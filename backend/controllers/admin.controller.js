const pool = require('../config/db');
const { asyncHandler, HttpError, parseId, round1 } = require('../utils/http');
const { notify } = require('../utils/notify');

// GET /api/admin/users?search
const getAllUsers = asyncHandler(async (req, res) => {
  const params = [];
  let where = '';
  if (req.query.search) {
    where = 'WHERE u.full_name LIKE ? OR u.email LIKE ? OR u.college_id LIKE ?';
    const term = `%${req.query.search}%`;
    params.push(term, term, term);
  }
  const [users] = await pool.execute(
    `SELECT u.id, u.full_name, u.email, u.phone, u.college_id, u.department, u.role, u.is_verified, u.is_active,
            u.profile_image, u.created_at,
            (SELECT COUNT(*) FROM resources WHERE owner_id = u.id) AS resource_count
     FROM users u ${where} ORDER BY u.created_at DESC`,
    params
  );
  res.json({ users });
});

// PUT /api/admin/users/:id/verify  { is_verified }
const verifyUser = asyncHandler(async (req, res) => {
  const userId = parseId(req.params.id, 'user ID');
  const { is_verified } = req.body;
  if (typeof is_verified !== 'boolean') throw new HttpError(400, 'is_verified must be a boolean.');

  const [result] = await pool.execute('UPDATE users SET is_verified = ? WHERE id = ?', [is_verified, userId]);
  if (!result.affectedRows) throw new HttpError(404, 'User not found.');

  await notify(userId, is_verified
    ? 'Your account has been verified. You can now list items and send borrow requests!'
    : 'Your account verification has been removed by an admin.', { type: 'admin', link: '/dashboard' });
  res.json({ message: is_verified ? 'User verified.' : 'Verification removed.' });
});

// PUT /api/admin/users/:id/status  { is_active }
const setUserStatus = asyncHandler(async (req, res) => {
  const userId = parseId(req.params.id, 'user ID');
  const { is_active } = req.body;
  if (typeof is_active !== 'boolean') throw new HttpError(400, 'is_active must be a boolean.');
  if (userId === req.user.id) throw new HttpError(400, 'You cannot suspend your own account.');

  const [result] = await pool.execute('UPDATE users SET is_active = ? WHERE id = ?', [is_active, userId]);
  if (!result.affectedRows) throw new HttpError(404, 'User not found.');
  res.json({ message: is_active ? 'Account reactivated.' : 'Account suspended.' });
});

// GET /api/admin/resources
const getAllResources = asyncHandler(async (req, res) => {
  const [resources] = await pool.execute(
    `SELECT r.*, u.full_name AS owner_name, u.email AS owner_email,
            c.name AS category_name, c.color AS category_color,
            (SELECT COUNT(*) FROM borrow_requests WHERE resource_id = r.id) AS borrow_count
     FROM resources r
     JOIN users u ON r.owner_id = u.id
     JOIN categories c ON r.category = c.slug
     ORDER BY r.created_at DESC`
  );
  res.json({ resources });
});

// GET /api/admin/borrows
const getAllBorrows = asyncHandler(async (req, res) => {
  const [borrows] = await pool.execute(
    `SELECT br.*, r.title AS resource_title, r.category,
            b.full_name AS borrower_name, o.full_name AS owner_name
     FROM borrow_requests br
     JOIN resources r ON br.resource_id = r.id
     JOIN users b ON br.borrower_id = b.id
     JOIN users o ON br.owner_id = o.id
     ORDER BY br.requested_at DESC`
  );
  res.json({ borrows });
});

// GET /api/admin/reports/summary
const getReportSummary = asyncHandler(async (req, res) => {
  const [[s]] = await pool.execute(
    `SELECT
       (SELECT COUNT(*) FROM users) AS total_users,
       (SELECT COUNT(*) FROM users WHERE is_verified = TRUE) AS verified_users,
       (SELECT COUNT(*) FROM users WHERE is_verified = FALSE AND role = 'student') AS pending_users,
       (SELECT COUNT(*) FROM resources) AS total_resources,
       (SELECT COUNT(*) FROM resources WHERE availability_status = 'available') AS available_resources,
       (SELECT COUNT(*) FROM resources WHERE availability_status = 'borrowed') AS borrowed_resources,
       (SELECT COUNT(*) FROM borrow_requests) AS total_borrows,
       (SELECT COUNT(*) FROM borrow_requests WHERE status = 'borrowed') AS active_borrows,
       (SELECT COUNT(*) FROM borrow_requests WHERE status = 'pending') AS pending_borrows,
       (SELECT COUNT(*) FROM borrow_requests WHERE status = 'returned') AS completed_borrows,
       (SELECT COUNT(*) FROM borrow_requests WHERE status = 'borrowed' AND due_date < CURDATE()) AS overdue_borrows,
       (SELECT COUNT(*) FROM reviews) AS total_reviews,
       (SELECT AVG(rating) FROM reviews) AS avg_rating,
       (SELECT COUNT(*) FROM reports WHERE status = 'open') AS open_reports,
       (SELECT COALESCE(SUM(amount), 0) FROM wallet_transactions WHERE type = 'deposit') AS total_deposited,
       (SELECT COUNT(*) FROM wallet_transactions WHERE type = 'deposit') AS deposit_count,
       (SELECT COALESCE(SUM(IF(fee_status = 'held', total_fee, 0) + IF(deposit_status = 'held', deposit_amount, 0)), 0) FROM borrow_requests) AS held_funds`
  );
  const [categoryDist] = await pool.execute(
    `SELECT c.name AS category, c.color, COUNT(r.id) AS count
     FROM categories c LEFT JOIN resources r ON r.category = c.slug
     GROUP BY c.slug, c.name, c.color, c.sort_order ORDER BY count DESC, c.sort_order`
  );
  const [monthly] = await pool.execute(
    `SELECT DATE_FORMAT(requested_at, '%Y-%m') AS month, COUNT(*) AS count
     FROM borrow_requests
     WHERE requested_at >= DATE_SUB(CURDATE(), INTERVAL 5 MONTH) - INTERVAL (DAY(CURDATE()) - 1) DAY
     GROUP BY month ORDER BY month`
  );
  res.json({ summary: { ...s, avg_rating: round1(s.avg_rating) || 0 }, category_distribution: categoryDist, monthly_activity: monthly });
});

