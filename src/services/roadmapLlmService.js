const UserProfile = require('../models/UserProfile');
const SkillMemoryBank = require('../models/SkillMemoryBank');
const Roadmap = require('../models/Roadmap');
const fs = require('fs');
const path = require('path');
const { chat, extractJSON } = require('./llmClient');
const { generateComprehensiveRoadmap } = require('./researchAgentService');

function buildPrompt(profile, bank) {
  const weak = (bank?.concepts || [])
    .filter((c) => c.strengthLevel < 50)
    .map((c) => `${c.topic} (${c.strengthLevel})`)
    .slice(0, 5);
  return `You are an expert learning planner. Create a 7-day microlearning roadmap as JSON.
Profile: skill=${profile?.skill}, level=${profile?.level}, dailyTime=${profile?.dailyTime} minutes, goal=${profile?.goal}.
Weak topics: ${weak.join(', ') || 'None'}.
Return strictly JSON with shape: { "steps": [ { "day": number, "topic": string, "lessonIds": string[], "concepts": string[] } ] }.
Topics should be concise and practical. Concepts array lists 1-2 key ideas.
`;
}

function buildEnhancedPrompt(profile, bank) {
  const weak = (bank?.concepts || [])
    .filter((c) => c.strengthLevel < 50)
    .map((c) => `${c.topic} (${c.strengthLevel})`)
    .slice(0, 5);
  
  const profileDetails = {
    skill: profile?.skill || 'General Programming',
    level: profile?.level || 'beginner',
    dailyTime: profile?.dailyTime || 30,
    goal: profile?.goal || profile?.learningGoal || 'Improve skills',
    occupation: profile?.occupation || 'Student',
    experience: profile?.yearsOfExperience || 0,
    interests: profile?.interests || [],
    preferredLearningStyle: profile?.learningPreferences?.preferredStyle || 'mixed'
  };

  return `Generate complete JSON roadmap for ${profileDetails.skill} (${profileDetails.level} level, ${profileDetails.dailyTime} min/day).

MUST include ALL 7 days. NO placeholders, NO "...", NO incomplete responses.

{
  "steps": [
    {
      "day": 1,
      "topic": "Day 1 Topic",
      "description": "Brief description",
      "concepts": ["concept1", "concept2"],
      "lessonIds": [],
      "estimatedMinutes": ${profileDetails.dailyTime},
      "difficulty": "${profileDetails.level}"
    },
    {
      "day": 2,
      "topic": "Day 2 Topic",
      "description": "Brief description",
      "concepts": ["concept3", "concept4"],
      "lessonIds": [],
      "estimatedMinutes": ${profileDetails.dailyTime},
      "difficulty": "${profileDetails.level}"
    }
  ]
}

Generate complete JSON with days 1-7:`;
}

async function generateRoadmapWithLLM(userId, useResearchAgent = false, provider = 'ollama') {
  const profile = await UserProfile.findOne({ userId }).lean();
  fs.appendFileSync('/Users/kmounika/Desktop/SkillForge/skillforge-api/roadmap_debug.log', `Debug: User Profile: ${JSON.stringify(profile)}\n`);
  const bank = await SkillMemoryBank.findOne({ userId }).lean();
  fs.appendFileSync('/Users/kmounika/Desktop/SkillForge/skillforge-api/roadmap_debug.log', `Debug: Skill Memory Bank: ${JSON.stringify(bank)}\n`);
  
  if (useResearchAgent && profile?.skill) {
    try {
      // Use research agent for enhanced roadmap generation
      const comprehensiveRoadmap = await generateComprehensiveRoadmap(profile.skill, {
        level: profile.level || 'beginner',
        timeframe: '4-weeks',
        dailyTimeMinutes: profile.dailyTime || 30,
        focus: 'practical',
        includeProjects: true
      });
      
      // Convert comprehensive roadmap to our format
      const steps = comprehensiveRoadmap.roadmap.steps?.slice(0, 7).map((s, i) => ({
        day: Number(s.day ?? i + 1),
        topic: String(s.title ?? s.topic ?? `Day ${i + 1}`),
        lessonIds: [],
        concepts: Array.isArray(s.concepts) ? s.concepts.map(String) : [],
        description: s.description || '',
        resources: s.resources || [],
        type: s.type || 'theory',
        duration: s.duration || '5 minutes'
      })) || [];

      const roadmap = await Roadmap.findOneAndUpdate(
        { userId },
        { 
          steps,
          metadata: {
            generatedWith: 'research-agent',
            sources: comprehensiveRoadmap.sources?.slice(0, 5) || [],
            generatedAt: new Date()
          }
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      return roadmap;
      
    } catch (error) {
      console.error('Research agent roadmap generation failed, falling back to basic LLM:', error.message);
      // Fall back to basic LLM generation
    }
  }
  
  // Enhanced LLM generation with profile-based customization
  const prompt = buildEnhancedPrompt(profile, bank);
  fs.appendFileSync('/Users/kmounika/Desktop/SkillForge/skillforge-api/roadmap_debug.log', `Debug: Sending prompt to LLM: ${prompt}\n`);
  const reply = await chat([{ role: 'user', content: prompt }], provider);
  fs.appendFileSync('/Users/kmounika/Desktop/SkillForge/skillforge-api/roadmap_debug.log', `Debug: LLM raw response: ${reply}\n`);
  const json = extractJSON(reply);
  fs.appendFileSync('/Users/kmounika/Desktop/SkillForge/skillforge-api/roadmap_debug.log', `Debug: Extracted JSON: ${JSON.stringify(json)}\n`);
  if (!json?.steps || !Array.isArray(json.steps)) {
    fs.appendFileSync('/Users/kmounika/Desktop/SkillForge/skillforge-api/roadmap_debug.log', `Error: Invalid LLM response structure: ${JSON.stringify(json)}\n`);
    console.error('Invalid LLM response structure:', json);
    throw new Error(`LLM did not return steps. Got: ${JSON.stringify(json)}`);
  }
  
  // Normalize and enhance steps with profile data
  const steps = json.steps.slice(0, 7).map((s, i) => ({
    day: Number(s.day ?? i + 1),
    topic: String(s.topic ?? `Day ${i + 1}`),
    lessonIds: Array.isArray(s.lessonIds) ? s.lessonIds.map(String) : [],
    concepts: Array.isArray(s.concepts) ? s.concepts.map(String) : [],
    description: s.description || '',
    estimatedMinutes: s.estimatedMinutes || profile?.dailyTime || 30,
    difficulty: s.difficulty || profile?.level || 'beginner'
  }));

  const roadmap = await Roadmap.findOneAndUpdate(
    { userId },
    { 
      steps,
      metadata: {
        generatedWith: `${provider}-llm`,
        model: provider === 'ollama' ? 'phi3:mini' : 'openrouter',
        profileBased: true,
        generatedAt: new Date()
      }
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  return roadmap;
}

module.exports = { generateRoadmapWithLLM };


