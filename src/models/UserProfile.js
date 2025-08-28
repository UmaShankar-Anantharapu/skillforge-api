const mongoose = require('mongoose');

// Clear any existing model to avoid caching issues
if (mongoose.models.UserProfile) {
  delete mongoose.models.UserProfile;
}

// Enhanced UserProfile Schema for New Onboarding & Roadmap Workflow
const userProfileSchema = new mongoose.Schema(
  {
    // Core Identity
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    sessionId: { type: String, default: () => new mongoose.Types.ObjectId().toString() },

    // Personal Details (Step 1)
    fullName: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    age: { type: Number, min: 16, max: 100 },
    country: { type: String, trim: true },
    timezone: { type: String, trim: true },
    preferredLanguages: [{ type: String, trim: true }],

    // Career Background (Step 2)
    careerBackground: [{
      company: { type: String, trim: true, required: true },
      position: { type: String, trim: true, required: true },
      yearsOfExperience: { type: Number, min: 0, max: 50, required: true },
      skillsWorkedOn: [{ type: String, trim: true }],
      startDate: { type: Date },
      endDate: { type: Date },
      isCurrent: { type: Boolean, default: false },
      description: { type: String, trim: true }
    }],

    // Current Skills (moved from Step 2, now derived from career background)
    currentSkills: [{
      skillName: { type: String, trim: true },
      proficiencyLevel: {
        type: String,
        enum: ['Beginner', 'Intermediate', 'Advanced']
      },
      yearsOfExperience: { type: Number, min: 0, max: 50 },
      lastUsed: {
        type: String,
        enum: ['Currently using', 'Within 6 months', '6-12 months ago', '1+ years ago', 'Never used professionally']
      },
      prerequisites: [{ type: String, trim: true }],
      subSkills: [{ type: String, trim: true }]
    }],

    // Learning Goals (Step 3)
    primaryGoal: { type: String, trim: true },
    targetRole: { type: String, trim: true },
    motivationLevel: { type: Number, min: 1, max: 10 },
    customGoalDescription: { type: String, trim: true },

    // Roadmap Configuration (Steps 4-6)
    requiredSkills: [{
      skillName: { type: String, trim: true },
      currentLevel: { type: String, enum: ['None', 'Beginner', 'Intermediate', 'Advanced'] },
      targetLevel: { type: String, enum: ['Beginner', 'Intermediate', 'Advanced'] },
      priority: { type: Number, min: 1, max: 10 }
    }],

    timeline: {
      targetDuration: { type: String }, // "3 months", "6 months", etc.
      weeklyTimeCommitment: { type: Number }, // hours per week
      preferredLearningDays: [{ type: String }], // ["Monday", "Wednesday", "Friday"]
      startDate: { type: Date, default: Date.now },
      expectedEndDate: { type: Date }
    },

    learningPreferences: {
      learningStyles: [{ type: String }], // ["Video", "Articles", "Hands-on Projects"]
      contentDifficulty: { type: String, enum: ['Beginner-friendly', 'Balanced', 'Challenge-focused'] },
      assessmentFrequency: { type: String, enum: ['Daily', 'Weekly', 'Project-based', 'Mixed'] }
    },

    // Tracking
    onboardingStep: { type: Number, default: 0 }, // 0-7
    onboardingComplete: { type: Boolean, default: false },
    roadmapGenerated: { type: Boolean, default: false },

    // Metadata
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
  },
  {
    timestamps: true,
    versionKey: false,
    // Automatically update the updatedAt field
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Pre-save middleware to update the updatedAt field
userProfileSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Virtual for calculating onboarding progress percentage
userProfileSchema.virtual('onboardingProgress').get(function() {
  return Math.round((this.onboardingStep / 7) * 100);
});

// Virtual for checking if user has completed personal details
userProfileSchema.virtual('hasPersonalDetails').get(function() {
  return !!(this.fullName && this.email && this.country && this.timezone);
});

// Virtual for checking if user has skills assessment
userProfileSchema.virtual('hasSkillsAssessment').get(function() {
  return this.currentSkills && this.currentSkills.length > 0;
});

// Virtual for checking if user has learning goals
userProfileSchema.virtual('hasLearningGoals').get(function() {
  return !!(this.primaryGoal && this.motivationLevel);
});

// Virtual for checking if roadmap configuration is complete
userProfileSchema.virtual('hasRoadmapConfig').get(function() {
  return !!(this.timeline && this.timeline.targetDuration && this.timeline.weeklyTimeCommitment);
});

// Static method to find profile by user ID
userProfileSchema.statics.findByUserId = function(userId) {
  return this.findOne({ userId });
};

// Static method to find profile by session ID
userProfileSchema.statics.findBySessionId = function(sessionId) {
  return this.findOne({ sessionId });
};

// Instance method to advance to next onboarding step
userProfileSchema.methods.advanceStep = function() {
  if (this.onboardingStep < 7) {
    this.onboardingStep += 1;
  }
  return this.save();
};

// Instance method to complete onboarding
userProfileSchema.methods.completeOnboarding = function() {
  this.onboardingStep = 7;
  this.onboardingComplete = true;
  return this.save();
};

// Instance method to get skill by name
userProfileSchema.methods.getSkillByName = function(skillName) {
  return this.currentSkills.find(skill =>
    skill.skillName.toLowerCase() === skillName.toLowerCase()
  );
};

// Instance method to add or update skill
userProfileSchema.methods.addOrUpdateSkill = function(skillData) {
  const existingSkillIndex = this.currentSkills.findIndex(skill =>
    skill.skillName.toLowerCase() === skillData.skillName.toLowerCase()
  );

  if (existingSkillIndex >= 0) {
    this.currentSkills[existingSkillIndex] = { ...this.currentSkills[existingSkillIndex], ...skillData };
  } else {
    this.currentSkills.push(skillData);
  }

  return this.save();
};

// Create compound unique index for userId and sessionId
userProfileSchema.index({ userId: 1, sessionId: 1 }, { unique: true });

// Create index for efficient queries
// userId index already created by compound unique index above
userProfileSchema.index({ onboardingStep: 1 });
userProfileSchema.index({ onboardingComplete: 1 });
userProfileSchema.index({ createdAt: -1 });

module.exports = mongoose.model('UserProfile', userProfileSchema);