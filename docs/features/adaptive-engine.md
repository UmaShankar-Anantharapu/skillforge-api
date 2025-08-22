# Adaptive Learning Engine

## Overview

The Adaptive Learning Engine is a core component of CareerLeap that tracks user performance and adjusts content based on strengths and weaknesses. This intelligent system ensures that learning is personalized and efficient, focusing on areas where users need the most help. This document details the implementation, flow, and enhancement recommendations for the adaptive learning engine.

## Current Implementation

### Backend Implementation

#### Models

**SkillMemoryBank Model** (`/skillforge-api/src/models/SkillMemoryBank.js`)

Stores user knowledge levels for different topics:

```javascript
const skillMemoryBankSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  skill: { type: String, required: true },
  topic: { type: String, required: true },
  strengthLevel: { type: Number, default: 50 }, // 0-100 scale
  lastUpdated: { type: Date, default: Date.now }
});

// Compound index to ensure unique combination of userId, skill, and topic
skillMemoryBankSchema.index({ userId: 1, skill: 1, topic: 1 }, { unique: true });
```

#### Services

**Memory Service** (`/skillforge-api/src/services/memoryService.js`)

Handles updates to the user's knowledge levels:

1. **calculateDeltaFromScore**
   - Determines how much to adjust the strength level based on quiz/exercise performance
   - Higher scores result in larger positive adjustments, lower scores in negative adjustments

```javascript
function calculateDeltaFromScore(score) {
  if (score >= 90) return 12;
  if (score >= 80) return 8;
  if (score >= 70) return 5;
  if (score >= 60) return 2;
  return -10; // Score below 60 indicates significant weakness
}
```

2. **updateMemoryFromScore**
   - Updates the SkillMemoryBank based on user performance
   - Creates new entries if a topic doesn't exist
   - Ensures strength level stays within 0-100 range

```javascript
async function updateMemoryFromScore(userId, skill, topic, score) {
  try {
    const delta = calculateDeltaFromScore(score);
    
    // Find existing entry or create new one
    let memoryEntry = await SkillMemoryBank.findOne({ userId, skill, topic });
    
    if (memoryEntry) {
      // Update existing entry
      memoryEntry.strengthLevel = Math.min(100, Math.max(0, memoryEntry.strengthLevel + delta));
      memoryEntry.lastUpdated = Date.now();
      await memoryEntry.save();
    } else {
      // Create new entry with initial strength based on score
      const initialStrength = 50 + delta; // Base of 50 adjusted by performance
      memoryEntry = await SkillMemoryBank.create({
        userId,
        skill,
        topic,
        strengthLevel: Math.min(100, Math.max(0, initialStrength)),
        lastUpdated: Date.now()
      });
    }
    
    return memoryEntry;
  } catch (error) {
    console.error('Error updating memory from score:', error);
    throw error;
  }
}
```

**Adaptive Engine** (`/skillforge-api/src/services/adaptiveEngine.js`)

Handles personalization logic:

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

2. **getRecommendations**
   - Suggests topics for review based on the user's weakest areas
   - Used for dashboard recommendations

```javascript
async function getRecommendations(userId) {
  try {
    // Get user's weak areas
    const weakTopics = await getWeakTopics(userId, 3); // Get top 3 weak areas
    
    // Get relevant lessons for these topics
    const recommendations = [];
    
    for (const topic of weakTopics) {
      const lessons = await Lesson.find({
        skill: topic.skill,
        concepts: topic.topic,
        difficulty: { $in: ['beginner', 'intermediate'] } // Start with easier content
      }).limit(2);
      
      recommendations.push({
        topic: topic.topic,
        strengthLevel: topic.strengthLevel,
        lessons: lessons.map(lesson => ({
          lessonId: lesson.lessonId,
          title: lesson.content.title,
          type: lesson.type
        }))
      });
    }
    
    return recommendations;
  } catch (error) {
    console.error('Error getting recommendations:', error);
    throw error;
  }
}
```

3. **getWeakTopics**
   - Helper function to identify user's weakest topics
   - Considers both strength level and last updated time

