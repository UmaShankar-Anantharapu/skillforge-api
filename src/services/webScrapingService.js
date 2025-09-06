const axios = require('axios');
const cheerio = require('cheerio');
const { getCachedData, setCachedData } = require('./cacheService');

/**
 * Web Scraping Service for Roadmap Data Collection
 * Gathers latest industry trends, salary data, and learning resources
 */

/**
 * Main function to scrape roadmap data from multiple sources
 * @param {string} targetSkill - The skill to gather data for
 * @param {Object} options - Scraping options
 * @returns {Object} Aggregated data from multiple sources
 */
async function scrapeRoadmapData(targetSkill, options = {}) {
  try {
    console.log(`Starting web scraping for skill: ${targetSkill}`);
    
    const scrapingTasks = [
      scrapeGitHubTrends(targetSkill),
      scrapeStackOverflowTrends(targetSkill),
      scrapeJobSites(targetSkill),
      scrapeLearningPlatforms(targetSkill),
      scrapeTechBlogs(targetSkill)
    ];
    
    // Execute all scraping tasks in parallel with timeout
    const results = await Promise.allSettled(
      scrapingTasks.map(task => 
        Promise.race([
          task,
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Scraping timeout')), 10000)
          )
        ])
      )
    );
    
    // Aggregate successful results
    const aggregatedData = {
      skill: targetSkill,
      trends: [],
      salaryData: {},
      jobMarket: {},
      resources: [],
      certifications: [],
      tools: [],
      sources: [],
      scrapingResults: {
        successful: 0,
        failed: 0,
        errors: []
      },
      lastUpdated: new Date()
    };
    
    results.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value) {
        aggregatedData.scrapingResults.successful++;
        const data = result.value;
        
        // Merge data from each source
        if (data.trends) aggregatedData.trends.push(...data.trends);
        if (data.salaryData) Object.assign(aggregatedData.salaryData, data.salaryData);
        if (data.jobMarket) Object.assign(aggregatedData.jobMarket, data.jobMarket);
        if (data.resources) aggregatedData.resources.push(...data.resources);
        if (data.certifications) aggregatedData.certifications.push(...data.certifications);
        if (data.tools) aggregatedData.tools.push(...data.tools);
        if (data.source) aggregatedData.sources.push(data.source);
      } else {
        aggregatedData.scrapingResults.failed++;
        aggregatedData.scrapingResults.errors.push({
          source: ['GitHub', 'StackOverflow', 'Job Sites', 'Learning Platforms', 'Tech Blogs'][index],
          error: result.reason?.message || 'Unknown error'
        });
      }
    });
    
    // Deduplicate and clean data
    aggregatedData.trends = [...new Set(aggregatedData.trends)].slice(0, 10);
    aggregatedData.resources = deduplicateResources(aggregatedData.resources).slice(0, 15);
    aggregatedData.tools = [...new Set(aggregatedData.tools)].slice(0, 12);
    aggregatedData.certifications = [...new Set(aggregatedData.certifications)].slice(0, 8);
    
    console.log(`Web scraping completed. Success: ${aggregatedData.scrapingResults.successful}, Failed: ${aggregatedData.scrapingResults.failed}`);
    return aggregatedData;
    
  } catch (error) {
    console.error('Error in web scraping service:', error);
    throw error;
  }
}

/**
 * Scrape GitHub for trending repositories and technologies
 * @param {string} targetSkill - Target skill
 * @returns {Object} GitHub trends data
 */
async function scrapeGitHubTrends(targetSkill) {
  try {
    const searchQuery = encodeURIComponent(targetSkill);
    const url = `https://api.github.com/search/repositories?q=${searchQuery}&sort=stars&order=desc&per_page=10`;
    
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'SkillForge-Roadmap-Generator',
        'Accept': 'application/vnd.github.v3+json'
      },
      timeout: 8000
    });
    
    const repos = response.data.items || [];
    const trends = [];
    const tools = [];
    
    repos.forEach(repo => {
      if (repo.language) tools.push(repo.language);
      if (repo.topics) trends.push(...repo.topics);
      
      // Extract trends from repository names and descriptions
      const description = repo.description || '';
      const name = repo.name || '';
      
      // Look for technology keywords
      const techKeywords = extractTechKeywords(description + ' ' + name);
      trends.push(...techKeywords);
    });
    
    return {
      trends: [...new Set(trends)].slice(0, 8),
      tools: [...new Set(tools)].slice(0, 6),
      resources: repos.slice(0, 5).map(repo => ({
        type: 'repository',
        name: repo.name,
        link: repo.html_url,
        description: repo.description,
        stars: repo.stargazers_count,
        language: repo.language,
        provider: 'GitHub'
      })),
      source: 'GitHub API'
    };
  } catch (error) {
    console.warn('GitHub scraping failed:', error.message);
    return null;
  }
}

