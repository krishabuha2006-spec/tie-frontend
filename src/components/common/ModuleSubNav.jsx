import React from 'react';
import { NavLink } from 'react-router-dom';

export const ModuleSubNav = ({ items }) => {
  if (!items || !items.length) return null;

  return (
    <div className="module-subnav" role="navigation" aria-label="Module Sub-navigation">
      {items.map((tab) => {
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
