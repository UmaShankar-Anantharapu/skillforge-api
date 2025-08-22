require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const User = require('../models/User');
const UserProfile = require('../models/UserProfile');
const { generateRoadmapForUser } = require('../services/roadmapService');
const Lesson = require('../models/Lesson');
const Challenge = require('../models/Challenge');
const Leaderboard = require('../models/Leaderboard');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/skillforge';

async function run() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    const usersData = [
      { name: 'Alice Example', email: 'alice@example.com', password: 'Password123!' },
      { name: 'Bob Example', email: 'bob@example.com', password: 'Password123!' },
    ];

    for (const data of usersData) {
      let user = await User.findOne({ email: data.email });
      if (!user) {
        const salt = await bcrypt.genSalt(12);
        const passwordHash = await bcrypt.hash(data.password, salt);
        user = await User.create({ name: data.name, email: data.email, passwordHash });
        console.log('Created user:', user.email);
      } else {
        console.log('User exists:', user.email);
      }

      const existingProfile = await UserProfile.findOne({ userId: user._id });
      if (!existingProfile) {
        const profile = await UserProfile.create({
          userId: user._id,
          skill: 'Angular',
          level: 'Beginner',
          dailyTime: 30,
          goal: 'Learn basics and build a small app',
        });
        console.log('Created profile for:', user.email, profile._id.toString());
      } else {
        console.log('Profile exists for:', user.email);
      }

      const roadmap = await generateRoadmapForUser(user._id);
      console.log('Ensured roadmap for:', user.email, roadmap._id.toString());
    }

    // Seed lessons
    const lessons = [
      {
        lessonId: 'angular-1',
        type: 'text',
        content: { title: 'Intro to Angular', body: 'Angular basics, components, and modules.' },
        skill: 'Angular',
        difficulty: 'Beginner',
        concepts: ['Components'],
      },
      {
        lessonId: 'angular-2',
        type: 'quiz',
        content: { question: 'What is a component?', options: ['Class', 'Directive', 'Service'], answer: 0 },
        skill: 'Angular',
        difficulty: 'Beginner',
        concepts: ['Components'],
      },
      {
        lessonId: 'angular-3',
        type: 'text',
        content: { title: 'Services & DI', body: 'Using services, providers, and dependency injection.' },
        skill: 'Angular',
        difficulty: 'Beginner',
        concepts: ['Dependency Injection'],
      },
    ];

    for (const l of lessons) {
      await Lesson.updateOne({ lessonId: l.lessonId }, { $setOnInsert: l }, { upsert: true });
    }
    console.log('Seeded lessons');

    // Seed challenges
    const challenges = [
      { id: 'wk-angular', title: 'Angular Week Sprint', description: 'Complete 7 daily lessons', points: 300, duration: 7 },
      { id: 'wk-leadership', title: 'Leadership Kickoff', description: 'Practice scenarios daily', points: 250, duration: 7 },
    ];
    for (const c of challenges) {
      await Challenge.updateOne({ id: c.id }, { $setOnInsert: c }, { upsert: true });
    }
    console.log('Seeded challenges');

    // Ensure leaderboard rows
    const allUsers = await User.find({});
    for (const u of allUsers) {
      await Leaderboard.updateOne({ userId: u._id }, { $setOnInsert: { points: 0, rank: 0 } }, { upsert: true });
    }
    console.log('Ensured leaderboard entries');

    await mongoose.disconnect();
    console.log('Done');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

run();


