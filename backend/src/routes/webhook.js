/**
 * Webhook Route — Third Party Booking Integration
 *
 * External systems (OTA, hotel website, booking engines) POST to:
 * POST /api/webhook/:tenantSlug/booking
 *
 * Sample payload:
 * {
 *   "guest_name": "John Doe",
 *   "phone": "9876543210",
 *   "email": "john@example.com",
 *   "room_type": "deluxe",
 *   "check_in_date": "2026-05-10",
 *   "check_out_date": "2026-05-12",
 *   "num_guests": 2,
 *   "room_amount": 5000,
 *   "booking_source": "ota",
 *   "payment_status": "paid",
 *   "payment_method": "card",
 *   "special_requests": "Early check-in",
 *   "external_booking_id": "OTA-12345"
 * }
 */

const express = require('express');
const r = express.Router();
const { query } = require('../config/database');
const { asyncHandler, sendSuccess } = require('../middleware/helpers');

const generateRecordNumber = async (tenantId, moduleSlug) => {
  const prefix = moduleSlug.toUpperCase().substring(0, 4);
  const res = await query(
    `SELECT COUNT(*) FROM records r JOIN modules m ON m.id=r.module_id WHERE r.tenant_id=$1 AND m.slug=$2`,
    [tenantId, moduleSlug]
  );
  return `${prefix}-${String(parseInt(res.rows[0].count) + 1).padStart(5, '0')}`;
};

