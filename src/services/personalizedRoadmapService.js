const enhancedUserProfileService = require('./enhancedUserProfileService');
const SkillMemoryBank = require('../models/SkillMemoryBank');
const Roadmap = require('../models/Roadmap');
const { chat, extractJSON } = require('./llmClient');
const logger = require('./loggingService');

/**
 * Personalized Roadmap Service
 * Generates roadmaps that exclude user's current skills and focus on skill gaps
 * Integrates with enhanced user profile service for comprehensive personalization
 */
class PersonalizedRoadmapService {
  /**
   * Generate a personalized roadmap for a user based on target skill
   * @param {string} userId - User ID
   * @param {string} targetSkill - Target skill to learn
   * @param {Object} options - Additional options for roadmap generation
   * @returns {Promise<Object>} Generated roadmap with excluded skills
   */
  async generatePersonalizedRoadmap(userId, targetSkill, options = {}) {
    try {
      logger.info(`Starting personalized roadmap generation for user: ${userId}, target skill: ${targetSkill}`);
      
      // Step 1: Validate user profile readiness
      const profileValidation = await enhancedUserProfileService.validateProfileForRoadmap(userId);
      if (!profileValidation.isValid) {
        throw new Error(`User profile incomplete. Missing: ${profileValidation.missingFields.join(', ')}`);
      }
      
      const userProfile = profileValidation.profileData;
      
      // Step 2: Analyze skill gaps and exclusions
      const skillAnalysis = await this.analyzeSkillGaps(userProfile, targetSkill);
      
      // Step 3: Get skill memory bank for weak areas
      const skillMemoryBank = await SkillMemoryBank.findOne({ userId });
      
      // Step 4: Build enhanced prompt with skill exclusions
      const prompt = this.buildSkillExclusionPrompt(userProfile, skillAnalysis, skillMemoryBank, targetSkill, options);
      
      // Step 5: Generate roadmap using LLM
      const llmResponse = await chat(prompt, options.provider || 'ollama');
      const roadmapData = extractJSON(llmResponse);
      
      // Step 6: Validate and enhance roadmap structure
      const validatedRoadmap = this.validateAndEnhanceRoadmap(roadmapData, skillAnalysis, userProfile);
      
      // Step 7: Save roadmap to database
      const savedRoadmap = await this.savePersonalizedRoadmap(userId, targetSkill, validatedRoadmap, skillAnalysis, userProfile);
      
      logger.info(`Successfully generated personalized roadmap for user: ${userId}`);
      return {
        roadmap: savedRoadmap,
        skillAnalysis,
        excludedSkills: skillAnalysis.excludedSkills,
        focusAreas: skillAnalysis.focusAreas
      };
      
    } catch (error) {
      logger.error(`Error generating personalized roadmap: ${error.message}`, {
        userId,
        targetSkill,
        error: error.stack
      });
      throw error;
    }
  }

  /**
   * Analyze skill gaps and determine what to exclude from roadmap
   * @param {Object} userProfile - Enhanced user profile data
   * @param {string} targetSkill - Target skill to learn
   * @returns {Promise<Object>} Skill analysis with exclusions and focus areas
   */
  async analyzeSkillGaps(userProfile, targetSkill) {
    try {
      const analysis = {
        targetSkill,
        excludedSkills: [],
        focusAreas: [],
        skillGaps: [],
        prerequisitesMet: [],
        prerequisitesMissing: [],
        learningPath: 'beginner' // default
      };

      // Get skills to exclude from user profile
      analysis.excludedSkills = [...userProfile.currentSkills.skillsToExclude];
      
      // Analyze target skill prerequisites
      const targetSkillPrereqs = await this.getSkillPrerequisites(targetSkill);
      
      // Check which prerequisites user already has
      targetSkillPrereqs.forEach(prereq => {
        const hasSkill = userProfile.currentSkills.technical.some(skill => 
          skill.toLowerCase().includes(prereq.toLowerCase()) ||
          prereq.toLowerCase().includes(skill.toLowerCase())
        );
        
        if (hasSkill) {
          analysis.prerequisitesMet.push(prereq);
          analysis.excludedSkills.push(prereq); // Exclude from roadmap
        } else {
          analysis.prerequisitesMissing.push(prereq);
          analysis.focusAreas.push(prereq); // Include in roadmap
        }
      });
      
      // Determine learning path based on existing skills
      const relevantSkillsCount = userProfile.currentSkills.technical.filter(skill => 
        this.isSkillRelevantToTarget(skill, targetSkill)
      ).length;
      
      if (relevantSkillsCount >= 3) {
        analysis.learningPath = 'advanced';
      } else if (relevantSkillsCount >= 1) {
        analysis.learningPath = 'intermediate';
      }
      
      // Identify specific skill gaps
      const targetSkillComponents = await this.getSkillComponents(targetSkill);
      analysis.skillGaps = targetSkillComponents.filter(component => 
        !analysis.excludedSkills.some(excluded => 
          excluded.toLowerCase().includes(component.toLowerCase())
        )
      );
      
      // Add skill gaps to focus areas
      analysis.focusAreas.push(...analysis.skillGaps);
      
      // Remove duplicates
      analysis.excludedSkills = [...new Set(analysis.excludedSkills)];
      analysis.focusAreas = [...new Set(analysis.focusAreas)];
      
      logger.info(`Skill analysis completed for ${targetSkill}`, {
        excludedSkills: analysis.excludedSkills.length,
        focusAreas: analysis.focusAreas.length,
        learningPath: analysis.learningPath
      });
      
      return analysis;
      
    } catch (error) {
      logger.error(`Error analyzing skill gaps: ${error.message}`);
      throw error;
    }
  }

