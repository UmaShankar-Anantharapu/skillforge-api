const { v4: uuidv4 } = require('uuid');
const { loggingService } = require('./loggingService');
const enhancedUserProfileService = require('./enhancedUserProfileService');
const { searchRoadmapsMultiSource } = require('./enhancedWebScrapingService');
const { processScrapedDataWithOllama } = require('./ollamaRoadmapProcessor');
const { collectResourcesForRoadmap } = require('./resourceCollectionService');
const { statusTracker, STATUS_TYPES, WORKFLOW_STAGES } = require('./statusTrackingService');
const workflowErrorHandler = require('./workflowErrorHandlingService');
const Roadmap = require('../models/Roadmap');
const UserProfile = require('../models/UserProfile');

/**
 * Personalized Roadmap Workflow Service
 * Main orchestrator for the complete roadmap generation workflow
 */

/**
 * Generate personalized roadmap workflow
 * @param {string} userId - User ID
 * @param {string} targetSkill - Target skill to learn
 * @param {Object} options - Workflow options
 * @returns {Promise<Object>} Workflow result with roadmap and status
 */
async function generatePersonalizedRoadmapWorkflow(userId, targetSkill, options = {}) {
  const workflowId = uuidv4();
  
  try {
    const {
      priority = 'medium',
      maxResourcesPerTopic = 5,
      validateResources = true,
      useCache = true,
      customPreferences = {}
    } = options;

    loggingService.info(`Starting personalized roadmap workflow for user ${userId}, skill: ${targetSkill}`);

    // Initialize workflow tracking
    const workflow = statusTracker.initializeWorkflow(workflowId, {
      userId,
      targetSkill,
      priority,
      metadata: {
        maxResourcesPerTopic,
        validateResources,
        useCache,
        customPreferences
      }
    });

    let roadmapResult = null;
    let enhancedRoadmap = null;

    try {
      // Stage 1: Profile Data Fetch
      statusTracker.startStage(workflowId, 'PROFILE_FETCH', { targetSkill });
      const profileData = await fetchAndValidateProfile(userId, workflowId);
      statusTracker.completeStage(workflowId, 'PROFILE_FETCH', { profileCompleteness: profileData.completeness });

      // Stage 2: Skill Analysis
      statusTracker.startStage(workflowId, 'SKILL_ANALYSIS', { currentSkills: profileData.currentSkills.length });
      const skillAnalysis = await analyzeUserSkills(profileData, targetSkill, workflowId);
      statusTracker.completeStage(workflowId, 'SKILL_ANALYSIS', { 
        excludedSkills: skillAnalysis.excludedSkills.length,
        focusAreas: skillAnalysis.focusAreas.length
      });

      // Stage 3: Web Scraping
      statusTracker.startStage(workflowId, 'WEB_SCRAPING', { targetSkill });
      const scrapedData = await performWebScraping(targetSkill, skillAnalysis, workflowId);
      statusTracker.completeStage(workflowId, 'WEB_SCRAPING', { 
        sourcesScraped: scrapedData.sources.length,
        roadmapsFound: scrapedData.roadmaps.length
      });

      // Stage 4: Ollama Processing
      statusTracker.startStage(workflowId, 'OLLAMA_PROCESSING', { 
        roadmapsToProcess: scrapedData.roadmaps.length
      });
      roadmapResult = await processWithOllama(scrapedData, profileData, skillAnalysis, workflowId);
      statusTracker.completeStage(workflowId, 'OLLAMA_PROCESSING', { 
        phasesGenerated: roadmapResult.phases.length,
        totalTopics: roadmapResult.phases.reduce((sum, phase) => sum + phase.topics.length, 0)
      });

      // Stage 5: Resource Collection
      statusTracker.startStage(workflowId, 'RESOURCE_COLLECTION', { 
        topicsToProcess: roadmapResult.phases.reduce((sum, phase) => sum + phase.topics.length, 0)
      });
      enhancedRoadmap = await collectResources(roadmapResult, targetSkill, maxResourcesPerTopic, validateResources, workflowId);
      statusTracker.completeStage(workflowId, 'RESOURCE_COLLECTION', { 
        totalResources: enhancedRoadmap.resourceMetadata.totalResources
      });

      // Stage 6: Finalization
      statusTracker.startStage(workflowId, 'FINALIZATION', { roadmapId: enhancedRoadmap.id });
      const savedRoadmap = await finalizeRoadmap(enhancedRoadmap, userId, profileData, skillAnalysis, workflowId);
      statusTracker.completeStage(workflowId, 'FINALIZATION', { roadmapId: savedRoadmap._id });

      // Complete workflow
      const finalResult = {
        success: true,
        workflowId,
        roadmap: savedRoadmap,
        metadata: {
          profileCompleteness: profileData.completeness,
          excludedSkills: skillAnalysis.excludedSkills,
          focusAreas: skillAnalysis.focusAreas,
          totalResources: enhancedRoadmap.resourceMetadata.totalResources,
          processingTime: statusTracker.getWorkflowStatus(workflowId)?.timing?.actualDuration
        }
      };

      statusTracker.completeWorkflow(workflowId, finalResult);
      
      loggingService.info(`Personalized roadmap workflow completed successfully for user ${userId}`);
      return finalResult;

    } catch (stageError) {
      // Handle stage-specific errors
      const currentStage = statusTracker.getWorkflowStatus(workflowId)?.progress?.currentStage;
      if (currentStage) {
        statusTracker.failStage(workflowId, currentStage, stageError);
      }
      
      statusTracker.failWorkflow(workflowId, stageError);
      throw stageError;
    }

  } catch (error) {
    loggingService.error(`Personalized roadmap workflow failed for user ${userId}:`, error);
    
    // Ensure workflow is marked as failed
    if (statusTracker.getWorkflowStatus(workflowId)) {
      statusTracker.failWorkflow(workflowId, error);
    }
    
    return {
      success: false,
      workflowId,
      error: error.message,
      roadmap: null,
      metadata: {
        failureStage: statusTracker.getWorkflowStatus(workflowId)?.progress?.currentStage,
        processingTime: statusTracker.getWorkflowStatus(workflowId)?.timing?.actualDuration
      }
    };
  }
}

