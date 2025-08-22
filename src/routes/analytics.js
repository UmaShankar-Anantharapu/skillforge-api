const express = require('express');
const { param } = require('express-validator');
const requireAuth = require('../middleware/requireAuth');
const { getUserStats } = require('../services/analyticsService');

const router = express.Router();

router.get('/:userId', requireAuth, [param('userId').isString().isLength({ min: 1 })], async (req, res, next) => {
  try {
    if (req.params.userId !== req.userId) return res.status(403).json({ error: 'Forbidden' });
    const stats = await getUserStats(req.userId);
    return res.json({ stats });
  } catch (err) { return next(err); }
});

module.exports = router;


