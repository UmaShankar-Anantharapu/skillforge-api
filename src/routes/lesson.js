const express = require('express');
const { param, body } = require('express-validator');
const Lesson = require('../models/Lesson');
const requireAuth = require('../middleware/requireAuth');
const { generateLesson } = require('../services/lessonLlmService');

const router = express.Router();

// GET /api/lesson/:id -> fetch lesson by lessonId
router.get('/:id', requireAuth, [param('id').isString().isLength({ min: 1 })], async (req, res, next) => {
  try {
    const lesson = await Lesson.findOne({ lessonId: req.params.id });
    if (!lesson) return res.status(404).json({ error: 'Lesson not found' });
    return res.json({ lesson });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;

// POST /api/lesson/generate -> generate lesson with LLM and attach to a roadmap step
router.post(
  '/generate',
  requireAuth,
  [
    body('topic').isString().isLength({ min: 1 }),
    body('skill').optional().isString(),
    body('difficulty').optional().isString(),
    body('day').optional().isInt({ min: 1 }),
  ],
  async (req, res, next) => {
    try {
      const { topic, skill, difficulty, day } = req.body;
      const lesson = await generateLesson({ userId: req.userId, topic, skill, difficulty, day });
      return res.status(201).json({ lesson });
    } catch (err) {
      return next(err);
    }
  }
);


