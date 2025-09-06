# My-Learning API Documentation

## Base URL
```
/api/my-learning
```

## Authentication
All endpoints require JWT authentication. Include the token in the Authorization header:
```
Authorization: Bearer <jwt-token>
```

## Endpoints

### 1. Continue Learning

#### Get Continue Learning Data
```http
GET /api/my-learning/continue-learning
```

**Description:** Retrieves user's active roadmaps with complete details and progress tracking.

**Response:**
```json
{
  "success": true,
  "hasData": true,
  "data": [
    {
      "roadmapId": "60f7b3b3b3b3b3b3b3b3b3b3",
      "title": "Full Stack Web Development",
      "description": "Complete roadmap for becoming a full stack developer",
      "category": "Web Development",
      "difficultyLevel": "Intermediate",
      "estimatedDuration": "6 months",
      "progress": {
        "percentageComplete": 45,
        "completedSteps": 23,
        "totalSteps": 51,
        "currentStep": 24,
        "lastActivityAt": "2024-01-15T10:30:00.000Z"
      },
      "status": "active",
      "startedAt": "2024-01-01T00:00:00.000Z",
      "lastAccessedAt": "2024-01-15T10:30:00.000Z",
      "completedSteps": [
        {
          "day": 1,
          "title": "HTML Basics",
          "completedAt": "2024-01-01T14:30:00.000Z"
        }
      ],
      "nextSteps": [
        {
          "day": 24,
          "title": "CSS Grid Layout",
          "estimatedMinutes": 120
        }
      ]
    }
  ],
  "message": null
}
```

**Empty State Response:**
```json
{
  "success": true,
  "hasData": false,
  "data": [],
  "message": "Not started any roadmap yet"
}
```

### 2. Saved Roadmaps

#### Get Saved Roadmaps
```http
GET /api/my-learning/saved-roadmaps
```

**Description:** Retrieves user's saved roadmaps with summaries and level-wise details (not full details).

**Response:**
```json
{
  "success": true,
  "hasData": true,
  "data": [
    {
      "roadmapId": "60f7b3b3b3b3b3b3b3b3b3b4",
      "title": "Data Science Fundamentals",
      "summary": "Learn the basics of data science including statistics, Python, and machine learning",
      "category": "Data Science",
      "difficultyLevel": "Beginner",
      "estimatedDuration": "4 months",
      "tags": ["Python", "Statistics", "Machine Learning"],
      "levelDetails": {
        "beginner": {
          "duration": "6 weeks",
          "topics": ["Python Basics", "Statistics Fundamentals"],
          "estimatedHours": 60
        },
        "intermediate": {
          "duration": "8 weeks",
          "topics": ["Data Analysis", "Pandas", "NumPy"],
          "estimatedHours": 80
        },
        "advanced": {
          "duration": "6 weeks",
          "topics": ["Machine Learning", "Deep Learning Basics"],
          "estimatedHours": 70
        }
      },
      "savedAt": "2024-01-10T15:45:00.000Z",
      "analytics": {
        "averageRating": 4.7,
        "totalRatings": 156,
        "viewCount": 2340
      }
    }
  ],
  "message": null
}
```

**Empty State Response:**
```json
{
  "success": true,
  "hasData": false,
  "data": [],
  "message": "Not saved any roadmap yet"
}
```

### 3. AI Recommendations

#### Get AI Recommendations
```http
GET /api/my-learning/ai-recommendations
```

**Description:** Retrieves personalized AI recommendations (max 25 per user, 7-day expiration).

**Query Parameters:**
- `refresh` (optional): Force refresh recommendations (boolean)
- `category` (optional): Filter by category (string)
- `difficulty` (optional): Filter by difficulty level (string)

