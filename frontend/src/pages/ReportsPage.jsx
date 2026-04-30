import React, { useState, useEffect } from 'react';
import { Download, FileSpreadsheet, FileText, Loader } from 'lucide-react';
import { recordAPI, moduleAPI } from 'services/api';
import { useAuth } from 'context/AuthContext';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts';

const COLORS = ['#c75b39','#0b1628','#22c55e','#3b82f6','#f59e0b','#8b5cf6'];

const ReportsPage = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'user_admin';

  const [modules, setModules]   = useState([]);
  const [stats, setStats]       = useState({});   // { moduleSlug: { byStatus, summary } }
  const [loading, setLoading]   = useState(true);
  const [exporting, setExporting] = useState('');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const modRes = await moduleAPI.list();
        if (!modRes.success) return;

        // Filter out dashboard and reports themselves
        const reportable = modRes.data.filter(
          m => m.slug !== 'dashboard' && m.slug !== 'reports'
        );
        setModules(reportable);

        // Fetch stats for each module in parallel
        const results = await Promise.allSettled(
          reportable.map(m => recordAPI.stats(m.slug))
        );
        const statsMap = {};
        reportable.forEach((m, i) => {
          if (results[i].status === 'fulfilled' && results[i].value.success) {
            statsMap[m.slug] = results[i].value.data;
          }
        });
        setStats(statsMap);
      } catch {}
      setLoading(false);
    };
    load();
  }, []);

  // ── Export helpers ─────────────────────────────────────────────────────────
  const exportCSV = async (moduleSlug, moduleName) => {
    setExporting(moduleSlug + '_csv');
    try {
      // Fetch all records for this module
      const res = await recordAPI.list(moduleSlug, { limit: 1000, page: 1 });
      if (!res.success || !res.data.length) {
        alert('No records to export');
        setExporting('');
        return;
      }

      // Build CSV from record data
      const allKeys = [...new Set(res.data.flatMap(r => Object.keys(r.data || {})))];
      const headers = ['Record #', 'Title', 'Status', 'Created', ...allKeys];
      const rows = res.data.map(r => [
        r.record_number,
        r.title || '',
        r.status || '',
        new Date(r.created_at).toLocaleDateString(),
        ...allKeys.map(k => r.data?.[k] ?? ''),
      ]);

      const csv = [headers, ...rows]
        .map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
        .join('\n');

      download(`${moduleName}_report.csv`, 'text/csv', csv);
    } catch (err) {
      alert('Export failed: ' + err.message);
    }
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

      const html = `
        <html><head><title>${moduleName} Report</title>
        <style>
          body { font-family: Arial, sans-serif; font-size: 12px; color: #1a202c; padding: 24px; }
          h1 { font-size: 20px; color: #0b1628; margin-bottom: 4px; }
          .meta { color: #718096; font-size: 11px; margin-bottom: 20px; }
          .stats { display: flex; gap: 20px; margin-bottom: 24px; }
          .stat { background: #f4f6fb; padding: 12px 18px; border-radius: 8px; }
          .stat-val { font-size: 22px; font-weight: 700; color: #c75b39; }
          .stat-lbl { font-size: 10px; color: #718096; text-transform: uppercase; }
          table { width: 100%; border-collapse: collapse; }
          th { background: #0b1628; color: white; padding: 8px 10px; text-align: left; font-size: 10px; text-transform: uppercase; }
          td { padding: 7px 10px; border-bottom: 1px solid #e2e8f0; font-size: 11px; }
          tr:nth-child(even) td { background: #f8fafc; }
        </style></head><body>
        <h1>${moduleName} Report</h1>
        <div class="meta">Generated on ${new Date().toLocaleString()} · ${rows.length} records</div>
        <div class="stats">
          <div class="stat"><div class="stat-val">${stat?.summary?.total || rows.length}</div><div class="stat-lbl">Total</div></div>
          <div class="stat"><div class="stat-val">${stat?.summary?.this_month || 0}</div><div class="stat-lbl">This Month</div></div>
          <div class="stat"><div class="stat-val">${stat?.summary?.this_week || 0}</div><div class="stat-lbl">This Week</div></div>
        </div>
        <table>
          <thead><tr><th>#</th><th>Title</th><th>Status</th><th>Created</th>${allKeys.map(k => `<th>${k}</th>`).join('')}</tr></thead>
          <tbody>${rows.map(r => `
            <tr>
              <td>${r.record_number}</td>
              <td>${r.title || ''}</td>
              <td>${r.status || ''}</td>
              <td>${new Date(r.created_at).toLocaleDateString()}</td>
              ${allKeys.map(k => `<td>${r.data?.[k] ?? ''}</td>`).join('')}
            </tr>`).join('')}
          </tbody>
        </table>
        </body></html>`;

      const win = window.open('', '_blank');
      win.document.write(html);
      win.document.close();
      win.print();
    } catch (err) {
      alert('Export failed: ' + err.message);
    }
    setExporting('');
  };

  const download = (filename, type, content) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  // ── Chart data ─────────────────────────────────────────────────────────────
  const summaryChart = modules.map(m => ({
    name: m.name,
    records: parseInt(stats[m.slug]?.summary?.total || 0),
  }));

  const totalAllRecords = summaryChart.reduce((s, m) => s + m.records, 0);

  if (loading) return <div className="page-loader"><div className="spinner" /><p>Loading reports...</p></div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h2 style={{ fontSize: 20 }}>Reports & Analytics</h2>
        <p style={{ fontSize: 12, color: 'var(--color-text-3)', marginTop: 2 }}>
          {totalAllRecords} total records across {modules.length} modules
        </p>
      </div>

      {/* Overview chart */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 16 }}>
        <div className="card">
          <h3 style={{ fontSize: 14, marginBottom: 16 }}>Records by Module</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={summaryChart} margin={{ left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="records" fill="var(--color-secondary)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h3 style={{ fontSize: 14, marginBottom: 16 }}>Distribution</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={summaryChart} dataKey="records" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false} fontSize={10}>
                {summaryChart.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Per-module cards with export */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px,1fr))', gap: 14 }}>
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
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => exportCSV(m.slug, m.name)}
                    disabled={!!exporting}
                    title="Export CSV (Excel)"
                  >
                    {exporting === m.slug + '_csv'
                      ? <Loader size={12} className="animate-spin" />
                      : <FileSpreadsheet size={12} />}
                    CSV
                  </button>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => exportPDF(m.slug, m.name)}
                    disabled={!!exporting}
                    title="Export PDF"
                  >
                    {exporting === m.slug + '_pdf'
                      ? <Loader size={12} className="animate-spin" />
                      : <FileText size={12} />}
                    PDF
                  </button>
                </div>
              </div>

              {/* Status breakdown */}
              {byStatus.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {byStatus.map(s => (
                    <span key={s.status} className="badge badge-default" style={{ fontSize: 11 }}>
                      {s.status}: <strong>{s.count}</strong>
                    </span>
                  ))}
                </div>
              )}

              {/* Mini bar */}
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
  );
};

export default ReportsPage;