```javascript
async function getWeakTopics(userId, limit = 5) {
  try {
    // Get topics with low strength levels
    const weakTopics = await SkillMemoryBank.find({ userId, strengthLevel: { $lt: 60 } })
      .sort({ strengthLevel: 1 }) // Lowest strength first
      .limit(limit);
    
    // If not enough weak topics, include topics not updated recently
    if (weakTopics.length < limit) {
      const twoWeeksAgo = new Date();
      twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
      
      const staleTopics = await SkillMemoryBank.find({
        userId,
        lastUpdated: { $lt: twoWeeksAgo },
        _id: { $nin: weakTopics.map(t => t._id) }
      })
        .sort({ lastUpdated: 1 }) // Oldest first
        .limit(limit - weakTopics.length);
      
      return [...weakTopics, ...staleTopics];
    }
    
    return weakTopics;
  } catch (error) {
    console.error('Error getting weak topics:', error);
    throw error;
  }
}
```

### Frontend Implementation

#### Components

The adaptive engine results are displayed in various parts of the frontend:

1. **Dashboard Recommendations**
   - Shows suggested topics for review
   - Displays strength levels for different skills

2. **Progress Tracking**
   - Visualizes skill mastery levels
   - Shows improvement over time

#### Services

**Progress Service** (`/skillforge-ui/src/app/core/services/progress.service.ts`)

Handles communication with the backend API for progress and recommendations:

```typescript
@Injectable({
  providedIn: 'root'
})
export class ProgressService {
  constructor(private http: HttpClient) {}

  getSkillStrengths() {
    return this.http.get('/api/progress/skills');
  }

  getTopicStrengths(skill: string) {
    return this.http.get(`/api/progress/skills/${skill}/topics`);
  }

  getRecommendations() {
    return this.http.get('/api/recommendations');
  }

  getProgressOverTime(skill: string, period: string = 'month') {
    return this.http.get(`/api/progress/history/${skill}?period=${period}`);
  }
}
```

## Flow Diagram

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│ User Completes  │────▶│ Memory Service  │────▶│ SkillMemoryBank │
│ Lesson/Quiz     │     │ Updates Strength│     │ Updated         │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                                        │
                                                        ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│ Updated Roadmap │◀────│ Adaptive Engine │◀────│ Weak Topics     │
│ & Recommendations│     │ Analyzes Data   │     │ Identified      │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

## Enhancement Recommendations

### Backend Enhancements

1. **Sophisticated Knowledge Tracking**
   - Implement a more nuanced knowledge model with multiple dimensions
   - Track conceptual understanding, application ability, and retention separately

```javascript
// Enhanced SkillMemoryBank schema
const skillMemoryBankSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  skill: { type: String, required: true },
  topic: { type: String, required: true },
  knowledgeDimensions: {
    conceptualUnderstanding: { type: Number, default: 50 }, // 0-100
    applicationAbility: { type: Number, default: 50 }, // 0-100
    retentionStrength: { type: Number, default: 50 } // 0-100
  },
  confidenceLevel: { type: Number, default: 50 }, // 0-100, user's self-assessment
  lastUpdated: { type: Date, default: Date.now },
  interactionHistory: [{
    date: { type: Date },
    activityType: { type: String }, // 'lesson', 'quiz', 'practice'
    performance: { type: Number }, // 0-100
    timeSpent: { type: Number } // in seconds
  }]
});
```

2. **Spaced Repetition System**
   - Implement an algorithm like SuperMemo or Anki for optimal retention
   - Schedule reviews based on forgetting curves

```javascript
// New service: spacedRepetitionService.js
async function calculateNextReviewDate(userId, topic, performance) {
  // Get current interval for this topic
  const memoryEntry = await SkillMemoryBank.findOne({ userId, topic });
  const currentInterval = memoryEntry.reviewInterval || 1; // days
  
  // Calculate ease factor based on performance
  const easeFactor = calculateEaseFactor(performance, memoryEntry.easeFactor || 2.5);
  
  // Calculate new interval using SM-2 algorithm
  let newInterval;
  if (performance < 3) { // Poor performance
    newInterval = 1; // Reset to 1 day
  } else {
    if (currentInterval === 1) newInterval = 6;
    else newInterval = Math.round(currentInterval * easeFactor);
  }
  
  // Calculate next review date
  const nextReview = new Date();
  nextReview.setDate(nextReview.getDate() + newInterval);
  
  // Update memory entry
  memoryEntry.reviewInterval = newInterval;
  memoryEntry.easeFactor = easeFactor;
  memoryEntry.nextReviewDate = nextReview;
  await memoryEntry.save();
  
  return nextReview;
}
```

