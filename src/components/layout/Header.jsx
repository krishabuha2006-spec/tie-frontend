import React, { useState } from 'react';
import { Menu, LogOut, Building2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import UserProfileModal from '../common/UserProfileModal';

export const Header = ({ onToggleMobileSidebar, title = 'HRMS Portal' }) => {
  const { user, userRole, company, branch, logout } = useAuth();
  const [profileOpen, setProfileOpen] = useState(false);

  const getInitials = (name) => {
    if (!name) return 'U';
    const parts = name.trim().split(' ');
    return parts.map((p) => p[0]).join('').substring(0, 2).toUpperCase();
  };

  return (
    <header className="app-header">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
        {/* Mobile / Tablet Hamburger Toggle */}
        <button
          type="button"
          onClick={onToggleMobileSidebar}
          className="header-menu-btn"
          aria-label="Toggle navigation menu"
          title="Toggle navigation"
        >
          <Menu size={22} />
        </button>

        <div style={{ minWidth: 0 }}>
          <h2 className="header-brand-title" style={{ fontSize: '1.15rem', fontWeight: 600, color: 'var(--text-main)', margin: 0 }}>
            {title}
          </h2>
          {(company || branch) && (
            <div className="header-company-sub" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.76rem', color: 'var(--text-muted)' }}>
              <Building2 size={12} />
              <span>{company?.name || 'TIE Technologies'}</span>
              {branch && <span>• {branch?.name}</span>}
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>

        {/* User Badge - Clickable to open Profile */}
        <div
          onClick={() => setProfileOpen(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            cursor: 'pointer',
            padding: '4px 6px',
            borderRadius: 8,
            transition: 'background-color 0.2s',
          }}
          title="Click to view/edit profile & settings"
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.04)')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
        >
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: '50%',
              backgroundColor: 'var(--primary)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 600,
              fontSize: '0.85rem',
              flexShrink: 0,
            }}
          >
            {getInitials(user?.name)}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
            <span className="header-user-name" style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-main)' }}>
              {user?.name || 'User'}
            </span>
            <span className="header-user-role" style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
              {userRole}
            </span>
          </div>
        </div>

        {/* Logout */}
        <button
          onClick={logout}
          className="btn btn-secondary btn-icon-only"
          title="Sign out"
          aria-label="Sign out"
        >
          <LogOut size={16} color="var(--danger)" />
        </button>
      </div>

      <UserProfileModal isOpen={profileOpen} onClose={() => setProfileOpen(false)} />
    </header>
  );
};

export default Header;
