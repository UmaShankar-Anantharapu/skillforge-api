const axios = require('axios');
const { loggingService } = require('./loggingService');
const { searchRoadmapsMultiSource } = require('./enhancedWebScrapingService');
const NodeCache = require('node-cache');

// Cache for collected resources (2 hours TTL)
const resourceCache = new NodeCache({ stdTTL: 7200 });

/**
 * Resource Collection Service
 * Collects and validates learning resources for roadmap sub-concepts
 */

/**
 * Resource types and their priorities
 */
const RESOURCE_TYPES = {
  DOCUMENTATION: { name: 'documentation', priority: 10, weight: 0.9 },
  TUTORIAL: { name: 'tutorial', priority: 9, weight: 0.8 },
  VIDEO: { name: 'video', priority: 8, weight: 0.7 },
  COURSE: { name: 'course', priority: 7, weight: 0.8 },
  ARTICLE: { name: 'article', priority: 6, weight: 0.6 },
  BOOK: { name: 'book', priority: 5, weight: 0.7 },
  PROJECT: { name: 'project', priority: 9, weight: 0.8 },
  EXERCISE: { name: 'exercise', priority: 8, weight: 0.7 },
  QUIZ: { name: 'quiz', priority: 6, weight: 0.6 },
  TOOL: { name: 'tool', priority: 5, weight: 0.5 }
};

/**
 * Quality indicators for resource validation
 */
const QUALITY_INDICATORS = {
  DOMAIN_AUTHORITY: {
    'github.com': 0.9,
    'stackoverflow.com': 0.8,
    'developer.mozilla.org': 0.95,
    'docs.microsoft.com': 0.9,
    'reactjs.org': 0.95,
    'nodejs.org': 0.95,
    'python.org': 0.95,
    'freecodecamp.org': 0.8,
    'coursera.org': 0.8,
    'edx.org': 0.8,
    'udemy.com': 0.7,
    'youtube.com': 0.6,
    'medium.com': 0.6,
    'dev.to': 0.6
  },
  CONTENT_INDICATORS: {
    'official': 0.2,
    'documentation': 0.15,
    'tutorial': 0.1,
    'guide': 0.1,
    'example': 0.08,
    'best practices': 0.12,
    'getting started': 0.1
  }
};

/**
 * Collect resources for all sub-concepts in a roadmap
 * @param {Object} roadmap - Generated roadmap with phases and topics
 * @param {Object} options - Collection options
 * @returns {Promise<Object>} Roadmap enhanced with resources
 */
async function collectResourcesForRoadmap(roadmap, options = {}) {
  try {
    const {
      maxResourcesPerTopic = 5,
      resourceTypes = ['documentation', 'tutorial', 'video', 'project'],
      validateQuality = true,
      useCache = true,
      targetSkill = roadmap.title || 'programming'
    } = options;

    loggingService.info(`Collecting resources for roadmap: ${roadmap.title}`);

    // Check cache
    const cacheKey = `resources_${roadmap.title}_${targetSkill}`;
    if (useCache) {
      const cached = resourceCache.get(cacheKey);
      if (cached) {
        loggingService.info('Returning cached roadmap resources');
        return cached;
      }
    }

    const enhancedPhases = [];
    
    // Process each phase
    for (const phase of roadmap.phases) {
      const enhancedTopics = [];
      
      // Process each topic in the phase
      for (const topic of phase.topics) {
        loggingService.info(`Collecting resources for topic: ${topic}`);
        
        const topicResources = await collectResourcesForTopic(
          topic,
          targetSkill,
          {
            maxResources: maxResourcesPerTopic,
            resourceTypes,
            validateQuality,
            phase: phase.name
          }
        );
        
        enhancedTopics.push({
          name: topic,
          resources: topicResources,
          resourceCount: topicResources.length,
          resourceTypes: [...new Set(topicResources.map(r => r.type))]
        });
      }
      
      enhancedPhases.push({
        ...phase,
        topics: enhancedTopics,
        totalResources: enhancedTopics.reduce((sum, topic) => sum + topic.resourceCount, 0)
      });
    }
    
    const enhancedRoadmap = {
      ...roadmap,
      phases: enhancedPhases,
      resourceMetadata: {
        totalResources: enhancedPhases.reduce((sum, phase) => sum + phase.totalResources, 0),
        collectedAt: new Date().toISOString(),
        resourceTypes: resourceTypes,
        qualityValidated: validateQuality
      }
    };
    
    // Cache the enhanced roadmap
    if (useCache) {
      resourceCache.set(cacheKey, enhancedRoadmap);
    }
    
    loggingService.info(`Successfully collected resources for ${enhancedRoadmap.resourceMetadata.totalResources} topics`);
    return enhancedRoadmap;
    
  } catch (error) {
    loggingService.error('Failed to collect resources for roadmap:', error);
    throw new Error(`Resource collection failed: ${error.message}`);
  }
}

