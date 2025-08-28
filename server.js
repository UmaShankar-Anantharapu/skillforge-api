global.File = class File {}

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const mongoose = require('mongoose');

const app = express();

// Basic middleware
app.use(morgan('dev'));
app.use(helmet());
app.use(express.json());
app.use(cors({
  origin: ['http://localhost:4200', 'http://localhost:4201'],
  credentials: true,
}));

// Logging middleware
app.use((req, res, next) => {
  console.log(`INCOMING REQUEST: ${req.method} ${req.originalUrl}`);
  console.log('Request headers:', req.headers);
  next();
});

// Health endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Simple test endpoint
app.get('/api/simple-direct', (req, res) => {
  console.log('SIMPLE DIRECT ENDPOINT HIT!');
  res.json({ message: 'Simple direct endpoint works!' });
});

// Debug test endpoint - REMOVED to avoid conflict with /api/skills/debug-test
// app.get('/api/debug-test', (req, res) => {
//   console.log('Debug test endpoint hit!');
//   res.json({ message: 'Debug test working', timestamp: new Date().toISOString() });
// });

// New test endpoint
app.get('/api/immediate-test', (req, res) => {
  console.log('Immediate test endpoint hit!');
  res.json({ message: 'Immediate test working', timestamp: new Date().toISOString() });
});

// Test skills route mounting
app.get('/api/skills/server-test', (req, res) => {
  res.json({ message: 'Skills route test from server.js', timestamp: new Date().toISOString() });
});

// Direct test route for debugging
app.get('/api/direct-test', (req, res) => {
  console.log('DIRECT TEST ROUTE HIT!');
  res.json({ message: 'Direct test route working', timestamp: new Date().toISOString() });
});

// Routes configuration
const routes = [
  { path: './src/routes/auth', mount: '/api/auth' },
  { path: './src/routes/profile', mount: '/api/profile' },
  { path: './src/routes/onboarding', mount: '/api/onboarding' },
  { path: './src/routes/roadmap', mount: '/api/roadmap' },
  { path: './src/routes/lesson', mount: '/api/lesson' },
  { path: './src/routes/progress', mount: '/api/progress' },
  { path: './src/routes/challenge', mount: '/api/challenge' },
  { path: './src/routes/challenges', mount: '/api/challenges' },
  { path: './src/routes/leaderboard', mount: '/api/leaderboard' },
  { path: './src/routes/tutor', mount: '/api/tutor' },
  { path: './src/routes/runner', mount: '/api/runner' },
  { path: './src/routes/analytics', mount: '/api/analytics' },
  { path: './src/routes/badges', mount: '/api/badges' },
  { path: './src/routes/squad', mount: '/api/squad' },
  { path: './src/routes/admin', mount: '/api/admin' },
  { path: './src/routes/research', mount: '/api/research' },
  { path: './src/routes/resume', mount: '/api/resume' },
  { path: './src/routes/skills', mount: '/api/skills' },
  { path: './src/routes/skills-test', mount: '/api/skills-test' },
  { path: './src/routes/simple-test', mount: '/api/simple-test' },
  { path: './src/routes/debug-routes', mount: '/api/debug' }
];

// Load routes
function loadRoutes() {
  console.log('Loading routes...');
  let successCount = 0;
  for (const route of routes) {
    try {
      console.log(`Importing route: ${route.path}`);
      // Clear require cache to avoid caching issues
      const absolutePath = require.resolve(route.path);
      console.log(`Clearing cache for: ${absolutePath}`);
      delete require.cache[absolutePath];
      
      // Also clear any dependencies that might be cached
      Object.keys(require.cache).forEach(key => {
        if (key.includes('routes/skills') || key.includes('routes/skills-test')) {
          console.log(`Clearing dependency cache: ${key}`);
          delete require.cache[key];
        }
      });
      
      const routeModule = require(route.path);
      console.log(`Route module type: ${typeof routeModule}, is function: ${typeof routeModule === 'function'}`);
      app.use(route.mount, routeModule);
      console.log(`✓ Successfully registered: ${route.mount}`);
      successCount++;
    } catch (err) {
      console.error(`✗ Failed to import ${route.path}:`, err.message);
      console.error(err.stack);
    }
  }
  console.log(`\nRoute loading complete: ${successCount}/${routes.length} routes loaded successfully`);
  return successCount;
}



const PORT = 5000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/skillForge';

async function startServer() {
  try {
    // Connect to MongoDB
    mongoose.set('strictQuery', true);
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB at:', MONGODB_URI);
    
    // Load routes
    loadRoutes();
    
    // Debug: Log all registered routes
    console.log('\n=== REGISTERED ROUTES DEBUG ===');
    if (app._router && app._router.stack) {
      app._router.stack.forEach((middleware, index) => {
        if (middleware.route) {
          console.log(`Route ${index}: ${Object.keys(middleware.route.methods)} ${middleware.route.path}`);
        } else if (middleware.name === 'router') {
          console.log(`Router ${index}: ${middleware.regexp} (mounted router)`);
          if (middleware.handle && middleware.handle.stack) {
            middleware.handle.stack.forEach((route, routeIndex) => {
              if (route.route) {
                console.log(`  Sub-route ${routeIndex}: ${Object.keys(route.route.methods)} ${route.route.path}`);
              }
            });
          }
        }
      });
    } else {
      console.log('No router stack found');
    }
    console.log('=== END ROUTES DEBUG ===\n');
    
    // Add 404 and error handlers BEFORE starting server
    // 404 handler (must be after all routes)
    app.use((req, res) => {
      console.log(`404 - Route not found: ${req.method} ${req.originalUrl}`);
      res.status(404).json({ error: `Cannot ${req.method} ${req.originalUrl}` });
    });
    
    // Error handler
    app.use((err, req, res, next) => {
      console.error('Error:', err.message);
      res.status(500).json({ error: 'Internal Server Error' });
    });
    
    console.log('404 and error handlers added');
    
    // Start server
    app.listen(PORT, () => {
      console.log(`Server listening on http://localhost:${PORT}`);
      console.log('Available endpoints:');
      console.log('- GET /api/health');
      console.log('- GET /api/simple-test/hello');
      console.log('- GET /api/skills');
      console.log('- And more...');
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();