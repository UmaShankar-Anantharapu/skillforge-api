# Analytics & Reporting

## Overview

The Analytics & Reporting feature in CareerLeap provides comprehensive insights into user learning patterns, progress tracking, and platform usage. This system enables users to visualize their learning journey, identify areas for improvement, and track their skill development over time. For administrators and instructors, it offers valuable data on content effectiveness, user engagement, and overall platform performance.

## Current Implementation

### Backend Implementation

#### Models

**UserAnalytics Model** (`/skillforge-api/src/models/UserAnalytics.js`)

Tracks individual user analytics data:

```javascript
const userAnalyticsSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  sessionData: [{
    sessionId: { type: String, required: true },
    startTime: { type: Date, required: true },
    endTime: { type: Date },
    duration: { type: Number }, // in seconds
    pages: [{
      path: { type: String, required: true },
      timeSpent: { type: Number, required: true }, // in seconds
      interactions: { type: Number, default: 0 }
    }],
    deviceInfo: {
      deviceType: { type: String },
      browser: { type: String },
      os: { type: String }
    }
  }],
  learningStats: {
    totalLessonsCompleted: { type: Number, default: 0 },
    totalQuizzesCompleted: { type: Number, default: 0 },
    totalCodeExercisesCompleted: { type: Number, default: 0 },
    averageQuizScore: { type: Number, default: 0 },
    streakDays: { type: Number, default: 0 },
    lastActiveDate: { type: Date },
    timeSpentBySkill: { type: Map, of: Number }, // skill -> seconds
    completionsByDifficulty: {
      beginner: { type: Number, default: 0 },
      intermediate: { type: Number, default: 0 },
      advanced: { type: Number, default: 0 }
    }
  },
  progressTimeline: [{
    date: { type: Date, required: true },
    lessonsCompleted: { type: Number, default: 0 },
    quizzesCompleted: { type: Number, default: 0 },
    codeExercisesCompleted: { type: Number, default: 0 },
    pointsEarned: { type: Number, default: 0 },
    skillsImproved: [{ 
      skill: { type: String },
      strengthDelta: { type: Number }
    }]
  }],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Indexes for efficient querying
userAnalyticsSchema.index({ userId: 1 });
userAnalyticsSchema.index({ 'progressTimeline.date': 1 });
```

**ContentAnalytics Model** (`/skillforge-api/src/models/ContentAnalytics.js`)

Tracks analytics for learning content:

```javascript
const contentAnalyticsSchema = new mongoose.Schema({
  contentId: { type: String, required: true }, // lessonId, quizId, etc.
  contentType: { type: String, required: true }, // 'lesson', 'quiz', 'code_exercise'
  skill: { type: String, required: true },
  difficulty: { type: String, required: true },
  views: { type: Number, default: 0 },
  completions: { type: Number, default: 0 },
  averageCompletionTime: { type: Number, default: 0 }, // in seconds
  averageScore: { type: Number }, // for quizzes
  ratings: [{
    userId: { type: String, required: true },
    rating: { type: Number, required: true }, // 1-5
    feedback: { type: String }
  }],
  averageRating: { type: Number },
  dropoffPoints: { type: Map, of: Number }, // step -> count
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Indexes for efficient querying
contentAnalyticsSchema.index({ contentId: 1 });
contentAnalyticsSchema.index({ contentType: 1, skill: 1 });
contentAnalyticsSchema.index({ skill: 1, difficulty: 1 });
contentAnalyticsSchema.index({ averageRating: -1 });
```

**PlatformAnalytics Model** (`/skillforge-api/src/models/PlatformAnalytics.js`)

Tracks overall platform analytics:

```javascript
const dailyStatsSchema = new mongoose.Schema({
  date: { type: Date, required: true },
  activeUsers: { type: Number, default: 0 },
  newUsers: { type: Number, default: 0 },
  totalSessions: { type: Number, default: 0 },
  averageSessionDuration: { type: Number, default: 0 }, // in seconds
  totalLessonsCompleted: { type: Number, default: 0 },
  totalQuizzesCompleted: { type: Number, default: 0 },
  totalCodeExercisesCompleted: { type: Number, default: 0 },
  mostActiveSkill: { type: String },
  mostCompletedLesson: { type: String }, // lessonId
  deviceBreakdown: {
    desktop: { type: Number, default: 0 },
    mobile: { type: Number, default: 0 },
    tablet: { type: Number, default: 0 }
  },
  peakActiveHour: { type: Number } // 0-23
});

const platformAnalyticsSchema = new mongoose.Schema({
  dailyStats: [dailyStatsSchema],
  retentionData: [{
    cohortDate: { type: Date, required: true },
    cohortSize: { type: Number, required: true },
    retentionByDay: { type: Map, of: Number } // day -> count
  }],
  userSegments: [{
    segmentName: { type: String, required: true },
    userCount: { type: Number, required: true },
    criteria: { type: mongoose.Schema.Types.Mixed }
  }],
  updatedAt: { type: Date, default: Date.now }
});

// Indexes for efficient querying
platformAnalyticsSchema.index({ 'dailyStats.date': 1 });
platformAnalyticsSchema.index({ 'retentionData.cohortDate': 1 });
```

#### Services

**Analytics Service** (`/skillforge-api/src/services/analyticsService.js`)

Handles tracking and retrieving analytics data:

