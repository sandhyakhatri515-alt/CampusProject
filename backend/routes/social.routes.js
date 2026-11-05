const express = require('express');
const c = require('../controllers/social.controller');
const { authenticate, requireVerified } = require('../middleware/auth');

const router = express.Router();

router.get('/wishlist', authenticate, c.getWishlist);
router.post('/wishlist/:resourceId', authenticate, c.toggleWishlist);
router.get('/messages/:requestId', authenticate, c.getMessages);
router.post('/messages/:requestId', authenticate, c.sendMessage);
router.post('/reports', authenticate, requireVerified, c.createReport);

module.exports = router;
