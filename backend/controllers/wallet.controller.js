const pool = require('../config/db');
const { asyncHandler, HttpError } = require('../utils/http');
const { credit } = require('../utils/wallet');

const MIN_DEPOSIT = 10;
const MAX_DEPOSIT = 50000;

// GET /api/wallet
const getWallet = asyncHandler(async (req, res) => {
  const [[u]] = await pool.execute('SELECT wallet_balance FROM users WHERE id = ?', [req.user.id]);
  const [[held]] = await pool.execute(
    `SELECT COALESCE(SUM(IF(fee_status = 'held', total_fee, 0) + IF(deposit_status = 'held', deposit_amount, 0)), 0) AS held
     FROM borrow_requests WHERE borrower_id = ?`,
    [req.user.id]
  );
  const [transactions] = await pool.execute(
    `SELECT t.id, t.type, t.amount, t.balance_after, t.note, t.created_at, t.borrow_request_id, r.title AS resource_title
     FROM wallet_transactions t
     LEFT JOIN borrow_requests br ON t.borrow_request_id = br.id
     LEFT JOIN resources r ON br.resource_id = r.id
     WHERE t.user_id = ? ORDER BY t.id DESC LIMIT 100`,
    [req.user.id]
  );
  res.json({ balance: Number(u.wallet_balance), held: Number(held.held), transactions });
});

// POST /api/wallet/deposit  { amount, note? }
// Records a deposit as proof only: no gateway and no real money moves. The user gets a receipt number.
const deposit = asyncHandler(async (req, res) => {
  const amount = Number(req.body.amount);
  if (!Number.isFinite(amount) || amount < MIN_DEPOSIT || amount > MAX_DEPOSIT) {
    throw new HttpError(400, `Deposit between Rs ${MIN_DEPOSIT} and Rs ${MAX_DEPOSIT}.`);
  }
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const note = String(req.body.note || '').trim().slice(0, 100);
    const txId = await credit(conn, req.user.id, amount, 'deposit', { note: note ? `Deposit: ${note}` : 'Deposit recorded' });
    const [[u]] = await conn.execute('SELECT wallet_balance FROM users WHERE id = ?', [req.user.id]);
    await conn.commit();
    res.status(201).json({
      message: `Deposit of Rs ${amount} recorded.`,
      balance: Number(u.wallet_balance),
      receipt: { id: txId, amount, balance_after: Number(u.wallet_balance), note, created_at: new Date().toISOString() }
    });
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
});

module.exports = { getWallet, deposit };
