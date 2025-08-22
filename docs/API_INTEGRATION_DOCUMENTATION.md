# SkillForge API Integration Documentation

## Overview

This document outlines the integration between the SkillForge frontend application and the backend API services, with a focus on the Research Agent API. It provides implementation details, usage patterns, and best practices for frontend developers.

## API Service Architecture

### Core Services

| Service | Description | Angular Service |
|---------|-------------|---------------|
| Authentication | User login, registration, and token management | `AuthService` |
| Profile | User profile management and preferences | `ProfileService` |
| Roadmap | Learning path generation and management | `RoadmapService` |
| Research Agent | AI-powered research capabilities | `ResearchAgentService` |
| Lessons | Lesson content and progress tracking | `LessonService` |
| Gamification | Points, badges, and leaderboards | `GamificationService` |

### Service Integration Pattern

All API services follow a consistent pattern:

1. Angular services extend or use the core `ApiService`
2. JWT authentication is handled via `AuthInterceptor`
3. Error handling is standardized across all services
4. Response models match backend DTOs

## Research Agent API Integration

### Service Implementation

The `ResearchAgentService` is the primary interface for interacting with the Research Agent API. It provides methods for all endpoints documented in the POSTMAN_TESTING_GUIDE.md.

```typescript
@Injectable({
  providedIn: 'root'
})
export class ResearchAgentService {
  constructor(private apiService: ApiService) {}

  // Check if the Research Agent is operational
  getStatus(): Observable<ResearchAgentStatus> {
    return this.apiService.get<ResearchAgentStatus>('/api/research/status');
  }

  // Generate a comprehensive learning roadmap
  generateRoadmap(params: RoadmapGenerationParams): Observable<RoadmapResponse> {
    return this.apiService.post<RoadmapResponse>('/api/research/roadmap', params);
  }

  // Perform web search
  webSearch(query: string, limit?: number): Observable<SearchResults> {
    const params = new HttpParams()
      .set('q', query)
      .set('limit', limit ? limit.toString() : '5');
    return this.apiService.get<SearchResults>('/api/research/search', { params });
  }

  // Scrape content from a URL
  scrapeContent(url: string): Observable<ScrapedContent> {
    return this.apiService.post<ScrapedContent>('/api/research/scrape', { url });
  }

  // Analyze a topic
  analyzeTopic(topic: string, depth: 'overview' | 'detailed' | 'comprehensive' = 'detailed'): Observable<TopicAnalysis> {
    return this.apiService.post<TopicAnalysis>('/api/research/analyze-topic', { topic, depth });
  }

  // Compare learning resources
  compareResources(topic: string, urls: string[]): Observable<ResourceComparison> {
    return this.apiService.post<ResourceComparison>('/api/research/compare-resources', { topic, urls });
  }
}
```

### Data Models

```typescript
// Research Agent Status
export interface ResearchAgentStatus {
  operational: boolean;
  ollamaConnected: boolean;
  capabilities: string[];
  version: string;
}

// Roadmap Generation Parameters
export interface RoadmapGenerationParams {
  topic: string;
  level: 'beginner' | 'intermediate' | 'advanced';
  timeframe: number; // in weeks
  dailyTimeMinutes: number;
  focus?: string;
  includeProjects?: boolean;
}

// Roadmap Response
export interface RoadmapResponse {
  id: string;
  topic: string;
  level: string;
  overview: string;
  prerequisites: string[];
  steps: RoadmapStep[];
  projects?: RoadmapProject[];
  milestones: RoadmapMilestone[];
  estimatedCompletionWeeks: number;
  sources?: string[];
}

export interface RoadmapStep {
  id: string;
  title: string;
  description: string;
  resources: Resource[];
  estimatedHours: number;
  order: number;
}

export interface RoadmapProject {
  id: string;
  title: string;
  description: string;
  skills: string[];
  complexity: 'basic' | 'intermediate' | 'advanced';
  estimatedHours: number;
}

export interface RoadmapMilestone {
  id: string;
  title: string;
  description: string;
  weekNumber: number;
}

export interface Resource {
  title: string;
  url?: string;
  type: 'article' | 'video' | 'course' | 'book' | 'tool' | 'other';
  description?: string;
  estimatedMinutes?: number;
}

// Search Results
export interface SearchResults {
  query: string;
  results: SearchResult[];
}

export interface SearchResult {
  title: string;
  url: string;
  description: string;
}

// Scraped Content
export interface ScrapedContent {
  url: string;
  title: string;
  content: string;
  summary: string;
  readingTimeMinutes: number;
  topics: string[];
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
}

// Topic Analysis
export interface TopicAnalysis {
  topic: string;
  overview: string;
  keyAreas: string[];
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  prerequisites: string[];
  careerRelevance: string;
  estimatedLearningTimeHours: number;
  recommendedApproach: string;
}

// Resource Comparison
export interface ResourceComparison {
  topic: string;
  summary: string;
  bestOption: string;
  resources: ComparedResource[];
}

export interface ComparedResource {
  url: string;
  title: string;
  strengths: string[];
  weaknesses: string[];
  suitableFor: string[];
  rating: number; // 1-10
}
```