**Response:**
```json
{
  "success": true,
  "hasData": true,
  "refreshed": false,
  "data": [
    {
      "roadmapId": "60f7b3b3b3b3b3b3b3b3b3b5",
      "title": "React Native Mobile Development",
      "description": "Build cross-platform mobile apps with React Native",
      "category": "Mobile Development",
      "difficultyLevel": "Intermediate",
      "estimatedDuration": "3 months",
      "tags": ["React Native", "Mobile", "JavaScript"],
      "relevanceScore": 0.92,
      "reasonForRecommendation": "Based on your web development experience and interest in mobile technologies",
      "suggestedDateTime": "2024-01-15T08:00:00.000Z",
      "expiresAt": "2024-01-22T08:00:00.000Z",
      "analytics": {
        "averageRating": 4.5,
        "totalStarts": 89,
        "completionRate": 0.73
      },
      "industryRelevance": {
        "jobDemand": "High",
        "salaryRange": "$70k - $120k",
        "growthProjection": "15% annually"
      }
    }
  ],
  "metadata": {
    "totalRecommendations": 15,
    "lastRefreshed": "2024-01-15T08:00:00.000Z",
    "nextRefresh": "2024-01-22T08:00:00.000Z"
  }
}
```

**Empty/Expired State Response:**
```json
{
  "success": true,
  "hasData": true,
  "refreshed": true,
  "data": [...], // New recommendations
  "message": "Recommendations refreshed based on your latest activity"
}
```

### 4. Trending Roadmaps

#### Get Trending Roadmaps
```http
GET /api/my-learning/trending-roadmaps
```

**Description:** Retrieves global trending roadmaps (7-day refresh cycle, same for all users).

**Query Parameters:**
- `category` (optional): Filter by category (string)
- `difficulty` (optional): Filter by difficulty level (string)
- `limit` (optional): Number of results (default: 20, max: 50)

**Response:**
```json
{
  "success": true,
  "hasData": true,
  "refreshed": false,
  "data": [
    {
      "rank": 1,
      "roadmapId": "60f7b3b3b3b3b3b3b3b3b3b6",
      "title": "AI/ML Engineering",
      "description": "Complete guide to becoming an AI/ML engineer",
      "category": "Artificial Intelligence",
      "difficultyLevel": "Advanced",
      "estimatedDuration": "8 months",
      "tags": ["Python", "TensorFlow", "Machine Learning", "Deep Learning"],
      "trendingScore": 98.5,
      "metrics": {
        "totalViews": 15420,
        "totalStarts": 3240,
        "totalCompletions": 890,
        "totalSaves": 5670,
        "averageRating": 4.8,
        "totalRatings": 1230
      },
      "industryRelevance": {
        "industryDemand": "Very High",
        "jobGrowth": "25% annually",
        "averageSalary": "$130k - $200k",
        "topCompanies": ["Google", "Microsoft", "OpenAI"]
      },
      "resources": {
        "totalResources": 45,
        "freeResources": 32,
        "premiumResources": 13
      },
      "demoProjects": [
        "Image Classification System",
        "Natural Language Chatbot",
        "Recommendation Engine"
      ],
      "imageUrl": "https://example.com/ai-ml-roadmap.jpg"
    }
  ],
  "metadata": {
    "periodId": "2024-W03",
    "periodStart": "2024-01-15T00:00:00.000Z",
    "periodEnd": "2024-01-22T00:00:00.000Z",
    "totalTrending": 25,
    "lastRefreshed": "2024-01-15T02:00:00.000Z",
    "nextRefresh": "2024-01-22T02:00:00.000Z"
  }
}
```

### 5. Dashboard (Combined Data)

#### Get My-Learning Dashboard
```http
GET /api/my-learning/dashboard
```

**Description:** Retrieves all My-Learning sections in a single API call for optimal performance.

**Query Parameters:**
- `sections` (optional): Comma-separated list of sections to include (default: all)
  - Options: `continue-learning`, `saved-roadmaps`, `ai-recommendations`, `trending-roadmaps`

