const express = require('express');
const mongoose = require('mongoose');
const { param, body, validationResult } = require('express-validator');
const requireAuth = require('../middleware/requireAuth');
const { generateRoadmapForUser, getRoadmap } = require('../services/roadmapService');
const { updateRoadmapForWeakAreas, getRecommendations } = require('../services/adaptiveEngine');
const { generateRoadmapWithLLM } = require('../services/roadmapLlmService');

// Import models
const UserProfile = require('../models/UserProfile');
const Roadmap = require('../models/Roadmap');

// Import services
const { generateSkillSuggestions } = require('../services/skillSuggestionService');
const enhancedRoadmapService = require('../services/enhancedRoadmapService');
const userSkillAssessmentService = require('../services/userSkillAssessmentService');
const enhancedRoadmapGenerationService = require('../services/enhancedRoadmapGenerationService');
const cacheService = require('../services/cacheService');
const { loggingService } = require('../services/loggingService');
const { errorHandlingService, ErrorTypes } = require('../services/errorHandlingService');

const personalizedRoadmapWorkflowService = require('../services/personalizedRoadmapWorkflowService');

const router = express.Router();

// POST /api/roadmap/generate -> generate for current user from profile
router.post('/generate', requireAuth, async (req, res, next) => {
  try {
    console.log(req);
    console.log(req.userId);
    const roadmap = await generateRoadmapForUser(req.userId);
    return res.json({ roadmap });
  } catch (err) {
    return next(err);
  }
});

// GET /api/roadmap/:userId -> fetch roadmap (must be own)
router.get('/:userId', requireAuth, [param('userId').isString().isLength({ min: 1 })], async (req, res, next) => {
  try {
    console.log(req);
    console.log(req.userId);
    // if (req.params.userId !== req.body.userId) {
    //   return res.status(403).json({ error: 'Forbidden' });
    // }
    const roadmap = await getRoadmap(req.params.userId);
    if (!roadmap) return res.status(404).json({ error: 'Roadmap not found' });
    return res.json({ roadmap });
  } catch (err) {
    return next(err);
  }
});

// GET /api/roadmap/active -> get user's active roadmap
router.get('/active', requireAuth, async (req, res, next) => {
  try {
    const activeRoadmap = await Roadmap.findOne({
      userId: req.userId,
      status: 'active'
    }).sort({ updatedAt: -1 });

    return res.json({
      roadmap: activeRoadmap,
      hasActiveRoadmap: !!activeRoadmap
    });
  } catch (err) {
    console.error('Error fetching active roadmap:', err);
    return next(err);
  }
});

// GET /api/roadmap/user/status/:roadmapId -> check if roadmap is saved by user
router.get('/user/status/:roadmapId', requireAuth, [
  param('roadmapId').isMongoId().withMessage('Valid roadmap ID required')
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const savedRoadmap = await Roadmap.findOne({
      userId: req.userId,
      $or: [
        { _id: req.params.roadmapId },
        { originalRoadmapId: req.params.roadmapId }
      ]
    });

    return res.json({
      isSaved: !!savedRoadmap,
      roadmapId: savedRoadmap ? savedRoadmap._id : null,
      status: savedRoadmap ? savedRoadmap.status : null
    });
  } catch (err) {
    console.error('Error checking roadmap status:', err);
    return next(err);
  }
});

// POST /api/roadmap/analyze-requirements - Analyze skill gaps for user's goal
router.post('/analyze-requirements', requireAuth, [
  body('goal').isString().trim().notEmpty().withMessage('Goal is required'),
  body('currentSkills').optional().isArray().withMessage('Current skills must be an array'),
  body('targetRole').optional().isString().trim().withMessage('Target role must be a string')
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { goal, currentSkills = [], targetRole } = req.body;
    const userId = req.userId;

    // Get user profile for additional context
    const profile = await UserProfile.findOne({ userId });

    // Generate skill suggestions based on goal and current skills
    const skillSuggestions = await generateSkillSuggestions(
      goal,
      currentSkills,
      targetRole || profile?.targetRole,
      false // Use predefined mappings for now
    );

    // Analyze skill gaps
    const currentSkillNames = currentSkills.map(skill => skill.skillName.toLowerCase());
    const skillGaps = skillSuggestions.map(suggestion => {
      const currentSkill = currentSkills.find(cs =>
        cs.skillName.toLowerCase() === suggestion.skillName.toLowerCase()
      );

      return {
        skillName: suggestion.skillName,
        currentLevel: currentSkill ? currentSkill.proficiencyLevel : 'None',
        targetLevel: suggestion.category === 'Core' ? 'Advanced' :
                    suggestion.category === 'Advanced' ? 'Intermediate' : 'Beginner',
        priority: suggestion.priority === 'High' ? 10 :
                 suggestion.priority === 'Medium' ? 7 : 5,
        relevanceScore: suggestion.relevanceScore,
        category: suggestion.category,
        estimatedLearningTime: suggestion.estimatedLearningTime,
        description: suggestion.description
      };
    });

    // Sort by priority and relevance
    skillGaps.sort((a, b) => {
      if (a.priority !== b.priority) return b.priority - a.priority;
      return b.relevanceScore - a.relevanceScore;
    });

    return res.status(200).json({
      message: 'Skill requirements analyzed successfully',
      analysis: {
        goal,
        targetRole,
        totalSkillsAnalyzed: skillSuggestions.length,
        skillGaps: skillGaps.slice(0, 15), // Return top 15 skill gaps
        summary: {
          coreSkillsNeeded: skillGaps.filter(sg => sg.category === 'Core').length,
          advancedSkillsNeeded: skillGaps.filter(sg => sg.category === 'Advanced').length,
          complementarySkillsNeeded: skillGaps.filter(sg => sg.category === 'Complementary').length,
          estimatedTotalLearningTime: calculateTotalLearningTime(skillGaps)
        }
      }
    });
  } catch (err) {
    return next(err);
  }
});

