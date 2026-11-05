// Recreates the schema and loads demo data.  Usage: npm run db:setup
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const DB_NAME = process.env.DB_NAME || 'campus_resource_sharing';

const CATEGORIES = [
  ['camera', 'Cameras', 'FiCamera', '#FF6B6B', 1],
  ['calculator', 'Calculators', 'FiPercent', '#FFB703', 2],
  ['tablet', 'Tablets & Laptops', 'FiTablet', '#4D96FF', 3],
  ['projector', 'Projectors', 'FiMonitor', '#9B5DE5', 4],
  ['book', 'Books', 'FiBookOpen', '#2EC4B6', 5],
  ['lab_equipment', 'Lab Equipment', 'FiActivity', '#F15BB5', 6],
  ['sports', 'Sports Gear', 'FiTarget', '#06D6A0', 7],
  ['other', 'Other', 'FiBox', '#8D99AE', 8]
];

const day = (offset) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
};

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '',
    multipleStatements: true
  });

  console.log('Creating schema...');
  await conn.query(fs.readFileSync(path.join(__dirname, '..', 'db', 'schema.sql'), 'utf8'));
  await conn.query(`USE \`${DB_NAME}\``);

  console.log('Seeding data...');
  for (const c of CATEGORIES) {
    await conn.execute('INSERT INTO categories (slug, name, icon, color, sort_order) VALUES (?, ?, ?, ?, ?)', c);
  }

  const hash = (p) => bcrypt.hashSync(p, 10);
  const users = [
    ['Admin User', 'admin@campus.edu', 'admin123', '9800000000', 'ADM001', 'Administration', 'Keeping the campus sharing running smoothly.', 'admin', 1],
    ['Alice Johnson', 'alice@campus.edu', 'alice123', '9801111111', 'STU001', 'Computer Science', 'CS senior. I love photography and sharing gear.', 'student', 1],
    ['Bob Smith', 'bob@campus.edu', 'bob123', '9802222222', 'STU002', 'Electrical Engineering', 'Circuits, robotics and bad puns.', 'student', 1],
    ['Charlie Brown', 'charlie@campus.edu', 'charlie123', '9803333333', 'STU003', 'Physics', 'Lab rat. Happy to lend what I am not using.', 'student', 1],
    ['Diana Prince', 'diana@campus.edu', 'diana123', '9804444444', 'STU004', 'Business', null, 'student', 0]
  ];
  const ids = {};
  for (const u of users) {
    const [r] = await conn.execute(
      'INSERT INTO users (full_name, email, password_hash, phone, college_id, department, bio, role, is_verified) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [u[0], u[1], hash(u[2]), u[3], u[4], u[5], u[6], u[7], u[8]]
    );
    ids[u[1].split('@')[0]] = r.insertId;
  }

  // [owner, title, description, category, condition, location, max days, price per day (NPR), status]
  const resources = [
    ['alice', 'Canon EOS 250D DSLR', 'Beginner-friendly DSLR with an 18-55mm lens, battery, charger and an SD card. Great for events and projects.', 'camera', 'like_new', 'Library, Main Desk', 7, 100, 'available'],
    ['alice', 'Sony A6000 Mirrorless', 'Compact mirrorless camera with a kit lens. Please handle with care.', 'camera', 'good', 'CS Block, Room 204', 7, 150, 'borrowed'],
    ['bob', 'Casio fx-991EX Scientific Calculator', 'Approved for exams. Fresh batteries and a protective cover.', 'calculator', 'good', 'Engineering Hostel', 14, 0, 'available'],
    ['bob', 'TI-84 Plus Graphing Calculator', 'Handy for calculus and statistics courses.', 'calculator', 'fair', 'Engineering Hostel', 14, 0, 'available'],
    ['charlie', 'iPad 9th Gen + Apple Pencil', 'Good for note taking and sketching. Wiped before each loan.', 'tablet', 'like_new', 'Physics Dept. Office', 7, 80, 'available'],
    ['charlie', 'Epson HD Projector', '3000 lumens, HDMI and VGA cables included. Perfect for club presentations.', 'projector', 'good', 'Physics Dept. Office', 3, 50, 'available'],
    ['alice', 'Introduction to Algorithms (CLRS)', 'Third edition, hardcover. Light highlighting in chapters 1-6.', 'book', 'good', 'CS Block, Room 204', 21, 0, 'available'],
    ['bob', 'Digital Electronics by Morris Mano', 'Classic text for the digital logic course.', 'book', 'fair', 'Engineering Hostel', 21, 0, 'available'],
    ['charlie', 'Digital Multimeter (Fluke 117)', 'Auto-ranging true RMS multimeter with probes.', 'lab_equipment', 'like_new', 'Physics Lab 2', 5, 0, 'available'],
    ['charlie', 'Arduino Starter Kit', 'Uno board, breadboard, sensors, LEDs and jumper wires.', 'lab_equipment', 'good', 'Physics Lab 2', 10, 0, 'borrowed'],
    ['bob', 'Soldering Station (60W)', 'Adjustable temperature station with spare tips.', 'lab_equipment', 'good', 'Engineering Hostel', 4, 20, 'available'],
    ['alice', 'Badminton Racket Set', 'Two rackets and a tube of shuttlecocks.', 'sports', 'good', 'Sports Complex Locker 12', 3, 20, 'reserved'],
    ['bob', 'Basketball (Size 7)', 'Indoor and outdoor ball, fully inflated.', 'sports', 'fair', 'Engineering Hostel', 3, 10, 'reserved'],
    ['charlie', 'Folding Whiteboard (A1)', 'Portable whiteboard with markers, ideal for group study.', 'other', 'good', 'Physics Dept. Office', 7, 0, 'unavailable'],
    ['alice', 'Portable Tripod', 'Lightweight aluminium tripod, up to 1.5m.', 'camera', 'good', 'CS Block, Room 204', 5, 30, 'available']
  ];
  // Refundable security deposit (NPR) per resource, same order as above.
  const deposits = [500, 800, 0, 0, 1000, 500, 0, 0, 200, 150, 100, 0, 0, 0, 100];
  const rid = [];
  const price = [];
  for (const r of resources) {
    const [res] = await conn.execute(
      'INSERT INTO resources (owner_id, title, description, category, condition_status, location, max_borrow_days, price_per_day, deposit_amount, availability_status, views) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [ids[r[0]], r[1], r[2], r[3], r[4], r[5], r[6], r[7], deposits[rid.length], r[8], Math.floor(Math.random() * 80) + 5]
    );
    rid.push(res.insertId);
    price.push(r[7]);
  }

  // Wallet helpers: same rules the app uses (hold on request, fee to owner on release, deposit back on return).
  const tx = async (user, type, amount, reqId, note) => {
    await conn.execute('UPDATE users SET wallet_balance = wallet_balance + ? WHERE id = ?', [amount, user]);
    const [[u]] = await conn.execute('SELECT wallet_balance FROM users WHERE id = ?', [user]);
    await conn.execute(
      'INSERT INTO wallet_transactions (user_id, borrow_request_id, type, amount, balance_after, note) VALUES (?, ?, ?, ?, ?, ?)',
      [user, reqId, type, amount, u.wallet_balance, note]
    );
  };
  // Everyone starts with a deposit so the demo works straight away (Diana tops up after verification).
  for (const [name, amount] of [['alice', 6000], ['bob', 6000], ['charlie', 6000], ['diana', 500]]) {
    await tx(ids[name], 'deposit', amount, null, 'Deposit added');
  }

  // [resource idx, borrower, status, borrow offset, due offset, message]
  const borrows = [
    [1, 'bob', 'borrowed', -2, 2, 'Need it for a short film assignment.'],
    [9, 'alice', 'borrowed', -4, 6, 'Starting my embedded systems project.'],
    [0, 'bob', 'returned', -20, -15, 'Photographing the robotics club demo.'],
    [4, 'alice', 'returned', -30, -24, 'Taking notes for a conference.'],
    [8, 'alice', 'pending', 1, 4, 'Lab report measurements.'],
    [5, 'bob', 'pending', 3, 5, 'Club presentation on Friday.'],
    [2, 'charlie', 'rejected', -10, -3, 'Exam prep.'],
    [6, 'charlie', 'cancelled', -8, 10, 'Maybe for the algorithms course.'],
    [11, 'charlie', 'accepted', 1, 3, 'Weekend match with friends.'],
    [12, 'alice', 'accepted', 1, 2, 'Practice session.']
  ];
  const brIds = [];
  for (const b of borrows) {
    const [owner] = await conn.execute('SELECT owner_id FROM resources WHERE id = ?', [rid[b[0]]]);
    const ownerId = owner[0].owner_id;
    const borrowerId = ids[b[1]];
    const status = b[2];
    const days = b[4] - b[3] + 1;
    const fee = price[b[0]] * days;
    const deposit = deposits[b[0]];
    const refunded = ['rejected', 'cancelled'].includes(status);
    const feePaid = ['borrowed', 'returned'].includes(status);
    const feeStatus = fee === 0 ? 'none' : refunded ? 'refunded' : feePaid ? 'paid' : 'held';
    const depositStatus = deposit === 0 ? 'none' : refunded || status === 'returned' ? 'refunded' : 'held';
    const responded = ['pending', 'cancelled'].includes(status) ? 'NULL' : 'NOW()';
    const released = feePaid ? 'NOW()' : 'NULL';
    const returned = status === 'returned' ? 'NOW()' : 'NULL';
    const [r] = await conn.execute(
      `INSERT INTO borrow_requests (resource_id, borrower_id, owner_id, request_message, status, borrow_date, due_date, total_fee, deposit_amount, fee_status, deposit_status, responded_at, released_at, returned_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ${responded}, ${released}, ${returned})`,
      [rid[b[0]], borrowerId, ownerId, b[5], status, day(b[3]), day(b[4]), fee, deposit, feeStatus, depositStatus]
    );
    brIds.push(r.insertId);

    const title = resources[b[0]][1];
    if (fee + deposit > 0) await tx(borrowerId, 'hold', -(fee + deposit), r.insertId, `Held for "${title}"`);
    if (refunded && fee + deposit > 0) await tx(borrowerId, 'refund', fee + deposit, r.insertId, 'Refund: request not completed');
    if (feePaid && fee > 0) await tx(ownerId, 'earning', fee, r.insertId, `Rental fee for "${title}"`);
    if (status === 'returned' && deposit > 0) await tx(borrowerId, 'refund', deposit, r.insertId, `Security deposit returned for "${title}"`);
  }

  const reviews = [
    [2, 'bob', 'alice', 5, 'Alice was super flexible and the camera was in perfect shape.'],
    [2, 'alice', 'bob', 5, 'Bob returned everything on time with the battery charged.'],
    [3, 'alice', 'charlie', 4, 'The iPad worked great. Pick-up was a bit slow.'],
    [3, 'charlie', 'alice', 5, 'Responsible borrower, would lend again.']
  ];
  for (const r of reviews) {
    await conn.execute(
      'INSERT INTO reviews (borrow_request_id, reviewer_id, reviewee_id, rating, comment) VALUES (?, ?, ?, ?, ?)',
      [brIds[r[0]], ids[r[1]], ids[r[2]], r[3], r[4]]
    );
  }

  for (const [user, idx] of [['bob', 0], ['bob', 4], ['alice', 8], ['charlie', 10], ['alice', 5]]) {
    await conn.execute('INSERT INTO wishlist (user_id, resource_id) VALUES (?, ?)', [ids[user], rid[idx]]);
  }

  const messages = [
    [0, 'bob', 'Hi Alice, can I pick the camera up after 3 PM?'],
    [0, 'alice', 'Sure! I will be at the CS Block, room 204.'],
    [0, 'bob', 'Perfect, see you then.']
  ];
  for (const m of messages) {
    await conn.execute('INSERT INTO messages (borrow_request_id, sender_id, body) VALUES (?, ?, ?)', [brIds[m[0]], ids[m[1]], m[2]]);
  }

  const notes = [
    ['alice', 'request', 'Bob Smith has requested to borrow your "Sony A6000 Mirrorless".', '/requests'],
    ['alice', 'review', 'Bob Smith left you a 5-star review.', '/profile'],
    ['charlie', 'request', 'Alice Johnson has requested to borrow your "Digital Multimeter (Fluke 117)".', '/requests'],
    ['bob', 'request', 'Your borrow request for "Sony A6000 Mirrorless" has been accepted.', '/requests'],
    ['charlie', 'request', 'Your request for "Badminton Racket Set" was accepted. The owner will release it to you.', '/requests?tab=sent'],
    ['bob', 'payment', 'Alice Johnson requested "Basketball (Size 7)" with Rs 20 held. You can release it now.', '/requests'],
    ['admin', 'admin', 'New student registration: Diana Prince (diana@campus.edu) is awaiting verification.', '/admin/users']
  ];
  for (const n of notes) {
    await conn.execute('INSERT INTO notifications (user_id, type, message, link) VALUES (?, ?, ?, ?)', [ids[n[0]], n[1], n[2], n[3]]);
  }

  await conn.execute(
    'INSERT INTO reports (reporter_id, resource_id, reason, details) VALUES (?, ?, ?, ?)',
    [ids.bob, rid[13], 'Inaccurate listing', 'The description says markers are included but the owner says they are not.']
  );

  await conn.end();
  console.log('Done. Demo logins:');
  console.log('  admin@campus.edu   / admin123   (admin)');
  console.log('  alice@campus.edu   / alice123   (verified student)');
  console.log('  bob@campus.edu     / bob123     (verified student)');
  console.log('  charlie@campus.edu / charlie123 (verified student)');
  console.log('  diana@campus.edu   / diana123   (unverified student)');
}

main().catch((err) => {
  console.error(`Database setup failed (${err.code || 'UNKNOWN'}): ${err.message}`);
  process.exit(1);
});
