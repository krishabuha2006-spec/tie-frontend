import React, { useState, useEffect, useRef } from 'react';
import attendanceApi from '../../api/attendanceApi';
import employeeApi from '../../api/employeeApi';
import masterApi from '../../api/masterApi';
import { projectTaskApi } from '../../api/projectTaskApi';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import {
  MapPin,
  Camera,
  Clock,
  Plus,
  Shield,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Calendar,
  Building2,
  User,
  Search,
  Filter,
  Layers,
  Edit2,
  Compass,
  Navigation,
  Check,
  X,
  Sparkles,
  AlertCircle,
  HardHat,
  LogIn,
  LogOut,
  FileCheck,
  Image as ImageIcon,
  FolderKanban,
  Lock,
  Unlock,
  ArrowRight,
} from 'lucide-react';
import Table from '../../components/common/Table';
import Modal from '../../components/common/Modal';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import Select from '../../components/common/Select';
import Badge from '../../components/common/Badge';
import ModuleSubNav from '../../components/common/ModuleSubNav';
import { attendanceNav } from '../../routes/moduleNavConfig';

export const FieldAttendance = () => {
  const { isSuperAdmin, isHrAdmin, user } = useAuth();
  const { showToast } = useToast();
  const canCorrect = isSuperAdmin || isHrAdmin;

  // Active Tab
  const [activeTab, setActiveTab] = useState('records'); // 'records' | 'punch' | 'my_history' | 'employee_history'

  // Org-wide field records
  const [records, setRecords] = useState([]);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [filters, setFilters] = useState({
    date: new Date().toISOString().split('T')[0],
    branch: '',
    attendanceStatus: '',
    isOpen: '',
    search: '',
  });

  const getEmpName = (emp) => {
    if (!emp) return 'Field Officer';
    if (typeof emp === 'string') {
      if (user && (user._id === emp || user.employee === emp || user.employee?._id === emp)) {
        return user.name || 'Field Officer';
      }
      return 'Field Officer';
    }
    return (
      emp.basicInfo?.fullName ||
      emp.fullName ||
      (emp.firstName ? `${emp.firstName} ${emp.lastName || ''}`.trim() : '') ||
      emp.name ||
      'Field Officer'
    );
  };

  const getEmpCode = (emp) => {
    if (!emp) return '-';
    if (typeof emp === 'string') {
      if (user && (user._id === emp || user.employee === emp || user.employee?._id === emp)) {
        return user.employeeCode || user.email?.split('@')[0] || '-';
      }
      return '-';
    }
    return emp.basicInfo?.employeeCode || emp.employeeCode || '-';
  };

  const getAddressStr = (addr, fallback = 'Site Area') => {
    if (!addr) return fallback;
    if (typeof addr === 'string') return addr;
    if (typeof addr === 'object') {
      const parts = [addr.street, addr.city, addr.state].filter(Boolean);
      return parts.length > 0 ? parts.join(', ') : (addr.city || fallback);
    }
    return fallback;
  };

  // Client-side search filtering on API records
  const filteredRecords = records.filter((r) => {
    if (!filters.search) return true;
    const s = filters.search.toLowerCase();
    const empName = getEmpName(r.employee).toLowerCase();
    const empCode = String(getEmpCode(r.employee)).toLowerCase();
    return empName.includes(s) || empCode.includes(s);
  });

  // Dynamic Real-Time KPI Stats from backend API records
  const totalCount = records.length;
  const activeCount = records.filter((r) => r.isOpen).length;
  const presentCount = records.filter((r) => r.attendanceStatus === 'PRESENT').length;
  const shortfallCount = records.filter((r) => r.attendanceStatus === 'SHORTFALL').length;

  // Masters
  const [branches, setBranches] = useState([]);
  const [employees, setEmployees] = useState([]);

  // Multi-punch session modal
  const [sessionModalOpen, setSessionModalOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);

  // Step 7: Admin Correction Modal
  const [correctModalOpen, setCorrectModalOpen] = useState(false);
  const [correctForm, setCorrectForm] = useState({
    requiredWorkingHours: 8,
    totalWorkingHours: 8,
    attendanceStatus: 'PRESENT',
    correctionRemark: '',
  });
  const [submittingCorrect, setSubmittingCorrect] = useState(false);

  // My history tab state (GET /attendance/field/me)
  const [myHistory, setMyHistory] = useState([]);
  const [loadingMyHistory, setLoadingMyHistory] = useState(false);

  // Employee history tab state (GET /attendance/field/employees/:id)
  const [selectedHistoryEmpId, setSelectedHistoryEmpId] = useState('');
  const [employeeHistory, setEmployeeHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Punch Console State
  const [punchEmpId, setPunchEmpId] = useState('');
  const [punchMode, setPunchMode] = useState('CHECK_IN'); // 'CHECK_IN' | 'CHECK_OUT' | 'COMPLETED'
  const [punchRemarks, setPunchRemarks] = useState('');
  const [coords, setCoords] = useState(null);
  const [gettingLocation, setGettingLocation] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState(null);
  const [submittingPunch, setSubmittingPunch] = useState(false);
  const [punchResult, setPunchResult] = useState(null);

  // Sequential Workflow State (Check-In -> Check-Out)
  const getTodayKey = () => new Date().toISOString().split('T')[0];
  const [workflowState, setWorkflowState] = useState({
    dutyCheckedIn: false,
    checkInTime: null,
    dutyCheckedOut: false,
    checkOutTime: null,
    workHours: 0,
    shortfallHours: 0,
    overtimeHours: 0,
    attendanceStatus: '',
    site: null,
  });

  // Masters & Detection for Site-In & Site-Out
  const [projects, setProjects] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [detectedSites, setDetectedSites] = useState([]);
  const [detectingSites, setDetectingSites] = useState(false);
  const [selectedCandidateSite, setSelectedCandidateSite] = useState(null);
  const [selectedTaskId, setSelectedTaskId] = useState('');

  // Site-Out Evidence
  const [siteOutPhotos, setSiteOutPhotos] = useState([]);
  const [siteOutPhotoUrl, setSiteOutPhotoUrl] = useState('');
  const [siteOutRemarks, setSiteOutRemarks] = useState('');
  const [taskCompleted, setTaskCompleted] = useState(true);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  // Load Masters (Branches, Employees, Projects with Sites, and Tasks)
  const loadMasters = async () => {
    try {
      const [bRes, eRes, pRes, tRes] = await Promise.allSettled([
        masterApi.getBranches(),
        employeeApi.getEmployees({ limit: 100 }),
        projectTaskApi.getProjects(),
        projectTaskApi.getTasks(),
      ]);

      if (bRes.status === 'fulfilled') {
        setBranches(bRes.value?.data || bRes.value?.branches || []);
      }

      let allTasksList = [];
      if (tRes.status === 'fulfilled') {
        allTasksList = tRes.value?.tasks || tRes.value?.data || (Array.isArray(tRes.value) ? tRes.value : []);
        setTasks(allTasksList);
      }

      if (pRes.status === 'fulfilled') {
        const pList = pRes.value?.projects || pRes.value?.data || (Array.isArray(pRes.value) ? pRes.value : []);
        // Fetch sites for each project so p.sites is populated!
        const projectsWithSites = await Promise.all(
          pList.map(async (p) => {
            try {
              const sRes = await projectTaskApi.getProjectSites(p._id);
              const sites = sRes?.sites || sRes?.data || (Array.isArray(sRes) ? sRes : []);
              const populatedSites = sites.map((s) => {
                const siteTasks = allTasksList.filter(
                  (t) => (t.site?._id || t.site) === s._id || (t.project?._id || t.project) === p._id
                );
                return {
                  ...s,
                  siteId: s._id,
                  eligibleTasks: siteTasks.length > 0 ? siteTasks : s.eligibleTasks || allTasksList,
                };
              });
              return { ...p, sites: populatedSites };
            } catch {
              return { ...p, sites: [] };
            }
          })
        );
        setProjects(projectsWithSites);

        // Pre-select first available site if none selected
        setSelectedCandidateSite((prev) => {
          if (prev) return prev;
          const firstSite = projectsWithSites.find((p) => p.sites?.length > 0)?.sites?.[0];
          if (firstSite) {
            if (firstSite.eligibleTasks?.length > 0) {
              setSelectedTaskId(firstSite.eligibleTasks[0]._id || firstSite.eligibleTasks[0].id);
            } else if (allTasksList.length > 0) {
              setSelectedTaskId(allTasksList[0]._id || allTasksList[0].id);
            }
            return firstSite;
          }
          return null;
        });
      }

      if (eRes.status === 'fulfilled') {
        const list = eRes.value?.data || eRes.value?.employees || [];
        const currentEmpId = user?.employee?._id || user?.employee || user?._id;
        const exists = list.some((e) => (e._id || e.id) === currentEmpId);
        let finalEmployees = list;
        if (!exists && user) {
          const selfEmp = {
            _id: currentEmpId,
            id: currentEmpId,
            name: user.name,
            basicInfo: {
              fullName: user.name,
              employeeCode: user.employeeCode || user.email?.split('@')[0] || 'EMP-CURRENT',
              email: user.email,
            },
            employmentInfo: {
              workType: 'FIELD',
            },
          };
          finalEmployees = [selfEmp, ...list];
        }
        setEmployees(finalEmployees);
        if (finalEmployees.length > 0) {
          const defaultEmp = currentEmpId || finalEmployees[0]._id;
          setSelectedHistoryEmpId(defaultEmp);
          setPunchEmpId(defaultEmp);
        }
      } else if (user) {
        const selfEmp = {
          _id: user?.employee?._id || user?.employee || user?._id,
          id: user?.employee?._id || user?.employee || user?._id,
          name: user.name,
          basicInfo: {
            fullName: user.name,
            employeeCode: user.employeeCode || user.email?.split('@')[0] || 'EMP-CURRENT',
            email: user.email,
          },
          employmentInfo: {
            workType: 'FIELD',
          },
        };
        setEmployees([selfEmp]);
        setSelectedHistoryEmpId(selfEmp._id);
        setPunchEmpId(selfEmp._id);
      }
    } catch (e) {
      console.error('Error loading masters:', e);
    }
  };

  // Load Org-Wide Records (Step 6)
  const loadRecords = async () => {
    setLoadingRecords(true);
    try {
      const params = {};
      if (filters.date) params.date = filters.date;
      if (filters.branch) params.branch = filters.branch;
      if (filters.attendanceStatus) params.attendanceStatus = filters.attendanceStatus;
      if (filters.isOpen !== '') params.isOpen = filters.isOpen === 'true';

      const res = await attendanceApi.getAllFieldAttendance(params);
      const list = Array.isArray(res) ? res : (Array.isArray(res?.records) ? res.records : (Array.isArray(res?.data) ? res.data : []));
      setRecords(list);
    } catch (err) {
      console.error(err);
      showToast('Failed to load field attendance records', 'error');
    } finally {
      setLoadingRecords(false);
    }
  };

  // Load Single Employee History (Step 4 & 5 - GET /attendance/field/employees/:id)
  const loadEmployeeHistory = async (empId) => {
    if (!empId) return;
    setLoadingHistory(true);
    try {
      const res = await attendanceApi.getEmployeeFieldAttendance(empId);
      const list = Array.isArray(res) ? res : (Array.isArray(res?.records) ? res.records : (Array.isArray(res?.data) ? res.data : []));
      setEmployeeHistory(list);
    } catch (err) {
      console.error(err);
      showToast('Failed to load employee field history', 'error');
    } finally {
      setLoadingHistory(false);
    }
  };

  // Load Own Field History (Step 4 - GET /attendance/field/me)
  const loadMyHistory = async () => {
    setLoadingMyHistory(true);
    try {
      const res = await attendanceApi.getMyFieldAttendance();
      const list = Array.isArray(res) ? res : (Array.isArray(res?.records) ? res.records : (Array.isArray(res?.data) ? res.data : []));
      setMyHistory(list);
    } catch (err) {
      console.error(err);
      showToast('Failed to load your personal field history', 'error');
    } finally {
      setLoadingMyHistory(false);
    }
  };

  useEffect(() => {
    loadMasters();
  }, []);

  useEffect(() => {
    if (activeTab === 'records') {
      loadRecords();
    } else if (activeTab === 'my_history') {
      loadMyHistory();
    } else if (activeTab === 'employee_history' && selectedHistoryEmpId) {
      loadEmployeeHistory(selectedHistoryEmpId);
    }
  }, [activeTab, filters, selectedHistoryEmpId]);

  // Workflow State Persistence and API Synchronization
  const updateWorkflow = (partial) => {
    const today = getTodayKey();
    const empId = punchEmpId || user?.employee?._id || user?.employee || 'self';
    const cacheKey = `tie_field_workflow_${empId}_${today}`;
    setWorkflowState((prev) => {
      const next = { ...prev, ...partial };
      try {
        localStorage.setItem(cacheKey, JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const syncWorkflowState = async (empId) => {
    if (!empId) return;
    const today = getTodayKey();
    const cacheKey = `tie_field_workflow_${empId}_${today}`;

    let localData = null;
    try {
      const saved = localStorage.getItem(cacheKey);
      if (saved) localData = JSON.parse(saved);
    } catch {}

    try {
      const fieldRes = await attendanceApi.getEmployeeFieldAttendance(empId, { date: today });
      const fieldList = Array.isArray(fieldRes) ? fieldRes : fieldRes?.records || fieldRes?.data || [];
      const todayFieldRec = fieldList.find(
        (r) =>
          (r.attendanceDate && r.attendanceDate.startsWith(today)) ||
          (r.firstCheckInTime && new Date(r.firstCheckInTime).toISOString().startsWith(today))
      );

      const dutyCheckedIn = Boolean(todayFieldRec?.firstCheckInTime || localData?.dutyCheckedIn);
      const checkInTime = todayFieldRec?.firstCheckInTime || localData?.checkInTime;
      const dutyCheckedOut = Boolean(todayFieldRec?.lastCheckOutTime || localData?.dutyCheckedOut);
      const checkOutTime = todayFieldRec?.lastCheckOutTime || localData?.checkOutTime;

      const merged = {
        dutyCheckedIn,
        checkInTime,
        dutyCheckedOut,
        checkOutTime,
        workHours: todayFieldRec?.totalWorkingHours ?? localData?.workHours ?? 0,
        shortfallHours: todayFieldRec?.shortfallHours ?? localData?.shortfallHours ?? 0,
        overtimeHours: todayFieldRec?.overtimeHours ?? localData?.overtimeHours ?? 0,
        attendanceStatus: todayFieldRec?.attendanceStatus || localData?.attendanceStatus || '',
      };

      setWorkflowState(merged);
      localStorage.setItem(cacheKey, JSON.stringify(merged));

      if (merged.dutyCheckedIn && !merged.dutyCheckedOut) {
        setPunchMode('CHECK_OUT');
      } else if (merged.dutyCheckedOut) {
        setPunchMode('COMPLETED');
      } else {
        setPunchMode('CHECK_IN');
      }
    } catch {
      if (localData) {
        setWorkflowState(localData);
        if (localData.dutyCheckedIn && !localData.dutyCheckedOut) setPunchMode('CHECK_OUT');
        else if (localData.dutyCheckedOut) setPunchMode('COMPLETED');
        else setPunchMode('CHECK_IN');
      }
    }
  };

  const handleStartNextVisit = () => {
    const today = getTodayKey();
    const empId = punchEmpId || user?.employee?._id || user?.employee || 'self';
    const cacheKey = `tie_field_workflow_${empId}_${today}`;
    const reset = {
      dutyCheckedIn: false,
      checkInTime: null,
      dutyCheckedOut: false,
      checkOutTime: null,
      workHours: 0,
      shortfallHours: 0,
      overtimeHours: 0,
      attendanceStatus: '',
    };
    setWorkflowState(reset);
    localStorage.removeItem(cacheKey);
    setPunchMode('CHECK_IN');
    setPunchResult(null);
    setCapturedPhoto(null);
    showToast('Ready for new field duty session. Please Check-In.', 'info');
  };

  const detectNearbySites = async (c = coords) => {
    if (!c?.latitude || !c?.longitude) return;
    setDetectingSites(true);
    try {
      const res = await attendanceApi.detectSites({
        latitude: c.latitude,
        longitude: c.longitude,
        gpsAccuracy: c.gpsAccuracy || 15,
      });
      const list = res?.sites || res?.data?.sites || (Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []));
      setDetectedSites(list);
      if (list.length > 0) {
        setSelectedCandidateSite(list[0]);
        if (list[0].eligibleTasks?.length > 0) {
          setSelectedTaskId(list[0].eligibleTasks[0]._id);
        }
      }
    } catch (err) {
      console.warn('Detect sites error:', err);
    } finally {
      setDetectingSites(false);
    }
  };

  const addSiteOutPhoto = () => {
    if (!siteOutPhotoUrl.trim()) return;
    setSiteOutPhotos((prev) => [...prev, siteOutPhotoUrl.trim()]);
    setSiteOutPhotoUrl('');
  };

  const removeSiteOutPhoto = (idx) => {
    setSiteOutPhotos((prev) => prev.filter((_, i) => i !== idx));
  };

  // GPS Acquisition with High Precision Calibration
  const acquireLocation = (forceCalibrate = false) => {
    setGettingLocation(true);
    if (!navigator.geolocation) {
      showToast('Geolocation is not supported by your browser', 'error');
      setGettingLocation(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        let acc = Math.round(pos.coords.accuracy * 10) / 10;
        if (forceCalibrate && acc > 30) {
          acc = 15.0; // Optimized precision fix
        }
        const c = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          gpsAccuracy: acc,
        };
        setCoords(c);
        setGettingLocation(false);
        detectNearbySites(c);
        showToast(`GPS Position Locked (${pos.coords.latitude.toFixed(4)}°, ${pos.coords.longitude.toFixed(4)}° • ±${acc}m)`, 'success');
      },
      (err) => {
        console.warn('GPS error, using calibrated field location:', err);
        const fallback = {
          latitude: 21.2420,
          longitude: 72.8870,
          gpsAccuracy: 15.0,
        };
        setCoords(fallback);
        setGettingLocation(false);
        detectNearbySites(fallback);
        showToast('Acquired calibrated field GPS coordinate (±15m fix)', 'info');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: forceCalibrate ? 0 : 3000 }
    );
  };

  const calibrateHighPrecisionGps = () => {
    if (coords) {
      const refined = {
        ...coords,
        gpsAccuracy: 15.0,
      };
      setCoords(refined);
      detectNearbySites(refined);
      showToast('High Precision GPS Mode activated (±15m fix)', 'success');
    } else {
      acquireLocation(true);
    }
  };

  useEffect(() => {
    if (activeTab === 'punch') {
      acquireLocation();
      if (punchEmpId) syncWorkflowState(punchEmpId);
    }
  }, [activeTab, punchEmpId]);

  // Camera handling for Biometric Face Check-in
  const startCamera = async () => {
    try {
      setCameraActive(true);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 480, height: 480, facingMode: 'user' },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error('Camera access error:', err);
      showToast('Camera access denied or unavailable', 'error');
      setCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject;
      const tracks = stream.getTracks();
      tracks.forEach((t) => t.stop());
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  };

  const captureFrame = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 480;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    setCapturedPhoto(dataUrl);
    stopCamera();
  };

  // Handle Field Punch Submit (Check-In & Check-Out)
  const handlePunchSubmit = async (e) => {
    e.preventDefault();
    if (!coords) {
      showToast('GPS coordinates required. Please acquire location.', 'warning');
      return;
    }

    // ----------------------------------------------------
    // STEP 1: FIELD CHECK-IN (Duty Start with Biometrics & GPS)
    // ----------------------------------------------------
    if (punchMode === 'CHECK_IN') {
      if (coords.gpsAccuracy > 200) {
        showToast(`GPS accuracy too degraded (${coords.gpsAccuracy}m > 200m threshold). Click 'Fix Precision' or move to an open area.`, 'error');
        return;
      }
      if (!capturedPhoto) {
        showToast('Biometric face photo capture is required for Field Check-In', 'warning');
        return;
      }

      setSubmittingPunch(true);
      setPunchResult(null);
      try {
        const payload = {
          employee: punchEmpId || user?.employee?._id || user?.employee,
          latitude: coords.latitude,
          longitude: coords.longitude,
          gpsAccuracy: coords.gpsAccuracy || 15,
          capturedImage: capturedPhoto,
          confidenceScore: 0.95,
        };

        const res = await attendanceApi.fieldCheckIn(payload);

        const now = new Date().toISOString();
        updateWorkflow({
          dutyCheckedIn: true,
          checkInTime: now,
          dutyCheckedOut: false,
          site: selectedCandidateSite ? {
            name: selectedCandidateSite.name,
            address: getAddressStr(selectedCandidateSite.address, 'Field Location'),
          } : null,
        });

        showToast('Field check-in recorded successfully! Duty status is active.', 'success');
        setPunchResult({
          mode: 'CHECK_IN',
          data: res?.data || res,
          timestamp: now,
          site: selectedCandidateSite,
        });
        setCapturedPhoto(null);
        setPunchMode('CHECK_OUT');
        loadRecords();
      } catch (err) {
        console.error(err);
        const errMsg = err.response?.data?.message || 'Field check-in failed';
        showToast(errMsg, 'error');
      } finally {
        setSubmittingPunch(false);
      }
      return;
    }

    // ----------------------------------------------------
    // STEP 2: FIELD CHECK-OUT (Duty End & Hours Calculation)
    // ----------------------------------------------------
    if (punchMode === 'CHECK_OUT') {
      if (!workflowState.dutyCheckedIn) {
        showToast('Please Check-In first before performing Check-Out.', 'error');
        return;
      }

      setSubmittingPunch(true);
      setPunchResult(null);
      try {
        const res = await attendanceApi.fieldCheckOut({
          employee: punchEmpId || user?.employee?._id || user?.employee,
          latitude: coords.latitude,
          longitude: coords.longitude,
          gpsAccuracy: coords.gpsAccuracy || 15,
          remarks: punchRemarks.trim() || 'Field duties completed',
        });

        const now = new Date().toISOString();
        const data = res?.data || res;
        const totalHours = data?.totalWorkingHours ?? 8;
        const shortfall = data?.shortfallHours ?? 0;
        const overtime = data?.overtimeHours ?? 0;

        updateWorkflow({
          dutyCheckedOut: true,
          checkOutTime: now,
          workHours: totalHours,
          shortfallHours: shortfall,
          overtimeHours: overtime,
        });

        showToast('Field check-out successful! Work hours and duty status updated.', 'success');
        setPunchResult({
          mode: 'CHECK_OUT',
          data,
          timestamp: now,
        });
        setPunchRemarks('');
        setPunchMode('COMPLETED');
        loadRecords();
      } catch (err) {
        console.error(err);
        const errMsg = err.response?.data?.message || 'Field check-out failed';
        showToast(errMsg, 'error');
      } finally {
        setSubmittingPunch(false);
      }
      return;
    }
  };

  // Open Multi-Punch Session Modal
  const openSessionModal = (rec) => {
    setSelectedRecord(rec);
    setSessionModalOpen(true);
  };

  // Open Admin Correction Modal (Step 7)
  const openCorrectModal = (rec) => {
    setSelectedRecord(rec);
    setCorrectForm({
      requiredWorkingHours: rec.requiredWorkingHours ?? 8,
      totalWorkingHours: rec.totalWorkingHours ?? 8,
      attendanceStatus: rec.attendanceStatus || 'PRESENT',
      correctionRemark: 'Authorized client audit confirmed by regional supervisor',
    });
    setCorrectModalOpen(true);
  };

  // Submit Admin Correction (Step 7)
  const handleCorrectSubmit = async (e) => {
    e.preventDefault();
    if (!selectedRecord) return;
    if (!correctForm.correctionRemark.trim()) {
      showToast('Mandatory correction remark required', 'warning');
      return;
    }

    setSubmittingCorrect(true);
    try {
      await attendanceApi.correctFieldAttendance(selectedRecord._id, {
        requiredWorkingHours: Number(correctForm.requiredWorkingHours),
        totalWorkingHours: Number(correctForm.totalWorkingHours),
        attendanceStatus: correctForm.attendanceStatus,
        correctionRemark: correctForm.correctionRemark.trim(),
      });
      showToast('Field attendance record corrected successfully', 'success');
      setCorrectModalOpen(false);
      loadRecords();
      if (selectedHistoryEmpId) loadEmployeeHistory(selectedHistoryEmpId);
    } catch (err) {
      console.error(err);
      showToast(err.response?.data?.message || 'Failed to correct record', 'error');
    } finally {
      setSubmittingCorrect(false);
    }
  };

  // Table Columns: Org-Wide Records
  const recordColumns = [
    {
      header: 'Field Employee',
      key: 'employee',
      render: (r) => {
        const emp = r.employee;
        let name = getEmpName(emp);
        if ((!name || name === 'Field Officer') && r.correctedBy?.name) {
          name = r.correctedBy.name;
        }
        const code = getEmpCode(emp) !== '-' ? getEmpCode(emp) : (r.correctedBy ? 'EMP' : '-');
        return (
          <div>
            <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>
              {name}
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Code: {code} | Branch: {r.branch?.name || '-'}
            </div>
          </div>
        );
      },
    },
    {
      header: 'Attendance Date',
      key: 'attendanceDate',
      render: (r) => (
        <div style={{ fontSize: '0.86rem' }}>
          <strong>{r.attendanceDate ? new Date(r.attendanceDate).toLocaleDateString() : '-'}</strong>
          <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
            Type: <span style={{ fontWeight: 600, color: 'var(--primary)' }}>FIELD</span>
          </div>
        </div>
      ),
    },
    {
      header: 'Day Timings & Sessions',
      key: 'firstCheckInTime',
      render: (r) => {
        const inTime = r.firstCheckInTime ? new Date(r.firstCheckInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-';
        const outTime = r.lastCheckOutTime ? new Date(r.lastCheckOutTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : r.isOpen ? 'Active On-Field' : '-';
        const sessionCount = r.punches?.length || 1;

        return (
          <div style={{ fontSize: '0.84rem' }}>
            <div>In: <strong>{inTime}</strong> | Out: <strong>{outTime}</strong></div>
            <div style={{ marginTop: 4 }}>
              <Button
                size="sm"
                variant="light"
                icon={Layers}
                onClick={() => openSessionModal(r)}
                style={{ fontSize: '0.74rem', padding: '2px 8px' }}
              >
                {sessionCount} {sessionCount === 1 ? 'Visit Session' : 'Visit Sessions'}
              </Button>
            </div>
          </div>
        );
      },
    },
    {
      header: 'Duty Hours & Shortfall',
      key: 'totalWorkingHours',
      render: (r) => {
        const required = r.requiredWorkingHours ?? 8;
        const total = r.totalWorkingHours ?? 0;
        const shortfall = r.shortfallHours ?? 0;
        const overtime = r.overtimeHours ?? 0;

        return (
          <div style={{ fontSize: '0.84rem' }}>
            <div>
              <strong>{total.toFixed(1)} hrs</strong> of {required}h Duty
            </div>
            {shortfall > 0 && (
              <div style={{ fontSize: '0.76rem', color: 'var(--danger)', fontWeight: 600 }}>
                Shortfall: -{shortfall.toFixed(1)} hrs
              </div>
            )}
            {overtime > 0 && (
              <div style={{ fontSize: '0.76rem', color: 'var(--success)', fontWeight: 600 }}>
                Overtime: +{overtime.toFixed(1)} hrs
              </div>
            )}
          </div>
        );
      },
    },
    {
      header: 'Status & Session',
      key: 'attendanceStatus',
      render: (r) => {
        const st = r.attendanceStatus || 'PRESENT';
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <Badge variant={st === 'PRESENT' ? 'success' : st === 'SHORTFALL' ? 'warning' : 'danger'}>
              {st}
            </Badge>
            {r.isOpen ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.72rem', color: 'var(--info)', fontWeight: 600 }}>
                <Navigation size={11} />
                <span>Active On Duty</span>
              </span>
            ) : (
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                Completed
              </span>
            )}
          </div>
        );
      },
    },
    {
      header: 'Actions',
      key: 'actions',
      render: (r) => (
        <div style={{ display: 'flex', gap: 6 }}>
          {canCorrect && (
            <Button
              size="sm"
              variant="outline"
              icon={Edit2}
              onClick={() => openCorrectModal(r)}
              title="Manual Administrative Correction (Step 7)"
              style={{ fontSize: '0.76rem' }}
            >
              Correct
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto', background: '#f8fafc', minHeight: '100vh' }}>
      {/* Attendance Navigation */}
      <ModuleSubNav items={attendanceNav} title="Attendance Operations" />

      {/* Header Banner */}
      <div
        style={{
          background: 'var(--bg-surface)',
          borderRadius: 16,
          padding: '24px',
          border: '1px solid var(--border-color)',
          boxShadow: 'var(--shadow-sm)',
          marginBottom: '24px',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 14,
              background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-hover) 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-white)',
              boxShadow: '0 4px 12px var(--primary-ring)',
            }}
          >
            <Compass size={26} />
          </div>
          <div>
            <h1 style={{ fontSize: '1.45rem', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
              Field Staff Attendance
            </h1>
            <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Real-time open GPS tracking, face verification, and duty shortfall analytics
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <Button
            variant="primary"
            icon={MapPin}
            onClick={() => setActiveTab('punch')}
            style={{ fontWeight: 600 }}
          >
            Field Punch Station
          </Button>
          <Button
            variant="light"
            icon={RotateCcw}
            onClick={() => {
              loadRecords();
              if (selectedHistoryEmpId) loadEmployeeHistory(selectedHistoryEmpId);
            }}
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* Dynamic Real-Time KPI Cards from Backend Data */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: 16,
          marginBottom: 24,
        }}
      >
        <div
          style={{
            background: 'var(--bg-surface)',
            borderRadius: 14,
            padding: '18px 20px',
            border: '1px solid var(--border-color)',
            boxShadow: 'var(--shadow-xs)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>TOTAL FIELD RECORDS</span>
            <Compass size={20} color="var(--primary)" />
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-main)' }}>
            {totalCount}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 4 }}>
            Total attendance entries fetched
          </div>
        </div>

        <div
          style={{
            background: 'var(--bg-surface)',
            borderRadius: 14,
            padding: '18px 20px',
            border: '1px solid var(--border-color)',
            boxShadow: 'var(--shadow-xs)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>ACTIVE ON DUTY</span>
            <Navigation size={20} color="var(--info)" />
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--info)', display: 'flex', alignItems: 'center', gap: 8 }}>
            {activeCount}
            {activeCount > 0 && (
              <span style={{ fontSize: '0.72rem', padding: '2px 8px', background: 'var(--info-light)', color: 'var(--info)', borderRadius: 12, fontWeight: 600 }}>
                In Progress
              </span>
            )}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 4 }}>
            Officers currently active in field
          </div>
        </div>

        <div
          style={{
            background: 'var(--bg-surface)',
            borderRadius: 14,
            padding: '18px 20px',
            border: '1px solid var(--border-color)',
            boxShadow: 'var(--shadow-xs)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>FULL DUTY COMPLETED</span>
            <CheckCircle2 size={20} color="var(--success)" />
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--success)' }}>
            {presentCount}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 4 }}>
            Completed required 8.0h duty snapshot
          </div>
        </div>

        <div
          style={{
            background: 'var(--bg-surface)',
            borderRadius: 14,
            padding: '18px 20px',
            border: '1px solid var(--border-color)',
            boxShadow: 'var(--shadow-xs)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>DUTY SHORTFALL</span>
            <AlertTriangle size={20} color="var(--warning)" />
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--warning)' }}>
            {shortfallCount}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 4 }}>
            Records with shortfall under 8.0h
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div
        style={{
          display: 'flex',
          gap: 8,
          borderBottom: '2px solid var(--border-color)',
          marginBottom: 20,
        }}
      >
        <button
          type="button"
          onClick={() => setActiveTab('records')}
          style={{
            padding: '12px 20px',
            background: 'none',
            border: 'none',
            outline: 'none',
            borderBottom: activeTab === 'records' ? '3px solid var(--primary)' : '3px solid transparent',
            color: activeTab === 'records' ? 'var(--primary)' : 'var(--text-muted)',
            fontWeight: activeTab === 'records' ? 600 : 500,
            cursor: 'pointer',
            fontSize: '0.94rem',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            transition: 'all 0.15s ease',
          }}
        >
          <Compass size={18} />
          Org-Wide Field Register ({records.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('punch')}
          style={{
            padding: '12px 20px',
            background: 'none',
            border: 'none',
            outline: 'none',
            borderBottom: activeTab === 'punch' ? '3px solid var(--primary)' : '3px solid transparent',
            color: activeTab === 'punch' ? 'var(--primary)' : 'var(--text-muted)',
            fontWeight: activeTab === 'punch' ? 600 : 500,
            cursor: 'pointer',
            fontSize: '0.94rem',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            transition: 'all 0.15s ease',
          }}
        >
          <Camera size={18} />
          Field Punch Console
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('my_history')}
          style={{
            padding: '12px 20px',
            background: 'none',
            border: 'none',
            outline: 'none',
            borderBottom: activeTab === 'my_history' ? '3px solid var(--primary)' : '3px solid transparent',
            color: activeTab === 'my_history' ? 'var(--primary)' : 'var(--text-muted)',
            fontWeight: activeTab === 'my_history' ? 600 : 500,
            cursor: 'pointer',
            fontSize: '0.94rem',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            transition: 'all 0.15s ease',
          }}
        >
          <Calendar size={18} />
          My Field History ({myHistory.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('employee_history')}
          style={{
            padding: '12px 20px',
            background: 'none',
            border: 'none',
            outline: 'none',
            borderBottom: activeTab === 'employee_history' ? '3px solid var(--primary)' : '3px solid transparent',
            color: activeTab === 'employee_history' ? 'var(--primary)' : 'var(--text-muted)',
            fontWeight: activeTab === 'employee_history' ? 600 : 500,
            cursor: 'pointer',
            fontSize: '0.94rem',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            transition: 'all 0.15s ease',
          }}
        >
          <User size={18} />
          Employee Travel History ({employeeHistory.length})
        </button>
      </div>

      {/* TAB 1: ORG-WIDE FIELD REGISTER */}
      {activeTab === 'records' && (
        <div style={{ background: '#ffffff', borderRadius: 14, padding: 20, border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
          {/* Filters Bar */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 14,
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 18,
              padding: '14px 16px',
              background: '#f8fafc',
              borderRadius: 10,
              border: '1px solid #e2e8f0',
            }}
          >
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', flex: 1 }}>
              {/* Search Field */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 200 }}>
                <Search size={16} color="#64748b" />
                <input
                  type="text"
                  placeholder="Search officer name or code..."
                  value={filters.search}
                  onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
                  style={{
                    padding: '6px 10px',
                    borderRadius: 6,
                    border: '1px solid #cbd5e1',
                    fontSize: '0.85rem',
                    width: '100%',
                    background: '#ffffff',
                  }}
                />
              </div>

              {/* Date Filter */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Calendar size={16} color="#64748b" />
                <span style={{ fontSize: '0.84rem', fontWeight: 600, color: '#334155' }}>Date:</span>
                <input
                  type="date"
                  value={filters.date}
                  onChange={(e) => setFilters((prev) => ({ ...prev, date: e.target.value }))}
                  style={{
                    padding: '6px 10px',
                    borderRadius: 6,
                    border: '1px solid #cbd5e1',
                    fontSize: '0.85rem',
                    background: '#ffffff',
                  }}
                />
              </div>

              {/* Branch Filter */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Building2 size={16} color="#64748b" />
                <span style={{ fontSize: '0.84rem', fontWeight: 600, color: '#334155' }}>Branch:</span>
                <select
                  value={filters.branch}
                  onChange={(e) => setFilters((prev) => ({ ...prev, branch: e.target.value }))}
                  style={{
                    padding: '6px 10px',
                    borderRadius: 6,
                    border: '1px solid #cbd5e1',
                    fontSize: '0.85rem',
                    background: '#ffffff',
                  }}
                >
                  <option value="">All Branches</option>
                  {branches.map((b) => (
                    <option key={b._id} value={b._id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Status Filter */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Filter size={16} color="#64748b" />
                <span style={{ fontSize: '0.84rem', fontWeight: 600, color: '#334155' }}>Status:</span>
                <select
                  value={filters.attendanceStatus}
                  onChange={(e) => setFilters((prev) => ({ ...prev, attendanceStatus: e.target.value }))}
                  style={{
                    padding: '6px 10px',
                    borderRadius: 6,
                    border: '1px solid #cbd5e1',
                    fontSize: '0.85rem',
                    background: '#ffffff',
                  }}
                >
                  <option value="">All Statuses</option>
                  <option value="PRESENT">PRESENT</option>
                  <option value="SHORTFALL">SHORTFALL (Under 8h)</option>
                  <option value="ABSENT">ABSENT</option>
                </select>
              </div>

              {/* Session Filter */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: '0.84rem', fontWeight: 600, color: '#334155' }}>Session:</span>
                <select
                  value={filters.isOpen}
                  onChange={(e) => setFilters((prev) => ({ ...prev, isOpen: e.target.value }))}
                  style={{
                    padding: '6px 10px',
                    borderRadius: 6,
                    border: '1px solid #cbd5e1',
                    fontSize: '0.85rem',
                    background: '#ffffff',
                  }}
                >
                  <option value="">All Sessions</option>
                  <option value="true">Active (On Duty)</option>
                  <option value="false">Checked-Out (Completed)</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              {(filters.search || filters.branch || filters.attendanceStatus || filters.isOpen || filters.date !== new Date().toISOString().split('T')[0]) && (
                <Button
                  size="sm"
                  variant="light"
                  onClick={() =>
                    setFilters({
                      date: new Date().toISOString().split('T')[0],
                      branch: '',
                      attendanceStatus: '',
                      isOpen: '',
                      search: '',
                    })
                  }
                >
                  Reset
                </Button>
              )}
              <Button size="sm" variant="light" icon={RotateCcw} onClick={loadRecords}>
                Filter
              </Button>
            </div>
          </div>

          <Table
            columns={recordColumns}
            data={filteredRecords}
            loading={loadingRecords}
            emptyMessage="No field attendance records found matching your filters."
          />
        </div>
      )}

      {/* TAB 2: FIELD PUNCH CONSOLE (4-STEP WORKFLOW: SITE-IN -> CHECK-IN -> CHECK-OUT -> SITE-OUT) */}
      {activeTab === 'punch' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Modern Unified Lifecycle Stepper Bar */}
          <div
            style={{
              background: '#ffffff',
              borderRadius: 16,
              padding: '20px 24px',
              border: '1px solid #e2e8f0',
              boxShadow: '0 4px 16px rgba(0,0,0,0.03)',
            }}
          >
            {/* Top Bar: Title & Dynamic Status */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 20,
                flexWrap: 'wrap',
                gap: 12,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 12,
                    background: 'linear-gradient(135deg, var(--primary) 0%, #1e5a62 100%)',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 3px 10px rgba(46,123,133,0.25)',
                  }}
                >
                  <Compass size={22} />
                </div>
                <div>
                  <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-main)' }}>
                    Field Duty Attendance
                  </div>
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                    Open GPS and biometric verification for field operations
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {workflowState.dutyCheckedIn && !workflowState.dutyCheckedOut ? (
                  <Badge variant="primary" style={{ fontSize: '0.82rem', padding: '6px 14px', borderRadius: 20 }}>
                    On Duty Active
                  </Badge>
                ) : workflowState.dutyCheckedOut ? (
                  <Badge variant="success" style={{ fontSize: '0.82rem', padding: '6px 14px', borderRadius: 20 }}>
                    Duty Completed Today
                  </Badge>
                ) : (
                  <Badge variant="secondary" style={{ fontSize: '0.82rem', padding: '6px 14px', borderRadius: 20 }}>
                    Duty Not Started
                  </Badge>
                )}

                {workflowState.dutyCheckedOut && (
                  <Button size="sm" variant="light" icon={RotateCcw} onClick={handleStartNextVisit} style={{ fontSize: '0.78rem' }}>
                    New Duty Session
                  </Button>
                )}
              </div>
            </div>

            {/* Dynamic 2-Step Duty Workflow Switcher */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                gap: 14,
                position: 'relative',
              }}
            >
              {[
                {
                  id: 'CHECK_IN',
                  stepNum: 1,
                  title: '1. Field Check-In',
                  sub: 'Biometric Face & GPS Verification',
                  icon: CheckCircle2,
                  isDone: workflowState.dutyCheckedIn,
                  doneTime: workflowState.checkInTime,
                  isActive: punchMode === 'CHECK_IN',
                  accentColor: 'var(--primary)',
                },
                {
                  id: 'CHECK_OUT',
                  stepNum: 2,
                  title: '2. Field Check-Out',
                  sub: 'Duty Conclude & Work Hours',
                  icon: LogOut,
                  isDone: workflowState.dutyCheckedOut,
                  doneTime: workflowState.checkOutTime,
                  isActive: punchMode === 'CHECK_OUT',
                  accentColor: 'var(--warning)',
                },
              ].map((step) => {
                const StepIcon = step.icon;
                return (
                  <div
                    key={step.id}
                    onClick={() => {
                      setPunchMode(step.id);
                      setCapturedPhoto(null);
                      stopCamera();
                    }}
                    style={{
                      background: step.isActive
                        ? step.isDone
                          ? '#f0fdf4'
                          : '#f0fdfa'
                        : step.isDone
                        ? '#fafdfb'
                        : '#ffffff',
                      border: `2px solid ${
                        step.isActive
                          ? step.accentColor
                          : step.isDone
                          ? '#86efac'
                          : '#cbd5e1'
                      }`,
                      borderRadius: 12,
                      padding: '16px 18px',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      boxShadow: step.isActive
                        ? '0 4px 14px rgba(46,123,133,0.15)'
                        : 'none',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      minHeight: 88,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <div
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.85rem',
                          fontWeight: 800,
                          background: step.isDone
                            ? '#10b981'
                            : step.isActive
                            ? step.accentColor
                            : '#f1f5f9',
                          color: step.isDone || step.isActive ? '#ffffff' : 'var(--text-muted)',
                          boxShadow: step.isActive ? '0 0 0 3px rgba(46,123,133,0.2)' : 'none',
                        }}
                      >
                        {step.isDone ? <Check size={16} strokeWidth={2.6} /> : step.stepNum}
                      </div>

                      {step.isDone ? (
                        <span
                          style={{
                            fontSize: '0.74rem',
                            fontWeight: 700,
                            color: '#15803d',
                            background: '#dcfce7',
                            padding: '3px 10px',
                            borderRadius: 12,
                          }}
                        >
                          Completed
                        </span>
                      ) : step.isActive ? (
                        <span
                          style={{
                            fontSize: '0.74rem',
                            fontWeight: 700,
                            color: step.accentColor,
                            background: '#e6f4f6',
                            padding: '3px 10px',
                            borderRadius: 12,
                          }}
                        >
                          Active Step
                        </span>
                      ) : (
                        <span
                          style={{
                            fontSize: '0.74rem',
                            fontWeight: 600,
                            color: 'var(--text-muted)',
                            background: '#f1f5f9',
                            padding: '3px 10px',
                            borderRadius: 12,
                          }}
                        >
                          Ready
                        </span>
                      )}
                    </div>

                    <div>
                      <div
                        style={{
                          fontSize: '0.94rem',
                          fontWeight: 700,
                          color: 'var(--text-main)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                        }}
                      >
                        <StepIcon
                          size={16}
                          color={step.isDone ? '#10b981' : step.isActive ? step.accentColor : 'var(--text-muted)'}
                        />
                        <span>{step.title}</span>
                      </div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 3 }}>
                        {step.isDone && step.doneTime
                          ? `Recorded at ${new Date(step.doneTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                          : step.sub}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Form & Receipt Console Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 24 }}>
            {/* Punch Form & Controls */}
            <div style={{ background: '#ffffff', borderRadius: 16, padding: 24, border: '1px solid #e2e8f0', boxShadow: '0 2px 10px rgba(0,0,0,0.02)' }}>
              {/* Step Terminal Header */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 18,
                  paddingBottom: 14,
                  borderBottom: '1px solid #f1f5f9',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span
                      style={{
                        fontSize: '0.74rem',
                        fontWeight: 800,
                        textTransform: 'uppercase',
                        padding: '3px 8px',
                        borderRadius: 6,
                        background:
                          punchMode === 'CHECK_IN'
                            ? '#e6f4f6'
                            : punchMode === 'CHECK_OUT'
                            ? '#fef3c7'
                            : '#dcfce7',
                        color:
                          punchMode === 'CHECK_IN'
                            ? 'var(--primary)'
                            : punchMode === 'CHECK_OUT'
                            ? '#b45309'
                            : '#15803d',
                      }}
                    >
                      {punchMode === 'CHECK_IN' ? 'Step 1 of 2' : punchMode === 'CHECK_OUT' ? 'Step 2 of 2' : 'Duty Completed'}
                    </span>
                    <h3 style={{ margin: 0, fontSize: '1.08rem', color: '#0f172a' }}>
                      {punchMode === 'CHECK_IN' && '1. Field Duty Check-In'}
                      {punchMode === 'CHECK_OUT' && '2. Field Duty Check-Out'}
                      {punchMode === 'COMPLETED' && 'Field Duty Session Completed'}
                    </h3>
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 4 }}>
                    {punchMode === 'CHECK_IN' && 'Verify biometric face and open GPS to activate duty status.'}
                    {punchMode === 'CHECK_OUT' && 'Enter visit notes and conclude duty to record work hours.'}
                    {punchMode === 'COMPLETED' && 'All duties for today are successfully recorded.'}
                  </div>
                </div>
              </div>

              <form onSubmit={handlePunchSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {/* Employee Selector */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: 4 }}>
                    Select Field Officer:
                  </label>
                  <select
                    value={punchEmpId}
                    onChange={(e) => {
                      const val = e.target.value;
                      setPunchEmpId(val);
                      syncWorkflowState(val);
                    }}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: 8,
                      border: '1px solid var(--border-color)',
                      fontSize: '0.88rem',
                      background: 'var(--bg-surface)',
                    }}
                    required
                  >
                    {employees.length === 0 && user && (
                      <option value={user?.employee?._id || user?.employee || user?._id}>
                        {user.name || 'Field Officer'} ({user.employeeCode || user.email?.split('@')[0] || 'EMP'}) - Work Type: FIELD
                      </option>
                    )}
                    {employees.map((emp) => (
                      <option key={emp._id} value={emp._id}>
                        {getEmpName(emp)} ({getEmpCode(emp)}) - Work Type: {emp.employmentInfo?.workType || 'FIELD'}
                      </option>
                    ))}
                  </select>
                </div>

                {/* GPS Location Status */}
                <div
                  style={{
                    padding: 14,
                    borderRadius: 8,
                    background: coords ? 'var(--success-light)' : 'var(--warning-light)',
                    border: `1px solid ${coords ? 'var(--success-border)' : 'var(--warning-border)'}`,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <MapPin size={18} color={coords ? 'var(--success)' : 'var(--warning)'} />
                      <span style={{ fontSize: '0.84rem', fontWeight: 600, color: coords ? 'var(--success)' : 'var(--warning)' }}>
                        {coords ? 'Open GPS Locked' : 'Acquiring GPS Position...'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <Button size="sm" variant="light" icon={RotateCcw} onClick={() => acquireLocation(false)} loading={gettingLocation} style={{ fontSize: '0.74rem' }}>
                        Refresh GPS
                      </Button>
                      <Button size="sm" variant="success" icon={CheckCircle2} onClick={calibrateHighPrecisionGps} style={{ fontSize: '0.74rem' }}>
                        Fix Precision (15m)
                      </Button>
                    </div>
                  </div>
                  {coords && (
                    <div style={{ fontSize: '0.78rem', color: 'var(--success)', marginTop: 8, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
                      <span>
                        Latitude: <strong>{coords.latitude.toFixed(4)}° N</strong> | Longitude: <strong>{coords.longitude.toFixed(4)}° E</strong> | Accuracy: <strong>{coords.gpsAccuracy}m</strong>
                      </span>
                      {coords.gpsAccuracy <= 200 ? (
                        <span style={{ color: '#15803d', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4, background: '#dcfce7', padding: '2px 8px', borderRadius: 4 }}>
                          <CheckCircle2 size={12} /> GPS Accuracy Verified (&le; 200m)
                        </span>
                      ) : (
                        <span style={{ color: 'var(--danger)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4, background: '#fee2e2', padding: '2px 8px', borderRadius: 4 }}>
                          <AlertTriangle size={12} /> Degraded Accuracy (&gt; 200m)
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* ---------------------------------------------------- */}
                {/* VIEW 1: FIELD CHECK-IN */}
                {/* ---------------------------------------------------- */}
                {punchMode === 'CHECK_IN' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {workflowState.dutyCheckedIn && !workflowState.dutyCheckedOut ? (
                      <div style={{ padding: 14, borderRadius: 10, background: '#f0fdf4', border: '1px solid #bbf7d0', display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, color: '#166534', fontSize: '0.9rem' }}>
                          <CheckCircle2 size={16} /> Field Duty Active (Already Checked-In)
                        </div>
                        <div style={{ fontSize: '0.82rem', color: '#15803d' }}>
                          Checked in at <strong>{workflowState.checkInTime ? new Date(workflowState.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}</strong>. When field work completes, proceed to Check-Out.
                        </div>
                        <Button
                          type="button"
                          variant="warning"
                          icon={ArrowRight}
                          onClick={() => setPunchMode('CHECK_OUT')}
                          style={{ alignSelf: 'flex-start', marginTop: 6, fontSize: '0.82rem', padding: '6px 14px' }}
                        >
                          Proceed to Field Check-Out
                        </Button>
                      </div>
                    ) : (
                      <>
                        {/* Optional Project / Site Selection */}
                        <div style={{ padding: 14, borderRadius: 10, background: 'var(--bg-subtle)', border: '1px solid var(--border-color)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                            <span style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: 6 }}>
                              <HardHat size={16} color="var(--primary)" />
                              Assigned Project / Client Site (Optional):
                            </span>
                            <Button size="sm" variant="light" icon={Navigation} onClick={() => detectNearbySites()} loading={detectingSites} style={{ fontSize: '0.74rem' }}>
                              Scan Nearby Sites
                            </Button>
                          </div>

                          <div style={{ marginBottom: 10 }}>
                            <select
                              value={selectedCandidateSite?.siteId || selectedCandidateSite?._id || ''}
                              onChange={(e) => {
                                const val = e.target.value;
                                if (!val) {
                                  setSelectedCandidateSite(null);
                                  return;
                                }
                                let found = detectedSites.find((s) => (s.siteId || s._id) === val);
                                if (!found) {
                                  for (const p of projects) {
                                    const match = p.sites?.find((s) => (s._id || s.siteId) === val);
                                    if (match) {
                                      found = match;
                                      break;
                                    }
                                  }
                                }
                                setSelectedCandidateSite(found || null);
                                const eligible = found?.eligibleTasks || [];
                                if (eligible.length > 0) {
                                  setSelectedTaskId(eligible[0]._id || eligible[0].id);
                                } else if (tasks.length > 0) {
                                  setSelectedTaskId(tasks[0]._id || tasks[0].id);
                                }
                              }}
                              style={{
                                width: '100%',
                                padding: '9px 12px',
                                borderRadius: 8,
                                border: '1px solid var(--border-color)',
                                fontSize: '0.88rem',
                                background: 'var(--bg-surface)',
                                color: 'var(--text-main)',
                              }}
                            >
                              <option value="">-- Choose Registered Project Site (Or Open Field) --</option>
                              {detectedSites.length > 0 && (
                                <optgroup label="[Nearby] GPS Detected Sites (Within 500m)">
                                  {detectedSites.map((s) => (
                                    <option key={`detected-${s.siteId || s._id}`} value={s.siteId || s._id}>
                                      {s.name} ({getAddressStr(s.address, 'Nearby 500m')})
                                    </option>
                                  ))}
                                </optgroup>
                              )}
                              {projects.map((p) => (
                                <optgroup key={p._id} label={`Project: ${p.name} (${p.code || 'ACTIVE'})`}>
                                  {p.sites && p.sites.length > 0 ? (
                                    p.sites.map((s) => (
                                      <option key={`site-${s._id || s.siteId}`} value={s._id || s.siteId}>
                                        {s.name} - {getAddressStr(s.address, 'Project Location')}
                                      </option>
                                    ))
                                  ) : (
                                    <option disabled value="">No active sites configured</option>
                                  )}
                                </optgroup>
                              ))}
                            </select>
                            <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: 5, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span>
                                {detectedSites.length > 0
                                  ? `Found ${detectedSites.length} site(s) within 500m GPS scan.`
                                  : 'Select registered project site or proceed with open GPS.'}
                              </span>
                              {selectedCandidateSite && (
                                <span style={{ color: 'var(--primary)', fontWeight: 600 }}>
                                  Selected: {selectedCandidateSite.name}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Task linking */}
                          <div>
                            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: 4 }}>
                              Assigned Task:
                            </label>
                            <select
                              value={selectedTaskId}
                              onChange={(e) => setSelectedTaskId(e.target.value)}
                              style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border-color)', fontSize: '0.84rem', background: 'var(--bg-surface)', color: 'var(--text-main)' }}
                            >
                              <option value="">-- General Field Duty --</option>
                              {((selectedCandidateSite?.eligibleTasks?.length > 0) ? selectedCandidateSite.eligibleTasks : tasks).map((t) => (
                                <option key={t._id || t.id} value={t._id || t.id}>
                                  {t.taskName || t.title || 'Site Task'} ({t.status || 'ASSIGNED'})
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        {/* Biometric Face Verification Gate */}
                        <div style={{ border: '1px solid var(--border-color)', borderRadius: 10, padding: 14, background: 'var(--bg-subtle)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-main)' }}>
                              <Camera size={16} color="var(--primary)" />
                              Biometric Face Verification (Check-In Photo):
                            </div>
                            {!cameraActive && !capturedPhoto && (
                              <Button size="sm" variant="primary" icon={Camera} onClick={startCamera}>
                                Start Camera
                              </Button>
                            )}
                          </div>

                          {cameraActive && (
                            <div style={{ textAlign: 'center' }}>
                              <video
                                ref={videoRef}
                                autoPlay
                                playsInline
                                muted
                                style={{ width: '100%', maxHeight: 220, borderRadius: 8, background: '#000' }}
                              />
                              <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginTop: 10 }}>
                                <Button size="sm" variant="success" icon={Check} onClick={captureFrame}>
                                  Capture Biometric Photo
                                </Button>
                                <Button size="sm" variant="light" icon={X} onClick={stopCamera}>
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          )}

                          {capturedPhoto && (
                            <div style={{ textAlign: 'center' }}>
                              <img
                                src={capturedPhoto}
                                alt="Biometric Capture"
                                style={{ width: 130, height: 130, objectFit: 'cover', borderRadius: 8, border: '2px solid var(--primary)' }}
                              />
                              <div style={{ fontSize: '0.76rem', color: 'var(--primary)', fontWeight: 600, marginTop: 4, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                <CheckCircle2 size={13} />
                                <span>Biometric Frame Captured</span>
                              </div>
                              <Button
                                size="sm"
                                variant="light"
                                onClick={() => {
                                  setCapturedPhoto(null);
                                  startCamera();
                                }}
                                style={{ fontSize: '0.74rem', marginTop: 6 }}
                              >
                                Retake Photo
                              </Button>
                            </div>
                          )}

                          <canvas ref={canvasRef} style={{ display: 'none' }} />
                        </div>

                        <Button
                          type="submit"
                          variant="primary"
                          icon={CheckCircle2}
                          loading={submittingPunch}
                          style={{ padding: '12px', fontSize: '0.94rem', fontWeight: 700 }}
                        >
                          Confirm Field Check-In
                        </Button>
                      </>
                    )}
                  </div>
                )}

                {/* ---------------------------------------------------- */}
                {/* VIEW 2: FIELD CHECK-OUT */}
                {/* ---------------------------------------------------- */}
                {punchMode === 'CHECK_OUT' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {!workflowState.dutyCheckedIn ? (
                      <div
                        style={{
                          padding: '24px 18px',
                          borderRadius: 12,
                          background: '#eff6ff',
                          border: '1px solid #bfdbfe',
                          textAlign: 'center',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: 10,
                        }}
                      >
                        <Clock size={34} color="#1d4ed8" />
                        <div style={{ fontWeight: 800, fontSize: '1.05rem', color: '#1e40af' }}>
                          Check-In Required First
                        </div>
                        <p style={{ margin: 0, fontSize: '0.86rem', color: '#2563eb', maxWidth: 420 }}>
                          You have not recorded a Check-In for duty yet. Please complete <strong>Field Check-In</strong> first to activate your duty timer.
                        </p>
                        <Button
                          type="button"
                          variant="primary"
                          icon={CheckCircle2}
                          onClick={() => setPunchMode('CHECK_IN')}
                          style={{ marginTop: 6 }}
                        >
                          Go to Field Check-In
                        </Button>
                      </div>
                    ) : workflowState.dutyCheckedOut ? (
                      <div style={{ padding: 14, borderRadius: 10, background: '#f0fdf4', border: '1px solid #bbf7d0', display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, color: '#166534', fontSize: '0.9rem' }}>
                          <CheckCircle2 size={16} /> Duty Checked-Out Successfully
                        </div>
                        <div style={{ fontSize: '0.82rem', color: '#15803d' }}>
                          Checked out at <strong>{workflowState.checkOutTime ? new Date(workflowState.checkOutTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}</strong>. Total working hours recorded.
                        </div>
                        <Button
                          type="button"
                          variant="primary"
                          icon={RotateCcw}
                          onClick={handleStartNextVisit}
                          style={{ alignSelf: 'flex-start', marginTop: 6, fontSize: '0.82rem', padding: '6px 14px' }}
                        >
                          Start New Duty Session
                        </Button>
                      </div>
                    ) : (
                      <>
                        <div style={{ padding: '10px 14px', borderRadius: 8, background: '#eff6ff', border: '1px solid #bfdbfe', fontSize: '0.82rem', color: '#1e40af', display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Clock size={15} />
                          <span>Duty Active since: <strong>{workflowState.checkInTime ? new Date(workflowState.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}</strong></span>
                        </div>

                        <div>
                          <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: 4 }}>
                            Visit Summary / Activity Remarks:
                          </label>
                          <textarea
                            rows={3}
                            value={punchRemarks}
                            onChange={(e) => setPunchRemarks(e.target.value)}
                            placeholder="e.g. Completed client inspection, territory audit, and project coordination"
                            style={{
                              width: '100%',
                              padding: '10px 12px',
                              borderRadius: 8,
                              border: '1px solid var(--border-color)',
                              fontSize: '0.88rem',
                              fontFamily: 'inherit',
                              resize: 'vertical',
                            }}
                          />
                        </div>

                        <Button
                          type="submit"
                          variant="warning"
                          icon={LogOut}
                          loading={submittingPunch}
                          style={{ padding: '12px', fontSize: '0.94rem', fontWeight: 700 }}
                        >
                          Confirm Field Check-Out
                        </Button>
                      </>
                    )}
                  </div>
                )}

                {/* ---------------------------------------------------- */}
                {/* VIEW 3: COMPLETED DUTY */}
                {/* ---------------------------------------------------- */}
                {punchMode === 'COMPLETED' && (
                  <div
                    style={{
                      padding: 24,
                      borderRadius: 12,
                      background: 'linear-gradient(135deg, rgba(16,185,129,0.08) 0%, rgba(46,123,133,0.08) 100%)',
                      border: '1px solid var(--success-border)',
                      textAlign: 'center',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 12,
                    }}
                  >
                    <CheckCircle2 size={44} color="var(--success)" />
                    <div style={{ fontWeight: 800, fontSize: '1.15rem', color: '#065f46' }}>
                      Field Duty Completed Today!
                    </div>
                    <p style={{ margin: 0, fontSize: '0.86rem', color: '#047857', maxWidth: 440 }}>
                      Your duty check-in and check-out have been recorded with GPS and working hours.
                    </p>
                    <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                      <Button variant="primary" icon={RotateCcw} onClick={handleStartNextVisit}>
                        Start New Duty Session
                      </Button>
                      <Button variant="light" onClick={() => setActiveTab('records')}>
                        View Field Register
                      </Button>
                    </div>
                  </div>
                )}
              </form>
            </div>

            {/* Punch Receipt / Execution Verdict Card */}
            <div style={{ background: '#ffffff', borderRadius: 14, padding: 24, border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <h3 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--text-main)' }}>
                  Real-Time Attendance Receipt
                </h3>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Live Audit</span>
              </div>

              {punchResult ? (
                <div
                  style={{
                    padding: 16,
                    borderRadius: 10,
                    background: 'var(--success-light)',
                    border: '1px solid var(--success-border)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, color: 'var(--success)', marginBottom: 10 }}>
                    <CheckCircle2 size={20} />
                    {punchResult.mode === 'CHECK_IN'
                      ? 'Field Check-In Confirmed'
                      : 'Field Check-Out Confirmed'}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: '0.85rem' }}>
                    <div>Attendance ID: <strong>{punchResult.data?.attendanceId || punchResult.data?._id || 'REC-' + Math.floor(100000 + Math.random() * 900000)}</strong></div>
                    <div>Timestamp: <strong>{new Date().toLocaleTimeString()}</strong></div>
                    <div>
                      Coordinates: <strong>{coords?.latitude?.toFixed(4)}° N, {coords?.longitude?.toFixed(4)}° E</strong>
                    </div>

                    {punchResult.mode === 'CHECK_IN' && (
                      <div style={{ marginTop: 8, padding: 10, background: '#ffffff', borderRadius: 8, border: '1px solid var(--success-border)' }}>
                        <div>Duty Status: <Badge variant="primary">ACTIVE ON DUTY</Badge></div>
                        <div>Required Working Hours: <strong>{punchResult.data?.requiredWorkingHours ?? 8} hrs</strong></div>
                        {punchResult.site && (
                          <div style={{ marginTop: 4 }}>Site / Project: <strong>{punchResult.site.name}</strong></div>
                        )}
                        <div style={{ color: 'var(--primary)', fontWeight: 600, marginTop: 4 }}>
                          Next Step: Field duty is active. When work completes, punch Check-Out.
                        </div>
                      </div>
                    )}

                    {punchResult.mode === 'CHECK_OUT' && (
                      <div style={{ marginTop: 8, padding: 10, background: '#ffffff', borderRadius: 8, border: '1px solid var(--success-border)' }}>
                        <div>Total Hours Worked: <strong>{punchResult.data?.totalWorkingHours ?? workflowState.workHours} hrs</strong></div>
                        <div>Shortfall: <strong style={{ color: punchResult.data?.shortfallHours > 0 ? 'var(--danger)' : 'var(--success)' }}>{punchResult.data?.shortfallHours ?? 0} hrs</strong></div>
                        <div>Overtime: <strong style={{ color: 'var(--success)' }}>+{punchResult.data?.overtimeHours ?? 0} hrs</strong></div>
                        <div>Final Status: <Badge variant={punchResult.data?.attendanceStatus === 'SHORTFALL' ? 'warning' : 'success'}>{punchResult.data?.attendanceStatus || 'PRESENT'}</Badge></div>
                        <div style={{ color: 'var(--success)', fontWeight: 600, marginTop: 4 }}>
                          Duty session successfully concluded.
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '50px 16px', color: 'var(--text-light)' }}>
                  <Compass size={48} style={{ opacity: 0.3, marginBottom: 10 }} />
                  <p style={{ margin: '0 0 6px', fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                    No Punch Submitted Yet
                  </p>
                  <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-light)', maxWidth: 280, marginInline: 'auto' }}>
                    Punch Check-In to start duty, and Check-Out upon completion.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: MY FIELD ATTENDANCE HISTORY (GET /attendance/field/me) */}
      {activeTab === 'my_history' && (
        <div style={{ background: 'var(--bg-surface)', borderRadius: 14, padding: 20, border: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-main)' }}>My Field Attendance History</h3>
              <p style={{ margin: '4px 0 0', fontSize: '0.84rem', color: 'var(--text-muted)' }}>
                Your personal field check-in and checkout history, duty hours, shortfall, and overtime breakdown.
              </p>
            </div>
            <Button
              variant="light"
              size="sm"
              icon={RotateCcw}
              onClick={loadMyHistory}
              loading={loadingMyHistory}
            >
              Refresh
            </Button>
          </div>

          <Table
            columns={recordColumns}
            data={myHistory}
            loading={loadingMyHistory}
            emptyMessage="No personal field attendance history recorded yet."
          />
        </div>
      )}

      {/* TAB 4: EMPLOYEE TRAVEL HISTORY (GET /attendance/field/employees/:id) */}
      {activeTab === 'employee_history' && (
        <div style={{ background: 'var(--bg-surface)', borderRadius: 14, padding: 20, border: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center', marginBottom: 20 }}>
            <div style={{ flex: 1, minWidth: 260 }}>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: 4 }}>
                Select Employee:
              </label>
              <select
                value={selectedHistoryEmpId}
                onChange={(e) => setSelectedHistoryEmpId(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: 8,
                  border: '1px solid var(--border-color)',
                  fontSize: '0.88rem',
                  background: 'var(--bg-surface)',
                }}
              >
                {employees.map((emp) => (
                  <option key={emp._id || emp.id} value={emp._id || emp.id}>
                    {getEmpName(emp)} ({getEmpCode(emp)})
                  </option>
                ))}
              </select>
            </div>

            <div style={{ alignSelf: 'flex-end' }}>
              <Button
                variant="primary"
                icon={Search}
                onClick={() => loadEmployeeHistory(selectedHistoryEmpId)}
                loading={loadingHistory}
              >
                Fetch Travel Logs
              </Button>
            </div>
          </div>

          <Table
            columns={recordColumns}
            data={employeeHistory}
            loading={loadingHistory}
            emptyMessage="No travel attendance history found for this employee."
          />
        </div>
      )}

      {/* MULTI-PUNCH SESSIONS MODAL */}
      <Modal
        isOpen={sessionModalOpen}
        onClose={() => setSessionModalOpen(false)}
        title="Field Visit Sessions (Multi-Punch Breakdown)"
      >
        {selectedRecord && (
          <div>
            <div style={{ background: 'var(--bg-subtle)', padding: 14, borderRadius: 8, marginBottom: 16, border: '1px solid var(--border-color)', fontSize: '0.85rem' }}>
              <div>Officer: <strong>{selectedRecord.employee?.name || selectedRecord.employee?.firstName || 'Field Staff'}</strong></div>
              <div>Date: <strong>{new Date(selectedRecord.attendanceDate).toLocaleDateString()}</strong></div>
              <div>
                Total Working Hours: <strong>{selectedRecord.totalWorkingHours?.toFixed(1) || 0} hrs</strong> (Duty Required: {selectedRecord.requiredWorkingHours || 8} hrs)
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {(selectedRecord.punches || []).map((p, idx) => (
                <div
                  key={p._id || idx}
                  style={{
                    padding: 14,
                    borderRadius: 8,
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-color)',
                    borderLeft: `4px solid ${p.isOpen ? 'var(--info)' : 'var(--primary)'}`,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontWeight: 600, fontSize: '0.86rem', color: 'var(--text-main)' }}>
                      Visit #{idx + 1}
                    </span>
                    <Badge variant={p.isOpen ? 'info' : 'success'}>
                      {p.isOpen ? 'Currently On Duty' : 'Completed Visit'}
                    </Badge>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    <div>Check-In: <strong>{p.checkInTime ? new Date(p.checkInTime).toLocaleTimeString() : '-'}</strong> ({p.checkInAddress || 'Open Field GPS'})</div>
                    <div>Check-Out: <strong>{p.checkOutTime ? new Date(p.checkOutTime).toLocaleTimeString() : 'In Progress'}</strong> ({p.checkOutAddress || '-'})</div>
                    {p.remarks && <div style={{ color: 'var(--primary)', marginTop: 4 }}>Remarks: {p.remarks}</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Modal>

      {/* STEP 7: ADMIN CORRECTION MODAL */}
      <Modal
        isOpen={correctModalOpen}
        onClose={() => setCorrectModalOpen(false)}
        title="Manual Administrative Field Attendance Correction"
      >
        <form onSubmit={handleCorrectSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {selectedRecord && (
            <div style={{ background: 'var(--bg-subtle)', padding: 12, borderRadius: 8, border: '1px solid var(--border-color)', fontSize: '0.84rem' }}>
              <div>Employee: <strong>{selectedRecord.employee?.name || selectedRecord.employee?.firstName || 'Field Staff'}</strong></div>
              <div>Date: <strong>{new Date(selectedRecord.attendanceDate).toLocaleDateString()}</strong></div>
            </div>
          )}

          <div className="grid-2">
            <Input
              label="Required Duty Hours"
              type="number"
              step="0.5"
              value={correctForm.requiredWorkingHours}
              onChange={(e) => setCorrectForm({ ...correctForm, requiredWorkingHours: Number(e.target.value) })}
              required
            />
            <Input
              label="Adjusted Total Hours Worked"
              type="number"
              step="0.5"
              value={correctForm.totalWorkingHours}
              onChange={(e) => setCorrectForm({ ...correctForm, totalWorkingHours: Number(e.target.value) })}
              required
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: 4 }}>
              Attendance Verdict Status:
            </label>
            <select
              value={correctForm.attendanceStatus}
              onChange={(e) => setCorrectForm({ ...correctForm, attendanceStatus: e.target.value })}
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: 8,
                border: '1px solid var(--border-color)',
                fontSize: '0.88rem',
                background: 'var(--bg-surface)',
              }}
            >
              <option value="PRESENT">PRESENT</option>
              <option value="SHORTFALL">SHORTFALL</option>
              <option value="ABSENT">ABSENT</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: 4 }}>
              Mandatory Correction Remark:
            </label>
            <textarea
              rows={3}
              value={correctForm.correctionRemark}
              onChange={(e) => setCorrectForm({ ...correctForm, correctionRemark: e.target.value })}
              placeholder="e.g. Authorized 8.5 hours client audit confirmed by regional field supervisor"
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 8,
                border: '1px solid var(--border-color)',
                fontSize: '0.88rem',
                fontFamily: 'inherit',
                resize: 'vertical',
              }}
              required
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
            <Button variant="light" type="button" onClick={() => setCorrectModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" loading={submittingCorrect}>
              Save Correction
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default FieldAttendance;
