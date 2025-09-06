const UserProfile = require('../models/UserProfile');
const logger = require('./loggingService');

/**
 * Enhanced User Profile Service
 * Fetches and processes user profile data for personalized roadmap generation
 * Extracts current skills and learning preferences while excluding existing competencies
 */
class EnhancedUserProfileService {
  /**
   * Fetch comprehensive user profile data for roadmap generation
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Enhanced profile data with skills and preferences
   */
  async fetchUserProfileForRoadmap(userId) {
    try {
      logger.info(`Fetching user profile for roadmap generation: ${userId}`);
      
      const userProfile = await UserProfile.findByUserId(userId);
      if (!userProfile) {
        throw new Error(`User profile not found for userId: ${userId}`);
      }

      // Extract and process current skills
      const currentSkills = this.extractCurrentSkills(userProfile);
      
      // Extract learning preferences
      const learningPreferences = this.extractLearningPreferences(userProfile);
      
      // Extract career context
      const careerContext = this.extractCareerContext(userProfile);
      
      // Extract learning goals
      const learningGoals = this.extractLearningGoals(userProfile);
      
      // Extract timeline preferences
      const timelinePreferences = this.extractTimelinePreferences(userProfile);

      const enhancedProfile = {
        userId,
        profileId: userProfile._id,
        sessionId: userProfile.sessionId,
        currentSkills,
        learningPreferences,
        careerContext,
        learningGoals,
        timelinePreferences,
        onboardingComplete: userProfile.onboardingComplete,
        profileCompleteness: this.calculateProfileCompleteness(userProfile)
      };

      logger.info(`Successfully fetched enhanced profile for user: ${userId}`);
      return enhancedProfile;
      
    } catch (error) {
      logger.error(`Error fetching user profile for roadmap: ${error.message}`, {
        userId,
        error: error.stack
      });
      throw error;
    }
  }

  /**
   * Extract and categorize current skills from user profile
   * @param {Object} userProfile - User profile document
   * @returns {Object} Categorized skills data
   */
  extractCurrentSkills(userProfile) {
    const skills = {
      technical: [],
      proficiencyLevels: {},
      experienceYears: {},
      recentlyUsed: [],
      prerequisites: new Set(),
      subSkills: new Set(),
      skillsToExclude: [] // Skills to exclude from roadmap generation
    };

    if (userProfile.currentSkills && userProfile.currentSkills.length > 0) {
      userProfile.currentSkills.forEach(skill => {
        const skillName = skill.skillName;
        skills.technical.push(skillName);
        skills.proficiencyLevels[skillName] = skill.proficiencyLevel;
        skills.experienceYears[skillName] = skill.yearsOfExperience || 0;
        
        // Mark recently used skills
        if (skill.lastUsed === 'Currently using' || skill.lastUsed === 'Within 6 months') {
          skills.recentlyUsed.push(skillName);
        }
        
        // Collect prerequisites and sub-skills
        if (skill.prerequisites) {
          skill.prerequisites.forEach(prereq => skills.prerequisites.add(prereq));
        }
        if (skill.subSkills) {
          skill.subSkills.forEach(subSkill => skills.subSkills.add(subSkill));
        }
        
        // Skills to exclude based on proficiency (Intermediate+ skills)
        if (skill.proficiencyLevel === 'Intermediate' || skill.proficiencyLevel === 'Advanced') {
          skills.skillsToExclude.push(skillName);
        }
      });
    }

    // Extract skills from career background
    if (userProfile.careerBackground && userProfile.careerBackground.length > 0) {
      userProfile.careerBackground.forEach(career => {
        if (career.skillsWorkedOn) {
          career.skillsWorkedOn.forEach(skill => {
            if (!skills.technical.includes(skill)) {
              skills.technical.push(skill);
              skills.proficiencyLevels[skill] = 'Intermediate'; // Assume intermediate for work experience
              skills.experienceYears[skill] = career.yearsOfExperience || 1;
              skills.skillsToExclude.push(skill); // Exclude work skills from roadmap
            }
          });
        }
      });
    }

    // Convert sets to arrays
    skills.prerequisites = Array.from(skills.prerequisites);
    skills.subSkills = Array.from(skills.subSkills);

    return skills;
  }

  /**
   * Extract learning preferences from user profile
   * @param {Object} userProfile - User profile document
   * @returns {Object} Learning preferences data
   */
  extractLearningPreferences(userProfile) {
    const preferences = {
      learningStyles: [],
      contentDifficulty: 'Balanced',
      assessmentFrequency: 'Weekly',
      preferredLanguages: [],
      timezone: null
    };

    if (userProfile.learningPreferences) {
      preferences.learningStyles = userProfile.learningPreferences.learningStyles || [];
      preferences.contentDifficulty = userProfile.learningPreferences.contentDifficulty || 'Balanced';
      preferences.assessmentFrequency = userProfile.learningPreferences.assessmentFrequency || 'Weekly';
    }

    preferences.preferredLanguages = userProfile.preferredLanguages || ['English'];
    preferences.timezone = userProfile.timezone;

    return preferences;
  }

