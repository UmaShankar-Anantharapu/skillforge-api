const UserProfile = require('../models/UserProfile');
const SkillMemoryBank = require('../models/SkillMemoryBank');
const { chat } = require('./llmClient');

/**
 * Enhanced User Skill Assessment Service
 * Analyzes user's existing skills to create personalized learning paths
 * Excludes known skills and focuses on skill gaps
 */

/**
 * Assess user's current skill level and identify knowledge gaps
 * @param {string} userId - User ID
 * @param {string} targetSkill - The skill user wants to learn
 * @returns {Object} Skill assessment with gaps and recommendations
 */
async function assessUserSkills(userId, targetSkill) {
  try {
    const userProfile = await UserProfile.findOne({ userId });
    const skillMemoryBank = await SkillMemoryBank.findOne({ userId });

    if (!userProfile) {
      throw new Error('User profile not found');
    }

    // Extract current skills and proficiency levels
    const currentSkills = userProfile.currentSkills || [];
    const careerBackground = userProfile.careerBackground || [];
    const requiredSkills = userProfile.requiredSkills || [];

    // Analyze skill gaps using AI
    const skillGapAnalysis = await analyzeSkillGaps(
      currentSkills,
      careerBackground,
      targetSkill,
      skillMemoryBank
    );

    // Calculate skill coverage and learning priorities
    const skillCoverage = calculateSkillCoverage(currentSkills, targetSkill);
    const learningPriorities = determineLearningPriorities(
      skillGapAnalysis,
      userProfile.timeline?.weeklyTimeCommitment || 10
    );

    return {
      userId,
      targetSkill,
      currentSkills: currentSkills.map(skill => ({
        name: skill.skillName,
        level: skill.proficiencyLevel,
        experience: skill.yearsOfExperience,
        lastUsed: skill.lastUsed,
        shouldExclude: shouldExcludeSkill(skill, targetSkill)
      })),
      skillGaps: skillGapAnalysis.gaps,
      skillCoverage,
      learningPriorities,
      recommendedPath: skillGapAnalysis.recommendedPath,
      estimatedLearningTime: skillGapAnalysis.estimatedTime,
      assessmentDate: new Date()
    };
  } catch (error) {
    console.error('Error in skill assessment:', error);
    throw error;
  }
}

/**
 * Analyze skill gaps using AI-powered analysis
 * @param {Array} currentSkills - User's current skills
 * @param {Array} careerBackground - User's career history
 * @param {string} targetSkill - Target skill to learn
 * @param {Object} skillMemoryBank - User's learning history
 * @returns {Object} Detailed skill gap analysis
 */
