const express = require('express');
const r = express.Router();
const { authenticate, requireClientServicing, requireSuperAdmin, requireUserAdmin, scopeToTenant } = require('../middleware/auth');
const { listTenants, getTenant, getMyTenant, createTenant, updateTenant, updateMyTenant, deleteTenant } = require('../controllers/tenantController');

// Platform level
r.get('/',      authenticate, requireClientServicing, listTenants);
r.post('/',     authenticate, requireClientServicing, createTenant);
r.get('/:id',   authenticate, requireClientServicing, getTenant);
r.put('/:id',   authenticate, requireClientServicing, updateTenant);
r.delete('/:id',authenticate, requireSuperAdmin, deleteTenant);

// Tenant self-service (user_admin updates their own hotel info)
r.get('/my/info',  authenticate, scopeToTenant, getMyTenant);
r.put('/my/info',  authenticate, scopeToTenant, requireUserAdmin, updateMyTenant);

module.exports = r;