/**
 * Fetch and validate user profile
 * @param {string} userId - User ID
 * @param {string} workflowId - Workflow ID for tracking
 * @returns {Promise<Object>} Enhanced profile data
 */
async function fetchAndValidateProfile(userId, workflowId) {
  try {
    statusTracker.updateStageProgress(workflowId, 'PROFILE_FETCH', 25, { step: 'fetching_profile' });
    
    const profileData = await enhancedUserProfileService.fetchUserProfileForRoadmap(userId);
    
    statusTracker.updateStageProgress(workflowId, 'PROFILE_FETCH', 50, { step: 'validating_profile' });
    
    const isReady = await enhancedUserProfileService.validateProfileForRoadmap(userId);
    if (!isReady.ready) {
      throw new Error(`Profile not ready for roadmap generation: ${isReady.missingFields.join(', ')}`);
    }
    
    statusTracker.updateStageProgress(workflowId, 'PROFILE_FETCH', 100, { 
      step: 'profile_validated',
      completeness: profileData.completeness
    });
    
    return profileData;
    
  } catch (error) {
    loggingService.error(`Profile fetch failed for user ${userId}:`, error);
    
    const errorResult = await workflowErrorHandler.handleStageError(
      workflowId,
      'PROFILE_FETCH',
      error,
      { userId }
    );
    
    if (errorResult.success && errorResult.fallbackUsed) {
      return errorResult.data;
    }
    
    if (errorResult.critical) {
      throw error;
    }
    
    // If we can continue with fallback data
    if (errorResult.canContinue && errorResult.data) {
      return errorResult.data;
    }
    
    throw new Error(`Profile fetch failed: ${error.message}`);
  }
}

