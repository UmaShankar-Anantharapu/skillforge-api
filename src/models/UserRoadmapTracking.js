const mongoose = require('mongoose');

// Schema for tracking user's roadmap interactions across different sections
const userRoadmapTrackingSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Continue Learning Section - Active roadmaps with complete details
  activeLearning: [{
    roadmapId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Roadmap',
      required: true
    },
    startedAt: {
      type: Date,
      default: Date.now
    },
    lastAccessedAt: {
      type: Date,
      default: Date.now
    },
    progress: {
      completedSteps: { type: Number, default: 0 },
      totalSteps: { type: Number, required: true },
      percentageComplete: { type: Number, default: 0, min: 0, max: 100 },
      currentMilestone: { type: String },
      streakDays: { type: Number, default: 0 },
      totalTimeSpent: { type: Number, default: 0 } // in minutes
    },
    status: {
      type: String,
      enum: ['active', 'paused', 'completed'],
      default: 'active'
    },
    priority: {
      type: Number,
      default: 1,
      min: 1,
      max: 5
    }
  }],
  
  // Saved Roadmaps Section - Roadmap summaries and level-wise details
  savedRoadmaps: [{
    roadmapId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Roadmap'
    },
    // Store summary data to avoid full roadmap fetches
    summary: {
      title: { type: String, required: true },
      description: { type: String },
      category: { type: String },
      difficultyLevel: {
        type: String,
        enum: ['Beginner', 'Intermediate', 'Advanced']
      },
      estimatedDuration: { type: String },
      totalMilestones: { type: Number, default: 0 },
      tags: [{ type: String }]
    },
    // Level-wise breakdown for quick access
    levelDetails: [{
      level: { type: Number, required: true },
      title: { type: String, required: true },
      description: { type: String },
      estimatedHours: { type: Number },
      skillsToLearn: [{ type: String }],
      milestoneCount: { type: Number, default: 0 }
    }],
    savedAt: {
      type: Date,
      default: Date.now
    },
    lastViewedAt: {
      type: Date
    },
    isFavorite: {
      type: Boolean,
      default: false
    },
    personalNotes: {
      type: String,
      maxlength: 500
    }
  }],
  
  // AI Recommendations Section - Max 25 recommendations with 7-day expiration
  aiRecommendations: [{
    recommendationId: {
      type: String,
      required: true,
      unique: true
    },
    title: {
      type: String,
      required: true
    },
    description: {
      type: String,
      required: true
    },
    category: {
      type: String,
      required: true
    },
    difficultyLevel: {
      type: String,
      enum: ['Beginner', 'Intermediate', 'Advanced'],
      required: true
    },
    estimatedDuration: {
      type: String,
      required: true
    },
    relevanceScore: {
      type: Number,
      min: 0,
      max: 1,
      required: true
    },
    suggestedDateTime: {
      type: Date,
      default: Date.now,
      required: true
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expireAfterSeconds: 0 } // MongoDB TTL index
    },
    basedOn: {
      userSkills: [{ type: String }],
      learningHistory: [{ type: String }],
      industryTrends: [{ type: String }]
    },
    interactionData: {
      viewed: { type: Boolean, default: false },
      viewedAt: { type: Date },
      clicked: { type: Boolean, default: false },
      clickedAt: { type: Date },
      dismissed: { type: Boolean, default: false },
      dismissedAt: { type: Date }
    }
  }],
  
  // User preferences for recommendations
  recommendationPreferences: {
    preferredCategories: [{ type: String }],
    preferredDifficulty: [{
      type: String,
      enum: ['Beginner', 'Intermediate', 'Advanced']
    }],
    excludedTopics: [{ type: String }],
    maxRecommendations: {
      type: Number,
      default: 25,
      min: 5,
      max: 25
    },
    refreshFrequency: {
      type: Number,
      default: 7, // days
      min: 1,
      max: 30
    }
  },
  
  // Analytics and tracking
  analytics: {
    totalRoadmapsStarted: { type: Number, default: 0 },
    totalRoadmapsCompleted: { type: Number, default: 0 },
    totalRoadmapsSaved: { type: Number, default: 0 },
    averageCompletionRate: { type: Number, default: 0, min: 0, max: 100 },
    totalLearningTimeMinutes: { type: Number, default: 0 },
    longestStreak: { type: Number, default: 0 },
    lastRecommendationRefresh: { type: Date },
    engagementScore: { type: Number, default: 0, min: 0, max: 100 }
  }
}, {
  timestamps: true,
  versionKey: false,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Comprehensive indexes for performance optimization
userRoadmapTrackingSchema.index({ userId: 1 }, { unique: true }); // Primary lookup
userRoadmapTrackingSchema.index({ 'activeLearning.roadmapId': 1 }); // Active roadmap queries
userRoadmapTrackingSchema.index({ 'activeLearning.status': 1 }); // Status filtering
userRoadmapTrackingSchema.index({ 'activeLearning.lastAccessedAt': -1 }); // Recent activity
userRoadmapTrackingSchema.index({ 'savedRoadmaps.roadmapId': 1 }); // Saved roadmap lookup
userRoadmapTrackingSchema.index({ 'savedRoadmaps.savedAt': -1 }); // Recent saves
userRoadmapTrackingSchema.index({ 'savedRoadmaps.category': 1 }); // Category filtering
userRoadmapTrackingSchema.index({ 'aiRecommendations.expiresAt': 1 }, { expireAfterSeconds: 0 }); // TTL for cleanup
userRoadmapTrackingSchema.index({ 'aiRecommendations.suggestedDateTime': -1 }); // Recent recommendations
userRoadmapTrackingSchema.index({ 'aiRecommendations.category': 1 }); // Category-based recommendations
userRoadmapTrackingSchema.index({ 'aiRecommendations.difficultyLevel': 1 }); // Difficulty filtering
userRoadmapTrackingSchema.index({ 'recommendationPreferences.categories': 1 }); // Preference matching
userRoadmapTrackingSchema.index({ 'analytics.totalRecommendationsViewed': -1 }); // Analytics queries
userRoadmapTrackingSchema.index({ updatedAt: -1 }); // Recent updates
userRoadmapTrackingSchema.index({ createdAt: -1 }); // User registration order

// Virtual for active recommendations count
userRoadmapTrackingSchema.virtual('activeRecommendationsCount').get(function() {
  return this.aiRecommendations ? this.aiRecommendations.filter(rec => 
    new Date(rec.expiresAt) > new Date() && !rec.interactionData.dismissed
  ).length : 0;
});

// Virtual for active learning count
userRoadmapTrackingSchema.virtual('activeLearningCount').get(function() {
  return this.activeLearning ? this.activeLearning.filter(learning => 
    learning.status === 'active'
  ).length : 0;
});

// Virtual for saved roadmaps count
userRoadmapTrackingSchema.virtual('savedRoadmapsCount').get(function() {
  return this.savedRoadmaps ? this.savedRoadmaps.length : 0;
});

// Pre-save middleware to manage AI recommendations limit
userRoadmapTrackingSchema.pre('save', function(next) {
  // Ensure AI recommendations don't exceed 25
  if (this.aiRecommendations && this.aiRecommendations.length > 25) {
    // Sort by relevance score and keep top 25
    this.aiRecommendations.sort((a, b) => b.relevanceScore - a.relevanceScore);
    this.aiRecommendations = this.aiRecommendations.slice(0, 25);
  }
  
  // Set expiration date for new AI recommendations (7 days from suggestion)
  if (this.aiRecommendations) {
    this.aiRecommendations.forEach(rec => {
      if (!rec.expiresAt) {
        const expirationDate = new Date(rec.suggestedDateTime);
        expirationDate.setDate(expirationDate.getDate() + 7);
        rec.expiresAt = expirationDate;
      }
    });
  }
  
  next();
});

// Static methods
userRoadmapTrackingSchema.statics.findByUserId = function(userId) {
  return this.findOne({ userId }).populate('activeLearning.roadmapId', 'title description category difficultyLevel');
};

userRoadmapTrackingSchema.statics.getActiveLearning = function(userId) {
  return this.findOne({ userId }, { activeLearning: 1 })
    .populate('activeLearning.roadmapId');
};

userRoadmapTrackingSchema.statics.getSavedRoadmaps = function(userId) {
  return this.findOne({ userId }, { savedRoadmaps: 1 });
};

userRoadmapTrackingSchema.statics.getActiveRecommendations = function(userId) {
  return this.findOne({ userId }, { aiRecommendations: 1 })
    .then(doc => {
      if (!doc) return [];
      const now = new Date();
      return doc.aiRecommendations.filter(rec => 
        new Date(rec.expiresAt) > now && !rec.interactionData.dismissed
      );
    });
};

// Instance methods
userRoadmapTrackingSchema.methods.addToActiveLearning = function(roadmapId, roadmapData) {
  const existingIndex = this.activeLearning.findIndex(learning => 
    learning.roadmapId.toString() === roadmapId.toString()
  );
  
  if (existingIndex === -1) {
    this.activeLearning.push({
      roadmapId,
      progress: {
        totalSteps: roadmapData.totalSteps || 0,
        completedSteps: 0,
        percentageComplete: 0
      },
      status: 'active'
    });
    this.analytics.totalRoadmapsStarted += 1;
  } else {
    this.activeLearning[existingIndex].lastAccessedAt = new Date();
    this.activeLearning[existingIndex].status = 'active';
  }
  
  return this.save();
};

userRoadmapTrackingSchema.methods.addToSavedRoadmaps = function(roadmapData) {
  const existingIndex = this.savedRoadmaps.findIndex(saved => 
    saved.roadmapId && saved.roadmapId.toString() === roadmapData._id.toString()
  );
  
  if (existingIndex === -1) {
    this.savedRoadmaps.push({
      roadmapId: roadmapData._id,
      summary: {
        title: roadmapData.title,
        description: roadmapData.description,
        category: roadmapData.category,
        difficultyLevel: roadmapData.difficultyLevel,
        estimatedDuration: roadmapData.estimatedDuration,
        totalMilestones: roadmapData.milestones ? roadmapData.milestones.length : 0,
        tags: roadmapData.tags || []
      },
      levelDetails: this.extractLevelDetails(roadmapData)
    });
    this.analytics.totalRoadmapsSaved += 1;
  }
  
  return this.save();
};

userRoadmapTrackingSchema.methods.addAIRecommendations = function(recommendations) {
  // Clear existing recommendations
  this.aiRecommendations = [];
  
  // Add new recommendations (max 25)
  const limitedRecommendations = recommendations.slice(0, 25);
  
  limitedRecommendations.forEach(rec => {
    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() + 7);
    
    this.aiRecommendations.push({
      recommendationId: rec.id || `rec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      title: rec.title,
      description: rec.description,
      category: rec.category,
      difficultyLevel: rec.difficultyLevel,
      estimatedDuration: rec.estimatedDuration,
      relevanceScore: rec.relevanceScore || 0.5,
      expiresAt: expirationDate,
      basedOn: rec.basedOn || {}
    });
  });
  
  this.analytics.lastRecommendationRefresh = new Date();
  return this.save();
};

userRoadmapTrackingSchema.methods.extractLevelDetails = function(roadmapData) {
  const levelDetails = [];
  
  if (roadmapData.phases && roadmapData.phases.length > 0) {
    roadmapData.phases.forEach((phase, index) => {
      levelDetails.push({
        level: index + 1,
        title: phase.title,
        description: phase.description,
        estimatedHours: phase.milestones ? 
          phase.milestones.reduce((total, milestone) => total + (milestone.estimatedHours || 0), 0) : 0,
        skillsToLearn: phase.milestones ? 
          phase.milestones.flatMap(milestone => milestone.topics || []) : [],
        milestoneCount: phase.milestones ? phase.milestones.length : 0
      });
    });
  } else if (roadmapData.milestones && roadmapData.milestones.length > 0) {
    roadmapData.milestones.forEach((milestone, index) => {
      levelDetails.push({
        level: index + 1,
        title: milestone.title,
        description: milestone.description,
        estimatedHours: milestone.estimatedWeeks ? milestone.estimatedWeeks * 10 : 5, // Estimate
        skillsToLearn: milestone.skills || [],
        milestoneCount: 1
      });
    });
  }
  
  return levelDetails;
};

module.exports = mongoose.model('UserRoadmapTracking', userRoadmapTrackingSchema);