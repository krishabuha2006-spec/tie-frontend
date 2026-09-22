import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  Users,
  Building2,
  CalendarCheck,
  Briefcase,
  CalendarOff,
  ScanFace,
  ArrowRight,
  TrendingUp,
  RefreshCw,
  Clock,
  Shield,
  CheckCircle2,
  Layers,
  FileText,
} from 'lucide-react';
import employeeApi from '../../api/employeeApi';
import masterApi from '../../api/masterApi';
import attendanceApi from '../../api/attendanceApi';
import recruitmentApi from '../../api/recruitmentApi';
import leaveHolidayApi from '../../api/leaveHolidayApi';
import { payrollApi } from '../../api/payrollApi';
import { assetsLoansApi } from '../../api/assetsLoansApi';
import { projectTaskApi } from '../../api/projectTaskApi';
import { useAuth } from '../../context/AuthContext';
import Loader from '../../components/common/Loader';
import Badge from '../../components/common/Badge';

export const Dashboard = () => {
  const {
    user,
    userRole,
    company,
    branch,
    isSuperAdmin,
    isHrAdmin,
    isAccountant,
    isDirector,
    isBranchManager,
    isProjectExecutive,
    isEmployee,
    canAccessModule,
  } = useAuth();

  const [stats, setStats] = useState({
    employees: 0,
    departments: 0,
    branches: 0,
    companies: 0,
    openJobs: 0,
    candidates: 0,
    todayAttendance: 0,
    pendingLeaves: 0,
    payrollRuns: 0,
    assets: 0,
    projects: 0,
    tasks: 0,
  });
  const [recentEmployees, setRecentEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const isFetchingRef = useRef(false);
  const initialLoadedRef = useRef(false);
  const lastFetchTimeRef = useRef(0);

  // Extract department and branch cleanly from user / employee object
  const userDept =
    user?.department?.name ||
    (typeof user?.department === 'string' ? user.department : null) ||
    user?.employee?.employmentInfo?.department?.name ||
    user?.employee?.department?.name ||
    user?.employmentInfo?.department?.name ||
    'Management & Leadership';

  const userBranch =
    user?.branch?.name ||
    (typeof user?.branch === 'string' ? user.branch : null) ||
    user?.employee?.employmentInfo?.branch?.name ||
    user?.employee?.branch?.name ||
    user?.employmentInfo?.branch?.name ||
    'Head Office';

  const fetchDashboardData = useCallback(
    async (isManual = false) => {
      const now = Date.now();
      // Throttle automatic refreshes to at least 10 seconds
      if (!isManual && now - lastFetchTimeRef.current < 10000) {
        return;
      }
      if (isFetchingRef.current) return;

      isFetchingRef.current = true;
      lastFetchTimeRef.current = now;

      if (isManual) {
        setIsRefreshing(true);
      } else if (!initialLoadedRef.current) {
        setLoading(true);
      }

      try {
        const todayStr = new Date().toISOString().split('T')[0];
        const isOrgAdmin = isSuperAdmin || isHrAdmin || isDirector || isBranchManager;
        const isRecruiter = isSuperAdmin || isHrAdmin || isDirector;
        const isMasterAdmin = isSuperAdmin || isDirector;

        // STAGE 1: Core Daily Metrics (Employees, Attendance, Leaves)
        // Dispatched first so core numbers show up immediately
        const stage1Calls = [
          isOrgAdmin && canAccessModule('employees')
            ? employeeApi.getEmployees({ limit: 5 }).catch(() => ({ data: [] }))
            : Promise.resolve({ data: [] }),
          canAccessModule('attendance')
            ? isOrgAdmin
              ? attendanceApi.getAllOfficeAttendance({ date: todayStr }).catch(() => attendanceApi.getMyOfficeAttendance({ date: todayStr }).catch(() => []))
              : attendanceApi.getMyOfficeAttendance({ date: todayStr }).catch(() => [])
            : Promise.resolve([]),
          canAccessModule('leaves')
            ? isOrgAdmin
              ? leaveHolidayApi.getPendingLeaveApprovals().catch(() => leaveHolidayApi.getMyLeaves().catch(() => []))
              : leaveHolidayApi.getMyLeaves().catch(() => [])
            : Promise.resolve([]),
        ];

        const [empRes, attRes, leaveRes] = await Promise.allSettled(stage1Calls);

        const empDataVal = empRes.status === 'fulfilled' ? empRes.value : {};
        const employeesList = empDataVal?.data || empDataVal?.employees || (Array.isArray(empDataVal) ? empDataVal : []);
        const totalEmps = empDataVal?.count ?? (empDataVal?.total || employeesList.length);

        const attDataVal = attRes.status === 'fulfilled' ? attRes.value : {};
        const todayAttList = attDataVal?.data || (Array.isArray(attDataVal) ? attDataVal : []);

        const leaveDataVal = leaveRes.status === 'fulfilled' ? leaveRes.value : {};
        const leavesList = leaveDataVal?.data || leaveDataVal?.leaves || (Array.isArray(leaveDataVal) ? leaveDataVal : []);

        setStats((prev) => ({
          ...prev,
          employees: totalEmps,
          todayAttendance: todayAttList.length,
          pendingLeaves: leavesList.length,
        }));

        if (canAccessModule('employees')) {
          setRecentEmployees(employeesList.slice(0, 5));
        }

        // Show UI immediately once core stats are loaded
        if (!initialLoadedRef.current) {
          initialLoadedRef.current = true;
          setLoading(false);
        }

        // STAGE 2: Operations & Assets (Tasks, Projects, Assets)
        // Dispatched next in small batch to avoid flooding server
        const stage2Calls = [
          canAccessModule('tasks') ? projectTaskApi.getSiteTasks().catch(() => []) : Promise.resolve([]),
          canAccessModule('projects') ? projectTaskApi.getProjects().catch(() => []) : Promise.resolve([]),
          canAccessModule('assets-claims') || canAccessModule('assets')
            ? assetsLoansApi.getAssets().catch(() => [])
            : Promise.resolve([]),
        ];

        const [taskRes, projRes, assetsRes] = await Promise.allSettled(stage2Calls);

        const taskDataVal = taskRes.status === 'fulfilled' ? taskRes.value : {};
        const tasksList = taskDataVal?.data || taskDataVal?.tasks || (Array.isArray(taskDataVal) ? taskDataVal : []);

        const projDataVal = projRes.status === 'fulfilled' ? projRes.value : {};
        const projList = projDataVal?.data || projDataVal?.projects || (Array.isArray(projDataVal) ? projDataVal : []);

        const assetsDataVal = assetsRes.status === 'fulfilled' ? assetsRes.value : {};
        const assetsList = assetsDataVal?.data || assetsDataVal?.assets || (Array.isArray(assetsDataVal) ? assetsDataVal : []);

        setStats((prev) => ({
          ...prev,
          tasks: tasksList.length,
          projects: projList.length,
          assets: assetsList.length,
        }));

        // STAGE 3: Administration & Recruitment (Only if authorized)
        const stage3Calls = [
          isRecruiter && canAccessModule('recruitment')
            ? recruitmentApi.getJobOpenings().catch(() => [])
            : Promise.resolve([]),
          isRecruiter && canAccessModule('recruitment')
            ? recruitmentApi.getCandidates().catch(() => [])
            : Promise.resolve([]),
          canAccessModule('payroll') ? payrollApi.getPayrollRuns().catch(() => []) : Promise.resolve([]),
          isMasterAdmin && canAccessModule('masters') ? masterApi.getDepartments().catch(() => []) : Promise.resolve([]),
          isOrgAdmin && canAccessModule('masters') ? masterApi.getBranches().catch(() => []) : Promise.resolve([]),
          isMasterAdmin && canAccessModule('masters') ? masterApi.getCompanies().catch(() => []) : Promise.resolve([]),
        ];

        const [jobRes, candRes, payrollRes, deptRes, branchRes, compRes] = await Promise.allSettled(stage3Calls);

        const jobDataVal = jobRes.status === 'fulfilled' ? jobRes.value : {};
        const jobsList =
          jobDataVal?.data || jobDataVal?.jobs || jobDataVal?.jobOpenings || (Array.isArray(jobDataVal) ? jobDataVal : []);
        const openJobsCount = jobsList.filter((j) => !j.status || j.status === 'OPEN' || j.status === 'ACTIVE').length;

        const candDataVal = candRes.status === 'fulfilled' ? candRes.value : {};
        const candsList = candDataVal?.data || candDataVal?.candidates || (Array.isArray(candDataVal) ? candDataVal : []);

        const payrollDataVal = payrollRes.status === 'fulfilled' ? payrollRes.value : {};
        const payrollList = payrollDataVal?.data || payrollDataVal?.runs || (Array.isArray(payrollDataVal) ? payrollDataVal : []);

        const deptDataVal = deptRes.status === 'fulfilled' ? deptRes.value : {};
        const deptsList = deptDataVal?.data || deptDataVal?.departments || (Array.isArray(deptDataVal) ? deptDataVal : []);

        const branchDataVal = branchRes.status === 'fulfilled' ? branchRes.value : {};
        const branchesList = branchDataVal?.data || branchDataVal?.branches || (Array.isArray(branchDataVal) ? branchDataVal : []);

        const compDataVal = compRes.status === 'fulfilled' ? compRes.value : {};
        const compsList = compDataVal?.data || compDataVal?.companies || (Array.isArray(compDataVal) ? compDataVal : []);

        setStats((prev) => ({
          ...prev,
          openJobs: openJobsCount,
          candidates: candsList.length,
          payrollRuns: payrollList.length,
          departments: deptsList.length,
          branches: branchesList.length,
          companies: compsList.length,
        }));
      } catch (err) {
        console.error('Error loading dashboard stats:', err);
      } finally {
        isFetchingRef.current = false;
        initialLoadedRef.current = true;
        setLoading(false);
        setIsRefreshing(false);
      }
    },
    [isSuperAdmin, isHrAdmin, isDirector, isBranchManager, canAccessModule]
  );

  // Trigger fetch once when user profile is loaded
  useEffect(() => {
    if (user?._id && !initialLoadedRef.current) {
      fetchDashboardData();
    }
  }, [user?._id, fetchDashboardData]);

  // Dynamically assemble authorized modules list for RBAC summary
  const accessibleModulesList = [];
  if (canAccessModule('employees')) accessibleModulesList.push('Employees Master');
  if (canAccessModule('attendance')) accessibleModulesList.push('Attendance & Face Punch');
  if (canAccessModule('leaves')) accessibleModulesList.push('Leaves & Holidays');
  if (canAccessModule('payroll')) accessibleModulesList.push('Payroll & Salaries');
  if (canAccessModule('recruitment')) accessibleModulesList.push('Recruitment & Hiring');
  if (canAccessModule('assets-claims') || canAccessModule('assets')) accessibleModulesList.push('Assets & Loans');
  if (canAccessModule('projects') || canAccessModule('operations')) accessibleModulesList.push('Projects & Sites');
  if (canAccessModule('tasks')) accessibleModulesList.push('Tasks & Milestones');
  if (canAccessModule('performance')) accessibleModulesList.push('Performance Reviews');
  if (canAccessModule('reports')) accessibleModulesList.push('Reports & Analytics');
  if (canAccessModule('masters')) accessibleModulesList.push('Organization Masters');

  // Dynamically assemble stat cards strictly based on user role & permissions
  const statCards = [];

  if (canAccessModule('employees')) {
    statCards.push({
      title: 'Total Employees',
      value: stats.employees,
      icon: Users,
      color: '#0d9488',
      bg: 'rgba(13, 148, 136, 0.1)',
      link: '/employees',
    });
  }

  if (canAccessModule('attendance')) {
    statCards.push({
      title: isEmployee && !isSuperAdmin && !isHrAdmin && !isBranchManager ? "My Today's Status" : "Today's Attendance",
      value: isEmployee && !isSuperAdmin && !isHrAdmin && !isBranchManager ? "Active" : stats.todayAttendance,
      icon: CalendarCheck,
      color: '#16a34a',
      bg: 'rgba(22, 163, 74, 0.1)',
      link: '/attendance',
    });
  }

  if (canAccessModule('leaves')) {
    statCards.push({
      title: isEmployee && !isSuperAdmin && !isHrAdmin && !isBranchManager ? 'Leave Requests' : 'Pending Leave Requests',
      value: stats.pendingLeaves,
      icon: CalendarOff,
      color: '#d97706',
      bg: 'rgba(217, 119, 6, 0.1)',
      link: '/leaves',
    });
  }

  if (canAccessModule('recruitment')) {
    statCards.push({
      title: 'Open Job Vacancies',
      value: stats.openJobs,
      icon: Briefcase,
      color: '#2563eb',
      bg: 'rgba(37, 99, 235, 0.1)',
      link: '/recruitment/jobs',
    });
  }

  if (canAccessModule('payroll')) {
    statCards.push({
      title: 'Payroll & Salaries',
      value: stats.payrollRuns || 'Active',
      icon: TrendingUp,
      color: '#8b5cf6',
      bg: 'rgba(139, 92, 246, 0.1)',
      link: '/payroll',
    });
  }

  if (canAccessModule('assets-claims') || canAccessModule('assets')) {
    statCards.push({
      title: 'Assets & Custody',
      value: stats.assets || 'Active',
      icon: Shield,
      color: '#0284c7',
      bg: 'rgba(2, 132, 199, 0.1)',
      link: '/assets-claims',
    });
  }

  if (canAccessModule('projects') || canAccessModule('operations')) {
    statCards.push({
      title: 'Active Projects',
      value: stats.projects || 'Tracked',
      icon: Building2,
      color: '#059669',
      bg: 'rgba(5, 150, 105, 0.1)',
      link: '/operations/projects',
    });
  }

  if (canAccessModule('tasks')) {
    statCards.push({
      title: 'Tasks & Milestones',
      value: stats.tasks || 'Active',
      icon: Layers,
      color: '#e11d48',
      bg: 'rgba(225, 29, 72, 0.1)',
      link: '/operations/tasks',
    });
  }

  // Fallback for employee with restricted permissions to ensure at least 4 helpful cards
  if (statCards.length < 4) {
    if (!statCards.some((c) => c.link === '/payroll/payslips') && (isEmployee || canAccessModule('payroll'))) {
      statCards.push({
        title: 'My Payslips & Tax',
        value: 'Available',
        icon: TrendingUp,
        color: '#8b5cf6',
        bg: 'rgba(139, 92, 246, 0.1)',
        link: '/payroll/payslips',
      });
    }
    if (!statCards.some((c) => c.link === '/attendance/face-punch')) {
      statCards.push({
        title: 'Biometric Face Punch',
        value: 'Ready',
        icon: ScanFace,
        color: '#0d9488',
        bg: 'rgba(13, 148, 136, 0.1)',
        link: '/attendance/face-punch',
      });
    }
  }

  // Dynamically assemble shortcuts strictly based on accessible modules
  const allShortcuts = [
    {
      label: 'Employees',
      link: '/employees',
      icon: Users,
      color: 'var(--primary)',
      canAccess: canAccessModule('employees'),
    },
    {
      label: 'Face Attendance Punch',
      link: '/attendance/face-punch',
      icon: ScanFace,
      color: '#16a34a',
      canAccess: canAccessModule('attendance') || isEmployee,
    },
    {
      label: 'Geo-Fences',
      link: '/attendance/geo-fences',
      icon: Building2,
      color: '#16a34a',
      canAccess: canAccessModule('attendance') && (isSuperAdmin || isHrAdmin || isBranchManager),
    },
    {
      label: 'Candidates',
      link: '/recruitment/candidates',
      icon: Users,
      color: '#2563eb',
      canAccess: canAccessModule('recruitment'),
    },
    {
      label: 'Job Openings',
      link: '/recruitment/jobs',
      icon: Briefcase,
      color: '#2563eb',
      canAccess: canAccessModule('recruitment'),
    },
    {
      label: 'Payroll Runs',
      link: '/payroll',
      icon: TrendingUp,
      color: '#8b5cf6',
      canAccess: canAccessModule('payroll'),
    },
    {
      label: 'My Payslips',
      link: '/payroll/payslips',
      icon: TrendingUp,
      color: '#8b5cf6',
      canAccess: isEmployee && !canAccessModule('payroll'),
    },
    {
      label: 'Leave Requests',
      link: '/leaves',
      icon: CalendarOff,
      color: '#d97706',
      canAccess: canAccessModule('leaves'),
    },
    {
      label: 'Projects & Sites',
      link: '/operations/projects',
      icon: Building2,
      color: '#059669',
      canAccess: canAccessModule('projects'),
    },
    {
      label: 'Site Activity Logs',
      link: '/operations/site-logs',
      icon: FileText,
      color: '#0284c7',
      canAccess: canAccessModule('site-logs'),
    },
    {
      label: 'Daily Tasks',
      link: '/operations/tasks',
      icon: Layers,
      color: '#e11d48',
      canAccess: canAccessModule('tasks'),
    },
    {
      label: 'Assets & Loans',
      link: '/assets-claims',
      icon: Shield,
      color: '#0284c7',
      canAccess: canAccessModule('assets-claims') || canAccessModule('assets'),
    },
    {
      label: 'System Masters',
      link: '/masters/branches',
      icon: Building2,
      color: 'var(--primary)',
      canAccess: canAccessModule('masters'),
    },
  ];

  const visibleShortcuts = allShortcuts.filter((s) => s.canAccess);

  if (loading) {
    return (
      <div style={{ padding: 60, display: 'flex', justifyContent: 'center' }}>
        <Loader message="Loading data..." />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Welcome Banner */}
      <div
        className="card"
        style={{
          padding: '18px 22px',
          background: 'linear-gradient(135deg, #ffffff 0%, rgba(42, 171, 160, 0.05) 100%)',
          borderLeft: '4px solid var(--primary)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <h1 style={{ fontSize: '1.35rem', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
            Welcome back, {user?.name || user?.basicInfo?.fullName || 'User'}!
          </h1>
          <Badge variant="primary">{userRole || 'Employee'}</Badge>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{userDept}</span>
            <span>•</span>
            <span>{userBranch}</span>
          </div>
          <button
            type="button"
            onClick={() => fetchDashboardData(true)}
            disabled={isRefreshing}
            className="btn btn-light btn-sm"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 10px',
              fontSize: '0.78rem',
              fontWeight: 500,
              cursor: isRefreshing ? 'not-allowed' : 'pointer',
              opacity: isRefreshing ? 0.7 : 1,
            }}
            title="Refresh dashboard stats"
          >
            <RefreshCw size={13} style={{ animation: isRefreshing ? 'spin 1s linear infinite' : 'none' }} />
            <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="dashboard-stats-grid">
        {statCards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <Link
              key={idx}
              to={card.link}
              className="card"
              style={{
                textDecoration: 'none',
                padding: '18px 20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                transition: 'transform 0.15s ease, box-shadow 0.15s ease',
              }}
            >
              <div>
                <div style={{ fontSize: '0.84rem', color: 'var(--text-muted)', marginBottom: 6, fontWeight: 500 }}>
                  {card.title}
                </div>
                <div style={{ fontSize: '1.85rem', fontWeight: 700, color: 'var(--text-main)', lineHeight: 1 }}>
                  {card.value}
                </div>
              </div>
              <div
                style={{
                  width: 46,
                  height: 46,
                  borderRadius: 12,
                  backgroundColor: card.bg,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: card.color,
                  flexShrink: 0,
                }}
              >
                <Icon size={22} />
              </div>
            </Link>
          );
        })}
      </div>

      {/* Quick Shortcuts & Organization Overview */}
      <div className="dashboard-overview-grid">
        {/* Organization Scope OR User Department Permissions */}
        {canAccessModule('masters') ? (
          <div className="card" style={{ padding: '18px 20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 700, color: 'var(--text-main)' }}>
                Organization Master Overview
              </h3>
              <Link to="/masters/branches" style={{ fontSize: '0.8rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4, color: 'var(--primary)', textDecoration: 'none' }}>
                Manage <ArrowRight size={13} />
              </Link>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 10, borderBottom: '1px solid var(--border-color)' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Total Configured Branches</span>
                <Badge variant="info">{stats.branches || 2} Branches</Badge>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 10, borderBottom: '1px solid var(--border-color)' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Functional Departments</span>
                <Badge variant="info">{stats.departments || 4} Departments</Badge>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Security Protocol</span>
                <Badge variant="success">Dual JWT + RBAC</Badge>
              </div>
            </div>
          </div>
        ) : (
          <div className="card" style={{ padding: '18px 20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 700, color: 'var(--text-main)' }}>
                My Workplace & Permissions Profile
              </h3>
              <span style={{ fontSize: '0.78rem', color: 'var(--primary)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <Shield size={13} /> Active Role
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 10, borderBottom: '1px solid var(--border-color)' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Department</span>
                <Badge variant="info">{userDept}</Badge>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 10, borderBottom: '1px solid var(--border-color)' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Assigned Branch</span>
                <Badge variant="secondary">{userBranch}</Badge>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexDirection: 'column', gap: 6 }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Authorized Modules ({accessibleModulesList.length})</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                  {accessibleModulesList.map((m) => (
                    <span
                      key={m}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        fontSize: '0.74rem',
                        padding: '2px 8px',
                        borderRadius: 4,
                        background: 'rgba(22, 163, 74, 0.1)',
                        color: '#16a34a',
                        fontWeight: 600,
                      }}
                    >
                      <CheckCircle2 size={11} /> {m}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Quick Operations Shortcuts */}
        <div className="card" style={{ padding: '18px 20px' }}>
          <div style={{ marginBottom: 14 }}>
            <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 700, color: 'var(--text-main)' }}>
              Quick Operations
            </h3>
          </div>

          <div className="dashboard-shortcuts-grid">
            {visibleShortcuts.slice(0, 6).map((sc, scIdx) => {
              const ScIcon = sc.icon;
              return (
                <Link
                  key={scIdx}
                  to={sc.link}
                  style={{
                    textDecoration: 'none',
                    padding: '12px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    backgroundColor: '#ffffff',
                    border: '1px solid var(--border-color)',
                    borderRadius: 8,
                    color: 'var(--text-main)',
                    fontWeight: 600,
                    fontSize: '0.86rem',
                    transition: 'border-color 0.15s ease, background-color 0.15s ease',
                  }}
                >
                  <ScIcon size={18} color={sc.color} />
                  <span>{sc.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      {/* Role-Scoped Bottom Section: Recent Employees for HR/Admins OR Workspace Activity for Staff */}
      {canAccessModule('employees') ? (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div
            style={{
              padding: '14px 18px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderBottom: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-subtle)',
            }}
          >
            <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 700, color: 'var(--text-main)' }}>
              Recently Onboarded Employees
            </h3>
            <Link
              to="/employees"
              style={{
                fontSize: '0.8rem',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                color: 'var(--primary)',
                textDecoration: 'none',
              }}
            >
              View All Employees <ArrowRight size={13} />
            </Link>
          </div>

          <div className="table-responsive">
            <table style={{ width: '100%', minWidth: 600, borderCollapse: 'collapse', fontSize: '0.84rem' }}>
              <thead>
                <tr style={{ backgroundColor: '#ffffff', borderBottom: '1px solid var(--border-color)' }}>
                  <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)', width: 120 }}>
                    Code
                  </th>
                  <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)' }}>
                    Employee Name
                  </th>
                  <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)' }}>
                    Department
                  </th>
                  <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)' }}>
                    Designation
                  </th>
                  <th style={{ padding: '10px 16px', textAlign: 'center', fontWeight: 600, color: 'var(--text-muted)', width: 100 }}>
                    Status
                  </th>
                  <th style={{ padding: '10px 16px', textAlign: 'center', fontWeight: 600, color: 'var(--text-muted)', width: 150 }}>
                    Biometric Face
                  </th>
                </tr>
              </thead>
              <tbody>
                {recentEmployees.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>
                      No recent employees found.
                    </td>
                  </tr>
                ) : (
                  recentEmployees.map((emp, eIdx) => {
                    const empCode =
                      emp?.basicInfo?.employeeCode ||
                      emp?.employeeCode ||
                      (typeof emp?._id === 'string' && emp._id.length >= 4 ? `EMP-${emp._id.substring(emp._id.length - 4).toUpperCase()}` : `EMP-00${eIdx + 1}`);

                    const rawName =
                      emp?.basicInfo?.fullName ||
                      emp?.name ||
                      emp?.fullName ||
                      (emp?.firstName ? `${emp.firstName} ${emp.lastName || ''}`.trim() : 'Employee');

                    const empName = rawName
                      .split(' ')
                      .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : ''))
                      .join(' ');

                    const empEmail = emp?.basicInfo?.email || emp?.email || '';
                    const empId = typeof emp?._id === 'string' ? emp._id : `emp-${eIdx}`;

                    const deptName =
                      emp?.department?.name ||
                      emp?.employmentInfo?.department?.name ||
                      (typeof emp?.department === 'string' ? emp.department : 'General Operations');

                    const desigTitle =
                      emp?.designation?.name ||
                      emp?.designation?.title ||
                      emp?.employmentInfo?.designation?.name ||
                      (typeof emp?.designation === 'string' ? emp.designation : 'Staff Member');

                    const empStatus = emp?.employeeStatus || emp?.employmentInfo?.employeeStatus || 'Active';
                    const isFacePending = emp?.faceRegistrationPending !== false && !emp?.faceVectorStored;

                    const initials = empName
                      .split(' ')
                      .filter(Boolean)
                      .map((w) => w[0])
                      .join('')
                      .substring(0, 2)
                      .toUpperCase();

                    return (
                      <tr
                        key={empId}
                        style={{
                          borderBottom: '1px solid var(--border-color)',
                          transition: 'background-color 0.12s ease',
                        }}
                      >
                        <td style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-main)', fontFamily: 'monospace' }}>
                          {empCode}
                        </td>

                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div
                              style={{
                                width: 32,
                                height: 32,
                                borderRadius: '50%',
                                backgroundColor: 'rgba(42, 171, 160, 0.12)',
                                color: 'var(--primary)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '0.78rem',
                                fontWeight: 700,
                                flexShrink: 0,
                              }}
                            >
                              {initials || 'EM'}
                            </div>
                            <div>
                              <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{empName}</div>
                              {empEmail && (
                                <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>{empEmail}</div>
                              )}
                            </div>
                          </div>
                        </td>

                        <td style={{ padding: '12px 16px', color: 'var(--text-muted)' }}>
                          {deptName}
                        </td>

                        <td style={{ padding: '12px 16px', color: 'var(--text-main)', fontWeight: 500 }}>
                          {desigTitle}
                        </td>

                        <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                          <Badge variant={empStatus.toLowerCase() === 'active' ? 'success' : 'secondary'}>
                            {empStatus.charAt(0).toUpperCase() + empStatus.slice(1).toLowerCase()}
                          </Badge>
                        </td>

                        <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                          {isFacePending ? (
                            <Link to={`/attendance/face-punch?tab=register&empId=${empId}`} style={{ textDecoration: 'none' }}>
                              <Badge variant="warning" style={{ cursor: 'pointer' }}>Pending Registration</Badge>
                            </Link>
                          ) : (
                            <Badge variant="success">Face Stored • Ready</Badge>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div
            style={{
              padding: '14px 18px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderBottom: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-subtle)',
            }}
          >
            <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 700, color: 'var(--text-main)' }}>
              My Department & Workplace Activity
            </h3>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Role: <strong style={{ color: 'var(--primary)' }}>{userRole || 'Employee'}</strong>
            </span>
          </div>

          <div style={{ padding: 20 }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                gap: 16,
              }}
            >
              <div style={{ padding: 16, borderRadius: 8, border: '1px solid var(--border-color)', backgroundColor: '#ffffff' }}>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 4 }}>Department & Branch</div>
                <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-main)' }}>{userDept}</div>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: 4 }}>Location: {userBranch}</div>
              </div>

              <div style={{ padding: 16, borderRadius: 8, border: '1px solid var(--border-color)', backgroundColor: '#ffffff' }}>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 4 }}>Biometric Face Punch</div>
                <div style={{ fontWeight: 700, fontSize: '1rem', color: '#16a34a', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <CheckCircle2 size={16} /> Biometrics Active
                </div>
                <Link to="/attendance/face-punch" style={{ fontSize: '0.82rem', color: 'var(--primary)', textDecoration: 'none', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                  Punch Attendance Now <ArrowRight size={12} />
                </Link>
              </div>

              <div style={{ padding: 16, borderRadius: 8, border: '1px solid var(--border-color)', backgroundColor: '#ffffff' }}>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 4 }}>Access Level</div>
                <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-main)' }}>
                  {accessibleModulesList.length} Authorized Modules
                </div>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: 4 }}>
                  RBAC Scoped to {userRole}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
