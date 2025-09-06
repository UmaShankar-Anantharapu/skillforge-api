const EventEmitter = require('events');
const { loggingService } = require('./loggingService');
const NodeCache = require('node-cache');

// Cache for status tracking (1 hour TTL)
const statusCache = new NodeCache({ stdTTL: 3600 });

/**
 * Status Tracking Service
 * Comprehensive status tracking and reporting for roadmap generation workflow
 */

/**
 * Workflow stages and their expected durations (in seconds)
 */
const WORKFLOW_STAGES = {
  PROFILE_FETCH: { name: 'Profile Data Fetch', duration: 5, weight: 0.1 },
  SKILL_ANALYSIS: { name: 'Skill Analysis', duration: 10, weight: 0.15 },
  WEB_SCRAPING: { name: 'Web Scraping', duration: 30, weight: 0.25 },
  OLLAMA_PROCESSING: { name: 'Ollama Processing', duration: 45, weight: 0.25 },
  RESOURCE_COLLECTION: { name: 'Resource Collection', duration: 60, weight: 0.2 },
  FINALIZATION: { name: 'Finalization', duration: 5, weight: 0.05 }
};

/**
 * Status types
 */
const STATUS_TYPES = {
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled'
};

/**
 * Priority levels
 */
const PRIORITY_LEVELS = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical'
};

class StatusTracker extends EventEmitter {
  constructor() {
    super();
    this.activeWorkflows = new Map();
    this.completedWorkflows = new Map();
    this.globalStats = {
      totalWorkflows: 0,
      completedWorkflows: 0,
      failedWorkflows: 0,
      averageCompletionTime: 0,
      successRate: 0
    };
  }

  /**
   * Initialize a new workflow tracking session
   * @param {string} workflowId - Unique workflow identifier
   * @param {Object} options - Workflow options
   * @returns {Object} Workflow status object
   */
  initializeWorkflow(workflowId, options = {}) {
    try {
      const {
        userId,
        targetSkill,
        priority = PRIORITY_LEVELS.MEDIUM,
        estimatedDuration = 155, // Sum of all stage durations
        metadata = {}
      } = options;

      const workflow = {
        id: workflowId,
        userId,
        targetSkill,
        priority,
        status: STATUS_TYPES.PENDING,
        progress: {
          overall: 0,
          currentStage: null,
          completedStages: [],
          failedStages: []
        },
        stages: this.initializeStages(),
        timing: {
          startTime: new Date().toISOString(),
          endTime: null,
          estimatedDuration,
          actualDuration: null,
          stageTimings: {}
        },
        metadata,
        issues: [],
        resources: {
          collected: 0,
          validated: 0,
          failed: 0
        },
        events: []
      };

      this.activeWorkflows.set(workflowId, workflow);
      this.globalStats.totalWorkflows++;
      
      this.addEvent(workflowId, 'workflow_initialized', {
        message: 'Workflow tracking initialized',
        priority,
        targetSkill
      });

      this.emit('workflow_initialized', { workflowId, workflow });
      
      loggingService.info(`Workflow ${workflowId} initialized for user ${userId}`);
      return workflow;
      
    } catch (error) {
      loggingService.error(`Failed to initialize workflow ${workflowId}:`, error);
      throw error;
    }
  }

  /**
   * Initialize workflow stages
   * @returns {Object} Initialized stages
   */
  initializeStages() {
    const stages = {};
    
    Object.entries(WORKFLOW_STAGES).forEach(([key, config]) => {
      stages[key] = {
        name: config.name,
        status: STATUS_TYPES.PENDING,
        progress: 0,
        startTime: null,
        endTime: null,
        duration: null,
        estimatedDuration: config.duration,
        weight: config.weight,
        issues: [],
        metadata: {}
      };
    });
    
    return stages;
  }

