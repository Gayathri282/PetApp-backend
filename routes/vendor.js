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

    const { businessName, description, contactEmail, contactNumber, address } = req.body;

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
    });

    res.status(201).json({ application, message: 'Application submitted successfully' });
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
      .populate('vendor', 'name avatar')
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
      const videoFile = req.files?.video?.[0];
      if (!videoFile) {
        return res.status(400).json({ message: 'Video file is required' });
      }

      const { name, description, tags } = req.body;

      const { Video } = require('../utils/muxClient');
      const asset = await Video.Assets.create({
        input: path.join(__dirname, '..', 'uploads', 'videos', videoFile.filename),
        playback_policy: ['public'],
      });

      const product = await Product.create({
        vendor: req.user._id,
        name: name || 'Promotional Reel',
        description: description || '',
        category: 'promotional',
        tags: tags ? JSON.parse(tags) : [],
        price: 0,
        isOnSale: false,
        reels: [
          {
            videoUrl: `https://stream.mux.com/${asset.playback_ids[0].id}.m3u8`,
            thumbnail: `https://image.mux.com/${asset.playback_ids[0].id}/thumbnail.jpg`,
            order: 0,
          },
        ],
      });

      await product.populate('vendor', 'name avatar');

      res.status(201).json({ product });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
);

module.exports = router;
