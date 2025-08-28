const express = require('express');
const mongoose = require('mongoose');
const { param, body, validationResult } = require('express-validator');
const requireAuth = require('../middleware/requireAuth');
const { generateRoadmapForUser, getRoadmap } = require('../services/roadmapService');
const { updateRoadmapForWeakAreas, getRecommendations } = require('../services/adaptiveEngine');
const { generateRoadmapWithLLM } = require('../services/roadmapLlmService');

// Import models
const UserProfile = require('../models/UserProfile');
const Roadmap = require('../models/Roadmap');

// Import services
const { generateSkillSuggestions } = require('../services/skillSuggestionService');

const router = express.Router();

// POST /api/roadmap/generate -> generate for current user from profile
router.post('/generate', requireAuth,async (req, res, next) => {
  try {
    console.log(req);
    console.log(req.userId);
    const roadmap = await generateRoadmapForUser(req.userId);
    return res.json({ roadmap });
  } catch (err) {
    return next(err);
  }
});

// GET /api/roadmap/:userId -> fetch roadmap (must be own)
router.get('/:userId',requireAuth, [param('userId').isString().isLength({ min: 1 })], async (req, res, next) => {
  try {
    console.log(req);
    console.log(req.userId);
    // if (req.params.userId !== req.body.userId) {
    //   return res.status(403).json({ error: 'Forbidden' });
    // }
    const roadmap = await getRoadmap(req.params.userId);
    if (!roadmap) return res.status(404).json({ error: 'Roadmap not found' });
    return res.json({ roadmap });
  } catch (err) {
    return next(err);
  }
});

// POST /api/roadmap/analyze-requirements - Analyze skill gaps for user's goal
router.post('/analyze-requirements', requireAuth, [
  body('goal').isString().trim().notEmpty().withMessage('Goal is required'),
  body('currentSkills').optional().isArray().withMessage('Current skills must be an array'),
  body('targetRole').optional().isString().trim().withMessage('Target role must be a string')
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { goal, currentSkills = [], targetRole } = req.body;
    const userId = req.userId;

    // Get user profile for additional context
    const profile = await UserProfile.findOne({ userId });

    // Generate skill suggestions based on goal and current skills
    const skillSuggestions = await generateSkillSuggestions(
      goal,
      currentSkills,
      targetRole || profile?.targetRole,
      false // Use predefined mappings for now
    );

    // Analyze skill gaps
    const currentSkillNames = currentSkills.map(skill => skill.skillName.toLowerCase());
    const skillGaps = skillSuggestions.map(suggestion => {
      const currentSkill = currentSkills.find(cs =>
        cs.skillName.toLowerCase() === suggestion.skillName.toLowerCase()
      );

      return {
        skillName: suggestion.skillName,
        currentLevel: currentSkill ? currentSkill.proficiencyLevel : 'None',
        targetLevel: suggestion.category === 'Core' ? 'Advanced' :
                    suggestion.category === 'Advanced' ? 'Intermediate' : 'Beginner',
        priority: suggestion.priority === 'High' ? 10 :
                 suggestion.priority === 'Medium' ? 7 : 5,
        relevanceScore: suggestion.relevanceScore,
        category: suggestion.category,
        estimatedLearningTime: suggestion.estimatedLearningTime,
        description: suggestion.description
      };
    });

    // Sort by priority and relevance
    skillGaps.sort((a, b) => {
      if (a.priority !== b.priority) return b.priority - a.priority;
      return b.relevanceScore - a.relevanceScore;
    });

    return res.status(200).json({
      message: 'Skill requirements analyzed successfully',
      analysis: {
        goal,
        targetRole,
        totalSkillsAnalyzed: skillSuggestions.length,
        skillGaps: skillGaps.slice(0, 15), // Return top 15 skill gaps
        summary: {
          coreSkillsNeeded: skillGaps.filter(sg => sg.category === 'Core').length,
          advancedSkillsNeeded: skillGaps.filter(sg => sg.category === 'Advanced').length,
          complementarySkillsNeeded: skillGaps.filter(sg => sg.category === 'Complementary').length,
          estimatedTotalLearningTime: calculateTotalLearningTime(skillGaps)
        }
      }
    });
  } catch (err) {
    return next(err);
  }
});