/**
 * Analyze user skills for roadmap customization
 * @param {Object} profileData - User profile data
 * @param {string} targetSkill - Target skill
 * @param {string} workflowId - Workflow ID for tracking
 * @returns {Promise<Object>} Skill analysis result
 */
async function analyzeUserSkills(profileData, targetSkill, workflowId) {
  try {
    statusTracker.updateStageProgress(workflowId, 'SKILL_ANALYSIS', 25, { step: 'analyzing_current_skills' });
    
    // Extract skills to exclude (high proficiency skills)
    const excludedSkills = profileData.currentSkills
      .filter(skill => skill.proficiencyLevel >= 7) // Advanced/Expert level
      .map(skill => skill.skillName);
    
    statusTracker.updateStageProgress(workflowId, 'SKILL_ANALYSIS', 50, { 
      step: 'identifying_excluded_skills',
      excludedCount: excludedSkills.length
    });
    
    // Identify focus areas based on learning goals and preferences
    const focusAreas = identifyFocusAreas(profileData, targetSkill);
    
    statusTracker.updateStageProgress(workflowId, 'SKILL_ANALYSIS', 75, { 
      step: 'identifying_focus_areas',
      focusAreasCount: focusAreas.length
    });
    
    // Analyze skill gaps
    const skillGaps = analyzeSkillGaps(profileData, targetSkill, excludedSkills);
    
    statusTracker.updateStageProgress(workflowId, 'SKILL_ANALYSIS', 100, { 
      step: 'analysis_complete',
      skillGapsCount: skillGaps.length
    });
    
    return {
      excludedSkills,
      focusAreas,
      skillGaps,
      learningPreferences: profileData.learningPreferences,
      timeline: profileData.timeline
    };
    
  } catch (error) {
    loggingService.error('Skill analysis failed:', error);
    
    const errorResult = await workflowErrorHandler.handleStageError(
      workflowId,
      'SKILL_ANALYSIS',
      error,
      { profileData, targetSkill }
    );
    
    if (errorResult.success && errorResult.fallbackUsed) {
      return errorResult.data;
    }
    
    if (errorResult.critical) {
      throw error;
    }
    
    // If we can continue with fallback data
    if (errorResult.canContinue && errorResult.data) {
      return errorResult.data;
    }
    
    throw new Error(`Skill analysis failed: ${error.message}`);
  }
}

/**
 * Perform web scraping for roadmap data
 * @param {string} targetSkill - Target skill
 * @param {Object} skillAnalysis - Skill analysis result
 * @param {string} workflowId - Workflow ID for tracking
 * @returns {Promise<Object>} Scraped data
 */
async function performWebScraping(targetSkill, skillAnalysis, workflowId) {
  try {
    statusTracker.updateStageProgress(workflowId, 'WEB_SCRAPING', 20, { step: 'initializing_scraping' });
    
    const scrapingOptions = {
      maxResults: 10,
      sources: ['roadmap.sh', 'github', 'freecodecamp', 'medium'],
      excludeSkills: skillAnalysis.excludedSkills,
      focusAreas: skillAnalysis.focusAreas
    };
    
    statusTracker.updateStageProgress(workflowId, 'WEB_SCRAPING', 50, { 
      step: 'scraping_sources',
      sources: scrapingOptions.sources
    });
    
    const scrapedData = await searchRoadmapsMultiSource(targetSkill, scrapingOptions);
    
    statusTracker.updateStageProgress(workflowId, 'WEB_SCRAPING', 80, { 
      step: 'processing_scraped_data',
      roadmapsFound: scrapedData.roadmaps.length
    });
    
    // Validate scraped data quality
    const validatedData = validateScrapedData(scrapedData, targetSkill);
    
    statusTracker.updateStageProgress(workflowId, 'WEB_SCRAPING', 100, { 
      step: 'scraping_complete',
      validRoadmaps: validatedData.roadmaps.length
    });
    
    return validatedData;
    
  } catch (error) {
    loggingService.error('Web scraping failed:', error);
    
    const errorResult = await workflowErrorHandler.handleStageError(
      workflowId,
      'WEB_SCRAPING',
      error,
      { targetSkill, skillAnalysis }
    );
    
    if (errorResult.success && errorResult.fallbackUsed) {
      return errorResult.data;
    }
    
    if (errorResult.critical) {
      throw error;
    }
    
    // If we can continue with fallback data
    if (errorResult.canContinue && errorResult.data) {
      return errorResult.data;
    }
    
    throw new Error(`Web scraping failed: ${error.message}`);
  }
}

