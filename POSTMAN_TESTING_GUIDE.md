# SkillForge Research Agent - Postman Testing Guide

## Overview

This guide provides comprehensive instructions for testing the SkillForge Research Agent API using Postman. The Research Agent enhances the platform with AI-powered web search, content scraping, and comprehensive roadmap generation capabilities.

## Prerequisites

1. **Postman installed** (Desktop app or web version)
2. **SkillForge API running** on `http://localhost:5000`
3. **Ollama running locally** on `http://localhost:11434`
4. **Valid authentication token** (obtain via login endpoint)

## Environment Setup

### 1. Create Postman Environment

Create a new environment in Postman with the following variables:

```json
{
  "baseUrl": "http://localhost:5050",
  "token": "{{your_jwt_token_here}}",
  "userId": "{{your_user_id_here}}"
}
```

### 2. Authentication Setup

First, get an authentication token:

**POST** `{{baseUrl}}/api/auth/login`

```json
{
  "email": "test@example.com",
  "password": "testpassword"
}
```

Copy the `token` from the response and update your environment variable.

## Research Agent API Endpoints

### 1. Research Agent Status Check

**GET** `{{baseUrl}}/api/research/status`

**Headers:**
```
Authorization: Bearer {{token}}
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "service": "Research Agent",
    "version": "1.0.0",
    "ollama": {
      "status": "connected",
      "model": "llama3:8b",
      "url": "http://127.0.0.1:11434"
    },
    "capabilities": [
      "Web search via DuckDuckGo API",
      "Content scraping and summarization",
      "Comprehensive roadmap generation",
      "Topic analysis and insights",
      "Resource comparison",
      "Multi-source research synthesis"
    ],
    "features": {
      "webSearch": true,
      "contentScraping": true,
      "llmIntegration": true,
      "roadmapGeneration": true,
      "resourceComparison": true
    }
  },
  "message": "Research agent is operational"
}
```

### 2. Generate Comprehensive Roadmap

**POST** `{{baseUrl}}/api/research/roadmap`

**Headers:**
```
Authorization: Bearer {{token}}
Content-Type: application/json
```

**Body (Basic Example):**
```json
{
  "topic": "Learn React from scratch",
  "level": "beginner",
  "timeframe": "4-weeks",
  "dailyTimeMinutes": 30,
  "focus": "practical",
  "includeProjects": true
}
```

**Body (Advanced Example):**
```json
{
  "topic": "Data Science with Python",
  "level": "intermediate",
  "timeframe": "8-weeks",
  "dailyTimeMinutes": 45,
  "focus": "mixed",
  "includeProjects": true
}
```

**Expected Response Structure:**
```json
{
  "success": true,
  "data": {
    "topic": "Learn React from scratch",
    "timeframe": "4-weeks",
    "level": "beginner",
    "dailyTimeMinutes": 30,
    "generatedAt": "2024-01-15T10:30:00.000Z",
    "roadmap": {
      "overview": "Comprehensive React learning journey...",
      "prerequisites": ["Basic JavaScript", "HTML/CSS"],
      "steps": [
        {
          "week": 1,
          "day": 1,
          "title": "React Fundamentals",
          "description": "Learn JSX and components",
          "duration": "30 minutes",
          "type": "theory",
          "concepts": ["JSX", "Components"],
          "resources": ["React Official Docs"],
          "optional": false,
          "difficulty": "beginner"
        }
      ],
      "projects": [
        {
          "title": "Todo App",
          "description": "Build a simple todo application",
          "week": 2,
          "estimatedHours": 4,
          "skills": ["Components", "State Management"]
        }
      ],
      "milestones": [
        {
          "week": 1,
          "title": "React Basics",
          "description": "Understand components and JSX"
        }
      ]
    },
    "sources": [
      {
        "title": "React Official Documentation",
        "url": "https://react.dev/learn",
        "qualityScore": 0.95,
        "source": "React.dev"
      }
    ],
    "methodology": "web-enhanced-llm",
    "totalSteps": 28
  },
  "message": "Roadmap generated successfully"
}
```

