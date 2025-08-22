const UserProfile = require('../models/UserProfile');
const SkillMemoryBank = require('../models/SkillMemoryBank');
const Roadmap = require('../models/Roadmap');
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

async function generateRoadmapWithLLM(userId, useResearchAgent = false) {
  const profile = await UserProfile.findOne({ userId }).lean();
  const bank = await SkillMemoryBank.findOne({ userId }).lean();
  
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
  
  // Original LLM-only generation
  const prompt = buildPrompt(profile, bank);
  const reply = await chat([{ role: 'user', content: prompt }]);
  const json = extractJSON(reply);
  if (!json?.steps || !Array.isArray(json.steps)) throw new Error('LLM did not return steps');
  // Normalize
  const steps = json.steps.slice(0, 7).map((s, i) => ({
    day: Number(s.day ?? i + 1),
    topic: String(s.topic ?? `Day ${i + 1}`),
    lessonIds: Array.isArray(s.lessonIds) ? s.lessonIds.map(String) : [],
    concepts: Array.isArray(s.concepts) ? s.concepts.map(String) : [],
  }));

  const roadmap = await Roadmap.findOneAndUpdate(
    { userId },
    { 
      steps,
      metadata: {
        generatedWith: 'basic-llm',
        generatedAt: new Date()
      }
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  return roadmap;
}

module.exports = { generateRoadmapWithLLM };


