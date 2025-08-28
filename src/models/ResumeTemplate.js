const mongoose = require('mongoose');

// Resume Template Schema for storing predefined resume templates
const resumeTemplateSchema = new mongoose.Schema(
  {
    // Template Identity
    name: { type: String, trim: true, required: true, unique: true },
    description: { type: String, trim: true },
    category: { 
      type: String, 
      enum: ['modern', 'classic', 'creative', 'minimal', 'technical', 'academic'],
      required: true 
    },
    
    // Template Configuration
    sections: [{
      name: { 
        type: String, 
        enum: ['personalInfo', 'professionalSummary', 'experience', 'education', 'skills', 'projects', 'certifications', 'additionalSections'],
        required: true 
      },
      order: { type: Number, required: true },
      required: { type: Boolean, default: false },
      customizable: { type: Boolean, default: true },
      layout: {
        columns: { type: Number, default: 1, min: 1, max: 3 },
        width: { type: String, enum: ['full', 'half', 'third'], default: 'full' },
        alignment: { type: String, enum: ['left', 'center', 'right'], default: 'left' }
      }
    }],
    
    // Visual Styling
    style: {
      // Color scheme
      colors: {
        primary: { type: String, default: '#2563eb' },
        secondary: { type: String, default: '#64748b' },
        accent: { type: String, default: '#0ea5e9' },
        text: { type: String, default: '#1e293b' },
        background: { type: String, default: '#ffffff' }
      },
      
      // Typography
      fonts: {
        heading: { type: String, default: 'Inter' },
        body: { type: String, default: 'Inter' },
        size: {
          heading: { type: String, default: '18px' },
          subheading: { type: String, default: '16px' },
          body: { type: String, default: '14px' },
          small: { type: String, default: '12px' }
        },
        weight: {
          heading: { type: String, default: '600' },
          subheading: { type: String, default: '500' },
          body: { type: String, default: '400' }
        }
      },
      
      // Layout
      layout: {
        pageSize: { type: String, enum: ['A4', 'Letter'], default: 'A4' },
        margins: {
          top: { type: String, default: '20mm' },
          right: { type: String, default: '20mm' },
          bottom: { type: String, default: '20mm' },
          left: { type: String, default: '20mm' }
        },
        spacing: {
          section: { type: String, default: '16px' },
          item: { type: String, default: '8px' },
          line: { type: String, default: '1.5' }
        }
      },
      
      // Visual elements
      elements: {
        showBorders: { type: Boolean, default: false },
        showIcons: { type: Boolean, default: true },
        showDividers: { type: Boolean, default: true },
        borderRadius: { type: String, default: '4px' },
        shadowLevel: { type: String, enum: ['none', 'light', 'medium', 'heavy'], default: 'none' }
      }
    },
    
    // Template Metadata
    targetAudience: [{
      type: String,
      enum: ['student', 'fresher', 'experienced', 'senior', 'executive', 'creative', 'technical', 'academic']
    }],
    
    industries: [{ type: String, trim: true }], // e.g., ['Technology', 'Finance', 'Healthcare']
    
    // Usage and Performance
    usage: {
      timesUsed: { type: Number, default: 0 },
      rating: { type: Number, default: 0, min: 0, max: 5 },
      reviews: [{
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        rating: { type: Number, min: 1, max: 5 },
        comment: { type: String, trim: true },
        createdAt: { type: Date, default: Date.now }
      }]
    },
    
    // Template Status
    status: { 
      type: String, 
      enum: ['active', 'inactive', 'deprecated'], 
      default: 'active' 
    },
    
    // Preview and Assets
    preview: {
      thumbnailUrl: { type: String, trim: true },
      previewUrl: { type: String, trim: true },
      sampleData: { type: mongoose.Schema.Types.Mixed } // Sample resume data for preview
    },
    
    // Template Features
    features: [{
      type: String,
      enum: ['ats-friendly', 'single-page', 'multi-page', 'photo-support', 'color-customizable', 'font-customizable', 'icon-support']
    }],
    
    // Creation and Management
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    isDefault: { type: Boolean, default: false },
    isPremium: { type: Boolean, default: false },
    
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

// Pre-save middleware
resumeTemplateSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Virtual for average rating
resumeTemplateSchema.virtual('averageRating').get(function() {
  if (!this.usage.reviews || this.usage.reviews.length === 0) return 0;
  
  const sum = this.usage.reviews.reduce((acc, review) => acc + review.rating, 0);
  return Math.round((sum / this.usage.reviews.length) * 10) / 10;
});

// Virtual for popularity score (based on usage and rating)
resumeTemplateSchema.virtual('popularityScore').get(function() {
  const usageScore = Math.min(this.usage.timesUsed / 100, 1); // Normalize to 0-1
  const ratingScore = this.averageRating / 5; // Normalize to 0-1
  return Math.round((usageScore * 0.6 + ratingScore * 0.4) * 100);
});

// Static method to find active templates
resumeTemplateSchema.statics.findActive = function() {
  return this.find({ status: 'active' }).sort({ isDefault: -1, popularityScore: -1 });
};

// Static method to find templates by category
resumeTemplateSchema.statics.findByCategory = function(category) {
  return this.find({ category, status: 'active' }).sort({ popularityScore: -1 });
};

// Static method to find templates for target audience
resumeTemplateSchema.statics.findForAudience = function(audience) {
  return this.find({ 
    targetAudience: { $in: [audience] }, 
    status: 'active' 
  }).sort({ popularityScore: -1 });
};

// Static method to get default template
resumeTemplateSchema.statics.getDefault = function() {
  return this.findOne({ isDefault: true, status: 'active' });
};

// Instance method to increment usage
resumeTemplateSchema.methods.incrementUsage = function() {
  this.usage.timesUsed += 1;
  return this.save();
};

// Instance method to add review
resumeTemplateSchema.methods.addReview = function(userId, rating, comment) {
  // Remove existing review from same user
  this.usage.reviews = this.usage.reviews.filter(
    review => !review.userId.equals(userId)
  );
  
  // Add new review
  this.usage.reviews.push({
    userId,
    rating,
    comment,
    createdAt: new Date()
  });
  
  // Update average rating
  const sum = this.usage.reviews.reduce((acc, review) => acc + review.rating, 0);
  this.usage.rating = sum / this.usage.reviews.length;
  
  return this.save();
};

// Instance method to get sections in order
resumeTemplateSchema.methods.getOrderedSections = function() {
  return this.sections.sort((a, b) => a.order - b.order);
};

// Instance method to validate section configuration
resumeTemplateSchema.methods.validateSections = function() {
  const requiredSections = ['personalInfo', 'professionalSummary'];
  const templateSections = this.sections.map(s => s.name);
  
  return requiredSections.every(section => templateSections.includes(section));
};

// Indexes for performance
resumeTemplateSchema.index({ status: 1, category: 1 });
resumeTemplateSchema.index({ status: 1, isDefault: -1 });
resumeTemplateSchema.index({ targetAudience: 1, status: 1 });
resumeTemplateSchema.index({ 'usage.timesUsed': -1 });
resumeTemplateSchema.index({ 'usage.rating': -1 });
resumeTemplateSchema.index({ createdAt: -1 });
// Unique index on name is already defined in schema

module.exports = mongoose.model('ResumeTemplate', resumeTemplateSchema);