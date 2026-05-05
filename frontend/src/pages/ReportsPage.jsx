import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, FileSpreadsheet, FileText, Loader, BedDouble, Users, TrendingUp, Calendar, ArrowRight } from 'lucide-react';
import { recordAPI, moduleAPI } from 'services/api';
import { useAuth } from 'context/AuthContext';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts';

const COLORS = ['#c75b39','#0b1628','#22c55e','#3b82f6','#f59e0b','#8b5cf6'];

const ReportsPage = () => {
  const { user, tenant } = useAuth();
  const navigate = useNavigate();
  const isHotel = tenant?.industrySlug === 'hotel_restaurant';

  const [modules, setModules]     = useState([]);
  const [stats, setStats]         = useState({});
  const [loading, setLoading]     = useState(true);
  const [exporting, setExporting] = useState('');

  // Hotel specific data
  const [roomStats, setRoomStats]         = useState({ total: 0, vacant: 0, occupied: 0, reserved: 0, maintenance: 0 });
  const [occupiedRooms, setOccupiedRooms] = useState([]);
  const [recentBookings, setRecentBookings] = useState([]);
  const [revenueData, setRevenueData]     = useState([]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const modRes = await moduleAPI.list();
        if (!modRes.success) return;
        const reportable = modRes.data.filter(m => m.slug !== 'dashboard' && m.slug !== 'reports');
        setModules(reportable);

        const results = await Promise.allSettled(reportable.map(m => recordAPI.stats(m.slug)));
        const statsMap = {};
        reportable.forEach((m, i) => {
          if (results[i].status === 'fulfilled' && results[i].value.success) {
            statsMap[m.slug] = results[i].value.data;
          }
        });
        setStats(statsMap);

        // Hotel specific: fetch rooms and bookings
        if (isHotel) {
          const [roomsRes, bookingsRes, billingRes] = await Promise.all([
            recordAPI.list('rooms', { limit: 200 }),
            recordAPI.list('bookings', { limit: 50, status: 'checked_in' }),
            recordAPI.list('billing', { limit: 200 }),
          ]);

          if (roomsRes.success) {
            const rooms = roomsRes.data;
            const rs = { total: rooms.length, vacant: 0, occupied: 0, reserved: 0, maintenance: 0 };
            rooms.forEach(r => {
              const s = r.data?.status || r.status;
              if (s === 'vacant') rs.vacant++;
              else if (s === 'occupied') rs.occupied++;
              else if (s === 'reserved') rs.reserved++;
              else if (s === 'under_maintenance') rs.maintenance++;
            });
            setRoomStats(rs);
          }

          if (bookingsRes.success) {
            setOccupiedRooms(bookingsRes.data);
          }

          if (bookingsRes.success) {
            // Also get recent bookings (all statuses)
            const allBookings = await recordAPI.list('bookings', { limit: 10 });
            if (allBookings.success) setRecentBookings(allBookings.data);
          }

          // Revenue by month from billing
          if (billingRes.success) {
            const byMonth = {};
            billingRes.data.forEach(b => {
              if (b.data?.payment_status === 'paid') {
                const month = new Date(b.created_at).toLocaleString('default', { month: 'short' });
                byMonth[month] = (byMonth[month] || 0) + parseFloat(b.data?.total || 0);
              }
            });
            setRevenueData(Object.entries(byMonth).map(([month, amount]) => ({ month, amount })));
          }
        }
      } catch {}
      setLoading(false);
    };
    load();
  }, [isHotel]);

  const exportCSV = async (moduleSlug, moduleName) => {
    setExporting(moduleSlug + '_csv');
    try {
      const res = await recordAPI.list(moduleSlug, { limit: 1000, page: 1 });
      if (!res.success || !res.data.length) { alert('No records to export'); setExporting(''); return; }
      const allKeys = [...new Set(res.data.flatMap(r => Object.keys(r.data || {})))];
      const headers = ['Record #', 'Title', 'Status', 'Created', ...allKeys];
      const rows = res.data.map(r => [
        r.record_number, r.title || '', r.status || '',
        new Date(r.created_at).toLocaleDateString(),
        ...allKeys.map(k => r.data?.[k] ?? ''),
      ]);
      const csv = [headers, ...rows].map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
      download(`${moduleName}_report.csv`, 'text/csv', csv);
    } catch (err) { alert('Export failed: ' + err.message); }
    setExporting('');
  };

  const exportPDF = async (moduleSlug, moduleName) => {
    setExporting(moduleSlug + '_pdf');
    try {
      const res = await recordAPI.list(moduleSlug, { limit: 1000, page: 1 });
      if (!res.success) { setExporting(''); return; }
      const stat = stats[moduleSlug];
      const rows = res.data;
      const allKeys = [...new Set(rows.flatMap(r => Object.keys(r.data || {})))].slice(0, 6);
      const html = `<html><head><title>${moduleName} Report</title>
        <style>body{font-family:Arial,sans-serif;font-size:12px;color:#1a202c;padding:24px}h1{font-size:20px;color:#0b1628;margin-bottom:4px}.meta{color:#718096;font-size:11px;margin-bottom:20px}.stats{display:flex;gap:20px;margin-bottom:24px}.stat{background:#f4f6fb;padding:12px 18px;border-radius:8px}.stat-val{font-size:22px;font-weight:700;color:#c75b39}.stat-lbl{font-size:10px;color:#718096;text-transform:uppercase}table{width:100%;border-collapse:collapse}th{background:#0b1628;color:white;padding:8px 10px;text-align:left;font-size:10px;text-transform:uppercase}td{padding:7px 10px;border-bottom:1px solid #e2e8f0;font-size:11px}tr:nth-child(even) td{background:#f8fafc}</style>
        </head><body>
        <h1>${moduleName} Report</h1>
        <div class="meta">Generated on ${new Date().toLocaleString()} · ${rows.length} records</div>
        <div class="stats">
          <div class="stat"><div class="stat-val">${stat?.summary?.total||rows.length}</div><div class="stat-lbl">Total</div></div>
          <div class="stat"><div class="stat-val">${stat?.summary?.this_month||0}</div><div class="stat-lbl">This Month</div></div>
        </div>
        <table><thead><tr><th>#</th><th>Title</th><th>Status</th><th>Created</th>${allKeys.map(k=>`<th>${k}</th>`).join('')}</tr></thead>
        <tbody>${rows.map(r=>`<tr><td>${r.record_number}</td><td>${r.title||''}</td><td>${r.status||''}</td><td>${new Date(r.created_at).toLocaleDateString()}</td>${allKeys.map(k=>`<td>${r.data?.[k]??''}</td>`).join('')}</tr>`).join('')}</tbody>
        </table></body></html>`;
      const win = window.open('', '_blank');
      win.document.write(html);
      win.document.close();
      win.print();
    } catch (err) { alert('Export failed: ' + err.message); }
    setExporting('');
  };

  const download = (filename, type, content) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  const summaryChart = modules.map(m => ({
    name: m.name,
    records: parseInt(stats[m.slug]?.summary?.total || 0),
  })).filter(m => m.records > 0);

  const totalRevenue = revenueData.reduce((s, r) => s + r.amount, 0);

  if (loading) return <div className="page-loader"><div className="spinner" /><p>Loading reports...</p></div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h2 style={{ fontSize: 20 }}>Reports & Analytics</h2>
        <p style={{ fontSize: 12, color: 'var(--color-text-3)', marginTop: 2 }}>
          {new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* ── HOTEL DASHBOARD ── */}
      {isHotel && (
        <>
          {/* Room Status Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
            {[
              { label: 'Total Rooms', value: roomStats.total, color: '#0b1628', status: '' },
              { label: 'Vacant', value: roomStats.vacant, color: '#16a34a', status: 'vacant' },
              { label: 'Occupied', value: roomStats.occupied, color: '#dc2626', status: 'occupied' },
              { label: 'Reserved', value: roomStats.reserved, color: '#d97706', status: 'reserved' },
              { label: 'Maintenance', value: roomStats.maintenance, color: '#6b7280', status: 'under_maintenance' },
            ].map(card => (
              <div
                key={card.label}
                className="card"
                onClick={() => card.status ? navigate(`/m/rooms?status=${card.status}`) : navigate('/m/rooms')}
                style={{ padding: '16px 20px', cursor: 'pointer', borderLeft: `4px solid ${card.color}`, transition: 'transform 0.15s', userSelect: 'none' }}
                onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                onMouseLeave={e => e.currentTarget.style.transform = 'none'}
              >
                <div style={{ fontSize: 28, fontWeight: 700, color: card.color }}>{card.value}</div>
                <div style={{ fontSize: 12, color: 'var(--color-text-3)', marginTop: 2 }}>{card.label}</div>
                <div style={{ fontSize: 10, color: 'var(--color-text-muted)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 3 }}>
                  View rooms <ArrowRight size={10} />
                </div>
              </div>
            ))}
          </div>

          {/* Currently Occupied Rooms */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 style={{ fontSize: 14 }}>
                <BedDouble size={15} style={{ marginRight: 6, verticalAlign: 'middle', color: 'var(--color-secondary)' }} />
                Currently Checked In ({occupiedRooms.length})
              </h3>
              <button className="btn btn-secondary btn-sm" onClick={() => navigate('/m/bookings?status=checked_in')}>
                View All <ArrowRight size={12} />
              </button>
            </div>
            {occupiedRooms.length === 0 ? (
              <p style={{ fontSize: 13, color: 'var(--color-text-3)' }}>No guests currently checked in.</p>
            ) : (
              <div className="table-wrapper">
                <table className="table" style={{ fontSize: 12 }}>
                  <thead>
                    <tr>
                      <th>Room</th><th>Guest</th><th>Phone</th><th>Check-In</th><th>Check-Out</th><th>Nights</th><th>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {occupiedRooms.map(b => (
                      <tr key={b.id}>
                        <td><strong>{b.data?.room_number || '—'}</strong> <span style={{ color: 'var(--color-text-3)', fontSize: 11 }}>{b.data?.room_type}</span></td>
                        <td>{b.data?.guest_name || b.title}</td>
                        <td style={{ color: 'var(--color-text-3)' }}>{b.data?.phone || '—'}</td>
                        <td>{b.data?.check_in_date ? new Date(b.data.check_in_date).toLocaleDateString() : '—'}</td>
                        <td>{b.data?.check_out_date ? new Date(b.data.check_out_date).toLocaleDateString() : '—'}</td>
                        <td style={{ textAlign: 'center' }}>{b.data?.total_nights || '—'}</td>
                        <td style={{ fontFamily: 'monospace', color: 'var(--color-secondary)' }}>
                          {b.data?.room_amount ? `₹${Number(b.data.room_amount).toLocaleString()}` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Revenue + Recent Bookings */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 16 }}>
            {revenueData.length > 0 && (
              <div className="card">
                <h3 style={{ fontSize: 14, marginBottom: 16 }}>
                  <TrendingUp size={14} style={{ marginRight: 6, verticalAlign: 'middle', color: 'var(--color-secondary)' }} />
                  Revenue (Paid Bills) · ₹{totalRevenue.toLocaleString()} total
                </h3>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={revenueData} margin={{ left: -10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} />
                    <Tooltip formatter={v => [`₹${Number(v).toLocaleString()}`, 'Revenue']} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                    <Bar dataKey="amount" fill="var(--color-secondary)" radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <h3 style={{ fontSize: 14 }}>
                  <Calendar size={14} style={{ marginRight: 6, verticalAlign: 'middle', color: 'var(--color-secondary)' }} />
                  Recent Bookings
                </h3>
                <button className="btn btn-secondary btn-sm" onClick={() => navigate('/m/bookings')}>
                  All <ArrowRight size={12} />
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {recentBookings.slice(0, 6).map(b => {
                  const statusColors = { reserved: '#d97706', checked_in: '#2563eb', checked_out: '#6b7280', cancelled: '#dc2626' };
                  const s = b.data?.status || b.status;
                  return (
                    <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--color-border)' }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 500 }}>{b.data?.guest_name || b.title}</div>
                        <div style={{ fontSize: 11, color: 'var(--color-text-3)' }}>
                          Room {b.data?.room_number || '?'} · {b.data?.check_in_date ? new Date(b.data.check_in_date).toLocaleDateString() : '—'}
                        </div>
                      </div>
                      <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 4, background: (statusColors[s] || '#6b7280') + '18', color: statusColors[s] || '#6b7280' }}>
                        {s}
                      </span>
                    </div>
                  );
                })}
                {recentBookings.length === 0 && <p style={{ fontSize: 13, color: 'var(--color-text-3)' }}>No bookings yet.</p>}
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── GENERIC MODULE STATS (all industries) ── */}
      <div>
        <h3 style={{ fontSize: 15, marginBottom: 12 }}>Module Summary</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px,1fr))', gap: 14 }}>
          {modules.map(m => {
            const s = stats[m.slug];
            const byStatus = s?.byStatus || [];
            return (
              <div key={m.slug} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <h3 style={{ fontSize: 14 }}>{m.name}</h3>
                    <p style={{ fontSize: 11, color: 'var(--color-text-3)', marginTop: 2 }}>
                      {s?.summary?.total || 0} total · {s?.summary?.this_month || 0} this month
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="btn btn-secondary btn-sm" onClick={() => exportCSV(m.slug, m.name)} disabled={!!exporting} title="Export CSV">
                      {exporting === m.slug + '_csv' ? <Loader size={12} className="animate-spin" /> : <FileSpreadsheet size={12} />} CSV
                    </button>
                    <button className="btn btn-secondary btn-sm" onClick={() => exportPDF(m.slug, m.name)} disabled={!!exporting} title="Export PDF">
                      {exporting === m.slug + '_pdf' ? <Loader size={12} className="animate-spin" /> : <FileText size={12} />} PDF
                    </button>
                  </div>
                </div>

                {byStatus.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {byStatus.map(st => (
                      <span
                        key={st.status}
                        className="badge badge-default"
                        style={{ fontSize: 11, cursor: 'pointer' }}
                        onClick={() => navigate(`/m/${m.slug}?status=${st.status}`)}
                        title={`View ${st.status} records`}
                      >
                        {st.status}: <strong>{st.count}</strong>
                      </span>
                    ))}
                  </div>
                )}

                {s?.summary?.total > 0 && (
                  <div style={{ height: 6, background: 'var(--color-border)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%',
                      width: `${Math.min(100, (s.summary.this_month / s.summary.total) * 100)}%`,
                      background: 'var(--color-secondary)',
                      borderRadius: 3,
                      transition: 'width 0.5s ease',
                    }} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default ReportsPage;
