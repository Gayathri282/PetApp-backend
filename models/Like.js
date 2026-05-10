const mongoose = require('mongoose');

const likeSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    reelIndex: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

// One like per user per reel
likeSchema.index({ user: 1, product: 1, reelIndex: 1 }, { unique: true });

module.exports = mongoose.model('Like', likeSchema);
