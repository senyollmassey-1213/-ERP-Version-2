import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, LogIn, Loader } from 'lucide-react';
import { useAuth } from 'context/AuthContext';
import { authAPI } from 'services/api';
import toast from 'react-hot-toast';
import 'styles/login.css';

const LoginPage = () => {
  const navigate = useNavigate();
  const { login, isAuthenticated } = useAuth();

  const [email, setEmail]         = useState('');
  const [password, setPassword]   = useState('');
  const [showPass, setShowPass]   = useState(false);
  const [tenantSlug, setSlug]     = useState('');
  const [branding, setBranding]   = useState(null);
  const [loading, setLoading]     = useState(false);

  useEffect(() => { if (isAuthenticated) navigate('/dashboard'); }, [isAuthenticated]);

  const fetchBranding = async (slug) => {
    if (!slug || slug.length < 2) { setBranding(null); return; }
    try {
      const res = await authAPI.resolveTenant(slug);
      if (res.success) setBranding(res.data);
    } catch { setBranding(null); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await login(email, password, tenantSlug || undefined);
      if (res.success) {
        toast.success(`Welcome, ${res.data.user.firstName}!`);
        navigate('/dashboard');
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fillDemo = (e, p, s = '') => { setEmail(e); setPassword(p); setSlug(s); if (s) fetchBranding(s); };

  return (
    <div className="login-page">
      <div className="login-left">
        <div className="login-brand">
          <div className="login-logo"><span>D</span></div>
          <div>
            <h1>Drusshti</h1>
            <p>Enterprise Resource Platform</p>
          </div>
        </div>
        <div className="login-tagline">
          <h2>Industry-Specific.<br/>Workflow-Connected.</h2>
          <p>Manufacturing, Production, and Warehousing — each with their own pre-configured modules, fields, and connected workflows.</p>
        </div>
        <div className="login-industries">
          {['🏭 Manufacturing', '⚙️ Production', '🏪 Warehousing'].map(i => (
            <div key={i} className="industry-chip">{i}</div>
          ))}
        </div>
      </div>

      <div className="login-right">
        <div className="login-card">
          {branding ? (
            <div className="login-tenant-header">
              <div className="tenant-logo-badge" style={{ background: branding.primary_color || '#0b1628' }}>
                {branding.name.charAt(0)}
              </div>
              <div>
                <h3>{branding.name}</h3>
                <span className="badge badge-info" style={{ fontSize: 10 }}>{branding.industry_name}</span>
              </div>
            </div>
          ) : (
            <div className="login-header">
              <h2>Sign In</h2>
              <p>Access your Drusshti ERP</p>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="form-group" style={{ marginBottom: 14 }}>
              <label className="form-label">Company ID <span style={{ color: 'var(--color-text-muted)', textTransform: 'none', fontWeight: 400 }}>(leave blank for platform login)</span></label>
              <input className="form-input" placeholder="company-slug" value={tenantSlug}
                onChange={e => { setSlug(e.target.value); fetchBranding(e.target.value); }} />
            </div>
            <div className="form-group" style={{ marginBottom: 14 }}>
              <label className="form-label">Email</label>
              <input type="email" className="form-input" placeholder="you@company.com"
                value={email} onChange={e => setEmail(e.target.value)} required autoFocus />
            </div>
            <div className="form-group" style={{ marginBottom: 20 }}>
              <label className="form-label">Password</label>
              <div className="input-icon-wrap">
                <input type={showPass ? 'text' : 'password'} className="form-input"
                  placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required />
                <button type="button" className="input-icon-btn" onClick={() => setShowPass(!showPass)}>
                  {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>
            <button type="submit" className="btn btn-primary btn-lg w-full" disabled={loading}>
              {loading ? <Loader size={16} className="animate-spin" /> : <LogIn size={16} />}
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <div className="demo-box">
            <p className="demo-title">Quick Login</p>
            <div className="demo-grid">
              <button className="demo-btn" onClick={() => fillDemo('superadmin@drusshti.com','SuperAdmin@123')}>
                Super Admin
              </button>
              <button className="demo-btn" onClick={() => fillDemo('cs@drusshti.com','CS@123456')}>
                Client Servicing
              </button>
            </div>
          </div>

          <p className="login-footer">Powered by <strong>Drusshti</strong> · www.drusshti.com</p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
