const mongoose = require('mongoose');

const userProfileSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
    // Step 1: Welcome & Basic Profile
    fullName: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    phoneNumber: { type: String, trim: true },
    jobTitle: { type: String, trim: true },
    company: { type: String, trim: true },
    industry: { type: String, trim: true },
    yearsExperience: { type: String, enum: ['0-2', '3-5', '6-10', '10+'] },
    preferredLanguage: { type: String, trim: true },
    
    // Step 2: Learning Goals & Context
    primaryLearningGoal: { type: String, enum: ['Career advancement', 'Skill enhancement', 'Career change', 'Interview prep', 'Personal interest'] },
    targetRole: { type: String, trim: true },
    learningTimeline: { type: String, enum: ['1 month', '3 months', '6 months', '1 year', 'No deadline'] },
    motivationLevel: { type: String, enum: ['Casual learner', 'Moderate commitment', 'Highly motivated', 'Career critical'] },
    currentChallenge: { type: String, enum: ['Lack of time', 'Don\'t know where to start', 'Need structured learning', 'Want to stay updated'] },
    
    // Step 3: Learning Preferences
    learningStyle: { type: String, enum: ['Visual', 'Auditory', 'Hands-on/Kinesthetic', 'Reading/Text'] },
    contentFormat: { type: String, enum: ['Video tutorials', 'Interactive exercises', 'Text articles', 'Combination'] },
    sessionDuration: { type: String, enum: ['5-15 min', '15-30 min', '30-60 min', '60+ min'] },
    learningDifficulty: { type: String, enum: ['Gradual progression', 'Moderate pace', 'Fast-track/Intensive'] },
    preferredDevice: { type: String, enum: ['Mobile', 'Desktop', 'Tablet', 'All equally'] },
    
    // Step 4: Schedule & Availability
    dailyTime: { type: String, enum: ['15-30 min', '30-60 min', '1-2 hours', '2+ hours'] },
    bestLearningTimes: [{ type: String, enum: ['Morning', 'Afternoon', 'Evening', 'Late night'] }],
    daysPerWeek: { type: String, enum: ['1-2 days', '3-4 days', '5-6 days', 'Daily'] },
    timeZone: { type: String, trim: true },
    reminderMethod: { type: String, enum: ['Email', 'Push notification', 'SMS', 'None'] },
    
    // Step 5: Skills Assessment Setup
    primarySkillCategory: { type: String, trim: true },
    skillsToLearn: [{ type: String, trim: true }],
    currentSkillLevels: [{
      skill: { type: String, trim: true },
      level: { type: String, enum: ['Beginner', 'Intermediate', 'Advanced', 'Expert'] }
    }],
    relatedSkills: [{ type: String, trim: true }],
    prioritySkills: [{ type: String, trim: true }], // Top 3 priority skills
    
    // Step 6: Background & Experience
    educationLevel: { type: String, enum: ['High School', 'Bachelor\'s', 'Master\'s', 'PhD', 'Professional Certification', 'Self-taught'] },
    certifications: [{ type: String, trim: true }],
    previousLearningExperience: { type: String, enum: ['Online courses', 'Bootcamps', 'University', 'Self-study', 'None'] },
    teamRole: { type: String, enum: ['Individual contributor', 'Team lead', 'Manager', 'Senior manager', 'Executive', 'Student'] },
    learningBudget: { type: String, enum: ['Free only', '<$50/month', '$50-200/month', '$200+/month', 'Company sponsored'] },
    
    // Step 7: Success Metrics & Preferences
    successMeasurement: { type: String, enum: ['Completion certificates', 'Skill assessments', 'Real projects', 'Portfolio building', 'Job placement'] },
    progressTracking: { type: String, enum: ['Detailed analytics', 'Simple progress bar', 'Milestone-based', 'Minimal tracking'] },
    communityParticipation: { type: String, enum: ['Very active', 'Moderate participation', 'Occasional', 'Prefer solo learning'] },
    accessibilityRequirements: [{ type: String, enum: ['Screen reader', 'Large text', 'High contrast', 'Keyboard navigation', 'None'] }],
    communicationPreferences: [{ type: String, enum: ['Email updates', 'In-app notifications', 'SMS reminders', 'Weekly digests'] }],
    
    // Step 8: Skill Assessment
    skillAssessments: [{
      skill: { type: String, trim: true },
      confidenceLevel: { type: Number, min: 1, max: 10 },
      recentExperience: { type: String, enum: ['Currently using', 'Within 6 months', '6-12 months ago', '1+ years ago', 'Never used professionally'] },
      learningGoal: { type: String, enum: ['Learn basics', 'Improve proficiency', 'Master advanced concepts', 'Stay updated with trends'] }
    }],
    
    // Step 9: Final Setup & Preferences
    profilePrivacy: { type: String, enum: ['Public profile', 'Private', 'Visible to connections only'] },
    dataSharing: {
      analytics: { type: Boolean, default: true },
      marketing: { type: Boolean, default: false },
      thirdParty: { type: Boolean, default: false }
    },
    notificationPreferences: {
      email: { type: Boolean, default: true },
      push: { type: Boolean, default: true },
      sms: { type: Boolean, default: false }
    },
    themePreference: { type: String, enum: ['Dark mode', 'Light mode', 'Auto'], default: 'Auto' },
    betaFeatures: { type: Boolean, default: false },
    
    // Legacy fields for backward compatibility
    gender: { type: String, enum: ['Male', 'Female', 'Other', 'Prefer not to say'] },
    dateOfBirth: { type: Date },
    country: { type: String, trim: true },
    city: { type: String, trim: true },
    occupation: { type: String, trim: true },
    skill: { type: String, trim: true },
    level: { type: String, trim: true },
    goal: { type: String, trim: true },
    learningGoal: [{ type: String, trim: true }],
    assessmentScore: { type: Number },
    currentKnowledge: { type: String, trim: true },
    
    // Tracking current step in onboarding process
    onboardingStep: { type: Number, default: 0 }, // 0 = Get Started, 1-9 for each step
    onboardingComplete: { type: Boolean, default: false },
  },
  { timestamps: true, versionKey: false }
);

module.exports = mongoose.model('UserProfile', userProfileSchema);


