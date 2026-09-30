const mongoose = require('mongoose');

const vendorApplicationSchema = new mongoose.Schema(
  {
    applicant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    businessName: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    contactEmail: {
      type: String,
      required: true,
    },
    contactNumber: {
      type: String,
      required: true,
    },
    address: {
      type: String,
      default: '',
    },
    petCategories: {
      type: [String],
      default: [],
    },
    upiDetails: {
      upiId: { type: String, default: '' },
      upiName: { type: String, default: '' },
      qrCodeUrl: { type: String, default: '' },
      phonePeNumber: { type: String, default: '' },
      gpayNumber: { type: String, default: '' },
    },
    // Legal & Animal Welfare Verification
    sawbLicenseNumber: { type: String, default: '' }, // State Animal Welfare Board Reg
    petShopLicenseNumber: { type: String, default: '' }, // Municipal Pet Shop Trade License
    govIdType: { type: String, enum: ['aadhaar', 'pan', 'gstin', 'none'], default: 'none' },
    govIdNumber: { type: String, default: '' },
    licenseProofUrl: { type: String, default: '' },
    // Cashfree Bank Account Details for Automated Payouts / Splits
    bankAccountDetails: {
      accountHolder: { type: String, default: '' },
      accountNumber: { type: String, default: '' },
      ifscCode: { type: String, default: '' },
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    reviewNote: {
      type: String,
      default: '',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('VendorApplication', vendorApplicationSchema);
