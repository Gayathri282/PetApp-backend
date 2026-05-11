const Mux = require('@mux/mux-node');

let Video;

if (process.env.MUX_TOKEN_ID && process.env.MUX_TOKEN_SECRET) {
  const muxClient = new Mux(process.env.MUX_TOKEN_ID, process.env.MUX_TOKEN_SECRET);
  Video = muxClient.Video;
} else {
  console.warn('⚠️ Mux credentials missing. Video uploads will fail.');
  Video = {
    Assets: {
      create: () => { throw new Error('Mux credentials missing. Please set MUX_TOKEN_ID and MUX_TOKEN_SECRET.'); }
    }
  };
}

module.exports = { Video };
