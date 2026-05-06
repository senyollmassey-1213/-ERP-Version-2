const bcrypt = require('bcryptjs');
const { query, getClient } = require('../config/database');
const { asyncHandler, sendSuccess, getPagination, paginatedResponse } = require('../middleware/helpers');

const listTenants = asyncHandler(async (req, res) => {
  const { page, limit, offset } = getPagination(req);
  const search = req.query.search || '';
  const countR = await query(`SELECT COUNT(*) FROM tenants t WHERE t.name ILIKE $1`, [`%${search}%`]);
  const r = await query(
    `SELECT t.*, i.name AS industry_name, i.slug AS industry_slug,
       (SELECT COUNT(*) FROM users u WHERE u.tenant_id=t.id) AS user_count
     FROM tenants t JOIN industries i ON i.id=t.industry_id
     WHERE t.name ILIKE $1 ORDER BY t.created_at DESC LIMIT $2 OFFSET $3`,
    [`%${search}%`, limit, offset]
  );
  paginatedResponse(res, r.rows, parseInt(countR.rows[0].count), page, limit);
});

const getTenant = asyncHandler(async (req, res) => {
  const r = await query(
    `SELECT t.*, i.name AS industry_name,
       json_agg(json_build_object('id',m.id,'name',m.name,'slug',m.slug,'is_enabled',tm.is_enabled)
         ORDER BY tm.sort_order) FILTER (WHERE m.id IS NOT NULL) AS modules
     FROM tenants t JOIN industries i ON i.id=t.industry_id
     LEFT JOIN tenant_modules tm ON tm.tenant_id=t.id
     LEFT JOIN modules m ON m.id=tm.module_id
     WHERE t.id=$1 GROUP BY t.id, i.name`,
    [req.params.id]
  );
  if (!r.rows[0]) return res.status(404).json({ success: false, message: 'Company not found' });
  sendSuccess(res, r.rows[0]);
});

const getMyTenant = asyncHandler(async (req, res) => {
  const r = await query(
    `SELECT t.*, i.name AS industry_name, i.slug AS industry_slug
     FROM tenants t JOIN industries i ON i.id=t.industry_id WHERE t.id=$1`,
    [req.tenantId]
  );
  if (!r.rows[0]) return res.status(404).json({ success: false, message: 'Tenant not found' });
  sendSuccess(res, r.rows[0]);
});

const createTenant = asyncHandler(async (req, res) => {
  const { name, slug, industryId, moduleIds = [], adminEmail, adminPassword, adminFirstName = 'Admin', adminLastName = '', subscriptionPlan = 'trial' } = req.body;
  if (!name || !slug || !industryId || !adminEmail || !adminPassword)
    return res.status(400).json({ success: false, message: 'name, slug, industryId, adminEmail, adminPassword required' });
  if (!/^[a-z0-9-]+$/.test(slug))
    return res.status(400).json({ success: false, message: 'Slug: lowercase letters, numbers, hyphens only' });
  if (moduleIds.length > 0) {
    const valid = await query(`SELECT module_id FROM industry_modules WHERE industry_id=$1 AND module_id = ANY($2::uuid[])`, [industryId, moduleIds]);
    if (valid.rows.length !== moduleIds.length)
      return res.status(400).json({ success: false, message: 'One or more modules do not belong to this industry' });
  }
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const tr = await client.query(
      `INSERT INTO tenants (name, slug, industry_id, subscription_plan, created_by_role) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [name, slug, industryId, subscriptionPlan, req.user.role]
    );
    const tenant = tr.rows[0];
    const dashboardR = await client.query(`SELECT id FROM modules WHERE slug='dashboard'`);
    const allModuleIds = [...new Set([dashboardR.rows[0]?.id, ...moduleIds].filter(Boolean))];
    for (let i = 0; i < allModuleIds.length; i++) {
      await client.query(`INSERT INTO tenant_modules (tenant_id, module_id, is_enabled, sort_order) VALUES ($1,$2,true,$3) ON CONFLICT DO NOTHING`, [tenant.id, allModuleIds[i], i]);
    }
    const hash = await bcrypt.hash(adminPassword, 12);
    await client.query(`INSERT INTO users (tenant_id, email, password_hash, first_name, last_name, role) VALUES ($1,$2,$3,$4,$5,'user_admin')`, [tenant.id, adminEmail.toLowerCase(), hash, adminFirstName, adminLastName]);
    await client.query('COMMIT');
    sendSuccess(res, tenant, 'Company created', 201);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

const updateTenant = asyncHandler(async (req, res) => {
  const { name, logoUrl, primaryColor, secondaryColor, subscriptionPlan, isActive, address, gstNumber, phone, website, invoicePrefix } = req.body;
  const r = await query(
    `UPDATE tenants SET name=COALESCE($1,name), logo_url=COALESCE($2,logo_url),
       primary_color=COALESCE($3,primary_color), secondary_color=COALESCE($4,secondary_color),
       subscription_plan=COALESCE($5,subscription_plan), is_active=COALESCE($6,is_active),
       address=COALESCE($7,address), gst_number=COALESCE($8,gst_number),
       phone=COALESCE($9,phone), website=COALESCE($10,website),
       invoice_prefix=COALESCE($11,invoice_prefix), updated_at=NOW()
     WHERE id=$12 RETURNING *`,
    [name, logoUrl, primaryColor, secondaryColor, subscriptionPlan, isActive, address, gstNumber, phone, website, invoicePrefix, req.params.id]
  );
  if (!r.rows[0]) return res.status(404).json({ success: false, message: 'Company not found' });
  sendSuccess(res, r.rows[0], 'Company updated');
});

const updateMyTenant = asyncHandler(async (req, res) => {
  const { logoUrl, primaryColor, secondaryColor, address, gstNumber, phone, website, invoicePrefix, staffSettings } = req.body;
  const r = await query(
    `UPDATE tenants SET
       logo_url=COALESCE($1,logo_url), primary_color=COALESCE($2,primary_color),
       secondary_color=COALESCE($3,secondary_color), address=COALESCE($4,address),
       gst_number=COALESCE($5,gst_number), phone=COALESCE($6,phone),
       website=COALESCE($7,website), invoice_prefix=COALESCE($8,invoice_prefix),
       staff_settings=COALESCE($9::jsonb,staff_settings), updated_at=NOW()
     WHERE id=$10 RETURNING *`,
    [logoUrl, primaryColor, secondaryColor, address, gstNumber, phone, website, invoicePrefix,
     staffSettings ? JSON.stringify(staffSettings) : null, req.tenantId]
  );
  if (!r.rows[0]) return res.status(404).json({ success: false, message: 'Tenant not found' });
  sendSuccess(res, r.rows[0], 'Hotel info updated');
});

const deleteTenant = asyncHandler(async (req, res) => {
  await query(`DELETE FROM tenants WHERE id=$1`, [req.params.id]);
  sendSuccess(res, {}, 'Company deleted');
});

module.exports = { listTenants, getTenant, getMyTenant, createTenant, updateTenant, updateMyTenant, deleteTenant };
