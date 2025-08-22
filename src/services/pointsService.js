const Leaderboard = require('../models/Leaderboard');
const { awardBadge } = require('./badgeService');

/**
 * Award points to a user and handle related gamification elements
 * @param {string} userId - The user ID
 * @param {number} points - Number of points to award
 * @param {string} action - The action that earned points (e.g., 'lesson_completed', 'challenge_completed')
 * @returns {Promise<Object>} Updated leaderboard entry
 */
async function awardPoints(userId, points, action) {
  try {
    // Update leaderboard with new points
    const leaderboard = await Leaderboard.findOneAndUpdate(
      { userId },
      { $inc: { points } },
      { upsert: true, new: true }
    );

    // Award badges based on point thresholds
    await checkAndAwardPointBadges(userId, leaderboard.points);
    
    // Award action-specific badges
    if (action === 'lesson_completed') {
      // Count completed lessons to award streak badges
      // This would be implemented with a more sophisticated tracking system
    }
    
    return leaderboard;
  } catch (error) {
    console.error('Error awarding points:', error);
    throw error;
  }
}

/**
 * Check point thresholds and award badges accordingly
 * @param {string} userId - The user ID
 * @param {number} totalPoints - User's total points
 */
async function checkAndAwardPointBadges(userId, totalPoints) {
  try {
    // Point threshold badges
    if (totalPoints >= 100) {
      await awardBadge(userId, 'points_100', 'Century', 'Earned 100 points');
    }
    
    if (totalPoints >= 500) {
      await awardBadge(userId, 'points_500', 'High Achiever', 'Earned 500 points');
    }
    
    if (totalPoints >= 1000) {
      await awardBadge(userId, 'points_1000', 'Point Master', 'Earned 1000 points');
    }
    
    if (totalPoints >= 5000) {
      await awardBadge(userId, 'points_5000', 'Skill Champion', 'Earned 5000 points');
    }
  } catch (error) {
    console.error('Error awarding point badges:', error);
  }
}

/**
 * Get user's current rank on the leaderboard
 * @param {string} userId - The user ID
 * @returns {Promise<number>} User's current rank
 */
async function getUserRank(userId) {
  try {
    // Get all users ordered by points
    const leaderboard = await Leaderboard.find().sort({ points: -1 }).lean();
    
    // Find user's position
    const userIndex = leaderboard.findIndex(entry => entry.userId.toString() === userId);
    
    return userIndex !== -1 ? userIndex + 1 : null;
  } catch (error) {
    console.error('Error getting user rank:', error);
    throw error;
  }
}

module.exports = { awardPoints, getUserRank };