r.post('/:tenantSlug/booking', asyncHandler(async (req, res) => {
  const { tenantSlug } = req.params;
  const {
    guest_name, phone, email, room_type, room_number,
    check_in_date, check_out_date, num_guests,
    room_amount, rate_per_night, booking_source = 'ota',
    payment_status = 'unpaid', payment_method,
    special_requests, external_booking_id, nationality,
  } = req.body;

  // Validate required fields
  if (!guest_name || !check_in_date || !check_out_date) {
    return res.status(400).json({
      success: false,
      message: 'guest_name, check_in_date, check_out_date are required'
    });
  }

  // Get tenant
  const tenantR = await query(
    `SELECT t.*, i.slug AS industry_slug FROM tenants t JOIN industries i ON i.id=t.industry_id WHERE t.slug=$1 AND t.is_active=true`,
    [tenantSlug]
  );
  if (!tenantR.rows[0]) {
    return res.status(404).json({ success: false, message: 'Hotel not found' });
  }
  const tenant = tenantR.rows[0];

  // Get system user (first user_admin of tenant) to assign as creator
  const userR = await query(
    `SELECT id FROM users WHERE tenant_id=$1 AND role='user_admin' LIMIT 1`,
    [tenant.id]
  );
  if (!userR.rows[0]) {
    return res.status(500).json({ success: false, message: 'No admin user found for this tenant' });
  }
  const systemUserId = userR.rows[0].id;

  // Calculate nights
  const checkIn  = new Date(check_in_date);
  const checkOut = new Date(check_out_date);
  const nights   = Math.max(1, Math.round((checkOut - checkIn) / (1000 * 60 * 60 * 24)));

  // Get module IDs
  const crmModR = await query(
    `SELECT m.id FROM modules m JOIN tenant_modules tm ON tm.module_id=m.id WHERE m.slug='crm' AND tm.tenant_id=$1 AND tm.is_enabled=true`,
    [tenant.id]
  );
  const bookModR = await query(
    `SELECT m.id FROM modules m JOIN tenant_modules tm ON tm.module_id=m.id WHERE m.slug='bookings' AND tm.tenant_id=$1 AND tm.is_enabled=true`,
    [tenant.id]
  );

  if (!crmModR.rows[0] || !bookModR.rows[0]) {
    return res.status(400).json({ success: false, message: 'CRM or Bookings module not enabled for this tenant' });
  }

  // ── 1. Create CRM record ──────────────────────────────────────────────────
  const crmNumber = await generateRecordNumber(tenant.id, 'crm');
  const crmData = {
    guest_name, phone: phone || '', email: email || '',
    nationality: nationality || '',
    lead_source: booking_source,
    status: 'converted',
    _external_booking_id: external_booking_id || '',
  };

  const crmR = await query(
    `INSERT INTO records (tenant_id, module_id, industry_id, record_number, title, data, status, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,'converted',$7) RETURNING *`,
    [tenant.id, crmModR.rows[0].id, tenant.industry_id, crmNumber, guest_name, JSON.stringify(crmData), systemUserId]
  );

  // ── 2. Block room if room_number provided ─────────────────────────────────
  if (room_number) {
    const roomModR = await query(`SELECT id FROM modules WHERE slug='rooms'`);
    if (roomModR.rows[0]) {
      const roomR = await query(
        `SELECT id, data FROM records WHERE tenant_id=$1 AND module_id=$2 AND data->>'room_number'=$3 AND is_archived=false`,
        [tenant.id, roomModR.rows[0].id, String(room_number)]
      );
      if (roomR.rows[0]) {
        const updatedData = { ...roomR.rows[0].data, status: 'reserved' };
        await query(
          `UPDATE records SET status='reserved', data=$1::jsonb, updated_at=NOW() WHERE id=$2`,
          [JSON.stringify(updatedData), roomR.rows[0].id]
        );
      }
    }
  }

  // ── 3. Create Booking record ──────────────────────────────────────────────
  const bookNumber = await generateRecordNumber(tenant.id, 'bookings');
  const finalRoomAmount = room_amount || (rate_per_night ? rate_per_night * nights : 0);

  const bookingData = {
    guest_name, phone: phone || '', email: email || '',
    room_number:    room_number || '',
    room_type:      room_type || '',
    check_in_date, check_out_date,
    total_nights:   nights,
    num_guests:     num_guests || 1,
    rate_per_night: rate_per_night || '',
    room_amount:    finalRoomAmount,
    booking_source,
    payment_status,
    payment_method: payment_method || '',
    special_requests: special_requests || '',
    status: 'reserved',
    _linked_from:   crmNumber,
    _linked_record_id: crmR.rows[0].id,
    _external_booking_id: external_booking_id || '',
    _source: 'webhook',
  };

  const bookR = await query(
    `INSERT INTO records (tenant_id, module_id, industry_id, record_number, title, data, status, created_by, parent_record_id, source_module_id)
     VALUES ($1,$2,$3,$4,$5,$6,'reserved',$7,$8,$9) RETURNING *`,
    [tenant.id, bookModR.rows[0].id, tenant.industry_id, bookNumber,
     `${guest_name}${room_number ? ' - Room ' + room_number : ''}`,
     JSON.stringify(bookingData), systemUserId, crmR.rows[0].id, crmModR.rows[0].id]
  );

  // ── 4. Log workflow ───────────────────────────────────────────────────────
  await query(
    `INSERT INTO workflow_log (tenant_id, from_record_id, to_record_id, from_module_id, to_module_id, trigger_status, triggered_by)
     VALUES ($1,$2,$3,$4,$5,'converted',$6)`,
    [tenant.id, crmR.rows[0].id, bookR.rows[0].id, crmModR.rows[0].id, bookModR.rows[0].id, systemUserId]
  );

  console.log(`  🔗 Webhook booking: ${guest_name} → CRM ${crmNumber} + Booking ${bookNumber} [${tenantSlug}]`);

  sendSuccess(res, {
    crm_record:     crmNumber,
    booking_record: bookNumber,
    nights,
    message: `Booking created successfully for ${guest_name}`,
  }, 'Booking received', 201);
}));

// Health check for webhook
r.get('/:tenantSlug/ping', asyncHandler(async (req, res) => {
  const tenantR = await query(
    `SELECT name FROM tenants WHERE slug=$1 AND is_active=true`,
    [req.params.tenantSlug]
  );
  if (!tenantR.rows[0]) return res.status(404).json({ success: false, message: 'Hotel not found' });
  sendSuccess(res, { hotel: tenantR.rows[0].name, status: 'active' }, 'Webhook active');
}));

module.exports = r;