## Integration Patterns

### 1. Research Agent Status Check

Implement a status check before using Research Agent features to ensure the service is available.

```typescript
// Component example
export class ResearchFeatureComponent implements OnInit {
  researchAvailable = false;

  constructor(private researchService: ResearchAgentService) {}

  ngOnInit() {
    this.checkResearchStatus();
  }

  private checkResearchStatus() {
    this.researchService.getStatus().pipe(
      tap(status => this.researchAvailable = status.operational),
      catchError(error => {
        this.researchAvailable = false;
        return of(null);
      })
    ).subscribe();
  }
}
```

### 2. Roadmap Generation with Research Enhancement

Integrate the Research Agent's roadmap generation with the existing roadmap service.

```typescript
// Enhanced RoadmapService
export class RoadmapService {
  constructor(
    private apiService: ApiService,
    private researchService: ResearchAgentService
  ) {}

  generateEnhancedRoadmap(params: RoadmapParams): Observable<Roadmap> {
    return this.researchService.getStatus().pipe(
      switchMap(status => {
        if (status.operational) {
          // Use research-enhanced roadmap generation
          return this.researchService.generateRoadmap({
            topic: params.skill,
            level: params.level,
            timeframe: params.timeframeWeeks,
            dailyTimeMinutes: params.dailyTimeMinutes,
            focus: params.focus,
            includeProjects: true
          }).pipe(
            map(researchRoadmap => this.mapResearchRoadmapToRoadmap(researchRoadmap))
          );
        } else {
          // Fallback to standard roadmap generation
          return this.generateRoadmapLlm(params);
        }
      }),
      catchError(error => {
        // Fallback to standard roadmap generation on error
        return this.generateRoadmapLlm(params);
      })
    );
  }

  private mapResearchRoadmapToRoadmap(researchRoadmap: RoadmapResponse): Roadmap {
    // Map the research roadmap response to the standard roadmap model
    // Implementation details...
  }
}
```

### 3. Topic Analysis for Onboarding

Enhance the onboarding experience with topic analysis.

```typescript
// Onboarding component example
export class SkillSelectionComponent {
  selectedSkill: string;
  skillAnalysis: TopicAnalysis;
  isAnalyzing = false;

  constructor(private researchService: ResearchAgentService) {}

  analyzeSkill() {
    if (!this.selectedSkill) return;
    
    this.isAnalyzing = true;
    this.researchService.analyzeTopic(this.selectedSkill, 'overview').pipe(
      finalize(() => this.isAnalyzing = false)
    ).subscribe(analysis => {
      this.skillAnalysis = analysis;
      // Use analysis to suggest level, prerequisites, etc.
    });
  }
}
```

### 4. Resource Comparison for Lessons

Implement resource comparison to suggest the best learning materials.

```typescript
// Lesson resources component example
export class LessonResourcesComponent {
  topic: string;
  resourceUrls: string[] = [];
  comparison: ResourceComparison;
  isComparing = false;

  constructor(private researchService: ResearchAgentService) {}

  compareResources() {
    if (!this.topic || this.resourceUrls.length < 2) return;
    
    this.isComparing = true;
    this.researchService.compareResources(this.topic, this.resourceUrls).pipe(
      finalize(() => this.isComparing = false)
    ).subscribe(comparison => {
      this.comparison = comparison;
      // Use comparison to highlight best resources
    });
  }
}
```

## Error Handling and Fallbacks

### Error Handling Strategy

Implement a consistent error handling strategy across all API integrations:

```typescript
// Error handling service
@Injectable({
  providedIn: 'root'
})
export class ErrorHandlingService {
  handleApiError(error: HttpErrorResponse): Observable<never> {
    let errorMessage = 'An unknown error occurred';
    
    if (error.error instanceof ErrorEvent) {
      // Client-side error
      errorMessage = `Error: ${error.error.message}`;
    } else {
      // Server-side error
      errorMessage = `Error Code: ${error.status}\nMessage: ${error.message}`;
    }
    
    // Log the error
    console.error(errorMessage);
    
    // Return an observable with a user-facing error message
    return throwError(() => new Error(errorMessage));
  }
}
```

### Fallback Mechanisms

Implement fallback mechanisms for when the Research Agent is unavailable:

```typescript
// Example of fallback implementation in a component
export class SkillSearchComponent {
  searchResults: SearchResult[] = [];
  isSearching = false;
  
  constructor(
    private researchService: ResearchAgentService,
    private fallbackService: FallbackSearchService
  ) {}
  
  searchSkill(query: string) {
    this.isSearching = true;
    
    this.researchService.webSearch(query).pipe(
      catchError(error => {
        // Fallback to basic search
        return this.fallbackService.search(query);
      }),
      finalize(() => this.isSearching = false)
    ).subscribe(results => {
      this.searchResults = results.results;
    });
  }
}
```

