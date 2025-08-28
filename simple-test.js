console.log('Simple test starting...');
const express = require('express');
const app = express();

app.get('/hello', (req, res) => {
  res.json({ message: 'Hello World' });
});

app.listen(5002, () => {
  console.log('Server running on port 5002');
});