```javascript
const UserAnalytics = require('../models/UserAnalytics');
const ContentAnalytics = require('../models/ContentAnalytics');
const PlatformAnalytics = require('../models/PlatformAnalytics');
const { v4: uuidv4 } = require('uuid');

// User Analytics Functions
async function trackUserSession(userId, sessionData) {
  try {
    const sessionId = uuidv4();
    const session = {
      sessionId,
      startTime: new Date(),
      pages: [],
      deviceInfo: sessionData.deviceInfo
    };
    
    await UserAnalytics.findOneAndUpdate(
      { userId },
      { $push: { sessionData: session } },
      { upsert: true, new: true }
    );
    
    return sessionId;
  } catch (error) {
    console.error('Error tracking user session:', error);
    throw error;
  }
}

async function updateUserSession(userId, sessionId, sessionData) {
  try {
    const { endTime, duration, pages } = sessionData;
    
    await UserAnalytics.findOneAndUpdate(
      { userId, 'sessionData.sessionId': sessionId },
      { 
        $set: { 
          'sessionData.$.endTime': endTime,
          'sessionData.$.duration': duration,
          'sessionData.$.pages': pages
        }
      }
    );
  } catch (error) {
    console.error('Error updating user session:', error);
    throw error;
  }
}

async function trackLessonCompletion(userId, lessonId, lessonData) {
  try {
    const { skill, difficulty, timeSpent, score } = lessonData;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Update user analytics
    const userAnalytics = await UserAnalytics.findOne({ userId });
    
    if (!userAnalytics) {
      // Create new user analytics record if it doesn't exist
      await UserAnalytics.create({
        userId,
        learningStats: {
          totalLessonsCompleted: 1,
          lastActiveDate: new Date(),
          timeSpentBySkill: { [skill]: timeSpent },
          completionsByDifficulty: {
            [difficulty]: 1
          }
        },
        progressTimeline: [{
          date: today,
          lessonsCompleted: 1,
          skillsImproved: [{
            skill,
            strengthDelta: score ? Math.round(score / 10) : 5 // Estimate strength improvement
          }]
        }]
      });
    } else {
      // Update existing user analytics
      const existingTimeForSkill = userAnalytics.learningStats.timeSpentBySkill.get(skill) || 0;
      
      // Check if there's an entry for today in the timeline
      const todayTimelineIndex = userAnalytics.progressTimeline.findIndex(
        entry => entry.date.toDateString() === today.toDateString()
      );
      
      if (todayTimelineIndex >= 0) {
        // Update today's entry
        await UserAnalytics.findOneAndUpdate(
          { userId, 'progressTimeline.date': today },
          { 
            $inc: { 
              'learningStats.totalLessonsCompleted': 1,
              [`learningStats.completionsByDifficulty.${difficulty}`]: 1,
              'progressTimeline.$.lessonsCompleted': 1
            },
            $set: {
              'learningStats.lastActiveDate': new Date(),
              [`learningStats.timeSpentBySkill.${skill}`]: existingTimeForSkill + timeSpent
            },
            $push: {
              'progressTimeline.$.skillsImproved': {
                skill,
                strengthDelta: score ? Math.round(score / 10) : 5
              }
            }
          }
        );
      } else {
        // Add new entry for today
        await UserAnalytics.findOneAndUpdate(
          { userId },
          { 
            $inc: { 
              'learningStats.totalLessonsCompleted': 1,
              [`learningStats.completionsByDifficulty.${difficulty}`]: 1
            },
            $set: {
              'learningStats.lastActiveDate': new Date(),
              [`learningStats.timeSpentBySkill.${skill}`]: existingTimeForSkill + timeSpent
            },
            $push: {
              'progressTimeline': {
                date: today,
                lessonsCompleted: 1,
                quizzesCompleted: 0,
                codeExercisesCompleted: 0,
                pointsEarned: 0,
                skillsImproved: [{
                  skill,
                  strengthDelta: score ? Math.round(score / 10) : 5
                }]
              }
            }
          }
        );
      }
      
      // Update streak
      const lastActiveDate = userAnalytics.learningStats.lastActiveDate;
      if (lastActiveDate) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        yesterday.setHours(0, 0, 0, 0);
        
        const lastActiveDay = new Date(lastActiveDate);
        lastActiveDay.setHours(0, 0, 0, 0);
        
        if (lastActiveDay.getTime() === yesterday.getTime()) {
          // User was active yesterday, increment streak
          await UserAnalytics.findOneAndUpdate(
            { userId },
            { $inc: { 'learningStats.streakDays': 1 } }
          );
        } else if (lastActiveDay.getTime() < yesterday.getTime()) {
          // User missed a day, reset streak to 1
          await UserAnalytics.findOneAndUpdate(
            { userId },
            { $set: { 'learningStats.streakDays': 1 } }
          );
        }
        // If lastActiveDay is today, streak remains unchanged
      } else {
        // First activity, set streak to 1
        await UserAnalytics.findOneAndUpdate(
          { userId },
          { $set: { 'learningStats.streakDays': 1 } }
        );
      }
    }
    
    // Update content analytics
    await ContentAnalytics.findOneAndUpdate(
      { contentId: lessonId },
      { 
        $inc: { 
          completions: 1,
          views: 1
        },
        $set: {
          contentType: 'lesson',
          skill,
          difficulty,
          updatedAt: new Date()
        }
      },
      { upsert: true }
    );
    
    // Update average completion time
    const contentAnalytics = await ContentAnalytics.findOne({ contentId: lessonId });
    const newAvgTime = contentAnalytics.averageCompletionTime === 0 ?
      timeSpent :
      (contentAnalytics.averageCompletionTime * (contentAnalytics.completions - 1) + timeSpent) / contentAnalytics.completions;
    
    await ContentAnalytics.findOneAndUpdate(
      { contentId: lessonId },
      { $set: { averageCompletionTime: newAvgTime } }
    );
    
    // Update platform analytics
    await PlatformAnalytics.findOneAndUpdate(
      { 'dailyStats.date': today },
      { $inc: { 'dailyStats.$.totalLessonsCompleted': 1 } }
    );
    
    return true;
  } catch (error) {
    console.error('Error tracking lesson completion:', error);
    throw error;
  }
}

async function trackQuizCompletion(userId, quizId, quizData) {
  try {
    const { skill, difficulty, timeSpent, score } = quizData;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Similar implementation to trackLessonCompletion but for quizzes
    // Update user analytics, content analytics, and platform analytics
    // ...
    
    return true;
  } catch (error) {
    console.error('Error tracking quiz completion:', error);
    throw error;
  }
}

async function getUserProgressStats(userId, timeframe = 'all') {
  try {
    const userAnalytics = await UserAnalytics.findOne({ userId });
    if (!userAnalytics) {
      return null;
    }
    
    // Basic stats from learningStats
    const stats = {
      totalLessonsCompleted: userAnalytics.learningStats.totalLessonsCompleted,
      totalQuizzesCompleted: userAnalytics.learningStats.totalQuizzesCompleted,
      totalCodeExercisesCompleted: userAnalytics.learningStats.totalCodeExercisesCompleted,
      averageQuizScore: userAnalytics.learningStats.averageQuizScore,
      streakDays: userAnalytics.learningStats.streakDays,
      timeSpentBySkill: Object.fromEntries(userAnalytics.learningStats.timeSpentBySkill),
      completionsByDifficulty: userAnalytics.learningStats.completionsByDifficulty
    };
    
    // Filter timeline data based on timeframe
    let filteredTimeline = userAnalytics.progressTimeline;
    const now = new Date();
    
    if (timeframe === 'week') {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      filteredTimeline = filteredTimeline.filter(entry => entry.date >= weekAgo);
    } else if (timeframe === 'month') {
      const monthAgo = new Date();
      monthAgo.setMonth(monthAgo.getMonth() - 1);
      filteredTimeline = filteredTimeline.filter(entry => entry.date >= monthAgo);
    } else if (timeframe === 'year') {
      const yearAgo = new Date();
      yearAgo.setFullYear(yearAgo.getFullYear() - 1);
      filteredTimeline = filteredTimeline.filter(entry => entry.date >= yearAgo);
    }
    
    // Calculate progress over time
    stats.progressOverTime = filteredTimeline.map(entry => ({
      date: entry.date,
      lessonsCompleted: entry.lessonsCompleted,
      quizzesCompleted: entry.quizzesCompleted,
      codeExercisesCompleted: entry.codeExercisesCompleted,
      pointsEarned: entry.pointsEarned
    }));
    
    // Calculate skill improvement
    const skillImprovementMap = new Map();
    
    filteredTimeline.forEach(entry => {
      entry.skillsImproved.forEach(improvement => {
        const currentValue = skillImprovementMap.get(improvement.skill) || 0;
        skillImprovementMap.set(improvement.skill, currentValue + improvement.strengthDelta);
      });
    });
    
    stats.skillImprovement = Array.from(skillImprovementMap.entries()).map(([skill, delta]) => ({
      skill,
      improvement: delta
    }));
    
    // Calculate activity heatmap (days active in the period)
    const activityDays = new Set(filteredTimeline.map(entry => entry.date.toDateString()));
    stats.activityHeatmap = Array.from(activityDays).map(dateStr => new Date(dateStr));
    
    return stats;
  } catch (error) {
    console.error('Error getting user progress stats:', error);
    throw error;
  }
}

// Content Analytics Functions
async function getContentPerformance(filters = {}) {
  try {
    const query = {};
    
    if (filters.contentType) query.contentType = filters.contentType;
    if (filters.skill) query.skill = filters.skill;
    if (filters.difficulty) query.difficulty = filters.difficulty;
    
    const contentAnalytics = await ContentAnalytics.find(query);
    
    return contentAnalytics.map(content => ({
      contentId: content.contentId,
      contentType: content.contentType,
      skill: content.skill,
      difficulty: content.difficulty,
      views: content.views,
      completions: content.completions,
      completionRate: content.views > 0 ? (content.completions / content.views) * 100 : 0,
      averageCompletionTime: content.averageCompletionTime,
      averageScore: content.averageScore,
      averageRating: content.averageRating,
      ratingCount: content.ratings.length
    }));
  } catch (error) {
    console.error('Error getting content performance:', error);
    throw error;
  }
}

async function rateContent(userId, contentId, rating, feedback = '') {
  try {
    // Check if user has already rated this content
    const content = await ContentAnalytics.findOne({
      contentId,
      'ratings.userId': userId
    });
    
    if (content) {
      // Update existing rating
      await ContentAnalytics.findOneAndUpdate(
        { contentId, 'ratings.userId': userId },
        { 
          $set: { 
            'ratings.$.rating': rating,
            'ratings.$.feedback': feedback
          }
        }
      );
    } else {
      // Add new rating
      await ContentAnalytics.findOneAndUpdate(
        { contentId },
        { 
          $push: { 
            ratings: {
              userId,
              rating,
              feedback
            }
          }
        },
        { upsert: true }
      );
    }
    
    // Recalculate average rating
    const updatedContent = await ContentAnalytics.findOne({ contentId });
    const totalRatings = updatedContent.ratings.length;
    const ratingSum = updatedContent.ratings.reduce((sum, r) => sum + r.rating, 0);
    const averageRating = totalRatings > 0 ? ratingSum / totalRatings : 0;
    
    await ContentAnalytics.findOneAndUpdate(
      { contentId },
      { $set: { averageRating } }
    );
    
    return { averageRating, totalRatings };
  } catch (error) {
    console.error('Error rating content:', error);
    throw error;
  }
}

// Platform Analytics Functions
async function getDailyStats(startDate, endDate) {
  try {
    const platformAnalytics = await PlatformAnalytics.findOne({
      'dailyStats.date': {
        $gte: startDate,
        $lte: endDate
      }
    });
    
    if (!platformAnalytics) {
      return [];
    }
    
    return platformAnalytics.dailyStats.filter(stat => 
      stat.date >= startDate && stat.date <= endDate
    );
  } catch (error) {
    console.error('Error getting daily stats:', error);
    throw error;
  }
}

async function getRetentionData(cohortDate) {
  try {
    const query = cohortDate ? 
      { 'retentionData.cohortDate': cohortDate } : 
      {};
    
    const platformAnalytics = await PlatformAnalytics.findOne(query);
    
    if (!platformAnalytics) {
      return [];
    }
    
    return cohortDate ?
      platformAnalytics.retentionData.filter(data => data.cohortDate.toDateString() === cohortDate.toDateString()) :
      platformAnalytics.retentionData;
  } catch (error) {
    console.error('Error getting retention data:', error);
    throw error;
  }
}

module.exports = {
  // User analytics
  trackUserSession,
  updateUserSession,
  trackLessonCompletion,
  trackQuizCompletion,
  getUserProgressStats,
  
  // Content analytics
  getContentPerformance,
  rateContent,
  
  // Platform analytics
  getDailyStats,
  getRetentionData
};
```

