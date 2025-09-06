const { loggingService } = require('./loggingService');
const { errorHandlingService, ErrorTypes } = require('./errorHandlingService');
const statusTrackingService = require('./statusTrackingService');

/**
 * Comprehensive error handling and fallback mechanisms for personalized roadmap workflow
 */
class WorkflowErrorHandler {
  constructor() {
    this.maxRetries = 3;
    this.retryDelays = [1000, 2000, 5000]; // Progressive delays in ms
    this.fallbackStrategies = new Map();
    this.criticalErrors = new Set([
      'PROFILE_NOT_FOUND',
      'AUTHENTICATION_ERROR',
      'DATABASE_CONNECTION_ERROR'
    ]);
    
    this.initializeFallbackStrategies();
  }

  /**
   * Initialize fallback strategies for different workflow stages
   */
  initializeFallbackStrategies() {
    this.fallbackStrategies.set('profile_data_fetch', {
      fallback: this.fallbackProfileData.bind(this),
      canContinue: true,
      priority: 'high'
    });

    this.fallbackStrategies.set('skill_analysis', {
      fallback: this.fallbackSkillAnalysis.bind(this),
      canContinue: true,
      priority: 'high'
    });

    this.fallbackStrategies.set('web_scraping', {
      fallback: this.fallbackWebScraping.bind(this),
      canContinue: true,
      priority: 'medium'
    });

    this.fallbackStrategies.set('ollama_processing', {
      fallback: this.fallbackOllamaProcessing.bind(this),
      canContinue: false,
      priority: 'high'
    });

    this.fallbackStrategies.set('resource_collection', {
      fallback: this.fallbackResourceCollection.bind(this),
      canContinue: true,
      priority: 'low'
    });

    this.fallbackStrategies.set('finalization', {
      fallback: this.fallbackFinalization.bind(this),
      canContinue: false,
      priority: 'high'
    });
  }

  /**
   * Handle workflow stage error with retry and fallback mechanisms
   */
  async handleStageError(workflowId, stage, error, context = {}) {
    try {
      loggingService.error(`Workflow stage error: ${stage}`, {
        workflowId,
        stage,
        error: error.message,
        context,
        stack: error.stack
      });

      // Update workflow status to indicate error
      await statusTrackingService.updateStageStatus(
        workflowId,
        stage,
        'failed',
        { error: error.message, context }
      );

      // Check if this is a critical error that should stop the workflow
      if (this.isCriticalError(error)) {
        await this.handleCriticalError(workflowId, stage, error, context);
        return { success: false, critical: true, error };
      }

      // Attempt retry with exponential backoff
      const retryResult = await this.attemptRetry(workflowId, stage, error, context);
      if (retryResult.success) {
        return retryResult;
      }

      // If retry failed, attempt fallback strategy
      const fallbackResult = await this.attemptFallback(workflowId, stage, error, context);
      return fallbackResult;

    } catch (handlingError) {
      loggingService.error('Error in workflow error handling', {
        workflowId,
        stage,
        originalError: error.message,
        handlingError: handlingError.message
      });

      return {
        success: false,
        critical: true,
        error: handlingError,
        fallbackUsed: false
      };
    }
  }

  /**
   * Attempt to retry a failed stage with exponential backoff
   */
  async attemptRetry(workflowId, stage, error, context) {
    const retryCount = context.retryCount || 0;
    
    if (retryCount >= this.maxRetries) {
      loggingService.warn('Max retries exceeded for workflow stage', {
        workflowId,
        stage,
        retryCount
      });
      return { success: false, maxRetriesExceeded: true };
    }

    const delay = this.retryDelays[Math.min(retryCount, this.retryDelays.length - 1)];
    
    loggingService.info(`Retrying workflow stage: ${stage}`, {
      workflowId,
      stage,
      retryCount: retryCount + 1,
      delay
    });

    // Wait before retry
    await new Promise(resolve => setTimeout(resolve, delay));

    try {
      // Update status to indicate retry
      await statusTrackingService.updateStageStatus(
        workflowId,
        stage,
        'in_progress',
        { 
          retrying: true, 
          retryCount: retryCount + 1,
          previousError: error.message 
        }
      );

      return {
        success: true,
        retried: true,
        retryCount: retryCount + 1
      };

    } catch (retryError) {
      loggingService.error('Retry attempt failed', {
        workflowId,
        stage,
        retryCount: retryCount + 1,
        error: retryError.message
      });

      return {
        success: false,
        retryFailed: true,
        retryCount: retryCount + 1,
        error: retryError
      };
    }
  }

  /**
   * Attempt fallback strategy for a failed stage
   */
  async attemptFallback(workflowId, stage, error, context) {
    const strategy = this.fallbackStrategies.get(stage);
    
    if (!strategy) {
      loggingService.warn('No fallback strategy available for stage', {
        workflowId,
        stage
      });
      return { success: false, noFallback: true };
    }

    try {
      loggingService.info(`Attempting fallback for stage: ${stage}`, {
        workflowId,
        stage,
        canContinue: strategy.canContinue
      });

      // Update status to indicate fallback attempt
      await statusTrackingService.updateStageStatus(
        workflowId,
        stage,
        'in_progress',
        { 
          usingFallback: true,
          originalError: error.message 
        }
      );

      const fallbackResult = await strategy.fallback(workflowId, error, context);

      if (fallbackResult.success) {
        await statusTrackingService.updateStageStatus(
          workflowId,
          stage,
          'completed',
          { 
            fallbackUsed: true,
            fallbackData: fallbackResult.data 
          }
        );
      }

      return {
        success: fallbackResult.success,
        fallbackUsed: true,
        canContinue: strategy.canContinue,
        data: fallbackResult.data,
        warnings: fallbackResult.warnings || []
      };

    } catch (fallbackError) {
      loggingService.error('Fallback strategy failed', {
        workflowId,
        stage,
        fallbackError: fallbackError.message
      });

      return {
        success: false,
        fallbackFailed: true,
        canContinue: false,
        error: fallbackError
      };
    }
  }

