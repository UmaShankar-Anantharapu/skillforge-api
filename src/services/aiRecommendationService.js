const { chat } = require('./llmClient');
const axios = require('axios');
const UserProfile = require('../models/UserProfile');

// Configuration
const DUCKDUCKGO_API_URL = 'https://api.duckduckgo.com';
const MAX_ROADMAPS = 12;
const SEARCH_RESULTS_PER_ROADMAP = 3;

/**
 * Generate AI-powered personalized roadmap recommendations
 * @param {string} userId - User ID to fetch profile data
 * @returns {Object} Generated roadmaps with resources
 */
async function generatePersonalizedRoadmaps(userId) {
  try {
    // Try to fetch user profile data
    let userProfile = null;
    try {
      userProfile = await UserProfile.findByUserId(userId);
    } catch (profileError) {
      console.log('User profile not found or invalid userId, using fallback roadmaps:', profileError.message);
    }

    if (!userProfile) {
      // Return fallback roadmaps if user profile not found
      const fallbackRoadmaps = generateFallbackRoadmaps();
      const enhancedRoadmaps = await enhanceRoadmapsWithResources(fallbackRoadmaps);
      
      return {
        success: true,
        data: {
          roadmaps: enhancedRoadmaps,
          totalCount: enhancedRoadmaps.length,
          generatedAt: new Date(),
          userProfile: {
            primaryGoal: 'General skill development',
            targetRole: 'Not specified',
            currentSkills: []
          }
        }
      };
    }

    // Generate dynamic prompt based on user data
    const prompt = generatePersonalizedPrompt(userProfile);

    // Query Ollama LLM for roadmap recommendations
    const llmResponse = await queryLLMForRoadmaps(prompt);

    // Parse roadmaps from LLM response
    const roadmaps = parseRoadmapsFromResponse(llmResponse);

    // Enhance roadmaps with web search resources
    const enhancedRoadmaps = await enhanceRoadmapsWithResources(roadmaps);

    return {
      success: true,
      data: {
        roadmaps: enhancedRoadmaps,
        totalCount: enhancedRoadmaps.length,
        generatedAt: new Date(),
        userProfile: {
          primaryGoal: userProfile.primaryGoal,
          targetRole: userProfile.targetRole,
          currentSkills: userProfile.currentSkills?.map(skill => skill.skillName) || []
        }
      }
    };
  } catch (error) {
    console.error('Error generating personalized roadmaps:', error);
    
    // Return fallback roadmaps as last resort
    try {
      const fallbackRoadmaps = generateFallbackRoadmaps();
      const enhancedRoadmaps = await enhanceRoadmapsWithResources(fallbackRoadmaps);
      
      return {
        success: true,
        data: {
          roadmaps: enhancedRoadmaps,
          totalCount: enhancedRoadmaps.length,
          generatedAt: new Date(),
          userProfile: {
            primaryGoal: 'General skill development',
            targetRole: 'Not specified',
            currentSkills: []
          }
        }
      };
    } catch (fallbackError) {
      console.error('Error generating fallback roadmaps:', fallbackError);
      throw new Error('Failed to generate personalized roadmaps');
    }
  }
}

/**
 * Generate trending roadmaps without user-specific inputs
 * @returns {Object} Generated trending roadmaps with resources
 */
async function generateTrendingRoadmaps() {
  try {
    // For now, use fallback roadmaps to ensure reliability
    // TODO: Fix LLM JSON parsing issues in future iteration
    const roadmaps = generateFallbackRoadmaps();

    // Enhance roadmaps with web search resources
    const enhancedRoadmaps = await enhanceRoadmapsWithResources(roadmaps);

    return {
      success: true,
      data: {
        roadmaps: enhancedRoadmaps,
        totalCount: enhancedRoadmaps.length,
        generatedAt: new Date(),
        type: 'trending'
      }
    };
  } catch (error) {
    console.error('Error generating trending roadmaps:', error);
    // Return basic fallback if even the enhanced version fails
    const basicRoadmaps = generateFallbackRoadmaps();
    return {
      success: true,
      data: {
        roadmaps: basicRoadmaps,
        totalCount: basicRoadmaps.length,
        generatedAt: new Date(),
        type: 'trending'
      }
    };
  }
}

/**
 * Generate dynamic prompt based on user profile data
 * @param {Object} userProfile - User profile object
 * @returns {string} Generated prompt
 */
