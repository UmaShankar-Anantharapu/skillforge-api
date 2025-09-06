const UserProfile = require('../models/UserProfile');
const Roadmap = require('../models/Roadmap');
const { assessUserSkills } = require('./userSkillAssessmentService');
const { scrapeRoadmapData } = require('./webScrapingService');
const { chat, extractJSON } = require('./llmClient');
const { getCachedData, setCachedData } = require('./cacheService');

/**
 * Enhanced Roadmap Generation Service
 * Creates personalized roadmaps by excluding known skills and incorporating latest industry data
 */

/**
 * Generate a comprehensive, personalized roadmap for a user
 * @param {string} userId - User ID
 * @param {string} targetSkill - The skill to create roadmap for
 * @param {Object} options - Generation options
 * @returns {Object} Generated roadmap data
 */
async function generatePersonalizedRoadmap(userId, targetSkill, options = {}) {
  try {
    console.log(`Generating personalized roadmap for user ${userId}, skill: ${targetSkill}`);
    
    // Step 1: Assess user's current skills and identify gaps
    const skillAssessment = await assessUserSkills(userId, targetSkill);
    console.log('Skill assessment completed:', skillAssessment.skillCoverage);
    
    // Step 2: Gather latest industry data and trends
    const industryData = await gatherIndustryData(targetSkill, options.useWebScraping);
    console.log('Industry data gathered:', industryData.sources?.length || 0, 'sources');
    
    // Step 3: Generate roadmap structure using AI
    const roadmapStructure = await generateRoadmapStructure(
      skillAssessment,
      industryData,
      options.provider || 'ollama'
    );
    
    // Step 4: Enhance with progress tracking and gamification
    const enhancedRoadmap = await enhanceRoadmapWithTracking(
      roadmapStructure,
      skillAssessment,
      userId
    );
    
    // Step 5: Save to database
    const savedRoadmap = await saveRoadmapToDatabase(userId, enhancedRoadmap);
    
    console.log('Roadmap generation completed successfully');
    return {
      roadmap: savedRoadmap,
      skillAssessment,
      metadata: {
        generatedAt: new Date(),
        excludedSkills: skillAssessment.currentSkills
          .filter(skill => skill.shouldExclude)
          .map(skill => skill.name),
        learningPriorities: skillAssessment.learningPriorities.length,
        estimatedDuration: skillAssessment.estimatedLearningTime,
        industryDataSources: industryData.sources?.length || 0
      }
    };
  } catch (error) {
    console.error('Error generating personalized roadmap:', error);
    throw error;
  }
}

/**
 * Gather latest industry data and trends for the target skill
 * @param {string} targetSkill - Target skill
 * @param {boolean} useWebScraping - Whether to use web scraping
 * @returns {Object} Industry data and trends
 */
async function gatherIndustryData(targetSkill, useWebScraping = true) {
  try {
    // Check cache first
    const cacheKey = `industry_data_${targetSkill.toLowerCase().replace(/\s+/g, '_')}`;
    const cachedData = await getCachedData(cacheKey);
    
    if (cachedData && !isDataStale(cachedData.timestamp)) {
      console.log('Using cached industry data');
      return cachedData.data;
    }
    
    const industryData = {
      skill: targetSkill,
      trends: [],
      salaryData: {},
      jobMarket: {},
      resources: [],
      certifications: [],
      tools: [],
      sources: [],
      lastUpdated: new Date()
    };
    
    if (useWebScraping) {
      try {
        // Scrape data from multiple sources
        const scrapedData = await scrapeRoadmapData(targetSkill);
        industryData.trends = scrapedData.trends || [];
        industryData.salaryData = scrapedData.salaryData || {};
        industryData.jobMarket = scrapedData.jobMarket || {};
        industryData.resources = scrapedData.resources || [];
        industryData.certifications = scrapedData.certifications || [];
        industryData.tools = scrapedData.tools || [];
        industryData.sources = scrapedData.sources || [];
      } catch (scrapingError) {
        console.warn('Web scraping failed, using fallback data:', scrapingError.message);
        industryData.trends = getFallbackTrends(targetSkill);
        industryData.resources = getFallbackResources(targetSkill);
      }
    } else {
      // Use predefined data
      industryData.trends = getFallbackTrends(targetSkill);
      industryData.resources = getFallbackResources(targetSkill);
    }
    
    // Cache the data
    await setCachedData(cacheKey, {
      data: industryData,
      timestamp: new Date()
    });
    
    return industryData;
  } catch (error) {
    console.error('Error gathering industry data:', error);
    // Return minimal fallback data
    return {
      skill: targetSkill,
      trends: getFallbackTrends(targetSkill),
      resources: getFallbackResources(targetSkill),
      sources: ['Fallback data'],
      lastUpdated: new Date()
    };
  }
}

