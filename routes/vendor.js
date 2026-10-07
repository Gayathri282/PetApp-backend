const router = require('express').Router();
const auth = require('../middleware/auth');
const vendor = require('../middleware/vendor');
const upload = require('../middleware/upload');
const Product = require('../models/Product');
const VendorApplication = require('../models/VendorApplication');
const User = require('../models/User');

// @route POST /api/vendor/apply — submit vendor application
router.post('/apply', auth, async (req, res) => {
  try {
    if (req.user.role === 'vendor') {
      return res.status(400).json({ message: 'You are already a vendor' });
    }
    if (req.user.role === 'admin') {
      return res.status(400).json({ message: 'Admins cannot apply as vendor' });
    }

    // Check for existing pending application
    const existing = await VendorApplication.findOne({
      applicant: req.user._id,
      status: 'pending',
    });
    if (existing) {
      return res.status(400).json({ message: 'You already have a pending application' });
    }

    const { businessName, description, contactEmail, contactNumber, address, petCategories, upiDetails } = req.body;

    if (!businessName || !description || !contactEmail || !contactNumber) {
      return res.status(400).json({ message: 'Business name, description, contact email, and contact number are required' });
    }

    const application = await VendorApplication.create({
      applicant: req.user._id,
      businessName,
      description,
      contactEmail,
      contactNumber,
      address: address || '',
      petCategories: Array.isArray(petCategories) ? petCategories : [],
      upiDetails: upiDetails || {},
    });

    res.status(201).json({ application, message: 'Application submitted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route PUT /api/vendor/upi-settings — update vendor pet categories and UPI payment details
router.put('/upi-settings', auth, vendor, async (req, res) => {
  try {
    const { petCategories, upiDetails, businessName, description, address } = req.body;

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (!user.vendorDetails) user.vendorDetails = {};

    if (businessName) user.vendorDetails.businessName = businessName;
    if (description) user.vendorDetails.description = description;
    if (address !== undefined) user.vendorDetails.address = address;
    if (Array.isArray(petCategories)) user.vendorDetails.petCategories = petCategories;
    if (upiDetails) {
      user.vendorDetails.upiDetails = {
        ...user.vendorDetails.upiDetails,
        ...upiDetails,
      };
    }

    await user.save();

    res.json({ vendorDetails: user.vendorDetails, message: 'Vendor settings updated successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route PUT /api/vendor/shipping-settings — update vendor shipping configuration
router.put('/shipping-settings', auth, vendor, async (req, res) => {
  try {
    const { shippingType, flatRate, notes } = req.body;

    if (!['free', 'flat', 'variable', 'unconfigured'].includes(shippingType)) {
      return res.status(400).json({ message: 'Invalid shipping type' });
    }

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (!user.vendorDetails) user.vendorDetails = {};
    user.vendorDetails.shippingDetails = {
      shippingType,
      flatRate: shippingType === 'flat' ? Math.max(0, Number(flatRate) || 0) : 0,
      notes: notes || '',
    };

    await user.save();

    res.json({ 
      shippingDetails: user.vendorDetails.shippingDetails, 
      message: 'Shipping settings updated successfully' 
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route GET /api/vendor/application-status — check own application status
router.get('/application-status', auth, async (req, res) => {
  try {
    const application = await VendorApplication.findOne({
      applicant: req.user._id,
    }).sort({ createdAt: -1 });

    res.json({ application: application || null });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route GET /api/vendor/products — get vendor's own products
router.get('/products', auth, vendor, async (req, res) => {
  try {
    const products = await Product.find({ vendor: req.user._id })
      .populate('vendor', 'name avatar vendorDetails.upiDetails')
      .sort({ createdAt: -1 })
      .lean();

    res.json({ products });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route POST /api/vendor/reel — upload single promotional reel
router.post(
  '/reel',
  auth,
  vendor,
  upload.fields([{ name: 'video', maxCount: 1 }]),
  async (req, res) => {
    try {
      console.log('--- REEL UPLOAD ATTEMPT ---');
      console.log('User:', req.user._id, req.user.role);
      const { name, description, tags, videoUrl: directVideoUrl } = req.body;
      const videoFile = req.files?.video?.[0];
      
      const finalVideoUrl = directVideoUrl || videoFile?.path;

      if (!finalVideoUrl) {
        return res.status(400).json({ message: 'Video file or URL is required' });
      }

      const product = await Product.create({
        vendor: req.user._id,
        name: name || 'Promotional Reel',
        description: description || '',
        category: 'promotional',
        tags: tags ? JSON.parse(tags) : [],
        price: 0,
        isOnSale: false,
        deliveryChargesAdditional: false,
        reels: [
          {
            videoUrl: finalVideoUrl,
            thumbnail: '',
            order: 0,
          },
        ],
      });

      await product.populate('vendor', 'name avatar vendorDetails.upiDetails');

      res.status(201).json({ product });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
);

// @route GET /api/vendor/custom-categories — Get vendor's custom categories and breeds
router.get('/custom-categories', auth, vendor, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    const categories = user.vendorDetails?.customCategories || [];
    res.json({ categories });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route PUT /api/vendor/custom-categories — Update vendor's custom categories and breeds
router.put('/custom-categories', auth, vendor, async (req, res) => {
  try {
    const { categories } = req.body;
    if (!Array.isArray(categories)) {
      return res.status(400).json({ message: 'Categories must be an array' });
    }

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (!user.vendorDetails) user.vendorDetails = {};

    // Sanitize categories and breeds
    user.vendorDetails.customCategories = categories
      .map((cat) => ({
        name: (cat.name || '').trim(),
        breeds: Array.isArray(cat.breeds)
          ? cat.breeds.map((b) => (typeof b === 'string' ? b.trim() : b?.name || '')).filter(Boolean)
          : [],
      }))
      .filter((cat) => cat.name.length > 0);

    await user.save();
    res.json({
      categories: user.vendorDetails.customCategories,
      message: 'Custom categories and breeds saved successfully',
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route DELETE /api/vendor/clear/reels — Bulk remove all reels for this vendor
router.delete('/clear/reels', auth, vendor, async (req, res) => {
  try {
    const result = await Product.deleteMany({
      vendor: req.user._id,
      $or: [{ category: 'promotional' }, { 'reels.0': { $exists: true } }],
    });
    res.json({
      deletedCount: result.deletedCount,
      message: `Successfully removed ${result.deletedCount} reel(s).`,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route DELETE /api/vendor/clear/products — Bulk remove all sale products for this vendor
router.delete('/clear/products', auth, vendor, async (req, res) => {
  try {
    const result = await Product.deleteMany({
      vendor: req.user._id,
      category: { $ne: 'promotional' },
    });
    res.json({
      deletedCount: result.deletedCount,
      message: `Successfully removed ${result.deletedCount} product(s).`,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route DELETE /api/vendor/clear/categories — Bulk remove all custom categories & breeds for this vendor
router.delete('/clear/categories', auth, vendor, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (user.vendorDetails) {
      user.vendorDetails.customCategories = [];
      await user.save();
    }

    res.json({ message: 'All custom categories and breeds have been removed.' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;

