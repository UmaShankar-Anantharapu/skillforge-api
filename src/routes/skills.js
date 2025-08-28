const express = require('express');
const { body, validationResult } = require('express-validator');
const requireAuth = require('../middleware/requireAuth');
const UserProfile = require('../models/UserProfile');
const { generateSkillSuggestions } = require('../services/skillSuggestionService');
const { generatePersonalizedRoadmaps, generateTrendingRoadmaps } = require('../services/aiRecommendationService');

const router = express.Router();

console.log('Skills router initialized');

// Test endpoint to verify route is working
router.get('/test', (req, res) => {
  console.log('SKILLS /test endpoint hit!');
  res.json({ message: 'Skills route is working!', timestamp: new Date().toISOString() });
});



// New test endpoint to verify route ordering
router.get('/new-test', (req, res) => {
  console.log('NEW TEST ENDPOINT HIT!');
  res.json({ message: 'New test endpoint working!', timestamp: new Date().toISOString() });
});

// Simple working test
router.get('/simple-working-test', (req, res) => {
  console.log('SIMPLE WORKING TEST HIT!');
  res.json({ success: true, message: 'Simple working test' });
});



// Trending roadmaps endpoint
router.get('/trending-roadmaps', async (req, res) => {
  try {
    const { page = 1, limit = 6 } = req.query;
    const skip = (page - 1) * limit;

    // Generate trending roadmaps using LLM
    const result = await generateTrendingRoadmaps();
    
    if (!result.success) {
      throw new Error('Failed to generate trending roadmaps');
    }
    
    const allRoadmaps = result.data.roadmaps;
    
    // Apply pagination
    const paginatedRoadmaps = allRoadmaps.slice(skip, skip + parseInt(limit));
    
    const totalCount = allRoadmaps.length;
    const totalPages = Math.ceil(totalCount / limit);
    
    res.json({
      success: true,
      data: paginatedRoadmaps,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalCount,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Error fetching trending roadmaps:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch trending roadmaps' 
    });
  }
});

// Personalized roadmaps endpoint
router.get('/personalized-roadmaps', async (req, res) => {
  try {
    const { userId, page = 1, limit = 6 } = req.query;
    
    if (!userId) {
      return res.status(400).json({ 
        success: false, 
        error: 'userId parameter is required' 
      });
    }
    
    const skip = (page - 1) * limit;

    // Generate personalized roadmaps using LLM
    const result = await generatePersonalizedRoadmaps(userId);
    
    if (!result.success) {
      throw new Error('Failed to generate personalized roadmaps');
    }
    
    const allRoadmaps = result.data.roadmaps;
    
    // Apply pagination
    const paginatedRoadmaps = allRoadmaps.slice(skip, skip + parseInt(limit));
    
    const totalCount = allRoadmaps.length;
    const totalPages = Math.ceil(totalCount / limit);
    
    res.json({
      success: true,
      data: paginatedRoadmaps,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalCount,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Error fetching personalized roadmaps:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch personalized roadmaps' 
    });
  }
});

// Get recommended skills based on current skills
router.get('/recommendations/:userId', requireAuth, async (req, res, next) => {
  try {
    const userId = req.params.userId;
    
    // Validate that the requesting user can access this data
    if (req.user.id !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const profile = await UserProfile.findByUserId(userId);
    if (!profile) {
      return res.status(404).json({ error: 'User profile not found' });
    }

    // Generate recommendations based on current skills
    const recommendations = await generateSkillRecommendations(profile.currentSkills);
    
    res.json({ skills: recommendations });
  } catch (error) {
    console.error('Error generating skill recommendations:', error);
    next(error);
  }
});

// Get career advancement pathways
router.post('/career-pathways', requireAuth, [
  body('currentSkills').isArray().withMessage('Current skills must be an array'),
  body('targetRole').optional().isString().trim().withMessage('Target role must be a string')
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { currentSkills, targetRole } = req.body;
    
    // Generate career pathways
    const pathways = await generateCareerPathways(currentSkills, targetRole);
    
    res.json({ pathways });
  } catch (error) {
    console.error('Error generating career pathways:', error);
    next(error);
  }
});

