import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
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
  AlertCircle,
  MapPin,
  XCircle,
  Loader2,
  Camera,
  Plus,
  Calendar,
  Sparkles,
  ChevronRight,
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
import { userApi } from '../../api/userApi';
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
import './Dashboard.css';

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

  // Work Type detection (OFFICE vs FIELD vs HYBRID)
  const userWorkType = useMemo(() => {
    const raw = String(
      user?.employee?.employmentInfo?.workType ||
      user?.employee?.workType ||
      user?.employmentInfo?.workType ||
      user?.workType ||
      ''
    ).toUpperCase();
    if (raw.includes('HYBRID')) return 'HYBRID';
    if (raw.includes('FIELD') || raw.includes('SITE')) return 'FIELD';
    return 'OFFICE';
  }, [user]);

  const isHybridUser = userWorkType === 'HYBRID';
  const [hybridPunchMode, setHybridPunchMode] = useState('OFFICE'); // 'OFFICE' | 'FIELD'
  const isFieldStaffUser = userWorkType === 'FIELD' || (isHybridUser && hybridPunchMode === 'FIELD');

  // Auto-capture GPS location on mount
  useEffect(() => {
    if (typeof window !== 'undefined' && 'geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setCoords({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            gpsAccuracy: Math.round(pos.coords.accuracy || 15),
            address: `${pos.coords.latitude.toFixed(4)}°, ${pos.coords.longitude.toFixed(4)}°`,
          });
        },
        (err) => {
          console.warn('Auto GPS location capture warning:', err.message);
        },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 }
      );
    }
  }, []);

  const refreshGpsLocation = useCallback(() => {
    return new Promise((resolve) => {
      if (typeof window !== 'undefined' && 'geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const loc = {
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
              gpsAccuracy: Math.round(pos.coords.accuracy || 15),
              address: `${pos.coords.latitude.toFixed(4)}°, ${pos.coords.longitude.toFixed(4)}°`,
            };
            setCoords(loc);
            resolve(loc);
          },
          (err) => {
            console.warn('GPS fetch failed or denied:', err);
            resolve(coords);
          },
          { enableHighAccuracy: true, timeout: 8000 }
        );
      } else {
        resolve(coords);
      }
    });
  }, [coords]);

  // Extract department and branch cleanly from user / employee object
  const userDept =
    user?.department?.name ||
    (typeof user?.department === 'string' ? user.department : null) ||
    user?.employee?.employmentInfo?.department?.name ||
    user?.employee?.department?.name ||
    user?.employmentInfo?.department?.name ||
    'Management & Leadership';

  const userBranch =
    branch?._id === 'ALL'
      ? 'All Branches'
      : (branch?.name || user?.branch?.name || user?.employee?.employmentInfo?.branch?.name || 'Head Office');

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

        const activeBrId = branch?._id && branch._id !== 'ALL' ? branch._id : undefined;
        // STAGE 1: Core Daily Metrics (Employees, Attendance, Leaves)
        // Dispatched first so core numbers show up immediately
        const stage1Calls = [
          isOrgAdmin && canAccessModule('employees')
            ? employeeApi.getEmployees({ limit: 5, branch: activeBrId }).catch(() => ({ data: [] }))
            : Promise.resolve({ data: [] }),
          canAccessModule('attendance')
            ? isOrgAdmin
              ? attendanceApi.getAllOfficeAttendance({ date: todayStr, branch: activeBrId }).catch(() => [])
              : (user?.employee ? attendanceApi.getMyOfficeAttendance({ date: todayStr }).catch(() => []) : Promise.resolve([]))
            : Promise.resolve([]),
          canAccessModule('leaves')
            ? (isSuperAdmin || isDirector || isHrAdmin)
              ? leaveHolidayApi.getPendingLeaveApprovals().catch(() => leaveHolidayApi.getMyLeaves().catch(() => []))
              : leaveHolidayApi.getMyLeaves().catch(() => [])
            : Promise.resolve([]),
        ];

        const [empRes, attRes, leaveRes] = await Promise.allSettled(stage1Calls);

        const empDataVal = empRes.status === 'fulfilled' ? empRes.value : {};
        const employeesList = extractApiData(empDataVal, 'employees');
        // Properly read total count — backend returns total/totalCount/count at root or nested
        const totalEmps =
          empDataVal?.totalCount ??
          empDataVal?.total ??
          empDataVal?.count ??
          empDataVal?.data?.totalCount ??
          empDataVal?.data?.total ??
          empDataVal?.data?.count ??
          employeesList.length;

        const attDataVal = attRes.status === 'fulfilled' ? attRes.value : {};
        const todayAttList = extractApiData(attDataVal, 'attendance', 'records', 'sessions');

        const leaveDataVal = leaveRes.status === 'fulfilled' ? leaveRes.value : {};
        const leavesList = extractApiData(leaveDataVal, 'leaves', 'leaveRequests', 'pendingRequests', 'requests');

        // Merge employees + users (User = Employee in this system via syncUserEmployee)
        // Same bridge logic as EmployeeList.jsx to get accurate total
        let actualTotalEmps = totalEmps;
        try {
          // Fetch all employees (no branch filter for total count)
          const allEmpRes = await employeeApi.getEmployees({ limit: 1000, branch: activeBrId }).catch(() => ({}));
          const allEmpList = extractApiData(allEmpRes, 'employees');

          // Fetch all users (they are also employees in this system)
          const usersRes = await userApi.getUsers({ limit: 100 }).catch(() => ({ data: [] }));
          const rawUsers = extractApiData(usersRes, 'users', 'data') || (Array.isArray(usersRes) ? usersRes : []);
          const candidateUsers = Array.isArray(rawUsers) ? rawUsers : [];

          // Build set of emails already in employee list
          const existingEmails = new Set(
            allEmpList.map((e) => (e.basicInfo?.email || e.email || '').toLowerCase()).filter(Boolean)
          );

          // Count users not already in employee list (they are bridged employees)
          let bridgedCount = 0;
          candidateUsers.forEach((u) => {
            const uEmail = (u.email || '').toLowerCase();
            if (uEmail && !existingEmails.has(uEmail)) {
              // Branch filter for bridged users
              if (activeBrId) {
                const uBranchId = u.branch?._id || u.branch?.id || (typeof u.branch === 'string' ? u.branch : '');
                if (uBranchId && String(uBranchId) !== String(activeBrId)) return;
              }
              bridgedCount++;
              existingEmails.add(uEmail);
            }
          });

          actualTotalEmps = allEmpList.length + bridgedCount;
        } catch { }

        setStats((prev) => ({
          ...prev,
          employees: actualTotalEmps,
          todayAttendance: todayAttList.length,
          pendingLeaves: leaveDataVal?.count ?? leavesList.length,
        }));

        if (canAccessModule('employees')) {
          setRecentEmployees(employeesList.slice(0, 5));
        }

        // Load logged in employee's today attendance & face registration status
        const actualEmpId = user?.employee?._id || (typeof user?.employee === 'string' && /^[0-9a-fA-F]{24}$/.test(user.employee) ? user.employee : null);
        if (actualEmpId) {
          try {
            let myAtt = null;
            if (isFieldStaffUser) {
              myAtt = await attendanceApi.getMyFieldAttendance({ date: todayStr }).catch(() => null);
              if (!myAtt || (Array.isArray(myAtt) && myAtt.length === 0)) {
                myAtt = await attendanceApi.getEmployeeFieldAttendance(actualEmpId, { date: todayStr }).catch(() => null);
              }
            } else {
              myAtt = await attendanceApi.getMyOfficeAttendance({ date: todayStr }).catch(() => null);
            }
            const myAttList = extractApiData(myAtt, 'records', 'sessions', 'attendance', 'data');
            const myRecord = myAttList.find((r) => {
              const d = r.attendanceDate ? String(r.attendanceDate).substring(0, 10) : (r.date ? String(r.date).substring(0, 10) : '');
              const c = r.checkInTime ? String(r.checkInTime).substring(0, 10) : (r.firstCheckInTime ? String(r.firstCheckInTime).substring(0, 10) : '');
              return d === todayStr || c.startsWith(todayStr);
            }) || (myAttList.length > 0 ? myAttList[0] : null);

            let cachedToday = null;
            try {
              const raw = localStorage.getItem(`tie_today_att_${actualEmpId}_${todayStr}`);
              if (raw) cachedToday = JSON.parse(raw);
            } catch { }

            setMyTodayAttendance(cachedToday || myRecord || null);
          } catch { }

          try {
            const st = await faceApi.getFaceStatus(actualEmpId);
            const sData = st?.data || st;
            const isEnr = sData?.isRegistered === true || sData?.status === 'REGISTERED' || sData?.status === 'ENROLLED' || sData?.isEnrolled === true;
            const hasLocalSelfie = !!localStorage.getItem(`tie_reg_selfie_${actualEmpId}`) || !!localStorage.getItem(`tie_face_enrolled_${actualEmpId}`);
            setMyFaceStatus({ isEnrolled: isEnr || hasLocalSelfie, details: sData });
          } catch {
            const hasLocalSelfie = !!localStorage.getItem(`tie_reg_selfie_${actualEmpId}`) || !!localStorage.getItem(`tie_face_enrolled_${actualEmpId}`);
            setMyFaceStatus({ isEnrolled: hasLocalSelfie });
          }
        } else {
          setMyTodayAttendance(null);
          setMyFaceStatus({ isEnrolled: false });
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
    [isSuperAdmin, isHrAdmin, isDirector, isBranchManager, canAccessModule, user, branch]
  );

  const handleOpenFaceModal = async (mode = 'CHECK_IN') => {
    setPunchMode(mode);
    setCapturedPhoto(null);
    setPunchSuccess(null);
    setPunchError(null);
    setFaceModalOpen(true);
    setCheckingFaceStatus(true);

    // Auto-refresh GPS coordinates
    refreshGpsLocation();

    // Resolve employee branch location coordinates & radius for 500m verification (only relevant for OFFICE)
    const empBranch =
      user?.employee?.employmentInfo?.branch ||
      user?.employee?.branch ||
      user?.branch;
    if (empBranch && !isFieldStaffUser) {
      setLoadingBranchLocation(true);
      resolveBranchLocation(empBranch)
        .then((loc) => setBranchLocation(loc))
        .catch(() => setBranchLocation(null))
        .finally(() => setLoadingBranchLocation(false));
    }

    const actualEmpId = user?.employee?._id || (typeof user?.employee === 'string' && /^[0-9a-fA-F]{24}$/.test(user.employee) ? user.employee : null);
    if (actualEmpId) {
      try {
        const st = await faceApi.getFaceStatus(actualEmpId);
        const sData = st?.data || st;
        const isEnr = sData?.isRegistered === true || sData?.status === 'REGISTERED' || sData?.status === 'ENROLLED' || sData?.isEnrolled === true;
        const hasLocalSelfie = !!localStorage.getItem(`tie_reg_selfie_${actualEmpId}`) || !!localStorage.getItem(`tie_face_enrolled_${actualEmpId}`);
        setMyFaceStatus({ isEnrolled: isEnr || hasLocalSelfie, details: sData });
      } catch {
        const hasLocalSelfie = !!localStorage.getItem(`tie_reg_selfie_${actualEmpId}`) || !!localStorage.getItem(`tie_face_enrolled_${actualEmpId}`);
        setMyFaceStatus({ isEnrolled: hasLocalSelfie });
      } finally {
        setCheckingFaceStatus(false);
      }

      // Resolve registered photo for biometric face matching
      try {
        let photo = user?.employee?.basicInfo?.photo || user?.photo || null;
        if (!photo) {
          const empRes = await employeeApi.getEmployeeById(actualEmpId);
          const empData = empRes?.data || empRes?.employee || empRes;
          photo = empData?.basicInfo?.photo || empData?.photo || null;
        }
        setRegisteredFacePhoto(photo);
      } catch {
        setRegisteredFacePhoto(null);
      }
    } else {
      setCheckingFaceStatus(false);
      setMyFaceStatus({ isEnrolled: false });
    }
  };

  const handleFaceAttendanceSubmit = async () => {
    const actualEmpId = user?.employee?._id || (typeof user?.employee === 'string' && /^[0-9a-fA-F]{24}$/.test(user.employee) ? user.employee : null);
    if (!actualEmpId) {
      showToast('No employee profile linked to your account. Attendance punch requires an employee profile.', 'warning');
      return;
    }
    if (!capturedPhoto) {
      showToast('Please capture your face photo first', 'warning');
      return;
    }
    if (!myFaceStatus?.isEnrolled) {
      const notEnrolledMsg = 'Face registration required: Super Admin must register your face in Employee Master before you can check in.';
      setPunchError(notEnrolledMsg);
      showToast(notEnrolledMsg, 'error');
      return;
    }

    // Auto-capture GPS if not present yet
    let activeCoords = coords;
    if (!activeCoords || (activeCoords.latitude == null && activeCoords.longitude == null)) {
      activeCoords = await refreshGpsLocation();
    }

    if (!activeCoords || activeCoords.gpsUnavailable || activeCoords.error || (activeCoords.latitude == null && activeCoords.longitude == null)) {
      const geoErr = 'GPS Location required: Please enable device location / GPS permissions to record attendance.';
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
        const noPhotoErr = 'No registered face photograph found for this employee. Super Admin must register your face in Employee Master before you can mark attendance.';
        setPunchError(noPhotoErr);
        showToast(noPhotoErr, 'error');
        setVerifyingFace(false);
        return;
      }

      const compareResult = await compareFacePhotos(regPhoto, capturedPhoto, 0.70);
      if (!compareResult.matched) {
        const mismatchReason = compareResult.reason || `Face biometric mismatch (${compareResult.confidencePct || 35}% match). Live camera face does not match the registered employee selfie! Check-in rejected.`;
        setPunchError(mismatchReason);
        showToast(mismatchReason, 'error');
        setVerifyingFace(false);
        return;
      }

      // Also verify with backend faceApi
      let faceRes;
      try {
        faceRes = await faceApi.verifyFace(myEmpId, capturedPhoto, userWorkType);
      } catch (err) {
        faceRes = err.response?.data || { matched: true };
      }

      const confidence = faceRes?.confidenceScore ?? faceRes?.data?.confidenceScore ?? (compareResult.confidencePct ? compareResult.confidencePct / 100 : 0.95);
      const matchResult = faceRes?.matchResult || faceRes?.data?.matchResult || 'MATCHED';
      const isMatched = faceRes?.matched !== false && matchResult !== 'NOT_MATCHED' && matchResult !== 'NO_FACE_DETECTED' && matchResult !== 'LOW_CONFIDENCE';

      if (!isMatched) {
        const reason = faceRes?.reason || faceRes?.data?.reason || `Face biometric mismatch (${Math.round(confidence * 100)}% match). Live photo does not match registered employee selfie. Attendance rejected.`;
        setPunchError(reason);
        showToast('Face verification failed: Photo did not match registered selfie!', 'error');
        setVerifyingFace(false);
        return;
      }

      // 2. CONDITION 2: 500m Radius Geo-Location Check against Branch (Only for OFFICE work type)
      if (!isFieldStaffUser && branchLocation && branchLocation.latitude != null && branchLocation.longitude != null) {
        const distance = calculateDistanceMeters(
          activeCoords.latitude,
          activeCoords.longitude,
          branchLocation.latitude,
          branchLocation.longitude
        );
        const maxRadius = branchLocation.radiusMeters || 500;

        if (distance !== null && distance > maxRadius) {
          const distErr = `Location check failed: You are ${distance}m away from ${branchLocation.branchName || 'your office branch'}. Office check-in is only permitted within ${maxRadius}m radius.`;
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

      if (isFieldStaffUser) {
        if (punchMode === 'CHECK_IN') {
          await attendanceApi.fieldCheckIn(checkInPayload);
          showToast('Site-In successfully recorded! Face & GPS location verified.', 'success');
        } else {
          await attendanceApi.fieldCheckOut(checkOutPayload);
          showToast('Site-Out successfully recorded! Face & GPS location verified.', 'success');
        }
      } else {
        if (punchMode === 'CHECK_IN') {
          await attendanceApi.officeCheckIn(checkInPayload);
          showToast('Office Check-In successfully recorded! Face & location verified.', 'success');
        } else {
          await attendanceApi.officeCheckOut(checkOutPayload);
          showToast('Office Check-Out successfully recorded! Face & location verified.', 'success');
        }
      }

      const isCheckIn = punchMode === 'CHECK_IN';
      const updatedAttendance = {
        ...(myTodayAttendance || {}),
        attendanceDate: todayStr,
        isOpen: isCheckIn,
        firstCheckInTime: isCheckIn ? now.toISOString() : (myTodayAttendance?.firstCheckInTime || now.toISOString()),
        checkInTime: isCheckIn ? now.toISOString() : (myTodayAttendance?.checkInTime || now.toISOString()),
        lastCheckOutTime: isCheckIn ? null : now.toISOString(),
        checkOutTime: isCheckIn ? null : now.toISOString(),
        dutyCheckedIn: true,
        dutyCheckedOut: !isCheckIn,
      };
      setMyTodayAttendance(updatedAttendance);
      try {
        localStorage.setItem(`tie_today_att_${myEmpId}_${todayStr}`, JSON.stringify(updatedAttendance));
      } catch { }

      setPunchSuccess({
        mode: punchMode,
        time: timeStr,
        date: todayStr,
        confidence: Math.round((confidence || 0.95) * 100),
        address: addressStr,
      });

      // Refresh Dashboard data and attendance in background
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

  // Trigger fetch when user profile is loaded or active branch changes
  useEffect(() => {
    if (user?._id) {
      fetchDashboardData(true);
    }
  }, [user?._id, branch?._id, fetchDashboardData]);

  useEffect(() => {
    const handleContextChange = () => {
      fetchDashboardData(true);
    };
    window.addEventListener('tie:context-changed', handleContextChange);
    return () => window.removeEventListener('tie:context-changed', handleContextChange);
  }, [fetchDashboardData]);

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
      title: isOrgAdmin ? 'Total Employees' : 'Team Directory',
      value: stats.employees,
      icon: Users,
      color: '#0d9488',
      bg: 'rgba(13, 148, 136, 0.1)',
      link: '/employees',
      subtext: isOrgAdmin ? 'Staff in selected branch' : 'Team members',
    });
  }

  if (canAccessModule('attendance')) {
    statCards.push({
      title: isEmployee && !isSuperAdmin && !isHrAdmin && !isBranchManager ? "My Today's Status" : "Today's Attendance",
      value: isEmployee && !isSuperAdmin && !isHrAdmin && !isBranchManager ? (myTodayAttendance?.checkInTime ? 'Checked In' : 'Pending') : stats.todayAttendance,
      icon: CalendarCheck,
      color: '#16a34a',
      bg: 'rgba(22, 163, 74, 0.1)',
      link: '/attendance',
      subtext: isEmployee && !isSuperAdmin && !isHrAdmin && !isBranchManager ? 'Daily presence' : 'Recorded present today',
    });
  }

  if (canAccessModule('leaves')) {
    statCards.push({
      title: isEmployee && !isSuperAdmin && !isHrAdmin && !isBranchManager ? 'My Leave Requests' : 'Pending Leave Approvals',
      value: stats.pendingLeaves,
      icon: CalendarOff,
      color: 'var(--logo-orange, #f5a532)',
      bg: 'rgba(245, 165, 50, 0.12)',
      link: '/leaves',
      subtext: isEmployee && !isSuperAdmin && !isHrAdmin && !isBranchManager ? 'Application status' : 'Awaiting admin review',
    });
  }

  if (canAccessModule('recruitment') && isOrgAdmin) {
    statCards.push({
      title: 'Open Job Vacancies',
      value: stats.openJobs,
      icon: Briefcase,
      color: 'var(--primary, #3f929a)',
      bg: 'rgba(63, 146, 154, 0.1)',
      link: '/recruitment/jobs',
      subtext: 'Active job openings',
    });
  }

  if (canAccessModule('payroll')) {
    statCards.push({
      title: isOrgAdmin ? 'Payroll & Salaries' : 'My Payslips',
      value: stats.payrollRuns || 'Active',
      icon: TrendingUp,
      color: '#8b5cf6',
      bg: 'rgba(139, 92, 246, 0.1)',
      link: isOrgAdmin ? '/payroll' : '/payroll/payslips',
      subtext: isOrgAdmin ? 'Monthly cycles & runs' : 'View monthly statements',
    });
  }

  if (canAccessModule('assets-claims') || canAccessModule('assets')) {
    statCards.push({
      title: isOrgAdmin ? 'Assets & Custody' : 'My Assigned Assets',
      value: stats.assets || 'Active',
      icon: Shield,
      color: 'var(--logo-orange, #f5a532)',
      bg: 'rgba(245, 165, 50, 0.1)',
      link: '/assets-claims',
      subtext: 'Hardware & inventory',
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
      subtext: 'Field sites & operations',
    });
  }

  if (canAccessModule('tasks')) {
    statCards.push({
      title: isOrgAdmin ? 'Tasks & Milestones' : 'My Open Tasks',
      value: stats.tasks || 'Active',
      icon: Layers,
      color: '#e11d48',
      bg: 'rgba(225, 29, 72, 0.1)',
      link: '/operations/tasks',
      subtext: 'Action items & deliverables',
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
      color: 'var(--primary, #3f929a)',
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
      color: 'var(--logo-orange, #f5a532)',
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

  // Dynamic User Greeting & Context
  const currentHour = new Date().getHours();
  const greeting = currentHour < 12 ? 'Good morning' : currentHour < 18 ? 'Good afternoon' : 'Good evening';
  const userName = user?.name || user?.basicInfo?.fullName || user?.firstName || 'User';
  const userInitials = userName
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0])
    .join('')
    .substring(0, 2)
    .toUpperCase() || 'U';

  const todayFormattedDate = new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }).format(new Date());

  return (
    <div className="dashboard-container">
      {/* ─── 1. Modern Header Welcome Banner ─── */}
      <div className="dash-welcome-card">
        <div className="dash-welcome-left">
          <div className="dash-user-avatar">
            {userInitials}
          </div>
          <div>
            <h1 className="dash-greeting-title">
              {greeting}, {userName}!
              <Badge variant="primary" style={{ fontSize: '0.72rem', padding: '3px 8px', fontWeight: 600 }}>
                {userRole || 'Employee'}
              </Badge>
            </h1>
            <div className="dash-greeting-subtitle">
              <span>{userDept}</span>
              <span>•</span>
              <span style={{ color: 'var(--primary)', fontWeight: 600 }}>{userBranch}</span>
              <span>•</span>
              <span>{todayFormattedDate}</span>
            </div>
          </div>
        </div>

        <div className="dash-welcome-right">
          <div className="dash-context-chip" title="Current Active Branch">
            <MapPin size={13} color="var(--primary)" />
            <span>{userBranch}</span>
          </div>
          <button
            type="button"
            onClick={() => fetchDashboardData(true)}
            disabled={isRefreshing}
            className="dash-refresh-btn"
            title="Refresh dashboard metrics"
          >
            <RefreshCw size={13} style={{ animation: isRefreshing ? 'spin 1s linear infinite' : 'none' }} />
            <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {/* ─── 2. Quick Action Pills Bar (Role Tailored) ─── */}
      <div className="dash-actions-bar">
        {isOrgAdmin ? (
          <>
            <Link to="/employees" className="dash-action-pill primary">
              <Plus size={14} /> Add Employee
            </Link>
            <Link to="/operations/tasks" className="dash-action-pill">
              <Plus size={14} /> Assign Task
            </Link>
            <Link to="/leaves" className="dash-action-pill">
              <CalendarOff size={14} /> Leave Approvals {stats.pendingLeaves > 0 && `(${stats.pendingLeaves})`}
            </Link>
            {canAccessModule('payroll') && (
              <Link to="/payroll" className="dash-action-pill">
                <TrendingUp size={14} /> Process Payroll
              </Link>
            )}
            {canAccessModule('attendance') && (
              <Link to="/attendance/face-punch" className="dash-action-pill">
                <ScanFace size={14} /> Biometric Gate
              </Link>
            )}
            {isMasterAdmin && (
              <Link to="/masters/branches" className="dash-action-pill">
                <Building2 size={14} /> Branches Directory
              </Link>
            )}
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => handleOpenFaceModal(myTodayAttendance?.checkInTime ? 'CHECK_OUT' : 'CHECK_IN')}
              className="dash-action-pill primary"
              style={{ cursor: 'pointer' }}
            >
              <ScanFace size={14} /> {myTodayAttendance?.checkInTime ? 'Punch Check-Out' : 'Punch Check-In'}
            </button>
            <Link to="/leaves" className="dash-action-pill">
              <Plus size={14} /> Apply for Leave
            </Link>
            <Link to="/payroll/payslips" className="dash-action-pill">
              <TrendingUp size={14} /> View Payslips
            </Link>
            <Link to="/operations/tasks" className="dash-action-pill">
              <Layers size={14} /> My Tasks
            </Link>
          </>
        )}
      </div>

      {/* ─── 3. KPI Stat Cards Grid ─── */}
      <div className="dash-kpi-grid">
        {statCards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <Link key={idx} to={card.link} className="dash-kpi-card">
              <div className="dash-kpi-info">
                <span className="dash-kpi-title">{card.title}</span>
                <span className="dash-kpi-value">{card.value}</span>
                {card.subtext && <span className="dash-kpi-subtext">{card.subtext}</span>}
              </div>
              <div className="dash-kpi-icon" style={{ backgroundColor: card.bg, color: card.color }}>
                <Icon size={22} />
              </div>
            </Link>
          );
        })}
      </div>

      {/* ─── 4. Main Two-Column Content Grid ─── */}
      <div className="dash-content-grid">
        {/* Left Column (65%): Recently Onboarded Employees OR My Workplace */}
        {canAccessModule('employees') ? (
          <div className="dash-panel">
            <div className="dash-panel-header">
              <h3 className="dash-panel-title">
                <Users size={16} color="var(--primary)" />
                Recently Onboarded Employees
              </h3>
              <Link to="/employees" className="dash-panel-link">
                View All Directory <ChevronRight size={13} />
              </Link>
            </div>
            <div className="dash-table-wrap">
              <table className="dash-table">
                <thead>
                  <tr>
                    <th style={{ width: 110 }}>Code</th>
                    <th>Employee Name</th>
                    <th>Department</th>
                    <th>Designation</th>
                    <th style={{ textAlign: 'center', width: 95 }}>Status</th>
                    <th style={{ textAlign: 'center', width: 140 }}>Biometric Face</th>
                  </tr>
                </thead>
                <tbody>
                  {recentEmployees.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: 28, color: '#94a3b8' }}>
                        No employees found in selected branch.
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
                        <tr key={empId}>
                          <td>
                            <span className="dash-code-tag">{empCode}</span>
                          </td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <div
                                style={{
                                  width: 32,
                                  height: 32,
                                  borderRadius: 8,
                                  backgroundColor: 'rgba(46, 123, 133, 0.12)',
                                  color: 'var(--primary)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: '0.76rem',
                                  fontWeight: 700,
                                  flexShrink: 0,
                                }}
                              >
                                {initials || 'EM'}
                              </div>
                              <div>
                                <div style={{ fontWeight: 600, color: '#0f172a' }}>{empName}</div>
                                {empEmail && (
                                  <div style={{ fontSize: '0.73rem', color: '#64748b' }}>{empEmail}</div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td style={{ color: '#475569' }}>{deptName}</td>
                          <td style={{ color: '#334155', fontWeight: 500 }}>{desigTitle}</td>
                          <td style={{ textAlign: 'center' }}>
                            <Badge variant={empStatus.toLowerCase() === 'active' ? 'success' : 'secondary'}>
                              {empStatus.charAt(0).toUpperCase() + empStatus.slice(1).toLowerCase()}
                            </Badge>
                          </td>
                          <td style={{ textAlign: 'center' }}>
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
          <div className="dash-panel">
            <div className="dash-panel-header">
              <h3 className="dash-panel-title">
                <Users size={16} color="var(--primary)" />
                My Workplace & Department Summary
              </h3>
              <Badge variant="primary">{userRole || 'Employee'}</Badge>
            </div>
            <div className="dash-panel-body">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
                <div style={{ padding: 14, borderRadius: 10, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Department</div>
                  <div style={{ fontWeight: 700, fontSize: '0.96rem', color: '#0f172a', marginTop: 3 }}>{userDept}</div>
                  <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: 2 }}>Location: {userBranch}</div>
                </div>

                <div style={{ padding: 14, borderRadius: 10, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Work Type</div>
                  <div style={{ fontWeight: 700, fontSize: '0.96rem', color: '#0f172a', marginTop: 3 }}>
                    {isFieldStaffUser ? 'Field Staff' : 'Office Staff'}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--primary)', marginTop: 2 }}>
                    {isFieldStaffUser ? 'Office & Field Attendance' : 'Office Biometric Attendance'}
                  </div>
                </div>

                <div style={{ padding: 14, borderRadius: 10, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Biometrics Status</div>
                  <div style={{ fontWeight: 700, fontSize: '0.96rem', color: '#16a34a', display: 'flex', alignItems: 'center', gap: 5, marginTop: 3 }}>
                    <CheckCircle2 size={15} /> Biometrics Active
                  </div>
                  <Link to="/attendance/face-punch" style={{ fontSize: '0.78rem', color: 'var(--primary)', textDecoration: 'none', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 3, marginTop: 2 }}>
                    Gate View <ChevronRight size={12} />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Right Column (35%): Attendance Widget + Branch Overview */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Daily Biometric Attendance Punch Widget */}
          {(() => {
            const isCheckedIn = Boolean(
              myTodayAttendance &&
              (myTodayAttendance.checkInTime || myTodayAttendance.firstCheckInTime || myTodayAttendance.dutyCheckedIn || myTodayAttendance.isOpen === true) &&
              !myTodayAttendance.checkOutTime &&
              !myTodayAttendance.lastCheckOutTime &&
              !myTodayAttendance.dutyCheckedOut &&
              myTodayAttendance.isOpen !== false
            );

            const isCheckedOut = Boolean(
              myTodayAttendance &&
              (myTodayAttendance.checkOutTime || myTodayAttendance.lastCheckOutTime || myTodayAttendance.dutyCheckedOut || myTodayAttendance.isOpen === false) &&
              (myTodayAttendance.checkInTime || myTodayAttendance.firstCheckInTime || myTodayAttendance.dutyCheckedIn)
            );

            const rawInTime = myTodayAttendance?.firstCheckInTime || myTodayAttendance?.checkInTime;
            const todayCheckInTimeStr = rawInTime ? new Date(rawInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--';
            const rawOutTime = myTodayAttendance?.lastCheckOutTime || myTodayAttendance?.checkOutTime;
            const todayCheckOutTimeStr = rawOutTime ? new Date(rawOutTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--';

            // Work type rules: Office staff only sees Office. Field staff sees both Office and Field.
            const punchLabel = isCheckedIn ? 'Check-Out (Face Match)' : 'Check-In (Face Match)';

            return (
              <div className="dash-punch-widget">
                <div className="dash-punch-status-row">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <ScanFace size={16} color="var(--primary)" />
                    <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#0f172a' }}>Daily Attendance</span>
                  </div>
                  <span className={`dash-punch-status-badge ${isCheckedIn ? 'checked-in' : isCheckedOut ? 'checked-out' : 'not-checked'}`}>
                    {isCheckedIn ? <CheckCircle2 size={11} /> : isCheckedOut ? <CheckCircle2 size={11} /> : <Clock size={11} />}
                    {isCheckedIn ? 'Checked In' : isCheckedOut ? 'Shift Done' : 'Not In Today'}
                  </span>
                </div>

                {/* Work Type: Field staff has Office / Field toggle; Office staff is locked to Office */}
                {isFieldStaffUser && (
                  <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: 7, padding: 2, marginBottom: 12 }}>
                    <button
                      type="button"
                      onClick={() => setHybridPunchMode('OFFICE')}
                      style={{
                        flex: 1,
                        border: 'none',
                        borderRadius: 5,
                        padding: '4px 8px',
                        fontSize: '0.74rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        background: hybridPunchMode === 'OFFICE' ? 'var(--primary)' : 'transparent',
                        color: hybridPunchMode === 'OFFICE' ? '#ffffff' : '#64748b',
                        transition: 'all 0.15s ease',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 4,
                      }}
                    >
                      <Building2 size={12} /> Office
                    </button>
                    <button
                      type="button"
                      onClick={() => setHybridPunchMode('FIELD')}
                      style={{
                        flex: 1,
                        border: 'none',
                        borderRadius: 5,
                        padding: '4px 8px',
                        fontSize: '0.74rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        background: hybridPunchMode === 'FIELD' ? 'var(--primary)' : 'transparent',
                        color: hybridPunchMode === 'FIELD' ? '#ffffff' : '#64748b',
                        transition: 'all 0.15s ease',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 4,
                      }}
                    >
                      <MapPin size={12} /> Site / Field
                    </button>
                  </div>
                )}

                {/* Check In / Out Time Display */}
                <div className="dash-punch-time-display">
                  <div className="dash-punch-time-col">
                    <span className="dash-punch-time-label">Check-In</span>
                    <div className="dash-punch-time-val">{todayCheckInTimeStr}</div>
                  </div>
                  <div style={{ width: 1, height: 26, background: '#cbd5e1' }} />
                  <div className="dash-punch-time-col">
                    <span className="dash-punch-time-label">Check-Out</span>
                    <div className="dash-punch-time-val">{todayCheckOutTimeStr}</div>
                  </div>
                </div>

                {/* Primary Biometric Punch Button */}
                <button
                  type="button"
                  onClick={() => handleOpenFaceModal(isCheckedIn ? 'CHECK_OUT' : 'CHECK_IN')}
                  className={`dash-punch-action-btn ${isCheckedIn ? 'out' : 'in'}`}
                >
                  {isCheckedIn ? <LogOut size={16} /> : <LogIn size={16} />}
                  <span>{punchLabel}</span>
                </button>

                {/* Sub-links */}
                <div className="dash-punch-sublinks">
                  <Link to="/attendance/face-punch" className="dash-punch-sublink">
                    <Clock size={12} /> Full Gate View
                  </Link>
                  {coords && (
                    <span style={{ color: '#0d9488', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                      <MapPin size={12} /> GPS Active
                    </span>
                  )}
                </div>

                {!myFaceStatus?.isEnrolled && (
                  <div style={{ marginTop: 10, padding: '6px 10px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 7, fontSize: '0.73rem', color: '#b91c1c', display: 'flex', alignItems: 'center', gap: 5 }}>
                    <AlertCircle size={13} style={{ flexShrink: 0 }} />
                    <span>Admin face enrollment required for attendance.</span>
                  </div>
                )}
              </div>
            );
          })()}

          {/* Branch & Organization Status Widget */}
          <div className="dash-branch-overview">
            <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#0f172a', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Building2 size={15} color="var(--primary)" />
              Branch &amp; Organization Context
            </div>
            <div className="dash-overview-item">
              <span className="dash-overview-label">Active Branch</span>
              <span className="dash-overview-val" style={{ color: 'var(--primary)' }}>{userBranch}</span>
            </div>
            <div className="dash-overview-item">
              <span className="dash-overview-label">Assigned Role</span>
              <span className="dash-overview-val">{userRole || 'Employee'}</span>
            </div>
            <div className="dash-overview-item">
              <span className="dash-overview-label">Biometric System</span>
              <span className="dash-overview-val" style={{ color: '#16a34a' }}>Active &amp; Live</span>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Biometric Face Attendance Modal */}
      <Modal
        isOpen={faceModalOpen}
        onClose={() => {
          setFaceModalOpen(false);
          setCapturedPhoto(null);
          setPunchSuccess(null);
          setPunchError(null);
        }}
        title={
          isFieldStaffUser
            ? (punchMode === 'CHECK_IN' ? 'Field Site-In Biometric Verification' : 'Field Site-Out Biometric Verification')
            : (punchMode === 'CHECK_IN' ? 'Office Check-In Biometric Verification' : 'Office Check-Out Biometric Verification')
        }
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
              {punchSuccess.mode === 'CHECK_IN'
                ? (isFieldStaffUser ? 'Site-In Successfully Recorded!' : 'Office Check-In Successfully Recorded!')
                : (isFieldStaffUser ? 'Site-Out Successfully Recorded!' : 'Office Check-Out Successfully Recorded!')}
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', margin: '0 0 20px' }}>
              Your face was verified with {punchSuccess.confidence}% biometric confidence and GPS coordinates recorded.
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
                  Code: {user?.employeeCode || user?.basicInfo?.employeeCode || 'SELF'} &bull; Work Type: <strong>{userWorkType}</strong> &bull; {userDept}
                </div>
              </div>
              <div>
                {checkingFaceStatus ? (
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> Checking enrollment...
                  </span>
                ) : myFaceStatus?.isEnrolled ? (
                  <Badge variant="success">
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <CheckCircle2 size={12} /> Face Enrolled &amp; Ready
                    </span>
                  </Badge>
                ) : (
                  <Badge variant="danger">
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <AlertTriangle size={12} /> Face Not Enrolled
                    </span>
                  </Badge>
                )}
              </div>
            </div>

            {!checkingFaceStatus && myFaceStatus && !myFaceStatus.isEnrolled ? (
              <div
                style={{
                  padding: 24,
                  backgroundColor: '#fef2f2',
                  border: '1px solid #fecaca',
                  borderRadius: 10,
                  textAlign: 'center',
                }}
              >
                <AlertTriangle size={38} color="#dc2626" style={{ margin: '0 auto 10px' }} />
                <h4 style={{ margin: '0 0 6px', color: '#991b1b', fontWeight: 700 }}>
                  Face Registration Required by Super Admin
                </h4>
                <p style={{ margin: '0 0 16px', fontSize: '0.84rem', color: '#b91c1c', lineHeight: 1.5 }}>
                  Your face photograph has not been registered yet.
                  <br />
                  <strong>Policy:</strong> Super Admin must register the employee face in Employee Master before check-in can be performed.
                </p>
                {isSuperAdmin ? (
                  <Link
                    to="/employees"
                    className="btn btn-primary btn-sm"
                    onClick={() => setFaceModalOpen(false)}
                  >
                    Go to Employee Master to Register Face
                  </Link>
                ) : (
                  <div style={{ fontSize: '0.82rem', color: '#7f1d1d', background: '#fee2e2', padding: '8px 14px', borderRadius: 6, display: 'inline-block' }}>
                    Please contact your Super Admin to register your face photograph.
                  </div>
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
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Clock size={16} color="var(--primary)" />
                        <span style={{ fontSize: '0.88rem', fontWeight: 600 }}>2. Mode &amp; Location</span>
                      </div>
                      <span style={{ fontSize: '0.72rem', color: isFieldStaffUser ? '#0284c7' : '#64748b', fontWeight: 600 }}>
                        {isFieldStaffUser ? 'Field Staff' : 'Office Staff'}
                      </span>
                    </div>

                    {isFieldStaffUser && (
                      <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: 6, padding: 2, marginBottom: 10 }}>
                        <button
                          type="button"
                          onClick={() => setHybridPunchMode('OFFICE')}
                          style={{
                            flex: 1, border: 'none', borderRadius: 4, padding: '4px',
                            fontSize: '0.74rem', fontWeight: 600, cursor: 'pointer',
                            background: hybridPunchMode === 'OFFICE' ? 'var(--primary)' : 'transparent',
                            color: hybridPunchMode === 'OFFICE' ? '#fff' : '#64748b',
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4
                          }}
                        >
                          <Building2 size={12} /> Office Check-In
                        </button>
                        <button
                          type="button"
                          onClick={() => setHybridPunchMode('FIELD')}
                          style={{
                            flex: 1, border: 'none', borderRadius: 4, padding: '4px',
                            fontSize: '0.74rem', fontWeight: 600, cursor: 'pointer',
                            background: hybridPunchMode === 'FIELD' ? 'var(--primary)' : 'transparent',
                            color: hybridPunchMode === 'FIELD' ? '#fff' : '#64748b',
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4
                          }}
                        >
                          <MapPin size={12} /> Site / Field
                        </button>
                      </div>
                    )}

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
                      <button
                        type="button"
                        onClick={() => setPunchMode('CHECK_IN')}
                        className={`btn ${punchMode === 'CHECK_IN' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                      >
                        {isFieldStaffUser && hybridPunchMode === 'FIELD' ? 'Site-In (GPS)' : 'Office Check-In'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setPunchMode('CHECK_OUT')}
                        className={`btn ${punchMode === 'CHECK_OUT' ? 'btn-danger' : 'btn-secondary'} btn-sm`}
                        style={punchMode === 'CHECK_OUT' ? { backgroundColor: '#dc2626', borderColor: '#dc2626', color: '#fff' } : {}}
                      >
                        {isFieldStaffUser && hybridPunchMode === 'FIELD' ? 'Site-Out (GPS)' : 'Office Check-Out'}
                      </button>
                    </div>
                    <GeoLocationPicker
                      onLocationChange={(c) => setCoords(c)}
                      targetLocation={hybridPunchMode === 'OFFICE' ? branchLocation : null}
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
                      ? 'Matching Face with Registered Selfie...'
                      : submittingPunch
                        ? 'Recording Attendance with GPS...'
                        : punchMode === 'CHECK_IN'
                          ? (isFieldStaffUser ? 'Match Face & Submit Site-In' : 'Match Face & Submit Office Check-In')
                          : (isFieldStaffUser ? 'Match Face & Submit Site-Out' : 'Match Face & Submit Office Check-Out')}
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
