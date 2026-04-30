const express = require('express');
const r = express.Router();
const { authenticate, requireSuperAdmin, scopeToTenant } = require('../middleware/auth');
const { getDashboard, getSuperDashboard } = require('../controllers/dashboardController');

r.get('/super', authenticate, requireSuperAdmin, getSuperDashboard);
r.get('/',      authenticate, scopeToTenant, getDashboard);

module.exports = r;
