import React, { useState, useEffect } from 'react';
import { Plus, Settings, X, Save, Loader, Trash2, Key, Eye, EyeOff } from 'lucide-react';
import { userAPI, moduleAPI, tenantAPI } from 'services/api';
import { useAuth } from 'context/AuthContext';
import toast from 'react-hot-toast';

const SettingsPage = () => {
  const { user: me } = useAuth();
  const [tab, setTab] = useState('users');

  const TABS = [
    { key: 'users',     label: 'Users' },
    { key: 'hotelinfo', label: 'Hotel Info' },
    { key: 'profile',   label: 'My Profile' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h2 style={{ fontSize: 20 }}>Settings</h2>
        <p style={{ fontSize: 12, color: 'var(--color-text-3)', marginTop: 2 }}>Manage users and their module access</p>
      </div>

      <div style={{ display: 'flex', gap: 4, background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: 4, width: 'fit-content' }}>
        {TABS.map(t => (
          <button key={t.key} className={`btn btn-sm ${tab === t.key ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'users'     && <UsersTab currentUser={me} />}
      {tab === 'hotelinfo' && <HotelInfoTab />}
      {tab === 'profile'   && <ProfileTab />}
    </div>
  );
};

// ── Hotel Info Tab ────────────────────────────────────────────────────────────
const HotelInfoTab = () => {
  const [saving, setSaving]   = useState(false);
  const [loading, setLoading] = useState(true);
  const [users, setUsers]     = useState([]);
  const [hotelName, setHotelName] = useState('');
  const [form, setForm] = useState({
    address: '', phone: '', website: '',
    gstNumber: '', invoicePrefix: 'INV', logoUrl: '',
    defaultHousekeepingUserId: '',
    gstStay: 12, gstFood: 5, gstTransport: 5,
  });

  useEffect(() => {
    Promise.all([tenantAPI.getMyInfo(), userAPI.list({ limit: 100 })]).then(([tenantRes, usersRes]) => {
      if (tenantRes.success && tenantRes.data) {
        const d = tenantRes.data;
        const ss = d.staff_settings || {};
        const gr = d.gst_rates || {};
        setHotelName(d.name || '');
        setForm({
          address:                   d.address        || '',
          phone:                     d.phone          || '',
          website:                   d.website        || '',
          gstNumber:                 d.gst_number     || '',
          invoicePrefix:             d.invoice_prefix || 'INV',
          logoUrl:                   d.logo_url       || '',
          defaultHousekeepingUserId: ss.default_housekeeping_user_id || '',
          gstStay:      gr.stay      ?? 12,
          gstFood:      gr.food      ?? 5,
          gstTransport: gr.transport ?? 5,
        });
      }
      if (usersRes.success) setUsers(usersRes.data);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const staffSettings = { default_housekeeping_user_id: form.defaultHousekeepingUserId || null };
      const gstRates = {
        stay:      parseFloat(form.gstStay)      || 0,
        food:      parseFloat(form.gstFood)      || 0,
        transport: parseFloat(form.gstTransport) || 0,
      };
      const res = await tenantAPI.updateMyInfo({
        address: form.address, gstNumber: form.gstNumber,
        phone: form.phone, website: form.website,
        invoicePrefix: form.invoicePrefix, logoUrl: form.logoUrl,
        staffSettings, gstRates,
      });
      if (res.success) toast.success('Hotel info saved');
    } catch (err) { toast.error(err.message); }
    setSaving(false);
  };

  if (loading) return <div className="page-loader"><div className="spinner" /></div>;

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h3 style={{ fontSize: 15 }}>Hotel / Business Information</h3>
        <p style={{ fontSize: 12, color: 'var(--color-text-3)', marginTop: 2 }}>Appears on invoices and used for auto-assignments.</p>
      </div>

      <div className="card" style={{ maxWidth: 580 }}>
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          <div className="form-group">
            <label className="form-label">Hotel / Business Name</label>
            <input className="form-input" value={hotelName} disabled style={{ background: 'var(--color-surface-2)', color: 'var(--color-text-3)' }} />
            <span className="form-hint">Contact platform admin to change.</span>
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
              <input className="form-input" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="+91 XXXXX XXXXX" />
            </div>
            <div className="form-group">
              <label className="form-label">Website</label>
              <input className="form-input" value={form.website} onChange={e => setForm({ ...form, website: e.target.value })} placeholder="www.yourhotel.com" />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label className="form-label">GST Number</label>
              <input className="form-input" value={form.gstNumber}
                onChange={e => setForm({ ...form, gstNumber: e.target.value.toUpperCase() })}
                placeholder="22AAAAA0000A1Z5" style={{ fontFamily: 'monospace' }} />
            </div>
            <div className="form-group">
              <label className="form-label">Invoice Prefix</label>
              <input className="form-input" value={form.invoicePrefix}
                onChange={e => setForm({ ...form, invoicePrefix: e.target.value.toUpperCase() })}
                placeholder="INV" maxLength={10} style={{ fontFamily: 'monospace' }} />
              <span className="form-hint">Bills: {form.invoicePrefix || 'INV'}-00001</span>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Logo URL</label>
            <input className="form-input" value={form.logoUrl} onChange={e => setForm({ ...form, logoUrl: e.target.value })} placeholder="https://yourdomain.com/logo.png" />
            {form.logoUrl && (
              <div style={{ marginTop: 8 }}>
                <img src={form.logoUrl} alt="Logo preview"
                  style={{ height: 48, objectFit: 'contain', border: '1px solid var(--color-border)', borderRadius: 6, padding: 4 }}
                  onError={e => e.target.style.display = 'none'} />
              </div>
            )}
          </div>

          {/* GST Rates */}
          <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 16 }}>
            <h4 style={{ fontSize: 13, marginBottom: 4, color: 'var(--color-text-2)' }}>🧾 GST Rates</h4>
            <p style={{ fontSize: 11, color: 'var(--color-text-3)', marginBottom: 12 }}>Auto-fills on billing when bill type is selected.</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Stay / Room GST %</label>
                <input type="number" className="form-input" value={form.gstStay}
                  onChange={e => setForm({ ...form, gstStay: e.target.value })} placeholder="12" min={0} max={100} />
              </div>
              <div className="form-group">
                <label className="form-label">Food & Beverage GST %</label>
                <input type="number" className="form-input" value={form.gstFood}
                  onChange={e => setForm({ ...form, gstFood: e.target.value })} placeholder="5" min={0} max={100} />
              </div>
              <div className="form-group">
                <label className="form-label">Transport GST %</label>
                <input type="number" className="form-input" value={form.gstTransport}
                  onChange={e => setForm({ ...form, gstTransport: e.target.value })} placeholder="5" min={0} max={100} />
              </div>
            </div>
          </div>

          {/* Housekeeping Staff */}
          <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 16 }}>
            <h4 style={{ fontSize: 13, marginBottom: 4, color: 'var(--color-text-2)' }}>🧹 Housekeeping Assignment</h4>
            <p style={{ fontSize: 11, color: 'var(--color-text-3)', marginBottom: 12 }}>Auto-assigned when guest checks out.</p>
            <div className="form-group">
              <label className="form-label">Default Housekeeping Staff</label>
              <select className="form-select" value={form.defaultHousekeepingUserId}
                onChange={e => setForm({ ...form, defaultHousekeepingUserId: e.target.value })}>
                <option value="">None (assign manually)</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>{u.first_name} {u.last_name} ({u.role.replace('_',' ')})</option>
                ))}
              </select>
            </div>
          </div>
        {/* Webhook URL */}
          <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 16 }}>
            <h4 style={{ fontSize: 13, marginBottom: 4, color: 'var(--color-text-2)' }}>🔗 Third Party Booking Webhook</h4>
            <p style={{ fontSize: 11, color: 'var(--color-text-3)', marginBottom: 8 }}>Share this URL with your web developer or OTA to auto-create bookings.</p>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input className="form-input" readOnly
                value={`https://backend-production-4750.up.railway.app/api/webhook/${window.location.hostname.includes('localhost') ? 'your-hotel-slug' : ''}`}
                style={{ fontFamily: 'monospace', fontSize: 11, background: 'var(--color-surface-2)' }} />
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => {
                navigator.clipboard.writeText(`https://backend-production-4750.up.railway.app/api/webhook/YOUR-HOTEL-SLUG/booking`);
                toast.success('URL copied!');
              }}>Copy</button>
            </div>
            <p style={{ fontSize: 10, color: 'var(--color-text-muted)', marginTop: 4 }}>Replace YOUR-HOTEL-SLUG with your company slug. Test with GET /ping</p>
          </div>
          {/* Preview */}
          <div style={{ padding: '12px 16px', background: 'var(--color-surface-2)', borderRadius: 'var(--radius-md)', fontSize: 12, color: 'var(--color-text-3)', lineHeight: 1.8 }}>
            <strong style={{ color: 'var(--color-text-2)' }}>Invoice preview:</strong><br />
            <strong>{hotelName}</strong>{form.phone ? ` · ${form.phone}` : ''}{form.gstNumber ? ` · GST: ${form.gstNumber}` : ''}<br />
            {form.address && <span>{form.address}</span>}
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

// ── Users Tab ─────────────────────────────────────────────────────────────────
const UsersTab = ({ currentUser }) => {
  const [users, setUsers]           = useState([]);
  const [modules, setModules]       = useState([]);
  const [loading, setLoading]       = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [accessUser, setAccessUser] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const [ur, mr] = await Promise.all([userAPI.list(), moduleAPI.list()]);
      if (ur.success) setUsers(ur.data);
      if (mr.success) setModules(mr.data.filter(m => m.slug !== 'dashboard'));
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async (id, email) => {
    if (!window.confirm(`Delete user "${email}"?`)) return;
    try { await userAPI.delete(id); toast.success('User deleted'); load(); }
    catch (err) { toast.error(err.message); }
  };

  const handleToggle = async (id, isActive) => {
    try { await userAPI.update(id, { isActive: !isActive }); toast.success(isActive ? 'Deactivated' : 'Activated'); load(); }
    catch (err) { toast.error(err.message); }
  };

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 13, color: 'var(--color-text-3)' }}>{users.length} users in this company</span>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}><Plus size={14} /> Add User</button>
      </div>

      {loading ? <div className="page-loader"><div className="spinner" /></div> : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="table">
            <thead><tr><th>User</th><th>Email</th><th>Role</th><th>Status</th><th>Last Login</th><th>Actions</th></tr></thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                      <div style={{ width: 30, height: 30, borderRadius: 8, background: u.role === 'user_admin' ? 'var(--color-primary)' : 'var(--color-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 11, fontWeight: 700 }}>
                        {u.first_name?.charAt(0)}{u.last_name?.charAt(0)}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{u.first_name} {u.last_name}</div>
                        {u.id === currentUser?.id && <div style={{ fontSize: 10, color: 'var(--color-secondary)' }}>you</div>}
                      </div>
                    </div>
                  </td>
                  <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{u.email}</td>
                  <td><span className={`badge ${u.role === 'user_admin' ? 'badge-warning' : 'badge-default'}`}>{u.role.replace(/_/g,' ')}</span></td>
                  <td>
                    <button className={`badge ${u.is_active ? 'badge-success' : 'badge-default'}`}
                      style={{ border: 'none', cursor: u.id !== currentUser?.id ? 'pointer' : 'default' }}
                      onClick={() => u.id !== currentUser?.id && handleToggle(u.id, u.is_active)}>
                      {u.is_active ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td style={{ fontSize: 11, color: 'var(--color-text-3)' }}>
                    {u.last_login_at ? new Date(u.last_login_at).toLocaleString() : 'Never'}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button className="btn btn-secondary btn-sm" onClick={() => setAccessUser(u)}><Settings size={12} /> Modules</button>
                      {u.id !== currentUser?.id && (
                        <button className="btn btn-ghost btn-sm btn-icon" onClick={() => handleDelete(u.id, u.email)}><Trash2 size={13} /></button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {!users.length && <tr><td colSpan={6}><div className="empty-state" style={{ height: 80 }}><p>No users yet</p></div></td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && <CreateUserModal onClose={() => setShowCreate(false)} onSave={() => { setShowCreate(false); load(); }} />}
      {accessUser && <ModuleAccessModal user={accessUser} allModules={modules} onClose={() => setAccessUser(null)} onSave={() => { setAccessUser(null); toast.success('Module access updated'); }} />}
    </>
  );
};

// ── Create User Modal ─────────────────────────────────────────────────────────
const CreateUserModal = ({ onClose, onSave }) => {
  const [saving, setSaving] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', password: '', role: 'user' });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const r = await userAPI.create(form);
      if (r.success) { toast.success('User created'); onSave(); }
    } catch (err) { toast.error(err.message); }
    setSaving(false);
  };

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header">
          <h3 className="modal-title">Add User</h3>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={17} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 13 }}>
            <div className="form-group"><label className="form-label">First Name</label><input className="form-input" value={form.firstName} onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))} /></div>
            <div className="form-group"><label className="form-label">Last Name</label><input className="form-input" value={form.lastName} onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))} /></div>
            <div className="form-group" style={{ gridColumn: '1/-1' }}>
              <label className="form-label">Email *</label>
              <input type="email" className="form-input" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required />
            </div>
            <div className="form-group" style={{ gridColumn: '1/-1' }}>
              <label className="form-label">Password *</label>
              <div className="input-icon-wrap">
                <input type={showPass ? 'text' : 'password'} className="form-input" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} required minLength={8} />
                <button type="button" className="input-icon-btn" onClick={() => setShowPass(!showPass)}>
                  {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>
            <div className="form-group" style={{ gridColumn: '1/-1' }}>
              <label className="form-label">Role</label>
              <select className="form-select" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                <option value="user">User</option>
                <option value="user_admin">User Admin</option>
              </select>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? <Loader size={14} className="animate-spin" /> : <Save size={14} />} {saving ? 'Creating...' : 'Create User'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ── Module Access Modal ───────────────────────────────────────────────────────
const ModuleAccessModal = ({ user, allModules, onClose, onSave }) => {
  const [access, setAccess]         = useState([]);
  const [saving, setSaving]         = useState(false);
  const [loadingAcc, setLoadingAcc] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const r = await userAPI.getModuleAccess(user.id);
        if (r.success) {
          const existing = r.data.reduce((acc, m) => ({ ...acc, [m.module_id]: m.is_visible }), {});
          setAccess(allModules.map(m => ({ moduleId: m.id, name: m.name, isVisible: existing[m.id] !== false })));
        }
      } catch {}
      setLoadingAcc(false);
    };
    if (allModules.length) { setAccess(allModules.map(m => ({ moduleId: m.id, name: m.name, isVisible: true }))); load(); }
    else setLoadingAcc(false);
  }, [user.id, allModules]);

  const toggle = (moduleId) => setAccess(prev => prev.map(a => a.moduleId === moduleId ? { ...a, isVisible: !a.isVisible } : a));

  const handleSave = async () => {
    setSaving(true);
    try {
      await userAPI.setModuleAccess(user.id, access.map(a => ({ moduleId: a.moduleId, isVisible: a.isVisible })));
      onSave();
    } catch (err) { toast.error(err.message); }
    setSaving(false);
  };

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header">
          <div>
            <h3 className="modal-title">Module Access</h3>
            <p style={{ fontSize: 11, color: 'var(--color-text-3)', marginTop: 2 }}>{user.first_name} {user.last_name} · {user.email}</p>
          </div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={17} /></button>
        </div>
        <div className="modal-body">
          {loadingAcc ? <div className="page-loader"><div className="spinner" /></div> : (
            <>
              <p style={{ fontSize: 13, color: 'var(--color-text-2)', marginBottom: 14 }}>Toggle which modules this user can see.</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {access.map(a => (
                  <label key={a.moduleId} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', border: `1.5px solid ${a.isVisible ? 'var(--color-secondary)' : 'var(--color-border)'}`, borderRadius: 'var(--radius-md)', cursor: 'pointer', background: a.isVisible ? '#fff7ed' : 'var(--color-surface)', transition: 'var(--transition)' }}>
                    <input type="checkbox" checked={a.isVisible} onChange={() => toggle(a.moduleId)} />
                    <span style={{ fontSize: 13, fontWeight: 500 }}>{a.name}</span>
                    <span style={{ marginLeft: 'auto', fontSize: 11, color: a.isVisible ? 'var(--color-secondary)' : 'var(--color-text-muted)' }}>{a.isVisible ? 'Visible' : 'Hidden'}</span>
                  </label>
                ))}
              </div>
            </>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? <Loader size={14} className="animate-spin" /> : <Save size={14} />} {saving ? 'Saving...' : 'Save Access'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Profile Tab ───────────────────────────────────────────────────────────────
const ProfileTab = () => {
  const { user } = useAuth();
  const [saving, setSaving]       = useState(false);
  const [changingPw, setChangingPw] = useState(false);
  const [form, setForm]   = useState({ firstName: user?.firstName || '', lastName: user?.lastName || '', phone: '' });
  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });

  const saveProfile = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { authAPI: aapi } = await import('services/api');
      await aapi.updateProfile(form);
      toast.success('Profile updated');
    } catch (err) { toast.error(err.message); }
    setSaving(false);
  };

  const changePassword = async (e) => {
    e.preventDefault();
    if (pwForm.newPassword !== pwForm.confirmPassword) { toast.error('Passwords do not match'); return; }
    setChangingPw(true);
    try {
      const { authAPI: aapi } = await import('services/api');
      await aapi.changePassword(pwForm.currentPassword, pwForm.newPassword);
      toast.success('Password changed');
      setPwForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) { toast.error(err.message); }
    setChangingPw(false);
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
      <div className="card">
        <h3 style={{ fontSize: 14, marginBottom: 16 }}>Profile Information</h3>
        <form onSubmit={saveProfile} style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
          <div className="form-group"><label className="form-label">First Name</label><input className="form-input" value={form.firstName} onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))} /></div>
          <div className="form-group"><label className="form-label">Last Name</label><input className="form-input" value={form.lastName} onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))} /></div>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input className="form-input" value={user?.email} disabled style={{ background: 'var(--color-surface-2)', color: 'var(--color-text-3)' }} />
            <span className="form-hint">Email cannot be changed</span>
          </div>
          <div className="form-group"><label className="form-label">Phone</label><input type="tel" className="form-input" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+91 XXXXX XXXXX" /></div>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? <Loader size={14} className="animate-spin" /> : <Save size={14} />} {saving ? 'Saving...' : 'Save Profile'}
          </button>
        </form>
      </div>

      <div className="card">
        <h3 style={{ fontSize: 14, marginBottom: 16 }}>Change Password</h3>
        <form onSubmit={changePassword} style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
          {['currentPassword','newPassword','confirmPassword'].map((key, i) => (
            <div key={key} className="form-group">
              <label className="form-label">{['Current Password','New Password','Confirm New Password'][i]}</label>
              <input type="password" className="form-input" value={pwForm[key]} onChange={e => setPwForm(f => ({ ...f, [key]: e.target.value }))} required minLength={key !== 'currentPassword' ? 8 : 1} />
            </div>
          ))}
          <button type="submit" className="btn btn-primary" disabled={changingPw}>
            {changingPw ? <Loader size={14} className="animate-spin" /> : <Key size={14} />} {changingPw ? 'Changing...' : 'Change Password'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default SettingsPage;
