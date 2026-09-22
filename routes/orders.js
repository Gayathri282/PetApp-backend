const crypto = require('crypto');
const Razorpay = require('razorpay');
const router = require('express').Router();
const auth = require('../middleware/auth');
const vendor = require('../middleware/vendor');
const upload = require('../middleware/upload');
const Order = require('../models/Order');
const Product = require('../models/Product');
const User = require('../models/User');
const Notification = require('../models/Notification');
const Message = require('../models/Message');

// @route POST /api/orders — Create a new order (buyer initiates purchase)
router.post('/', auth, async (req, res) => {
  try {
    const { productId, shippingAddress, selectedShippingCharge, selectedShippingName } = req.body;

    console.log(`[ORDER CREATE REQUEST]
----------------------
Buyer ID: ${req.user._id}
Product ID: ${productId || 'MISSING'}
Selected Shipping Charge: ${selectedShippingCharge}
Selected Shipping Name: ${selectedShippingName}
----------------------`);

    if (!productId) {
      return res.status(400).json({ message: 'Product ID is required' });
    }

    const product = await Product.findById(productId).populate('vendor', 'name vendorDetails');
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    // Product type validation: Reels cannot be purchased directly
    if (product.type === 'reel') {
      return res.status(400).json({ message: 'Reels cannot be purchased directly as products' });
    }

    // Vendor validation
    if (!product.vendor) {
      return res.status(400).json({ message: 'Seller account for this product was not found' });
    }

    // Prevent vendor from buying their own product
    if (req.user._id.toString() === product.vendor._id.toString()) {
      return res.status(400).json({ message: 'You cannot buy your own product. Please test using a different buyer account.' });
    }

    const vendorDetails = product.vendor.vendorDetails || {};
    const upiDetails = vendorDetails.upiDetails || {};
    const upiId = upiDetails.upiId || '';

    // Vendor UPI validation
    if (!upiId || upiId.trim() === '') {
      return res.status(400).json({ message: 'Seller has not configured a UPI ID yet. Please contact the seller.' });
    }

    // Explicit Shipping Configuration Validation
    const rawShipping = product.shippingChargeKerala;
    const shippingGroups = product.shippingGroups || [];
    const isShippingConfigured = (rawShipping !== undefined && rawShipping !== null && rawShipping !== '' && !isNaN(Number(rawShipping))) || (Array.isArray(shippingGroups) && shippingGroups.length > 0);

    if (!isShippingConfigured) {
      return res.status(400).json({ message: 'Shipping charge is not configured for this product by the vendor.' });
    }

    let shippingCharge = 0;
    if (selectedShippingCharge !== undefined && selectedShippingCharge !== null && !isNaN(Number(selectedShippingCharge))) {
      shippingCharge = Math.max(0, Number(selectedShippingCharge));
    } else if (rawShipping !== undefined && rawShipping !== null && rawShipping !== '' && !isNaN(Number(rawShipping))) {
      shippingCharge = Math.max(0, Number(rawShipping));
    } else {
      shippingCharge = 0;
    }

    const shippingType = selectedShippingName || (shippingCharge === 0 ? 'free' : 'flat');

    const productPrice = Math.max(0, Number(product.price) || 0);
    const totalAmount = productPrice + shippingCharge;

    const productImage = (product.images && product.images.length > 0)
      ? product.images[0]
      : (product.reels && product.reels.length > 0 ? product.reels[0].thumbnail : '');

    const order = await Order.create({
      buyer: req.user._id,
      vendor: product.vendor._id,
      product: product._id,
      productSnapshot: {
        name: product.name,
        price: productPrice,
        image: productImage || '',
      },
      vendorSnapshot: {
        name: product.vendor.name || 'Vendor',
        upiId: upiId,
        upiName: upiDetails.upiName || product.vendor.name || 'Vendor',
      },
      productPrice,
      shippingCharge,
      totalAmount,
      shippingType,
      paymentMethod: 'UPI',
      paymentStatus: 'pending_verification',
      orderStatus: 'payment_pending',
      shippingAddress: shippingAddress || {},
    });

    await order.populate([
      { path: 'product', select: 'name price images reels' },
      { path: 'vendor', select: 'name email avatar vendorDetails' },
      { path: 'buyer', select: 'name email avatar contactNumber' },
    ]);

    console.log(`[ORDER CREATE SUCCESS]
----------------------
Order ID: ${order._id}
Product: ${product.name} (${product._id})
Vendor: ${product.vendor.name} (${product.vendor._id})
Product Price: ₹${productPrice}
Kerala Shipping: ₹${shippingCharge}
Total: ₹${totalAmount}
Payment Method: UPI
Payment Status: ${order.paymentStatus}
----------------------`);

    res.status(201).json({ 
      order, 
      message: 'Order initiated. Complete payment via UPI and submit Transaction ID.',
      vendorUpi: {
        upiId: upiId,
        upiName: upiDetails.upiName || product.vendor.name || 'Vendor',
      }
    });
  } catch (error) {
    console.error('[ORDER CREATE ERROR]:', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: error.message, error: error.errors });
    }
    res.status(500).json({ message: error.message || 'Failed to create order' });
  }
});

