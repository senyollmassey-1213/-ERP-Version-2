const express = require('express');
const bcrypt  = require('bcryptjs');
const r = express.Router();
const { query } = require('../config/database');
const { authenticate, requireSuperAdmin } = require('../middleware/auth');
const { asyncHandler, sendSuccess } = require('../middleware/helpers');

// List all platform-level users (no tenant)
r.get('/', authenticate, requireSuperAdmin, asyncHandler(async (req, res) => {
  const rows = await query(
    `SELECT id, email, first_name, last_name, phone, role, is_active, last_login_at, created_at
     FROM users WHERE tenant_id IS NULL ORDER BY created_at DESC`
  );
  sendSuccess(res, rows.rows);
}));

// Create a platform user
r.post('/', authenticate, requireSuperAdmin, asyncHandler(async (req, res) => {
  const { email, password, firstName, lastName, role = 'client_servicing', phone } = req.body;
  if (!email || !password)
    return res.status(400).json({ success: false, message: 'Email and password required' });
  if (!['super_admin','client_servicing'].includes(role))
    return res.status(400).json({ success: false, message: 'Role must be super_admin or client_servicing' });

  const hash = await bcrypt.hash(password, 12);
  const result = await query(
    `INSERT INTO users (tenant_id, email, password_hash, first_name, last_name, phone, role)
     VALUES (NULL,$1,$2,$3,$4,$5,$6) RETURNING id, email, first_name, last_name, role`,
    [email.toLowerCase(), hash, firstName, lastName, phone, role]
  );
  sendSuccess(res, result.rows[0], 'Platform user created', 201);
}));

// Update a platform user
r.put('/:id', authenticate, requireSuperAdmin, asyncHandler(async (req, res) => {
  const { firstName, lastName, isActive, phone } = req.body;
  const result = await query(
    `UPDATE users SET first_name=COALESCE($1,first_name), last_name=COALESCE($2,last_name),
     is_active=COALESCE($3,is_active), phone=COALESCE($4,phone), updated_at=NOW()
     WHERE id=$5 AND tenant_id IS NULL RETURNING id, email, first_name, last_name, role, is_active`,
    [firstName, lastName, isActive, phone, req.params.id]
  );
  if (!result.rows[0]) return res.status(404).json({ success: false, message: 'User not found' });
  sendSuccess(res, result.rows[0], 'User updated');
}));

// Delete a platform user (cannot delete self or last super admin)
r.delete('/:id', authenticate, requireSuperAdmin, asyncHandler(async (req, res) => {
  if (req.params.id === req.user.id)
    return res.status(400).json({ success: false, message: 'Cannot delete your own account' });
  const target = await query(`SELECT role FROM users WHERE id=$1 AND tenant_id IS NULL`, [req.params.id]);
  if (!target.rows[0]) return res.status(404).json({ success: false, message: 'User not found' });
  if (target.rows[0].role === 'super_admin') {
    const count = await query(`SELECT COUNT(*) FROM users WHERE role='super_admin' AND tenant_id IS NULL AND is_active=true`);
    if (parseInt(count.rows[0].count) <= 1)
      return res.status(400).json({ success: false, message: 'Cannot delete the last Super Admin' });
  }
  await query(`DELETE FROM users WHERE id=$1 AND tenant_id IS NULL`, [req.params.id]);
  sendSuccess(res, {}, 'User deleted');
}));

module.exports = r;
