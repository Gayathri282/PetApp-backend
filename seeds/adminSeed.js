require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);

const seedAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const adminGoogleId = process.env.ADMIN_GOOGLE_ID;
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@furreel.com';
    const adminName = process.env.ADMIN_NAME || 'FurReel Admin';

    if (!adminGoogleId) {
      console.log('⚠️  ADMIN_GOOGLE_ID not set in .env — creating placeholder admin.');
      console.log('   Set ADMIN_GOOGLE_ID to your Google account ID and re-run.');
    }

    const existing = await User.findOne({
      $or: [
        { googleId: adminGoogleId || 'admin-placeholder' },
        { email: adminEmail },
      ],
    });

    if (existing) {
      if (existing.role !== 'admin') {
        existing.role = 'admin';
        await existing.save();
        console.log(`✅ Updated ${existing.name} to admin role`);
      } else {
        console.log(`ℹ️  Admin already exists: ${existing.name} (${existing.email})`);
      }
    } else {
      await User.create({
        googleId: adminGoogleId || 'admin-placeholder',
        email: adminEmail,
        name: adminName,
        avatar: '',
        role: 'admin',
        vendorApproved: false,
      });
      console.log(`✅ Admin user created: ${adminName} (${adminEmail})`);
    }

    await mongoose.disconnect();
    console.log('Done.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Seed error:', error.message);
    process.exit(1);
  }
};

seedAdmin();
