import React, { useRef, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Camera, AlertCircle } from 'lucide-react';

const ScanPage = () => {
  const navigate = useNavigate();
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef = useRef(null);
  const [mode, setMode] = useState('idle'); // idle | scanning | manual
  const [error, setError] = useState('');
  const [manualCode, setManualCode] = useState('');

  useEffect(() => {
    return () => { stopCamera(); };
  }, []);

  const stopCamera = () => {
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
    if (videoRef.current) { videoRef.current.srcObject = null; }
  };

  const startCamera = async () => {
    setError('');
    setMode('scanning');

    setTimeout(async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });

        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.setAttribute('playsinline', true);
          videoRef.current.muted = true;

          await videoRef.current.play().catch(e => console.log('Play error:', e));

          videoRef.current.onloadedmetadata = () => { startDetection(); };
          if (videoRef.current.readyState >= 2) { startDetection(); }
        }
      } catch (err) {
        setMode('idle');
        if (err.name === 'NotAllowedError') {
          setError('Camera permission denied. Please allow camera access in your browser settings.');
        } else if (err.name === 'NotFoundError') {
          setError('No camera found on this device.');
        } else {
          setError('Could not open camera: ' + err.message);
        }
      }
    }, 200);
  };

  const startDetection = () => {
    if (!('BarcodeDetector' in window)) {
      setMode('manual');
      stopCamera();
      return;
    }

    const detector = new window.BarcodeDetector({ formats: ['qr_code'] });

    const scan = async () => {
      if (!videoRef.current || !streamRef.current) return;
      if (videoRef.current.readyState < 2) { rafRef.current = requestAnimationFrame(scan); return; }

      try {
        const barcodes = await detector.detect(videoRef.current);
        if (barcodes.length > 0) {
          const code = barcodes[0].rawValue;
          stopCamera();
          navigate(`/scan/review/${encodeURIComponent(code)}`);
          return;
        }
      } catch (e) {}

      rafRef.current = requestAnimationFrame(scan);
    };

    rafRef.current = requestAnimationFrame(scan);
  };

  const handleManualSubmit = () => {
    const code = manualCode.trim().toUpperCase();
    if (!code) return;
    navigate(`/scan/review/${encodeURIComponent(code)}`);
  };

  const handleBack = () => { stopCamera(); navigate(-1); };

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <button style={styles.iconBtn} onClick={handleBack}><X size={20} color="white" /></button>
        <h2 style={styles.title}>Scan Item</h2>
        <div style={{ width: 36 }} />
      </div>

      {mode === 'idle' && (
        <div style={styles.center}>
          <div style={styles.cameraCircle}><Camera size={48} color="#c75b39" /></div>
          <p style={styles.hint}>Tap below to open camera and scan a Drusshti QR label</p>
          {error && (
            <div style={styles.errorBox}>
              <AlertCircle size={15} style={{ flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}
          <button style={styles.primaryBtn} onClick={startCamera}>
            <Camera size={18} /> Open Camera
          </button>
          <button style={styles.linkBtn} onClick={() => setMode('manual')}>
            Enter code manually instead
          </button>
        </div>
      )}

      {mode === 'scanning' && (
        <div style={styles.scannerWrap}>
          <p style={styles.hint}>Point camera at the QR code on the label</p>
          <div style={styles.videoContainer}>
            <video ref={videoRef} style={styles.video} autoPlay playsInline muted />
            <div style={{ ...styles.corner, top: 12, left: 12, borderTop: '3px solid #c75b39', borderLeft: '3px solid #c75b39' }} />
            <div style={{ ...styles.corner, top: 12, right: 12, borderTop: '3px solid #c75b39', borderRight: '3px solid #c75b39' }} />
            <div style={{ ...styles.corner, bottom: 12, left: 12, borderBottom: '3px solid #c75b39', borderLeft: '3px solid #c75b39' }} />
            <div style={{ ...styles.corner, bottom: 12, right: 12, borderBottom: '3px solid #c75b39', borderRight: '3px solid #c75b39' }} />
          </div>
          <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12, marginTop: 10 }}>Scanning automatically...</p>
          <button style={styles.linkBtn} onClick={() => { stopCamera(); setMode('manual'); }}>
            Can't scan? Enter code manually
          </button>
          <button style={{ ...styles.primaryBtn, background: 'rgba(255,255,255,0.08)', marginTop: 4 }}
            onClick={() => { stopCamera(); setMode('idle'); }}>
            Cancel
          </button>
        </div>
      )}

      {mode === 'manual' && (
        <div style={styles.center}>
          <p style={{ color: 'white', fontSize: 16, fontWeight: 600, marginBottom: 4 }}>Enter SKU Code</p>
          <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12, marginBottom: 20, textAlign: 'center', lineHeight: 1.6 }}>
            Type the code printed on the label e.g. INV-ABC-00001
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
            style={{ ...styles.primaryBtn, marginTop: 12, opacity: manualCode.trim() ? 1 : 0.5 }}
            onClick={handleManualSubmit}
            disabled={!manualCode.trim()}
          >
            Look Up Item
          </button>
          <button style={styles.linkBtn} onClick={() => { setMode('idle'); setManualCode(''); }}>
            ← Try camera again
          </button>
        </div>
      )}
    </div>
  );
};

const styles = {
  page: { minHeight: '100vh', background: '#0b1628', display: 'flex', flexDirection: 'column', fontFamily: "'Inter', sans-serif" },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', background: 'rgba(0,0,0,0.3)' },
  iconBtn: { background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 8, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' },
  title: { color: 'white', fontSize: 17, fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, margin: 0 },
  center: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 24px', gap: 10 },
  cameraCircle: { width: 100, height: 100, background: 'rgba(199,91,57,0.12)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 8, border: '2px solid rgba(199,91,57,0.3)' },
  hint: { color: 'rgba(255,255,255,0.5)', fontSize: 13, textAlign: 'center', lineHeight: 1.6, maxWidth: 280, margin: 0 },
  errorBox: { display: 'flex', alignItems: 'flex-start', gap: 8, color: '#f87171', fontSize: 12, padding: '10px 14px', background: 'rgba(239,68,68,0.12)', borderRadius: 8, maxWidth: 300, lineHeight: 1.5, border: '1px solid rgba(239,68,68,0.2)' },
  primaryBtn: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '13px 24px', background: '#c75b39', color: 'white', border: 'none', borderRadius: 10, cursor: 'pointer', fontWeight: 600, fontSize: 15, fontFamily: "'Inter', sans-serif", width: '100%', maxWidth: 300 },
  linkBtn: { background: 'none', border: 'none', color: 'rgba(255,255,255,0.35)', fontSize: 12, cursor: 'pointer', fontFamily: "'Inter', sans-serif", padding: '4px 0', textDecoration: 'underline' },
  scannerWrap: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '16px', gap: 6 },
  videoContainer: { position: 'relative', width: '100%', maxWidth: 360, aspectRatio: '4/3', borderRadius: 12, overflow: 'hidden', background: '#111', border: '1px solid rgba(255,255,255,0.1)' },
  video: { width: '100%', height: '100%', objectFit: 'cover', display: 'block' },
  corner: { position: 'absolute', width: 22, height: 22 },
  input: { width: '100%', maxWidth: 300, padding: '13px 16px', border: '1.5px solid rgba(255,255,255,0.15)', borderRadius: 10, background: 'rgba(255,255,255,0.06)', color: 'white', fontSize: 16, fontFamily: 'monospace', outline: 'none', textAlign: 'center', letterSpacing: '0.08em' },
};

export default ScanPage;