/**
 * Generate roadmap structure using AI with personalization
 * @param {Object} skillAssessment - User skill assessment
 * @param {Object} industryData - Industry data and trends
 * @param {string} provider - AI provider (ollama/openrouter)
 * @returns {Object} Generated roadmap structure
 */
async function generateRoadmapStructure(skillAssessment, industryData, provider) {
  const { targetSkill, skillGaps, learningPriorities, currentSkills } = skillAssessment;
  const excludedSkills = currentSkills.filter(skill => skill.shouldExclude).map(skill => skill.name);
  
  const prompt = `You are an expert learning architect creating a personalized roadmap. Generate a comprehensive learning roadmap that EXCLUDES skills the user already knows and focuses on their specific learning gaps.

**USER SKILL ASSESSMENT:**
- Target Skill: ${targetSkill}
- Skills to EXCLUDE (user already knows): ${excludedSkills.join(', ') || 'None'}
- Learning Gaps to Focus On:
${skillGaps.map(gap => 
  `  • ${gap.skillName}: ${gap.currentLevel} → ${gap.targetLevel} (Priority: ${gap.priority}/10, ${gap.estimatedHours}h)`
).join('\n')}

**LEARNING PRIORITIES (in order):**
${learningPriorities.map((priority, index) => 
  `${index + 1}. ${priority.skillName} (${priority.category}, Week ${priority.startWeek}-${priority.endWeek})`
).join('\n')}

**INDUSTRY TRENDS & DATA:**
- Current Trends: ${industryData.trends?.slice(0, 5).join(', ') || 'General industry growth'}
- Salary Range: ${industryData.salaryData?.range || '$50,000 - $120,000'}
- Job Growth: ${industryData.jobMarket?.growth || '15% above average'}
- Popular Tools: ${industryData.tools?.slice(0, 5).join(', ') || 'Standard industry tools'}
- Top Certifications: ${industryData.certifications?.slice(0, 3).join(', ') || 'Industry certifications'}

**CRITICAL REQUIREMENTS:**
1. DO NOT include any skills from the excluded list
2. Focus ONLY on the identified learning gaps
3. Structure learning path based on the priority order
4. Include current industry trends and tools
5. Provide realistic time estimates based on skill gap analysis
6. Return ONLY valid JSON matching the exact structure

**RETURN THIS EXACT JSON STRUCTURE:**
{
  "skill": "${targetSkill}",
  "description": "Comprehensive description focusing on user's learning gaps",
  "version": "1.0",
  "lastUpdated": "${new Date().toISOString().split('T')[0]}",
  "difficulty": "Personalized based on user's current level",
  
  "metadata": {
    "category": "Technology/Business/Creative",
    "tags": ["tag1", "tag2", "tag3"],
    "industry": "Primary industry",
    "trending": true
  },

  "timeline": {
    "estimated": "${skillAssessment.estimatedLearningTime || '3-6 months'}",
    "flexible": true,
    "selfPaced": true,
    "intensity": {
      "casual": "5-8 hours/week",
      "moderate": "10-15 hours/week",
      "intensive": "20+ hours/week"
    }
  },

  "prerequisites": {
    "required": [
      {
        "skill": "Required skill name",
        "level": "Beginner/Intermediate/Advanced",
        "timeToComplete": "Time estimate",
        "alternatives": ["Alternative 1", "Alternative 2"]
      }
    ],
    "recommended": [
      {
        "skill": "Recommended skill",
        "level": "Level needed",
        "reason": "Why recommended"
      }
    ]
  },

  "learningObjectives": [
    "Specific objective 1",
    "Specific objective 2",
    "Specific objective 3"
  ],

  "skillsYouWillGain": [
    "New skill 1",
    "New skill 2",
    "New skill 3"
  ],

  "careerPaths": [
    {
      "title": "Job title",
      "averageSalary": "${industryData.salaryData?.range || '$70,000 - $120,000'}",
      "jobGrowth": "${industryData.jobMarket?.growth || '15%'}",
      "companies": ["Company 1", "Company 2", "Company 3"]
    }
  ],

  "levels": [
    {
      "level": "Foundation",
      "order": 1,
      "duration": "4-6 weeks",
      "difficulty": "Beginner",
      "overview": "Build fundamental understanding",
      
      "learningObjectives": [
        "Understand core concepts",
        "Set up development environment"
      ],

      "completionCriteria": {
        "minimumScore": 80,
        "requiredProjects": 2,
        "timeSpent": "20+ hours",
        "skillChecks": ["Basic concepts", "Environment setup"]
      },

      "gamification": {
        "xpReward": 500,
        "badges": ["Foundation Builder", "Quick Learner"],
        "achievements": ["First Project", "Concept Master"],
        "leaderboard": false
      },

      "topics": [
        {
          "title": "Topic 1",
          "order": 1,
          "estimatedHours": 8,
          "difficulty": "Beginner",
          "description": "Topic description",
          
          "learningObjectives": [
            "Objective 1",
            "Objective 2"
          ],

          "keyTerms": ["Term 1", "Term 2", "Term 3"],

          "resources": [
            {
              "type": "course",
              "name": "Course name",
              "link": "https://example.com/course",
              "duration": "2 hours",
              "rating": 4.5,
              "difficulty": "Beginner",
              "free": true,
              "certificate": true,
              "provider": "Provider name"
            }
          ],

          "assessments": [
            {
              "type": "quiz",
              "name": "Topic Quiz",
              "questions": 10,
              "timeLimit": 30,
              "passingScore": 80,
              "attempts": 3
            }
          ],

          "project": {
            "title": "Project title",
            "description": "Project description",
            "requirements": ["Requirement 1", "Requirement 2"],
            "deliverables": ["Deliverable 1", "Deliverable 2"],
            "estimatedHours": 6,
            "difficulty": "Beginner",
            "rubric": {
              "codeQuality": 25,
              "functionality": 30,
              "documentation": 20,
              "creativity": 15,
              "presentation": 10
            }
          }
        }
      ]
    }
  ],

  "communities": [
    {
      "name": "Community name",
      "link": "https://community.example.com",
      "type": "forum",
      "active": true,
      "description": "Community description"
    }
  ],

  "tools": [
    {
      "name": "Tool name",
      "category": "Development",
      "free": true,
      "description": "Tool description",
      "link": "https://tool.example.com"
    }
  ],

  "certifications": [
    {
      "name": "Certification name",
      "provider": "Provider",
      "cost": "$200",
      "duration": "3 months",
      "recognition": "Industry standard",
      "link": "https://cert.example.com"
    }
  ],

  "portfolioGuidance": {
    "projectTypes": ["Project type 1", "Project type 2"],
    "showcaseItems": ["Item 1", "Item 2"],
    "presentationTips": ["Tip 1", "Tip 2"],
    "platforms": ["GitHub", "Portfolio Website", "LinkedIn"]
  },

  "nextSteps": {
    "advancedTopics": ["Advanced topic 1", "Advanced topic 2"],
    "relatedSkills": ["Related skill 1", "Related skill 2"],
    "continuousLearning": ["Learning tip 1", "Learning tip 2"]
  },

  "successMetrics": {
    "knowledgeAssessments": {
      "passingScore": 80,
      "retakePolicy": "Unlimited attempts with 24-hour cooldown"
    },
    "projectRequirements": {
      "minimumQuality": "Professional standard",
      "peerReview": true,
      "industryRelevance": true
    },
    "timeTracking": {
      "expectedHours": "${skillGaps.reduce((total, gap) => total + gap.estimatedHours, 0)} hours",
      "milestoneCheckins": "Weekly",
      "progressReports": "Bi-weekly"
    }
  },

  "adaptiveFeatures": {
    "personalizedPacing": true,
    "difficultyAdjustment": true,
    "alternativeResources": true,
    "mentorshipProgram": false,
    "studyGroups": true
  }
}`;

  try {
    const response = await chat([
      { role: 'system', content: 'You are a personalized learning architect. Always respond with valid JSON only. Focus on excluding known skills and personalizing based on skill gaps.' },
      { role: 'user', content: prompt }
    ], provider);

    const roadmapData = extractJSON(response);
    
    if (!roadmapData) {
      throw new Error('Failed to extract valid JSON from AI response');
    }

    // Validate and enhance the structure
    return validateAndEnhanceRoadmap(roadmapData, skillAssessment, industryData);
  } catch (error) {
    console.error('Error generating roadmap structure:', error);
    throw new Error(`Failed to generate roadmap structure: ${error.message}`);
  }
}

