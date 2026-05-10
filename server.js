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
      // Allow requests with no origin (like mobile apps or curl)
      if (!origin) return callback(null, true);
      if (allowedOrigins.indexOf(origin) !== -1) {
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

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/vendor', vendorRoutes);
app.use('/api/enquiries', enquiryRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/chat', chatRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', name: 'FurReel API', version: '1.0.0' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);

  if (err.name === 'MulterError') {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ message: 'File too large. Max 50MB.' });
    }
    return res.status(400).json({ message: err.message });
  }

  res.status(500).json({ message: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`🐾 FurReel server running on port ${PORT}`);
});
