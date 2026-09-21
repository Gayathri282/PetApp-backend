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
    const { productId, shippingAddress } = req.body;
    if (!productId) {
      return res.status(400).json({ message: 'Product ID is required' });
    }

    const product = await Product.findById(productId).populate('vendor', 'name vendorDetails');
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    if (req.user._id.toString() === product.vendor._id.toString()) {
      return res.status(400).json({ message: 'You cannot buy your own product' });
    }

    const order = await Order.create({
      buyer: req.user._id,
      vendor: product.vendor._id,
      product: product._id,
      amount: product.price,
      status: 'pending_payment',
      shippingAddress: shippingAddress || {},
      paymentDetails: {
        upiId: product.vendor.vendorDetails?.upiDetails?.upiId || '',
      },
    });

    await order.populate([
      { path: 'product', select: 'name price images reels' },
      { path: 'vendor', select: 'name email avatar vendorDetails' },
      { path: 'buyer', select: 'name email avatar contactNumber' },
    ]);

    res.status(201).json({ order, message: 'Order created. Proceed with UPI payment.' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route PUT /api/orders/:id/submit-payment — Buyer submits UTR number & payment screenshot
router.put(
  '/:id/submit-payment',
  auth,
  upload.fields([{ name: 'screenshot', maxCount: 1 }]),
  async (req, res) => {
    try {
      const { utrNumber, notes } = req.body;
      const screenshotFile = req.files?.screenshot?.[0];

      if (!utrNumber || utrNumber.trim().length < 6) {
        return res.status(400).json({ message: 'Valid UTR / Transaction Reference ID (12 digits) is required' });
      }

      const order = await Order.findById(req.params.id);
      if (!order) return res.status(404).json({ message: 'Order not found' });

      if (order.buyer.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: 'Unauthorized' });
      }

      // Check for duplicate UTR
      const duplicateUTR = await Order.findOne({
        'paymentDetails.utrNumber': utrNumber.trim(),
        _id: { $ne: order._id },
        status: { $in: ['payment_submitted', 'confirmed', 'delivered'] },
      });

      if (duplicateUTR) {
        return res.status(400).json({ message: 'This UTR / Transaction ID has already been submitted for another order' });
      }

      order.paymentDetails.utrNumber = utrNumber.trim();
      if (screenshotFile?.path) {
        order.paymentDetails.paymentScreenshot = screenshotFile.path;
      } else if (req.body.paymentScreenshot) {
        order.paymentDetails.paymentScreenshot = req.body.paymentScreenshot;
      }
      order.paymentDetails.submittedAt = new Date();
      order.paymentDetails.notes = notes || '';
      order.status = 'payment_submitted';

      await order.save();

      await order.populate([
        { path: 'product', select: 'name price' },
        { path: 'buyer', select: 'name email' },
      ]);

      // Notify vendor
      await Notification.create({
        recipient: order.vendor,
        sender: req.user._id,
        type: 'system',
        message: `💳 Payment submitted for "${order.product.name}". UTR: ${utrNumber}. Please verify & confirm.`,
      });

      await Message.create({
        sender: req.user._id,
        receiver: order.vendor,
        content: `🛒 *Order Payment Submitted*\n\nProduct: **${order.product.name}**\nAmount: ₹${order.amount}\nUTR Number: \`${utrNumber.trim()}\`\n\nPlease check your bank / UPI app and confirm the payment.`,
      });

      res.json({ order, message: 'Payment reference submitted successfully. Vendor will verify shortly.' });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
);

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

// @route PUT /api/orders/:id/vendor-status — Vendor updates order status ('confirmed', 'rejected', 'delivered', 'cancelled')
router.put('/:id/vendor-status', auth, vendor, async (req, res) => {
  try {
    const { status, vendorNotes } = req.body;
    if (!['confirmed', 'rejected', 'delivered', 'cancelled'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status update' });
    }

    const order = await Order.findById(req.params.id).populate('product', 'name price');
    if (!order) return res.status(404).json({ message: 'Order not found' });

    if (order.vendor.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    order.status = status;
    if (vendorNotes) order.vendorNotes = vendorNotes;

    if (status === 'confirmed') {
      order.paymentDetails.verifiedAt = new Date();
    }

    await order.save();

    const statusIcons = {
      confirmed: '✅ Payment Verified & Order Confirmed',
      rejected: '❌ Order Rejected / Payment Unverified',
      delivered: '📦 Order Marked Delivered',
      cancelled: '🚫 Order Cancelled',
    };

    await Notification.create({
      recipient: order.buyer,
      sender: req.user._id,
      type: 'system',
      message: `${statusIcons[status] || 'Order Status Updated'} for "${order.product.name}".`,
    });

    await Message.create({
      sender: req.user._id,
      receiver: order.buyer,
      content: `📦 *Order Update*\n\nYour order for **${order.product.name}** status is now: **${status.toUpperCase()}**.\n${vendorNotes ? `Note: ${vendorNotes}` : ''}`,
    });

    res.json({ order, message: `Order status updated to ${status}` });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
