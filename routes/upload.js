const router = require('express').Router();
const auth = require('../middleware/auth');
const { Video } = require('../utils/muxClient');

// @route POST /api/upload/mux-url — generate direct upload URL
router.post('/mux-url', auth, async (req, res) => {
  try {
    const upload = await Video.Uploads.create({
      cors_origin: process.env.FRONTEND_URL || 'http://localhost:5173',
      new_asset_settings: {
        playback_policy: ['public'],
        video_quality: 'basic',
      },
    });

    res.json({
      url: upload.url,
      uploadId: upload.id,
    });
  } catch (error) {
    console.error('Mux Upload Error:', error);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
