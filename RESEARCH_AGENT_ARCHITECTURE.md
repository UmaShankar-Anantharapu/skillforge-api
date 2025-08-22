# SkillForge Research Agent - Architecture & Design Documentation

## Overview

The SkillForge Research Agent is an AI-powered enhancement to the existing SkillForge microlearning platform that integrates web search, content scraping, and intelligent roadmap generation capabilities using local Ollama LLM integration.

## Architecture Changes

### 1. System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     SkillForge Architecture                    │
├─────────────────────────────────────────────────────────────────┤
│  Frontend (Angular)                                            │
│  ├── Components                                                │
│  ├── Services                                                  │
│  └── Guards/Interceptors                                       │
├─────────────────────────────────────────────────────────────────┤
│  Backend API (Node.js/Express)                                 │
│  ├── Routes Layer                                              │
│  │   ├── /api/auth                                             │
│  │   ├── /api/roadmap                                          │
│  │   ├── /api/research  ← NEW                                  │
│  │   └── ...existing routes                                    │
│  ├── Services Layer                                            │
│  │   ├── researchAgentService.js  ← NEW                        │
│  │   ├── roadmapLlmService.js     ← ENHANCED                   │
│  │   ├── llmClient.js                                          │
│  │   └── ...existing services                                  │
│  ├── Models Layer (MongoDB)                                    │
│  │   ├── Roadmap  ← ENHANCED                                   │
│  │   └── ...existing models                                    │
│  └── Middleware                                                │
├─────────────────────────────────────────────────────────────────┤
│  External Integrations                                         │
│  ├── Ollama LLM (Local)                                        │
│  │   ├── llama3:8b (Primary)                                   │
│  │   ├── codellama:7b (Code-specific)                          │
│  │   └── phi3:mini (Lightweight)                               │
│  ├── DuckDuckGo Search API                                     │
│  ├── Web Scraping (Cheerio/Axios)                              │
│  └── Educational Source APIs                                   │
└─────────────────────────────────────────────────────────────────┘
```

### 2. Design Patterns Implemented

#### a) Service Layer Pattern
- **Purpose**: Separation of business logic from route handlers
- **Implementation**: 
  - `researchAgentService.js` - Core research functionality
  - `roadmapLlmService.js` - Enhanced roadmap generation
  - `llmClient.js` - LLM communication abstraction

#### b) Strategy Pattern
- **Purpose**: Multiple roadmap generation strategies
- **Implementation**:
  ```javascript
  // Basic LLM strategy
  async function generateRoadmapWithLLM(userId, useResearchAgent = false) {
    if (useResearchAgent && profile?.skill) {
      // Research-enhanced strategy
      return await generateComprehensiveRoadmap(...);
    }
    // Fallback to basic LLM strategy
    return await basicLLMGeneration(...);
  }
  ```

#### c) Factory Pattern
- **Purpose**: Content source selection and ranking
- **Implementation**:
  ```javascript
  async function getCuratedSources(query) {
    // Factory creates appropriate source configurations
    // based on query topic detection
  }
  ```

#### d) Observer Pattern (Implicit)
- **Purpose**: Error handling and fallback mechanisms
- **Implementation**: Graceful degradation when external services fail

#### e) Facade Pattern
- **Purpose**: Simplified interface for complex research operations
- **Implementation**: Research agent provides unified interface for search, scrape, and analyze operations

### 3. Component Breakdown

#### New Components Added

##### A) ResearchAgentService (`src/services/researchAgentService.js`)

**Responsibilities:**
- Web search coordination
- Content scraping and summarization
- Resource ranking and quality assessment
- Comprehensive roadmap generation
- Multi-source content synthesis

**Key Methods:**
```javascript
performWebSearch(query, maxResults)
scrapeAndSummarize(url, title)
generateComprehensiveRoadmap(topic, options)
rankResources(searchResults, scrapedContent)
```

**Design Features:**
- **Error Resilience**: Graceful fallback to curated sources
- **Rate Limiting**: Built-in request throttling
- **Content Quality Assessment**: Automated scoring system
- **Modular Architecture**: Each function has single responsibility

##### B) Research Routes (`src/routes/research.js`)

**Endpoints Added:**
- `POST /api/research/roadmap` - Generate comprehensive roadmaps
- `GET /api/research/search` - Perform web searches
- `POST /api/research/scrape` - Scrape and summarize content
- `POST /api/research/analyze-topic` - Deep topic analysis
- `POST /api/research/compare-resources` - Compare learning resources
- `GET /api/research/status` - Service health check

**Validation Strategy:**
- Express-validator middleware for input sanitization
- Comprehensive error handling with descriptive messages
- Authentication requirement for all endpoints

#### Enhanced Components

##### A) Enhanced RoadmapLlmService
**Changes Made:**
- Added optional research agent integration
- Fallback mechanism for basic LLM generation
- Enhanced metadata storage for roadmaps
- Support for web-sourced content integration

##### B) Enhanced Roadmap Model (Implicit)
**New Fields:**
```javascript
{
  steps: [...],
  metadata: {
    generatedWith: 'research-agent' | 'basic-llm',
    sources: [...], // Web sources used
    generatedAt: Date
  }
}
```

### 4. Data Flow Architecture

#### Research-Enhanced Roadmap Generation Flow

```
User Request → Route Handler → Research Agent Service
                                      ↓
                              Web Search (DuckDuckGo)
                                      ↓
                              Content Scraping (Parallel)
                                      ↓
                              Resource Ranking & Quality Assessment
                                      ↓
                              LLM Synthesis (Ollama)
                                      ↓
                              Roadmap Formatting & Storage
                                      ↓
                              Response to User
