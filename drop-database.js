const mongoose = require('mongoose');
require('dotenv').config();

async function dropDatabase() {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/skillForge';
    console.log('Connecting to MongoDB:', mongoUri);

    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('Connected to MongoDB successfully');

    // Drop the entire database
    await mongoose.connection.db.dropDatabase();
    console.log('✅ Database dropped successfully');

    await mongoose.connection.close();
    console.log('🔌 Database connection closed');

  } catch (error) {
    console.error('❌ Error dropping database:', error);
    process.exit(1);
  }
}

dropDatabase();