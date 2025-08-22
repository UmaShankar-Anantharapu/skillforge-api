const Progress = require('../models/Progress');
const SkillMemoryBank = require('../models/SkillMemoryBank');

async function getUserStats(userId) {
  const progress = await Progress.find({ userId }).lean();
  const completed = progress.filter((p) => p.status === 'completed').length;
  const total = progress.length || 1;
  const completionRate = Math.round((completed / total) * 100);

  const bank = await SkillMemoryBank.findOne({ userId }).lean();
  const weakTopics = (bank?.concepts || [])
    .filter((c) => c.strengthLevel < 50)
    .sort((a, b) => a.strengthLevel - b.strengthLevel)
    .slice(0, 5)
    .map((c) => ({ topic: c.topic, strength: c.strengthLevel }));

  return { completed, total, completionRate, weakTopics };
}

module.exports = { getUserStats };


