const pool = require('../config/db');
const { asyncHandler, HttpError, parseId } = require('../utils/http');
const { notify } = require('../utils/notify');
const { credit, hold, refundHeld } = require('../utils/wallet');

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const daysBetween = (a, b) => Math.round((new Date(b) - new Date(a)) / 86400000);
const today = () => new Date().toISOString().slice(0, 10);

const LIST_SQL = `
  SELECT br.*, r.title AS resource_title, r.category, r.image_url AS resource_image,
         c.color AS category_color, c.icon AS category_icon,
         ob.full_name AS owner_name, bb.full_name AS borrower_name,
         bb.department AS borrower_department,
         (SELECT COUNT(*) FROM messages m WHERE m.borrow_request_id = br.id) AS message_count,
         (SELECT COUNT(*) FROM reviews rv WHERE rv.borrow_request_id = br.id AND rv.reviewer_id = ?) AS reviewed
  FROM borrow_requests br
  JOIN resources r ON br.resource_id = r.id
  JOIN categories c ON r.category = c.slug
  JOIN users ob ON br.owner_id = ob.id
  JOIN users bb ON br.borrower_id = bb.id`;

const withFlags = (rows) => rows.map((r) => ({ ...r, reviewed: r.reviewed > 0 }));

// POST /api/borrows
const createBorrowRequest = asyncHandler(async (req, res) => {
  const { resource_id, request_message, borrow_date, due_date } = req.body;
  if (!resource_id || !borrow_date || !due_date) {
    throw new HttpError(400, 'Resource, pick-up date and due date are required.');
  }
  if (!DATE_RE.test(borrow_date) || !DATE_RE.test(due_date)) throw new HttpError(400, 'Dates must be in YYYY-MM-DD format.');
  if (borrow_date < today()) throw new HttpError(400, 'Pick-up date cannot be in the past.');
  if (due_date < borrow_date) throw new HttpError(400, 'Due date must be on or after the pick-up date.');

  const resId = parseId(resource_id, 'resource ID');
  const [resources] = await pool.execute('SELECT * FROM resources WHERE id = ?', [resId]);
  if (!resources.length) throw new HttpError(404, 'Resource not found.');
  const resource = resources[0];

  if (resource.owner_id === req.user.id) throw new HttpError(400, 'You cannot borrow your own resource.');
  if (resource.availability_status !== 'available') throw new HttpError(400, 'This resource is not available for borrowing.');
  if (daysBetween(borrow_date, due_date) + 1 > resource.max_borrow_days) {
    throw new HttpError(400, `This item can be borrowed for at most ${resource.max_borrow_days} days.`);
  }

  const [active] = await pool.execute(
    "SELECT id FROM borrow_requests WHERE resource_id = ? AND borrower_id = ? AND status IN ('pending', 'accepted', 'borrowed')",
    [resId, req.user.id]
  );
  if (active.length) throw new HttpError(400, 'You already have an active request for this resource.');

  const days = daysBetween(borrow_date, due_date) + 1;
  const fee = Number(resource.price_per_day) * days;
  const deposit = Number(resource.deposit_amount);

  // The fee and security deposit are set aside from the borrower's balance before the request is sent.
  const conn = await pool.getConnection();
  let requestId;
  try {
    await conn.beginTransaction();
    const [result] = await conn.execute(
      `INSERT INTO borrow_requests (resource_id, borrower_id, owner_id, request_message, borrow_date, due_date, total_fee, deposit_amount, fee_status, deposit_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [resId, req.user.id, resource.owner_id, request_message || null, borrow_date, due_date, fee, deposit, fee > 0 ? 'held' : 'none', deposit > 0 ? 'held' : 'none']
    );
    requestId = result.insertId;
    await hold(conn, req.user.id, fee + deposit, { requestId, note: `Held for "${resource.title}"` });
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }

  const [[borrower]] = await pool.execute('SELECT full_name FROM users WHERE id = ?', [req.user.id]);
  await notify(resource.owner_id, `${borrower.full_name} has requested to borrow your "${resource.title}".`, { type: 'request', link: '/requests' });

  res.status(201).json({ message: 'Borrow request sent.', request: { id: requestId, total_fee: fee, deposit_amount: deposit } });
});

// GET /api/borrows/sent
const getSentRequests = asyncHandler(async (req, res) => {
  const [rows] = await pool.execute(`${LIST_SQL} WHERE br.borrower_id = ? ORDER BY br.requested_at DESC`, [req.user.id, req.user.id]);
  res.json({ requests: withFlags(rows) });
});

// GET /api/borrows/received
const getReceivedRequests = asyncHandler(async (req, res) => {
  const [rows] = await pool.execute(`${LIST_SQL} WHERE br.owner_id = ? ORDER BY br.requested_at DESC`, [req.user.id, req.user.id]);
  res.json({ requests: withFlags(rows) });
});

// PUT /api/borrows/:id/respond  { action: 'accept' | 'reject' }
const respondToRequest = asyncHandler(async (req, res) => {
  const requestId = parseId(req.params.id, 'request ID');
  const { action } = req.body;
  if (!['accept', 'reject'].includes(action)) throw new HttpError(400, 'Action must be "accept" or "reject".');

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [requests] = await conn.execute('SELECT * FROM borrow_requests WHERE id = ? FOR UPDATE', [requestId]);
    if (!requests.length) throw new HttpError(404, 'Request not found.');
    const request = requests[0];
    if (request.owner_id !== req.user.id) throw new HttpError(403, 'Only the resource owner can respond to this request.');
    if (request.status !== 'pending') throw new HttpError(400, 'This request has already been responded to.');

    const [resources] = await conn.execute('SELECT title, availability_status FROM resources WHERE id = ? FOR UPDATE', [request.resource_id]);
    const resource = resources[0];

    if (action === 'accept') {
      if (resource.availability_status !== 'available') throw new HttpError(400, 'This resource is no longer available.');
      // Accepting reserves the item; it goes on loan only when the owner releases it.
      await conn.execute("UPDATE borrow_requests SET status = 'accepted', responded_at = NOW() WHERE id = ?", [requestId]);
      await conn.execute("UPDATE resources SET availability_status = 'reserved' WHERE id = ?", [request.resource_id]);

      const [others] = await conn.execute(
        "SELECT * FROM borrow_requests WHERE resource_id = ? AND id <> ? AND status = 'pending'",
        [request.resource_id, requestId]
      );
      if (others.length) {
        await conn.execute(
          "UPDATE borrow_requests SET status = 'rejected', responded_at = NOW() WHERE resource_id = ? AND id <> ? AND status = 'pending'",
          [request.resource_id, requestId]
        );
        for (const o of others) {
          await refundHeld(conn, o, 'Refund: item was lent to someone else');
          await notify(o.borrower_id, `Your request for "${resource.title}" was declined because it was lent to someone else.`, { type: 'request', link: '/requests', db: conn });
        }
      }
    } else {
      await conn.execute("UPDATE borrow_requests SET status = 'rejected', responded_at = NOW() WHERE id = ?", [requestId]);
      await refundHeld(conn, request, `Refund: request for "${resource.title}" was declined`);
    }

    const acceptedText = 'accepted. The owner will release it to you.';
    await notify(request.borrower_id, `Your borrow request for "${resource.title}" has been ${action === 'accept' ? acceptedText : 'rejected. Your held money was refunded.'}`, { type: 'request', link: '/requests?tab=sent', db: conn });
    await conn.commit();
    res.json({ message: `Request ${action === 'accept' ? 'accepted' : 'rejected'}.` });
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
});

// PUT /api/borrows/:id/release  (owner hands the item over; the held rental fee moves to the owner)
const releaseItem = asyncHandler(async (req, res) => {
  const requestId = parseId(req.params.id, 'request ID');
  const [requests] = await pool.execute('SELECT * FROM borrow_requests WHERE id = ?', [requestId]);
  if (!requests.length) throw new HttpError(404, 'Request not found.');
  const request = requests[0];

  if (request.owner_id !== req.user.id) throw new HttpError(403, 'Only the owner can release this item.');
  if (request.status !== 'accepted') throw new HttpError(400, 'Only accepted requests can be released.');

  const [[resource]] = await pool.execute('SELECT title FROM resources WHERE id = ?', [request.resource_id]);
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [fresh] = await conn.execute('SELECT status FROM borrow_requests WHERE id = ? FOR UPDATE', [requestId]);
    if (fresh[0].status !== 'accepted') throw new HttpError(400, 'Only accepted requests can be released.');
    await conn.execute("UPDATE borrow_requests SET status = 'borrowed', released_at = NOW() WHERE id = ?", [requestId]);
    await conn.execute("UPDATE resources SET availability_status = 'borrowed' WHERE id = ?", [request.resource_id]);
    if (request.fee_status === 'held') {
      await credit(conn, request.owner_id, request.total_fee, 'earning', { requestId, note: `Rental fee for "${resource.title}"` });
      await conn.execute("UPDATE borrow_requests SET fee_status = 'paid' WHERE id = ?", [requestId]);
    }
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }

  await notify(request.borrower_id, `"${resource.title}" has been released to you. Please return it by ${String(request.due_date).slice(0, 10)}.`, { type: 'release', link: '/requests?tab=sent' });
  res.json({ message: 'Item released to the borrower.' });
});

// PUT /api/borrows/:id/return  (only the owner confirms, which refunds the borrower's security deposit)
const markReturned = asyncHandler(async (req, res) => {
  const requestId = parseId(req.params.id, 'request ID');
  const [requests] = await pool.execute('SELECT * FROM borrow_requests WHERE id = ?', [requestId]);
  if (!requests.length) throw new HttpError(404, 'Request not found.');
  const request = requests[0];

  if (request.owner_id !== req.user.id) throw new HttpError(403, 'Only the owner can confirm that the item was returned.');
  if (request.status !== 'borrowed') throw new HttpError(400, 'Only items currently on loan can be marked as returned.');

  const [[resource]] = await pool.execute('SELECT title FROM resources WHERE id = ?', [request.resource_id]);
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [fresh] = await conn.execute('SELECT status FROM borrow_requests WHERE id = ? FOR UPDATE', [requestId]);
    if (fresh[0].status !== 'borrowed') throw new HttpError(400, 'Only items currently on loan can be marked as returned.');
    await conn.execute("UPDATE borrow_requests SET status = 'returned', returned_at = NOW() WHERE id = ?", [requestId]);
    await conn.execute("UPDATE resources SET availability_status = 'available' WHERE id = ?", [request.resource_id]);
    if (request.deposit_status === 'held') {
      await credit(conn, request.borrower_id, request.deposit_amount, 'refund', { requestId, note: `Security deposit returned for "${resource.title}"` });
      await conn.execute("UPDATE borrow_requests SET deposit_status = 'refunded' WHERE id = ?", [requestId]);
    }
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }

  const refundNote = request.deposit_status === 'held' ? ` Your Rs ${request.deposit_amount} deposit was refunded.` : '';
  await notify(request.borrower_id, `"${resource.title}" has been confirmed as returned.${refundNote} You can now leave a review.`, { type: 'return', link: '/requests?tab=sent' });
  res.json({ message: 'Marked as returned.' });
});

// PUT /api/borrows/:id/cancel
const cancelRequest = asyncHandler(async (req, res) => {
  const requestId = parseId(req.params.id, 'request ID');
  const [requests] = await pool.execute('SELECT * FROM borrow_requests WHERE id = ?', [requestId]);
  if (!requests.length) throw new HttpError(404, 'Request not found.');
  const request = requests[0];
  const isBorrower = request.borrower_id === req.user.id;
  const isOwner = request.owner_id === req.user.id;
  if (!isBorrower && !isOwner) throw new HttpError(403, 'Access denied.');

  if (request.status === 'pending') {
    if (!isBorrower) throw new HttpError(403, 'Only the borrower can cancel a pending request.');
  } else if (request.status !== 'accepted') {
    throw new HttpError(400, 'This request can no longer be cancelled.');
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [fresh] = await conn.execute('SELECT status FROM borrow_requests WHERE id = ? FOR UPDATE', [requestId]);
    if (fresh[0].status !== request.status) throw new HttpError(400, 'This request can no longer be cancelled.');
    await conn.execute("UPDATE borrow_requests SET status = 'cancelled' WHERE id = ?", [requestId]);
    await refundHeld(conn, request, 'Refund: request cancelled');
    if (request.status === 'accepted') {
      await conn.execute("UPDATE resources SET availability_status = 'available' WHERE id = ? AND availability_status = 'reserved'", [request.resource_id]);
    }
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
  if (request.status === 'accepted') {
    const other = isBorrower ? request.owner_id : request.borrower_id;
    const [[resource]] = await pool.execute('SELECT title FROM resources WHERE id = ?', [request.resource_id]);
    await notify(other, `The reservation for "${resource.title}" was cancelled.`, { type: 'request', link: '/requests' });
  }
  res.json({ message: 'Request cancelled. Any held money was refunded.' });
});

module.exports = { createBorrowRequest, getSentRequests, getReceivedRequests, respondToRequest, releaseItem, markReturned, cancelRequest };
