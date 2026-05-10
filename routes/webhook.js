const router = require('express').Router();
const Mux = require('@mux/mux-node');
const Product = require('../models/Product');

// @route POST /api/webhooks/mux
router.post('/mux', async (req, res) => {
  const sig = req.headers['mux-signature'];
  const secret = process.env.MUX_WEBHOOK_SECRET;

  try {
    // Verify webhook signature (requires raw body)
    Mux.Webhooks.verifyHeader(req.body, sig, secret);
    
    const event = JSON.parse(req.body.toString());
    console.log(`Mux Webhook: ${event.type}`);

    if (event.type === 'video.asset.ready') {
      const assetId = event.data.id;
      const playbackId = event.data.playback_ids[0].id;

      // Update product reel status in MongoDB
      await Product.findOneAndUpdate(
        { 'reels.muxAssetId': assetId },
        { 
          $set: { 
            'reels.$.playbackId': playbackId, 
            'reels.$.status': 'ready' 
          } 
        }
      );
      console.log(`Asset ${assetId} is ready. Playback ID: ${playbackId}`);
    } else if (event.type === 'video.asset.errored') {
      console.error('Mux Asset Errored:', event.data.errors);
    }

    res.status(200).send('Webhook acknowledged');
  } catch (error) {
    console.error('Mux Webhook Error:', error.message);
    // Always respond with 200 to Mux to prevent retries on verification failure during dev
    res.status(200).send(`Webhook Error: ${error.message}`);
  }
});

module.exports = router;