// Get skill relationships and dependencies
router.get('/relationships/:skillName', async (req, res, next) => {
  try {
    const skillName = req.params.skillName;
    
    if (!skillName || skillName.trim().length === 0) {
      return res.status(400).json({ error: 'Skill name is required' });
    }

    const relationships = await getSkillRelationships(skillName);
    
    res.json(relationships);
  } catch (error) {
    console.error('Error getting skill relationships:', error);
    next(error);
  }
});

// Get trending skills
router.get('/trending', async (req, res, next) => {
  try {
    const trendingSkills = getTrendingSkills([]);
    
    res.json({ skills: trendingSkills });
  } catch (error) {
    console.error('Error getting trending skills:', error);
    next(error);
  }
});

// Generate AI-powered personalized roadmap recommendations
router.get('/ai-recommendations/:userId', requireAuth, async (req, res, next) => {
  try {
    const { userId } = req.params;
    console.log(`Generating AI recommendations for user: ${userId}`);
    
    const result = await generatePersonalizedRoadmaps(userId);
    res.json(result);
  } catch (error) {
    console.error('Error generating AI recommendations:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to generate AI recommendations',
      message: error.message 
    });
  }
});

// Generate skill suggestions based on goal and current skills
router.post('/suggest', [
  body('goal').optional().isString().trim().withMessage('Goal must be a string'),
  body('currentSkills').optional().isArray().withMessage('Current skills must be an array'),
  body('targetRole').optional().isString().trim().withMessage('Target role must be a string')
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { goal, currentSkills = [], targetRole } = req.body;
    
    // Generate skill suggestions using the service
    const suggestions = await generateSkillSuggestions(goal, currentSkills, targetRole, false);
    
    res.json({ suggestions });
  } catch (error) {
    console.error('Error generating skill suggestions:', error);
    next(error);
  }
});

/**
 * Generate skill recommendations based on current skills
 * @param {Array} currentSkills - User's current skills with proficiency levels
 * @returns {Promise<Array>} Array of recommended skills
 */
async function generateSkillRecommendations(currentSkills) {
  try {
    // Extract skill names for analysis
    const skillNames = currentSkills.map(skill => skill.skillName);
    
    // Define skill categories and relationships
    const skillCategories = {
      'Frontend': ['JavaScript', 'React', 'Angular', 'Vue.js', 'HTML', 'CSS', 'TypeScript'],
      'Backend': ['Node.js', 'Python', 'Java', 'Express.js', 'Django', 'Spring Boot'],
      'Database': ['MongoDB', 'PostgreSQL', 'MySQL', 'Redis'],
      'Cloud': ['AWS', 'Azure', 'GCP', 'Docker', 'Kubernetes'],
      'Data Science': ['Python', 'R', 'Machine Learning', 'Statistics', 'Pandas', 'NumPy'],
      'Mobile': ['React Native', 'Flutter', 'Swift', 'Kotlin'],
      'DevOps': ['Docker', 'Kubernetes', 'CI/CD', 'Jenkins', 'Terraform'],
      'Security': ['Cybersecurity', 'Ethical Hacking', 'Network Security']
    };

    // Skill progression paths
    const progressionPaths = {
      'JavaScript': ['TypeScript', 'React', 'Node.js', 'Vue.js', 'Angular'],
      'Python': ['Django', 'Flask', 'Machine Learning', 'Data Science', 'FastAPI'],
      'React': ['Next.js', 'Redux', 'React Native', 'TypeScript'],
      'Node.js': ['Express.js', 'NestJS', 'GraphQL', 'MongoDB'],
      'HTML': ['CSS', 'JavaScript', 'React', 'Angular'],
      'CSS': ['SASS', 'Tailwind CSS', 'JavaScript', 'React'],
      'Machine Learning': ['Deep Learning', 'TensorFlow', 'PyTorch', 'MLOps'],
      'AWS': ['Docker', 'Kubernetes', 'Terraform', 'DevOps'],
      'Docker': ['Kubernetes', 'DevOps', 'CI/CD', 'Microservices']
    };

    const recommendations = [];
    const currentSkillNames = skillNames.map(name => name.toLowerCase());

    // Generate recommendations based on current skills
    for (const skill of skillNames) {
      const progressions = progressionPaths[skill] || [];
      
      for (const nextSkill of progressions) {
        if (!currentSkillNames.includes(nextSkill.toLowerCase())) {
          const recommendation = {
            skillName: nextSkill,
            relevanceScore: calculateRelevanceScore(skill, nextSkill, currentSkills),
            difficultyLevel: getDifficultyLevel(nextSkill),
            estimatedLearningTime: getEstimatedLearningTime(nextSkill),
            prerequisites: getPrerequisites(nextSkill),
            careerImpact: getCareerImpact(nextSkill),
            demandLevel: getDemandLevel(nextSkill),
            relatedRoles: getRelatedRoles(nextSkill),
            reason: `Builds upon your ${skill} knowledge`
          };
          
          // Avoid duplicates
          if (!recommendations.find(r => r.skillName === nextSkill)) {
            recommendations.push(recommendation);
          }
        }
      }
    }

    // Add trending skills based on current skill categories
    const trendingSkills = getTrendingSkills(currentSkills);
    for (const trending of trendingSkills) {
      if (!currentSkillNames.includes(trending.skillName.toLowerCase()) &&
          !recommendations.find(r => r.skillName === trending.skillName)) {
        recommendations.push(trending);
      }
    }

    // Sort by relevance score and return top 10
    return recommendations
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, 10);
      
  } catch (error) {
    console.error('Error in generateSkillRecommendations:', error);
    return [];
  }
}

