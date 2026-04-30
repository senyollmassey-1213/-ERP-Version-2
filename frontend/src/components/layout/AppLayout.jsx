import React, { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from 'components/layout/Sidebar';
import Header from 'components/layout/Header';

const TITLES = {
  '/dashboard': 'Dashboard',
  '/tenants': 'Companies',
  '/industries': 'Industries',
  '/platform-users': 'Platform Users',
  '/settings': 'Settings',
};

const AppLayout = () => {
  const [collapsed, setCollapsed] = useState(false);
  const { pathname } = useLocation();

  const title = TITLES[pathname] ||
    pathname.split('/').filter(Boolean).slice(-1)[0]
      ?.replace(/-/g,' ')?.replace(/\b\w/g, c => c.toUpperCase()) || 'Dashboard';

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        <Header title={title} />
        <main style={{ flex: 1, overflowY: 'auto', padding: 22 }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AppLayout;