### 3. Web Search

**GET** `{{baseUrl}}/api/research/search?q=machine learning tutorial&limit=5`

**Headers:**
```
Authorization: Bearer {{token}}
```

**Parameters:**
- `q` (required): Search query
- `limit` (optional): Maximum results (1-20, default: 10)

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "query": "machine learning tutorial",
    "results": [
      {
        "title": "Machine Learning Tutorial",
        "url": "https://example.com/ml-tutorial",
        "snippet": "Comprehensive guide to machine learning...",
        "source": "Educational Site",
        "relevanceScore": 0.9
      }
    ],
    "count": 5
  },
  "message": "Search completed successfully"
}
```

### 4. Content Scraping

**POST** `{{baseUrl}}/api/research/scrape`

**Headers:**
```
Authorization: Bearer {{token}}
Content-Type: application/json
```

**Body:**
```json
{
  "url": "https://javascript.info/intro",
  "title": "JavaScript Introduction"
}
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "url": "https://javascript.info/intro",
    "title": "JavaScript Introduction",
    "content": "JavaScript was initially created to make web pages alive...",
    "summary": "JavaScript is a versatile programming language...",
    "headers": [
      {
        "level": 1,
        "text": "An Introduction to JavaScript"
      },
      {
        "level": 2,
        "text": "What is JavaScript?"
      }
    ],
    "wordCount": 500,
    "scrapedAt": "2024-01-15T10:30:00.000Z"
  },
  "message": "Content scraped and summarized successfully"
}
```

### 5. Topic Analysis

**POST** `{{baseUrl}}/api/research/analyze-topic`

**Headers:**
```
Authorization: Bearer {{token}}
Content-Type: application/json
```

**Body:**
```json
{
  "topic": "Artificial Intelligence",
  "depth": "detailed"
}
```

**Depth Options:**
- `overview`: Basic analysis with 5 sources
- `detailed`: Comprehensive analysis with 10 sources
- `comprehensive`: Deep analysis with 15 sources

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "topic": "Artificial Intelligence",
    "depth": "detailed",
    "analysis": {
      "overview": "AI is a rapidly evolving field...",
      "keyAreas": ["Machine Learning", "Neural Networks", "Natural Language Processing"],
      "difficulty": "intermediate",
      "timeToLearn": "6-12 months for proficiency",
      "prerequisites": ["Statistics", "Programming", "Mathematics"],
      "careerRelevance": "High demand in tech industry",
      "trends": "Focus on ethical AI and large language models",
      "recommendations": "Start with Python and basic ML concepts",
      "relatedTopics": ["Data Science", "Computer Vision", "Robotics"]
    },
    "searchResults": [...],
    "scrapedContent": [...],
    "generatedAt": "2024-01-15T10:30:00.000Z"
  },
  "message": "Topic analysis completed successfully"
}
```

### 6. Resource Comparison

**POST** `{{baseUrl}}/api/research/compare-resources`

**Headers:**
```
Authorization: Bearer {{token}}
Content-Type: application/json
```

**Body:**
```json
{
  "urls": [
    "https://www.coursera.org/learn/machine-learning",
    "https://www.edx.org/course/introduction-to-artificial-intelligence-ai",
    "https://www.udacity.com/course/machine-learning-engineer-nanodegree--nd009t"
  ],
  "topic": "Machine Learning Courses"
}
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "topic": "Machine Learning Courses",
    "resources": [...],
    "comparison": {
      "comparison": {
        "bestForBeginners": "Coursera Machine Learning",
        "mostComprehensive": "Udacity Nanodegree",
        "mostPractical": "Coursera Machine Learning",
        "bestStructure": "EdX AI Course"
      },
      "resourceRankings": [
        {
          "title": "Coursera Machine Learning",
          "rank": 1,
          "strengths": ["Comprehensive content", "Practical assignments"],
          "weaknesses": ["Requires time commitment"],
          "recommendedFor": "Beginners to intermediate learners"
        }
      ],
      "summary": "All courses offer solid foundations..."
    },
    "validResourceCount": 3,
    "generatedAt": "2024-01-15T10:30:00.000Z"
  },
  "message": "Resource comparison completed successfully"
}
```

