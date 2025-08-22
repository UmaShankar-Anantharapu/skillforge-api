const { chat, extractJSON } = require('./llmClient');
const Lesson = require('../models/Lesson');
const Roadmap = require('../models/Roadmap');

function buildLessonPrompt({ topic, skill, difficulty }) {
  return `Generate a micro-lesson as JSON with fields:
{
  "lessonId": string (kebab-case, short),
  "type": "text" | "quiz",
  "content": object (if text: {title, body}; if quiz: {question, options: string[], answer: index}),
  "skill": string,
  "difficulty": "Beginner"|"Intermediate"|"Advanced",
  "concepts": string[] (1-2 items)
}
Constraints: Keep it concise, beginner-friendly if not sure. Topic=${topic}, skill=${skill}, difficulty=${difficulty}.
Return strictly JSON only.`;
}

async function generateLesson({ userId, topic, skill, difficulty, day }) {
  const prompt = buildLessonPrompt({ topic, skill, difficulty });
  const text = await chat([{ role: 'user', content: prompt }]);
  const json = extractJSON(text);
  if (!json?.lessonId || !json?.type || !json?.content) throw new Error('Invalid lesson JSON');
  const lessonDoc = await Lesson.findOneAndUpdate(
    { lessonId: String(json.lessonId) },
    {
      lessonId: String(json.lessonId),
      type: json.type === 'quiz' ? 'quiz' : 'text',
      content: json.content,
      skill: String(json.skill || skill || topic),
      difficulty: ['Beginner', 'Intermediate', 'Advanced'].includes(json.difficulty) ? json.difficulty : (difficulty || 'Beginner'),
      concepts: Array.isArray(json.concepts) ? json.concepts.map(String) : [],
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  if (userId && day) {
    await Roadmap.updateOne(
      { userId, 'steps.day': day },
      { $addToSet: { 'steps.$.lessonIds': lessonDoc.lessonId } }
    );
  }

  return lessonDoc;
}

module.exports = { generateLesson };