// GET /api/admin/reports/top-resources
const getTopResources = asyncHandler(async (req, res) => {
  const [rows] = await pool.execute(
    `SELECT r.id, r.title, r.category, r.availability_status, r.views, u.full_name AS owner_name,
            COUNT(br.id) AS borrow_count
     FROM resources r
     JOIN users u ON r.owner_id = u.id
     LEFT JOIN borrow_requests br ON br.resource_id = r.id
     GROUP BY r.id, r.title, r.category, r.availability_status, r.views, u.full_name
     ORDER BY borrow_count DESC, r.views DESC LIMIT 8`
  );
  res.json({ top_resources: rows });
});

// GET /api/admin/payments - every deposit, hold, refund and earning in the wallets
const getPayments = asyncHandler(async (req, res) => {
  const [payments] = await pool.execute(
    `SELECT t.id, t.type, t.amount, t.balance_after, t.note, t.created_at,
            u.full_name AS user_name, r.title AS resource_title
     FROM wallet_transactions t
     JOIN users u ON t.user_id = u.id
     LEFT JOIN borrow_requests br ON t.borrow_request_id = br.id
     LEFT JOIN resources r ON br.resource_id = r.id
     ORDER BY t.id DESC LIMIT 200`
  );
  res.json({ payments });
});

// GET /api/admin/flags?status
const getFlags = asyncHandler(async (req, res) => {
  const status = ['open', 'resolved', 'dismissed'].includes(req.query.status) ? req.query.status : null;
  const [rows] = await pool.execute(
    `SELECT rp.*, r.title AS resource_title, r.owner_id, o.full_name AS owner_name, u.full_name AS reporter_name
     FROM reports rp
     JOIN resources r ON rp.resource_id = r.id
     JOIN users o ON r.owner_id = o.id
     JOIN users u ON rp.reporter_id = u.id
     ${status ? 'WHERE rp.status = ?' : ''}
     ORDER BY rp.status = 'open' DESC, rp.created_at DESC`,
    status ? [status] : []
  );
  res.json({ reports: rows });
});

// PUT /api/admin/flags/:id  { status: 'resolved' | 'dismissed', remove_listing? }
const resolveFlag = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id, 'report ID');
  const { status, remove_listing } = req.body;
  if (!['resolved', 'dismissed'].includes(status)) throw new HttpError(400, 'Status must be "resolved" or "dismissed".');

  const [rows] = await pool.execute(
    'SELECT rp.*, r.title, r.owner_id FROM reports rp JOIN resources r ON rp.resource_id = r.id WHERE rp.id = ?', [id]);
  if (!rows.length) throw new HttpError(404, 'Report not found.');
  const report = rows[0];

  await pool.execute('UPDATE reports SET status = ? WHERE id = ?', [status, id]);
  await notify(report.reporter_id, `Your report about "${report.title}" was ${status}.`, { type: 'admin' });
  if (status === 'resolved' && remove_listing) {
    await notify(report.owner_id, `Your listing "${report.title}" was removed after a community report.`, { type: 'admin' });
    await pool.execute('DELETE FROM resources WHERE id = ?', [report.resource_id]);
  }
  res.json({ message: `Report ${status}.` });
});

// DELETE /api/admin/resources/:id
const deleteResource = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id, 'resource ID');
  const [result] = await pool.execute('DELETE FROM resources WHERE id = ?', [id]);
  if (!result.affectedRows) throw new HttpError(404, 'Resource not found.');
  res.json({ message: 'Resource deleted.' });
});

module.exports = {
  getAllUsers, verifyUser, setUserStatus, getAllResources, deleteResource,
  getAllBorrows, getReportSummary, getTopResources, getFlags, resolveFlag, getPayments
};
