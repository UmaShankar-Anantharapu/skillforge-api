const Roadmap = require('../models/Roadmap');
const UserProfile = require('../models/UserProfile');

/**
 * Mock roadmap generation using profile. Later, plug in LLM.
 */
async function generateRoadmapForUser(userId) {
  const profile = await UserProfile.findOne({ userId });
  const baseSkill = profile?.skill || 'General Skill';
  const baseLevel = profile?.level || 'Beginner';
  const durationDays = 7; // MVP: 1 week

  const topics = Array.from({ length: durationDays }, (_, i) => ({
    day: i + 1,
    topic: `${baseSkill}: ${baseLevel} Day ${i + 1}`,
    lessonIds: [`${baseSkill.toLowerCase()}-${i + 1}`],
  }));

  const roadmap = await Roadmap.findOneAndUpdate(
    { userId },
    { steps: topics },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return roadmap;
}

async function getRoadmap(userId) {
  return Roadmap.findOne({ userId });
}

module.exports = { generateRoadmapForUser, getRoadmap };


