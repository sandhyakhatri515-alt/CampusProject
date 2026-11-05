const express = require('express');
const { getOverview, getCategories, getLookups, getDashboard } = require('../controllers/public.controller');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

router.get('/public/overview', getOverview);
router.get('/categories', getCategories);
router.get('/lookups', getLookups);
router.get('/dashboard', authenticate, getDashboard);

module.exports = router;
