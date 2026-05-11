const router = require('express').Router();
const auth = require('../middleware/auth');
const Notification = require('../models/Notification');

// @route GET /api/notifications
router.get('/', auth, async (req, res) => {
  try {
    const notifications = await Notification.find({ recipient: req.user._id })
      .sort({ createdAt: -1 })
      .populate('sender', 'name avatar')
      .populate('product', 'name reels')
      .limit(50);
    
    res.json({ notifications });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route PUT /api/notifications/read
router.put('/read', auth, async (req, res) => {
  try {
    await Notification.updateMany({ recipient: req.user._id, read: false }, { read: true });
    res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