  /**
   * Build enhanced prompt that excludes user's current skills
   * @param {Object} userProfile - Enhanced user profile data
   * @param {Object} skillAnalysis - Skill gap analysis
   * @param {Object} skillMemoryBank - User's skill memory bank
   * @param {string} targetSkill - Target skill to learn
   * @param {Object} options - Additional options
   * @returns {string} Enhanced prompt for LLM
   */
  buildSkillExclusionPrompt(userProfile, skillAnalysis, skillMemoryBank, targetSkill, options) {
    const weakAreas = (skillMemoryBank?.concepts || [])
      .filter(c => c.strengthLevel < 50)
      .map(c => `${c.topic} (${c.strengthLevel})`)
      .slice(0, 5);

    const prompt = `Generate a comprehensive personalized learning roadmap for "${targetSkill}" with the following requirements:

USER PROFILE:
- Current Role: ${userProfile.careerContext.currentRole || 'Not specified'}
- Target Role: ${userProfile.careerContext.targetRole || 'Not specified'}
- Experience Level: ${userProfile.careerContext.careerStage}
- Learning Timeline: ${userProfile.timelinePreferences.targetDuration}
- Weekly Commitment: ${userProfile.timelinePreferences.weeklyTimeCommitment} hours
- Learning Preferences: ${userProfile.learningPreferences.learningStyles.join(', ')}
- Content Difficulty: ${userProfile.learningPreferences.contentDifficulty}

SKILL EXCLUSIONS (DO NOT include these in the roadmap as user already knows them):
${skillAnalysis.excludedSkills.map(skill => `- ${skill}`).join('\n')}

FOCUS AREAS (prioritize these in the roadmap):
${skillAnalysis.focusAreas.map(area => `- ${area}`).join('\n')}

WEAK AREAS TO STRENGTHEN:
${weakAreas.join(', ') || 'None identified'}

LEARNING PATH: ${skillAnalysis.learningPath.toUpperCase()}

REQUIREMENTS:
1. Create a ${userProfile.timelinePreferences.targetDuration} roadmap
2. EXCLUDE all skills the user already knows
3. Focus on skill gaps and missing prerequisites
4. Match user's ${skillAnalysis.learningPath} level
5. Respect ${userProfile.timelinePreferences.weeklyTimeCommitment} hours/week commitment
6. Use ${userProfile.learningPreferences.contentDifficulty.toLowerCase()} difficulty level

Return COMPLETE JSON with this exact structure:
{
  "roadmapTitle": "Personalized ${targetSkill} Learning Path",
  "targetSkill": "${targetSkill}",
  "learningPath": "${skillAnalysis.learningPath}",
  "estimatedDuration": "${userProfile.timelinePreferences.targetDuration}",
  "weeklyHours": ${userProfile.timelinePreferences.weeklyTimeCommitment},
  "excludedSkills": ${JSON.stringify(skillAnalysis.excludedSkills)},
  "focusAreas": ${JSON.stringify(skillAnalysis.focusAreas)},
  "phases": [
    {
      "phaseNumber": 1,
      "title": "Foundation Phase",
      "duration": "2-3 weeks",
      "description": "Build essential foundations",
      "milestones": [
        {
          "week": 1,
          "title": "Week 1 Milestone",
          "topics": ["topic1", "topic2"],
          "concepts": ["concept1", "concept2"],
          "estimatedHours": ${Math.ceil(userProfile.timelinePreferences.weeklyTimeCommitment)},
          "difficulty": "${skillAnalysis.learningPath}",
          "resources": []
        }
      ]
    }
  ],
  "prerequisites": ${JSON.stringify(skillAnalysis.prerequisitesMissing)},
  "skillGaps": ${JSON.stringify(skillAnalysis.skillGaps)},
  "personalizedNotes": "Customized for ${userProfile.careerContext.careerStage} level learner"
}

Generate COMPLETE roadmap with ALL phases and milestones. NO placeholders or incomplete sections.`;

    return prompt;
  }

