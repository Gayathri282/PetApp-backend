const mongoose = require('mongoose');

const enquirySchema = new mongoose.Schema(
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
    message: {
      type: String,
      default: '',
    },
    status: {
      type: String,
      enum: ['pending', 'resolved'],
      default: 'pending',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Enquiry', enquirySchema);