  /**
   * Extract career context from user profile
   * @param {Object} userProfile - User profile document
   * @returns {Object} Career context data
   */
  extractCareerContext(userProfile) {
    const context = {
      currentRole: null,
      targetRole: null,
      industry: null,
      totalExperience: 0,
      careerStage: 'entry'
    };

    // Extract from career background
    if (userProfile.careerBackground && userProfile.careerBackground.length > 0) {
      const currentJob = userProfile.careerBackground.find(job => job.isCurrent);
      if (currentJob) {
        context.currentRole = currentJob.position;
        context.totalExperience = currentJob.yearsOfExperience;
      } else {
        // Get most recent job
        const sortedJobs = userProfile.careerBackground.sort((a, b) => 
          new Date(b.endDate || Date.now()) - new Date(a.endDate || Date.now())
        );
        if (sortedJobs.length > 0) {
          context.currentRole = sortedJobs[0].position;
          context.totalExperience = sortedJobs.reduce((total, job) => total + (job.yearsOfExperience || 0), 0);
        }
      }
    }

    context.targetRole = userProfile.targetRole;
    
    // Determine career stage based on experience
    if (context.totalExperience <= 2) {
      context.careerStage = 'entry';
    } else if (context.totalExperience <= 5) {
      context.careerStage = 'junior';
    } else if (context.totalExperience <= 10) {
      context.careerStage = 'mid';
    } else {
      context.careerStage = 'senior';
    }

    return context;
  }

  /**
   * Extract learning goals from user profile
   * @param {Object} userProfile - User profile document
   * @returns {Object} Learning goals data
   */
  extractLearningGoals(userProfile) {
    return {
      primaryGoal: userProfile.primaryGoal,
      targetRole: userProfile.targetRole,
      motivationLevel: userProfile.motivationLevel || 5,
      customGoalDescription: userProfile.customGoalDescription,
      requiredSkills: userProfile.requiredSkills || []
    };
  }

  /**
   * Extract timeline preferences from user profile
   * @param {Object} userProfile - User profile document
   * @returns {Object} Timeline preferences data
   */
  extractTimelinePreferences(userProfile) {
    const timeline = {
      targetDuration: '3 months',
      weeklyTimeCommitment: 5,
      preferredLearningDays: ['Monday', 'Wednesday', 'Friday'],
      startDate: new Date(),
      expectedEndDate: null
    };

    if (userProfile.timeline) {
      timeline.targetDuration = userProfile.timeline.targetDuration || '3 months';
      timeline.weeklyTimeCommitment = userProfile.timeline.weeklyTimeCommitment || 5;
      timeline.preferredLearningDays = userProfile.timeline.preferredLearningDays || timeline.preferredLearningDays;
      timeline.startDate = userProfile.timeline.startDate || new Date();
      timeline.expectedEndDate = userProfile.timeline.expectedEndDate;
    }

    return timeline;
  }

  /**
   * Calculate profile completeness percentage
   * @param {Object} userProfile - User profile document
   * @returns {number} Completeness percentage (0-100)
   */
  calculateProfileCompleteness(userProfile) {
    let completeness = 0;
    const totalFields = 7;

    // Check essential fields
    if (userProfile.fullName && userProfile.email) completeness++;
    if (userProfile.currentSkills && userProfile.currentSkills.length > 0) completeness++;
    if (userProfile.careerBackground && userProfile.careerBackground.length > 0) completeness++;
    if (userProfile.primaryGoal) completeness++;
    if (userProfile.targetRole) completeness++;
    if (userProfile.timeline && userProfile.timeline.targetDuration) completeness++;
    if (userProfile.learningPreferences && userProfile.learningPreferences.learningStyles) completeness++;

    return Math.round((completeness / totalFields) * 100);
  }

  /**
   * Get skills that should be excluded from roadmap generation
   * @param {string} userId - User ID
   * @returns {Promise<Array>} Array of skill names to exclude
   */
  async getSkillsToExclude(userId) {
    try {
      const profileData = await this.fetchUserProfileForRoadmap(userId);
      return profileData.currentSkills.skillsToExclude;
    } catch (error) {
      logger.error(`Error getting skills to exclude for user ${userId}: ${error.message}`);
      return [];
    }
  }

  /**
   * Validate if user profile is ready for roadmap generation
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Validation result with status and missing fields
   */
  async validateProfileForRoadmap(userId) {
    try {
      const profileData = await this.fetchUserProfileForRoadmap(userId);
      const missingFields = [];
      
      if (!profileData.learningGoals.primaryGoal) {
        missingFields.push('Primary learning goal');
      }
      
      if (!profileData.learningGoals.targetRole) {
        missingFields.push('Target role');
      }
      
      if (!profileData.timelinePreferences.targetDuration) {
        missingFields.push('Learning timeline');
      }
      
      if (profileData.currentSkills.technical.length === 0) {
        missingFields.push('Current skills assessment');
      }

      return {
        isValid: missingFields.length === 0,
        missingFields,
        completeness: profileData.profileCompleteness,
        profileData: missingFields.length === 0 ? profileData : null
      };
      
    } catch (error) {
      logger.error(`Error validating profile for roadmap: ${error.message}`);
      return {
        isValid: false,
        missingFields: ['Profile data unavailable'],
        completeness: 0,
        profileData: null
      };
    }
  }
}

module.exports = new EnhancedUserProfileService();