const { chat } = require('./llmClient');
const { loggingService } = require('./loggingService');
const NodeCache = require('node-cache');

// Cache for processed roadmaps (1 hour TTL)
const roadmapCache = new NodeCache({ stdTTL: 3600 });

/**
 * Ollama Roadmap Processor Service
 * Processes scraped data through Ollama LLM to generate structured, optimized learning roadmaps
 */

/**
 * Process scraped roadmap data through Ollama to generate a personalized roadmap
 * @param {Array} scrapedData - Array of scraped roadmap data from multiple sources
 * @param {Object} userContext - User profile and preferences context
 * @param {Object} options - Processing options
 * @returns {Promise<Object>} Generated structured roadmap
 */
async function processScrapedDataWithOllama(scrapedData, userContext, options = {}) {
  try {
    const {
      targetSkill,
      excludedSkills = [],
      focusAreas = [],
      learningPreferences = {},
      timeline = '12 weeks',
      weeklyHours = 10,
      difficulty = 'intermediate'
    } = userContext;

    const {
      useCache = true,
      provider = 'ollama',
      maxRetries = 2
    } = options;

    loggingService.info(`Processing scraped data for ${targetSkill} roadmap generation`);

    // Check cache first
    const cacheKey = `roadmap_${targetSkill}_${excludedSkills.join('_')}_${timeline}`;
    if (useCache) {
      const cached = roadmapCache.get(cacheKey);
      if (cached) {
        loggingService.info('Returning cached processed roadmap');
        return cached;
      }
    }

    // Prepare context for Ollama
    const processedContext = prepareOllamaContext(scrapedData, userContext);
    
    // Generate structured roadmap with retry logic
    let roadmap = null;
    let lastError = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        roadmap = await generateStructuredRoadmap(processedContext, provider);
        if (roadmap && roadmap.phases && roadmap.phases.length > 0) {
          break; // Success
        }
      } catch (error) {
        lastError = error;
        loggingService.warn(`Roadmap generation attempt ${attempt} failed:`, error.message);
        if (attempt === maxRetries) {
          throw error;
        }
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }

    if (!roadmap) {
      throw lastError || new Error('Failed to generate roadmap after all attempts');
    }

    // Optimize roadmap for user's skill level and preferences
    const optimizedRoadmap = await optimizeForSkillLevel(roadmap, userContext);
    
    // Create personalized learning sequence
    const finalRoadmap = await createLearningSequence(optimizedRoadmap, userContext);

    // Cache the result
    if (useCache && finalRoadmap) {
      roadmapCache.set(cacheKey, finalRoadmap);
    }

    loggingService.info(`Successfully generated roadmap for ${targetSkill}`);
    return finalRoadmap;

  } catch (error) {
    loggingService.error('Failed to process scraped data with Ollama:', error);
    throw new Error(`Roadmap processing failed: ${error.message}`);
  }
}

/**
 * Prepare context data for Ollama processing
 * @param {Array} scrapedData - Scraped roadmap data
 * @param {Object} userContext - User context
 * @returns {Object} Prepared context for Ollama
 */
function prepareOllamaContext(scrapedData, userContext) {
  const {
    targetSkill,
    excludedSkills = [],
    focusAreas = [],
    learningPreferences = {},
    timeline,
    weeklyHours,
    difficulty
  } = userContext;

  // Extract key information from scraped data
  const roadmapSources = scrapedData.map(data => ({
    title: data.title,
    source: data.source,
    structure: data.structure,
    resources: data.resources,
    prerequisites: data.prerequisites,
    estimatedTime: data.estimatedTime,
    difficulty: data.difficulty
  }));

  // Combine all topics and resources
  const allTopics = new Set();
  const allResources = [];
  
  scrapedData.forEach(data => {
    if (data.structure && data.structure.phases) {
      data.structure.phases.forEach(phase => {
        if (phase.topics) {
          phase.topics.forEach(topic => allTopics.add(topic));
        }
      });
    }
    if (data.resources) {
      allResources.push(...data.resources);
    }
  });

  return {
    targetSkill,
    excludedSkills,
    focusAreas,
    learningPreferences,
    timeline,
    weeklyHours,
    difficulty,
    roadmapSources,
    availableTopics: Array.from(allTopics),
    availableResources: allResources,
    sourceCount: scrapedData.length
  };
}

/**
 * Generate structured roadmap using Ollama LLM
 * @param {Object} context - Prepared context data
 * @param {string} provider - LLM provider ('ollama' or 'openrouter')
 * @returns {Promise<Object>} Generated roadmap structure
 */
