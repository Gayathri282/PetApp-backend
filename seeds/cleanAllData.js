require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');

const User = require('../models/User');
const Product = require('../models/Product');
const VendorApplication = require('../models/VendorApplication');
const Enquiry = require('../models/Enquiry');
const Like = require('../models/Like');
const Message = require('../models/Message');
const Notification = require('../models/Notification');
const Order = require('../models/Order');

const cleanDatabase = async () => {
  try {
    console.log('Connecting to MongoDB...');
    await connectDB();
    console.log('Connected to MongoDB successfully.');

    // 1. Delete all dummy products, reels, enquiries, orders, messages, notifications, likes, applications
    console.log('Cleaning dummy collections...');
    const deletedProducts = await Product.deleteMany({});
    const deletedApps = await VendorApplication.deleteMany({});
    const deletedEnquiries = await Enquiry.deleteMany({});
    const deletedLikes = await Like.deleteMany({});
    const deletedMessages = await Message.deleteMany({});
    const deletedNotifications = await Notification.deleteMany({});
    const deletedOrders = await Order.deleteMany({});

    console.log(`🧹 Deleted ${deletedProducts.deletedCount} products/reels`);
    console.log(`🧹 Deleted ${deletedApps.deletedCount} vendor applications`);
    console.log(`🧹 Deleted ${deletedEnquiries.deletedCount} enquiries`);
    console.log(`🧹 Deleted ${deletedLikes.deletedCount} likes`);
    console.log(`🧹 Deleted ${deletedMessages.deletedCount} messages`);
    console.log(`🧹 Deleted ${deletedNotifications.deletedCount} notifications`);
    console.log(`🧹 Deleted ${deletedOrders.deletedCount} orders`);

    // 2. Manage Users & Ensure Admin role for active users / create admin
    console.log('\nChecking users in database...');
    let users = await User.find();

    if (users.length === 0) {
      console.log('No users found. Creating default admin account...');
      const adminEmail = process.env.ADMIN_EMAIL || 'admin@keralapets.com';
      const defaultAdmin = await User.create({
        googleId: 'admin-default-id',
        email: adminEmail,
        name: 'Kerala Pets Admin',
        role: 'admin',
        status: 'active',
      });
      users = [defaultAdmin];
    } else {
      // Ensure existing users are upgraded to admin role if requested or keep active user as admin
      console.log('Setting all existing registered accounts to Admin role for full management access...');
      for (const user of users) {
        user.role = 'admin';
        user.isSuspended = false;
        user.status = 'active';
        await user.save();
        console.log(`👑 Granted Admin role to: ${user.name} (${user.email}) [ID: ${user._id}]`);
      }
    }

    console.log('\n==================================================');
    console.log('   🎉 CLEAN DATABASE & ADMIN CREDENTIALS DETAILS');
    console.log('==================================================');
    console.log('All dummy data, products, reels, and test applications have been completely cleared.\n');
    console.log('🔑 HOW ADMIN LOGIN WORKS:');
    console.log('This app uses Google OAuth for 1-Click Secure Login.\n');
    console.log('To login as Admin:');
    console.log('1. Go to the website / Login page');
    console.log('2. Click "Continue with Google" and sign in with any of your registered Google Emails below:');
    users.forEach((u, i) => {
      console.log(`   Admin #${i + 1}: ${u.email} (Name: ${u.name}, Role: ${u.role.toUpperCase()})`);
    });
    console.log('\nOnce logged in with Google, you will immediately see the "Admin Panel" button in the Profile page.');
    console.log('==================================================\n');

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Clean database error:', error);
    process.exit(1);
  }
};

cleanDatabase();
