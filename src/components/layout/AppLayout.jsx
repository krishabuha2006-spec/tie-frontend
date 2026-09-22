import React, { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';

export const AppLayout = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  // Determine title from route
  const getPageTitle = (pathname) => {
    if (pathname.includes('/dashboard')) return 'Dashboard Overview';
    if (pathname.includes('/employees')) return 'Employee Master Directory';
    if (pathname.includes('/attendance/face-punch')) return 'Biometric Face Punch';
    if (pathname.includes('/attendance/geofences')) return 'Geo-Fence Boundary Configurations';
    if (pathname.includes('/attendance/regularization')) return 'Attendance Regularization';
    if (pathname.includes('/attendance')) return 'Daily Attendance Register';
    if (pathname.includes('/masters/companies')) return 'Company Master';
    if (pathname.includes('/masters/branches')) return 'Branch Locations';
    if (pathname.includes('/masters/departments')) return 'Departments';
    if (pathname.includes('/masters/designations')) return 'Designations & Levels';
    if (pathname.includes('/masters/roles')) return 'Roles & RBAC Catalog';
    if (pathname.includes('/masters/users')) return 'System User Administration';
    if (pathname.includes('/recruitment/jobs')) return 'Job Openings';
    if (pathname.includes('/recruitment/candidates')) return 'Recruitment Pipeline & Onboarding';
    if (pathname.includes('/recruitment/templates')) return 'Letter Templates';
    if (pathname.includes('/operations/projects')) return 'Project Sites & Fences';
    if (pathname.includes('/operations/site-logs')) return 'Site Activity Logs';
    if (pathname.includes('/operations/tasks')) return 'Employee Tasks Management';
    if (pathname.includes('/leaves')) return 'Leaves & Holidays Calendar';
    if (pathname.includes('/payroll')) return 'Payroll Runs & Payslips';
    if (pathname.includes('/assets-claims')) return 'Assets, Claims & Loans';
    return 'TIE HRMS Portal';
  };

  return (
    <div className="app-layout">
      <Sidebar
        isMobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />
      <div className="app-main">
        <Header
          onToggleMobileSidebar={() => setMobileOpen(!mobileOpen)}
          title={getPageTitle(location.pathname)}
        />
        <main className="app-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AppLayout;