  /**
   * Start a workflow stage
   * @param {string} workflowId - Workflow identifier
   * @param {string} stageName - Stage name
   * @param {Object} metadata - Stage metadata
   * @returns {boolean} Success status
   */
  startStage(workflowId, stageName, metadata = {}) {
    try {
      const workflow = this.activeWorkflows.get(workflowId);
      if (!workflow) {
        throw new Error(`Workflow ${workflowId} not found`);
      }

      const stage = workflow.stages[stageName];
      if (!stage) {
        throw new Error(`Stage ${stageName} not found in workflow ${workflowId}`);
      }

      // Update stage status
      stage.status = STATUS_TYPES.IN_PROGRESS;
      stage.startTime = new Date().toISOString();
      stage.metadata = { ...stage.metadata, ...metadata };
      
      // Update workflow progress
      workflow.progress.currentStage = stageName;
      workflow.status = STATUS_TYPES.IN_PROGRESS;
      
      this.addEvent(workflowId, 'stage_started', {
        stage: stageName,
        message: `Started ${stage.name}`,
        metadata
      });

      this.emit('stage_started', { workflowId, stageName, stage });
      
      loggingService.info(`Stage ${stageName} started for workflow ${workflowId}`);
      return true;
      
    } catch (error) {
      loggingService.error(`Failed to start stage ${stageName} for workflow ${workflowId}:`, error);
      return false;
    }
  }

  /**
   * Update stage progress
   * @param {string} workflowId - Workflow identifier
   * @param {string} stageName - Stage name
   * @param {number} progress - Progress percentage (0-100)
   * @param {Object} metadata - Additional metadata
   * @returns {boolean} Success status
   */
  updateStageProgress(workflowId, stageName, progress, metadata = {}) {
    try {
      const workflow = this.activeWorkflows.get(workflowId);
      if (!workflow) {
        throw new Error(`Workflow ${workflowId} not found`);
      }

      const stage = workflow.stages[stageName];
      if (!stage) {
        throw new Error(`Stage ${stageName} not found`);
      }

      // Update stage progress
      stage.progress = Math.min(Math.max(progress, 0), 100);
      stage.metadata = { ...stage.metadata, ...metadata };
      
      // Update overall workflow progress
      this.updateOverallProgress(workflowId);
      
      this.addEvent(workflowId, 'stage_progress', {
        stage: stageName,
        progress: stage.progress,
        message: `${stage.name} progress: ${stage.progress}%`,
        metadata
      });

      this.emit('stage_progress', { workflowId, stageName, progress: stage.progress });
      
      return true;
      
    } catch (error) {
      loggingService.error(`Failed to update stage progress for ${stageName}:`, error);
      return false;
    }
  }

  /**
   * Complete a workflow stage
   * @param {string} workflowId - Workflow identifier
   * @param {string} stageName - Stage name
   * @param {Object} result - Stage completion result
   * @returns {boolean} Success status
   */
  completeStage(workflowId, stageName, result = {}) {
    try {
      const workflow = this.activeWorkflows.get(workflowId);
      if (!workflow) {
        throw new Error(`Workflow ${workflowId} not found`);
      }

      const stage = workflow.stages[stageName];
      if (!stage) {
        throw new Error(`Stage ${stageName} not found`);
      }

      // Update stage status
      stage.status = STATUS_TYPES.COMPLETED;
      stage.progress = 100;
      stage.endTime = new Date().toISOString();
      stage.duration = this.calculateDuration(stage.startTime, stage.endTime);
      stage.metadata = { ...stage.metadata, result };
      
      // Update workflow progress
      workflow.progress.completedStages.push(stageName);
      workflow.progress.currentStage = null;
      
      // Store timing information
      workflow.timing.stageTimings[stageName] = {
        duration: stage.duration,
        estimatedDuration: stage.estimatedDuration,
        efficiency: stage.estimatedDuration > 0 ? stage.duration / stage.estimatedDuration : 1
      };
      
      this.updateOverallProgress(workflowId);
      
      this.addEvent(workflowId, 'stage_completed', {
        stage: stageName,
        duration: stage.duration,
        message: `Completed ${stage.name} in ${stage.duration}s`,
        result
      });

      this.emit('stage_completed', { workflowId, stageName, stage, result });
      
      loggingService.info(`Stage ${stageName} completed for workflow ${workflowId} in ${stage.duration}s`);
      return true;
      
    } catch (error) {
      loggingService.error(`Failed to complete stage ${stageName}:`, error);
      return false;
    }
  }

