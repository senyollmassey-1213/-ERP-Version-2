import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authAPI } from 'services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser]     = useState(null);
  const [tenant, setTenant] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      const token = localStorage.getItem('drush_token');
      const saved = localStorage.getItem('drush_user');
      if (token && saved) {
        try {
          const parsed = JSON.parse(saved);
          setUser(parsed);
          setTenant(parsed.tenant || null);
          applyBranding(parsed.tenant);
          const res = await authAPI.getProfile();
          if (res.success) {
            setUser(res.data);
            setTenant(res.data.tenant || null);
            applyBranding(res.data.tenant);
            localStorage.setItem('drush_user', JSON.stringify(res.data));
          }
        } catch { logout(); }
      }
      setLoading(false);
    };
    init();
  }, []);

  const applyBranding = (t) => {
    const root = document.documentElement;
    root.style.setProperty('--color-primary',   t?.primaryColor   || '#0b1628');
    root.style.setProperty('--color-secondary', t?.secondaryColor || '#c75b39');
  };

  const login = useCallback(async (email, password, tenantSlug) => {
    const res = await authAPI.login(email, password, tenantSlug);
    if (res.success) {
      const { token, user: u } = res.data;
      localStorage.setItem('drush_token', token);
      localStorage.setItem('drush_user', JSON.stringify(u));
      setUser(u);
      setTenant(u.tenant || null);
      applyBranding(u.tenant);
    }
    return res;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('drush_token');
    localStorage.removeItem('drush_user');
    setUser(null);
    setTenant(null);
    applyBranding(null);
  }, []);

  const isSuperAdmin      = user?.role === 'super_admin';
  const isClientServicing = ['super_admin','client_servicing'].includes(user?.role);
  const isUserAdmin       = ['super_admin','client_servicing','user_admin'].includes(user?.role);
  const isTenantUser      = ['user_admin','user'].includes(user?.role);
  const isAuthenticated   = !!localStorage.getItem('drush_token') && !!user;

  return (
    <AuthContext.Provider value={{
      user, tenant, loading,
      login, logout,
      isSuperAdmin, isClientServicing, isUserAdmin, isTenantUser,
      isAuthenticated,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
};