/**
 * Generate career advancement pathways
 * @param {Array} currentSkills - User's current skills
 * @param {string} targetRole - Target role (optional)
 * @returns {Promise<Array>} Array of career pathways
 */
async function generateCareerPathways(currentSkills, targetRole) {
  try {
    const pathways = [];
    
    // Define role-based skill requirements
    const roleRequirements = {
      'Full Stack Developer': {
        required: ['JavaScript', 'React', 'Node.js', 'MongoDB', 'HTML', 'CSS'],
        advanced: ['TypeScript', 'GraphQL', 'Docker', 'AWS'],
        estimatedDuration: '6-9 months'
      },
      'Data Scientist': {
        required: ['Python', 'Statistics', 'Machine Learning', 'SQL', 'Pandas'],
        advanced: ['Deep Learning', 'TensorFlow', 'Big Data', 'MLOps'],
        estimatedDuration: '8-12 months'
      },
      'DevOps Engineer': {
        required: ['Docker', 'Kubernetes', 'CI/CD', 'Linux', 'AWS'],
        advanced: ['Terraform', 'Monitoring', 'Security', 'Microservices'],
        estimatedDuration: '6-8 months'
      },
      'Frontend Developer': {
        required: ['JavaScript', 'React', 'HTML', 'CSS', 'TypeScript'],
        advanced: ['Next.js', 'Testing', 'Performance Optimization', 'Accessibility'],
        estimatedDuration: '4-6 months'
      },
      'Backend Developer': {
        required: ['Node.js', 'Python', 'MongoDB', 'API Design', 'SQL'],
        advanced: ['Microservices', 'GraphQL', 'Caching', 'Security'],
        estimatedDuration: '5-7 months'
      }
    };

    const currentSkillNames = currentSkills.map(skill => skill.toLowerCase());
    
    // Generate pathways for each role
    for (const [role, requirements] of Object.entries(roleRequirements)) {
      if (targetRole && role !== targetRole) continue;
      
      const requiredSkills = requirements.required.filter(skill => 
        !currentSkillNames.includes(skill.toLowerCase())
      );
      
      const advancedSkills = requirements.advanced.filter(skill => 
        !currentSkillNames.includes(skill.toLowerCase())
      );
      
      if (requiredSkills.length > 0 || advancedSkills.length > 0) {
        const pathway = {
          pathwayName: `Path to ${role}`,
          targetRole: role,
          requiredSkills: [...requiredSkills, ...advancedSkills].map((skill, index) => ({
            skillName: skill,
            currentLevel: 'None',
            targetLevel: requirements.required.includes(skill) ? 'Intermediate' : 'Advanced',
            priority: requirements.required.includes(skill) ? 9 - index : 5 - index,
            estimatedTime: getEstimatedLearningTime(skill)
          })),
          estimatedDuration: requirements.estimatedDuration,
          difficultyLevel: calculatePathwayDifficulty(requiredSkills, advancedSkills),
          marketDemand: getMarketDemand(role)
        };
        
        pathways.push(pathway);
      }
    }
    
    return pathways.sort((a, b) => b.marketDemand - a.marketDemand);
    
  } catch (error) {
    console.error('Error in generateCareerPathways:', error);
    return [];
  }
}

