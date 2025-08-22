const express = require('express');
const { body } = require('express-validator');
const requireAuth = require('../middleware/requireAuth');
const Challenge = require('../models/Challenge');
const UserChallenge = require('../models/UserChallenge');
const { awardPoints } = require('../services/pointsService');
const { awardBadge } = require('../services/badgeService');

const router = express.Router();

// GET /api/challenge - List available challenges
router.get('/', requireAuth, async (req, res, next) => {
  try {
    // Get all challenges
    const challenges = await Challenge.find().lean();
    
    // Get user's joined challenges
    const userChallenges = await UserChallenge.find({ userId: req.userId }).lean();
    const joinedChallengeIds = userChallenges.map(uc => uc.challengeId.toString());
    
    // Mark challenges as joined if user has joined them
    const challengesWithStatus = challenges.map(challenge => ({
      ...challenge,
      joined: joinedChallengeIds.includes(challenge._id.toString()),
      progress: userChallenges.find(uc => uc.challengeId.toString() === challenge._id.toString())?.progress || 0
    }));
    
    return res.json({ challenges: challengesWithStatus });
  } catch (err) {
    return next(err);
  }
});

// POST /api/challenge/join - Join a challenge
router.post('/join', requireAuth, [
  body('id').isString().withMessage('Challenge ID is required')
], async (req, res, next) => {
  try {
    const { id } = req.body;
    
    // Check if challenge exists
    const challenge = await Challenge.findById(id);
    if (!challenge) {
      return res.status(404).json({ message: 'Challenge not found' });
    }
    
    // Check if user has already joined this challenge
    const existingUserChallenge = await UserChallenge.findOne({
      userId: req.userId,
      challengeId: id
    });
    
    if (existingUserChallenge) {
      return res.status(400).json({ message: 'You have already joined this challenge' });
    }
    
    // Create user challenge entry
    const userChallenge = await UserChallenge.create({
      userId: req.userId,
      challengeId: id,
      startedAt: new Date(),
      progress: 0
    });
    
    // Award badge for joining first challenge
    const userChallengeCount = await UserChallenge.countDocuments({ userId: req.userId });
    if (userChallengeCount === 1) {
      await awardBadge(req.userId, 'first_challenge', 'Challenger', 'Joined your first challenge');
    }
    
    // Award points for joining a challenge
    await awardPoints(req.userId, 5, 'challenge_joined');
    
    return res.json({
      message: 'Successfully joined challenge',
      challenge: {
        ...challenge.toObject(),
        joined: true,
        progress: 0
      }
    });
  } catch (err) {
    return next(err);
  }
});

// POST /api/challenge/progress - Update challenge progress
router.post('/progress', requireAuth, [
  body('id').isString().withMessage('Challenge ID is required'),
  body('progress').isInt({ min: 0, max: 100 }).withMessage('Progress must be between 0 and 100')
], async (req, res, next) => {
  try {
    const { id, progress } = req.body;
    
    // Check if user has joined this challenge
    const userChallenge = await UserChallenge.findOne({
      userId: req.userId,
      challengeId: id
    });
    
    if (!userChallenge) {
      return res.status(400).json({ message: 'You have not joined this challenge' });
    }
    
    // Get the challenge to calculate points
    const challenge = await Challenge.findById(id);
    if (!challenge) {
      return res.status(404).json({ message: 'Challenge not found' });
    }
    
    const previousProgress = userChallenge.progress;
    userChallenge.progress = progress;
    
    // If challenge is completed (progress = 100%)
    if (progress === 100 && previousProgress < 100) {
      userChallenge.completedAt = new Date();
      
      // Award points for completing the challenge
      await awardPoints(req.userId, challenge.points || 50, 'challenge_completed');
      
      // Award badge for completing challenge
      await awardBadge(
        req.userId,
        `challenge_${challenge._id}`,
        challenge.title || 'Challenge Completed',
        `Completed the ${challenge.title} challenge`
      );
      
      // Check for milestone badges
      const completedChallenges = await UserChallenge.countDocuments({
        userId: req.userId,
        completedAt: { $exists: true }
      });
      
      if (completedChallenges === 5) {
        await awardBadge(req.userId, 'five_challenges', 'Challenge Master', 'Completed 5 challenges');
      }
      
      if (completedChallenges === 10) {
        await awardBadge(req.userId, 'ten_challenges', 'Challenge Champion', 'Completed 10 challenges');
      }
    }
    
    await userChallenge.save();
    
    return res.json({
      message: 'Challenge progress updated',
      userChallenge
    });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;