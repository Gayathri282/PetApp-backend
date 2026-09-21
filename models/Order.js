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
    amount: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: ['pending_payment', 'payment_submitted', 'confirmed', 'rejected', 'delivered', 'cancelled'],
      default: 'pending_payment',
      index: true,
    },
    paymentDetails: {
      upiId: { type: String, default: '' },
      utrNumber: { type: String, default: '', index: true },
      paymentScreenshot: { type: String, default: '' },
      submittedAt: { type: Date },
      verifiedAt: { type: Date },
      notes: { type: String, default: '' },
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
