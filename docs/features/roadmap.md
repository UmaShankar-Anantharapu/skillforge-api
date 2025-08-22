# Personalized Learning Roadmap

## Overview

The Personalized Learning Roadmap is a core feature of CareerLeap that provides users with an AI-generated learning plan tailored to their goals, skill level, and available time. This document details the implementation, flow, and enhancement recommendations for the roadmap feature.

## Current Implementation

### Backend Implementation

#### Models

**Roadmap Model** (`/skillforge-api/src/models/Roadmap.js`)

Stores the user's personalized learning path:

```javascript
const roadmapSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  steps: [{
    day: { type: Number, required: true },
    topic: { type: String, required: true },
    lessonIds: [{ type: String }]
  }]
});
```

#### Services

**Roadmap LLM Service** (`/skillforge-api/src/services/roadmapLlmService.js`)

Generates personalized roadmaps using LLM:

1. **buildPrompt**
   - Constructs a prompt for the LLM based on user profile and skill memory bank data
   - Includes user's goal, skill level, available time, and current knowledge

2. **generateRoadmapWithLLM**
   - Uses the LLM to create a 7-day microlearning roadmap
   - Optionally uses a research agent for enhanced roadmap generation
   - Saves the generated roadmap to the Roadmap model

```javascript
async function generateRoadmapWithLLM(userId, useResearchAgent = false) {
  try {
    const userProfile = await UserProfile.findOne({ userId });
    const skillMemoryBank = await SkillMemoryBank.find({ userId });
    
    // Prioritize using research agent for enhanced roadmap
    if (useResearchAgent && userProfile.skill) {
      try {
        const researchAgentRoadmap = await researchAgentService.generateComprehensiveRoadmap(
          userProfile.skill,
          userProfile.level,
          userProfile.goal
        );
        
        // Convert research agent roadmap to system format
        const formattedRoadmap = convertResearchRoadmapToSystemFormat(researchAgentRoadmap);
        await saveRoadmap(userId, formattedRoadmap);
        return formattedRoadmap;
      } catch (error) {
        console.error('Research agent failed, falling back to basic LLM:', error);
        // Fall back to basic LLM generation
      }
    }
    
    // Basic LLM roadmap generation
    const prompt = buildPrompt(userProfile, skillMemoryBank);
    const completion = await llm.complete(prompt);
    const roadmapData = parseRoadmapFromLLMResponse(completion);
    
    await saveRoadmap(userId, roadmapData);
    return roadmapData;
  } catch (error) {
    console.error('Error generating roadmap with LLM:', error);
    throw error;
  }
}
```

**Adaptive Engine** (`/skillforge-api/src/services/adaptiveEngine.js`)

Adjusts roadmap based on user performance:

1. **updateRoadmapForWeakAreas**
   - Identifies weak topics from the SkillMemoryBank
   - Prepends a review day to the user's Roadmap

```javascript
async function updateRoadmapForWeakAreas(userId) {
  try {
    // Get user's weak areas
    const weakTopics = await getWeakTopics(userId);
    if (weakTopics.length === 0) return null;
    
    // Create review lessons for weak topics
    const reviewLessons = await createReviewLessons(weakTopics);
    
    // Update roadmap with review day
    const roadmap = await Roadmap.findOne({ userId });
    if (!roadmap) return null;
    
    // Shift existing days forward
    roadmap.steps = roadmap.steps.map(step => ({
      ...step,
      day: step.day + 1
    }));
    
    // Add review day at the beginning
    roadmap.steps.unshift({
      day: 1,
      topic: 'Review of Challenging Topics',
      lessonIds: reviewLessons.map(lesson => lesson._id)
    });
    
    await roadmap.save();
    return roadmap;
  } catch (error) {
    console.error('Error updating roadmap for weak areas:', error);
    throw error;
  }
}
```

### Frontend Implementation

#### Components

The roadmap visualization is implemented in the `/skillforge-ui/src/app/features/roadmap` directory:

1. **Roadmap Overview**
   - Displays the 7-day learning plan
   - Shows topics and estimated time for each day

2. **Daily View**
   - Shows detailed information for the selected day
   - Lists lessons and their types (text, quiz, code)

3. **Progress Tracking**
   - Visualizes completed vs. pending lessons
   - Shows overall roadmap progress

#### Services

**Roadmap Service** (`/skillforge-ui/src/app/core/services/roadmap.service.ts`)

Handles communication with the backend API:

```typescript
@Injectable({
  providedIn: 'root'
})
export class RoadmapService {
  constructor(private http: HttpClient) {}

  getUserRoadmap() {
    return this.http.get('/api/roadmap');
  }

  regenerateRoadmap(useResearchAgent: boolean = false) {
    return this.http.post('/api/roadmap/generate', { useResearchAgent });
  }

  markDayComplete(day: number) {
    return this.http.post(`/api/roadmap/day/${day}/complete`, {});
  }

  getRecommendedTopics() {
    return this.http.get('/api/roadmap/recommendations');
  }
}
```

