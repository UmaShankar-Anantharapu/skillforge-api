const mongoose = require('mongoose');
const Roadmap = require('../models/Roadmap');

// Sample AI/ML roadmap data
const aiMlRoadmap = {
  userId: new mongoose.Types.ObjectId('000000000000000000000001'), // Dummy user ID
  profileId: new mongoose.Types.ObjectId('000000000000000000000001'), // Dummy profile ID
  title: 'Complete AI/ML Learning Path',
  description: 'ai-ml-roadmap',
  estimatedDuration: '6 months',
  difficultyLevel: 'Intermediate',
  category: 'Artificial Intelligence',
  tags: ['ai', 'machine-learning', 'python', 'data-science', 'deep-learning'],
  isPublic: true, // Make it public so it can be found by the API
  status: 'active',
  
  milestones: [
    {
      id: 'milestone_1',
      title: 'Python & Math Foundations',
      description: 'Master Python programming and essential mathematics for AI/ML',
      estimatedWeeks: 4,
      skills: ['Python Programming', 'Linear Algebra', 'Statistics', 'NumPy', 'Pandas'],
      completed: false,
      order: 1
    },
    {
      id: 'milestone_2',
      title: 'Machine Learning Fundamentals',
      description: 'Learn core ML algorithms and concepts',
      estimatedWeeks: 6,
      skills: ['Supervised Learning', 'Unsupervised Learning', 'Model Evaluation', 'Scikit-learn'],
      completed: false,
      order: 2
    },
    {
      id: 'milestone_3',
      title: 'Deep Learning & Neural Networks',
      description: 'Dive into deep learning with TensorFlow and PyTorch',
      estimatedWeeks: 8,
      skills: ['Neural Networks', 'TensorFlow', 'PyTorch', 'CNN', 'RNN'],
      completed: false,
      order: 3
    },
    {
      id: 'milestone_4',
      title: 'Advanced AI Applications',
      description: 'Build real-world AI applications and projects',
      estimatedWeeks: 6,
      skills: ['Computer Vision', 'NLP', 'MLOps', 'Model Deployment'],
      completed: false,
      order: 4
    }
  ],
  
  steps: [
    {
      day: 1,
      week: 1,
      milestoneId: 'milestone_1',
      title: 'Python Basics Setup',
      description: 'Set up Python environment and learn basic syntax',
      type: 'theory',
      estimatedMinutes: 120,
      skills: ['Python Programming'],
      resources: [
        {
          type: 'tutorial',
          title: 'Python for Beginners',
          url: 'https://python.org/tutorial',
          description: 'Official Python tutorial',
          duration: '2 hours',
          difficulty: 'Beginner',
          isFree: true
        }
      ],
      prerequisites: [],
      learningObjectives: ['Install Python', 'Understand basic syntax', 'Write first Python program'],
      completed: false,
      difficulty: 'Easy',
      order: 1
    },
    {
      day: 2,
      week: 1,
      milestoneId: 'milestone_1',
      title: 'Data Structures in Python',
      description: 'Learn lists, dictionaries, sets, and tuples',
      type: 'practice',
      estimatedMinutes: 90,
      skills: ['Python Programming', 'Data Structures'],
      resources: [
        {
          type: 'article',
          title: 'Python Data Structures Guide',
          url: 'https://docs.python.org/3/tutorial/datastructures.html',
          description: 'Comprehensive guide to Python data structures',
          duration: '1.5 hours',
          difficulty: 'Beginner',
          isFree: true
        }
      ],
      prerequisites: ['Python Basics Setup'],
      learningObjectives: ['Master Python data structures', 'Practice with exercises'],
      completed: false,
      difficulty: 'Medium',
      order: 2
    }
  ],
  
  generationMetadata: {
    generatedWith: 'manual',
    prompt: 'Sample AI/ML roadmap for testing',
    sources: ['Educational best practices'],
    generatedAt: new Date(),
    version: '1.0',
    modelUsed: 'manual-creation',
    confidence: 1.0
  },
  
  progress: {
    completedSteps: 0,
    totalSteps: 2,
    completedMilestones: 0,
    totalMilestones: 4,
    percentageComplete: 0,
    currentStep: 1,
    currentMilestone: 'Python & Math Foundations',
    estimatedCompletionDate: new Date(Date.now() + 6 * 30 * 24 * 60 * 60 * 1000), // 6 months from now
    actualStartDate: new Date(),
    streakDays: 0,
    totalTimeSpent: 0
  }
};

async function seedSampleRoadmaps() {
  try {
    // Connect to MongoDB
    await mongoose.connect('mongodb://127.0.0.1:27017/skillforge');
    console.log('Connected to MongoDB');
    
    // Check if roadmap already exists
    const existingRoadmap = await Roadmap.findOne({ description: 'ai-ml-roadmap', isPublic: true });
    
    if (existingRoadmap) {
      console.log('AI/ML roadmap already exists:', existingRoadmap._id);
    } else {
      // Create the roadmap
      const roadmap = new Roadmap(aiMlRoadmap);
      await roadmap.save();
      console.log('Sample AI/ML roadmap created successfully:', roadmap._id);
    }
    
    // List all public roadmaps
    const publicRoadmaps = await Roadmap.find({ isPublic: true }, { title: 1, description: 1, isPublic: 1 });
    console.log('Public roadmaps in database:', publicRoadmaps);
    
  } catch (error) {
    console.error('Error seeding roadmaps:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Run the seed function if this file is executed directly
if (require.main === module) {
  seedSampleRoadmaps();
}

module.exports = { seedSampleRoadmaps, aiMlRoadmap };