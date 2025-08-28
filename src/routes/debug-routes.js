const express = require('express');
const router = express.Router();

console.log('DEBUG: debug-routes.js module loaded, defining routes...');

// Debug test endpoint
router.get('/test', (req, res) => {
  console.log('DEBUG: New debug route test endpoint called');
  res.json({ success: true, message: 'New debug route working', timestamp: new Date().toISOString() });
});
console.log('DEBUG: /test route defined');

// Debug endpoint for skills
router.get('/skills-debug', (req, res) => {
  console.log('DEBUG: Skills debug endpoint called');
  res.json({ success: true, message: 'Skills debug endpoint working', timestamp: new Date().toISOString() });
});
console.log('DEBUG: /skills-debug route defined');

console.log('DEBUG: debug-routes.js module export ready, router has', router.stack ? router.stack.length : 'unknown', 'routes');
module.exports = router;