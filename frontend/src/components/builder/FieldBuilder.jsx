import React, { useState, useEffect } from 'react';
import {
  ArrowLeft, Plus, Trash2, Edit, GripVertical, Save,
  X, Loader, Tag, List, ToggleLeft, Hash, Calendar,
  Mail, Phone, Link, Star, DollarSign, Type, AlignLeft,
} from 'lucide-react';
import { fieldAPI, moduleAPI } from 'services/api';
import toast from 'react-hot-toast';

const FIELD_TYPES = [
  { value: 'text',         label: 'Text',          icon: Type },
  { value: 'textarea',     label: 'Long Text',      icon: AlignLeft },
  { value: 'number',       label: 'Number',         icon: Hash },
  { value: 'currency',     label: 'Currency',       icon: DollarSign },
  { value: 'date',         label: 'Date',           icon: Calendar },
  { value: 'dropdown',     label: 'Dropdown',       icon: List },
  { value: 'multi_select', label: 'Multi-Select',   icon: Tag },
  { value: 'boolean',      label: 'Checkbox',       icon: ToggleLeft },
  { value: 'email',        label: 'Email',          icon: Mail },
  { value: 'phone',        label: 'Phone',          icon: Phone },
  { value: 'url',          label: 'URL',            icon: Link },
  { value: 'rating',       label: 'Rating',         icon: Star },
];

