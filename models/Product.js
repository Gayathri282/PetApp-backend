const mongoose = require('mongoose');

const reelSchema = new mongoose.Schema({
  videoUrl: { type: String, required: true },
  thumbnail: { type: String, default: '' },
  order: { type: Number, default: 0 },
});

const productSchema = new mongoose.Schema(
  {
    vendor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      default: '',
    },
    category: {
      type: String,
      default: 'other',
    },
    tags: {
      type: [String],
      default: [],
      index: true,
    },
    price: {
      type: Number,
      default: 0,
    },
    isOnSale: {
      type: Boolean,
      default: false,
    },
    status: { 
      type: String, 
      enum: ['pending', 'approved', 'rejected'], 
      default: 'pending' 
    },
    deliveryChargesAdditional: {
      type: Boolean,
      default: false,
    },
    reels: [reelSchema],
    images: {
      type: [String],
      default: [],
    },
    likeCount: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

// Text index for search
productSchema.index({ name: 'text', description: 'text' });

// Performance indexes
productSchema.index({ createdAt: -1 });               // Feed sorting
productSchema.index({ vendor: 1 });                    // Vendor lookups
productSchema.index({ isOnSale: 1 });                  // Sale filtering
productSchema.index({ createdAt: -1, isOnSale: 1 });  // Combined feed + sale

module.exports = mongoose.model('Product', productSchema);