// POST /api/roadmap/generate-preview - Generate roadmap preview
router.post('/generate-preview', requireAuth, [
  body('profileId').optional().isMongoId().withMessage('Valid profile ID required'),
  body('useResearchAgent').optional().isBoolean().withMessage('Use research agent must be boolean')
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { profileId, useResearchAgent = false } = req.body;
    const userId = req.userId;

    // Get user profile
    const profile = await UserProfile.findOne({
      userId,
      ...(profileId && { _id: profileId })
    });

    if (!profile) {
      return res.status(404).json({ error: 'User profile not found' });
    }

    // Validate that profile has required data for roadmap generation
    if (!profile.primaryGoal || !profile.timeline?.targetDuration || !profile.timeline?.weeklyTimeCommitment) {
      return res.status(400).json({
        error: 'Incomplete profile data. Please complete onboarding first.',
        missing: {
          primaryGoal: !profile.primaryGoal,
          targetDuration: !profile.timeline?.targetDuration,
          weeklyTimeCommitment: !profile.timeline?.weeklyTimeCommitment
        }
      });
    }

    // Generate roadmap using LLM service
    const roadmapData = await generateRoadmapWithLLM(userId, useResearchAgent);

    return res.status(200).json({
      message: 'Roadmap preview generated successfully',
      preview: {
        title: roadmapData.title,
        description: roadmapData.description,
        estimatedDuration: roadmapData.estimatedDuration,
        difficultyLevel: roadmapData.difficultyLevel,
        totalMilestones: roadmapData.milestones.length,
        totalSteps: roadmapData.steps.length,
        milestones: roadmapData.milestones.map(milestone => ({
          id: milestone.id,
          title: milestone.title,
          description: milestone.description,
          estimatedWeeks: milestone.estimatedWeeks,
          skills: milestone.skills
        })),
        weeklyBreakdown: generateWeeklyBreakdown(roadmapData.steps),
        generationMetadata: roadmapData.generationMetadata
      }
    });
  } catch (err) {
    return next(err);
  }
});

// Helper functions
function calculateTotalLearningTime(skillGaps) {
  // Simple estimation based on skill gaps
  const totalWeeks = skillGaps.reduce((total, skill) => {
    const timeStr = skill.estimatedLearningTime;
    const weeks = parseInt(timeStr.split('-')[0]) || 4;
    return total + weeks;
  }, 0);

  return `${Math.ceil(totalWeeks / 4)} months`;
}

function generateWeeklyBreakdown(steps) {
  const weeklyBreakdown = {};

  steps.forEach(step => {
    const week = step.week;
    if (!weeklyBreakdown[week]) {
      weeklyBreakdown[week] = {
        week,
        totalSteps: 0,
        totalMinutes: 0,
        stepTypes: {}
      };
    }

    weeklyBreakdown[week].totalSteps += 1;
    weeklyBreakdown[week].totalMinutes += step.estimatedMinutes;

    if (!weeklyBreakdown[week].stepTypes[step.type]) {
      weeklyBreakdown[week].stepTypes[step.type] = 0;
    }
    weeklyBreakdown[week].stepTypes[step.type] += 1;
  });

  return Object.values(weeklyBreakdown);
}

function calculateEstimatedCompletionDate(targetDuration, startDate = new Date()) {
  const durationMap = {
    '1 month': 30,
    '3 months': 90,
    '6 months': 180,
    '1 year': 365
  };

  const days = durationMap[targetDuration] || 90;
  const completionDate = new Date(startDate);
  completionDate.setDate(completionDate.getDate() + days);

  return completionDate;
}

function applyCustomizations(roadmapData, customizations) {
  const customizedData = { ...roadmapData };

  customizations.forEach(customization => {
    if (customization.type === 'step' && customization.stepId) {
      const step = customizedData.steps.find(s => s.day === customization.stepId);
      if (step) {
        if (customization.title) step.title = customization.title;
        if (customization.description) step.description = customization.description;
        if (customization.estimatedMinutes) step.estimatedMinutes = customization.estimatedMinutes;
      }
    } else if (customization.type === 'milestone' && customization.milestoneId) {
      const milestone = customizedData.milestones.find(m => m.id === customization.milestoneId);
      if (milestone) {
        if (customization.title) milestone.title = customization.title;
        if (customization.description) milestone.description = customization.description;
        if (customization.estimatedWeeks) milestone.estimatedWeeks = customization.estimatedWeeks;
      }
    }
  });

  return customizedData;
}

// Enhanced roadmap generation with LLM
router.post('/generate-enhanced-v2', async (req, res) => {
  try {
    const { targetSkill, provider = 'ollama', customizations = {} } = req.body;
    const userId = req.user?.id;

    if (!targetSkill) {
      return res.status(400).json({ 
        error: 'Target skill is required',
        code: 'MISSING_TARGET_SKILL'
      });
    }

    // Get user profile for personalization
    const userProfile = await UserProfile.findOne({ userId });
    if (!userProfile) {
      return res.status(404).json({ 
        error: 'User profile not found. Please complete onboarding first.',
        code: 'PROFILE_NOT_FOUND'
      });
    }

    console.log(`Generating enhanced roadmap for user ${userId}, skill: ${targetSkill}`);

    // Generate enhanced roadmap using LLM
    const roadmapData = await enhancedRoadmapService.generateEnhancedRoadmap(
      userProfile,
      targetSkill,
      provider,
      customizations
    );

    res.json({
      success: true,
      roadmap: roadmapData,
      metadata: {
        generatedAt: new Date(),
        provider,
        targetSkill,
        customizations
      }
    });

  } catch (error) {
    console.error('Enhanced roadmap generation error:', error);
    res.status(500).json({ 
      error: 'Failed to generate enhanced roadmap',
      details: error.message,
      code: 'ENHANCED_GENERATION_FAILED'
    });
  }
});

