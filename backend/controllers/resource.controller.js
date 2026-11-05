const pool = require('../config/db');
const { asyncHandler, HttpError, parseId, round1 } = require('../utils/http');

const CONDITIONS = require('../utils/constants').CONDITIONS.map((c) => c.value);
const AVAILABILITY = ['available', 'reserved', 'borrowed', 'unavailable'];
const SORTS = {
  newest: 'r.created_at DESC',
  oldest: 'r.created_at ASC',
  title: 'r.title ASC',
  popular: 'r.views DESC, r.created_at DESC'
};

const categoryExists = async (slug) => {
  const [rows] = await pool.execute('SELECT slug FROM categories WHERE slug = ?', [slug]);
  return rows.length > 0;
};

// GET /api/resources?category&status&condition&search&owner_id&sort&page&limit
const getResources = asyncHandler(async (req, res) => {
  const where = ['1=1'];
  const params = [];

  if (req.query.category) { where.push('r.category = ?'); params.push(req.query.category); }
  if (AVAILABILITY.includes(req.query.status)) { where.push('r.availability_status = ?'); params.push(req.query.status); }
  if (CONDITIONS.includes(req.query.condition)) { where.push('r.condition_status = ?'); params.push(req.query.condition); }
  if (req.query.location) { where.push('r.location = ?'); params.push(req.query.location); }
  if (req.query.search) {
    where.push('(r.title LIKE ? OR r.description LIKE ? OR r.location LIKE ?)');
    const term = `%${req.query.search}%`;
    params.push(term, term, term);
  }
  if (req.query.owner_id) {
    const ownerId = parseInt(req.query.owner_id, 10);
    if (!Number.isNaN(ownerId)) { where.push('r.owner_id = ?'); params.push(ownerId); }
  }
  // Hidden listings are only visible to their owner and to admins.
  if (req.user.role !== 'admin') {
    where.push("(r.availability_status <> 'unavailable' OR r.owner_id = ?)");
    params.push(req.user.id);
  }

  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 24, 1), 100);
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const orderBy = SORTS[req.query.sort] || SORTS.newest;
  const whereSql = where.join(' AND ');

  const [[{ total }]] = await pool.execute(`SELECT COUNT(*) AS total FROM resources r WHERE ${whereSql}`, params);
  const [resources] = await pool.execute(
    `SELECT r.*, u.full_name AS owner_name, u.department AS owner_department,
            c.name AS category_name, c.color AS category_color, c.icon AS category_icon,
            (SELECT AVG(rating) FROM reviews WHERE reviewee_id = r.owner_id) AS owner_avg_rating,
            EXISTS(SELECT 1 FROM wishlist w WHERE w.resource_id = r.id AND w.user_id = ?) AS is_saved
     FROM resources r
     JOIN users u ON r.owner_id = u.id
     JOIN categories c ON r.category = c.slug
     WHERE ${whereSql}
     ORDER BY ${orderBy}
     LIMIT ${limit} OFFSET ${(page - 1) * limit}`,
    [req.user.id, ...params]
  );

  res.json({
    resources: resources.map((r) => ({ ...r, is_saved: !!r.is_saved, owner_avg_rating: round1(r.owner_avg_rating) })),
    total,
    page,
    pages: Math.ceil(total / limit)
  });
});

// GET /api/resources/suggest?q=  (type-ahead for the search boxes)
const suggest = asyncHandler(async (req, res) => {
  const q = String(req.query.q || '').trim().slice(0, 60);
  if (q.length < 2) return res.json({ resources: [], categories: [] });
  const term = `%${q}%`;
  const [resources] = await pool.execute(
    `SELECT r.id, r.title, r.availability_status, c.name AS category_name, c.color AS category_color
     FROM resources r JOIN categories c ON r.category = c.slug
     WHERE (r.title LIKE ? OR r.location LIKE ?)
       AND (r.availability_status <> 'unavailable' OR r.owner_id = ? OR ? = 'admin')
     ORDER BY r.title LIKE ? DESC, r.views DESC LIMIT 6`,
    [term, term, req.user.id, req.user.role, `${q}%`]
  );
  const [categories] = await pool.execute('SELECT slug, name, color, icon FROM categories WHERE name LIKE ? ORDER BY sort_order LIMIT 3', [term]);
  res.json({ resources, categories });
});

