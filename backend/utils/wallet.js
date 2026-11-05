// Deposit-wallet helpers. Every function takes a transaction connection so balance changes and the
// request update they belong to commit (or roll back) together. No payment gateway: users simply
// top up a balance, and borrowing sets money aside from it.
const { HttpError } = require('./http');

const money = (n) => Number(Number(n).toFixed(2));

async function record(conn, userId, type, amount, { requestId = null, note = null } = {}) {
  const [[u]] = await conn.execute('SELECT wallet_balance FROM users WHERE id = ?', [userId]);
  const [r] = await conn.execute(
    'INSERT INTO wallet_transactions (user_id, borrow_request_id, type, amount, balance_after, note) VALUES (?, ?, ?, ?, ?, ?)',
    [userId, requestId, type, amount, u.wallet_balance, note]
  );
  return r.insertId;
}

async function credit(conn, userId, amount, type, opts) {
  amount = money(amount);
  if (amount <= 0) return null;
  await conn.execute('UPDATE users SET wallet_balance = wallet_balance + ? WHERE id = ?', [amount, userId]);
  return record(conn, userId, type, amount, opts);
}

// Removes money from the available balance. Throws 400 when the balance is too low.
async function hold(conn, userId, amount, opts) {
  amount = money(amount);
  if (amount <= 0) return;
  const [r] = await conn.execute('UPDATE users SET wallet_balance = wallet_balance - ? WHERE id = ? AND wallet_balance >= ?', [amount, userId, amount]);
  if (!r.affectedRows) {
    const [[u]] = await conn.execute('SELECT wallet_balance FROM users WHERE id = ?', [userId]);
    throw new HttpError(400, `Not enough deposit balance. You need Rs ${amount} but have Rs ${money(u.wallet_balance)}. Add money to your wallet first.`);
  }
  await record(conn, userId, 'hold', -amount, opts);
}

// Gives back everything still held for a request (rejected / cancelled before the item went out).
async function refundHeld(conn, request, note) {
  let total = 0;
  if (request.fee_status === 'held') total += Number(request.total_fee);
  if (request.deposit_status === 'held') total += Number(request.deposit_amount);
  if (total > 0) await credit(conn, request.borrower_id, total, 'refund', { requestId: request.id, note });
  await conn.execute(
    `UPDATE borrow_requests SET fee_status = IF(fee_status = 'held', 'refunded', fee_status),
       deposit_status = IF(deposit_status = 'held', 'refunded', deposit_status) WHERE id = ?`,
    [request.id]
  );
}

module.exports = { money, credit, hold, refundHeld };
