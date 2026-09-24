import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from '../components/layout/ProtectedRoute';
import AppLayout from '../components/layout/AppLayout';

// Auth Pages
import Login from '../pages/auth/Login';

// Dashboard
import Dashboard from '../pages/dashboard/Dashboard';

// Employee Master
import EmployeeList from '../pages/employees/EmployeeList';

// Attendance & Bio
import DailyAttendance from '../pages/attendance/DailyAttendance';
import FacePunch from '../pages/attendance/FacePunch';
import OfficeCheckIn from '../pages/attendance/OfficeCheckIn';
import OfficeCheckOut from '../pages/attendance/OfficeCheckOut';
import GeoFences from '../pages/attendance/GeoFences';
import Regularization from '../pages/attendance/Regularization';
import TimingRules from '../pages/attendance/TimingRules';
import FieldAttendance from '../pages/attendance/FieldAttendance';
import SiteAttendance from '../pages/attendance/SiteAttendance';

// Masters
import Companies from '../pages/masters/Companies';
import Branches from '../pages/masters/Branches';
import Departments from '../pages/masters/Departments';
import Designations from '../pages/masters/Designations';
import RolesPermissions from '../pages/masters/RolesPermissions';
import Users from '../pages/masters/Users';

// Recruitment
import JobOpenings from '../pages/recruitment/JobOpenings';
import Candidates from '../pages/recruitment/Candidates';
import LetterTemplates from '../pages/recruitment/LetterTemplates';

// Operations
import ProjectsSites from '../pages/operations/ProjectsSites';
import SiteLogs from '../pages/operations/SiteLogs';
import Tasks from '../pages/operations/Tasks';

// Leaves, Payroll, Assets & Performance
import LeavesHolidays from '../pages/leaves/LeavesHolidays';
import PayrollPayslips from '../pages/payroll/PayrollPayslips';
import AssetsClaimsLoans from '../pages/assets-claims/AssetsClaimsLoans';
import PerformanceReviews from '../pages/performance/PerformanceReviews';

// Lifecycle Transitions, Reports & Analytics, System Integration
import LifecycleEvents from '../pages/lifecycle/LifecycleEvents';
import ReportsAnalytics from '../pages/reports/ReportsAnalytics';
import IntegrationCenter from '../pages/integration/IntegrationCenter';

