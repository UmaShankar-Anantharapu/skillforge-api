const mongoose = require('mongoose');

// Schema for global trending roadmaps collection
const trendingRoadmapsSchema = new mongoose.Schema({
  // Unique identifier for the trending period
  periodId: {
    type: String,
    required: true,
    unique: true
  },
  
  // Period information
  periodStart: {
    type: Date,
    required: true
  },
  
  periodEnd: {
    type: Date,
    required: true
  },
  
  // Status of the trending period
  status: {
    type: String,
    enum: ['active', 'expired', 'generating'],
    default: 'active'
  },
  
  // Trending roadmaps data
  trendingRoadmaps: [{
    rank: {
      type: Number,
      required: true,
      min: 1
    },
    roadmapId: {
      type: String,
      required: true
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
    tags: [{
      type: String
    }],
    
    // Trending metrics
    trendingScore: {
      type: Number,
      required: true,
      min: 0,
      max: 100
    },
    
    // Engagement metrics
    metrics: {
      totalViews: { type: Number, default: 0 },
      totalStarts: { type: Number, default: 0 },
      totalCompletions: { type: Number, default: 0 },
      totalSaves: { type: Number, default: 0 },
      averageRating: { type: Number, min: 0, max: 5, default: 0 },
      totalRatings: { type: Number, default: 0 },
      shareCount: { type: Number, default: 0 },
      completionRate: { type: Number, min: 0, max: 100, default: 0 }
    },
    
    // Industry relevance
    industryRelevance: {
      trendingTopics: [{ type: String }],
      industryDemand: { type: Number, min: 0, max: 100, default: 50 },
      jobMarketRelevance: { type: Number, min: 0, max: 100, default: 50 },
      skillDemandGrowth: { type: Number, min: -100, max: 100, default: 0 }
    },
    
    // Resources and demo projects
    resources: [{
      title: { type: String, required: true },
      url: { type: String, required: true },
      type: {
        type: String,
        enum: ['video', 'article', 'course', 'book', 'tool', 'documentation'],
        required: true
      },
      isFree: { type: Boolean, default: true }
    }],
    
    demoProjects: [{
      title: { type: String, required: true },
      url: { type: String },
      description: { type: String },
      difficulty: {
        type: String,
        enum: ['Beginner', 'Intermediate', 'Advanced']
      }
    }],
    
    // Thumbnail/image for display
    imageUrl: {
      type: String,
      default: ''
    },
    
    // Source information
    sourceData: {
      generatedBy: {
        type: String,
        enum: ['ai-analysis', 'web-scraping', 'user-analytics', 'manual'],
        default: 'ai-analysis'
      },
      sources: [{ type: String }],
      lastUpdated: { type: Date, default: Date.now },
      confidence: { type: Number, min: 0, max: 1, default: 0.5 }
    }
  }],
  
  // Generation metadata
  generationMetadata: {
    generatedAt: {
      type: Date,
      default: Date.now
    },
    generationMethod: {
      type: String,
      enum: ['web-scraping', 'user-analytics', 'ai-analysis', 'hybrid'],
      default: 'hybrid'
    },
    dataSource: {
      webScrapingSources: [{ type: String }],
      analyticsTimeframe: { type: String },
      aiModel: { type: String },
      totalDataPoints: { type: Number, default: 0 }
    },
    qualityScore: {
      type: Number,
      min: 0,
      max: 100,
      default: 50
    },
    processingTime: {
      type: Number, // in milliseconds
      default: 0
    }
  },
  
  // Auto-expiration (7 days)
  expiresAt: {
    type: Date,
    required: true,
    index: { expireAfterSeconds: 0 } // MongoDB TTL index
  },
  
  // Analytics for the trending period
  periodAnalytics: {
    totalRequests: { type: Number, default: 0 },
    uniqueUsers: { type: Number, default: 0 },
    averageEngagement: { type: Number, min: 0, max: 100, default: 0 },
    topCategories: [{
      category: { type: String },
      count: { type: Number }
    }],
    topDifficulties: [{
      difficulty: { type: String },
      count: { type: Number }
    }]
  }
}, {
  timestamps: true,
  versionKey: false,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Comprehensive indexes for performance optimization
trendingRoadmapsSchema.index({ periodId: 1 }, { unique: true }); // Primary lookup
trendingRoadmapsSchema.index({ status: 1 }); // Status filtering
trendingRoadmapsSchema.index({ periodStart: -1 }); // Recent periods first
trendingRoadmapsSchema.index({ periodEnd: -1 }); // Period end sorting
trendingRoadmapsSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL for automatic cleanup
trendingRoadmapsSchema.index({ 'trendingRoadmaps.rank': 1 }); // Rank-based queries
trendingRoadmapsSchema.index({ 'trendingRoadmaps.roadmapId': 1 }); // Roadmap lookup
trendingRoadmapsSchema.index({ 'trendingRoadmaps.category': 1 }); // Category filtering
trendingRoadmapsSchema.index({ 'trendingRoadmaps.difficultyLevel': 1 }); // Difficulty filtering
trendingRoadmapsSchema.index({ 'trendingRoadmaps.trendingScore': -1 }); // Score-based sorting
trendingRoadmapsSchema.index({ 'trendingRoadmaps.metrics.totalViews': -1 }); // View count sorting
trendingRoadmapsSchema.index({ 'trendingRoadmaps.metrics.averageRating': -1 }); // Rating sorting
trendingRoadmapsSchema.index({ 'trendingRoadmaps.industryRelevance.industryDemand': -1 }); // Industry relevance
trendingRoadmapsSchema.index({ 'periodAnalytics.totalRequests': -1 }); // Analytics queries
trendingRoadmapsSchema.index({ createdAt: -1 }); // Creation time sorting
trendingRoadmapsSchema.index({ updatedAt: -1 }); // Update time sorting

// Virtual for active period check
trendingRoadmapsSchema.virtual('isActive').get(function() {
  const now = new Date();
  return this.status === 'active' && 
         this.periodStart <= now && 
         this.periodEnd >= now;
});

// Virtual for days remaining
trendingRoadmapsSchema.virtual('daysRemaining').get(function() {
  const now = new Date();
  const diffTime = this.periodEnd - now;
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

// Virtual for top trending roadmaps (top 10)
trendingRoadmapsSchema.virtual('topTrending').get(function() {
  return this.trendingRoadmaps
    .sort((a, b) => a.rank - b.rank)
    .slice(0, 10);
});

// Pre-save middleware
trendingRoadmapsSchema.pre('save', function(next) {
  // Ensure trending roadmaps are sorted by rank
  if (this.trendingRoadmaps && this.trendingRoadmaps.length > 0) {
    this.trendingRoadmaps.sort((a, b) => a.rank - b.rank);
  }
  
  // Set expiration date if not set (7 days from period start)
  if (!this.expiresAt && this.periodStart) {
    const expirationDate = new Date(this.periodStart);
    expirationDate.setDate(expirationDate.getDate() + 7);
    this.expiresAt = expirationDate;
    this.periodEnd = expirationDate;
  }
  
  next();
});

// Static methods
trendingRoadmapsSchema.statics.getCurrentTrending = function() {
  const now = new Date();
  return this.findOne({
    status: 'active',
    periodStart: { $lte: now },
    periodEnd: { $gte: now }
  }).sort({ periodStart: -1 });
};

trendingRoadmapsSchema.statics.getLatestTrending = function(limit = 25) {
  return this.getCurrentTrending().then(doc => {
    if (!doc) return [];
    return doc.trendingRoadmaps.slice(0, limit);
  });
};

trendingRoadmapsSchema.statics.createNewPeriod = function(trendingData) {
  const now = new Date();
  const periodId = `trending_${now.getFullYear()}_${now.getMonth() + 1}_${now.getDate()}`;
  const periodEnd = new Date(now);
  periodEnd.setDate(periodEnd.getDate() + 7);
  
  return this.create({
    periodId,
    periodStart: now,
    periodEnd,
    status: 'active',
    trendingRoadmaps: trendingData,
    expiresAt: periodEnd
  });
};

trendingRoadmapsSchema.statics.expireOldPeriods = function() {
  const now = new Date();
  return this.updateMany(
    {
      status: 'active',
      periodEnd: { $lt: now }
    },
    {
      $set: { status: 'expired' }
    }
  );
};

trendingRoadmapsSchema.statics.needsRefresh = function() {
  return this.getCurrentTrending().then(doc => {
    if (!doc) return true;
    const now = new Date();
    return doc.periodEnd <= now || doc.status !== 'active';
  });
};

trendingRoadmapsSchema.statics.getTrendingByCategory = function(category, limit = 10) {
  return this.getCurrentTrending().then(doc => {
    if (!doc) return [];
    return doc.trendingRoadmaps
      .filter(roadmap => roadmap.category.toLowerCase() === category.toLowerCase())
      .slice(0, limit);
  });
};

trendingRoadmapsSchema.statics.getTrendingByDifficulty = function(difficulty, limit = 10) {
  return this.getCurrentTrending().then(doc => {
    if (!doc) return [];
    return doc.trendingRoadmaps
      .filter(roadmap => roadmap.difficultyLevel === difficulty)
      .slice(0, limit);
  });
};

// Instance methods
trendingRoadmapsSchema.methods.updateMetrics = function(roadmapId, metrics) {
  const roadmap = this.trendingRoadmaps.find(r => r.roadmapId === roadmapId);
  if (roadmap) {
    Object.assign(roadmap.metrics, metrics);
    
    // Recalculate trending score based on updated metrics
    roadmap.trendingScore = this.calculateTrendingScore(roadmap.metrics);
    
    // Re-sort and update ranks
    this.trendingRoadmaps.sort((a, b) => b.trendingScore - a.trendingScore);
    this.trendingRoadmaps.forEach((roadmap, index) => {
      roadmap.rank = index + 1;
    });
  }
  
  return this.save();
};

trendingRoadmapsSchema.methods.calculateTrendingScore = function(metrics) {
  // Weighted scoring algorithm
  const weights = {
    views: 0.2,
    starts: 0.25,
    completions: 0.3,
    saves: 0.15,
    rating: 0.1
  };
  
  const normalizedViews = Math.min(metrics.totalViews / 1000, 1) * 100;
  const normalizedStarts = Math.min(metrics.totalStarts / 500, 1) * 100;
  const normalizedCompletions = Math.min(metrics.totalCompletions / 100, 1) * 100;
  const normalizedSaves = Math.min(metrics.totalSaves / 200, 1) * 100;
  const normalizedRating = (metrics.averageRating / 5) * 100;
  
  return Math.round(
    (normalizedViews * weights.views) +
    (normalizedStarts * weights.starts) +
    (normalizedCompletions * weights.completions) +
    (normalizedSaves * weights.saves) +
    (normalizedRating * weights.rating)
  );
};

trendingRoadmapsSchema.methods.incrementRequest = function() {
  this.periodAnalytics.totalRequests += 1;
  return this.save();
};

trendingRoadmapsSchema.methods.addUniqueUser = function(userId) {
  // In a real implementation, you'd track unique users properly
  // For now, we'll just increment the counter
  this.periodAnalytics.uniqueUsers += 1;
  return this.save();
};

module.exports = mongoose.model('TrendingRoadmaps', trendingRoadmapsSchema);