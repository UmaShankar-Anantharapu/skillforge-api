const mongoose = require('mongoose');

const challengeSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    points: { type: Number, default: 100 },
    duration: { type: Number, default: 7 }, // days
    participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  },
  { timestamps: true, versionKey: false }
);

module.exports = mongoose.model('Challenge', challengeSchema);


