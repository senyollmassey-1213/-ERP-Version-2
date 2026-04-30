const express = require('express');
const router = express.Router();
const { authenticate, requireUserAdmin, scopeToTenant } = require('../middleware/auth');
const { listDepartments, createDepartment, updateDepartment, deleteDepartment } = require('../controllers/departmentController');

router.use(authenticate, scopeToTenant);
router.get('/', listDepartments);
router.post('/', requireUserAdmin, createDepartment);
router.put('/:id', requireUserAdmin, updateDepartment);
router.delete('/:id', requireUserAdmin, deleteDepartment);

module.exports = router;
