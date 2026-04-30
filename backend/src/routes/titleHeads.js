const express = require('express');
const r = express.Router();
const { authenticate, requireSuperAdmin } = require('../middleware/auth');
const { getTitleHeads, createTitleHead, updateTitleHead, deleteTitleHead } = require('../controllers/titleHeadController');

r.get('/:industryId/:moduleId', authenticate, getTitleHeads);
r.post('/:industryId/:moduleId', authenticate, requireSuperAdmin, createTitleHead);
r.put('/:id', authenticate, requireSuperAdmin, updateTitleHead);
r.delete('/:id', authenticate, requireSuperAdmin, deleteTitleHead);

module.exports = r;