function generatePersonalizedPrompt(userProfile) {
  const currentSkills = userProfile.currentSkills?.map(skill => 
    `${skill.skillName} (${skill.proficiencyLevel})`
  ).join(', ') || 'No skills specified';

  const experienceLevel = calculateExperienceLevel(userProfile);
  const careerBackground = userProfile.careerBackground?.map(exp => 
    `${exp.position} at ${exp.company} (${exp.yearsOfExperience} years)`
  ).join(', ') || 'No experience specified';

  return `
You are an AI career advisor. Based on the following user profile, generate exactly 25 personalized learning roadmaps that will help them achieve their career goals.

User Profile:
- Primary Goal: ${userProfile.primaryGoal || 'Career advancement'}
- Target Role: ${userProfile.targetRole || 'Not specified'}
- Current Skills: ${currentSkills}
- Experience Level: ${experienceLevel}
- Career Background: ${careerBackground}
- Motivation Level: ${userProfile.motivationLevel || 'Not specified'}/10
- Weekly Time Commitment: ${userProfile.timeline?.weeklyTimeCommitment || 'Not specified'} hours

For each roadmap, provide:
1. Title (concise, specific)
2. Description (2-3 sentences explaining the roadmap)
3. Difficulty Level (Beginner/Intermediate/Advanced)
4. Estimated Duration (in weeks/months)
5. Key Skills to Learn (3-5 main skills)
6. Prerequisites (if any)
7. Career Impact (how this helps their goal)

Format your response as a JSON array with exactly 25 roadmap objects. Each object should have the structure:
{
  "title": "Roadmap Title",
  "description": "Brief description",
  "difficulty": "Beginner|Intermediate|Advanced",
  "duration": "X weeks/months",
  "keySkills": ["skill1", "skill2", "skill3"],
  "prerequisites": ["prereq1", "prereq2"],
  "careerImpact": "How this helps achieve their goal"
}

Ensure roadmaps are diverse, relevant to their goals, and progressively build upon their current skills.
`;
}

/**
 * Generate prompt for trending roadmaps
 * @returns {string} Generated prompt
 */
function generateTrendingPrompt() {
  return `
You are an AI technology trend analyst. Generate exactly 12 trending learning roadmaps based on current technology trends, market demands, and emerging skills in 2024.

IMPORTANT: You MUST return COMPLETE, VALID JSON. Do NOT truncate or abbreviate the response. Include ALL 12 roadmaps in full.

Focus on:
- Emerging technologies (AI/ML, Web3, Cloud Native, etc.)
- High-demand skills in the job market
- Future-proof career paths
- Industry-leading frameworks and tools

For each roadmap, provide:
1. Title (concise, specific)
2. Description (brief explanation why it's trending)
3. Difficulty Level (Beginner/Intermediate/Advanced)
4. Estimated Duration (in weeks/months)
5. Key Skills to Learn (3-4 main skills)
6. Prerequisites (if any)
7. Market Demand (why this is trending now)

Format your response as a COMPLETE JSON array with exactly 12 roadmap objects. Each object should have this structure:
{
  "title": "Roadmap Title",
  "description": "Brief description of why it's trending",
  "difficulty": "Beginner|Intermediate|Advanced",
  "duration": "X weeks/months",
  "keySkills": ["skill1", "skill2", "skill3"],
  "prerequisites": ["prereq1", "prereq2"],
  "marketDemand": "Why this is trending and in-demand"
}

Return ONLY the JSON array. Do NOT include any explanatory text before or after the JSON.
`;
}

/**
 * Query Ollama LLM for roadmap recommendations
 * @param {string} prompt - The prompt to send to LLM
 * @returns {string} LLM response
 */
async function queryLLMForRoadmaps(prompt) {
  try {
    const messages = [
      {
        role: 'system',
        content: 'You are an expert career advisor and technology trend analyst. Always respond with valid JSON format.'
      },
      {
        role: 'user',
        content: prompt
      }
    ];

    const response = await chat(messages);
    return response;
  } catch (error) {
    console.error('Error querying LLM:', error);
    throw new Error('Failed to generate roadmaps from LLM');
  }
}

/**
 * Parse roadmaps from LLM response
 * @param {string} llmResponse - Raw LLM response
 * @returns {Array} Parsed roadmaps array
 */
