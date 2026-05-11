const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure upload directories exist
const videosDir = path.join(__dirname, '..', 'uploads', 'videos');
const imagesDir = path.join(__dirname, '..', 'uploads', 'images');
fs.mkdirSync(videosDir, { recursive: true });
fs.mkdirSync(imagesDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (file.mimetype.startsWith('video/')) {
      cb(null, videosDir);
    } else {
      cb(null, imagesDir);
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
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
