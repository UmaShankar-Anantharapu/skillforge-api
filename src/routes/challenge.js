const express = require('express');
const { body } = require('express-validator');
const requireAuth = require('../middleware/requireAuth');
const Challenge = require('../models/Challenge');
const { awardBadge } = require('../services/badgeService');

const router = express.Router();

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const items = await Challenge.find({}).sort({ createdAt: -1 }).lean();
    return res.json({ challenges: items });
  } catch (err) { return next(err); }
});

router.post('/join', requireAuth, [body('id').isString().isLength({ min: 1 })], async (req, res, next) => {
  try {
    const { id } = req.body;
    const ch = await Challenge.findOne({ id });
    if (!ch) return res.status(404).json({ error: 'Challenge not found' });
    const already = ch.participants.some((p) => p.toString() === req.userId);
    if (!already) {
      ch.participants.push(req.userId);
      await ch.save();
      // Award badge for first challenge join
      await awardBadge(req.userId, 'challenger', 'Challenger', 'Joined a challenge');
    }
    return res.json({ challenge: ch });
  } catch (err) { return next(err); }
});

module.exports = router;