## Flow Diagram

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│ Onboarding      │────▶│ LLM/Research    │────▶│ Roadmap         │
│ Completion      │     │ Agent Processing│     │ Generation      │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                                        │
                                                        ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│ Adaptive        │◀────│ Performance     │◀────│ User Completes  │
│ Adjustments     │     │ Analysis        │     │ Lessons/Quizzes │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

## Enhancement Recommendations

### Backend Enhancements

1. **Micro-Learning vs. Macro-Learning Paths**
   - Extend the Roadmap model to support both short-term and long-term learning paths
   - Add a `pathType` field to distinguish between micro and macro learning

```javascript
// Add to Roadmap schema
pathType: { type: String, enum: ['micro', 'macro'], default: 'micro' },
macroMilestones: [{
  milestone: { type: String },
  estimatedCompletionDate: { type: Date },
  topics: [{ type: String }],
  completed: { type: Boolean, default: false }
}],
```

2. **Real-time Web Scraping Integration**
   - Enhance the research agent to incorporate real-time industry trends
   - Implement a caching system for scraped content to improve performance

```javascript
// New service: webScrapingService.js
async function getLatestTrendsForSkill(skill) {
  // Implement web scraping logic for latest trends
  // Return structured data about current industry trends
}

// Update roadmapLlmService.js to use scraped data
const latestTrends = await webScrapingService.getLatestTrendsForSkill(userProfile.skill);
prompt += `\nIncorporate these latest industry trends: ${JSON.stringify(latestTrends)}`;
```

3. **Dynamic Roadmap Adjustment**
   - Implement more sophisticated algorithms for roadmap adaptation
   - Consider user feedback and explicit ratings of content

```javascript
// Add to adaptiveEngine.js
async function adjustRoadmapBasedOnFeedback(userId, lessonId, rating) {
  // Adjust future roadmap based on explicit user feedback
  // If user rates content poorly, find alternative approaches to the topic
}
```

4. **Collaborative Learning Paths**
   - Allow users to share and follow others' roadmaps
   - Implement roadmap templates for common learning goals

```javascript
// Add to Roadmap schema
isPublic: { type: Boolean, default: false },
sharedWith: [{ type: String }], // Array of userIds
templateName: { type: String }, // If this is a template roadmap
```

### Frontend Enhancements

1. **Calendar Integration**
   - Add calendar view for roadmap visualization
   - Enable export to external calendars (Google, Outlook, etc.)
   - Implement scheduling features with reminders

2. **Interactive Roadmap Visualization**
   - Implement a graph-based visualization showing topic relationships
   - Add drag-and-drop interface for manual roadmap adjustments
   - Include skill dependency visualization

3. **Progress Analytics**
   - Add detailed progress tracking with time spent on each topic
   - Visualize learning velocity and projected completion dates
   - Compare progress against similar users

4. **Roadmap Sharing**
   - Add social sharing features for roadmaps
   - Implement "follow this roadmap" functionality
   - Create leaderboards for popular roadmap templates

5. **Milestone Celebrations**
   - Add animations and rewards for completing roadmap milestones
   - Implement shareable achievement cards

## Integration Points

1. **Onboarding System**
   - Roadmap generation triggered by onboarding completion
   - User preferences from onboarding inform roadmap content

2. **Lesson System**
   - Roadmap steps link to specific lessons
   - Lesson completion updates roadmap progress

3. **Adaptive Engine**
   - Performance in lessons triggers roadmap adjustments
   - Weak areas identified by the adaptive engine inform review days

4. **External Calendars**
   - Export roadmap to Google Calendar, Outlook, etc.
   - Sync progress with external systems

## Testing Strategy

1. **Unit Tests**
   - Test roadmap generation with various user profiles
   - Test adaptive adjustments with different performance scenarios

2. **Integration Tests**
   - Test end-to-end flow from onboarding to roadmap generation
   - Test roadmap updates based on lesson completion

3. **User Testing**
   - Evaluate roadmap clarity and usefulness
   - Measure adherence to roadmap schedule

## Security Considerations

1. **Data Privacy**
   - Ensure roadmap data is only accessible to the user and authorized parties
   - Implement proper access controls for shared roadmaps

2. **External API Security**
   - Secure communication with LLM and research agent
   - Implement rate limiting for roadmap generation

## Performance Considerations

1. **Optimized LLM Calls**
   - Implement caching for similar roadmap requests
   - Batch process roadmap generations during off-peak hours

2. **Efficient Roadmap Storage**
   - Optimize database schema for quick roadmap retrieval
   - Implement pagination for long-term roadmaps

## Conclusion

The Personalized Learning Roadmap is a key differentiator for CareerLeap, providing users with a tailored learning experience. By implementing the recommended enhancements, the platform can offer more flexible, engaging, and effective learning paths that adapt to user needs and performance.