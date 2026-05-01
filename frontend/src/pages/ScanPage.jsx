import React, { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Camera, AlertCircle } from 'lucide-react';

/**
 * ScanPage.jsx
 * Uses native browser camera + BarcodeDetector API (supported on Android Chrome)
 * Falls back to manual entry if BarcodeDetector not available
 */
const ScanPage = () => {
  const navigate = useNavigate();
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState('');
  const [manualCode, setManualCode] = useState('');
  const [showManual, setShowManual] = useState(false);

  const startCamera = async () => {
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setScanning(true);
      detectQR();
    } catch (err) {
      setError('Camera access denied. Please allow camera permission and try again, or enter code manually.');
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setScanning(false);
  };

  const detectQR = async () => {
    // BarcodeDetector is supported on Android Chrome 83+
    if (!('BarcodeDetector' in window)) {
      setError('');
      setShowManual(true);
      stopCamera();
      return;
    }

    const detector = new window.BarcodeDetector({ formats: ['qr_code'] });

    const scan = async () => {
      if (!videoRef.current || !streamRef.current) return;
      try {
        const barcodes = await detector.detect(videoRef.current);
        if (barcodes.length > 0) {
          const code = barcodes[0].rawValue;
          stopCamera();
          navigate(`/scan/review/${encodeURIComponent(code)}`);
          return;
        }
      } catch {}
      // Keep scanning
      requestAnimationFrame(scan);
    };

    requestAnimationFrame(scan);
  };

  const handleManualSubmit = () => {
    const code = manualCode.trim().toUpperCase();
    if (!code) return;
    navigate(`/scan/review/${encodeURIComponent(code)}`);
  };

  const handleBack = () => {
    stopCamera();
    navigate(-1);
  };

  return (
    <div style={styles.page}>
      {/* Header */}
      <div style={styles.header}>
        <button style={styles.iconBtn} onClick={handleBack}>
          <X size={20} color="white" />
        </button>
        <h2 style={styles.title}>Scan Item</h2>
        <div style={{ width: 36 }} />
      </div>

      {!scanning && !showManual && (
        <div style={styles.center}>
          <div style={styles.cameraIcon}>
            <Camera size={48} color="#c75b39" />
          </div>
          <p style={styles.hint}>Tap below to open camera and scan a QR label</p>
          <button style={styles.primaryBtn} onClick={startCamera}>
            <Camera size={18} /> Open Camera
          </button>
          <button style={styles.linkBtn} onClick={() => setShowManual(true)}>
            Enter code manually instead
          </button>
          {error && (
            <div style={styles.errorBox}>
              <AlertCircle size={15} />
              <span>{error}</span>
            </div>
          )}
        </div>
      )}

      {scanning && (
        <div style={styles.scannerWrap}>
          <p style={styles.hint}>Point at QR code on the label</p>

          <div style={styles.videoWrap}>
            <video
              ref={videoRef}
              style={styles.video}
              autoPlay
              playsInline
              muted
            />
            {/* Corner guides */}
            <div style={{ ...styles.corner, top: 8, left: 8, borderTop: '3px solid #c75b39', borderLeft: '3px solid #c75b39' }} />
            <div style={{ ...styles.corner, top: 8, right: 8, borderTop: '3px solid #c75b39', borderRight: '3px solid #c75b39' }} />
            <div style={{ ...styles.corner, bottom: 8, left: 8, borderBottom: '3px solid #c75b39', borderLeft: '3px solid #c75b39' }} />
            <div style={{ ...styles.corner, bottom: 8, right: 8, borderBottom: '3px solid #c75b39', borderRight: '3px solid #c75b39' }} />
          </div>

          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 12, textAlign: 'center' }}>
            Scanning automatically...
          </p>

          <button style={styles.linkBtn} onClick={() => { stopCamera(); setShowManual(true); }}>
            Can't scan? Enter code manually
          </button>

          <button style={{ ...styles.primaryBtn, background: 'rgba(255,255,255,0.1)', marginTop: 8 }} onClick={() => { stopCamera(); }}>
            Cancel
          </button>
        </div>
      )}

      {showManual && (
        <div style={styles.center}>
          <p style={{ color: 'white', fontSize: 15, fontWeight: 600, marginBottom: 6 }}>Enter SKU Code</p>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, marginBottom: 20, textAlign: 'center' }}>
            Type the code printed on the label (e.g. INV-ABC-00001)
          </p>
          <input
            style={styles.input}
            value={manualCode}
            onChange={e => setManualCode(e.target.value.toUpperCase())}
            placeholder="INV-ABC-00001"
            autoFocus
            onKeyDown={e => e.key === 'Enter' && handleManualSubmit()}
          />
          <button
            style={{ ...styles.primaryBtn, width: '100%', marginTop: 12 }}
            onClick={handleManualSubmit}
            disabled={!manualCode.trim()}
          >
            Look Up Item
          </button>
          <button style={styles.linkBtn} onClick={() => { setShowManual(false); setManualCode(''); }}>
            ← Back to camera
          </button>
        </div>
      )}
    </div>
  );
};

const styles = {
  page: {
    minHeight: '100vh',
    background: '#0b1628',
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '14px 16px',
    background: 'rgba(0,0,0,0.3)',
  },
  iconBtn: {
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
  center: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '32px 24px',
    gap: 12,
  },
  cameraIcon: {
    width: 96,
    height: 96,
    background: 'rgba(199,91,57,0.15)',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  hint: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 1.6,
    marginBottom: 8,
  },
  primaryBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: '13px 28px',
    background: '#c75b39',
    color: 'white',
    border: 'none',
    borderRadius: 10,
    cursor: 'pointer',
    fontWeight: 600,
    fontSize: 15,
    fontFamily: "'Inter', sans-serif",
    width: '100%',
    maxWidth: 320,
  },
  linkBtn: {
    background: 'none',
    border: 'none',
    color: 'rgba(255,255,255,0.4)',
    fontSize: 12,
    cursor: 'pointer',
    fontFamily: "'Inter', sans-serif",
    marginTop: 4,
    textDecoration: 'underline',
  },
  errorBox: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 8,
    color: '#f87171',
    fontSize: 12,
    padding: '10px 14px',
    background: 'rgba(239,68,68,0.1)',
    borderRadius: 8,
    maxWidth: 320,
    lineHeight: 1.5,
  },
  scannerWrap: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '20px 16px',
    gap: 8,
  },
  videoWrap: {
    position: 'relative',
    width: '100%',
    maxWidth: 340,
    aspectRatio: '1',
    borderRadius: 12,
    overflow: 'hidden',
    background: '#000',
  },
  video: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  corner: {
    position: 'absolute',
    width: 24,
    height: 24,
  },
  input: {
    width: '100%',
    maxWidth: 320,
    padding: '12px 14px',
    border: '1.5px solid rgba(255,255,255,0.2)',
    borderRadius: 10,
    background: 'rgba(255,255,255,0.08)',
    color: 'white',
    fontSize: 16,
    fontFamily: 'monospace',
    outline: 'none',
    textAlign: 'center',
    letterSpacing: '0.05em',
  },
};

export default ScanPage;
