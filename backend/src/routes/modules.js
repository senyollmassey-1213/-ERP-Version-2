const express = require('express');
const r = express.Router();
const { authenticate, scopeToTenant } = require('../middleware/auth');
const { getTenantModules, getAllModules, getIndustryModules, getModuleTitleHeads } = require('../controllers/moduleController');

r.get('/all', authenticate, getAllModules);
r.get('/industry/:industryId', authenticate, getIndustryModules);
r.get('/', authenticate, scopeToTenant, getTenantModules);
r.get('/:moduleSlug/title-heads', authenticate, scopeToTenant, getModuleTitleHeads);

module.exports = r;