// GET /api/resources/:id
const getResourceById = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id, 'resource ID');
  const [rows] = await pool.execute(
    `SELECT r.*, u.full_name AS owner_name, u.department AS owner_department, u.profile_image AS owner_image,
            u.is_verified AS owner_verified,
            c.name AS category_name, c.color AS category_color, c.icon AS category_icon,
            EXISTS(SELECT 1 FROM wishlist w WHERE w.resource_id = r.id AND w.user_id = ?) AS is_saved
     FROM resources r
     JOIN users u ON r.owner_id = u.id
     JOIN categories c ON r.category = c.slug
     WHERE r.id = ?`,
    [req.user.id, id]
  );
  if (!rows.length) throw new HttpError(404, 'Resource not found.');
  const resource = rows[0];
  if (resource.availability_status === 'unavailable' && resource.owner_id !== req.user.id && req.user.role !== 'admin') {
    throw new HttpError(404, 'Resource not found.');
  }

  if (resource.owner_id !== req.user.id) {
    await pool.execute('UPDATE resources SET views = views + 1 WHERE id = ?', [id]);
    resource.views += 1;
  }

  const [[rating]] = await pool.execute(
    'SELECT AVG(rating) AS avg_rating, COUNT(*) AS total_reviews FROM reviews WHERE reviewee_id = ?', [resource.owner_id]);
  const [mine] = await pool.execute(
    `SELECT id, status FROM borrow_requests
     WHERE resource_id = ? AND borrower_id = ? AND status IN ('pending', 'accepted', 'borrowed') ORDER BY id DESC LIMIT 1`,
    [id, req.user.id]
  );

  res.json({
    resource: {
      ...resource,
      is_saved: !!resource.is_saved,
      owner_verified: !!resource.owner_verified,
      owner_avg_rating: round1(rating.avg_rating),
      owner_total_reviews: rating.total_reviews,
      my_request: mine[0] || null
    }
  });
});

const readResourceBody = (body) => {
  const { title, description, category, condition_status, location, max_borrow_days, price_per_day, deposit_amount } = body;
  const days = max_borrow_days === undefined || max_borrow_days === '' ? undefined : parseInt(max_borrow_days, 10);
  if (days !== undefined && (Number.isNaN(days) || days < 1 || days > 60)) {
    throw new HttpError(400, 'Maximum borrow days must be between 1 and 60.');
  }
  const price = price_per_day === undefined || price_per_day === '' ? undefined : Number(price_per_day);
  if (price !== undefined && (Number.isNaN(price) || price < 0 || price > 100000)) {
    throw new HttpError(400, 'Price per day must be between 0 and 100000.');
  }
  const deposit = deposit_amount === undefined || deposit_amount === '' ? undefined : Number(deposit_amount);
  if (deposit !== undefined && (Number.isNaN(deposit) || deposit < 0 || deposit > 100000)) {
    throw new HttpError(400, 'Security deposit must be between 0 and 100000.');
  }
  if (price > 0 && price < 5) throw new HttpError(400, 'A daily fee must be at least Rs 5 (or 0 for free).');
  if (title !== undefined && title.length > 200) throw new HttpError(400, 'Title must not exceed 200 characters.');
  if (condition_status && !CONDITIONS.includes(condition_status)) throw new HttpError(400, 'Invalid condition.');
  return { title, description, category, condition_status, location, days, price, deposit };
};

