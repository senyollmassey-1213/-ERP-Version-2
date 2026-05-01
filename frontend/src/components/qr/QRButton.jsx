import React, { useState, useEffect } from 'react';
import { QrCode, Printer, Eye, Loader, CheckCircle } from 'lucide-react';
import api from 'services/api';
import toast from 'react-hot-toast';

/**
 * QRButton.jsx
 * Drop-in button for inventory record rows / record modal.
 *
 * Usage:
 *   <QRButton recordId={record.id} moduleSlug={moduleSlug} />
 *
 * Shows:
 *   - "Generate QR" if no QR exists yet
 *   - "View QR" + "Print Label" if QR already exists
 *
 * Only visible to user_admin and above (enforced by requireUserAdmin on backend,
 * but we also hide in UI for regular users)
 */
const QRButton = ({ recordId, moduleSlug, canGenerate = true }) => {
  const [sku, setSku]         = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [showQR, setShowQR]   = useState(false);

  useEffect(() => {
    // Check if QR already exists for this record
    const check = async () => {
      try {
        const res = await api.get('/skus', { params: { moduleSlug } });
        if (res.success) {
          const existing = res.data.find(s => s.record_id === recordId);
          if (existing) setSku(existing);
        }
      } catch {}
      setLoading(false);
    };
    if (recordId) check();
    else setLoading(false);
  }, [recordId, moduleSlug]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res = await api.post(`/skus/record/${recordId}`, { labelType: 'item' });
      if (res.success) {
        setSku(res.data);
        toast.success('QR code generated!');
      }
    } catch (err) {
      toast.error(err.message);
    }
    setGenerating(false);
  };

  const handlePrint = () => {
    const url = `${process.env.REACT_APP_API_URL || 'https://backend-production-4750.up.railway.app/api'}/skus/label/${sku.sku_code}`;
    window.open(url, '_blank');
  };

  if (loading) return null;

  if (!canGenerate && !sku) return null;

  return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
      {!sku ? (
        // No QR yet — show Generate button
        <button
          className="btn btn-secondary btn-sm"
          onClick={handleGenerate}
          disabled={generating}
          title="Generate QR code for this item"
        >
          {generating
            ? <Loader size={12} style={{ animation: 'spin 0.7s linear infinite' }} />
            : <QrCode size={12} />}
          {generating ? 'Generating...' : 'Generate QR'}
        </button>
      ) : (
        // QR exists — show View + Print
        <>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setShowQR(true)}
            title={`SKU: ${sku.sku_code}`}
          >
            <QrCode size={12} />
            {sku.sku_code}
          </button>
          <button
            className="btn btn-ghost btn-sm btn-icon"
            onClick={handlePrint}
            title="Print label"
          >
            <Printer size={12} />
          </button>
        </>
      )}

      {/* QR Preview modal */}
      {showQR && sku && (
        <QRPreviewModal sku={sku} onClose={() => setShowQR(false)} onPrint={handlePrint} />
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

// ── QR Preview Modal ──────────────────────────────────────────────────────────
const QRPreviewModal = ({ sku, onClose, onPrint }) => (
  <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
    <div className="modal" style={{ maxWidth: 340 }}>
      <div className="modal-header">
        <h3 className="modal-title">QR Code</h3>
        <button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button>
      </div>
      <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
        {sku.qr_data && (
          <img src={sku.qr_data} alt={sku.sku_code} style={{ width: 180, height: 180, border: '1px solid var(--color-border)', borderRadius: 8 }} />
        )}
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 16, color: 'var(--color-secondary)' }}>
            {sku.sku_code}
          </p>
          <p style={{ fontSize: 11, color: 'var(--color-text-3)', marginTop: 4 }}>
            Scan count: {sku.scan_count || 0}
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10, width: '100%' }}>
          <button className="btn btn-secondary" style={{ flex: 1 }} onClick={onClose}>
            Close
          </button>
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={onPrint}>
            <Printer size={14} /> Print Label
          </button>
        </div>
      </div>
    </div>
  </div>
);

export default QRButton;