  /**
   * Mark a stage as failed
   * @param {string} workflowId - Workflow identifier
   * @param {string} stageName - Stage name
   * @param {Object} error - Error information
   * @returns {boolean} Success status
   */
  failStage(workflowId, stageName, error = {}) {
    try {
      const workflow = this.activeWorkflows.get(workflowId);
      if (!workflow) {
        throw new Error(`Workflow ${workflowId} not found`);
      }

      const stage = workflow.stages[stageName];
      if (!stage) {
        throw new Error(`Stage ${stageName} not found`);
      }

      // Update stage status
      stage.status = STATUS_TYPES.FAILED;
      stage.endTime = new Date().toISOString();
      stage.duration = this.calculateDuration(stage.startTime, stage.endTime);
      stage.issues.push({
        timestamp: new Date().toISOString(),
        error: error.message || 'Unknown error',
        details: error
      });
      
      // Update workflow progress
      workflow.progress.failedStages.push(stageName);
      workflow.progress.currentStage = null;
      workflow.issues.push({
        stage: stageName,
        timestamp: new Date().toISOString(),
        error: error.message || 'Stage failed',
        details: error
      });
      
      this.addEvent(workflowId, 'stage_failed', {
        stage: stageName,
        error: error.message || 'Unknown error',
        message: `Failed ${stage.name}: ${error.message || 'Unknown error'}`,
        priority: PRIORITY_LEVELS.HIGH
      });

      this.emit('stage_failed', { workflowId, stageName, stage, error });
      
      loggingService.error(`Stage ${stageName} failed for workflow ${workflowId}:`, error);
      return true;
      
    } catch (err) {
      loggingService.error(`Failed to mark stage ${stageName} as failed:`, err);
      return false;
    }
  }

  /**
   * Complete entire workflow
   * @param {string} workflowId - Workflow identifier
   * @param {Object} result - Final workflow result
   * @returns {boolean} Success status
   */
  completeWorkflow(workflowId, result = {}) {
    try {
      const workflow = this.activeWorkflows.get(workflowId);
      if (!workflow) {
        throw new Error(`Workflow ${workflowId} not found`);
      }

      // Update workflow status
      workflow.status = STATUS_TYPES.COMPLETED;
      workflow.progress.overall = 100;
      workflow.timing.endTime = new Date().toISOString();
      workflow.timing.actualDuration = this.calculateDuration(
        workflow.timing.startTime,
        workflow.timing.endTime
      );
      
      // Store final result
      workflow.metadata.result = result;
      
      this.addEvent(workflowId, 'workflow_completed', {
        duration: workflow.timing.actualDuration,
        message: `Workflow completed successfully in ${workflow.timing.actualDuration}s`,
        result
      });

      // Move to completed workflows
      this.completedWorkflows.set(workflowId, workflow);
      this.activeWorkflows.delete(workflowId);
      
      // Update global stats
      this.globalStats.completedWorkflows++;
      this.updateGlobalStats();
      
      this.emit('workflow_completed', { workflowId, workflow, result });
      
      loggingService.info(`Workflow ${workflowId} completed successfully in ${workflow.timing.actualDuration}s`);
      return true;
      
    } catch (error) {
      loggingService.error(`Failed to complete workflow ${workflowId}:`, error);
      return false;
    }
  }

  /**
   * Mark workflow as failed
   * @param {string} workflowId - Workflow identifier
   * @param {Object} error - Error information
   * @returns {boolean} Success status
   */
  failWorkflow(workflowId, error = {}) {
    try {
      const workflow = this.activeWorkflows.get(workflowId);
      if (!workflow) {
        throw new Error(`Workflow ${workflowId} not found`);
      }

      // Update workflow status
      workflow.status = STATUS_TYPES.FAILED;
      workflow.timing.endTime = new Date().toISOString();
      workflow.timing.actualDuration = this.calculateDuration(
        workflow.timing.startTime,
        workflow.timing.endTime
      );
      
      // Add error to issues
      workflow.issues.push({
        timestamp: new Date().toISOString(),
        error: error.message || 'Workflow failed',
        details: error,
        critical: true
      });
      
      this.addEvent(workflowId, 'workflow_failed', {
        error: error.message || 'Unknown error',
        message: `Workflow failed: ${error.message || 'Unknown error'}`,
        priority: PRIORITY_LEVELS.CRITICAL
      });

      // Move to completed workflows (for historical tracking)
      this.completedWorkflows.set(workflowId, workflow);
      this.activeWorkflows.delete(workflowId);
      
      // Update global stats
      this.globalStats.failedWorkflows++;
      this.updateGlobalStats();
      
      this.emit('workflow_failed', { workflowId, workflow, error });
      
      loggingService.error(`Workflow ${workflowId} failed:`, error);
      return true;
      
    } catch (err) {
      loggingService.error(`Failed to mark workflow ${workflowId} as failed:`, err);
      return false;
    }
  }

