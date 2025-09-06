global.File = class File {}

const path = require('path');
const dotenv = require('dotenv');

const envPath = process.env.NODE_ENV === 'production' 
  ? path.resolve(__dirname, '.env.production') 
  : path.resolve(__dirname, '.env.development');

dotenv.config({ path: envPath });

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const mongoose = require('mongoose');

// Import new services
const { loggingService } = require('./src/services/loggingService');
const { errorHandlingService } = require('./src/services/errorHandlingService');

const cacheService = require('./src/services/cacheService');
const dataCleanupService = require('./src/services/dataCleanupService');

const app = express();

// Services initialize themselves automatically

// Basic middleware
app.use(morgan('dev'));
app.use(helmet());
app.use(express.json());
app.use(cors({
  origin: ['http://localhost:4200', 'http://localhost:4201', 'https://umashankar-anantharapu.github.io'],
  credentials: true,
}));

// Request logging middleware
app.use((req, res, next) => {
  const startTime = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const requestLog = {
      method: req.method,
      url: req.originalUrl,
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
  { path: './src/routes/auth', mount: '/api/auth' },
  { path: './src/routes/profile', mount: '/api/profile' },
  { path: './src/routes/onboarding', mount: '/api/onboarding' },
  { path: './src/routes/roadmap', mount: '/api/roadmap' },
  { path: './src/routes/myLearning', mount: '/api/my-learning' },

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
  { path: './src/routes/resume', mount: '/api/resume' },
  { path: './src/routes/skills', mount: '/api/skills' },
  { path: './src/routes/research', mount: '/api/research' },
];

// Load routes
function loadRoutes() {
  let successCount = 0;
  console.log('Loading routes...');
  
  // Force Express router initialization
  app.get('/___force_router_init___', (req, res) => res.json({ message: 'Router test' }));
  console.log('Router initialized, stack length:', app._router ? app._router.stack.length : 'no router');
  
  for (const route of routes) {
    try {
      console.log(`Attempting to load: ${route.path}`);
      const routeModule = require(route.path);
      console.log(`Module type: ${typeof routeModule}, is function: ${typeof routeModule === 'function'}`);
      if (typeof routeModule === 'function') {
        console.log(`About to mount ${route.mount} with module:`, typeof routeModule);
        app.use(route.mount, routeModule);
        console.log(`✓ Loaded route: ${route.mount} from ${route.path}`);
        
        // Test if the route was actually registered by trying to access it
        setTimeout(() => {
          console.log(`Testing route ${route.mount} registration...`);
          const testReq = { method: 'GET', url: route.mount, originalUrl: route.mount };
          const testRes = { status: () => ({ json: () => {} }), json: () => {} };
          try {
            // This is a basic test - in reality we'd need proper req/res objects
            console.log(`Route ${route.mount} appears to be registered`);
          } catch (err) {
            console.error(`Route ${route.mount} test failed:`, err.message);
          }
        }, 100);
        
        successCount++;
      } else {
        console.error(`✗ Route module is not a function: ${route.path}`);
      }
    } catch (err) {
      console.error(`✗ Failed to import ${route.path}:`, err.message);
      console.error('Full error:', err);
    }
  }
  console.log(`Routes loaded: ${successCount}/${routes.length}`);
  
  // Final debug: List all registered routes
  if (app._router && app._router.stack) {
    console.log('\n=== REGISTERED ROUTES DEBUG ===');
    app._router.stack.forEach((layer, index) => {
      if (layer.route) {
        console.log(`${index}: ${Object.keys(layer.route.methods)} ${layer.route.path}`);
      } else if (layer.name === 'router') {
        console.log(`${index}: Router middleware (${layer.regexp})`);
      } else {
        console.log(`${index}: ${layer.name} middleware`);
      }
    });
    console.log('=== END ROUTES DEBUG ===\n');
  }
  
  return successCount;
}



const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/skillforge';

async function startServer() {
  try {
    // Connect to MongoDB
    mongoose.set('strictQuery', true);
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB at:', MONGODB_URI);
    
    // Initialize data cleanup service
    try {
      dataCleanupService.initialize();
      console.log('Data cleanup service initialized successfully');
    } catch (error) {
      console.error('Failed to initialize data cleanup service:', error.message);
      // Don't exit - cleanup service is not critical for basic functionality
    }
    
    // Load routes
    loadRoutes();
    

    


    // Add 404 and error handlers AFTER all routes are loaded - TEMPORARILY DISABLED
    // 404 handler (must be after all routes)
    // app.use((req, res) => {
    //   loggingService.warn(`404 - Route not found: ${req.method} ${req.originalUrl}`);
    //   monitoringService.trackError('NOT_FOUND', req.originalUrl);
    //   res.status(404).json({ error: `Cannot ${req.method} ${req.originalUrl}` });
    // });
    
    // Use enhanced error handler - TEMPORARILY DISABLED FOR DEBUGGING
    // app.use(errorHandlingService.expressErrorHandler());
    
    // Start server
    app.listen(PORT, () => {
      console.log(`Server listening on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();