```

#### Fallback Mechanism Flow

```
Research Agent Failure → Error Logging → Basic LLM Generation → Response
```

### 5. Integration Points

#### A) Ollama LLM Integration
- **Connection**: HTTP API at `http://127.0.0.1:11434`
- **Models Used**:
  - `llama3:8b` - Primary model for comprehensive roadmaps
  - `codellama:7b` - Code-specific roadmaps (future enhancement)
  - `phi3:mini` - Lightweight operations
- **Communication Protocol**: REST API with JSON payloads

#### B) External Web Services
- **DuckDuckGo Instant Answer API**: Primary search source
- **Curated Educational Sources**: Fallback content sources
- **Web Scraping**: Cheerio-based HTML parsing

#### C) Database Integration
- **Enhanced Models**: Roadmap model with metadata support
- **Backward Compatibility**: Existing API endpoints remain functional
- **Data Persistence**: Research results cached in database

### 6. Security Considerations

#### A) Input Validation
- All user inputs validated using express-validator
- URL validation for scraping endpoints
- Query sanitization for search operations

#### B) Rate Limiting
- Per-endpoint rate limiting implemented
- User-based request throttling
- Circuit breaker pattern for external services

#### C) Content Security
- User-Agent rotation for web scraping
- Timeout mechanisms for external requests
- Content sanitization for scraped data

#### D) Authentication & Authorization
- JWT-based authentication required for all endpoints
- User context preserved throughout request lifecycle
- Role-based access control ready for future implementation

### 7. Performance Optimizations

#### A) Asynchronous Operations
- Parallel content scraping using `Promise.allSettled()`
- Non-blocking LLM calls
- Concurrent web searches

#### B) Caching Strategy
- Content caching for frequently requested topics
- Search result caching (ready for implementation)
- LLM response caching for common queries

#### C) Resource Management
- Connection pooling for HTTP requests
- Memory-efficient content processing
- Timeout controls for long-running operations

### 8. Error Handling & Resilience

#### A) Graceful Degradation
```javascript
try {
  // Research-enhanced generation
  return await generateComprehensiveRoadmap(...);
} catch (error) {
  console.error('Research agent failed, falling back...');
  // Basic LLM generation
  return await basicLLMGeneration(...);
}
```

#### B) Circuit Breaker Pattern
- Automatic fallback when external services fail
- Service health monitoring
- Recovery mechanisms

#### C) Comprehensive Error Logging
- Structured error logging with context
- Error categorization for debugging
- Performance metrics collection

### 9. API Design Principles

#### A) RESTful Design
- Consistent endpoint naming conventions
- Proper HTTP status codes
- Resource-based URL structure

#### B) Response Standardization
```javascript
{
  "success": boolean,
  "data": {...},
  "message": string,
  "error": string? // Only on errors
}
```

#### C) Backward Compatibility
- Existing endpoints unchanged
- Optional parameters for new features
- Version-agnostic implementation

### 10. Monitoring & Observability

#### A) Health Check Endpoint
- Service status verification
- Dependency health monitoring
- Performance metrics exposure

#### B) Logging Strategy
- Request/response logging
- Error tracking with stack traces
- Performance timing logs

#### C) Metrics Collection (Ready for Implementation)
- Request rate monitoring
- Success/failure rates
- Response time tracking

### 11. Future Enhancement Opportunities

#### A) Caching Layer
- Redis integration for content caching
- Search result caching
- LLM response memoization

#### B) Advanced AI Features
- Multi-model ensemble for better results
- Personalized content recommendations
- Adaptive learning path optimization

#### C) Real-time Features
- WebSocket integration for live updates
- Progressive roadmap generation
- Real-time collaboration features

#### D) Analytics Integration
- User behavior tracking
- Content effectiveness metrics
- A/B testing framework

### 12. Dependencies Added

#### Production Dependencies
```json
{
  "axios": "^1.7.2",           // HTTP client for web requests
  "cheerio": "^1.0.0-rc.12",   // Server-side HTML parsing
  "node-html-parser": "^6.1.12" // Alternative HTML parser
}
```

#### Key Dependency Rationale
- **Axios**: Robust HTTP client with timeout/retry capabilities
- **Cheerio**: jQuery-like server-side HTML manipulation
- **Node-HTML-Parser**: Lightweight alternative for HTML parsing

### 13. Testing Strategy

#### A) Unit Testing (Recommended)
- Service layer function testing
- LLM integration testing
- Error handling validation

#### B) Integration Testing
- End-to-end API testing
- External service mocking
- Database integration testing

#### C) Performance Testing
- Load testing for concurrent requests
- Memory usage monitoring
- Response time optimization

### 14. Deployment Considerations

#### A) Environment Variables
```env
OLLAMA_URL=http://127.0.0.1:11434
OLLAMA_MODEL=llama3:8b
RESEARCH_AGENT_ENABLED=true
```

#### B) Docker Configuration
- Ollama service dependency
- Network configuration for LLM access
- Resource allocation for AI operations

#### C) Production Readiness
- Error monitoring integration
- Performance optimization
- Scalability planning

## Summary

The Research Agent implementation successfully integrates advanced AI capabilities into the existing SkillForge architecture while maintaining:

- **Backward Compatibility**: All existing functionality preserved
- **Scalability**: Modular design supports future enhancements
- **Reliability**: Comprehensive error handling and fallback mechanisms
- **Security**: Input validation and authentication enforcement
- **Performance**: Asynchronous operations and optimization strategies

The implementation follows established software engineering principles and provides a solid foundation for future AI-powered educational features.
