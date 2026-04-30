import React, { useState, useEffect } from 'react';
import { Plus, Settings, UserCog, X, Save, Loader, Trash2, Key, Eye, EyeOff } from 'lucide-react';
import { userAPI, moduleAPI } from 'services/api';
import { useAuth } from 'context/AuthContext';
import toast from 'react-hot-toast';

const SettingsPage = () => {
  const { user: me } = useAuth();
  const [tab, setTab] = useState('users');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h2 style={{ fontSize: 20 }}>Settings</h2>
        <p style={{ fontSize: 12, color: 'var(--color-text-3)', marginTop: 2 }}>
          Manage users and their module access
        </p>
      </div>

      <div style={{ display: 'flex', gap: 4, background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: 4, width: 'fit-content' }}>
        {[{ key: 'users', label: 'Users' }, { key: 'profile', label: 'My Profile' }].map(t => (
          <button key={t.key} className={`btn btn-sm ${tab === t.key ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'users'   && <UsersTab currentUser={me} />}
      {tab === 'profile' && <ProfileTab />}
    </div>
  );
};

// ── Users Tab ─────────────────────────────────────────────────────────────────
const UsersTab = ({ currentUser }) => {
  const [users, setUsers]         = useState([]);
  const [modules, setModules]     = useState([]);
  const [loading, setLoading]     = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [accessUser, setAccessUser] = useState(null); // user whose module access we're editing

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
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
          <Plus size={14} /> Add User
        </button>
      </div>

      {loading ? <div className="page-loader"><div className="spinner" /></div> : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="table">
            <thead>
              <tr><th>User</th><th>Email</th><th>Role</th><th>Status</th><th>Last Login</th><th>Actions</th></tr>
            </thead>
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
                  <td>
                    <span className={`badge ${u.role === 'user_admin' ? 'badge-warning' : 'badge-default'}`}>
                      {u.role.replace(/_/g,' ')}
                    </span>
                  </td>
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
                      <button className="btn btn-secondary btn-sm" onClick={() => setAccessUser(u)} title="Manage module access">
                        <Settings size={12} /> Modules
                      </button>
                      {u.id !== currentUser?.id && (
                        <button className="btn btn-ghost btn-sm btn-icon" onClick={() => handleDelete(u.id, u.email)}>
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {!users.length && (
                <tr><td colSpan={6}><div className="empty-state" style={{ height: 80 }}><p>No users yet</p></div></td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && (
        <CreateUserModal
          onClose={() => setShowCreate(false)}
          onSave={() => { setShowCreate(false); load(); }}
        />
      )}

      {accessUser && (
        <ModuleAccessModal
          user={accessUser}
          allModules={modules}
          onClose={() => setAccessUser(null)}
          onSave={() => { setAccessUser(null); toast.success('Module access updated'); }}
        />
      )}
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
            <div className="form-group">
              <label className="form-label">First Name</label>
              <input className="form-input" value={form.firstName} onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Last Name</label>
              <input className="form-input" value={form.lastName} onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))} />
            </div>
            <div className="form-group" style={{ gridColumn: '1/-1' }}>
              <label className="form-label">Email *</label>
              <input type="email" className="form-input" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required />
            </div>
            <div className="form-group" style={{ gridColumn: '1/-1' }}>
              <label className="form-label">Password *</label>
              <div className="input-icon-wrap">
                <input type={showPass ? 'text' : 'password'} className="form-input" value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))} required minLength={8} />
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
              {saving ? <Loader size={14} className="animate-spin" /> : <Save size={14} />}
              {saving ? 'Creating...' : 'Create User'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ── Module Access Modal ───────────────────────────────────────────────────────
const ModuleAccessModal = ({ user, allModules, onClose, onSave }) => {
  const [access, setAccess]   = useState([]);
  const [saving, setSaving]   = useState(false);
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
    // If no access records yet, default all to visible
    if (allModules.length) {
      setAccess(allModules.map(m => ({ moduleId: m.id, name: m.name, isVisible: true })));
      load();
    } else {
      setLoadingAcc(false);
    }
  }, [user.id, allModules]);

  const toggle = (moduleId) => {
    setAccess(prev => prev.map(a => a.moduleId === moduleId ? { ...a, isVisible: !a.isVisible } : a));
  };

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
              <p style={{ fontSize: 13, color: 'var(--color-text-2)', marginBottom: 14 }}>
                Toggle which modules this user can see in their sidebar.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {access.map(a => (
                  <label key={a.moduleId} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', border: `1.5px solid ${a.isVisible ? 'var(--color-secondary)' : 'var(--color-border)'}`, borderRadius: 'var(--radius-md)', cursor: 'pointer', background: a.isVisible ? '#fff7ed' : 'var(--color-surface)', transition: 'var(--transition)' }}>
                    <input type="checkbox" checked={a.isVisible} onChange={() => toggle(a.moduleId)} />
                    <span style={{ fontSize: 13, fontWeight: 500 }}>{a.name}</span>
                    <span style={{ marginLeft: 'auto', fontSize: 11, color: a.isVisible ? 'var(--color-secondary)' : 'var(--color-text-muted)' }}>
                      {a.isVisible ? 'Visible' : 'Hidden'}
                    </span>
                  </label>
                ))}
              </div>
            </>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? <Loader size={14} className="animate-spin" /> : <Save size={14} />}
            {saving ? 'Saving...' : 'Save Access'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Profile Tab ───────────────────────────────────────────────────────────────
const ProfileTab = () => {
  const { user, logout } = useAuth();
  const [saving, setSaving] = useState(false);
  const [changingPw, setChangingPw] = useState(false);
  const [form, setForm] = useState({ firstName: user?.firstName || '', lastName: user?.lastName || '', phone: '' });
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
          <div className="form-group">
            <label className="form-label">First Name</label>
            <input className="form-input" value={form.firstName} onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Last Name</label>
            <input className="form-input" value={form.lastName} onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input className="form-input" value={user?.email} disabled style={{ background: 'var(--color-surface-2)', color: 'var(--color-text-3)' }} />
            <span className="form-hint">Email cannot be changed</span>
          </div>
          <div className="form-group">
            <label className="form-label">Phone</label>
            <input type="tel" className="form-input" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+91 XXXXX XXXXX" />
          </div>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? <Loader size={14} className="animate-spin" /> : <Save size={14} />}
            {saving ? 'Saving...' : 'Save Profile'}
          </button>
        </form>
      </div>

      <div className="card">
        <h3 style={{ fontSize: 14, marginBottom: 16 }}>Change Password</h3>
        <form onSubmit={changePassword} style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
          {['currentPassword','newPassword','confirmPassword'].map((key, i) => (
            <div key={key} className="form-group">
              <label className="form-label">{['Current Password','New Password','Confirm New Password'][i]}</label>
              <input type="password" className="form-input" value={pwForm[key]}
                onChange={e => setPwForm(f => ({ ...f, [key]: e.target.value }))} required minLength={key !== 'currentPassword' ? 8 : 1} />
            </div>
          ))}
          <button type="submit" className="btn btn-primary" disabled={changingPw}>
            {changingPw ? <Loader size={14} className="animate-spin" /> : <Key size={14} />}
            {changingPw ? 'Changing...' : 'Change Password'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default SettingsPage;