async function generateStructuredRoadmap(context, provider = 'ollama') {
  try {
    const prompt = buildRoadmapGenerationPrompt(context);
    
    const messages = [
      {
        role: 'system',
        content: 'You are an expert learning path designer. Generate structured, practical learning roadmaps in valid JSON format. Focus on creating clear phases with specific topics, resources, and timelines.'
      },
      {
        role: 'user',
        content: prompt
      }
    ];

    loggingService.info('Sending roadmap generation request to Ollama');
    const response = await chat(messages, provider);
    
    // Parse and validate the response
    const roadmap = parseRoadmapResponse(response);
    
    if (!roadmap || !roadmap.phases) {
      throw new Error('Invalid roadmap structure received from Ollama');
    }

    return roadmap;

  } catch (error) {
    loggingService.error('Structured roadmap generation failed:', error);
    throw error;
  }
}

/**
 * Build the prompt for roadmap generation
 * @param {Object} context - Context data
 * @returns {string} Generated prompt
 */
function buildRoadmapGenerationPrompt(context) {
  const {
    targetSkill,
    excludedSkills,
    focusAreas,
    timeline,
    weeklyHours,
    difficulty,
    roadmapSources,
    availableTopics
  } = context;

  const excludedSkillsText = excludedSkills.length > 0 
    ? `\n\nIMPORTANT: The user already knows these skills, so EXCLUDE them from the roadmap: ${excludedSkills.join(', ')}`
    : '';

  const focusAreasText = focusAreas.length > 0
    ? `\n\nFocus particularly on these areas: ${focusAreas.join(', ')}`
    : '';

  const sourcesText = roadmapSources.length > 0
    ? `\n\nBased on these roadmap sources:\n${roadmapSources.map(s => `- ${s.title} (${s.source}): ${s.estimatedTime || 'N/A'}`).join('\n')}`
    : '';

  return `Create a comprehensive learning roadmap for "${targetSkill}" with these requirements:

**User Context:**
- Timeline: ${timeline}
- Weekly time commitment: ${weeklyHours} hours
- Difficulty level: ${difficulty}${excludedSkillsText}${focusAreasText}

**Available Topics:** ${availableTopics.slice(0, 20).join(', ')}${sourcesText}

**Required JSON Structure:**
\`\`\`json
{
  "title": "${targetSkill} Learning Roadmap",
  "totalDuration": "${timeline}",
  "weeklyHours": ${weeklyHours},
  "difficulty": "${difficulty}",
  "phases": [
    {
      "name": "Phase Name",
      "duration": "2-3 weeks",
      "description": "Phase description",
      "topics": ["Topic 1", "Topic 2", "Topic 3"],
      "learningObjectives": ["Objective 1", "Objective 2"],
      "milestones": ["Milestone 1", "Milestone 2"],
      "estimatedHours": 20
    }
  ],
  "prerequisites": ["Prerequisite 1", "Prerequisite 2"],
  "learningOutcomes": ["Outcome 1", "Outcome 2"],
  "nextSteps": ["Next step 1", "Next step 2"]
}
\`\`\`

**Instructions:**
1. Create 3-5 progressive phases
2. Each phase should build upon the previous
3. Include specific, actionable topics
4. Provide clear learning objectives and milestones
5. Ensure total estimated hours align with timeline and weekly commitment
6. Return ONLY valid JSON, no additional text

Generate the roadmap now:`;
}

/**
 * Parse roadmap response from Ollama
 * @param {string} response - Raw response from Ollama
 * @returns {Object} Parsed roadmap object
 */
function parseRoadmapResponse(response) {
  try {
    // Clean the response to extract JSON
    let jsonStr = response.trim();
    
    // Remove markdown code blocks if present
    jsonStr = jsonStr.replace(/```json\s*/, '').replace(/```\s*$/, '');
    
    // Find JSON object boundaries
    const startIndex = jsonStr.indexOf('{');
    const lastIndex = jsonStr.lastIndexOf('}');
    
    if (startIndex === -1 || lastIndex === -1) {
      throw new Error('No valid JSON found in response');
    }
    
    jsonStr = jsonStr.substring(startIndex, lastIndex + 1);
    
    // Parse JSON
    const roadmap = JSON.parse(jsonStr);
    
    // Validate required structure
    if (!roadmap.phases || !Array.isArray(roadmap.phases)) {
      throw new Error('Invalid roadmap structure: missing phases array');
    }
    
    // Validate each phase
    roadmap.phases.forEach((phase, index) => {
      if (!phase.name || !phase.topics || !Array.isArray(phase.topics)) {
        throw new Error(`Invalid phase structure at index ${index}`);
      }
    });
    
    return roadmap;
    
  } catch (error) {
    loggingService.error('Failed to parse roadmap response:', error);
    loggingService.error('Raw response:', response);
    
    // Return a fallback structure
    return createFallbackRoadmap(response);
  }
}

