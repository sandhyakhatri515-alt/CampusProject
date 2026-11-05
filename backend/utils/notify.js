const pool = require('../config/db');

// Creates an in-app notification. `db` may be a pool or a transaction connection.
const notify = (userId, message, { type = 'info', link = null, db = pool } = {}) =>
  db.execute('INSERT INTO notifications (user_id, type, message, link) VALUES (?, ?, ?, ?)', [userId, type, message, link]);

module.exports = { notify };
