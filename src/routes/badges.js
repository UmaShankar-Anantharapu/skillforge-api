const express = require('express');
const requireAuth = require('../middleware/requireAuth');
const UserBadge = require('../models/UserBadge');

const router = express.Router();

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const badges = await UserBadge.find({ userId: req.userId }).sort({ earnedAt: -1 }).lean();
    return res.json({ badges });
  } catch (err) { return next(err); }
});

module.exports = router;


