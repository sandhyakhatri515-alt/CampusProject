const express = require('express');
const router = express.Router();
const { createReview, getUserReviews } = require('../controllers/review.controller');
const { authenticate } = require('../middleware/auth');

router.post('/', authenticate, createReview);
router.get('/user/:id', authenticate, getUserReviews);

module.exports = router;
