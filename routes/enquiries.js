const router = require('express').Router();
const auth = require('../middleware/auth');
const Enquiry = require('../models/Enquiry');
const Product = require('../models/Product');

// @route POST /api/enquiries — submit enquiry
router.post('/', auth, async (req, res) => {
  try {
    const { productId, message } = req.body;

    if (!productId || !message) {
      return res.status(400).json({ message: 'Product and message are required' });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    const enquiry = await Enquiry.create({
      user: req.user._id,
      product: productId,
      message,
    });

    // Automatically send a chat message to vendor
    const Message = require('../models/Message');
    const vendorId = product.vendor;
    
    const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
    const productLink = `${clientUrl.replace(/\/$/, '')}/product/${product._id}`;

    await Message.create({
      sender: req.user._id,
      receiver: vendorId,
      content: `👋 Hi! I'm interested in your product: "${product.name}". \n\nMy contact: ${req.user.contactNumber || 'N/A'} \n\nView product here: ${productLink}`,
      enquiry: enquiry._id,
      product: product._id
    });

    // Also add to Activity Feed
    const Notification = require('../models/Notification');
    await Notification.create({
      recipient: vendorId,
      sender: req.user._id,
      type: 'enquiry',
      product: product._id,
      message: `${req.user.name} enquired about your product "${product.name}" (Phone: ${req.user.contactNumber || 'N/A'})`
    });

    res.status(201).json({ 
      enquiry, 
      vendorId,
      message: 'Enquiry sent and chat started with the vendor!' 
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