export const AppRoutes = () => {
  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/login" element={<Login />} />
      <Route path="/reset-password" element={<Login />} />
      <Route path="/reset-password/:token" element={<Login />} />

      {/* Protected HRMS Application */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />

        {/* HRM Module Routes & Aliases */}
        <Route path="hrm" element={<Navigate to="/employees" replace />} />
        <Route path="hrm/employees" element={<Navigate to="/employees" replace />} />
        <Route path="hrm/attendance" element={<Navigate to="/attendance" replace />} />
        <Route path="hrm/leaves" element={<Navigate to="/leaves" replace />} />
        <Route path="hrm/payroll" element={<Navigate to="/payroll" replace />} />
        <Route path="hrm/recruitment" element={<Navigate to="/recruitment/jobs" replace />} />
        <Route path="hrm/assets-claims" element={<Navigate to="/assets-claims" replace />} />

        {/* Backend Menu Aliases (/hrms/*, /admin/*, /project/*, /accounting) */}
        <Route path="hrms" element={<Navigate to="/employees" replace />} />
        <Route path="hrms/employees" element={<Navigate to="/employees" replace />} />
        <Route path="hrms/attendance" element={<Navigate to="/attendance" replace />} />
        <Route path="hrms/leaves" element={<Navigate to="/leaves" replace />} />
        <Route path="hrms/payroll" element={<Navigate to="/payroll" replace />} />
        <Route path="hrms/kra" element={<Navigate to="/performance" replace />} />
        <Route path="hrms/assets" element={<Navigate to="/assets-claims" replace />} />
        <Route path="hrm/kra" element={<Navigate to="/performance" replace />} />
        <Route path="hrm/assets" element={<Navigate to="/assets-claims" replace />} />
        <Route path="admin" element={<Navigate to="/masters/companies" replace />} />
        <Route path="admin/roles" element={<Navigate to="/masters/roles" replace />} />
        <Route path="admin/users" element={<Navigate to="/masters/users" replace />} />
        <Route path="admin/settings" element={<Navigate to="/masters/companies" replace />} />
        <Route path="project" element={<Navigate to="/operations/projects" replace />} />
        <Route path="project/tasks" element={<Navigate to="/operations/tasks" replace />} />
        <Route path="project/attendance" element={<Navigate to="/attendance/site" replace />} />
        <Route path="accounting" element={<Navigate to="/payroll" replace />} />

        {/* Employees */}
        <Route
          path="employees"
          element={
            <ProtectedRoute module="employees">
              <EmployeeList />
            </ProtectedRoute>
          }
        />

        {/* Attendance */}
        <Route
          path="attendance"
          element={
            <ProtectedRoute module="attendance">
              <DailyAttendance />
            </ProtectedRoute>
          }
        />
        <Route
          path="attendance/face-punch"
          element={
            <ProtectedRoute module="attendance">
              <FacePunch />
            </ProtectedRoute>
          }
        />
        <Route
          path="attendance/office-checkin"
          element={
            <ProtectedRoute module="attendance">
              <OfficeCheckIn />
            </ProtectedRoute>
          }
        />
        <Route
          path="attendance/office-checkout"
          element={
            <ProtectedRoute module="attendance">
              <OfficeCheckOut />
            </ProtectedRoute>
          }
        />
        <Route
          path="attendance/field"
          element={
            <ProtectedRoute module="attendance">
              <FieldAttendance />
            </ProtectedRoute>
          }
        />
        <Route
          path="attendance/site"
          element={
            <ProtectedRoute module="attendance">
              <SiteAttendance />
            </ProtectedRoute>
          }
        />
        <Route
          path="attendance/geofences"
          element={
            <ProtectedRoute module="attendance">
              <GeoFences />
            </ProtectedRoute>
          }
        />
        <Route
          path="attendance/timing-rules"
          element={
            <ProtectedRoute module="attendance">
              <TimingRules />
            </ProtectedRoute>
          }
        />
        <Route
          path="attendance/regularization"
          element={
            <ProtectedRoute module="attendance">
              <Regularization />
            </ProtectedRoute>
          }
        />

        {/* Organization Masters */}
        <Route path="companies" element={<Navigate to="/masters/companies" replace />} />
        <Route path="masters" element={<Navigate to="/masters/companies" replace />} />
        <Route
          path="masters/companies"
          element={
            <ProtectedRoute module="companies">
              <Companies />
            </ProtectedRoute>
          }
        />
        <Route
          path="masters/branches"
          element={
            <ProtectedRoute module="branches">
              <Branches />
            </ProtectedRoute>
          }
        />
        <Route
          path="masters/departments"
          element={
            <ProtectedRoute module="departments">
              <Departments />
            </ProtectedRoute>
          }
        />
        <Route
          path="masters/designations"
          element={
            <ProtectedRoute module="designations">
              <Designations />
            </ProtectedRoute>
          }
        />
        <Route
          path="masters/roles"
          element={
            <ProtectedRoute module="roles">
              <RolesPermissions />
            </ProtectedRoute>
          }
        />
        <Route
          path="masters/users"
          element={
            <ProtectedRoute module="users">
              <Users />
            </ProtectedRoute>
          }
        />

        {/* Recruitment */}
        <Route path="recruitment" element={<Navigate to="/recruitment/jobs" replace />} />
        <Route
          path="recruitment/jobs"
          element={
            <ProtectedRoute module="recruitment">
              <JobOpenings />
            </ProtectedRoute>
          }
        />
        <Route
          path="recruitment/candidates"
          element={
            <ProtectedRoute module="recruitment">
              <Candidates />
            </ProtectedRoute>
          }
        />
        <Route
          path="recruitment/templates"
          element={
            <ProtectedRoute module="recruitment">
              <LetterTemplates />
            </ProtectedRoute>
          }
        />

        {/* Operations */}
        <Route path="operations" element={<Navigate to="/operations/projects" replace />} />
        <Route
          path="operations/projects"
          element={
            <ProtectedRoute module="projects">
              <ProjectsSites />
            </ProtectedRoute>
          }
        />
        <Route
          path="operations/site-logs"
          element={
            <ProtectedRoute module="site-logs">
              <SiteLogs />
            </ProtectedRoute>
          }
        />
        <Route
          path="operations/tasks"
          element={
            <ProtectedRoute module="tasks">
              <Tasks />
            </ProtectedRoute>
          }
        />

        {/* Leaves, Payroll, Assets & Performance */}
        <Route
          path="leaves"
          element={
            <ProtectedRoute module="leaves">
              <LeavesHolidays />
            </ProtectedRoute>
          }
        />
        <Route
          path="payroll"
          element={
            <ProtectedRoute module="payroll">
              <PayrollPayslips />
            </ProtectedRoute>
          }
        />
        <Route
          path="payroll/payslips"
          element={
            <ProtectedRoute module="payroll">
              <PayrollPayslips defaultTab="payslips" />
            </ProtectedRoute>
          }
        />
        <Route
          path="assets-claims"
          element={
            <ProtectedRoute module="assets-claims">
              <AssetsClaimsLoans />
            </ProtectedRoute>
          }
        />
        <Route
          path="performance"
          element={
            <ProtectedRoute module="performance">
              <PerformanceReviews />
            </ProtectedRoute>
          }
        />
        <Route path="hrm/performance" element={<Navigate to="/performance" replace />} />

        {/* Lifecycle Transitions (Module 22) */}
        <Route
          path="lifecycle"
          element={
            <ProtectedRoute module="lifecycle">
              <LifecycleEvents />
            </ProtectedRoute>
          }
        />
        <Route path="hrm/lifecycle" element={<Navigate to="/lifecycle" replace />} />

        {/* HR Reports & Analytics (Module 23) */}
        <Route
          path="reports"
          element={
            <ProtectedRoute module="reports">
              <ReportsAnalytics />
            </ProtectedRoute>
          }
        />
        <Route path="hrm/reports" element={<Navigate to="/reports" replace />} />

        {/* HRMS Cross-Module Integration Layer (Module 24) */}
        <Route
          path="integration"
          element={
            <ProtectedRoute module="masters">
              <IntegrationCenter />
            </ProtectedRoute>
          }
        />
        <Route path="masters/integration" element={<Navigate to="/integration" replace />} />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
};

export default AppRoutes;
