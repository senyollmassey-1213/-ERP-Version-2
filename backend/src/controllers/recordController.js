const { query, getClient } = require('../config/database');
const { asyncHandler, sendSuccess, getPagination, paginatedResponse } = require('../middleware/helpers');

// ── Workflow rules per industry ───────────────────────────────────────────────
// When a record's status changes to the trigger, auto-create a record in the next module
const WORKFLOW_RULES = {
  manufacturing: [
    { fromSlug: 'crm',        triggerStatus: 'converted',  toSlug: 'sales',      copyFields: ['company_name','contact_name','phone','email'] },
    { fromSlug: 'sales',      triggerStatus: 'confirmed',  toSlug: 'production', copyFields: ['customer_name','product','quantity','delivery_date'] },
    { fromSlug: 'production', triggerStatus: 'complete',   toSlug: 'billing',    copyFields: ['job_number','product_name','quantity'] },
    { fromSlug: 'billing',    triggerStatus: 'paid',       toSlug: 'reports',    copyFields: ['customer_name','total','payment_date'] },
  ],
  production: [
    { fromSlug: 'crm',     triggerStatus: 'converted', toSlug: 'job',     copyFields: ['company_name','contact_name','phone','email','estimated_value'] },
    { fromSlug: 'job',     triggerStatus: 'complete',  toSlug: 'billing', copyFields: ['client_name','job_number','cost'] },
    { fromSlug: 'billing', triggerStatus: 'paid',      toSlug: 'reports', copyFields: ['client_name','total','payment_date'] },
  ],
  warehousing: [
    { fromSlug: 'crm',       triggerStatus: 'converted', toSlug: 'storage',   copyFields: ['company_name','contact_name','phone','email','contract_value'] },
    { fromSlug: 'storage',   triggerStatus: 'dispatched',toSlug: 'warehouse', copyFields: ['client_name','item_description','quantity','unit'] },
    { fromSlug: 'warehouse', triggerStatus: 'complete',  toSlug: 'billing',   copyFields: ['client_name'] },
    { fromSlug: 'billing',   triggerStatus: 'paid',      toSlug: 'reports',   copyFields: ['client_name','total','payment_date'] },
  ],
};

const generateRecordNumber = async (tenantId, moduleSlug) => {
  const prefix = moduleSlug.toUpperCase().substring(0, 4);
  const r = await query(
    `SELECT COUNT(*) FROM records r
     JOIN modules m ON m.id=r.module_id
     WHERE r.tenant_id=$1 AND m.slug=$2`,
    [tenantId, moduleSlug]
  );
  return `${prefix}-${String(parseInt(r.rows[0].count) + 1).padStart(5, '0')}`;
};

const listRecords = asyncHandler(async (req, res) => {
  const { moduleSlug } = req.params;
  const { page, limit, offset } = getPagination(req);
  const { search, status } = req.query;

  const modR = await query(`SELECT id FROM modules WHERE slug=$1`, [moduleSlug]);
  if (!modR.rows[0]) return res.status(404).json({ success: false, message: 'Module not found' });
  const moduleId = modR.rows[0].id;

  let conditions = [`r.tenant_id=$1`, `r.module_id=$2`, `r.is_archived=false`];
  let params = [req.tenantId, moduleId];
  let idx = 3;

  if (status)  { conditions.push(`r.status=$${idx++}`); params.push(status); }
  if (search)  { conditions.push(`(r.title ILIKE $${idx} OR r.record_number ILIKE $${idx})`); params.push(`%${search}%`); idx++; }

  const where = conditions.join(' AND ');
  const countR = await query(`SELECT COUNT(*) FROM records r WHERE ${where}`, params);
  const r = await query(
    `SELECT r.*, u.first_name||' '||u.last_name AS assigned_to_name,
            cu.first_name||' '||cu.last_name AS created_by_name
     FROM records r
     LEFT JOIN users u ON u.id=r.assigned_to
     LEFT JOIN users cu ON cu.id=r.created_by
     WHERE ${where} ORDER BY r.created_at DESC LIMIT $${idx} OFFSET $${idx+1}`,
    [...params, limit, offset]
  );
  paginatedResponse(res, r.rows, parseInt(countR.rows[0].count), page, limit);
});