3. **Learning Pattern Analytics**
   - Implement more detailed tracking of learning patterns
   - Analyze optimal learning times, session durations, and content types

```javascript
// New model: LearningAnalytics.js
const learningAnalyticsSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  sessions: [{
    startTime: { type: Date },
    endTime: { type: Date },
    contentTypes: [{ type: String }], // 'text', 'video', 'quiz', etc.
    performance: { type: Number }, // Average performance in session
    focusScore: { type: Number }, // Estimated focus level based on interaction
    interruptions: { type: Number } // Number of times user left the app
  }],
  patterns: {
    optimalTimeOfDay: { type: String }, // 'morning', 'afternoon', 'evening'
    optimalSessionDuration: { type: Number }, // in minutes
    preferredContentTypes: [{ type: String }], // Ranked list
    distractionFrequency: { type: Number } // Average interruptions per hour
  }
});
```

4. **Adaptive Difficulty**
   - Implement dynamic difficulty adjustment based on performance
   - Create a system to generate content at appropriate difficulty levels

```javascript
// Add to adaptiveEngine.js
async function determineOptimalDifficulty(userId, skill) {
  // Analyze recent performance
  const recentPerformance = await getRecentPerformance(userId, skill);
  
  // Calculate success rate
  const successRate = recentPerformance.successCount / recentPerformance.totalAttempts;
  
  // Determine optimal difficulty to maintain ~80% success rate
  if (successRate > 0.9) return 'advanced';
  if (successRate > 0.7) return 'intermediate';
  return 'beginner';
}

async function generateAdaptiveContent(userId, skill, topic) {
  const difficulty = await determineOptimalDifficulty(userId, skill);
  
  // Find or generate content at appropriate difficulty
  const content = await findOrGenerateContent(skill, topic, difficulty);
  
  return content;
}
```

### Frontend Enhancements

1. **Detailed Knowledge Maps**
   - Implement visual knowledge maps showing topic relationships
   - Color-code based on strength levels
   - Allow drilling down into specific topics

2. **Personalized Learning Insights**
   - Create a dashboard with personalized insights
   - Show optimal learning times and patterns
   - Provide recommendations for improving learning efficiency

3. **Progress Forecasting**
   - Implement predictive analytics for learning outcomes
   - Show projected mastery dates based on current progress
   - Visualize the impact of increased practice

4. **Learning Style Adaptation**
   - Adjust content presentation based on identified learning style
   - Track which content types lead to better outcomes for each user
   - Recommend optimal content formats

5. **Retention Testing**
   - Implement periodic retention tests for previously mastered content
   - Show retention curves over time
   - Provide targeted refreshers for fading knowledge

## Integration Points

1. **Lesson System**
   - Lesson performance feeds into the adaptive engine
   - Adaptive engine influences lesson selection and sequencing

2. **Roadmap System**
   - Adaptive engine adjusts roadmap based on performance
   - Inserts review days for weak topics

3. **Gamification System**
   - Rewards for improving in weak areas
   - Badges for consistent progress

4. **AI Tutor**
   - Tutor access to strength levels for targeted assistance
   - Personalized explanations based on knowledge gaps

## Testing Strategy

1. **Unit Tests**
   - Test strength level calculations with various inputs
   - Test weak topic identification logic
   - Test recommendation generation

2. **Integration Tests**
   - Test end-to-end flow from lesson completion to roadmap adjustment
   - Test spaced repetition scheduling

3. **User Testing**
   - Evaluate effectiveness of recommendations
   - Measure improvement in weak areas over time
   - Test user perception of adaptive features

## Security Considerations

1. **Data Privacy**
   - Secure storage of performance data
   - User control over learning analytics
   - Anonymization for aggregate analysis

2. **Access Controls**
   - Proper authentication for accessing personal learning data
   - Role-based access for enterprise analytics

## Performance Considerations

1. **Efficient Data Processing**
   - Optimize algorithms for large datasets
   - Implement caching for frequently accessed data
   - Use background processing for complex analytics

2. **Scalable Architecture**
   - Design for horizontal scaling as user base grows
   - Implement database sharding for performance

## Conclusion

The Adaptive Learning Engine is a key differentiator for CareerLeap, enabling truly personalized learning experiences. By implementing the recommended enhancements, the platform can provide more sophisticated adaptation, better retention, and deeper insights into learning patterns, ultimately leading to more efficient and effective skill acquisition.