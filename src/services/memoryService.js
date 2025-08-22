const SkillMemoryBank = require('../models/SkillMemoryBank');

function calculateDeltaFromScore(score) {
  if (typeof score !== 'number') return 0;
  if (score >= 90) return 12;
  if (score >= 80) return 8;
  if (score >= 60) return 4;
  return -10;
}

async function updateMemoryFromScore(userId, topic, score) {
  const delta = calculateDeltaFromScore(score);
  if (delta === 0) return null;

  const bank = await SkillMemoryBank.findOneAndUpdate(
    { userId },
    { $setOnInsert: { concepts: [] } },
    { upsert: true, new: true }
  );

  const concept = bank.concepts.find((c) => c.topic === topic);
  if (concept) {
    concept.strengthLevel = Math.max(0, Math.min(100, concept.strengthLevel + delta));
  } else {
    bank.concepts.push({ topic, strengthLevel: Math.max(0, Math.min(100, 50 + delta)) });
  }
  await bank.save();
  return bank;
}

module.exports = { updateMemoryFromScore };


