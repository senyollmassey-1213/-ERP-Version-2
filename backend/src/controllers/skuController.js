/**
 * skuController.js
 * Handles QR code generation, scanning, label printing, and history
 */

const { query, getClient } = require('../config/database');
const { asyncHandler, sendSuccess } = require('../middleware/helpers');
const QRCode = require('qrcode');

// ── SKU Code Generator ────────────────────────────────────────────────────────
// Format: TYPE-TENANTPREFIX-NNNNN  e.g. INV-ABC-00042
const generateSkuCode = async (tenantId, labelType, moduleSlug) => {
  let prefix = 'GEN'; // generic (no tenant)

  if (tenantId) {
    // Get tenant slug for prefix
    const tr = await query(`SELECT slug FROM tenants WHERE id=$1`, [tenantId]);
    const slug = tr.rows[0]?.slug || 'ten';
    const tenantPrefix = slug.toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 3);
    const typePrefix = labelType === 'document' ? 'DOC' : (moduleSlug?.toUpperCase().substring(0, 3) || 'ITM');
    prefix = `${typePrefix}-${tenantPrefix}`;
  }

  // Count existing SKUs with this prefix to get next number
  const countR = await query(
    `SELECT COUNT(*) FROM item_skus WHERE sku_code LIKE $1`,
    [`${prefix}-%`]
  );
  const nextNum = parseInt(countR.rows[0].count) + 1;
  return `${prefix}-${String(nextNum).padStart(5, '0')}`;
};

// ── 1. Generate QR for an inventory item (User Admin / above) ─────────────────
const generateForRecord = asyncHandler(async (req, res) => {
  const { recordId } = req.params;
  const { labelType = 'item' } = req.body;

  // Get the record + its module slug
  const recR = await query(
    `SELECT r.*, m.slug AS module_slug FROM records r
     JOIN modules m ON m.id = r.module_id
     WHERE r.id=$1 AND r.tenant_id=$2`,
    [recordId, req.tenantId]
  );
  if (!recR.rows[0]) return res.status(404).json({ success: false, message: 'Record not found' });
  const record = recR.rows[0];

  // Check if QR already exists for this record
  const existing = await query(
    `SELECT * FROM item_skus WHERE record_id=$1`,
    [recordId]
  );
  if (existing.rows[0]) {
    // Return existing QR
    return sendSuccess(res, existing.rows[0], 'QR already exists');
  }

  const skuCode = await generateSkuCode(req.tenantId, labelType, record.module_slug);

  // Generate QR PNG as base64
  const qrData = await QRCode.toDataURL(skuCode, {
    errorCorrectionLevel: 'M',
    margin: 1,
    width: 200,
    color: { dark: '#0b1628', light: '#ffffff' },
  });

  const r = await query(
    `INSERT INTO item_skus (tenant_id, record_id, module_id, sku_code, label_type, generated_by, is_assigned, qr_data)
     VALUES ($1,$2,$3,$4,$5,$6,true,$7) RETURNING *`,
    [req.tenantId, recordId, record.module_id, skuCode, labelType, req.user.id, qrData]
  );

  sendSuccess(res, r.rows[0], 'QR generated', 201);
});

// ── 2. Bulk generate generic QRs (Super Admin / Client Servicing) ─────────────
// Used when client doesn't have a printer — super admin prints and hands over
const bulkGenerate = asyncHandler(async (req, res) => {
  const { quantity = 1, tenantId, labelType = 'item' } = req.body;

  if (quantity < 1 || quantity > 500) {
    return res.status(400).json({ success: false, message: 'Quantity must be 1–500' });
  }

  const targetTenantId = tenantId || null; // null = generic, no tenant assigned yet

  const generated = [];
  for (let i = 0; i < quantity; i++) {
    const skuCode = await generateSkuCode(targetTenantId, labelType, null);
    const qrData = await QRCode.toDataURL(skuCode, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 200,
      color: { dark: '#0b1628', light: '#ffffff' },
    });

    const r = await query(
      `INSERT INTO item_skus (tenant_id, record_id, module_id, sku_code, label_type, generated_by, is_assigned, qr_data)
       VALUES ($1,NULL,NULL,$2,$3,$4,false,$5) RETURNING *`,
      [targetTenantId, skuCode, labelType, req.user.id, qrData]
    );
    generated.push(r.rows[0]);
  }

  sendSuccess(res, generated, `${quantity} QR code(s) generated`, 201);
});

