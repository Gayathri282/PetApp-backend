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
      .populate('sender', 'name avatar contactNumber')
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
      // Check if the otherUserId is an admin
      const targetUser = await User.findById(otherUserId).select('role');
      if (targetUser?.role === 'admin') {
        const admins = await User.find({ role: 'admin' }).distinct('_id');
        filter = {
          $or: [
            { sender: req.user._id, receiver: { $in: admins } },
            { sender: { $in: admins }, receiver: req.user._id },
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
    }

    let messages = await Message.find(filter)
      .sort({ createdAt: 1 })
      .populate('sender', 'name avatar contactNumber')
      .populate('product', 'name price')
      .lean();

    // Only show adminOnlyContent to admins
    messages = messages.map(m => {
      if (req.user.role !== 'admin') {
        const { adminOnlyContent, ...rest } = m;
        return rest;
      }
      return m;
    });

    // Mark all unread messages from the other user as read
    await Message.updateMany(
      { sender: otherUserId, receiver: req.user._id, read: false },
      { read: true }
    );

    // If current user is not admin and is opening a chat with an admin,
    // also mark all other admin messages as read (since they are grouped)
    if (req.user.role !== 'admin') {
      const targetUser = await User.findById(otherUserId).select('role');
      if (targetUser?.role === 'admin') {
        const admins = await User.find({ role: 'admin' }).distinct('_id');
        await Message.updateMany(
          { sender: { $in: admins }, receiver: req.user._id, read: false },
          { read: true }
        );
      }
    }

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
    const adminIds = await User.find({ role: 'admin' }).distinct('_id').then(ids => ids.map(id => id.toString()));

    for (const m of messages) {
      let otherId = m.sender.toString() === req.user._id.toString() ? m.receiver.toString() : m.sender.toString();
      
      // If user is NOT admin, group all admin messages into a single "Support" convo
      let isConvoWithAdmin = false;
      if (req.user.role !== 'admin' && adminIds.includes(otherId)) {
        otherId = 'admin_support';
        isConvoWithAdmin = true;
      }

      if (!seen.has(otherId)) {
        seen.add(otherId);
        
        let otherUser;
        if (isConvoWithAdmin) {
          otherUser = {
            _id: adminIds[0],
            name: 'PetPlace Support',
            avatar: '',
            role: 'admin'
          };
        } else {
          otherUser = await User.findById(otherId).select('name avatar contactNumber role').lean();
        }

        if (otherUser) {
          // Check if there are ANY unread messages in this conversation
          const hasUnread = messages.some(msg => {
            let msgOtherId = msg.sender.toString() === req.user._id.toString() ? msg.receiver.toString() : msg.sender.toString();
            if (req.user.role !== 'admin' && adminIds.includes(msgOtherId)) msgOtherId = 'admin_support';
            
            return msgOtherId === otherId && !msg.read && msg.receiver.toString() === req.user._id.toString();
          });

          convos.push({
            user: otherUser,
            lastMessage: m.content,
            createdAt: m.createdAt,
            unread: hasUnread
          });
        }
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
