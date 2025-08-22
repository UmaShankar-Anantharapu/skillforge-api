require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const mongoose = require('mongoose');

const authRoutes = require('./src/routes/auth');
const profileRoutes = require('./src/routes/profile');
const onboardingRoutes = require('./src/routes/onboarding');
const roadmapRoutes = require('./src/routes/roadmap');
const lessonRoutes = require('./src/routes/lesson');
const progressRoutes = require('./src/routes/progress');
const challengeRoutes = require('./src/routes/challenge');
const challengesRoutes = require('./src/routes/challenges');
const leaderboardRoutes = require('./src/routes/leaderboard');
const tutorRoutes = require('./src/routes/tutor');
const runnerRoutes = require('./src/routes/runner');
const analyticsRoutes = require('./src/routes/analytics');
const badgesRoutes = require('./src/routes/badges');
const squadRoutes = require('./src/routes/squad');
const adminRoutes = require('./src/routes/admin');
const researchRoutes = require('./src/routes/research');

const app = express();

// Middleware
app.use(helmet());
app.use(express.json());

const frontendOrigin = process.env.FRONTEND_ORIGIN || 'http://localhost:4200';
app.use(
  cors({
    origin: frontendOrigin,
    credentials: true,
  })
);

app.use(morgan('dev'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/onboarding', onboardingRoutes);
app.use('/api/roadmap', roadmapRoutes);
app.use('/api/lesson', lessonRoutes);
app.use('/api/progress', progressRoutes);
app.use('/api/challenge', challengeRoutes);
app.use('/api/challenges', challengesRoutes);
app.use('/api/leaderboard', leaderboardRoutes);
app.use('/api/tutor', tutorRoutes);
app.use('/api/runner', runnerRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/badges', badgesRoutes);
app.use('/api/squad', squadRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/research', researchRoutes);

// Global error handler
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  // Avoid leaking internal errors
  const status = err.status || 500;
  const message = err.message || 'Internal Server Error';
  res.status(status).json({ error: message });
});

const PORT = process.env.PORT || 5000;
const MONGODB_URI =
  process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/skillforge';

async function startServer() {
  try {
    mongoose.set('strictQuery', true);
    
    // Connect to the actual MongoDB instance
    await mongoose.connect(MONGODB_URI);
    // eslint-disable-next-line no-console
    console.log('Connected to MongoDB at:', MONGODB_URI);

    app.listen(PORT, () => {
      // eslint-disable-next-line no-console
      console.log(`Server listening on http://localhost:${PORT}`);
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();