/**
 * Create a fallback roadmap structure when parsing fails
 * @param {string} response - Original response
 * @returns {Object} Fallback roadmap
 */
function createFallbackRoadmap(response) {
  return {
    title: 'Learning Roadmap',
    totalDuration: '12 weeks',
    weeklyHours: 10,
    difficulty: 'intermediate',
    phases: [
      {
        name: 'Foundation',
        duration: '4 weeks',
        description: 'Build fundamental knowledge and skills',
        topics: ['Basic Concepts', 'Core Principles', 'Getting Started'],
        learningObjectives: ['Understand fundamentals', 'Set up development environment'],
        milestones: ['Complete basic setup', 'Understand core concepts'],
        estimatedHours: 40
      },
      {
        name: 'Intermediate',
        duration: '4 weeks',
        description: 'Develop practical skills and knowledge',
        topics: ['Intermediate Concepts', 'Practical Applications', 'Best Practices'],
        learningObjectives: ['Apply concepts practically', 'Follow best practices'],
        milestones: ['Build first project', 'Implement best practices'],
        estimatedHours: 40
      },
      {
        name: 'Advanced',
        duration: '4 weeks',
        description: 'Master advanced topics and real-world applications',
        topics: ['Advanced Topics', 'Real-world Projects', 'Optimization'],
        learningObjectives: ['Master advanced concepts', 'Build complex projects'],
        milestones: ['Complete advanced project', 'Demonstrate mastery'],
        estimatedHours: 40
      }
    ],
    prerequisites: ['Basic knowledge required'],
    learningOutcomes: ['Comprehensive understanding', 'Practical skills'],
    nextSteps: ['Continue learning', 'Apply skills professionally'],
    metadata: {
      generatedBy: 'fallback',
      originalResponse: response.substring(0, 500) // Store first 500 chars for debugging
    }
  };
}

/**
 * Optimize roadmap for user's skill level and preferences
 * @param {Object} roadmap - Generated roadmap
 * @param {Object} userContext - User context
 * @returns {Promise<Object>} Optimized roadmap
 */
async function optimizeForSkillLevel(roadmap, userContext) {
  try {
    const { difficulty, learningPreferences, weeklyHours } = userContext;
    
    // Adjust phase durations based on weekly hours
    const optimizedPhases = roadmap.phases.map(phase => {
      const adjustedDuration = adjustPhaseDuration(phase, weeklyHours);
      const adjustedTopics = filterTopicsByDifficulty(phase.topics, difficulty);
      
      return {
        ...phase,
        duration: adjustedDuration,
        topics: adjustedTopics,
        estimatedHours: calculatePhaseHours(adjustedTopics.length, difficulty)
      };
    });
    
    // Add learning preference adaptations
    const adaptedPhases = adaptToLearningPreferences(optimizedPhases, learningPreferences);
    
    return {
      ...roadmap,
      phases: adaptedPhases,
      optimizedFor: {
        difficulty,
        weeklyHours,
        learningPreferences
      },
      optimizedAt: new Date().toISOString()
    };
    
  } catch (error) {
    loggingService.error('Roadmap optimization failed:', error);
    return roadmap; // Return original if optimization fails
  }
}

/**
 * Create personalized learning sequence
 * @param {Object} roadmap - Optimized roadmap
 * @param {Object} userContext - User context
 * @returns {Promise<Object>} Roadmap with personalized sequence
 */
async function createLearningSequence(roadmap, userContext) {
  try {
    const { focusAreas, learningPreferences } = userContext;
    
    // Add sequence information to each phase
    const sequencedPhases = roadmap.phases.map((phase, index) => {
      const sequence = {
        order: index + 1,
        dependencies: index > 0 ? [roadmap.phases[index - 1].name] : [],
        recommendedStartWeek: calculateStartWeek(index, roadmap.phases),
        priority: calculatePhasePriority(phase, focusAreas)
      };
      
      return {
        ...phase,
        sequence,
        personalizedNotes: generatePersonalizedNotes(phase, userContext)
      };
    });
    
    return {
      ...roadmap,
      phases: sequencedPhases,
      learningSequence: {
        totalPhases: sequencedPhases.length,
        estimatedCompletionWeeks: calculateTotalWeeks(sequencedPhases),
        personalizedFor: userContext.targetSkill,
        createdAt: new Date().toISOString()
      }
    };
    
  } catch (error) {
    loggingService.error('Learning sequence creation failed:', error);
    return roadmap; // Return roadmap without sequence if creation fails
  }
}

