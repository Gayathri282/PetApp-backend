const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    const isVideo = file.mimetype.startsWith('video/');
    const params = {
      folder: 'petplace',
      resource_type: isVideo ? 'video' : 'image',
      public_id: `${file.fieldname}-${Date.now()}`,
    };

    if (isVideo) {
      params.transformation = [
        { width: 720, crop: 'limit' },
        { quality: 'auto:good' },
        { fetch_format: 'mp4' },
        { audio_codec: 'aac' },
      ];
    }

    return params;
  },
});

const fileFilter = (req, file, cb) => {
  const allowedVideo = ['video/mp4', 'video/webm', 'video/quicktime'];
  const allowedImage = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

  if ([...allowedVideo, ...allowedImage].includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only MP4, WebM, MOV, JPEG, PNG, WebP, GIF allowed.'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 200 * 1024 * 1024, // 200MB
  },
});

module.exports = upload;