  /**
   * Validate and enhance the generated roadmap
   * @param {Object} roadmapData - Raw roadmap data from LLM
   * @param {Object} skillAnalysis - Skill analysis data
   * @param {Object} userProfile - User profile data
   * @returns {Object} Validated and enhanced roadmap
   */
  validateAndEnhanceRoadmap(roadmapData, skillAnalysis, userProfile) {
    if (!roadmapData || !roadmapData.phases || !Array.isArray(roadmapData.phases)) {
      throw new Error('Invalid roadmap structure received from LLM');
    }

    // Enhance roadmap with additional metadata
    const enhancedRoadmap = {
      ...roadmapData,
      generatedAt: new Date(),
      userId: userProfile.userId,
      profileCompleteness: userProfile.profileCompleteness,
      customizations: {
        excludedSkillsCount: skillAnalysis.excludedSkills.length,
        focusAreasCount: skillAnalysis.focusAreas.length,
        learningPath: skillAnalysis.learningPath,
        personalizedFor: userProfile.careerContext.careerStage
      },
      metadata: {
        generationMethod: 'skill-exclusion',
        profileVersion: '2.0',
        excludedSkills: skillAnalysis.excludedSkills,
        focusAreas: skillAnalysis.focusAreas
      }
    };

    // Validate each phase has required fields
    enhancedRoadmap.phases.forEach((phase, index) => {
      if (!phase.milestones || !Array.isArray(phase.milestones)) {
        throw new Error(`Phase ${index + 1} missing milestones`);
      }
      
      phase.milestones.forEach((milestone, mIndex) => {
        if (!milestone.topics || !milestone.concepts) {
          throw new Error(`Phase ${index + 1}, Milestone ${mIndex + 1} missing required fields`);
        }
      });
    });

    return enhancedRoadmap;
  }

  /**
   * Save the personalized roadmap to database
   * @param {string} userId - User ID
   * @param {string} targetSkill - Target skill
   * @param {Object} roadmapData - Validated roadmap data
   * @param {Object} skillAnalysis - Skill analysis
   * @param {Object} userProfile - User profile
   * @returns {Promise<Object>} Saved roadmap document
   */
  async savePersonalizedRoadmap(userId, targetSkill, roadmapData, skillAnalysis, userProfile) {
    try {
      const roadmap = new Roadmap({
        userId,
        skill: targetSkill,
        level: skillAnalysis.learningPath,
        goal: userProfile.learningGoals.primaryGoal,
        dailyTime: Math.ceil(userProfile.timelinePreferences.weeklyTimeCommitment / 7 * 60), // Convert to minutes
        
        // Enhanced fields for personalized roadmap
        roadmapTitle: roadmapData.roadmapTitle,
        targetSkill: roadmapData.targetSkill,
        learningPath: roadmapData.learningPath,
        estimatedDuration: roadmapData.estimatedDuration,
        weeklyHours: roadmapData.weeklyHours,
        
        // Phases instead of simple steps
        phases: roadmapData.phases,
        
        // Skill exclusion metadata
        excludedSkills: roadmapData.excludedSkills,
        focusAreas: roadmapData.focusAreas,
        prerequisites: roadmapData.prerequisites,
        skillGaps: roadmapData.skillGaps,
        
        // Personalization metadata
        customizations: roadmapData.customizations,
        metadata: roadmapData.metadata,
        personalizedNotes: roadmapData.personalizedNotes,
        
        // Standard fields
        generatedAt: new Date(),
        isPersonalized: true,
        profileCompleteness: userProfile.profileCompleteness
      });

      const savedRoadmap = await roadmap.save();
      
      // Update user profile to mark roadmap as generated
      await this.updateUserProfileRoadmapStatus(userId, savedRoadmap._id);
      
      logger.info(`Personalized roadmap saved for user: ${userId}`, {
        roadmapId: savedRoadmap._id,
        targetSkill,
        excludedSkillsCount: skillAnalysis.excludedSkills.length
      });
      
      return savedRoadmap;
      
    } catch (error) {
      logger.error(`Error saving personalized roadmap: ${error.message}`);
      throw error;
    }
  }

