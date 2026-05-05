import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Plus, Search, Trash2, Edit, GitBranch } from 'lucide-react';
import { moduleAPI, recordAPI } from 'services/api';
import { useAuth } from 'context/AuthContext';
import toast from 'react-hot-toast';
import RecordModal from 'components/modules/RecordModal';
import QRButton from 'components/qr/QRButton';

// Columns to show per module slug
const MODULE_COLUMNS = {
  bookings:     ['guest_name', 'room_number', 'check_in_date', 'check_out_date', 'status'],
  rooms:        ['room_number', 'room_type', 'floor', 'capacity', 'status'],
  billing:      ['guest_name', 'bill_type', 'total', 'payment_status'],
  crm:          ['guest_name', 'phone', 'email', 'status'],
  housekeeping: ['room_number', 'task_type', 'assigned_to', 'status'],
  transport:    ['guest_name', 'transport_type', 'pickup_datetime', 'status'],
  menu:         ['item_name', 'category', 'price', 'available'],
  inventory:    ['item_name', 'category', 'quantity', 'unit'],
};

const ModulePage = () => {
  const { moduleSlug } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Read status from URL query param (e.g. /m/rooms?status=vacant)
  const queryStatus = new URLSearchParams(location.search).get('status') || '';

  const [titleHeads, setTitleHeads] = useState([]);
  const [records, setRecords]       = useState([]);
  const [stats, setStats]           = useState(null);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState('');
  const [filterStatus, setFilterStatus] = useState(queryStatus);
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

  const statusField = titleHeads.find(t => t.name === 'status');
  const statusOptions = statusField?.options || [];

  // Determine which columns to show
  const preferredCols = MODULE_COLUMNS[moduleSlug];
  const visibleCols = preferredCols
    ? titleHeads.filter(t => preferredCols.includes(t.name)).sort((a, b) => preferredCols.indexOf(a.name) - preferredCols.indexOf(b.name))
    : titleHeads.slice(0, 4);

  const moduleName = moduleSlug.charAt(0).toUpperCase() + moduleSlug.slice(1);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
        <div>
          <h2 style={{ fontSize: 20, marginBottom: 4 }}>{moduleName}</h2>
          {stats && (
            <div style={{ display: 'flex', gap: 12, fontSize: 12, color: 'var(--color-text-3)', flexWrap: 'wrap' }}>
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
                    <th style={{ whiteSpace: 'nowrap' }}>#</th>
                    <th style={{ whiteSpace: 'nowrap' }}>Title</th>
                    {visibleCols.map(c => <th key={c.id} style={{ whiteSpace: 'nowrap' }}>{c.label}</th>)}
                    <th style={{ whiteSpace: 'nowrap' }}>Created</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {records.map(r => (
                    <tr key={r.id}>
                      <td style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--color-text-3)', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          {r.parent_record_id && <GitBranch size={11} style={{ color: 'var(--color-secondary)' }} title="Auto-created by workflow" />}
                          {r.record_number}
                        </div>
                      </td>
                      <td style={{ maxWidth: 180 }}>
                        <span style={{ fontWeight: 500, cursor: 'pointer', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                          onClick={() => { setEditRecord(r); setShowModal(true); }}>
                          {r.title || '(No title)'}
                        </span>
                        {r.data?._linked_from && (
                          <div style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>from {r.data._linked_from}</div>
                        )}
                      </td>
                      {visibleCols.map(c => (
                        <td key={c.id} style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {renderValue(r.data?.[c.name], c)}
                        </td>
                      ))}
                      <td style={{ fontSize: 11, color: 'var(--color-text-3)', whiteSpace: 'nowrap' }}>
                        {new Date(r.created_at).toLocaleDateString()}
                      </td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', gap: 4, opacity: 0 }} className="row-actions">
                          <button className="btn btn-ghost btn-sm btn-icon" onClick={() => { setEditRecord(r); setShowModal(true); }}>
                            <Edit size={13} />
                          </button>
                          {moduleSlug === 'inventory' && (
                            <QRButton
                              recordId={r.id}
                              moduleSlug={moduleSlug}
                              canGenerate={user?.role === 'user_admin'}
                            />
                          )}
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
  if (field.field_type === 'date') {
    try { return new Date(value).toLocaleDateString(); } catch { return value; }
  }
  if (field.field_type === 'datetime') {
    try { return new Date(value).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }); } catch { return value; }
  }
  if (field.field_type === 'currency') return <span style={{ fontFamily: 'monospace' }}>₹{Number(value).toLocaleString()}</span>;
  if (field.name === 'status' || field.name === 'payment_status' || field.name === 'available') {
    const opt = field.options?.find(o => o.value === value);
    const label = opt?.label || value;
    const colorMap = {
      vacant: '#16a34a', occupied: '#dc2626', reserved: '#d97706', under_maintenance: '#6b7280', housekeeping: '#7c3aed',
      checked_in: '#2563eb', checked_out: '#6b7280', cancelled: '#dc2626', no_show: '#9a3412',
      paid: '#16a34a', unpaid: '#dc2626', partial: '#d97706', overdue: '#9a3412',
      available: '#16a34a', unavailable: '#dc2626', seasonal: '#d97706',
      complete: '#16a34a', pending: '#d97706', in_progress: '#2563eb',
      converted: '#16a34a', new: '#6b7280', lost: '#dc2626',
    };
    return (
      <span style={{
        display: 'inline-block', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600,
        background: (colorMap[value] || '#6b7280') + '18',
        color: colorMap[value] || '#6b7280',
      }}>
        {label}
      </span>
    );
  }
  const str = String(value);
  return <span title={str} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block', maxWidth: 150 }}>{str.length > 30 ? str.substring(0,30)+'…' : str}</span>;
};

export default ModulePage;
