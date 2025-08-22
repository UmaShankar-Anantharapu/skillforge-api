const express = require('express');
const { body, query } = require('express-validator');
const requireAuth = require('../middleware/requireAuth');
const {
  performWebSearch,
  scrapeAndSummarize,
  generateComprehensiveRoadmap,
  summarizeContent
} = require('../services/researchAgentService');

const router = express.Router();

/**
 * POST /api/research/roadmap
 * Generate a comprehensive roadmap for a given topic
 */
router.post('/roadmap', requireAuth, [
  body('topic').isString().isLength({ min: 1, max: 200 }).withMessage('Topic is required and must be 1-200 characters'),
  body('level').optional().isIn(['beginner', 'intermediate', 'advanced']).withMessage('Level must be beginner, intermediate, or advanced'),
  body('timeframe').optional().isString().withMessage('Timeframe must be a string'),
  body('dailyTimeMinutes').optional().isInt({ min: 5, max: 120 }).withMessage('Daily time must be between 5-120 minutes'),
  body('focus').optional().isIn(['theory', 'practical', 'mixed']).withMessage('Focus must be theory, practical, or mixed'),
  body('includeProjects').optional().isBoolean().withMessage('Include projects must be boolean')
], async (req, res, next) => {
  try {
    const {
      topic,
      level = 'beginner',
      timeframe = '4-weeks',
      dailyTimeMinutes = 30,
      focus = 'practical',
      includeProjects = true
    } = req.body;

    console.log(`Generating roadmap for topic: ${topic}`);

    const roadmapData = await generateComprehensiveRoadmap(topic, {
      level,
      timeframe,
      dailyTimeMinutes,
      focus,
      includeProjects
    });

    res.json({
      success: true,
      data: roadmapData,
      message: 'Roadmap generated successfully'
    });

  } catch (error) {
    console.error('Roadmap generation error:', error);
    next(error);
  }
});

/**
 * GET /api/research/search
 * Perform web search for a given query
 */
router.get('/search', requireAuth, [
  query('q').isString().isLength({ min: 1, max: 200 }).withMessage('Query is required and must be 1-200 characters'),
  query('limit').optional().isInt({ min: 1, max: 20 }).withMessage('Limit must be between 1-20')
], async (req, res, next) => {
  try {
    const { q: query, limit = 10 } = req.query;

    console.log(`Performing web search for: ${query}`);

    const searchResults = await performWebSearch(query, parseInt(limit));

    res.json({
      success: true,
      data: {
        query,
        results: searchResults,
        count: searchResults.length
      },
      message: 'Search completed successfully'
    });

  } catch (error) {
    console.error('Web search error:', error);
    next(error);
  }
});

/**
 * POST /api/research/scrape
 * Scrape and summarize content from a URL
 */
router.post('/scrape', requireAuth, [
  body('url').isURL().withMessage('Valid URL is required'),
  body('title').optional().isString().isLength({ max: 200 }).withMessage('Title must be a string with max 200 characters')
], async (req, res, next) => {
  try {
    const { url, title = 'Scraped Content' } = req.body;

    console.log(`Scraping content from: ${url}`);

    const scrapedData = await scrapeAndSummarize(url, title);

    res.json({
      success: true,
      data: scrapedData,
      message: 'Content scraped and summarized successfully'
    });

  } catch (error) {
    console.error('Content scraping error:', error);
    next(error);
  }
});

/**
 * POST /api/research/analyze-topic
 * Analyze a topic and provide comprehensive insights
 */
router.post('/analyze-topic', requireAuth, [
  body('topic').isString().isLength({ min: 1, max: 200 }).withMessage('Topic is required and must be 1-200 characters'),
  body('depth').optional().isIn(['overview', 'detailed', 'comprehensive']).withMessage('Depth must be overview, detailed, or comprehensive')
], async (req, res, next) => {
  try {
    const { topic, depth = 'detailed' } = req.body;

    console.log(`Analyzing topic: ${topic} with depth: ${depth}`);

    // Determine search result limit based on depth
    const searchLimit = depth === 'overview' ? 5 : depth === 'detailed' ? 10 : 15;

    // Perform web search
    const searchResults = await performWebSearch(topic, searchLimit);

    // Scrape top results
    const scrapingPromises = searchResults.slice(0, Math.min(5, searchResults.length)).map(result =>
      scrapeAndSummarize(result.url, result.title)
    );

    const scrapedResults = await Promise.allSettled(scrapingPromises);
    const validScrapedContent = scrapedResults
      .filter(result => result.status === 'fulfilled')
      .map(result => result.value);

    // Generate analysis summary
    const analysisPrompt = `Based on the following research about "${topic}", provide a comprehensive analysis:

Search Results:
${searchResults.map((result, index) => `${index + 1}. ${result.title}: ${result.snippet}`).join('\n')}

Scraped Content Summaries:
${validScrapedContent.map((content, index) => `${index + 1}. ${content.title}: ${content.summary}`).join('\n')}

Provide analysis in the following JSON format:
{
  "overview": "Brief overview of the topic",
  "keyAreas": ["area1", "area2", "area3"],
  "difficulty": "beginner|intermediate|advanced",
  "timeToLearn": "estimated time to learn",
  "prerequisites": ["prerequisite1", "prerequisite2"],
  "careerRelevance": "how this topic relates to career development",
  "trends": "current trends and future outlook",
  "recommendations": "learning recommendations",
  "relatedTopics": ["related1", "related2", "related3"]
}`;

    const { chat, extractJSON } = require('../services/llmClient');
    const analysisResponse = await chat([{ role: 'user', content: analysisPrompt }]);
    const analysis = extractJSON(analysisResponse) || {};

    res.json({
      success: true,
      data: {
        topic,
        depth,
        analysis,
        searchResults: searchResults.slice(0, 8),
        scrapedContent: validScrapedContent.slice(0, 3),
        generatedAt: new Date().toISOString()
      },
      message: 'Topic analysis completed successfully'
    });

  } catch (error) {
    console.error('Topic analysis error:', error);
    next(error);
  }
});