// Personalized roadmap generation with skill exclusion and web scraping
router.post('/generate-personalized', errorHandlingService.asyncHandler(async (req, res) => {
  const startTime = Date.now();
  const { 
    targetSkill, 
    provider = 'ollama', 
    useWebScraping = true,
    excludeKnownSkills = true,
    customizations = {} 
  } = req.body;
  const userId = req.user?.id;

  try {
    loggingService.info('Starting personalized roadmap generation', {
      userId,
      targetSkill,
      provider,
      useWebScraping,
      excludeKnownSkills
    });

    // Validation
    if (!targetSkill) {
      throw errorHandlingService.handleValidationError(
        'Target skill is required',
        { targetSkill: !!targetSkill }
      );
    }

    if (!userId) {
      throw errorHandlingService.createError(
        ErrorTypes.AUTHENTICATION_ERROR,
        'User authentication required',
        null,
        { userId }
      );
    }

    // Check if user profile exists
    const userProfile = await UserProfile.findOne({ userId });
    if (!userProfile) {
      throw errorHandlingService.createError(
        ErrorTypes.VALIDATION_ERROR,
        'User profile not found. Please complete onboarding first.',
        null,
        { userId }
      );
    }

    loggingService.info(`Generating personalized roadmap for user ${userId}, skill: ${targetSkill}`);

    // Import the enhanced roadmap generation service
    const { generatePersonalizedRoadmap } = require('../services/enhancedRoadmapGenerationService');

    // Generate personalized roadmap with retry mechanism
    const result = await errorHandlingService.retryOperation(async () => {
      return await generatePersonalizedRoadmap(userId, targetSkill, {
        provider,
        useWebScraping,
        excludeKnownSkills,
        customizations
      });
    }, 2, 1000);

    const duration = Date.now() - startTime;

    // Track successful generation

    loggingService.logRoadmapGeneration(userId, targetSkill, 'completed', {
      duration,
      roadmapId: result.roadmap._id
    });

    res.json({
      success: true,
      roadmap: result.roadmap,
      skillAssessment: {
        excludedSkills: result.metadata.excludedSkills,
        learningPriorities: result.metadata.learningPriorities,
        estimatedDuration: result.metadata.estimatedDuration,
        skillCoverage: result.skillAssessment.skillCoverage
      },
      metadata: {
        generatedAt: result.metadata.generatedAt,
        provider,
        targetSkill,
        industryDataSources: result.metadata.industryDataSources,
        personalizationApplied: true,
        webScrapingUsed: useWebScraping,
        customizations,
        generationTime: duration
      }
    });

  } catch (error) {
    const duration = Date.now() - startTime;

    // Track failed generation

    loggingService.logRoadmapGeneration(userId, targetSkill, 'failed', {
      duration,
      error: error.message
    });
    
    // Handle specific error types
    if (error.message.includes('skill assessment')) {
      throw errorHandlingService.handleAIServiceError(
        error,
        'skill_assessment',
        'user_skill_evaluation'
      );
    }
    
    if (error.message.includes('web scraping')) {
      throw errorHandlingService.handleWebScrapingError(
        error,
        'industry_data',
        null
      );
    }
    
    if (error.message.includes('AI')) {
      throw errorHandlingService.handleAIServiceError(
        error,
        'roadmap_generation',
        'llm_processing'
      );
    }

    // Re-throw if it's already a handled error
    if (error.type) {
      throw error;
    }

    // Handle unexpected errors
    throw errorHandlingService.createError(
      ErrorTypes.INTERNAL_ERROR,
      'Failed to generate personalized roadmap',
      error,
      { userId, targetSkill }
    );
  }
}));

// Skill assessment endpoint
router.post('/assess-skills', errorHandlingService.asyncHandler(async (req, res) => {
  const startTime = Date.now();
  const { targetSkill } = req.body;
  const userId = req.user?.id;

  try {
    loggingService.info('Starting skill assessment', {
      userId,
      targetSkill
    });

    // Validate required fields
    if (!targetSkill) {
      throw errorHandlingService.handleValidationError(
        'Target skill is required',
        { targetSkill: !!targetSkill }
      );
    }

    if (!userId) {
      throw errorHandlingService.createError(
        ErrorTypes.AUTHENTICATION_ERROR,
        'User authentication required',
        null,
        { userId }
      );
    }

    // Check if user profile exists
    const userProfile = await UserProfile.findOne({ userId });
    if (!userProfile) {
      throw errorHandlingService.createError(
        ErrorTypes.VALIDATION_ERROR,
        'User profile not found. Please complete your profile first.',
        null,
        { userId }
      );
    }

    console.log(`Assessing skills for user ${userId}, target: ${targetSkill}`);

    // Import skill assessment service
    const { assessUserSkills } = require('../services/userSkillAssessmentService');

    // Perform skill assessment with retry mechanism
    const assessment = await errorHandlingService.retryOperation(async () => {
      return await assessUserSkills(userId, targetSkill);
    }, 2, 1000);

    const duration = Date.now() - startTime;

    // Track successful assessment
    monitoringService.trackSkillAssessment(true, duration, {
      userId,
      targetSkill,
      skillsFound: assessment.currentSkills?.length || 0,
      gapsIdentified: assessment.skillGaps?.length || 0
    });

    loggingService.logSkillAssessment(userId, targetSkill, assessment, {
      duration
    });

    res.json({
      success: true,
      assessment: {
        targetSkill: assessment.targetSkill,
        skillCoverage: assessment.skillCoverage,
        skillGaps: assessment.skillGaps,
        learningPriorities: assessment.learningPriorities,
        estimatedLearningTime: assessment.estimatedLearningTime,
        excludedSkills: assessment.currentSkills
          .filter(skill => skill.shouldExclude)
          .map(skill => skill.name)
      },
      metadata: {
        assessedAt: assessment.assessmentDate,
        userId,
        assessmentTime: duration
      }
    });

  } catch (error) {
    const duration = Date.now() - startTime;

    // Track failed assessment

    loggingService.error('Skill assessment failed', error, {
      userId,
      targetSkill,
      duration
    });

    // Re-throw if it's already a handled error
    if (error.type) {
      throw error;
    }

    // Handle unexpected errors
    throw errorHandlingService.createError(
      ErrorTypes.INTERNAL_ERROR,
      'Failed to assess user skills',
      error,
      { userId, targetSkill }
    );
  }
}));

