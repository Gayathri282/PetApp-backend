const router = require('express').Router();
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');
const User = require('../models/User');
const Product = require('../models/Product');
const VendorApplication = require('../models/VendorApplication');
const Enquiry = require('../models/Enquiry');
const Like = require('../models/Like');

// All admin routes require auth + admin middleware
router.use(auth, admin);

// @route GET /api/admin/stats
router.get('/stats', async (req, res) => {
  try {
    const [users, vendors, products, pendingApps, pendingEnquiries] =
      await Promise.all([
        User.countDocuments(),
        User.countDocuments({ role: 'vendor', vendorApproved: true }),
        Product.countDocuments(),
        VendorApplication.countDocuments({ status: 'pending' }),
        Enquiry.countDocuments({ status: 'pending' }),
      ]);

    res.json({
      stats: { users, vendors, products, pendingApps, pendingEnquiries },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route GET /api/admin/applications
router.get('/applications', async (req, res) => {
  try {
    const { status } = req.query;
    const filter = {};
    if (status) filter.status = status;

    const applications = await VendorApplication.find(filter)
      .populate('applicant', 'name email avatar')
      .populate('reviewedBy', 'name')
      .sort({ createdAt: -1 })
      .lean();

    res.json({ applications });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route PUT /api/admin/applications/:id — approve/reject
router.put('/applications/:id', async (req, res) => {
  try {
    const { status } = req.body; // 'approved' or 'rejected'

    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ message: 'Status must be approved or rejected' });
    }

    const application = await VendorApplication.findById(req.params.id);
    if (!application) {
      return res.status(404).json({ message: 'Application not found' });
    }

    application.status = status;
    application.reviewedBy = req.user._id;
    await application.save();

    // If approved, update user role
    if (status === 'approved') {
      await User.findByIdAndUpdate(application.applicant, {
        role: 'vendor',
        vendorApproved: true,
        vendorDetails: {
          businessName: application.businessName,
          description: application.description,
          contactEmail: application.contactEmail,
          contactNumber: application.contactNumber,
          address: application.address,
        },
      });
    }

    res.json({ application, message: `Application ${status}` });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route GET /api/admin/enquiries
router.get('/enquiries', async (req, res) => {
  try {
    const enquiries = await Enquiry.find()
      .populate('user', 'name email avatar contactNumber')
      .populate({
        path: 'product',
        select: 'name price isOnSale vendor',
        populate: {
          path: 'vendor',
          select: 'name email contactNumber avatar'
        }
      })
      .sort({ createdAt: -1 })
      .lean();

    res.json({ enquiries });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route PUT /api/admin/enquiries/:id — update status
router.put('/enquiries/:id', async (req, res) => {
  try {
    const { status } = req.body;
    if (!['pending', 'resolved'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const enquiry = await Enquiry.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    )
      .populate('user', 'name email avatar')
      .populate('product', 'name price');

    if (!enquiry) {
      return res.status(404).json({ message: 'Enquiry not found' });
    }

    res.json({ enquiry });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route GET /api/admin/products/pending
router.get('/products/pending', async (req, res) => {
  try {
    const products = await Product.find({ status: 'pending' })
      .populate('vendor', 'name avatar')
      .sort({ createdAt: -1 })
      .lean();
    res.json({ products });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route GET /api/admin/products — list all products for moderation
router.get('/products', async (req, res) => {
  try {
    const { status, q } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (q) filter.name = { $regex: q, $options: 'i' };

    const products = await Product.find(filter)
      .populate('vendor', 'name avatar')
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    res.json({ products });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route PUT /api/admin/products/:id/review
router.put('/products/:id/review', async (req, res) => {
  try {
    const { status, reason } = req.body; // 'approved' or 'rejected'
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const product = await Product.findById(req.params.id).populate('vendor', 'name');
    if (!product) return res.status(404).json({ message: 'Product not found' });

    product.status = status;
    await product.save();

    const Notification = require('../models/Notification');
    const Message = require('../models/Message');

    if (status === 'approved') {
      // Notify vendor via activity feed
      await Notification.create({
        recipient: product.vendor._id,
        sender: req.user._id,
        type: 'system',
        product: product._id,
        message: `✅ Your product "${product.name}" has been approved and is now live!`
      });
    } else {
      const takedownReason = reason || 'Does not meet our community guidelines';

      // Notify via activity feed
      await Notification.create({
        recipient: product.vendor._id,
        sender: req.user._id,
        type: 'system',
        product: product._id,
        message: `❌ Your product "${product.name}" has been taken down. Reason: ${takedownReason}`
      });

      // Also send a direct chat message so the vendor sees it in Messages
      await Message.create({
        sender: req.user._id,
        receiver: product.vendor._id,
        content: `⚠️ *Admin Notice — Content Taken Down*\n\nYour product **"${product.name}"** has been taken down from PetPlace.\n\n**Reason:** ${takedownReason}\n\nIf you believe this was a mistake, please reply here and our team will review your case.`,
      });
    }

    res.json({ product, message: `Product ${status}` });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route DELETE /api/admin/products/:id — moderate/delete any product
router.delete('/products/:id', async (req, res) => {
  try {
    const { reason } = req.body;
    const deleteReason = reason || 'Violation of community guidelines';

    const product = await Product.findById(req.params.id).populate('vendor', 'name _id');
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    const Notification = require('../models/Notification');
    const Message = require('../models/Message');

    // Notify vendor before deleting
    if (product.vendor) {
      await Notification.create({
        recipient: product.vendor._id,
        sender: req.user._id,
        type: 'system',
        message: `🗑️ Your product "${product.name}" has been permanently removed by admin. Reason: ${deleteReason}`
      });

      await Message.create({
        sender: req.user._id,
        receiver: product.vendor._id,
        content: `🚫 *Admin Notice — Product Permanently Removed*\n\nYour product **"${product.name}"** has been permanently deleted from PetPlace.\n\n**Reason:** ${deleteReason}\n\nIf you believe this was a mistake, please reply here and our team will review your case.`,
      });
    }

    await Product.findByIdAndDelete(req.params.id);
    await Like.deleteMany({ product: req.params.id });

    res.json({ message: 'Product deleted by admin' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route GET /api/admin/users — list all users
router.get('/users', async (req, res) => {
  try {
    const { q } = req.query;
    const filter = q ? { $or: [{ name: { $regex: q, $options: 'i' } }, { email: { $regex: q, $options: 'i' } }] } : {};
    const users = await User.find(filter).sort({ createdAt: -1 }).limit(100).lean();
    res.json({ users });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route DELETE /api/admin/users/:id — take down any account + cascade delete all content
router.delete('/users/:id', async (req, res) => {
  try {
    const { reason } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (user.role === 'admin') return res.status(403).json({ message: 'Cannot delete admin accounts' });

    const Message = require('../models/Message');
    const Notification = require('../models/Notification');
    const VendorApplication = require('../models/VendorApplication');

    // Send them a message before deleting so they know why if they log in again on a different account
    // (We store the reason in notifications for the record, cascade deletes the messages after)
    const takedownReason = reason || 'Violation of community guidelines';

    // Cascade delete all user content
    const userProducts = await Product.find({ vendor: user._id }).select('_id');
    const productIds = userProducts.map(p => p._id);

    await Product.deleteMany({ vendor: user._id });
    await Like.deleteMany({ $or: [{ user: user._id }, { product: { $in: productIds } }] });
    await Message.deleteMany({ $or: [{ sender: user._id }, { receiver: user._id }] });
    await Notification.deleteMany({ $or: [{ recipient: user._id }, { sender: user._id }] });
    await VendorApplication.deleteMany({ applicant: user._id });
    await User.findByIdAndDelete(user._id);

    res.json({ message: `Account for ${user.name} deleted. Reason: ${takedownReason}` });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
