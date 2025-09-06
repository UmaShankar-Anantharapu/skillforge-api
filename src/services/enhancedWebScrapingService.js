const axios = require('axios');
const cheerio = require('cheerio');
const { loggingService } = require('./loggingService');
const NodeCache = require('node-cache');

// Cache for 1 hour to avoid repeated scraping
const scrapingCache = new NodeCache({ stdTTL: 3600 });

/**
 * Enhanced Web Scraping Service
 * Specialized for fetching roadmaps and learning resources from multiple sources
 */

/**
 * Roadmap sources configuration
 */
const ROADMAP_SOURCES = {
  roadmapsh: {
    baseUrl: 'https://roadmap.sh',
    searchPath: '/roadmaps',
    selector: '.roadmap-card',
    titleSelector: '.roadmap-title',
    descriptionSelector: '.roadmap-description'
  },
  github: {
    baseUrl: 'https://github.com',
    searchPath: '/search',
    selector: '.repo-list-item',
    titleSelector: '.repo-list-name a',
    descriptionSelector: '.repo-list-description'
  },
  freecodecamp: {
    baseUrl: 'https://www.freecodecamp.org',
    searchPath: '/news/search',
    selector: '.post-card',
    titleSelector: '.post-card-title',
    descriptionSelector: '.post-card-excerpt'
  },
  medium: {
    baseUrl: 'https://medium.com',
    searchPath: '/search',
    selector: 'article',
    titleSelector: 'h2',
    descriptionSelector: 'p'
  }
};

/**
 * Search for roadmaps across multiple sources
 * @param {string} skillset - Target skillset to search for
 * @param {Object} options - Search options
 * @returns {Promise<Array>} Array of roadmap results
 */
async function searchRoadmapsMultiSource(skillset, options = {}) {
  try {
    const {
      maxResultsPerSource = 5,
      sources = ['roadmapsh', 'github', 'freecodecamp'],
      includeContent = true,
      cacheResults = true
    } = options;

    loggingService.info(`Searching roadmaps for skillset: ${skillset}`);

    // Check cache first
    const cacheKey = `roadmaps_${skillset}_${sources.join('_')}`;
    if (cacheResults) {
      const cached = scrapingCache.get(cacheKey);
      if (cached) {
        loggingService.info('Returning cached roadmap results');
        return cached;
      }
    }

    const allResults = [];
    const searchPromises = sources.map(source => 
      searchRoadmapsBySource(skillset, source, maxResultsPerSource, includeContent)
    );

    const sourceResults = await Promise.allSettled(searchPromises);
    
    sourceResults.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        allResults.push(...result.value);
      } else {
        loggingService.error(`Failed to search ${sources[index]}:`, result.reason);
      }
    });

    // Rank and deduplicate results
    const rankedResults = rankRoadmapResults(allResults);
    const finalResults = rankedResults.slice(0, maxResultsPerSource * sources.length);

    // Cache results
    if (cacheResults && finalResults.length > 0) {
      scrapingCache.set(cacheKey, finalResults);
    }

    loggingService.info(`Found ${finalResults.length} roadmap results for ${skillset}`);
    return finalResults;

  } catch (error) {
    loggingService.error('Multi-source roadmap search failed:', error);
    return [];
  }
}

/**
 * Search roadmaps from a specific source
 * @param {string} skillset - Target skillset
 * @param {string} source - Source name
 * @param {number} maxResults - Maximum results to return
 * @param {boolean} includeContent - Whether to scrape full content
 * @returns {Promise<Array>} Search results from the source
 */
async function searchRoadmapsBySource(skillset, source, maxResults = 5, includeContent = true) {
  try {
    const sourceConfig = ROADMAP_SOURCES[source];
    if (!sourceConfig) {
      throw new Error(`Unknown source: ${source}`);
    }

    loggingService.info(`Searching ${source} for ${skillset} roadmaps`);

    // Mock implementation - replace with actual scraping logic
    const mockResults = generateMockRoadmapResults(skillset, source, maxResults);
    
    if (includeContent) {
      // Enhance results with scraped content
      const enhancedResults = await Promise.all(
        mockResults.map(async (result) => {
          const content = await scrapeRoadmapContent(result.url, source);
          return { ...result, ...content };
        })
      );
      return enhancedResults;
    }

    return mockResults;

  } catch (error) {
    loggingService.error(`Failed to search ${source}:`, error);
    return [];
  }
}

/**
 * Scrape detailed roadmap content from a URL
 * @param {string} url - URL to scrape
 * @param {string} source - Source name for context
 * @returns {Promise<Object>} Scraped roadmap content
 */