/**
 * Scrape StackOverflow for trending questions and technologies
 * @param {string} targetSkill - Target skill
 * @returns {Object} StackOverflow trends data
 */
async function scrapeStackOverflowTrends(targetSkill) {
  try {
    const searchQuery = encodeURIComponent(targetSkill);
    const url = `https://api.stackexchange.com/2.3/questions?order=desc&sort=votes&tagged=${searchQuery}&site=stackoverflow&pagesize=20`;
    
    const response = await axios.get(url, {
      timeout: 8000,
      headers: {
        'User-Agent': 'SkillForge-Roadmap-Generator'
      }
    });
    
    const questions = response.data.items || [];
    const trends = [];
    const tools = [];
    
    questions.forEach(question => {
      if (question.tags) {
        trends.push(...question.tags);
        tools.push(...question.tags.filter(tag => 
          tag.includes('js') || tag.includes('framework') || 
          tag.includes('library') || tag.includes('tool')
        ));
      }
      
      // Extract technology mentions from titles
      const techKeywords = extractTechKeywords(question.title);
      trends.push(...techKeywords);
    });
    
    return {
      trends: [...new Set(trends)].slice(0, 10),
      tools: [...new Set(tools)].slice(0, 8),
      resources: questions.slice(0, 3).map(q => ({
        type: 'discussion',
        name: q.title,
        link: q.link,
        score: q.score,
        views: q.view_count,
        provider: 'StackOverflow'
      })),
      source: 'StackOverflow API'
    };
  } catch (error) {
    console.warn('StackOverflow scraping failed:', error.message);
    return null;
  }
}

/**
 * Scrape job sites for salary and market data
 * @param {string} targetSkill - Target skill
 * @returns {Object} Job market data
 */
async function scrapeJobSites(targetSkill) {
  try {
    // Note: This is a simplified implementation
    // In production, you'd integrate with job APIs like Indeed, LinkedIn, etc.
    
    const jobData = await scrapeIndeedJobs(targetSkill);
    
    return {
      salaryData: {
        range: jobData.salaryRange || '$60,000 - $120,000',
        average: jobData.averageSalary || '$85,000',
        currency: 'USD',
        location: 'United States'
      },
      jobMarket: {
        growth: jobData.growth || '15% above average',
        demand: jobData.demand || 'High',
        openings: jobData.openings || '10,000+',
        competitiveness: jobData.competitiveness || 'Moderate'
      },
      tools: jobData.requiredSkills || [],
      certifications: jobData.preferredCertifications || [],
      source: 'Job Market Analysis'
    };
  } catch (error) {
    console.warn('Job sites scraping failed:', error.message);
    return null;
  }
}

/**
 * Scrape learning platforms for courses and resources
 * @param {string} targetSkill - Target skill
 * @returns {Object} Learning resources data
 */
async function scrapeLearningPlatforms(targetSkill) {
  try {
    // This would integrate with APIs from Coursera, Udemy, edX, etc.
    // For now, we'll simulate the data structure
    
    const resources = [
      {
        type: 'course',
        name: `Complete ${targetSkill} Bootcamp`,
        link: `https://example.com/course/${targetSkill.toLowerCase()}`,
        duration: '40 hours',
        rating: 4.6,
        difficulty: 'Intermediate',
        free: false,
        certificate: true,
        provider: 'Online Learning Platform',
        price: '$89.99',
        students: '50,000+'
      },
      {
        type: 'tutorial',
        name: `${targetSkill} Fundamentals`,
        link: `https://example.com/tutorial/${targetSkill.toLowerCase()}`,
        duration: '12 hours',
        rating: 4.4,
        difficulty: 'Beginner',
        free: true,
        certificate: false,
        provider: 'Free Learning Platform'
      }
    ];
    
    const certifications = [
      `${targetSkill} Professional Certificate`,
      `Advanced ${targetSkill} Certification`,
      `${targetSkill} Developer Associate`
    ];
    
    return {
      resources,
      certifications,
      trends: [`${targetSkill} certification demand`, 'Online learning growth'],
      source: 'Learning Platforms'
    };
  } catch (error) {
    console.warn('Learning platforms scraping failed:', error.message);
    return null;
  }
}

