// fields.js
const express = require('express');
const router = express.Router();
const { authenticate, requireUserAdmin, scopeToTenant } = require('../middleware/auth');
const { getFields, createField, updateField, deleteField, reorderFields } = require('../controllers/fieldController');

router.use(authenticate, scopeToTenant);
router.get('/module/:moduleId', getFields);
router.post('/module/:moduleId', requireUserAdmin, createField);
router.put('/:fieldId', requireUserAdmin, updateField);
router.delete('/:fieldId', requireUserAdmin, deleteField);
router.post('/module/:moduleId/reorder', requireUserAdmin, reorderFields);

module.exports = router;
