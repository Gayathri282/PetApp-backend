const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema(
  {
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    receiver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    content: {
      type: String,
      default: '',
    },
    image: {
      type: String,
      default: '',
    },
    enquiry: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Enquiry',
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
    },
    read: {
      type: Boolean,
      default: false,
    },
    adminOnlyContent: {
      type: String,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Message', messageSchema);
