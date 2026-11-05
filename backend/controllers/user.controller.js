const pool = require('../config/db');
const { asyncHandler, HttpError, parseId, round1 } = require('../utils/http');

const USER_FIELDS = 'id, full_name, email, phone, college_id, department, bio, role, is_verified, profile_image, created_at';

const getUserById = asyncHandler(async (req, res) => {
  const userId = parseId(req.params.id, 'user ID');
  const [users] = await pool.execute(`SELECT ${USER_FIELDS} FROM users WHERE id = ? AND is_active = TRUE`, [userId]);
  if (!users.length) throw new HttpError(404, 'User not found.');

  const [[rating]] = await pool.execute(
    'SELECT AVG(rating) AS avg_rating, COUNT(*) AS total_reviews FROM reviews WHERE reviewee_id = ?', [userId]);
  const [[counts]] = await pool.execute(
    `SELECT (SELECT COUNT(*) FROM resources WHERE owner_id = ?) AS resources_shared,
            (SELECT COUNT(*) FROM borrow_requests WHERE owner_id = ? AND status = 'returned') AS lent_count,
            (SELECT COUNT(*) FROM borrow_requests WHERE borrower_id = ? AND status = 'returned') AS borrowed_count`,
    [userId, userId, userId]);

  const user = { ...users[0], avg_rating: round1(rating.avg_rating), total_reviews: rating.total_reviews, ...counts };
  // Contact details are only visible to the user themselves and to admins.
  if (req.user.id !== userId && req.user.role !== 'admin') {
    delete user.email;
    delete user.phone;
  }
  res.json({ user });
});

const updateProfile = asyncHandler(async (req, res) => {
  const { full_name, phone, college_id, department, bio } = req.body;
  const updates = [];
  const values = [];
  if (full_name) { updates.push('full_name = ?'); values.push(full_name.trim()); }
  if (phone !== undefined) {
    const p = String(phone || '').trim();
    if (p && !/^\d{10}$/.test(p)) throw new HttpError(400, 'Phone number must be exactly 10 digits.');
    updates.push('phone = ?'); values.push(p || null);
  }
  if (college_id !== undefined) { updates.push('college_id = ?'); values.push(college_id || null); }
  if (department !== undefined) { updates.push('department = ?'); values.push(department || null); }
  if (bio !== undefined) { updates.push('bio = ?'); values.push((bio || '').slice(0, 500) || null); }
  if (req.file) { updates.push('profile_image = ?'); values.push(`/uploads/${req.file.filename}`); }
  if (!updates.length) throw new HttpError(400, 'No fields to update.');

  await pool.execute(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, [...values, req.user.id]);
  const [rows] = await pool.execute(`SELECT ${USER_FIELDS} FROM users WHERE id = ?`, [req.user.id]);
  res.json({ message: 'Profile updated successfully.', user: rows[0] });
});

module.exports = { getUserById, updateProfile };
