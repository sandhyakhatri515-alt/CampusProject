const express = require('express');
const { register, login, getMe, changePassword } = require('../controllers/auth.controller');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.get('/me', authenticate, getMe);
router.put('/password', authenticate, changePassword);

module.exports = router;
