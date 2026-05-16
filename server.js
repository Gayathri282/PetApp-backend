require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');
const passport = require('./config/passport');
const connectDB = require('./config/db');

// Route imports
const authRoutes = require('./routes/auth');
const productRoutes = require('./routes/products');
const vendorRoutes = require('./routes/vendor');
const enquiryRoutes = require('./routes/enquiries');
const adminRoutes = require('./routes/admin');
const chatRoutes = require('./routes/chat');
const notificationRoutes = require('./routes/notifications');
const mediaRoutes = require('./routes/media');

const app = express();
const PORT = process.env.PORT || 5000;

// Connect to MongoDB
connectDB();

// Middleware
const allowedOrigins = [
  'http://localhost:5173',
  'https://pet-app-frontend-steel.vercel.app',
  'https://pet-app-frontend-m4y243n7j-gayathri282s-projects.vercel.app'
];

// Add the CLIENT_URL from env if it exists and isn't already in the list
if (process.env.CLIENT_URL) {
  const cleanUrl = process.env.CLIENT_URL.replace(/\/$/, '');
  if (!allowedOrigins.includes(cleanUrl)) allowedOrigins.push(cleanUrl);
}

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      
      const isLocal = origin.includes('localhost') || origin.includes('127.0.0.1');
      const isVercel = origin.endsWith('.vercel.app');
      const isAllowedManual = allowedOrigins.indexOf(origin) !== -1;

      if (isLocal || isVercel || isAllowedManual) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(passport.initialize());

// Static files serving (for local video storage)
const uploadsPath = path.join(__dirname, 'uploads');
app.use('/uploads', (req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
}, express.static(uploadsPath, {
  setHeaders: (res, path) => {
    if (path.endsWith('.mp4')) {
      res.set('Content-Type', 'video/mp4');
    }
  }
}));

// Routes
app.use('/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/vendor', vendorRoutes);
app.use('/api/enquiries', enquiryRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/media', mediaRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', name: 'PetPlace API', version: '1.0.0' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);

  if (err.name === 'MulterError') {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ message: 'File too large. Max 200MB.' });
    }
    return res.status(400).json({ message: err.message });
  }

  // Cloudinary or other specific errors
  if (err.message && (err.message.includes('cloudinary') || err.http_code)) {
    return res.status(err.http_code || 400).json({ message: err.message });
  }

  res.status(500).json({ 
    message: err.message || 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err : undefined
  });
});

app.listen(PORT, () => {
  console.log(`🐾 PetPlace server running on port ${PORT}`);
});
