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
    status: {
      type: String,
      enum: ['active', 'suspended'],
      default: 'active',
    },
    isSuspended: {
      type: Boolean,
      default: false,
    },
    vendorDetails: {
      businessName: { type: String, default: '' },
      description: { type: String, default: '' },
      contactEmail: { type: String, default: '' },
      contactNumber: { type: String, default: '' },
      address: { type: String, default: '' },
      petCategories: { type: [String], default: [] },
      upiDetails: {
        upiId: { type: String, default: '' },
        upiName: { type: String, default: '' },
        qrCodeUrl: { type: String, default: '' },
        phonePeNumber: { type: String, default: '' },
        gpayNumber: { type: String, default: '' },
      },
      shippingDetails: {
        shippingType: {
          type: String,
          enum: ['free', 'flat', 'variable', 'unconfigured'],
          default: 'unconfigured',
        },
        flatRate: { type: Number, default: 0 },
        notes: { type: String, default: '' },
      },
    },
    location: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], default: [0, 0] }, // [longitude, latitude]
    },
    address: { type: String, default: '' },
    // Interest weights for personalized feed: { tagName: score (0-100) }
    interests: {
      type: Map,
      of: Number,
      default: {},
    },
  },
  { timestamps: true }
);

userSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('User', userSchema);
