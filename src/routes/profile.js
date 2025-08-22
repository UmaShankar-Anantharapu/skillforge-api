const express = require('express');
const { body, validationResult, param } = require('express-validator');
const requireAuth = require('../middleware/requireAuth');
const UserProfile = require('../models/UserProfile');

const router = express.Router();

// POST /api/profile - create or update current user's profile
router.post(
  '/',
  requireAuth,
  [
    body('fullName').optional().isString().trim(),
    body('email').optional().isEmail().normalizeEmail(),
    body('dateOfBirth').optional().isISO8601().toDate(),
    body('gender').optional().isIn(['Male', 'Female', 'Other', 'Prefer not to say']),
    body('country').optional().isString().trim(),
    body('city').optional().isString().trim(),
    body('occupation').optional().isString().trim(),
    body('company').optional().isString().trim(),
    body('skill').optional().isString().trim(),
    body('level').optional().isString().trim(),
    body('dailyTime').optional().isInt({ min: 1 }),
    body('goal').optional().isString().trim(),
    body('learningGoal').optional().isArray(),
    body('learningGoal.*').optional().isString().trim(),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { fullName, email, dateOfBirth, gender, country, city, occupation, company, skill, level, dailyTime, goal, learningGoal } = req.body;
      const userId = req.userId;

      const profile = await UserProfile.findOneAndUpdate(
        { userId },
        { fullName, email, dateOfBirth, gender, country, city, occupation, company, skill, level, dailyTime, goal, learningGoal },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      return res.status(200).json({ profile });
    } catch (err) {
      return next(err);
    }
  }
);

// GET /api/profile/:id - fetch profile by user id; must match authenticated user
router.get(
  '/:id',
  requireAuth,
  [param('id').isString().isLength({ min: 1 })],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      const requestedUserId = req.params.id;
      if (requestedUserId !== req.userId) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      const profile = await UserProfile.findOne({ userId: requestedUserId });
      if (!profile) {
        return res.status(404).json({ error: 'Profile not found' });
      }
      return res.json({ profile });
    } catch (err) {
      return next(err);
    }
  }
);

module.exports = router;


