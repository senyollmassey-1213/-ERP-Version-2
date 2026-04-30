import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, LogOut, Settings, ChevronDown } from 'lucide-react';
import { useAuth } from 'context/AuthContext';
import toast from 'react-hot-toast';
import './Header.css';

const Header = ({ title }) => {
  const { user, tenant, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const handleLogout = () => { logout(); toast.success('Logged out'); navigate('/login'); };

  return (
    <header className="header">
      <h1 className="header-title">{title}</h1>
      <div className="header-right">
        <div className="header-user" onClick={() => setOpen(!open)}>
          <div className="header-avatar">{user?.firstName?.charAt(0)}{user?.lastName?.charAt(0)}</div>
          {!open && (
            <div className="header-user-info">
              <span>{user?.firstName} {user?.lastName}</span>
              <span className="header-role">{user?.role?.replace(/_/g,' ')}</span>
            </div>
          )}
          <ChevronDown size={13} className={`hchevron ${open ? 'rotated' : ''}`} />
        </div>

        {open && (
          <>
            <div className="dropdown-overlay" onClick={() => setOpen(false)} />
            <div className="header-dropdown">
              <div className="dropdown-info">
                <p className="di-name">{user?.firstName} {user?.lastName}</p>
                <p className="di-email">{user?.email}</p>
                {tenant && <p className="di-tenant">{tenant.name} · {tenant.industryName}</p>}
              </div>
              <div className="dropdown-divider" />
              <button className="dropdown-item" onClick={() => { navigate('/settings'); setOpen(false); }}>
                <Settings size={14} /> Settings
              </button>
              <button className="dropdown-item danger" onClick={handleLogout}>
                <LogOut size={14} /> Sign Out
              </button>
            </div>
          </>
        )}
      </div>
    </header>
  );
};

export default Header;