/**
 * Collect resources for a specific topic
 * @param {string} topic - Topic name
 * @param {string} targetSkill - Target skill context
 * @param {Object} options - Collection options
 * @returns {Promise<Array>} Array of collected resources
 */
async function collectResourcesForTopic(topic, targetSkill, options = {}) {
  try {
    const {
      maxResources = 5,
      resourceTypes = ['documentation', 'tutorial', 'video'],
      validateQuality = true,
      phase = 'general'
    } = options;

    // Check cache for this specific topic
    const cacheKey = `topic_resources_${topic}_${targetSkill}`;
    const cached = resourceCache.get(cacheKey);
    if (cached) {
      return cached.slice(0, maxResources);
    }

    const allResources = [];
    
    // Collect from multiple sources
    const collectionPromises = [
      collectFromWebSearch(topic, targetSkill, resourceTypes),
      collectFromKnownSources(topic, targetSkill, resourceTypes),
      collectFromCommunityResources(topic, targetSkill, resourceTypes)
    ];
    
    const results = await Promise.allSettled(collectionPromises);
    
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        allResources.push(...result.value);
      } else {
        loggingService.warn(`Resource collection method ${index} failed:`, result.reason);
      }
    });
    
    // Remove duplicates
    const uniqueResources = removeDuplicateResources(allResources);
    
    // Validate quality if requested
    const validatedResources = validateQuality 
      ? await validateResourceQuality(uniqueResources, topic, targetSkill)
      : uniqueResources;
    
    // Rank and filter resources
    const rankedResources = rankResourcesByRelevance(validatedResources, topic, targetSkill);
    const finalResources = rankedResources.slice(0, maxResources);
    
    // Add metadata
    const resourcesWithMetadata = finalResources.map(resource => ({
      ...resource,
      collectedFor: topic,
      targetSkill,
      phase,
      collectedAt: new Date().toISOString()
    }));
    
    // Cache the results
    resourceCache.set(cacheKey, resourcesWithMetadata);
    
    return resourcesWithMetadata;
    
  } catch (error) {
    loggingService.error(`Failed to collect resources for topic ${topic}:`, error);
    return [];
  }
}

/**
 * Collect resources from web search
 * @param {string} topic - Topic to search for
 * @param {string} targetSkill - Target skill context
 * @param {Array} resourceTypes - Types of resources to collect
 * @returns {Promise<Array>} Web search resources
 */
async function collectFromWebSearch(topic, targetSkill, resourceTypes) {
  try {
    // Mock web search implementation - replace with actual search API
    const searchQueries = generateSearchQueries(topic, targetSkill, resourceTypes);
    const searchResults = [];
    
    for (const query of searchQueries.slice(0, 3)) { // Limit to 3 queries
      const mockResults = generateMockSearchResults(query, resourceTypes);
      searchResults.push(...mockResults);
    }
    
    return searchResults;
    
  } catch (error) {
    loggingService.error('Web search resource collection failed:', error);
    return [];
  }
}

/**
 * Collect resources from known high-quality sources
 * @param {string} topic - Topic to search for
 * @param {string} targetSkill - Target skill context
 * @param {Array} resourceTypes - Types of resources to collect
 * @returns {Promise<Array>} Known source resources
 */
