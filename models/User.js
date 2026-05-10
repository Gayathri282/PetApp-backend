const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    googleId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    email: {
      type: String,
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
    },
    avatar: {
      type: String,
      default: '',
    },
    contactNumber: {
      type: String,
      default: '',
    },
    role: {
      type: String,
      enum: ['user', 'vendor', 'admin'],
      default: 'user',
    },
    vendorApproved: {
      type: Boolean,
      default: false,
    },
    vendorDetails: {
      businessName: { type: String, default: '' },
      description: { type: String, default: '' },
      contactEmail: { type: String, default: '' },
      contactNumber: { type: String, default: '' },
      address: { type: String, default: '' },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', userSchema);