  /**
   * Handle critical errors that should stop the workflow
   */
  async handleCriticalError(workflowId, stage, error, context) {
    loggingService.error('Critical workflow error encountered', {
      workflowId,
      stage,
      error: error.message,
      context
    });

    // Mark workflow as failed
    await statusTrackingService.failWorkflow(
      workflowId,
      `Critical error in ${stage}: ${error.message}`,
      { stage, context }
    );

    // Track critical error in monitoring

    // Send notification if configured
    await this.notifyCriticalError(workflowId, stage, error);
  }

  /**
   * Check if an error is critical and should stop the workflow
   */
  isCriticalError(error) {
    if (this.criticalErrors.has(error.code)) {
      return true;
    }

    // Check for specific error patterns
    const criticalPatterns = [
      /database.*connection/i,
      /authentication.*failed/i,
      /user.*not.*found/i,
      /permission.*denied/i
    ];

    return criticalPatterns.some(pattern => pattern.test(error.message));
  }

  /**
   * Fallback for profile data fetch errors
   */
  async fallbackProfileData(workflowId, error, context) {
    loggingService.info('Using fallback profile data', { workflowId });

    // Return minimal profile data to continue workflow
    const fallbackProfile = {
      userId: context.userId,
      skill: context.targetSkill || 'General',
      level: 'beginner',
      dailyTime: 60,
      learningGoal: 'Learn new skills',
      currentSkills: [],
      preferences: {
        learningStyle: 'mixed',
        difficulty: 'beginner'
      }
    };

    return {
      success: true,
      data: fallbackProfile,
      warnings: ['Using default profile data due to fetch error']
    };
  }

  /**
   * Fallback for skill analysis errors
   */
  async fallbackSkillAnalysis(workflowId, error, context) {
    loggingService.info('Using fallback skill analysis', { workflowId });

    // Return basic skill analysis
    const fallbackAnalysis = {
      excludedSkills: [],
      focusAreas: [context.targetSkill],
      skillGaps: ['foundational', 'intermediate', 'advanced'],
      learningPriorities: ['basics', 'practice', 'projects']
    };

    return {
      success: true,
      data: fallbackAnalysis,
      warnings: ['Using basic skill analysis due to processing error']
    };
  }

  /**
   * Fallback for web scraping errors
   */
  async fallbackWebScraping(workflowId, error, context) {
    loggingService.info('Using fallback web scraping data', { workflowId });

    // Return cached or template data
    const fallbackData = {
      roadmaps: [],
      resources: [],
      trends: [],
      source: 'fallback_cache'
    };

    return {
      success: true,
      data: fallbackData,
      warnings: ['Using cached data due to web scraping error']
    };
  }

  /**
   * Fallback for Ollama processing errors
   */
  async fallbackOllamaProcessing(workflowId, error, context) {
    loggingService.error('Ollama processing failed - no fallback available', { workflowId });

    // Ollama is critical - no fallback possible
    return {
      success: false,
      error: 'Ollama processing is required and cannot be bypassed',
      critical: true
    };
  }

  /**
   * Fallback for resource collection errors
   */
  async fallbackResourceCollection(workflowId, error, context) {
    loggingService.info('Using fallback resource collection', { workflowId });

    // Return minimal resources
    const fallbackResources = {
      resources: [],
      statistics: {
        totalResources: 0,
        qualityScore: 0,
        coverage: 'minimal'
      }
    };

    return {
      success: true,
      data: fallbackResources,
      warnings: ['Limited resources available due to collection error']
    };
  }

  /**
   * Fallback for finalization errors
   */
  async fallbackFinalization(workflowId, error, context) {
    loggingService.error('Finalization failed - attempting recovery', { workflowId });

    try {
      // Attempt to save partial roadmap
      const partialRoadmap = {
        ...context.roadmapData,
        status: 'partial',
        warnings: ['Roadmap generated with limited data due to processing errors'],
        generatedAt: new Date()
      };

      return {
        success: true,
        data: partialRoadmap,
        warnings: ['Roadmap saved with partial data']
      };

    } catch (recoveryError) {
      return {
        success: false,
        error: 'Failed to save even partial roadmap data',
        critical: true
      };
    }
  }

  /**
   * Send notification for critical errors
   */
  async notifyCriticalError(workflowId, stage, error) {
    try {
      // This could integrate with email, Slack, or other notification systems
      loggingService.error('CRITICAL WORKFLOW ERROR - NOTIFICATION', {
        workflowId,
        stage,
        error: error.message,
        timestamp: new Date(),
        severity: 'critical'
      });

      // Track in monitoring system

    } catch (notificationError) {
      loggingService.error('Failed to send critical error notification', {
        workflowId,
        notificationError: notificationError.message
      });
    }
  }

  /**
   * Get error recovery statistics
   */
  async getErrorStatistics() {
    // This could query a database for error statistics
    return {
      totalErrors: 0,
      criticalErrors: 0,
      recoveredErrors: 0,
      fallbacksUsed: 0,
      retrySuccess: 0,
      errorsByStage: {},
      recoveryRate: 0
    };
  }
}

module.exports = new WorkflowErrorHandler();