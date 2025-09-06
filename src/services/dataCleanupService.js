const UserRoadmapTracking = require('../models/UserRoadmapTracking');
const TrendingRoadmaps = require('../models/TrendingRoadmaps');
const { loggingService } = require('./loggingService');
const cron = require('node-cron');

/**
 * Data Cleanup Service
 * Handles automatic data expiration and cleanup for scalability
 */
class DataCleanupService {
  constructor() {
    this.isInitialized = false;
    this.cleanupJobs = new Map();
  }
  
  /**
   * Initialize cleanup service with scheduled jobs
   */
  initialize() {
    if (this.isInitialized) {
      loggingService.warn('DataCleanupService already initialized');
      return;
    }
    
    try {
      // Schedule AI recommendations cleanup - every 6 hours
      this.scheduleAIRecommendationsCleanup();
      
      // Schedule trending roadmaps refresh - daily at 2 AM
      this.scheduleTrendingRoadmapsRefresh();
      
      // Schedule general data cleanup - weekly on Sunday at 3 AM
      this.scheduleWeeklyCleanup();
      
      // Schedule analytics cleanup - monthly on 1st at 4 AM
      this.scheduleMonthlyAnalyticsCleanup();
      
      this.isInitialized = true;
      loggingService.info('DataCleanupService initialized successfully');
      
    } catch (error) {
      loggingService.error('Failed to initialize DataCleanupService', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }
  
  /**
   * Schedule AI recommendations cleanup (every 6 hours)
   */
  scheduleAIRecommendationsCleanup() {
    const job = cron.schedule('0 */6 * * *', async () => {
      try {
        await this.cleanupExpiredAIRecommendations();
      } catch (error) {
        loggingService.error('AI recommendations cleanup failed', {
          error: error.message
        });
      }
    }, {
      scheduled: false,
      timezone: 'UTC'
    });
    
    this.cleanupJobs.set('aiRecommendations', job);
    job.start();
    
    loggingService.info('AI recommendations cleanup scheduled (every 6 hours)');
  }
  
  /**
   * Schedule trending roadmaps refresh (daily at 2 AM UTC)
   */
  scheduleTrendingRoadmapsRefresh() {
    const job = cron.schedule('0 2 * * *', async () => {
      try {
        await this.refreshTrendingRoadmapsIfNeeded();
      } catch (error) {
        loggingService.error('Trending roadmaps refresh failed', {
          error: error.message
        });
      }
    }, {
      scheduled: false,
      timezone: 'UTC'
    });
    
    this.cleanupJobs.set('trendingRefresh', job);
    job.start();
    
    loggingService.info('Trending roadmaps refresh scheduled (daily at 2 AM UTC)');
  }
  
  /**
   * Schedule weekly cleanup (Sunday at 3 AM UTC)
   */
  scheduleWeeklyCleanup() {
    const job = cron.schedule('0 3 * * 0', async () => {
      try {
        await this.performWeeklyCleanup();
      } catch (error) {
        loggingService.error('Weekly cleanup failed', {
          error: error.message
        });
      }
    }, {
      scheduled: false,
      timezone: 'UTC'
    });
    
    this.cleanupJobs.set('weeklyCleanup', job);
    job.start();
    
    loggingService.info('Weekly cleanup scheduled (Sunday at 3 AM UTC)');
  }
  
  /**
   * Schedule monthly analytics cleanup (1st of month at 4 AM UTC)
   */
  scheduleMonthlyAnalyticsCleanup() {
    const job = cron.schedule('0 4 1 * *', async () => {
      try {
        await this.performMonthlyAnalyticsCleanup();
      } catch (error) {
        loggingService.error('Monthly analytics cleanup failed', {
          error: error.message
        });
      }
    }, {
      scheduled: false,
      timezone: 'UTC'
    });
    
    this.cleanupJobs.set('monthlyAnalytics', job);
    job.start();
    
    loggingService.info('Monthly analytics cleanup scheduled (1st of month at 4 AM UTC)');
  }
  
  /**
   * Clean up expired AI recommendations
   */
  async cleanupExpiredAIRecommendations() {
    try {
      const startTime = Date.now();
      
      // Find users with expired recommendations
      const usersWithExpiredRecs = await UserRoadmapTracking.find({
        'aiRecommendations.expiresAt': { $lt: new Date() }
      }, {
        userId: 1,
        aiRecommendations: 1
      });
      
      let totalCleaned = 0;
      
      for (const userTracking of usersWithExpiredRecs) {
        const expiredCount = userTracking.aiRecommendations.filter(
          rec => new Date(rec.expiresAt) < new Date()
        ).length;
        
        // Remove expired recommendations
        userTracking.aiRecommendations = userTracking.aiRecommendations.filter(
          rec => new Date(rec.expiresAt) >= new Date()
        );
        
        await userTracking.save();
        totalCleaned += expiredCount;
      }
      
      const duration = Date.now() - startTime;
      
      loggingService.info('AI recommendations cleanup completed', {
        usersProcessed: usersWithExpiredRecs.length,
        recommendationsCleaned: totalCleaned,
        duration: `${duration}ms`
      });
      
      return {
        success: true,
        usersProcessed: usersWithExpiredRecs.length,
        recommendationsCleaned: totalCleaned,
        duration
      };
      
    } catch (error) {
      loggingService.error('Error during AI recommendations cleanup', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }
  
  /**
   * Refresh trending roadmaps if needed
   */
  async refreshTrendingRoadmapsIfNeeded() {
    try {
      const startTime = Date.now();
      
      const needsRefresh = await TrendingRoadmaps.needsRefresh();
      
      if (!needsRefresh) {
        loggingService.info('Trending roadmaps refresh skipped - not needed');
        return { success: true, refreshed: false, reason: 'Not needed' };
      }
      
      // Expire old periods
      const expiredCount = await TrendingRoadmaps.expireOldPeriods();
      
      loggingService.info('Trending roadmaps refresh completed', {
        expiredPeriods: expiredCount,
        duration: `${Date.now() - startTime}ms`
      });
      
      return {
        success: true,
        refreshed: true,
        expiredPeriods: expiredCount,
        duration: Date.now() - startTime
      };
      
    } catch (error) {
      loggingService.error('Error during trending roadmaps refresh', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }
  
  /**
   * Perform weekly cleanup tasks
   */
  async performWeeklyCleanup() {
    try {
      const startTime = Date.now();
      const results = {};
      
      // 1. Clean up old inactive learning entries (no progress for 30+ days)
      results.inactiveLearning = await this.cleanupInactiveLearning();
      
      // 2. Clean up old dismissed recommendations (older than 30 days)
      results.dismissedRecommendations = await this.cleanupDismissedRecommendations();
      
      // 3. Optimize user tracking documents (remove empty arrays, etc.)
      results.optimizedDocuments = await this.optimizeUserTrackingDocuments();
      
      // 4. Clean up old trending periods (keep only last 4 periods)
      results.oldTrendingPeriods = await this.cleanupOldTrendingPeriods();
      
      const duration = Date.now() - startTime;
      
      loggingService.info('Weekly cleanup completed', {
        results,
        duration: `${duration}ms`
      });
      
      return {
        success: true,
        results,
        duration
      };
      
    } catch (error) {
      loggingService.error('Error during weekly cleanup', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }
  
  /**
   * Perform monthly analytics cleanup
   */
  async performMonthlyAnalyticsCleanup() {
    try {
      const startTime = Date.now();
      const results = {};
      
      // 1. Archive old analytics data (older than 6 months)
      results.archivedAnalytics = await this.archiveOldAnalytics();
      
      // 2. Aggregate and summarize monthly statistics
      results.monthlyAggregation = await this.aggregateMonthlyStats();
      
      // 3. Clean up detailed interaction logs (keep summaries only)
      results.cleanedInteractionLogs = await this.cleanupDetailedInteractionLogs();
      
      const duration = Date.now() - startTime;
      
      loggingService.info('Monthly analytics cleanup completed', {
        results,
        duration: `${duration}ms`
      });
      
      return {
        success: true,
        results,
        duration
      };
      
    } catch (error) {
      loggingService.error('Error during monthly analytics cleanup', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }
  
  /**
   * Clean up inactive learning entries
   */
  async cleanupInactiveLearning() {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const result = await UserRoadmapTracking.updateMany(
      {
        'activeLearning.lastAccessedAt': { $lt: thirtyDaysAgo },
        'activeLearning.status': 'active',
        'activeLearning.progress.percentageComplete': { $lt: 5 } // Less than 5% progress
      },
      {
        $set: { 'activeLearning.$.status': 'inactive' }
      }
    );
    
    return result.modifiedCount;
  }
  
  /**
   * Clean up old dismissed recommendations
   */
  async cleanupDismissedRecommendations() {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const users = await UserRoadmapTracking.find({
      'aiRecommendations.interactionData.dismissedAt': { $lt: thirtyDaysAgo }
    });
    
    let totalCleaned = 0;
    
    for (const user of users) {
      const originalLength = user.aiRecommendations.length;
      user.aiRecommendations = user.aiRecommendations.filter(
        rec => !rec.interactionData.dismissed || 
               new Date(rec.interactionData.dismissedAt) >= thirtyDaysAgo
      );
      totalCleaned += originalLength - user.aiRecommendations.length;
      await user.save();
    }
    
    return totalCleaned;
  }
  
  /**
   * Optimize user tracking documents
   */
  async optimizeUserTrackingDocuments() {
    const result = await UserRoadmapTracking.updateMany(
      {
        $or: [
          { activeLearning: { $size: 0 } },
          { savedRoadmaps: { $size: 0 } },
          { aiRecommendations: { $size: 0 } }
        ]
      },
      {
        $unset: {
          activeLearning: "",
          savedRoadmaps: "",
          aiRecommendations: ""
        }
      }
    );
    
    return result.modifiedCount;
  }
  
  /**
   * Clean up old trending periods
   */
  async cleanupOldTrendingPeriods() {
    // Keep only the last 4 trending periods
    const recentPeriods = await TrendingRoadmaps.find({})
      .sort({ periodStart: -1 })
      .limit(4)
      .select('_id');
    
    const recentIds = recentPeriods.map(p => p._id);
    
    const result = await TrendingRoadmaps.deleteMany({
      _id: { $nin: recentIds }
    });
    
    return result.deletedCount;
  }
  
  /**
   * Archive old analytics data
   */
  async archiveOldAnalytics() {
    // This would typically move data to a separate archive collection
    // For now, we'll just clean up very old detailed analytics
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    
    const result = await UserRoadmapTracking.updateMany(
      {
        'analytics.detailedLogs.timestamp': { $lt: sixMonthsAgo }
      },
      {
        $pull: {
          'analytics.detailedLogs': {
            timestamp: { $lt: sixMonthsAgo }
          }
        }
      }
    );
    
    return result.modifiedCount;
  }
  
  /**
   * Aggregate monthly statistics
   */
  async aggregateMonthlyStats() {
    // This would create monthly summary documents
    // Implementation depends on specific analytics requirements
    return 0; // Placeholder
  }
  
  /**
   * Clean up detailed interaction logs
   */
  async cleanupDetailedInteractionLogs() {
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
    
    const result = await UserRoadmapTracking.updateMany(
      {},
      {
        $pull: {
          'analytics.interactionHistory': {
            timestamp: { $lt: oneMonthAgo }
          }
        }
      }
    );
    
    return result.modifiedCount;
  }
  
  /**
   * Manual cleanup trigger (for admin use)
   */
  async performManualCleanup(cleanupType = 'all') {
    try {
      const results = {};
      
      switch (cleanupType) {
        case 'ai-recommendations':
          results.aiRecommendations = await this.cleanupExpiredAIRecommendations();
          break;
          
        case 'trending-roadmaps':
          results.trendingRoadmaps = await this.refreshTrendingRoadmapsIfNeeded();
          break;
          
        case 'weekly':
          results.weekly = await this.performWeeklyCleanup();
          break;
          
        case 'monthly':
          results.monthly = await this.performMonthlyAnalyticsCleanup();
          break;
          
        case 'all':
        default:
          results.aiRecommendations = await this.cleanupExpiredAIRecommendations();
          results.trendingRoadmaps = await this.refreshTrendingRoadmapsIfNeeded();
          results.weekly = await this.performWeeklyCleanup();
          break;
      }
      
      return {
        success: true,
        cleanupType,
        results,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      loggingService.error('Manual cleanup failed', {
        cleanupType,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }
  
  /**
   * Get cleanup service status
   */
  getStatus() {
    return {
      initialized: this.isInitialized,
      activeJobs: Array.from(this.cleanupJobs.keys()),
      jobStatuses: Array.from(this.cleanupJobs.entries()).map(([name, job]) => ({
        name,
        running: job.running || false,
        scheduled: true
      }))
    };
  }
  
  /**
   * Stop all cleanup jobs
   */
  stop() {
    for (const [name, job] of this.cleanupJobs) {
      job.stop();
      loggingService.info(`Stopped cleanup job: ${name}`);
    }
    
    this.cleanupJobs.clear();
    this.isInitialized = false;
    
    loggingService.info('DataCleanupService stopped');
  }
}

module.exports = new DataCleanupService();