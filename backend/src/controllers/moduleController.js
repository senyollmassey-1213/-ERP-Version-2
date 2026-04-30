const { query } = require('../config/database');
const { asyncHandler, sendSuccess } = require('../middleware/helpers');

// Get all modules for a tenant (enabled subset of industry modules)
const getTenantModules = asyncHandler(async (req, res) => {
  let tenantId = req.tenantId;

  // user_admin can query their own tenant
  const r = await query(
    `SELECT m.id, m.name, m.slug, m.icon, m.sort_order,
            tm.is_enabled, tm.sort_order AS tenant_sort_order
     FROM tenant_modules tm
     JOIN modules m ON m.id=tm.module_id
     WHERE tm.tenant_id=$1 AND tm.is_enabled=true AND m.is_active=true
     ORDER BY COALESCE(tm.sort_order, m.sort_order)`,
    [tenantId]
  );
  sendSuccess(res, r.rows);
});

// Get all modules in the system (for super admin / client servicing)
const getAllModules = asyncHandler(async (req, res) => {
  const r = await query(`SELECT * FROM modules WHERE is_active=true ORDER BY sort_order`);
  sendSuccess(res, r.rows);
});

// Get modules available for an industry (for client servicing when creating tenant)
const getIndustryModules = asyncHandler(async (req, res) => {
  const r = await query(
    `SELECT m.id, m.name, m.slug, m.icon, im.sort_order
     FROM industry_modules im
     JOIN modules m ON m.id=im.module_id AND m.is_active=true
     WHERE im.industry_id=$1
     ORDER BY im.sort_order`,
    [req.params.industryId]
  );
  sendSuccess(res, r.rows);
});

// Get title heads for a specific tenant's module (uses their industry)
const getModuleTitleHeads = asyncHandler(async (req, res) => {
  const { moduleSlug } = req.params;

  // Get tenant's industry
  const tenantR = await query(`SELECT industry_id FROM tenants WHERE id=$1`, [req.tenantId]);
  if (!tenantR.rows[0]) return res.status(404).json({ success: false, message: 'Tenant not found' });

  const r = await query(
    `SELECT th.* FROM title_heads th
     JOIN modules m ON m.id=th.module_id
     WHERE th.industry_id=$1 AND m.slug=$2 AND th.is_active=true
     ORDER BY th.sort_order`,
    [tenantR.rows[0].industry_id, moduleSlug]
  );
  sendSuccess(res, r.rows);
});

module.exports = { getTenantModules, getAllModules, getIndustryModules, getModuleTitleHeads };
