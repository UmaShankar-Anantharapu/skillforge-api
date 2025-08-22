const express = require('express');
const { body, query } = require('express-validator');
const requireAuth = require('../middleware/requireAuth');
const Progress = require('../models/Progress');
const Lesson = require('../models/Lesson');
const { updateMemoryFromScore } = require('../services/memoryService');
const { awardPoints } = require('../services/pointsService');
const { awardBadge } = require('../services/badgeService');

const router = express.Router();

// POST /api/progress -> create/update user lesson progress
router.post(
  '/',
  requireAuth,
  [
    body('lessonId').isString().isLength({ min: 1 }),
    body('status').optional().isIn(['not_started', 'in_progress', 'completed']),
    body('concept').optional().isString().isLength({ min: 1 }),
    body('score').optional().isInt({ min: 0, max: 100 }),
  ],
  async (req, res, next) => {
    try {
      const { lessonId, status, score, concept } = req.body;
      const update = { lessonId, userId: req.userId };
      if (status) update.status = status;
      if (typeof score === 'number') update.score = score;
      if (status === 'completed') update.completedAt = new Date();

      const progress = await Progress.findOneAndUpdate(
        { userId: req.userId, lessonId },
        update,
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      // If quiz completion with score, update memory bank using lesson skill/topic
      if (status === 'completed') {
        const lesson = await Lesson.findOne({ lessonId });
        const topic = concept || lesson?.concepts?.[0] || lesson?.skill || lesson?.lessonId || 'General';
        await updateMemoryFromScore(req.userId, topic, typeof score === 'number' ? score : 100);

        // Award points (simple rule: 10 points per completion + bonus based on score)
        const bonus = typeof score === 'number' ? Math.round(score / 10) : 10;
        await awardPoints(req.userId, 10 + bonus, 'lesson_completed');

        // Award "Starter" badge on first completion
        await awardBadge(req.userId, 'starter', 'Starter', 'First lesson completed');
      }

      return res.json({ progress });
    } catch (err) {
      return next(err);
    }
  }
);

module.exports = router;

// GET /api/progress -> list progress for current user (optional ?lessonId=)
router.get(
  '/',
  requireAuth,
  [query('lessonId').optional().isString().isLength({ min: 1 })],
  async (req, res, next) => {
    try {
      const filter = { userId: req.userId };
      if (req.query.lessonId) {
        filter.lessonId = req.query.lessonId;
      }
      const progress = await Progress.find(filter).sort({ updatedAt: -1 });
      return res.json({ progress });
    } catch (err) {
      return next(err);
    }
  }
);