// Progress tracking endpoints
router.post('/:roadmapId/progress/step', async (req, res) => {
  try {
    const { roadmapId } = req.params;
    const { stepId, timeSpent, completed = true } = req.body;
    const userId = req.user?.id;

    if (!stepId) {
      return res.status(400).json({ 
        error: 'Step ID is required',
        code: 'MISSING_STEP_ID'
      });
    }

    // Find and update roadmap
    const roadmap = await Roadmap.findOne({ _id: roadmapId, userId });
    if (!roadmap) {
      return res.status(404).json({ 
        error: 'Roadmap not found',
        code: 'ROADMAP_NOT_FOUND'
      });
    }

    // Update step progress
    const step = roadmap.steps.find(s => s._id.toString() === stepId);
    if (!step) {
      return res.status(404).json({ 
        error: 'Step not found',
        code: 'STEP_NOT_FOUND'
      });
    }

    step.completed = completed;
    step.completedAt = completed ? new Date() : null;
    
    if (timeSpent) {
      roadmap.progress.totalTimeSpent += timeSpent;
    }

    // Update overall progress
    const completedSteps = roadmap.steps.filter(s => s.completed).length;
    roadmap.progress.completedSteps = completedSteps;
    roadmap.progress.percentageComplete = Math.round((completedSteps / roadmap.steps.length) * 100);

    // Check if milestone is completed
    const milestone = roadmap.milestones.find(m => m.id === step.milestoneId);
    if (milestone) {
      const milestoneSteps = roadmap.steps.filter(s => s.milestoneId === milestone.id);
      const completedMilestoneSteps = milestoneSteps.filter(s => s.completed).length;
      
      if (completedMilestoneSteps === milestoneSteps.length && !milestone.completed) {
        milestone.completed = true;
        milestone.completedAt = new Date();
        roadmap.progress.completedMilestones += 1;
      }
    }

    await roadmap.save();

    res.json({
      success: true,
      progress: {
        stepCompleted: completed,
        totalProgress: roadmap.progress.percentageComplete,
        completedSteps: roadmap.progress.completedSteps,
        totalSteps: roadmap.steps.length,
        completedMilestones: roadmap.progress.completedMilestones,
        totalMilestones: roadmap.milestones.length,
        timeSpent: roadmap.progress.totalTimeSpent
      }
    });

  } catch (error) {
    console.error('Progress update error:', error);
    res.status(500).json({ 
      error: 'Failed to update progress',
      details: error.message,
      code: 'PROGRESS_UPDATE_FAILED'
    });
  }
});

// Get roadmap progress
router.get('/:roadmapId/progress', async (req, res) => {
  try {
    const { roadmapId } = req.params;
    const userId = req.user?.id;

    const roadmap = await Roadmap.findOne({ _id: roadmapId, userId });
    if (!roadmap) {
      return res.status(404).json({ 
        error: 'Roadmap not found',
        code: 'ROADMAP_NOT_FOUND'
      });
    }

    // Calculate detailed progress
    const completedSteps = roadmap.steps.filter(s => s.completed);
    const completedMilestones = roadmap.milestones.filter(m => m.completed);
    
    // Calculate weekly progress
    const weeklyProgress = calculateWeeklyProgress(roadmap.steps);
    
    // Calculate streak
    const streak = calculateLearningStreak(completedSteps);

    res.json({
      success: true,
      progress: {
        overall: {
          percentageComplete: roadmap.progress.percentageComplete,
          completedSteps: completedSteps.length,
          totalSteps: roadmap.steps.length,
          completedMilestones: completedMilestones.length,
          totalMilestones: roadmap.milestones.length,
          totalTimeSpent: roadmap.progress.totalTimeSpent,
          estimatedTimeRemaining: calculateEstimatedTimeRemaining(roadmap)
        },
        milestones: roadmap.milestones.map(milestone => ({
          id: milestone.id,
          title: milestone.title,
          completed: milestone.completed,
          completedAt: milestone.completedAt,
          progress: calculateMilestoneProgress(milestone, roadmap.steps)
        })),
        recentActivity: completedSteps
          .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt))
          .slice(0, 10)
          .map(step => ({
            stepId: step._id,
            title: step.title,
            completedAt: step.completedAt,
            timeSpent: step.timeSpent || 0
          })),
        weeklyProgress,
        streak: {
          current: streak,
          longest: roadmap.progress.longestStreak || streak
        }
      }
    });

  } catch (error) {
    console.error('Progress retrieval error:', error);
    res.status(500).json({ 
      error: 'Failed to retrieve progress',
      details: error.message,
      code: 'PROGRESS_RETRIEVAL_FAILED'
    });
  }
});

// Cache management endpoints
router.delete('/cache', async (req, res) => {
  try {
    const userId = req.user?.id;

    // Import cache service
    const { clearCache, deleteCachedData, generateSkillAssessmentKey, generateRoadmapKey } = require('../services/cacheService');

    if (userId) {
      // Clear user-specific cache
      const userCacheKeys = [
        generateSkillAssessmentKey(userId, '*'),
        generateRoadmapKey(userId, '*')
      ];
      
      for (const key of userCacheKeys) {
        await deleteCachedData(key);
      }
      
      res.json({
        success: true,
        message: 'User cache cleared successfully'
      });
    } else {
      res.status(400).json({
        error: 'User ID required for cache clearing',
        code: 'MISSING_USER_ID'
      });
    }

  } catch (error) {
    console.error('Cache management error:', error);
    res.status(500).json({ 
      error: 'Failed to manage cache',
      details: error.message,
      code: 'CACHE_MANAGEMENT_FAILED'
    });
  }
});

