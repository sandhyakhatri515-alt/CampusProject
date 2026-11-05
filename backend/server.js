const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
require('dotenv').config();
const pool = require('./config/db');

const app = express();
const PORT = process.env.PORT || 5000;

// Security headers
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'blob:'],
      connectSrc: ["'self'"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"]
    }
  }
}));

// CORS - strict origin
app.use(cors({
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests, please try again later.' }
});
app.use(limiter);

// Auth-specific stricter rate limit
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { message: 'Too many authentication attempts, please try again later.' }
});

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files statically with security headers
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
  setHeaders: (res) => {
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('Content-Disposition', 'inline');
  }
}));

// Routes
app.use('/api/auth', authLimiter, require('./routes/auth.routes'));
app.use('/api/users', require('./routes/user.routes'));
app.use('/api/resources', require('./routes/resource.routes'));
app.use('/api/borrows', require('./routes/borrow.routes'));
app.use('/api/reviews', require('./routes/review.routes'));
app.use('/api/admin', require('./routes/admin.routes'));
app.use('/api/notifications', require('./routes/notification.routes'));
app.use('/api/wallet', require('./routes/wallet.routes'));
app.use('/api', require('./routes/social.routes'));
app.use('/api', require('./routes/public.routes'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found.' });
});

// Global error handler - don't expose internal errors to clients
app.use((err, req, res, next) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ message: 'File too large. Maximum size is 5MB.' });
  }
  if (err.name === 'MulterError' || (err.message && /image files|file extension/i.test(err.message))) {
    return res.status(400).json({ message: err.message });
  }
  if (err.status && err.status < 500) {
    return res.status(err.status).json({ message: err.message });
  }
  console.error(err);
  res.status(500).json({ message: 'Internal server error.' });
});

// Listen only after confirming the database is available.
const startServer = async () => {
  try {
    const connection = await pool.getConnection();
    const [tables] = await connection.query('SHOW TABLES');
    connection.release();
    const present = new Set(tables.map((row) => Object.values(row)[0]));
    const required = ['users', 'categories', 'resources', 'borrow_requests', 'reviews', 'notifications', 'wishlist', 'messages', 'reports', 'wallet_transactions'];
    const missing = required.filter((name) => !present.has(name));
    if (missing.length > 0) {
      console.error(`Database schema is out of date (missing tables: ${missing.join(', ')}).`);
      console.error('Run "npm run db:setup" in the backend folder (it recreates all tables and demo data), then start the server again.');
      process.exitCode = 1;
      return;
    }

    app.listen(PORT, '127.0.0.1', () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error(`Database connection failed (${error.code || 'UNKNOWN'}): ${error.message}`);
    console.error('Check DB_HOST, DB_USER, DB_PASS, and DB_NAME in backend/.env.');
    process.exitCode = 1;
  }
};

if (require.main === module) {
  startServer();
}

module.exports = app;