**Reporting Service** (`/skillforge-api/src/services/reportingService.js`)

Generates reports from analytics data:

```javascript
const UserAnalytics = require('../models/UserAnalytics');
const ContentAnalytics = require('../models/ContentAnalytics');
const PlatformAnalytics = require('../models/PlatformAnalytics');
const UserProfile = require('../models/UserProfile');
const SkillMemoryBank = require('../models/SkillMemoryBank');

async function generateUserProgressReport(userId) {
  try {
    // Get user analytics data
    const userAnalytics = await UserAnalytics.findOne({ userId });
    if (!userAnalytics) {
      throw new Error('User analytics not found');
    }
    
    // Get user profile
    const userProfile = await UserProfile.findOne({ userId });
    if (!userProfile) {
      throw new Error('User profile not found');
    }
    
    // Get skill memory bank data
    const skillMemory = await SkillMemoryBank.findOne({ userId });
    
    // Calculate learning time distribution
    const timeSpentBySkill = userAnalytics.learningStats.timeSpentBySkill;
    const totalTimeSpent = Array.from(timeSpentBySkill.values()).reduce((sum, time) => sum + time, 0);
    
    const timeDistribution = Array.from(timeSpentBySkill.entries()).map(([skill, time]) => ({
      skill,
      timeSpent: time,
      percentage: totalTimeSpent > 0 ? (time / totalTimeSpent) * 100 : 0
    }));
    
    // Calculate skill proficiency
    const skillProficiency = [];
    
    if (skillMemory) {
      skillMemory.topics.forEach(topic => {
        skillProficiency.push({
          skill: topic.topicName,
          proficiency: topic.strengthLevel,
          lastUpdated: topic.lastUpdated
        });
      });
    }
    
    // Calculate progress over time
    const progressByMonth = {};
    
    userAnalytics.progressTimeline.forEach(entry => {
      const monthYear = `${entry.date.getMonth() + 1}/${entry.date.getFullYear()}`;
      
      if (!progressByMonth[monthYear]) {
        progressByMonth[monthYear] = {
          lessonsCompleted: 0,
          quizzesCompleted: 0,
          codeExercisesCompleted: 0,
          pointsEarned: 0
        };
      }
      
      progressByMonth[monthYear].lessonsCompleted += entry.lessonsCompleted;
      progressByMonth[monthYear].quizzesCompleted += entry.quizzesCompleted;
      progressByMonth[monthYear].codeExercisesCompleted += entry.codeExercisesCompleted;
      progressByMonth[monthYear].pointsEarned += entry.pointsEarned;
    });
    
    // Format the report
    const report = {
      user: {
        userId,
        fullName: userProfile.fullName,
        email: userProfile.email,
        joinDate: userProfile.createdAt
      },
      summary: {
        totalLessonsCompleted: userAnalytics.learningStats.totalLessonsCompleted,
        totalQuizzesCompleted: userAnalytics.learningStats.totalQuizzesCompleted,
        totalCodeExercisesCompleted: userAnalytics.learningStats.totalCodeExercisesCompleted,
        averageQuizScore: userAnalytics.learningStats.averageQuizScore,
        currentStreak: userAnalytics.learningStats.streakDays,
        totalTimeSpent: totalTimeSpent, // in seconds
        lastActiveDate: userAnalytics.learningStats.lastActiveDate
      },
      timeDistribution,
      skillProficiency,
      progressByMonth: Object.entries(progressByMonth).map(([month, data]) => ({
        month,
        ...data
      })),
      completionsByDifficulty: userAnalytics.learningStats.completionsByDifficulty
    };
    
    return report;
  } catch (error) {
    console.error('Error generating user progress report:', error);
    throw error;
  }
}

async function generateContentEffectivenessReport(filters = {}) {
  try {
    const query = {};
    
    if (filters.contentType) query.contentType = filters.contentType;
    if (filters.skill) query.skill = filters.skill;
    if (filters.difficulty) query.difficulty = filters.difficulty;
    
    const contentAnalytics = await ContentAnalytics.find(query);
    
    // Group content by skill
    const contentBySkill = {};
    
    contentAnalytics.forEach(content => {
      if (!contentBySkill[content.skill]) {
        contentBySkill[content.skill] = [];
      }
      
      contentBySkill[content.skill].push({
        contentId: content.contentId,
        contentType: content.contentType,
        difficulty: content.difficulty,
        views: content.views,
        completions: content.completions,
        completionRate: content.views > 0 ? (content.completions / content.views) * 100 : 0,
        averageCompletionTime: content.averageCompletionTime,
        averageScore: content.averageScore,
        averageRating: content.averageRating,
        ratingCount: content.ratings.length
      });
    });
    
    // Calculate skill-level metrics
    const skillMetrics = Object.entries(contentBySkill).map(([skill, contents]) => {
      const totalViews = contents.reduce((sum, content) => sum + content.views, 0);
      const totalCompletions = contents.reduce((sum, content) => sum + content.completions, 0);
      const weightedAvgRating = contents.reduce((sum, content) => {
        return sum + (content.averageRating || 0) * (content.ratingCount || 0);
      }, 0) / contents.reduce((sum, content) => sum + (content.ratingCount || 0), 0) || 0;
      
      return {
        skill,
        contentCount: contents.length,
        totalViews,
        totalCompletions,
        overallCompletionRate: totalViews > 0 ? (totalCompletions / totalViews) * 100 : 0,
        averageRating: weightedAvgRating,
        contents: contents.sort((a, b) => b.completions - a.completions) // Sort by popularity
      };
    });
    
    // Format the report
    const report = {
      summary: {
        totalContent: contentAnalytics.length,
        totalViews: contentAnalytics.reduce((sum, content) => sum + content.views, 0),
        totalCompletions: contentAnalytics.reduce((sum, content) => sum + content.completions, 0),
        averageRating: contentAnalytics.reduce((sum, content) => sum + (content.averageRating || 0), 0) / contentAnalytics.length || 0
      },
      skillMetrics,
      topPerforming: contentAnalytics
        .sort((a, b) => (b.completions / Math.max(b.views, 1)) - (a.completions / Math.max(a.views, 1)))
        .slice(0, 10)
        .map(content => ({
          contentId: content.contentId,
          contentType: content.contentType,
          skill: content.skill,
          difficulty: content.difficulty,
          completionRate: content.views > 0 ? (content.completions / content.views) * 100 : 0,
          averageRating: content.averageRating
        })),
      underPerforming: contentAnalytics
        .filter(content => content.views > 10) // Only consider content with sufficient views
        .sort((a, b) => (a.completions / Math.max(a.views, 1)) - (b.completions / Math.max(b.views, 1)))
        .slice(0, 10)
        .map(content => ({
          contentId: content.contentId,
          contentType: content.contentType,
          skill: content.skill,
          difficulty: content.difficulty,
          completionRate: content.views > 0 ? (content.completions / content.views) * 100 : 0,
          averageRating: content.averageRating
        }))
    };
    
    return report;
  } catch (error) {
    console.error('Error generating content effectiveness report:', error);
    throw error;
  }
}

async function generatePlatformUsageReport(startDate, endDate) {
  try {
    // Get platform analytics for the date range
    const platformAnalytics = await PlatformAnalytics.findOne({
      'dailyStats.date': {
        $gte: startDate,
        $lte: endDate
      }
    });
    
    if (!platformAnalytics) {
      return null;
    }
    
    const dailyStats = platformAnalytics.dailyStats.filter(stat => 
      stat.date >= startDate && stat.date <= endDate
    );
    
    // Calculate user metrics
    const totalActiveUsers = new Set();
    let totalNewUsers = 0;
    let totalSessions = 0;
    
    const userMetricsByDay = dailyStats.map(stat => {
      totalNewUsers += stat.newUsers;
      totalSessions += stat.totalSessions;
      
      return {
        date: stat.date,
        activeUsers: stat.activeUsers,
        newUsers: stat.newUsers,
        sessions: stat.totalSessions,
        avgSessionDuration: stat.averageSessionDuration
      };
    });
    
    // Calculate content engagement metrics
    let totalLessonsCompleted = 0;
    let totalQuizzesCompleted = 0;
    let totalCodeExercisesCompleted = 0;
    
    const contentMetricsByDay = dailyStats.map(stat => {
      totalLessonsCompleted += stat.totalLessonsCompleted;
      totalQuizzesCompleted += stat.totalQuizzesCompleted;
      totalCodeExercisesCompleted += stat.totalCodeExercisesCompleted;
      
      return {
        date: stat.date,
        lessonsCompleted: stat.totalLessonsCompleted,
        quizzesCompleted: stat.totalQuizzesCompleted,
        codeExercisesCompleted: stat.totalCodeExercisesCompleted,
        mostActiveSkill: stat.mostActiveSkill,
        mostCompletedLesson: stat.mostCompletedLesson
      };
    });
    
    // Calculate device usage
    const deviceUsage = {
      desktop: 0,
      mobile: 0,
      tablet: 0
    };
    
    dailyStats.forEach(stat => {
      deviceUsage.desktop += stat.deviceBreakdown.desktop;
      deviceUsage.mobile += stat.deviceBreakdown.mobile;
      deviceUsage.tablet += stat.deviceBreakdown.tablet;
    });
    
    const totalDeviceCount = deviceUsage.desktop + deviceUsage.mobile + deviceUsage.tablet;
    
    // Calculate peak usage hours
    const hourCounts = new Array(24).fill(0);
    
    dailyStats.forEach(stat => {
      if (stat.peakActiveHour !== undefined) {
        hourCounts[stat.peakActiveHour]++;
      }
    });
    
    const peakHour = hourCounts.indexOf(Math.max(...hourCounts));
    
    // Format the report
    const report = {
      dateRange: {
        startDate,
        endDate
      },
      summary: {
        totalDays: dailyStats.length,
        totalNewUsers,
        totalSessions,
        totalLessonsCompleted,
        totalQuizzesCompleted,
        totalCodeExercisesCompleted,
        avgDailyActiveUsers: dailyStats.reduce((sum, stat) => sum + stat.activeUsers, 0) / dailyStats.length || 0
      },
      userMetricsByDay,
      contentMetricsByDay,
      deviceUsage: {
        desktop: {
          count: deviceUsage.desktop,
          percentage: totalDeviceCount > 0 ? (deviceUsage.desktop / totalDeviceCount) * 100 : 0
        },
        mobile: {
          count: deviceUsage.mobile,
          percentage: totalDeviceCount > 0 ? (deviceUsage.mobile / totalDeviceCount) * 100 : 0
        },
        tablet: {
          count: deviceUsage.tablet,
          percentage: totalDeviceCount > 0 ? (deviceUsage.tablet / totalDeviceCount) * 100 : 0
        }
      },
      peakUsage: {
        hour: peakHour,
        formattedHour: `${peakHour % 12 || 12}${peakHour < 12 ? 'AM' : 'PM'}`
      }
    };
    
    // Add retention data if available
    if (platformAnalytics.retentionData && platformAnalytics.retentionData.length > 0) {
      // Filter retention data for cohorts within the date range
      const relevantRetentionData = platformAnalytics.retentionData.filter(data => 
        data.cohortDate >= startDate && data.cohortDate <= endDate
      );
      
      if (relevantRetentionData.length > 0) {
        report.retentionData = relevantRetentionData.map(data => ({
          cohortDate: data.cohortDate,
          cohortSize: data.cohortSize,
          retentionByDay: Object.fromEntries(data.retentionByDay)
        }));
      }
    }
    
    return report;
  } catch (error) {
    console.error('Error generating platform usage report:', error);
    throw error;
  }
}

module.exports = {
  generateUserProgressReport,
  generateContentEffectivenessReport,
  generatePlatformUsageReport
};
```

