import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from 'context/AuthContext';

import AppLayout      from 'components/layout/AppLayout';
import LoginPage      from 'pages/LoginPage';
import Dashboard      from 'pages/Dashboard';
import TenantsPage    from 'pages/TenantsPage';
import IndustriesPage from 'pages/IndustriesPage';
import PlatformUsersPage from 'pages/PlatformUsersPage';
import SettingsPage   from 'pages/SettingsPage';
import ModulePage     from 'pages/ModulePage';

const Loader = () => (
  <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center' }}>
    <div className="spinner" />
  </div>
);

// Generic protected route
const Protected = ({ children, allow }) => {
  const { isAuthenticated, loading, user } = useAuth();
  if (loading) return <Loader />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (allow && user && !allow.includes(user.role)) return <Navigate to="/dashboard" replace />;
  return children;
};

const AppRoutes = () => {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return <Loader />;

  return (
    <Routes>
      <Route path="/login" element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <LoginPage />} />

      <Route element={<Protected><AppLayout /></Protected>}>
        <Route path="/dashboard" element={<Dashboard />} />

        {/* Platform routes */}
        <Route path="/tenants" element={
          <Protected allow={['super_admin','client_servicing']}><TenantsPage /></Protected>
        } />
        <Route path="/industries" element={
          <Protected allow={['super_admin']}><IndustriesPage /></Protected>
        } />
        <Route path="/platform-users" element={
          <Protected allow={['super_admin']}><PlatformUsersPage /></Protected>
        } />

        {/* Tenant routes */}
        <Route path="/m/:moduleSlug" element={
          <Protected allow={['user_admin','user']}><ModulePage /></Protected>
        } />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>

      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
};

const App = () => (
  <AuthProvider>
    <BrowserRouter>
      <AppRoutes />
      <Toaster
        position="top-right"
        toastOptions={{
          style: { fontFamily: 'var(--font)', fontSize: 13, borderRadius: 10, boxShadow: 'var(--shadow-md)' },
          success: { iconTheme: { primary: '#22c55e', secondary: '#fff' } },
          error:   { iconTheme: { primary: '#ef4444', secondary: '#fff' } },
        }}
      />
    </BrowserRouter>
  </AuthProvider>
);

export default App;
