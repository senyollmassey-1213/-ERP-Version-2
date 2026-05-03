import React from 'react';
import { useNavigate } from 'react-router-dom';
import { QrCode, Package } from 'lucide-react';
import { useAuth } from 'context/AuthContext';

const MobileHomePage = () => {
  const navigate = useNavigate();
  const { user, tenant } = useAuth();

  return (
    <div style={s.page}>
      <div style={s.header}>
        <div style={s.logo}>D</div>
        <div>
          <div style={s.appName}>Drusshti</div>
          {tenant && <div style={s.tenantName}>{tenant.name}</div>}
        </div>
      </div>

      <div style={s.greeting}>
        Hello, {user?.firstName} 👋
      </div>

      <div style={s.grid}>
        <button style={s.card} onClick={() => navigate('/scan')}>
          <QrCode size={36} color="#c75b39" />
          <span style={s.cardLabel}>Scan Item</span>
          <span style={s.cardSub}>Point camera at QR label</span>
        </button>

        <button style={s.card} onClick={() => navigate('/m/inventory')}>
          <Package size={36} color="#c75b39" />
          <span style={s.cardLabel}>Inventory</span>
          <span style={s.cardSub}>View & update stock</span>
        </button>
      </div>

      <button style={s.fullLink} onClick={() => navigate('/dashboard')}>
        Open full ERP →
      </button>
    </div>
  );
};

const s = {
  page: { minHeight: '100vh', background: '#0b1628', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 24px', fontFamily: "'Inter', sans-serif" },
  header: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 32 },
  logo: { width: 44, height: 44, background: '#c75b39', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: 20 },
  appName: { color: 'white', fontWeight: 700, fontSize: 18 },
  tenantName: { color: 'rgba(255,255,255,0.4)', fontSize: 12 },
  greeting: { color: 'rgba(255,255,255,0.7)', fontSize: 16, marginBottom: 32 },
  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, width: '100%', maxWidth: 340 },
  card: { background: 'rgba(255,255,255,0.06)', border: '1.5px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: '28px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, cursor: 'pointer' },
  cardLabel: { color: 'white', fontWeight: 600, fontSize: 15 },
  cardSub: { color: 'rgba(255,255,255,0.4)', fontSize: 11, textAlign: 'center' },
  fullLink: { marginTop: 40, background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', fontSize: 13, cursor: 'pointer', textDecoration: 'underline' },
};

export default MobileHomePage;