// Fresh server implementation based on working test server
global.File = class File {}

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const mongoose = require('mongoose');

const app = express();

// Middleware in correct order
app.use(morgan('dev'));
app.use(helmet());
app.use(express.json());

const frontendOrigin = process.env.FRONTEND_ORIGIN || 'http://localhost:4200';
app.use(
  cors({
    origin: frontendOrigin,
    credentials: true,
  })
);

// Health check endpoint
app.get('/api/health', (req, res) => {
  console.log('Health endpoint hit!');
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Add a direct test route before logging middleware
app.get('/api/direct-test-before-logging', (req, res) => {
  console.log('Direct test route before logging hit!');
  res.json({ message: 'Direct test route before logging working!' });
});

// Add request logging middleware
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

// Add a direct test route after logging middleware
app.get('/api/direct-test-after-logging', (req, res) => {
  console.log('Direct test route after logging hit!');
  res.json({ message: 'Direct test route after logging working!' });
});

// Safe route import function
function safeImportRoute(routePath, mountPath) {
  try {
    console.log(`Importing route: ${routePath}`);
    const route = require(routePath);
    app.use(mountPath, route);
    console.log(`✓ Successfully registered: ${mountPath}`);
    return true;
  } catch (err) {
    console.error(`✗ Failed to import ${routePath}:`, err.message);
    return false;
  }
}

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
  { path: './src/routes/simple-test', mount: '/api/simple-test' }
];

function loadRoutes() {
  console.log('Loading routes...');
  let successCount = 0;
  for (const route of routes) {
    if (safeImportRoute(route.path, route.mount)) {
      successCount++;
    }
  }
  console.log(`\nRoute loading complete: ${successCount}/${routes.length} routes loaded successfully`);
  return successCount;
}

// Load routes immediately before error handler
// loadRoutes(); // Moved to after function definitions

// Global error handler will be added after routes are loaded

const PORT = 5000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/skillforge';

async function startServer() {
  try {
    mongoose.set('strictQuery', true);
    
    // Connect to MongoDB
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB at:', MONGODB_URI);
    
    // Load routes after MongoDB connection but before starting server
    loadRoutes();
    
    // Add a direct test route to verify Express is working
    app.get('/api/direct-test', (req, res) => {
      console.log('Direct test route hit!');
      res.json({ message: 'Direct test route working!' });
    });
    
    // Add 404 handler for unmatched routes AFTER all routes are loaded
    app.use((req, res) => {
      console.log(`404 - Route not found: ${req.method} ${req.originalUrl}`);
      res.status(404).json({ error: `Cannot ${req.method} ${req.originalUrl}` });
    });
    
    // Add global error handler after routes are loaded
    app.use((err, req, res, next) => {
      console.error('Global error handler:', err.message);
      const status = err.status || 500;
      const message = err.message || 'Internal Server Error';
      res.status(status).json({ error: message });
    });

    app.listen(PORT, () => {
      console.log(`Server listening on http://localhost:${PORT}`);
      console.log('Available endpoints:');
      console.log('- GET /api/health');
      console.log('- GET /api/resume/templates/list');
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();


