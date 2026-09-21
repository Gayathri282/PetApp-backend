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
    const [
      users,
      vendors,
      totalProducts,
      totalReels,
      pendingProducts,
      pendingReels,
      pendingApps,
      pendingEnquiries,
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ role: 'vendor', vendorApproved: true }),
      Product.countDocuments(),
      Product.countDocuments({ 'reels.0': { $exists: true } }),
      Product.countDocuments({ status: 'pending' }),
      Product.countDocuments({ 'reels.0': { $exists: true }, status: 'pending' }),
      VendorApplication.countDocuments({ status: 'pending' }),
      Enquiry.countDocuments({ status: 'pending' }),
    ]);

    res.json({
      stats: {
        users,
        vendors,
        products: totalProducts,
        totalProducts,
        totalReels,
        pendingProducts,
        pendingReels,
        pendingApps,
        pendingEnquiries,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route GET /api/admin/reels — List all reels for moderation
router.get('/reels', async (req, res) => {
  try {
    const { status, q } = req.query;
    const filter = { 'reels.0': { $exists: true } };

    if (status && status !== 'all') {
      filter.status = status;
    }
    if (q) {
      filter.name = { $regex: q, $options: 'i' };
    }

    const reels = await Product.find(filter)
      .populate('vendor', 'name email avatar contactNumber')
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    res.json({ reels });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route PUT /api/admin/reels/:id/status — Approve / Reject / Delete reel
router.put('/reels/:id/status', async (req, res) => {
  try {
    const { status, reason } = req.body; // 'approved' | 'rejected' | 'deleted'
    if (!['approved', 'rejected', 'deleted'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const product = await Product.findById(req.params.id).populate('vendor', 'name');
    if (!product) return res.status(404).json({ message: 'Reel not found' });

    product.status = status;
    await product.save();

    const Notification = require('../models/Notification');
    const Message = require('../models/Message');

    if (product.vendor) {
      if (status === 'approved') {
        await Notification.create({
          recipient: product.vendor._id,
          sender: req.user._id,
          type: 'system',
          product: product._id,
          message: `✅ Your reel "${product.name}" has been approved!`,
        });
      } else {
        const takedownReason = reason || 'Violation of community guidelines';
        await Notification.create({
          recipient: product.vendor._id,
          sender: req.user._id,
          type: 'system',
          product: product._id,
          message: `❌ Your reel "${product.name}" was ${status}. Reason: ${takedownReason}`,
        });

        await Message.create({
          sender: req.user._id,
          receiver: product.vendor._id,
          content: `⚠️ *Admin Reel Notice*\n\nYour reel **"${product.name}"** status was updated to: **${status}**.\n\n**Reason:** ${takedownReason}`,
        });
      }
    }

    res.json({ reel: product, message: `Reel status updated to ${status}` });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route DELETE /api/admin/reels/:id — Delete reel
router.delete('/reels/:id', async (req, res) => {
  try {
    const { reason } = req.body;
    const deleteReason = reason || 'Violation of community guidelines';

    const product = await Product.findById(req.params.id).populate('vendor', 'name _id');
    if (!product) {
      return res.status(404).json({ message: 'Reel not found' });
    }

    product.status = 'deleted';
    await product.save();

    const Notification = require('../models/Notification');
    const Message = require('../models/Message');

    if (product.vendor) {
      await Notification.create({
        recipient: product.vendor._id,
        sender: req.user._id,
        type: 'system',
        message: `🗑️ Your reel "${product.name}" has been deleted by admin. Reason: ${deleteReason}`,
      });

      await Message.create({
        sender: req.user._id,
        receiver: product.vendor._id,
        content: `🚫 *Admin Notice — Reel Deleted*\n\nYour reel **"${product.name}"** has been removed by admin.\n\n**Reason:** ${deleteReason}`,
      });
    }

    res.json({ message: 'Reel deleted by admin' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route GET /api/admin/applications
router.get('/applications', async (req, res) => {
  try {
    const { status } = req.query;
    const filter = {};
    if (status && status !== 'all') filter.status = status;

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
          petCategories: application.petCategories || [],
          upiDetails: application.upiDetails || {},
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
          select: 'name email contactNumber avatar',
        },
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
    if (status && status !== 'all') filter.status = status;
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
    const { status, reason } = req.body; // 'approved' | 'rejected' | 'deleted'
    if (!['approved', 'rejected', 'deleted'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const product = await Product.findById(req.params.id).populate('vendor', 'name');
    if (!product) return res.status(404).json({ message: 'Product not found' });

    product.status = status;
    await product.save();

    const Notification = require('../models/Notification');
    const Message = require('../models/Message');

    if (product.vendor) {
      if (status === 'approved') {
        await Notification.create({
          recipient: product.vendor._id,
          sender: req.user._id,
          type: 'system',
          product: product._id,
          message: `✅ Your product "${product.name}" has been approved and is live!`,
        });
      } else {
        const takedownReason = reason || 'Does not meet community guidelines';
        await Notification.create({
          recipient: product.vendor._id,
          sender: req.user._id,
          type: 'system',
          product: product._id,
          message: `❌ Your product "${product.name}" status: ${status}. Reason: ${takedownReason}`,
        });

        await Message.create({
          sender: req.user._id,
          receiver: product.vendor._id,
          content: `⚠️ *Admin Notice*\n\nYour product **"${product.name}"** status was set to: **${status}**.\n\n**Reason:** ${takedownReason}`,
        });
      }
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

    product.status = 'deleted';
    await product.save();

    const Notification = require('../models/Notification');
    const Message = require('../models/Message');

    if (product.vendor) {
      await Notification.create({
        recipient: product.vendor._id,
        sender: req.user._id,
        type: 'system',
        message: `🗑️ Your product "${product.name}" has been deleted by admin. Reason: ${deleteReason}`,
      });

      await Message.create({
        sender: req.user._id,
        receiver: product.vendor._id,
        content: `🚫 *Admin Notice — Product Deleted*\n\nYour product **"${product.name}"** has been deleted by admin.\n\n**Reason:** ${deleteReason}`,
      });
    }

    res.json({ message: 'Product deleted by admin' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route GET /api/admin/users — list all users
router.get('/users', async (req, res) => {
  try {
    const { q, status } = req.query;
    const filter = {};

    if (status === 'suspended') {
      filter.$or = [{ isSuspended: true }, { status: 'suspended' }];
    } else if (status === 'active') {
      filter.isSuspended = { $ne: true };
      filter.status = { $ne: 'suspended' };
    }

    if (q) {
      const regex = new RegExp(q, 'i');
      filter.$and = filter.$and || [];
      filter.$and.push({ $or: [{ name: regex }, { email: regex }] });
    }

    const rawUsers = await User.find(filter).sort({ createdAt: -1 }).limit(100).lean();

    // Populate counts for each user
    const usersWithCounts = await Promise.all(
      rawUsers.map(async (u) => {
        const productCount = await Product.countDocuments({ vendor: u._id });
        const reelCount = await Product.countDocuments({ vendor: u._id, 'reels.0': { $exists: true } });
        return {
          ...u,
          productCount,
          reelCount,
          status: u.isSuspended || u.status === 'suspended' ? 'suspended' : 'active',
        };
      })
    );

    res.json({ users: usersWithCounts });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route PUT /api/admin/users/:id/suspend — toggle suspend/activate user status
router.put('/users/:id/suspend', async (req, res) => {
  try {
    const { suspend, reason } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (user.role === 'admin') return res.status(403).json({ message: 'Cannot suspend admin accounts' });

    user.isSuspended = Boolean(suspend);
    user.status = suspend ? 'suspended' : 'active';
    await user.save();

    res.json({ user, message: `Account for ${user.name} is now ${user.status}` });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route DELETE /api/admin/users/:id — take down user account + cascade delete content
router.delete('/users/:id', async (req, res) => {
  try {
    const { reason } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (user.role === 'admin') return res.status(403).json({ message: 'Cannot delete admin accounts' });

    const Message = require('../models/Message');
    const Notification = require('../models/Notification');
    const VendorApplication = require('../models/VendorApplication');

    const takedownReason = reason || 'Violation of community guidelines';

    const userProducts = await Product.find({ vendor: user._id }).select('_id');
    const productIds = userProducts.map((p) => p._id);

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
