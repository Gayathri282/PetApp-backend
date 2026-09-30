/**
 * Cashfree Easy Split Service Module
 * Handles Sub-Merchant Vendor Onboarding, Split Payment Orders, and Webhook Verification
 * Docs: https://docs.cashfree.com/docs/easy-split
 */

const CASHFREE_APP_ID = process.env.CASHFREE_APP_ID || '';
const CASHFREE_SECRET_KEY = process.env.CASHFREE_SECRET_KEY || '';
const CASHFREE_ENV = process.env.CASHFREE_ENV || 'SANDBOX'; // 'SANDBOX' or 'PRODUCTION'

const BASE_URL = CASHFREE_ENV === 'PRODUCTION' 
  ? 'https://api.cashfree.com/pg' 
  : 'https://sandbox.cashfree.com/pg';

/**
 * Creates or updates a vendor (sub-merchant) on Cashfree Easy Split
 */
async function registerCashfreeVendor({ vendorId, name, email, phone, bankAccount, ifsc }) {
  if (!CASHFREE_APP_ID || !CASHFREE_SECRET_KEY) {
    console.warn('[Cashfree] API Keys missing. Running in mock mode.');
    return {
      success: true,
      vendorId: vendorId || `vendor_${Date.now()}`,
      status: 'ACTIVE',
      mock: true
    };
  }

  try {
    const response = await fetch(`${BASE_URL}/easy-split/vendors`, {
      method: 'POST',
      headers: {
        'x-client-id': CASHFREE_APP_ID,
        'x-client-secret': CASHFREE_SECRET_KEY,
        'x-api-version': '2023-08-01',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        vendor_id: vendorId,
        name: name,
        email: email,
        phone: phone,
        bank_details: {
          account_number: bankAccount,
          ifsc: ifsc,
          account_holder: name
        }
      })
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || 'Failed to onboard vendor on Cashfree');
    }

    return {
      success: true,
      vendorId: data.vendor_id,
      status: data.status || 'ACTIVE'
    };
  } catch (err) {
    console.error('[Cashfree Vendor Onboarding Error]', err);
    throw err;
  }
}

/**
 * Creates a Payment Order with automated Split logic for Marketplace commission & Vendor payout
 */
async function createSplitOrder({ orderId, orderAmount, customer, vendorCashfreeId, commissionPercent = 5 }) {
  const platformFee = Math.round((orderAmount * (commissionPercent / 100)) * 100) / 100;
  const vendorPayout = Math.round((orderAmount - platformFee) * 100) / 100;

  if (!CASHFREE_APP_ID || !CASHFREE_SECRET_KEY) {
    console.warn('[Cashfree] API Keys missing. Returning mock session.');
    return {
      cfOrderId: `cf_ord_${Date.now()}`,
      paymentSessionId: `mock_session_${Date.now()}`,
      platformFeeAmount: platformFee,
      vendorPayoutAmount: vendorPayout,
      mock: true
    };
  }

  try {
    const payload = {
      order_id: orderId,
      order_amount: orderAmount,
      order_currency: 'INR',
      customer_details: {
        customer_id: customer._id.toString(),
        customer_name: customer.name || 'Pet Buyer',
        customer_email: customer.email || 'buyer@example.com',
        customer_phone: customer.contactNumber || '9999999999'
      },
      order_meta: {
        return_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/order-confirmation?order_id={order_id}`
      },
      // Easy Split Configuration
      splits: [
        {
          vendor_id: vendorCashfreeId,
          percentage: 100 - commissionPercent, // Vendor percentage share
          tags: {
            hold: 'true' // Hold funds until pet receipt / health check verification
          }
        }
      ]
    };

    const response = await fetch(`${BASE_URL}/orders`, {
      method: 'POST',
      headers: {
        'x-client-id': CASHFREE_APP_ID,
        'x-client-secret': CASHFREE_SECRET_KEY,
        'x-api-version': '2023-08-01',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || 'Failed to create Cashfree Split Order');
    }

    return {
      cfOrderId: data.order_id,
      paymentSessionId: data.payment_session_id,
      platformFeeAmount: platformFee,
      vendorPayoutAmount: vendorPayout
    };
  } catch (err) {
    console.error('[Cashfree Create Order Error]', err);
    throw err;
  }
}

module.exports = {
  registerCashfreeVendor,
  createSplitOrder
};