router.delete('/cache/:cacheType', async (req, res) => {
  try {
    const { cacheType } = req.params;
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    let result;
    // Clear specific cache type
    switch (cacheType) {
      case 'skill-assessment':
        const skillKey = cacheService.generateSkillAssessmentKey(userId, '*');
        result = await cacheService.deleteCachedData(skillKey);
        break;
      case 'roadmap':
        const roadmapKey = cacheService.generateRoadmapKey(userId, '*');
        result = await cacheService.deleteCachedData(roadmapKey);
        break;
      case 'industry':
        const industryKey = cacheService.generateIndustryDataKey('*');
        result = await cacheService.deleteCachedData(industryKey);
        break;
      case 'all':
        result = await cacheService.clearCache({ userOnly: false });
        break;
      default:
        return res.status(400).json({ error: 'Invalid cache type' });
    }

    res.json({
      success: true,
      message: `Cache ${cacheType} cleared successfully`,
      result
    });
  } catch (error) {
    console.error('Cache clear error:', error);
    res.status(500).json({ error: 'Failed to clear cache' });
  }
});

// Helper functions for progress calculations
function calculateWeeklyProgress(steps) {
  const weeklyData = {};
  const now = new Date();
  
  for (let i = 6; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const dateKey = date.toISOString().split('T')[0];
    weeklyData[dateKey] = 0;
  }
  
  steps.forEach(step => {
    if (step.completed && step.completedAt) {
      const completedDate = new Date(step.completedAt).toISOString().split('T')[0];
      if (weeklyData.hasOwnProperty(completedDate)) {
        weeklyData[completedDate]++;
      }
    }
  });
  
  return Object.entries(weeklyData).map(([date, count]) => ({ date, count }));
}

function calculateLearningStreak(completedSteps) {
  if (completedSteps.length === 0) return 0;
  
  const sortedSteps = completedSteps
    .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt));
  
  let streak = 0;
  let currentDate = new Date();
  currentDate.setHours(0, 0, 0, 0);
  
  for (const step of sortedSteps) {
    const stepDate = new Date(step.completedAt);
    stepDate.setHours(0, 0, 0, 0);
    
    const daysDiff = Math.floor((currentDate - stepDate) / (1000 * 60 * 60 * 24));
    
    if (daysDiff === streak || (streak === 0 && daysDiff <= 1)) {
      streak++;
      currentDate.setDate(currentDate.getDate() - 1);
    } else {
      break;
    }
  }
  
  return streak;
}

function calculateMilestoneProgress(milestone, steps) {
  const milestoneSteps = steps.filter(s => s.milestoneId === milestone.id);
  const completedSteps = milestoneSteps.filter(s => s.completed);
  
  return {
    completed: completedSteps.length,
    total: milestoneSteps.length,
    percentage: milestoneSteps.length > 0 ? Math.round((completedSteps.length / milestoneSteps.length) * 100) : 0
  };
}

function calculateEstimatedTimeRemaining(roadmap) {
  const remainingSteps = roadmap.steps.filter(s => !s.completed);
  const totalEstimatedMinutes = remainingSteps.reduce((total, step) => {
    return total + (step.estimatedMinutes || 120); // Default 2 hours per step
  }, 0);
  
  return Math.round(totalEstimatedMinutes / 60); // Return hours
}

// GET /api/roadmap/details/:description -> fetch roadmap details by description
router.get('/details/:description', requireAuth, [
  param('description').isString().trim().notEmpty().withMessage('Description is required')
], errorHandlingService.asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { description } = req.params;
  const cacheKey = `roadmap_details_${description.toLowerCase().replace(/\s+/g, '_')}`;
  
  try {
    // Check cache first
    const cachedRoadmap = await cacheService.getCachedData(cacheKey);
    if (cachedRoadmap) {
      loggingService.info('Roadmap details served from cache', { description, userId: req.userId });
      return res.json({ roadmap: cachedRoadmap, fromCache: true });
    }

    // Find roadmap by description or title
    const roadmap = await Roadmap.findOne({
      $or: [
        { description: { $regex: description, $options: 'i' } },
        { title: { $regex: description, $options: 'i' } },
        { tags: { $in: [new RegExp(description, 'i')] } }
      ],
      isPublic: true
    }).populate('userId', 'username email');

    if (!roadmap) {
      return res.status(404).json({ 
        error: 'Roadmap not found', 
        message: 'No public roadmap found matching the description' 
      });
    }

    // Enhance roadmap data with additional metadata
    const enhancedRoadmap = {
      ...roadmap.toObject(),
      levelSummaries: roadmap.milestones.map(milestone => ({
        id: milestone.id,
        title: milestone.title,
        description: milestone.description,
        estimatedWeeks: milestone.estimatedWeeks,
        skills: milestone.skills,
        stepCount: roadmap.steps.filter(step => step.milestoneId === milestone.id).length,
        totalMinutes: roadmap.steps
          .filter(step => step.milestoneId === milestone.id)
          .reduce((sum, step) => sum + step.estimatedMinutes, 0)
      })),
      totalSteps: roadmap.steps.length,
      totalEstimatedHours: Math.round(roadmap.steps.reduce((sum, step) => sum + step.estimatedMinutes, 0) / 60),
      skillsRequired: [...new Set(roadmap.steps.flatMap(step => step.skills))],
      resourceTypes: [...new Set(roadmap.steps.flatMap(step => step.resources.map(r => r.type)))]
    };

    // Cache the result
    await cacheService.setCachedData(cacheKey, enhancedRoadmap, { ttl: 3600 }); // Cache for 1 hour
    
    loggingService.info('Roadmap details fetched successfully', { 
      description, 
      roadmapId: roadmap._id, 
      userId: req.userId 
    });

    res.json({ roadmap: enhancedRoadmap });
  } catch (error) {
    loggingService.error('Error fetching roadmap details', { error: error.message, description, userId: req.userId });
    throw error;
  }
}));

