import React, { useState, useEffect } from 'react';
import { QrCode, Printer, Download, X, Loader, Plus, CheckCircle } from 'lucide-react';
import api from 'services/api';
import toast from 'react-hot-toast';

/**
 * QRBulkGeneratePage.jsx
 * Super Admin / Client Servicing page to:
 *  - Select a client
 *  - Enter quantity
 *  - Generate generic QR labels
 *  - Print them as a sheet
 *
 * Accessible at: /qr-generate (platform admin only)
 */
const QRBulkGeneratePage = () => {
  const [tenants, setTenants]       = useState([]);
  const [tenantId, setTenantId]     = useState('');
  const [quantity, setQuantity]     = useState(10);
  const [labelType, setLabelType]   = useState('item');
  const [loading, setLoading]       = useState(false);
  const [generated, setGenerated]   = useState([]); // array of sku objects
  const [loadingTenants, setLoadingTenants] = useState(true);

  useEffect(() => {
    api.get('/skus/tenants').then(res => {
      if (res.success) setTenants(res.data);
    }).catch(() => {}).finally(() => setLoadingTenants(false));
  }, []);

  const handleGenerate = async () => {
    if (quantity < 1 || quantity > 500) {
      toast.error('Quantity must be 1–500');
      return;
    }
    setLoading(true);
    setGenerated([]);
    try {
      const res = await api.post('/skus/bulk-generate', {
        quantity,
        tenantId: tenantId || null,
        labelType,
      });
      if (res.success) {
        setGenerated(res.data);
        toast.success(`${res.data.length} QR code(s) generated`);
      }
    } catch (err) {
      toast.error(err.message);
    }
    setLoading(false);
  };

  const handlePrint = async () => {
    if (!generated.length) return;
    const skuCodes = generated.map(s => s.sku_code);

    try {
      const res = await fetch(`${process.env.REACT_APP_API_URL || 'https://backend-production-4750.up.railway.app/api'}/skus/labels/bulk`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('drush_token')}`,
        },
        body: JSON.stringify({ skuCodes }),
      });

      const html = await res.text();
      const win = window.open('', '_blank');
      win.document.write(html);
      win.document.close();
    } catch (err) {
      toast.error('Failed to open print page: ' + err.message);
    }
  };

  const clearGenerated = () => setGenerated([]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Page header */}
      <div>
        <h2 style={{ fontSize: 20 }}>QR Label Generator</h2>
        <p style={{ fontSize: 12, color: 'var(--color-text-3)', marginTop: 2 }}>
          Generate generic QR labels for clients who don't have a printer
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, alignItems: 'start' }}>

        {/* Form */}
        <div className="card">
          <h3 style={{ fontSize: 14, marginBottom: 18 }}>Generate Labels</h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* Client selection */}
            <div className="form-group">
              <label className="form-label">Client Company</label>
              {loadingTenants ? (
                <div style={{ height: 40, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--color-text-3)', fontSize: 13 }}>
                  <div className="spinner" style={{ width: 14, height: 14 }} /> Loading...
                </div>
              ) : (
                <select className="form-select" value={tenantId} onChange={e => setTenantId(e.target.value)}>
                  <option value="">— No client (generic labels) —</option>
                  {tenants.map(t => (
                    <option key={t.id} value={t.id}>{t.name} ({t.slug})</option>
                  ))}
                </select>
              )}
              <span className="form-hint">
                {tenantId ? 'QRs will be pre-assigned to this company' : 'Generic QRs — client maps them manually on first scan'}
              </span>
            </div>

            {/* Label type */}
            <div className="form-group">
              <label className="form-label">Label Type</label>
              <select className="form-select" value={labelType} onChange={e => setLabelType(e.target.value)}>
                <option value="item">Physical Item (product, box, part)</option>
                <option value="document">Document (job card, invoice, delivery note)</option>
              </select>
            </div>

            {/* Quantity */}
            <div className="form-group">
              <label className="form-label">Quantity (max 500)</label>
              <input
                type="number"
                className="form-input"
                value={quantity}
                onChange={e => setQuantity(parseInt(e.target.value) || 1)}
                min={1}
                max={500}
              />
              <span className="form-hint">
                Standard A4 sheet fits ~8 labels. {Math.ceil(quantity / 8)} page(s) needed.
              </span>
            </div>

            {/* Info box */}
            <div style={{ padding: '10px 14px', background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 8, fontSize: 12, color: '#c2410c', lineHeight: 1.6 }}>
              <strong>How it works:</strong><br />
              1. Generate labels here → print sheet<br />
              2. Hand label sheet to client<br />
              3. Client pastes labels on products<br />
              4. Worker scans → links item to inventory record
            </div>

            <button
              className="btn btn-primary"
              onClick={handleGenerate}
              disabled={loading || quantity < 1}
              style={{ alignSelf: 'flex-start' }}
            >
              {loading ? <Loader size={14} style={{ animation: 'spin 0.7s linear infinite' }} /> : <QrCode size={14} />}
              {loading ? `Generating ${quantity}...` : `Generate ${quantity} QR Code(s)`}
            </button>
          </div>
        </div>

        {/* Preview / results */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h3 style={{ fontSize: 14 }}>
              {generated.length > 0 ? `${generated.length} QR(s) Ready` : 'Preview'}
            </h3>
            {generated.length > 0 && (
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-secondary btn-sm" onClick={clearGenerated}>
                  <X size={12} /> Clear
                </button>
                <button className="btn btn-primary btn-sm" onClick={handlePrint}>
                  <Printer size={12} /> Print Labels
                </button>
              </div>
            )}
          </div>

          {generated.length === 0 ? (
            <div className="empty-state" style={{ height: 200 }}>
              <QrCode size={32} />
              <p>Generated QR codes will appear here</p>
            </div>
          ) : (
            <>
              {/* Success summary */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: '#dcfce7', borderRadius: 8, marginBottom: 14, border: '1px solid #bbf7d0' }}>
                <CheckCircle size={16} color="#166534" />
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: '#166534' }}>
                    {generated.length} QR codes generated successfully
                  </p>
                  <p style={{ fontSize: 11, color: '#166534' }}>
                    Click "Print Labels" to open print-ready label sheet
                  </p>
                </div>
              </div>

              {/* SKU code list */}
              <div style={{ maxHeight: 320, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
                {generated.map((sku, i) => (
                  <div key={sku.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px', background: 'var(--color-surface-2)', borderRadius: 6, fontSize: 12 }}>
                    <span style={{ color: 'var(--color-text-muted)', minWidth: 24, textAlign: 'right' }}>{i + 1}.</span>
                    <span style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--color-secondary)', flex: 1 }}>
                      {sku.sku_code}
                    </span>
                    <span style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>{sku.label_type}</span>
                    {/* Individual label print */}
                    <a
                      href={`${process.env.REACT_APP_API_URL || 'https://backend-production-4750.up.railway.app/api'}/skus/label/${sku.sku_code}`}
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: 'var(--color-text-muted)', display: 'flex' }}
                      title="Print this label"
                    >
                      <Printer size={12} />
                    </a>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

export default QRBulkGeneratePage;
