const express = require('express');
const mongoose = require('mongoose');
const { body, validationResult } = require('express-validator');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const requireAuth = require('../middleware/requireAuth');
const UserProfile = require('../models/UserProfile');
const { processResume } = require('../services/resumeExtractorService');

const router = express.Router();

// Configure multer for temporary uploads
const uploadDir = path.join(process.cwd(), 'uploads');
try { if (!require('fs').existsSync(uploadDir)) require('fs').mkdirSync(uploadDir, { recursive: true }); } catch {}
const upload = multer({
  dest: uploadDir,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

// Predefined options for dropdowns

const COUNTRIES_TIMEZONES = [
  { country: 'United States', timezone: 'America/New_York' },
  { country: 'United Kingdom', timezone: 'Europe/London' },
  { country: 'India', timezone: 'Asia/Kolkata' },
  { country: 'Canada', timezone: 'America/Toronto' },
  { country: 'Australia', timezone: 'Australia/Sydney' },
  { country: 'Germany', timezone: 'Europe/Berlin' },
  { country: 'France', timezone: 'Europe/Paris' },
  { country: 'Japan', timezone: 'Asia/Tokyo' },
  { country: 'Singapore', timezone: 'Asia/Singapore' },
  { country: 'Brazil', timezone: 'America/Sao_Paulo' }
];

const COMMON_SKILLS = [
  // Programming Languages
  'JavaScript', 'Python', 'Java', 'TypeScript', 'C++', 'C#', 'PHP', 'Ruby', 'Go', 'Rust', 'Swift', 'Kotlin', 'Scala', 'R', 'MATLAB', 'Dart',
  
  // Frontend Technologies
  'React', 'Angular', 'Vue.js', 'Svelte', 'Next.js', 'Nuxt.js', 'HTML', 'CSS', 'SASS', 'LESS', 'Tailwind CSS', 'Bootstrap', 'Material-UI', 'Chakra UI',
  
  // Backend Technologies
  'Node.js', 'Express.js', 'Django', 'Flask', 'FastAPI', 'Spring Boot', 'ASP.NET', 'Ruby on Rails', 'Laravel', 'Symfony', 'Gin', 'Fiber',
  
  // Mobile Development
  'React Native', 'Flutter', 'Ionic', 'Xamarin', 'SwiftUI', 'Android Development', 'iOS Development',
  
  // Databases
  'MongoDB', 'PostgreSQL', 'MySQL', 'SQLite', 'Redis', 'Elasticsearch', 'Cassandra', 'DynamoDB', 'Firebase', 'Supabase',
  
  // Cloud & DevOps
  'AWS', 'Azure', 'Google Cloud Platform', 'Docker', 'Kubernetes', 'Jenkins', 'GitLab CI/CD', 'GitHub Actions', 'Terraform', 'Ansible',
  
  // Data & AI/ML
  'Machine Learning', 'Deep Learning', 'Data Science', 'Artificial Intelligence', 'TensorFlow', 'PyTorch', 'Pandas', 'NumPy', 'Scikit-learn', 'Apache Spark',
  
  // Design & UX
  'UI/UX Design', 'Figma', 'Adobe Creative Suite', 'Sketch', 'InVision', 'Principle', 'Framer', 'Webflow',
  
  // Tools & Methodologies
  'Git', 'Linux', 'Agile', 'Scrum', 'DevOps', 'Project Management', 'Cybersecurity', 'Testing', 'API Development', 'Microservices',
  
  // Emerging Technologies
  'Blockchain', 'Web3', 'GraphQL', 'WebAssembly', 'Progressive Web Apps', 'Serverless', 'Edge Computing', 'IoT'
];

const PREDEFINED_GOALS = [
  'Get a job as a Software Developer',
  'Transition to Full-Stack Development',
  'Learn Data Science and Machine Learning',
  'Become a Frontend Specialist',
  'Master Backend Development',
  'Learn Mobile App Development',
  'Get into DevOps and Cloud Computing',
  'Transition to Product Management',
  'Learn UI/UX Design',
  'Master Cybersecurity',
  'Learn Game Development',
  'Become a Data Engineer',
  'Learn Blockchain Development',
  'Master System Design',
  'Learn AI/ML Engineering',
  'Other (Custom Goal)'
];

// Helper function to validate step data
const validateStepData = (step, data) => {
  const validations = {
    1: ['fullName', 'email', 'country', 'timezone'],
    2: ['careerBackground']
  };

  const required = validations[step] || [];
  const missing = required.filter(field => !data[field] || (Array.isArray(data[field]) && data[field].length === 0));

  return {
    isValid: missing.length === 0,
    missingFields: missing
  };
};

// POST /api/onboarding/start - Initialize onboarding session (Step 0)
router.post('/start', requireAuth, async (req, res, next) => {
  try {
    const userId = req.userId;
    const { sessionId } = req.body;

    // Generate session ID if not provided
    const finalSessionId = sessionId || new mongoose.Types.ObjectId().toString();

    // Find existing profile or create new one
    let profile = await UserProfile.findOne({ userId });

    if (profile) {
      // Reset onboarding for existing user
      profile.sessionId = finalSessionId;
      profile.onboardingStep = 0;
      profile.onboardingComplete = false;
      profile.roadmapGenerated = false;
      await profile.save();
    } else {
      // Create new profile
      profile = await UserProfile.create({
        userId,
        sessionId: finalSessionId,
        onboardingStep: 0,
        onboardingComplete: false,
        roadmapGenerated: false
      });
    }

    return res.status(200).json({
      message: 'Onboarding session initialized successfully',
      profile: {
        sessionId: profile.sessionId,
        onboardingStep: profile.onboardingStep,
        onboardingProgress: profile.onboardingProgress
      },
      config: {
        totalSteps: 7,
        predefinedGoals: PREDEFINED_GOALS,
        countriesTimezones: COUNTRIES_TIMEZONES,
        commonSkills: COMMON_SKILLS
      }
    });
  } catch (err) {
    return next(err);
  }
});


// POST /api/onboarding/resume-upload - Upload a resume and extract data for autofill (Step 0 action)
router.post('/resume-upload', requireAuth, upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const allowed = ['.pdf', '.doc', '.docx'];
    const ext = path.extname(req.file.originalname).toLowerCase();
    if (!allowed.includes(ext)) {
      // Clean up uploaded file
      fs.unlink(req.file.path, () => {});
      return res.status(400).json({ error: 'Unsupported file type. Please upload PDF, DOC, or DOCX' });
    }

    // Map extension to fileType expected by service
    const fileType = ext.replace('.', ''); // 'pdf' | 'doc' | 'docx'

    // Process with LLM extractor
    const extracted = await processResume(req.file.path, fileType);

    // Clean up uploaded file after processing
    fs.unlink(req.file.path, () => {});

    // Map extracted fields into onboarding step data structure
    // Note: Backend step configs expect fields across steps; frontend will handle assigning to appropriate step forms
    const payload = {
      personalInfo: extracted.personalInfo || {},
      background: extracted.background || {},
      skillsAssessment: extracted.skillsAssessment || {},
      userType: extracted.userType || null
    };

    return res.json({ success: true, data: payload });
  } catch (err) {
    // Best-effort cleanup
    if (req.file) fs.unlink(req.file.path, () => {});
    return next(err);
  }
});

