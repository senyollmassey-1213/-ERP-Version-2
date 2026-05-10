/**
 * Public Routes — No authentication required
 * Used by QR ordering system
 *
 * GET  /api/public/:tenantSlug/menu    — fetch menu + restaurant info
 * POST /api/public/:tenantSlug/order   — place an order (creates open tab)
 */

const express = require('express');
const r = express.Router();
const { query } = require('../config/database');
const { asyncHandler, sendSuccess } = require('../middleware/helpers');

// ── GET menu + restaurant info ────────────────────────────────────────────────
r.get('/:tenantSlug/menu', asyncHandler(async (req, res) => {
  const { tenantSlug } = req.params;

  const tenantR = await query(
    `SELECT t.id, t.name, t.logo_url, t.gst_rates, t.staff_settings,
            t.primary_color, t.secondary_color
     FROM tenants t WHERE t.slug=$1 AND t.is_active=true`,
    [tenantSlug]
  );
  if (!tenantR.rows[0]) {
    return res.status(404).json({ success: false, message: 'Restaurant not found' });
  }
  const tenant = tenantR.rows[0];
  const staffSettings = tenant.staff_settings || {};

  const modR = await query(
    `SELECT m.id FROM modules m JOIN tenant_modules tm ON tm.module_id=m.id
     WHERE m.slug='menu' AND tm.tenant_id=$1 AND tm.is_enabled=true`,
    [tenant.id]
  );
  if (!modR.rows[0]) {
    return res.status(404).json({ success: false, message: 'Menu not available' });
  }

  const itemsR = await query(
    `SELECT id, title, data, record_number FROM records
     WHERE tenant_id=$1 AND module_id=$2
     AND is_archived=false
     AND (data->>'available' IS NULL OR data->>'available' != 'unavailable')
     ORDER BY data->>'category', title`,
    [tenant.id, modR.rows[0].id]
  );

  sendSuccess(res, {
    restaurant: {
      name:       tenant.name,
      logo_url:   tenant.logo_url || '',
      gst_rates:  tenant.gst_rates || { food: 5 },
      upi_qr_url: staffSettings.upi_qr_url || '',
      upi_id:     staffSettings.upi_id || '',
      qr_primary: staffSettings.qr_primary_color || '#0b1628',
      qr_accent:  staffSettings.qr_accent_color  || '#c75b39',
      num_tables: staffSettings.num_tables || 20,
    },
    menu: itemsR.rows.map(item => ({
      id:          item.id,
      name:        item.data?.item_name || item.title,
      category:    item.data?.category || 'other',
      price:       parseFloat(item.data?.price) || 0,
      description: item.data?.description || '',
      is_veg:      item.data?.is_veg || 'non_veg',
    })),
  });
}));

// ── POST order ────────────────────────────────────────────────────────────────
r.post('/:tenantSlug/order', asyncHandler(async (req, res) => {
  const { tenantSlug } = req.params;
  const { guest_name, phone, table_number, items, payment_method = 'cash' } = req.body;

  if (!guest_name || !table_number || !items?.length) {
    return res.status(400).json({
      success: false,
      message: 'guest_name, table_number and items are required'
    });
  }

  const tenantR = await query(
    `SELECT t.id, t.industry_id, t.gst_rates FROM tenants t WHERE t.slug=$1 AND t.is_active=true`,
    [tenantSlug]
  );
  if (!tenantR.rows[0]) {
    return res.status(404).json({ success: false, message: 'Restaurant not found' });
  }
  const tenant  = tenantR.rows[0];
  const gstRate = tenant.gst_rates?.food || 5;

  const modR = await query(
    `SELECT m.id FROM modules m JOIN tenant_modules tm ON tm.module_id=m.id
     WHERE m.slug='billing' AND tm.tenant_id=$1 AND tm.is_enabled=true`,
    [tenant.id]
  );
  if (!modR.rows[0]) {
    return res.status(500).json({ success: false, message: 'Billing module not enabled' });
  }

  // Check if open tab already exists for this table
  const existingTabR = await query(
    `SELECT * FROM records WHERE tenant_id=$1 AND module_id=$2
     AND status='open_tab' AND data->>'bill_type'='food_bill'
     AND data->>'table_number'=$3 AND is_archived=false LIMIT 1`,
    [tenant.id, modR.rows[0].id, String(table_number)]
  );

  const subtotal = items.reduce((s, i) => s + (i.price * i.qty), 0);
  const gstAmt   = subtotal * gstRate / 100;
  const total    = subtotal + gstAmt;

  const userR = await query(
    `SELECT id FROM users WHERE tenant_id=$1 ORDER BY created_at LIMIT 1`,
    [tenant.id]
  );
  const systemUserId = userR.rows[0]?.id;

  if (existingTabR.rows[0]) {
    const existing      = existingTabR.rows[0];
    const existingItems = existing.data?._food_items || [];

    // Merge items — increase qty if same item exists
    const merged = [...existingItems];
    for (const newItem of items) {
      const found = merged.find(e => e.id === newItem.id);
      if (found) found.qty += newItem.qty;
      else merged.push(newItem);
    }

    const newSubtotal = merged.reduce((s, i) => s + (i.price * i.qty), 0);
    const newGst      = newSubtotal * gstRate / 100;
    const newTotal    = newSubtotal + newGst;

    const updatedData = {
      ...existing.data,
      _food_items:      merged,
      amount:           newSubtotal.toFixed(2),
      tax:              gstRate,
      total:            newTotal.toFixed(2),
      payment_method,
      last_updated:     new Date().toISOString(),
      _new_items_added: items,
    };

    await query(
      `UPDATE records SET data=$1::jsonb, updated_at=NOW() WHERE id=$2`,
      [JSON.stringify(updatedData), existing.id]
    );

    return sendSuccess(res, {
      order_id:     existing.record_number,
      table_number,
      total:        newTotal.toFixed(2),
      status:       'updated',
      message:      'Items added to your existing order',
    }, 'Order updated');
  }

  // Create new open tab
  const countR = await query(
    `SELECT COUNT(*) FROM records r JOIN modules m ON m.id=r.module_id WHERE r.tenant_id=$1 AND m.slug='billing'`,
    [tenant.id]
  );
  const recNum = `BILL-${String(parseInt(countR.rows[0].count) + 1).padStart(5, '0')}`;

  const tabData = {
    guest_name,
    phone:          phone || '',
    table_number:   String(table_number),
    bill_type:      'food_bill',
    _food_items:    items,
    amount:         subtotal.toFixed(2),
    tax:            gstRate,
    total:          total.toFixed(2),
    payment_method,
    payment_status: 'unpaid',
    status:         'open_tab',
    _source:        'qr_order',
    order_time:     new Date().toISOString(),
  };

  const newR = await query(
    `INSERT INTO records (tenant_id, module_id, industry_id, record_number, title, data, status, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,'open_tab',$7) RETURNING *`,
    [tenant.id, modR.rows[0].id, tenant.industry_id, recNum,
     `Table ${table_number} — ${guest_name}`, JSON.stringify(tabData), systemUserId]
  );

  sendSuccess(res, {
    order_id:     recNum,
    table_number,
    total:        total.toFixed(2),
    status:       'placed',
    message:      'Order placed successfully',
  }, 'Order placed', 201);
}));

module.exports = r;