/**
 * Scrape tech blogs and news sites for industry trends
 * @param {string} targetSkill - Target skill
 * @returns {Object} Tech trends data
 */
async function scrapeTechBlogs(targetSkill) {
  try {
    // This would scrape from TechCrunch, Medium, Dev.to, etc.
    // For now, we'll provide structured trend data
    
    const trends = generateTechTrends(targetSkill);
    const tools = generatePopularTools(targetSkill);
    
    return {
      trends,
      tools,
      resources: [
        {
          type: 'article',
          name: `${targetSkill} Industry Report 2024`,
          link: `https://techblog.com/${targetSkill}-report-2024`,
          provider: 'Tech Industry Blog',
          publishDate: new Date().toISOString().split('T')[0]
        }
      ],
      source: 'Tech Blogs & News'
    };
  } catch (error) {
    console.warn('Tech blogs scraping failed:', error.message);
    return null;
  }
}

/**
 * Simplified Indeed job scraping (would use their API in production)
 * @param {string} targetSkill - Target skill
 * @returns {Object} Job data
 */
async function scrapeIndeedJobs(targetSkill) {
  // This is a placeholder - in production you'd use Indeed's API
  // or other job board APIs with proper authentication
  
  const skillSalaryMap = {
    'react': { salaryRange: '$70,000 - $130,000', averageSalary: '$95,000', growth: '22%' },
    'python': { salaryRange: '$75,000 - $140,000', averageSalary: '$105,000', growth: '25%' },
    'javascript': { salaryRange: '$65,000 - $125,000', averageSalary: '$90,000', growth: '20%' },
    'machine learning': { salaryRange: '$90,000 - $180,000', averageSalary: '$130,000', growth: '35%' },
    'data science': { salaryRange: '$85,000 - $160,000', averageSalary: '$120,000', growth: '30%' },
    'node.js': { salaryRange: '$70,000 - $135,000', averageSalary: '$100,000', growth: '18%' }
  };
  
  const skillLower = targetSkill.toLowerCase();
  const matchedSkill = Object.keys(skillSalaryMap).find(skill => 
    skillLower.includes(skill) || skill.includes(skillLower)
  );
  
  if (matchedSkill) {
    return {
      ...skillSalaryMap[matchedSkill],
      demand: 'High',
      openings: '15,000+',
      competitiveness: 'Moderate to High',
      requiredSkills: generateRequiredSkills(targetSkill),
      preferredCertifications: generatePreferredCertifications(targetSkill)
    };
  }
  
  // Default data
  return {
    salaryRange: '$60,000 - $120,000',
    averageSalary: '$85,000',
    growth: '15%',
    demand: 'Moderate to High',
    openings: '8,000+',
    competitiveness: 'Moderate',
    requiredSkills: ['Problem solving', 'Communication', 'Teamwork'],
    preferredCertifications: [`${targetSkill} Certification`]
  };
}

// Helper functions

/**
 * Extract technology keywords from text
 * @param {string} text - Text to analyze
 * @returns {Array} Array of technology keywords
 */
function extractTechKeywords(text) {
  const techKeywords = [
    'react', 'vue', 'angular', 'javascript', 'typescript', 'python', 'java',
    'node.js', 'express', 'mongodb', 'postgresql', 'mysql', 'redis',
    'docker', 'kubernetes', 'aws', 'azure', 'gcp', 'terraform',
    'machine learning', 'ai', 'data science', 'tensorflow', 'pytorch',
    'microservices', 'api', 'rest', 'graphql', 'websockets',
    'testing', 'ci/cd', 'devops', 'agile', 'scrum'
  ];
  
  const foundKeywords = [];
  const textLower = text.toLowerCase();
  
  techKeywords.forEach(keyword => {
    if (textLower.includes(keyword)) {
      foundKeywords.push(keyword);
    }
  });
  
  return foundKeywords;
}