async function scrapeRoadmapContent(url, source) {
  try {
    loggingService.info(`Scraping roadmap content from: ${url}`);

    // Check cache first
    const cacheKey = `content_${url}`;
    const cached = scrapingCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    // Mock scraping - replace with actual implementation
    const mockContent = {
      fullContent: `Comprehensive roadmap content from ${url}`,
      structure: {
        phases: [
          {
            name: 'Foundation',
            duration: '2-4 weeks',
            topics: ['Basics', 'Core Concepts', 'Setup']
          },
          {
            name: 'Intermediate',
            duration: '4-6 weeks', 
            topics: ['Advanced Topics', 'Best Practices', 'Tools']
          },
          {
            name: 'Advanced',
            duration: '6-8 weeks',
            topics: ['Expert Level', 'Real Projects', 'Optimization']
          }
        ]
      },
      resources: [
        { type: 'documentation', url: `${url}/docs`, title: 'Official Documentation' },
        { type: 'tutorial', url: `${url}/tutorial`, title: 'Step-by-step Tutorial' },
        { type: 'project', url: `${url}/projects`, title: 'Practice Projects' }
      ],
      prerequisites: ['Basic programming knowledge', 'Understanding of web technologies'],
      estimatedTime: '12-18 weeks',
      difficulty: 'intermediate',
      lastUpdated: new Date().toISOString(),
      scrapedAt: new Date().toISOString()
    };

    // Cache the content
    scrapingCache.set(cacheKey, mockContent);
    return mockContent;

  } catch (error) {
    loggingService.error('Failed to scrape roadmap content:', error);
    return {
      fullContent: '',
      structure: { phases: [] },
      resources: [],
      prerequisites: [],
      estimatedTime: 'unknown',
      difficulty: 'unknown',
      lastUpdated: null,
      scrapedAt: new Date().toISOString(),
      error: error.message
    };
  }
}

/**
 * Extract learning resources from roadmap content
 * @param {Object} roadmapContent - Scraped roadmap content
 * @param {string} skillset - Target skillset
 * @returns {Promise<Array>} Extracted learning resources
 */
async function extractLearningResources(roadmapContent, skillset) {
  try {
    loggingService.info(`Extracting learning resources for ${skillset}`);

    const resources = [];
    
    // Extract from roadmap structure
    if (roadmapContent.structure && roadmapContent.structure.phases) {
      roadmapContent.structure.phases.forEach(phase => {
        phase.topics.forEach(topic => {
          resources.push({
            type: 'topic',
            title: topic,
            phase: phase.name,
            duration: phase.duration,
            skillset,
            source: 'roadmap_structure'
          });
        });
      });
    }

    // Add existing resources
    if (roadmapContent.resources) {
      resources.push(...roadmapContent.resources.map(resource => ({
        ...resource,
        skillset,
        source: 'roadmap_resources'
      })));
    }

    // Validate and rank resources
    const validatedResources = await validateResourceQuality(resources);
    return rankResourcesByRelevance(validatedResources, skillset);

  } catch (error) {
    loggingService.error('Failed to extract learning resources:', error);
    return [];
  }
}

/**
 * Validate the quality and relevance of resources
 * @param {Array} resources - Resources to validate
 * @returns {Promise<Array>} Validated resources
 */
async function validateResourceQuality(resources) {
  try {
    const validatedResources = [];

    for (const resource of resources) {
      // Basic validation
      if (!resource.title || resource.title.length < 3) {
        continue;
      }

      // Check URL accessibility (mock implementation)
      const isAccessible = await checkUrlAccessibility(resource.url);
      
      validatedResources.push({
        ...resource,
        isAccessible,
        qualityScore: calculateQualityScore(resource),
        validatedAt: new Date().toISOString()
      });
    }

    return validatedResources.filter(resource => resource.qualityScore > 0.3);

  } catch (error) {
    loggingService.error('Resource validation failed:', error);
    return resources; // Return original resources if validation fails
  }
}

/**
 * Check if a URL is accessible
 * @param {string} url - URL to check
 * @returns {Promise<boolean>} Whether URL is accessible
 */
async function checkUrlAccessibility(url) {
  try {
    if (!url) return false;
    
    // Mock implementation - replace with actual HTTP check
    const mockAccessibility = Math.random() > 0.1; // 90% success rate
    return mockAccessibility;

  } catch (error) {
    return false;
  }
}

/**
 * Calculate quality score for a resource
 * @param {Object} resource - Resource to score
 * @returns {number} Quality score (0-1)
 */
