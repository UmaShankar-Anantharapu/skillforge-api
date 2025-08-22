const mongoose = require('mongoose');

const roadmapStepSchema = new mongoose.Schema(
  {
    day: { type: Number, required: true },
    topic: { type: String, required: true, trim: true },
    lessonIds: { type: [String], default: [] },
  },
  { _id: false }
);

const roadmapSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
    steps: { type: [roadmapStepSchema], default: [] },
  },
  { timestamps: true, versionKey: false }
);

module.exports = mongoose.model('Roadmap', roadmapSchema);


