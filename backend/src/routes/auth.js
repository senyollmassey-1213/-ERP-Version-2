const express = require('express');
const r = express.Router();
const { login, getProfile, updateProfile, changePassword, resolveTenant } = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');

r.post('/login', login);
r.get('/tenant/:slug', resolveTenant);
r.get('/me', authenticate, getProfile);
r.put('/me', authenticate, updateProfile);
r.put('/me/password', authenticate, changePassword);

module.exports = r;
