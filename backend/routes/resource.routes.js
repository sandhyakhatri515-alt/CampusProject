const express = require('express');
const router = express.Router();
const { getResources, suggest, getResourceById, createResource, updateResource, deleteResource } = require('../controllers/resource.controller');
const { authenticate, requireVerified } = require('../middleware/auth');
const upload = require('../middleware/upload');

router.get('/', authenticate, getResources);
router.get('/suggest', authenticate, suggest);
router.get('/:id', authenticate, getResourceById);
router.post('/', authenticate, requireVerified, upload.single('image'), createResource);
router.put('/:id', authenticate, requireVerified, upload.single('image'), updateResource);
router.delete('/:id', authenticate, deleteResource);

module.exports = router;
