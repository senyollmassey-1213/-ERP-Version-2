import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, X, Flashlight, AlertCircle } from 'lucide-react';
import { Html5QrcodeScanner, Html5QrcodeScanType } from 'html5-qrcode';

/**
 * ScanPage.jsx
 * Opens phone camera, reads QR code, redirects to /scan/review/:skuCode
 * Uses html5-qrcode library (free, browser-based)
 */
const ScanPage = () => {
  const navigate = useNavigate();
  const scannerRef = useRef(null);
  const [error, setError] = useState('');
  const [scanning, setScanning] = useState(true);

  useEffect(() => {
    // Slight delay so DOM element is ready
    const timer = setTimeout(() => {
      if (!scannerRef.current) return;

      const scanner = new Html5QrcodeScanner(
        'qr-reader',
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
          supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA],
          showZoomSliderIfSupported: true,
          defaultZoomValueIfSupported: 2,
        },
        false // verbose = false
      );

      scanner.render(
        (decodedText) => {
          // Success: SKU code scanned
          setScanning(false);
          scanner.clear().catch(() => {});
          // Navigate to review page
          navigate(`/scan/review/${encodeURIComponent(decodedText)}`);
        },
        (err) => {
          // Ignore scan errors (happens constantly while searching)
          // Only show real errors
          if (err && !err.includes('NotFoundException')) {
            setError('Camera error: ' + err);
          }
        }
      );

      scannerRef.current = scanner;
    }, 300);

    return () => {
      clearTimeout(timer);
      if (scannerRef.current && typeof scannerRef.current.clear === 'function') {
        scannerRef.current.clear().catch(() => {});
      }
    };
  }, [navigate]);

  return (
    <div style={styles.page}>
      {/* Header */}
      <div style={styles.header}>
        <button style={styles.backBtn} onClick={() => navigate(-1)}>
          <X size={20} color="white" />
        </button>
        <h2 style={styles.title}>Scan Item</h2>
        <div style={{ width: 36 }} />
      </div>

      {/* Instructions */}
      <p style={styles.instruction}>
        Point camera at a Drusshti QR label
      </p>

      {/* Scanner viewport */}
      <div style={styles.scannerWrap}>
        <div id="qr-reader" style={styles.scannerEl} />

        {/* Corner guides */}
        <div style={{ ...styles.corner, top: 0, left: 0, borderTop: '3px solid #c75b39', borderLeft: '3px solid #c75b39' }} />
        <div style={{ ...styles.corner, top: 0, right: 0, borderTop: '3px solid #c75b39', borderRight: '3px solid #c75b39' }} />
        <div style={{ ...styles.corner, bottom: 0, left: 0, borderBottom: '3px solid #c75b39', borderLeft: '3px solid #c75b39' }} />
        <div style={{ ...styles.corner, bottom: 0, right: 0, borderBottom: '3px solid #c75b39', borderRight: '3px solid #c75b39' }} />
      </div>

      {error && (
        <div style={styles.error}>
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* Manual entry fallback */}
      <ManualEntry onSubmit={(code) => navigate(`/scan/review/${encodeURIComponent(code)}`)} />
    </div>
  );
};

// Manual entry for cases where camera doesn't work
const ManualEntry = ({ onSubmit }) => {
  const [show, setShow] = useState(false);
  const [code, setCode] = useState('');

  if (!show) {
    return (
      <button style={styles.manualBtn} onClick={() => setShow(true)}>
        Can't scan? Enter code manually
      </button>
    );
  }

  return (
    <div style={styles.manualWrap}>
      <p style={{ fontSize: 12, color: '#718096', marginBottom: 8 }}>Enter SKU code from label:</p>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          style={styles.manualInput}
          value={code}
          onChange={e => setCode(e.target.value.toUpperCase())}
          placeholder="e.g. INV-ABC-00042"
          autoFocus
        />
        <button
          style={styles.manualSubmit}
          onClick={() => code.trim() && onSubmit(code.trim())}
          disabled={!code.trim()}
        >
          Go
        </button>
      </div>
    </div>
  );
};

const styles = {
  page: {
    minHeight: '100vh',
    background: '#0b1628',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '0 0 40px',
  },
  header: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 20px',
    background: 'rgba(0,0,0,0.3)',
  },
  backBtn: {
    background: 'rgba(255,255,255,0.1)',
    border: 'none',
    borderRadius: 8,
    width: 36,
    height: 36,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  title: {
    color: 'white',
    fontSize: 17,
    fontFamily: "'Space Grotesk', sans-serif",
    fontWeight: 600,
  },
  instruction: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 13,
    marginTop: 24,
    marginBottom: 16,
    textAlign: 'center',
  },
  scannerWrap: {
    position: 'relative',
    width: 300,
    height: 300,
  },
  scannerEl: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
    overflow: 'hidden',
  },
  corner: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderRadius: 2,
  },
  error: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    color: '#f87171',
    fontSize: 12,
    marginTop: 16,
    padding: '8px 16px',
    background: 'rgba(239,68,68,0.1)',
    borderRadius: 8,
  },
  manualBtn: {
    background: 'none',
    border: 'none',
    color: 'rgba(255,255,255,0.4)',
    fontSize: 12,
    cursor: 'pointer',
    marginTop: 32,
    textDecoration: 'underline',
    fontFamily: "'Inter', sans-serif",
  },
  manualWrap: {
    marginTop: 24,
    padding: 16,
    background: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    width: 300,
  },
  manualInput: {
    flex: 1,
    padding: '9px 12px',
    borderRadius: 8,
    border: '1px solid rgba(255,255,255,0.2)',
    background: 'rgba(255,255,255,0.1)',
    color: 'white',
    fontSize: 13,
    fontFamily: 'monospace',
    outline: 'none',
  },
  manualSubmit: {
    padding: '9px 18px',
    background: '#c75b39',
    color: 'white',
    border: 'none',
    borderRadius: 8,
    cursor: 'pointer',
    fontWeight: 600,
    fontSize: 13,
    fontFamily: "'Inter', sans-serif",
  },
};

export default ScanPage;
