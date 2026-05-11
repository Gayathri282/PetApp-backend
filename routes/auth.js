const router = require('express').Router();
const passport = require('passport');
const jwt = require('jsonwebtoken');
const auth = require('../middleware/auth');
const upload = require('../middleware/upload');

// @route GET /auth/google
router.get(
  '/google',
  passport.authenticate('google', {
    scope: ['profile', 'email'],
    session: false,
  })
);

// @route GET /auth/google/callback
router.get(
  '/google/callback',
  passport.authenticate('google', {
    session: false,
    failureRedirect: `${process.env.CLIENT_URL}/login?error=auth_failed`,
  }),
  (req, res) => {
    const token = jwt.sign(
      { id: req.user._id },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.cookie('jwt', token, {
      httpOnly: true,
      secure: true, // Always true for cross-site sameSite:'none'
      sameSite: 'none', // Required for Render -> Vercel communication
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    const clientUrl = process.env.CLIENT_URL.replace(/\/$/, '');
    res.redirect(`${clientUrl}/feed?token=${token}`);
  }
);

// @route GET /auth/me
router.get('/me', auth, (req, res) => {
  res.json({ user: req.user });
});

// @route PUT /auth/me — update profile
router.put('/me', auth, upload.single('avatar'), async (req, res) => {
  try {
    const { name, contactNumber, address, location } = req.body;
    const user = req.user;

    if (name) user.name = name;
    if (contactNumber !== undefined) user.contactNumber = contactNumber;
    if (address !== undefined) user.address = address;
    if (location !== undefined) {
      try {
        const loc = typeof location === 'string' ? JSON.parse(location) : location;
        user.location = loc;
        user.markModified('location');
      } catch (e) {
        console.error('Failed to parse location:', e);
      }
    }
    
    if (req.file) {
      user.avatar = `/uploads/images/${req.file.filename}`;
    }

    await user.save();
    res.json({ user, message: 'Profile updated successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route POST /auth/logout
router.post('/logout', (req, res) => {
  res.clearCookie('jwt');
  res.json({ message: 'Logged out successfully' });
});

module.exports = router;