// POST /api/roadmap/generate-preview - Generate roadmap preview
router.post('/generate-preview', requireAuth, [
  body('profileId').optional().isMongoId().withMessage('Valid profile ID required'),
  body('useResearchAgent').optional().isBoolean().withMessage('Use research agent must be boolean')
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { profileId, useResearchAgent = false } = req.body;
    const userId = req.userId;

    // Get user profile
    const profile = await UserProfile.findOne({
      userId,
      ...(profileId && { _id: profileId })
    });

    if (!profile) {
      return res.status(404).json({ error: 'User profile not found' });
    }

    // Validate that profile has required data for roadmap generation
    if (!profile.primaryGoal || !profile.timeline?.targetDuration || !profile.timeline?.weeklyTimeCommitment) {
      return res.status(400).json({
        error: 'Incomplete profile data. Please complete onboarding first.',
        missing: {
          primaryGoal: !profile.primaryGoal,
          targetDuration: !profile.timeline?.targetDuration,
          weeklyTimeCommitment: !profile.timeline?.weeklyTimeCommitment
        }
      });
    }

    // Generate roadmap using LLM service
    const roadmapData = await generateRoadmapWithLLM(userId, useResearchAgent);

    return res.status(200).json({
      message: 'Roadmap preview generated successfully',
      preview: {
        title: roadmapData.title,
        description: roadmapData.description,
        estimatedDuration: roadmapData.estimatedDuration,
        difficultyLevel: roadmapData.difficultyLevel,
        totalMilestones: roadmapData.milestones.length,
        totalSteps: roadmapData.steps.length,
        milestones: roadmapData.milestones.map(milestone => ({
          id: milestone.id,
          title: milestone.title,
          description: milestone.description,
          estimatedWeeks: milestone.estimatedWeeks,
          skills: milestone.skills
        })),
        weeklyBreakdown: generateWeeklyBreakdown(roadmapData.steps),
        generationMetadata: roadmapData.generationMetadata
      }
    });
  } catch (err) {
    return next(err);
  }
});

// Helper functions
function calculateTotalLearningTime(skillGaps) {
  // Simple estimation based on skill gaps
  const totalWeeks = skillGaps.reduce((total, skill) => {
    const timeStr = skill.estimatedLearningTime;
    const weeks = parseInt(timeStr.split('-')[0]) || 4;
    return total + weeks;
  }, 0);

  return `${Math.ceil(totalWeeks / 4)} months`;
}

function generateWeeklyBreakdown(steps) {
  const weeklyBreakdown = {};

  steps.forEach(step => {
    const week = step.week;
    if (!weeklyBreakdown[week]) {
      weeklyBreakdown[week] = {
        week,
        totalSteps: 0,
        totalMinutes: 0,
        stepTypes: {}
      };
    }

    weeklyBreakdown[week].totalSteps += 1;
    weeklyBreakdown[week].totalMinutes += step.estimatedMinutes;

    if (!weeklyBreakdown[week].stepTypes[step.type]) {
      weeklyBreakdown[week].stepTypes[step.type] = 0;
    }
    weeklyBreakdown[week].stepTypes[step.type] += 1;
  });

  return Object.values(weeklyBreakdown);
}

function calculateEstimatedCompletionDate(targetDuration, startDate = new Date()) {
  const durationMap = {
    '1 month': 30,
    '3 months': 90,
    '6 months': 180,
    '1 year': 365
  };

  const days = durationMap[targetDuration] || 90;
  const completionDate = new Date(startDate);
  completionDate.setDate(completionDate.getDate() + days);

  return completionDate;
}

function applyCustomizations(roadmapData, customizations) {
  const customizedData = { ...roadmapData };

  customizations.forEach(customization => {
    if (customization.type === 'step' && customization.stepId) {
      const step = customizedData.steps.find(s => s.day === customization.stepId);
      if (step) {
        if (customization.title) step.title = customization.title;
        if (customization.description) step.description = customization.description;
        if (customization.estimatedMinutes) step.estimatedMinutes = customization.estimatedMinutes;
      }
    } else if (customization.type === 'milestone' && customization.milestoneId) {
      const milestone = customizedData.milestones.find(m => m.id === customization.milestoneId);
      if (milestone) {
        if (customization.title) milestone.title = customization.title;
        if (customization.description) milestone.description = customization.description;
        if (customization.estimatedWeeks) milestone.estimatedWeeks = customization.estimatedWeeks;
      }
    }
  });

  return customizedData;
}

module.exports = router;

// POST /api/roadmap/update -> update roadmap using memory bank
router.post('/update', async (req, res, next) => {
  try {
    const roadmap = await updateRoadmapForWeakAreas(req.userId);
    if (!roadmap) return res.status(404).json({ error: 'Roadmap not found' });
    return res.json({ roadmap });
  } catch (err) {
    return next(err);
  }
});

// GET /api/roadmap/recommendations -> short list of suggestions
router.get('/recommendations/list', async (req, res, next) => {
  try {
    const recs = await getRecommendations(req.userId);
    return res.json({ recommendations: recs });
  } catch (err) {
    return next(err);
  }
});

