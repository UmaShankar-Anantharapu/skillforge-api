const express = require('express');
const requireAuth = require('../middleware/requireAuth');
const User = require('../models/User');
const Squad = require('../models/Squad');

const router = express.Router();

// Minimal admin list endpoints (no RBAC yet)
router.get('/users', requireAuth, async (req, res, next) => {
  try {
    console.log(req);
    const users = await User.find({}, { name: 1, email: 1 }).lean();
    return res.json({ users });
  } catch (e) { return next(e); }
});

router.get('/squads', requireAuth, async (req, res, next) => {
  try {
    const squads = await Squad.find({}, { name: 1, members: 1 }).lean();
    return res.json({ squads });
  } catch (e) { return next(e); }
});

module.exports = router;


