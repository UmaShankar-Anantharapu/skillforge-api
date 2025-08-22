// Ollama configuration
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://127.0.0.1:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.1';

// OpenRouter configuration
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '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';
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || 'meta-llama/llama-3.1-405b-instruct:free' || 'mistral-7b-instruct';

/**
 * Chat with either Ollama or OpenRouter based on configuration
 * @param {Array} messages - Array of message objects with role and content
 * @param {string} provider - 'ollama' or 'openrouter'
 * @returns {Promise<string>} The response text
 */
async function chat(messages, provider = 'openrouter') {
  if (provider === 'openrouter') {
    return chatWithOpenRouter(messages);
  }
  return chatWithOllama(messages);
}

/**
 * Chat with Ollama local instance
 * @param {Array} messages - Array of message objects
 * @returns {Promise<string>} The response text
 */
async function chatWithOllama(messages) {
  try {
    const res = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: OLLAMA_MODEL, messages, stream: false }),
    });
    if (!res.ok) throw new Error(`Ollama chat error ${res.status}`);
    const data = await res.json();
    const text = data?.message?.content || data?.response || '';
    return text;
  } catch (error) {
    console.error('Ollama connection error:', error.message);
    if (error.cause && error.cause.code === 'ECONNREFUSED') {
      throw new Error('Ollama service is not running. Please start Ollama and try again.');
    }
    throw new Error(`Failed to connect to Ollama: ${error.message}`);
  }
}

/**
 * Chat with OpenRouter API
 * @param {Array} messages - Array of message objects
 * @returns {Promise<string>} The response text
 */
async function chatWithOpenRouter(messages) {
  if (!OPENROUTER_API_KEY) {
    throw new Error('OpenRouter API key is not configured');
  }

  try {
    const res = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'HTTP-Referer': process.env.APP_URL || 'http://localhost:3000', // Required for OpenRouter
        'X-Title': 'SkillForge' // Optional - your app's name
      },
      body: JSON.stringify({
        model: OPENROUTER_MODEL,
        messages,
        temperature: 0.7,
        max_tokens: 1000
      })
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      throw new Error(`OpenRouter API error ${res.status}: ${error.message || 'Unknown error'}`);
    }

    const data = await res.json();
    return data.choices[0]?.message?.content || '';
  } catch (error) {
    console.error('OpenRouter API error:', error.message);
    throw new Error(`Failed to connect to OpenRouter: ${error.message}`);
  }
}

/**
 * Extract and parse JSON from text that may contain code blocks or malformed JSON
 * @param {string} text - The text that may contain JSON
 * @return {object|null} - The parsed JSON object or null if parsing fails
 */
function extractJSON(text) {
  if (!text) return null;
  
  // Enable for verbose debugging
  const debug = false;
  
  // Extract content from code blocks if present
  let jsonContent = text;
  
  // Case 1: Extract from triple backticks (```json or just ```)
  const tripleMatch = text.match(/```(?:json)?([\s\S]*?)```/i);
  if (tripleMatch && tripleMatch[1]) {
    jsonContent = tripleMatch[1].trim();
  } 
  // Case 2: Extract from single backticks
  else {
    const singleMatch = text.match(/`([\s\S]*?)`/);
    if (singleMatch && singleMatch[1]) {
      jsonContent = singleMatch[1].trim();
    }
  }
  
  // Try parsing with increasingly aggressive methods
  try {
    // Method 1: Direct parse (for well-formed JSON)
    try {
      return JSON.parse(jsonContent);
    } catch (e) {
      if (debug) console.log('Direct parse failed:', e.message);
    }
    
    // Method 2: Basic cleanup then parse
    try {
      const cleaned = cleanupJSON(jsonContent);
      return JSON.parse(cleaned);
    } catch (e) {
      if (debug) console.log('Basic cleanup parse failed:', e.message);
    }
    
    // Method 3: Deep cleanup then parse
    try {
      const deepCleaned = deepCleanJSON(jsonContent);
      return JSON.parse(deepCleaned);
    } catch (e) {
      if (debug) console.log('Deep cleanup parse failed:', e.message);
    }
    
    // Method 4: Try to extract JSON-like structure and parse
    try {
      // Look for anything that resembles a JSON object
      const jsonPattern = /{[\s\S]*?}/;
      const jsonMatch = text.match(jsonPattern);
      if (jsonMatch) {
        const extracted = deepCleanJSON(jsonMatch[0]);
        return JSON.parse(extracted);
      }
    } catch (e) {
      if (debug) console.log('Pattern extraction failed:', e.message);
    }
    
    // Method 5: Last resort - try eval-based parsing (with safety checks)
    try {
      // Only attempt if the content looks like a safe object literal
      if (/^\s*\{[\s\S]*\}\s*$/.test(jsonContent) && 
          !/(function|eval|setTimeout|setInterval|new\s+Function)/.test(jsonContent)) {
        // Convert to valid JSON first
        const safeJson = jsonContent
          .replace(/([{,]\s*)([a-zA-Z0-9_$]+)\s*:/g, '$1"$2":') // Quote unquoted keys
          .replace(/(?<!\\)'/g, '"') // Replace single quotes with double quotes
          .replace(/,\s*([}\]])/g, '$1'); // Remove trailing commas
        
        return JSON.parse(safeJson);
      }
    } catch (e) {
      if (debug) console.log('Safe eval parse failed:', e.message);
    }
    
    // All methods failed
    return null;
  } catch (error) {
    console.warn('Failed to extract JSON:', error.message);
    return null;
  }
}