/**
 * POST /api/research/compare-resources
 * Compare multiple learning resources for a topic
 */
router.post('/compare-resources', requireAuth, [
  body('urls').isArray({ min: 2, max: 5 }).withMessage('URLs array with 2-5 URLs is required'),
  body('urls.*').isURL().withMessage('Each URL must be valid'),
  body('topic').optional().isString().withMessage('Topic must be a string')
], async (req, res, next) => {
  try {
    const { urls, topic = 'Learning Resources' } = req.body;

    console.log(`Comparing ${urls.length} resources for topic: ${topic}`);

    // Scrape all URLs in parallel
    const scrapingPromises = urls.map((url, index) =>
      scrapeAndSummarize(url, `Resource ${index + 1}`)
    );

    const scrapedResults = await Promise.allSettled(scrapingPromises);
    const resources = scrapedResults.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        return {
          url: urls[index],
          title: `Resource ${index + 1}`,
          error: result.reason?.message || 'Scraping failed'
        };
      }
    });

    // Generate comparison using LLM
    const validResources = resources.filter(r => !r.error);
    
    if (validResources.length >= 2) {
      const comparisonPrompt = `Compare these learning resources for "${topic}":

${validResources.map((resource, index) => 
  `Resource ${index + 1}: ${resource.title}
  URL: ${resource.url}
  Summary: ${resource.summary}
  Word Count: ${resource.wordCount}
  `
).join('\n')}

Provide a comparison in JSON format:
{
  "comparison": {
    "bestForBeginners": "resource title",
    "mostComprehensive": "resource title",
    "mostPractical": "resource title",
    "bestStructure": "resource title"
  },
  "resourceRankings": [
    {
      "title": "resource title",
      "rank": 1,
      "strengths": ["strength1", "strength2"],
      "weaknesses": ["weakness1"],
      "recommendedFor": "audience description"
    }
  ],
  "summary": "Overall comparison summary"
}`;

      const { chat, extractJSON } = require('../services/llmClient');
      const comparisonResponse = await chat([{ role: 'user', content: comparisonPrompt }]);
      const comparison = extractJSON(comparisonResponse) || {};

      res.json({
        success: true,
        data: {
          topic,
          resources,
          comparison,
          validResourceCount: validResources.length,
          generatedAt: new Date().toISOString()
        },
        message: 'Resource comparison completed successfully'
      });
    } else {
      res.json({
        success: false,
        data: { resources },
        message: 'Not enough valid resources to compare'
      });
    }

  } catch (error) {
    console.error('Resource comparison error:', error);
    next(error);
  }
});

/**
 * GET /api/research/status
 * Get research agent status and capabilities
 */
router.get('/status', requireAuth, async (req, res) => {
  try {
    // Test Ollama connection
    const { chat } = require('../services/llmClient');
    const testResponse = await chat([{ 
      role: 'user', 
      content: 'Respond with "OK" if you are working properly.' 
    }]);
    
    const ollamaStatus = testResponse.toLowerCase().includes('ok') ? 'connected' : 'limited';

    res.json({
      success: true,
      data: {
        service: 'Research Agent',
        version: '1.0.0',
        ollama: {
          status: ollamaStatus,
          model: process.env.OLLAMA_MODEL || 'llama3.1',
          url: process.env.OLLAMA_URL || 'http://127.0.0.1:11434'
        },
        capabilities: [
          'Web search via DuckDuckGo API',
          'Content scraping and summarization',
          'Comprehensive roadmap generation',
          'Topic analysis and insights',
          'Resource comparison',
          'Multi-source research synthesis'
        ],
        features: {
          webSearch: true,
          contentScraping: true,
          llmIntegration: ollamaStatus === 'connected',
          roadmapGeneration: true,
          resourceComparison: true
        },
        limits: {
          maxSearchResults: 20,
          maxDailyRequests: 1000,
          maxContentLength: 3000,
          maxScrapeUrls: 5
        }
      },
      message: 'Research agent is operational'
    });

  } catch (error) {
    console.error('Status check error:', error);
    res.status(500).json({
      success: false,
      data: {
        service: 'Research Agent',
        status: 'error',
        error: error.message
      },
      message: 'Research agent status check failed'
    });
  }
});

module.exports = router;