### Frontend Implementation

#### Components

1. **User Dashboard Analytics** (`/skillforge-ui/src/app/features/dashboard/analytics`)
   - Progress charts and visualizations
   - Skill proficiency radar charts
   - Learning time distribution
   - Streak calendar

2. **Learning Reports** (`/skillforge-ui/src/app/features/reports`)
   - Detailed progress reports
   - Skill development tracking
   - Performance analytics
   - Downloadable reports

3. **Admin Analytics Dashboard** (`/skillforge-ui/src/app/features/admin/analytics`)
   - Platform usage metrics
   - Content effectiveness analysis
   - User engagement statistics
   - Retention analysis

#### Services

**Analytics Service** (`/skillforge-ui/src/app/core/services/analytics.service.ts`)

Handles analytics API calls and data processing:

```typescript
@Injectable({
  providedIn: 'root'
})
export class AnalyticsService {
  constructor(private http: HttpClient) {}

  // User Analytics
  trackPageView(pagePath: string) {
    return this.http.post('/api/analytics/page-view', { pagePath });
  }

  startSession(deviceInfo: any) {
    return this.http.post('/api/analytics/session/start', { deviceInfo });
  }

  endSession(sessionId: string, sessionData: any) {
    return this.http.post(`/api/analytics/session/${sessionId}/end`, sessionData);
  }

  getUserProgressStats(timeframe: string = 'all') {
    return this.http.get(`/api/analytics/user/progress?timeframe=${timeframe}`);
  }

  // Content Analytics
  rateContent(contentId: string, rating: number, feedback: string = '') {
    return this.http.post(`/api/analytics/content/${contentId}/rate`, { rating, feedback });
  }

  // Reports
  getUserProgressReport() {
    return this.http.get('/api/reports/user/progress');
  }

  // Admin Analytics
  getContentEffectivenessReport(filters: any = {}) {
    let params = new HttpParams();
    
    if (filters.contentType) params = params.set('contentType', filters.contentType);
    if (filters.skill) params = params.set('skill', filters.skill);
    if (filters.difficulty) params = params.set('difficulty', filters.difficulty);
    
    return this.http.get('/api/reports/content/effectiveness', { params });
  }

  getPlatformUsageReport(startDate: Date, endDate: Date) {
    const params = new HttpParams()
      .set('startDate', startDate.toISOString())
      .set('endDate', endDate.toISOString());
    
    return this.http.get('/api/reports/platform/usage', { params });
  }
}
```

