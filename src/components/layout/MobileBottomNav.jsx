import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, CalendarCheck, Briefcase, Menu } from 'lucide-react';
import './MobileBottomNav.css';

export const MobileBottomNav = ({ onToggleSidebar }) => {
  const location = useLocation();

  const navItems = [
    {
      to: '/dashboard',
      label: 'Home',
      icon: LayoutDashboard,
      isActive: (path) => path.startsWith('/dashboard'),
    },
    {
      to: '/employees',
      label: 'Employees',
      icon: Users,
      isActive: (path) => path.includes('/employees') || path.includes('/masters/users'),
    },
    {
      to: '/attendance',
      label: 'Attendance',
      icon: CalendarCheck,
      isActive: (path) => path.includes('/attendance') || path.includes('/leaves') || path.includes('/holidays'),
    },
    {
      to: '/recruitment/jobs',
      label: 'Hiring',
      icon: Briefcase,
      isActive: (path) => path.includes('/recruitment'),
    },
  ];

  return (
    <nav className="mobile-bottom-nav" aria-label="Mobile Navigation">
      {navItems.map((item) => {
        const active = item.isActive(location.pathname);
        const Icon = item.icon;
        return (
          <NavLink
            key={item.to}
            to={item.to}
            className={`mobile-nav-item ${active ? 'active' : ''}`}
          >
            <div className="mobile-nav-icon-wrap">
              <Icon size={20} strokeWidth={active ? 2.5 : 1.9} />
            </div>
            <span className="mobile-nav-label">{item.label}</span>
          </NavLink>
        );
      })}

      {/* 5th item: Toggle All Modules Menu (Sidebar Drawer) */}
      <button
        type="button"
        className="mobile-nav-item"
        onClick={onToggleSidebar}
        aria-label="Open full menu"
        title="All Modules"
      >
        <div className="mobile-nav-icon-wrap">
          <Menu size={20} strokeWidth={1.9} />
        </div>
        <span className="mobile-nav-label">Menu</span>
      </button>
    </nav>
  );
};

export default MobileBottomNav;
