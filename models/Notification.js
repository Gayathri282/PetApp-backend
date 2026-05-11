const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: ['like', 'enquiry', 'system'], required: true },
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    reelIndex: { type: Number },
    message: { type: String },
    read: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Notification', notificationSchema);
