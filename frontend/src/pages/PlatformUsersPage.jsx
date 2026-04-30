import React, { useState, useEffect } from 'react';
import { Plus, Trash2, X, Save, Loader, Shield, UserCog } from 'lucide-react';
import { authAPI } from 'services/api';
import api from 'services/api';
import toast from 'react-hot-toast';

const PlatformUsersPage = () => {
  const [users, setUsers]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [showModal, setShowModal] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get('/users/platform');
      if (r.success) setUsers(r.data);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async (id, email) => {
    if (!window.confirm(`Delete platform user "${email}"?`)) return;
    try {
      await api.delete(`/users/platform/${id}`);
      toast.success('User deleted');
      load();
    } catch (err) { toast.error(err.message); }
  };

  const handleToggle = async (id, isActive) => {
    try {
      await api.put(`/users/platform/${id}`, { isActive: !isActive });
      toast.success(isActive ? 'User deactivated' : 'User activated');
      load();
    } catch (err) { toast.error(err.message); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: 20 }}>Platform Users</h2>
          <p style={{ fontSize: 12, color: 'var(--color-text-3)', marginTop: 2 }}>
            Manage Super Admin and Client Servicing accounts
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          <Plus size={14} /> New Platform User
        </button>
      </div>

      {loading ? <div className="page-loader"><div className="spinner" /></div> : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {!users.length ? (
            <div className="empty-state" style={{ padding: 60 }}>
              <UserCog size={40} />
              <h3>No platform users yet</h3>
              <p>Add Client Servicing users who can onboard companies</p>
            </div>
          ) : (
            <table className="table">
              <thead>
                <tr><th>User</th><th>Email</th><th>Role</th><th>Status</th><th>Last Login</th><th>Created</th><th></th></tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 30, height: 30, borderRadius: 8, background: u.role === 'super_admin' ? 'var(--color-primary)' : 'var(--color-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 11, fontWeight: 700 }}>
                          {u.first_name?.charAt(0)}{u.last_name?.charAt(0)}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{u.first_name} {u.last_name}</div>
                          {u.phone && <div style={{ fontSize: 11, color: 'var(--color-text-3)' }}>{u.phone}</div>}
                        </div>
                      </div>
                    </td>
                    <td style={{ fontSize: 12, fontFamily: 'monospace' }}>{u.email}</td>
                    <td>
                      <span className={`badge ${u.role === 'super_admin' ? 'badge-error' : 'badge-info'}`}>
                        {u.role === 'super_admin' ? '⚡ Super Admin' : '👤 Client Servicing'}
                      </span>
                    </td>
                    <td>
                      <button className={`badge ${u.is_active ? 'badge-success' : 'badge-default'}`}
                        style={{ border: 'none', cursor: 'pointer' }}
                        onClick={() => handleToggle(u.id, u.is_active)}>
                        {u.is_active ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                    <td style={{ fontSize: 11, color: 'var(--color-text-3)' }}>
                      {u.last_login_at ? new Date(u.last_login_at).toLocaleString() : 'Never'}
                    </td>
                    <td style={{ fontSize: 11, color: 'var(--color-text-3)' }}>
                      {new Date(u.created_at).toLocaleDateString()}
                    </td>
                    <td>
                      {u.role !== 'super_admin' && (
                        <button className="btn btn-ghost btn-sm btn-icon" onClick={() => handleDelete(u.id, u.email)}>
                          <Trash2 size={13} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {showModal && (
        <CreatePlatformUserModal
          onClose={() => setShowModal(false)}
          onSave={() => { setShowModal(false); load(); }}
        />
      )}
    </div>
  );
};

const CreatePlatformUserModal = ({ onClose, onSave }) => {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    firstName: '', lastName: '', email: '', password: '',
    role: 'client_servicing', phone: '',
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const r = await api.post('/users/platform', form);
      if (r.success) { toast.success('Platform user created'); onSave(); }
    } catch (err) { toast.error(err.message); }
    setSaving(false);
  };

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header">
          <h3 className="modal-title">New Platform User</h3>
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
              <input type="email" className="form-input" value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required />
            </div>
            <div className="form-group" style={{ gridColumn: '1/-1' }}>
              <label className="form-label">Password *</label>
              <input type="password" className="form-input" value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))} required minLength={8} />
            </div>
            <div className="form-group">
              <label className="form-label">Phone</label>
              <input type="tel" className="form-input" value={form.phone}
                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Role *</label>
              <select className="form-select" value={form.role}
                onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                <option value="client_servicing">Client Servicing</option>
                <option value="super_admin">Super Admin</option>
              </select>
            </div>
            <div style={{ gridColumn: '1/-1', padding: '10px 14px', background: 'var(--color-surface-2)', borderRadius: 'var(--radius-md)', fontSize: 12, color: 'var(--color-text-3)', border: '1px solid var(--color-border)' }}>
              <strong>Client Servicing</strong> — Can create and manage client companies, set module access, create user admins.<br />
              <strong>Super Admin</strong> — Full platform access including industry and title head management.
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

export default PlatformUsersPage;