/**
 * Validate and enhance the generated roadmap
 * @param {Object} roadmapData - Generated roadmap data
 * @param {Object} skillAssessment - User skill assessment
 * @param {Object} industryData - Industry data
 * @returns {Object} Validated and enhanced roadmap
 */
function validateAndEnhanceRoadmap(roadmapData, skillAssessment, industryData) {
  // Ensure required fields exist
  if (!roadmapData.skill || !roadmapData.levels || !Array.isArray(roadmapData.levels)) {
    throw new Error('Invalid roadmap structure: missing required fields');
  }

  // Add personalization metadata
  roadmapData.personalization = {
    excludedSkills: skillAssessment.currentSkills
      .filter(skill => skill.shouldExclude)
      .map(skill => skill.name),
    focusAreas: skillAssessment.learningPriorities.map(p => p.skillName),
    skillCoverage: skillAssessment.skillCoverage,
    customizedFor: skillAssessment.userId,
    basedOnAssessment: skillAssessment.assessmentDate
  };

  // Add industry data integration
  roadmapData.industryIntegration = {
    trendsIncluded: industryData.trends?.slice(0, 5) || [],
    toolsRecommended: industryData.tools?.slice(0, 10) || [],
    certificationsAligned: industryData.certifications?.slice(0, 5) || [],
    dataSourcesUsed: industryData.sources || [],
    lastIndustryUpdate: industryData.lastUpdated
  };

  return roadmapData;
}

