const express = require('express');
const r = express.Router();
const { authenticate, requireSuperAdmin, requireClientServicing } = require('../middleware/auth');
const { listIndustries, getIndustry, createIndustry, updateIndustry, addModuleToIndustry } = require('../controllers/industryController');

r.get('/', authenticate, listIndustries);               // all roles can read
r.get('/:id', authenticate, getIndustry);
r.post('/', authenticate, requireSuperAdmin, createIndustry);
r.put('/:id', authenticate, requireSuperAdmin, updateIndustry);
r.post('/:id/modules', authenticate, requireSuperAdmin, addModuleToIndustry);

module.exports = r;
