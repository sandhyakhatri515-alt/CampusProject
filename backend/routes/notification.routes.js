const express = require('express');
const { getNotifications, markAllRead, markRead, clearAll } = require('../controllers/notification.controller');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);
router.get('/', getNotifications);
router.put('/read-all', markAllRead);
router.put('/:id/read', markRead);
router.delete('/', clearAll);

module.exports = router;
