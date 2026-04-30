const { query } = require('../config/database');
const { asyncHandler, sendSuccess } = require('../middleware/helpers');

const listDepartments = asyncHandler(async (req, res) => {
  const result = await query(
    `SELECT d.*,
            u.first_name || ' ' || u.last_name AS head_name,
            (SELECT COUNT(*) FROM users WHERE department_id=d.id) AS member_count
     FROM departments d
     LEFT JOIN users u ON u.id=d.head_user_id
     WHERE d.tenant_id=$1 AND d.is_active=true
     ORDER BY d.name`,
    [req.tenantId]
  );
  sendSuccess(res, result.rows);
});

const createDepartment = asyncHandler(async (req, res) => {
  const { name, description, parentId, headUserId } = req.body;
  if (!name) return res.status(400).json({ success: false, message: 'Name required' });

  const result = await query(
    `INSERT INTO departments (tenant_id, name, description, parent_id, head_user_id)
     VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [req.tenantId, name, description, parentId || null, headUserId || null]
  );
  sendSuccess(res, result.rows[0], 'Department created', 201);
});

const updateDepartment = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, description, parentId, headUserId } = req.body;
  const result = await query(
    `UPDATE departments SET
       name=COALESCE($1,name), description=COALESCE($2,description),
       parent_id=COALESCE($3,parent_id), head_user_id=COALESCE($4,head_user_id),
       updated_at=NOW()
     WHERE id=$5 AND tenant_id=$6 RETURNING *`,
    [name, description, parentId, headUserId, id, req.tenantId]
  );
  if (!result.rows[0]) return res.status(404).json({ success: false, message: 'Department not found' });
  sendSuccess(res, result.rows[0], 'Department updated');
});

const deleteDepartment = asyncHandler(async (req, res) => {
  const { id } = req.params;
  await query('UPDATE departments SET is_active=false WHERE id=$1 AND tenant_id=$2', [id, req.tenantId]);
  sendSuccess(res, {}, 'Department deleted');
});

module.exports = { listDepartments, createDepartment, updateDepartment, deleteDepartment };