  /**
   * Update resource collection progress
   * @param {string} workflowId - Workflow identifier
   * @param {Object} resourceStats - Resource collection statistics
   * @returns {boolean} Success status
   */
  updateResourceProgress(workflowId, resourceStats) {
    try {
      const workflow = this.activeWorkflows.get(workflowId);
      if (!workflow) {
        throw new Error(`Workflow ${workflowId} not found`);
      }

      // Update resource statistics
      workflow.resources = {
        collected: resourceStats.collected || 0,
        validated: resourceStats.validated || 0,
        failed: resourceStats.failed || 0,
        totalExpected: resourceStats.totalExpected || 0
      };
      
      this.addEvent(workflowId, 'resource_progress', {
        message: `Resources: ${workflow.resources.collected} collected, ${workflow.resources.validated} validated`,
        resourceStats: workflow.resources
      });

      this.emit('resource_progress', { workflowId, resourceStats: workflow.resources });
      
      return true;
      
    } catch (error) {
      loggingService.error(`Failed to update resource progress for workflow ${workflowId}:`, error);
      return false;
    }
  }

  /**
   * Get workflow status
   * @param {string} workflowId - Workflow identifier
   * @returns {Object|null} Workflow status or null if not found
   */
  getWorkflowStatus(workflowId) {
    const workflow = this.activeWorkflows.get(workflowId) || this.completedWorkflows.get(workflowId);
    
    if (!workflow) {
      return null;
    }
    
    return {
      id: workflow.id,
      userId: workflow.userId,
      targetSkill: workflow.targetSkill,
      status: workflow.status,
      progress: workflow.progress,
      timing: workflow.timing,
      resources: workflow.resources,
      issues: workflow.issues,
      currentStage: workflow.progress.currentStage,
      completedStages: workflow.progress.completedStages,
      failedStages: workflow.progress.failedStages,
      recentEvents: workflow.events.slice(-5) // Last 5 events
    };
  }

  /**
   * Get detailed workflow information
   * @param {string} workflowId - Workflow identifier
   * @returns {Object|null} Detailed workflow information
   */
  getDetailedWorkflowStatus(workflowId) {
    const workflow = this.activeWorkflows.get(workflowId) || this.completedWorkflows.get(workflowId);
    return workflow || null;
  }

  /**
   * Get all active workflows
   * @returns {Array} Array of active workflow statuses
   */
  getActiveWorkflows() {
    return Array.from(this.activeWorkflows.values()).map(workflow => ({
      id: workflow.id,
      userId: workflow.userId,
      targetSkill: workflow.targetSkill,
      status: workflow.status,
      progress: workflow.progress.overall,
      currentStage: workflow.progress.currentStage,
      startTime: workflow.timing.startTime,
      estimatedCompletion: this.calculateEstimatedCompletion(workflow)
    }));
  }

  /**
   * Get global statistics
   * @returns {Object} Global workflow statistics
   */
  getGlobalStats() {
    return {
      ...this.globalStats,
      activeWorkflows: this.activeWorkflows.size,
      completedWorkflows: this.completedWorkflows.size
    };
  }

  /**
   * Get workflow history for a user
   * @param {string} userId - User identifier
   * @param {number} limit - Maximum number of workflows to return
   * @returns {Array} Array of user's workflow history
   */
  getUserWorkflowHistory(userId, limit = 10) {
    const userWorkflows = [];
    
    // Add active workflows
    this.activeWorkflows.forEach(workflow => {
      if (workflow.userId === userId) {
        userWorkflows.push(workflow);
      }
    });
    
    // Add completed workflows
    this.completedWorkflows.forEach(workflow => {
      if (workflow.userId === userId) {
        userWorkflows.push(workflow);
      }
    });
    
    // Sort by start time (newest first) and limit
    return userWorkflows
      .sort((a, b) => new Date(b.timing.startTime) - new Date(a.timing.startTime))
      .slice(0, limit)
      .map(workflow => ({
        id: workflow.id,
        targetSkill: workflow.targetSkill,
        status: workflow.status,
        progress: workflow.progress.overall,
        startTime: workflow.timing.startTime,
        endTime: workflow.timing.endTime,
        duration: workflow.timing.actualDuration,
        issues: workflow.issues.length
      }));
  }

