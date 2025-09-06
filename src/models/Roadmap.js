const mongoose = require('mongoose');

// Resource schema for learning materials
const resourceSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['video', 'article', 'course', 'book', 'tool', 'documentation', 'tutorial'],
    required: true
  },
  title: { type: String, required: true, trim: true },
  url: { type: String, trim: true },
  description: { type: String, trim: true },
  duration: { type: String, trim: true }, // e.g., "15 minutes", "2 hours"
  difficulty: { type: String, enum: ['Beginner', 'Intermediate', 'Advanced'] },
  rating: { type: Number, min: 1, max: 5 },
  isFree: { type: Boolean, default: true }
}, { _id: false });

// Milestone schema for major learning checkpoints
const milestoneSchema = new mongoose.Schema({
  id: { type: String, required: true },
  title: { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  estimatedWeeks: { type: Number, required: true, min: 1 },
  skills: [{ type: String, trim: true }],
  completed: { type: Boolean, default: false },
  completedAt: { type: Date },
  order: { type: Number, required: true }
}, { _id: false });

// Enhanced roadmap step schema
const roadmapStepSchema = new mongoose.Schema({
  day: { type: Number, required: true },
  week: { type: Number, required: true },
  milestoneId: { type: String, required: true },
  title: { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  type: {
    type: String,
    enum: ['theory', 'practice', 'project', 'assessment', 'review'],
    required: true
  },
  estimatedMinutes: { type: Number, required: true, min: 5 },
  skills: [{ type: String, trim: true }],
  resources: [resourceSchema],
  prerequisites: [{ type: String, trim: true }],
  learningObjectives: [{ type: String, trim: true }],
  completed: { type: Boolean, default: false },
  completedAt: { type: Date },
  difficulty: { type: String, enum: ['Easy', 'Medium', 'Hard'], default: 'Medium' },
  order: { type: Number, required: true }
}, { _id: false });

// Phase schema for personalized roadmaps
const phaseSchema = new mongoose.Schema({
  phaseNumber: { type: Number, required: true },
  title: { type: String, required: true, trim: true },
  duration: { type: String, required: true }, // "2-3 weeks"
  description: { type: String, trim: true },
  milestones: [{
    week: { type: Number, required: true },
    title: { type: String, required: true, trim: true },
    topics: [{ type: String, trim: true }],
    concepts: [{ type: String, trim: true }],
    estimatedHours: { type: Number, required: true },
    difficulty: { type: String, enum: ['beginner', 'intermediate', 'advanced'], required: true },
    resources: [resourceSchema],
    completed: { type: Boolean, default: false },
    completedAt: { type: Date }
  }]
}, { _id: false });

// Main roadmap schema
const roadmapSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  profileId: { type: mongoose.Schema.Types.ObjectId, ref: 'UserProfile', required: true },

  // Roadmap Metadata
  title: { type: String, required: true, trim: true },
  roadmapTitle: { type: String, trim: true }, // For personalized roadmaps
  description: { type: String, trim: true },
  estimatedDuration: { type: String, required: true }, // "3 months", "6 months"
  difficultyLevel: { type: String, enum: ['Beginner', 'Intermediate', 'Advanced'], required: true },
  category: { type: String, trim: true }, // e.g., "Web Development", "Data Science"
  tags: [{ type: String, trim: true }],

  // Legacy fields for backward compatibility
  skill: { type: String, trim: true },
  level: { type: String, trim: true },
  goal: { type: String, trim: true },
  dailyTime: { type: Number }, // in minutes

  // Personalized roadmap fields
  targetSkill: { type: String, trim: true },
  learningPath: { type: String, enum: ['beginner', 'intermediate', 'advanced'], trim: true },
  weeklyHours: { type: Number },
  excludedSkills: [{ type: String, trim: true }],
  focusAreas: [{ type: String, trim: true }],
  prerequisites: [{ type: String, trim: true }],
  skillGaps: [{ type: String, trim: true }],
  personalizedNotes: { type: String, trim: true },
  isPersonalized: { type: Boolean, default: false },
  profileCompleteness: { type: Number, min: 0, max: 100 },

  // Roadmap Structure (support both legacy and new formats)
  milestones: [milestoneSchema],
  steps: [roadmapStepSchema],
  phases: [phaseSchema], // New personalized structure

  // AI Generation Metadata
  generationMetadata: {
    generatedWith: {
      type: String,
      enum: ['basic-llm', 'research-agent', 'template', 'manual'],
      required: true
    },
    prompt: { type: String, trim: true },
    sources: [{ type: String, trim: true }],
    generatedAt: { type: Date, default: Date.now },
    version: { type: String, default: '1.0' },
    modelUsed: { type: String, trim: true },
    confidence: { type: Number, min: 0, max: 1 } // AI confidence score
  },

  // Progress Tracking
  progress: {
    completedSteps: { type: Number, default: 0 },
    totalSteps: { type: Number, required: true },
    completedMilestones: { type: Number, default: 0 },
    totalMilestones: { type: Number, required: true },
    percentageComplete: { type: Number, default: 0, min: 0, max: 100 },
    lastActivityAt: { type: Date },
    currentStep: { type: Number, default: 1 },
    currentMilestone: { type: String },
    estimatedCompletionDate: { type: Date },
    actualStartDate: { type: Date },
    streakDays: { type: Number, default: 0 },
    totalTimeSpent: { type: Number, default: 0 } // in minutes
  },

  // Customization & Preferences
  isCustomized: { type: Boolean, default: false },
  customizations: {
    excludedSkillsCount: { type: Number, default: 0 },
    focusAreasCount: { type: Number, default: 0 },
    learningPath: { type: String, trim: true },
    personalizedFor: { type: String, trim: true },
    stepCustomizations: [{
      stepId: { type: Number, required: true },
      originalTitle: { type: String, trim: true },
      customTitle: { type: String, trim: true },
      originalDescription: { type: String, trim: true },
      customDescription: { type: String, trim: true },
      modifiedAt: { type: Date, default: Date.now }
    }]
  },

  // Personalization metadata
  metadata: {
    generationMethod: { type: String, enum: ['basic', 'skill-exclusion', 'research-enhanced'], default: 'basic' },
    profileVersion: { type: String, default: '1.0' },
    excludedSkills: [{ type: String, trim: true }],
    focusAreas: [{ type: String, trim: true }],
    skillAnalysis: {
      excludedSkillsCount: { type: Number, default: 0 },
      focusAreasCount: { type: Number, default: 0 },
      learningPath: { type: String, trim: true }
    }
  },

  // Status and Visibility
  status: {
    type: String,
    enum: ['draft', 'active', 'paused', 'completed', 'archived'],
    default: 'draft'
  },
  isPublic: { type: Boolean, default: false },
  sharedWith: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

  // Analytics and Feedback
  analytics: {
    viewCount: { type: Number, default: 0 },
    shareCount: { type: Number, default: 0 },
    likeCount: { type: Number, default: 0 },
    averageRating: { type: Number, min: 1, max: 5 },
    totalRatings: { type: Number, default: 0 }
  },

  feedback: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    rating: { type: Number, min: 1, max: 5, required: true },
    comment: { type: String, trim: true },
    createdAt: { type: Date, default: Date.now }
  }]
}, {
  timestamps: true,
  versionKey: false,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for calculating days remaining
roadmapSchema.virtual('daysRemaining').get(function() {
  if (!this.progress.estimatedCompletionDate) return null;
  const today = new Date();
  const endDate = new Date(this.progress.estimatedCompletionDate);
  const diffTime = endDate - today;
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

// Virtual for calculating average step duration
roadmapSchema.virtual('averageStepDuration').get(function() {
  if (!this.steps || this.steps.length === 0) return 0;
  const totalMinutes = this.steps.reduce((sum, step) => sum + step.estimatedMinutes, 0);
  return Math.round(totalMinutes / this.steps.length);
});

// Virtual for getting current milestone
roadmapSchema.virtual('currentMilestoneData').get(function() {
  if (!this.progress.currentMilestone) return null;
  return this.milestones.find(m => m.id === this.progress.currentMilestone);
});

// Virtual for getting next step
roadmapSchema.virtual('nextStep').get(function() {
  return this.steps.find(step => !step.completed);
});

// Virtual for checking if roadmap is overdue
roadmapSchema.virtual('isOverdue').get(function() {
  if (!this.progress.estimatedCompletionDate) return false;
  return new Date() > new Date(this.progress.estimatedCompletionDate) && !this.isCompleted;
});

// Virtual for checking if roadmap is completed
roadmapSchema.virtual('isCompleted').get(function() {
  return this.progress.percentageComplete === 100;
});

// Pre-save middleware to update progress calculations
roadmapSchema.pre('save', function(next) {
  // Update total counts
  this.progress.totalSteps = this.steps.length;
  this.progress.totalMilestones = this.milestones.length;

  // Update completed counts
  this.progress.completedSteps = this.steps.filter(step => step.completed).length;
  this.progress.completedMilestones = this.milestones.filter(milestone => milestone.completed).length;

  // Update percentage
  if (this.progress.totalSteps > 0) {
    this.progress.percentageComplete = Math.round(
      (this.progress.completedSteps / this.progress.totalSteps) * 100
    );
  }

  // Update current step
  const nextIncompleteStep = this.steps.find(step => !step.completed);
  if (nextIncompleteStep) {
    this.progress.currentStep = nextIncompleteStep.day;
  }

  // Update current milestone
  const currentMilestone = this.milestones.find(milestone =>
    !milestone.completed &&
    this.steps.some(step => step.milestoneId === milestone.id && !step.completed)
  );
  if (currentMilestone) {
    this.progress.currentMilestone = currentMilestone.id;
  }

  // Update status based on progress
  if (this.progress.percentageComplete === 100) {
    this.status = 'completed';
  } else if (this.progress.completedSteps > 0 && this.status === 'draft') {
    this.status = 'active';
  }

  next();
});

// Static method to find roadmap by user ID
roadmapSchema.statics.findByUserId = function(userId) {
  return this.findOne({ userId }).populate('profileId');
};

// Static method to find active roadmaps
roadmapSchema.statics.findActiveRoadmaps = function() {
  return this.find({ status: 'active' });
};

// Static method to find public roadmaps
roadmapSchema.statics.findPublicRoadmaps = function(limit = 10) {
  return this.find({ isPublic: true })
    .sort({ 'analytics.likeCount': -1, createdAt: -1 })
    .limit(limit);
};

// Instance method to mark step as completed
roadmapSchema.methods.completeStep = function(stepDay) {
  const step = this.steps.find(s => s.day === stepDay);
  if (step && !step.completed) {
    step.completed = true;
    step.completedAt = new Date();
    this.progress.lastActivityAt = new Date();

    // Update streak
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    if (this.progress.lastActivityAt >= yesterday) {
      this.progress.streakDays += 1;
    } else {
      this.progress.streakDays = 1;
    }
  }
  return this.save();
};

// Instance method to mark milestone as completed
roadmapSchema.methods.completeMilestone = function(milestoneId) {
  const milestone = this.milestones.find(m => m.id === milestoneId);
  if (milestone && !milestone.completed) {
    milestone.completed = true;
    milestone.completedAt = new Date();
  }
  return this.save();
};

// Instance method to add time spent
roadmapSchema.methods.addTimeSpent = function(minutes) {
  this.progress.totalTimeSpent += minutes;
  this.progress.lastActivityAt = new Date();
  return this.save();
};

// Instance method to customize step
roadmapSchema.methods.customizeStep = function(stepDay, customizations) {
  const step = this.steps.find(s => s.day === stepDay);
  if (!step) return this.save();

  const customization = {
    stepId: stepDay,
    originalTitle: step.title,
    originalDescription: step.description,
    customTitle: customizations.title || step.title,
    customDescription: customizations.description || step.description,
    modifiedAt: new Date()
  };

  // Update step
  if (customizations.title) step.title = customizations.title;
  if (customizations.description) step.description = customizations.description;

  // Add to customizations array
  const existingIndex = this.customizations.findIndex(c => c.stepId === stepDay);
  if (existingIndex >= 0) {
    this.customizations[existingIndex] = customization;
  } else {
    this.customizations.push(customization);
  }

  this.isCustomized = true;
  return this.save();
};

// Instance method to add feedback
roadmapSchema.methods.addFeedback = function(userId, rating, comment) {
  this.feedback.push({
    userId,
    rating,
    comment,
    createdAt: new Date()
  });

  // Update analytics
  this.analytics.totalRatings += 1;
  const totalRating = this.feedback.reduce((sum, f) => sum + f.rating, 0);
  this.analytics.averageRating = totalRating / this.analytics.totalRatings;

  return this.save();
};

// Comprehensive indexes for performance optimization
roadmapSchema.index({ userId: 1 }); // User-specific roadmaps
roadmapSchema.index({ status: 1 }); // Status filtering
roadmapSchema.index({ isPublic: 1 }); // Public roadmaps
roadmapSchema.index({ category: 1 }); // Category filtering
roadmapSchema.index({ difficultyLevel: 1 }); // Difficulty filtering
roadmapSchema.index({ 'analytics.averageRating': -1 }); // Rating sorting
roadmapSchema.index({ 'analytics.likeCount': -1 }); // Popularity sorting
roadmapSchema.index({ 'analytics.viewCount': -1 }); // View count sorting
roadmapSchema.index({ 'analytics.shareCount': -1 }); // Share count sorting
roadmapSchema.index({ createdAt: -1 }); // Recent roadmaps
roadmapSchema.index({ updatedAt: -1 }); // Recently updated
roadmapSchema.index({ 'progress.percentageComplete': 1 }); // Progress tracking
roadmapSchema.index({ 'progress.lastActivityAt': -1 }); // Recent activity
roadmapSchema.index({ 'progress.currentStep': 1 }); // Current step queries
roadmapSchema.index({ estimatedDuration: 1 }); // Duration filtering
roadmapSchema.index({ tags: 1 }); // Tag-based searches
roadmapSchema.index({ skill: 1 }); // Skill-based queries
roadmapSchema.index({ targetSkill: 1 }); // Target skill filtering
roadmapSchema.index({ isPersonalized: 1 }); // Personalized roadmaps
roadmapSchema.index({ profileCompleteness: -1 }); // Profile completeness sorting
// Compound indexes for complex queries
roadmapSchema.index({ userId: 1, status: 1 }); // User's active roadmaps
roadmapSchema.index({ category: 1, difficultyLevel: 1 }); // Category + difficulty
roadmapSchema.index({ isPublic: 1, 'analytics.averageRating': -1 }); // Public + rating
roadmapSchema.index({ status: 1, 'progress.lastActivityAt': -1 }); // Active + recent activity

module.exports = mongoose.model('Roadmap', roadmapSchema);
