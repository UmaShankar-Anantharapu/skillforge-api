const { chat, extractJSON } = require('./llmClient');

// Predefined skill mappings for common goals
const GOAL_SKILL_MAPPINGS = {
  'Become an Angular Expert': {
    core: ['Angular', 'TypeScript', 'RxJS', 'HTML', 'CSS', 'JavaScript'],
    advanced: ['NgRx', 'Angular Material', 'Angular Universal', 'Jest', 'Cypress', 'Webpack'],
    complementary: ['Node.js', 'Express.js', 'MongoDB', 'Git', 'Docker']
  },
  'Crack FAANG Interviews': {
    core: ['Data Structures', 'Algorithms', 'System Design', 'Problem Solving'],
    advanced: ['Dynamic Programming', 'Graph Algorithms', 'Tree Algorithms', 'Distributed Systems'],
    complementary: ['JavaScript', 'Python', 'Java', 'SQL', 'Communication Skills']
  },
  'Learn AI from basics': {
    core: ['Python', 'Machine Learning', 'Statistics', 'Linear Algebra'],
    advanced: ['Deep Learning', 'Neural Networks', 'TensorFlow', 'PyTorch', 'Computer Vision'],
    complementary: ['NumPy', 'Pandas', 'Matplotlib', 'Jupyter', 'SQL']
  },
  'Master Full-Stack Development': {
    core: ['JavaScript', 'HTML', 'CSS', 'React', 'Node.js', 'Express.js'],
    advanced: ['MongoDB', 'PostgreSQL', 'Redis', 'Docker', 'AWS', 'GraphQL'],
    complementary: ['Git', 'Testing', 'DevOps', 'Agile', 'UI/UX Design']
  },
  'Become a Data Scientist': {
    core: ['Python', 'R', 'SQL', 'Statistics', 'Machine Learning'],
    advanced: ['Deep Learning', 'Big Data', 'Spark', 'Hadoop', 'Data Visualization'],
    complementary: ['Pandas', 'NumPy', 'Matplotlib', 'Jupyter', 'Excel']
  },
  'Learn Cloud Architecture': {
    core: ['AWS', 'Azure', 'GCP', 'Docker', 'Kubernetes'],
    advanced: ['Terraform', 'CloudFormation', 'Serverless', 'Microservices', 'DevOps'],
    complementary: ['Linux', 'Networking', 'Security', 'Monitoring', 'CI/CD']
  },
  'Master DevOps': {
    core: ['Docker', 'Kubernetes', 'CI/CD', 'Linux', 'Git'],
    advanced: ['Terraform', 'Ansible', 'Jenkins', 'Monitoring', 'Security'],
    complementary: ['AWS', 'Azure', 'Python', 'Bash', 'Networking']
  },
  'Become a Mobile Developer': {
    core: ['React Native', 'Flutter', 'Swift', 'Kotlin', 'Mobile UI/UX'],
    advanced: ['Native Development', 'App Store Optimization', 'Push Notifications', 'Mobile Security'],
    complementary: ['JavaScript', 'Dart', 'Firebase', 'API Integration', 'Testing']
  },
  'Learn Cybersecurity': {
    core: ['Network Security', 'Ethical Hacking', 'Cryptography', 'Risk Assessment'],
    advanced: ['Penetration Testing', 'Incident Response', 'Malware Analysis', 'Forensics'],
    complementary: ['Linux', 'Python', 'Networking', 'Compliance', 'Security Tools']
  },
  'Master Machine Learning': {
    core: ['Python', 'Machine Learning', 'Statistics', 'Data Preprocessing'],
    advanced: ['Deep Learning', 'Neural Networks', 'Model Deployment', 'MLOps'],
    complementary: ['TensorFlow', 'PyTorch', 'Scikit-learn', 'Pandas', 'NumPy']
  }
};

