import React, { useState, useRef, useEffect } from 'react';
import { Menu, LogOut, Building2, MapPin, ChevronDown, Check, Search, Loader2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import UserProfileModal from '../common/UserProfileModal';
import CompanySwitcherModal from '../common/CompanySwitcherModal';
import './Header.css';

export const Header = ({ onToggleMobileSidebar, title = 'HRMS Portal' }) => {
  const {
    user,
    userRole,
    company,
    branch,
    logout,
    accessibleCompanies = [],
    accessibleBranches = [],
    selectCompany,
    selectBranch,
  } = useAuth();

  const [profileOpen, setProfileOpen] = useState(false);
  const [switcherModalOpen, setSwitcherModalOpen] = useState(false);
  const [switchingCompany, setSwitchingCompany] = useState(false);

  // Custom Dropdown Open States
  const [companyMenuOpen, setCompanyMenuOpen] = useState(false);
  const [branchMenuOpen, setBranchMenuOpen] = useState(false);

  const companyRef = useRef(null);
  const branchRef = useRef(null);

  // Close dropdowns on outside click or Escape key
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (companyRef.current && !companyRef.current.contains(e.target)) {
        setCompanyMenuOpen(false);
      }
      if (branchRef.current && !branchRef.current.contains(e.target)) {
        setBranchMenuOpen(false);
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setCompanyMenuOpen(false);
        setBranchMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const getInitials = (name) => {
    if (!name) return 'U';
    const parts = name.trim().split(' ');
    return parts.map((p) => p[0]).join('').substring(0, 2).toUpperCase();
  };

  const handleSelectCompany = async (compId) => {
    setCompanyMenuOpen(false);
    const currentCompId = company?._id || company?.id || (typeof company === 'string' ? company : '');
    if (!compId || compId === currentCompId) return;

    setSwitchingCompany(true);
    try {
      await selectCompany(compId);
    } catch (err) {
      console.warn('Company switch notice:', err?.message || err);
    } finally {
      setSwitchingCompany(false);
    }
  };

  const handleSelectBranch = (brId) => {
    setBranchMenuOpen(false);
    selectBranch(brId);
  };

  const currentCompanyId = company?._id || company?.id || (typeof company === 'string' ? company : '');
  const currentBranchId = branch?._id || branch?.id || (typeof branch === 'string' ? branch : '');

  const currentCompanyName = company?.name || 'TIE Corporation';
  const currentBranchDisplayName =
    branch?.name
      ? `${branch.name}${branch.city ? ' - ' + branch.city : ''}`
      : accessibleBranches[0]?.name
      ? `${accessibleBranches[0].name}${accessibleBranches[0].city ? ' - ' + accessibleBranches[0].city : ''}`
      : 'Main Branch';

  const hasMultipleCompanies = accessibleCompanies.length > 1;
  const hasMultipleBranches = accessibleBranches.length > 1;

  return (
    <header className="app-header">
      <div className="header-main-bar">
        {/* Left Section: Mobile Menu + Title */}
        <div className="header-left-col">
          {/* Mobile / Tablet Hamburger Toggle */}
          <button
            type="button"
            onClick={onToggleMobileSidebar}
            className="header-menu-btn"
            aria-label="Toggle navigation menu"
            title="Toggle navigation"
          >
            <Menu size={20} />
          </button>

          <h1 className="header-brand-title" title={title}>{title}</h1>
        </div>

        {/* Scope Context: Company & Branch (Desktop inline / Mobile sub-tier) */}
        {(company || branch || accessibleCompanies.length > 0) && (
          <div className="header-context-strip">
            {/* Company Selector Pill */}
            <div className="header-context-pill-wrap" ref={companyRef}>
              <button
                type="button"
                className={`header-context-pill ${companyMenuOpen ? 'active' : ''} ${!hasMultipleCompanies ? 'disabled' : ''}`}
                onClick={() => {
                  if (hasMultipleCompanies) {
                    setCompanyMenuOpen(!companyMenuOpen);
                    setBranchMenuOpen(false);
                  } else {
                    setSwitcherModalOpen(true);
                  }
                }}
                title={hasMultipleCompanies ? 'Click to switch company' : 'Current company'}
                aria-expanded={companyMenuOpen}
              >
                {switchingCompany ? (
                  <Loader2 size={13} className="header-pill-icon company animate-spin" />
                ) : (
                  <Building2 size={13} className="header-pill-icon company" />
                )}
                <span className="header-pill-text">{currentCompanyName}</span>
                {hasMultipleCompanies && (
                  <ChevronDown size={11} className={`header-pill-chevron ${companyMenuOpen ? 'rotated' : ''}`} />
                )}
              </button>

              {/* Company Floating Dropdown */}
              {companyMenuOpen && (
                <div className="header-dropdown-menu">
                  <div className="header-dropdown-header">
                    <span>Switch Company</span>
                    <span style={{ fontSize: '0.65rem' }}>{accessibleCompanies.length} available</span>
                  </div>

                  <div className="header-dropdown-list">
                    {accessibleCompanies.map((c) => {
                      const cid = c._id || c.id;
                      const isSelected = String(cid) === String(currentCompanyId);
                      return (
                        <button
                          key={cid}
                          type="button"
                          className={`header-dropdown-item ${isSelected ? 'selected' : ''}`}
                          onClick={() => handleSelectCompany(cid)}
                        >
                          <div className="header-dropdown-item-left">
                            <Building2 size={14} style={{ opacity: isSelected ? 1 : 0.6 }} />
                            <span className="header-dropdown-item-text">{c.name}</span>
                            {c.code && <span className="header-badge-tag">{c.code}</span>}
                          </div>
                          {isSelected && <Check size={14} />}
                        </button>
                      );
                    })}
                  </div>

                  <button
                    type="button"
                    className="header-dropdown-footer-btn"
                    onClick={() => {
                      setCompanyMenuOpen(false);
                      setSwitcherModalOpen(true);
                    }}
                  >
                    <Search size={13} />
                    <span>Search & Switch Company...</span>
                  </button>
                </div>
              )}
            </div>

            {/* Separator Dot */}
            <span className="header-context-sep">•</span>

            {/* Branch Selector Pill */}
            <div className="header-context-pill-wrap" ref={branchRef}>
              <button
                type="button"
                className={`header-context-pill ${branchMenuOpen ? 'active' : ''} ${!hasMultipleBranches ? 'disabled' : ''}`}
                onClick={() => {
                  if (hasMultipleBranches) {
                    setBranchMenuOpen(!branchMenuOpen);
                    setCompanyMenuOpen(false);
                  }
                }}
                title={hasMultipleBranches ? 'Click to switch branch' : 'Current branch'}
                aria-expanded={branchMenuOpen}
              >
                <MapPin size={12} className="header-pill-icon branch" />
                <span className="header-pill-text">{currentBranchDisplayName}</span>
                {hasMultipleBranches && (
                  <ChevronDown size={11} className={`header-pill-chevron ${branchMenuOpen ? 'rotated' : ''}`} />
                )}
              </button>

              {/* Branch Floating Dropdown */}
              {branchMenuOpen && (
                <div className="header-dropdown-menu">
                  <div className="header-dropdown-header">
                    <span>Active Branch</span>
                    <span style={{ fontSize: '0.65rem' }}>{accessibleBranches.length} branches</span>
                  </div>

                  <div className="header-dropdown-list">
                    {accessibleBranches.map((b) => {
                      const bid = b._id || b.id;
                      const isSelected = String(bid) === String(currentBranchId);
                      return (
                        <button
                          key={bid}
                          type="button"
                          className={`header-dropdown-item ${isSelected ? 'selected' : ''}`}
                          onClick={() => handleSelectBranch(bid)}
                        >
                          <div className="header-dropdown-item-left">
                            <MapPin size={13} style={{ opacity: isSelected ? 1 : 0.6 }} />
                            <span className="header-dropdown-item-text">{b.name}</span>
                            {b.city && <span className="header-badge-tag">{b.city}</span>}
                          </div>
                          {isSelected && <Check size={14} />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Right Section: User Profile & Actions */}
        <div className="header-right-col">
          {/* User Card - Clickable to open Profile */}
          <button
            type="button"
            onClick={() => setProfileOpen(true)}
            className="header-user-btn"
            title="Click to view/edit profile & settings"
          >
            <div className="header-user-avatar">
              {getInitials(user?.name)}
            </div>
            <div className="header-user-info">
              <span className="header-user-name">
                {user?.name || 'User'}
              </span>
              <span className="header-user-role">
                {userRole || 'Employee'}
              </span>
            </div>
          </button>

          {/* Logout Button */}
          <button
            type="button"
            onClick={logout}
            className="header-logout-btn"
            title="Sign out"
            aria-label="Sign out"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>


      <UserProfileModal isOpen={profileOpen} onClose={() => setProfileOpen(false)} />
      <CompanySwitcherModal isOpen={switcherModalOpen} onClose={() => setSwitcherModalOpen(false)} />
    </header>
  );
};

export default Header;
