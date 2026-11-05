const pool = require('../config/db');
const { asyncHandler, parseId } = require('../utils/http');

// GET /api/notifications
const getNotifications = asyncHandler(async (req, res) => {
  const [notifications] = await pool.execute(
    'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC, id DESC LIMIT 50', [req.user.id]);
  const [[{ count }]] = await pool.execute(
    'SELECT COUNT(*) AS count FROM notifications WHERE user_id = ? AND is_read = FALSE', [req.user.id]);
  res.json({ notifications, unread_count: count });
});

// PUT /api/notifications/read-all
const markAllRead = asyncHandler(async (req, res) => {
  await pool.execute('UPDATE notifications SET is_read = TRUE WHERE user_id = ?', [req.user.id]);
  res.json({ message: 'All notifications marked as read.' });
});

// PUT /api/notifications/:id/read
const markRead = asyncHandler(async (req, res) => {
  await pool.execute('UPDATE notifications SET is_read = TRUE WHERE id = ? AND user_id = ?', [parseId(req.params.id), req.user.id]);
  res.json({ message: 'Notification marked as read.' });
});

// DELETE /api/notifications
const clearAll = asyncHandler(async (req, res) => {
  await pool.execute('DELETE FROM notifications WHERE user_id = ?', [req.user.id]);
  res.json({ message: 'Notifications cleared.' });
});

module.exports = { getNotifications, markAllRead, markRead, clearAll };