/**
 * Get skill relationships and dependencies
 * @param {string} skillName - Name of the skill
 * @returns {Promise<Object>} Skill relationships object
 */
async function getSkillRelationships(skillName) {
  try {
    const relationships = {
      skillName,
      prerequisites: [],
      complementarySkills: [],
      advancedSkills: [],
      relatedRoles: [],
      learningPath: []
    };

    // Define skill relationships
    const skillRelationships = {
      'React': {
        prerequisites: ['JavaScript', 'HTML', 'CSS'],
        complementarySkills: ['TypeScript', 'Redux', 'React Router'],
        advancedSkills: ['Next.js', 'React Native', 'GraphQL'],
        relatedRoles: ['Frontend Developer', 'Full Stack Developer', 'React Developer'],
        learningPath: ['JavaScript', 'HTML/CSS', 'React Basics', 'State Management', 'Advanced React']
      },
      'Python': {
        prerequisites: ['Programming Fundamentals'],
        complementarySkills: ['Git', 'Linux', 'SQL'],
        advancedSkills: ['Django', 'Flask', 'Machine Learning', 'Data Science'],
        relatedRoles: ['Backend Developer', 'Data Scientist', 'Python Developer'],
        learningPath: ['Python Basics', 'OOP', 'Libraries', 'Frameworks', 'Specialization']
      },
      'Machine Learning': {
        prerequisites: ['Python', 'Statistics', 'Linear Algebra'],
        complementarySkills: ['Pandas', 'NumPy', 'Matplotlib'],
        advancedSkills: ['Deep Learning', 'TensorFlow', 'PyTorch', 'MLOps'],
        relatedRoles: ['Data Scientist', 'ML Engineer', 'AI Researcher'],
        learningPath: ['Math Foundations', 'Python', 'ML Algorithms', 'Model Building', 'Deployment']
      },
      'Docker': {
        prerequisites: ['Linux', 'Command Line'],
        complementarySkills: ['Git', 'CI/CD'],
        advancedSkills: ['Kubernetes', 'Docker Compose', 'Microservices'],
        relatedRoles: ['DevOps Engineer', 'Backend Developer', 'Cloud Engineer'],
        learningPath: ['Containerization Basics', 'Docker Commands', 'Dockerfile', 'Docker Compose', 'Orchestration']
      }
    };

    const skillData = skillRelationships[skillName];
    if (skillData) {
      Object.assign(relationships, skillData);
    } else {
      // Generate basic relationships for unknown skills
      relationships.prerequisites = ['Programming Fundamentals'];
      relationships.relatedRoles = ['Software Developer'];
      relationships.learningPath = ['Basics', 'Intermediate', 'Advanced'];
    }

    return relationships;
    
  } catch (error) {
    console.error('Error in getSkillRelationships:', error);
    return {
      skillName,
      prerequisites: [],
      complementarySkills: [],
      advancedSkills: [],
      relatedRoles: [],
      learningPath: []
    };
  }
}

// Helper functions
function calculateRelevanceScore(baseSkill, targetSkill, currentSkills) {
  // Base score
  let score = 70;
  
  // Boost score based on skill relationships
  const synergies = {
    'JavaScript': ['TypeScript', 'React', 'Node.js'],
    'Python': ['Django', 'Machine Learning', 'Data Science'],
    'React': ['Next.js', 'React Native', 'Redux'],
    'AWS': ['Docker', 'Kubernetes', 'DevOps']
  };
  
  if (synergies[baseSkill]?.includes(targetSkill)) {
    score += 20;
  }
  
  return Math.min(score, 95);
}

