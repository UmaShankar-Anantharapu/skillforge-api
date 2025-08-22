const mongoose = require('mongoose');

const userBadgeSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    badgeId: { type: String, required: true },
    name: { type: String, required: true },
    description: { type: String },
    earnedAt: { type: Date, default: Date.now },
  },
  { versionKey: false }
);

userBadgeSchema.index({ userId: 1, badgeId: 1 }, { unique: true });

module.exports = mongoose.model('UserBadge', userBadgeSchema);


