const NodeCache = require('node-cache');
const fs = require('fs').promises;
const path = require('path');

/**
 * Caching Service for SkillForge Roadmap Generation
 * Provides in-memory and persistent caching for improved performance
 */

// In-memory cache with TTL (Time To Live)
const memoryCache = new NodeCache({
  stdTTL: 3600, // 1 hour default TTL
  checkperiod: 600, // Check for expired keys every 10 minutes
  useClones: false // Don't clone objects for better performance
});

// Cache directory for persistent storage
const CACHE_DIR = path.join(process.cwd(), 'cache');
const PERSISTENT_CACHE_FILE = path.join(CACHE_DIR, 'roadmap_cache.json');

// Cache configuration
const CACHE_CONFIG = {
  // TTL values in seconds
  TTL: {
    SKILL_ASSESSMENT: 24 * 60 * 60, // 24 hours
    INDUSTRY_DATA: 12 * 60 * 60,    // 12 hours
    WEB_SCRAPING: 6 * 60 * 60,      // 6 hours
    ROADMAP_STRUCTURE: 2 * 60 * 60, // 2 hours
    USER_PREFERENCES: 7 * 24 * 60 * 60, // 7 days
    AI_RESPONSES: 1 * 60 * 60       // 1 hour
  },
  
  // Cache size limits
  MAX_MEMORY_ITEMS: 1000,
  MAX_PERSISTENT_SIZE_MB: 50,
  
  // Cache key prefixes
  PREFIXES: {
    SKILL_ASSESSMENT: 'skill_assess_',
    INDUSTRY_DATA: 'industry_',
    WEB_SCRAPING: 'scraping_',
    ROADMAP: 'roadmap_',
    USER_PREF: 'user_pref_',
    AI_RESPONSE: 'ai_resp_'
  }
};

/**
 * Initialize cache service
 */
async function initializeCache() {
  try {
    // Ensure cache directory exists
    await fs.mkdir(CACHE_DIR, { recursive: true });
    
    // Load persistent cache if it exists
    await loadPersistentCache();
    
    // Set up cache cleanup intervals
    setupCacheCleanup();
    
    console.log('Cache service initialized successfully');
  } catch (error) {
    console.error('Error initializing cache service:', error);
  }
}

/**
 * Get data from cache (checks memory first, then persistent)
 * @param {string} key - Cache key
 * @param {Object} options - Cache options
 * @returns {*} Cached data or null if not found
 */
async function getCachedData(key, options = {}) {
  try {
    // Check memory cache first
    const memoryData = memoryCache.get(key);
    if (memoryData !== undefined) {
      console.log(`Cache hit (memory): ${key}`);
      return memoryData;
    }
    
    // Check persistent cache if enabled
    if (options.usePersistent !== false) {
      const persistentData = await getPersistentData(key);
      if (persistentData !== null) {
        // Move to memory cache for faster access
        const ttl = getTTLForKey(key);
        memoryCache.set(key, persistentData, ttl);
        console.log(`Cache hit (persistent): ${key}`);
        return persistentData;
      }
    }
    
    console.log(`Cache miss: ${key}`);
    return null;
  } catch (error) {
    console.error(`Error getting cached data for key ${key}:`, error);
    return null;
  }
}

/**
 * Set data in cache (both memory and persistent if applicable)
 * @param {string} key - Cache key
 * @param {*} data - Data to cache
 * @param {Object} options - Cache options
 * @returns {boolean} Success status
 */
async function setCachedData(key, data, options = {}) {
  try {
    const ttl = options.ttl || getTTLForKey(key);
    
    // Set in memory cache
    const memorySuccess = memoryCache.set(key, data, ttl);
    
    // Set in persistent cache if enabled and data is suitable
    if (options.persistent !== false && shouldPersist(key, data)) {
      await setPersistentData(key, data, ttl);
    }
    
    console.log(`Data cached: ${key} (TTL: ${ttl}s)`);
    return memorySuccess;
  } catch (error) {
    console.error(`Error setting cached data for key ${key}:`, error);
    return false;
  }
}

/**
 * Delete data from cache
 * @param {string} key - Cache key
 * @returns {boolean} Success status
 */
async function deleteCachedData(key) {
  try {
    // Delete from memory cache
    const memoryDeleted = memoryCache.del(key);
    
    // Delete from persistent cache
    await deletePersistentData(key);
    
    console.log(`Cache deleted: ${key}`);
    return memoryDeleted > 0;
  } catch (error) {
    console.error(`Error deleting cached data for key ${key}:`, error);
    return false;
  }
}

/**
 * Clear all cache data
 * @param {Object} options - Clear options
 */
async function clearCache(options = {}) {
  try {
    if (options.memory !== false) {
      memoryCache.flushAll();
      console.log('Memory cache cleared');
    }
    
    if (options.persistent !== false) {
      await clearPersistentCache();
      console.log('Persistent cache cleared');
    }
  } catch (error) {
    console.error('Error clearing cache:', error);
  }
}

