global.File = class File {}

const path = require('path');
const dotenv = require('dotenv');

const envPath = process.env.NODE_ENV === 'production' 
  ? path.resolve(__dirname, '../.env.production') 
  : path.resolve(__dirname, '../.env.development');

dotenv.config({ path: envPath });

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const mongoose = require('mongoose');

// Import new services
const { loggingService } = require('./services/loggingService');
const { errorHandlingService } = require('./services/errorHandlingService');

const cacheService = require('./services/cacheService');

const app = express();

// Initialize services


// Basic middleware
app.use(morgan('dev'));
app.use(helmet());
app.use(express.json());
app.use(cors({
  origin: '*', // Allow all origins during development
  credentials: true,
}));

// Request logging and monitoring middleware
app.use((req, res, next) => {
  const startTime = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const requestLog = {
      method: req.method,
      url: req.originalUrl,
      userAgent: req.get('User-Agent'),
      ip: req.ip,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      userId: req.user?.id || 'anonymous'
    };
    loggingService.info('API Request', requestLog);
  
  });
  
  next();
});

// Health endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Routes configuration
const routes = [
  { path: './routes/auth', mount: '/api/auth' },
  { path: './routes/profile', mount: '/api/profile' },
  { path: './routes/onboarding', mount: '/api/onboarding' },
  { path: './routes/roadmap', mount: '/api/roadmap' },
  { path: './routes/myLearning', mount: '/api/my-learning' },
  { path: './routes/lesson', mount: '/api/lesson' },
  { path: './routes/progress', mount: '/api/progress' },
  { path: './routes/challenge', mount: '/api/challenge' },
  { path: './routes/challenges', mount: '/api/challenges' },
  { path: './routes/leaderboard', mount: '/api/leaderboard' },
  { path: './routes/tutor', mount: '/api/tutor' },
  { path: './routes/runner', mount: '/api/runner' },
  { path: './routes/analytics', mount: '/api/analytics' },
  { path: './routes/badges', mount: '/api/badges' },
  { path: './routes/squad', mount: '/api/squad' },
  { path: './routes/admin', mount: '/api/admin' },
  { path: './routes/resume', mount: '/api/resume' },
  { path: './routes/skills', mount: '/api/skills' },
];

// Load routes
function loadRoutes() {
  let successCount = 0;
  for (const route of routes) {
    try {
      const routeModule = require(route.path);
      app.use(route.mount, routeModule);
      successCount++;
    } catch (err) {
      console.error(`Failed to import ${route.path}:`, err.message);
    }
  }
  return successCount;
}

// Load routes
loadRoutes();

// Add monitoring endpoints
app.get('/api/monitoring/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

app.get('/api/monitoring/metrics', (req, res) => {
  res.json({ message: 'Metrics endpoint disabled' });
});

// Add 404 and error handlers
// 404 handler (must be after all routes)
app.use((req, res) => {
  loggingService.warn(`404 - Route not found: ${req.method} ${req.originalUrl}`);

  res.status(404).json({ error: `Cannot ${req.method} ${req.originalUrl}` });
});

// Use enhanced error handler
app.use(errorHandlingService.expressErrorHandler());

module.exports = app;