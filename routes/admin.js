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

// @route DELETE /api/admin/products/:id — moderate/delete any product
router.delete('/products/:id', async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    await Like.deleteMany({ product: req.params.id });
    res.json({ message: 'Product deleted by admin' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