// GET /api/onboarding/step/:stepNumber - Get step configuration and current data
router.get('/step/:stepNumber', requireAuth, async (req, res, next) => {
  try {
    const userId = req.userId;
    const stepNumber = parseInt(req.params.stepNumber);

    if (stepNumber < 0 || stepNumber > 6) {
      return res.status(400).json({ error: 'Invalid step number. Must be between 0 and 6.' });
    }

    const profile = await UserProfile.findOne({ userId });
    if (!profile) {
      return res.status(404).json({ error: 'User profile not found. Please start onboarding first.' });
    }

    // Step configurations
    const stepConfigs = {
      0: {
        title: 'Get Started',
        description: 'Welcome to your personalized learning journey',
        fields: [],
        data: {}
      },
      1: {
        title: 'Personal Details',
        description: 'Tell us about yourself',
        fields: ['fullName', 'email', 'age', 'country', 'timezone', 'preferredLanguages'],
        data: {
          fullName: profile.fullName || '',
          email: profile.email || '',
          age: profile.age || null,
          country: profile.country || '',
          timezone: profile.timezone || '',
          preferredLanguages: profile.preferredLanguages || []
        }
      },
      2: {
        title: 'Career Background',
        description: 'Tell us about your work experience and professional background',
        fields: ['careerBackground'],
        data: {
          careerBackground: profile.careerBackground || []
        }
      },
      3: {
        title: 'Skill Requirements Analysis',
        description: 'Skills needed for your goal',
        fields: ['requiredSkills'],
        data: {
          requiredSkills: profile.requiredSkills || []
        }
      },
      4: {
        title: 'Timeline & Commitment',
        description: 'When and how much time can you dedicate?',
        fields: ['timeline'],
        data: {
          timeline: profile.timeline || {}
        }
      },
      5: {
        title: 'Learning Preferences',
        description: 'How do you prefer to learn?',
        fields: ['learningPreferences'],
        data: {
          learningPreferences: profile.learningPreferences || {}
        }
      },
      6: {
        title: 'AI Roadmap Generation & Review',
        description: 'Review your personalized learning roadmap',
        fields: [],
        data: {
          roadmapGenerated: profile.roadmapGenerated || false
        }
      }
    };

    return res.status(200).json({
      step: stepConfigs[stepNumber],
      currentStep: profile.onboardingStep,
      progress: profile.onboardingProgress,
      canAccess: stepNumber <= profile.onboardingStep + 1
    });
  } catch (err) {
    return next(err);
  }
});

