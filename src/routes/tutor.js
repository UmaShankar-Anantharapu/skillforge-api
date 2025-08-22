const express = require('express');
const { body } = require('express-validator');
const requireAuth = require('../middleware/requireAuth');
const { askTutor } = require('../services/tutorService');

const router = express.Router();

router.post('/ask', requireAuth, [body('message').isString().isLength({ min: 1 })], async (req, res, next) => {
  try { const { message, history } = req.body; const data = await askTutor(message, Array.isArray(history) ? history : []); return res.json(data); } catch (err) { return next(err); }
});

router.get('/stream', requireAuth, async (req, res, next) => {
  try {
    const message = String(req.query.q || 'Hello');
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    const data = await askTutor(message, []);
    res.write(`data: ${JSON.stringify({ delta: data.reply })}\n\n`);
    res.write('event: end\n');
    res.write('data: done\n\n');
    res.end();
  } catch (err) { return next(err); }
});

module.exports = router;