// Role-based skill suggestions
const ROLE_SKILL_MAPPINGS = {
  'Frontend Developer': ['JavaScript', 'React', 'Vue.js', 'Angular', 'HTML', 'CSS', 'TypeScript'],
  'Backend Developer': ['Node.js', 'Python', 'Java', 'Express.js', 'MongoDB', 'PostgreSQL', 'API Design'],
  'Full Stack Developer': ['JavaScript', 'React', 'Node.js', 'MongoDB', 'Express.js', 'HTML', 'CSS'],
  'Data Scientist': ['Python', 'R', 'Machine Learning', 'Statistics', 'SQL', 'Pandas', 'NumPy'],
  'DevOps Engineer': ['Docker', 'Kubernetes', 'AWS', 'CI/CD', 'Linux', 'Terraform', 'Monitoring'],
  'Mobile Developer': ['React Native', 'Flutter', 'Swift', 'Kotlin', 'Mobile UI/UX', 'Firebase'],
  'Cloud Architect': ['AWS', 'Azure', 'GCP', 'Kubernetes', 'Terraform', 'Microservices', 'Security'],
  'Machine Learning Engineer': ['Python', 'TensorFlow', 'PyTorch', 'MLOps', 'Docker', 'Kubernetes', 'Statistics'],
  'Cybersecurity Analyst': ['Network Security', 'Ethical Hacking', 'Risk Assessment', 'Incident Response', 'Python'],
  'Product Manager': ['Product Strategy', 'User Research', 'Analytics', 'Agile', 'Communication', 'Market Analysis']
};

/**
 * Generate skill suggestions based on user's goal, current skills, and target role
 * @param {string} goal - User's primary learning goal
 * @param {Array} currentSkills - User's current skills with proficiency levels
 * @param {string} targetRole - User's target role (optional)
 * @param {boolean} useAI - Whether to use AI for enhanced suggestions (default: false)
 * @returns {Promise<Array>} Array of skill suggestions with metadata
 */
async function generateSkillSuggestions(goal, currentSkills = [], targetRole = null, useAI = false) {
  try {
    let suggestions = [];

    if (useAI && process.env.OPENAI_API_KEY) {
      // Use AI for enhanced suggestions
      suggestions = await generateAISkillSuggestions(goal, currentSkills, targetRole);
    } else {
      // Use predefined mappings
      suggestions = generatePredefinedSkillSuggestions(goal, currentSkills, targetRole);
    }

    // Filter out skills user already has at advanced level
    const advancedSkills = currentSkills
      .filter(skill => skill.proficiencyLevel === 'Advanced')
      .map(skill => skill.skillName.toLowerCase());

    suggestions = suggestions.filter(suggestion =>
      !advancedSkills.includes(suggestion.skillName.toLowerCase())
    );

    // Sort by relevance score and return top 15
    return suggestions
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, 15);

  } catch (error) {
    console.error('Error generating skill suggestions:', error);
    // Fallback to basic suggestions
    return generateBasicSkillSuggestions(goal);
  }
}

/**
 * Generate skill suggestions using predefined mappings
 */
function generatePredefinedSkillSuggestions(goal, currentSkills, targetRole) {
  const suggestions = [];
  const currentSkillNames = currentSkills.map(skill => skill.skillName.toLowerCase());

  // Get skills based on goal
  const goalSkills = GOAL_SKILL_MAPPINGS[goal];
  if (goalSkills) {
    // Add core skills with high relevance
    goalSkills.core.forEach(skill => {
      if (!currentSkillNames.includes(skill.toLowerCase())) {
        suggestions.push({
          skillName: skill,
          relevanceScore: 0.9 + Math.random() * 0.1,
          category: 'Core',
          description: `Essential skill for ${goal}`,
          priority: 'High',
          estimatedLearningTime: getEstimatedLearningTime(skill)
        });
      }
    });

    // Add advanced skills with medium relevance
    goalSkills.advanced.forEach(skill => {
      if (!currentSkillNames.includes(skill.toLowerCase())) {
        suggestions.push({
          skillName: skill,
          relevanceScore: 0.7 + Math.random() * 0.2,
          category: 'Advanced',
          description: `Advanced skill for ${goal}`,
          priority: 'Medium',
          estimatedLearningTime: getEstimatedLearningTime(skill)
        });
      }
    });

    // Add complementary skills with lower relevance
    goalSkills.complementary.forEach(skill => {
      if (!currentSkillNames.includes(skill.toLowerCase())) {
        suggestions.push({
          skillName: skill,
          relevanceScore: 0.5 + Math.random() * 0.2,
          category: 'Complementary',
          description: `Complementary skill for ${goal}`,
          priority: 'Low',
          estimatedLearningTime: getEstimatedLearningTime(skill)
        });
      }
    });
  }

  // Add role-specific skills if target role is provided
  if (targetRole && ROLE_SKILL_MAPPINGS[targetRole]) {
    ROLE_SKILL_MAPPINGS[targetRole].forEach(skill => {
      if (!currentSkillNames.includes(skill.toLowerCase()) &&
          !suggestions.some(s => s.skillName.toLowerCase() === skill.toLowerCase())) {
        suggestions.push({
          skillName: skill,
          relevanceScore: 0.8 + Math.random() * 0.1,
          category: 'Role-specific',
          description: `Important skill for ${targetRole}`,
          priority: 'High',
          estimatedLearningTime: getEstimatedLearningTime(skill)
        });
      }
    });
  }

  return suggestions;
}