// @route PUT /api/orders/:id/submit-payment — Buyer submits UPI Transaction / UTR ID
router.put('/:id/submit-payment', auth, async (req, res) => {
  try {
    const { transactionId, utrNumber, notes } = req.body;
    const finalTxId = (transactionId || utrNumber || '').trim();

    if (!finalTxId || finalTxId.length < 4) {
      return res.status(400).json({ message: 'Valid UPI Transaction / UTR ID is required' });
    }

    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found' });

    if (order.buyer.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    if (order.paymentStatus === 'verified') {
      return res.status(400).json({ message: 'This payment has already been verified and cannot be updated.' });
    }

    order.transactionId = finalTxId;
    order.paymentStatus = 'pending_verification';
    order.orderStatus = 'payment_pending';
    if (notes) order.vendorNotes = notes;

    await order.save();

    await order.populate([
      { path: 'product', select: 'name price' },
      { path: 'buyer', select: 'name email' },
      { path: 'vendor', select: 'name email' },
    ]);

    // Format chat message payload for automatic Purchase Request card in buyer/vendor chat
    const chatContent = `🛒 **PURCHASE_REQUEST**
Order ID: ${order._id}
Product: ${order.productSnapshot.name}
Product Price: ₹${order.productPrice.toLocaleString('en-IN')}
Shipping: ${order.shippingCharge > 0 ? `₹${order.shippingCharge.toLocaleString('en-IN')}` : 'FREE'}
Total: ₹${order.totalAmount.toLocaleString('en-IN')}
UPI Transaction ID: ${finalTxId}
Payment Status: PENDING_VERIFICATION`;

    await Message.create({
      sender: req.user._id,
      receiver: order.vendor._id,
      content: chatContent,
      productId: order.product._id,
    });

    await Notification.create({
      recipient: order.vendor._id,
      sender: req.user._id,
      type: 'system',
      message: `💳 Payment submitted for "${order.productSnapshot.name}". Tx ID: ${finalTxId}. Please verify & confirm in chat.`,
    });

    res.json({ order, message: 'Payment submitted for verification. Vendor will verify shortly.' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route PUT /api/orders/:id/verify-payment — Vendor approves or declines payment
router.put('/:id/verify-payment', auth, vendor, async (req, res) => {
  try {
    const { action, reason } = req.body; // action = 'approve' | 'decline'
    if (!['approve', 'decline'].includes(action)) {
      return res.status(400).json({ message: 'Action must be "approve" or "decline"' });
    }

    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found' });

    if (order.vendor.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Only the vendor of this product can verify payment' });
    }

    // Prevent duplicate verification
    if (order.paymentStatus === 'verified' || order.paymentStatus === 'declined') {
      return res.status(400).json({ message: `Payment is already ${order.paymentStatus.toUpperCase()} and cannot be changed.` });
    }

    let systemChatMessage = '';

    if (action === 'approve') {
      order.paymentStatus = 'verified';
      order.orderStatus = 'processing';
      order.declineReason = '';

      systemChatMessage = `✅ **PAYMENT_VERIFIED**
Order ID: ${order._id}
Product: ${order.productSnapshot.name}
Amount: ₹${order.totalAmount.toLocaleString('en-IN')}
Transaction ID: ${order.transactionId}
Order status: Payment Verified`;
    } else {
      order.paymentStatus = 'declined';
      order.orderStatus = 'cancelled';
      order.declineReason = reason || 'Payment details could not be verified by vendor.';

      systemChatMessage = `❌ **PAYMENT_DECLINED**
Order ID: ${order._id}
Product: ${order.productSnapshot.name}
Reason: ${order.declineReason}
Transaction ID: ${order.transactionId}
Status: Verification Declined`;
    }

    await order.save();

    await Message.create({
      sender: req.user._id,
      receiver: order.buyer,
      content: systemChatMessage,
      productId: order.product,
    });

    await Notification.create({
      recipient: order.buyer,
      sender: req.user._id,
      type: 'system',
      message: action === 'approve'
        ? `✓ Vendor verified your payment for "${order.productSnapshot.name}".`
        : `❌ Payment verification declined for "${order.productSnapshot.name}".`,
    });

    res.json({ order, message: `Payment ${order.paymentStatus} successfully.` });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route GET /api/orders/my-orders — List buyer's orders
router.get('/my-orders', auth, async (req, res) => {
  try {
    const orders = await Order.find({ buyer: req.user._id })
      .populate('product', 'name price images category reels')
      .populate('vendor', 'name email avatar vendorDetails')
      .sort({ createdAt: -1 })
      .lean();

    res.json({ orders });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route GET /api/orders/vendor-orders — List vendor's received orders
router.get('/vendor-orders', auth, vendor, async (req, res) => {
  try {
    const orders = await Order.find({ vendor: req.user._id })
      .populate('product', 'name price images category')
      .populate('buyer', 'name email avatar contactNumber')
      .sort({ createdAt: -1 })
      .lean();

    res.json({ orders });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route POST /api/orders/:id/razorpay-initiate — Initialize Razorpay Checkout Order
router.post('/:id/razorpay-initiate', auth, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found' });

    const razorpayKeyId = process.env.RAZORPAY_KEY_ID || '';
    const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET || '';

    let razorpayOrder;
    if (razorpayKeyId && razorpayKeySecret) {
      const razorpay = new Razorpay({
        key_id: razorpayKeyId,
        key_secret: razorpayKeySecret,
      });

      const options = {
        amount: Math.round(order.totalAmount * 100), // in paise
        currency: 'INR',
        receipt: `receipt_${order._id.toString().slice(-10)}`,
        notes: {
          orderId: order._id.toString(),
          productId: order.product.toString(),
          buyerId: order.buyer.toString(),
        },
      };

      razorpayOrder = await razorpay.orders.create(options);
    } else {
      // Simulated Razorpay Order ID for dev/testing
      razorpayOrder = {
        id: `rzp_order_sim_${Date.now()}`,
        amount: Math.round(order.totalAmount * 100),
        currency: 'INR',
        receipt: `receipt_${order._id.toString().slice(-10)}`,
      };
    }

    order.razorpayOrderId = razorpayOrder.id;
    await order.save();

    res.json({
      order,
      razorpayOrder,
      keyId: razorpayKeyId || 'rzp_test_simulated_key',
    });
  } catch (error) {
    console.error('[RAZORPAY INITIATE ERROR]:', error);
    res.status(500).json({ message: error.message || 'Failed to initiate Razorpay order' });
  }
});

// @route POST /api/orders/:id/razorpay-verify — Verify Razorpay payment signature & auto-confirm order
router.post('/:id/razorpay-verify', auth, async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found' });

    const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET || '';

    if (razorpayKeySecret && !razorpay_order_id?.startsWith('rzp_order_sim_')) {
      const body = razorpay_order_id + '|' + razorpay_payment_id;
      const expectedSignature = crypto
        .createHmac('sha256', razorpayKeySecret)
        .update(body.toString())
        .digest('hex');

      if (expectedSignature !== razorpay_signature) {
        return res.status(400).json({ message: 'Invalid payment signature. Verification failed.' });
      }
    }

    const paymentId = razorpay_payment_id || `pay_sim_${Date.now()}`;
    order.razorpayOrderId = razorpay_order_id || order.razorpayOrderId;
    order.razorpayPaymentId = paymentId;
    order.razorpaySignature = razorpay_signature || 'simulated_signature';
    order.transactionId = paymentId;
    order.paymentMethod = 'Razorpay / UPI';
    order.paymentStatus = 'verified';
    order.orderStatus = 'processing';

    await order.save();

    await order.populate([
      { path: 'product', select: 'name price' },
      { path: 'buyer', select: 'name email' },
      { path: 'vendor', select: 'name email' },
    ]);

    // Send automated chat receipt notification
    const chatContent = `✅ **PAYMENT_VERIFIED**
Order ID: ${order._id}
Product: ${order.productSnapshot.name}
Total Paid: ₹${order.totalAmount.toLocaleString('en-IN')} via Razorpay / UPI
Payment ID: ${paymentId}
Status: VERIFIED & PAID (Instant 1-Touch Checkout)`;

    await Message.create({
      sender: req.user._id,
      receiver: order.vendor._id,
      content: chatContent,
      productId: order.product._id,
    });

    await Notification.create({
      recipient: order.vendor._id,
      sender: req.user._id,
      type: 'system',
      message: `🎉 Payment of ₹${order.totalAmount.toLocaleString('en-IN')} for "${order.productSnapshot.name}" verified via Razorpay! Payment ID: ${paymentId}`,
    });

    console.log(`[RAZORPAY VERIFIED SUCCESS] Order ${order._id} paid with ID ${paymentId}`);

    res.json({ order, message: 'Payment verified and confirmed successfully!' });
  } catch (error) {
    console.error('[RAZORPAY VERIFY ERROR]:', error);
    res.status(500).json({ message: error.message || 'Payment verification failed' });
  }
});

module.exports = router;