async function analyzeSkillGaps(currentSkills, careerBackground, targetSkill, skillMemoryBank) {
  const prompt = `You are an expert skill assessment analyst. Analyze the user's current skills and identify learning gaps for their target skill.

**USER'S CURRENT SKILLS:**
${currentSkills.map(skill => 
  `- ${skill.skillName}: ${skill.proficiencyLevel} (${skill.yearsOfExperience || 0} years, last used: ${skill.lastUsed || 'Unknown'})`
).join('\n')}

**CAREER BACKGROUND:**
${careerBackground.map(bg => 
  `- ${bg.position} at ${bg.company} (${bg.yearsOfExperience} years): ${bg.skillsWorkedOn?.join(', ') || 'No skills specified'}`
).join('\n')}

**TARGET SKILL:** ${targetSkill}

**LEARNING HISTORY:**
${skillMemoryBank?.concepts?.map(concept => 
  `- ${concept.topic}: ${concept.strengthLevel}% strength, ${concept.practiceCount} practices`
).join('\n') || 'No previous learning data'}

**INSTRUCTIONS:**
Analyze the skill gaps and provide a JSON response with:
1. Skills to exclude (user already knows well)
2. Prerequisite skills needed
3. Core skills to focus on
4. Advanced skills for later
5. Estimated learning time for each gap
6. Recommended learning path

Return ONLY valid JSON:
{
  "gaps": [
    {
      "skillName": "Skill name",
      "currentLevel": "None/Beginner/Intermediate/Advanced",
      "targetLevel": "Beginner/Intermediate/Advanced",
      "priority": 1-10,
      "estimatedHours": 20,
      "category": "prerequisite/core/advanced",
      "reason": "Why this skill is needed"
    }
  ],
  "excludedSkills": [
    {
      "skillName": "Skill name",
      "reason": "Why excluded (already proficient)"
    }
  ],
  "recommendedPath": [
    "Step 1: Learn prerequisite skills",
    "Step 2: Master core concepts",
    "Step 3: Advanced applications"
  ],
  "estimatedTime": "3-6 months"
}`;

  try {
    const response = await chat([
      { role: 'system', content: 'You are a skill assessment expert. Always respond with valid JSON only.' },
      { role: 'user', content: prompt }
    ]);

    // Extract and parse JSON from response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No valid JSON found in AI response');
    }

    return JSON.parse(jsonMatch[0]);
  } catch (error) {
    console.error('Error in AI skill gap analysis:', error);
    // Return fallback analysis
    return {
      gaps: [
        {
          skillName: targetSkill,
          currentLevel: 'Beginner',
          targetLevel: 'Intermediate',
          priority: 8,
          estimatedHours: 40,
          category: 'core',
          reason: 'Primary learning objective'
        }
      ],
      excludedSkills: [],
      recommendedPath: [
        'Start with fundamentals',
        'Practice with projects',
        'Apply in real scenarios'
      ],
      estimatedTime: '2-3 months'
    };
  }
}

/**
 * Calculate skill coverage percentage
 * @param {Array} currentSkills - User's current skills
 * @param {string} targetSkill - Target skill
 * @returns {Object} Skill coverage analysis
 */
function calculateSkillCoverage(currentSkills, targetSkill) {
  const relevantSkills = currentSkills.filter(skill => 
    isSkillRelevant(skill.skillName, targetSkill)
  );

  const totalRelevantSkills = getRequiredSkillsForTarget(targetSkill).length;
  const coveragePercentage = totalRelevantSkills > 0 
    ? (relevantSkills.length / totalRelevantSkills) * 100 
    : 0;

  return {
    coveragePercentage: Math.round(coveragePercentage),
    relevantSkills: relevantSkills.length,
    totalRequired: totalRelevantSkills,
    missingSkills: Math.max(0, totalRelevantSkills - relevantSkills.length)
  };
}

/**
 * Determine learning priorities based on skill gaps and time commitment
 * @param {Object} skillGapAnalysis - Result from skill gap analysis
 * @param {number} weeklyHours - Weekly time commitment
 * @returns {Array} Prioritized learning items
 */
function determineLearningPriorities(skillGapAnalysis, weeklyHours) {
  const { gaps } = skillGapAnalysis;
  
  // Sort gaps by priority and category
  const sortedGaps = gaps.sort((a, b) => {
    // Prioritize prerequisites first
    if (a.category === 'prerequisite' && b.category !== 'prerequisite') return -1;
    if (b.category === 'prerequisite' && a.category !== 'prerequisite') return 1;
    
    // Then by priority score
    return b.priority - a.priority;
  });

  // Calculate realistic timeline based on weekly commitment
  let cumulativeHours = 0;
  const priorities = sortedGaps.map((gap, index) => {
    cumulativeHours += gap.estimatedHours;
    const weeksToComplete = Math.ceil(gap.estimatedHours / weeklyHours);
    const startWeek = Math.ceil(cumulativeHours / weeklyHours) - weeksToComplete + 1;
    
    return {
      ...gap,
      order: index + 1,
      startWeek,
      endWeek: Math.ceil(cumulativeHours / weeklyHours),
      canStartImmediately: index < 3 // Allow parallel learning for top 3 priorities
    };
  });

  return priorities;
}

/**
 * Check if a skill should be excluded from learning path
 * @param {Object} skill - User's current skill
 * @param {string} targetSkill - Target skill to learn
 * @returns {boolean} Whether to exclude this skill
 */
