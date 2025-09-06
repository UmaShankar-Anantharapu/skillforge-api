# My-Learning Backend Architecture Documentation

## Overview

This document outlines the scalable backend architecture designed for managing user roadmaps in the SkillForge platform. The architecture supports four main sections: Continue Learning, Saved Roadmaps, AI Recommendations, and Trending Roadmaps.

## Architecture Components

### 1. Database Models

#### UserRoadmapTracking Model
**File:** `src/models/UserRoadmapTracking.js`

**Purpose:** Manages user-specific roadmap interactions across all sections.

**Key Features:**
- **Active Learning:** Stores complete roadmap details when users start roadmaps
- **Saved Roadmaps:** Stores roadmap summaries and level-wise details (not full details)
- **AI Recommendations:** Manages up to 25 recommendations per user with 7-day expiration
- **User Preferences:** Stores recommendation preferences and analytics

**Schema Structure:**
```javascript
{
  userId: ObjectId, // Unique user identifier
  activeLearning: [{
    roadmapId: ObjectId,
    status: String, // 'active', 'paused', 'completed'
    progress: Object,
    lastAccessedAt: Date
  }],
  savedRoadmaps: [{
    roadmapId: ObjectId,
    title: String,
    summary: String,
    levelDetails: Object,
    savedAt: Date
  }],
  aiRecommendations: [{
    roadmapId: ObjectId,
    title: String,
    description: String,
    relevanceScore: Number,
    suggestedDateTime: Date,
    expiresAt: Date // 7-day expiration
  }],
  recommendationPreferences: Object,
  analytics: Object
}
```

#### TrendingRoadmaps Model
**File:** `src/models/TrendingRoadmaps.js`

**Purpose:** Manages global trending roadmaps visible to all users.

**Key Features:**
- **7-Day Refresh Cycle:** Automatically refreshes trending data every 7 days
- **Global Visibility:** Same trending roadmaps for all users
- **Comprehensive Metrics:** Tracks views, starts, completions, saves, and ratings
- **Industry Relevance:** Includes industry demand and job market data

**Schema Structure:**
```javascript
{
  periodId: String, // Unique period identifier
  periodStart: Date,
  periodEnd: Date,
  status: String, // 'active', 'expired'
  trendingRoadmaps: [{
    rank: Number,
    roadmapId: ObjectId,
    title: String,
    description: String,
    trendingScore: Number,
    metrics: {
      totalViews: Number,
      totalStarts: Number,
      totalCompletions: Number,
      totalSaves: Number,
      averageRating: Number
    },
    industryRelevance: Object
  }],
  expiresAt: Date // TTL index for automatic cleanup
}
```

### 2. API Endpoints

#### My-Learning Routes
**File:** `src/routes/myLearning.js`

**Base URL:** `/api/my-learning`

##### Continue Learning
- **GET** `/continue-learning` - Fetch user's active roadmaps
- **Response:** Active roadmaps or "Not started any roadmap yet" message

##### Saved Roadmaps
- **GET** `/saved-roadmaps` - Fetch user's saved roadmaps
- **Response:** Saved roadmap summaries or "Not saved any roadmap yet" message

##### AI Recommendations
- **GET** `/ai-recommendations` - Fetch personalized AI recommendations
- **Features:**
  - Automatic refresh when expired (7-day expiration)
  - Maximum 25 recommendations per user
  - Relevance-based sorting

##### Trending Roadmaps
- **GET** `/trending-roadmaps` - Fetch global trending roadmaps
- **Features:**
  - Global data (same for all users)
  - 7-day refresh cycle
  - Rank-based sorting

##### Dashboard
- **GET** `/dashboard` - Comprehensive data for My-Learning page
- **Response:** All four sections in a single API call

##### Actions
- **POST** `/start-roadmap` - Start a new roadmap (adds to Continue Learning)
- **POST** `/save-roadmap` - Save a roadmap (adds to Saved Roadmaps)
- **POST** `/recommendation-interaction` - Track recommendation interactions
- **POST** `/refresh-recommendations` - Manually refresh AI recommendations

##### Analytics
- **GET** `/user-stats` - Get user learning statistics

### 3. Service Layer

#### MyLearningService
**File:** `src/services/myLearningService.js`

**Purpose:** Handles business logic for My-Learning functionality.

**Key Functions:**
- `getContinueLearningData(userId)` - Retrieves active learning data
- `getSavedRoadmapsData(userId)` - Retrieves saved roadmaps
- `getAIRecommendations(userId)` - Manages AI recommendations with refresh logic
- `getTrendingRoadmaps()` - Retrieves trending roadmaps with refresh logic
- `startRoadmap(userId, roadmapId)` - Adds roadmap to active learning
- `saveRoadmap(userId, roadmapId)` - Saves roadmap summary

#### DataCleanupService
**File:** `src/services/dataCleanupService.js`

**Purpose:** Manages data expiration and cleanup policies.

**Scheduled Tasks:**
- **AI Recommendations Cleanup:** Every 6 hours
- **Trending Roadmaps Refresh:** Daily at 2 AM
- **Weekly Cleanup:** Every Sunday at 3 AM
- **Monthly Analytics Cleanup:** 1st of each month at 4 AM

## Scalability Features

### 1. Database Optimization

