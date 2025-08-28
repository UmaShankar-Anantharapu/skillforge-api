const mongoose = require('mongoose');

// Resume Schema for Resume Builder Feature
const resumeSchema = new mongoose.Schema(
  {
    // Core Identity
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    
    // Resume Metadata
    title: { type: String, trim: true, default: 'My Resume' },
    templateId: { type: String, required: true },
    status: { 
      type: String, 
      enum: ['draft', 'completed', 'published'], 
      default: 'draft' 
    },
    
    // Personal Information
    personalInfo: {
      fullName: { type: String, trim: true, required: true },
      email: { type: String, trim: true, lowercase: true, required: true },
      phone: { type: String, trim: true },
      location: { type: String, trim: true },
      linkedIn: { type: String, trim: true },
      github: { type: String, trim: true },
      portfolio: { type: String, trim: true }
    },
    
    // Professional Summary
    professionalSummary: {
      content: { type: String, trim: true },
      type: { 
        type: String, 
        enum: ['frontend', 'backend', 'fullstack', 'mobile', 'devops', 'data', 'ai_ml', 'qa', 'ui_ux', 'custom'],
        default: 'custom'
      },
      experienceLevel: { 
        type: String, 
        enum: ['entry', 'junior', 'mid', 'senior', 'lead'],
        default: 'entry'
      },
      industry: { type: String, trim: true },
      keySkills: [{ type: String, trim: true }],
      achievements: [{ type: String, trim: true }]
    },
    
    // Work Experience
    experience: [{
      company: { type: String, trim: true, required: true },
      position: { type: String, trim: true, required: true },
      location: { type: String, trim: true },
      startDate: { type: Date, required: true },
      endDate: { type: Date },
      current: { type: Boolean, default: false },
      description: { type: String, trim: true },
      achievements: [{ type: String, trim: true }],
      technologies: [{ type: String, trim: true }]
    }],
    
    // Education
    education: [{
      institution: { type: String, trim: true, required: true },
      degree: { type: String, trim: true, required: true },
      field: { type: String, trim: true },
      location: { type: String, trim: true },
      startDate: { type: Date },
      endDate: { type: Date },
      gpa: { type: String, trim: true },
      honors: [{ type: String, trim: true }],
      relevantCourses: [{ type: String, trim: true }]
    }],
    
    // Skills
    skills: {
      technical: [{
        category: { type: String, trim: true }, // e.g., "Programming Languages", "Frameworks"
        items: [{ type: String, trim: true }]
      }],
      soft: [{ type: String, trim: true }],
      languages: [{
        language: { type: String, trim: true },
        proficiency: { 
          type: String, 
          enum: ['basic', 'conversational', 'fluent', 'native']
        }
      }]
    },
    
    // Projects
    projects: [{
      name: { type: String, trim: true, required: true },
      description: { type: String, trim: true },
      technologies: [{ type: String, trim: true }],
      startDate: { type: Date },
      endDate: { type: Date },
      url: { type: String, trim: true },
      github: { type: String, trim: true },
      highlights: [{ type: String, trim: true }]
    }],
    
    // Certifications
    certifications: [{
      name: { type: String, trim: true, required: true },
      issuer: { type: String, trim: true, required: true },
      issueDate: { type: Date },
      expiryDate: { type: Date },
      credentialId: { type: String, trim: true },
      url: { type: String, trim: true }
    }],
    
    // Additional Sections (Optional)
    additionalSections: [{
      title: { type: String, trim: true, required: true },
      content: { type: String, trim: true },
      items: [{ type: String, trim: true }]
    }],
    
    // Resume Configuration
    configuration: {
      sectionsOrder: [{ type: String }], // Order of sections in the resume
      visibleSections: [{ type: String }], // Which sections to show
      theme: {
        primaryColor: { type: String, default: '#2563eb' },
        fontFamily: { type: String, default: 'Inter' },
        fontSize: { type: String, default: 'medium' }
      }
    },
    
    // Generation Metadata
    generatedSummary: {
      content: { type: String, trim: true },
      generatedAt: { type: Date },
      prompt: { type: String, trim: true },
      model: { type: String, trim: true }
    },
    
    // Tracking
    completionPercentage: { type: Number, default: 0, min: 0, max: 100 },
    lastEditedSection: { type: String, trim: true },
    
    // Timestamps
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
  },
  {
    timestamps: true,
    versionKey: false,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Pre-save middleware to update timestamps and completion percentage
resumeSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  this.completionPercentage = this.calculateCompletionPercentage();
  next();
});

// Virtual for checking if resume is complete
resumeSchema.virtual('isComplete').get(function() {
  return this.completionPercentage >= 80; // Consider 80% as complete
});

// Virtual for getting years of experience
resumeSchema.virtual('totalExperience').get(function() {
  if (!this.experience || this.experience.length === 0) return 0;
  
  let totalMonths = 0;
  this.experience.forEach(exp => {
    const start = new Date(exp.startDate);
    const end = exp.current ? new Date() : new Date(exp.endDate);
    const months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
    totalMonths += Math.max(0, months);
  });
  
  return Math.round(totalMonths / 12 * 10) / 10; // Round to 1 decimal place
});

// Static method to find resumes by user
resumeSchema.statics.findByUserId = function(userId) {
  return this.find({ userId }).sort({ updatedAt: -1 });
};

// Static method to find published resumes
resumeSchema.statics.findPublished = function() {
  return this.find({ status: 'published' }).sort({ updatedAt: -1 });
};

// Instance method to calculate completion percentage
resumeSchema.methods.calculateCompletionPercentage = function() {
  let completedSections = 0;
  const totalSections = 7; // personalInfo, professionalSummary, experience, education, skills, projects, certifications
  
  // Check personal info
  if (this.personalInfo && this.personalInfo.fullName && this.personalInfo.email) {
    completedSections++;
  }
  
  // Check professional summary
  if (this.professionalSummary && this.professionalSummary.content) {
    completedSections++;
  }
  
  // Check experience
  if (this.experience && this.experience.length > 0) {
    completedSections++;
  }
  
  // Check education
  if (this.education && this.education.length > 0) {
    completedSections++;
  }
  
  // Check skills
  if (this.skills && (this.skills.technical.length > 0 || this.skills.soft.length > 0)) {
    completedSections++;
  }
  
  // Check projects
  if (this.projects && this.projects.length > 0) {
    completedSections++;
  }
  
  // Check certifications (optional, so we give partial credit)
  if (this.certifications && this.certifications.length > 0) {
    completedSections++;
  }
  
  return Math.round((completedSections / totalSections) * 100);
};

// Instance method to update section
resumeSchema.methods.updateSection = function(sectionName, data) {
  this[sectionName] = data;
  this.lastEditedSection = sectionName;
  return this.save();
};

// Instance method to duplicate resume
resumeSchema.methods.duplicate = function() {
  const duplicateData = this.toObject();
  delete duplicateData._id;
  delete duplicateData.createdAt;
  delete duplicateData.updatedAt;
  duplicateData.title = `${this.title} (Copy)`;
  duplicateData.status = 'draft';
  
  return new this.constructor(duplicateData);
};

// Indexes for performance
resumeSchema.index({ userId: 1, updatedAt: -1 });
resumeSchema.index({ userId: 1, status: 1 });
resumeSchema.index({ status: 1, updatedAt: -1 });
resumeSchema.index({ templateId: 1 });
resumeSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Resume', resumeSchema);