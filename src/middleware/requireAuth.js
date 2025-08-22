const jwt = require('jsonwebtoken');

module.exports = function requireAuth(req, res, next) {
  console.log('ac');
  try {
    const authHeader = req.headers.authorization || '';
    const [, token] = authHeader.split(' ');
    if (!token) {
      return res.status(401).json({ error: 'Missing Authorization header' });
    }
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret-change-me');
    req.userId = payload.sub;
    req.userEmail = payload.email;
    return next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};


