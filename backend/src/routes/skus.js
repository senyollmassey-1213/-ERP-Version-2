/**
 * routes/skus.js
 * QR Code & SKU tracking routes
 */

const express = require('express');
const r = express.Router();
const {
  authenticate,
  requireSuperAdmin,
  requireClientServicing,
  requireUserAdmin,
  scopeToTenant,
} = require('../middleware/auth');

const {
  generateForRecord,
  bulkGenerate,
  getTenantsForQR,
  lookupSku,
  logScan,
  getScanHistory,
  listSkus,
  getLabelHtml,
  getBulkLabelHtml,
} = require('../controllers/skuController');

// ── Super Admin / Client Servicing: bulk generate generic QRs ────────────────
// POST /api/skus/bulk-generate  { quantity, tenantId, labelType }
r.post('/bulk-generate',
  authenticate,
  requireClientServicing,
  bulkGenerate
);

// GET /api/skus/tenants  — dropdown list for super admin bulk generate form
r.get('/tenants',
  authenticate,
  requireClientServicing,
  getTenantsForQR
);

// ── Tenant routes (User Admin+ required for generation) ───────────────────────

// GET  /api/skus                 — list all SKUs for tenant
r.get('/',
  authenticate,
  scopeToTenant,
  listSkus
);

// POST /api/skus/record/:recordId   — generate QR for a specific record
r.post('/record/:recordId',
  authenticate,
  requireUserAdmin,
  scopeToTenant,
  generateForRecord
);

// ── Scan routes (any authenticated user) ──────────────────────────────────────

// GET  /api/skus/lookup/:skuCode    — fetch item details after scanning
r.get('/lookup/:skuCode',
  authenticate,
  lookupSku
);

// POST /api/skus/scan/:skuCode      — log scan event
r.post('/scan/:skuCode',
  authenticate,
  logScan
);

// GET  /api/skus/history/:skuCode   — scan trail for one item
r.get('/history/:skuCode',
  authenticate,
  getScanHistory
);

// ── Label printing (HTML routes — returns printable HTML) ─────────────────────

// GET  /api/skus/label/:skuCode         — single label
r.get('/label/:skuCode',
  authenticate,
  getLabelHtml
);

// POST /api/skus/labels/bulk            — bulk label sheet { skuCodes: [] }
r.post('/labels/bulk',
  authenticate,
  getBulkLabelHtml
);

module.exports = r;
