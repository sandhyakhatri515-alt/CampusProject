const express = require('express');
const c = require('../controllers/admin.controller');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate, authorize('admin'));

router.get('/users', c.getAllUsers);
router.put('/users/:id/verify', c.verifyUser);
router.put('/users/:id/status', c.setUserStatus);
router.get('/resources', c.getAllResources);
router.delete('/resources/:id', c.deleteResource);
router.get('/borrows', c.getAllBorrows);
router.get('/reports/summary', c.getReportSummary);
router.get('/reports/top-resources', c.getTopResources);
router.get('/payments', c.getPayments);
router.get('/flags', c.getFlags);
router.put('/flags/:id', c.resolveFlag);

module.exports = router;
