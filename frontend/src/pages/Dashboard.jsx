import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from 'context/AuthContext';
import { dashboardAPI } from 'services/api';
import { Users, Package, Layout, ArrowRight, GitBranch } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const StatCard = ({ label, value, sub, color }) => (
  <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
    <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-3)' }}>{label}</p>
    <p style={{ fontSize: 28, fontWeight: 700, fontFamily: 'var(--font-display)', color: color || 'var(--color-text)' }}>{value ?? '—'}</p>
    {sub && <p style={{ fontSize: 11, color: 'var(--color-text-3)' }}>{sub}</p>}
  </div>
);

const Dashboard = () => {
  const { isSuperAdmin, isClientServicing, user, tenant } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetch = async () => {
      try {
        const res = (isSuperAdmin || isClientServicing)
          ? await dashboardAPI.getSuper()
          : await dashboardAPI.get();
        if (res.success) setData(res.data);
      } catch {}
      setLoading(false);
    };
    fetch();
  }, [isSuperAdmin, isClientServicing]);

  if (loading) return <div className="page-loader"><div className="spinner" /><p>Loading...</p></div>;

  // ── Platform Admin Dashboard ─────────────────────────────────────────────
  if ((isSuperAdmin || isClientServicing) && data) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div>
          <h2 style={{ fontSize: 20, marginBottom: 4 }}>Platform Overview</h2>
          <p style={{ fontSize: 13, color: 'var(--color-text-3)' }}>Welcome back, {user?.firstName}</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px,1fr))', gap: 14 }}>
          <StatCard label="Total Companies" value={data.stats.tenants.total}   sub={`${data.stats.tenants.active} active`}  color="var(--color-secondary)" />
          <StatCard label="Trial Plans"     value={data.stats.tenants.trial}                                                  color="var(--color-warning)" />
          <StatCard label="Total Users"     value={data.stats.users.count}                                                    color="var(--color-info)" />
          <StatCard label="Workflow Events" value={data.stats.workflows.count}                                                color="var(--color-success)" />
        </div>
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--color-border)' }}>
            <h3 style={{ fontSize: 14 }}>Recent Companies</h3>
          </div>
          <table className="table">
            <thead><tr><th>Company</th><th>Industry</th><th>Plan</th><th>Users</th><th>Created</th></tr></thead>
            <tbody>
              {data.recentTenants.map(t => (
                <tr key={t.id} style={{ cursor: 'pointer' }} onClick={() => navigate('/tenants')}>
                  <td><strong>{t.name}</strong><br/><span style={{ fontSize: 11, color: 'var(--color-text-3)', fontFamily: 'monospace' }}>{t.slug}</span></td>
                  <td><span className="badge badge-info">{t.industry_name}</span></td>
                  <td><span className="badge badge-default">{t.subscription_plan}</span></td>
                  <td>{t.user_count}</td>
                  <td style={{ fontSize: 11, color: 'var(--color-text-3)' }}>{new Date(t.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
              {!data.recentTenants.length && <tr><td colSpan={5}><div className="empty-state" style={{ height: 80 }}><p>No companies yet</p></div></td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // ── Tenant Dashboard ─────────────────────────────────────────────────────
  if (!data) return <div className="page-loader"><p>No data</p></div>;

  const chartData = data.moduleActivity?.map(m => ({ name: m.module_name, records: parseInt(m.count) })) || [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h2 style={{ fontSize: 20, marginBottom: 4 }}>Welcome back, {user?.firstName} 👋</h2>
        {tenant && <p style={{ fontSize: 13, color: 'var(--color-text-3)' }}>{tenant.name} · {tenant.industryName}</p>}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px,1fr))', gap: 14 }}>
        <StatCard label="Total Users"    value={data.stats.users.total}   sub={`${data.stats.users.active} active`}  color="var(--color-secondary)" />
        <StatCard label="Active Modules" value={data.stats.modules.total}                                             color="var(--color-info)" />
        <StatCard label="Total Records"  value={data.stats.totalRecords}                                              color="var(--color-success)" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 18 }}>
        <div className="card">
          <div className="section-header">
            <h3>Records by Module</h3>
          </div>
          {chartData.length ? (
            <ResponsiveContainer width="100%" height={190}>
              <BarChart data={chartData} margin={{ left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="records" fill="var(--color-secondary)" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="empty-state" style={{ height: 190 }}><Package size={28} /><p>No records yet</p></div>
          )}
        </div>

        <div className="card">
          <div className="section-header"><h3>Recent Records</h3></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {data.recentRecords?.map(r => (
              <div key={r.id} onClick={() => navigate(`/m/${r.module_slug}`)}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', cursor: 'pointer', transition: 'var(--transition)' }}
                onMouseEnter={e => e.currentTarget.style.background='var(--color-surface-2)'}
                onMouseLeave={e => e.currentTarget.style.background=''}>
                <div>
                  <div style={{ fontSize: 10, color: 'var(--color-text-3)', fontFamily: 'monospace' }}>{r.record_number}</div>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{r.title || '(No title)'}</div>
                </div>
                <span className="badge badge-default" style={{ fontSize: 10 }}>{r.module_name}</span>
              </div>
            ))}
            {!data.recentRecords?.length && <div className="empty-state" style={{ height: 100 }}><p>No records yet</p></div>}
          </div>
        </div>
      </div>

      {/* Workflow activity */}
      {data.recentWorkflow?.length > 0 && (
        <div className="card">
          <div className="section-header"><h3>Recent Workflow Activity</h3></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {data.recentWorkflow.map((w, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
                <GitBranch size={14} style={{ color: 'var(--color-secondary)', flexShrink: 0 }} />
                <span style={{ color: 'var(--color-text-2)' }}>
                  <strong>{w.from_record}</strong> ({w.from_module}) → <span className="badge badge-success" style={{ fontSize: 10 }}>{w.trigger_status}</span> → created <strong>{w.to_record}</strong> in {w.to_module}
                </span>
                <span style={{ fontSize: 11, color: 'var(--color-text-muted)', marginLeft: 'auto', whiteSpace: 'nowrap' }}>
                  {new Date(w.created_at).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
