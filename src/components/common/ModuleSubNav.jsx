import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export const ModuleSubNav = ({ items }) => {
  const { canAccessModule, isSuperAdmin } = useAuth();
  if (!items || !items.length) return null;

  const visibleItems = items.filter((tab) => {
    if (isSuperAdmin) return true;
    if (!tab.module) return true;
    return canAccessModule(tab.module);
  });

  if (visibleItems.length === 0) return null;

  return (
    <div className="module-subnav" role="navigation" aria-label="Module Sub-navigation">
      {visibleItems.map((tab) => {
        const Icon = tab.icon;
        return (
          <NavLink
            key={tab.path}
            to={tab.path}
            end={tab.exact !== false}
            className={({ isActive }) =>
              `module-subnav-tab ${isActive ? 'active' : ''}`
            }
          >
            {Icon && <Icon size={16} />}
            <span>{tab.label}</span>
          </NavLink>
        );
      })}
    </div>
  );
};

export default ModuleSubNav;