/**
 * Helper function to adjust phase duration based on weekly hours
 * @param {Object} phase - Phase object
 * @param {number} weeklyHours - Weekly time commitment
 * @returns {string} Adjusted duration
 */
function adjustPhaseDuration(phase, weeklyHours) {
  const baseHours = phase.estimatedHours || 40;
  const weeks = Math.ceil(baseHours / weeklyHours);
  return `${weeks} week${weeks > 1 ? 's' : ''}`;
}

/**
 * Filter topics by difficulty level
 * @param {Array} topics - Array of topics
 * @param {string} difficulty - User's difficulty level
 * @returns {Array} Filtered topics
 */
function filterTopicsByDifficulty(topics, difficulty) {
  // For now, return all topics. In future, implement difficulty-based filtering
  return topics;
}

/**
 * Calculate estimated hours for a phase
 * @param {number} topicCount - Number of topics
 * @param {string} difficulty - Difficulty level
 * @returns {number} Estimated hours
 */
function calculatePhaseHours(topicCount, difficulty) {
  const baseHoursPerTopic = {
    'beginner': 8,
    'intermediate': 6,
    'advanced': 4
  };
  
  return topicCount * (baseHoursPerTopic[difficulty] || 6);
}

/**
 * Adapt phases to learning preferences
 * @param {Array} phases - Array of phases
 * @param {Object} learningPreferences - User's learning preferences
 * @returns {Array} Adapted phases
 */
function adaptToLearningPreferences(phases, learningPreferences) {
  // For now, return phases as-is. In future, implement preference-based adaptations
  return phases;
}

/**
 * Calculate start week for a phase
 * @param {number} phaseIndex - Phase index
 * @param {Array} allPhases - All phases
 * @returns {number} Recommended start week
 */
function calculateStartWeek(phaseIndex, allPhases) {
  let totalWeeks = 1;
  for (let i = 0; i < phaseIndex; i++) {
    const duration = allPhases[i].duration || '4 weeks';
    const weeks = parseInt(duration.match(/\d+/)?.[0] || '4');
    totalWeeks += weeks;
  }
  return totalWeeks;
}

/**
 * Calculate phase priority based on focus areas
 * @param {Object} phase - Phase object
 * @param {Array} focusAreas - User's focus areas
 * @returns {string} Priority level
 */
function calculatePhasePriority(phase, focusAreas) {
  if (!focusAreas || focusAreas.length === 0) return 'medium';
  
  const phaseTopics = phase.topics.map(t => t.toLowerCase());
  const matchingAreas = focusAreas.filter(area => 
    phaseTopics.some(topic => topic.includes(area.toLowerCase()))
  );
  
  if (matchingAreas.length > 0) return 'high';
  return 'medium';
}

/**
 * Calculate total weeks for all phases
 * @param {Array} phases - Array of phases
 * @returns {number} Total weeks
 */
function calculateTotalWeeks(phases) {
  return phases.reduce((total, phase) => {
    const duration = phase.duration || '4 weeks';
    const weeks = parseInt(duration.match(/\d+/)?.[0] || '4');
    return total + weeks;
  }, 0);
}

/**
 * Generate personalized notes for a phase
 * @param {Object} phase - Phase object
 * @param {Object} userContext - User context
 * @returns {Array} Personalized notes
 */
function generatePersonalizedNotes(phase, userContext) {
  const notes = [];
  
  if (userContext.excludedSkills && userContext.excludedSkills.length > 0) {
    const relevantSkills = userContext.excludedSkills.filter(skill => 
      phase.topics.some(topic => topic.toLowerCase().includes(skill.toLowerCase()))
    );
    if (relevantSkills.length > 0) {
      notes.push(`You already know: ${relevantSkills.join(', ')}. Focus on advanced applications.`);
    }
  }
  
  if (userContext.focusAreas && userContext.focusAreas.length > 0) {
    const relevantAreas = userContext.focusAreas.filter(area => 
      phase.topics.some(topic => topic.toLowerCase().includes(area.toLowerCase()))
    );
    if (relevantAreas.length > 0) {
      notes.push(`This phase aligns with your focus areas: ${relevantAreas.join(', ')}.`);
    }
  }
  
  return notes;
}

module.exports = {
  processScrapedDataWithOllama,
  generateStructuredRoadmap,
  optimizeForSkillLevel,
  createLearningSequence,
  parseRoadmapResponse,
  prepareOllamaContext
};