const mongoose = require('mongoose');
const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);

const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
    if (mongoUri) {
      const conn = await mongoose.connect(mongoUri);
      console.log(`✅ MongoDB connected: ${conn.connection.host}`);
      return;
    }

    // Try connecting to local MongoDB if running
    try {
      const conn = await mongoose.connect('mongodb://127.0.0.1:27017/keralapets', { serverSelectionTimeoutMS: 1500 });
      console.log(`✅ Local MongoDB connected: ${conn.connection.host}`);
      
      // Auto-seed if local MongoDB is running
      try {
        const seedGuppiesAuto = require('../seeds/seedGuppiesAuto');
        await seedGuppiesAuto();
      } catch (seedErr) {
        console.error('Auto-seed error:', seedErr.message);
      }
      return;
    } catch {
      console.log('ℹ️  MongoDB not connected. Server running in standalone API mode with frontend static fallback dataset.');
    }
  } catch (error) {
    console.error(`❌ MongoDB connection error: ${error.message}`);
  }
};

module.exports = connectDB;
