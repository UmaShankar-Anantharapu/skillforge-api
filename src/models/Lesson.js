const mongoose = require('mongoose');

const lessonSchema = new mongoose.Schema(
  {
    lessonId: { type: String, required: true, unique: true, index: true },
    type: { type: String, enum: ['text', 'quiz', 'code'], required: true },
    content: { type: mongoose.Schema.Types.Mixed, required: true },
    skill: { type: String, required: true, trim: true },
    difficulty: { type: String, enum: ['Beginner', 'Intermediate', 'Advanced'], required: true },
    concepts: { type: [String], default: [] },
  },
  { timestamps: true, versionKey: false }
);

module.exports = mongoose.model('Lesson', lessonSchema);


