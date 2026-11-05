// Public landing-page data, category list and the signed-in user's dashboard.
const pool = require('../config/db');
const { asyncHandler, round1 } = require('../utils/http');
const { CONDITIONS, REPORT_REASONS } = require('../utils/constants');

// GET /api/public/overview  (no auth)
const getOverview = asyncHandler(async (req, res) => {
  const [[stats]] = await pool.execute(
    `SELECT (SELECT COUNT(*) FROM users WHERE is_verified = TRUE) AS members,
            (SELECT COUNT(*) FROM resources WHERE availability_status <> 'unavailable') AS resources,
            (SELECT COUNT(*) FROM borrow_requests WHERE status = 'returned') AS successful_loans`
  );
  const [featured] = await pool.execute(
    `SELECT r.id, r.title, r.category, r.image_url, r.availability_status, c.name AS category_name,
            c.color AS category_color, c.icon AS category_icon, u.full_name AS owner_name
     FROM resources r
     JOIN categories c ON r.category = c.slug
     JOIN users u ON r.owner_id = u.id
     WHERE r.availability_status = 'available'
     ORDER BY r.views DESC, r.created_at DESC LIMIT 6`
  );
  res.json({ stats, featured });
});

// GET /api/categories  (no auth)
const getCategories = asyncHandler(async (req, res) => {
  const [categories] = await pool.execute(
    `SELECT c.*, COUNT(r.id) AS resource_count
     FROM categories c
     LEFT JOIN resources r ON r.category = c.slug AND r.availability_status <> 'unavailable'
     GROUP BY c.slug, c.name, c.icon, c.color, c.sort_order
     ORDER BY c.sort_order`
  );
  res.json({ categories });
});

// GET /api/lookups  (no auth: the register form needs departments)
// Option lists grow from real data, so new departments and pick-up spots show up automatically.
const getLookups = asyncHandler(async (req, res) => {
  const [departments] = await pool.execute(
    `SELECT department AS name, COUNT(*) AS count FROM users
     WHERE department IS NOT NULL AND TRIM(department) <> ''
     GROUP BY department ORDER BY count DESC, name LIMIT 100`
  );
  const [locations] = await pool.execute(
    `SELECT location AS name, COUNT(*) AS count FROM resources
     WHERE location IS NOT NULL AND TRIM(location) <> '' AND availability_status <> 'unavailable'
     GROUP BY location ORDER BY count DESC, name LIMIT 100`
  );
  res.json({ conditions: CONDITIONS, report_reasons: REPORT_REASONS, departments, locations });
});

// GET /api/dashboard
const getDashboard = asyncHandler(async (req, res) => {
  const uid = req.user.id;
  const [[stats]] = await pool.execute(
    `SELECT
       (SELECT COUNT(*) FROM resources WHERE owner_id = ?) AS my_resources,
       (SELECT COUNT(*) FROM borrow_requests WHERE borrower_id = ? AND status = 'borrowed') AS borrowing_now,
       (SELECT COUNT(*) FROM borrow_requests WHERE owner_id = ? AND status = 'borrowed') AS lent_out,
       (SELECT COUNT(*) FROM borrow_requests WHERE owner_id = ? AND status = 'pending') AS incoming_pending,
       (SELECT COUNT(*) FROM borrow_requests WHERE borrower_id = ? AND status = 'pending') AS outgoing_pending,
       (SELECT COUNT(*) FROM wishlist WHERE user_id = ?) AS saved_items,
       (SELECT COUNT(*) FROM borrow_requests WHERE (borrower_id = ? OR owner_id = ?) AND status = 'returned') AS completed,
       (SELECT AVG(rating) FROM reviews WHERE reviewee_id = ?) AS avg_rating,
       (SELECT COUNT(*) FROM reviews WHERE reviewee_id = ?) AS total_reviews,
       (SELECT COUNT(*) FROM borrow_requests WHERE owner_id = ? AND status = 'accepted') AS to_release,
       (SELECT COALESCE(SUM(amount), 0) FROM wallet_transactions WHERE user_id = ? AND type = 'earning') AS earnings,
       (SELECT wallet_balance FROM users WHERE id = ?) AS wallet_balance`,
    [uid, uid, uid, uid, uid, uid, uid, uid, uid, uid, uid, uid, uid]
  );

  const [due] = await pool.execute(
    `SELECT br.id, br.due_date, br.borrow_date, r.id AS resource_id, r.title, r.image_url, r.category,
            c.color AS category_color, c.icon AS category_icon, o.full_name AS owner_name,
            DATEDIFF(br.due_date, CURDATE()) AS days_left
     FROM borrow_requests br
     JOIN resources r ON br.resource_id = r.id
     JOIN categories c ON r.category = c.slug
     JOIN users o ON br.owner_id = o.id
     WHERE br.borrower_id = ? AND br.status = 'borrowed'
     ORDER BY br.due_date ASC LIMIT 5`,
    [uid]
  );

  const [incoming] = await pool.execute(
    `SELECT br.id, br.request_message, br.borrow_date, br.due_date, r.title, u.full_name AS borrower_name
     FROM borrow_requests br
     JOIN resources r ON br.resource_id = r.id
     JOIN users u ON br.borrower_id = u.id
     WHERE br.owner_id = ? AND br.status = 'pending'
     ORDER BY br.requested_at DESC LIMIT 5`,
    [uid]
  );

  const [recent] = await pool.execute(
    'SELECT id, type, message, link, is_read, created_at FROM notifications WHERE user_id = ? ORDER BY created_at DESC, id DESC LIMIT 6',
    [uid]
  );

  res.json({ stats: { ...stats, avg_rating: round1(stats.avg_rating) }, due_soon: due, incoming, recent_activity: recent });
});

module.exports = { getOverview, getCategories, getLookups, getDashboard };
