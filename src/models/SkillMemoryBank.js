const mongoose = require('mongoose');

const conceptSchema = new mongoose.Schema(
  {
    topic: { type: String, required: true },
    strengthLevel: { type: Number, default: 50, min: 0, max: 100 },
  },
  { _id: false }
);

const skillMemoryBankSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
    concepts: { type: [conceptSchema], default: [] },
  },
  { timestamps: true, versionKey: false }
);

module.exports = mongoose.model('SkillMemoryBank', skillMemoryBankSchema);