// ── 3. Get tenants list for super admin bulk generate dropdown ─────────────────
const getTenantsForQR = asyncHandler(async (req, res) => {
  const r = await query(
    `SELECT id, name, slug FROM tenants WHERE is_active=true ORDER BY name`
  );
  sendSuccess(res, r.rows);
});

// ── 4. Lookup by SKU code (when worker scans) ─────────────────────────────────
const lookupSku = asyncHandler(async (req, res) => {
  const { skuCode } = req.params;

  const r = await query(
    `SELECT s.*, r.title, r.record_number, r.data, r.status,
            m.name AS module_name, m.slug AS module_slug,
            t.name AS tenant_name
     FROM item_skus s
     LEFT JOIN records r ON r.id = s.record_id
     LEFT JOIN modules m ON m.id = s.module_id
     LEFT JOIN tenants t ON t.id = s.tenant_id
     WHERE s.sku_code=$1`,
    [skuCode]
  );

  if (!r.rows[0]) {
    return res.status(404).json({ success: false, message: 'QR code not found in system' });
  }

  const sku = r.rows[0];

  // Get title heads for this module if record exists (to know which fields to show)
  let titleHeads = [];
  if (sku.module_id && sku.tenant_id) {
    const tenantR = await query(`SELECT industry_id FROM tenants WHERE id=$1`, [sku.tenant_id]);
    if (tenantR.rows[0]) {
      const thR = await query(
        `SELECT * FROM title_heads WHERE industry_id=$1 AND module_id=$2 AND is_active=true ORDER BY sort_order`,
        [tenantR.rows[0].industry_id, sku.module_id]
      );
      titleHeads = thR.rows;
    }
  }

  sendSuccess(res, { sku, titleHeads });
});

