const express = require('express');
const { body, param, validationResult } = require('express-validator');
const requireAuth = require('../middleware/requireAuth');
const { errorHandlingService } = require('../services/errorHandlingService');
const { loggingService } = require('../services/loggingService');
const personalizedRoadmapWorkflowService = require('../services/personalizedRoadmapWorkflowService');

const router = express.Router();

// POST /api/personalized-roadmap/generate -> generate personalized roadmap
router.post('/generate', requireAuth, [
  body('targetSkill').isString().trim().notEmpty().withMessage('Target skill is required'),
  body('learningStyle').optional().isString().trim(),
  body('timeCommitment').optional().isString().trim(),
  body('currentLevel').optional().isString().trim()
], errorHandlingService.asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { targetSkill, learningStyle, timeCommitment, currentLevel } = req.body;
  const userId = req.userId;

  try {
    loggingService.info('Starting personalized roadmap generation', {
      userId,
      targetSkill,
      learningStyle,
      timeCommitment,
      currentLevel
    });

    const result = await personalizedRoadmapWorkflowService.generatePersonalizedRoadmapWorkflow(
      userId,
      targetSkill,
      { learningStyle, timeCommitment, currentLevel }
    );

    if (!result.success) {
      loggingService.error('Personalized roadmap generation failed', {
        userId,
        targetSkill,
        error: result.error
      });
      return res.status(500).json({
        error: 'Roadmap generation failed',
        message: result.error || 'An error occurred during roadmap generation'
      });
    }

    loggingService.info('Personalized roadmap generated successfully', {
      userId,
      targetSkill,
      workflowId: result.workflowId
    });

    res.status(201).json({
      success: true,
      workflowId: result.workflowId,
      roadmap: result.roadmap,
      resources: result.resources,
      message: 'Personalized roadmap generated successfully'
    });

  } catch (error) {
    loggingService.error('Error in personalized roadmap generation endpoint', {
      error: error.message,
      userId,
      targetSkill
    });
    throw error;
  }
}));

// GET /api/personalized-roadmap/status/:workflowId -> get workflow status
router.get('/status/:workflowId', requireAuth, [
  param('workflowId').isString().trim().notEmpty().withMessage('Workflow ID is required')
], errorHandlingService.asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { workflowId } = req.params;
  const userId = req.userId;

  try {
    const status = await personalizedRoadmapWorkflowService.getWorkflowStatus(workflowId, userId);

    if (!status) {
      return res.status(404).json({
        error: 'Workflow not found',
        message: 'No workflow found with the provided ID'
      });
    }

    res.json({
      success: true,
      status
    });

  } catch (error) {
    loggingService.error('Error fetching workflow status', {
      error: error.message,
      workflowId,
      userId
    });
    throw error;
  }
}));

// GET /api/personalized-roadmap/statistics -> get global workflow statistics
router.get('/statistics', requireAuth, errorHandlingService.asyncHandler(async (req, res) => {
  try {
    const statistics = await personalizedRoadmapWorkflowService.getGlobalStatistics();

    res.json({
      success: true,
      statistics
    });

  } catch (error) {
    loggingService.error('Error fetching workflow statistics', {
      error: error.message
    });
    throw error;
  }
}));

module.exports = router;