  /**
   * Add event to workflow
   * @param {string} workflowId - Workflow identifier
   * @param {string} eventType - Event type
   * @param {Object} eventData - Event data
   */
  addEvent(workflowId, eventType, eventData) {
    const workflow = this.activeWorkflows.get(workflowId) || this.completedWorkflows.get(workflowId);
    if (workflow) {
      workflow.events.push({
        timestamp: new Date().toISOString(),
        type: eventType,
        ...eventData
      });
      
      // Keep only last 50 events to prevent memory issues
      if (workflow.events.length > 50) {
        workflow.events = workflow.events.slice(-50);
      }
    }
  }

  /**
   * Update overall workflow progress
   * @param {string} workflowId - Workflow identifier
   */
  updateOverallProgress(workflowId) {
    const workflow = this.activeWorkflows.get(workflowId);
    if (!workflow) return;
    
    let totalProgress = 0;
    let totalWeight = 0;
    
    Object.values(workflow.stages).forEach(stage => {
      totalProgress += (stage.progress / 100) * stage.weight;
      totalWeight += stage.weight;
    });
    
    workflow.progress.overall = totalWeight > 0 ? Math.round((totalProgress / totalWeight) * 100) : 0;
  }

  /**
   * Calculate duration between two timestamps
   * @param {string} startTime - Start timestamp
   * @param {string} endTime - End timestamp
   * @returns {number} Duration in seconds
   */
  calculateDuration(startTime, endTime) {
    if (!startTime || !endTime) return 0;
    return Math.round((new Date(endTime) - new Date(startTime)) / 1000);
  }

  /**
   * Calculate estimated completion time
   * @param {Object} workflow - Workflow object
   * @returns {string} Estimated completion time
   */
  calculateEstimatedCompletion(workflow) {
    if (workflow.status === STATUS_TYPES.COMPLETED) {
      return workflow.timing.endTime;
    }
    
    const elapsed = this.calculateDuration(workflow.timing.startTime, new Date().toISOString());
    const progressRatio = workflow.progress.overall / 100;
    
    if (progressRatio === 0) {
      const estimatedTotal = workflow.timing.estimatedDuration;
      return new Date(Date.now() + estimatedTotal * 1000).toISOString();
    }
    
    const estimatedTotal = elapsed / progressRatio;
    const remaining = estimatedTotal - elapsed;
    
    return new Date(Date.now() + remaining * 1000).toISOString();
  }

  /**
   * Update global statistics
   */
  updateGlobalStats() {
    if (this.globalStats.totalWorkflows > 0) {
      this.globalStats.successRate = (this.globalStats.completedWorkflows / this.globalStats.totalWorkflows) * 100;
    }
    
    // Calculate average completion time from completed workflows
    let totalDuration = 0;
    let completedCount = 0;
    
    this.completedWorkflows.forEach(workflow => {
      if (workflow.status === STATUS_TYPES.COMPLETED && workflow.timing.actualDuration) {
        totalDuration += workflow.timing.actualDuration;
        completedCount++;
      }
    });
    
    this.globalStats.averageCompletionTime = completedCount > 0 ? Math.round(totalDuration / completedCount) : 0;
  }

  /**
   * Clean up old completed workflows
   * @param {number} maxAge - Maximum age in hours
   */
  cleanupOldWorkflows(maxAge = 24) {
    const cutoffTime = new Date(Date.now() - maxAge * 60 * 60 * 1000);
    
    this.completedWorkflows.forEach((workflow, workflowId) => {
      if (new Date(workflow.timing.endTime) < cutoffTime) {
        this.completedWorkflows.delete(workflowId);
      }
    });
  }
}

// Create singleton instance
const statusTracker = new StatusTracker();

// Export both the class and singleton instance
module.exports = {
  StatusTracker,
  statusTracker,
  STATUS_TYPES,
  PRIORITY_LEVELS,
  WORKFLOW_STAGES
};