import React, { useState, useEffect } from 'react';
import { X, Save, Loader, GitBranch, BedDouble, CheckCircle, AlertCircle } from 'lucide-react';
import { recordAPI } from 'services/api';
import toast from 'react-hot-toast';

const RecordModal = ({ moduleSlug, titleHeads, record, onClose, onSave }) => {
  const isEdit = !!record;
  const [title, setTitle]   = useState('');
  const [data, setData]     = useState({});
  const [status, setStatus] = useState('active');
  const [saving, setSaving] = useState(false);

  // Room allocation popup state
  const [showRoomPicker, setShowRoomPicker] = useState(false);
  const [pendingStatus, setPendingStatus]   = useState(null);

  useEffect(() => {
    if (record) {
      setTitle(record.title || '');
      setData(record.data || {});
      setStatus(record.status || 'active');
    }
  }, [record]);

  const statusField = titleHeads.find(t => t.name === 'status');
  const otherFields = titleHeads.filter(t => t.name !== 'status' && !t.name.startsWith('_'));

  const update = (name, val) => setData(prev => ({ ...prev, [name]: val }));

  const handleStatusChange = (newStatus) => {
    // Intercept CRM "converted" to show room picker
    if (moduleSlug === 'crm' && newStatus === 'converted') {
      setPendingStatus(newStatus);
      setShowRoomPicker(true);
      return;
    }
    setStatus(newStatus);
    update('status', newStatus);
  };

  const handleRoomPickerConfirm = (roomData) => {
    // roomData = { room_number, room_type, rate_per_night, capacity }
    setStatus(pendingStatus);
    update('status', pendingStatus);
    // Store room allocation in data so workflow can use it
    if (roomData) {
      update('_allocated_room', roomData.room_number);
      update('_allocated_room_type', roomData.room_type);
      update('_allocated_rate', roomData.rate_per_night);
    }
    setShowRoomPicker(false);
    setPendingStatus(null);
  };

  const handleRoomPickerCancel = () => {
    setShowRoomPicker(false);
    setPendingStatus(null);
  };

  // For Bookings module — auto-fill room details when room_number changes
  const handleRoomNumberChange = async (roomNumber) => {
    update('room_number', roomNumber);
    if (moduleSlug === 'bookings' && roomNumber) {
      try {
        const res = await recordAPI.list('rooms', { limit: 100 });
        if (res.success && res.data.length > 0) {
          const room = res.data.find(r => r.data?.room_number === roomNumber);
          if (room) {
            update('room_type', room.data?.room_type || '');
            update('rate_per_night', room.data?.rate_per_night || '');
          }
        }
      } catch {}
    }
  };

  // For Billing module — auto-fill from linked booking
  const handleBillingBookingLink = async (bookingRef) => {
    update('linked_booking', bookingRef);
    if (moduleSlug === 'billing' && bookingRef) {
      try {
        const res = await recordAPI.list('bookings', { search: bookingRef, limit: 10 });
        if (res.success && res.data.length > 0) {
          const booking = res.data.find(b => b.record_number === bookingRef || b.data?.booking_number === bookingRef) || res.data[0];
          if (booking) {
            update('guest_name', booking.data?.guest_name || '');
            update('amount', booking.data?.room_amount || '');
            // Auto-generate invoice number
            const invoiceNum = `INV-${Date.now().toString().slice(-6)}`;
            update('invoice_number', invoiceNum);
          }
        }
      } catch {}
    }
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

  // For bookings — room_number should be a dropdown of available rooms
  const isBookingsModule = moduleSlug === 'bookings';

  return (
    <>
      <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
        <div className="modal" style={{ maxWidth: 620 }}>
          <div className="modal-header">
            <h3 className="modal-title">{isEdit ? `Edit Record` : `New ${modName} Record`}</h3>
            <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={17} /></button>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {record?.data?._linked_from && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 'var(--radius-md)', fontSize: 12, color: '#c2410c' }}>
                  <GitBranch size={14} />
                  Auto-created from {record.data._linked_from} via workflow
                </div>
              )}

              {/* Show allocated room notice if set */}
              {data._allocated_room && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 'var(--radius-md)', fontSize: 12, color: '#15803d' }}>
                  <BedDouble size={14} />
                  Room {data._allocated_room} ({data._allocated_room_type}) allocated — will be pre-filled in booking
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
                        if (isBookingsModule && f.name === 'room_number') {
                          handleRoomNumberChange(val);
                        } else if (moduleSlug === 'billing' && f.name === 'linked_booking') {
                          handleBillingBookingLink(val);
                        } else {
                          update(f.name, val);
                        }
                      }}
                      moduleSlug={moduleSlug}
                    />
                  ))}
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
          onCancel={handleRoomPickerCancel}
        />
      )}
    </>
  );
};

