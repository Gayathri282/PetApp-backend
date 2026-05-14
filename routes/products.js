const router = require('express').Router();
const auth = require('../middleware/auth');
const vendor = require('../middleware/vendor');
const upload = require('../middleware/upload');
const Product = require('../models/Product');
const Like = require('../models/Like');

// @route GET /api/products/feed
router.get('/feed', auth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const products = await Product.find({ 'reels.0': { $exists: true }, status: 'approved' })
      .populate('vendor', 'name avatar')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    // Get user's likes for these products
    const productIds = products.map((p) => p._id);
    const userLikes = await Like.find({
      user: req.user._id,
      product: { $in: productIds },
    }).lean();

    const likeMap = {};
    userLikes.forEach((l) => {
      const key = `${l.product}_${l.reelIndex}`;
      likeMap[key] = true;
    });

    const feed = products.map((p) => ({
      ...p,
      hasMultipleReels: p.reels.length > 1,
      primaryReel: p.reels[0] || null,
      isLiked: !!likeMap[`${p._id}_0`],
    }));

    const total = await Product.countDocuments({ 'reels.0': { $exists: true }, status: 'approved' });

    res.json({
      products: feed,
      page,
      totalPages: Math.ceil(total / limit),
      hasMore: skip + limit < total,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route GET /api/products/search
router.get('/search', auth, async (req, res) => {
  try {
    const { q, tags } = req.query;
    const filter = { 'reels.0': { $exists: true }, status: 'approved' };

    // Handle Text Search
    if (q) {
      filter.$text = { $search: q };
    }

    // Handle Tags & Special Filters
    if (tags) {
      const tagArray = tags.split(',').map((t) => t.trim().toLowerCase());
      
      // Separate regular tags from special filters
      const specialFilters = tagArray.filter(t => ['on sale', 'not for sale', 'near me'].includes(t));
      const regularTags = tagArray.filter(t => !['on sale', 'not for sale', 'near me'].includes(t));

      if (regularTags.length > 0) {
        filter.tags = { $in: regularTags };
      }

      if (specialFilters.includes('on sale')) {
        filter.isOnSale = true;
      } else if (specialFilters.includes('not for sale')) {
        filter.isOnSale = false;
      }

      if (specialFilters.includes('near me') && req.user.location?.coordinates?.[0] !== 0) {
        // Find nearby vendors first
        const User = require('../models/User');
        const nearbyVendors = await User.find({
          role: 'vendor',
          location: {
            $near: {
              $geometry: {
                type: 'Point',
                coordinates: req.user.location.coordinates,
              },
              $maxDistance: 50000, // 50km radius
            },
          },
        }).select('_id');
        
        const vendorIds = nearbyVendors.map(v => v._id);
        filter.vendor = { $in: vendorIds };
      }
    }

    const products = await Product.find(filter)
      .populate('vendor', 'name avatar')
      .sort(q ? { score: { $meta: 'textScore' } } : { createdAt: -1 })
      .limit(50)
      .lean();

    const results = products.map((p) => ({
      ...p,
      primaryReel: p.reels[0] || null,
      hasMultipleReels: p.reels.length > 1,
    }));

    res.json({ products: results });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route GET /api/products/:id — full product with all reels
router.get('/:id', auth, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)
      .populate('vendor', 'name avatar')
      .lean();

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    // Get likes for all reels
    const userLikes = await Like.find({
      user: req.user._id,
      product: product._id,
    }).lean();

    const likeSet = new Set(userLikes.map((l) => l.reelIndex));

    product.reels = product.reels.map((reel, i) => ({
      ...reel,
      isLiked: likeSet.has(i),
    }));

    res.json({ product });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route POST /api/products — create product (vendor only)
router.post(
  '/',
  auth,
  vendor,
  upload.fields([
    { name: 'videos', maxCount: 5 },
    { name: 'images', maxCount: 10 },
  ]),
  async (req, res) => {
    try {
      console.log('--- PRODUCT UPLOAD ATTEMPT ---');
      console.log('User:', req.user._id, req.user.role);
      console.log('Files:', req.files ? Object.keys(req.files) : 'NONE');
      
      const { name, description, category, tags, price, isOnSale, videoUrls, imageUrls } = req.body;
      
      // Parse pre-uploaded URLs if they exist
      const directReels = videoUrls ? (typeof videoUrls === 'string' ? JSON.parse(videoUrls) : videoUrls).map((url, i) => ({
        videoUrl: url,
        thumbnail: '',
        order: i
      })) : [];

      const directImages = imageUrls ? (typeof imageUrls === 'string' ? JSON.parse(imageUrls) : imageUrls) : [];

      const fileReels = (req.files?.videos || []).map((file, i) => ({
        videoUrl: file.path,
        thumbnail: '',
        order: directReels.length + i,
      }));

      const fileImages = (req.files?.images || []).map(
        (file) => file.path
      );

      const reels = [...directReels, ...fileReels];
      const images = [...directImages, ...fileImages];

      if (reels.length === 0) {
        return res.status(400).json({ message: 'At least one video is required' });
      }

      const product = await Product.create({
        vendor: req.user._id,
        name,
        description,
        category: category || 'other',
        tags: tags ? JSON.parse(tags) : [],
        price: parseFloat(price) || 0,
        isOnSale: isOnSale === 'true',
        deliveryChargesAdditional: req.body.deliveryChargesAdditional === 'true',
        reels,
        images,
      });

      await product.populate('vendor', 'name avatar');

      res.status(201).json({ product });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
);

// @route PUT /api/products/:id — update product (owner vendor only)
router.put(
  '/:id',
  auth,
  vendor,
  upload.fields([
    { name: 'videos', maxCount: 5 },
    { name: 'images', maxCount: 10 },
  ]),
  async (req, res) => {
    try {
      const product = await Product.findById(req.params.id);
      if (!product) {
        return res.status(404).json({ message: 'Product not found' });
      }

      if (product.vendor.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: 'Not authorized' });
      }

      const { name, description, category, tags, price, isOnSale, deliveryChargesAdditional, videoUrls, imageUrls } = req.body;

      if (name) product.name = name;
      if (description !== undefined) product.description = description;
      if (category) product.category = category;
      if (tags) product.tags = JSON.parse(tags);
      if (price !== undefined) product.price = parseFloat(price) || 0;
      if (isOnSale !== undefined) product.isOnSale = String(isOnSale) === 'true';
      if (deliveryChargesAdditional !== undefined) product.deliveryChargesAdditional = String(deliveryChargesAdditional) === 'true';

      // Reset status to pending on any update to require re-verification
      product.status = 'pending';

      // Handle pre-uploaded URLs
      if (videoUrls) {
        const urls = typeof videoUrls === 'string' ? JSON.parse(videoUrls) : videoUrls;
        const newReels = urls.map((url, i) => ({
          videoUrl: url,
          thumbnail: '',
          order: product.reels.length + i,
        }));
        product.reels.push(...newReels);
      }
      
      if (imageUrls) {
        const urls = typeof imageUrls === 'string' ? JSON.parse(imageUrls) : imageUrls;
        product.images.push(...urls);
      }

      // Append new files
      if (req.files?.videos) {
        if (product.reels.length + req.files.videos.length > 5) {
          return res.status(400).json({ message: 'Maximum 5 videos allowed per product' });
        }
        const fileReels = req.files.videos.map((file, i) => ({
          videoUrl: file.path,
          thumbnail: '',
          order: product.reels.length + i,
        }));
        product.reels.push(...fileReels);
      }

      // Append new image files
      if (req.files?.images) {
        const fileImages = req.files.images.map(
          (file) => file.path
        );
        product.images.push(...fileImages);
      }

      await product.save();
      await product.populate('vendor', 'name avatar');

      res.json({ product });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
);

// @route DELETE /api/products/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    // Allow owner vendor or admin
    const isOwner = product.vendor.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'admin';
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    await Product.findByIdAndDelete(req.params.id);
    await Like.deleteMany({ product: req.params.id });

    res.json({ message: 'Product deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route POST /api/products/:id/reels/:reelIndex/like — toggle like
router.post('/:id/reels/:reelIndex/like', auth, async (req, res) => {
  try {
    const { id, reelIndex } = req.params;
    const idx = parseInt(reelIndex);

    const product = await Product.findById(id);
    if (!product || !product.reels[idx]) {
      return res.status(404).json({ message: 'Reel not found' });
    }

    const existing = await Like.findOne({
      user: req.user._id,
      product: id,
      reelIndex: idx,
    });

    if (existing) {
      await Like.findByIdAndDelete(existing._id);
      product.likeCount = Math.max(0, product.likeCount - 1);
      await product.save();
      return res.json({ liked: false, likeCount: product.likeCount });
    }

    await Like.create({ user: req.user._id, product: id, reelIndex: idx });
    product.likeCount += 1;
    await product.save();

    // Notify vendor
    if (product.vendor.toString() !== req.user._id.toString()) {
      const Notification = require('../models/Notification');
      await Notification.create({
        recipient: product.vendor,
        sender: req.user._id,
        type: 'like',
        product: product._id,
        reelIndex: idx,
        message: `${req.user.name} liked your reel "${product.name}"`
      });
    }

    res.json({ liked: true, likeCount: product.likeCount });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
