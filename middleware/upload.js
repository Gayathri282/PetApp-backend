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
    return {
      folder: 'petplace',
      resource_type: isVideo ? 'video' : 'image',
      format: isVideo ? 'mp4' : undefined, // Optional: force video format
      public_id: `${file.fieldname}-${Date.now()}`,
    };
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
    fileSize: 100 * 1024 * 1024, // 100MB
  },
});

module.exports = upload;
