const axios = require('axios');
const cheerio = require('cheerio');
const { parse } = require('node-html-parser');
const { chat, extractJSON } = require('./llmClient');

// Web search configuration
const SEARCH_CONFIG = {
  timeout: 10000,
  maxRetries: 3,
  userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
};

/**
 * Performs a web search using DuckDuckGo Instant Answer API
 * @param {string} query - Search query
 * @param {number} maxResults - Maximum number of results to return
 * @returns {Promise<Array>} Array of search results
 */
async function performWebSearch(query, maxResults = 10) {
  try {
    // Use DuckDuckGo's JSON API for search results
    const searchUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(query + ' roadmap guide tutorial')}&format=json&no_html=1&skip_disambig=1`;
    
    const response = await axios.get(searchUrl, {
      timeout: SEARCH_CONFIG.timeout,
      headers: {
        'User-Agent': SEARCH_CONFIG.userAgent
      }
    });

    const results = [];
    const data = response.data;

    // Extract instant answer if available
    if (data.AbstractText && data.AbstractURL) {
      results.push({
        title: data.Heading || query,
        url: data.AbstractURL,
        snippet: data.AbstractText,
        source: data.AbstractSource || 'DuckDuckGo',
        relevanceScore: 0.9
      });
    }

    // Extract related topics
    if (data.RelatedTopics && Array.isArray(data.RelatedTopics)) {
      data.RelatedTopics.slice(0, maxResults - results.length).forEach(topic => {
        if (topic.FirstURL && topic.Text) {
          results.push({
            title: topic.Text.split(' - ')[0] || topic.Text.substring(0, 100),
            url: topic.FirstURL,
            snippet: topic.Text,
            source: 'Wikipedia',
            relevanceScore: 0.7
          });
        }
      });
    }

    // If we don't have enough results, add some curated educational sources
    if (results.length < 3) {
      const curatedSources = await getCuratedSources(query);
      results.push(...curatedSources.slice(0, maxResults - results.length));
    }

    return results.slice(0, maxResults);
  } catch (error) {
    console.error('Web search error:', error.message);
    // Fallback to curated sources
    return await getCuratedSources(query);
  }
}

/**
 * Get curated educational sources for common topics
 * @param {string} query - Search query
 * @returns {Array} Array of curated sources
 */
async function getCuratedSources(query) {
  const lowerQuery = query.toLowerCase();
  const sources = [];

  // Programming and development topics
  if (lowerQuery.includes('javascript') || lowerQuery.includes('js')) {
    sources.push(
      {
        title: 'MDN JavaScript Guide',
        url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide',
        snippet: 'Comprehensive JavaScript guide covering fundamentals to advanced topics',
        source: 'MDN',
        relevanceScore: 0.95
      },
      {
        title: 'JavaScript.info Modern Tutorial',
        url: 'https://javascript.info/',
        snippet: 'Modern JavaScript tutorial covering ES6+, async programming, and best practices',
        source: 'JavaScript.info',
        relevanceScore: 0.9
      }
    );
  }

  if (lowerQuery.includes('python')) {
    sources.push(
      {
        title: 'Python Official Tutorial',
        url: 'https://docs.python.org/3/tutorial/',
        snippet: 'Official Python tutorial covering syntax, data structures, and standard library',
        source: 'Python.org',
        relevanceScore: 0.95
      },
      {
        title: 'Real Python Learning Path',
        url: 'https://realpython.com/learning-paths/',
        snippet: 'Structured learning paths for Python development from beginner to advanced',
        source: 'Real Python',
        relevanceScore: 0.9
      }
    );
  }

  if (lowerQuery.includes('data science') || lowerQuery.includes('machine learning')) {
    sources.push(
      {
        title: 'Coursera Data Science Specialization',
        url: 'https://www.coursera.org/specializations/jhu-data-science',
        snippet: 'Johns Hopkins Data Science specialization covering R, statistics, and machine learning',
        source: 'Coursera',
        relevanceScore: 0.9
      },
      {
        title: 'Kaggle Learn',
        url: 'https://www.kaggle.com/learn',
        snippet: 'Free micro-courses on data science, machine learning, and AI topics',
        source: 'Kaggle',
        relevanceScore: 0.85
      }
    );
  }

  if (lowerQuery.includes('react') || lowerQuery.includes('frontend')) {
    sources.push(
      {
        title: 'React Official Documentation',
        url: 'https://react.dev/learn',
        snippet: 'Official React documentation with interactive examples and best practices',
        source: 'React.dev',
        relevanceScore: 0.95
      },
      {
        title: 'Frontend Masters Learning Paths',
        url: 'https://frontendmasters.com/learn/',
        snippet: 'Structured learning paths for frontend development and modern frameworks',
        source: 'Frontend Masters',
        relevanceScore: 0.85
      }
    );
  }

  // Business and soft skills
  if (lowerQuery.includes('leadership') || lowerQuery.includes('management')) {
    sources.push(
      {
        title: 'Harvard Business Review Leadership',
        url: 'https://hbr.org/topic/leadership',
        snippet: 'Leadership insights, case studies, and management best practices',
        source: 'Harvard Business Review',
        relevanceScore: 0.9
      },
      {
        title: 'LinkedIn Learning Leadership Courses',
        url: 'https://www.linkedin.com/learning/topics/leadership',
        snippet: 'Professional leadership development courses and skill assessments',
        source: 'LinkedIn Learning',
        relevanceScore: 0.8
      }
    );
  }

  return sources;
}

/**
 * Scrapes and summarizes content from a URL
 * @param {string} url - URL to scrape
 * @param {string} title - Title of the content
 * @returns {Promise<Object>} Scraped and summarized content
 */
async function scrapeAndSummarize(url, title) {
  try {
    const response = await axios.get(url, {
      timeout: SEARCH_CONFIG.timeout,
      headers: {
        'User-Agent': SEARCH_CONFIG.userAgent
      },
      maxRedirects: 3
    });

    const $ = cheerio.load(response.data);
    
    // Remove unwanted elements
    $('script, style, nav, header, footer, .advertisement, .ads').remove();
    
    // Extract main content
    let content = '';
    
    // Try different content selectors
    const contentSelectors = [
      'main', 'article', '.content', '.post-content', 
      '.entry-content', '.markdown-body', '.wiki-content',
      '#content', '.main-content', 'body'
    ];
    
    for (const selector of contentSelectors) {
      const element = $(selector);
      if (element.length && element.text().trim().length > 100) {
        content = element.text().trim();
        break;
      }
    }
    
    if (!content) {
      content = $('body').text().trim();
    }
    
    // Clean and truncate content
    content = content
      .replace(/\s+/g, ' ')
      .replace(/\n+/g, '\n')
      .substring(0, 3000); // Limit content size
    
    // Extract headers for structure
    const headers = [];
    $('h1, h2, h3, h4').each((i, el) => {
      const headerText = $(el).text().trim();
      if (headerText && headerText.length < 200) {
        headers.push({
          level: parseInt(el.tagName.charAt(1)),
          text: headerText
        });
      }
    });
    
    // Use LLM to summarize the content
    const summary = await summarizeContent(content, title);
    
    return {
      url,
      title,
      content: content.substring(0, 1000), // First 1000 chars
      summary,
      headers: headers.slice(0, 10), // Top 10 headers
      wordCount: content.split(' ').length,
      scrapedAt: new Date().toISOString()
    };
    
  } catch (error) {
    console.error(`Scraping error for ${url}:`, error.message);
    return {
      url,
      title,
      content: '',
      summary: `Unable to scrape content from ${title}. This resource may require manual review.`,
      headers: [],
      wordCount: 0,
      scrapedAt: new Date().toISOString(),
      error: error.message
    };
  }
}

/**
 * Summarizes content using LLM
 * @param {string} content - Content to summarize
 * @param {string} title - Title of the content
 * @returns {Promise<string>} Summary
 */
async function summarizeContent(content, title) {
  try {
    if (!content || content.length < 50) {
      return `${title}: Content not available for summary.`;
    }
    
    const prompt = `Summarize the following content about "${title}" in 2-3 sentences, focusing on key learning points and actionable insights:

${content.substring(0, 2000)}

Summary:`;

    const summary = await chat([{ role: 'user', content: prompt }]);
    return summary.trim() || `${title}: Summary not available.`;
  } catch (error) {
    console.error('Summarization error:', error.message);
    return `${title}: Summary generation failed.`;
  }
}

/**
 * Generates a comprehensive roadmap based on topic, web sources, and LLM knowledge
 * @param {string} topic - Learning topic
 * @param {Object} options - Generation options
 * @returns {Promise<Object>} Generated roadmap
 */
async function generateComprehensiveRoadmap(topic, options = {}) {
  const {
    timeframe = '4-weeks',
    level = 'beginner',
    dailyTimeMinutes = 30,
    focus = 'practical',
    includeProjects = true
  } = options;
  
  try {
    console.log(`Generating roadmap for: ${topic}`);
    
    // Step 1: Perform web search
    const searchResults = await performWebSearch(topic, 8);
    console.log(`Found ${searchResults.length} search results`);
    
    // Step 2: Scrape and summarize top resources
    const scrapingPromises = searchResults.slice(0, 5).map(result => 
      scrapeAndSummarize(result.url, result.title)
    );
    
    const scrapedContent = await Promise.allSettled(scrapingPromises);
    const validContent = scrapedContent
      .filter(result => result.status === 'fulfilled')
      .map(result => result.value)
      .filter(content => content.summary && content.summary.length > 20);
    
    console.log(`Successfully scraped ${validContent.length} resources`);
    
    // Step 3: Rank and select best resources
    const rankedResources = rankResources(searchResults, validContent);
    
    // Step 4: Generate roadmap using LLM with web-sourced insights
    const roadmap = await generateRoadmapWithSources(topic, rankedResources, options);
    
    // Step 5: Add metadata and return
    return {
      topic,
      timeframe,
      level,
      dailyTimeMinutes,
      generatedAt: new Date().toISOString(),
      roadmap,
      sources: rankedResources.slice(0, 10),
      methodology: 'web-enhanced-llm',
      totalSteps: roadmap.steps?.length || 0
    };
    
  } catch (error) {
    console.error('Roadmap generation error:', error.message);
    
    // Fallback to LLM-only generation
    const fallbackRoadmap = await generateFallbackRoadmap(topic, options);
    return {
      topic,
      timeframe,
      level,
      dailyTimeMinutes,
      generatedAt: new Date().toISOString(),
      roadmap: fallbackRoadmap,
      sources: [],
      methodology: 'llm-fallback',
      totalSteps: fallbackRoadmap.steps?.length || 0,
      warning: 'Generated without web sources due to connectivity issues'
    };
  }
}

/**
 * Ranks resources by relevance, depth, and quality
 * @param {Array} searchResults - Search results
 * @param {Array} scrapedContent - Scraped content
 * @returns {Array} Ranked resources
 */
function rankResources(searchResults, scrapedContent) {
  const resources = searchResults.map(result => {
    const scraped = scrapedContent.find(content => content.url === result.url);
    
    let qualityScore = result.relevanceScore || 0.5;
    
    // Boost score based on content quality
    if (scraped) {
      if (scraped.wordCount > 500) qualityScore += 0.1;
      if (scraped.headers.length > 3) qualityScore += 0.1;
      if (scraped.summary.length > 100) qualityScore += 0.1;
    }
    
    // Boost score for trusted sources
    const trustedDomains = [
      'mozilla.org', 'python.org', 'react.dev', 'angular.io',
      'coursera.org', 'edx.org', 'khanacademy.org', 'freecodecamp.org',
      'github.com', 'stackoverflow.com', 'medium.com',
      'harvard.edu', 'mit.edu', 'stanford.edu'
    ];
    
    if (trustedDomains.some(domain => result.url.includes(domain))) {
      qualityScore += 0.2;
    }
    
    return {
      ...result,
      scrapedContent: scraped,
      qualityScore: Math.min(qualityScore, 1.0)
    };
  });
  
  return resources.sort((a, b) => b.qualityScore - a.qualityScore);
}

/**
 * Generates roadmap using LLM with web-sourced insights
 * @param {string} topic - Learning topic
 * @param {Array} resources - Ranked resources
 * @param {Object} options - Generation options
 * @returns {Promise<Object>} Generated roadmap
 */
async function generateRoadmapWithSources(topic, resources, options) {
  const resourceSummaries = resources.slice(0, 5).map((resource, index) => 
    `${index + 1}. ${resource.title} (${resource.source}): ${resource.scrapedContent?.summary || resource.snippet}`
  ).join('\n');
  
  const prompt = `You are an expert learning designer. Create a comprehensive, step-by-step roadmap for learning "${topic}".

**Context from Web Research:**
${resourceSummaries}

**Requirements:**
- Level: ${options.level}
- Timeframe: ${options.timeframe}
- Daily time: ${options.dailyTimeMinutes} minutes
- Focus: ${options.focus}
- Include projects: ${options.includeProjects}

**Instructions:**
1. Create a practical, actionable roadmap
2. Each step should be 3-5 minutes (microlearning format)
3. Include variety: theory, practice, projects, quizzes
4. Reference the web sources where relevant
5. Make it suitable for different learning styles
6. Include optional advanced topics
7. Provide clear progression markers

Return a JSON object with this exact structure:
{
  "overview": "Brief description of the learning journey",
  "prerequisites": ["prerequisite 1", "prerequisite 2"],
  "steps": [
    {
      "week": number,
      "day": number,
      "title": "Step title",
      "description": "What the learner will do",
      "duration": "3-5 minutes",
      "type": "theory|practice|project|quiz|review",
      "concepts": ["concept1", "concept2"],
      "resources": ["resource name 1", "resource name 2"],
      "optional": false,
      "difficulty": "beginner|intermediate|advanced"
    }
  ],
  "projects": [
    {
      "title": "Project title",
      "description": "Project description",
      "week": number,
      "estimatedHours": number,
      "skills": ["skill1", "skill2"]
    }
  ],
  "milestones": [
    {
      "week": number,
      "title": "Milestone title",
      "description": "What the learner should have achieved"
    }
  ],
  "additionalResources": [
    {
      "title": "Resource title",
      "url": "resource url",
      "type": "article|video|course|book",
      "description": "Why this resource is helpful"
    }
  ]
}`;

  const response = await chat([{ role: 'user', content: prompt }]);
  const roadmapJson = extractJSON(response);
  
  // if (!roadmapJson || !roadmapJson.steps) {
  //   throw new Error('Invalid roadmap format from LLM');
  // }
  
  return roadmapJson;
}

/**
 * Fallback roadmap generation without web sources
 * @param {string} topic - Learning topic
 * @param {Object} options - Generation options
 * @returns {Promise<Object>} Generated roadmap
 */
async function generateFallbackRoadmap(topic, options) {
  const prompt = `Create a comprehensive learning roadmap for "${topic}" without external sources.

Level: ${options.level}
Timeframe: ${options.timeframe}
Daily time: ${options.dailyTimeMinutes} minutes

Return a well-structured JSON roadmap with steps, projects, and milestones.`;

  const response = await chat([{ role: 'user', content: prompt }]);
  const roadmapJson = extractJSON(response);
  
  if (!roadmapJson) {
    // Return basic structure if JSON parsing fails
    return {
      overview: `Learning roadmap for ${topic}`,
      steps: [
        {
          week: 1,
          day: 1,
          title: `Introduction to ${topic}`,
          description: `Learn the basics of ${topic}`,
          duration: '5 minutes',
          type: 'theory',
          concepts: [topic],
          resources: [],
          optional: false,
          difficulty: options.level
        }
      ],
      projects: [],
      milestones: []
    };
  }
  
  return roadmapJson;
}

module.exports = {
  performWebSearch,
  scrapeAndSummarize,
  generateComprehensiveRoadmap,
  summarizeContent
};