/**
 * Get cache statistics
 * @returns {Object} Cache statistics
 */
function getCacheStats() {
  const memoryStats = memoryCache.getStats();
  
  return {
    memory: {
      keys: memoryStats.keys,
      hits: memoryStats.hits,
      misses: memoryStats.misses,
      hitRate: memoryStats.hits / (memoryStats.hits + memoryStats.misses) || 0,
      vsize: memoryStats.vsize
    },
    persistent: {
      // Would include persistent cache stats in production
      enabled: true
    },
    config: CACHE_CONFIG
  };
}

/**
 * Generate cache key for skill assessment
 * @param {string} userId - User ID
 * @param {string} targetSkill - Target skill
 * @returns {string} Cache key
 */
function generateSkillAssessmentKey(userId, targetSkill) {
  const skillKey = targetSkill.toLowerCase().replace(/[^a-z0-9]/g, '_');
  return `${CACHE_CONFIG.PREFIXES.SKILL_ASSESSMENT}${userId}_${skillKey}`;
}

/**
 * Generate cache key for industry data
 * @param {string} targetSkill - Target skill
 * @returns {string} Cache key
 */
function generateIndustryDataKey(targetSkill) {
  const skillKey = targetSkill.toLowerCase().replace(/[^a-z0-9]/g, '_');
  return `${CACHE_CONFIG.PREFIXES.INDUSTRY_DATA}${skillKey}`;
}

/**
 * Generate cache key for web scraping data
 * @param {string} targetSkill - Target skill
 * @param {string} source - Data source
 * @returns {string} Cache key
 */
function generateWebScrapingKey(targetSkill, source = 'all') {
  const skillKey = targetSkill.toLowerCase().replace(/[^a-z0-9]/g, '_');
  const sourceKey = source.toLowerCase().replace(/[^a-z0-9]/g, '_');
  return `${CACHE_CONFIG.PREFIXES.WEB_SCRAPING}${skillKey}_${sourceKey}`;
}

/**
 * Generate cache key for roadmap data
 * @param {string} userId - User ID
 * @param {string} targetSkill - Target skill
 * @returns {string} Cache key
 */
function generateRoadmapKey(userId, targetSkill) {
  const skillKey = targetSkill.toLowerCase().replace(/[^a-z0-9]/g, '_');
  return `${CACHE_CONFIG.PREFIXES.ROADMAP}${userId}_${skillKey}`;
}

/**
 * Generate cache key for AI responses
 * @param {string} prompt - AI prompt (hashed)
 * @param {string} provider - AI provider
 * @returns {string} Cache key
 */
function generateAIResponseKey(prompt, provider = 'ollama') {
  const crypto = require('crypto');
  const promptHash = crypto.createHash('md5').update(prompt).digest('hex').substring(0, 16);
  return `${CACHE_CONFIG.PREFIXES.AI_RESPONSE}${provider}_${promptHash}`;
}

// Private helper functions

/**
 * Get TTL for a cache key based on its prefix
 * @param {string} key - Cache key
 * @returns {number} TTL in seconds
 */
function getTTLForKey(key) {
  for (const [type, prefix] of Object.entries(CACHE_CONFIG.PREFIXES)) {
    if (key.startsWith(prefix)) {
      return CACHE_CONFIG.TTL[type] || CACHE_CONFIG.TTL.AI_RESPONSES;
    }
  }
  return 3600; // Default 1 hour
}

/**
 * Determine if data should be persisted
 * @param {string} key - Cache key
 * @param {*} data - Data to check
 * @returns {boolean} Should persist
 */
function shouldPersist(key, data) {
  // Don't persist temporary or sensitive data
  if (key.includes('temp_') || key.includes('session_')) {
    return false;
  }
  
  // Don't persist very large objects
  const dataSize = JSON.stringify(data).length;
  if (dataSize > 1024 * 1024) { // 1MB limit
    return false;
  }
  
  // Persist industry data, skill assessments, and roadmaps
  return key.startsWith(CACHE_CONFIG.PREFIXES.INDUSTRY_DATA) ||
         key.startsWith(CACHE_CONFIG.PREFIXES.SKILL_ASSESSMENT) ||
         key.startsWith(CACHE_CONFIG.PREFIXES.ROADMAP);
}

/**
 * Load persistent cache from disk
 */
