import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Users, Building2, ChevronLeft, ChevronRight,
  TrendingUp, ShoppingCart, Factory, Package, FileText, BarChart2,
  Archive, Warehouse, Briefcase, Settings, Shield, UserCog,
} from 'lucide-react';
import { useAuth } from 'context/AuthContext';
import { moduleAPI } from 'services/api';
import './Sidebar.css';

const ICON_MAP = {
  LayoutDashboard, Users, Building2, TrendingUp, ShoppingCart, Factory,
  Package, FileText, BarChart2, Archive, Warehouse, Briefcase, Settings, Shield,
};

const Icon = ({ name, size = 17 }) => {
  const I = ICON_MAP[name] || Package;
  return <I size={size} />;
};

const Sidebar = ({ collapsed, onToggle }) => {
  const { user, tenant, isSuperAdmin, isClientServicing } = useAuth();
  const [modules, setModules] = useState([]);

  useEffect(() => {
    if (user?.role === 'user_admin' || user?.role === 'user') {
      moduleAPI.list().then(res => {
        if (res.success) setModules(res.data);
      }).catch(() => {});
    }
  }, [user]);

  const platformNav = [
    { path: '/dashboard', icon: 'LayoutDashboard', label: 'Dashboard' },
    ...(isClientServicing ? [{ path: '/tenants', icon: 'Building2', label: 'Companies' }] : []),
    ...(isSuperAdmin ? [
      { path: '/industries', icon: 'Shield', label: 'Industries' },
      { path: '/platform-users', icon: 'UserCog', label: 'Platform Users' },
    ] : []),
  ];

  const tenantNav = [
    { path: '/dashboard', icon: 'LayoutDashboard', label: 'Dashboard' },
    ...modules
      .filter(m => m.slug !== 'dashboard' && m.slug !== 'reports')
      .map(m => ({ path: `/m/${m.slug}`, icon: m.icon || 'Package', label: m.name })),
    ...(modules.find(m => m.slug === 'reports')
      ? [{ path: '/reports', icon: 'BarChart2', label: 'Reports' }]
      : []),
  ];

  const navItems = (isSuperAdmin || isClientServicing) ? platformNav : tenantNav;

  return (
    <aside className={`sidebar ${collapsed ? 'sidebar--collapsed' : ''}`}>
      <div className="sidebar-brand">
        <div className="sidebar-logo"><span>D</span></div>
        {!collapsed && (
          <div className="sidebar-brand-text">
            <span className="sidebar-name">Drusshti</span>
            {tenant && <span className="sidebar-tenant">{tenant.name}</span>}
          </div>
        )}
        <button className="sidebar-toggle" onClick={onToggle}>
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      </div>

      {!collapsed && (
        <div className="sidebar-user">
          <div className="sidebar-avatar">
            {user?.firstName?.charAt(0)}{user?.lastName?.charAt(0)}
          </div>
          <div>
            <div className="sidebar-user-name">{user?.firstName} {user?.lastName}</div>
            <div className="sidebar-user-role">{user?.role?.replace(/_/g, ' ')}</div>
          </div>
        </div>
      )}

      {!collapsed && tenant && (
        <div className="sidebar-industry">
          <span>{tenant.industryName}</span>
        </div>
      )}

      <nav className="sidebar-nav">
        {!collapsed && <span className="nav-label">Navigation</span>}
        {navItems.map(item => (
          <NavLink key={item.path} to={item.path}
            className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''}`}
            title={collapsed ? item.label : ''}>
            <span className="item-icon"><Icon name={item.icon} /></span>
            {!collapsed && <span>{item.label}</span>}
          </NavLink>
        ))}

        {user?.role === 'user_admin' && (
          <>
            {!collapsed && <span className="nav-label" style={{ marginTop: 8 }}>Admin</span>}
            <NavLink to="/settings"
              className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''}`}
              title={collapsed ? 'Settings' : ''}>
              <span className="item-icon"><Settings size={17} /></span>
              {!collapsed && <span>Settings</span>}
            </NavLink>
          </>
        )}
      </nav>

      {!collapsed && <div className="sidebar-footer">v2.0 · Drusshti ERP</div>}
    </aside>
  );
};

export default Sidebar;
