import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronRight, Plus, Edit, Trash2, X, Save, Loader } from 'lucide-react';
import { industryAPI, titleHeadAPI } from 'services/api';
import toast from 'react-hot-toast';

const FIELD_TYPES = [
  { value: 'text',     label: 'Text' },
  { value: 'textarea', label: 'Text Area' },
  { value: 'number',   label: 'Number' },
  { value: 'currency', label: 'Currency' },
  { value: 'date',     label: 'Date' },
  { value: 'email',    label: 'Email' },
  { value: 'phone',    label: 'Phone' },
  { value: 'dropdown', label: 'Dropdown' },
  { value: 'boolean',  label: 'Yes / No' },
];

const IndustriesPage = () => {
  const [industries, setIndustries] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [expanded, setExpanded]     = useState({});
  const [expandedMod, setExpandedMod] = useState({});
  const [moduleFields, setModuleFields] = useState({});    // key: indId_modId
  const [loadingFields, setLoadingFields] = useState({});
  const [showFieldModal, setShowFieldModal] = useState(null); // { industryId, moduleId, field? }
  const [editField, setEditField]   = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const r = await industryAPI.list();
      if (r.success) setIndustries(r.data);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const toggleIndustry = (id) => setExpanded(p => ({ ...p, [id]: !p[id] }));

  const toggleModule = async (industryId, moduleId) => {
    const key = `${industryId}_${moduleId}`;
    setExpandedMod(p => ({ ...p, [key]: !p[key] }));
    if (!moduleFields[key]) {
      setLoadingFields(p => ({ ...p, [key]: true }));
      try {
        const r = await titleHeadAPI.list(industryId, moduleId);
        if (r.success) setModuleFields(p => ({ ...p, [key]: r.data }));
      } catch {}
      setLoadingFields(p => ({ ...p, [key]: false }));
    }
  };

  const handleDeleteField = async (fieldId, key) => {
    if (!window.confirm('Delete this field?')) return;
    try {
      await titleHeadAPI.delete(fieldId);
      toast.success('Field deleted');
      setModuleFields(p => ({ ...p, [key]: p[key].filter(f => f.id !== fieldId) }));
    } catch (err) { toast.error(err.message); }
  };

  const handleFieldSaved = (key, newField, isEdit) => {
    setModuleFields(p => {
      const existing = p[key] || [];
      if (isEdit) return { ...p, [key]: existing.map(f => f.id === newField.id ? newField : f) };
      return { ...p, [key]: [...existing, newField].sort((a,b) => a.sort_order - b.sort_order) };
    });
    setShowFieldModal(null);
    setEditField(null);
  };

  if (loading) return <div className="page-loader"><div className="spinner" /></div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h2 style={{ fontSize: 20 }}>Industries</h2>
        <p style={{ fontSize: 12, color: 'var(--color-text-3)', marginTop: 2 }}>
          Manage industry title heads (field definitions) for each module
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {industries.map(industry => (
          <div key={industry.id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
            {/* Industry header */}
            <div
              onClick={() => toggleIndustry(industry.id)}
              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', cursor: 'pointer', userSelect: 'none' }}
            >
              {expanded[industry.id] ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              <div style={{ flex: 1 }}>
                <h3 style={{ fontSize: 15 }}>{industry.name}</h3>
                <p style={{ fontSize: 11, color: 'var(--color-text-3)' }}>{industry.description}</p>
              </div>
              <span className="badge badge-info">{industry.modules?.length || 0} modules</span>
            </div>

            {/* Module list */}
            {expanded[industry.id] && (
              <div style={{ borderTop: '1px solid var(--color-border)' }}>
                {(industry.modules || []).filter(m => m.slug !== 'dashboard').map(mod => {
                  const key = `${industry.id}_${mod.id}`;
                  const fields = moduleFields[key] || [];
                  const isOpen = expandedMod[key];

                  return (
                    <div key={mod.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                      {/* Module row */}
                      <div
                        onClick={() => toggleModule(industry.id, mod.id)}
                        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 18px 10px 36px', cursor: 'pointer', background: 'var(--color-surface-2)' }}
                      >
                        {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        <span style={{ fontSize: 13, fontWeight: 600, flex: 1 }}>{mod.name}</span>
                        {isOpen && (
                          <button className="btn btn-primary btn-sm" onClick={e => { e.stopPropagation(); setShowFieldModal({ industryId: industry.id, moduleId: mod.id, key }); setEditField(null); }}>
                            <Plus size={12} /> Add Field
                          </button>
                        )}
                        <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                          {loadingFields[key] ? '…' : isOpen ? `${fields.length} fields` : ''}
                        </span>
                      </div>

                      {/* Fields table */}
                      {isOpen && (
                        <div style={{ padding: '0 18px 14px 52px' }}>
                          {loadingFields[key] ? (
                            <div style={{ padding: 20, textAlign: 'center' }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
                          ) : fields.length === 0 ? (
                            <div className="empty-state" style={{ padding: '20px 0' }}><p>No fields defined. Click "Add Field" to begin.</p></div>
                          ) : (
                            <table className="table" style={{ fontSize: 12 }}>
                              <thead>
                                <tr>
                                  <th>Order</th><th>Field Name</th><th>Label</th><th>Type</th><th>Required</th><th>Options</th><th></th>
                                </tr>
                              </thead>
                              <tbody>
                                {fields.map(f => (
                                  <tr key={f.id}>
                                    <td style={{ color: 'var(--color-text-muted)', fontFamily: 'monospace' }}>{f.sort_order}</td>
                                    <td style={{ fontFamily: 'monospace', color: 'var(--color-text-2)' }}>{f.name}</td>
                                    <td><strong>{f.label}</strong></td>
                                    <td><span className="badge badge-default">{f.field_type}</span></td>
                                    <td>{f.is_required ? <span className="badge badge-warning">Yes</span> : <span style={{ color: 'var(--color-text-muted)' }}>No</span>}</td>
                                    <td style={{ color: 'var(--color-text-3)' }}>
                                      {f.options?.length ? `${f.options.length} options` : '—'}
                                    </td>
                                    <td>
                                      <div style={{ display: 'flex', gap: 4 }}>
                                        <button className="btn btn-ghost btn-sm btn-icon" onClick={() => { setShowFieldModal({ industryId: industry.id, moduleId: mod.id, key }); setEditField(f); }}>
                                          <Edit size={12} />
                                        </button>
                                        <button className="btn btn-ghost btn-sm btn-icon" onClick={() => handleDeleteField(f.id, key)}>
                                          <Trash2 size={12} />
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>

      {showFieldModal && (
        <FieldModal
          industryId={showFieldModal.industryId}
          moduleId={showFieldModal.moduleId}
          field={editField}
          onClose={() => { setShowFieldModal(null); setEditField(null); }}
          onSave={(f) => handleFieldSaved(showFieldModal.key, f, !!editField)}
        />
      )}
    </div>
  );
};

// ── Field Modal ───────────────────────────────────────────────────────────────
const FieldModal = ({ industryId, moduleId, field, onClose, onSave }) => {
  const isEdit = !!field;
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    label: field?.label || '',
    name:  field?.name  || '',
    field_type: field?.field_type || 'text',
    is_required: field?.is_required || false,
    sort_order: field?.sort_order || 99,
    options: field?.options ? JSON.stringify(field.options, null, 2) : '',
  });

  const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      let options;
      if (form.field_type === 'dropdown') {
        try { options = JSON.parse(form.options); }
        catch { toast.error('Options JSON is invalid'); setSaving(false); return; }
        if (!Array.isArray(options) || !options.length) {
          toast.error('Options must be a non-empty array'); setSaving(false); return;
        }
      }
      const payload = {
        label: form.label, name: form.name,
        field_type: form.field_type,
        is_required: form.is_required,
        sort_order: parseInt(form.sort_order),
        options,
      };
      let res;
      if (isEdit) res = await titleHeadAPI.update(field.id, payload);
      else        res = await titleHeadAPI.create(industryId, moduleId, payload);
      if (res.success) { toast.success(isEdit ? 'Field updated' : 'Field added'); onSave(res.data); }
    } catch (err) { toast.error(err.message); }
    setSaving(false);
  };

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header">
          <h3 className="modal-title">{isEdit ? 'Edit Field' : 'Add Field'}</h3>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={17} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 13 }}>
            <div className="form-group">
              <label className="form-label">Label *</label>
              <input className="form-input" value={form.label} required
                onChange={e => setForm(f => ({ ...f, label: e.target.value, name: isEdit ? f.name : slugify(e.target.value) }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Field Name *</label>
              <input className="form-input" value={form.name} required
                onChange={e => setForm(f => ({ ...f, name: slugify(e.target.value) }))}
                style={{ fontFamily: 'monospace', fontSize: 12 }} readOnly={isEdit} />
              {isEdit && <span className="form-hint">Field name cannot be changed after creation</span>}
            </div>
            <div className="form-group">
              <label className="form-label">Field Type *</label>
              <select className="form-select" value={form.field_type}
                onChange={e => setForm(f => ({ ...f, field_type: e.target.value }))}>
                {FIELD_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Sort Order</label>
              <input type="number" className="form-input" value={form.sort_order}
                onChange={e => setForm(f => ({ ...f, sort_order: e.target.value }))} />
            </div>
            <div className="form-group" style={{ gridColumn: '1/-1' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
                <input type="checkbox" checked={form.is_required}
                  onChange={e => setForm(f => ({ ...f, is_required: e.target.checked }))} />
                <span>Required field</span>
              </label>
            </div>
            {form.field_type === 'dropdown' && (
              <div className="form-group" style={{ gridColumn: '1/-1' }}>
                <label className="form-label">Options (JSON array) *</label>
                <textarea className="form-textarea" rows={6} value={form.options}
                  onChange={e => setForm(f => ({ ...f, options: e.target.value }))}
                  placeholder={`[\n  {"label": "Option 1", "value": "option_1"},\n  {"label": "Option 2", "value": "option_2"}\n]`}
                  style={{ fontFamily: 'monospace', fontSize: 12 }} />
                <span className="form-hint">Array of {"{"}"label","value"{"}"} objects</span>
              </div>
            )}
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? <Loader size={14} className="animate-spin" /> : <Save size={14} />}
              {saving ? 'Saving...' : isEdit ? 'Update' : 'Add Field'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default IndustriesPage;