**Chart Service** (`/skillforge-ui/src/app/core/services/chart.service.ts`)

Handles chart data processing and visualization:

```typescript
@Injectable({
  providedIn: 'root'
})
export class ChartService {
  constructor() {}

  // Progress Chart
  prepareProgressChartData(progressData: any[]) {
    const labels = progressData.map(item => item.date);
    
    const datasets = [
      {
        label: 'Lessons Completed',
        data: progressData.map(item => item.lessonsCompleted),
        backgroundColor: 'rgba(54, 162, 235, 0.2)',
        borderColor: 'rgba(54, 162, 235, 1)',
        borderWidth: 1
      },
      {
        label: 'Quizzes Completed',
        data: progressData.map(item => item.quizzesCompleted),
        backgroundColor: 'rgba(255, 206, 86, 0.2)',
        borderColor: 'rgba(255, 206, 86, 1)',
        borderWidth: 1
      },
      {
        label: 'Code Exercises Completed',
        data: progressData.map(item => item.codeExercisesCompleted),
        backgroundColor: 'rgba(75, 192, 192, 0.2)',
        borderColor: 'rgba(75, 192, 192, 1)',
        borderWidth: 1
      }
    ];
    
    return { labels, datasets };
  }

  // Skill Radar Chart
  prepareSkillRadarData(skillData: any[]) {
    const labels = skillData.map(item => item.skill);
    
    const datasets = [
      {
        label: 'Skill Proficiency',
        data: skillData.map(item => item.proficiency),
        backgroundColor: 'rgba(153, 102, 255, 0.2)',
        borderColor: 'rgba(153, 102, 255, 1)',
        borderWidth: 1
      }
    ];
    
    return { labels, datasets };
  }

  // Time Distribution Pie Chart
  prepareTimeDistributionData(timeData: any[]) {
    const labels = timeData.map(item => item.skill);
    
    const datasets = [
      {
        data: timeData.map(item => item.timeSpent),
        backgroundColor: [
          'rgba(255, 99, 132, 0.2)',
          'rgba(54, 162, 235, 0.2)',
          'rgba(255, 206, 86, 0.2)',
          'rgba(75, 192, 192, 0.2)',
          'rgba(153, 102, 255, 0.2)',
          'rgba(255, 159, 64, 0.2)'
        ],
        borderColor: [
          'rgba(255, 99, 132, 1)',
          'rgba(54, 162, 235, 1)',
          'rgba(255, 206, 86, 1)',
          'rgba(75, 192, 192, 1)',
          'rgba(153, 102, 255, 1)',
          'rgba(255, 159, 64, 1)'
        ],
        borderWidth: 1
      }
    ];
    
    return { labels, datasets };
  }

  // User Retention Chart
  prepareRetentionChartData(retentionData: any[]) {
    const cohorts = retentionData.map(item => item.cohortDate);
    const days = Object.keys(retentionData[0]?.retentionByDay || {}).sort((a, b) => Number(a) - Number(b));
    
    const datasets = cohorts.map((cohort, index) => {
      const data = days.map(day => {
        const retention = retentionData[index].retentionByDay[day];
        return (retention / retentionData[index].cohortSize) * 100;
      });
      
      return {
        label: new Date(cohort).toLocaleDateString(),
        data,
        borderColor: this.getColorByIndex(index),
        fill: false
      };
    });
    
    return {
      labels: days.map(day => `Day ${day}`),
      datasets
    };
  }

  // Helper method to generate colors
  private getColorByIndex(index: number) {
    const colors = [
      'rgba(255, 99, 132, 1)',
      'rgba(54, 162, 235, 1)',
      'rgba(255, 206, 86, 1)',
      'rgba(75, 192, 192, 1)',
      'rgba(153, 102, 255, 1)',
      'rgba(255, 159, 64, 1)'
    ];
    
    return colors[index % colors.length];
  }
}
```

**Report Service** (`/skillforge-ui/src/app/core/services/report.service.ts`)

Handles report generation and export:

```typescript
@Injectable({
  providedIn: 'root'
})
export class ReportService {
  constructor(private http: HttpClient) {}

  getUserProgressReport() {
    return this.http.get('/api/reports/user/progress');
  }

  exportUserProgressReport(format: string = 'pdf') {
    return this.http.get(`/api/reports/user/progress/export?format=${format}`, {
      responseType: 'blob'
    });
  }

  getContentEffectivenessReport(filters: any = {}) {
    let params = new HttpParams();
    
    if (filters.contentType) params = params.set('contentType', filters.contentType);
    if (filters.skill) params = params.set('skill', filters.skill);
    if (filters.difficulty) params = params.set('difficulty', filters.difficulty);
    
    return this.http.get('/api/reports/content/effectiveness', { params });
  }

  exportContentEffectivenessReport(filters: any = {}, format: string = 'pdf') {
    let params = new HttpParams()
      .set('format', format);
    
    if (filters.contentType) params = params.set('contentType', filters.contentType);
    if (filters.skill) params = params.set('skill', filters.skill);
    if (filters.difficulty) params = params.set('difficulty', filters.difficulty);
    
    return this.http.get('/api/reports/content/effectiveness/export', {
      params,
      responseType: 'blob'
    });
  }

  getPlatformUsageReport(startDate: Date, endDate: Date) {
    const params = new HttpParams()
      .set('startDate', startDate.toISOString())
      .set('endDate', endDate.toISOString());
    
    return this.http.get('/api/reports/platform/usage', { params });
  }

  exportPlatformUsageReport(startDate: Date, endDate: Date, format: string = 'pdf') {
    const params = new HttpParams()
      .set('startDate', startDate.toISOString())
      .set('endDate', endDate.toISOString())
      .set('format', format);
    
    return this.http.get('/api/reports/platform/usage/export', {
      params,
      responseType: 'blob'
    });
  }

  downloadReport(blob: Blob, filename: string) {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  }
}
```