const FieldBuilder = ({ module, onBack }) => {
  const [fields, setFields]     = useState([]);
  const [sections, setSections] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editField, setEditField] = useState(null);
  const [showSectionModal, setShowSectionModal] = useState(false);

  useEffect(() => {
    loadData();
  }, [module]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [fieldRes, secRes] = await Promise.all([
        fieldAPI.list(module.id),
        moduleAPI.getSections(module.id),
      ]);
      if (fieldRes.success) setFields(fieldRes.data);
      if (secRes.success)   setSections(secRes.data);
    } catch {}
    setLoading(false);
  };

  const handleDeleteField = async (id) => {
    if (!window.confirm('Delete this field? Existing record data for this field will remain stored but not displayed.')) return;
    try {
      await fieldAPI.delete(id);
      toast.success('Field deleted');
      loadData();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleDeleteSection = async (sectionId) => {
    if (!window.confirm('Delete this section?')) return;
    try {
      await moduleAPI.deleteSection(module.id, sectionId);
      toast.success('Section deleted');
      loadData();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const fieldsBySection = {
    none: fields.filter(f => !f.section_id),
    ...sections.reduce((acc, s) => ({
      ...acc,
      [s.id]: fields.filter(f => f.section_id === s.id),
    }), {}),
  };

  if (loading) return <div className="page-loader"><div className="spinner" /></div>;

  return (
    <div className="field-builder">
      <div className="field-builder-header">
        <button className="btn btn-ghost" onClick={onBack}>
          <ArrowLeft size={16} /> Back to Modules
        </button>
        <div>
          <h3>{module.display_name || module.name} — Fields & Sections</h3>
          <p style={{ fontSize: 12, color: 'var(--color-text-3)', marginTop: 2 }}>
            {fields.length} fields • {sections.length} sections
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
          <button className="btn btn-secondary btn-sm" onClick={() => setShowSectionModal(true)}>
            <Plus size={14} /> Add Section
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => { setEditField(null); setShowModal(true); }}>
            <Plus size={14} /> Add Field
          </button>
        </div>
      </div>

      {/* Sections */}
      {sections.map(sec => (
        <div key={sec.id} className="field-section">
          <div className="field-section-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {sec.color && <span style={{ width: 10, height: 10, borderRadius: '50%', background: sec.color, display: 'inline-block' }} />}
              <strong style={{ fontSize: 13 }}>{sec.name}</strong>
              <span style={{ fontSize: 11, color: 'var(--color-text-3)' }}>({fieldsBySection[sec.id]?.length || 0} fields)</span>
            </div>
            <button className="btn btn-ghost btn-sm btn-icon" onClick={() => handleDeleteSection(sec.id)}>
              <Trash2 size={13} />
            </button>
          </div>
          <FieldList
            fields={fieldsBySection[sec.id] || []}
            onEdit={(f) => { setEditField(f); setShowModal(true); }}
            onDelete={handleDeleteField}
          />
        </div>
      ))}

      {/* Unassigned fields */}
      <div className="field-section">
        <div className="field-section-header">
          <strong style={{ fontSize: 13, color: 'var(--color-text-3)' }}>
            {sections.length > 0 ? 'Unassigned Fields' : 'All Fields'}
          </strong>
        </div>
        <FieldList
          fields={fieldsBySection.none || []}
          onEdit={(f) => { setEditField(f); setShowModal(true); }}
          onDelete={handleDeleteField}
        />
        {(fieldsBySection.none?.length === 0 && fields.length === 0) && (
          <div className="empty-state" style={{ padding: '32px 16px', border: '1px dashed var(--color-border)', borderRadius: 'var(--radius-md)' }}>
            <Plus size={28} />
            <p>No fields yet. Click "Add Field" to start building your module.</p>
          </div>
        )}
      </div>

      {/* Field Modal */}
      {showModal && (
        <FieldModal
          module={module}
          sections={sections}
          field={editField}
          onClose={() => { setShowModal(false); setEditField(null); }}
          onSave={() => { setShowModal(false); setEditField(null); loadData(); }}
        />
      )}

      {/* Section Modal */}
      {showSectionModal && (
        <SectionModal
          module={module}
          onClose={() => setShowSectionModal(false)}
          onSave={() => { setShowSectionModal(false); loadData(); }}
        />
      )}
    </div>
  );
};

// ─── Field List ───────────────────────────────────────────────────────────────
const FieldList = ({ fields, onEdit, onDelete }) => {
  if (!fields.length) return null;
  return (
    <div className="field-list">
      {fields.map(f => {
        const TypeInfo = FIELD_TYPES.find(t => t.value === f.field_type);
        const TypeIcon = TypeInfo?.icon || Type;
        return (
          <div key={f.id} className="field-row">
            <GripVertical size={14} style={{ color: 'var(--color-border)', cursor: 'grab' }} />
            <div className="field-row-type">
              <TypeIcon size={14} />
            </div>
            <div className="field-row-info">
              <span className="field-row-label">{f.label}</span>
              <span className="field-row-name">{f.name}</span>
            </div>
            <div className="field-row-meta">
              <span className="badge badge-default" style={{ fontSize: 10 }}>{TypeInfo?.label || f.field_type}</span>
              {f.is_required && <span className="badge badge-error" style={{ fontSize: 10 }}>Required</span>}
            </div>
            <div className="field-row-actions">
              <button className="btn btn-ghost btn-sm btn-icon" onClick={() => onEdit(f)}>
                <Edit size={13} />
              </button>
              {!f.is_system && (
                <button className="btn btn-ghost btn-sm btn-icon" onClick={() => onDelete(f.id)}>
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ─── Field Modal ──────────────────────────────────────────────────────────────
const FieldModal = ({ module, sections, field, onClose, onSave }) => {
  const isEdit = !!field;
  const [form, setForm] = useState({
    name: field?.name || '',
    label: field?.label || '',
    fieldType: field?.field_type || 'text',
    sectionId: field?.section_id || '',
    isRequired: field?.is_required || false,
    placeholder: field?.placeholder || '',
    defaultValue: field?.default_value || '',
    options: field?.options || [],
  });
  const [saving, setSaving] = useState(false);
  const [newOption, setNewOption] = useState('');

  // Auto-generate name from label
  const handleLabelChange = (label) => {
    const name = label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
    setForm(prev => ({ ...prev, label, ...(isEdit ? {} : { name }) }));
  };

  const addOption = () => {
    if (!newOption.trim()) return;
    const opt = { label: newOption.trim(), value: newOption.trim().toLowerCase().replace(/\s+/g, '_') };
    setForm(prev => ({ ...prev, options: [...prev.options, opt] }));
    setNewOption('');
  };

  const removeOption = (idx) => {
    setForm(prev => ({ ...prev, options: prev.options.filter((_, i) => i !== idx) }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.label || !form.fieldType) {
      toast.error('Name, label, and type are required');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        label: form.label,
        fieldType: form.fieldType,
        sectionId: form.sectionId || undefined,
        isRequired: form.isRequired,
        placeholder: form.placeholder,
        defaultValue: form.defaultValue,
        options: ['dropdown', 'multi_select'].includes(form.fieldType) ? form.options : undefined,
      };

      if (isEdit) {
        await fieldAPI.update(field.id, payload);
        toast.success('Field updated');
      } else {
        await fieldAPI.create(module.id, payload);
        toast.success('Field created');
      }
      onSave();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const needsOptions = ['dropdown', 'multi_select'].includes(form.fieldType);

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: 520 }}>
        <div className="modal-header">
          <h3 className="modal-title">{isEdit ? 'Edit Field' : 'Add Field'}</h3>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Label *</label>
                <input className="form-input" value={form.label} onChange={e => handleLabelChange(e.target.value)} placeholder="Display Label" required />
              </div>
              <div className="form-group">
                <label className="form-label">Field Name *</label>
                <input className="form-input" value={form.name} onChange={e => setForm({...form, name: e.target.value})}
                  placeholder="field_name" required disabled={isEdit}
                  style={{ fontFamily: 'monospace', fontSize: 12, background: isEdit ? 'var(--color-bg)' : undefined }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Field Type *</label>
                <select className="form-select" value={form.fieldType} onChange={e => setForm({...form, fieldType: e.target.value})} disabled={isEdit}>
                  {FIELD_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              {sections.length > 0 && (
                <div className="form-group">
                  <label className="form-label">Section</label>
                  <select className="form-select" value={form.sectionId} onChange={e => setForm({...form, sectionId: e.target.value})}>
                    <option value="">No section</option>
                    {sections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">Placeholder</label>
              <input className="form-input" value={form.placeholder} onChange={e => setForm({...form, placeholder: e.target.value})} placeholder="Hint text shown inside input" />
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
              <input type="checkbox" checked={form.isRequired} onChange={e => setForm({...form, isRequired: e.target.checked})} />
              Required field
            </label>

            {/* Options for dropdown / multi_select */}
            {needsOptions && (
              <div className="form-group">
                <label className="form-label">Options</label>
                <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                  <input
                    className="form-input"
                    placeholder="Add option..."
                    value={newOption}
                    onChange={e => setNewOption(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addOption())}
                  />
                  <button type="button" className="btn btn-secondary" onClick={addOption}>Add</button>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {form.options.map((opt, i) => (
                    <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 10px', background: 'var(--color-bg)', borderRadius: 100, fontSize: 12, border: '1px solid var(--color-border)' }}>
                      {opt.label}
                      <button type="button" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-3)', padding: 0, display: 'flex' }} onClick={() => removeOption(i)}>
                        <X size={11} />
                      </button>
                    </span>
                  ))}
                </div>
                {form.options.length === 0 && <p style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Add at least one option</p>}
              </div>
            )}
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? <Loader size={14} className="animate-spin" /> : <Save size={14} />}
              {isEdit ? 'Update' : 'Create Field'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ─── Section Modal ────────────────────────────────────────────────────────────
const SectionModal = ({ module, onClose, onSave }) => {
  const [form, setForm] = useState({ name: '', description: '', color: '#c75b39' });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await moduleAPI.createSection(module.id, form);
      toast.success('Section created');
      onSave();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: 400 }}>
        <div className="modal-header">
          <h3 className="modal-title">Add Section</h3>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="form-group">
              <label className="form-label">Section Name *</label>
              <input className="form-input" value={form.name} onChange={e => setForm({...form, name: e.target.value})} required placeholder="e.g. Lead, Active, Closed" />
            </div>
            <div className="form-group">
              <label className="form-label">Description</label>
              <input className="form-input" value={form.description} onChange={e => setForm({...form, description: e.target.value})} />
            </div>
            <div className="form-group">
              <label className="form-label">Color</label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input type="color" value={form.color} onChange={e => setForm({...form, color: e.target.value})} style={{ width: 40, height: 36, border: 'none', cursor: 'pointer', borderRadius: 6 }} />
                <input className="form-input" value={form.color} onChange={e => setForm({...form, color: e.target.value})} style={{ fontFamily: 'monospace' }} />
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? <Loader size={14} className="animate-spin" /> : <Save size={14} />} Create
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default FieldBuilder;
