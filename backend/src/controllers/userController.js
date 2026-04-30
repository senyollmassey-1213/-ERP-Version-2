const bcrypt = require('bcryptjs');
const { query, getClient } = require('../config/database');
const { asyncHandler, sendSuccess, getPagination, paginatedResponse } = require('../middleware/helpers');

const listUsers = asyncHandler(async (req, res) => {
  const { page, limit, offset } = getPagination(req);
  const search = req.query.search || '';
  const countR = await query(
    `SELECT COUNT(*) FROM users WHERE tenant_id=$1
     AND (first_name ILIKE $2 OR last_name ILIKE $2 OR email ILIKE $2)`,
    [req.tenantId, `%${search}%`]
  );
  const r = await query(
    `SELECT id, email, first_name, last_name, role, is_active, last_login_at, created_at
     FROM users WHERE tenant_id=$1
     AND (first_name ILIKE $2 OR last_name ILIKE $2 OR email ILIKE $2)
     ORDER BY created_at DESC LIMIT $3 OFFSET $4`,
    [req.tenantId, `%${search}%`, limit, offset]
  );
  paginatedResponse(res, r.rows, parseInt(countR.rows[0].count), page, limit);
});

const createUser = asyncHandler(async (req, res) => {
  const { email, password, firstName, lastName, role = 'user' } = req.body;
  if (!email || !password)
    return res.status(400).json({ success: false, message: 'Email and password required' });
  if (!['user', 'user_admin'].includes(role))
    return res.status(400).json({ success: false, message: 'Role must be user or user_admin' });

  const hash = await bcrypt.hash(password, 12);
  const r = await query(
    `INSERT INTO users (tenant_id, email, password_hash, first_name, last_name, role)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, email, first_name, last_name, role`,
    [req.tenantId, email.toLowerCase(), hash, firstName, lastName, role]
  );
  sendSuccess(res, r.rows[0], 'User created', 201);
});

const updateUser = asyncHandler(async (req, res) => {
  const { firstName, lastName, role, isActive, phone } = req.body;
  const r = await query(
    `UPDATE users SET
       first_name=COALESCE($1,first_name), last_name=COALESCE($2,last_name),
       role=COALESCE($3,role), is_active=COALESCE($4,is_active),
       phone=COALESCE($5,phone), updated_at=NOW()
     WHERE id=$6 AND tenant_id=$7 RETURNING id, email, first_name, last_name, role, is_active`,
    [firstName, lastName, role, isActive, phone, req.params.id, req.tenantId]
  );
  if (!r.rows[0]) return res.status(404).json({ success: false, message: 'User not found' });
  sendSuccess(res, r.rows[0], 'User updated');
});

const deleteUser = asyncHandler(async (req, res) => {
  if (req.params.id === req.user.id)
    return res.status(400).json({ success: false, message: 'Cannot delete your own account' });
  await query(`DELETE FROM users WHERE id=$1 AND tenant_id=$2`, [req.params.id, req.tenantId]);
  sendSuccess(res, {}, 'User deleted');
});

const resetPassword = asyncHandler(async (req, res) => {
  const { newPassword } = req.body;
  if (!newPassword) return res.status(400).json({ success: false, message: 'New password required' });
  const hash = await bcrypt.hash(newPassword, 12);
  await query(`UPDATE users SET password_hash=$1, updated_at=NOW() WHERE id=$2 AND tenant_id=$3`,
    [hash, req.params.id, req.tenantId]);
  sendSuccess(res, {}, 'Password reset');
});

// User Admin sets which modules a user can see
const setUserModuleAccess = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { moduleAccess } = req.body;
  // moduleAccess: [{moduleId, isVisible}]

  if (!Array.isArray(moduleAccess))
    return res.status(400).json({ success: false, message: 'moduleAccess array required' });

  const client = await getClient();
  try {
    await client.query('BEGIN');
    // Delete existing and re-insert
    await client.query(`DELETE FROM user_module_access WHERE user_id=$1 AND tenant_id=$2`, [userId, req.tenantId]);
    for (const { moduleId, isVisible } of moduleAccess) {
      await client.query(
        `INSERT INTO user_module_access (user_id, tenant_id, module_id, is_visible) VALUES ($1,$2,$3,$4)`,
        [userId, req.tenantId, moduleId, isVisible !== false]
      );
    }
    await client.query('COMMIT');
    sendSuccess(res, {}, 'Module access updated');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

const getUserModuleAccess = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const r = await query(
    `SELECT uma.*, m.name AS module_name, m.slug AS module_slug, m.icon
     FROM user_module_access uma
     JOIN modules m ON m.id=uma.module_id
     WHERE uma.user_id=$1 AND uma.tenant_id=$2`,
    [userId, req.tenantId]
  );
  sendSuccess(res, r.rows);
});

module.exports = { listUsers, createUser, updateUser, deleteUser, resetPassword, setUserModuleAccess, getUserModuleAccess };