/**
 * Enhance roadmap with progress tracking and gamification
 * @param {Object} roadmapStructure - Basic roadmap structure
 * @param {Object} skillAssessment - User skill assessment
 * @param {string} userId - User ID
 * @returns {Object} Enhanced roadmap with tracking
 */
async function enhanceRoadmapWithTracking(roadmapStructure, skillAssessment, userId) {
  // Add progress tracking structure
  roadmapStructure.progressTracking = {
    userId,
    startDate: new Date(),
    expectedEndDate: calculateExpectedEndDate(skillAssessment.learningPriorities),
    currentLevel: 0,
    currentTopic: 0,
    completedTopics: [],
    completedProjects: [],
    totalXP: 0,
    earnedBadges: [],
    streakDays: 0,
    lastActivity: new Date(),
    weeklyGoals: generateWeeklyGoals(skillAssessment.learningPriorities),
    adaptiveAdjustments: []
  };

  // Add skill-specific milestones
  roadmapStructure.milestones = generateSkillMilestones(skillAssessment.learningPriorities);

  // Add personalized recommendations
  roadmapStructure.personalizedRecommendations = {
    studySchedule: generateStudySchedule(skillAssessment.learningPriorities),
    resourcePreferences: await getResourcePreferences(userId),
    difficultyAdjustments: calculateDifficultyAdjustments(skillAssessment),
    motivationalElements: generateMotivationalElements(skillAssessment)
  };

  return roadmapStructure;
}

/**
 * Save the generated roadmap to database
 * @param {string} userId - User ID
 * @param {Object} roadmapData - Complete roadmap data
 * @returns {Object} Saved roadmap document
 */