## Testing Scenarios

### Scenario 1: Complete Roadmap Generation Workflow

1. **Check Status** - Verify research agent is operational
2. **Generate Roadmap** - Create a roadmap for "Python Programming"
3. **Search Resources** - Search for additional Python tutorials
4. **Analyze Topic** - Get detailed analysis of Python
5. **Compare Resources** - Compare top Python learning platforms

### Scenario 2: Error Handling Tests

**Test Invalid Topic:**
```json
{
  "topic": "",
  "level": "beginner"
}
```
Expected: 400 error with validation message

**Test Invalid URL for Scraping:**
```json
{
  "url": "not-a-valid-url"
}
```
Expected: 400 error with validation message

**Test Unauthorized Access:**
Remove Authorization header
Expected: 401 error

### Scenario 3: Performance Testing

1. **Concurrent Requests** - Send multiple roadmap generation requests
2. **Large Topic Analysis** - Test with complex topics
3. **Multiple URL Scraping** - Test resource comparison with 5 URLs

## Postman Collection Import

You can create a Postman collection with all these endpoints. Here's a sample collection structure:

```json
{
  "info": {
    "name": "SkillForge Research Agent",
    "description": "API collection for testing Research Agent functionality"
  },
  "item": [
    {
      "name": "Authentication",
      "item": [
        {
          "name": "Login",
          "request": {
            "method": "POST",
            "url": "{{baseUrl}}/api/auth/login",
            "body": {
              "mode": "raw",
              "raw": "{\"email\": \"test@example.com\", \"password\": \"testpassword\"}"
            }
          }
        }
      ]
    },
    {
      "name": "Research Agent",
      "item": [
        {
          "name": "Status Check",
          "request": {
            "method": "GET",
            "url": "{{baseUrl}}/api/research/status",
            "header": [
              {
                "key": "Authorization",
                "value": "Bearer {{token}}"
              }
            ]
          }
        }
      ]
    }
  ]
}
```

## Common Issues and Troubleshooting

### Issue 1: Ollama Connection Failed
**Error:** "Research agent status check failed"
**Solution:** 
1. Verify Ollama is running: `ollama list`
2. Check Ollama URL in environment variables
3. Restart Ollama service

### Issue 2: Web Search Returns Empty Results
**Error:** Empty search results
**Solution:**
1. Check internet connectivity
2. Try different search terms
3. Verify DuckDuckGo API availability

### Issue 3: Content Scraping Fails
**Error:** "Scraping failed"
**Solution:**
1. Verify URL is accessible
2. Check if website blocks scraping
3. Try with different URLs

### Issue 4: Authentication Errors
**Error:** 401 Unauthorized
**Solution:**
1. Refresh authentication token
2. Verify token in environment variables
3. Check token expiration

## Advanced Testing Tips

1. **Use Environment Variables** for dynamic testing
2. **Create Test Scripts** in Postman for automated validation
3. **Set up Monitors** for continuous API health checking
4. **Use Pre-request Scripts** for dynamic token refresh
5. **Implement Data-driven Testing** with CSV files

## Rate Limits and Best Practices

- **Roadmap Generation**: Max 10 requests per minute
- **Web Search**: Max 50 requests per hour
- **Content Scraping**: Max 20 requests per hour
- **Always include proper headers** and authentication
- **Handle errors gracefully** in your applications
- **Cache results** when possible to reduce API calls

## Integration with Existing SkillForge APIs

The Research Agent integrates with existing APIs:

1. **Enhanced Roadmap Generation**: Use `/api/roadmap/generate` with `useResearchAgent=true`
2. **User Profile Integration**: Roadmaps consider user skill level and preferences
3. **Progress Tracking**: Generated roadmaps sync with user progress
4. **Tutor Integration**: Research results enhance AI tutor responses

This comprehensive testing guide ensures you can effectively test and integrate the Research Agent functionality into your SkillForge application.
