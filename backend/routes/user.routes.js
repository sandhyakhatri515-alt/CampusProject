const express = require('express');
const router = express.Router();
const { getUserById, updateProfile } = require('../controllers/user.controller');
const { authenticate } = require('../middleware/auth');
const upload = require('../middleware/upload');

router.get('/:id', authenticate, getUserById);
router.put('/profile', authenticate, upload.single('profile_image'), updateProfile);

module.exports = router;