/**
 * Process scraped data with Ollama
 * @param {Object} scrapedData - Scraped roadmap data
 * @param {Object} profileData - User profile data
 * @param {Object} skillAnalysis - Skill analysis result
 * @param {string} workflowId - Workflow ID for tracking
 * @returns {Promise<Object>} Generated roadmap
 */
async function processWithOllama(scrapedData, profileData, skillAnalysis, workflowId) {
  try {
    statusTracker.updateStageProgress(workflowId, 'OLLAMA_PROCESSING', 20, { step: 'preparing_context' });
    
    const ollamaOptions = {
      userContext: {
        currentSkills: profileData.currentSkills,
        learningPreferences: profileData.learningPreferences,
        timeline: profileData.timeline,
        difficultyPreference: profileData.difficultyPreference || 'intermediate'
      },
      excludedSkills: skillAnalysis.excludedSkills,
      focusAreas: skillAnalysis.focusAreas,
      useCache: true
    };
    
    statusTracker.updateStageProgress(workflowId, 'OLLAMA_PROCESSING', 50, { 
      step: 'processing_with_ollama',
      contextPrepared: true
    });
    
    const roadmapResult = await processScrapedDataWithOllama(scrapedData, ollamaOptions);
    
    statusTracker.updateStageProgress(workflowId, 'OLLAMA_PROCESSING', 80, { 
      step: 'validating_roadmap',
      phasesGenerated: roadmapResult.phases.length
    });
    
    // Validate generated roadmap structure
    const validatedRoadmap = validateGeneratedRoadmap(roadmapResult, skillAnalysis);
    
    statusTracker.updateStageProgress(workflowId, 'OLLAMA_PROCESSING', 100, { 
      step: 'ollama_processing_complete',
      roadmapValidated: true
    });
    
    return validatedRoadmap;
    
  } catch (error) {
    loggingService.error('Ollama processing failed:', error);
    
    const errorResult = await workflowErrorHandler.handleStageError(
      workflowId,
      'OLLAMA_PROCESSING',
      error,
      { scrapedData, profileData, skillAnalysis }
    );
    
    if (errorResult.success && errorResult.fallbackUsed) {
      return errorResult.data;
    }
    
    // Ollama processing is critical - cannot continue without it
    throw new Error(`Ollama processing failed: ${error.message}`);
  }
}

/**
 * Collect resources for the generated roadmap
 * @param {Object} roadmapResult - Generated roadmap
 * @param {string} targetSkill - Target skill
 * @param {number} maxResourcesPerTopic - Maximum resources per topic
 * @param {boolean} validateResources - Whether to validate resources
 * @param {string} workflowId - Workflow ID for tracking
 * @returns {Promise<Object>} Enhanced roadmap with resources
 */