#### Comprehensive Indexing
**UserRoadmapTracking Indexes:**
```javascript
// Primary and unique indexes
{ userId: 1 } // Unique index

// Active Learning indexes
{ 'activeLearning.roadmapId': 1 }
{ 'activeLearning.status': 1 }
{ 'activeLearning.lastAccessedAt': -1 }

// Saved Roadmaps indexes
{ 'savedRoadmaps.roadmapId': 1 }
{ 'savedRoadmaps.savedAt': -1 }
{ 'savedRoadmaps.category': 1 }

// AI Recommendations indexes
{ 'aiRecommendations.expiresAt': 1 } // TTL index
{ 'aiRecommendations.suggestedDateTime': -1 }
{ 'aiRecommendations.category': 1 }
{ 'aiRecommendations.difficultyLevel': 1 }
```

**TrendingRoadmaps Indexes:**
```javascript
// Primary indexes
{ periodId: 1 } // Unique index
{ status: 1 }
{ expiresAt: 1 } // TTL index

// Trending data indexes
{ 'trendingRoadmaps.rank': 1 }
{ 'trendingRoadmaps.trendingScore': -1 }
{ 'trendingRoadmaps.category': 1 }
{ 'trendingRoadmaps.metrics.totalViews': -1 }
```

#### TTL (Time To Live) Indexes
- **AI Recommendations:** Automatic expiration after 7 days
- **Trending Roadmaps:** Automatic cleanup of expired periods

### 2. Data Expiration Policies

#### AI Recommendations
- **Expiration:** 7 days from suggestion date
- **Limit:** Maximum 25 recommendations per user
- **Refresh Logic:** Automatic refresh when user accesses expired recommendations

#### Trending Roadmaps
- **Refresh Cycle:** Every 7 days
- **Global Data:** Same trending roadmaps for all users
- **Automatic Cleanup:** Old periods automatically removed

### 3. Efficient Data Fetching

#### Optimized Queries
- **Projection:** Only fetch required fields
- **Pagination:** Support for large datasets
- **Caching:** Trending roadmaps cached for performance

#### Fallback Messages
- **Continue Learning:** "Not started any roadmap yet"
- **Saved Roadmaps:** "Not saved any roadmap yet"
- **AI Recommendations:** "No recommendations available"
- **Trending Roadmaps:** "No trending roadmaps available"

## Data Consistency

### 1. Transaction Support
- Critical operations use MongoDB transactions
- Ensures data consistency across collections

### 2. Validation
- Schema-level validation for all models
- Business logic validation in service layer

### 3. Error Handling
- Comprehensive error handling in all endpoints
- Graceful degradation for non-critical failures

## Performance Considerations

### 1. Database Performance
- **Indexes:** Comprehensive indexing strategy
- **Aggregation:** Efficient aggregation pipelines
- **Connection Pooling:** Optimized MongoDB connections

### 2. API Performance
- **Caching:** Redis caching for frequently accessed data
- **Compression:** Response compression enabled
- **Rate Limiting:** API rate limiting implemented

### 3. Background Processing
- **Scheduled Tasks:** Non-blocking background cleanup
- **Queue System:** For heavy processing tasks

## Security Considerations

### 1. Authentication
- JWT-based authentication for all endpoints
- User-specific data access controls

### 2. Data Privacy
- User data isolation
- Secure data transmission (HTTPS)

### 3. Input Validation
- Request validation middleware
- SQL injection prevention
- XSS protection

## Monitoring and Analytics

### 1. Performance Monitoring
- API response time tracking
- Database query performance
- Error rate monitoring

### 2. Usage Analytics
- User engagement metrics
- Feature usage statistics
- Recommendation effectiveness tracking

## Future Enhancements

### 1. Machine Learning Integration
- Enhanced recommendation algorithms
- Personalized trending roadmaps
- Predictive analytics

### 2. Real-time Features
- WebSocket support for real-time updates
- Live progress tracking
- Collaborative learning features

### 3. Advanced Analytics
- Learning path optimization
- Completion prediction
- Skill gap analysis

## Deployment Considerations

### 1. Environment Configuration
- Separate configurations for development, staging, and production
- Environment-specific database connections
- Feature flags for gradual rollouts

### 2. Scaling Strategy
- Horizontal scaling support
- Database sharding considerations
- CDN integration for static content

### 3. Backup and Recovery
- Automated database backups
- Point-in-time recovery
- Disaster recovery procedures

## API Usage Examples

### Get My-Learning Dashboard
```javascript
GET /api/my-learning/dashboard
Authorization: Bearer <jwt-token>

Response:
{
  "continueLearning": {
    "hasData": true,
    "data": [...],
    "message": null
  },
  "savedRoadmaps": {
    "hasData": true,
    "data": [...],
    "message": null
  },
  "aiRecommendations": {
    "hasData": true,
    "data": [...],
    "refreshed": false
  },
  "trendingRoadmaps": {
    "hasData": true,
    "data": [...],
    "refreshed": false
  }
}
```

### Start a Roadmap
```javascript
POST /api/my-learning/start-roadmap
Authorization: Bearer <jwt-token>
Content-Type: application/json

{
  "roadmapId": "60f7b3b3b3b3b3b3b3b3b3b3"
}

Response:
{
  "success": true,
  "message": "Roadmap started successfully",
  "data": {
    "roadmapId": "60f7b3b3b3b3b3b3b3b3b3b3",
    "status": "active",
    "startedAt": "2024-01-15T10:30:00.000Z"
  }
}
```

## Conclusion

This architecture provides a robust, scalable foundation for managing user roadmaps in the SkillForge platform. The design emphasizes performance, scalability, and maintainability while ensuring data consistency and user experience quality.