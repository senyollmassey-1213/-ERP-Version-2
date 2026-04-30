import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Plus, Search, Trash2, Edit, GitBranch } from 'lucide-react';
import { moduleAPI, recordAPI } from 'services/api';
import { useAuth } from 'context/AuthContext';
import toast from 'react-hot-toast';
import RecordModal from 'components/modules/RecordModal';

const ModulePage = () => {
  const { moduleSlug } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [titleHeads, setTitleHeads] = useState([]);
  const [records, setRecords]       = useState([]);
  const [stats, setStats]           = useState(null);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [page, setPage]             = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showModal, setShowModal]   = useState(false);
  const [editRecord, setEditRecord] = useState(null);

  useEffect(() => {
    moduleAPI.titleHeads(moduleSlug)
      .then(res => { if (res.success) setTitleHeads(res.data); })
      .catch(() => {});
  }, [moduleSlug]);

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    try {
      const [recRes, statRes] = await Promise.all([
        recordAPI.list(moduleSlug, { page, limit: 20, search, status: filterStatus || undefined }),
        recordAPI.stats(moduleSlug),
      ]);
      if (recRes.success) { setRecords(recRes.data); setTotalPages(recRes.pagination?.totalPages || 1); }
      if (statRes.success) setStats(statRes.data);
    } catch {}
    setLoading(false);
  }, [moduleSlug, page, search, filterStatus]);

  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this record?')) return;
    try { await recordAPI.delete(id); toast.success('Deleted'); fetchRecords(); }
    catch (err) { toast.error(err.message); }
  };

  const handleSave = () => { setShowModal(false); setEditRecord(null); fetchRecords(); };

  // Show first 4 title heads as columns
  const visibleCols = titleHeads.slice(0, 4);
  const statusField = titleHeads.find(t => t.name === 'status');
  const statusOptions = statusField?.options || [];

  const moduleName = moduleSlug.charAt(0).toUpperCase() + moduleSlug.slice(1);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
        <div>
          <h2 style={{ fontSize: 20, marginBottom: 4 }}>{moduleName}</h2>
          {stats && (
            <div style={{ display: 'flex', gap: 12, fontSize: 12, color: 'var(--color-text-3)' }}>
              <span>{stats.summary?.total || 0} total</span>
              <span>·</span>
              <span>{stats.summary?.this_month || 0} this month</span>
              {stats.byStatus?.map(s => (
                <span key={s.status}>· {s.count} {s.status}</span>
              ))}
            </div>
          )}
        </div>
        <button className="btn btn-primary" onClick={() => { setEditRecord(null); setShowModal(true); }}>
          <Plus size={14} /> New Record
        </button>
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 13px', background: 'var(--color-surface)', border: '1.5px solid var(--color-border)', borderRadius: 'var(--radius-md)', flex: 1, maxWidth: 360 }}>
          <Search size={14} style={{ color: 'var(--color-text-3)', flexShrink: 0 }} />
          <input style={{ border: 'none', outline: 'none', background: 'none', fontSize: 13, flex: 1, fontFamily: 'var(--font)' }}
            placeholder={`Search ${moduleName}...`} value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }} />
        </div>
        {statusOptions.length > 0 && (
          <select className="form-select" style={{ width: 'auto' }} value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(1); }}>
            <option value="">All Status</option>
            {statusOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <div className="page-loader"><div className="spinner" /></div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {records.length === 0 ? (
            <div className="empty-state" style={{ padding: 60 }}>
              <Plus size={36} />
              <h3>No {moduleName} records yet</h3>
              <p>Click "New Record" to add your first entry</p>
            </div>
          ) : (
            <div className="table-wrapper">
              <table className="table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Title</th>
                    {visibleCols.map(c => <th key={c.id}>{c.label}</th>)}
                    <th>Created</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {records.map(r => (
                    <tr key={r.id}>
                      <td style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--color-text-3)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          {r.parent_record_id && <GitBranch size={11} style={{ color: 'var(--color-secondary)' }} title="Auto-created by workflow" />}
                          {r.record_number}
                        </div>
                      </td>
                      <td>
                        <span style={{ fontWeight: 500, cursor: 'pointer' }}
                          onClick={() => { setEditRecord(r); setShowModal(true); }}>
                          {r.title || '(No title)'}
                        </span>
                        {r.data?._linked_from && (
                          <div style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>from {r.data._linked_from}</div>
                        )}
                      </td>
                      {visibleCols.map(c => (
                        <td key={c.id} style={{ maxWidth: 150 }}>
                          {renderValue(r.data?.[c.name], c)}
                        </td>
                      ))}
                      <td style={{ fontSize: 11, color: 'var(--color-text-3)', whiteSpace: 'nowrap' }}>
                        {new Date(r.created_at).toLocaleDateString()}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 4, opacity: 0 }} className="row-actions">
                          <button className="btn btn-ghost btn-sm btn-icon" onClick={() => { setEditRecord(r); setShowModal(true); }}>
                            <Edit size={13} />
                          </button>
                          <button className="btn btn-ghost btn-sm btn-icon" onClick={() => handleDelete(r.id)}>
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {totalPages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, fontSize: 13, color: 'var(--color-text-3)' }}>
          <button className="btn btn-secondary btn-sm" onClick={() => setPage(p => p-1)} disabled={page===1}>Previous</button>
          <span>Page {page} of {totalPages}</span>
          <button className="btn btn-secondary btn-sm" onClick={() => setPage(p => p+1)} disabled={page===totalPages}>Next</button>
        </div>
      )}

      <style>{`.row-actions{opacity:0}.table tr:hover .row-actions{opacity:1!important}`}</style>

      {showModal && (
        <RecordModal
          moduleSlug={moduleSlug}
          titleHeads={titleHeads}
          record={editRecord}
          onClose={() => { setShowModal(false); setEditRecord(null); }}
          onSave={handleSave}
        />
      )}
    </div>
  );
};

const renderValue = (value, field) => {
  if (value === undefined || value === null || value === '') return <span style={{ color: 'var(--color-text-muted)' }}>—</span>;
  if (field.field_type === 'boolean') return value ? '✓' : '✗';
  if (field.field_type === 'date') return new Date(value).toLocaleDateString();
  if (field.field_type === 'currency') return <span style={{ fontFamily: 'monospace' }}>₹{Number(value).toLocaleString()}</span>;
  if (field.name === 'status') {
    const opt = field.options?.find(o => o.value === value);
    return <span className="badge badge-default" style={{ fontSize: 10 }}>{opt?.label || value}</span>;
  }
  const str = String(value);
  return <span title={str}>{str.length > 30 ? str.substring(0,30)+'…' : str}</span>;
};

export default ModulePage;