async function collectResources(roadmapResult, targetSkill, maxResourcesPerTopic, validateResources, workflowId) {
  try {
    const totalTopics = roadmapResult.phases.reduce((sum, phase) => sum + phase.topics.length, 0);
    let processedTopics = 0;
    
    statusTracker.updateStageProgress(workflowId, 'RESOURCE_COLLECTION', 10, { 
      step: 'initializing_collection',
      totalTopics
    });
    
    const resourceOptions = {
      maxResourcesPerTopic,
      resourceTypes: ['documentation', 'tutorial', 'video', 'project'],
      validateQuality: validateResources,
      useCache: true,
      targetSkill
    };
    
    // Set up progress tracking for resource collection
    const originalCollectResourcesForTopic = require('./resourceCollectionService').collectResourcesForTopic;
    
    // Override the function to track progress
    require('./resourceCollectionService').collectResourcesForTopic = async function(topic, skill, options) {
      const result = await originalCollectResourcesForTopic.call(this, topic, skill, options);
      processedTopics++;
      const progress = Math.min(10 + (processedTopics / totalTopics) * 80, 90);
      
      statusTracker.updateStageProgress(workflowId, 'RESOURCE_COLLECTION', progress, {
        step: 'collecting_resources',
        processedTopics,
        totalTopics,
        currentTopic: topic
      });
      
      // Update resource progress
      statusTracker.updateResourceProgress(workflowId, {
        collected: processedTopics * maxResourcesPerTopic,
        validated: validateResources ? processedTopics * maxResourcesPerTopic : 0,
        failed: 0,
        totalExpected: totalTopics * maxResourcesPerTopic
      });
      
      return result;
    };
    
    const enhancedRoadmap = await collectResourcesForRoadmap(roadmapResult, resourceOptions);
    
    // Restore original function
    require('./resourceCollectionService').collectResourcesForTopic = originalCollectResourcesForTopic;
    
    statusTracker.updateStageProgress(workflowId, 'RESOURCE_COLLECTION', 100, { 
      step: 'resource_collection_complete',
      totalResources: enhancedRoadmap.resourceMetadata.totalResources
    });
    
    return enhancedRoadmap;
    
  } catch (error) {
    loggingService.error('Resource collection failed:', error);
    
    const errorResult = await workflowErrorHandler.handleStageError(
      workflowId,
      'RESOURCE_COLLECTION',
      error,
      { roadmapResult, targetSkill }
    );
    
    if (errorResult.success && errorResult.fallbackUsed) {
      return errorResult.data;
    }
    
    if (errorResult.critical) {
      throw error;
    }
    
    // If we can continue with fallback data
    if (errorResult.canContinue && errorResult.data) {
      return errorResult.data;
    }
    
    throw new Error(`Resource collection failed: ${error.message}`);
  }
}

/**
 * Finalize and save the roadmap
 * @param {Object} enhancedRoadmap - Enhanced roadmap with resources
 * @param {string} userId - User ID
 * @param {Object} profileData - User profile data
 * @param {Object} skillAnalysis - Skill analysis result
 * @param {string} workflowId - Workflow ID for tracking
 * @returns {Promise<Object>} Saved roadmap
 */