/**
 * Helper function to clean up common JSON formatting issues
 */
function cleanupJSON(text) {
  if (!text) return text;
  
  let cleaned = text;
  
  // Remove trailing commas before } or ]
  cleaned = cleaned.replace(/,\s*([}\]])/g, '$1');
  
  // Remove ellipsis placeholders
  cleaned = cleaned.replace(/\.\.\.+/g, '""');
  
  // Fix unquoted property names (more comprehensive)
  cleaned = cleaned.replace(/([{,]\s*)([a-zA-Z0-9_$]+)\s*:/g, '$1"$2":');
  
  // Fix single quotes to double quotes (careful with already escaped quotes)
  cleaned = cleaned.replace(/(?<!\\)'/g, '"');
  
  // Fix array trailing commas
  cleaned = cleaned.replace(/(\[\s*|,\s*)\s*,\s*([\]\}])/g, '$1$2');
  
  // Fix missing commas between array items that are objects
  cleaned = cleaned.replace(/}\s*{/g, '}, {');
  
  // Fix missing commas between array items that are arrays
  cleaned = cleaned.replace(/]\s*\[/g, '], [');
  
  // Fix array syntax in square brackets
  const arrayRegex = /\[([^\[\]]*?)\]/g;
  let match;
  while ((match = arrayRegex.exec(cleaned)) !== null) {
    const arrayContent = match[1];
    if (arrayContent) {
      // Fix missing commas between array items
      const fixedArrayContent = arrayContent
        .replace(/(['"])\s+(['"])/g, '$1, $2') // Fix strings without commas
        .replace(/true\s+(?=[{['"tf])/g, 'true, ') // Fix boolean true without comma
        .replace(/false\s+(?=[{['"tf])/g, 'false, ') // Fix boolean false without comma
        .replace(/(\d+)\s+(?=[{['"tf\d])/g, '$1, '); // Fix numbers without commas
      
      // Replace the array content in the original string
      cleaned = cleaned.replace(`[${arrayContent}]`, `[${fixedArrayContent}]`);
    }
  }
  
  return cleaned;
}

/**
 * More aggressive JSON cleaning for malformed JSON
 * This function attempts to fix severely malformed JSON that the standard cleanup can't handle
 */
function deepCleanJSON(text) {
  if (!text) return text;
  
  // First apply standard cleanup
  let cleaned = cleanupJSON(text);
  
  // Fix arrays with missing brackets
  const fixArrays = (str) => {
    // Look for array-like structures without proper brackets
    return str.replace(/"([a-zA-Z0-9_$]+)"\s*:\s*([^\[{][^,}\]]*?)(?=[,}])/g, (match, key, value) => {
      // If value looks like an array without brackets (e.g., "tags": test json parsing)
      if (value.trim().split(/\s+/).length > 1 && !value.includes('[') && !value.includes('{')) {
        // Convert to proper array format
        const items = value.trim().split(/\s+/).map(item => `"${item.replace(/["']/g, '')}"`).join(', ');
        return `"${key}": [${items}]`;
      }
      return match;
    });
  };
  
  // Apply array fixes
  cleaned = fixArrays(cleaned);
  
  // Fix unbalanced brackets and braces
  const balanceBrackets = (str) => {
    const stack = [];
    let result = str;
    
    // Count opening and closing brackets/braces
    let openBraces = (str.match(/{/g) || []).length;
    let closeBraces = (str.match(/}/g) || []).length;
    let openBrackets = (str.match(/\[/g) || []).length;
    let closeBrackets = (str.match(/\]/g) || []).length;
    
    // Add missing closing braces
    while (openBraces > closeBraces) {
      result += '}';
      closeBraces++;
    }
    
    // Add missing closing brackets
    while (openBrackets > closeBrackets) {
      result += ']';
      closeBrackets++;
    }
    
    // Remove extra closing braces/brackets
    if (closeBraces > openBraces || closeBrackets > openBrackets) {
      // This is trickier - we'd need to parse the structure
      // For now, just return the original if we have too many closing brackets
      return str;
    }
    
    return result;
  };
  
  // Apply bracket balancing
  cleaned = balanceBrackets(cleaned);
  
  return cleaned;
}

module.exports = { chat, extractJSON };