const getRecord = asyncHandler(async (req, res) => {
  const r = await query(
    `SELECT r.*, m.name AS module_name, m.slug AS module_slug,
            u.first_name||' '||u.last_name AS assigned_to_name,
            cu.first_name||' '||cu.last_name AS created_by_name
     FROM records r
     JOIN modules m ON m.id=r.module_id
     LEFT JOIN users u ON u.id=r.assigned_to
     LEFT JOIN users cu ON cu.id=r.created_by
     WHERE r.id=$1 AND r.tenant_id=$2`,
    [req.params.id, req.tenantId]
  );
  if (!r.rows[0]) return res.status(404).json({ success: false, message: 'Record not found' });
  sendSuccess(res, r.rows[0]);
});

const createRecord = asyncHandler(async (req, res) => {
  const { moduleSlug } = req.params;
  const { title, data = {}, status = 'active', assignedTo } = req.body;

  const modR = await query(
    `SELECT m.id, m.slug FROM modules m
     JOIN tenant_modules tm ON tm.module_id=m.id
     WHERE m.slug=$1 AND tm.tenant_id=$2 AND tm.is_enabled=true`,
    [moduleSlug, req.tenantId]
  );
  if (!modR.rows[0]) return res.status(404).json({ success: false, message: 'Module not found or disabled' });

  const tenantR = await query(`SELECT industry_id FROM tenants WHERE id=$1`, [req.tenantId]);
  const industryId = tenantR.rows[0].industry_id;
  const recordNumber = await generateRecordNumber(req.tenantId, moduleSlug);

  const r = await query(
    `INSERT INTO records (tenant_id, module_id, industry_id, record_number, title, data, status, assigned_to, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [req.tenantId, modR.rows[0].id, industryId, recordNumber, title, JSON.stringify(data), status, assignedTo || null, req.user.id]
  );

  await query(
    `INSERT INTO audit_logs (tenant_id, user_id, action, entity_type, entity_id, new_data)
     VALUES ($1,$2,'created','record',$3,$4)`,
    [req.tenantId, req.user.id, r.rows[0].id, JSON.stringify(data)]
  );

  sendSuccess(res, r.rows[0], 'Record created', 201);
});

const updateRecord = asyncHandler(async (req, res) => {
  const { title, data, status, assignedTo } = req.body;

  const oldR = await query(`SELECT * FROM records WHERE id=$1 AND tenant_id=$2`, [req.params.id, req.tenantId]);
  if (!oldR.rows[0]) return res.status(404).json({ success: false, message: 'Record not found' });
  const old = oldR.rows[0];

  const r = await query(
    `UPDATE records SET
       title=COALESCE($1,title), data=COALESCE($2::jsonb,data),
       status=COALESCE($3,status), assigned_to=COALESCE($4,assigned_to),
       updated_by=$5, updated_at=NOW()
     WHERE id=$6 AND tenant_id=$7 RETURNING *`,
    [title, data ? JSON.stringify(data) : null, status, assignedTo, req.user.id, req.params.id, req.tenantId]
  );

  await query(
    `INSERT INTO audit_logs (tenant_id, user_id, action, entity_type, entity_id, old_data, new_data)
     VALUES ($1,$2,'updated','record',$3,$4,$5)`,
    [req.tenantId, req.user.id, req.params.id, old.data, JSON.stringify(data || {})]
  );

  // ── WORKFLOW: check if status change triggers auto-creation ──────────────
  if (status && status !== old.status) {
    await triggerWorkflow(req, r.rows[0], old.status, status);
  }

  sendSuccess(res, r.rows[0], 'Record updated');
});

const deleteRecord = asyncHandler(async (req, res) => {
  await query(`UPDATE records SET is_archived=true, updated_at=NOW() WHERE id=$1 AND tenant_id=$2`,
    [req.params.id, req.tenantId]);
  sendSuccess(res, {}, 'Record deleted');
});

// ── WORKFLOW ENGINE ────────────────────────────────────────────────────────────
async function triggerWorkflow(req, record, oldStatus, newStatus) {
  try {
    // Get industry slug
    const tenantR = await query(
      `SELECT i.slug AS industry_slug FROM tenants t JOIN industries i ON i.id=t.industry_id WHERE t.id=$1`,
      [req.tenantId]
    );
    if (!tenantR.rows[0]) return;
    const industrySlug = tenantR.rows[0].industry_slug;

    const rules = WORKFLOW_RULES[industrySlug] || [];
    const fromModR = await query(`SELECT slug FROM modules WHERE id=$1`, [record.module_id]);
    if (!fromModR.rows[0]) return;
    const fromSlug = fromModR.rows[0].slug;

    const rule = rules.find(r => r.fromSlug === fromSlug && r.triggerStatus === newStatus);
    if (!rule) return;

    // Check if target module is enabled for this tenant
    const toModR = await query(
      `SELECT m.id FROM modules m
       JOIN tenant_modules tm ON tm.module_id=m.id
       WHERE m.slug=$1 AND tm.tenant_id=$2 AND tm.is_enabled=true`,
      [rule.toSlug, req.tenantId]
    );
    if (!toModR.rows[0]) return;
    const toModuleId = toModR.rows[0].id;

    // Copy specified fields from source record
    const copiedData = {};
    for (const field of rule.copyFields) {
      if (record.data[field] !== undefined) copiedData[field] = record.data[field];
    }
    copiedData['_linked_from'] = record.record_number;
    copiedData['_linked_record_id'] = record.id;

    const newNumber = await generateRecordNumber(req.tenantId, rule.toSlug);
    const newTitle = `From ${record.record_number}${record.title ? ' — ' + record.title : ''}`;

    const newRecR = await query(
      `INSERT INTO records (tenant_id, module_id, industry_id, record_number, title, data, status, created_by, parent_record_id, source_module_id)
       VALUES ($1,$2,$3,$4,$5,$6,'active',$7,$8,$9) RETURNING *`,
      [req.tenantId, toModuleId, record.industry_id, newNumber, newTitle, JSON.stringify(copiedData), req.user.id, record.id, record.module_id]
    );

    // Log workflow
    await query(
      `INSERT INTO workflow_log (tenant_id, from_record_id, to_record_id, from_module_id, to_module_id, trigger_status, triggered_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [req.tenantId, record.id, newRecR.rows[0].id, record.module_id, toModuleId, newStatus, req.user.id]
    );

    console.log(`  ↪ Workflow: ${fromSlug} → ${rule.toSlug} (trigger: ${newStatus}) → created ${newNumber}`);
  } catch (err) {
    console.error('Workflow trigger error:', err.message);
  }
}

const getRecordStats = asyncHandler(async (req, res) => {
  const { moduleSlug } = req.params;
  const modR = await query(`SELECT id FROM modules WHERE slug=$1`, [moduleSlug]);
  if (!modR.rows[0]) return res.status(404).json({ success: false, message: 'Module not found' });

  const r = await query(
    `SELECT status, COUNT(*) AS count FROM records
     WHERE tenant_id=$1 AND module_id=$2 AND is_archived=false
     GROUP BY status`,
    [req.tenantId, modR.rows[0].id]
  );

  const totR = await query(
    `SELECT COUNT(*) AS total,
       COUNT(*) FILTER (WHERE created_at >= NOW()-INTERVAL '30 days') AS this_month,
       COUNT(*) FILTER (WHERE created_at >= NOW()-INTERVAL '7 days') AS this_week
     FROM records WHERE tenant_id=$1 AND module_id=$2 AND is_archived=false`,
    [req.tenantId, modR.rows[0].id]
  );

  sendSuccess(res, { byStatus: r.rows, summary: totR.rows[0] });
});

module.exports = { listRecords, getRecord, createRecord, updateRecord, deleteRecord, getRecordStats };
