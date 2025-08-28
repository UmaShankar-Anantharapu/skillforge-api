const express = require('express');
const { body, validationResult, param, query } = require('express-validator');
const requireAuth = require('../middleware/requireAuth');
const Resume = require('../models/Resume');
const ResumeTemplate = require('../models/ResumeTemplate');
const { generateProfessionalSummary } = require('../services/resumeService');

const router = express.Router();

// GET /api/resume/templates - Get all available templates
router.get('/templates/list', async (req, res, next) => {
  try {
    const { category, audience } = req.query;
    let templates;

    if (category) {
      templates = await ResumeTemplate.findByCategory(category);
    } else if (audience) {
      templates = await ResumeTemplate.findForAudience(audience);
    } else {
      templates = await ResumeTemplate.findActive();
    }

    return res.json({ templates });
  } catch (err) {
    return next(err);
  }
});

// GET /api/resume/templates/:id - Get specific template
router.get(
  '/templates/:id',
  [param('id').isMongoId()],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const template = await ResumeTemplate.findById(req.params.id);
      if (!template || template.status !== 'active') {
        return res.status(404).json({ error: 'Template not found' });
      }

      return res.json({ template });
    } catch (err) {
      return next(err);
    }
  }
);

// GET /api/resume - Get all resumes for current user
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const resumes = await Resume.findByUserId(req.userId);
    return res.json({ resumes });
  } catch (err) {
    return next(err);
  }
});

// GET /api/resume/:id - Get specific resume by ID
router.get(
  '/:id',
  requireAuth,
  [param('id').isMongoId()],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const resume = await Resume.findOne({ _id: req.params.id, userId: req.userId });
      if (!resume) {
        return res.status(404).json({ error: 'Resume not found' });
      }

      return res.json({ resume });
    } catch (err) {
      return next(err);
    }
  }
);

// POST /api/resume - Create new resume
router.post(
  '/',
  requireAuth,
  [
    body('title').optional().isString().trim().isLength({ min: 1, max: 100 }),
    body('templateId').isString().isLength({ min: 1 }),
    body('personalInfo').optional().isObject(),
    body('personalInfo.fullName').optional().isString().trim(),
    body('personalInfo.email').optional().isEmail().normalizeEmail(),
    body('personalInfo.phone').optional().isString().trim(),
    body('personalInfo.location').optional().isString().trim(),
    body('personalInfo.linkedIn').optional().isURL(),
    body('personalInfo.github').optional().isURL(),
    body('personalInfo.portfolio').optional().isURL()
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      // Verify template exists
      const template = await ResumeTemplate.findById(req.body.templateId);
      if (!template) {
        return res.status(400).json({ error: 'Invalid template ID' });
      }

      const resumeData = {
        userId: req.userId,
        templateId: req.body.templateId,
        title: req.body.title || 'My Resume',
        personalInfo: req.body.personalInfo || {},
        professionalSummary: { type: 'custom' },
        experience: [],
        education: [],
        skills: { technical: [], soft: [], languages: [] },
        projects: [],
        certifications: [],
        additionalSections: [],
        configuration: {
          sectionsOrder: template.getOrderedSections().map(s => s.name),
          visibleSections: template.getOrderedSections().map(s => s.name),
          theme: {
            primaryColor: template.style.colors.primary,
            fontFamily: template.style.fonts.heading,
            fontSize: 'medium'
          }
        }
      };

      const resume = new Resume(resumeData);
      await resume.save();

      // Increment template usage
      await template.incrementUsage();

      return res.status(201).json({ resume });
    } catch (err) {
      return next(err);
    }
  }
);

// PUT /api/resume/:id - Update resume
router.put(
  '/:id',
  requireAuth,
  [
    param('id').isMongoId(),
    body('title').optional().isString().trim().isLength({ min: 1, max: 100 }),
    body('status').optional().isIn(['draft', 'completed', 'published']),
    body('personalInfo').optional().isObject(),
    body('professionalSummary').optional().isObject(),
    body('experience').optional().isArray(),
    body('education').optional().isArray(),
    body('skills').optional().isObject(),
    body('projects').optional().isArray(),
    body('certifications').optional().isArray(),
    body('additionalSections').optional().isArray(),
    body('configuration').optional().isObject()
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const resume = await Resume.findOne({ _id: req.params.id, userId: req.userId });
      if (!resume) {
        return res.status(404).json({ error: 'Resume not found' });
      }

      // Update fields
      const allowedFields = [
        'title', 'status', 'personalInfo', 'professionalSummary', 
        'experience', 'education', 'skills', 'projects', 
        'certifications', 'additionalSections', 'configuration'
      ];

      allowedFields.forEach(field => {
        if (req.body[field] !== undefined) {
          resume[field] = req.body[field];
        }
      });

      await resume.save();
      return res.json({ resume });
    } catch (err) {
      return next(err);
    }
  }
);

