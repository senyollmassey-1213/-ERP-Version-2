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

// ── Super Admin / Client Servicing: tenants dropdown ─────────────────────────
r.get('/tenants', authenticate, requireClientServicing, getTenantsForQR);

// ── Bulk generate — now open to user_admin too ────────────────────────────────
r.post('/bulk-generate', authenticate, requireUserAdmin, bulkGenerate);

// ── Tenant routes ─────────────────────────────────────────────────────────────
r.get('/', authenticate, scopeToTenant, listSkus);
r.post('/record/:recordId', authenticate, requireUserAdmin, scopeToTenant, generateForRecord);

// ── Scan routes (any authenticated user) ──────────────────────────────────────
r.get('/lookup/:skuCode', authenticate, lookupSku);
r.post('/scan/:skuCode', authenticate, logScan);
r.get('/history/:skuCode', authenticate, getScanHistory);

// ── Label printing ────────────────────────────────────────────────────────────
r.get('/label/:skuCode', authenticate, getLabelHtml);
r.post('/labels/bulk', authenticate, getBulkLabelHtml);

module.exports = r;
