const router = require('express').Router();
const auth = require('../middleware/auth');
const vendor = require('../middleware/vendor');
const upload = require('../middleware/upload');
const Product = require('../models/Product');
const Like = require('../models/Like');

// @route GET /api/products/feed — paginated feed of products with primary reel
router.get('/feed', auth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const products = await Product.find({ 'reels.0': { $exists: true } })
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

    const total = await Product.countDocuments({ 'reels.0': { $exists: true } });

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
    const filter = { 'reels.0': { $exists: true } };

    if (q) {
      filter.$text = { $search: q };
    }

    if (tags) {
      const tagArray = tags.split(',').map((t) => t.trim().toLowerCase());
      filter.tags = { $in: tagArray };
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
      const { name, description, category, tags, price, isOnSale } = req.body;

      const reels = (req.files?.videos || []).map((file, i) => ({
        videoUrl: `/uploads/videos/${file.filename}`,
        thumbnail: '',
        order: i,
      }));

      const images = (req.files?.images || []).map(
        (file) => `/uploads/images/${file.filename}`
      );

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

      const { name, description, category, tags, price, isOnSale } = req.body;

      if (name) product.name = name;
      if (description !== undefined) product.description = description;
      if (category) product.category = category;
      if (tags) product.tags = JSON.parse(tags);
      if (price !== undefined) product.price = parseFloat(price) || 0;
      if (isOnSale !== undefined) product.isOnSale = isOnSale === 'true';

      // Append new videos
      if (req.files?.videos) {
        if (product.reels.length + req.files.videos.length > 5) {
          return res.status(400).json({ message: 'Maximum 5 videos allowed per product' });
        }
        const newReels = req.files.videos.map((file, i) => ({
          videoUrl: `/uploads/videos/${file.filename}`,
          thumbnail: '',
          order: product.reels.length + i,
        }));
        product.reels.push(...newReels);
      }

      // Append new images
      if (req.files?.images) {
        const newImages = req.files.images.map(
          (file) => `/uploads/images/${file.filename}`
        );
        product.images.push(...newImages);
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

    res.json({ liked: true, likeCount: product.likeCount });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
