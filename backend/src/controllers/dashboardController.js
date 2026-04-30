const { query } = require('../config/database');
const { asyncHandler, sendSuccess } = require('../middleware/helpers');

const getDashboard = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;

  const [usersR, modulesR, recordsR, recentR, workflowR] = await Promise.all([
    query(`SELECT COUNT(*) AS total, COUNT(*) FILTER(WHERE is_active) AS active FROM users WHERE tenant_id=$1`, [tenantId]),
    query(`SELECT COUNT(*) AS total FROM tenant_modules WHERE tenant_id=$1 AND is_enabled=true`, [tenantId]),
    query(
      `SELECT m.name AS module_name, m.slug, COUNT(r.id) AS count
       FROM modules m
       JOIN tenant_modules tm ON tm.module_id=m.id AND tm.tenant_id=$1 AND tm.is_enabled=true
       LEFT JOIN records r ON r.module_id=m.id AND r.tenant_id=$1 AND r.is_archived=false
       WHERE m.slug != 'dashboard'
       GROUP BY m.id, m.name, m.slug ORDER BY count DESC`,
      [tenantId]
    ),
    query(
      `SELECT r.id, r.record_number, r.title, r.status, r.created_at,
              m.name AS module_name, m.slug AS module_slug
       FROM records r JOIN modules m ON m.id=r.module_id
       WHERE r.tenant_id=$1 AND r.is_archived=false
       ORDER BY r.created_at DESC LIMIT 8`,
      [tenantId]
    ),
    query(
      `SELECT wl.trigger_status, wl.created_at,
              fm.name AS from_module, tm.name AS to_module,
              fr.record_number AS from_record, tr.record_number AS to_record
       FROM workflow_log wl
       JOIN modules fm ON fm.id=wl.from_module_id
       JOIN modules tm ON tm.id=wl.to_module_id
       LEFT JOIN records fr ON fr.id=wl.from_record_id
       LEFT JOIN records tr ON tr.id=wl.to_record_id
       WHERE wl.tenant_id=$1 ORDER BY wl.created_at DESC LIMIT 5`,
      [tenantId]
    ),
  ]);

  sendSuccess(res, {
    stats: {
      users: usersR.rows[0],
      modules: modulesR.rows[0],
      totalRecords: recordsR.rows.reduce((s, r) => s + parseInt(r.count), 0),
    },
    moduleActivity: recordsR.rows,
    recentRecords: recentR.rows,
    recentWorkflow: workflowR.rows,
  });
});

const getSuperDashboard = asyncHandler(async (req, res) => {
  const [tenantsR, usersR, workflowR] = await Promise.all([
    query(`SELECT COUNT(*) AS total, COUNT(*) FILTER(WHERE is_active) AS active,
           COUNT(*) FILTER(WHERE subscription_plan='trial') AS trial FROM tenants`),
    query(`SELECT COUNT(*) FROM users WHERE tenant_id IS NOT NULL`),
    query(`SELECT COUNT(*) FROM workflow_log`),
  ]);

  const recent = await query(
    `SELECT t.*, i.name AS industry_name,
       (SELECT COUNT(*) FROM users u WHERE u.tenant_id=t.id) AS user_count
     FROM tenants t JOIN industries i ON i.id=t.industry_id
     ORDER BY t.created_at DESC LIMIT 10`
  );

  sendSuccess(res, {
    stats: { tenants: tenantsR.rows[0], users: usersR.rows[0], workflows: workflowR.rows[0] },
    recentTenants: recent.rows,
  });
});

module.exports = { getDashboard, getSuperDashboard };
