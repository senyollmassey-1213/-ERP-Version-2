const express = require('express');
const r = express.Router();
const { authenticate, requireClientServicing, requireSuperAdmin } = require('../middleware/auth');
const { listTenants, getTenant, createTenant, updateTenant, deleteTenant } = require('../controllers/tenantController');

r.get('/',     authenticate, requireClientServicing, listTenants);
r.post('/',    authenticate, requireClientServicing, createTenant);
r.get('/:id',  authenticate, requireClientServicing, getTenant);
r.put('/:id',  authenticate, requireClientServicing, updateTenant);
r.delete('/:id', authenticate, requireSuperAdmin, deleteTenant);

module.exports = r;
