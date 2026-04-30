const { query } = require('../config/database');
const { asyncHandler, sendSuccess } = require('../middleware/helpers');

const VALID_FIELD_TYPES = [
  'text', 'textarea', 'number', 'date', 'datetime', 'time',
  'dropdown', 'multi_select', 'boolean', 'file', 'currency',
  'formula', 'email', 'phone', 'url', 'rating', 'color',
];

// ─── GET FIELDS FOR MODULE ────────────────────────────────────────────────────
const getFields = asyncHandler(async (req, res) => {
  const { moduleId } = req.params;
  const { sectionId } = req.query;

  let sql = `
    SELECT fd.*, ms.name AS section_name
    FROM field_definitions fd
    LEFT JOIN module_sections ms ON ms.id=fd.section_id
    WHERE fd.tenant_id=$1 AND fd.module_catalog_id=$2 AND fd.is_active=true
  `;
  const params = [req.tenantId, moduleId];

  if (sectionId) {
    sql += ` AND fd.section_id=$3`;
    params.push(sectionId);
  }
  sql += ' ORDER BY fd.sort_order, fd.created_at';

  const result = await query(sql, params);
  sendSuccess(res, result.rows);
});

// ─── CREATE FIELD ─────────────────────────────────────────────────────────────
const createField = asyncHandler(async (req, res) => {
  const { moduleId } = req.params;
  const {
    name, label, fieldType, sectionId,
    isRequired = false, isUnique = false,
    defaultValue, placeholder, options,
    formula, validationRules, settings,
    sortOrder = 0,
  } = req.body;

  if (!name || !label || !fieldType) {
    return res.status(400).json({ success: false, message: 'name, label, fieldType are required' });
  }

  if (!VALID_FIELD_TYPES.includes(fieldType)) {
    return res.status(400).json({
      success: false,
      message: `Invalid field type. Allowed: ${VALID_FIELD_TYPES.join(', ')}`,
    });
  }

  // Validate options for dropdown / multi_select
  if (['dropdown', 'multi_select'].includes(fieldType) && !options) {
    return res.status(400).json({
      success: false,
      message: 'Options array required for dropdown/multi_select fields',
    });
  }

  // Check name uniqueness within module
  const existing = await query(
    'SELECT id FROM field_definitions WHERE tenant_id=$1 AND module_catalog_id=$2 AND name=$3 AND is_active=true',
    [req.tenantId, moduleId, name]
  );
  if (existing.rows[0]) {
    return res.status(409).json({ success: false, message: `Field with name "${name}" already exists in this module` });
  }

  const result = await query(
    `INSERT INTO field_definitions
       (tenant_id, module_catalog_id, section_id, name, label, field_type,
        is_required, is_unique, default_value, placeholder, options,
        formula, validation_rules, settings, sort_order)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
     RETURNING *`,
    [
      req.tenantId, moduleId, sectionId || null,
      name, label, fieldType,
      isRequired, isUnique, defaultValue, placeholder,
      options ? JSON.stringify(options) : null,
      formula,
      validationRules ? JSON.stringify(validationRules) : null,
      settings ? JSON.stringify(settings) : null,
      sortOrder,
    ]
  );
  sendSuccess(res, result.rows[0], 'Field created', 201);
});

// ─── UPDATE FIELD ─────────────────────────────────────────────────────────────
const updateField = asyncHandler(async (req, res) => {
  const { fieldId } = req.params;
  const {
    label, isRequired, isUnique, defaultValue,
    placeholder, options, formula, validationRules,
    settings, sortOrder, sectionId,
  } = req.body;

  const result = await query(
    `UPDATE field_definitions SET
       label=COALESCE($1,label),
       is_required=COALESCE($2,is_required),
       is_unique=COALESCE($3,is_unique),
       default_value=COALESCE($4,default_value),
       placeholder=COALESCE($5,placeholder),
       options=COALESCE($6::jsonb,options),
       formula=COALESCE($7,formula),
       validation_rules=COALESCE($8::jsonb,validation_rules),
       settings=COALESCE($9::jsonb,settings),
       sort_order=COALESCE($10,sort_order),
       section_id=COALESCE($11,section_id),
       updated_at=NOW()
     WHERE id=$12 AND tenant_id=$13 AND is_system=false
     RETURNING *`,
    [
      label, isRequired, isUnique, defaultValue, placeholder,
      options ? JSON.stringify(options) : null,
      formula,
      validationRules ? JSON.stringify(validationRules) : null,
      settings ? JSON.stringify(settings) : null,
      sortOrder, sectionId, fieldId, req.tenantId,
    ]
  );
  if (!result.rows[0]) return res.status(404).json({ success: false, message: 'Field not found or is a system field' });
  sendSuccess(res, result.rows[0], 'Field updated');
});

// ─── DELETE FIELD ─────────────────────────────────────────────────────────────
const deleteField = asyncHandler(async (req, res) => {
  const { fieldId } = req.params;
  const result = await query(
    `UPDATE field_definitions SET is_active=false, updated_at=NOW()
     WHERE id=$1 AND tenant_id=$2 AND is_system=false RETURNING id`,
    [fieldId, req.tenantId]
  );
  if (!result.rows[0]) return res.status(404).json({ success: false, message: 'Field not found or cannot be deleted' });
  sendSuccess(res, {}, 'Field deleted');
});

// ─── REORDER FIELDS ───────────────────────────────────────────────────────────
const reorderFields = asyncHandler(async (req, res) => {
  const { fields } = req.body; // [{id, sortOrder}]
  if (!Array.isArray(fields)) {
    return res.status(400).json({ success: false, message: 'fields array required' });
  }

  const client = await require('../config/database').getClient();
  try {
    await client.query('BEGIN');
    for (const { id, sortOrder } of fields) {
      await client.query(
        'UPDATE field_definitions SET sort_order=$1 WHERE id=$2 AND tenant_id=$3',
        [sortOrder, id, req.tenantId]
      );
    }
    await client.query('COMMIT');
    sendSuccess(res, {}, 'Fields reordered');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

module.exports = { getFields, createField, updateField, deleteField, reorderFields };