// ── Room Picker Modal ─────────────────────────────────────────────────────────
const RoomPickerModal = ({ guestName, onConfirm, onCancel }) => {
  const [numGuests, setNumGuests]     = useState(1);
  const [roomType, setRoomType]       = useState('');
  const [rooms, setRooms]             = useState([]);
  const [loading, setLoading]         = useState(false);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [searched, setSearched]       = useState(false);

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
      const res = await recordAPI.list('rooms', { status: 'vacant', limit: 50 });
      if (res.success) {
        let available = res.data.filter(r => {
          const cap = parseInt(r.data?.capacity) || 1;
          const type = r.data?.room_type || '';
          return cap >= numGuests && (roomType === '' || type === roomType);
        });
        setRooms(available);
      }
    } catch {
      toast.error('Could not fetch rooms');
    }
    setLoading(false);
  };

  const handleConfirm = () => {
    if (!selectedRoom) {
      toast.error('Please select a room');
      return;
    }
    onConfirm({
      room_number: selectedRoom.data?.room_number,
      room_type: selectedRoom.data?.room_type,
      rate_per_night: selectedRoom.data?.rate_per_night,
      capacity: selectedRoom.data?.capacity,
    });
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
            <>
              {rooms.length === 0 ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 'var(--radius-md)', fontSize: 13, color: '#dc2626' }}>
                  <AlertCircle size={16} />
                  No available rooms match your criteria. Try different filters or assign manually in the booking.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 280, overflowY: 'auto' }}>
                  <p style={{ fontSize: 12, color: 'var(--color-text-3)' }}>{rooms.length} room(s) available — click to select</p>
                  {rooms.map(room => (
                    <div
                      key={room.id}
                      onClick={() => setSelectedRoom(room)}
                      style={{
                        padding: '12px 16px',
                        border: `2px solid ${selectedRoom?.id === room.id ? 'var(--color-secondary)' : 'var(--color-border)'}`,
                        borderRadius: 'var(--radius-md)',
                        cursor: 'pointer',
                        background: selectedRoom?.id === room.id ? '#fff7ed' : 'var(--color-surface)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        transition: 'all 0.15s',
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>
                          Room {room.data?.room_number} — {room.title}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--color-text-3)', marginTop: 2 }}>
                          {room.data?.room_type} · Floor {room.data?.floor} · {room.data?.capacity} persons · {room.data?.bed_type}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontWeight: 700, color: 'var(--color-secondary)', fontSize: 14 }}>
                          ₹{Number(room.data?.rate_per_night || 0).toLocaleString()}
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--color-text-3)' }}>per night</div>
                        {selectedRoom?.id === room.id && (
                          <CheckCircle size={16} style={{ color: 'var(--color-secondary)', marginTop: 4 }} />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          <p style={{ fontSize: 11, color: 'var(--color-text-3)' }}>
            You can also skip this and assign the room manually inside the booking.
          </p>
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={() => onConfirm(null)}>Skip — Assign Manually</button>
          <button className="btn btn-primary" onClick={handleConfirm} disabled={!selectedRoom}>
            <CheckCircle size={14} /> Confirm Room {selectedRoom ? `(${selectedRoom.data?.room_number})` : ''}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Field Input ───────────────────────────────────────────────────────────────
const FieldInput = ({ field, value, onChange, moduleSlug }) => {
  const [roomOptions, setRoomOptions] = useState([]);
  const [loadingRooms, setLoadingRooms] = useState(false);

  // For bookings room_number field — load rooms as dropdown
  // For billing linked_booking field — load bookings as dropdown
  useEffect(() => {
    if (moduleSlug === 'bookings' && field.name === 'room_number') {
      setLoadingRooms(true);
      recordAPI.list('rooms', { limit: 100 }).then(res => {
        if (res.success) setRoomOptions(res.data);
      }).catch(() => {}).finally(() => setLoadingRooms(false));
    }
    if (moduleSlug === 'billing' && field.name === 'linked_booking') {
      setLoadingRooms(true);
      recordAPI.list('bookings', { limit: 100 }).then(res => {
        if (res.success) setRoomOptions(res.data);
      }).catch(() => {}).finally(() => setLoadingRooms(false));
    }
  }, [moduleSlug, field.name]);

  const isWide = ['textarea', 'address'].includes(field.field_type) ||
    field.name.includes('description') || field.name.includes('material') ||
    field.name.includes('remarks') || field.name.includes('notes') ||
    field.name.includes('requests') || field.name.includes('amenities');

  const el = (() => {
    // Special: bookings room_number = dropdown of rooms
    if (moduleSlug === 'bookings' && field.name === 'room_number') {
      return (
        <select className="form-select" value={value || ''} onChange={e => onChange(e.target.value)}>
          <option value="">Select room...</option>
          {loadingRooms && <option disabled>Loading rooms...</option>}
          {roomOptions.map(r => (
            <option key={r.id} value={r.data?.room_number}>
              Room {r.data?.room_number} — {r.title} ({r.data?.room_type}) · {r.status}
            </option>
          ))}
        </select>
      );
    }

    // Special: billing linked_booking = dropdown of bookings
    if (moduleSlug === 'billing' && field.name === 'linked_booking') {
      return (
        <select className="form-select" value={value || ''} onChange={e => onChange(e.target.value)}>
          <option value="">Select booking...</option>
          {loadingRooms && <option disabled>Loading...</option>}
          {roomOptions.map(r => (
            <option key={r.id} value={r.record_number}>
              {r.record_number} — {r.data?.guest_name || r.title} (Room {r.data?.room_number || '?'})
            </option>
          ))}
        </select>
      );
    }

    // Special: billing invoice_number = auto-generated, read-only
    if (moduleSlug === 'billing' && field.name === 'invoice_number') {
      return (
        <input
          type="text"
          className="form-input"
          value={value || ''}
          onChange={e => onChange(e.target.value)}
          placeholder="Auto-generates when booking is linked"
          style={{ fontFamily: 'monospace', background: value ? '#f0fdf4' : undefined }}
        />
      );
    }

    // Read-only auto-filled fields in bookings
    if (moduleSlug === 'bookings' && (field.name === 'room_type' || field.name === 'rate_per_night')) {
      return (
        <input
          type={field.field_type === 'currency' ? 'number' : 'text'}
          className="form-input"
          value={value || ''}
          onChange={e => onChange(e.target.value)}
          style={{ background: value ? '#f0fdf4' : undefined }}
          placeholder="Auto-fills when room is selected"
        />
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
      </label>
      {el}
    </div>
  );
};

export default RecordModal;
