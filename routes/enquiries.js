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

    // Automatically send a chat message to admin
    const Message = require('../models/Message');
    const User = require('../models/User');
    const adminUser = await User.findOne({ role: 'admin' });
    if (adminUser) {
      await Message.create({
        sender: req.user._id,
        receiver: adminUser._id,
        content: `Interest Registered: I'm interested in "${product.name}". ${message}`,
        enquiry: enquiry._id,
        product: product._id
      });
    }

    res.status(201).json({ enquiry, message: 'Enquiry sent and chat started with support!' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
