const UserProfile = require('../models/UserProfile');
const SkillMemoryBank = require('../models/SkillMemoryBank');
const { chat, extractJSON } = require('./llmClient');

/**
 * Enhanced roadmap generation service with comprehensive prompt engineering
 * Generates structured JSON roadmaps based on user profile data
 */

/**
 * Build comprehensive prompt for enhanced roadmap generation
 * @param {Object} userProfile - User profile data
 * @param {Object} skillMemoryBank - User's skill memory bank data
 * @returns {string} - Formatted prompt for LLM
 */
function buildEnhancedRoadmapPrompt(userProfile, skillMemoryBank) {
  // Extract user data for prompt
  const skill = userProfile?.requiredSkills?.[0]?.skillName || userProfile?.primaryGoal || 'General Programming';
  const currentLevel = userProfile?.requiredSkills?.[0]?.currentLevel || 'Beginner';
  const targetLevel = userProfile?.requiredSkills?.[0]?.targetLevel || 'Advanced';
  const targetRole = userProfile?.targetRole || 'Software Developer';
  const timeCommitment = userProfile?.timeline?.weeklyTimeCommitment || 10;
  const duration = userProfile?.timeline?.targetDuration || '3 months';
  const learningStyles = userProfile?.learningPreferences?.learningStyles || ['Video', 'Hands-on Projects'];
  const contentDifficulty = userProfile?.learningPreferences?.contentDifficulty || 'Balanced';
  const motivationLevel = userProfile?.motivationLevel || 7;
  const careerBackground = userProfile?.careerBackground || [];
  const currentSkills = userProfile?.currentSkills || [];
  
  // Extract weak areas from skill memory bank
  const weakAreas = (skillMemoryBank?.concepts || [])
    .filter(c => c.strengthLevel < 50)
    .map(c => `${c.topic} (strength: ${c.strengthLevel}%)`)
    .slice(0, 5);

  // Build comprehensive prompt
  const prompt = `You are an expert learning architect and career coach. Create a comprehensive, personalized learning roadmap that will transform the user from their current skill level to their target career goal.

**USER PROFILE:**
- Target Skill: ${skill}
- Current Level: ${currentLevel}
- Target Level: ${targetLevel}
- Career Goal: ${targetRole}
- Time Commitment: ${timeCommitment} hours/week
- Duration: ${duration}
- Learning Preferences: ${learningStyles.join(', ')}
- Content Difficulty: ${contentDifficulty}
- Motivation Level: ${motivationLevel}/10
- Career Background: ${careerBackground.length > 0 ? careerBackground.map(bg => `${bg.position} at ${bg.company} (${bg.yearsOfExperience} years)`).join(', ') : 'Entry level'}
- Current Skills: ${currentSkills.length > 0 ? currentSkills.map(s => `${s.skillName} (${s.proficiencyLevel})`).join(', ') : 'None specified'}
- Areas Needing Improvement: ${weakAreas.length > 0 ? weakAreas.join(', ') : 'To be assessed'}

**INSTRUCTIONS:**
Generate a comprehensive learning roadmap that includes:
1. Skill overview with market relevance and career impact
2. Detailed timeline with flexible pacing options
3. Prerequisites and recommended background
4. Clear learning objectives and skills to be gained
5. Career path information with salary and growth data
6. Structured levels with topics, resources, and assessments
7. Gamification elements to maintain motivation
8. Community resources and networking opportunities
9. Tools and certifications relevant to the skill
10. Portfolio guidance and next steps for career advancement

**CRITICAL REQUIREMENTS:**
- Return ONLY valid JSON matching the exact structure provided
- Fill ALL fields with realistic, actionable content
- Ensure content is tailored to the user's profile and goals
- Include current industry trends and best practices
- Provide specific, measurable learning objectives
- Include realistic time estimates and difficulty assessments
- Suggest actual courses, books, and practice platforms
- Ensure all URLs and resources are realistic (use placeholder URLs if needed)

**JSON STRUCTURE TO RETURN:**
{
  "skill": "${skill}",
  "description": "Comprehensive description of the skill and its importance in ${targetRole} role",
  "version": "1.0",
  "lastUpdated": "${new Date().toISOString().split('T')[0]}",
  "difficulty": "${currentLevel} to ${targetLevel}",
  
  "metadata": {
    "category": "Technology/Business/Creative category",
    "tags": "Relevant tags separated by commas",
    "industry": "Primary industry for this skill",
    "trending": true
  },

  "timeline": {
    "estimated": "${duration}",
    "flexible": true,
    "selfPaced": true,
    "intensity": {
      "casual": "${Math.ceil(timeCommitment * 0.5)} hours/week",
      "moderate": "${timeCommitment} hours/week",
      "intensive": "${Math.ceil(timeCommitment * 1.5)} hours/week"
    }
  },

  "prerequisites": {
    "required": {
      "skill": "Essential prerequisite skill",
      "level": "Minimum level needed",
      "timeToComplete": "Time to acquire if missing",
      "alternatives": "Alternative paths if prerequisite is missing"
    },
    "recommended": {
      "skill": "Helpful but not essential skill",
      "level": "Recommended level",
      "reason": "Why this skill helps"
    }
  },

  "learningObjectives": "Clear, measurable objectives the user will achieve",
  "skillsYouWillGain": "Specific technical and soft skills to be developed",

  "careerPaths": {
    "title": "${targetRole}",
    "averageSalary": "Realistic salary range for the target role",
    "jobGrowth": "Industry growth percentage and outlook",
    "companies": "Types of companies that hire for this role"
  },

  "level": {
    "levelName": "Foundation Level",
    "order": 1,
    "duration": "4-6 weeks",
    "difficulty": "${currentLevel}",
    "overview": "What this level covers and why it's important",
    
    "learningObjectives": "Specific objectives for this level",

    "completionCriteria": {
      "minimumScore": 80,
      "requiredProjects": 2,
      "timeSpent": "Minimum hours required",
      "skillChecks": "Key competencies to demonstrate"
    },

    "gamification": {
      "xpReward": 500,
      "badges": "Badges earned at this level",
      "achievements": "Special achievements available",
      "leaderboard": false
    },

    "topic": {
      "title": "Core Fundamentals",
      "order": 1,
      "estimatedHours": 25,
      "difficulty": "${currentLevel}",
      "description": "Detailed description of what this topic covers",
      
      "learningObjectives": "Specific learning outcomes for this topic",
      "keyTerms": "Important terminology and concepts",

      "resources": {
        "course": {
          "name": "Recommended course name",
          "link": "https://example-course-platform.com/course",
          "duration": "20 hours",
          "rating": 4.5,
          "difficulty": "${currentLevel}",
          "free": true,
          "certificate": true,
          "provider": "Course provider name"
        },
        "book": {
          "name": "Recommended book title",
          "author": "Author name",
          "pages": 300,
          "rating": 4.3,
          "free": false
        },
        "practice": {
          "name": "Practice platform name",
          "link": "https://example-practice-platform.com",
          "problems": "Number and type of practice problems",
          "difficulty": "${currentLevel}",
          "free": true
        }
      },

      "assessments": {
        "quiz": {
          "name": "Topic mastery quiz",
          "questions": 20,
          "timeLimit": 45,
          "passingScore": 80,
          "attempts": 3
        },
        "coding": {
          "name": "Practical coding assessment",
          "problems": 5,
          "timeLimit": 120,
          "autoGraded": true
        }
      },

      "project": {
        "title": "Hands-on project title",
        "description": "Detailed project description and learning goals",
        "requirements": "Technical and functional requirements",
        "deliverables": "What the user needs to submit",
        "estimatedHours": 12,
        "difficulty": "${currentLevel}",
        "rubric": {
          "codeQuality": 25,
          "functionality": 30,
          "documentation": 20,
          "creativity": 15,
          "presentation": 10
        },
        "bonusChallenges": "Optional advanced features to implement"
      },

      "practiceExercises": {
        "title": "Daily practice exercises",
        "difficulty": "Easy",
        "timeEstimate": 30,
        "description": "Short exercises to reinforce learning"
      },

      "commonMistakes": "Common pitfalls and how to avoid them",
      "tips": "Pro tips and best practices"
    },

    "milestones": {
      "name": "Level completion milestone",
      "description": "What achieving this milestone means",
      "criteria": "Specific criteria for milestone completion"
    },

    "capstoneProject": {
      "title": "Level capstone project",
      "description": "Comprehensive project that demonstrates level mastery",
      "duration": "2-3 weeks",
      "difficulty": "${targetLevel}",
      "requirements": "Technical and business requirements",
      "businessContext": "Real-world business scenario",
      "deliverables": "Final deliverables and presentation requirements",
      "evaluationCriteria": {
        "technicalExecution": 40,
        "businessInsight": 30,
        "presentation": 20,
        "creativity": 10
      }
    },

    "troubleshooting": {
      "commonIssues": {
        "issue": "Most common learning obstacle",
        "solution": "Step-by-step solution approach",
        "resources": "Additional resources for help"
      },
      "gettingUnstuck": "Strategies for overcoming learning blocks"
    }
  },

  "communities": {
    "name": "Relevant community name",
    "link": "https://example-community.com",
    "type": "forum",
    "active": true,
    "description": "What this community offers"
  },

  "tools": {
    "name": "Essential tool name",
    "category": "Tool category",
    "free": true,
    "description": "Why this tool is important",
    "link": "https://example-tool.com"
  },

  "certifications": {
    "name": "Relevant certification name",
    "provider": "Certification provider",
    "cost": "Certification cost",
    "duration": "Time to complete",
    "recognition": "Industry standard",
    "link": "https://example-certification.com"
  },

  "portfolioGuidance": {
    "projectTypes": "Types of projects to showcase",
    "showcaseItems": "Key items to highlight",
    "presentationTips": "How to present work effectively",
    "platforms": "GitHub, Portfolio Website, LinkedIn"
  },

  "nextSteps": {
    "advancedTopics": "Advanced topics to explore next",
    "relatedSkills": "Complementary skills to consider",
    "continuousLearning": "How to stay updated in this field"
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
      "expectedHours": "${timeCommitment * 4} hours/month",
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
}

Return ONLY the JSON object, no additional text or formatting.`;

  return prompt;
}