async function finalizeRoadmap(enhancedRoadmap, userId, profileData, skillAnalysis, workflowId) {
  try {
    statusTracker.updateStageProgress(workflowId, 'FINALIZATION', 25, { step: 'preparing_roadmap_data' });
    
    // Prepare roadmap data for database
    const roadmapData = {
      userId,
      profileId: profileData.profileId,
      title: enhancedRoadmap.title,
      description: enhancedRoadmap.description,
      targetSkill: enhancedRoadmap.targetSkill,
      difficulty: enhancedRoadmap.difficulty,
      estimatedDuration: enhancedRoadmap.estimatedDuration,
      
      // Personalized fields
      isPersonalized: true,
      excludedSkills: skillAnalysis.excludedSkills,
      focusAreas: skillAnalysis.focusAreas,
      profileCompleteness: profileData.completeness,
      
      // Phases and resources
      phases: enhancedRoadmap.phases,
      
      // Metadata
      metadata: {
        generationMethod: 'personalized_workflow',
        workflowId,
        profileVersion: profileData.version || '1.0',
        excludedSkills: skillAnalysis.excludedSkills,
        focusAreas: skillAnalysis.focusAreas,
        skillAnalysis: {
          excludedSkillsCount: skillAnalysis.excludedSkills.length,
          focusAreasCount: skillAnalysis.focusAreas.length,
          skillGapsCount: skillAnalysis.skillGaps.length
        },
        resourceMetadata: enhancedRoadmap.resourceMetadata
      },
      
      // Status
      status: 'active',
      isPublic: false
    };
    
    statusTracker.updateStageProgress(workflowId, 'FINALIZATION', 50, { step: 'saving_roadmap' });
    
    // Save roadmap to database
    const savedRoadmap = await Roadmap.create(roadmapData);
    
    statusTracker.updateStageProgress(workflowId, 'FINALIZATION', 75, { 
      step: 'updating_user_profile',
      roadmapId: savedRoadmap._id
    });
    
    // Update user profile with roadmap reference
    await UserProfile.findByIdAndUpdate(profileData.profileId, {
      lastGeneratedRoadmapId: savedRoadmap._id,
      roadmapGenerated: true,
      updatedAt: new Date()
    });
    
    statusTracker.updateStageProgress(workflowId, 'FINALIZATION', 100, { 
      step: 'finalization_complete',
      roadmapId: savedRoadmap._id
    });
    
    loggingService.info(`Roadmap finalized and saved with ID: ${savedRoadmap._id}`);
    return savedRoadmap;
    
  } catch (error) {
    loggingService.error('Roadmap finalization failed:', error);
    
    const errorResult = await workflowErrorHandler.handleStageError(
      workflowId,
      'FINALIZATION',
      error,
      { enhancedRoadmap, userId, profileData, skillAnalysis }
    );
    
    if (errorResult.success && errorResult.fallbackUsed) {
      return errorResult.data;
    }
    
    // Finalization is critical - cannot continue without it
    throw new Error(`Roadmap finalization failed: ${error.message}`);
  }
}

/**
 * Get workflow status
 * @param {string} workflowId - Workflow ID
 * @returns {Object|null} Workflow status
 */
function getWorkflowStatus(workflowId) {
  return statusTracker.getWorkflowStatus(workflowId);
}

/**
 * Get detailed workflow status
 * @param {string} workflowId - Workflow ID
 * @returns {Object|null} Detailed workflow status
 */
function getDetailedWorkflowStatus(workflowId) {
  return statusTracker.getDetailedWorkflowStatus(workflowId);
}

/**
 * Get user's workflow history
 * @param {string} userId - User ID
 * @param {number} page - Page number (1-based)
 * @param {number} limit - Maximum number of workflows per page
 * @returns {Object} User's workflow history with pagination
 */
function getUserWorkflowHistory(userId, page = 1, limit = 10) {
  const allWorkflows = statusTracker.getUserWorkflowHistory(userId, 1000); // Get all workflows
  const totalCount = allWorkflows.length;
  const totalPages = Math.ceil(totalCount / limit);
  const startIndex = (page - 1) * limit;
  const endIndex = startIndex + limit;
  const workflows = allWorkflows.slice(startIndex, endIndex);
  
  return {
    workflows,
    totalCount,
    totalPages,
    currentPage: page,
    hasNext: page < totalPages,
    hasPrev: page > 1
  };
}

/**
 * Get user's active workflows
 * @param {string} userId - User ID
 * @returns {Array} User's active workflows
 */
function getActiveWorkflows(userId) {
  const allActiveWorkflows = statusTracker.getActiveWorkflows();
  return allActiveWorkflows.filter(workflow => workflow.userId === userId);
}

/**
 * Get global workflow statistics
 * @returns {Object} Global statistics
 */
function getGlobalWorkflowStats() {
  return statusTracker.getGlobalStats();
}

/**
 * Helper function to identify focus areas
 * @param {Object} profileData - User profile data
 * @param {string} targetSkill - Target skill
 * @returns {Array} Focus areas
 */
