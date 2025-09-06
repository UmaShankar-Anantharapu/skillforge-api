const UserRoadmapTracking = require('../models/UserRoadmapTracking');
const TrendingRoadmaps = require('../models/TrendingRoadmaps');
const Roadmap = require('../models/Roadmap');
const UserProfile = require('../models/UserProfile');
const { chat, extractJSON } = require('./llmClient');
const { performWebSearch } = require('./researchAgentService');
const { loggingService } = require('./loggingService');
const { errorHandlingService } = require('./errorHandlingService');

/**
 * My Learning Service
 * Manages all data operations for the My-Learning page sections
 */
class MyLearningService {
  
  /**
   * Get Continue Learning section data
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Continue learning data with active roadmaps
   */
  async getContinueLearning(userId) {
    try {
      const tracking = await UserRoadmapTracking.findByUserId(userId);
      
      if (!tracking || !tracking.activeLearning || tracking.activeLearning.length === 0) {
        return {
          hasActiveRoadmaps: false,
          message: "Not started any roadmap yet",
          activeRoadmaps: [],
          totalActiveRoadmaps: 0
        };
      }
      
      // Filter only active roadmaps and populate full details
      const activeRoadmaps = tracking.activeLearning
        .filter(learning => learning.status === 'active')
        .sort((a, b) => new Date(b.lastAccessedAt) - new Date(a.lastAccessedAt));
      
      // Get full roadmap details for each active roadmap
      const roadmapsWithDetails = await Promise.all(
        activeRoadmaps.map(async (learning) => {
          const roadmap = await Roadmap.findById(learning.roadmapId)
            .select('title description category difficultyLevel estimatedDuration milestones steps phases progress tags');
          
          if (!roadmap) return null;
          
          return {
            trackingId: learning._id,
            roadmapId: learning.roadmapId,
            roadmapDetails: roadmap,
            progress: learning.progress,
            startedAt: learning.startedAt,
            lastAccessedAt: learning.lastAccessedAt,
            priority: learning.priority,
            status: learning.status,
            // Include sources and complete roadmap structure
            completeSources: roadmap.generationMetadata?.sources || [],
            fullStructure: {
              milestones: roadmap.milestones,
              steps: roadmap.steps,
              phases: roadmap.phases
            }
          };
        })
      );
      
      const validRoadmaps = roadmapsWithDetails.filter(roadmap => roadmap !== null);
      
      return {
        hasActiveRoadmaps: validRoadmaps.length > 0,
        message: validRoadmaps.length > 0 ? null : "Not started any roadmap yet",
        activeRoadmaps: validRoadmaps,
        totalActiveRoadmaps: validRoadmaps.length,
        analytics: {
          totalTimeSpent: validRoadmaps.reduce((total, roadmap) => 
            total + (roadmap.progress.totalTimeSpent || 0), 0),
          averageProgress: validRoadmaps.length > 0 ? 
            validRoadmaps.reduce((total, roadmap) => 
              total + roadmap.progress.percentageComplete, 0) / validRoadmaps.length : 0,
          longestStreak: tracking.analytics?.longestStreak || 0
        }
      };
      
    } catch (error) {
      loggingService.error('Error fetching continue learning data', {
        userId,
        error: error.message
      });
      throw error;
    }
  }
  
  /**
   * Get Saved Roadmaps section data
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Saved roadmaps with summaries and level details
   */
  async getSavedRoadmaps(userId) {
    try {
      const tracking = await UserRoadmapTracking.findOne({ userId }, { savedRoadmaps: 1 });
      
      if (!tracking || !tracking.savedRoadmaps || tracking.savedRoadmaps.length === 0) {
        return {
          hasSavedRoadmaps: false,
          message: "Not saved any roadmap yet",
          savedRoadmaps: [],
          totalSavedRoadmaps: 0
        };
      }
      
      // Sort by most recently saved
      const sortedSavedRoadmaps = tracking.savedRoadmaps
        .sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt))
        .map(saved => ({
          trackingId: saved._id,
          roadmapId: saved.roadmapId,
          summary: saved.summary,
          levelDetails: saved.levelDetails,
          savedAt: saved.savedAt,
          lastViewedAt: saved.lastViewedAt,
          isFavorite: saved.isFavorite,
          personalNotes: saved.personalNotes,
          // Quick stats for display
          quickStats: {
            totalLevels: saved.levelDetails ? saved.levelDetails.length : 0,
            estimatedTotalHours: saved.levelDetails ? 
              saved.levelDetails.reduce((total, level) => total + (level.estimatedHours || 0), 0) : 0,
            skillsCount: saved.levelDetails ? 
              saved.levelDetails.reduce((total, level) => total + (level.skillsToLearn?.length || 0), 0) : 0
          }
        }));
      
