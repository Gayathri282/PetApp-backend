const Razorpay = require('razorpay');

let razorpayInstance = null;

function getRazorpayInstance() {
  if (!razorpayInstance) {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keyId || !keySecret || keyId.includes('your_razorpay')) {
      console.warn('⚠️ Razorpay credentials not configured in environment variables');
      return null;
    }

    razorpayInstance = new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    });
  }
  return razorpayInstance;
}

/**
 * Creates a Razorpay Route Linked Account for a vendor.
 * @param {Object} vendorUser - User model instance
 * @param {Object} bankDetails - { bankAccountHolder, bankAccountNumber, ifscCode, email, phone }
 */
async function createVendorLinkedAccount(vendorUser, bankDetails) {
  const rzp = getRazorpayInstance();
  if (!rzp) throw new Error('Razorpay client is not initialized. Please set RAZORPAY_KEY_ID & RAZORPAY_KEY_SECRET in backend .env');

  const account = await rzp.accounts.create({
    name: bankDetails.bankAccountHolder || vendorUser.name,
    email: bankDetails.email || vendorUser.email,
    phone: bankDetails.phone || vendorUser.contactNumber || '9999999999',
    type: 'route',
    legal_business_name: vendorUser.vendorDetails?.businessName || vendorUser.name,
    business_type: 'individual',
    profile: {
      category: 'pet_shops',
      subcategory: 'pet_food_and_supplies',
      addresses: {
        registered: {
          street1: vendorUser.address || 'Kerala',
          city: 'Kochi',
          state: 'KL',
          postal_code: '682001',
          country: 'IN',
        },
      },
    },
    bank_account: {
      ifsc_code: bankDetails.ifscCode,
      account_number: bankDetails.bankAccountNumber,
      beneficiary_name: bankDetails.bankAccountHolder,
    },
  });

  return account;
}

/**
 * Creates a Razorpay Order with an automated split transfer to the vendor's linked account.
 * @param {Object} params - { totalAmount, vendorAccountId, vendorShare, notes }
 */
async function createMultiVendorOrder({ totalAmount, vendorAccountId, vendorShare, notes = {} }) {
  const rzp = getRazorpayInstance();
  if (!rzp) throw new Error('Razorpay client is not initialized');

  const totalPaise = Math.round(totalAmount * 100);
  const vendorPaise = Math.round(vendorShare * 100);

  const orderOptions = {
    amount: totalPaise,
    currency: 'INR',
    receipt: `rcpt_${Date.now()}`,
    notes,
  };

  // Attach automated Route transfer if vendor has a linked account ID
  if (vendorAccountId) {
    orderOptions.transfers = [
      {
        account: vendorAccountId,
        amount: vendorPaise,
        currency: 'INR',
        notes: {
          ...notes,
          type: 'vendor_split_payout',
        },
        linked_account_notes: ['productId'],
        on_hold: 0,
      },
    ];
  }

  const razorpayOrder = await rzp.orders.create(orderOptions);
  return razorpayOrder;
}

module.exports = {
  getRazorpayInstance,
  createVendorLinkedAccount,
  createMultiVendorOrder,
};