/**
 * Generate enhanced roadmap using LLM with comprehensive prompt
 * @param {string} userId - User ID
 * @param {string} provider - LLM provider ('ollama' or 'openrouter')
 * @returns {Object} - Generated roadmap data
 */
async function generateEnhancedRoadmap(userId, provider = 'ollama') {
  try {
    // Fetch user profile and skill memory bank
    const userProfile = await UserProfile.findOne({ userId }).lean();
    if (!userProfile) {
      throw new Error('User profile not found. Please complete your profile first.');
    }

    const skillMemoryBank = await SkillMemoryBank.findOne({ userId }).lean();

    // Build comprehensive prompt
    const prompt = buildEnhancedRoadmapPrompt(userProfile, skillMemoryBank);
    
    console.log('Sending enhanced roadmap prompt to LLM...');
    
    // Generate roadmap using LLM
    const response = await chat([
      {
        role: 'system',
        content: 'You are an expert learning architect. Generate comprehensive, personalized learning roadmaps in valid JSON format only.'
      },
      {
        role: 'user',
        content: prompt
      }
    ], provider);

    console.log('LLM Response received, extracting JSON...');
    
    // Extract and validate JSON
    const roadmapData = extractJSON(response);
    
    if (!roadmapData || typeof roadmapData !== 'object') {
      throw new Error('Invalid JSON response from LLM');
    }

    // Add generation metadata
    roadmapData.generationMetadata = {
      generatedAt: new Date().toISOString(),
      provider: provider,
      model: provider === 'ollama' ? process.env.OLLAMA_MODEL || 'phi3:mini' : 'openrouter',
      userId: userId,
      profileBased: true,
      enhancedPrompt: true
    };

    console.log('Enhanced roadmap generated successfully');
    return roadmapData;

  } catch (error) {
    console.error('Error generating enhanced roadmap:', error);
    throw new Error(`Failed to generate enhanced roadmap: ${error.message}`);
  }
}

/**
 * Validate roadmap structure
 * @param {Object} roadmapData - Roadmap data to validate
 * @returns {boolean} - Whether the roadmap is valid
 */
function validateRoadmapStructure(roadmapData) {
  const requiredFields = [
    'skill', 'description', 'version', 'lastUpdated', 'difficulty',
    'metadata', 'timeline', 'prerequisites', 'learningObjectives',
    'skillsYouWillGain', 'careerPaths', 'level'
  ];

  for (const field of requiredFields) {
    if (!roadmapData.hasOwnProperty(field)) {
      console.error(`Missing required field: ${field}`);
      return false;
    }
  }

  return true;
}

module.exports = {
  generateEnhancedRoadmap,
  buildEnhancedRoadmapPrompt,
  validateRoadmapStructure
};