## Flow Diagram

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│ User Activity   │────▶│ Analytics       │────▶│ Data Storage    │
│ (Lessons, Quiz) │     │ Service         │     │ (MongoDB)       │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                                        │
                                                        ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│ Visualization   │◀────│ Data Processing │◀────│ Reporting       │
│ (Charts, Graphs)│     │ & Aggregation   │     │ Service         │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        │
        ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│ User Dashboard  │     │ Admin Dashboard │     │ Exportable      │
│ (Progress View) │     │ (Platform View) │     │ Reports (PDF)   │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

## Enhancement Recommendations

### Backend Enhancements

1. **Advanced Learning Analytics Engine**
   - Implement machine learning algorithms to identify learning patterns
   - Add predictive analytics for user progress and potential drop-off points
   - Create personalized insights based on learning behavior

```javascript
// Add to analyticsService.js
async function generateLearningInsights(userId) {
  try {
    // Get user analytics data
    const userAnalytics = await UserAnalytics.findOne({ userId });
    if (!userAnalytics) {
      throw new Error('User analytics not found');
    }
    
    // Get skill memory bank data
    const skillMemory = await SkillMemoryBank.findOne({ userId });
    if (!skillMemory) {
      throw new Error('Skill memory bank not found');
    }
    
    const insights = [];
    
    // Insight 1: Optimal learning time
    const sessions = userAnalytics.sessionData;
    const sessionsByHour = new Array(24).fill(0);
    const scoresByHour = new Array(24).fill(0);
    const countsByHour = new Array(24).fill(0);
    
    sessions.forEach(session => {
      if (session.startTime) {
        const hour = new Date(session.startTime).getHours();
        sessionsByHour[hour]++;
      }
    });
    
    // Analyze quiz scores by hour of day
    skillMemory.topics.forEach(topic => {
      topic.interactions.forEach(interaction => {
        if (interaction.score !== undefined) {
          const hour = new Date(interaction.timestamp).getHours();
          scoresByHour[hour] += interaction.score;
          countsByHour[hour]++;
        }
      });
    });
    
    // Calculate average scores by hour
    const avgScoresByHour = scoresByHour.map((score, index) => 
      countsByHour[index] > 0 ? score / countsByHour[index] : 0
    );
    
    // Find peak performance hours (top 3)
    const topHours = avgScoresByHour
      .map((score, hour) => ({ hour, score }))
      .filter(item => countsByHour[item.hour] >= 3) // Require at least 3 data points
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
    
    if (topHours.length > 0) {
      insights.push({
        type: 'optimal_time',
        title: 'Your Optimal Learning Times',
        description: `You tend to perform best during these hours: ${topHours
          .map(h => `${h.hour % 12 || 12}${h.hour < 12 ? 'AM' : 'PM'}`)
          .join(', ')}`,
        data: {
          topHours: topHours.map(h => ({
            hour: h.hour,
            formattedHour: `${h.hour % 12 || 12}${h.hour < 12 ? 'AM' : 'PM'}`,
            score: h.score
          }))
        }
      });
    }
    
    // Insight 2: Learning pattern analysis
    const weekdayActivity = new Array(7).fill(0);
    const weekdayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    
    userAnalytics.progressTimeline.forEach(day => {
      const weekday = new Date(day.date).getDay();
      weekdayActivity[weekday] += day.lessonsCompleted + day.quizzesCompleted + day.codeExercisesCompleted;
    });
    
    const mostActiveDay = weekdayActivity.indexOf(Math.max(...weekdayActivity));
    const leastActiveDay = weekdayActivity.indexOf(Math.min(...weekdayActivity));
    
    insights.push({
      type: 'activity_pattern',
      title: 'Your Learning Schedule',
      description: `You're most active on ${weekdayNames[mostActiveDay]} and least active on ${weekdayNames[leastActiveDay]}.`,
      data: {
        weekdayActivity: weekdayActivity.map((count, index) => ({
          day: weekdayNames[index],
          count
        })),
        mostActiveDay: weekdayNames[mostActiveDay],
        leastActiveDay: weekdayNames[leastActiveDay]
      }
    });
    
    // Insight 3: Skill improvement velocity
    const skillVelocity = new Map();
    
    // Group timeline entries by month
    const timelineByMonth = {};
    userAnalytics.progressTimeline.forEach(entry => {
      const monthYear = `${entry.date.getMonth() + 1}/${entry.date.getFullYear()}`;
      
      if (!timelineByMonth[monthYear]) {
        timelineByMonth[monthYear] = [];
      }
      
      timelineByMonth[monthYear].push(entry);
    });
    
    // Calculate skill improvement by month
    Object.entries(timelineByMonth).forEach(([month, entries]) => {
      const skillImprovementMap = new Map();
      
      entries.forEach(entry => {
        entry.skillsImproved.forEach(improvement => {
          const currentValue = skillImprovementMap.get(improvement.skill) || 0;
          skillImprovementMap.set(improvement.skill, currentValue + improvement.strengthDelta);
        });
      });
      
      // Store monthly improvement for each skill
      skillImprovementMap.forEach((improvement, skill) => {
        if (!skillVelocity.has(skill)) {
          skillVelocity.set(skill, []);
        }
        
        skillVelocity.get(skill).push({
          month,
          improvement
        });
      });
    });
    
    // Calculate velocity (rate of improvement)
    const skillGrowthRates = [];
    
    skillVelocity.forEach((monthlyData, skill) => {
      if (monthlyData.length >= 2) {
        const totalImprovement = monthlyData.reduce((sum, data) => sum + data.improvement, 0);
        const monthsCount = monthlyData.length;
        const growthRate = totalImprovement / monthsCount;
        
        skillGrowthRates.push({
          skill,
          growthRate,
          totalImprovement
        });
      }
    });
    
    // Find fastest and slowest improving skills
    if (skillGrowthRates.length > 0) {
      skillGrowthRates.sort((a, b) => b.growthRate - a.growthRate);
      
      const fastestSkill = skillGrowthRates[0];
      const slowestSkill = skillGrowthRates[skillGrowthRates.length - 1];
      
      insights.push({
        type: 'skill_velocity',
        title: 'Your Learning Velocity',
        description: `You're making the fastest progress in ${fastestSkill.skill} (${fastestSkill.growthRate.toFixed(1)} points/month) and slower progress in ${slowestSkill.skill} (${slowestSkill.growthRate.toFixed(1)} points/month).`,
        data: {
          skillGrowthRates,
          fastestSkill,
          slowestSkill
        }
      });
    }
    
    // Insight 4: Learning style detection
    const lessonTypes = {
      text: 0,
      quiz: 0,
      code: 0
    };
    
    // Analyze completion rates by content type
    const contentAnalytics = await ContentAnalytics.find({
      'ratings.userId': userId
    });
    
    contentAnalytics.forEach(content => {
      const userRating = content.ratings.find(r => r.userId === userId);
      if (userRating && userRating.rating >= 4) { // User rated content highly
        lessonTypes[content.contentType]++;
      }
    });
    
    // Determine preferred learning style
    const totalRatings = lessonTypes.text + lessonTypes.quiz + lessonTypes.code;
    
    if (totalRatings >= 5) { // Ensure enough data points
      const preferredStyle = Object.entries(lessonTypes)
        .sort((a, b) => b[1] - a[1])
        .map(([type, count]) => ({
          type,
          percentage: (count / totalRatings) * 100
        }));
      
      insights.push({
        type: 'learning_style',
        title: 'Your Learning Style',
        description: `You seem to prefer ${preferredStyle[0].type} content (${preferredStyle[0].percentage.toFixed(0)}% of your highly-rated content).`,
        data: {
          preferredStyle
        }
      });
    }
    
    return insights;
  } catch (error) {
    console.error('Error generating learning insights:', error);
    throw error;
  }
}
```

2. **Real-time Analytics Dashboard**
   - Implement WebSocket connections for live analytics updates
   - Create real-time monitoring of platform usage and user activity
   - Develop anomaly detection for unusual patterns or potential issues

```javascript
// Add to analyticsService.js
const WebSocket = require('ws');
let wss;