async function loadPersistentCache() {
  try {
    const data = await fs.readFile(PERSISTENT_CACHE_FILE, 'utf8');
    const cacheData = JSON.parse(data);
    
    let loadedCount = 0;
    const now = Date.now();
    
    for (const [key, item] of Object.entries(cacheData)) {
      // Check if item has expired
      if (item.expires && item.expires < now) {
        continue;
      }
      
      // Load into memory cache
      const remainingTTL = item.expires ? Math.max(0, (item.expires - now) / 1000) : getTTLForKey(key);
      memoryCache.set(key, item.data, remainingTTL);
      loadedCount++;
    }
    
    console.log(`Loaded ${loadedCount} items from persistent cache`);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.warn('Error loading persistent cache:', error.message);
    }
  }
}

/**
 * Get data from persistent cache
 * @param {string} key - Cache key
 * @returns {*} Cached data or null
 */
async function getPersistentData(key) {
  try {
    const data = await fs.readFile(PERSISTENT_CACHE_FILE, 'utf8');
    const cacheData = JSON.parse(data);
    
    const item = cacheData[key];
    if (!item) {
      return null;
    }
    
    // Check expiration
    if (item.expires && item.expires < Date.now()) {
      // Clean up expired item
      delete cacheData[key];
      await fs.writeFile(PERSISTENT_CACHE_FILE, JSON.stringify(cacheData, null, 2));
      return null;
    }
    
    return item.data;
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.warn('Error reading persistent cache:', error.message);
    }
    return null;
  }
}

/**
 * Set data in persistent cache
 * @param {string} key - Cache key
 * @param {*} data - Data to cache
 * @param {number} ttl - TTL in seconds
 */
async function setPersistentData(key, data, ttl) {
  try {
    let cacheData = {};
    
    // Load existing cache
    try {
      const existingData = await fs.readFile(PERSISTENT_CACHE_FILE, 'utf8');
      cacheData = JSON.parse(existingData);
    } catch (error) {
      // File doesn't exist or is invalid, start fresh
    }
    
    // Add new item
    cacheData[key] = {
      data,
      created: Date.now(),
      expires: Date.now() + (ttl * 1000)
    };
    
    // Clean up expired items while we're here
    const now = Date.now();
    for (const [k, item] of Object.entries(cacheData)) {
      if (item.expires && item.expires < now) {
        delete cacheData[k];
      }
    }
    
    // Write back to file
    await fs.writeFile(PERSISTENT_CACHE_FILE, JSON.stringify(cacheData, null, 2));
  } catch (error) {
    console.warn('Error writing to persistent cache:', error.message);
  }
}

/**
 * Delete data from persistent cache
 * @param {string} key - Cache key
 */
async function deletePersistentData(key) {
  try {
    const data = await fs.readFile(PERSISTENT_CACHE_FILE, 'utf8');
    const cacheData = JSON.parse(data);
    
    if (cacheData[key]) {
      delete cacheData[key];
      await fs.writeFile(PERSISTENT_CACHE_FILE, JSON.stringify(cacheData, null, 2));
    }
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.warn('Error deleting from persistent cache:', error.message);
    }
  }
}

/**
 * Clear persistent cache
 */
async function clearPersistentCache() {
  try {
    await fs.unlink(PERSISTENT_CACHE_FILE);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.warn('Error clearing persistent cache:', error.message);
    }
  }
}

/**
 * Set up cache cleanup intervals
 */
function setupCacheCleanup() {
  // Clean up memory cache every hour
  setInterval(() => {
    const stats = memoryCache.getStats();
    console.log(`Cache cleanup - Keys: ${stats.keys}, Hit rate: ${(stats.hits / (stats.hits + stats.misses) * 100).toFixed(1)}%`);
  }, 60 * 60 * 1000);
  
  // Clean up persistent cache daily
  setInterval(async () => {
    try {
      await cleanupPersistentCache();
    } catch (error) {
      console.warn('Error during persistent cache cleanup:', error.message);
    }
  }, 24 * 60 * 60 * 1000);
}

/**
 * Clean up expired items from persistent cache
 */
async function cleanupPersistentCache() {
  try {
    const data = await fs.readFile(PERSISTENT_CACHE_FILE, 'utf8');
    const cacheData = JSON.parse(data);
    
    let cleanedCount = 0;
    const now = Date.now();
    
    for (const [key, item] of Object.entries(cacheData)) {
      if (item.expires && item.expires < now) {
        delete cacheData[key];
        cleanedCount++;
      }
    }
    
    if (cleanedCount > 0) {
      await fs.writeFile(PERSISTENT_CACHE_FILE, JSON.stringify(cacheData, null, 2));
      console.log(`Cleaned up ${cleanedCount} expired items from persistent cache`);
    }
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.warn('Error during persistent cache cleanup:', error.message);
    }
  }
}

// Initialize cache on module load
initializeCache();

module.exports = {
  getCachedData,
  setCachedData,
  deleteCachedData,
  clearCache,
  getCacheStats,
  generateSkillAssessmentKey,
  generateIndustryDataKey,
  generateWebScrapingKey,
  generateRoadmapKey,
  generateAIResponseKey,
  CACHE_CONFIG
};