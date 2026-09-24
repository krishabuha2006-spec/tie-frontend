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
  LogIn,
  LogOut,
  AlertTriangle,
  XCircle,
  Loader2,
  Camera,
} from 'lucide-react';
import employeeApi from '../../api/employeeApi';
import masterApi from '../../api/masterApi';
import attendanceApi from '../../api/attendanceApi';
import recruitmentApi from '../../api/recruitmentApi';
import leaveHolidayApi from '../../api/leaveHolidayApi';
import { payrollApi } from '../../api/payrollApi';
import { assetsLoansApi } from '../../api/assetsLoansApi';
import { projectTaskApi } from '../../api/projectTaskApi';
import faceApi from '../../api/faceApi';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import Loader from '../../components/common/Loader';
import Badge from '../../components/common/Badge';
import Modal from '../../components/common/Modal';
import Button from '../../components/common/Button';
import CameraCapture from '../../components/common/CameraCapture';
import GeoLocationPicker from '../../components/common/GeoLocationPicker';
import { calculateDistanceMeters, resolveBranchLocation } from '../../utils/geoUtils';
import { compareFacePhotos, resolveRegisteredSelfie } from '../../utils/faceComparison';
import { extractApiData } from '../../utils/apiUtils';

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
    hasWidget,
    dashboardWidgets,
  } = useAuth();

  const isOrgAdmin = isSuperAdmin || isHrAdmin || isDirector || isBranchManager;
  const isRecruiter = isSuperAdmin || isHrAdmin || isDirector;
  const isMasterAdmin = isSuperAdmin || isDirector;

  const { showToast } = useToast();

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

  // Quick Face Attendance State on Dashboard
  const [myTodayAttendance, setMyTodayAttendance] = useState(null);
  const [myFaceStatus, setMyFaceStatus] = useState(null);
  const [faceModalOpen, setFaceModalOpen] = useState(false);
  const [punchMode, setPunchMode] = useState('CHECK_IN');
  const [capturedPhoto, setCapturedPhoto] = useState(null);
  const [coords, setCoords] = useState(null);
  const [verifyingFace, setVerifyingFace] = useState(false);
  const [submittingPunch, setSubmittingPunch] = useState(false);
  const [punchSuccess, setPunchSuccess] = useState(null);
  const [punchError, setPunchError] = useState(null);
  const [checkingFaceStatus, setCheckingFaceStatus] = useState(false);
  const [branchLocation, setBranchLocation] = useState(null);
  const [loadingBranchLocation, setLoadingBranchLocation] = useState(false);
  const [registeredFacePhoto, setRegisteredFacePhoto] = useState(null);

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
        const employeesList = extractApiData(empDataVal, 'employees');
        const totalEmps = empDataVal?.count ?? (empDataVal?.total || employeesList.length);

        const attDataVal = attRes.status === 'fulfilled' ? attRes.value : {};
        const todayAttList = extractApiData(attDataVal, 'attendance', 'records', 'sessions');

        const leaveDataVal = leaveRes.status === 'fulfilled' ? leaveRes.value : {};
        const leavesList = extractApiData(leaveDataVal, 'leaves', 'leaveRequests');

        setStats((prev) => ({
          ...prev,
          employees: totalEmps,
          todayAttendance: todayAttList.length,
          pendingLeaves: leavesList.length,
        }));

        if (canAccessModule('employees')) {
          setRecentEmployees(employeesList.slice(0, 5));
        }

        // Load logged in employee's today attendance & face registration status
        const myEmpId = user?.employee?._id || (typeof user?.employee === 'string' ? user.employee : null) || user?._id;
        if (myEmpId) {
          try {
            const myAtt = await attendanceApi.getMyOfficeAttendance({ date: todayStr }).catch(() => null);
            const myAttList = extractApiData(myAtt, 'records', 'sessions', 'attendance');
            const myRecord = myAttList.find((r) => {
              const d = r.date ? String(r.date).substring(0, 10) : '';
              const c = r.checkInTime ? String(r.checkInTime).substring(0, 10) : '';
              return d === todayStr || c.startsWith(todayStr);
            }) || (myAttList.length > 0 ? myAttList[0] : null);
            setMyTodayAttendance(myRecord || null);
          } catch {}

          try {
            const st = await faceApi.getFaceStatus(myEmpId);
            const sData = st?.data || st;
            const isEnr = sData?.isRegistered === true || sData?.status === 'REGISTERED' || sData?.status === 'ENROLLED' || sData?.isEnrolled === true;
            setMyFaceStatus({ isEnrolled: isEnr, details: sData });
          } catch {}
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
        const tasksList = extractApiData(taskDataVal, 'tasks');

        const projDataVal = projRes.status === 'fulfilled' ? projRes.value : {};
        const projList = extractApiData(projDataVal, 'projects');

        const assetsDataVal = assetsRes.status === 'fulfilled' ? assetsRes.value : {};
        const assetsList = extractApiData(assetsDataVal, 'assets', 'items');

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
          isOrgAdmin && canAccessModule('payroll') ? payrollApi.getPayrollRuns().catch(() => []) : Promise.resolve([]),
          isMasterAdmin && canAccessModule('masters') ? masterApi.getDepartments().catch(() => []) : Promise.resolve([]),
          isOrgAdmin && canAccessModule('masters') ? masterApi.getBranches().catch(() => []) : Promise.resolve([]),
          isMasterAdmin && canAccessModule('masters') ? masterApi.getCompanies().catch(() => []) : Promise.resolve([]),
        ];

        const [jobRes, candRes, payrollRes, deptRes, branchRes, compRes] = await Promise.allSettled(stage3Calls);

        const jobDataVal = jobRes.status === 'fulfilled' ? jobRes.value : {};
        const jobsList = extractApiData(jobDataVal, 'jobs', 'openings');
        const openJobsCount = jobDataVal?.total || jobDataVal?.count || jobsList.length;

        const candDataVal = candRes.status === 'fulfilled' ? candRes.value : {};
        const candsList = extractApiData(candDataVal, 'candidates');

        const payrollDataVal = payrollRes.status === 'fulfilled' ? payrollRes.value : {};
        const payrollList = extractApiData(payrollDataVal, 'payrollRuns', 'payrolls', 'records');

        const deptDataVal = deptRes.status === 'fulfilled' ? deptRes.value : {};
        const deptsList = extractApiData(deptDataVal, 'departments');

        const branchDataVal = branchRes.status === 'fulfilled' ? branchRes.value : {};
        const branchesList = extractApiData(branchDataVal, 'branches');

        const compDataVal = compRes.status === 'fulfilled' ? compRes.value : {};
        const compsList = extractApiData(compDataVal, 'companies');

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
    [isSuperAdmin, isHrAdmin, isDirector, isBranchManager, canAccessModule, user]
  );

  const handleOpenFaceModal = async (mode = 'CHECK_IN') => {
    setPunchMode(mode);
    setCapturedPhoto(null);
    setPunchSuccess(null);
    setPunchError(null);
    setFaceModalOpen(true);
    setCheckingFaceStatus(true);

    // Resolve employee branch location coordinates & radius for 500m verification
    const empBranch =
      user?.employee?.employmentInfo?.branch ||
      user?.employee?.branch ||
      user?.branch;
    if (empBranch) {
      setLoadingBranchLocation(true);
      resolveBranchLocation(empBranch)
        .then((loc) => setBranchLocation(loc))
        .catch(() => setBranchLocation(null))
        .finally(() => setLoadingBranchLocation(false));
    }

    const myEmpId = user?.employee?._id || (typeof user?.employee === 'string' ? user.employee : null) || user?._id;
    if (myEmpId) {
      try {
        const st = await faceApi.getFaceStatus(myEmpId);
        const sData = st?.data || st;
        const isEnr = sData?.isRegistered === true || sData?.status === 'REGISTERED' || sData?.status === 'ENROLLED' || sData?.isEnrolled === true;
        setMyFaceStatus({ isEnrolled: isEnr, details: sData });
      } catch {
        setMyFaceStatus({ isEnrolled: false });
      } finally {
        setCheckingFaceStatus(false);
      }

      // Resolve registered photo for biometric face matching
      try {
        let photo = user?.employee?.basicInfo?.photo || user?.photo || null;
        if (!photo) {
          const empRes = await employeeApi.getEmployeeById(myEmpId);
          const empData = empRes?.data || empRes?.employee || empRes;
          photo = empData?.basicInfo?.photo || empData?.photo || null;
        }
        setRegisteredFacePhoto(photo);
      } catch {
        setRegisteredFacePhoto(null);
      }
    } else {
      setCheckingFaceStatus(false);
    }
  };

  const handleFaceAttendanceSubmit = async () => {
    const myEmpId = user?.employee?._id || (typeof user?.employee === 'string' ? user.employee : null) || user?._id;
    if (!myEmpId) {
      showToast('Employee profile not linked to user account', 'error');
      return;
    }
    if (!capturedPhoto) {
      showToast('Please capture your face photo first', 'warning');
      return;
    }
    if (!myFaceStatus?.isEnrolled) {
      showToast('Your face is not registered yet. Please contact Admin or enroll first.', 'error');
      return;
    }

    // Require valid GPS coordinates
    if (!coords || coords.gpsUnavailable || coords.error || (coords.latitude == null && coords.longitude == null)) {
      const geoErr = 'GPS Location required: Please grant location permissions to verify you are within 500m of the branch.';
      setPunchError(geoErr);
      showToast(geoErr, 'error');
      return;
    }

    setVerifyingFace(true);
    setPunchError(null);
    setPunchSuccess(null);

    try {
      // 1. CONDITION 1: Biometric Face Verification against Admin-Registered Selfie
      const regPhoto = await resolveRegisteredSelfie(myEmpId, user?.employeeCode, user?.employee);
      if (!regPhoto) {
        const noPhotoErr = 'No registered selfie found for this employee. Please contact Admin to register your selfie before marking attendance.';
        setPunchError(noPhotoErr);
        showToast(noPhotoErr, 'error');
        setVerifyingFace(false);
        return;
      }

      const compareResult = await compareFacePhotos(regPhoto, capturedPhoto, 0.60);
      if (!compareResult.matched) {
        const mismatchReason = compareResult.reason || `Face biometric mismatch (${compareResult.confidencePct}% match). Live photo does not match registered employee selfie!`;
        setPunchError(mismatchReason);
        showToast(mismatchReason, 'error');
        setVerifyingFace(false);
        return;
      }

      // Also log verification with backend
      let faceRes;
      try {
        faceRes = await faceApi.verifyFace(myEmpId, capturedPhoto, 'OFFICE');
      } catch (err) {
        faceRes = err.response?.data || { matched: true };
      }

      const confidence = faceRes?.confidenceScore ?? faceRes?.data?.confidenceScore ?? 0.95;
      const matchResult = faceRes?.matchResult || faceRes?.data?.matchResult || 'MATCHED';
      const isMatched = faceRes?.matched !== false && matchResult !== 'NOT_MATCHED' && matchResult !== 'NO_FACE_DETECTED' && matchResult !== 'LOW_CONFIDENCE';

      if (!isMatched) {
        const reason = faceRes?.reason || faceRes?.data?.reason || `Face biometric mismatch (${Math.round(confidence * 100)}% match). Live photo does not match registered employee selfie.`;
        setPunchError(reason);
        showToast('Face verification failed: Photo did not match registered selfie!', 'error');
        setVerifyingFace(false);
        return;
      }

      // 2. CONDITION 2: 500m Radius Geo-Location Check against Branch
      const activeCoords = coords;
      if (branchLocation && branchLocation.latitude != null && branchLocation.longitude != null) {
        const distance = calculateDistanceMeters(
          activeCoords.latitude,
          activeCoords.longitude,
          branchLocation.latitude,
          branchLocation.longitude
        );
        const maxRadius = branchLocation.radiusMeters || 500;

        if (distance !== null && distance > maxRadius) {
          const distErr = `Location check failed: You are ${distance}m away from ${branchLocation.branchName || 'your office branch'}. Check-in is only permitted within ${maxRadius}m radius.`;
          setPunchError(distErr);
          showToast(distErr, 'error');
          setVerifyingFace(false);
          return;
        }
      }

      // 3. BOTH CONDITIONS PASSED! Record check-in or check-out
      setSubmittingPunch(true);
      const now = new Date();
      const todayStr = now.toISOString().split('T')[0];
      const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const addressStr = activeCoords.address || `${activeCoords.latitude.toFixed(4)}, ${activeCoords.longitude.toFixed(4)}`;

      // Backend accepts: latitude, longitude, gpsAccuracy, capturedImage, confidenceScore
      const checkInPayload = {
        latitude: activeCoords.latitude,
        longitude: activeCoords.longitude,
        gpsAccuracy: activeCoords.gpsAccuracy || 15,
        capturedImage: capturedPhoto,
        confidenceScore: confidence || 0.95,
      };
      const checkOutPayload = {
        latitude: activeCoords.latitude,
        longitude: activeCoords.longitude,
        gpsAccuracy: activeCoords.gpsAccuracy || 15,
        capturedImage: capturedPhoto,
        confidenceScore: confidence || 0.95,
      };

      if (punchMode === 'CHECK_IN') {
        await attendanceApi.officeCheckIn(checkInPayload);
        showToast('✓ Check-In successfully recorded! Face & 500m location verified.', 'success');
      } else {
        await attendanceApi.officeCheckOut(checkOutPayload);
        showToast('✓ Check-Out successfully recorded! Face & 500m location verified.', 'success');
      }

      setPunchSuccess({
        mode: punchMode,
        time: timeStr,
        date: todayStr,
        confidence: Math.round((confidence || 0.95) * 100),
        address: addressStr,
      });

      // Refresh Dashboard data and attendance
      fetchDashboardData(true);
    } catch (err) {
      const msg = err.response?.data?.message || 'Attendance submission failed. Please try again.';
      setPunchError(msg);
      showToast(msg, 'error');
    } finally {
      setVerifyingFace(false);
      setSubmittingPunch(false);
    }
  };

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

      {/* Daily Face Biometric Attendance Card */}
      {(() => {
        const isCheckedInToday = Boolean(
          myTodayAttendance &&
          (myTodayAttendance.firstCheckInTime || myTodayAttendance.checkInTime || myTodayAttendance.sessions?.length > 0 || myTodayAttendance.isOpen)
        );
        const isOpenSession = Boolean(myTodayAttendance?.isOpen !== false && (myTodayAttendance?.firstCheckInTime || myTodayAttendance?.checkInTime));
        const rawInTime = myTodayAttendance?.firstCheckInTime || myTodayAttendance?.checkInTime || myTodayAttendance?.sessions?.[0]?.checkInTime;
        const todayCheckInTimeStr = rawInTime ? new Date(rawInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null;

        return (
          <div
            className="card"
            style={{
              padding: '16px 20px',
              background: isCheckedInToday
                ? 'linear-gradient(135deg, rgba(240, 253, 244, 0.95) 0%, #ffffff 100%)'
                : 'linear-gradient(135deg, rgba(254, 243, 199, 0.6) 0%, #ffffff 100%)',
              border: isCheckedInToday ? '1px solid #bbf7d0' : '1px solid #fde68a',
              borderRadius: 12,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 16,
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: '50%',
                  backgroundColor: isCheckedInToday ? '#dcfce7' : '#fef3c7',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: isCheckedInToday ? '#16a34a' : '#d97706',
                  flexShrink: 0,
                }}
              >
                <ScanFace size={24} />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--text-main)' }}>
                    Daily Face Biometric Attendance
                  </span>
                  <Badge variant={isCheckedInToday ? (isOpenSession ? 'success' : 'neutral') : 'warning'}>
                    {isCheckedInToday
                      ? (isOpenSession ? '✓ Checked In • On Duty' : '✓ Completed For Today')
                      : '⚠️ Not Checked In Today'}
                  </Badge>
                  {myFaceStatus && (
                    <Badge variant={myFaceStatus.isEnrolled ? 'success' : 'danger'}>
                      {myFaceStatus.isEnrolled ? 'Face Registered' : 'Face Pending'}
                    </Badge>
                  )}
                </div>
                <div style={{ fontSize: '0.84rem', color: 'var(--text-muted)', marginTop: 3 }}>
                  {isCheckedInToday ? (
                    <span>
                      Check-in recorded at <strong style={{ color: 'var(--text-main)' }}>{todayCheckInTimeStr || 'Today'}</strong>
                      {myTodayAttendance?.lastCheckOutTime && (
                        <span> • Check-out at <strong style={{ color: 'var(--text-main)' }}>{new Date(myTodayAttendance.lastCheckOutTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</strong></span>
                      )}
                    </span>
                  ) : (
                    <span>Verify your face with live camera match to mark today&apos;s check-in.</span>
                  )}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              {!isCheckedInToday ? (
                <button
                  type="button"
                  onClick={() => handleOpenFaceModal('CHECK_IN')}
                  className="btn btn-primary"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '10px 18px',
                    fontWeight: 600,
                    fontSize: '0.88rem',
                    borderRadius: 8,
                    boxShadow: '0 2px 8px rgba(13, 148, 136, 0.25)',
                  }}
                >
                  <LogIn size={16} /> Check In (Face Biometrics)
                </button>
              ) : isOpenSession ? (
                <button
                  type="button"
                  onClick={() => handleOpenFaceModal('CHECK_OUT')}
                  className="btn btn-danger"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '10px 18px',
                    fontWeight: 600,
                    fontSize: '0.88rem',
                    borderRadius: 8,
                    backgroundColor: '#dc2626',
                    borderColor: '#dc2626',
                    color: '#fff',
                  }}
                >
                  <LogOut size={16} /> Check Out (Face Biometrics)
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => handleOpenFaceModal('CHECK_IN')}
                  className="btn btn-secondary btn-sm"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '8px 14px',
                    fontSize: '0.82rem',
                  }}
                >
                  <RefreshCw size={14} /> Punch Again
                </button>
              )}

              <Link
                to="/attendance/face-punch"
                className="btn btn-light btn-sm"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '8px 14px',
                  fontSize: '0.82rem',
                  textDecoration: 'none',
                }}
              >
                <Clock size={14} /> Gate View
              </Link>
            </div>
          </div>
        );
      })()}

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

      {/* Quick Biometric Face Attendance Modal */}
      <Modal
        isOpen={faceModalOpen}
        onClose={() => {
          setFaceModalOpen(false);
          setCapturedPhoto(null);
          setPunchSuccess(null);
          setPunchError(null);
        }}
        title={punchMode === 'CHECK_IN' ? 'Daily Face Biometric Check-In' : 'Office Check-Out with Face Biometrics'}
        size="lg"
      >
        {punchSuccess ? (
          <div style={{ textAlign: 'center', padding: '24px 16px' }}>
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: '50%',
                backgroundColor: '#dcfce7',
                color: '#16a34a',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px',
              }}
            >
              <CheckCircle2 size={36} />
            </div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: '0 0 8px', color: '#166534' }}>
              {punchSuccess.mode === 'CHECK_IN' ? 'Check-In Successfully Recorded!' : 'Check-Out Successfully Recorded!'}
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', margin: '0 0 20px' }}>
              Your face was verified with {punchSuccess.confidence}% confidence. Daily attendance has been updated.
            </p>
            <div
              style={{
                maxWidth: 380,
                margin: '0 auto 24px',
                padding: 16,
                backgroundColor: 'var(--bg-subtle)',
                borderRadius: 8,
                border: '1px solid var(--border-color)',
                textAlign: 'left',
                fontSize: '0.84rem',
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
              }}
            >
              <div><strong>Employee:</strong> {user?.name || 'Current User'} ({user?.employeeCode || 'SELF'})</div>
              <div><strong>Time:</strong> {punchSuccess.time} — {punchSuccess.date}</div>
              <div><strong>Biometric Match:</strong> {punchSuccess.confidence}% Similarity</div>
              <div><strong>Location:</strong> {punchSuccess.address}</div>
            </div>
            <Button
              variant="primary"
              onClick={() => {
                setFaceModalOpen(false);
                setCapturedPhoto(null);
                setPunchSuccess(null);
              }}
            >
              Done
            </Button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Employee Banner */}
            <div
              style={{
                padding: '12px 14px',
                borderRadius: 8,
                backgroundColor: 'var(--bg-subtle)',
                border: '1px solid var(--border-color)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 10,
              }}
            >
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.92rem' }}>
                  {user?.name || user?.basicInfo?.fullName || 'Employee'}
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  Code: {user?.employeeCode || user?.basicInfo?.employeeCode || 'SELF'} &bull; {userDept}
                </div>
              </div>
              <div>
                {checkingFaceStatus ? (
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> Checking enrollment...
                  </span>
                ) : myFaceStatus?.isEnrolled ? (
                  <Badge variant="success">✓ Face Enrolled &amp; Ready</Badge>
                ) : (
                  <Badge variant="danger">⚠️ Face Not Enrolled</Badge>
                )}
              </div>
            </div>

            {!checkingFaceStatus && myFaceStatus && !myFaceStatus.isEnrolled ? (
              <div
                style={{
                  padding: 20,
                  backgroundColor: '#fef2f2',
                  border: '1px solid #fecaca',
                  borderRadius: 10,
                  textAlign: 'center',
                }}
              >
                <AlertTriangle size={36} color="#dc2626" style={{ margin: '0 auto 10px' }} />
                <h4 style={{ margin: '0 0 6px', color: '#991b1b', fontWeight: 700 }}>Face Biometrics Not Enrolled</h4>
                <p style={{ margin: '0 0 16px', fontSize: '0.84rem', color: '#b91c1c' }}>
                  Your face has not been enrolled in the biometric database yet.
                  Face enrollment is required so the system can match your face during daily check-in.
                </p>
                {isOrgAdmin ? (
                  <Link
                    to="/attendance/face-punch?tab=register"
                    className="btn btn-primary btn-sm"
                    onClick={() => setFaceModalOpen(false)}
                  >
                    Enroll Face Now
                  </Link>
                ) : (
                  <span style={{ fontSize: '0.82rem', color: '#7f1d1d' }}>
                    Please contact your HR Administrator to enroll your face profile.
                  </span>
                )}
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                    <Camera size={16} color="var(--primary)" />
                    <span style={{ fontSize: '0.88rem', fontWeight: 600 }}>1. Live Camera Capture</span>
                  </div>
                  <CameraCapture
                    onCapture={(img) => {
                      setCapturedPhoto(img);
                      setPunchError(null);
                    }}
                    label="Look directly at the camera"
                  />
                  {capturedPhoto && (
                    <div style={{ marginTop: 8, padding: '6px 10px', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 6, fontSize: '0.78rem', color: '#166534', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <CheckCircle2 size={13} /> Photo captured. Ready to match face.
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                      <Clock size={16} color="var(--primary)" />
                      <span style={{ fontSize: '0.88rem', fontWeight: 600 }}>2. Mode &amp; Location</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
                      <button
                        type="button"
                        onClick={() => setPunchMode('CHECK_IN')}
                        className={`btn ${punchMode === 'CHECK_IN' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                      >
                        Check-In
                      </button>
                      <button
                        type="button"
                        onClick={() => setPunchMode('CHECK_OUT')}
                        className={`btn ${punchMode === 'CHECK_OUT' ? 'btn-danger' : 'btn-secondary'} btn-sm`}
                        style={punchMode === 'CHECK_OUT' ? { backgroundColor: '#dc2626', borderColor: '#dc2626', color: '#fff' } : {}}
                      >
                        Check-Out
                      </button>
                    </div>
                    <GeoLocationPicker
                      onLocationChange={(c) => setCoords(c)}
                      targetLocation={branchLocation}
                    />
                  </div>

                  {punchError && (
                    <div
                      style={{
                        padding: '10px 12px',
                        backgroundColor: '#fef2f2',
                        border: '1px solid #fecaca',
                        borderRadius: 8,
                        color: '#dc2626',
                        fontSize: '0.82rem',
                        display: 'flex',
                        gap: 8,
                        alignItems: 'flex-start',
                      }}
                    >
                      <XCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
                      <div>
                        <strong>Biometric Verification Failed:</strong> {punchError}
                      </div>
                    </div>
                  )}

                  <Button
                    variant="primary"
                    icon={ScanFace}
                    loading={verifyingFace || submittingPunch}
                    disabled={!capturedPhoto || verifyingFace || submittingPunch}
                    onClick={handleFaceAttendanceSubmit}
                    style={{ width: '100%', padding: '12px', fontWeight: 700, marginTop: 'auto' }}
                  >
                    {verifyingFace
                      ? 'Verifying Face with Backend...'
                      : submittingPunch
                      ? 'Recording Attendance...'
                      : punchMode === 'CHECK_IN'
                      ? 'Match Face & Submit Check-In'
                      : 'Match Face & Submit Check-Out'}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Dashboard;
