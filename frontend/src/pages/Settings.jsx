import React, { useState, useEffect } from 'react';
import { useAuth } from 'context/AuthContext';
import { moduleAPI, userAPI, departmentAPI, tenantAPI } from 'services/api';
import {
  Layout, Users, Building2, Palette, Plus, Trash2,
  ChevronRight, ToggleLeft, ToggleRight, X, Save, Loader, Hotel,
} from 'lucide-react';
import toast from 'react-hot-toast';
import FieldBuilder from 'components/builder/FieldBuilder';
import './Settings.css';

const TABS = [
  { key: 'modules',     label: 'Modules',     icon: Layout },
  { key: 'users',       label: 'Users',        icon: Users },
  { key: 'departments', label: 'Departments',  icon: Building2 },
  { key: 'hotelinfo',   label: 'Hotel Info',   icon: Hotel },
  { key: 'branding',    label: 'Branding',     icon: Palette },
];

const Settings = () => {
  const { isUserAdmin, isSuperAdmin, tenant } = useAuth();
  const [activeTab, setActiveTab] = useState('modules');
  const [modules, setModules]     = useState([]);
  const [users, setUsers]         = useState([]);
  const [departments, setDeps]    = useState([]);
  const [loading, setLoading]     = useState(false);
  const [selectedModule, setSelectedModule] = useState(null);

  useEffect(() => { loadTab(activeTab); }, [activeTab]);

  const loadTab = async (tab) => {
    setLoading(true);
    try {
      if (tab === 'modules') {
        const res = await moduleAPI.list();
        if (res.success) setModules(res.data);
      } else if (tab === 'users') {
        const res = await userAPI.list({ limit: 100 });
        if (res.success) setUsers(res.data);
      } else if (tab === 'departments') {
        const res = await departmentAPI.list();
        if (res.success) setDeps(res.data);
      }
    } catch {}
    setLoading(false);
  };

  const toggleModule = async (mod) => {
    try {
      await moduleAPI.toggle(mod.id, !mod.is_enabled);
      toast.success(`${mod.display_name || mod.name} ${!mod.is_enabled ? 'enabled' : 'disabled'}`);
      loadTab('modules');
    } catch (err) { toast.error(err.message); }
  };

  if (!isUserAdmin && !isSuperAdmin) {
    return (
      <div className="empty-state" style={{ height: '60vh' }}>
        <h3>Access Denied</h3>
        <p>You need User Admin or higher privileges to access settings.</p>
      </div>
    );
  }

  return (
    <div className="settings-page">
      <div className="settings-sidebar">
        {TABS.map(tab => (
          <button
            key={tab.key}
            className={`settings-tab ${activeTab === tab.key ? 'active' : ''}`}
            onClick={() => { setActiveTab(tab.key); setSelectedModule(null); }}
          >
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
      </div>

      <div className="settings-content">
        {loading ? (
          <div className="page-loader"><div className="spinner" /></div>
        ) : (
          <>
            {activeTab === 'modules' && !selectedModule && (
              <ModulesTab modules={modules} onToggle={toggleModule} onSelectModule={setSelectedModule} />
            )}
            {activeTab === 'modules' && selectedModule && (
              <FieldBuilder module={selectedModule} onBack={() => setSelectedModule(null)} />
            )}
            {activeTab === 'users' && (
              <UsersTab users={users} onRefresh={() => loadTab('users')} />
            )}
            {activeTab === 'departments' && (
              <DepartmentsTab departments={departments} onRefresh={() => loadTab('departments')} />
            )}
            {activeTab === 'hotelinfo' && (
              <HotelInfoTab />
            )}
            {activeTab === 'branding' && (
              <BrandingTab tenant={tenant} />
            )}
          </>
        )}
      </div>
    </div>
  );
};

// ─── Modules Tab ──────────────────────────────────────────────────────────────
const ModulesTab = ({ modules, onToggle, onSelectModule }) => (
  <div>
    <div className="settings-section-header">
      <h3>Module Configuration</h3>
      <p>Enable or disable modules and configure their fields and sections.</p>
    </div>
    <div className="module-cards">
      {modules.map(mod => (
        <div key={mod.id} className={`module-card ${!mod.is_enabled ? 'module-card--disabled' : ''}`}>
          <div className="module-card-info">
            <span className="module-card-name">{mod.display_name || mod.name}</span>
            <span className="module-card-category">{mod.category}</span>
          </div>
          <div className="module-card-actions">
            {mod.is_enabled && (
              <button className="btn btn-secondary btn-sm" onClick={() => onSelectModule(mod)}>
                <ChevronRight size={14} /> Configure
              </button>
            )}
            {!mod.is_core && (
              <button
                className={`toggle-btn ${mod.is_enabled ? 'toggle-btn--on' : ''}`}
                onClick={() => onToggle(mod)}
                title={mod.is_enabled ? 'Disable' : 'Enable'}
              >
                {mod.is_enabled ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
              </button>
            )}
            {mod.is_core && <span className="badge badge-info">Core</span>}
          </div>
        </div>
      ))}
    </div>
  </div>
);

// ─── Hotel Info Tab ───────────────────────────────────────────────────────────
const HotelInfoTab = () => {
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    name: '',
    address: '',
    phone: '',
    website: '',
    gstNumber: '',
    invoicePrefix: 'INV',
    logoUrl: '',
    primaryColor: '#0b1628',
    secondaryColor: '#c75b39',
  });

  useEffect(() => {
    tenantAPI.getMyInfo().then(res => {
      if (res.success && res.data) {
        const d = res.data;
        setForm({
          name: d.name || '',
          address: d.address || '',
          phone: d.phone || '',
          website: d.website || '',
          gstNumber: d.gst_number || '',
          invoicePrefix: d.invoice_prefix || 'INV',
          logoUrl: d.logo_url || '',
          primaryColor: d.primary_color || '#0b1628',
          secondaryColor: d.secondary_color || '#c75b39',
        });
      }
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await tenantAPI.updateMyInfo({
        address: form.address,
        gstNumber: form.gstNumber,
        phone: form.phone,
        website: form.website,
        invoicePrefix: form.invoicePrefix,
        logoUrl: form.logoUrl,
      });
      if (res.success) toast.success('Hotel info saved');
    } catch (err) {
      toast.error(err.message);
    }
    setSaving(false);
  };

  if (loading) return <div className="page-loader"><div className="spinner" /></div>;

  return (
    <div>
      <div className="settings-section-header">
        <div>
          <h3>Hotel / Business Information</h3>
          <p>This information appears on printed invoices and bills.</p>
        </div>
      </div>

      <div className="card" style={{ maxWidth: 560 }}>
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          <div className="form-group">
            <label className="form-label">Hotel / Business Name</label>
            <input className="form-input" value={form.name} disabled
              style={{ background: 'var(--color-surface-2)', color: 'var(--color-text-3)' }} />
            <span className="form-hint">Name is set by platform admin. Contact support to change.</span>
          </div>

          <div className="form-group">
            <label className="form-label">Address</label>
            <textarea className="form-textarea" rows={3} value={form.address}
              onChange={e => setForm({ ...form, address: e.target.value })}
              placeholder="Full address including city, state, pincode" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label className="form-label">Phone Number</label>
              <input className="form-input" value={form.phone}
                onChange={e => setForm({ ...form, phone: e.target.value })}
                placeholder="+91 XXXXX XXXXX" />
            </div>
            <div className="form-group">
              <label className="form-label">Website</label>
              <input className="form-input" value={form.website}
                onChange={e => setForm({ ...form, website: e.target.value })}
                placeholder="www.yourhotel.com" />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label className="form-label">GST Number</label>
              <input className="form-input" value={form.gstNumber}
                onChange={e => setForm({ ...form, gstNumber: e.target.value.toUpperCase() })}
                placeholder="22AAAAA0000A1Z5"
                style={{ fontFamily: 'monospace' }} />
            </div>
            <div className="form-group">
              <label className="form-label">Invoice Prefix</label>
              <input className="form-input" value={form.invoicePrefix}
                onChange={e => setForm({ ...form, invoicePrefix: e.target.value.toUpperCase() })}
                placeholder="INV"
                style={{ fontFamily: 'monospace' }}
                maxLength={10} />
              <span className="form-hint">Bills will be numbered: {form.invoicePrefix || 'INV'}-00001</span>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Logo URL</label>
            <input className="form-input" value={form.logoUrl}
              onChange={e => setForm({ ...form, logoUrl: e.target.value })}
              placeholder="https://yourdomain.com/logo.png" />
            {form.logoUrl && (
              <div style={{ marginTop: 8 }}>
                <img src={form.logoUrl} alt="Logo preview"
                  style={{ height: 48, objectFit: 'contain', border: '1px solid var(--color-border)', borderRadius: 6, padding: 4 }}
                  onError={e => e.target.style.display = 'none'} />
              </div>
            )}
          </div>

          <div style={{ padding: '12px 16px', background: 'var(--color-surface-2)', borderRadius: 'var(--radius-md)', fontSize: 12, color: 'var(--color-text-3)' }}>
            <strong>Preview on invoice:</strong><br />
            {form.name} · {form.phone} · {form.gstNumber && `GST: ${form.gstNumber}`}
            {form.address && <><br />{form.address}</>}
          </div>

          <button type="submit" className="btn btn-primary" disabled={saving} style={{ alignSelf: 'flex-start' }}>
            {saving ? <Loader size={14} className="animate-spin" /> : <Save size={14} />}
            {saving ? 'Saving...' : 'Save Hotel Info'}
          </button>
        </form>
      </div>
    </div>
  );
};

// ─── Users Tab ────────────────────────────────────────────────────────────────
const UsersTab = ({ users, onRefresh }) => {
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ email: '', password: '', firstName: '', lastName: '', role: 'user' });
  const [saving, setSaving] = useState(false);

  const handleCreate = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await userAPI.create(form);
      toast.success('User created');
      setShowModal(false);
      setForm({ email: '', password: '', firstName: '', lastName: '', role: 'user' });
      onRefresh();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this user?')) return;
    try {
      await userAPI.delete(id);
      toast.success('User deleted');
      onRefresh();
    } catch (err) { toast.error(err.message); }
  };

  return (
    <div>
      <div className="settings-section-header">
        <div>
          <h3>Users</h3>
          <p>Manage company users and their roles.</p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setShowModal(true)}>
          <Plus size={14} /> Add User
        </button>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="table">
          <thead>
            <tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Last Login</th><th></th></tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id}>
                <td><strong>{u.first_name} {u.last_name}</strong></td>
                <td style={{ color: 'var(--color-text-3)', fontSize: 12 }}>{u.email}</td>
                <td><span className="badge badge-default">{u.role?.replace('_', ' ')}</span></td>
                <td><span className={`badge ${u.is_active ? 'badge-success' : 'badge-error'}`}>{u.is_active ? 'Active' : 'Inactive'}</span></td>
                <td style={{ fontSize: 11, color: 'var(--color-text-3)' }}>
                  {u.last_login_at ? new Date(u.last_login_at).toLocaleDateString() : 'Never'}
                </td>
                <td>
                  <button className="btn btn-ghost btn-sm btn-icon" onClick={() => handleDelete(u.id)}>
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3 className="modal-title">Add User</h3>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowModal(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleCreate}>
              <div className="modal-body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div className="form-group">
                  <label className="form-label">First Name</label>
                  <input className="form-input" value={form.firstName} onChange={e => setForm({...form, firstName: e.target.value})} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Last Name</label>
                  <input className="form-input" value={form.lastName} onChange={e => setForm({...form, lastName: e.target.value})} />
                </div>
                <div className="form-group" style={{ gridColumn: '1/-1' }}>
                  <label className="form-label">Email</label>
                  <input type="email" className="form-input" value={form.email} onChange={e => setForm({...form, email: e.target.value})} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Password</label>
                  <input type="password" className="form-input" value={form.password} onChange={e => setForm({...form, password: e.target.value})} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Role</label>
                  <select className="form-select" value={form.role} onChange={e => setForm({...form, role: e.target.value})}>
                    <option value="user">User</option>
                    <option value="user_admin">User Admin</option>
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? <Loader size={14} className="animate-spin" /> : <Save size={14} />} Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Departments Tab ──────────────────────────────────────────────────────────
const DepartmentsTab = ({ departments, onRefresh }) => {
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', description: '' });
  const [saving, setSaving] = useState(false);

  const handleCreate = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await departmentAPI.create(form);
      toast.success('Department created');
      setShowModal(false);
      setForm({ name: '', description: '' });
      onRefresh();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="settings-section-header">
        <div>
          <h3>Departments</h3>
          <p>Organize your company structure.</p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setShowModal(true)}>
          <Plus size={14} /> Add Department
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
        {departments.map(d => (
          <div key={d.id} className="card" style={{ padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <strong style={{ fontSize: 14 }}>{d.name}</strong>
              <span className="badge badge-default">{d.member_count} members</span>
            </div>
            {d.description && <p style={{ fontSize: 12, color: 'var(--color-text-3)' }}>{d.description}</p>}
          </div>
        ))}
        {departments.length === 0 && (
          <div className="empty-state" style={{ gridColumn: '1/-1' }}><p>No departments yet</p></div>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 400 }}>
            <div className="modal-header">
              <h3 className="modal-title">Add Department</h3>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowModal(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleCreate}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="form-group">
                  <label className="form-label">Name *</label>
                  <input className="form-input" value={form.name} onChange={e => setForm({...form, name: e.target.value})} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Description</label>
                  <textarea className="form-textarea" value={form.description} onChange={e => setForm({...form, description: e.target.value})} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? <Loader size={14} className="animate-spin" /> : <Save size={14} />} Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Branding Tab ─────────────────────────────────────────────────────────────
const BrandingTab = ({ tenant }) => {
  const [form, setForm] = useState({
    primaryColor: tenant?.primaryColor || '#0b1628',
    secondaryColor: tenant?.secondaryColor || '#c75b39',
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      document.documentElement.style.setProperty('--color-primary', form.primaryColor);
      document.documentElement.style.setProperty('--color-secondary', form.secondaryColor);
      await tenantAPI.updateMyInfo({ primaryColor: form.primaryColor, secondaryColor: form.secondaryColor });
      toast.success('Branding updated');
    } catch {}
    setSaving(false);
  };

  return (
    <div>
      <div className="settings-section-header">
        <div>
          <h3>Company Branding</h3>
          <p>Customize how your ERP looks for your team.</p>
        </div>
      </div>
      <div className="card" style={{ maxWidth: 480 }}>
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label className="form-label">Primary Color</label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input type="color" value={form.primaryColor} onChange={e => setForm({...form, primaryColor: e.target.value})} style={{ width: 40, height: 36, border: 'none', cursor: 'pointer', borderRadius: 6 }} />
                <input className="form-input" value={form.primaryColor} onChange={e => setForm({...form, primaryColor: e.target.value})} style={{ fontFamily: 'monospace' }} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Accent Color</label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input type="color" value={form.secondaryColor} onChange={e => setForm({...form, secondaryColor: e.target.value})} style={{ width: 40, height: 36, border: 'none', cursor: 'pointer', borderRadius: 6 }} />
                <input className="form-input" value={form.secondaryColor} onChange={e => setForm({...form, secondaryColor: e.target.value})} style={{ fontFamily: 'monospace' }} />
              </div>
            </div>
          </div>
          <button type="submit" className="btn btn-primary" disabled={saving} style={{ alignSelf: 'flex-start' }}>
            {saving ? <Loader size={14} className="animate-spin" /> : <Save size={14} />} Save Branding
          </button>
        </form>
      </div>
    </div>
  );
};

export default Settings;
