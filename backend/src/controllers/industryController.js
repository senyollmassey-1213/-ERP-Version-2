const { query } = require('../config/database');
const { asyncHandler, sendSuccess } = require('../middleware/helpers');

// List all industries with their module chains
const listIndustries = asyncHandler(async (req, res) => {
  const r = await query(
    `SELECT i.*,
       json_agg(json_build_object('id',m.id,'name',m.name,'slug',m.slug,'icon',m.icon,'sort_order',im.sort_order)
         ORDER BY im.sort_order) FILTER (WHERE m.id IS NOT NULL) AS modules
     FROM industries i
     LEFT JOIN industry_modules im ON im.industry_id=i.id
     LEFT JOIN modules m ON m.id=im.module_id AND m.is_active=true
     WHERE i.is_active=true
     GROUP BY i.id ORDER BY i.name`
  );
  sendSuccess(res, r.rows);
});

const getIndustry = asyncHandler(async (req, res) => {
  const r = await query(
    `SELECT i.*,
       json_agg(json_build_object('id',m.id,'name',m.name,'slug',m.slug,'icon',m.icon,'sort_order',im.sort_order)
         ORDER BY im.sort_order) FILTER (WHERE m.id IS NOT NULL) AS modules
     FROM industries i
     LEFT JOIN industry_modules im ON im.industry_id=i.id
     LEFT JOIN modules m ON m.id=im.module_id
     WHERE i.id=$1 GROUP BY i.id`,
    [req.params.id]
  );
  if (!r.rows[0]) return res.status(404).json({ success: false, message: 'Industry not found' });
  sendSuccess(res, r.rows[0]);
});

// Super Admin creates a new industry
const createIndustry = asyncHandler(async (req, res) => {
  const { name, slug, description, moduleIds = [] } = req.body;
  if (!name || !slug) return res.status(400).json({ success: false, message: 'name and slug required' });

  const client = await require('../config/database').getClient();
  try {
    await client.query('BEGIN');
    const r = await client.query(
      `INSERT INTO industries (name, slug, description) VALUES ($1,$2,$3) RETURNING *`,
      [name, slug, description]
    );
    const industry = r.rows[0];
    for (let i = 0; i < moduleIds.length; i++) {
      await client.query(
        `INSERT INTO industry_modules (industry_id, module_id, sort_order) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`,
        [industry.id, moduleIds[i], i]
      );
    }
    await client.query('COMMIT');
    sendSuccess(res, industry, 'Industry created', 201);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

const updateIndustry = asyncHandler(async (req, res) => {
  const { name, description } = req.body;
  const r = await query(
    `UPDATE industries SET name=COALESCE($1,name), description=COALESCE($2,description) WHERE id=$3 RETURNING *`,
    [name, description, req.params.id]
  );
  if (!r.rows[0]) return res.status(404).json({ success: false, message: 'Industry not found' });
  sendSuccess(res, r.rows[0], 'Industry updated');
});

// Add module to existing industry
const addModuleToIndustry = asyncHandler(async (req, res) => {
  const { moduleId, sortOrder = 99 } = req.body;
  await query(
    `INSERT INTO industry_modules (industry_id, module_id, sort_order) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`,
    [req.params.id, moduleId, sortOrder]
  );
  sendSuccess(res, {}, 'Module added to industry');
});

module.exports = { listIndustries, getIndustry, createIndustry, updateIndustry, addModuleToIndustry };