function initializeRealTimeAnalytics(server) {
  wss = new WebSocket.Server({ server });
  
  wss.on('connection', (ws) => {
    ws.on('message', (message) => {
      const data = JSON.parse(message);
      
      if (data.type === 'subscribe') {
        ws.subscriptions = data.channels || [];
      }
    });
  });
  
  // Set up periodic updates
  setInterval(async () => {
    try {
      // Get current active users count
      const activeUserCount = await UserAnalytics.countDocuments({
        'learningStats.lastActiveDate': { $gte: new Date(Date.now() - 15 * 60 * 1000) } // Active in last 15 minutes
      });
      
      // Get today's lesson completions
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const todayStats = await PlatformAnalytics.findOne({
        'dailyStats.date': today
      }, { 'dailyStats.$': 1 });
      
      const stats = {
        timestamp: new Date(),
        activeUsers: activeUserCount,
        todayLessonsCompleted: todayStats?.dailyStats[0]?.totalLessonsCompleted || 0,
        todayQuizzesCompleted: todayStats?.dailyStats[0]?.totalQuizzesCompleted || 0
      };
      
      broadcastToChannel('platform_stats', stats);
    } catch (error) {
      console.error('Error broadcasting real-time stats:', error);
    }
  }, 60000); // Update every minute
}

function broadcastToChannel(channel, data) {
  if (!wss) return;
  
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN && client.subscriptions?.includes(channel)) {
      client.send(JSON.stringify({
        channel,
        data
      }));
    }
  });
}
```

3. **A/B Testing Framework**
   - Implement content variant testing to optimize learning effectiveness
   - Track performance metrics across different content versions
   - Automate statistical analysis of test results

```javascript
// Add to models/ABTest.js
const abTestSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String },
  status: { type: String, enum: ['draft', 'active', 'completed'], default: 'draft' },
  startDate: { type: Date },
  endDate: { type: Date },
  variants: [{
    variantId: { type: String, required: true },
    name: { type: String, required: true },
    contentId: { type: String, required: true },
    impressions: { type: Number, default: 0 },
    completions: { type: Number, default: 0 },
    averageScore: { type: Number, default: 0 },
    averageCompletionTime: { type: Number, default: 0 },
    userAssignments: [{ type: String }] // userIds
  }],
  targetAudience: {
    skills: [{ type: String }],
    experienceLevels: [{ type: String }],
    percentage: { type: Number, default: 100 } // % of users to include
  },
  metrics: [{
    name: { type: String, required: true },
    weight: { type: Number, default: 1 }
  }],
  winner: { type: String }, // variantId
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Add to services/abTestingService.js
async function assignUserToVariant(userId, testId) {
  try {
    const test = await ABTest.findById(testId);
    if (!test || test.status !== 'active') {
      return null;
    }
    
    // Check if user is already assigned
    for (const variant of test.variants) {
      if (variant.userAssignments.includes(userId)) {
        return variant.variantId;
      }
    }
    
    // Assign to variant with fewest impressions
    const sortedVariants = [...test.variants].sort((a, b) => a.impressions - b.impressions);
    const assignedVariant = sortedVariants[0];
    
    await ABTest.findOneAndUpdate(
      { _id: testId, 'variants.variantId': assignedVariant.variantId },
      { 
        $push: { 'variants.$.userAssignments': userId },
        $inc: { 'variants.$.impressions': 1 }
      }
    );
    
    return assignedVariant.variantId;
  } catch (error) {
    console.error('Error assigning user to variant:', error);
    throw error;
  }
}

async function trackVariantCompletion(userId, testId, variantId, metrics) {
  try {
    const { score, completionTime } = metrics;
    
    const test = await ABTest.findById(testId);
    if (!test) {
      throw new Error('Test not found');
    }
    
    const variant = test.variants.find(v => v.variantId === variantId);
    if (!variant) {
      throw new Error('Variant not found');
    }
    
    // Update variant metrics
    const currentCompletions = variant.completions;
    const newCompletions = currentCompletions + 1;
    
    const newAvgScore = variant.averageScore === 0 ?
      score :
      (variant.averageScore * currentCompletions + score) / newCompletions;
    
    const newAvgTime = variant.averageCompletionTime === 0 ?
      completionTime :
      (variant.averageCompletionTime * currentCompletions + completionTime) / newCompletions;
    
    await ABTest.findOneAndUpdate(
      { _id: testId, 'variants.variantId': variantId },
      { 
        $inc: { 'variants.$.completions': 1 },
        $set: { 
          'variants.$.averageScore': newAvgScore,
          'variants.$.averageCompletionTime': newAvgTime
        }
      }
    );
    
    return true;
  } catch (error) {
    console.error('Error tracking variant completion:', error);
    throw error;
  }
}

async function analyzeTestResults(testId) {
  try {
    const test = await ABTest.findById(testId);
    if (!test) {
      throw new Error('Test not found');
    }
    
    // Calculate key metrics for each variant
    const results = test.variants.map(variant => {
      const completionRate = variant.impressions > 0 ? 
        (variant.completions / variant.impressions) * 100 : 0;
      
      return {
        variantId: variant.variantId,
        name: variant.name,
        metrics: {
          impressions: variant.impressions,
          completions: variant.completions,
          completionRate,
          averageScore: variant.averageScore,
          averageCompletionTime: variant.averageCompletionTime
        }
      };
    });
    
    // Calculate statistical significance
    // (simplified version - in production would use proper statistical tests)
    let winner = null;
    let winnerScore = 0;
    
    results.forEach(variant => {
      // Calculate a composite score based on test metrics and weights
      let score = 0;
      
      test.metrics.forEach(metric => {
        switch (metric.name) {
          case 'completionRate':
            score += variant.metrics.completionRate * metric.weight;
            break;
          case 'averageScore':
            score += variant.metrics.averageScore * metric.weight;
            break;
          case 'completionTime':
            // Lower time is better, so invert the relationship
            score += (1000 / Math.max(variant.metrics.averageCompletionTime, 1)) * metric.weight;
            break;
        }
      });
      
      if (score > winnerScore) {
        winnerScore = score;
        winner = variant.variantId;
      }
    });
    
    // Update test with winner if it has sufficient data
    const minSampleSize = 30; // Minimum sample size for statistical validity
    const hasEnoughData = results.every(r => r.metrics.impressions >= minSampleSize);
    
    if (hasEnoughData) {
      await ABTest.findByIdAndUpdate(testId, { winner });
    }
    
    return {
      results,
      winner: hasEnoughData ? winner : null,
      hasEnoughData
    };
  } catch (error) {
    console.error('Error analyzing test results:', error);
    throw error;
  }
}
```

4. **Enhanced Data Visualization**
   - Implement advanced visualization libraries for complex data representation
   - Create interactive dashboards with drill-down capabilities
   - Develop custom visualization components for learning analytics

### Frontend Enhancements

1. **Interactive Learning Analytics Dashboard**
   - Implement interactive charts and graphs with drill-down capabilities
   - Create personalized insights section based on learning patterns
   - Develop goal tracking and achievement visualization

```typescript
// Add to dashboard.component.ts
import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { AnalyticsService } from '../../core/services/analytics.service';
import { ChartService } from '../../core/services/chart.service';
import * as d3 from 'd3';