## Performance Optimization

### Caching Strategy

Implement caching for frequently accessed data:

```typescript
// Cache service for API responses
@Injectable({
  providedIn: 'root'
})
export class ApiCacheService {
  private cache = new Map<string, any>();
  private cacheTTL = 5 * 60 * 1000; // 5 minutes

  get<T>(key: string): T | null {
    if (!this.cache.has(key)) return null;
    
    const cachedItem = this.cache.get(key);
    if (Date.now() - cachedItem.timestamp > this.cacheTTL) {
      this.cache.delete(key);
      return null;
    }
    
    return cachedItem.data as T;
  }

  set(key: string, data: any): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  clear(): void {
    this.cache.clear();
  }
}
```

### Request Debouncing

Implement debouncing for user input to prevent excessive API calls:

```typescript
// Component example with debounced search
export class SearchComponent {
  searchTerm = new FormControl('');
  searchResults: SearchResult[] = [];
  
  constructor(private researchService: ResearchAgentService) {
    this.searchTerm.valueChanges.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      filter(term => !!term && term.length > 2),
      switchMap(term => this.researchService.webSearch(term))
    ).subscribe(results => {
      this.searchResults = results.results;
    });
  }
}
```

## Security Considerations

### Authentication

All API requests must include the JWT token for authentication:

```typescript
// Auth interceptor (already implemented)
@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  constructor(private authService: AuthService) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    const token = this.authService.getToken();
    
    if (token) {
      const authReq = req.clone({
        headers: req.headers.set('Authorization', `Bearer ${token}`)
      });
      return next.handle(authReq);
    }
    
    return next.handle(req);
  }
}
```

### Input Validation

Implement client-side validation before sending requests:

```typescript
// Validation service
@Injectable({
  providedIn: 'root'
})
export class ValidationService {
  validateRoadmapParams(params: RoadmapGenerationParams): boolean {
    if (!params.topic || params.topic.trim().length < 3) return false;
    if (!['beginner', 'intermediate', 'advanced'].includes(params.level)) return false;
    if (params.timeframe < 1 || params.timeframe > 52) return false;
    if (params.dailyTimeMinutes < 15 || params.dailyTimeMinutes > 240) return false;
    
    return true;
  }
  
  validateUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch (e) {
      return false;
    }
  }
}
```

## Implementation Roadmap

### Phase 1: Core Integration

1. Implement `ResearchAgentService` with all API endpoints
2. Create data models for all API responses
3. Implement error handling and fallback mechanisms
4. Add status check integration

### Phase 2: Feature Integration

1. Enhance `RoadmapService` with research-based roadmap generation
2. Implement topic analysis in the onboarding flow
3. Add web search functionality to the landing page
4. Implement content scraping for lesson resources

### Phase 3: Advanced Features

1. Implement resource comparison for lesson recommendations
2. Add caching for performance optimization
3. Implement debouncing for search inputs
4. Create fallback mechanisms for all research features

## Testing Strategy

### Unit Tests

Implement unit tests for all services and components:

```typescript
// Example test for ResearchAgentService
describe('ResearchAgentService', () => {
  let service: ResearchAgentService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [ResearchAgentService, ApiService]
    });
    
    service = TestBed.inject(ResearchAgentService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  it('should get research agent status', () => {
    const mockStatus: ResearchAgentStatus = {
      operational: true,
      ollamaConnected: true,
      capabilities: ['web_search', 'content_scraping', 'roadmap_generation'],
      version: '1.0.0'
    };
    
    service.getStatus().subscribe(status => {
      expect(status).toEqual(mockStatus);
    });
    
    const req = httpMock.expectOne('/api/research/status');
    expect(req.request.method).toBe('GET');
    req.flush(mockStatus);
  });
});
```

### Integration Tests

Implement integration tests for component-service interactions:

```typescript
// Example integration test
describe('RoadmapComponent Integration', () => {
  let component: RoadmapComponent;
  let fixture: ComponentFixture<RoadmapComponent>;
  let roadmapService: RoadmapService;
  let researchService: ResearchAgentService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [RoadmapComponent],
      providers: [
        { provide: RoadmapService, useValue: jasmine.createSpyObj('RoadmapService', ['generateEnhancedRoadmap']) },
        { provide: ResearchAgentService, useValue: jasmine.createSpyObj('ResearchAgentService', ['getStatus']) }
      ]
    }).compileComponents();
    
    fixture = TestBed.createComponent(RoadmapComponent);
    component = fixture.componentInstance;
    roadmapService = TestBed.inject(RoadmapService);
    researchService = TestBed.inject(ResearchAgentService);
  });

  it('should generate roadmap with research enhancement when available', () => {
    // Test implementation
  });
});
```

## Conclusion

This API integration documentation provides a comprehensive guide for implementing the Research Agent API in the SkillForge frontend. By following these patterns and best practices, developers can ensure a robust, performant, and secure integration that enhances the user experience with AI-powered features.