function getDifficultyLevel(skillName) {
  const difficulties = {
    'HTML': 'Easy',
    'CSS': 'Easy',
    'JavaScript': 'Medium',
    'React': 'Medium',
    'Node.js': 'Medium',
    'Machine Learning': 'Hard',
    'Kubernetes': 'Hard',
    'System Design': 'Hard'
  };
  
  return difficulties[skillName] || 'Medium';
}

function getEstimatedLearningTime(skillName) {
  const times = {
    'HTML': '2-3 weeks',
    'CSS': '3-4 weeks',
    'JavaScript': '2-3 months',
    'React': '1-2 months',
    'Node.js': '1-2 months',
    'Machine Learning': '4-6 months',
    'Kubernetes': '2-3 months',
    'Docker': '3-4 weeks'
  };
  
  return times[skillName] || '1-2 months';
}

function getPrerequisites(skillName) {
  const prerequisites = {
    'React': ['JavaScript', 'HTML', 'CSS'],
    'Node.js': ['JavaScript'],
    'TypeScript': ['JavaScript'],
    'Machine Learning': ['Python', 'Statistics'],
    'Kubernetes': ['Docker', 'Linux'],
    'Next.js': ['React', 'JavaScript']
  };
  
  return prerequisites[skillName] || [];
}

function getCareerImpact(skillName) {
  const impacts = {
    'React': 85,
    'Python': 90,
    'Machine Learning': 95,
    'AWS': 88,
    'Kubernetes': 85,
    'TypeScript': 80,
    'Docker': 82
  };
  
  return impacts[skillName] || 75;
}

function getDemandLevel(skillName) {
  const demands = {
    'React': 'High',
    'Python': 'High',
    'Machine Learning': 'High',
    'AWS': 'High',
    'JavaScript': 'High',
    'Docker': 'Medium',
    'Kubernetes': 'Medium'
  };
  
  return demands[skillName] || 'Medium';
}

function getRelatedRoles(skillName) {
  const roles = {
    'React': ['Frontend Developer', 'Full Stack Developer', 'React Developer'],
    'Python': ['Backend Developer', 'Data Scientist', 'Python Developer'],
    'Machine Learning': ['Data Scientist', 'ML Engineer', 'AI Researcher'],
    'AWS': ['Cloud Engineer', 'DevOps Engineer', 'Solutions Architect'],
    'Docker': ['DevOps Engineer', 'Backend Developer', 'Cloud Engineer']
  };
  
  return roles[skillName] || ['Software Developer'];
}

function getTrendingSkills(currentSkills) {
  const trending = [
    {
      skillName: 'AI/Machine Learning',
      relevanceScore: 95,
      difficultyLevel: 'Hard',
      estimatedLearningTime: '4-6 months',
      prerequisites: ['Python', 'Statistics'],
      careerImpact: 95,
      demandLevel: 'High',
      relatedRoles: ['AI Engineer', 'Data Scientist'],
      reason: 'Highest growth technology in 2024'
    },
    {
      skillName: 'Cloud Computing',
      relevanceScore: 90,
      difficultyLevel: 'Medium',
      estimatedLearningTime: '2-3 months',
      prerequisites: ['Linux', 'Networking'],
      careerImpact: 88,
      demandLevel: 'High',
      relatedRoles: ['Cloud Engineer', 'DevOps Engineer'],
      reason: 'Essential for modern development'
    },
    {
      skillName: 'Cybersecurity',
      relevanceScore: 85,
      difficultyLevel: 'Hard',
      estimatedLearningTime: '3-4 months',
      prerequisites: ['Networking', 'Linux'],
      careerImpact: 90,
      demandLevel: 'High',
      relatedRoles: ['Security Analyst', 'Cybersecurity Engineer'],
      reason: 'Critical skill with high demand'
    }
  ];
  
  return trending;
}

function calculatePathwayDifficulty(requiredSkills, advancedSkills) {
  const baseScore = requiredSkills.length * 2 + advancedSkills.length * 3;
  return Math.min(Math.max(baseScore / 10, 1), 10);
}

function getMarketDemand(role) {
  const demands = {
    'Full Stack Developer': 95,
    'Data Scientist': 90,
    'DevOps Engineer': 88,
    'Frontend Developer': 85,
    'Backend Developer': 82
  };
  
  return demands[role] || 75;
}

module.exports = router;