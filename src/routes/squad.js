const express = require('express');
const { body } = require('express-validator');
const requireAuth = require('../middleware/requireAuth');
const Squad = require('../models/Squad');

const router = express.Router();

router.get('/', requireAuth, async (req, res, next) => {
  try { const squads = await Squad.find({}).lean(); return res.json({ squads }); } catch (e) { return next(e); }
});

router.post('/create', requireAuth, [body('name').isString().isLength({ min: 2 })], async (req, res, next) => {
  try {
    const squad = await Squad.create({ name: req.body.name, members: [req.userId], createdBy: req.userId });
    return res.status(201).json({ squad });
  } catch (e) { return next(e); }
});

router.post('/join', requireAuth, [body('name').isString().isLength({ min: 2 })], async (req, res, next) => {
  try {
    const squad = await Squad.findOneAndUpdate({ name: req.body.name }, { $addToSet: { members: req.userId } }, { new: true });
    if (!squad) return res.status(404).json({ error: 'Squad not found' });
    return res.json({ squad });
  } catch (e) { return next(e); }
});

module.exports = router;