// ── 5. Log a scan event + optionally update record / assign QR ────────────────
const logScan = asyncHandler(async (req, res) => {
  const { skuCode } = req.params;
  const { action = 'scanned', location, notes, recordData, assignToRecord } = req.body;

  const skuR = await query(`SELECT * FROM item_skus WHERE sku_code=$1`, [skuCode]);
  if (!skuR.rows[0]) {
    return res.status(404).json({ success: false, message: 'SKU not found' });
  }
  const sku = skuR.rows[0];

  const client = await getClient();
  try {
    await client.query('BEGIN');

    // Log the scan
    await client.query(
      `INSERT INTO scan_events (tenant_id, sku_id, scanned_by, action, location, notes)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [sku.tenant_id || req.tenantId, sku.id, req.user.id, action, location, notes]
    );

    // If QR is unassigned and worker is assigning it to a record now
    if (assignToRecord && !sku.is_assigned) {
      await client.query(
        `UPDATE item_skus SET record_id=$1, tenant_id=$2, is_assigned=true WHERE id=$3`,
        [assignToRecord, req.tenantId, sku.id]
      );
    }

    // If record data update is provided (worker edited fields)
    if (recordData && sku.record_id) {
      await client.query(
        `UPDATE records SET data=data || $1::jsonb, updated_by=$2, updated_at=NOW()
         WHERE id=$3`,
        [JSON.stringify(recordData), req.user.id, sku.record_id]
      );
    }

    await client.query('COMMIT');
    sendSuccess(res, {}, 'Scan logged');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

// ── 6. Get scan history for a SKU ─────────────────────────────────────────────
const getScanHistory = asyncHandler(async (req, res) => {
  const { skuCode } = req.params;

  const skuR = await query(`SELECT id FROM item_skus WHERE sku_code=$1`, [skuCode]);
  if (!skuR.rows[0]) return res.status(404).json({ success: false, message: 'SKU not found' });

  const r = await query(
    `SELECT se.*,
            u.first_name || ' ' || u.last_name AS scanned_by_name,
            u.email AS scanned_by_email
     FROM scan_events se
     LEFT JOIN users u ON u.id = se.scanned_by
     WHERE se.sku_id=$1
     ORDER BY se.scanned_at DESC`,
    [skuR.rows[0].id]
  );

  sendSuccess(res, r.rows);
});

// ── 7. Get all SKUs for a tenant (inventory overview) ─────────────────────────
const listSkus = asyncHandler(async (req, res) => {
  const { moduleSlug } = req.query;

  let sql = `
    SELECT s.*, r.title, r.record_number, r.status,
           m.name AS module_name, m.slug AS module_slug,
           (SELECT COUNT(*) FROM scan_events WHERE sku_id=s.id) AS scan_count
    FROM item_skus s
    LEFT JOIN records r ON r.id = s.record_id
    LEFT JOIN modules m ON m.id = s.module_id
    WHERE s.tenant_id=$1
  `;
  const params = [req.tenantId];

  if (moduleSlug) {
    sql += ` AND m.slug=$2`;
    params.push(moduleSlug);
  }

  sql += ` ORDER BY s.created_at DESC LIMIT 200`;

  const r = await query(sql, params);
  sendSuccess(res, r.rows);
});

// ── 8. Get QR label HTML for printing ────────────────────────────────────────
// Returns HTML that browser can print directly
const getLabelHtml = asyncHandler(async (req, res) => {
  const { skuCode } = req.params;

  const r = await query(
    `SELECT s.*, r.title, r.record_number,
            m.name AS module_name,
            t.name AS tenant_name, t.primary_color, t.logo_url
     FROM item_skus s
     LEFT JOIN records r ON r.id = s.record_id
     LEFT JOIN modules m ON m.id = s.module_id
     LEFT JOIN tenants t ON t.id = s.tenant_id
     WHERE s.sku_code=$1`,
    [skuCode]
  );

  if (!r.rows[0]) return res.status(404).json({ success: false, message: 'SKU not found' });
  const sku = r.rows[0];

  const primaryColor = sku.primary_color || '#0b1628';
  const accentColor = '#c75b39';

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>Label: ${sku.sku_code}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Inter', Arial, sans-serif; background: #f4f6fb; display: flex; flex-wrap: wrap; gap: 12px; padding: 16px; }
    .label {
      width: 85mm; background: white; border-radius: 8px;
      border: 2px solid ${primaryColor}; overflow: hidden;
      page-break-inside: avoid;
    }
    .label-header {
      background: ${primaryColor}; color: white;
      padding: 8px 12px;
      display: flex; align-items: center; justify-content: space-between;
    }
    .label-brand { font-size: 13px; font-weight: 700; letter-spacing: 0.05em; }
    .label-type { font-size: 9px; opacity: 0.6; text-transform: uppercase; }
    .label-body { padding: 10px 12px; display: flex; gap: 12px; align-items: center; }
    .label-qr { flex-shrink: 0; }
    .label-qr img { width: 72px; height: 72px; display: block; }
    .label-info { flex: 1; min-width: 0; }
    .label-sku { font-size: 11px; font-weight: 700; color: ${primaryColor}; font-family: monospace; letter-spacing: 0.05em; margin-bottom: 4px; }
    .label-title { font-size: 10px; color: #4a5568; margin-bottom: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .label-module { font-size: 9px; color: #718096; }
    .label-footer {
      background: ${accentColor}; color: white;
      padding: 3px 12px; font-size: 8px; text-align: center;
      opacity: 0.85;
    }
    .unassigned { color: #a0aec0; font-style: italic; }
    @media print {
      body { background: white; padding: 8px; gap: 8px; }
      .label { border-radius: 4px; }
      @page { margin: 8mm; }
    }
  </style>
</head>
<body>
  <div class="label">
    <div class="label-header">
      <span class="label-brand">${sku.tenant_name || 'DRUSSHTI'}</span>
      <span class="label-type">${sku.module_name || sku.label_type}</span>
    </div>
    <div class="label-body">
      <div class="label-qr">
        <img src="${sku.qr_data}" alt="${sku.sku_code}" />
      </div>
      <div class="label-info">
        <div class="label-sku">${sku.sku_code}</div>
        <div class="label-title ${!sku.title ? 'unassigned' : ''}">${sku.title || '(Unassigned)'}</div>
        ${sku.record_number ? `<div class="label-module">${sku.record_number}</div>` : ''}
        <div class="label-module">${new Date(sku.created_at).toLocaleDateString()}</div>
      </div>
    </div>
    <div class="label-footer">www.drusshti.com · Scan to track</div>
  </div>

  <script>
    window.onload = function() {
      // Auto-print if opened directly (not iframe)
      if (window.self === window.top) {
        setTimeout(() => window.print(), 500);
      }
    };
  </script>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html');
  res.send(html);
});

// ── 9. Bulk label sheet (multiple QRs on one printable page) ──────────────────
const getBulkLabelHtml = asyncHandler(async (req, res) => {
  const { skuCodes } = req.body; // array of sku_codes

  if (!Array.isArray(skuCodes) || !skuCodes.length) {
    return res.status(400).json({ success: false, message: 'skuCodes array required' });
  }

  const r = await query(
    `SELECT s.*, r.title, r.record_number, m.name AS module_name, t.name AS tenant_name, t.primary_color
     FROM item_skus s
     LEFT JOIN records r ON r.id = s.record_id
     LEFT JOIN modules m ON m.id = s.module_id
     LEFT JOIN tenants t ON t.id = s.tenant_id
     WHERE s.sku_code = ANY($1::text[])`,
    [skuCodes]
  );

  if (!r.rows.length) return res.status(404).json({ success: false, message: 'No SKUs found' });
  const skus = r.rows;

  const labelsHtml = skus.map(sku => {
    const color = sku.primary_color || '#0b1628';
    return `
    <div class="label">
      <div class="label-header" style="background:${color}">
        <span class="label-brand">${sku.tenant_name || 'DRUSSHTI'}</span>
        <span class="label-type">${sku.module_name || sku.label_type}</span>
      </div>
      <div class="label-body">
        <img src="${sku.qr_data}" class="label-qr" alt="${sku.sku_code}" />
        <div class="label-info">
          <div class="label-sku" style="color:${color}">${sku.sku_code}</div>
          <div class="label-title">${sku.title || '(Unassigned)'}</div>
          ${sku.record_number ? `<div class="label-small">${sku.record_number}</div>` : ''}
        </div>
      </div>
      <div class="label-footer">www.drusshti.com</div>
    </div>`;
  }).join('');

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8"/>
  <title>Bulk Labels (${skus.length})</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Inter', Arial, sans-serif; background: #f4f6fb; padding: 16px; }
    h1 { font-size: 14px; margin-bottom: 12px; color: #0b1628; }
    .grid { display: flex; flex-wrap: wrap; gap: 10px; }
    .label { width: 80mm; background: white; border-radius: 6px; border: 1.5px solid #e2e8f0; overflow: hidden; page-break-inside: avoid; }
    .label-header { color: white; padding: 6px 10px; display: flex; align-items: center; justify-content: space-between; }
    .label-brand { font-size: 12px; font-weight: 700; }
    .label-type { font-size: 8px; opacity: 0.65; text-transform: uppercase; }
    .label-body { padding: 8px 10px; display: flex; gap: 10px; align-items: center; }
    .label-qr { width: 68px; height: 68px; flex-shrink: 0; }
    .label-info { flex: 1; min-width: 0; }
    .label-sku { font-size: 11px; font-weight: 700; font-family: monospace; margin-bottom: 3px; }
    .label-title { font-size: 10px; color: #4a5568; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .label-small { font-size: 9px; color: #718096; margin-top: 2px; }
    .label-footer { background: #c75b39; color: white; padding: 2px 10px; font-size: 8px; text-align: center; }
    @media print {
      body { background: white; }
      h1, .no-print { display: none; }
      @page { margin: 6mm; }
    }
  </style>
</head>
<body>
  <h1 class="no-print">${skus.length} Label(s) — Click Print below or use Ctrl+P</h1>
  <button class="no-print" onclick="window.print()" style="margin-bottom:12px;padding:8px 16px;background:#c75b39;color:white;border:none;border-radius:6px;cursor:pointer;font-size:13px;">🖨️ Print Labels</button>
  <div class="grid">${labelsHtml}</div>
  <script>
    // Auto-print when opened as new window
    if (window.opener) setTimeout(() => window.print(), 600);
  </script>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html');
  res.send(html);
});

module.exports = {
  generateForRecord,
  bulkGenerate,
  getTenantsForQR,
  lookupSku,
  logScan,
  getScanHistory,
  listSkus,
  getLabelHtml,
  getBulkLabelHtml,
};