// PATCH /api/resume/:id/section/:sectionName - Update specific section
router.patch(
  '/:id/section/:sectionName',
  requireAuth,
  [
    param('id').isMongoId(),
    param('sectionName').isIn([
      'personalInfo', 'professionalSummary', 'experience', 
      'education', 'skills', 'projects', 'certifications', 'additionalSections'
    ]),
    body('data').exists()
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const resume = await Resume.findOne({ _id: req.params.id, userId: req.userId });
      if (!resume) {
        return res.status(404).json({ error: 'Resume not found' });
      }

      await resume.updateSection(req.params.sectionName, req.body.data);
      return res.json({ resume, message: `${req.params.sectionName} updated successfully` });
    } catch (err) {
      return next(err);
    }
  }
);

// POST /api/resume/:id/duplicate - Duplicate resume
router.post(
  '/:id/duplicate',
  requireAuth,
  [param('id').isMongoId()],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const originalResume = await Resume.findOne({ _id: req.params.id, userId: req.userId });
      if (!originalResume) {
        return res.status(404).json({ error: 'Resume not found' });
      }

      const duplicatedResume = originalResume.duplicate();
      await duplicatedResume.save();

      return res.status(201).json({ resume: duplicatedResume });
    } catch (err) {
      return next(err);
    }
  }
);

// DELETE /api/resume/:id - Delete resume
router.delete(
  '/:id',
  requireAuth,
  [param('id').isMongoId()],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const resume = await Resume.findOneAndDelete({ _id: req.params.id, userId: req.userId });
      if (!resume) {
        return res.status(404).json({ error: 'Resume not found' });
      }

      return res.json({ message: 'Resume deleted successfully' });
    } catch (err) {
      return next(err);
    }
  }
);

// POST /api/resume/:id/generate-summary - Generate AI professional summary
router.post(
  '/:id/generate-summary',
  requireAuth,
  [
    param('id').isMongoId(),
    body('type').isIn(['frontend', 'backend', 'fullstack', 'mobile', 'devops', 'data', 'ai_ml', 'qa', 'ui_ux', 'custom']),
    body('experienceLevel').isIn(['entry', 'junior', 'mid', 'senior', 'lead']),
    body('industry').optional().isString().trim(),
    body('keySkills').optional().isArray(),
    body('achievements').optional().isArray(),
    body('customPrompt').optional().isString().trim()
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const resume = await Resume.findOne({ _id: req.params.id, userId: req.userId });
      if (!resume) {
        return res.status(404).json({ error: 'Resume not found' });
      }

      const summaryRequest = {
        type: req.body.type,
        experienceLevel: req.body.experienceLevel,
        industry: req.body.industry,
        keySkills: req.body.keySkills || [],
        achievements: req.body.achievements || [],
        customPrompt: req.body.customPrompt,
        existingExperience: resume.experience,
        existingEducation: resume.education,
        existingSkills: resume.skills
      };

      const generatedSummary = await generateProfessionalSummary(summaryRequest);

      // Update resume with generated summary
      resume.professionalSummary = {
        content: generatedSummary.content,
        type: req.body.type,
        experienceLevel: req.body.experienceLevel,
        industry: req.body.industry,
        keySkills: req.body.keySkills || [],
        achievements: req.body.achievements || []
      };

      resume.generatedSummary = {
        content: generatedSummary.content,
        generatedAt: new Date(),
        prompt: generatedSummary.prompt,
        model: generatedSummary.model
      };

      await resume.save();

      return res.json({ 
        summary: generatedSummary,
        resume: resume
      });
    } catch (err) {
      return next(err);
    }
  }
);

// GET /api/resume/:id/export/:format - Export resume (placeholder for future PDF/Word export)
router.get(
  '/:id/export/:format',
  requireAuth,
  [
    param('id').isMongoId(),
    param('format').isIn(['pdf', 'docx', 'html'])
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const resume = await Resume.findOne({ _id: req.params.id, userId: req.userId });
      if (!resume) {
        return res.status(404).json({ error: 'Resume not found' });
      }

      // TODO: Implement actual export functionality
      // For now, return the resume data with export format info
      return res.json({ 
        message: `Export functionality for ${req.params.format} format will be implemented soon`,
        resume: resume,
        format: req.params.format
      });
    } catch (err) {
      return next(err);
    }
  }
);

// POST /api/resume/templates/:id/review - Add review to template
router.post(
  '/templates/:id/review',
  requireAuth,
  [
    param('id').isMongoId(),
    body('rating').isInt({ min: 1, max: 5 }),
    body('comment').optional().isString().trim().isLength({ max: 500 })
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const template = await ResumeTemplate.findById(req.params.id);
      if (!template || template.status !== 'active') {
        return res.status(404).json({ error: 'Template not found' });
      }

      await template.addReview(req.userId, req.body.rating, req.body.comment);

      return res.json({ 
        message: 'Review added successfully',
        averageRating: template.averageRating
      });
    } catch (err) {
      return next(err);
    }
  }
);

module.exports = router;