// POST /api/roadmap/:roadmapId/save -> save roadmap to user profile and mark as active
router.post('/:roadmapId/save', requireAuth, [
  param('roadmapId').isMongoId().withMessage('Valid roadmap ID required')
], errorHandlingService.asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { roadmapId } = req.params;
  const userId = req.userId;

  try {
    // Check if roadmap exists and is public
    const sourceRoadmap = await Roadmap.findOne({ _id: roadmapId, isPublic: true });
    if (!sourceRoadmap) {
      return res.status(404).json({ 
        error: 'Roadmap not found', 
        message: 'Roadmap not found or not publicly available' 
      });
    }

    // Check if user already has an active roadmap
    const existingRoadmap = await Roadmap.findOne({ userId, status: 'active' });
    if (existingRoadmap) {
      return res.status(409).json({ 
        error: 'Active roadmap exists', 
        message: 'You already have an active roadmap. Please complete or archive it first.',
        existingRoadmap: {
          id: existingRoadmap._id,
          title: existingRoadmap.title,
          progress: existingRoadmap.progress.percentageComplete
        }
      });
    }

    // Get user profile
    const userProfile = await UserProfile.findOne({ userId });
    if (!userProfile) {
      return res.status(404).json({ 
        error: 'Profile not found', 
        message: 'User profile not found. Please complete onboarding first.' 
      });
    }

    // Create a copy of the roadmap for the user
    const userRoadmap = new Roadmap({
      userId,
      profileId: userProfile._id,
      title: sourceRoadmap.title,
      description: sourceRoadmap.description,
      estimatedDuration: sourceRoadmap.estimatedDuration,
      difficultyLevel: sourceRoadmap.difficultyLevel,
      category: sourceRoadmap.category,
      tags: sourceRoadmap.tags,
      milestones: sourceRoadmap.milestones.map(milestone => ({
        ...milestone.toObject(),
        completed: false,
        completedAt: null
      })),
      steps: sourceRoadmap.steps.map(step => ({
        ...step.toObject(),
        completed: false,
        completedAt: null
      })),
      generationMetadata: {
        ...sourceRoadmap.generationMetadata,
        generatedAt: new Date(),
        version: '1.0',
        generatedWith: 'template'
      },
      progress: {
        completedSteps: 0,
        totalSteps: sourceRoadmap.steps.length,
        completedMilestones: 0,
        totalMilestones: sourceRoadmap.milestones.length,
        percentageComplete: 0,
        currentStep: 1,
        currentMilestone: sourceRoadmap.milestones[0]?.id,
        estimatedCompletionDate: new Date(Date.now() + (parseInt(sourceRoadmap.estimatedDuration) * 30 * 24 * 60 * 60 * 1000)),
        actualStartDate: new Date(),
        streakDays: 0,
        totalTimeSpent: 0
      },
      status: 'active',
      isPublic: false
    });

    await userRoadmap.save();

    // Update user profile to mark roadmap as generated
    userProfile.roadmapGenerated = true;
    await userProfile.save();

    loggingService.info('Roadmap saved to user profile', { 
      userId, 
      roadmapId, 
      newRoadmapId: userRoadmap._id 
    });

    res.status(201).json({ 
      message: 'Roadmap saved successfully',
      roadmap: userRoadmap,
      startUrl: `/roadmap/${userRoadmap._id}`
    });
  } catch (error) {
    loggingService.error('Error saving roadmap to user profile', { 
      error: error.message, 
      userId, 
      roadmapId 
    });
    throw error;
  }
}));

// POST /api/roadmap/:roadmapId/summarize-level -> generate AI summary for a specific level
router.post('/:roadmapId/summarize-level', requireAuth, [
  param('roadmapId').isMongoId().withMessage('Valid roadmap ID required'),
  body('milestoneId').isString().trim().notEmpty().withMessage('Milestone ID is required')
], errorHandlingService.asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { roadmapId } = req.params;
  const { milestoneId } = req.body;
  const cacheKey = `level_summary_${roadmapId}_${milestoneId}`;

  try {
    // Check cache first
    const cachedSummary = cacheService.getCachedData(cacheKey);
    if (cachedSummary) {
      loggingService.info('Level summary served from cache', { roadmapId, milestoneId, userId: req.userId });
      return res.json({ summary: cachedSummary, fromCache: true });
    }

    // Find roadmap and milestone
    const roadmap = await Roadmap.findById(roadmapId);
    if (!roadmap) {
      return res.status(404).json({ error: 'Roadmap not found' });
    }

    const milestone = roadmap.milestones.find(m => m.id === milestoneId);
    if (!milestone) {
      return res.status(404).json({ error: 'Milestone not found' });
    }

    // Get all steps for this milestone
    const milestoneSteps = roadmap.steps.filter(step => step.milestoneId === milestoneId);
    
    // Use research agent service for AI summarization
    const researchAgentService = require('../services/researchAgentService');
    
    const summaryPrompt = `
      Generate a concise, actionable summary for this learning milestone:
      
      Milestone: ${milestone.title}
      Description: ${milestone.description}
      Skills to Learn: ${milestone.skills.join(', ')}
      Estimated Duration: ${milestone.estimatedWeeks} weeks
      
      Learning Steps:
      ${milestoneSteps.map((step, index) => 
        `${index + 1}. ${step.title} (${step.type}, ${step.estimatedMinutes} min)\n   - ${step.description}\n   - Skills: ${step.skills.join(', ')}`
      ).join('\n\n')}
      
      Please provide:
      1. A brief overview of what the learner will accomplish
      2. Key skills and concepts they'll master
      3. Practical outcomes and deliverables
      4. Tips for success in this milestone
      
      Keep it concise but comprehensive, around 200-300 words.
    `;

    const summary = await researchAgentService.summarizeContent(summaryPrompt);
    
    const enhancedSummary = {
      milestoneId,
      title: milestone.title,
      aiSummary: summary,
      keySkills: milestone.skills,
      estimatedWeeks: milestone.estimatedWeeks,
      stepCount: milestoneSteps.length,
      totalMinutes: milestoneSteps.reduce((sum, step) => sum + step.estimatedMinutes, 0),
      difficulty: roadmap.difficultyLevel,
      generatedAt: new Date()
    };

    // Cache the summary
    cacheService.set(cacheKey, enhancedSummary, 7200); // Cache for 2 hours
    
    loggingService.info('Level summary generated successfully', { 
      roadmapId, 
      milestoneId, 
      userId: req.userId 
    });

    res.json({ summary: enhancedSummary });
  } catch (error) {
    loggingService.error('Error generating level summary', { 
      error: error.message, 
      roadmapId, 
      milestoneId, 
      userId: req.userId 
    });
    throw error;
  }
}));

