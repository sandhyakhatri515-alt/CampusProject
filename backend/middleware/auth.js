const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const pool = require('../config/db');

// Secret resolution: environment, otherwise an ephemeral random secret.
const JWT_SECRET = process.env.JWT_SECRET || (() => {
  console.warn('WARNING: JWT_SECRET is not set. Using an ephemeral secret; tokens will reset on restart.');
  return crypto.randomBytes(32).toString('hex');
})();
const JWT_EXPIRY = '24h';

// Verifies the token, then loads the user so role, verification and suspension are always current.
const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Access denied. No token provided.' });
  }

  let decoded;
  try {
    decoded = jwt.verify(authHeader.split(' ')[1], JWT_SECRET, { algorithms: ['HS256'] });
  } catch {
    return res.status(401).json({ message: 'Invalid or expired token.' });
  }

  try {
    const [rows] = await pool.execute(
      'SELECT id, email, role, is_verified, is_active FROM users WHERE id = ?',
      [decoded.id]
    );
    if (rows.length === 0 || !rows[0].is_active) {
      return res.status(401).json({ message: 'This account is no longer active.' });
    }
    req.user = { ...rows[0], is_verified: !!rows[0].is_verified };
    next();
  } catch (err) {
    next(err);
  }
};

const authorize = (...roles) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ message: 'Authentication required.' });
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ message: 'Access denied. Insufficient permissions.' });
  }
  next();
};

const requireVerified = (req, res, next) => {
  if (!req.user) return res.status(401).json({ message: 'Authentication required.' });
  if (!req.user.is_verified) {
    return res.status(403).json({ message: 'Your account must be verified by an admin before you can do this.' });
  }
  next();
};

const generateToken = (user) =>
  jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { algorithm: 'HS256', expiresIn: JWT_EXPIRY });

module.exports = { authenticate, authorize, requireVerified, generateToken };
