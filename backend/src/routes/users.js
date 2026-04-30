const express = require('express');
const r = express.Router();
const { authenticate, requireUserAdmin, scopeToTenant } = require('../middleware/auth');
const { listUsers, createUser, updateUser, deleteUser, resetPassword, setUserModuleAccess, getUserModuleAccess } = require('../controllers/userController');

r.use(authenticate, scopeToTenant);
r.get('/',    requireUserAdmin, listUsers);
r.post('/',   requireUserAdmin, createUser);
r.put('/:id', requireUserAdmin, updateUser);
r.delete('/:id', requireUserAdmin, deleteUser);
r.post('/:id/reset-password', requireUserAdmin, resetPassword);
r.get('/:userId/modules',  requireUserAdmin, getUserModuleAccess);
r.put('/:userId/modules',  requireUserAdmin, setUserModuleAccess);

module.exports = r;