@Component({
  selector: 'app-analytics-dashboard',
  templateUrl: './analytics-dashboard.component.html',
  styleUrls: ['./analytics-dashboard.component.scss']
})
export class AnalyticsDashboardComponent implements OnInit {
  @ViewChild('skillTreeChart') skillTreeChart: ElementRef;
  
  userStats: any;
  insights: any[];
  selectedTimeframe = 'month';
  isLoading = true;
  
  constructor(
    private analyticsService: AnalyticsService,
    private chartService: ChartService
  ) {}
  
  ngOnInit() {
    this.loadDashboardData();
  }
  
  loadDashboardData() {
    this.isLoading = true;
    
    // Get user progress stats
    this.analyticsService.getUserProgressStats(this.selectedTimeframe)
      .subscribe(stats => {
        this.userStats = stats;
        this.renderSkillTree();
        this.isLoading = false;
      });
    
    // Get personalized insights
    this.analyticsService.getLearningInsights()
      .subscribe(insights => {
        this.insights = insights;
      });
  }
  
  changeTimeframe(timeframe: string) {
    this.selectedTimeframe = timeframe;
    this.loadDashboardData();
  }
  
  renderSkillTree() {
    if (!this.skillTreeChart || !this.userStats?.skillImprovement) {
      return;
    }
    
    const element = this.skillTreeChart.nativeElement;
    const data = this.prepareSkillTreeData();
    
    // Clear previous chart
    d3.select(element).selectAll('*').remove();
    
    const width = element.clientWidth;
    const height = 400;
    const margin = { top: 20, right: 20, bottom: 30, left: 40 };
    
    const svg = d3.select(element)
      .append('svg')
      .attr('width', width)
      .attr('height', height);
    
    const g = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);
    
    // Create force simulation
    const simulation = d3.forceSimulation(data.nodes)
      .force('link', d3.forceLink(data.links).id(d => d.id))
      .force('charge', d3.forceManyBody().strength(-300))
      .force('center', d3.forceCenter(width / 2, height / 2));
    
    // Add links
    const link = g.append('g')
      .selectAll('line')
      .data(data.links)
      .enter().append('line')
      .attr('stroke', '#999')
      .attr('stroke-opacity', 0.6)
      .attr('stroke-width', d => Math.sqrt(d.value));
    
    // Add nodes
    const node = g.append('g')
      .selectAll('circle')
      .data(data.nodes)
      .enter().append('circle')
      .attr('r', d => d.value * 5)
      .attr('fill', d => this.getColorByProficiency(d.proficiency))
      .call(this.drag(simulation));
    
    // Add labels
    const label = g.append('g')
      .selectAll('text')
      .data(data.nodes)
      .enter().append('text')
      .text(d => d.id)
      .attr('font-size', 12)
      .attr('dx', 15)
      .attr('dy', 4);
    
    // Update positions on simulation tick
    simulation.on('tick', () => {
      link
        .attr('x1', d => d.source.x)
        .attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x)
        .attr('y2', d => d.target.y);
      
      node
        .attr('cx', d => d.x)
        .attr('cy', d => d.y);
      
      label
        .attr('x', d => d.x)
        .attr('y', d => d.y);
    });
  }
  
  prepareSkillTreeData() {
    const nodes = [];
    const links = [];
    
    // Create central node
    nodes.push({
      id: 'Skills',
      value: 2,
      proficiency: 100
    });
    
    // Create nodes for each skill
    this.userStats.skillImprovement.forEach(skill => {
      nodes.push({
        id: skill.skill,
        value: Math.max(0.5, Math.min(2, skill.improvement / 20)),
        proficiency: skill.improvement
      });
      
      links.push({
        source: 'Skills',
        target: skill.skill,
        value: Math.max(1, Math.min(5, skill.improvement / 10))
      });
    });
    
    return { nodes, links };
  }
  
  getColorByProficiency(proficiency: number) {
    const colorScale = d3.scaleLinear<string>()
      .domain([0, 50, 100])
      .range(['#ff4d4d', '#ffcc00', '#00cc66']);
    
    return colorScale(proficiency);
  }
  
  drag(simulation) {
    function dragstarted(event) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      event.subject.fx = event.subject.x;
      event.subject.fy = event.subject.y;
    }
    
    function dragged(event) {
      event.subject.fx = event.x;
      event.subject.fy = event.y;
    }
    
    function dragended(event) {
      if (!event.active) simulation.alphaTarget(0);
      event.subject.fx = null;
      event.subject.fy = null;
    }
    
    return d3.drag()
      .on('start', dragstarted)
      .on('drag', dragged)
      .on('end', dragended);
  }
}
```

2. **Predictive Learning Path Visualization**
   - Implement predictive analytics to forecast learning outcomes
   - Visualize potential learning paths based on current progress
   - Create interactive "what-if" scenarios for different learning strategies

3. **Comparative Analytics**
   - Develop peer comparison features with anonymized data
   - Create industry benchmark visualizations
   - Implement cohort analysis for group learning patterns

4. **Mobile-Optimized Analytics**
   - Design responsive analytics dashboards for mobile devices
   - Create simplified data visualizations for smaller screens
   - Implement offline analytics caching for mobile users

5. **Exportable Custom Reports**
   - Develop customizable report templates
   - Implement multiple export formats (PDF, CSV, Excel)
   - Create scheduled report delivery functionality

## Integration Points

1. **User Profile System**
   - Analytics data is tied to user profiles for personalized insights
   - Learning preferences and patterns feed back into the user profile

2. **Adaptive Learning Engine**
   - Analytics data informs the adaptive engine for content recommendations
   - Learning patterns and strengths/weaknesses are analyzed for personalization

3. **Gamification System**
   - Analytics track achievements and progress for badge awards
   - Leaderboard positions are calculated based on analytics data

4. **Content Management System**
   - Content effectiveness metrics inform content creators
   - A/B testing framework integrates with content variants

5. **External Analytics Tools**
   - API endpoints for exporting data to external analytics platforms
   - Integration with business intelligence tools

## Testing Strategy

1. **Unit Testing**
   - Test individual analytics calculation functions
   - Verify data aggregation methods
   - Test chart data preparation functions

2. **Integration Testing**
   - Test analytics data flow from user actions to storage
   - Verify reporting service integration with analytics data
   - Test real-time analytics broadcasting

3. **Performance Testing**
   - Benchmark analytics queries with large datasets
   - Test dashboard rendering performance with complex visualizations
   - Verify real-time analytics performance under load

4. **User Acceptance Testing**
   - Verify analytics accuracy from end-user perspective
   - Test dashboard usability and information clarity
   - Validate report generation and export functionality

## Security Considerations

1. **Data Privacy**
   - Implement data anonymization for aggregate analytics
   - Ensure compliance with data protection regulations (GDPR, CCPA)
   - Implement proper access controls for sensitive analytics data

2. **Access Control**
   - Role-based access to analytics dashboards and reports
   - Admin-only access to platform-wide analytics
   - User-level access limited to personal analytics

3. **Data Retention**
   - Implement appropriate data retention policies
   - Provide data export and deletion capabilities for users
   - Aggregate historical data to reduce personal identifiability over time

## Performance Considerations

1. **Query Optimization**
   - Implement efficient indexing strategies for analytics collections
   - Use aggregation pipelines for complex analytics queries
   - Implement data pre-aggregation for common reports

2. **Caching Strategy**
   - Cache frequently accessed analytics data
   - Implement time-based cache invalidation
   - Use Redis or similar in-memory data store for real-time analytics

3. **Scalability**
   - Implement sharding for analytics collections as data grows
   - Consider time-series database for long-term analytics storage
   - Implement worker processes for heavy analytics calculations