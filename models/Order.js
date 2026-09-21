const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema(
  {
    buyer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    vendor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      index: true,
    },
    productSnapshot: {
      name: { type: String, required: true },
      price: { type: Number, required: true },
      image: { type: String, default: '' },
    },
    vendorSnapshot: {
      name: { type: String, default: '' },
      upiId: { type: String, default: '' },
      upiName: { type: String, default: '' },
    },
    productPrice: {
      type: Number,
      required: true,
    },
    shippingCharge: {
      type: Number,
      default: 0,
    },
    totalAmount: {
      type: Number,
      required: true,
    },
    transactionId: {
      type: String,
      default: '',
      index: true,
    },
    paymentMethod: {
      type: String,
      default: 'UPI',
    },
    paymentStatus: {
      type: String,
      enum: ['pending_verification', 'verified', 'declined'],
      default: 'pending_verification',
      index: true,
    },
    orderStatus: {
      type: String,
      enum: ['payment_pending', 'processing', 'shipped', 'delivered', 'cancelled'],
      default: 'payment_pending',
      index: true,
    },
    declineReason: {
      type: String,
      default: '',
    },
    shippingType: {
      type: String,
      enum: ['free', 'flat', 'variable', 'unconfigured'],
      default: 'unconfigured',
    },
    shippingAddress: {
      fullName: { type: String, default: '' },
      phone: { type: String, default: '' },
      address: { type: String, default: '' },
      city: { type: String, default: '' },
      pincode: { type: String, default: '' },
    },
    vendorNotes: { type: String, default: '' },
  },
  { timestamps: true }
);

orderSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Order', orderSchema);
