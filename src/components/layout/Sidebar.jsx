import React, { useState, useEffect } from 'react';
import tieLogo from '../../assets/logo.jpg';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Building2,
  CalendarCheck,
  Briefcase,
  FolderKanban,
  CalendarOff,
  Banknote,
  Laptop,
  ShieldCheck,
  FileSpreadsheet,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  UserCheck,
  Award,
  X,
  GitFork,
  BarChart3,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export const Sidebar = ({ isMobileOpen, onCloseMobile }) => {
  const { userRole, canAccessModule, hasPermission, isSuperAdmin } = useAuth();
  const location = useLocation();

  // Track expanded state of dropdown menus (HRM open by default)
  const [openMenus, setOpenMenus] = useState({
    hrm: true,
    operations: false,
    masters: false,
  });

  // Prevent body scrolling when mobile drawer is open
  useEffect(() => {
    if (isMobileOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isMobileOpen]);

  // Automatically keep dropdown open if current path is inside that group
  useEffect(() => {
    const path = location.pathname;
    if (
      path.includes('/hrm') ||
      path.includes('/employees') ||
      path.includes('/attendance') ||
      path.includes('/leaves') ||
      path.includes('/payroll') ||
      path.includes('/recruitment') ||
      path.includes('/assets-claims') ||
      path.includes('/performance') ||
      path.includes('/lifecycle') ||
      path.includes('/reports')
    ) {
      setOpenMenus((prev) => ({ ...prev, hrm: true }));
    }
    if (path.includes('/operations')) {
      setOpenMenus((prev) => ({ ...prev, operations: true }));
    }
    if (path.includes('/masters')) {
      setOpenMenus((prev) => ({ ...prev, masters: true }));
    }
  }, [location.pathname]);

  const toggleMenu = (key) => {
    setOpenMenus((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  // Modern, organized Enterprise Navigation Structure with module permission bindings
  const navStructure = [
    {
      type: 'single',
      path: '/dashboard',
      label: 'Dashboard',
      icon: LayoutDashboard,
      module: 'dashboard',
    },
    {
      type: 'dropdown',
      key: 'hrm',
      label: 'HRM',
      icon: Users,
      module: 'hrm',
      items: [
        { path: '/recruitment/jobs', label: 'Recruitment & Offers', icon: Briefcase, module: 'recruitment' },
        { path: '/employees', label: 'Employee Master', icon: Users, module: 'employees' },
        { path: '/attendance', label: 'Attendance & Biometrics', icon: CalendarCheck, module: 'attendance' },
        { path: '/leaves', label: 'Leaves & Holidays', icon: CalendarOff, module: 'leaves' },
        { path: '/payroll', label: 'Payroll & Payslips', icon: Banknote, module: 'payroll' },
        { path: '/assets-claims', label: 'Assets, Claims & Loans', icon: Laptop, module: 'assets-claims' },
        { path: '/performance', label: 'Performance & KRA', icon: Award, module: 'performance' },
        { path: '/reports', label: 'Reports & Analytics', icon: BarChart3, module: 'reports' },
      ],
    },
    {
      type: 'dropdown',
      key: 'operations',
      label: 'Operations',
      icon: FolderKanban,
      module: 'operations',
      items: [
        { path: '/operations/projects', label: 'Projects & Sites', icon: FolderKanban, module: 'projects' },
        { path: '/operations/site-logs', label: 'Site Logs', icon: FileSpreadsheet, module: 'site-logs' },
        { path: '/operations/tasks', label: 'Tasks Board', icon: CheckSquare, module: 'tasks' },
      ],
    },
    {
      type: 'dropdown',
      key: 'masters',
      label: 'Organization Masters',
      icon: Building2,
      module: 'masters',
      items: [
        { path: '/masters/companies', label: 'Companies', icon: Building2, module: 'companies' },
        { path: '/masters/branches', label: 'Branches', icon: Building2, module: 'branches' },
        { path: '/masters/departments', label: 'Departments', icon: Building2, module: 'departments' },
        { path: '/masters/designations', label: 'Designations', icon: Award, module: 'designations' },
        { path: '/masters/roles', label: 'Roles & RBAC', icon: ShieldCheck, module: 'roles' },
      ],
    },
  ];

  return (
    <>
      {isMobileOpen && <div className="sidebar-backdrop" onClick={onCloseMobile} />}
      <aside className={`app-sidebar ${isMobileOpen ? 'mobile-open' : ''}`}>
        {/* Brand Header */}
        <div
          style={{
            height: 'var(--header-height)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 16px',
            borderBottom: '1px solid var(--border-color)',
            background: '#fff',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
            {/* TIE Corporation Official Logo */}
            <img
              src={tieLogo}
              alt="TIE Corporation"
              style={{
                width: 38,
                height: 38,
                borderRadius: 8,
                objectFit: 'cover',
                flexShrink: 0,
                boxShadow: '0 2px 5px rgba(0,0,0,0.08)',
              }}
            />
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <span style={{ fontWeight: 700, fontSize: '1.08rem', color: 'var(--primary)', letterSpacing: '0.01em', lineHeight: 1.2 }}>
                TIE Corporation
              </span>
            </div>
          </div>

          <button
            onClick={onCloseMobile}
            className="modal-close"
            style={{ display: isMobileOpen ? 'flex' : 'none' }}
            aria-label="Close sidebar"
          >
            <X size={18} />
          </button>
        </div>

        {/* Clean, Intuitive Menu List */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '16px 12px',
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
          }}
        >
          {navStructure.map((menu, mIdx) => {
            if (menu.type === 'single') {
              if (menu.module && !canAccessModule(menu.module)) return null;
              const Icon = menu.icon;
              return (
                <NavLink
                  key={`nav-${menu.path}-${mIdx}`}
                  to={menu.path}
                  end
                  onClick={() => {
                    if (isMobileOpen && onCloseMobile) onCloseMobile();
                  }}
                  style={({ isActive }) => ({
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '0.9rem',
                    fontWeight: isActive ? 600 : 500,
                    color: isActive ? 'var(--primary)' : 'var(--text-main)',
                    backgroundColor: isActive ? 'var(--primary-light)' : 'transparent',
                    textDecoration: 'none',
                    transition: 'all var(--transition-fast)',
                  })}
                >
                  <Icon size={19} />
                  <span>{menu.label}</span>
                </NavLink>
              );
            }

            // Dropdown Group - Filter child items by RBAC access
            const visibleItems = menu.items.filter((item) => {
              if (isSuperAdmin) return true;
              return canAccessModule(item.module);
            });

            // If user has no access to any sub-item in this group, hide the group
            if (visibleItems.length === 0) return null;

            const GroupIcon = menu.icon;
            const isOpen = !!openMenus[menu.key];
            const isAnyChildActive = visibleItems.some((item) =>
              location.pathname.startsWith(item.path)
            );

            return (
              <div key={`group-${menu.key}-${mIdx}`} style={{ marginBottom: 4 }}>
                {/* Dropdown Header Button */}
                <button
                  type="button"
                  onClick={() => toggleMenu(menu.key)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '0.9rem',
                    fontWeight: isAnyChildActive ? 600 : 500,
                    color: isAnyChildActive ? 'var(--primary)' : 'var(--text-main)',
                    backgroundColor: isAnyChildActive && !isOpen ? 'var(--primary-light)' : 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'all var(--transition-fast)',
                    textAlign: 'left',
                  }}
                  onMouseEnter={(e) => {
                    if (!isAnyChildActive) e.currentTarget.style.backgroundColor = 'var(--bg-subtle)';
                  }}
                  onMouseLeave={(e) => {
                    if (!isAnyChildActive) e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <GroupIcon size={19} color={isAnyChildActive ? 'var(--primary)' : 'inherit'} />
                    <span>{menu.label}</span>
                    {menu.badge && (
                      <span
                        style={{
                          fontSize: '0.68rem',
                          background: isAnyChildActive ? 'var(--primary)' : 'var(--primary-light)',
                          color: isAnyChildActive ? '#fff' : 'var(--primary)',
                          padding: '1px 6px',
                          borderRadius: '10px',
                          fontWeight: 600,
                          letterSpacing: '0.02em',
                        }}
                      >
                        {menu.badge}
                      </span>
                    )}
                  </div>
                  {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </button>

                {/* Dropdown Sub-Items */}
                {isOpen && (
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 2,
                      marginTop: 3,
                      paddingLeft: 22,
                      borderLeft: '2px solid var(--primary-border)',
                      marginLeft: 18,
                    }}
                  >
                    {visibleItems.map((subItem, sIdx) => {
                      const SubIcon = subItem.icon;
                      return (
                        <NavLink
                          key={`sub-${subItem.path}-${sIdx}`}
                          to={subItem.path}
                          end={subItem.exact}
                          onClick={() => {
                            if (isMobileOpen && onCloseMobile) onCloseMobile();
                          }}
                          style={({ isActive }) => ({
                            display: 'flex',
                            alignItems: 'center',
                            gap: 9,
                            padding: '8px 12px',
                            borderRadius: 'var(--radius-md)',
                            fontSize: '0.84rem',
                            fontWeight: isActive ? 600 : 500,
                            color: isActive ? 'var(--primary)' : 'var(--text-muted)',
                            backgroundColor: isActive ? 'var(--primary-light)' : 'transparent',
                            textDecoration: 'none',
                            transition: 'all var(--transition-fast)',
                          })}
                        >
                          <SubIcon size={15} />
                          <span>{subItem.label}</span>
                        </NavLink>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* User Info Footer in Sidebar */}
        <div
          style={{
            padding: '12px 16px',
            borderTop: '1px solid var(--border-color)',
            background: 'var(--bg-subtle)',
            fontSize: '0.78rem',
            color: 'var(--text-muted)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0,
          }}
        >
          <span>Role: <strong>{userRole}</strong></span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--success)', fontWeight: 600 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--success)' }} />
            Online
          </span>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
