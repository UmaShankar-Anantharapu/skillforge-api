const express = require('express');
const { param } = require('express-validator');
const requireAuth = require('../middleware/requireAuth');
const { generateRoadmapForUser, getRoadmap } = require('../services/roadmapService');
const { updateRoadmapForWeakAreas, getRecommendations } = require('../services/adaptiveEngine');
const { generateRoadmapWithLLM } = require('../services/roadmapLlmService');

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


