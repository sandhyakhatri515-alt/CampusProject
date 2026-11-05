const pool = require('../config/db');
const { asyncHandler, HttpError, parseId, round1 } = require('../utils/http');
const { notify } = require('../utils/notify');

// POST /api/reviews
const createReview = asyncHandler(async (req, res) => {
  const { borrow_request_id, rating, comment } = req.body;
  if (!borrow_request_id || !rating) throw new HttpError(400, 'Borrow request and rating are required.');

  const stars = parseInt(rating, 10);
  if (Number.isNaN(stars) || stars < 1 || stars > 5) throw new HttpError(400, 'Rating must be between 1 and 5.');
  const reqId = parseId(borrow_request_id, 'borrow request ID');

  const [requests] = await pool.execute('SELECT * FROM borrow_requests WHERE id = ?', [reqId]);
  if (!requests.length) throw new HttpError(404, 'Borrow request not found.');
  const br = requests[0];

  if (br.status !== 'returned') throw new HttpError(400, 'You can only review after the item has been returned.');
  if (br.borrower_id !== req.user.id && br.owner_id !== req.user.id) {
    throw new HttpError(403, 'You are not part of this borrow transaction.');
  }

  const revieweeId = req.user.id === br.borrower_id ? br.owner_id : br.borrower_id;
  const [existing] = await pool.execute('SELECT id FROM reviews WHERE borrow_request_id = ? AND reviewer_id = ?', [reqId, req.user.id]);
  if (existing.length) throw new HttpError(400, 'You have already reviewed this transaction.');

  const [result] = await pool.execute(
    'INSERT INTO reviews (borrow_request_id, reviewer_id, reviewee_id, rating, comment) VALUES (?, ?, ?, ?, ?)',
    [reqId, req.user.id, revieweeId, stars, (comment || '').slice(0, 1000) || null]
  );

  const [[reviewer]] = await pool.execute('SELECT full_name FROM users WHERE id = ?', [req.user.id]);
  await notify(revieweeId, `${reviewer.full_name} left you a ${stars}-star review.`, { type: 'review', link: `/profile/${revieweeId}` });
  res.status(201).json({ message: 'Thanks for your review!', review: { id: result.insertId } });
});

// GET /api/reviews/user/:id
const getUserReviews = asyncHandler(async (req, res) => {
  const userId = parseId(req.params.id, 'user ID');
  const [reviews] = await pool.execute(
    `SELECT rv.*, u.full_name AS reviewer_name, u.profile_image AS reviewer_image, r.title AS resource_title
     FROM reviews rv
     JOIN users u ON rv.reviewer_id = u.id
     JOIN borrow_requests br ON rv.borrow_request_id = br.id
     JOIN resources r ON br.resource_id = r.id
     WHERE rv.reviewee_id = ?
     ORDER BY rv.created_at DESC`,
    [userId]
  );
  const [[avg]] = await pool.execute('SELECT AVG(rating) AS avg_rating, COUNT(*) AS total FROM reviews WHERE reviewee_id = ?', [userId]);
  res.json({ reviews, avg_rating: round1(avg.avg_rating), total_reviews: avg.total });
});

module.exports = { createReview, getUserReviews };
