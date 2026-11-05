const express = require('express');
const { getWallet, deposit } = require('../controllers/wallet.controller');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);
router.get('/', getWallet);
router.post('/deposit', deposit);

module.exports = router;
