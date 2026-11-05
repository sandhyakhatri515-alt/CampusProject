const express = require('express');
const router = express.Router();
const { createBorrowRequest, getSentRequests, getReceivedRequests, respondToRequest, releaseItem, markReturned, cancelRequest } = require('../controllers/borrow.controller');
const { authenticate, requireVerified } = require('../middleware/auth');

router.post('/', authenticate, requireVerified, createBorrowRequest);
router.get('/sent', authenticate, getSentRequests);
router.get('/received', authenticate, getReceivedRequests);
router.put('/:id/respond', authenticate, respondToRequest);
router.put('/:id/release', authenticate, releaseItem);
router.put('/:id/return', authenticate, markReturned);
router.put('/:id/cancel', authenticate, cancelRequest);

module.exports = router;