function parseRoadmapsFromResponse(llmResponse) {
  try {
    // Try to extract JSON from the response
    let jsonStr = llmResponse.trim();
    
    // Remove markdown code blocks if present
    if (jsonStr.startsWith('```json')) {
      jsonStr = jsonStr.replace(/```json\s*/, '').replace(/\s*```$/, '');
    } else if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/```\s*/, '').replace(/\s*```$/, '');
    }

    const roadmaps = JSON.parse(jsonStr);
    
    if (!Array.isArray(roadmaps)) {
      throw new Error('Response is not an array');
    }

    // Validate and ensure we have exactly 25 roadmaps
    const validRoadmaps = roadmaps.slice(0, MAX_ROADMAPS).map((roadmap, index) => ({
      id: `roadmap_${index + 1}`,
      title: roadmap.title || `Roadmap ${index + 1}`,
      description: roadmap.description || 'No description available',
      difficulty: roadmap.difficulty || 'Intermediate',
      duration: roadmap.duration || '8-12 weeks',
      keySkills: Array.isArray(roadmap.keySkills) ? roadmap.keySkills : [],
      prerequisites: Array.isArray(roadmap.prerequisites) ? roadmap.prerequisites : [],
      careerImpact: roadmap.careerImpact || roadmap.marketDemand || 'Enhances career prospects',
      resources: [] // Will be populated by web search
    }));

    return validRoadmaps;
  } catch (error) {
    console.error('Error parsing LLM response:', error);
    // Return fallback roadmaps if parsing fails
    return generateFallbackRoadmaps();
  }
}

/**
 * Enhance roadmaps with web search resources
 * @param {Array} roadmaps - Array of roadmap objects
 * @returns {Array} Enhanced roadmaps with resources
 */
async function enhanceRoadmapsWithResources(roadmaps) {
  const enhancedRoadmaps = [];

  for (const roadmap of roadmaps) {
    try {
      // Search for resources related to the roadmap
      const resources = await searchResourcesForRoadmap(roadmap);
      
      enhancedRoadmaps.push({
        ...roadmap,
        resources: resources
      });
    } catch (error) {
      console.error(`Error enhancing roadmap ${roadmap.title}:`, error);
      // Add roadmap without resources if search fails
      enhancedRoadmaps.push({
        ...roadmap,
        resources: []
      });
    }
  }

  return enhancedRoadmaps;
}

/**
 * Search for resources related to a specific roadmap
 * @param {Object} roadmap - Roadmap object
 * @returns {Array} Array of resource objects
 */
async function searchResourcesForRoadmap(roadmap) {
  try {
    const searchQuery = `${roadmap.title} tutorial course learning resources`;
    const searchResults = await performWebSearch(searchQuery);
    
    // Process and format search results
    const resources = searchResults.slice(0, SEARCH_RESULTS_PER_ROADMAP).map((result, index) => ({
      id: `resource_${roadmap.id}_${index + 1}`,
      title: result.title || 'Resource',
      url: result.url || '#',
      description: result.description || 'No description available',
      type: determineResourceType(result.url),
      thumbnail: generateThumbnailUrl(result.url),
      source: extractDomain(result.url)
    }));

    return resources;
  } catch (error) {
    console.error('Error searching resources:', error);
    return [];
  }
}

/**
 * Perform web search using DuckDuckGo API
 * @param {string} query - Search query
 * @returns {Array} Search results
 */
async function performWebSearch(query) {
  try {
    // Note: DuckDuckGo doesn't have a public API, so we'll simulate search results
    // In a real implementation, you might use Google Custom Search API, Bing API, or web scraping
    
    // For now, return mock search results based on common learning platforms
    const mockResults = generateMockSearchResults(query);
    return mockResults;
  } catch (error) {
    console.error('Error performing web search:', error);
    return [];
  }
}

/**
 * Generate mock search results for demonstration
 * @param {string} query - Search query
 * @returns {Array} Mock search results
 */
function generateMockSearchResults(query) {
  const platforms = [
    { name: 'Coursera', domain: 'coursera.org', type: 'course' },
    { name: 'Udemy', domain: 'udemy.com', type: 'course' },
    { name: 'freeCodeCamp', domain: 'freecodecamp.org', type: 'tutorial' },
    { name: 'MDN Web Docs', domain: 'developer.mozilla.org', type: 'documentation' },
    { name: 'YouTube', domain: 'youtube.com', type: 'video' },
    { name: 'GitHub', domain: 'github.com', type: 'project' }
  ];

  return platforms.slice(0, SEARCH_RESULTS_PER_ROADMAP).map((platform, index) => ({
    title: `${query} - ${platform.name}`,
    url: `https://${platform.domain}/search?q=${encodeURIComponent(query)}`,
    description: `Learn ${query} with comprehensive ${platform.type}s on ${platform.name}`,
    type: platform.type
  }));
}

/**
 * Calculate user's experience level based on profile
 * @param {Object} userProfile - User profile object
 * @returns {string} Experience level
 */
