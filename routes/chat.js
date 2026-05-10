const router = require('express').Router();
const auth = require('../middleware/auth');
const Message = require('../models/Message');
const User = require('../models/User');

// @route POST /api/chat — send message
router.post('/', auth, async (req, res) => {
  try {
    const { receiverId, content, enquiryId, productId } = req.body;

    if (!receiverId || !content) {
      return res.status(400).json({ message: 'Receiver and content required' });
    }

    const message = await Message.create({
      sender: req.user._id,
      receiver: receiverId,
      content,
      enquiry: enquiryId,
      product: productId,
    });

    const populated = await Message.findById(message._id)
      .populate('sender', 'name avatar')
      .populate('product', 'name price');

    res.status(201).json({ message: populated });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route GET /api/chat/messages/:otherUserId
router.get('/messages/:otherUserId', auth, async (req, res) => {
  try {
    const { otherUserId } = req.params;

    let filter;
    if (req.user.role === 'admin') {
      // Admins can see messages between this user and ANY admin
      const admins = await User.find({ role: 'admin' }).distinct('_id');
      filter = {
        $or: [
          { sender: otherUserId, receiver: { $in: admins } },
          { sender: { $in: admins }, receiver: otherUserId },
        ],
      };
    } else {
      filter = {
        $or: [
          { sender: req.user._id, receiver: otherUserId },
          { sender: otherUserId, receiver: req.user._id },
        ],
      };
    }

    const messages = await Message.find(filter)
      .sort({ createdAt: 1 })
      .populate('sender', 'name avatar')
      .populate('product', 'name price')
      .lean();

    // Mark as read
    await Message.updateMany(
      { sender: otherUserId, receiver: req.user._id, read: false },
      { read: true }
    );

    res.json({ messages });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route GET /api/chat/conversations
router.get('/conversations', auth, async (req, res) => {
  try {
    let filter;
    if (req.user.role === 'admin') {
      const admins = await User.find({ role: 'admin' }).distinct('_id');
      filter = {
        $or: [
          { sender: { $in: admins } },
          { receiver: { $in: admins } }
        ]
      };
    } else {
      filter = { $or: [{ sender: req.user._id }, { receiver: req.user._id }] };
    }

    const messages = await Message.find(filter)
      .sort({ createdAt: -1 })
      .lean();

    const convos = [];
    const seen = new Set();

    for (const m of messages) {
      const otherId = m.sender.toString() === req.user._id.toString() ? m.receiver.toString() : m.sender.toString();
      if (!seen.has(otherId)) {
        seen.add(otherId);
        const otherUser = await User.findById(otherId).select('name avatar contactNumber role').lean();
        convos.push({
          user: otherUser,
          lastMessage: m.content,
          createdAt: m.createdAt,
          unread: !m.read && m.receiver.toString() === req.user._id.toString()
        });
      }
    }

    res.json({ conversations: convos });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route GET /api/chat/admin-user
router.get('/admin-user', auth, async (req, res) => {
  try {
    const admin = await User.findOne({ role: 'admin' }).select('name avatar role');
    if (!admin) return res.status(404).json({ message: 'Admin not found' });
    res.json({ admin });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