async function saveRoadmapToDatabase(userId, roadmapData) {
  try {
    // Convert roadmap structure to database format
    const roadmapDocument = {
      userId,
      title: `${roadmapData.skill} Learning Path`,
      description: roadmapData.description,
      estimatedDuration: roadmapData.timeline.estimated,
      difficultyLevel: roadmapData.difficulty.includes('Advanced') ? 'Advanced' : 
                      roadmapData.difficulty.includes('Intermediate') ? 'Intermediate' : 'Beginner',
      category: roadmapData.metadata.category,
      tags: roadmapData.metadata.tags,
      
      // Convert levels to milestones and steps
      milestones: roadmapData.levels.map((level, index) => ({
        id: `milestone_${index + 1}`,
        title: level.level,
        description: level.overview,
        estimatedWeeks: parseInt(level.duration.match(/\d+/)?.[0]) || 4,
        skills: level.learningObjectives,
        completed: false,
        order: level.order
      })),
      
      steps: generateStepsFromLevels(roadmapData.levels),
      
      generationMetadata: {
        generatedWith: 'enhanced-ai-agent',
        prompt: 'Personalized roadmap with skill exclusion',
        sources: roadmapData.industryIntegration?.dataSourcesUsed || [],
        generatedAt: new Date(),
        version: roadmapData.version,
        modelUsed: 'ollama-enhanced',
        confidence: 0.9
      },
      
      progress: {
        completedSteps: 0,
        totalSteps: roadmapData.levels.reduce((total, level) => total + level.topics.length, 0),
        completedMilestones: 0,
        totalMilestones: roadmapData.levels.length,
        percentageComplete: 0,
        currentStep: 1,
        currentMilestone: roadmapData.levels[0]?.level,
        estimatedCompletionDate: roadmapData.progressTracking?.expectedEndDate,
        actualStartDate: new Date(),
        streakDays: 0,
        totalTimeSpent: 0
      },
      
      status: 'active',
      isCustomized: true,
      
      // Store full roadmap data in a separate field for reference
      fullRoadmapData: roadmapData
    };

    // Save or update roadmap
    const savedRoadmap = await Roadmap.findOneAndUpdate(
      { userId },
      roadmapDocument,
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    console.log('Roadmap saved successfully:', savedRoadmap._id);
    return savedRoadmap;
  } catch (error) {
    console.error('Error saving roadmap to database:', error);
    throw error;
  }
}

// Helper functions

function isDataStale(timestamp, maxAgeHours = 24) {
  const now = new Date();
  const dataAge = (now - new Date(timestamp)) / (1000 * 60 * 60);
  return dataAge > maxAgeHours;
}

function getFallbackTrends(targetSkill) {
  const trendMappings = {
    'react': ['Component-based architecture', 'Hooks and functional components', 'Server-side rendering', 'TypeScript integration'],
    'python': ['Machine learning applications', 'Data science automation', 'Web development with FastAPI', 'Cloud computing integration'],
    'javascript': ['Modern ES6+ features', 'Full-stack development', 'Progressive web apps', 'Microservices architecture'],
    'machine learning': ['Deep learning frameworks', 'MLOps and deployment', 'Ethical AI practices', 'Edge computing ML']
  };
  
  const skillLower = targetSkill.toLowerCase();
  for (const [skill, trends] of Object.entries(trendMappings)) {
    if (skillLower.includes(skill)) {
      return trends;
    }
  }
  
  return ['Growing industry demand', 'Remote work opportunities', 'Continuous learning required', 'High market value'];
}

function getFallbackResources(targetSkill) {
  return [
    {
      type: 'course',
      name: `Complete ${targetSkill} Course`,
      link: 'https://example.com/course',
      duration: '40 hours',
      rating: 4.5,
      difficulty: 'Intermediate',
      free: false,
      certificate: true,
      provider: 'Online Learning Platform'
    },
    {
      type: 'documentation',
      name: `Official ${targetSkill} Documentation`,
      link: 'https://docs.example.com',
      duration: 'Self-paced',
      rating: 4.8,
      difficulty: 'All levels',
      free: true,
      certificate: false,
      provider: 'Official'
    }
  ];
}

function calculateExpectedEndDate(learningPriorities) {
  const totalWeeks = Math.max(...learningPriorities.map(p => p.endWeek));
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + (totalWeeks * 7));
  return endDate;
}