// POST /api/onboarding/step/1 - Personal Details (Step 1)
router.post('/step/1', requireAuth, [
  body('sessionId').isString().trim().notEmpty().withMessage('Session ID is required'),
  body('fullName').isString().trim().isLength({ min: 2, max: 100 }).withMessage('Full name is required (2-100 characters)'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('age').optional().isInt({ min: 16, max: 100 }).withMessage('Age must be between 16 and 100'),
  body('country').isString().trim().notEmpty().withMessage('Country is required'),
  body('timezone').isString().trim().notEmpty().withMessage('Timezone is required'),
  body('preferredLanguages').optional().isArray().withMessage('Preferred languages must be an array')
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { sessionId, fullName, email, age, country, timezone, preferredLanguages } = req.body;
    const userId = req.userId;

    const profile = await UserProfile.findOneAndUpdate(
      { userId, sessionId },
      {
        fullName,
        email,
        age,
        country,
        timezone,
        preferredLanguages,
        onboardingStep: 1
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return res.status(200).json({
      message: 'Personal details saved successfully',
      profile: {
        sessionId: profile.sessionId,
        onboardingStep: profile.onboardingStep,
        onboardingProgress: profile.onboardingProgress,
        hasPersonalDetails: profile.hasPersonalDetails
      }
    });
  } catch (err) {
    return next(err);
  }
});

// POST /api/onboarding/step/2 - Career Background Assessment (Step 2)
router.post('/step/2', requireAuth, [
  body('sessionId').isString().trim().notEmpty().withMessage('Session ID is required'),
  body('careerBackground').isArray({ min: 1 }).withMessage('At least one work experience is required'),
  body('careerBackground.*.company').isString().trim().notEmpty().withMessage('Company name is required'),
  body('careerBackground.*.position').isString().trim().notEmpty().withMessage('Position/role is required'),
  body('careerBackground.*.yearsOfExperience').isInt({ min: 0, max: 50 }).withMessage('Years of experience must be between 0 and 50'),
  body('careerBackground.*.skillsWorkedOn').optional().isArray().withMessage('Skills worked on must be an array'),
  body('careerBackground.*.startDate').optional().isISO8601().withMessage('Valid start date is required'),
  body('careerBackground.*.endDate').optional().isISO8601().withMessage('Valid end date is required'),
  body('careerBackground.*.isCurrent').optional().isBoolean().withMessage('Current position flag must be boolean'),
  body('careerBackground.*.description').optional().isString().trim().withMessage('Description must be a string')
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { sessionId, careerBackground } = req.body;
    const userId = req.userId;

    const profile = await UserProfile.findOneAndUpdate(
      { userId, sessionId },
      {
        careerBackground,
        onboardingStep: 2,
        onboardingCompleted: true
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return res.status(200).json({
      message: 'Career background saved successfully',
      profile: {
        sessionId: profile.sessionId,
        onboardingStep: profile.onboardingStep,
        onboardingProgress: profile.onboardingProgress,
        hasCareerBackground: profile.hasCareerBackground
      }
    });
  } catch (err) {
    return next(err);
  }
});





// POST /api/onboarding/skills/suggest - AI-powered skill suggestions
router.post('/skills/suggest', requireAuth, [
  body('goal').optional().isString().trim(),
  body('currentSkills').optional().isArray(),
  body('targetRole').optional().isString().trim()
], async (req, res, next) => {
  try {
    const { goal, currentSkills, targetRole } = req.body;

    // For now, return predefined suggestions based on goal
    // TODO: Implement AI-powered suggestions using LLM
    const skillSuggestions = {
      'Become an Angular Expert': ['Angular', 'TypeScript', 'RxJS', 'NgRx', 'Angular Material', 'Jest', 'Cypress'],
      'Crack FAANG Interviews': ['Data Structures', 'Algorithms', 'System Design', 'JavaScript', 'Python', 'Java', 'SQL'],
      'Learn AI from basics': ['Python', 'Machine Learning', 'Deep Learning', 'TensorFlow', 'PyTorch', 'NumPy', 'Pandas'],
      'Master Full-Stack Development': ['JavaScript', 'React', 'Node.js', 'Express.js', 'MongoDB', 'PostgreSQL', 'Docker'],
      'Become a Data Scientist': ['Python', 'R', 'SQL', 'Machine Learning', 'Statistics', 'Pandas', 'Matplotlib', 'Jupyter']
    };

    const suggestions = skillSuggestions[goal] || COMMON_SKILLS.slice(0, 10);

    return res.status(200).json({
      message: 'Skill suggestions generated successfully',
      suggestions: suggestions.map(skill => ({
        skillName: skill,
        relevanceScore: Math.random() * 0.3 + 0.7, // Mock relevance score
        category: 'Technical', // Mock category
        description: `Essential skill for ${goal || 'your learning journey'}`
      }))
    });
  } catch (err) {
    return next(err);
  }
});

// POST /api/onboarding/skills/subskills - Get prerequisites and sub-skills for a core skill
router.post('/skills/subskills', requireAuth, [
  body('skillName').isString().trim().notEmpty().withMessage('Skill name is required')
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { skillName } = req.body;
    // Prompt LLM for structured prerequisites and sub-skills
    const provider = process.env.DEFAULT_LLM_PROVIDER || 'ollama';
    const { chat, extractJSON } = require('../services/llmClient');

    const system = { role: 'system', content: 'You are a senior technical mentor. Given a core skill, produce a concise JSON with prerequisites and subSkills arrays. Keep items short and specific.' };
    const user = { role: 'user', content: `Core Skill: ${skillName}\n\nReturn JSON with keys: prerequisites (top 3-6), subSkills (15-30). Example keys only, no explanations.` };

    let prerequisites = [];
    let subSkills = [];

    try {
      const text = await chat([system, user], provider);
      const parsed = extractJSON(text) || {};
      prerequisites = Array.isArray(parsed.prerequisites) ? parsed.prerequisites : [];
      subSkills = Array.isArray(parsed.subSkills) ? parsed.subSkills : [];
    } catch (e) {
      console.warn('LLM subskills generation failed, using fallback for', skillName);
    }

    // Fallback static examples for common skills
    if (subSkills.length === 0 && /angular/i.test(skillName)) {
      prerequisites = ['HTML', 'CSS', 'JavaScript', 'TypeScript'];
      subSkills = [
        'Change Detection','RxJS & Reactive Programming','State Management (NgRx)','Dependency Injection','Routing & Route Guards',
        'Angular Forms (Reactive & Template-driven)','HTTPClient & Interceptors','Pipes (Built-in & Custom)','Directives (Structural & Attribute)',
        'Lifecycle Hooks','Security & Sanitization','Angular Universal (SSR)','Standalone Components','Angular Modules','Testing (Jest/Cypress)',
        'Performance Optimization (OnPush, trackBy)','Internationalization (i18n)','Accessibility (ARIA)','PWAs with Service Workers','Dynamic Component Loading'
      ];
    }

    return res.status(200).json({ skillName, prerequisites, subSkills });
  } catch (err) {
    return next(err);
  }
});

// POST /api/onboarding/complete - Complete onboarding and generate roadmap (Step 7)
router.post('/complete', requireAuth, [
  body('sessionId').isString().trim().notEmpty().withMessage('Session ID is required')
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { sessionId } = req.body;
    const userId = req.userId;

    // Find the user profile
    const profile = await UserProfile.findOne({ userId, sessionId });
    if (!profile) {
      return res.status(404).json({ error: 'User profile not found' });
    }

    // Validate that all required steps are completed
    const validation = validateStepData(6, {
      fullName: profile.fullName,
      email: profile.email,
      country: profile.country,
      timezone: profile.timezone,
      currentSkills: profile.currentSkills,
      primaryGoal: profile.primaryGoal,
      motivationLevel: profile.motivationLevel,
      requiredSkills: profile.requiredSkills,
      timeline: profile.timeline,
      learningPreferences: profile.learningPreferences
    });

    if (!validation.isValid) {
      return res.status(400).json({
        error: 'Onboarding incomplete',
        missingFields: validation.missingFields
      });
    }

    // Complete onboarding
    await profile.completeOnboarding();

    // TODO: Trigger roadmap generation
    // const roadmap = await generateRoadmapWithLLM(userId);

    return res.status(200).json({
      message: 'Onboarding completed successfully',
      profile: {
        sessionId: profile.sessionId,
        onboardingStep: profile.onboardingStep,
        onboardingComplete: profile.onboardingComplete,
        onboardingProgress: profile.onboardingProgress
      },
      nextSteps: {
        roadmapGeneration: true,
        redirectTo: '/roadmap'
      }
    });
  } catch (err) {
    return next(err);
  }
});

// GET /api/onboarding/status - Get current onboarding status
router.get('/status', requireAuth, async (req, res, next) => {
  try {
    const userId = req.userId;
    const profile = await UserProfile.findOne({ userId });

    if (!profile) {
      return res.status(404).json({
        error: 'User profile not found',
        onboardingRequired: true
      });
    }

    return res.status(200).json({
      sessionId: profile.sessionId,
      currentStep: profile.onboardingStep,
      progress: profile.onboardingProgress,
      isComplete: profile.onboardingComplete,
      hasPersonalDetails: profile.hasPersonalDetails,
      hasSkillsAssessment: profile.hasSkillsAssessment,
      hasLearningGoals: profile.hasLearningGoals,
      hasRoadmapConfig: profile.hasRoadmapConfig,
      roadmapGenerated: profile.roadmapGenerated
    });
  } catch (err) {
    return next(err);
  }
});

// DELETE /api/onboarding/reset - Reset onboarding progress
router.delete('/reset', requireAuth, async (req, res, next) => {
  try {
    const userId = req.userId;

    const profile = await UserProfile.findOne({ userId });
    if (!profile) {
      return res.status(404).json({ error: 'User profile not found' });
    }

    // Reset onboarding progress
    profile.onboardingStep = 0;
    profile.onboardingComplete = false;
    profile.roadmapGenerated = false;
    profile.sessionId = new mongoose.Types.ObjectId().toString();

    // Clear onboarding data but keep basic user info
    profile.currentSkills = [];
    profile.primaryGoal = '';
    profile.targetRole = '';
    profile.motivationLevel = null;
    profile.customGoalDescription = '';
    profile.requiredSkills = [];
    profile.timeline = {};
    profile.learningPreferences = {};

    await profile.save();

    return res.status(200).json({
      message: 'Onboarding progress reset successfully',
      profile: {
        sessionId: profile.sessionId,
        onboardingStep: profile.onboardingStep,
        onboardingProgress: profile.onboardingProgress
      }
    });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;