function shouldExcludeSkill(skill, targetSkill) {
  // Exclude if user is already advanced in this skill
  if (skill.proficiencyLevel === 'Advanced') {
    return true;
  }
  
  // Exclude if user has significant experience and used recently
  if (skill.yearsOfExperience >= 2 && 
      ['Currently using', 'Within 6 months'].includes(skill.lastUsed)) {
    return true;
  }
  
  // Exclude if skill is not relevant to target
  if (!isSkillRelevant(skill.skillName, targetSkill)) {
    return true;
  }
  
  return false;
}

/**
 * Check if a skill is relevant to the target skill
 * @param {string} skillName - Name of the skill
 * @param {string} targetSkill - Target skill
 * @returns {boolean} Whether the skill is relevant
 */
function isSkillRelevant(skillName, targetSkill) {
  const skillLower = skillName.toLowerCase();
  const targetLower = targetSkill.toLowerCase();
  
  // Direct match
  if (skillLower.includes(targetLower) || targetLower.includes(skillLower)) {
    return true;
  }
  
  // Technology family matching
  const techFamilies = {
    'javascript': ['react', 'node.js', 'vue', 'angular', 'typescript'],
    'python': ['django', 'flask', 'pandas', 'numpy', 'machine learning'],
    'java': ['spring', 'hibernate', 'android'],
    'web development': ['html', 'css', 'javascript', 'react', 'vue', 'angular'],
    'data science': ['python', 'r', 'sql', 'machine learning', 'statistics'],
    'mobile development': ['react native', 'flutter', 'swift', 'kotlin', 'android', 'ios']
  };
  
  for (const [family, skills] of Object.entries(techFamilies)) {
    if (targetLower.includes(family) && skills.some(s => skillLower.includes(s))) {
      return true;
    }
    if (skillLower.includes(family) && skills.some(s => targetLower.includes(s))) {
      return true;
    }
  }
  
  return false;
}

/**
 * Get required skills for a target skill (simplified mapping)
 * @param {string} targetSkill - Target skill
 * @returns {Array} Array of required skills
 */
function getRequiredSkillsForTarget(targetSkill) {
  const skillMappings = {
    'react': ['javascript', 'html', 'css', 'es6', 'jsx'],
    'node.js': ['javascript', 'npm', 'express', 'async programming'],
    'python': ['programming fundamentals', 'data types', 'functions', 'oop'],
    'machine learning': ['python', 'statistics', 'linear algebra', 'pandas', 'numpy'],
    'web development': ['html', 'css', 'javascript', 'responsive design'],
    'data science': ['python', 'statistics', 'sql', 'data visualization']
  };
  
  const targetLower = targetSkill.toLowerCase();
  for (const [skill, requirements] of Object.entries(skillMappings)) {
    if (targetLower.includes(skill)) {
      return requirements;
    }
  }
  
  return []; // Default empty array if no mapping found
}

/**
 * Update user's skill assessment in their profile
 * @param {string} userId - User ID
 * @param {Object} assessment - Skill assessment results
 * @returns {Object} Updated user profile
 */
async function updateUserSkillAssessment(userId, assessment) {
  try {
    const updateData = {
      'skillAssessment': {
        lastAssessment: assessment.assessmentDate,
        skillCoverage: assessment.skillCoverage,
        learningPriorities: assessment.learningPriorities,
        excludedSkills: assessment.currentSkills
          .filter(skill => skill.shouldExclude)
          .map(skill => skill.name)
      }
    };

    const updatedProfile = await UserProfile.findOneAndUpdate(
      { userId },
      { $set: updateData },
      { new: true }
    );

    return updatedProfile;
  } catch (error) {
    console.error('Error updating skill assessment:', error);
    throw error;
  }
}

module.exports = {
  assessUserSkills,
  analyzeSkillGaps,
  calculateSkillCoverage,
  determineLearningPriorities,
  shouldExcludeSkill,
  isSkillRelevant,
  updateUserSkillAssessment
};