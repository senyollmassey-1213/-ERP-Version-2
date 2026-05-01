import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { CheckCircle, ArrowLeft, QrCode, Package, AlertTriangle, Loader, Save } from 'lucide-react';
import api from 'services/api';
import { useAuth } from 'context/AuthContext';
import toast from 'react-hot-toast';

/**
 * ScanReviewPage.jsx
 * After scanning a QR code, this page:
 * 1. Fetches item details from the SKU
 * 2. Shows current field values
 * 3. Lets worker edit relevant fields
 * 4. Logs the scan event on submit
 *
 * For unassigned QRs: prompts worker to identify what item this is
 */
const ScanReviewPage = () => {
  const { skuCode } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState('');
  const [sku, setSku]           = useState(null);
  const [titleHeads, setTitleHeads] = useState([]);
  const [editData, setEditData] = useState({});
  const [action, setAction]     = useState('scanned');
  const [location, setLocation] = useState('');
  const [notes, setNotes]       = useState('');
  const [done, setDone]         = useState(false);

  useEffect(() => {
    const fetch = async () => {
      try {
        const res = await api.get(`/skus/lookup/${encodeURIComponent(skuCode)}`);
        if (res.success) {
          setSku(res.data.sku);
          setTitleHeads(res.data.titleHeads || []);
          setEditData(res.data.sku.data || {});
        }
      } catch (err) {
        setError(err.message || 'Item not found');
      }
      setLoading(false);
    };
    fetch();
  }, [skuCode]);

  const handleSubmit = async () => {
    setSaving(true);
    try {
      await api.post(`/skus/scan/${encodeURIComponent(skuCode)}`, {
        action,
        location,
        notes,
        recordData: Object.keys(editData).length ? editData : undefined,
      });
      setDone(true);
      toast.success('Scan logged!');
    } catch (err) {
      toast.error(err.message);
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div style={pageStyle}>
        <div style={centeredStyle}>
          <div className="spinner" style={{ borderTopColor: '#c75b39' }} />
          <p style={{ color: 'white', marginTop: 12, fontSize: 13 }}>Looking up item...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={pageStyle}>
        <div style={{ ...centeredStyle, gap: 16 }}>
          <AlertTriangle size={40} color="#f87171" />
          <p style={{ color: 'white', fontSize: 15, fontWeight: 600 }}>QR Not Found</p>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, textAlign: 'center' }}>{error}</p>
          <button style={primaryBtn} onClick={() => navigate('/scan')}>Scan Again</button>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div style={pageStyle}>
        <div style={{ ...centeredStyle, gap: 16 }}>
          <div style={{ width: 64, height: 64, background: '#22c55e', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CheckCircle size={32} color="white" />
          </div>
          <p style={{ color: 'white', fontSize: 18, fontWeight: 700 }}>Scan Logged!</p>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>{sku?.sku_code}</p>
          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            <button style={secondaryBtn} onClick={() => navigate('/scan')}>Scan Another</button>
            <button style={primaryBtn} onClick={() => navigate('/dashboard')}>Dashboard</button>
          </div>
        </div>
      </div>
    );
  }

  const isUnassigned = !sku?.is_assigned;

  return (
    <div style={pageStyle}>
      {/* Header */}
      <div style={headerStyle}>
        <button style={iconBtn} onClick={() => navigate('/scan')}>
          <ArrowLeft size={18} color="white" />
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <QrCode size={16} color="#c75b39" />
          <span style={{ color: 'white', fontSize: 14, fontFamily: 'monospace', fontWeight: 600 }}>
            {skuCode}
          </span>
        </div>
        <div style={{ width: 36 }} />
      </div>

      {/* Scrollable content */}
      <div style={contentStyle}>

        {/* Item card */}
        <div style={cardStyle}>
          {isUnassigned ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', marginBottom: 12 }}>
              <div style={{ width: 36, height: 36, background: '#fef9c3', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <AlertTriangle size={18} color="#854d0e" />
              </div>
              <div>
                <p style={{ fontWeight: 600, fontSize: 14 }}>Unassigned QR</p>
                <p style={{ fontSize: 11, color: '#718096' }}>This QR is not yet linked to any item</p>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', marginBottom: 12 }}>
              <div style={{ width: 36, height: 36, background: '#dbeafe', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Package size={18} color="#1e40af" />
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontWeight: 600, fontSize: 14 }}>{sku.title || '(No title)'}</p>
                <p style={{ fontSize: 11, color: '#718096' }}>
                  {sku.record_number} · {sku.module_name}
                </p>
              </div>
              {sku.status && (
                <span style={{ padding: '2px 10px', background: '#f4f6fb', borderRadius: 100, fontSize: 11, fontWeight: 600, border: '1px solid #e2e8f0' }}>
                  {sku.status}
                </span>
              )}
            </div>
          )}

          {/* Editable fields from title heads */}
          {titleHeads.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#718096', marginBottom: 2 }}>
                Update Fields
              </p>
              {titleHeads.filter(f => !f.name.startsWith('_')).map(f => (
                <div key={f.id} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <label style={{ fontSize: 11, fontWeight: 600, color: '#4a5568', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    {f.label}
                  </label>
                  <FieldInput
                    field={f}
                    value={editData[f.name]}
                    onChange={val => setEditData(prev => ({ ...prev, [f.name]: val }))}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Scan action card */}
        <div style={cardStyle}>
          <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#718096', marginBottom: 10 }}>
            Scan Details
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div>
              <label style={labelStyle}>Action</label>
              <select style={inputStyle} value={action} onChange={e => setAction(e.target.value)}>
                <option value="scanned">Scanned / Checked</option>
                <option value="received">Received</option>
                <option value="dispatched">Dispatched</option>
                <option value="moved">Moved</option>
                <option value="checked">Quality Check</option>
              </select>
            </div>

            <div>
              <label style={labelStyle}>Location (optional)</label>
              <input
                style={inputStyle}
                value={location}
                onChange={e => setLocation(e.target.value)}
                placeholder="e.g. Rack B3, Gate 2, Dispatch Area"
              />
            </div>

            <div>
              <label style={labelStyle}>Notes (optional)</label>
              <textarea
                style={{ ...inputStyle, minHeight: 70, resize: 'vertical' }}
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Any observations..."
              />
            </div>
          </div>
        </div>

        {/* Submit */}
        <button style={{ ...primaryBtn, width: '100%', padding: '14px', fontSize: 15 }} onClick={handleSubmit} disabled={saving}>
          {saving ? <Loader size={16} style={{ animation: 'spin 0.7s linear infinite' }} /> : <Save size={16} />}
          {saving ? 'Saving...' : 'Submit Scan'}
        </button>

      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        * { box-sizing: border-box; }
        input:focus, select:focus, textarea:focus { outline: none; border-color: #c75b39 !important; box-shadow: 0 0 0 3px rgba(199,91,57,0.15); }
      `}</style>
    </div>
  );
};

// ── Field renderer (mobile-friendly) ─────────────────────────────────────────
const FieldInput = ({ field, value, onChange }) => {
  const base = {
    padding: '10px 12px',
    border: '1.5px solid #e2e8f0',
    borderRadius: 8,
    fontSize: 14,
    fontFamily: "'Inter', sans-serif",
    color: '#1a202c',
    background: 'white',
    width: '100%',
    minHeight: 42,
  };

  switch (field.field_type) {
    case 'dropdown':
      return (
        <select style={base} value={value || ''} onChange={e => onChange(e.target.value)}>
          <option value="">Select...</option>
          {(field.options || []).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      );
    case 'number':
      return <input type="number" style={base} value={value || ''} onChange={e => onChange(e.target.value)} />;
    case 'date':
      return <input type="date" style={base} value={value || ''} onChange={e => onChange(e.target.value)} />;
    case 'boolean':
      return (
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
          <input type="checkbox" checked={!!value} onChange={e => onChange(e.target.checked)}
            style={{ width: 20, height: 20 }} />
          <span style={{ fontSize: 14 }}>{value ? 'Yes' : 'No'}</span>
        </label>
      );
    case 'textarea':
      return <textarea style={{ ...base, minHeight: 80, resize: 'vertical' }} value={value || ''} onChange={e => onChange(e.target.value)} />;
    default:
      return <input type="text" style={base} value={value || ''} onChange={e => onChange(e.target.value)} />;
  }
};

// Styles
const pageStyle = { minHeight: '100vh', background: '#f4f6fb', display: 'flex', flexDirection: 'column' };
const headerStyle = { background: '#0b1628', padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 10 };
const contentStyle = { flex: 1, padding: '16px', display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 500, width: '100%', margin: '0 auto' };
const cardStyle = { background: 'white', borderRadius: 12, padding: 16, border: '1px solid #e2e8f0' };
const centeredStyle = { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 32 };
const iconBtn = { background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 8, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' };
const primaryBtn = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '11px 20px', background: '#c75b39', color: 'white', border: 'none', borderRadius: 10, cursor: 'pointer', fontWeight: 600, fontSize: 14, fontFamily: "'Inter', sans-serif" };
const secondaryBtn = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '11px 20px', background: 'white', color: '#0b1628', border: '1.5px solid #e2e8f0', borderRadius: 10, cursor: 'pointer', fontWeight: 600, fontSize: 14, fontFamily: "'Inter', sans-serif" };
const labelStyle = { fontSize: 11, fontWeight: 600, color: '#4a5568', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: 4 };
const inputStyle = { padding: '10px 12px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 14, fontFamily: "'Inter', sans-serif", color: '#1a202c', background: 'white', width: '100%' };

export default ScanReviewPage;
