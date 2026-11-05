// Wishlist, chat messages and listing reports.
const pool = require('../config/db');
const { asyncHandler, HttpError, parseId, round1 } = require('../utils/http');
const { notify } = require('../utils/notify');
const { REPORT_REASONS } = require('../utils/constants');

// ---- Wishlist ----------------------------------------------------------

// GET /api/wishlist
const getWishlist = asyncHandler(async (req, res) => {
  const [resources] = await pool.execute(
    `SELECT r.*, u.full_name AS owner_name, u.department AS owner_department,
            c.name AS category_name, c.color AS category_color, c.icon AS category_icon,
            (SELECT AVG(rating) FROM reviews WHERE reviewee_id = r.owner_id) AS owner_avg_rating,
            TRUE AS is_saved
     FROM wishlist w
     JOIN resources r ON w.resource_id = r.id
     JOIN users u ON r.owner_id = u.id
     JOIN categories c ON r.category = c.slug
     WHERE w.user_id = ?
     ORDER BY w.created_at DESC`,
    [req.user.id]
  );
  res.json({ resources: resources.map((r) => ({ ...r, is_saved: true, owner_avg_rating: round1(r.owner_avg_rating) })) });
});

// POST /api/wishlist/:resourceId  (toggles)
const toggleWishlist = asyncHandler(async (req, res) => {
  const resourceId = parseId(req.params.resourceId, 'resource ID');
  const [resources] = await pool.execute('SELECT id FROM resources WHERE id = ?', [resourceId]);
  if (!resources.length) throw new HttpError(404, 'Resource not found.');

  const [removed] = await pool.execute('DELETE FROM wishlist WHERE user_id = ? AND resource_id = ?', [req.user.id, resourceId]);
  if (removed.affectedRows) return res.json({ saved: false, message: 'Removed from saved items.' });

  await pool.execute('INSERT INTO wishlist (user_id, resource_id) VALUES (?, ?)', [req.user.id, resourceId]);
  res.json({ saved: true, message: 'Saved for later.' });
});

// ---- Messages ----------------------------------------------------------

const loadParticipantRequest = async (requestId, user) => {
  const [rows] = await pool.execute(
    `SELECT br.*, r.title AS resource_title FROM borrow_requests br
     JOIN resources r ON br.resource_id = r.id WHERE br.id = ?`,
    [requestId]
  );
  if (!rows.length) throw new HttpError(404, 'Request not found.');
  const br = rows[0];
  if (br.borrower_id !== user.id && br.owner_id !== user.id && user.role !== 'admin') {
    throw new HttpError(403, 'You are not part of this conversation.');
  }
  return br;
};

// GET /api/messages/:requestId
const getMessages = asyncHandler(async (req, res) => {
  const requestId = parseId(req.params.requestId, 'request ID');
  await loadParticipantRequest(requestId, req.user);
  const [messages] = await pool.execute(
    `SELECT m.id, m.sender_id, m.body, m.created_at, u.full_name AS sender_name
     FROM messages m JOIN users u ON m.sender_id = u.id
     WHERE m.borrow_request_id = ? ORDER BY m.created_at ASC, m.id ASC`,
    [requestId]
  );
  res.json({ messages });
});

// POST /api/messages/:requestId
const sendMessage = asyncHandler(async (req, res) => {
  const requestId = parseId(req.params.requestId, 'request ID');
  const body = (req.body.body || '').trim();
  if (!body) throw new HttpError(400, 'Message cannot be empty.');
  if (body.length > 1000) throw new HttpError(400, 'Message must not exceed 1000 characters.');

  const br = await loadParticipantRequest(requestId, req.user);
  if (br.borrower_id !== req.user.id && br.owner_id !== req.user.id) throw new HttpError(403, 'Only participants can send messages.');

  const [result] = await pool.execute('INSERT INTO messages (borrow_request_id, sender_id, body) VALUES (?, ?, ?)', [requestId, req.user.id, body]);
  const other = req.user.id === br.owner_id ? br.borrower_id : br.owner_id;
  const [[me]] = await pool.execute('SELECT full_name FROM users WHERE id = ?', [req.user.id]);
  await notify(other, `${me.full_name} sent a message about "${br.resource_title}".`, { type: 'message', link: '/requests' });

  res.status(201).json({
    message: { id: result.insertId, sender_id: req.user.id, sender_name: me.full_name, body, created_at: new Date().toISOString() }
  });
});

// ---- Reports -----------------------------------------------------------

// POST /api/reports
const createReport = asyncHandler(async (req, res) => {
  const { resource_id, reason, details } = req.body;
  const resourceId = parseId(resource_id, 'resource ID');
  if (!REPORT_REASONS.includes(reason)) throw new HttpError(400, 'Please choose a valid reason.');

  const [resources] = await pool.execute('SELECT id, title FROM resources WHERE id = ?', [resourceId]);
  if (!resources.length) throw new HttpError(404, 'Resource not found.');
  const [dup] = await pool.execute("SELECT id FROM reports WHERE reporter_id = ? AND resource_id = ? AND status = 'open'", [req.user.id, resourceId]);
  if (dup.length) throw new HttpError(400, 'You have already reported this listing. An admin will review it soon.');

  await pool.execute('INSERT INTO reports (reporter_id, resource_id, reason, details) VALUES (?, ?, ?, ?)',
    [req.user.id, resourceId, reason, (details || '').slice(0, 1000) || null]);

  const [admins] = await pool.execute("SELECT id FROM users WHERE role = 'admin'");
  await Promise.all(admins.map((a) =>
    notify(a.id, `A listing was reported: "${resources[0].title}" (${reason}).`, { type: 'admin', link: '/admin/reports' })));

  res.status(201).json({ message: 'Report submitted. Thank you for helping keep the community safe.' });
});

module.exports = { getWishlist, toggleWishlist, getMessages, sendMessage, createReport };