**Response:**
```json
{
  "success": true,
  "data": {
    "continueLearning": {
      "hasData": true,
      "data": [...], // Continue learning data
      "message": null
    },
    "savedRoadmaps": {
      "hasData": true,
      "data": [...], // Saved roadmaps data
      "message": null
    },
    "aiRecommendations": {
      "hasData": true,
      "data": [...], // AI recommendations data
      "refreshed": false,
      "metadata": {...}
    },
    "trendingRoadmaps": {
      "hasData": true,
      "data": [...], // Trending roadmaps data
      "refreshed": false,
      "metadata": {...}
    }
  },
  "metadata": {
    "requestedAt": "2024-01-15T10:30:00.000Z",
    "sectionsIncluded": ["continueLearning", "savedRoadmaps", "aiRecommendations", "trendingRoadmaps"]
  }
}
```

### 6. Actions

#### Start Roadmap
```http
POST /api/my-learning/start-roadmap
```

**Description:** Starts a new roadmap and adds it to Continue Learning section.

**Request Body:**
```json
{
  "roadmapId": "60f7b3b3b3b3b3b3b3b3b3b3",
  "customizations": {
    "dailyTime": 60, // minutes per day
    "weeklyHours": 7,
    "excludedSkills": ["PHP"],
    "focusAreas": ["Frontend", "React"]
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Roadmap started successfully",
  "data": {
    "roadmapId": "60f7b3b3b3b3b3b3b3b3b3b3",
    "status": "active",
    "startedAt": "2024-01-15T10:30:00.000Z",
    "estimatedCompletionDate": "2024-07-15T10:30:00.000Z",
    "totalSteps": 51,
    "currentStep": 1
  }
}
```

#### Save Roadmap
```http
POST /api/my-learning/save-roadmap
```

**Description:** Saves a roadmap summary to Saved Roadmaps section.

**Request Body:**
```json
{
  "roadmapId": "60f7b3b3b3b3b3b3b3b3b3b4",
  "notes": "Interested in this for future learning"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Roadmap saved successfully",
  "data": {
    "roadmapId": "60f7b3b3b3b3b3b3b3b3b3b4",
    "savedAt": "2024-01-15T10:30:00.000Z",
    "notes": "Interested in this for future learning"
  }
}
```

#### Update Recommendation Interaction
```http
POST /api/my-learning/recommendation-interaction
```

**Description:** Tracks user interactions with AI recommendations for improving future suggestions.

**Request Body:**
```json
{
  "roadmapId": "60f7b3b3b3b3b3b3b3b3b3b5",
  "interactionType": "viewed", // "viewed", "clicked", "saved", "started", "dismissed"
  "feedback": {
    "relevant": true,
    "reason": "matches_interests" // "matches_interests", "good_timing", "appropriate_level", "not_relevant"
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Interaction recorded successfully"
}
```

#### Refresh AI Recommendations
```http
POST /api/my-learning/refresh-recommendations
```

**Description:** Manually refreshes AI recommendations before expiration.

**Request Body:**
```json
{
  "preferences": {
    "categories": ["Web Development", "Mobile Development"],
    "difficultyLevels": ["Intermediate", "Advanced"],
    "maxDuration": "6 months"
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Recommendations refreshed successfully",
  "data": {
    "totalRecommendations": 20,
    "refreshedAt": "2024-01-15T10:30:00.000Z",
    "nextAutoRefresh": "2024-01-22T10:30:00.000Z"
  }
}
```

### 7. Analytics

#### Get User Learning Statistics
```http
GET /api/my-learning/user-stats
```

**Description:** Retrieves comprehensive user learning statistics.

**Response:**
```json
{
  "success": true,
  "data": {
    "continueLearning": {
      "totalActive": 2,
      "totalCompleted": 5,
      "averageProgress": 67.5,
      "totalTimeSpent": 14520, // minutes
      "currentStreak": 7, // days
      "longestStreak": 23
    },
    "savedRoadmaps": {
      "totalSaved": 12,
      "categoriesInterested": ["Web Development", "Data Science", "Mobile Development"],
      "averageDifficulty": "Intermediate"
    },
    "aiRecommendations": {
      "totalViewed": 45,
      "totalStarted": 8,
      "totalSaved": 15,
      "averageRelevanceScore": 0.84,
      "topCategories": ["Web Development", "AI/ML"]
    },
    "overall": {
      "joinedDate": "2023-12-01T00:00:00.000Z",
      "totalRoadmapsStarted": 13,
      "totalRoadmapsCompleted": 5,
      "completionRate": 0.38,
      "favoriteCategory": "Web Development",
      "skillLevel": "Intermediate"
    }
  }
}
```

