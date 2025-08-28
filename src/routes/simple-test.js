const express = require('express');
const router = express.Router();

// Simple test endpoint
router.get('/hello', (req, res) => {
  res.json({ message: 'Hello from simple test route!' });
});

module.exports = router;