// POST /api/roadmap/generate-and-save -> generate new roadmap with AI and web scraping, then save
router.post('/generate-and-save', requireAuth, [
  body('title').isString().trim().notEmpty().withMessage('Title is required'),
  body('description').isString().trim().notEmpty().withMessage('Description is required'),
  body('category').optional().isString().trim().withMessage('Category must be a string'),
  body('difficultyLevel').optional().isIn(['Beginner', 'Intermediate', 'Advanced']).withMessage('Invalid difficulty level'),
  body('enableWebScraping').optional().isBoolean().withMessage('Enable web scraping must be boolean'),
  body('timeframeWeeks').optional().isInt({ min: 1, max: 52 }).withMessage('Timeframe must be between 1-52 weeks'),
  body('dailyTimeMinutes').optional().isInt({ min: 15, max: 480 }).withMessage('Daily time must be between 15-480 minutes')
], errorHandlingService.asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const {
    title,
    description,
    category = 'General',
    difficultyLevel = 'Intermediate',
    enableWebScraping = true,
    timeframeWeeks = 12,
    dailyTimeMinutes = 60
  } = req.body;

  try {
    // Check if user already has an active roadmap
    const existingActiveRoadmap = await Roadmap.findOne({
      userId: req.userId,
      status: 'active'
    });

    if (existingActiveRoadmap) {
      return res.status(409).json({
        error: 'Active roadmap exists',
        message: 'You already have an active roadmap. Please complete or archive it first.',
        existingRoadmap: existingActiveRoadmap
      });
    }

    // Generate personalized roadmap using existing service
    const roadmapData = {
      skill: title,
      level: difficultyLevel.toLowerCase(),
      timeframeWeeks,
      dailyTimeMinutes,
      focus: description,
      enableWebScraping,
      excludeKnownSkills: true
    };

    const generatedRoadmap = await enhancedRoadmapGenerationService.generatePersonalizedRoadmap(
      req.userId,
      roadmapData
    );

    // Create and save the roadmap
    const roadmap = new Roadmap({
      userId: req.userId,
      title,
      description,
      category,
      difficultyLevel,
      estimatedDuration: `${timeframeWeeks} weeks`,
      tags: [category, difficultyLevel.toLowerCase()],
      milestones: generatedRoadmap.milestones || [],
      steps: generatedRoadmap.steps || [],
      progress: {
        completedSteps: 0,
        totalSteps: generatedRoadmap.steps ? generatedRoadmap.steps.length : 0,
        completedMilestones: 0,
        totalMilestones: generatedRoadmap.milestones ? generatedRoadmap.milestones.length : 0,
        percentageComplete: 0,
        currentStep: 0,
        streakDays: 0,
        totalTimeSpent: 0
      },
      status: 'active',
      isPublic: false,
      totalEstimatedHours: Math.ceil((timeframeWeeks * 7 * dailyTimeMinutes) / 60),
      skillsRequired: generatedRoadmap.skillsRequired || [],
      resourceTypes: generatedRoadmap.resourceTypes || []
    });

    await roadmap.save();

    // Log the generation
    await loggingService.logActivity({
      userId: req.userId,
      action: 'roadmap_generated_and_saved',
      details: {
        roadmapId: roadmap._id,
        title,
        category,
        difficultyLevel,
        webScrapingUsed: enableWebScraping
      }
    });

    return res.status(201).json({
      roadmap,
      message: 'Roadmap generated and saved successfully',
      generatedWithAI: true,
      webScrapingUsed: enableWebScraping
    });

  } catch (error) {
    console.error('Error generating and saving roadmap:', error);
    
    // Handle specific errors
    if (error.message && error.message.includes('generation failed')) {
      return res.status(500).json({
        error: 'Generation failed',
        message: 'Failed to generate roadmap content. Please try again.'
      });
    }

    throw error;
  }
}));

// POST /api/roadmap/generate-personalized-workflow -> Start personalized roadmap workflow
router.post('/generate-personalized-workflow', requireAuth, [
  body('targetSkill').isString().trim().notEmpty().withMessage('Target skill is required'),
  body('options').optional().isObject().withMessage('Options must be an object')
], errorHandlingService.asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { targetSkill, options = {} } = req.body;
  const userId = req.userId;

  try {
    loggingService.info('Starting personalized roadmap workflow', {
      userId,
      targetSkill,
      options
    });

    const workflowId = await personalizedRoadmapWorkflowService.generatePersonalizedRoadmapWorkflow(
      userId,
      targetSkill,
      options
    );

    res.status(202).json({
      success: true,
      workflowId,
      message: 'Personalized roadmap workflow started',
      statusUrl: `/api/roadmap/workflow-status/${workflowId}`
    });

  } catch (error) {
    loggingService.error('Error starting personalized roadmap workflow', {
      error: error.message,
      userId,
      targetSkill
    });
    throw error;
  }
}));

