const Roadmap = require('../models/Roadmap');
const SkillMemoryBank = require('../models/SkillMemoryBank');

async function updateRoadmapForWeakAreas(userId) {
  const bank = await SkillMemoryBank.findOne({ userId });
  const roadmap = await Roadmap.findOne({ userId });
  if (!roadmap) return null;

  const weakTopics = (bank?.concepts || [])
    .filter((c) => c.strengthLevel < 50)
    .map((c) => c.topic);

  if (weakTopics.length === 0) return roadmap;

  // Simple heuristic: prepend a review day for the weakest topic
  const weakest = (bank?.concepts || []).sort((a, b) => a.strengthLevel - b.strengthLevel)[0];
  if (!weakest) return roadmap;

  const reviewStep = {
    day: 0,
    topic: `Review ${weakest.topic}`,
    lessonIds: [`${weakest.topic.toLowerCase()}-review`],
  };

  // Ensure not duplicating
  const exists = roadmap.steps.some((s) => s.topic === reviewStep.topic);
  if (!exists) {
    // Shift day numbers and insert review at front
    const shifted = roadmap.steps.map((s) => ({ ...s, day: s.day + 1 }));
    roadmap.steps = [ { ...reviewStep, day: 1 }, ...shifted ];
    await roadmap.save();
  }

  return roadmap;
}

async function getRecommendations(userId) {
  const bank = await SkillMemoryBank.findOne({ userId });
  if (!bank) return [];
  const weak = bank.concepts.filter((c) => c.strengthLevel < 50).sort((a,b)=>a.strengthLevel-b.strengthLevel);
  return weak.slice(0, 3).map((c) => ({ message: `Review ${c.topic} soon`, topic: c.topic }));
}

module.exports = { updateRoadmapForWeakAreas, getRecommendations };