// POST /api/roadmap/generate-llm -> use Ollama to create roadmap
router.post('/generate-llm', async (req, res, next) => {
  try {
    const roadmap = await generateRoadmapWithLLM(req.userId);
    return res.json({ roadmap });
  } catch (err) {
    return next(err);
  }
});

// GET /api/roadmap/recommendations/ai - Profile-based AI recommendations (25 items)
router.get('/recommendations/ai', requireAuth, async (req, res, next) => {
  try {
    const profile = await UserProfile.findOne({ userId: req.userId });
    const skills = Array.isArray(profile?.skills) ? profile.skills.map(s => s.name || s.skillName).filter(Boolean) : [];
    const experience = profile?.experienceLevel || profile?.level || 'beginner';

    const { chat, extractJSON } = require('../services/llmClient');
    const prompt = `You are an expert learning path curator. Using the following user context, recommend 25 career-growth learning roadmaps.
User skills: ${skills.join(', ') || 'none'}
Experience: ${experience}
Return JSON strictly in this shape:
{
  "items": [
    {"id":"slug","title":"...","description":"...","image":"url-or-empty","resources":[{"title":"...","url":"..."}],"demoProjects":[{"title":"...","url":"..."}]}
  ]
}`;

    const text = await chat([{ role: 'user', content: prompt }]);
    let data = extractJSON(text) || { items: [] };

    // Fallback if missing/short
    if (!Array.isArray(data.items) || data.items.length < 10) {
      data.items = (data.items || []).concat(Array.from({ length: 25 - (data.items?.length || 0) }, (_, i) => ({
        id: `ai-rec-${i+1}`,
        title: `Recommended Roadmap ${i+1}`,
        description: 'AI suggested roadmap.',
        image: '', resources: [], demoProjects: []
      })));
    }

    // Limit to 25
    data.items = data.items.slice(0, 25);
    return res.json({ recommendations: data.items });
  } catch (err) {
    return next(err);
  }
});

// GET /api/roadmap/recommendations/trending - Global trending roadmaps (25)
router.get('/recommendations/trending', requireAuth, async (req, res, next) => {
  try {
    const { performWebSearch } = require('../services/researchAgentService');
    const { chat, extractJSON } = require('../services/llmClient');

    // Seed with quick web search topics
    const seed = await performWebSearch('top trending technologies and developer skills 2025', 8);
    const seedList = seed.map(s => s.title).join(', ');

    const prompt = `From the following trending topics: ${seedList}. Create 25 ranked learning roadmaps irrespective of user skills.
Return JSON with {"items":[{"id":"slug","title":"...","description":"...","image":"","resources":[{"title":"","url":""}],"demoProjects":[{"title":"","url":""}]}]}`;

    const text = await chat([{ role: 'user', content: prompt }]);
    let data = extractJSON(text) || { items: [] };
    if (!Array.isArray(data.items) || data.items.length < 10) {
      data.items = (data.items || []).concat(Array.from({ length: 25 - (data.items?.length || 0) }, (_, i) => ({
        id: `trending-${i+1}`,
        title: `Trending Roadmap ${i+1}`,
        description: 'Trending roadmap',
        image: '', resources: [], demoProjects: []
      })));
    }
    data.items = data.items.slice(0, 25);
    return res.json({ recommendations: data.items });
  } catch (err) {
    return next(err);
  }
});


// POST /api/roadmap/generate-enhanced -> Enhanced profile-based roadmap with Ollama
router.post('/generate-enhanced', requireAuth, [
  body('provider').optional().isIn(['ollama', 'openrouter']).withMessage('Provider must be ollama or openrouter'),
  body('useResearchAgent').optional().isBoolean().withMessage('Use research agent must be boolean')
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { provider = 'ollama', useResearchAgent = false } = req.body;

    // Check if user has a profile for enhanced generation
    const profile = await UserProfile.findOne({ userId: req.userId });
    if (!profile) {
      return res.status(400).json({
        error: 'User profile required for enhanced roadmap generation',
        suggestion: 'Please complete your profile first at /api/profile'
      });
    }

    const roadmap = await generateRoadmapWithLLM(req.userId, useResearchAgent, provider);

    return res.json({
      roadmap,
      generationInfo: {
        provider,
        model: provider === 'ollama' ? process.env.OLLAMA_MODEL || 'phi3:mini' : 'openrouter',
        profileBased: true,
        useResearchAgent,
        profileData: {
          skill: profile.skill,
          level: profile.level,
          dailyTime: profile.dailyTime,
          goal: profile.learningGoal
        }
      }
    });
  } catch (err) {
     console.error('Enhanced roadmap generation error:', err.message);
     return next(err);
   }
 });