// POST /api/resources
const createResource = asyncHandler(async (req, res) => {
  const f = readResourceBody(req.body);
  if (!f.title || !f.title.trim() || !f.category) throw new HttpError(400, 'Title and category are required.');
  if (!(await categoryExists(f.category))) throw new HttpError(400, 'Invalid category.');

  const [result] = await pool.execute(
    `INSERT INTO resources (owner_id, title, description, category, condition_status, location, max_borrow_days, price_per_day, deposit_amount, image_url)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [req.user.id, f.title.trim(), f.description || null, f.category, f.condition_status || 'good',
     f.location || null, f.days || 7, f.price || 0, f.deposit || 0, req.file ? `/uploads/${req.file.filename}` : null]
  );
  const [rows] = await pool.execute('SELECT * FROM resources WHERE id = ?', [result.insertId]);
  res.status(201).json({ message: 'Resource listed successfully.', resource: rows[0] });
});

// PUT /api/resources/:id
const updateResource = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id, 'resource ID');
  const [existing] = await pool.execute('SELECT * FROM resources WHERE id = ?', [id]);
  if (!existing.length) throw new HttpError(404, 'Resource not found.');
  if (existing[0].owner_id !== req.user.id && req.user.role !== 'admin') {
    throw new HttpError(403, 'You can only edit your own resources.');
  }

  const f = readResourceBody(req.body);
  const updates = [];
  const values = [];
  if (f.title && f.title.trim()) { updates.push('title = ?'); values.push(f.title.trim()); }
  if (f.description !== undefined) { updates.push('description = ?'); values.push(f.description || null); }
  if (f.category) {
    if (!(await categoryExists(f.category))) throw new HttpError(400, 'Invalid category.');
    updates.push('category = ?'); values.push(f.category);
  }
  if (f.condition_status) { updates.push('condition_status = ?'); values.push(f.condition_status); }
  if (f.location !== undefined) { updates.push('location = ?'); values.push(f.location || null); }
  if (f.days) { updates.push('max_borrow_days = ?'); values.push(f.days); }
  if (f.price !== undefined) { updates.push('price_per_day = ?'); values.push(f.price); }
  if (f.deposit !== undefined) { updates.push('deposit_amount = ?'); values.push(f.deposit); }
  const nextStatus = req.body.availability_status;
  if (nextStatus && nextStatus !== existing[0].availability_status) {
    if (!AVAILABILITY.includes(nextStatus)) throw new HttpError(400, 'Invalid availability.');
    if (['borrowed', 'reserved'].includes(existing[0].availability_status)) {
      throw new HttpError(400, 'This item is reserved or on loan. Finish or cancel the request first.');
    }
    if (['borrowed', 'reserved'].includes(nextStatus)) {
      throw new HttpError(400, 'Items are reserved when you accept a request and on loan when you release them.');
    }
    updates.push('availability_status = ?'); values.push(nextStatus);
  }
  if (req.file) { updates.push('image_url = ?'); values.push(`/uploads/${req.file.filename}`); }
  if (!updates.length) throw new HttpError(400, 'No fields to update.');

  await pool.execute(`UPDATE resources SET ${updates.join(', ')} WHERE id = ?`, [...values, id]);
  const [rows] = await pool.execute('SELECT * FROM resources WHERE id = ?', [id]);
  res.json({ message: 'Resource updated successfully.', resource: rows[0] });
});

// DELETE /api/resources/:id
const deleteResource = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id, 'resource ID');
  const [existing] = await pool.execute('SELECT owner_id FROM resources WHERE id = ?', [id]);
  if (!existing.length) throw new HttpError(404, 'Resource not found.');
  if (existing[0].owner_id !== req.user.id && req.user.role !== 'admin') {
    throw new HttpError(403, 'You can only delete your own resources.');
  }
  await pool.execute('DELETE FROM resources WHERE id = ?', [id]);
  res.json({ message: 'Resource deleted successfully.' });
});

module.exports = { getResources, suggest, getResourceById, createResource, updateResource, deleteResource };
