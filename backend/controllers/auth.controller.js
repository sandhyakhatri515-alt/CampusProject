const bcrypt = require('bcryptjs');
const pool = require('../config/db');
const { generateToken } = require('../middleware/auth');
const { asyncHandler, HttpError } = require('../utils/http');
const { notify } = require('../utils/notify');

const USER_FIELDS = 'id, full_name, email, phone, college_id, department, bio, role, is_verified, is_active, profile_image, wallet_balance, created_at';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const register = asyncHandler(async (req, res) => {
  const { full_name, email, password, phone, college_id, department } = req.body;
  if (!full_name || !email || !password) throw new HttpError(400, 'Full name, email, and password are required.');
  if (!EMAIL_RE.test(email)) throw new HttpError(400, 'Invalid email format.');
  if (!/^\d{10}$/.test(String(phone || '').trim())) throw new HttpError(400, 'Phone number must be exactly 10 digits.');
  if (password.length < 8) throw new HttpError(400, 'Password must be at least 8 characters long.');
  if (password.length > 128) throw new HttpError(400, 'Password must not exceed 128 characters.');

  const cleanEmail = email.trim().toLowerCase();
  const [existing] = await pool.execute('SELECT id FROM users WHERE email = ?', [cleanEmail]);
  if (existing.length) throw new HttpError(409, 'An account with this email already exists.');

  const password_hash = await bcrypt.hash(password, 10);
  const [result] = await pool.execute(
    'INSERT INTO users (full_name, email, password_hash, phone, college_id, department) VALUES (?, ?, ?, ?, ?, ?)',
    [full_name.trim(), cleanEmail, password_hash, String(phone).trim(), college_id || null, department || null]
  );

  const [admins] = await pool.execute("SELECT id FROM users WHERE role = 'admin'");
  await Promise.all(admins.map((a) =>
    notify(a.id, `New student registration: ${full_name} (${cleanEmail}) is awaiting verification.`, { type: 'admin', link: '/admin/users' })
  ));

  const [rows] = await pool.execute(`SELECT ${USER_FIELDS} FROM users WHERE id = ?`, [result.insertId]);
  res.status(201).json({
    message: 'Registration successful. An admin will verify your account shortly.',
    token: generateToken(rows[0]),
    user: rows[0]
  });
});

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) throw new HttpError(400, 'Email and password are required.');

  const [users] = await pool.execute('SELECT * FROM users WHERE email = ?', [email.trim().toLowerCase()]);
  const user = users[0];
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    throw new HttpError(401, 'Invalid email or password.');
  }
  if (!user.is_active) throw new HttpError(403, 'This account has been suspended. Contact an administrator.');

  const { password_hash, ...userData } = user;
  res.json({ message: 'Login successful.', token: generateToken(user), user: userData });
});

const getMe = asyncHandler(async (req, res) => {
  const [rows] = await pool.execute(`SELECT ${USER_FIELDS} FROM users WHERE id = ?`, [req.user.id]);
  if (!rows.length) throw new HttpError(404, 'User not found.');
  res.json({ user: rows[0] });
});

const changePassword = asyncHandler(async (req, res) => {
  const { current_password, new_password } = req.body;
  if (!current_password || !new_password) throw new HttpError(400, 'Current and new password are required.');
  if (new_password.length < 8 || new_password.length > 128) throw new HttpError(400, 'New password must be 8-128 characters long.');

  const [rows] = await pool.execute('SELECT password_hash FROM users WHERE id = ?', [req.user.id]);
  if (!(await bcrypt.compare(current_password, rows[0].password_hash))) {
    throw new HttpError(400, 'Current password is incorrect.');
  }
  await pool.execute('UPDATE users SET password_hash = ? WHERE id = ?', [await bcrypt.hash(new_password, 10), req.user.id]);
  res.json({ message: 'Password updated successfully.' });
});

module.exports = { register, login, getMe, changePassword };
