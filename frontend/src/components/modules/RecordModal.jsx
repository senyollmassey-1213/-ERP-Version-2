import React, { useState, useEffect } from 'react';
import { X, Save, Loader, GitBranch, BedDouble, CheckCircle, AlertCircle, Printer, MessageCircle } from 'lucide-react';
import { recordAPI, tenantAPI } from 'services/api';
import { useAuth } from 'context/AuthContext';
import toast from 'react-hot-toast';

const UTR_METHODS = ['card', 'bank', 'upi'];

const RecordModal = ({ moduleSlug, titleHeads, record, onClose, onSave }) => {
  const isEdit = !!record;
  const { tenant } = useAuth();
  const [title, setTitle]   = useState('');
  const [data, setData]     = useState({});
  const [status, setStatus] = useState('active');
  const [saving, setSaving] = useState(false);
  const [showRoomPicker, setShowRoomPicker] = useState(false);
  const [pendingStatus, setPendingStatus]   = useState(null);
  const [hotelInfo, setHotelInfo] = useState(null);

  useEffect(() => {
    if (record) {
      setTitle(record.title || '');
      setData(record.data || {});
      setStatus(record.status || 'active');
    }
  }, [record]);

  useEffect(() => {
    if (moduleSlug === 'billing') {
      tenantAPI.getMyInfo().then(res => {
        if (res.success) setHotelInfo(res.data);
      }).catch(() => {});
    }
  }, [moduleSlug]);

  const statusField = titleHeads.find(t => t.name === 'status');
  const otherFields = titleHeads.filter(t => t.name !== 'status' && !t.name.startsWith('_'));

  const update = (name, val) => setData(prev => ({ ...prev, [name]: val }));

  const handleStatusChange = (newStatus) => {
    if (moduleSlug === 'crm' && newStatus === 'converted') {
      setPendingStatus(newStatus);
      setShowRoomPicker(true);
      return;
    }
    setStatus(newStatus);
    update('status', newStatus);
  };

  const handleRoomPickerConfirm = (roomData) => {
    setStatus(pendingStatus);
    update('status', pendingStatus);
    if (roomData) {
      update('_allocated_room', roomData.room_number);
      update('_allocated_room_type', roomData.room_type);
      update('_allocated_rate', roomData.rate_per_night);
    }
    setShowRoomPicker(false);
    setPendingStatus(null);
  };

  const handleRoomNumberChange = async (roomNumber) => {
    update('room_number', roomNumber);
    if (moduleSlug === 'bookings' && roomNumber) {
      try {
        const res = await recordAPI.list('rooms', { limit: 100 });
        if (res.success) {
          const room = res.data.find(r => r.data?.room_number === roomNumber);
          if (room) {
            update('room_type', room.data?.room_type || '');
            update('rate_per_night', room.data?.rate_per_night || '');
          }
        }
      } catch {}
    }
  };

  const handleBillingBookingLink = async (bookingRef) => {
    update('linked_booking', bookingRef);
    if (moduleSlug === 'billing' && bookingRef) {
      try {
        const res = await recordAPI.list('bookings', { limit: 100 });
        if (res.success) {
          const booking = res.data.find(b => b.record_number === bookingRef);
          if (booking) {
            update('guest_name', booking.data?.guest_name || '');
            if (!data.bill_type || data.bill_type === 'room_bill') {
              update('amount', booking.data?.room_amount || '');
            }
          }
        }
      } catch {}
    }
  };

  const handleBillTypeChange = (billType) => {
    update('bill_type', billType);
    update('amount', '');
    update('total', '');
  };

  const generateInvoiceNumber = async () => {
    try {
      const prefix = hotelInfo?.invoice_prefix || 'INV';
      const res = await recordAPI.list('billing', { limit: 1000 });
      const count = res.success ? (res.data?.length || 0) + 1 : 1;
      return `${prefix}-${String(count).padStart(5, '0')}`;
    } catch { return `INV-00001`; }
  };

  useEffect(() => {
    if (moduleSlug === 'billing' && !isEdit && !data.invoice_number && hotelInfo) {
      generateInvoiceNumber().then(num => update('invoice_number', num));
    }
  }, [moduleSlug, isEdit, hotelInfo]);

  // Auto-calculate total from amount + tax
  useEffect(() => {
    if (moduleSlug === 'billing') {
      const amount = parseFloat(data.amount) || 0;
      const tax = parseFloat(data.tax) || 0;
      if (amount > 0) {
        const total = amount + (amount * tax / 100);
        update('total', total.toFixed(2));
      }
    }
  , [data.amount, data.tax, moduleSlug]);

  const handlePrint = () => {
    const hotel = hotelInfo || {};
    const d = data;
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>Invoice ${d.invoice_number||''}</title>
<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif;font-size:13px;color:#1a202c;padding:32px}
.header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;border-bottom:2px solid #0b1628;padding-bottom:16px}
.hotel-name{font-size:22px;font-weight:700;color:#0b1628}.hotel-meta{font-size:11px;color:#718096;margin-top:4px;line-height:1.6}
.logo{max-height:60px;margin-bottom:8px;display:block}
.invoice-title{font-size:28px;font-weight:700;color:#c75b39;text-align:right}
.invoice-meta{font-size:11px;color:#718096;text-align:right;margin-top:4px;line-height:1.6}
.guest-section{background:#f8fafc;padding:14px 16px;border-radius:8px;margin-bottom:20px}
.guest-section h4{font-size:11px;text-transform:uppercase;color:#718096;margin-bottom:8px;letter-spacing:.05em}
.guest-name{font-size:16px;font-weight:600;color:#0b1628}.guest-meta{font-size:12px;color:#718096;margin-top:2px}
table{width:100%;border-collapse:collapse;margin-bottom:20px}
th{background:#0b1628;color:white;padding:10px 12px;text-align:left;font-size:11px;text-transform:uppercase}
td{padding:10px 12px;border-bottom:1px solid #e2e8f0;font-size:12px}tr:nth-child(even) td{background:#f8fafc}
.totals{margin-left:auto;width:260px}.total-row{display:flex;justify-content:space-between;padding:6px 0;font-size:13px;border-bottom:1px solid #e2e8f0}
.total-final{display:flex;justify-content:space-between;padding:10px 0;font-size:16px;font-weight:700;color:#0b1628;border-top:2px solid #0b1628;margin-top:4px}
.paid-stamp{margin-top:20px;padding:12px 16px;background:#f0fdf4;border-radius:8px;border-left:4px solid #16a34a;font-size:13px}
.footer{margin-top:32px;text-align:center;font-size:11px;color:#a0aec0;border-top:1px solid #e2e8f0;padding-top:16px}
@media print{body{padding:16px}@page{margin:12mm}}</style></head><body>
<div class="header">
  <div>
    ${hotel.logo_url ? `<img src="${hotel.logo_url}" class="logo" alt="Logo"/>` : ''}
    <div class="hotel-name">${hotel.name||'Hotel'}</div>
    <div class="hotel-meta">${hotel.address||''}${hotel.phone?'<br/>Tel: '+hotel.phone:''}${hotel.website?' · '+hotel.website:''}${hotel.gst_number?'<br/>GSTIN: '+hotel.gst_number:''}</div>
  </div>
  <div>
    <div class="invoice-title">INVOICE</div>
    <div class="invoice-meta"><strong>${d.invoice_number||'—'}</strong><br/>Date: ${new Date().toLocaleDateString('en-IN')}${d.linked_booking?'<br/>Booking: '+d.linked_booking:''}</div>
  </div>
</div>
<div class="guest-section">
  <h4>Bill To</h4>
  <div class="guest-name">${d.guest_name||'Guest'}</div>
  <div class="guest-meta">${d.room_number?'Room: '+d.room_number:''}${d.check_in_date?' · Check-in: '+d.check_in_date:''}${d.check_out_date?' · Check-out: '+d.check_out_date:''}</div>
</div>
<table>
  <thead><tr><th>Description</th><th>Details</th><th style="text-align:right">Amount</th></tr></thead>
  <tbody>
    <tr>
      <td>${d.bill_type==='room_bill'?'Room Charges':d.bill_type==='food_bill'?'Food & Beverage':d.bill_type==='transport_bill'?'Transport Charges':'Charges'}</td>
      <td style="color:#718096;font-size:11px">${d.room_number?'Room '+d.room_number:''}${d.total_nights?' · '+d.total_nights+' night(s)':''}</td>
      <td style="text-align:right;font-family:monospace">₹${Number(d.amount||0).toLocaleString('en-IN')}</td>
    </tr>
  </tbody>
</table>
<div class="totals">
  <div class="total-row"><span>Subtotal</span><span>₹${Number(d.amount||0).toLocaleString('en-IN')}</span></div>
  <div class="total-row"><span>GST (${d.tax||0}%)</span><span>₹${(Number(d.amount||0)*(Number(d.tax||0)/100)).toLocaleString('en-IN')}</span></div>
  <div class="total-final"><span>Total</span><span>₹${Number(d.total||0).toLocaleString('en-IN')}</span></div>
</div>
${d.payment_status==='paid'?`<div class="paid-stamp">✓ <strong>PAID</strong> via ${d.payment_method||'—'} on ${d.payment_date||'—'}${d.utr_number?' · Ref: '+d.utr_number:''}</div>`:''}
${d.remarks?`<p style="margin-top:16px;font-size:12px;color:#718096">Note: ${d.remarks}</p>`:''}
<div class="footer">Thank you for staying with us!${hotel.website?' · '+hotel.website:''}${hotel.phone?' · '+hotel.phone:''}</div>
<script>window.onload=()=>setTimeout(()=>window.print(),400);</script>
</body></html>`;
    const win = window.open('', '_blank');
    win.document.write(html);
    win.document.close();
  };

  const handleWhatsApp = () => {
    const d = data;
    const phone = (d.phone || '').replace(/[^0-9]/g, '');
    const msg = encodeURIComponent(
      `Dear ${d.guest_name||'Guest'},\n\n` +
      `Your invoice *${d.invoice_number||''}* from *${hotelInfo?.name||'Hotel'}*\n` +
      `Amount: ₹${Number(d.total||0).toLocaleString('en-IN')}\n` +
      `Status: ${d.payment_status||'—'}\n` +
      `Booking Ref: ${d.linked_booking||'—'}\n\n` +
      `Thank you for your stay!`
    );
    window.open(`https://wa.me/${phone ? '91' + phone.slice(-10) : ''}?text=${msg}`, '_blank');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    for (const f of titleHeads) {
      if (f.is_required && !data[f.name] && f.name !== 'status') {
        toast.error(`${f.label} is required`);
        return;
      }
    }
    setSaving(true);
    try {
      const payload = { title, data: { ...data, status }, status };
      if (isEdit) {
        await recordAPI.update(record.id, payload);
        toast.success('Record updated');
      } else {
        await recordAPI.create(moduleSlug, payload);
        toast.success('Record created');
      }
      onSave();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const modName = moduleSlug.charAt(0).toUpperCase() + moduleSlug.slice(1);
  const isBookingsModule = moduleSlug === 'bookings';
  const isBillingModule  = moduleSlug === 'billing';
  const showUTR = isBillingModule && UTR_METHODS.includes(data.payment_method);

  return (
    <>
      <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
        <div className="modal" style={{ maxWidth: 640 }}>
          <div className="modal-header">
            <h3 className="modal-title">{isEdit ? `Edit Record` : `New ${modName} Record`}</h3>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              {isBillingModule && isEdit && (
                <>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={handleWhatsApp} title="Share via WhatsApp">
                    <MessageCircle size={14} /> WhatsApp
                  </button>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={handlePrint} title="Print Invoice">
                    <Printer size={14} /> Print
                  </button>
                </>
              )}
              <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={17} /></button>
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {record?.data?._linked_from && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 'var(--radius-md)', fontSize: 12, color: '#c2410c' }}>
                  <GitBranch size={14} />
                  Auto-created from {record.data._linked_from} via workflow
                </div>
              )}

              {data._allocated_room && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 'var(--radius-md)', fontSize: 12, color: '#15803d' }}>
                  <BedDouble size={14} />
                  Room {data._allocated_room} ({data._allocated_room_type}) allocated
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Title *</label>
                <input className="form-input" value={title} onChange={e => setTitle(e.target.value)} placeholder="Record title..." required />
              </div>

              {statusField && (
                <div className="form-group">
                  <label className="form-label">
                    Status *
                    {isEdit && statusField.options?.length > 0 && (
                      <span style={{ color: 'var(--color-secondary)', marginLeft: 8, textTransform: 'none', fontWeight: 400 }}>
                        (changing to certain statuses triggers workflow)
                      </span>
                    )}
                  </label>
                  <select className="form-select" value={data.status || ''}
                    onChange={e => handleStatusChange(e.target.value)}>
                    {statusField.options?.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              )}

              {otherFields.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  {otherFields.map(f => (
                    <FieldInput
                      key={f.id}
                      field={f}
                      value={data[f.name]}
                      onChange={val => {
                        if (isBookingsModule && f.name === 'room_number') handleRoomNumberChange(val);
                        else if (isBillingModule && f.name === 'linked_booking') handleBillingBookingLink(val);
                        else if (isBillingModule && f.name === 'bill_type') handleBillTypeChange(val);
                        else update(f.name, val);
                      }}
                      moduleSlug={moduleSlug}
                    />
                  ))}

                  {showUTR && (
                    <div className="form-group">
                      <label className="form-label">UTR / Transaction Reference</label>
                      <input type="text" className="form-input" value={data.utr_number || ''}
                        onChange={e => update('utr_number', e.target.value)}
                        placeholder="Enter UTR / transaction ID"
                        style={{ fontFamily: 'monospace' }} />
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? <Loader size={14} className="animate-spin" /> : <Save size={14} />}
                {saving ? 'Saving...' : isEdit ? 'Update' : 'Create'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {showRoomPicker && (
        <RoomPickerModal
          guestName={data.guest_name || title}
          onConfirm={handleRoomPickerConfirm}
          onCancel={() => { setShowRoomPicker(false); setPendingStatus(null); }}
        />
      )}
    </>
  );
};

// ── Room Picker Modal ─────────────────────────────────────────────────────────
const RoomPickerModal = ({ guestName, onConfirm, onCancel }) => {
  const [numGuests, setNumGuests]       = useState(1);
  const [roomType, setRoomType]         = useState('');
  const [rooms, setRooms]               = useState([]);
  const [loading, setLoading]           = useState(false);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [searched, setSearched]         = useState(false);

  const ROOM_TYPES = [
    { value: '', label: 'Any Type' },
    { value: 'standard', label: 'Standard' },
    { value: 'deluxe', label: 'Deluxe' },
    { value: 'suite', label: 'Suite' },
    { value: 'executive', label: 'Executive' },
    { value: 'family', label: 'Family' },
  ];

  const searchRooms = async () => {
    setLoading(true);
    setSearched(true);
    setSelectedRoom(null);
    try {
      const res = await recordAPI.list('rooms', { limit: 100 });
      if (res.success) {
        const available = res.data.filter(r => {
          const cap = parseInt(r.data?.capacity) || 1;
          const type = r.data?.room_type || '';
          const roomStatus = r.data?.status || r.status;
          return roomStatus === 'vacant' && cap >= numGuests && (roomType === '' || type === roomType);
        });
        setRooms(available);
      }
    } catch { toast.error('Could not fetch rooms'); }
    setLoading(false);
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 1100 }}>
      <div className="modal" style={{ maxWidth: 560 }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <BedDouble size={18} style={{ color: 'var(--color-secondary)' }} />
            <h3 className="modal-title">Allocate Room for {guestName || 'Guest'}</h3>
          </div>
          <button className="btn btn-ghost btn-icon" onClick={onCancel}><X size={17} /></button>
        </div>

        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label className="form-label">Number of Guests</label>
              <input type="number" className="form-input" min={1} max={20} value={numGuests}
                onChange={e => setNumGuests(parseInt(e.target.value) || 1)} />
            </div>
            <div className="form-group">
              <label className="form-label">Preferred Room Type</label>
              <select className="form-select" value={roomType} onChange={e => setRoomType(e.target.value)}>
                {ROOM_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
          </div>

          <button className="btn btn-primary" onClick={searchRooms} disabled={loading}>
            {loading ? <Loader size={14} className="animate-spin" /> : <BedDouble size={14} />}
            {loading ? 'Searching...' : 'Find Available Rooms'}
          </button>

          {searched && !loading && (
            rooms.length === 0 ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 'var(--radius-md)', fontSize: 13, color: '#dc2626' }}>
                <AlertCircle size={16} />
                No vacant rooms match your criteria. Try different filters or skip to assign manually.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 280, overflowY: 'auto' }}>
                <p style={{ fontSize: 12, color: 'var(--color-text-3)' }}>{rooms.length} room(s) available</p>
                {rooms.map(room => (
                  <div key={room.id} onClick={() => setSelectedRoom(room)}
                    style={{ padding: '12px 16px', border: `2px solid ${selectedRoom?.id === room.id ? 'var(--color-secondary)' : 'var(--color-border)'}`, borderRadius: 'var(--radius-md)', cursor: 'pointer', background: selectedRoom?.id === room.id ? '#fff7ed' : 'var(--color-surface)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', transition: 'all 0.15s' }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>Room {room.data?.room_number} — {room.title}</div>
                      <div style={{ fontSize: 12, color: 'var(--color-text-3)', marginTop: 2 }}>
                        {room.data?.room_type} · Floor {room.data?.floor} · {room.data?.capacity} persons · {room.data?.bed_type}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 700, color: 'var(--color-secondary)', fontSize: 14 }}>₹{Number(room.data?.rate_per_night || 0).toLocaleString()}</div>
                      <div style={{ fontSize: 10, color: 'var(--color-text-3)' }}>per night</div>
                      {selectedRoom?.id === room.id && <CheckCircle size={16} style={{ color: 'var(--color-secondary)', marginTop: 4 }} />}
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
          <p style={{ fontSize: 11, color: 'var(--color-text-3)' }}>You can skip this and assign the room manually inside the booking.</p>
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={() => onConfirm(null)}>Skip — Assign Manually</button>
          <button className="btn btn-primary" onClick={() => {
            if (!selectedRoom) { toast.error('Please select a room'); return; }
            onConfirm({ room_number: selectedRoom.data?.room_number, room_type: selectedRoom.data?.room_type, rate_per_night: selectedRoom.data?.rate_per_night, capacity: selectedRoom.data?.capacity });
          }} disabled={!selectedRoom}>
            <CheckCircle size={14} /> Confirm Room {selectedRoom ? `(${selectedRoom.data?.room_number})` : ''}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Field Input ───────────────────────────────────────────────────────────────
const FieldInput = ({ field, value, onChange, moduleSlug }) => {
  const [options, setOptions] = useState([]);
  const [loadingOpts, setLoadingOpts] = useState(false);

  useEffect(() => {
    if (moduleSlug === 'bookings' && field.name === 'room_number') {
      setLoadingOpts(true);
      recordAPI.list('rooms', { limit: 100 }).then(res => {
        if (res.success) setOptions(res.data);
      }).catch(() => {}).finally(() => setLoadingOpts(false));
    }
    if (moduleSlug === 'billing' && field.name === 'linked_booking') {
      setLoadingOpts(true);
      recordAPI.list('bookings', { limit: 100 }).then(res => {
        if (res.success) setOptions(res.data);
      }).catch(() => {}).finally(() => setLoadingOpts(false));
    }
  }, [moduleSlug, field.name]);

  const isWide = ['textarea'].includes(field.field_type) ||
    ['description','material','remarks','notes','requests','amenities','address'].some(k => field.name.includes(k));

  const isAutoFilled = (moduleSlug === 'bookings' && ['room_type','rate_per_night'].includes(field.name)) ||
                       (moduleSlug === 'billing'   && ['guest_name','invoice_number','total'].includes(field.name));

  const el = (() => {
    if (moduleSlug === 'bookings' && field.name === 'room_number') {
      return (
        <select className="form-select" value={value || ''} onChange={e => onChange(e.target.value)}>
          <option value="">Select room...</option>
          {loadingOpts && <option disabled>Loading...</option>}
          {options.map(r => (
            <option key={r.id} value={r.data?.room_number}>
              Room {r.data?.room_number} — {r.title} ({r.data?.room_type}) · {r.data?.status || r.status}
            </option>
          ))}
        </select>
      );
    }

    if (moduleSlug === 'billing' && field.name === 'linked_booking') {
      return (
        <select className="form-select" value={value || ''} onChange={e => onChange(e.target.value)}>
          <option value="">Select booking...</option>
          {loadingOpts && <option disabled>Loading...</option>}
          {options.map(r => (
            <option key={r.id} value={r.record_number}>
              {r.record_number} — {r.data?.guest_name || r.title} (Room {r.data?.room_number || '?'})
            </option>
          ))}
        </select>
      );
    }

    if (isAutoFilled && value) {
      return (
        <input type={field.field_type === 'currency' || field.field_type === 'number' ? 'number' : 'text'}
          className="form-input" value={value || ''} onChange={e => onChange(e.target.value)}
          style={{ background: '#f0fdf4' }} />
      );
    }

    switch (field.field_type) {
      case 'textarea':
        return <textarea className="form-textarea" value={value||''} onChange={e=>onChange(e.target.value)} placeholder={`Enter ${field.label.toLowerCase()}...`} rows={3} />;
      case 'number':
        return <input type="number" className="form-input" value={value||''} onChange={e=>onChange(e.target.value)} />;
      case 'currency':
        return (
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-3)', fontSize: 13 }}>₹</span>
            <input type="number" className="form-input" style={{ paddingLeft: 24 }} value={value||''} onChange={e=>onChange(e.target.value)} />
          </div>
        );
      case 'date':
        return <input type="date" className="form-input" value={value||''} onChange={e=>onChange(e.target.value)} />;
      case 'datetime':
        return <input type="datetime-local" className="form-input" value={value||''} onChange={e=>onChange(e.target.value)} />;
      case 'email':
        return <input type="email" className="form-input" value={value||''} onChange={e=>onChange(e.target.value)} placeholder="email@example.com" />;
      case 'phone':
        return <input type="tel" className="form-input" value={value||''} onChange={e=>onChange(e.target.value)} placeholder="+91 XXXXX XXXXX" />;
      case 'boolean':
        return (
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, marginTop: 4 }}>
            <input type="checkbox" checked={!!value} onChange={e=>onChange(e.target.checked)} />
            {value ? 'Yes' : 'No'}
          </label>
        );
      case 'dropdown':
        return (
          <select className="form-select" value={value||''} onChange={e=>onChange(e.target.value)}>
            <option value="">Select...</option>
            {(field.options||[]).map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        );
      default:
        return <input type="text" className="form-input" value={value||''} onChange={e=>onChange(e.target.value)} />;
    }
  })();

  return (
    <div className="form-group" style={isWide ? { gridColumn: '1 / -1' } : {}}>
      <label className="form-label">
        {field.label}
        {field.is_required && <span style={{ color: 'var(--color-error)', marginLeft: 2 }}>*</span>}
        {isAutoFilled && value && <span style={{ color: '#16a34a', marginLeft: 6, fontSize: 10, fontWeight: 400 }}>auto-filled</span>}
      </label>
      {el}
    </div>
  );
};

export default RecordModal;