// GET /api/roadmap/workflow-status/:workflowId -> Get workflow status
router.get('/workflow-status/:workflowId', requireAuth, [
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
        message: 'The specified workflow does not exist or does not belong to you'
      });
    }

    res.json({
      success: true,
      workflow: status
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

// GET /api/roadmap/workflow-history -> Get user's workflow history
router.get('/workflow-history', requireAuth, errorHandlingService.asyncHandler(async (req, res) => {
  const userId = req.userId;
  const { page = 1, limit = 10 } = req.query;

  try {
    const history = await personalizedRoadmapWorkflowService.getUserWorkflowHistory(
      userId,
      parseInt(page),
      parseInt(limit)
    );

    res.json({
      success: true,
      workflows: history.workflows,
      pagination: {
        currentPage: parseInt(page),
        totalPages: history.totalPages,
        totalWorkflows: history.totalCount,
        hasNext: history.hasNext,
        hasPrev: history.hasPrev
      }
    });

  } catch (error) {
    loggingService.error('Error fetching workflow history', {
      error: error.message,
      userId
    });
    throw error;
  }
}));

// GET /api/roadmap/active-workflows -> Get user's active workflows
router.get('/active-workflows', requireAuth, errorHandlingService.asyncHandler(async (req, res) => {
  const userId = req.userId;

  try {
    const activeWorkflows = await personalizedRoadmapWorkflowService.getActiveWorkflows(userId);

    res.json({
      success: true,
      workflows: activeWorkflows,
      count: activeWorkflows.length
    });

  } catch (error) {
    loggingService.error('Error fetching active workflows', {
      error: error.message,
      userId
    });
    throw error;
  }
}));

// GET /api/roadmap/workflow-statistics -> Get global workflow statistics
router.get('/workflow-statistics', requireAuth, errorHandlingService.asyncHandler(async (req, res) => {
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

// POST /api/roadmap/update -> update roadmap using memory bank
router.post('/update', async (req, res, next) => {
  try {
    const roadmap = await updateRoadmapForWeakAreas(req.userId);
    if (!roadmap) return res.status(404).json({ error: 'Roadmap not found' });
    return res.json({ roadmap });
  } catch (err) {
    return next(err);
  }
});

// GET /api/roadmap/recommendations -> short list of suggestions
router.get('/recommendations/list', async (req, res, next) => {
  try {
    const recs = await getRecommendations(req.userId);
    return res.json({ recommendations: recs });
  } catch (err) {
    return next(err);
  }
});

// POST /api/roadmap/generate-llm -> use Ollama to create roadmap
router.post('/generate-llm', async (req, res, next) => {
  try {
    const roadmap = await generateRoadmapWithLLM(req.userId);
    return res.json({ roadmap });
  } catch (err) {
    return next(err);
  }
});

// GET /api/roadmap/recommendations/ai - Profile-based AI recommendations (25 items)
router.get('/recommendations/ai', requireAuth, async (req, res, next) => {
  try {
    const profile = await UserProfile.findOne({ userId: req.userId });
    const skills = Array.isArray(profile?.skills) ? profile.skills.map(s => s.name || s.skillName).filter(Boolean) : [];
    const experience = profile?.experienceLevel || profile?.level || 'beginner';

    const { chat, extractJSON } = require('../services/llmClient');
    const prompt = `You are an expert learning path curator. Using the following user context, recommend 25 career-growth learning roadmaps.
User skills: ${skills.join(', ') || 'none'}
Experience: ${experience}
Return JSON strictly in this shape:
{
  "items": [
    {"id":"slug","title":"...","description":"...","image":"url-or-empty","resources":[{"title":"...","url":"..."}],"demoProjects":[{"title":"...","url":"..."}]}
  ]
}`;

    const text = await chat([{ role: 'user', content: prompt }]);
    let data = extractJSON(text) || { items: [] };

    // Fallback if missing/short
    if (!Array.isArray(data.items) || data.items.length < 10) {
      data.items = (data.items || []).concat(Array.from({ length: 25 - (data.items?.length || 0) }, (_, i) => ({
        id: `ai-rec-${i+1}`,
        title: `Recommended Roadmap ${i+1}`,
        description: 'AI suggested roadmap.',
        image: '', resources: [], demoProjects: []
      })));
    }

    // Limit to 25
    data.items = data.items.slice(0, 25);
    return res.json({ recommendations: data.items });
  } catch (err) {
    return next(err);
  }
});

// GET /api/roadmap/recommendations/trending - Global trending roadmaps (25)
router.get('/recommendations/trending', requireAuth, async (req, res, next) => {
  try {
    const { performWebSearch } = require('../services/researchAgentService');
    const { chat, extractJSON } = require('../services/llmClient');

    // Seed with quick web search topics
    const seed = await performWebSearch('top trending technologies and developer skills 2025', 8);
    const seedList = seed.map(s => s.title).join(', ');

    const prompt = `From the following trending topics: ${seedList}. Create 25 ranked learning roadmaps irrespective of user skills.
Return JSON with {"items":[{"id":"slug","title":"...","description":"...","image":"","resources":[{"title":"","url":""}],"demoProjects":[{"title":"","url":""}]}]}`;

    const text = await chat([{ role: 'user', content: prompt }]);
    let data = extractJSON(text) || { items: [] };
    if (!Array.isArray(data.items) || data.items.length < 10) {
      data.items = (data.items || []).concat(Array.from({ length: 25 - (data.items?.length || 0) }, (_, i) => ({
        id: `trending-${i+1}`,
        title: `Trending Roadmap ${i+1}`,
        description: 'Trending roadmap',
        image: '', resources: [], demoProjects: []
      })));
    }
    data.items = data.items.slice(0, 25);
    return res.json({ recommendations: data.items });
  } catch (err) {
    return next(err);
  }
});


// POST /api/roadmap/generate-enhanced -> Enhanced profile-based roadmap with Ollama
router.post('/generate-enhanced', requireAuth, [
  body('provider').optional().isIn(['ollama', 'openrouter']).withMessage('Provider must be ollama or openrouter'),
  body('useResearchAgent').optional().isBoolean().withMessage('Use research agent must be boolean')
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { provider = 'ollama', useResearchAgent = false } = req.body;

    // Check if user has a profile for enhanced generation
    const profile = await UserProfile.findOne({ userId: req.userId });
    if (!profile) {
      return res.status(400).json({
        error: 'User profile required for enhanced roadmap generation',
        suggestion: 'Please complete your profile first at /api/profile'
      });
    }

    const roadmap = await generateRoadmapWithLLM(req.userId, useResearchAgent, provider);

    return res.json({
      roadmap,
      generationInfo: {
        provider,
        model: provider === 'ollama' ? process.env.OLLAMA_MODEL || 'phi3:mini' : 'openrouter',
        profileBased: true,
        useResearchAgent,
        profileData: {
          skill: profile.skill,
          level: profile.level,
          dailyTime: profile.dailyTime,
          goal: profile.learningGoal
        }
      }
    });
  } catch (err) {
     console.error('Enhanced roadmap generation error:', err.message);
     return next(err);
   }
 });