  /**
   * Update user profile to mark roadmap as generated
   * @param {string} userId - User ID
   * @param {string} roadmapId - Generated roadmap ID
   */
  async updateUserProfileRoadmapStatus(userId, roadmapId) {
    try {
      await UserProfile.findOneAndUpdate(
        { userId },
        { 
          roadmapGenerated: true,
          lastGeneratedRoadmapId: roadmapId,
          updatedAt: new Date()
        }
      );
    } catch (error) {
      logger.error(`Error updating user profile roadmap status: ${error.message}`);
      // Don't throw error as this is not critical
    }
  }

  /**
   * Get prerequisites for a target skill
   * @param {string} targetSkill - Target skill name
   * @returns {Promise<Array>} Array of prerequisite skills
   */
  async getSkillPrerequisites(targetSkill) {
    // This would ideally connect to a skills database or API
    // For now, using a simple mapping
    const skillPrerequisites = {
      'React': ['JavaScript', 'HTML', 'CSS'],
      'Node.js': ['JavaScript'],
      'Python': [],
      'Machine Learning': ['Python', 'Statistics', 'Mathematics'],
      'Data Science': ['Python', 'Statistics', 'SQL'],
      'DevOps': ['Linux', 'Networking', 'Cloud Computing'],
      'Mobile Development': ['Programming Fundamentals'],
      'Web Development': ['HTML', 'CSS', 'JavaScript']
    };
    
    return skillPrerequisites[targetSkill] || [];
  }

  /**
   * Get components/sub-skills for a target skill
   * @param {string} targetSkill - Target skill name
   * @returns {Promise<Array>} Array of skill components
   */
  async getSkillComponents(targetSkill) {
    const skillComponents = {
      'React': ['JSX', 'Components', 'Props', 'State', 'Hooks', 'Router', 'Context API'],
      'Node.js': ['Express', 'NPM', 'Modules', 'File System', 'HTTP', 'Databases'],
      'Python': ['Syntax', 'Data Types', 'Functions', 'OOP', 'Libraries', 'Error Handling'],
      'Machine Learning': ['Algorithms', 'Data Preprocessing', 'Model Training', 'Evaluation'],
      'Data Science': ['Data Analysis', 'Visualization', 'Statistical Modeling', 'Pandas', 'NumPy']
    };
    
    return skillComponents[targetSkill] || [targetSkill];
  }

  /**
   * Check if a skill is relevant to the target skill
   * @param {string} skill - User's current skill
   * @param {string} targetSkill - Target skill to learn
   * @returns {boolean} Whether the skill is relevant
   */
  isSkillRelevantToTarget(skill, targetSkill) {
    const relevanceMap = {
      'React': ['JavaScript', 'HTML', 'CSS', 'Frontend', 'Web Development'],
      'Node.js': ['JavaScript', 'Backend', 'Server', 'API'],
      'Python': ['Programming', 'Scripting', 'Backend'],
      'Machine Learning': ['Python', 'Statistics', 'Mathematics', 'Data Science', 'AI'],
      'Data Science': ['Python', 'Statistics', 'SQL', 'Analytics', 'Mathematics']
    };
    
    const relevantSkills = relevanceMap[targetSkill] || [];
    return relevantSkills.some(relevant => 
      skill.toLowerCase().includes(relevant.toLowerCase()) ||
      relevant.toLowerCase().includes(skill.toLowerCase())
    );
  }
}

module.exports = new PersonalizedRoadmapService();