## Error Responses

### Authentication Error
```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Invalid or expired token"
  }
}
```

### Validation Error
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request data",
    "details": {
      "roadmapId": "Required field missing"
    }
  }
}
```

### Server Error
```json
{
  "success": false,
  "error": {
    "code": "INTERNAL_SERVER_ERROR",
    "message": "An unexpected error occurred"
  }
}
```

### Rate Limit Error
```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests. Please try again later.",
    "retryAfter": 60 // seconds
  }
}
```

## Rate Limiting

- **General endpoints:** 100 requests per minute per user
- **Dashboard endpoint:** 20 requests per minute per user
- **Refresh recommendations:** 5 requests per hour per user
- **Analytics endpoints:** 30 requests per minute per user

## Caching

- **Trending Roadmaps:** Cached for 1 hour
- **User Statistics:** Cached for 15 minutes
- **AI Recommendations:** Cached until expiration

## Pagination

For endpoints that return lists, pagination is supported:

**Query Parameters:**
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 20, max: 100)
- `sort`: Sort field (default: varies by endpoint)
- `order`: Sort order - `asc` or `desc` (default: `desc`)

**Paginated Response:**
```json
{
  "success": true,
  "data": [...],
  "pagination": {
    "currentPage": 1,
    "totalPages": 5,
    "totalItems": 95,
    "itemsPerPage": 20,
    "hasNextPage": true,
    "hasPrevPage": false
  }
}
```

## WebSocket Events (Future Enhancement)

### Real-time Progress Updates
```javascript
// Client subscribes to progress updates
socket.emit('subscribe-progress', { userId });

// Server sends progress updates
socket.emit('progress-update', {
  roadmapId: '60f7b3b3b3b3b3b3b3b3b3b3',
  stepCompleted: 24,
  percentageComplete: 47
});
```

### New Recommendations
```javascript
// Server sends new recommendation notifications
socket.emit('new-recommendations', {
  count: 5,
  topRecommendation: {
    title: 'Advanced React Patterns',
    relevanceScore: 0.95
  }
});
```

## SDK Examples

### JavaScript/Node.js
```javascript
const SkillForgeAPI = require('@skillforge/api-client');

const client = new SkillForgeAPI({
  baseURL: 'https://api.skillforge.com',
  token: 'your-jwt-token'
});

// Get dashboard data
const dashboard = await client.myLearning.getDashboard();

// Start a roadmap
const result = await client.myLearning.startRoadmap({
  roadmapId: '60f7b3b3b3b3b3b3b3b3b3b3',
  customizations: {
    dailyTime: 60,
    focusAreas: ['Frontend']
  }
});
```

### Python
```python
from skillforge_api import SkillForgeClient

client = SkillForgeClient(
    base_url='https://api.skillforge.com',
    token='your-jwt-token'
)

# Get AI recommendations
recommendations = client.my_learning.get_ai_recommendations(
    category='Web Development',
    difficulty='Intermediate'
)

# Save a roadmap
result = client.my_learning.save_roadmap(
    roadmap_id='60f7b3b3b3b3b3b3b3b3b3b4',
    notes='Looks interesting for Q2 learning'
)
```

## Testing

### Unit Tests
```bash
npm test -- --grep "My Learning API"
```

### Integration Tests
```bash
npm run test:integration -- --grep "my-learning"
```

### Load Testing
```bash
# Test dashboard endpoint under load
artillery run load-tests/my-learning-dashboard.yml
```

## Changelog

### v1.0.0 (2024-01-15)
- Initial release of My-Learning API
- All four sections implemented
- Comprehensive documentation
- Rate limiting and caching

### Future Versions
- v1.1.0: WebSocket support for real-time updates
- v1.2.0: Advanced filtering and search
- v1.3.0: Machine learning enhanced recommendations