      return {
        hasSavedRoadmaps: true,
        message: null,
        savedRoadmaps: sortedSavedRoadmaps,
        totalSavedRoadmaps: sortedSavedRoadmaps.length,
        categories: this.extractCategories(sortedSavedRoadmaps),
        favoriteCount: sortedSavedRoadmaps.filter(roadmap => roadmap.isFavorite).length
      };
      
    } catch (error) {
      loggingService.error('Error fetching saved roadmaps', {
        userId,
        error: error.message
      });
      throw error;
    }
  }
  
  /**
   * Get AI Recommendations section data
   * @param {string} userId - User ID
   * @param {boolean} forceRefresh - Force refresh recommendations
   * @returns {Promise<Object>} AI recommendations (max 25, 7-day expiration)
   */
  async getAIRecommendations(userId, forceRefresh = false) {
    try {
      let tracking = await UserRoadmapTracking.findOne({ userId });
      
      if (!tracking) {
        // Create new tracking document for user
        tracking = new UserRoadmapTracking({ userId });
        await tracking.save();
      }
      
      // Check if recommendations need refresh
      const needsRefresh = forceRefresh || 
        this.shouldRefreshRecommendations(tracking.aiRecommendations, tracking.analytics.lastRecommendationRefresh);
      
      if (needsRefresh) {
        await this.generateAIRecommendations(userId, tracking);
        // Reload tracking after generating new recommendations
        tracking = await UserRoadmapTracking.findOne({ userId });
      }
      
      // Get active (non-expired, non-dismissed) recommendations
      const activeRecommendations = tracking.aiRecommendations
        .filter(rec => {
          const now = new Date();
          return new Date(rec.expiresAt) > now && !rec.interactionData.dismissed;
        })
        .sort((a, b) => b.relevanceScore - a.relevanceScore)
        .slice(0, 25);
      
      if (activeRecommendations.length === 0) {
        return {
          hasRecommendations: false,
          message: "No AI recommendations available. Check back later!",
          recommendations: [],
          totalRecommendations: 0,
          lastRefreshed: tracking.analytics.lastRecommendationRefresh
        };
      }
      
      return {
        hasRecommendations: true,
        message: null,
        recommendations: activeRecommendations.map(rec => ({
          recommendationId: rec.recommendationId,
          title: rec.title,
          description: rec.description,
          category: rec.category,
          difficultyLevel: rec.difficultyLevel,
          estimatedDuration: rec.estimatedDuration,
          relevanceScore: rec.relevanceScore,
          suggestedDateTime: rec.suggestedDateTime,
          expiresAt: rec.expiresAt,
          basedOn: rec.basedOn,
          interactionData: rec.interactionData,
          daysUntilExpiry: Math.ceil((new Date(rec.expiresAt) - new Date()) / (1000 * 60 * 60 * 24))
        })),
        totalRecommendations: activeRecommendations.length,
        lastRefreshed: tracking.analytics.lastRecommendationRefresh,
        nextRefresh: this.calculateNextRefreshDate(tracking.analytics.lastRecommendationRefresh)
      };
      
    } catch (error) {
      loggingService.error('Error fetching AI recommendations', {
        userId,
        error: error.message
      });
      throw error;
    }
  }
  
  /**
   * Get Trending Roadmaps section data
   * @param {number} limit - Number of trending roadmaps to return (default 25)
   * @returns {Promise<Object>} Global trending roadmaps
   */
  async getTrendingRoadmaps(limit = 25) {
    try {
      // Check if current trending data needs refresh
      const needsRefresh = await TrendingRoadmaps.needsRefresh();
      
      if (needsRefresh) {
        await this.generateTrendingRoadmaps();
      }
      
      const trendingData = await TrendingRoadmaps.getLatestTrending(limit);
      
      if (!trendingData || trendingData.length === 0) {
        return {
          hasTrendingRoadmaps: false,
          message: "No trending roadmaps available at the moment",
          trendingRoadmaps: [],
          totalTrendingRoadmaps: 0
        };
      }
      
      return {
        hasTrendingRoadmaps: true,
        message: null,
        trendingRoadmaps: trendingData.map(roadmap => ({
          rank: roadmap.rank,
          roadmapId: roadmap.roadmapId,
          title: roadmap.title,
          description: roadmap.description,
          category: roadmap.category,
          difficultyLevel: roadmap.difficultyLevel,
          estimatedDuration: roadmap.estimatedDuration,
          tags: roadmap.tags,
          trendingScore: roadmap.trendingScore,
          metrics: roadmap.metrics,
          industryRelevance: roadmap.industryRelevance,
          resources: roadmap.resources?.slice(0, 3) || [], // Limit resources for performance
          demoProjects: roadmap.demoProjects?.slice(0, 2) || [], // Limit demo projects
          imageUrl: roadmap.imageUrl
        })),
        totalTrendingRoadmaps: trendingData.length,
        categories: this.extractTrendingCategories(trendingData),
        lastUpdated: await this.getTrendingLastUpdated()
      };
      
    } catch (error) {
      loggingService.error('Error fetching trending roadmaps', {
        error: error.message
      });
      throw error;
    }
  }
  
  /**
   * Add roadmap to user's active learning
   * @param {string} userId - User ID
   * @param {string} roadmapId - Roadmap ID
   * @returns {Promise<Object>} Updated tracking data
   */
  async startRoadmap(userId, roadmapId) {
    try {
      const roadmap = await Roadmap.findById(roadmapId);
      if (!roadmap) {
        throw new Error('Roadmap not found');
      }
      
      let tracking = await UserRoadmapTracking.findOne({ userId });
      if (!tracking) {
        tracking = new UserRoadmapTracking({ userId });
      }
      
      await tracking.addToActiveLearning(roadmapId, {
        totalSteps: roadmap.steps ? roadmap.steps.length : 
                   roadmap.phases ? roadmap.phases.reduce((total, phase) => 
                     total + (phase.milestones ? phase.milestones.length : 0), 0) : 0
      });
      
      loggingService.logActivity({
        userId,
        action: 'roadmap_started',
        details: { roadmapId, title: roadmap.title }
      });
      
      return {
        success: true,
        message: 'Roadmap added to active learning',
        roadmapId,
        trackingId: tracking._id
      };
      
    } catch (error) {
      loggingService.error('Error starting roadmap', {
        userId,
        roadmapId,
        error: error.message
      });
      throw error;
    }
  }
  
  /**
   * Save roadmap to user's saved roadmaps
   * @param {string} userId - User ID
   * @param {string} roadmapId - Roadmap ID
   * @returns {Promise<Object>} Updated tracking data
   */
  async saveRoadmap(userId, roadmapId) {
    try {
      const roadmap = await Roadmap.findById(roadmapId);
      if (!roadmap) {
        throw new Error('Roadmap not found');
      }
      
      let tracking = await UserRoadmapTracking.findOne({ userId });
      if (!tracking) {
        tracking = new UserRoadmapTracking({ userId });
      }
      
      await tracking.addToSavedRoadmaps(roadmap);
      
      loggingService.logActivity({
        userId,
        action: 'roadmap_saved',
        details: { roadmapId, title: roadmap.title }
      });
      
      return {
        success: true,
        message: 'Roadmap saved successfully',
        roadmapId,
        trackingId: tracking._id
      };
      
    } catch (error) {
      loggingService.error('Error saving roadmap', {
        userId,
        roadmapId,
        error: error.message
      });
      throw error;
    }
  }
  
  /**
   * Mark AI recommendation as viewed/clicked/dismissed
   * @param {string} userId - User ID
   * @param {string} recommendationId - Recommendation ID
   * @param {string} action - Action type ('viewed', 'clicked', 'dismissed')
   * @returns {Promise<Object>} Updated tracking data
   */
  async updateRecommendationInteraction(userId, recommendationId, action) {
    try {
      const tracking = await UserRoadmapTracking.findOne({ userId });
      if (!tracking) {
        throw new Error('User tracking not found');
      }
      
      const recommendation = tracking.aiRecommendations.find(
        rec => rec.recommendationId === recommendationId
      );
      
      if (!recommendation) {
        throw new Error('Recommendation not found');
      }
      
      const now = new Date();
      
      switch (action) {
        case 'viewed':
          recommendation.interactionData.viewed = true;
          recommendation.interactionData.viewedAt = now;
          break;
        case 'clicked':
          recommendation.interactionData.clicked = true;
          recommendation.interactionData.clickedAt = now;
          if (!recommendation.interactionData.viewed) {
            recommendation.interactionData.viewed = true;
            recommendation.interactionData.viewedAt = now;
          }
          break;
        case 'dismissed':
          recommendation.interactionData.dismissed = true;
          recommendation.interactionData.dismissedAt = now;
          break;
        default:
          throw new Error('Invalid action type');
      }
      
      await tracking.save();
      
      return {
        success: true,
        message: `Recommendation ${action} successfully`,
        recommendationId,
        action
      };
      
    } catch (error) {
      loggingService.error('Error updating recommendation interaction', {
        userId,
        recommendationId,
        action,
        error: error.message
      });
      throw error;
    }
  }
  
  // Private helper methods
  
  /**
   * Check if AI recommendations need refresh
   * @param {Array} recommendations - Current recommendations
   * @param {Date} lastRefresh - Last refresh date
   * @returns {boolean} Whether refresh is needed
   */
  shouldRefreshRecommendations(recommendations, lastRefresh) {
    if (!recommendations || recommendations.length === 0) return true;
    if (!lastRefresh) return true;
    
    const now = new Date();
    const daysSinceRefresh = (now - new Date(lastRefresh)) / (1000 * 60 * 60 * 24);
    
    // Refresh if more than 7 days or less than 5 active recommendations
    const activeCount = recommendations.filter(rec => 
      new Date(rec.expiresAt) > now && !rec.interactionData.dismissed
    ).length;
    
    return daysSinceRefresh >= 7 || activeCount < 5;
  }
  
  /**
   * Generate new AI recommendations for user
   * @param {string} userId - User ID
   * @param {Object} tracking - User tracking document
   */
  async generateAIRecommendations(userId, tracking) {
    try {
      // Get user profile for personalization
      const userProfile = await UserProfile.findOne({ userId });
      
      // Build context for AI recommendations
      const context = {
        currentSkills: userProfile?.currentSkills || [],
        learningGoals: userProfile?.learningGoals || {},
        completedRoadmaps: tracking.analytics?.totalRoadmapsCompleted || 0,
        preferredCategories: tracking.recommendationPreferences?.preferredCategories || [],
        excludedTopics: tracking.recommendationPreferences?.excludedTopics || []
      };
      
      // Get industry trends
      const trendingTopics = await this.getIndustryTrends();
      
      // Generate recommendations using AI
      const prompt = this.buildRecommendationPrompt(context, trendingTopics);
      const aiResponse = await chat([{ role: 'user', content: prompt }]);
      const recommendationsData = extractJSON(aiResponse);
      
      if (recommendationsData && recommendationsData.recommendations) {
        const processedRecommendations = recommendationsData.recommendations.map(rec => ({
          ...rec,
          relevanceScore: rec.relevanceScore || Math.random() * 0.5 + 0.5, // Ensure score between 0.5-1
          basedOn: {
            userSkills: context.currentSkills.slice(0, 5),
            learningHistory: [`${context.completedRoadmaps} completed roadmaps`],
            industryTrends: trendingTopics.slice(0, 3)
          }
        }));
        
        await tracking.addAIRecommendations(processedRecommendations);
      }
      
    } catch (error) {
      loggingService.error('Error generating AI recommendations', {
        userId,
        error: error.message
      });
      // Don't throw error, just log it - we can return empty recommendations
    }
  }
  
  /**
   * Generate trending roadmaps data
   */
  async generateTrendingRoadmaps() {
    try {
      // Expire old periods
      await TrendingRoadmaps.expireOldPeriods();
      
      // Get trending topics from web search
      const trendingTopics = await performWebSearch(
        'top trending technologies developer skills programming 2025', 
        15
      );
      
      // Generate trending roadmaps using AI
      const prompt = this.buildTrendingPrompt(trendingTopics);
      const aiResponse = await chat([{ role: 'user', content: prompt }]);
      const trendingData = extractJSON(aiResponse);
      
      if (trendingData && trendingData.roadmaps) {
        const processedRoadmaps = trendingData.roadmaps.map((roadmap, index) => ({
          rank: index + 1,
          roadmapId: roadmap.id || `trending_${Date.now()}_${index}`,
          title: roadmap.title,
          description: roadmap.description,
          category: roadmap.category,
          difficultyLevel: roadmap.difficultyLevel || 'Intermediate',
          estimatedDuration: roadmap.estimatedDuration || '4-6 weeks',
          tags: roadmap.tags || [],
          trendingScore: roadmap.trendingScore || (100 - index * 3), // Decreasing score by rank
          metrics: {
            totalViews: Math.floor(Math.random() * 10000) + 1000,
            totalStarts: Math.floor(Math.random() * 5000) + 500,
            totalCompletions: Math.floor(Math.random() * 1000) + 100,
            totalSaves: Math.floor(Math.random() * 2000) + 200,
            averageRating: (Math.random() * 2 + 3).toFixed(1), // 3.0-5.0
            totalRatings: Math.floor(Math.random() * 500) + 50
          },
          industryRelevance: roadmap.industryRelevance || {
            trendingTopics: trendingTopics.slice(0, 3).map(t => t.title),
            industryDemand: Math.floor(Math.random() * 30) + 70, // 70-100
            jobMarketRelevance: Math.floor(Math.random() * 30) + 70,
            skillDemandGrowth: Math.floor(Math.random() * 40) + 10 // 10-50
          },
          resources: roadmap.resources || [],
          demoProjects: roadmap.demoProjects || [],
          imageUrl: roadmap.imageUrl || '',
          sourceData: {
            generatedBy: 'ai-analysis',
            sources: trendingTopics.slice(0, 5).map(t => t.url),
            lastUpdated: new Date(),
            confidence: 0.8
          }
        }));
        
        await TrendingRoadmaps.createNewPeriod(processedRoadmaps);
      }
      
    } catch (error) {
      loggingService.error('Error generating trending roadmaps', {
        error: error.message
      });
      throw error;
    }
  }
  
  /**
   * Build AI prompt for recommendations
   */
  buildRecommendationPrompt(context, trendingTopics) {
    return `Generate 25 personalized learning roadmap recommendations based on:

User Context:
- Current Skills: ${context.currentSkills.join(', ')}
- Learning Goals: ${JSON.stringify(context.learningGoals)}
- Completed Roadmaps: ${context.completedRoadmaps}
- Preferred Categories: ${context.preferredCategories.join(', ')}
- Excluded Topics: ${context.excludedTopics.join(', ')}

Industry Trends: ${trendingTopics.map(t => t.title).join(', ')}

Return JSON format:
{
  "recommendations": [
    {
      "id": "unique-id",
      "title": "Roadmap Title",
      "description": "Detailed description",
      "category": "Category",
      "difficultyLevel": "Beginner|Intermediate|Advanced",
      "estimatedDuration": "X weeks",
      "relevanceScore": 0.85
    }
  ]
}`;
  }
  
  /**
   * Build AI prompt for trending roadmaps
   */
  buildTrendingPrompt(trendingTopics) {
    const topicsText = trendingTopics.map(t => t.title).join(', ');
    
    return `Based on these trending topics: ${topicsText}

Generate 25 trending learning roadmaps that are currently in high demand. Focus on:
1. Emerging technologies
2. In-demand skills
3. Industry growth areas
4. Popular frameworks/tools

Return JSON format:
{
  "roadmaps": [
    {
      "id": "unique-slug",
      "title": "Roadmap Title",
      "description": "Compelling description",
      "category": "Technology Category",
      "difficultyLevel": "Beginner|Intermediate|Advanced",
      "estimatedDuration": "X weeks",
      "tags": ["tag1", "tag2"],
      "trendingScore": 95,
      "resources": [{"title": "Resource", "url": "https://example.com", "type": "article"}],
      "demoProjects": [{"title": "Project", "description": "Description"}]
    }
  ]
}`;
  }
  
  /**
   * Get industry trends from web search
   */
  async getIndustryTrends() {
    try {
      return await performWebSearch(
        'trending programming technologies developer skills 2025', 
        10
      );
    } catch (error) {
      loggingService.error('Error fetching industry trends', { error: error.message });
      return [];
    }
  }
  
  /**
   * Extract categories from roadmaps
   */
  extractCategories(roadmaps) {
    const categories = {};
    roadmaps.forEach(roadmap => {
      const category = roadmap.summary?.category || 'Other';
      categories[category] = (categories[category] || 0) + 1;
    });
    return Object.entries(categories).map(([name, count]) => ({ name, count }));
  }
  
  /**
   * Extract categories from trending roadmaps
   */
  extractTrendingCategories(roadmaps) {
    const categories = {};
    roadmaps.forEach(roadmap => {
      const category = roadmap.category || 'Other';
      categories[category] = (categories[category] || 0) + 1;
    });
    return Object.entries(categories).map(([name, count]) => ({ name, count }));
  }
  
  /**
   * Calculate next refresh date
   */
  calculateNextRefreshDate(lastRefresh) {
    if (!lastRefresh) return new Date();
    const nextRefresh = new Date(lastRefresh);
    nextRefresh.setDate(nextRefresh.getDate() + 7);
    return nextRefresh;
  }
  
  /**
   * Get trending roadmaps last updated date
   */
  async getTrendingLastUpdated() {
    try {
      const current = await TrendingRoadmaps.getCurrentTrending();
      return current ? current.generationMetadata.generatedAt : null;
    } catch (error) {
      return null;
    }
  }
}

module.exports = new MyLearningService();