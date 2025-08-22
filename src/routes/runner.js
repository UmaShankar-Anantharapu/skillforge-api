const express = require('express');
const { body } = require('express-validator');
const requireAuth = require('../middleware/requireAuth');
const { runNodeSandboxed } = require('../services/runnerService');

const router = express.Router();

router.post('/node', requireAuth, [body('code').isString().isLength({ min: 1 })], async (req, res, next) => {
  try {
    const { code } = req.body;
    const result = await runNodeSandboxed(code);
    return res.json(result);
  } catch (err) { return next(err); }
});

module.exports = router;


