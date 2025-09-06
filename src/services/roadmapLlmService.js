const SkillMemoryBank = require('../models/SkillMemoryBank');
const Roadmap = require('../models/Roadmap');
const { chat, extractJSON } = require('./llmClient');
const UserProfile = require('../models/UserProfile');

async function generateRoadmapWithLLM(userId, provider = 'ollama') {
  console.log('generateRoadmapWithLLM: Function entered.');
  try {
    console.log('generateRoadmapWithLLM: Starting roadmap generation for userId:', userId);

    console.log('generateRoadmapWithLLM: Attempting to find user profile for userId:', userId);
    const userProfile = await UserProfile.findOne({ userId });
    if (!userProfile) {
      console.error('generateRoadmapWithLLM: User profile not found for userId:', userId);
      throw new Error(`User profile not found for userId: ${userId}`);
    }
    console.log('generateRoadmapWithLLM: User profile found.');

    console.log('generateRoadmapWithLLM: Attempting to find skill memory bank for userId:', userId);
    const skillMemoryBank = await SkillMemoryBank.findOne({ userId });
    console.log('generateRoadmapWithLLM: Skill memory bank found or not found (null if not found).');

    const prompt = buildEnhancedPrompt(userProfile, skillMemoryBank);
    console.log('generateRoadmapWithLLM: Prompt built.');

    let llmResponse;
    try {
      llmResponse = await chat(prompt, provider);
      console.log('generateRoadmapWithLLM: LLM chat response received.');
    } catch (llmError) {
      console.error('generateRoadmapWithLLM: LLM chat error:', llmError);
      console.error('generateRoadmapWithLLM: LLM chat error stringified:', JSON.stringify(llmError));
      throw new Error(`Failed to get response from LLM: ${llmError.message}`);
    }

    let roadmapData;
    try {
      roadmapData = extractJSON(llmResponse);
      console.log('generateRoadmapWithLLM: JSON extracted from LLM response.');
    } catch (jsonError) {
      console.error('generateRoadmapWithLLM: JSON extraction error:', jsonError);
      throw new Error(`Failed to parse roadmap JSON from LLM response: ${jsonError.message}`);
    }

    if (!roadmapData || !roadmapData.steps || !Array.isArray(roadmapData.steps)) {
      console.error('generateRoadmapWithLLM: Invalid roadmap data structure received from LLM:', JSON.stringify(roadmapData));
      throw new Error('Invalid roadmap data structure received from LLM.');
    }
    console.log('generateRoadmapWithLLM: Roadmap data structure validated.');

    const roadmap = new Roadmap({
      userId,
      skill: userProfile.skill,
      level: userProfile.level,
      goal: userProfile.goal,
      dailyTime: userProfile.dailyTime,
      steps: roadmapData.steps,
      generatedAt: new Date(),
    });

    console.log('generateRoadmapWithLLM: Attempting to save roadmap to DB.');
    await roadmap.save();
    console.log('generateRoadmapWithLLM: Roadmap saved to DB.');

    return roadmap;
  } catch (error) {
    console.error('generateRoadmapWithLLM: Top-level error:', error);
    console.error('generateRoadmapWithLLM: Top-level error stack:', error.stack);
    throw error;
  }
}

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

Generate complete JSON with days 1-7:`
}


module.exports = {
  generateRoadmapWithLLM,
  buildPrompt,
  buildEnhancedPrompt
};


