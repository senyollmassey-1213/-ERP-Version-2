const { query, getClient } = require('../config/database');
const { asyncHandler, sendSuccess, getPagination, paginatedResponse } = require('../middleware/helpers');

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
    { fromSlug: 'crm',       triggerStatus: 'converted',  toSlug: 'storage',   copyFields: ['company_name','contact_name','phone','email','contract_value'] },
    { fromSlug: 'storage',   triggerStatus: 'dispatched', toSlug: 'warehouse', copyFields: ['client_name','item_description','quantity','unit'] },
    { fromSlug: 'warehouse', triggerStatus: 'complete',   toSlug: 'billing',   copyFields: ['client_name'] },
    { fromSlug: 'billing',   triggerStatus: 'paid',       toSlug: 'reports',   copyFields: ['client_name','total','payment_date'] },
  ],
  hotel_restaurant: [
    { fromSlug: 'crm',      triggerStatus: 'converted',   toSlug: 'bookings', copyFields: ['guest_name','phone','email','nationality','id_type','id_number','_allocated_room','_allocated_room_type','_allocated_rate'] },
    { fromSlug: 'bookings', triggerStatus: 'checked_out', toSlug: 'billing',  copyFields: ['guest_name','phone','room_number','room_type','check_in_date','check_out_date','total_nights','room_amount','rate_per_night','num_guests','booking_source'] },
    { fromSlug: 'billing',  triggerStatus: 'paid',        toSlug: 'reports',  copyFields: ['guest_name','total','payment_date','bill_type'] },
  ],
};

const generateRecordNumber = async (tenantId, moduleSlug) => {
  const prefix = moduleSlug.toUpperCase().substring(0, 4);
  const r = await query(
    `SELECT COUNT(*) FROM records r JOIN modules m ON m.id=r.module_id WHERE r.tenant_id=$1 AND m.slug=$2`,
    [tenantId, moduleSlug]
  );
  return `${prefix}-${String(parseInt(r.rows[0].count) + 1).padStart(5, '0')}`;
};

// ── Update room status by room_number ─────────────────────────────────────────
async function updateRoomStatus(tenantId, roomNumber, newStatus) {
  try {
    const roomModR = await query(`SELECT id FROM modules WHERE slug='rooms'`);
    if (!roomModR.rows[0]) return;
    const roomR = await query(
      `SELECT id, data FROM records WHERE tenant_id=$1 AND module_id=$2 AND data->>'room_number'=$3 AND is_archived=false`,
      [tenantId, roomModR.rows[0].id, String(roomNumber)]
    );
    if (roomR.rows[0]) {
      const updatedData = { ...roomR.rows[0].data, status: newStatus };
      await query(
        `UPDATE records SET status=$1, data=$2::jsonb, updated_at=NOW() WHERE id=$3`,
        [newStatus, JSON.stringify(updatedData), roomR.rows[0].id]
      );
      console.log(`  🛏 Room ${roomNumber} → ${newStatus}`);
    }
  } catch (err) {
    console.error('Room status update error:', err.message);
  }
}

// ── Check if room is available ────────────────────────────────────────────────
async function getRoomStatus(tenantId, roomNumber) {
  try {
    const roomModR = await query(`SELECT id FROM modules WHERE slug='rooms'`);
    if (!roomModR.rows[0]) return null;
    const roomR = await query(
      `SELECT status, data FROM records WHERE tenant_id=$1 AND module_id=$2 AND data->>'room_number'=$3 AND is_archived=false`,
      [tenantId, roomModR.rows[0].id, String(roomNumber)]
    );
    if (roomR.rows[0]) return roomR.rows[0].data?.status || roomR.rows[0].status;
    return null;
  } catch { return null; }
}

