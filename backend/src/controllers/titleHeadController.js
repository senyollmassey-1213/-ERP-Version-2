const { query } = require('../config/database');
const { asyncHandler, sendSuccess } = require('../middleware/helpers');

// Get all title heads for a given industry + module
const getTitleHeads = asyncHandler(async (req, res) => {
  const { industryId, moduleId } = req.params;
  const r = await query(
    `SELECT th.*, m.name AS module_name, i.name AS industry_name
     FROM title_heads th
     JOIN modules m ON m.id=th.module_id
     JOIN industries i ON i.id=th.industry_id
     WHERE th.industry_id=$1 AND th.module_id=$2 AND th.is_active=true
     ORDER BY th.sort_order`,
    [industryId, moduleId]
  );
  sendSuccess(res, r.rows);
});

// Create title head (Super Admin only)
const createTitleHead = asyncHandler(async (req, res) => {
  const { industryId, moduleId } = req.params;
  const { name, label, field_type = 'text', options, is_required = false, sort_order = 99 } = req.body;

  if (!name || !label)
    return res.status(400).json({ success: false, message: 'name and label required' });

  if (!['text','number','date','datetime','dropdown','boolean','currency','textarea','email','phone','url']
        .includes(field_type))
    return res.status(400).json({ success: false, message: 'Invalid field_type' });

  if (field_type === 'dropdown' && !options?.length)
    return res.status(400).json({ success: false, message: 'options required for dropdown' });

  const r = await query(
    `INSERT INTO title_heads (industry_id, module_id, name, label, field_type, options, is_required, sort_order)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [industryId, moduleId, name, label, field_type,
     options ? JSON.stringify(options) : null, is_required, sort_order]
  );
  sendSuccess(res, r.rows[0], 'Title head created', 201);
});

const updateTitleHead = asyncHandler(async (req, res) => {
  const { label, options, is_required, sort_order } = req.body;
  const r = await query(
    `UPDATE title_heads SET
       label=COALESCE($1,label),
       options=COALESCE($2::jsonb,options),
       is_required=COALESCE($3,is_required),
       sort_order=COALESCE($4,sort_order)
     WHERE id=$5 RETURNING *`,
    [label, options ? JSON.stringify(options) : null, is_required, sort_order, req.params.id]
  );
  if (!r.rows[0]) return res.status(404).json({ success: false, message: 'Title head not found' });
  sendSuccess(res, r.rows[0], 'Title head updated');
});

const deleteTitleHead = asyncHandler(async (req, res) => {
  await query(`UPDATE title_heads SET is_active=false WHERE id=$1`, [req.params.id]);
  sendSuccess(res, {}, 'Title head deleted');
});

module.exports = { getTitleHeads, createTitleHead, updateTitleHead, deleteTitleHead };