/**
 * Generate AI-powered skill suggestions using LLM
 */
async function generateAISkillSuggestions(goal, currentSkills, targetRole) {
  const currentSkillsList = currentSkills.map(skill =>
    `${skill.skillName} (${skill.proficiencyLevel})`
  ).join(', ');

  const prompt = `You are a career development expert. Generate skill recommendations for someone with the following profile:

Goal: ${goal}
Target Role: ${targetRole || 'Not specified'}
Current Skills: ${currentSkillsList || 'None specified'}

Please suggest 10-15 skills that would be most valuable for achieving this goal. For each skill, provide:
1. Skill name
2. Relevance score (0.0 to 1.0)
3. Category (Core, Advanced, Complementary, or Role-specific)
4. Brief description of why it's important
5. Priority level (High, Medium, Low)
6. Estimated learning time in weeks

Return the response as a JSON array with this structure:
[
  {
    "skillName": "Skill Name",
    "relevanceScore": 0.85,
    "category": "Core",
    "description": "Why this skill is important",
    "priority": "High",
    "estimatedLearningTime": "4-6 weeks"
  }
]`;

  try {
    const response = await chat([{ role: 'user', content: prompt }]);
    const suggestions = extractJSON(response);

    if (Array.isArray(suggestions)) {
      return suggestions;
    } else {
      throw new Error('Invalid AI response format');
    }
  } catch (error) {
    console.error('AI skill suggestion failed:', error);
    // Fallback to predefined suggestions
    return generatePredefinedSkillSuggestions(goal, currentSkills, targetRole);
  }
}

/**
 * Generate basic skill suggestions as fallback
 */
function generateBasicSkillSuggestions(goal) {
  const basicSkills = [
    'JavaScript', 'Python', 'HTML', 'CSS', 'Git', 'SQL', 'React', 'Node.js',
    'Machine Learning', 'Data Structures', 'Algorithms', 'Docker', 'AWS'
  ];

  return basicSkills.map(skill => ({
    skillName: skill,
    relevanceScore: 0.6 + Math.random() * 0.3,
    category: 'General',
    description: `Valuable skill for ${goal || 'your career development'}`,
    priority: 'Medium',
    estimatedLearningTime: getEstimatedLearningTime(skill)
  }));
}

/**
 * Get estimated learning time for a skill
 */
function getEstimatedLearningTime(skill) {
  const timeMap = {
    // Programming Languages
    'JavaScript': '6-8 weeks',
    'Python': '4-6 weeks',
    'Java': '8-10 weeks',
    'TypeScript': '2-3 weeks',
    'HTML': '1-2 weeks',
    'CSS': '2-3 weeks',

    // Frameworks/Libraries
    'React': '4-6 weeks',
    'Angular': '6-8 weeks',
    'Vue.js': '3-4 weeks',
    'Node.js': '4-5 weeks',
    'Express.js': '2-3 weeks',

    // Databases
    'MongoDB': '3-4 weeks',
    'PostgreSQL': '4-5 weeks',
    'MySQL': '3-4 weeks',
    'SQL': '3-4 weeks',

    // DevOps/Cloud
    'Docker': '3-4 weeks',
    'Kubernetes': '6-8 weeks',
    'AWS': '8-12 weeks',
    'Azure': '8-12 weeks',
    'GCP': '8-12 weeks',

    // Data Science/ML
    'Machine Learning': '12-16 weeks',
    'Deep Learning': '16-20 weeks',
    'Statistics': '8-10 weeks',
    'Data Structures': '6-8 weeks',
    'Algorithms': '8-12 weeks'
  };

  return timeMap[skill] || '4-6 weeks';
}

module.exports = {
  generateSkillSuggestions,
  GOAL_SKILL_MAPPINGS,
  ROLE_SKILL_MAPPINGS
};