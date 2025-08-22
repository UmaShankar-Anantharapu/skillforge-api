const express = require('express');
const { body, validationResult } = require('express-validator');
const requireAuth = require('../middleware/requireAuth');
const UserProfile = require('../models/UserProfile');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');
const { OpenAI } = require('openai');
const { processResume, generateDraftOnboardingData } = require('../services/resumeExtractorService');

// Configure OpenAI client (if API key is available)
let openai;
try {
  if (process.env.OPENAI_API_KEY) {
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
} catch (error) {
  console.warn('OpenAI client initialization failed:', error.message);
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../uploads');
    // Create directory if it doesn't exist
    if (!fsSync.existsSync(uploadDir)) {
      fsSync.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: function (req, file, cb) {
    const filetypes = /pdf|doc|docx/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only PDF, DOC, and DOCX files are allowed'));
    }
  }
});

const router = express.Router();

// POST /api/onboarding/step/0 - Get Started (Step 0)
router.post(
  '/step/0',
  requireAuth,
  async (req, res, next) => {
    try {
      const userId = req.userId;

      const profile = await UserProfile.findOneAndUpdate(
        { userId },
        { onboardingStep: 1 },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      return res.status(200).json({ message: 'Onboarding started successfully', profile });
    } catch (err) {
      return next(err);
    }
  }
);

// POST /api/onboarding/start-manually - Start onboarding with draft data
router.post(
  '/start-manually',
  requireAuth,
  async (req, res, next) => {
    try {
      const userId = req.userId;
      
      // Generate draft onboarding data
      const draftData = await generateDraftOnboardingData();
      
      // Update user profile to step 1
      const profile = await UserProfile.findOneAndUpdate(
        { userId },
        { onboardingStep: 1 },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      
      return res.status(200).json({ 
        message: 'Onboarding started with draft data', 
        profile,
        draftData
      });
    } catch (err) {
      return next(err);
    }
  }
);

// POST /api/onboarding/step/1 - Welcome & Basic Profile (Step 1)
router.post(
  '/step/1',
  requireAuth,
  [
    body('fullName').isString().trim().notEmpty().withMessage('Full name is required'),
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('phoneNumber').optional().isString().trim(),
    body('jobTitle').isString().trim().notEmpty().withMessage('Job title is required'),
    body('company').optional().isString().trim(),
    body('industry').isString().trim().notEmpty().withMessage('Industry is required'),
    body('yearsExperience').isIn(['0-2', '3-5', '6-10', '10+']).withMessage('Valid years of experience is required'),
    body('preferredLanguage').isString().trim().notEmpty().withMessage('Preferred language is required'),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { fullName, email, phoneNumber, jobTitle, company, industry, yearsExperience, preferredLanguage } = req.body;
      const userId = req.userId;

      const profile = await UserProfile.findOneAndUpdate(
        { userId },
        { 
          fullName, 
          email, 
          phoneNumber, 
          jobTitle, 
          company, 
          industry, 
          yearsExperience, 
          preferredLanguage,
          onboardingStep: 2
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      return res.status(200).json({ message: 'Basic profile saved successfully', profile });
    } catch (err) {
      return next(err);
    }
  }
);

// POST /api/onboarding/step/2 - Learning Goals & Context (Step 2)
router.post(
  '/step/2',
  requireAuth,
  [
    body('primaryLearningGoal').isIn(['Career advancement', 'Skill enhancement', 'Career change', 'Interview prep', 'Personal interest']).withMessage('Valid primary learning goal is required'),
    body('targetRole').optional().isString().trim(),
    body('learningTimeline').isIn(['1 month', '3 months', '6 months', '1 year', 'No deadline']).withMessage('Valid learning timeline is required'),
    body('motivationLevel').isIn(['Casual learner', 'Moderate commitment', 'Highly motivated', 'Career critical']).withMessage('Valid motivation level is required'),
    body('currentChallenge').isIn(['Lack of time', 'Don\'t know where to start', 'Need structured learning', 'Want to stay updated']).withMessage('Valid current challenge is required'),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { primaryLearningGoal, targetRole, learningTimeline, motivationLevel, currentChallenge } = req.body;
      const userId = req.userId;

      const profile = await UserProfile.findOneAndUpdate(
        { userId },
        { 
          primaryLearningGoal, 
          targetRole, 
          learningTimeline, 
          motivationLevel, 
          currentChallenge,
          onboardingStep: 3
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      return res.status(200).json({ message: 'Learning goals saved successfully', profile });
    } catch (err) {
      return next(err);
    }
  }
);

// POST /api/onboarding/step/3 - Learning Preferences (Step 3)
router.post(
  '/step/3',
  requireAuth,
  [
    body('learningStyle').isIn(['Visual', 'Auditory', 'Hands-on/Kinesthetic', 'Reading/Text']).withMessage('Valid learning style is required'),
    body('contentFormat').isIn(['Video tutorials', 'Interactive exercises', 'Text articles', 'Combination']).withMessage('Valid content format is required'),
    body('sessionDuration').isIn(['5-15 min', '15-30 min', '30-60 min', '60+ min']).withMessage('Valid session duration is required'),
    body('learningDifficulty').isIn(['Gradual progression', 'Moderate pace', 'Fast-track/Intensive']).withMessage('Valid learning difficulty is required'),
    body('preferredDevice').isIn(['Mobile', 'Desktop', 'Tablet', 'All equally']).withMessage('Valid preferred device is required'),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { learningStyle, contentFormat, sessionDuration, learningDifficulty, preferredDevice } = req.body;
      const userId = req.userId;

      const profile = await UserProfile.findOneAndUpdate(
        { userId },
        { 
          learningStyle, 
          contentFormat, 
          sessionDuration, 
          learningDifficulty, 
          preferredDevice,
          onboardingStep: 4
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      return res.status(200).json({ message: 'Learning preferences saved successfully', profile });
    } catch (err) {
      return next(err);
    }
  }
);

// POST /api/onboarding/step/4 - Schedule & Availability (Step 4)
router.post(
  '/step/4',
  requireAuth,
  [
    body('dailyTime').isIn(['15-30 min', '30-60 min', '1-2 hours', '2+ hours']).withMessage('Valid daily time is required'),
    body('bestLearningTimes').isArray({ min: 1 }).withMessage('At least one best learning time is required'),
    body('bestLearningTimes.*').isIn(['Morning', 'Afternoon', 'Evening', 'Late night']).withMessage('Valid best learning times are required'),
    body('daysPerWeek').isIn(['1-2 days', '3-4 days', '5-6 days', 'Daily']).withMessage('Valid days per week is required'),
    body('timeZone').isString().trim().notEmpty().withMessage('Time zone is required'),
    body('reminderMethod').isIn(['Email', 'Push notification', 'SMS', 'None']).withMessage('Valid reminder method is required'),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { dailyTime, bestLearningTimes, daysPerWeek, timeZone, reminderMethod } = req.body;
      const userId = req.userId;

      const profile = await UserProfile.findOneAndUpdate(
        { userId },
        { 
          dailyTime, 
          bestLearningTimes, 
          daysPerWeek, 
          timeZone, 
          reminderMethod,
          onboardingStep: 5
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      return res.status(200).json({ message: 'Schedule and availability saved successfully', profile });
    } catch (err) {
      return next(err);
    }
  }
);
// POST /api/onboarding/step/5 - Skills Assessment Setup (Step 5)
router.post(
  '/step/5',
  requireAuth,
  [
    body('primarySkillCategory').isString().trim().notEmpty().withMessage('Primary skill category is required'),
    body('skillsToLearn').isArray({ min: 1 }).withMessage('At least one skill to learn is required'),
    body('skillsToLearn.*').isString().trim().notEmpty().withMessage('Each skill must be a non-empty string'),
    body('currentSkillLevels').isArray({ min: 1 }).withMessage('Current skill levels are required'),
    body('currentSkillLevels.*.skill').isString().trim().notEmpty().withMessage('Skill name is required'),
    body('currentSkillLevels.*.level').isIn(['Beginner', 'Intermediate', 'Advanced', 'Expert']).withMessage('Valid skill level is required'),
    body('relatedSkills').optional().isArray(),
    body('relatedSkills.*').optional().isString().trim(),
    body('prioritySkills').isArray({ min: 1, max: 3 }).withMessage('1-3 priority skills are required'),
    body('prioritySkills.*').isString().trim().notEmpty().withMessage('Each priority skill must be a non-empty string'),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { primarySkillCategory, skillsToLearn, currentSkillLevels, relatedSkills, prioritySkills } = req.body;
      const userId = req.userId;

      const profile = await UserProfile.findOneAndUpdate(
        { userId },
        { 
          primarySkillCategory, 
          skillsToLearn, 
          currentSkillLevels, 
          relatedSkills, 
          prioritySkills,
          onboardingStep: 6
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      return res.status(200).json({ message: 'Skills assessment setup saved successfully', profile });
    } catch (err) {
      return next(err);
    }
  }
);

// POST /api/onboarding/step/6 - Background & Experience (Step 6)
router.post(
  '/step/6',
  requireAuth,
  [
    body('educationLevel').isIn(['High School', 'Bachelor\'s', 'Master\'s', 'PhD', 'Professional Certification', 'Self-taught']).withMessage('Valid education level is required'),
    body('certifications').optional().isArray(),
    body('certifications.*').optional().isString().trim(),
    body('previousLearningExperience').isIn(['Online courses', 'Bootcamps', 'University', 'Self-study', 'None']).withMessage('Valid previous learning experience is required'),
    body('teamRole').isIn(['Individual contributor', 'Team lead', 'Manager', 'Senior manager', 'Executive', 'Student']).withMessage('Valid team role is required'),
    body('learningBudget').isIn(['Free only', '<$50/month', '$50-200/month', '$200+/month', 'Company sponsored']).withMessage('Valid learning budget is required'),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { educationLevel, certifications, previousLearningExperience, teamRole, learningBudget } = req.body;
      const userId = req.userId;

      const profile = await UserProfile.findOneAndUpdate(
        { userId },
        { 
          educationLevel, 
          certifications, 
          previousLearningExperience, 
          teamRole, 
          learningBudget,
          onboardingStep: 7
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      return res.status(200).json({ message: 'Background and experience saved successfully', profile });
    } catch (err) {
      return next(err);
    }
  }
);

// POST /api/onboarding/step/7 - Success Metrics & Preferences (Step 7)
router.post(
  '/step/7',
  requireAuth,
  [
    body('successMeasurement').isIn(['Completion certificates', 'Skill assessments', 'Real projects', 'Portfolio building', 'Job placement']).withMessage('Valid success measurement is required'),
    body('progressTracking').isIn(['Detailed analytics', 'Simple progress bar', 'Milestone-based', 'Minimal tracking']).withMessage('Valid progress tracking preference is required'),
    body('communityParticipation').isIn(['Very active', 'Moderate participation', 'Occasional', 'Prefer solo learning']).withMessage('Valid community participation preference is required'),
    body('accessibilityRequirements').optional().isArray(),
    body('accessibilityRequirements.*').optional().isIn(['Screen reader', 'Large text', 'High contrast', 'Keyboard navigation', 'None']),
    body('communicationPreferences').isArray({ min: 1 }).withMessage('At least one communication preference is required'),
    body('communicationPreferences.*').isIn(['Email updates', 'In-app notifications', 'SMS reminders', 'Weekly digests']).withMessage('Valid communication preferences are required'),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { successMeasurement, progressTracking, communityParticipation, accessibilityRequirements, communicationPreferences } = req.body;
      const userId = req.userId;

      const profile = await UserProfile.findOneAndUpdate(
        { userId },
        { 
          successMeasurement, 
          progressTracking, 
          communityParticipation, 
          accessibilityRequirements, 
          communicationPreferences,
          onboardingStep: 8
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      return res.status(200).json({ message: 'Success metrics and preferences saved successfully', profile });
    } catch (err) {
      return next(err);
    }
  }
);

// POST /api/onboarding/step/8 - Skill Assessment (Step 8)
router.post(
  '/step/8',
  requireAuth,
  [
    body('skillAssessments').isArray({ min: 1 }).withMessage('Skill assessments are required'),
    body('skillAssessments.*.skill').isString().trim().notEmpty().withMessage('Skill name is required'),
    body('skillAssessments.*.confidenceLevel').isInt({ min: 1, max: 10 }).withMessage('Confidence level must be between 1 and 10'),
    body('skillAssessments.*.recentExperience').isIn(['Currently using', 'Within 6 months', '6-12 months ago', '1+ years ago', 'Never used professionally']).withMessage('Valid recent experience is required'),
    body('skillAssessments.*.learningGoal').isIn(['Learn basics', 'Improve proficiency', 'Master advanced concepts', 'Stay updated with trends']).withMessage('Valid learning goal is required'),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { skillAssessments } = req.body;
      const userId = req.userId;

      const profile = await UserProfile.findOneAndUpdate(
        { userId },
        { 
          skillAssessments,
          onboardingStep: 9
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      return res.status(200).json({ message: 'Skill assessment saved successfully', profile });
    } catch (err) {
      return next(err);
    }
  }
);

// POST /api/onboarding/step/9 - Final Setup & Preferences (Step 9)
router.post(
  '/step/9',
  requireAuth,
  [
    body('profilePrivacy').isIn(['Public profile', 'Private', 'Visible to connections only']).withMessage('Valid profile privacy setting is required'),
    body('dataSharing.analytics').isBoolean().withMessage('Analytics data sharing preference is required'),
    body('dataSharing.marketing').isBoolean().withMessage('Marketing data sharing preference is required'),
    body('dataSharing.thirdParty').isBoolean().withMessage('Third-party data sharing preference is required'),
    body('notificationPreferences.email').isBoolean().withMessage('Email notification preference is required'),
    body('notificationPreferences.push').isBoolean().withMessage('Push notification preference is required'),
    body('notificationPreferences.sms').isBoolean().withMessage('SMS notification preference is required'),
    body('themePreference').isIn(['Dark mode', 'Light mode', 'Auto']).withMessage('Valid theme preference is required'),
    body('betaFeatures').isBoolean().withMessage('Beta features preference is required'),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { profilePrivacy, dataSharing, notificationPreferences, themePreference, betaFeatures } = req.body;
      const userId = req.userId;

      const profile = await UserProfile.findOneAndUpdate(
        { userId },
        { 
          profilePrivacy, 
          dataSharing, 
          notificationPreferences, 
          themePreference, 
          betaFeatures,
          onboardingStep: 10,
          onboardingComplete: true
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      return res.status(200).json({ message: 'Final setup and preferences saved successfully', profile });
    } catch (err) {
      return next(err);
    }
  }
);

// POST /api/onboarding/analyze-resume - Analyze resume to extract onboarding data
router.post(
  '/analyze-resume',
  requireAuth,
  upload.single('resume'),
  async (req, res, next) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const filePath = req.file.path;
      const fileExtension = path.extname(filePath).toLowerCase();
      let fileType;
      
      // Determine file type
      if (fileExtension === '.pdf') {
        fileType = 'pdf';
      } else if (fileExtension === '.doc') {
        fileType = 'doc';
      } else if (fileExtension === '.docx') {
        fileType = 'docx';
      } else {
        await fs.unlink(filePath);
        return res.status(400).json({ error: 'Unsupported file type' });
      }

      try {
        // Process resume using Ollama LLM
        const extractedData = await processResume(filePath, fileType);
        
        // Clean up the uploaded file
        try {
          await fs.unlink(filePath);
        } catch (err) {
          console.error('Error deleting file:', err);
        }

        // Map extracted data to onboarding format
        const onboardingData = {
          personalInfo: extractedData.personalInfo || {},
          background: extractedData.background || {},
          skillsAssessment: extractedData.skillsAssessment || {},
          userType: extractedData.userType || 'fresher',
          skills: extractedData.skillsAssessment?.currentSkillLevels || [],
          primarySkill: extractedData.skillsAssessment?.primarySkillCategory || ''
        };

        return res.status(200).json(onboardingData);
      } catch (processError) {
        // Clean up the uploaded file in case of error
        try {
          await fs.unlink(filePath);
        } catch (err) {
          console.error('Error deleting file:', err);
        }
        
        // Check if this is an Ollama connection error
        if (processError.message.includes('Ollama service is not running') || 
            processError.message.includes('Resume analysis requires Ollama')) {
          return res.status(503).json({ 
            error: 'Resume analysis service is currently unavailable. Please try the manual input method instead.'
          });
        }
        
        throw processError; // Re-throw for the outer catch block
      }
    } catch (err) {
      console.error('Error analyzing resume:', err);
      return res.status(500).json({ error: 'Error analyzing resume' });
    }
  }
);

// POST /api/onboarding/complete - Complete onboarding with all data
router.post(
  '/complete',
  requireAuth,
  [
    body('skills').isArray().withMessage('Skills must be an array'),
    body('primarySkill').isString().withMessage('Primary skill is required'),
    body('level').isString().withMessage('Level is required'),
    body('dailyTime').isNumeric().withMessage('Daily time must be a number'),
    body('goal').isString().withMessage('Goal is required'),
    body('personalInfo').isObject().withMessage('Personal info must be an object'),
    body('personalInfo.fullName').isString().withMessage('Full name is required'),
    body('personalInfo.email').isEmail().withMessage('Valid email is required'),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { 
        skills, 
        primarySkill, 
        level, 
        dailyTime, 
        goal,
        personalInfo
      } = req.body;
      
      const userId = req.userId;

      const profile = await UserProfile.findOneAndUpdate(
        { userId },
        { 
          skill: primarySkill,
          level,
          dailyTime,
          goal,
          skills,
          fullName: personalInfo.fullName,
          email: personalInfo.email,
          dateOfBirth: personalInfo.dateOfBirth,
          gender: personalInfo.gender,
          country: personalInfo.country,
          city: personalInfo.city,
          occupation: personalInfo.occupation,
          company: personalInfo.company,
          onboardingStep: 'completed'
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      return res.status(200).json({ 
        message: 'Onboarding completed successfully', 
        profile 
      });
    } catch (err) {
      console.error('Error completing onboarding:', err);
      return res.status(500).json({ error: 'Error completing onboarding' });
    }
  }
);

module.exports = router;