require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);

const seedAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const adminsToSeed = [
      {
        googleId: process.env.ADMIN_GOOGLE_ID || 'admin-primary-id',
        email: (process.env.ADMIN_EMAIL || 'admin@keralapets.com').toLowerCase(),
        name: process.env.ADMIN_NAME || 'Primary Admin',
      },
      {
        googleId: process.env.ADMIN_GOOGLE_ID_2 || 'admin-secondary-id',
        email: (process.env.ADMIN_EMAIL_2 || 'admin2@keralapets.com').toLowerCase(),
        name: 'Secondary Admin',
      },
    ];

    for (const adminData of adminsToSeed) {
      const existing = await User.findOne({
        $or: [
          { googleId: adminData.googleId },
          { email: adminData.email },
        ],
      });

      if (existing) {
        if (existing.role !== 'admin') {
          existing.role = 'admin';
          await existing.save();
          console.log(`✅ Updated ${existing.name} (${existing.email}) to admin role`);
        } else {
          console.log(`ℹ️  Admin already exists: ${existing.name} (${existing.email})`);
        }
      } else {
        await User.create({
          googleId: adminData.googleId,
          email: adminData.email,
          name: adminData.name,
          avatar: '',
          role: 'admin',
          vendorApproved: false,
        });
        console.log(`✅ Admin user created: ${adminData.name} (${adminData.email})`);
      }
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
