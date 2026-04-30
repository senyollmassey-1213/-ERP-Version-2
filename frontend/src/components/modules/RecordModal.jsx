import React, { useState, useEffect } from 'react';
import { X, Save, Loader, GitBranch } from 'lucide-react';
import { recordAPI } from 'services/api';
import toast from 'react-hot-toast';

const RecordModal = ({ moduleSlug, titleHeads, record, onClose, onSave }) => {
  const isEdit = !!record;
  const [title, setTitle]   = useState('');
  const [data, setData]     = useState({});
  const [status, setStatus] = useState('active');
  const [saving, setSaving] = useState(false);

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    // Check required fields
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

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 620 }}>
        <div className="modal-header">
          <h3 className="modal-title">{isEdit ? `Edit Record` : `New ${modName} Record`}</h3>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={17} /></button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Workflow notice */}
            {record?.data?._linked_from && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 'var(--radius-md)', fontSize: 12, color: '#c2410c' }}>
                <GitBranch size={14} />
                Auto-created from {record.data._linked_from} via workflow
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Title *</label>
              <input className="form-input" value={title} onChange={e => setTitle(e.target.value)} placeholder="Record title..." required />
            </div>

            {/* Status field */}
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
                <select className="form-select" value={data.status || 'active'}
                  onChange={e => { setStatus(e.target.value); update('status', e.target.value); }}>
                  {statusField.options?.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            )}

            {/* Industry title head fields */}
            {otherFields.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {otherFields.map(f => (
                  <FieldInput key={f.id} field={f} value={data[f.name]} onChange={val => update(f.name, val)} />
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
  );
};

const FieldInput = ({ field, value, onChange }) => {
  const isWide = ['textarea', 'address'].includes(field.field_type) ||
    field.name.includes('description') || field.name.includes('material') ||
    field.name.includes('remarks') || field.name.includes('notes');

  const el = (() => {
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