function identifyFocusAreas(profileData, targetSkill) {
  const focusAreas = [];
  
  // Add focus areas based on learning goals
  if (profileData.primaryGoal) {
    focusAreas.push(profileData.primaryGoal);
  }
  
  // Add focus areas based on target role
  if (profileData.targetRole) {
    focusAreas.push(profileData.targetRole);
  }
  
  // Add focus areas based on required skills
  if (profileData.requiredSkills && profileData.requiredSkills.length > 0) {
    focusAreas.push(...profileData.requiredSkills.slice(0, 3)); // Top 3 required skills
  }
  
  // Add target skill if not already included
  if (!focusAreas.includes(targetSkill)) {
    focusAreas.push(targetSkill);
  }
  
  return [...new Set(focusAreas)]; // Remove duplicates
}

/**
 * Helper function to analyze skill gaps
 * @param {Object} profileData - User profile data
 * @param {string} targetSkill - Target skill
 * @param {Array} excludedSkills - Skills to exclude
 * @returns {Array} Skill gaps
 */
function analyzeSkillGaps(profileData, targetSkill, excludedSkills) {
  const skillGaps = [];
  
  // Identify gaps based on required skills vs current skills
  if (profileData.requiredSkills) {
    profileData.requiredSkills.forEach(requiredSkill => {
      const hasSkill = profileData.currentSkills.some(skill => 
        skill.skillName.toLowerCase() === requiredSkill.toLowerCase() && 
        skill.proficiencyLevel >= 5
      );
      
      if (!hasSkill && !excludedSkills.includes(requiredSkill)) {
        skillGaps.push({
          skill: requiredSkill,
          type: 'required',
          priority: 'high'
        });
      }
    });
  }
  
  // Add target skill if not in current skills
  const hasTargetSkill = profileData.currentSkills.some(skill => 
    skill.skillName.toLowerCase() === targetSkill.toLowerCase()
  );
  
  if (!hasTargetSkill) {
    skillGaps.push({
      skill: targetSkill,
      type: 'target',
      priority: 'critical'
    });
  }
  
  return skillGaps;
}

/**
 * Helper function to validate scraped data
 * @param {Object} scrapedData - Scraped data
 * @param {string} targetSkill - Target skill
 * @returns {Object} Validated scraped data
 */
function validateScrapedData(scrapedData, targetSkill) {
  // Filter out low-quality roadmaps
  const validRoadmaps = scrapedData.roadmaps.filter(roadmap => {
    return roadmap.qualityScore > 0.5 && 
           roadmap.relevanceScore > 0.6 &&
           roadmap.title.toLowerCase().includes(targetSkill.toLowerCase());
  });
  
  return {
    ...scrapedData,
    roadmaps: validRoadmaps
  };
}

/**
 * Helper function to validate generated roadmap
 * @param {Object} roadmapResult - Generated roadmap
 * @param {Object} skillAnalysis - Skill analysis
 * @returns {Object} Validated roadmap
 */
function validateGeneratedRoadmap(roadmapResult, skillAnalysis) {
  // Ensure roadmap has required structure
  if (!roadmapResult.phases || roadmapResult.phases.length === 0) {
    throw new Error('Generated roadmap has no phases');
  }
  
  // Ensure each phase has topics
  roadmapResult.phases.forEach((phase, index) => {
    if (!phase.topics || phase.topics.length === 0) {
      throw new Error(`Phase ${index + 1} has no topics`);
    }
  });
  
  // Ensure excluded skills are not in the roadmap
  const roadmapContent = JSON.stringify(roadmapResult).toLowerCase();
  skillAnalysis.excludedSkills.forEach(excludedSkill => {
    if (roadmapContent.includes(excludedSkill.toLowerCase())) {
      loggingService.warn(`Excluded skill '${excludedSkill}' found in generated roadmap`);
    }
  });
  
  return roadmapResult;
}

module.exports = {
  generatePersonalizedRoadmapWorkflow,
  getWorkflowStatus,
  getDetailedWorkflowStatus,
  getUserWorkflowHistory,
  getActiveWorkflows,
  getGlobalWorkflowStats
};