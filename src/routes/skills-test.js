const express = require('express');
const router = express.Router();

// Simple test endpoint
router.get('/test', (req, res) => {
  res.json({ message: 'Skills test route is working!', timestamp: new Date().toISOString() });
});

// Debug test endpoint
router.get('/debug-test', (req, res) => {
  console.log('DEBUG: debug-test endpoint called from skills-test');
  res.json({ success: true, message: 'Debug test endpoint reached from skills-test' });
});

// Trending roadmaps endpoint
router.get('/trending-roadmaps', (req, res) => {
  console.log('DEBUG: trending-roadmaps endpoint called from skills-test');
  res.json({ success: true, message: 'Trending roadmaps endpoint reached from skills-test' });
});

module.exports = router;