function calculateQualityScore(resource) {
  let score = 0.5; // Base score

  // Title quality
  if (resource.title && resource.title.length > 10) score += 0.1;
  if (resource.title && resource.title.length > 30) score += 0.1;

  // URL quality
  if (resource.url) {
    if (resource.url.includes('github.com')) score += 0.2;
    if (resource.url.includes('docs.') || resource.url.includes('documentation')) score += 0.2;
    if (resource.url.includes('tutorial')) score += 0.1;
  }

  // Type bonus
  const typeBonus = {
    'documentation': 0.2,
    'tutorial': 0.15,
    'project': 0.15,
    'course': 0.1,
    'article': 0.05
  };
  score += typeBonus[resource.type] || 0;

  return Math.min(score, 1.0);
}

/**
 * Rank resources by relevance to skillset
 * @param {Array} resources - Resources to rank
 * @param {string} skillset - Target skillset
 * @returns {Array} Ranked resources
 */
function rankResourcesByRelevance(resources, skillset) {
  return resources
    .map(resource => ({
      ...resource,
      relevanceScore: calculateRelevanceScore(resource, skillset)
    }))
    .sort((a, b) => {
      // Sort by combined quality and relevance score
      const scoreA = (a.qualityScore || 0.5) * 0.6 + (a.relevanceScore || 0.5) * 0.4;
      const scoreB = (b.qualityScore || 0.5) * 0.6 + (b.relevanceScore || 0.5) * 0.4;
      return scoreB - scoreA;
    });
}

/**
 * Calculate relevance score for a resource
 * @param {Object} resource - Resource to score
 * @param {string} skillset - Target skillset
 * @returns {number} Relevance score (0-1)
 */
function calculateRelevanceScore(resource, skillset) {
  let score = 0.5; // Base score
  const skillsetLower = skillset.toLowerCase();

  // Title relevance
  if (resource.title && resource.title.toLowerCase().includes(skillsetLower)) {
    score += 0.3;
  }

  // URL relevance
  if (resource.url && resource.url.toLowerCase().includes(skillsetLower)) {
    score += 0.2;
  }

  return Math.min(score, 1.0);
}

/**
 * Rank roadmap results by quality and relevance
 * @param {Array} results - Roadmap results to rank
 * @returns {Array} Ranked results
 */
function rankRoadmapResults(results) {
  return results
    .map(result => ({
      ...result,
      finalScore: calculateRoadmapScore(result)
    }))
    .sort((a, b) => b.finalScore - a.finalScore)
    .map(({ finalScore, ...result }) => result); // Remove finalScore from output
}

/**
 * Calculate overall score for a roadmap result
 * @param {Object} result - Roadmap result
 * @returns {number} Overall score
 */
function calculateRoadmapScore(result) {
  let score = 0.5; // Base score

  // Source reliability
  const sourceScores = {
    'roadmapsh': 0.9,
    'github': 0.8,
    'freecodecamp': 0.7,
    'medium': 0.6
  };
  score += (sourceScores[result.source] || 0.5) * 0.3;

  // Content quality
  if (result.fullContent && result.fullContent.length > 500) score += 0.1;
  if (result.structure && result.structure.phases && result.structure.phases.length > 2) score += 0.1;
  if (result.resources && result.resources.length > 3) score += 0.1;

  return Math.min(score, 1.0);
}

/**
 * Generate mock roadmap results for testing
 * @param {string} skillset - Target skillset
 * @param {string} source - Source name
 * @param {number} count - Number of results to generate
 * @returns {Array} Mock roadmap results
 */
function generateMockRoadmapResults(skillset, source, count) {
  const results = [];
  
  for (let i = 1; i <= count; i++) {
    results.push({
      title: `${skillset} Learning Roadmap ${i}`,
      url: `https://${source}.example.com/${skillset.toLowerCase()}-roadmap-${i}`,
      description: `Comprehensive ${skillset} learning path covering all essential topics and skills`,
      source,
      author: `${source}_contributor_${i}`,
      lastUpdated: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
      difficulty: ['beginner', 'intermediate', 'advanced'][Math.floor(Math.random() * 3)],
      estimatedTime: `${4 + Math.floor(Math.random() * 12)} weeks`,
      tags: [skillset.toLowerCase(), 'roadmap', 'learning', 'tutorial'],
      rating: 3.5 + Math.random() * 1.5,
      scrapedAt: new Date().toISOString()
    });
  }
  
  return results;
}

module.exports = {
  searchRoadmapsMultiSource,
  searchRoadmapsBySource,
  scrapeRoadmapContent,
  extractLearningResources,
  validateResourceQuality,
  rankResourcesByRelevance,
  rankRoadmapResults,
  checkUrlAccessibility,
  calculateQualityScore,
  calculateRelevanceScore
};