async function collectFromKnownSources(topic, targetSkill, resourceTypes) {
  try {
    const knownSources = {
      'javascript': [
        { url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript', type: 'documentation' },
        { url: 'https://javascript.info', type: 'tutorial' },
        { url: 'https://github.com/getify/You-Dont-Know-JS', type: 'book' }
      ],
      'react': [
        { url: 'https://reactjs.org/docs', type: 'documentation' },
        { url: 'https://reactjs.org/tutorial', type: 'tutorial' },
        { url: 'https://github.com/facebook/create-react-app', type: 'tool' }
      ],
      'python': [
        { url: 'https://docs.python.org/3/', type: 'documentation' },
        { url: 'https://realpython.com', type: 'tutorial' },
        { url: 'https://github.com/python/cpython', type: 'project' }
      ],
      'nodejs': [
        { url: 'https://nodejs.org/en/docs/', type: 'documentation' },
        { url: 'https://nodejs.dev/learn', type: 'tutorial' },
        { url: 'https://github.com/nodejs/node', type: 'project' }
      ]
    };
    
    const skillKey = targetSkill.toLowerCase();
    const sourceResources = knownSources[skillKey] || [];
    
    // Filter by requested resource types and add topic relevance
    const relevantResources = sourceResources
      .filter(resource => resourceTypes.includes(resource.type))
      .map(resource => ({
        ...resource,
        title: `${topic} - ${resource.type}`,
        description: `High-quality ${resource.type} resource for ${topic}`,
        source: 'known_sources',
        relevanceScore: calculateTopicRelevance(resource.url, topic),
        qualityScore: QUALITY_INDICATORS.DOMAIN_AUTHORITY[new URL(resource.url).hostname] || 0.5
      }));
    
    return relevantResources;
    
  } catch (error) {
    loggingService.error('Known sources resource collection failed:', error);
    return [];
  }
}

/**
 * Collect resources from community sources
 * @param {string} topic - Topic to search for
 * @param {string} targetSkill - Target skill context
 * @param {Array} resourceTypes - Types of resources to collect
 * @returns {Promise<Array>} Community resources
 */
async function collectFromCommunityResources(topic, targetSkill, resourceTypes) {
  try {
    // Mock community resources - replace with actual community API calls
    const communityResources = [
      {
        title: `${topic} Discussion on Stack Overflow`,
        url: `https://stackoverflow.com/questions/tagged/${topic.toLowerCase().replace(/\s+/g, '-')}`,
        type: 'article',
        description: `Community discussions and solutions for ${topic}`,
        source: 'stackoverflow',
        qualityScore: 0.8,
        relevanceScore: 0.9
      },
      {
        title: `${topic} on GitHub`,
        url: `https://github.com/search?q=${encodeURIComponent(topic + ' ' + targetSkill)}`,
        type: 'project',
        description: `Open source projects and examples for ${topic}`,
        source: 'github',
        qualityScore: 0.9,
        relevanceScore: 0.8
      },
      {
        title: `${topic} Tutorial on FreeCodeCamp`,
        url: `https://www.freecodecamp.org/news/search/?query=${encodeURIComponent(topic)}`,
        type: 'tutorial',
        description: `Free tutorial covering ${topic} concepts`,
        source: 'freecodecamp',
        qualityScore: 0.8,
        relevanceScore: 0.85
      }
    ];
    
    return communityResources.filter(resource => resourceTypes.includes(resource.type));
    
  } catch (error) {
    loggingService.error('Community resources collection failed:', error);
    return [];
  }
}

/**
 * Generate search queries for a topic
 * @param {string} topic - Topic name
 * @param {string} targetSkill - Target skill
 * @param {Array} resourceTypes - Resource types
 * @returns {Array} Generated search queries
 */
function generateSearchQueries(topic, targetSkill, resourceTypes) {
  const queries = [];
  
  // Basic queries
  queries.push(`${topic} ${targetSkill} tutorial`);
  queries.push(`${topic} ${targetSkill} documentation`);
  queries.push(`learn ${topic} ${targetSkill}`);
  
  // Resource type specific queries
  resourceTypes.forEach(type => {
    if (type !== 'tutorial' && type !== 'documentation') {
      queries.push(`${topic} ${targetSkill} ${type}`);
    }
  });
  
  return queries;
}

/**
 * Generate mock search results for testing
 * @param {string} query - Search query
 * @param {Array} resourceTypes - Resource types
 * @returns {Array} Mock search results
 */
function generateMockSearchResults(query, resourceTypes) {
  const results = [];
  const baseUrl = 'https://example.com';
  
  resourceTypes.forEach((type, index) => {
    results.push({
      title: `${query} - ${type}`,
      url: `${baseUrl}/${type}/${encodeURIComponent(query.toLowerCase().replace(/\s+/g, '-'))}`,
      type: type,
      description: `Comprehensive ${type} covering ${query}`,
      source: 'web_search',
      qualityScore: 0.6 + (Math.random() * 0.3),
      relevanceScore: 0.7 + (Math.random() * 0.2)
    });
  });
  
  return results;
}

/**
 * Remove duplicate resources based on URL and title similarity
 * @param {Array} resources - Array of resources
 * @returns {Array} Deduplicated resources
 */
function removeDuplicateResources(resources) {
  const seen = new Set();
  const unique = [];
  
  resources.forEach(resource => {
    const key = `${resource.url}_${resource.title.toLowerCase()}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(resource);
    }
  });
  
  return unique;
}

/**
 * Validate resource quality and accessibility
 * @param {Array} resources - Resources to validate
 * @param {string} topic - Topic context
 * @param {string} targetSkill - Target skill context
 * @returns {Promise<Array>} Validated resources
 */
async function validateResourceQuality(resources, topic, targetSkill) {
  try {
    const validatedResources = [];
    
    for (const resource of resources) {
      const validation = await validateSingleResource(resource, topic, targetSkill);
      if (validation.isValid) {
        validatedResources.push({
          ...resource,
          validation,
          validatedAt: new Date().toISOString()
        });
      }
    }
    
    return validatedResources;
    
  } catch (error) {
    loggingService.error('Resource quality validation failed:', error);
    return resources; // Return original resources if validation fails
  }
}

/**
 * Validate a single resource
 * @param {Object} resource - Resource to validate
 * @param {string} topic - Topic context
 * @param {string} targetSkill - Target skill context
 * @returns {Promise<Object>} Validation result
 */
async function validateSingleResource(resource, topic, targetSkill) {
  try {
    const validation = {
      isValid: true,
      score: 0.5,
      checks: {
        urlAccessible: false,
        contentRelevant: false,
        qualityIndicators: false
      },
      issues: []
    };
    
    // Check URL accessibility (mock implementation)
    validation.checks.urlAccessible = await checkUrlAccessibility(resource.url);
    if (!validation.checks.urlAccessible) {
      validation.issues.push('URL not accessible');
      validation.score -= 0.3;
    }
    
    // Check content relevance
    validation.checks.contentRelevant = checkContentRelevance(resource, topic, targetSkill);
    if (!validation.checks.contentRelevant) {
      validation.issues.push('Low content relevance');
      validation.score -= 0.2;
    }
    
    // Check quality indicators
    validation.checks.qualityIndicators = checkQualityIndicators(resource);
    if (!validation.checks.qualityIndicators) {
      validation.issues.push('Low quality indicators');
      validation.score -= 0.1;
    }
    
    // Determine if resource is valid
    validation.isValid = validation.score > 0.3 && validation.checks.urlAccessible;
    
    return validation;
    
  } catch (error) {
    return {
      isValid: false,
      score: 0,
      checks: { urlAccessible: false, contentRelevant: false, qualityIndicators: false },
      issues: ['Validation failed'],
      error: error.message
    };
  }
}

/**
 * Check if URL is accessible
 * @param {string} url - URL to check
 * @returns {Promise<boolean>} Whether URL is accessible
 */
async function checkUrlAccessibility(url) {
  try {
    // Mock implementation - replace with actual HTTP check
    const mockAccessibility = Math.random() > 0.1; // 90% success rate
    return mockAccessibility;
  } catch (error) {
    return false;
  }
}

/**
 * Check content relevance to topic and skill
 * @param {Object} resource - Resource to check
 * @param {string} topic - Topic context
 * @param {string} targetSkill - Target skill context
 * @returns {boolean} Whether content is relevant
 */
function checkContentRelevance(resource, topic, targetSkill) {
  const titleLower = resource.title.toLowerCase();
  const descriptionLower = (resource.description || '').toLowerCase();
  const topicLower = topic.toLowerCase();
  const skillLower = targetSkill.toLowerCase();
  
  // Check if topic and skill are mentioned
  const topicInTitle = titleLower.includes(topicLower);
  const skillInTitle = titleLower.includes(skillLower);
  const topicInDescription = descriptionLower.includes(topicLower);
  const skillInDescription = descriptionLower.includes(skillLower);
  
  return (topicInTitle || topicInDescription) && (skillInTitle || skillInDescription);
}

/**
 * Check quality indicators for a resource
 * @param {Object} resource - Resource to check
 * @returns {boolean} Whether resource has quality indicators
 */
function checkQualityIndicators(resource) {
  try {
    const url = new URL(resource.url);
    const domain = url.hostname;
    
    // Check domain authority
    const domainScore = QUALITY_INDICATORS.DOMAIN_AUTHORITY[domain] || 0;
    
    // Check content indicators
    const titleLower = resource.title.toLowerCase();
    let contentScore = 0;
    
    Object.entries(QUALITY_INDICATORS.CONTENT_INDICATORS).forEach(([indicator, score]) => {
      if (titleLower.includes(indicator)) {
        contentScore += score;
      }
    });
    
    return (domainScore + contentScore) > 0.5;
    
  } catch (error) {
    return false;
  }
}

/**
 * Rank resources by relevance to topic and skill
 * @param {Array} resources - Resources to rank
 * @param {string} topic - Topic context
 * @param {string} targetSkill - Target skill context
 * @returns {Array} Ranked resources
 */
function rankResourcesByRelevance(resources, topic, targetSkill) {
  return resources
    .map(resource => ({
      ...resource,
      finalScore: calculateFinalResourceScore(resource, topic, targetSkill)
    }))
    .sort((a, b) => b.finalScore - a.finalScore)
    .map(({ finalScore, ...resource }) => resource); // Remove finalScore from output
}

/**
 * Calculate final score for a resource
 * @param {Object} resource - Resource to score
 * @param {string} topic - Topic context
 * @param {string} targetSkill - Target skill context
 * @returns {number} Final score
 */
function calculateFinalResourceScore(resource, topic, targetSkill) {
  let score = 0;
  
  // Base scores
  const qualityScore = resource.qualityScore || 0.5;
  const relevanceScore = resource.relevanceScore || 0.5;
  
  // Resource type weight
  const typeWeight = RESOURCE_TYPES[resource.type.toUpperCase()]?.weight || 0.5;
  
  // Calculate weighted score
  score = (qualityScore * 0.4) + (relevanceScore * 0.4) + (typeWeight * 0.2);
  
  // Bonus for validation
  if (resource.validation && resource.validation.isValid) {
    score += 0.1;
  }
  
  return Math.min(score, 1.0);
}

/**
 * Calculate topic relevance for a URL
 * @param {string} url - URL to check
 * @param {string} topic - Topic to match
 * @returns {number} Relevance score (0-1)
 */
function calculateTopicRelevance(url, topic) {
  const urlLower = url.toLowerCase();
  const topicLower = topic.toLowerCase();
  
  if (urlLower.includes(topicLower)) {
    return 0.9;
  }
  
  // Check for partial matches
  const topicWords = topicLower.split(' ');
  const matchingWords = topicWords.filter(word => urlLower.includes(word));
  
  return matchingWords.length / topicWords.length * 0.7;
}

/**
 * Get resource statistics for a roadmap
 * @param {Object} roadmap - Roadmap with resources
 * @returns {Object} Resource statistics
 */
function getResourceStatistics(roadmap) {
  const stats = {
    totalResources: 0,
    resourcesByType: {},
    resourcesByPhase: {},
    averageQualityScore: 0,
    validationStats: {
      validated: 0,
      valid: 0,
      invalid: 0
    }
  };
  
  let totalQualityScore = 0;
  let resourceCount = 0;
  
  roadmap.phases.forEach(phase => {
    stats.resourcesByPhase[phase.name] = 0;
    
    phase.topics.forEach(topic => {
      if (topic.resources) {
        topic.resources.forEach(resource => {
          stats.totalResources++;
          stats.resourcesByPhase[phase.name]++;
          resourceCount++;
          
          // Count by type
          stats.resourcesByType[resource.type] = (stats.resourcesByType[resource.type] || 0) + 1;
          
          // Quality score
          if (resource.qualityScore) {
            totalQualityScore += resource.qualityScore;
          }
          
          // Validation stats
          if (resource.validation) {
            stats.validationStats.validated++;
            if (resource.validation.isValid) {
              stats.validationStats.valid++;
            } else {
              stats.validationStats.invalid++;
            }
          }
        });
      }
    });
  });
  
  stats.averageQualityScore = resourceCount > 0 ? totalQualityScore / resourceCount : 0;
  
  return stats;
}

module.exports = {
  collectResourcesForRoadmap,
  collectResourcesForTopic,
  validateResourceQuality,
  rankResourcesByRelevance,
  removeDuplicateResources,
  getResourceStatistics,
  checkUrlAccessibility,
  checkContentRelevance,
  checkQualityIndicators,
  calculateFinalResourceScore
};