const mongoose = require('mongoose');
require('dotenv').config();

// Import models to ensure they're registered
const UserProfile = require('./src/models/UserProfile');
const Roadmap = require('./src/models/Roadmap');

async function clearCollections() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/skillforge';
    console.log('Connecting to MongoDB:', mongoUri);

    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('Connected to MongoDB successfully');

    // List all collections to clear
    const collectionsToClean = [
      'userprofiles',
      'roadmaps',
      'skillmemorybanks', // Clear this too for fresh start
    ];

    console.log('\n🧹 Starting collection cleanup...\n');

    for (const collectionName of collectionsToClean) {
      try {
        const collection = mongoose.connection.db.collection(collectionName);
        const count = await collection.countDocuments();

        if (count > 0) {
          console.log(`📊 Found ${count} documents in ${collectionName}`);
          await collection.deleteMany({});
          console.log(`✅ Cleared ${collectionName} collection`);
        } else {
          console.log(`📭 Collection ${collectionName} is already empty`);
        }
      } catch (error) {
        if (error.message.includes('ns not found')) {
          console.log(`📭 Collection ${collectionName} doesn't exist yet`);
        } else {
          console.error(`❌ Error clearing ${collectionName}:`, error.message);
        }
      }
    }

    console.log('\n🎉 Collection cleanup completed successfully!');
    console.log('\n📋 Summary:');
    console.log('- UserProfile collection: Ready for new schema');
    console.log('- Roadmap collection: Ready for enhanced structure');
    console.log('- SkillMemoryBank collection: Cleared for fresh start');

    console.log('\n🚀 You can now start the server and begin testing the new onboarding flow');

  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Database connection closed');
    process.exit(0);
  }
}

// Run the cleanup
if (require.main === module) {
  console.log('🧹 SkillForge Database Collection Cleanup');
  console.log('==========================================');
  console.log('This script will clear existing collections to prepare for the new schema');
  console.log('⚠️  WARNING: This will delete all existing user profiles and roadmaps!');
  console.log('');

  // Add a small delay to let user read the warning
  setTimeout(() => {
    clearCollections();
  }, 2000);
}

module.exports = clearCollections;