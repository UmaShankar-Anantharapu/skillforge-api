const UserBadge = require('../models/UserBadge');

async function awardBadge(userId, badgeId, name, description = '') {
  try {
    await UserBadge.updateOne(
      { userId, badgeId },
      { $setOnInsert: { name, description, earnedAt: new Date() } },
      { upsert: true }
    );
  } catch {}
}

module.exports = { awardBadge };


