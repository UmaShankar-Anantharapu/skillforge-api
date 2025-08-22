const express = require('express');
const requireAuth = require('../middleware/requireAuth');
const Leaderboard = require('../models/Leaderboard');
const User = require('../models/User');

const router = express.Router();

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const rows = await Leaderboard.find({}).sort({ points: -1 }).limit(50).lean();
    // Optionally join user names
    const userIds = rows.map((r) => r.userId);
    const users = await User.find({ _id: { $in: userIds } }, { name: 1 }).lean();
    const nameMap = new Map(users.map((u) => [u._id.toString(), u.name]));
    const ranked = rows.map((r, idx) => ({
      userId: r.userId,
      name: nameMap.get(r.userId.toString()) || 'User',
      points: r.points,
      rank: idx + 1,
    }));
    return res.json({ leaderboard: ranked });
  } catch (err) { return next(err); }
});

module.exports = router;


