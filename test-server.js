const express = require('express');
const app = express();

// Simple logging middleware
app.use((req, res, next) => {
  console.log(`TEST SERVER: ${req.method} ${req.url}`);
  next();
});

// Simple test route
app.get('/test', (req, res) => {
  console.log('TEST ROUTE HIT!');
  res.json({ message: 'Test server works!' });
});

// Start server
app.listen(5001, () => {
  console.log('Test server listening on http://localhost:5001');
});