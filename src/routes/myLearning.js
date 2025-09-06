const express = require('express');
const router = express.Router();
const myLearningService = require('../services/myLearningService');
const requireAuth = require('../middleware/requireAuth');
const { validationResult } = require('express-validator');
const { loggingService } = require('../services/loggingService');
const { errorHandlingService } = require('../services/errorHandlingService');
const { body, param, query } = require('express-validator');

// Simple validation middleware
const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// Simple rate limiter middleware
const rateLimiter = (options) => {
  return (req, res, next) => {
    // Simple pass-through for now - can be enhanced later
    next();
  };
};

/**
 * My Learning Routes
 * Handles all API endpoints for the My-Learning page sections
 */

/**
 * @route GET /api/my-learning/continue-learning
 * @desc Get Continue Learning section data (active roadmaps with full details)
 * @access Private
 */
router.get('/continue-learning', 
  requireAuth,
  rateLimiter({ windowMs: 15 * 60 * 1000, max: 100 }), // 100 requests per 15 minutes
  async (req, res) => {
    try {
      const userId = req.userId;
      const data = await myLearningService.getContinueLearning(userId);
      
      res.json({
        success: true,
        data,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      loggingService.error('Error in continue-learning endpoint', {
        userId: req.userId,
        error: error.message,
        stack: error.stack
      });
      
      res.status(500).json({
        success: false,
        message: 'Failed to fetch continue learning data',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }
);

/**
 * @route GET /api/my-learning/saved-roadmaps
 * @desc Get Saved Roadmaps section data (summaries and level details)
 * @access Private
 */
router.get('/saved-roadmaps',
  requireAuth,
  rateLimiter({ windowMs: 15 * 60 * 1000, max: 100 }),
  async (req, res) => {
    try {
      const userId = req.userId;
      const data = await myLearningService.getSavedRoadmaps(userId);
      
      res.json({
        success: true,
        data,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      loggingService.error('Error in saved-roadmaps endpoint', {
        userId: req.userId,
        error: error.message,
        stack: error.stack
      });
      
      res.status(500).json({
        success: false,
        message: 'Failed to fetch saved roadmaps',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }
);

/**
 * @route GET /api/my-learning/ai-recommendations
 * @desc Get AI Recommendations section data (max 25, 7-day expiration)
 * @access Private
 */
router.get('/ai-recommendations',
  requireAuth,
  rateLimiter({ windowMs: 15 * 60 * 1000, max: 50 }), // Lower limit for AI recommendations
  [
    query('forceRefresh')
      .optional()
      .isBoolean()
      .withMessage('forceRefresh must be a boolean')
  ],
  validateRequest,
  async (req, res) => {
    try {
      const userId = req.userId;
      const forceRefresh = req.query.forceRefresh === 'true';
      
      const data = await myLearningService.getAIRecommendations(userId, forceRefresh);
      
      res.json({
        success: true,
        data,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      loggingService.error('Error in ai-recommendations endpoint', {
        userId: req.userId,
        forceRefresh: req.query.forceRefresh,
        error: error.message,
        stack: error.stack
      });
      
      res.status(500).json({
        success: false,
        message: 'Failed to fetch AI recommendations',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }
);

/**
 * @route GET /api/my-learning/trending-roadmaps
 * @desc Get Trending Roadmaps section data (global, 7-day refresh)
 * @access Public (but can be personalized if authenticated)
 */
router.get('/trending-roadmaps',
  rateLimiter({ windowMs: 15 * 60 * 1000, max: 200 }), // Higher limit as it's global data
  [
    query('limit')
      .optional()
      .isInt({ min: 1, max: 50 })
      .withMessage('Limit must be between 1 and 50')
  ],
  validateRequest,
  async (req, res) => {
    try {
      const limit = parseInt(req.query.limit) || 25;
      const data = await myLearningService.getTrendingRoadmaps(limit);
      
      res.json({
        success: true,
        data,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      loggingService.error('Error in trending-roadmaps endpoint', {
        limit: req.query.limit,
        error: error.message,
        stack: error.stack
      });
      
      res.status(500).json({
        success: false,
        message: 'Failed to fetch trending roadmaps',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }
);

/**
 * @route GET /api/my-learning/dashboard
 * @desc Get complete My-Learning dashboard data (all sections)
 * @access Private
 */
router.get('/dashboard',
  requireAuth,
  rateLimiter({ windowMs: 15 * 60 * 1000, max: 30 }), // Lower limit for complete dashboard
  [
    query('sections')
      .optional()
      .isString()
      .withMessage('Sections must be a comma-separated string')
  ],
  validateRequest,
  async (req, res) => {
    try {
      const userId = req.userId;
      const requestedSections = req.query.sections ? 
        req.query.sections.split(',').map(s => s.trim()) : 
        ['continue-learning', 'saved-roadmaps', 'ai-recommendations', 'trending-roadmaps'];
      
      const dashboardData = {};
      
      // Fetch requested sections in parallel
      const promises = [];
      
      if (requestedSections.includes('continue-learning')) {
        promises.push(
          myLearningService.getContinueLearning(userId)
            .then(data => ({ section: 'continueLearning', data }))
            .catch(error => ({ section: 'continueLearning', error: error.message }))
        );
      }
      
      if (requestedSections.includes('saved-roadmaps')) {
        promises.push(
          myLearningService.getSavedRoadmaps(userId)
            .then(data => ({ section: 'savedRoadmaps', data }))
            .catch(error => ({ section: 'savedRoadmaps', error: error.message }))
        );
      }
      
      if (requestedSections.includes('ai-recommendations')) {
        promises.push(
          myLearningService.getAIRecommendations(userId)
            .then(data => ({ section: 'aiRecommendations', data }))
            .catch(error => ({ section: 'aiRecommendations', error: error.message }))
        );
      }
      
      if (requestedSections.includes('trending-roadmaps')) {
        promises.push(
          myLearningService.getTrendingRoadmaps(25)
            .then(data => ({ section: 'trendingRoadmaps', data }))
            .catch(error => ({ section: 'trendingRoadmaps', error: error.message }))
        );
      }
      
      const results = await Promise.all(promises);
      
      // Process results
      results.forEach(result => {
        if (result.error) {
          dashboardData[result.section] = {
            success: false,
            error: result.error,
            data: null
          };
        } else {
          dashboardData[result.section] = {
            success: true,
            error: null,
            data: result.data
          };
        }
      });
      
      res.json({
        success: true,
        data: dashboardData,
        timestamp: new Date().toISOString(),
        requestedSections
      });
      
    } catch (error) {
      loggingService.error('Error in dashboard endpoint', {
        userId: req.userId,
        sections: req.query.sections,
        error: error.message,
        stack: error.stack
      });
      
      res.status(500).json({
        success: false,
        message: 'Failed to fetch dashboard data',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }
);

/**
 * @route POST /api/my-learning/start-roadmap
 * @desc Add roadmap to user's active learning (Continue Learning section)
 * @access Private
 */
router.post('/start-roadmap',
  requireAuth,
  rateLimiter({ windowMs: 15 * 60 * 1000, max: 20 }),
  [
    body('roadmapId')
      .notEmpty()
      .withMessage('Roadmap ID is required')
      .isMongoId()
      .withMessage('Invalid roadmap ID format')
  ],
  validateRequest,
  async (req, res) => {
    try {
      const userId = req.userId;
      const { roadmapId } = req.body;
      
      const result = await myLearningService.startRoadmap(userId, roadmapId);
      
      res.json({
        success: true,
        data: result,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      loggingService.error('Error in start-roadmap endpoint', {
        userId: req.userId,
        roadmapId: req.body?.roadmapId,
        error: error.message,
        stack: error.stack
      });
      
      const statusCode = error.message === 'Roadmap not found' ? 404 : 500;
      
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Failed to start roadmap',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }
);

/**
 * @route POST /api/my-learning/save-roadmap
 * @desc Save roadmap to user's saved roadmaps (Saved Roadmaps section)
 * @access Private
 */
router.post('/save-roadmap',
  requireAuth,
  rateLimiter({ windowMs: 15 * 60 * 1000, max: 30 }),
  [
    body('roadmapId')
      .notEmpty()
      .withMessage('Roadmap ID is required')
      .isMongoId()
      .withMessage('Invalid roadmap ID format')
  ],
  validateRequest,
  async (req, res) => {
    try {
      const userId = req.userId;
      const { roadmapId } = req.body;
      
      const result = await myLearningService.saveRoadmap(userId, roadmapId);
      
      res.json({
        success: true,
        data: result,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      loggingService.error('Error in save-roadmap endpoint', {
        userId: req.userId,
        roadmapId: req.body?.roadmapId,
        error: error.message,
        stack: error.stack
      });
      
      const statusCode = error.message === 'Roadmap not found' ? 404 : 500;
      
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Failed to save roadmap',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }
);

/**
 * @route PUT /api/my-learning/recommendation-interaction
 * @desc Update AI recommendation interaction (viewed, clicked, dismissed)
 * @access Private
 */
router.put('/recommendation-interaction',
  requireAuth,
  rateLimiter({ windowMs: 15 * 60 * 1000, max: 100 }),
  [
    body('recommendationId')
      .notEmpty()
      .withMessage('Recommendation ID is required'),
    body('action')
      .isIn(['viewed', 'clicked', 'dismissed'])
      .withMessage('Action must be one of: viewed, clicked, dismissed')
  ],
  validateRequest,
  async (req, res) => {
    try {
      const userId = req.userId;
      const { recommendationId, action } = req.body;
      
      const result = await myLearningService.updateRecommendationInteraction(
        userId, 
        recommendationId, 
        action
      );
      
      res.json({
        success: true,
        data: result,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      loggingService.error('Error in recommendation-interaction endpoint', {
        userId: req.userId,
        recommendationId: req.body?.recommendationId,
        action: req.body?.action,
        error: error.message,
        stack: error.stack
      });
      
      const statusCode = error.message.includes('not found') ? 404 : 500;
      
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Failed to update recommendation interaction',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }
);

/**
 * @route POST /api/my-learning/refresh-recommendations
 * @desc Force refresh AI recommendations
 * @access Private
 */
router.post('/refresh-recommendations',
  requireAuth,
  rateLimiter({ windowMs: 60 * 60 * 1000, max: 5 }), // Very limited - 5 per hour
  async (req, res) => {
    try {
      const userId = req.userId;
      
      const data = await myLearningService.getAIRecommendations(userId, true);
      
      res.json({
        success: true,
        data,
        message: 'Recommendations refreshed successfully',
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      loggingService.error('Error in refresh-recommendations endpoint', {
        userId: req.userId,
        error: error.message,
        stack: error.stack
      });
      
      res.status(500).json({
        success: false,
        message: 'Failed to refresh recommendations',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }
);

/**
 * @route GET /api/my-learning/stats
 * @desc Get user learning statistics and analytics
 * @access Private
 */
router.get('/stats',
  requireAuth,
  rateLimiter({ windowMs: 15 * 60 * 1000, max: 50 }),
  async (req, res) => {
    try {
      const userId = req.userId;
      
      // Get basic stats from all sections
      const [continueLearning, savedRoadmaps, aiRecommendations] = await Promise.all([
        myLearningService.getContinueLearning(userId),
        myLearningService.getSavedRoadmaps(userId),
        myLearningService.getAIRecommendations(userId)
      ]);
      
      const stats = {
        continueLearning: {
          totalActive: continueLearning.totalActiveRoadmaps || 0,
          totalTimeSpent: continueLearning.analytics?.totalTimeSpent || 0,
          averageProgress: continueLearning.analytics?.averageProgress || 0,
          longestStreak: continueLearning.analytics?.longestStreak || 0
        },
        savedRoadmaps: {
          totalSaved: savedRoadmaps.totalSavedRoadmaps || 0,
          favoriteCount: savedRoadmaps.favoriteCount || 0,
          categories: savedRoadmaps.categories || []
        },
        aiRecommendations: {
          totalRecommendations: aiRecommendations.totalRecommendations || 0,
          lastRefreshed: aiRecommendations.lastRefreshed,
          nextRefresh: aiRecommendations.nextRefresh
        },
        overall: {
          totalEngagement: (continueLearning.totalActiveRoadmaps || 0) + (savedRoadmaps.totalSavedRoadmaps || 0),
          lastActivity: new Date().toISOString()
        }
      };
      
      res.json({
        success: true,
        data: stats,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      loggingService.error('Error in stats endpoint', {
        userId: req.userId,
        error: error.message,
        stack: error.stack
      });
      
      res.status(500).json({
        success: false,
        message: 'Failed to fetch learning statistics',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }
);

module.exports = router;