// ── Auto-create housekeeping task ─────────────────────────────────────────────
async function createHousekeepingTask(req, booking) {
  try {
    const hkModR = await query(
      `SELECT m.id FROM modules m JOIN tenant_modules tm ON tm.module_id=m.id
       WHERE m.slug='housekeeping' AND tm.tenant_id=$1 AND tm.is_enabled=true`,
      [req.tenantId]
    );
    if (!hkModR.rows[0]) return;

    const tenantR = await query(`SELECT staff_settings, industry_id FROM tenants WHERE id=$1`, [req.tenantId]);
    const staffSettings = tenantR.rows[0]?.staff_settings || {};
    const defaultHKStaff = staffSettings.default_housekeeping_user_id || null;
    const defaultHKName  = staffSettings.default_housekeeping_name || '';

    let assignedName = defaultHKName;
    if (defaultHKStaff && !assignedName) {
      const userR = await query(`SELECT first_name, last_name FROM users WHERE id=$1`, [defaultHKStaff]);
      if (userR.rows[0]) assignedName = `${userR.rows[0].first_name} ${userR.rows[0].last_name}`;
    }

    const taskData = {
      room_number:    booking.data?.room_number || '',
      task_type:      'daily_cleaning',
      assigned_to:    assignedName,
      scheduled_date: new Date().toISOString().split('T')[0],
      status:         'pending',
      linked_booking: booking.record_number,
      notes:          `Auto-created on checkout of ${booking.data?.guest_name || 'guest'}`,
    };

    const newNumber = await generateRecordNumber(req.tenantId, 'housekeeping');
    await query(
      `INSERT INTO records (tenant_id, module_id, industry_id, record_number, title, data, status, assigned_to, created_by, parent_record_id)
       VALUES ($1,$2,$3,$4,$5,$6,'pending',$7,$8,$9)`,
      [
        req.tenantId, hkModR.rows[0].id, booking.industry_id,
        newNumber,
        `Cleaning - Room ${booking.data?.room_number || ''}`,
        JSON.stringify(taskData),
        defaultHKStaff || null,
        req.user.id,
        booking.id,
      ]
    );
    console.log(`  🧹 Housekeeping task created for Room ${booking.data?.room_number}`);
  } catch (err) {
    console.error('Housekeeping task creation error:', err.message);
  }
}

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

  if (status) { conditions.push(`(r.status=$${idx} OR r.data->>'status'=$${idx})`); params.push(status); idx++; }
  if (search)  { conditions.push(`(r.title ILIKE $${idx} OR r.record_number ILIKE $${idx} OR r.data->>'guest_name' ILIKE $${idx} OR r.data->>'room_number' ILIKE $${idx})`); params.push(`%${search}%`); idx++; }

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
     FROM records r JOIN modules m ON m.id=r.module_id
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
    `SELECT m.id, m.slug FROM modules m JOIN tenant_modules tm ON tm.module_id=m.id
     WHERE m.slug=$1 AND tm.tenant_id=$2 AND tm.is_enabled=true`,
    [moduleSlug, req.tenantId]
  );
  if (!modR.rows[0]) return res.status(404).json({ success: false, message: 'Module not found or disabled' });

  if (moduleSlug === 'bookings' && data.room_number) {
    const roomStatus = await getRoomStatus(req.tenantId, data.room_number);
    if (roomStatus === 'occupied' || roomStatus === 'reserved') {
      return res.status(409).json({
        success: false,
        message: `Room ${data.room_number} is already ${roomStatus}. Please select a different room.`
      });
    }
  }

  const tenantR = await query(`SELECT industry_id FROM tenants WHERE id=$1`, [req.tenantId]);
  const industryId = tenantR.rows[0].industry_id;
  const recordNumber = await generateRecordNumber(req.tenantId, moduleSlug);
  const resolvedStatus = (data && data.status) ? data.status : status;

  const r = await query(
    `INSERT INTO records (tenant_id, module_id, industry_id, record_number, title, data, status, assigned_to, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [req.tenantId, modR.rows[0].id, industryId, recordNumber, title, JSON.stringify(data), resolvedStatus, assignedTo || null, req.user.id]
  );

  if (moduleSlug === 'bookings' && data.room_number) {
    await updateRoomStatus(req.tenantId, data.room_number, 'reserved');
  }

  await query(
    `INSERT INTO audit_logs (tenant_id, user_id, action, entity_type, entity_id, new_data) VALUES ($1,$2,'created','record',$3,$4)`,
    [req.tenantId, req.user.id, r.rows[0].id, JSON.stringify(data)]
  );

  sendSuccess(res, r.rows[0], 'Record created', 201);
});

const updateRecord = asyncHandler(async (req, res) => {
  const { title, data, status, assignedTo } = req.body;

  const oldR = await query(`SELECT * FROM records WHERE id=$1 AND tenant_id=$2`, [req.params.id, req.tenantId]);
  if (!oldR.rows[0]) return res.status(404).json({ success: false, message: 'Record not found' });
  const old = oldR.rows[0];

  const resolvedStatus = (data && data.status) ? data.status : (status || old.status);

  const fromModR = await query(`SELECT slug FROM modules WHERE id=$1`, [old.module_id]);
  const fromSlug = fromModR.rows[0]?.slug;
  if (fromSlug === 'crm' && resolvedStatus === 'converted' && old.status === 'converted') {
    return res.status(409).json({
      success: false,
      message: 'This lead has already been converted. A booking already exists for this guest.'
    });
  }

  if (fromSlug === 'bookings' && data?.room_number && data.room_number !== old.data?.room_number) {
    const roomStatus = await getRoomStatus(req.tenantId, data.room_number);
    if (roomStatus === 'occupied' || roomStatus === 'reserved') {
      return res.status(409).json({
        success: false,
        message: `Room ${data.room_number} is already ${roomStatus}. Please select a different room.`
      });
    }
    if (old.data?.room_number) {
      await updateRoomStatus(req.tenantId, old.data.room_number, 'vacant');
    }
    await updateRoomStatus(req.tenantId, data.room_number, 'reserved');
  }

  const r = await query(
    `UPDATE records SET
       title=COALESCE($1,title), data=COALESCE($2::jsonb,data), status=$3,
       assigned_to=COALESCE($4,assigned_to), updated_by=$5, updated_at=NOW()
     WHERE id=$6 AND tenant_id=$7 RETURNING *`,
    [title, data ? JSON.stringify(data) : null, resolvedStatus, assignedTo, req.user.id, req.params.id, req.tenantId]
  );

  await query(
    `INSERT INTO audit_logs (tenant_id, user_id, action, entity_type, entity_id, old_data, new_data) VALUES ($1,$2,'updated','record',$3,$4,$5)`,
    [req.tenantId, req.user.id, req.params.id, old.data, JSON.stringify(data || {})]
  );

  if (resolvedStatus && resolvedStatus !== old.status) {
    await triggerWorkflow(req, r.rows[0], old.status, resolvedStatus);
  }

  sendSuccess(res, r.rows[0], 'Record updated');
});

const deleteRecord = asyncHandler(async (req, res) => {
  const recR = await query(
    `SELECT r.*, m.slug FROM records r JOIN modules m ON m.id=r.module_id WHERE r.id=$1 AND r.tenant_id=$2`,
    [req.params.id, req.tenantId]
  );
  if (recR.rows[0]?.slug === 'bookings' && recR.rows[0]?.data?.room_number) {
    await updateRoomStatus(req.tenantId, recR.rows[0].data.room_number, 'vacant');
  }
  await query(`UPDATE records SET is_archived=true, updated_at=NOW() WHERE id=$1 AND tenant_id=$2`, [req.params.id, req.tenantId]);
  sendSuccess(res, {}, 'Record deleted');
});

// ── Auto-close open food tab into food bill on checkout ───────────────────────
async function autoCloseFoodTab(req, booking, roomBillRecord) {
  try {
    const billingModR = await query(
      `SELECT m.id FROM modules m JOIN tenant_modules tm ON tm.module_id=m.id
       WHERE m.slug='billing' AND tm.tenant_id=$1 AND tm.is_enabled=true`,
      [req.tenantId]
    );
    if (!billingModR.rows[0]) return;

    const tabR = await query(
      `SELECT * FROM records WHERE tenant_id=$1 AND module_id=$2
       AND status='open_tab' AND data->>'bill_type'='food_bill'
       AND data->>'linked_booking'=$3 AND is_archived=false LIMIT 1`,
      [req.tenantId, billingModR.rows[0].id, booking.record_number]
    );
    if (!tabR.rows[0]) return;

    const tab = tabR.rows[0];
    const foodItems = tab.data?._food_items || [];
    if (!foodItems.length) return;

    const tenantInfoR = await query(`SELECT invoice_prefix FROM tenants WHERE id=$1`, [req.tenantId]);
    const prefix = tenantInfoR.rows[0]?.invoice_prefix || 'INV';
    const countR = await query(
      `SELECT COUNT(*) FROM records r JOIN modules m ON m.id=r.module_id WHERE r.tenant_id=$1 AND m.slug='billing'`,
      [req.tenantId]
    );
    const invoiceNum = `${prefix}-${String(parseInt(countR.rows[0].count) + 1).padStart(5, '0')}`;

    const updatedData = {
      ...tab.data,
      invoice_number:   invoiceNum,
      status:           'unpaid',
      payment_status:   'unpaid',
      guest_name:       booking.data?.guest_name || tab.data?.guest_name || '',
      room_number:      booking.data?.room_number || '',
      linked_booking:   booking.record_number,
      linked_room_bill: roomBillRecord.record_number,
      _linked_from:     booking.record_number,
    };

    await query(
      `UPDATE records SET status='unpaid', data=$1::jsonb, updated_at=NOW() WHERE id=$2`,
      [JSON.stringify(updatedData), tab.id]
    );
    console.log(`  🍽 Food tab closed → ${invoiceNum} for ${booking.data?.guest_name}`);
  } catch (err) {
    console.error('Food tab auto-close error:', err.message);
  }
}

// ── WORKFLOW ENGINE ────────────────────────────────────────────────────────────
async function triggerWorkflow(req, record, oldStatus, newStatus) {
  try {
    const tenantR = await query(
      `SELECT i.slug AS industry_slug FROM tenants t JOIN industries i ON i.id=t.industry_id WHERE t.id=$1`,
      [req.tenantId]
    );
    if (!tenantR.rows[0]) return;
    const industrySlug = tenantR.rows[0].industry_slug;

    const fromModR = await query(`SELECT slug FROM modules WHERE id=$1`, [record.module_id]);
    if (!fromModR.rows[0]) return;
    const fromSlug = fromModR.rows[0].slug;

    // ── Hotel room status automation ──────────────────────────────────────
    if (industrySlug === 'hotel_restaurant' && fromSlug === 'bookings') {
      const roomNum = record.data?.room_number;
      if (roomNum) {
        if (newStatus === 'checked_in')  await updateRoomStatus(req.tenantId, roomNum, 'occupied');
        if (newStatus === 'checked_out') await updateRoomStatus(req.tenantId, roomNum, 'housekeeping');
        if (newStatus === 'cancelled')   await updateRoomStatus(req.tenantId, roomNum, 'vacant');
        if (newStatus === 'no_show')     await updateRoomStatus(req.tenantId, roomNum, 'vacant');
      }
      if (newStatus === 'checked_out') {
        await createHousekeepingTask(req, record);
      }
    }

    // When housekeeping task complete → mark room vacant
    if (industrySlug === 'hotel_restaurant' && fromSlug === 'housekeeping' && newStatus === 'complete') {
      const roomNum = record.data?.room_number;
      if (roomNum) await updateRoomStatus(req.tenantId, roomNum, 'vacant');
    }

    const rules = WORKFLOW_RULES[industrySlug] || [];
    const rule = rules.find(r => r.fromSlug === fromSlug && r.triggerStatus === newStatus);
    if (!rule) return;

    const toModR = await query(
      `SELECT m.id FROM modules m JOIN tenant_modules tm ON tm.module_id=m.id
       WHERE m.slug=$1 AND tm.tenant_id=$2 AND tm.is_enabled=true`,
      [rule.toSlug, req.tenantId]
    );
    if (!toModR.rows[0]) return;
    const toModuleId = toModR.rows[0].id;

    const copiedData = {};
    for (const field of rule.copyFields) {
      if (record.data[field] !== undefined) copiedData[field] = record.data[field];
    }
    copiedData['_linked_from'] = record.record_number;
    copiedData['_linked_record_id'] = record.id;

    if (rule.toSlug === 'bookings' && record.data['_allocated_room']) {
      copiedData['room_number']    = record.data['_allocated_room'];
      copiedData['room_type']      = record.data['_allocated_room_type'];
      copiedData['rate_per_night'] = record.data['_allocated_rate'];
      await updateRoomStatus(req.tenantId, record.data['_allocated_room'], 'reserved');
    }

    if (rule.toSlug === 'billing') {
      copiedData['bill_type'] = 'room_bill';
      const tenantInfoR = await query(`SELECT invoice_prefix FROM tenants WHERE id=$1`, [req.tenantId]);
      const prefix = tenantInfoR.rows[0]?.invoice_prefix || 'INV';
      const countR = await query(
        `SELECT COUNT(*) FROM records r JOIN modules m ON m.id=r.module_id WHERE r.tenant_id=$1 AND m.slug='billing'`,
        [req.tenantId]
      );
      const count = parseInt(countR.rows[0].count) + 1;
      copiedData['invoice_number'] = `${prefix}-${String(count).padStart(5, '0')}`;
    }

    const newNumber = await generateRecordNumber(req.tenantId, rule.toSlug);

    let newTitle;
    if (rule.toSlug === 'billing') {
      newTitle = `${copiedData.guest_name || 'Bill'} - Room Bill`;
    } else if (rule.toSlug === 'bookings') {
      newTitle = copiedData.guest_name || `From ${record.record_number}`;
    } else {
      newTitle = `From ${record.record_number}${record.title ? ' — ' + record.title : ''}`;
    }

    const newRecR = await query(
      `INSERT INTO records (tenant_id, module_id, industry_id, record_number, title, data, status, created_by, parent_record_id, source_module_id)
       VALUES ($1,$2,$3,$4,$5,$6,'active',$7,$8,$9) RETURNING *`,
      [req.tenantId, toModuleId, record.industry_id, newNumber, newTitle, JSON.stringify(copiedData), req.user.id, record.id, record.module_id]
    );

    await query(
      `INSERT INTO workflow_log (tenant_id, from_record_id, to_record_id, from_module_id, to_module_id, trigger_status, triggered_by) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [req.tenantId, record.id, newRecR.rows[0].id, record.module_id, toModuleId, newStatus, req.user.id]
    );

    if (rule.toSlug === 'billing' && fromSlug === 'bookings' && newStatus === 'checked_out') {
      await autoCloseFoodTab(req, record, newRecR.rows[0]);
    }

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
    `SELECT status, COUNT(*) AS count FROM records WHERE tenant_id=$1 AND module_id=$2 AND is_archived=false GROUP BY status`,
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