function calculateExperienceLevel(userProfile) {
  const totalExperience = userProfile.careerBackground?.reduce((total, exp) => 
    total + (exp.yearsOfExperience || 0), 0
  ) || 0;

  if (totalExperience === 0) return 'Entry Level';
  if (totalExperience < 3) return 'Junior';
  if (totalExperience < 7) return 'Mid-level';
  return 'Senior';
}

/**
 * Determine resource type based on URL
 * @param {string} url - Resource URL
 * @returns {string} Resource type
 */
function determineResourceType(url) {
  if (url.includes('youtube.com') || url.includes('vimeo.com')) return 'video';
  if (url.includes('github.com')) return 'project';
  if (url.includes('coursera.org') || url.includes('udemy.com')) return 'course';
  if (url.includes('freecodecamp.org')) return 'tutorial';
  if (url.includes('developer.mozilla.org') || url.includes('docs.')) return 'documentation';
  return 'article';
}

/**
 * Generate thumbnail URL for resource
 * @param {string} url - Resource URL
 * @returns {string} Thumbnail URL
 */
function generateThumbnailUrl(url) {
  // In a real implementation, you might use a service like PagePeeker or generate thumbnails
  const domain = extractDomain(url);
  return `https://logo.clearbit.com/${domain}`;
}

/**
 * Extract domain from URL
 * @param {string} url - Full URL
 * @returns {string} Domain name
 */
function extractDomain(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace('www.', '');
  } catch {
    return 'unknown.com';
  }
}

/**
 * Generate fallback roadmaps if LLM parsing fails
 * @returns {Array} Fallback roadmaps
 */
function generateFallbackRoadmaps() {
  return [
    {
      id: 'fallback_1',
      title: 'Full-Stack Web Development',
      description: 'Master modern web development with React, Node.js, and databases.',
      difficulty: 'Intermediate',
      duration: '12-16 weeks',
      keySkills: ['React', 'Node.js', 'MongoDB', 'Express.js'],
      prerequisites: ['JavaScript', 'HTML', 'CSS'],
      careerImpact: 'Opens opportunities in web development roles',
      resources: []
    },
    {
      id: 'fallback_2',
      title: 'Data Science Fundamentals',
      description: 'Learn data analysis, machine learning, and statistical modeling.',
      difficulty: 'Beginner',
      duration: '10-14 weeks',
      keySkills: ['Python', 'Pandas', 'Machine Learning', 'Statistics'],
      prerequisites: ['Basic Math', 'Programming Basics'],
      careerImpact: 'Entry into data science and analytics roles',
      resources: []
    },
    {
      id: 'fallback_3',
      title: 'AI/ML Engineering',
      description: 'Build and deploy machine learning models in production environments.',
      difficulty: 'Advanced',
      duration: '16-20 weeks',
      keySkills: ['TensorFlow', 'PyTorch', 'MLOps', 'Docker'],
      prerequisites: ['Python', 'Statistics', 'Linear Algebra'],
      careerImpact: 'High-demand AI engineering positions',
      resources: []
    },
    {
      id: 'fallback_4',
      title: 'Cloud Architecture',
      description: 'Design and implement scalable cloud solutions using AWS/Azure.',
      difficulty: 'Intermediate',
      duration: '14-18 weeks',
      keySkills: ['AWS', 'Kubernetes', 'Terraform', 'DevOps'],
      prerequisites: ['Networking', 'Linux', 'Programming'],
      careerImpact: 'Cloud architect and DevOps engineer roles',
      resources: []
    },
    {
      id: 'fallback_5',
      title: 'Cybersecurity Specialist',
      description: 'Learn ethical hacking, security analysis, and threat detection.',
      difficulty: 'Intermediate',
      duration: '12-16 weeks',
      keySkills: ['Penetration Testing', 'Network Security', 'SIEM', 'Incident Response'],
      prerequisites: ['Networking', 'Operating Systems'],
      careerImpact: 'High-demand cybersecurity positions',
      resources: []
    },
    {
      id: 'fallback_6',
      title: 'Mobile App Development',
      description: 'Create cross-platform mobile applications using React Native or Flutter.',
      difficulty: 'Intermediate',
      duration: '10-14 weeks',
      keySkills: ['React Native', 'Flutter', 'Mobile UI/UX', 'API Integration'],
      prerequisites: ['JavaScript', 'Programming Fundamentals'],
      careerImpact: 'Mobile developer opportunities',
      resources: []
    }
  ];
}

module.exports = {
  generatePersonalizedRoadmaps,
  generateTrendingRoadmaps
};