/**
 * Generate tech trends based on skill
 * @param {string} targetSkill - Target skill
 * @returns {Array} Array of trends
 */
function generateTechTrends(targetSkill) {
  const trendMappings = {
    'react': [
      'Server Components adoption',
      'React 18 concurrent features',
      'Next.js 14 App Router',
      'TypeScript integration',
      'Micro-frontends architecture'
    ],
    'python': [
      'AI/ML integration boom',
      'FastAPI for web development',
      'Async programming patterns',
      'Data engineering pipelines',
      'Cloud-native Python apps'
    ],
    'javascript': [
      'ES2024 features adoption',
      'WebAssembly integration',
      'Edge computing with JS',
      'Full-stack TypeScript',
      'Progressive Web Apps'
    ],
    'machine learning': [
      'Large Language Models',
      'MLOps and model deployment',
      'Edge AI applications',
      'Responsible AI practices',
      'AutoML platforms'
    ]
  };
  
  const skillLower = targetSkill.toLowerCase();
  for (const [skill, trends] of Object.entries(trendMappings)) {
    if (skillLower.includes(skill)) {
      return trends;
    }
  }
  
  return [
    'Industry digital transformation',
    'Remote work technology adoption',
    'Cloud-first development',
    'Security-by-design principles',
    'Sustainable technology practices'
  ];
}

/**
 * Generate popular tools for a skill
 * @param {string} targetSkill - Target skill
 * @returns {Array} Array of tools
 */
function generatePopularTools(targetSkill) {
  const toolMappings = {
    'react': ['Vite', 'Next.js', 'React Query', 'Zustand', 'Tailwind CSS', 'Storybook'],
    'python': ['FastAPI', 'Pydantic', 'SQLAlchemy', 'Pytest', 'Black', 'Poetry'],
    'javascript': ['Node.js', 'Express', 'Webpack', 'ESLint', 'Prettier', 'Jest'],
    'machine learning': ['TensorFlow', 'PyTorch', 'Scikit-learn', 'Jupyter', 'MLflow', 'Weights & Biases']
  };
  
  const skillLower = targetSkill.toLowerCase();
  for (const [skill, tools] of Object.entries(toolMappings)) {
    if (skillLower.includes(skill)) {
      return tools;
    }
  }
  
  return ['VS Code', 'Git', 'Docker', 'Postman', 'Slack', 'Jira'];
}

/**
 * Generate required skills for job market
 * @param {string} targetSkill - Target skill
 * @returns {Array} Array of required skills
 */
function generateRequiredSkills(targetSkill) {
  const baseSkills = ['Problem solving', 'Communication', 'Teamwork', 'Time management'];
  const techSkills = generatePopularTools(targetSkill).slice(0, 4);
  return [...baseSkills, ...techSkills];
}

/**
 * Generate preferred certifications
 * @param {string} targetSkill - Target skill
 * @returns {Array} Array of certifications
 */
function generatePreferredCertifications(targetSkill) {
  const certMappings = {
    'react': ['React Developer Certification', 'Frontend Masters Certificate'],
    'python': ['Python Institute PCAP', 'Google Python Certificate'],
    'javascript': ['JavaScript Developer Certificate', 'Node.js Certification'],
    'machine learning': ['Google ML Engineer', 'AWS ML Specialty', 'Microsoft AI Engineer']
  };
  
  const skillLower = targetSkill.toLowerCase();
  for (const [skill, certs] of Object.entries(certMappings)) {
    if (skillLower.includes(skill)) {
      return certs;
    }
  }
  
  return [`${targetSkill} Professional Certificate`, `Advanced ${targetSkill} Certification`];
}

/**
 * Deduplicate resources array
 * @param {Array} resources - Array of resources
 * @returns {Array} Deduplicated resources
 */
function deduplicateResources(resources) {
  const seen = new Set();
  return resources.filter(resource => {
    const key = `${resource.name}_${resource.provider}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

module.exports = {
  scrapeRoadmapData,
  scrapeGitHubTrends,
  scrapeStackOverflowTrends,
  scrapeJobSites,
  scrapeLearningPlatforms,
  scrapeTechBlogs
};