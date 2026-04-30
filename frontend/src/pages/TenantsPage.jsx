import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Building2, X, Save, Loader } from 'lucide-react';
import { tenantAPI, industryAPI, moduleAPI } from 'services/api';
import toast from 'react-hot-toast';

const TenantsPage = () => {
  const [tenants, setTenants]     = useState([]);
  const [industries, setIndustries] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    Promise.all([
      tenantAPI.list({ limit: 100 }),
      industryAPI.list(),
    ]).then(([tr, ir]) => {
      if (tr.success) setTenants(tr.data);
      if (ir.success) setIndustries(ir.data);
    }).finally(() => setLoading(false));
  }, []);

  const reload = async () => {
    const r = await tenantAPI.list({ limit: 100 });
    if (r.success) setTenants(r.data);
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Delete "${name}"? All company data will be permanently removed.`)) return;
    try { await tenantAPI.delete(id); toast.success('Deleted'); reload(); }
    catch (err) { toast.error(err.message); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: 20 }}>Companies</h2>
          <p style={{ fontSize: 12, color: 'var(--color-text-3)', marginTop: 2 }}>{tenants.length} registered</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          <Plus size={14} /> New Company
        </button>
      </div>

      {loading ? <div className="page-loader"><div className="spinner" /></div> : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {!tenants.length ? (
            <div className="empty-state" style={{ padding: 60 }}>
              <Building2 size={40} />
              <h3>No companies yet</h3>
              <p>Click "New Company" to onboard your first client</p>
            </div>
          ) : (
            <table className="table">
              <thead><tr><th>Company</th><th>Industry</th><th>Modules</th><th>Plan</th><th>Users</th><th>Status</th><th>Created</th><th></th></tr></thead>
              <tbody>
                {tenants.map(t => (
                  <tr key={t.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 30, height: 30, borderRadius: 8, background: t.primary_color||'#0b1628', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: 13, flexShrink: 0 }}>
                          {t.name.charAt(0)}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{t.name}</div>
                          <div style={{ fontSize: 10, color: 'var(--color-text-3)', fontFamily: 'monospace' }}>{t.slug}</div>
                        </div>
                      </div>
                    </td>
                    <td><span className="badge badge-info">{t.industry_name}</span></td>
                    <td style={{ fontSize: 12, color: 'var(--color-text-3)' }}>—</td>
                    <td><span className="badge badge-default">{t.subscription_plan}</span></td>
                    <td>{t.user_count}</td>
                    <td><span className={`badge ${t.is_active ? 'badge-success' : 'badge-error'}`}>{t.is_active ? 'Active' : 'Inactive'}</span></td>
                    <td style={{ fontSize: 11, color: 'var(--color-text-3)' }}>{new Date(t.created_at).toLocaleDateString()}</td>
                    <td>
                      <button className="btn btn-ghost btn-sm btn-icon" onClick={() => handleDelete(t.id, t.name)}><Trash2 size={13} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {showModal && (
        <CreateTenantModal
          industries={industries}
          onClose={() => setShowModal(false)}
          onSave={() => { setShowModal(false); reload(); }}
        />
      )}
    </div>
  );
};

// ── Create Company Modal ──────────────────────────────────────────────────────
const CreateTenantModal = ({ industries, onClose, onSave }) => {
  const [step, setStep]           = useState(1); // 1=company info, 2=select modules
  const [saving, setSaving]       = useState(false);
  const [industryModules, setIndModules] = useState([]);
  const [selectedModules, setSelectedModules] = useState([]);

  const [form, setForm] = useState({
    name: '', slug: '',
    industryId: '',
    adminEmail: '', adminPassword: '',
    adminFirstName: 'Admin', adminLastName: '',
    subscriptionPlan: 'trial',
  });

  const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');

  const handleIndustryChange = async (industryId) => {
    setForm(f => ({ ...f, industryId }));
    if (!industryId) { setIndModules([]); return; }
    try {
      const res = await moduleAPI.byIndustry(industryId);
      if (res.success) {
        setIndModules(res.data.filter(m => m.slug !== 'dashboard'));
        setSelectedModules(res.data.filter(m => m.slug !== 'dashboard').map(m => m.id));
      }
    } catch {}
  };

  const toggleModule = (id) => {
    setSelectedModules(prev =>
      prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.industryId) return toast.error('Select an industry');
    if (!form.adminEmail || !form.adminPassword) return toast.error('Admin credentials required');
    setSaving(true);
    try {
      await tenantAPI.create({ ...form, moduleIds: selectedModules });
      toast.success('Company created!');
      onSave();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: 580 }}>
        <div className="modal-header">
          <h3 className="modal-title">
            {step === 1 ? 'New Company — Step 1: Details' : 'New Company — Step 2: Module Access'}
          </h3>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={17} /></button>
        </div>

        <form onSubmit={step === 2 ? handleSubmit : (e) => { e.preventDefault(); setStep(2); }}>
          {step === 1 && (
            <div className="modal-body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div className="form-group">
                <label className="form-label">Company Name *</label>
                <input className="form-input" value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value, slug: slugify(e.target.value) }))}
                  placeholder="Acme Manufacturing" required />
              </div>
              <div className="form-group">
                <label className="form-label">Company Slug *</label>
                <input className="form-input" value={form.slug} onChange={e => setForm(f => ({ ...f, slug: e.target.value }))}
                  style={{ fontFamily: 'monospace', fontSize: 12 }} required />
                <span className="form-hint">Used for login: company-slug</span>
              </div>
              <div className="form-group" style={{ gridColumn: '1/-1' }}>
                <label className="form-label">Industry *</label>
                <select className="form-select" value={form.industryId} onChange={e => handleIndustryChange(e.target.value)} required>
                  <option value="">Select industry...</option>
                  {industries.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Plan</label>
                <select className="form-select" value={form.subscriptionPlan} onChange={e => setForm(f => ({ ...f, subscriptionPlan: e.target.value }))}>
                  <option value="trial">Trial</option>
                  <option value="starter">Starter</option>
                  <option value="professional">Professional</option>
                  <option value="enterprise">Enterprise</option>
                </select>
              </div>
              <div />
              <div className="form-group">
                <label className="form-label">Admin First Name</label>
                <input className="form-input" value={form.adminFirstName} onChange={e => setForm(f => ({ ...f, adminFirstName: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Admin Last Name</label>
                <input className="form-input" value={form.adminLastName} onChange={e => setForm(f => ({ ...f, adminLastName: e.target.value }))} />
              </div>
              <div className="form-group" style={{ gridColumn: '1/-1' }}>
                <label className="form-label">Admin Email *</label>
                <input type="email" className="form-input" value={form.adminEmail}
                  onChange={e => setForm(f => ({ ...f, adminEmail: e.target.value }))}
                  placeholder={`admin@${form.slug || 'company'}.com`} required />
              </div>
              <div className="form-group" style={{ gridColumn: '1/-1' }}>
                <label className="form-label">Admin Password *</label>
                <input type="password" className="form-input" value={form.adminPassword}
                  onChange={e => setForm(f => ({ ...f, adminPassword: e.target.value }))} placeholder="Min 8 characters" required />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="modal-body">
              <p style={{ fontSize: 13, color: 'var(--color-text-2)', marginBottom: 16 }}>
                Select which modules this company can access. Dashboard is always included.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {industryModules.map(m => (
                  <label key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', border: `1.5px solid ${selectedModules.includes(m.id) ? 'var(--color-secondary)' : 'var(--color-border)'}`, borderRadius: 'var(--radius-md)', cursor: 'pointer', background: selectedModules.includes(m.id) ? '#fff7ed' : 'var(--color-surface)', transition: 'var(--transition)' }}>
                    <input type="checkbox" checked={selectedModules.includes(m.id)} onChange={() => toggleModule(m.id)} />
                    <span style={{ fontSize: 13, fontWeight: 500 }}>{m.name}</span>
                  </label>
                ))}
              </div>
              {industryModules.length === 0 && (
                <div className="empty-state"><p>No modules found for this industry</p></div>
              )}
            </div>
          )}

          <div className="modal-footer">
            {step === 2 && <button type="button" className="btn btn-secondary" onClick={() => setStep(1)}>Back</button>}
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? <Loader size={14} className="animate-spin" /> : <Save size={14} />}
              {step === 1 ? 'Next: Modules →' : 'Create Company'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TenantsPage;