function generateWeeklyGoals(learningPriorities) {
  const goals = [];
  const maxWeek = Math.max(...learningPriorities.map(p => p.endWeek));
  
  for (let week = 1; week <= maxWeek; week++) {
    const weekPriorities = learningPriorities.filter(p => 
      p.startWeek <= week && p.endWeek >= week
    );
    
    goals.push({
      week,
      goals: weekPriorities.map(p => `Continue learning ${p.skillName}`),
      estimatedHours: weekPriorities.reduce((total, p) => 
        total + (p.estimatedHours / (p.endWeek - p.startWeek + 1)), 0
      )
    });
  }
  
  return goals;
}

function generateSkillMilestones(learningPriorities) {
  return learningPriorities.map((priority, index) => ({
    id: `skill_milestone_${index + 1}`,
    name: `Master ${priority.skillName}`,
    description: `Achieve ${priority.targetLevel} level in ${priority.skillName}`,
    criteria: [
      `Complete all ${priority.skillName} topics`,
      `Pass skill assessment with 80%+ score`,
      `Complete practical project`
    ],
    estimatedWeek: priority.endWeek,
    xpReward: priority.priority * 100,
    badge: `${priority.skillName} Expert`
  }));
}

function generateStudySchedule(learningPriorities) {
  return {
    recommendedDaysPerWeek: 4,
    recommendedHoursPerSession: 2,
    bestStudyTimes: ['Morning (9-11 AM)', 'Evening (7-9 PM)'],
    breakFrequency: 'Every 45 minutes',
    weeklyReviewDay: 'Sunday'
  };
}

async function getResourcePreferences(userId) {
  // This would typically fetch from user preferences
  return {
    preferredFormats: ['video', 'interactive', 'text'],
    difficultyPreference: 'progressive',
    languagePreference: 'english',
    certificationImportance: 'high'
  };
}

function calculateDifficultyAdjustments(skillAssessment) {
  const avgCurrentLevel = skillAssessment.currentSkills.reduce((sum, skill) => {
    const levelMap = { 'None': 0, 'Beginner': 1, 'Intermediate': 2, 'Advanced': 3 };
    return sum + (levelMap[skill.level] || 0);
  }, 0) / skillAssessment.currentSkills.length;
  
  return {
    startingDifficulty: avgCurrentLevel > 1.5 ? 'Intermediate' : 'Beginner',
    progressionRate: avgCurrentLevel > 2 ? 'Fast' : 'Standard',
    challengeLevel: avgCurrentLevel > 2.5 ? 'High' : 'Moderate'
  };
}

function generateMotivationalElements(skillAssessment) {
  return {
    personalizedMessages: [
      `You're building on ${skillAssessment.currentSkills.length} existing skills!`,
      `Your learning journey is personalized to skip what you already know`,
      `Focus on ${skillAssessment.skillGaps.length} key areas for maximum impact`
    ],
    progressCelebrations: [
      'Skill gap closed!',
      'New expertise unlocked!',
      'Career goal milestone reached!'
    ],
    encouragementTriggers: [
      'After completing each topic',
      'When facing difficult concepts',
      'During weekly progress reviews'
    ]
  };
}

function generateStepsFromLevels(levels) {
  const steps = [];
  let dayCounter = 1;
  let weekCounter = 1;
  
  levels.forEach((level, levelIndex) => {
    level.topics.forEach((topic, topicIndex) => {
      steps.push({
        day: dayCounter,
        week: weekCounter,
        milestoneId: `milestone_${levelIndex + 1}`,
        title: topic.title,
        description: topic.description,
        type: topic.project ? 'project' : 'theory',
        estimatedMinutes: (topic.estimatedHours || 2) * 60,
        skills: topic.learningObjectives || [],
        resources: topic.resources || [],
        prerequisites: [],
        learningObjectives: topic.learningObjectives || [],
        completed: false,
        difficulty: topic.difficulty || 'Medium',
        order: dayCounter
      });
      
      dayCounter++;
      if (dayCounter % 7 === 0) {
        weekCounter++;
      }
    });
  });
  
  return steps;
}

module.exports = {
  generatePersonalizedRoadmap,
  gatherIndustryData,
  generateRoadmapStructure,
  enhanceRoadmapWithTracking,
  saveRoadmapToDatabase
};