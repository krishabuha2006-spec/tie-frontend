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

  const getEmpName = (emp) =>
    emp?.basicInfo?.fullName ||
    emp?.fullName ||
    (emp?.firstName ? `${emp.firstName} ${emp.lastName || ''}`.trim() : '') ||
    emp?.name ||
    'Field Officer';

  const getEmpCode = (emp) =>
    emp?.basicInfo?.employeeCode || emp?.employeeCode || '-';

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
  const [punchMode, setPunchMode] = useState('SITE_IN'); // 'SITE_IN' | 'CHECK_IN' | 'CHECK_OUT' | 'SITE_OUT' | 'COMPLETED'
  const [punchRemarks, setPunchRemarks] = useState('');
  const [coords, setCoords] = useState(null);
  const [gettingLocation, setGettingLocation] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState(null);
  const [submittingPunch, setSubmittingPunch] = useState(false);
  const [punchResult, setPunchResult] = useState(null);

  // Sequential Workflow State (Site-In -> Check-In -> Check-Out -> Site-Out)
  const getTodayKey = () => new Date().toISOString().split('T')[0];
  const [workflowState, setWorkflowState] = useState({
    siteInDone: false,
    siteInTime: null,
    activeSite: null,
    dutyCheckedIn: false,
    checkInTime: null,
    dutyCheckedOut: false,
    checkOutTime: null,
    siteOutDone: false,
    siteOutTime: null,
    workHours: 0,
    shortfallHours: 0,
    overtimeHours: 0,
  });

  // Masters & Detection for Site-In & Site-Out
  const [projects, setProjects] = useState([]);
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

  // Load Masters
  const loadMasters = async () => {
    try {
      const [bRes, eRes, pRes] = await Promise.allSettled([
        masterApi.getBranches(),
        employeeApi.getEmployees({ limit: 100 }),
        projectTaskApi.getProjects(),
      ]);
      if (bRes.status === 'fulfilled') {
        setBranches(bRes.value?.data || bRes.value?.branches || []);
      }
      if (pRes.status === 'fulfilled') {
        const pList = pRes.value?.projects || pRes.value?.data || (Array.isArray(pRes.value) ? pRes.value : []);
        setProjects(pList);
      }
      if (eRes.status === 'fulfilled') {
        const list = eRes.value?.data || eRes.value?.employees || [];
        setEmployees(list);
        if (list.length > 0) {
          const defaultEmp = user?.employee?._id || user?.employee || list[0]._id;
          setSelectedHistoryEmpId(defaultEmp);
          setPunchEmpId(defaultEmp);
        }
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
      const [siteRes, fieldRes] = await Promise.allSettled([
        attendanceApi.getEmployeeSiteAttendance(empId, { date: today }),
        attendanceApi.getEmployeeFieldAttendance(empId, { date: today }),
      ]);

      const siteList = siteRes.status === 'fulfilled' ? (Array.isArray(siteRes.value) ? siteRes.value : siteRes.value?.records || siteRes.value?.data || []) : [];
      const fieldList = fieldRes.status === 'fulfilled' ? (Array.isArray(fieldRes.value) ? fieldRes.value : fieldRes.value?.records || fieldRes.value?.data || []) : [];

      const todaySiteRec = siteList.find((r) => (r.attendanceDate && r.attendanceDate.startsWith(today)) || (r.siteInTime && new Date(r.siteInTime).toISOString().startsWith(today)));
      const todayFieldRec = fieldList.find((r) => (r.attendanceDate && r.attendanceDate.startsWith(today)) || (r.firstCheckInTime && new Date(r.firstCheckInTime).toISOString().startsWith(today)));

      const siteInDone = Boolean(todaySiteRec?.siteInTime || localData?.siteInDone);
      const siteInTime = todaySiteRec?.siteInTime || localData?.siteInTime;
      const activeSite = todaySiteRec?.site || localData?.activeSite || (todaySiteRec ? { name: todaySiteRec.site?.name || 'Project Site', address: todaySiteRec.site?.address } : null);

      const dutyCheckedIn = Boolean(todayFieldRec?.firstCheckInTime || localData?.dutyCheckedIn);
      const checkInTime = todayFieldRec?.firstCheckInTime || localData?.checkInTime;

      const dutyCheckedOut = Boolean(todayFieldRec?.lastCheckOutTime || localData?.dutyCheckedOut);
      const checkOutTime = todayFieldRec?.lastCheckOutTime || localData?.checkOutTime;

      const siteOutDone = Boolean(todaySiteRec?.siteOutTime || localData?.siteOutDone);
      const siteOutTime = todaySiteRec?.siteOutTime || localData?.siteOutTime;

      const merged = {
        siteInDone,
        siteInTime,
        activeSite,
        dutyCheckedIn,
        checkInTime,
        dutyCheckedOut,
        checkOutTime,
        siteOutDone,
        siteOutTime,
        workHours: todayFieldRec?.totalWorkingHours ?? localData?.workHours ?? 0,
        shortfallHours: todayFieldRec?.shortfallHours ?? localData?.shortfallHours ?? 0,
        overtimeHours: todayFieldRec?.overtimeHours ?? localData?.overtimeHours ?? 0,
      };

      setWorkflowState(merged);
      localStorage.setItem(cacheKey, JSON.stringify(merged));

      if (!merged.siteInDone) {
        setPunchMode('SITE_IN');
      } else if (!merged.dutyCheckedIn) {
        setPunchMode('CHECK_IN');
      } else if (!merged.dutyCheckedOut) {
        setPunchMode('CHECK_OUT');
      } else if (!merged.siteOutDone) {
        setPunchMode('SITE_OUT');
      } else {
        setPunchMode('COMPLETED');
      }
    } catch {
      if (localData) {
        setWorkflowState(localData);
        if (!localData.siteInDone) setPunchMode('SITE_IN');
        else if (!localData.dutyCheckedIn) setPunchMode('CHECK_IN');
        else if (!localData.dutyCheckedOut) setPunchMode('CHECK_OUT');
        else if (!localData.siteOutDone) setPunchMode('SITE_OUT');
        else setPunchMode('COMPLETED');
      }
    }
  };

  const handleStartNextVisit = () => {
    const today = getTodayKey();
    const empId = punchEmpId || user?.employee?._id || user?.employee || 'self';
    const cacheKey = `tie_field_workflow_${empId}_${today}`;
    const reset = {
      siteInDone: false,
      siteInTime: null,
      activeSite: null,
      dutyCheckedIn: false,
      checkInTime: null,
      dutyCheckedOut: false,
      checkOutTime: null,
      siteOutDone: false,
      siteOutTime: null,
      workHours: 0,
      shortfallHours: 0,
      overtimeHours: 0,
    };
    setWorkflowState(reset);
    localStorage.removeItem(cacheKey);
    setPunchMode('SITE_IN');
    setPunchResult(null);
    setCapturedPhoto(null);
    showToast('New site visit session initiated. Please Site-In first.', 'info');
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

  // GPS Acquisition
  const acquireLocation = () => {
    setGettingLocation(true);
    if (!navigator.geolocation) {
      showToast('Geolocation is not supported by your browser', 'error');
      setGettingLocation(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const c = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          gpsAccuracy: Math.round(pos.coords.accuracy * 10) / 10,
        };
        setCoords(c);
        setGettingLocation(false);
        detectNearbySites(c);
      },
      (err) => {
        console.warn('GPS error, using fallback location:', err);
        const fallback = {
          latitude: 21.25,
          longitude: 72.9,
          gpsAccuracy: 15.0,
        };
        setCoords(fallback);
        setGettingLocation(false);
        detectNearbySites(fallback);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
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

  // Handle Field Punch Submit (Step 1: Site-In -> Step 2: Check-In -> Step 3: Check-Out -> Step 4: Site-Out)
  const handlePunchSubmit = async (e) => {
    e.preventDefault();
    if (!coords) {
      showToast('GPS coordinates required. Please acquire location.', 'warning');
      return;
    }

    // ----------------------------------------------------
    // STEP 1: SITE-IN (Arrival at Project / Client Site)
    // ----------------------------------------------------
    if (punchMode === 'SITE_IN') {
      const siteId =
        selectedCandidateSite?.siteId ||
        selectedCandidateSite?._id ||
        detectedSites[0]?.siteId ||
        detectedSites[0]?._id ||
        projects[0]?.sites?.[0]?._id;

      if (!siteId && projects.length === 0 && detectedSites.length === 0) {
        showToast('Please select or detect a project site first', 'warning');
        return;
      }
      if (!capturedPhoto) {
        showToast('Biometric face capture is required for Site-In gate verification', 'warning');
        return;
      }

      setSubmittingPunch(true);
      setPunchResult(null);
      try {
        const taskId = selectedTaskId || selectedCandidateSite?.eligibleTasks?.[0]?._id;

        const res = await attendanceApi.siteCheckIn({
          employee: punchEmpId || user?.employee?._id || user?.employee,
          latitude: coords.latitude,
          longitude: coords.longitude,
          gpsAccuracy: coords.gpsAccuracy || 15,
          capturedImage: capturedPhoto,
          selectedSiteId: siteId,
          taskId: taskId,
          confidenceScore: 0.95,
        });

        const now = new Date().toISOString();
        const siteObj = {
          siteId,
          name: selectedCandidateSite?.name || 'Project Site',
          address: selectedCandidateSite?.address || 'Site Area',
          taskId,
          taskTitle: selectedCandidateSite?.eligibleTasks?.find((t) => t._id === taskId)?.title || 'Field Work',
        };

        updateWorkflow({
          siteInDone: true,
          siteInTime: now,
          activeSite: siteObj,
        });

        showToast('Site-In recorded successfully! You can now proceed to Check-In.', 'success');
        setPunchResult({
          mode: 'SITE_IN',
          data: res,
          site: siteObj,
        });
        setCapturedPhoto(null);
        setPunchMode('CHECK_IN');
      } catch (err) {
        console.error(err);
        const errMsg = err.response?.data?.message || 'Site-In verification failed';
        showToast(errMsg, 'error');
      } finally {
        setSubmittingPunch(false);
      }
      return;
    }

    // ----------------------------------------------------
    // STEP 2: CHECK-IN (Field Duty Start) - LOCKED UNTIL SITE-IN
    // ----------------------------------------------------
    if (punchMode === 'CHECK_IN') {
      if (!workflowState.siteInDone) {
        showToast('Pehle Site-In karein! Site-In karne ke baad hi Check-In kar sakte hain.', 'error');
        return;
      }
      if (coords.gpsAccuracy > 100) {
        showToast(`GPS accuracy too degraded (${coords.gpsAccuracy}m > 100m threshold). Move to an open area.`, 'error');
        return;
      }
      if (!capturedPhoto) {
        showToast('Biometric face photo capture is required for Field Check-In', 'warning');
        return;
      }

      setSubmittingPunch(true);
      setPunchResult(null);
      try {
        const res = await attendanceApi.fieldCheckIn({
          employee: punchEmpId || user?.employee?._id || user?.employee,
          latitude: coords.latitude,
          longitude: coords.longitude,
          gpsAccuracy: coords.gpsAccuracy,
          capturedImage: capturedPhoto,
        });

        const now = new Date().toISOString();
        updateWorkflow({
          dutyCheckedIn: true,
          checkInTime: now,
          dutyCheckedOut: false,
        });

        showToast('Field check-in recorded successfully with open GPS capture! Duty is active.', 'success');
        setPunchResult({
          mode: 'CHECK_IN',
          data: res,
        });
        setCapturedPhoto(null);
        setPunchMode('CHECK_OUT');
        loadRecords();
      } catch (err) {
        console.error(err);
        const errMsg = err.response?.data?.message || 'Field attendance check-in failed';
        showToast(errMsg, 'error');
      } finally {
        setSubmittingPunch(false);
      }
      return;
    }

    // ----------------------------------------------------
    // STEP 3: CHECK-OUT (Field Duty End) - LOCKED UNTIL CHECKED-IN
    // ----------------------------------------------------
    if (punchMode === 'CHECK_OUT') {
      if (!workflowState.dutyCheckedIn) {
        showToast('Pehle Check-In karein! Uske baad hi Check-Out kar sakte hain.', 'error');
        return;
      }

      setSubmittingPunch(true);
      setPunchResult(null);
      try {
        const res = await attendanceApi.fieldCheckOut({
          employee: punchEmpId || user?.employee?._id || user?.employee,
          latitude: coords.latitude,
          longitude: coords.longitude,
          gpsAccuracy: coords.gpsAccuracy,
          remarks: punchRemarks.trim() || 'Client territory inspection completed',
        });

        const now = new Date().toISOString();
        updateWorkflow({
          dutyCheckedOut: true,
          checkOutTime: now,
          workHours: res?.totalWorkingHours ?? 8,
          shortfallHours: res?.shortfallHours ?? 0,
          overtimeHours: res?.overtimeHours ?? 0,
        });

        showToast('Field check-out successful! Shortfall & overtime hours calculated. You can now perform Site-Out.', 'success');
        setPunchResult({
          mode: 'CHECK_OUT',
          data: res,
        });
        setPunchRemarks('');
        setPunchMode('SITE_OUT');
        loadRecords();
      } catch (err) {
        console.error(err);
        const errMsg = err.response?.data?.message || 'Field attendance check-out failed';
        showToast(errMsg, 'error');
      } finally {
        setSubmittingPunch(false);
      }
      return;
    }

    // ----------------------------------------------------
    // STEP 4: SITE-OUT (Site Departure) - LOCKED UNTIL CHECK-OUT
    // ----------------------------------------------------
    if (punchMode === 'SITE_OUT') {
      if (workflowState.dutyCheckedIn && !workflowState.dutyCheckedOut) {
        showToast('Pehle Check-Out karein! Check-Out karne ke baad hi Site-Out ho sakta hai.', 'error');
        return;
      }
      if (!workflowState.siteInDone) {
        showToast('Pehle Site-In karein! Uske baad hi Check-Out aur Site-Out ho sakta hai.', 'error');
        return;
      }
      if (siteOutPhotos.length === 0 && !capturedPhoto) {
        showToast('Mandatory: At least 1 site photograph is required for Site-Out exit', 'warning');
        return;
      }
      if (!siteOutRemarks.trim()) {
        showToast('Mandatory: Activity remarks are required for Site-Out exit', 'warning');
        return;
      }

      setSubmittingPunch(true);
      setPunchResult(null);
      try {
        const allPhotos = [...siteOutPhotos];
        if (capturedPhoto) allPhotos.push(capturedPhoto);

        const res = await attendanceApi.siteCheckOut({
          employee: punchEmpId || user?.employee?._id || user?.employee,
          latitude: coords.latitude,
          longitude: coords.longitude,
          gpsAccuracy: coords.gpsAccuracy || 15,
          photos: allPhotos,
          remarks: siteOutRemarks.trim(),
          taskCompleted,
        });

        const now = new Date().toISOString();
        updateWorkflow({
          siteOutDone: true,
          siteOutTime: now,
        });

        showToast('Site-Out exit verified and recorded successfully! Visit cycle completed.', 'success');
        setPunchResult({
          mode: 'SITE_OUT',
          data: res,
        });
        setCapturedPhoto(null);
        setSiteOutPhotos([]);
        setSiteOutRemarks('');
        setPunchMode('COMPLETED');
        loadRecords();
      } catch (err) {
        console.error(err);
        const errMsg = err.response?.data?.message || 'Site-Out failed';
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
            {/* Top Bar: Title & Status */}
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
                    width: 40,
                    height: 40,
                    borderRadius: 12,
                    background: 'linear-gradient(135deg, var(--primary) 0%, #1e5a62 100%)',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 3px 10px rgba(46,123,133,0.3)',
                  }}
                >
                  <Compass size={22} />
                </div>
                <div>
                  <div style={{ fontSize: '1.02rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.01em' }}>
                    Field Attendance Workflow
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Mandatory Sequence: <strong>1. Site-In</strong> ➔ <strong>2. Check-In</strong> ➔ <strong>3. Check-Out</strong> ➔ <strong>4. Site-Out</strong>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {workflowState.siteOutDone ? (
                  <Badge variant="success" style={{ fontSize: '0.82rem', padding: '6px 14px', borderRadius: 20 }}>
                    ✓ Full Visit Concluded
                  </Badge>
                ) : workflowState.dutyCheckedOut ? (
                  <Badge variant="warning" style={{ fontSize: '0.82rem', padding: '6px 14px', borderRadius: 20 }}>
                    ● Step 4 Ready: Site-Out Exit
                  </Badge>
                ) : workflowState.dutyCheckedIn ? (
                  <Badge variant="primary" style={{ fontSize: '0.82rem', padding: '6px 14px', borderRadius: 20 }}>
                    ● Step 3 Active: On Field Duty
                  </Badge>
                ) : workflowState.siteInDone ? (
                  <Badge variant="info" style={{ fontSize: '0.82rem', padding: '6px 14px', borderRadius: 20 }}>
                    ● Step 2 Ready: Duty Check-In
                  </Badge>
                ) : (
                  <Badge variant="secondary" style={{ fontSize: '0.82rem', padding: '6px 14px', borderRadius: 20 }}>
                    ● Step 1: Site-In Required
                  </Badge>
                )}

                {workflowState.siteOutDone && (
                  <Button size="sm" variant="light" icon={RotateCcw} onClick={handleStartNextVisit} style={{ fontSize: '0.78rem' }}>
                    Start Next Visit
                  </Button>
                )}
              </div>
            </div>

            {/* Connected Horizontal Stepper Flow */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: 12,
                position: 'relative',
              }}
            >
              {[
                {
                  id: 'SITE_IN',
                  stepNum: 1,
                  title: '1. Site-In',
                  sub: 'Site Arrival & GPS',
                  icon: LogIn,
                  isDone: workflowState.siteInDone,
                  doneTime: workflowState.siteInTime,
                  isLocked: false,
                  isActive: punchMode === 'SITE_IN',
                  accentColor: 'var(--primary)',
                },
                {
                  id: 'CHECK_IN',
                  stepNum: 2,
                  title: '2. Check-In',
                  sub: 'Duty Biometrics',
                  icon: CheckCircle2,
                  isDone: workflowState.dutyCheckedIn,
                  doneTime: workflowState.checkInTime,
                  isLocked: !workflowState.siteInDone,
                  isActive: punchMode === 'CHECK_IN',
                  accentColor: 'var(--primary)',
                },
                {
                  id: 'CHECK_OUT',
                  stepNum: 3,
                  title: '3. Check-Out',
                  sub: 'Duty End & Hours',
                  icon: LogOut,
                  isDone: workflowState.dutyCheckedOut,
                  doneTime: workflowState.checkOutTime,
                  isLocked: !workflowState.dutyCheckedIn,
                  isActive: punchMode === 'CHECK_OUT',
                  accentColor: 'var(--warning)',
                },
                {
                  id: 'SITE_OUT',
                  stepNum: 4,
                  title: '4. Site-Out',
                  sub: 'Site Exit & Photo',
                  icon: Navigation,
                  isDone: workflowState.siteOutDone,
                  doneTime: workflowState.siteOutTime,
                  isLocked: (workflowState.dutyCheckedIn && !workflowState.dutyCheckedOut) || !workflowState.siteInDone,
                  isActive: punchMode === 'SITE_OUT',
                  accentColor: '#7c3aed',
                },
              ].map((step) => {
                const StepIcon = step.icon;
                return (
                  <div
                    key={step.id}
                    onClick={() => {
                      if (step.isLocked) {
                        if (step.id === 'CHECK_IN') {
                          showToast('Pehle Step 1: Site-In karein! Tabhi Check-In unlock hoga.', 'warning');
                        } else if (step.id === 'CHECK_OUT') {
                          showToast('Pehle Step 2: Check-In karein! Uske baad hi Check-Out unlock hoga.', 'warning');
                        } else if (step.id === 'SITE_OUT') {
                          showToast('Pehle Step 3: Check-Out karein! Uske baad hi Site-Out unlock hoga.', 'warning');
                        }
                      }
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
                        : step.isLocked
                        ? '#f8fafc'
                        : '#ffffff',
                      border: `2px solid ${
                        step.isActive
                          ? step.accentColor
                          : step.isDone
                          ? '#86efac'
                          : step.isLocked
                          ? '#e2e8f0'
                          : '#cbd5e1'
                      }`,
                      borderRadius: 12,
                      padding: '14px 16px',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      boxShadow: step.isActive
                        ? `0 4px 14px ${step.id === 'SITE_OUT' ? 'rgba(124,58,237,0.15)' : 'rgba(46,123,133,0.15)'}`
                        : 'none',
                      opacity: step.isLocked && !step.isActive ? 0.72 : 1,
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      minHeight: 90,
                    }}
                  >
                    {/* Top: Icon + Status Pill */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <div
                        style={{
                          width: 30,
                          height: 30,
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.82rem',
                          fontWeight: 800,
                          background: step.isDone
                            ? '#10b981'
                            : step.isActive
                            ? step.accentColor
                            : step.isLocked
                            ? '#e2e8f0'
                            : '#f1f5f9',
                          color: step.isDone || step.isActive ? '#ffffff' : step.isLocked ? '#94a3b8' : 'var(--text-muted)',
                          boxShadow: step.isActive ? `0 0 0 3px ${step.id === 'SITE_OUT' ? 'rgba(124,58,237,0.2)' : 'rgba(46,123,133,0.2)'}` : 'none',
                        }}
                      >
                        {step.isDone ? <Check size={16} strokeWidth={2.6} /> : step.isLocked ? <Lock size={13} /> : step.stepNum}
                      </div>

                      {step.isDone ? (
                        <span
                          style={{
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            color: '#15803d',
                            background: '#dcfce7',
                            padding: '2px 8px',
                            borderRadius: 12,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 3,
                          }}
                        >
                          ✓ Done
                        </span>
                      ) : step.isLocked ? (
                        <span
                          style={{
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            color: '#dc2626',
                            background: '#fee2e2',
                            padding: '2px 8px',
                            borderRadius: 12,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 3,
                          }}
                        >
                          <Lock size={10} /> Locked
                        </span>
                      ) : step.isActive ? (
                        <span
                          style={{
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            color: step.accentColor,
                            background: '#e6f4f6',
                            padding: '2px 8px',
                            borderRadius: 12,
                          }}
                        >
                          Active
                        </span>
                      ) : (
                        <span
                          style={{
                            fontSize: '0.7rem',
                            fontWeight: 600,
                            color: 'var(--text-muted)',
                            background: '#f1f5f9',
                            padding: '2px 8px',
                            borderRadius: 12,
                          }}
                        >
                          Ready
                        </span>
                      )}
                    </div>

                    {/* Step Title & Sub */}
                    <div>
                      <div
                        style={{
                          fontSize: '0.88rem',
                          fontWeight: 700,
                          color: step.isActive ? 'var(--text-main)' : step.isLocked ? '#64748b' : 'var(--text-main)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                        }}
                      >
                        <StepIcon
                          size={15}
                          color={step.isDone ? '#10b981' : step.isActive ? step.accentColor : step.isLocked ? '#94a3b8' : 'var(--text-muted)'}
                        />
                        <span>{step.title}</span>
                      </div>
                      <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: 3 }}>
                        {step.isDone && step.doneTime
                          ? `Done at ${new Date(step.doneTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
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
                          punchMode === 'SITE_IN'
                            ? 'var(--primary-subtle, #e6f4f6)'
                            : punchMode === 'CHECK_IN'
                            ? '#dbeafe'
                            : punchMode === 'CHECK_OUT'
                            ? '#fef3c7'
                            : '#ede9fe',
                        color:
                          punchMode === 'SITE_IN'
                            ? 'var(--primary)'
                            : punchMode === 'CHECK_IN'
                            ? '#1d4ed8'
                            : punchMode === 'CHECK_OUT'
                            ? '#b45309'
                            : '#6d28d9',
                      }}
                    >
                      {punchMode === 'SITE_IN'
                        ? 'Step 1 of 4'
                        : punchMode === 'CHECK_IN'
                        ? 'Step 2 of 4'
                        : punchMode === 'CHECK_OUT'
                        ? 'Step 3 of 4'
                        : 'Step 4 of 4'}
                    </span>
                    <h3 style={{ margin: 0, fontSize: '1.08rem', color: '#0f172a' }}>
                      {punchMode === 'SITE_IN' && '1. Project Site Arrival (Site-In)'}
                      {punchMode === 'CHECK_IN' && '2. Field Duty Check-In'}
                      {punchMode === 'CHECK_OUT' && '3. Field Duty Check-Out'}
                      {punchMode === 'SITE_OUT' && '4. Project Site Exit (Site-Out)'}
                    </h3>
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 4 }}>
                    {punchMode === 'SITE_IN' && 'Select your project site and capture your entry face photo.'}
                    {punchMode === 'CHECK_IN' && 'Verify biometric face and GPS to activate on-duty status.'}
                    {punchMode === 'CHECK_OUT' && 'Enter visit notes and conclude duty to record work hours.'}
                    {punchMode === 'SITE_OUT' && 'Upload site departure photo to conclude this site visit.'}
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
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <MapPin size={18} color={coords ? 'var(--success)' : 'var(--warning)'} />
                      <span style={{ fontSize: '0.84rem', fontWeight: 600, color: coords ? 'var(--success)' : 'var(--warning)' }}>
                        {coords ? 'Open GPS Locked' : 'Acquiring GPS Position...'}
                      </span>
                    </div>
                    <Button size="sm" variant="light" icon={RotateCcw} onClick={acquireLocation} loading={gettingLocation}>
                      Refresh GPS
                    </Button>
                  </div>
                  {coords && (
                    <div style={{ fontSize: '0.78rem', color: 'var(--success)', marginTop: 6 }}>
                      Latitude: <strong>{coords.latitude.toFixed(4)}° N</strong> | Longitude: <strong>{coords.longitude.toFixed(4)}° E</strong> | Accuracy: <strong>{coords.gpsAccuracy}m</strong>
                      {coords.gpsAccuracy <= 100 ? (
                        <span style={{ color: 'var(--success)', fontWeight: 600, marginLeft: 8, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <CheckCircle2 size={12} /> High Precision (&lt; 100m)
                        </span>
                      ) : (
                        <span style={{ color: 'var(--danger)', fontWeight: 600, marginLeft: 8, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <AlertTriangle size={12} /> Degraded Accuracy (&gt; 100m)
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* ---------------------------------------------------- */}
                {/* VIEW 1: STEP 1 - SITE-IN (Arrival at Site) */}
                {/* ---------------------------------------------------- */}
                {punchMode === 'SITE_IN' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {workflowState.siteInDone ? (
                      <div style={{ padding: 14, borderRadius: 10, background: '#f0fdf4', border: '1px solid #bbf7d0', display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, color: '#166534', fontSize: '0.9rem' }}>
                          <CheckCircle2 size={16} /> Site-In Active for this Session
                        </div>
                        <div style={{ fontSize: '0.82rem', color: '#15803d' }}>
                          Verified at <strong>{workflowState.activeSite?.name || 'Project Site'}</strong> on{' '}
                          <strong>{workflowState.siteInTime ? new Date(workflowState.siteInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}</strong>.
                        </div>
                        <Button
                          type="button"
                          variant="primary"
                          icon={ArrowRight}
                          onClick={() => setPunchMode('CHECK_IN')}
                          style={{ alignSelf: 'flex-start', marginTop: 6, fontSize: '0.82rem', padding: '6px 14px' }}
                        >
                          Proceed to Step 2: Check-In
                        </Button>
                      </div>
                    ) : (
                      <>
                        {/* Site Detection & Selection */}
                        <div style={{ padding: 14, borderRadius: 10, background: 'var(--bg-subtle)', border: '1px solid var(--border-color)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                            <span style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: 6 }}>
                              <HardHat size={16} color="var(--primary)" />
                              Select Project / Client Site:
                            </span>
                            <Button size="sm" variant="light" icon={Navigation} onClick={() => detectNearbySites()} loading={detectingSites} style={{ fontSize: '0.74rem' }}>
                              Scan 500m Sites
                            </Button>
                          </div>

                          {detectedSites.length > 0 ? (
                            <div style={{ marginBottom: 10 }}>
                              <select
                                value={selectedCandidateSite?.siteId || selectedCandidateSite?._id || ''}
                                onChange={(e) => {
                                  const site = detectedSites.find((s) => (s.siteId || s._id) === e.target.value);
                                  setSelectedCandidateSite(site);
                                  if (site?.eligibleTasks?.length > 0) setSelectedTaskId(site.eligibleTasks[0]._id);
                                }}
                                style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border-color)', fontSize: '0.86rem' }}
                              >
                                {detectedSites.map((s) => (
                                  <option key={s.siteId || s._id} value={s.siteId || s._id}>
                                    📍 {s.name} ({s.address || '500m nearby'}) - {s.eligibleTasks?.length || 0} task(s)
                                  </option>
                                ))}
                              </select>
                            </div>
                          ) : (
                            <div style={{ marginBottom: 10 }}>
                              <select
                                value={selectedCandidateSite?.siteId || selectedCandidateSite?._id || ''}
                                onChange={(e) => {
                                  let found = null;
                                  projects.forEach((p) => {
                                    const match = p.sites?.find((s) => s._id === e.target.value);
                                    if (match) found = match;
                                  });
                                  setSelectedCandidateSite(found);
                                }}
                                style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border-color)', fontSize: '0.86rem' }}
                              >
                                <option value="">Choose from Registered Project Sites</option>
                                {projects.map((p) =>
                                  p.sites?.map((s) => (
                                    <option key={s._id} value={s._id}>
                                      🏢 {p.name} - {s.name} ({s.address || 'Active Site'})
                                    </option>
                                  ))
                                )}
                              </select>
                              <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: 4 }}>
                                Tip: 0 sites within 500m GPS scan. Select your designated project site from master list.
                              </div>
                            </div>
                          )}

                          {/* Task linking */}
                          {selectedCandidateSite?.eligibleTasks?.length > 0 && (
                            <div>
                              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: 4 }}>
                                Assigned Task Link:
                              </label>
                              <select
                                value={selectedTaskId}
                                onChange={(e) => setSelectedTaskId(e.target.value)}
                                style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border-color)', fontSize: '0.84rem' }}
                              >
                                {selectedCandidateSite.eligibleTasks.map((t) => (
                                  <option key={t._id} value={t._id}>
                                    📋 {t.title} ({t.status || 'ASSIGNED'})
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}
                        </div>

                        {/* Biometric Face Verification Gate */}
                        <div style={{ border: '1px solid var(--border-color)', borderRadius: 10, padding: 14, background: 'var(--bg-subtle)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-main)' }}>
                              <Camera size={16} color="var(--primary)" />
                              Biometric Face Verification Gate (Site-In):
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
                          icon={LogIn}
                          loading={submittingPunch}
                          style={{ padding: '12px', fontSize: '0.94rem', fontWeight: 700 }}
                        >
                          Confirm Biometric Site-In (Step 1)
                        </Button>
                      </>
                    )}
                  </div>
                )}

                {/* ---------------------------------------------------- */}
                {/* VIEW 2: STEP 2 - CHECK-IN (Field Duty Start) */}
                {/* ---------------------------------------------------- */}
                {punchMode === 'CHECK_IN' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {/* STRICT LOCK CHECK: Pehle Site-In karein! */}
                    {!workflowState.siteInDone ? (
                      <div
                        style={{
                          padding: '24px 18px',
                          borderRadius: 12,
                          background: '#fffbeb',
                          border: '1px solid #fde68a',
                          textAlign: 'center',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: 10,
                        }}
                      >
                        <Lock size={34} color="#d97706" />
                        <div style={{ fontWeight: 800, fontSize: '1.05rem', color: '#92400e' }}>
                          Step 2: Check-In is Locked
                        </div>
                        <p style={{ margin: 0, fontSize: '0.86rem', color: '#b45309', maxWidth: 420 }}>
                          Field staff attendance requirement: <strong>Pehle Site-In karein!</strong> Site-In complete hone ke baad hi Check-In unlock hoga.
                        </p>
                        <Button
                          type="button"
                          variant="primary"
                          icon={LogIn}
                          onClick={() => setPunchMode('SITE_IN')}
                          style={{ marginTop: 6, fontWeight: 700 }}
                        >
                          Go to Step 1: Site-In
                        </Button>
                      </div>
                    ) : workflowState.dutyCheckedIn ? (
                      <div style={{ padding: 14, borderRadius: 10, background: '#f0fdf4', border: '1px solid #bbf7d0', display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, color: '#166534', fontSize: '0.9rem' }}>
                          <CheckCircle2 size={16} /> Duty Active (Already Checked-In)
                        </div>
                        <div style={{ fontSize: '0.82rem', color: '#15803d' }}>
                          Punched in at <strong>{workflowState.checkInTime ? new Date(workflowState.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}</strong>. When field work completes, proceed to Check-Out.
                        </div>
                        <Button
                          type="button"
                          variant="warning"
                          icon={ArrowRight}
                          onClick={() => setPunchMode('CHECK_OUT')}
                          style={{ alignSelf: 'flex-start', marginTop: 6, fontSize: '0.82rem', padding: '6px 14px' }}
                        >
                          Proceed to Step 3: Check-Out
                        </Button>
                      </div>
                    ) : (
                      <>
                        <div style={{ padding: '10px 14px', borderRadius: 8, background: '#f0fdf4', border: '1px solid #bbf7d0', fontSize: '0.82rem', color: '#166534', display: 'flex', alignItems: 'center', gap: 6 }}>
                          <CheckCircle2 size={15} />
                          <span>Site-In Verified: <strong>{workflowState.activeSite?.name || 'Project Site'}</strong></span>
                        </div>

                        {/* Biometric Face Verification Gate for Duty Check-in */}
                        <div style={{ border: '1px solid var(--border-color)', borderRadius: 10, padding: 14, background: 'var(--bg-subtle)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-main)' }}>
                              <Camera size={16} color="var(--primary)" />
                              Biometric Face Verification (Duty Check-In):
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
                          Confirm Biometric Field Check-In (Step 2)
                        </Button>
                      </>
                    )}
                  </div>
                )}

                {/* ---------------------------------------------------- */}
                {/* VIEW 3: STEP 3 - CHECK-OUT (Field Duty End) */}
                {/* ---------------------------------------------------- */}
                {punchMode === 'CHECK_OUT' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {!workflowState.dutyCheckedIn ? (
                      <div
                        style={{
                          padding: '24px 18px',
                          borderRadius: 12,
                          background: '#f8fafc',
                          border: '1px solid #cbd5e1',
                          textAlign: 'center',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: 10,
                        }}
                      >
                        <Lock size={34} color="#64748b" />
                        <div style={{ fontWeight: 800, fontSize: '1.05rem', color: '#334155' }}>
                          Step 3: Check-Out is Locked
                        </div>
                        <p style={{ margin: 0, fontSize: '0.86rem', color: '#64748b', maxWidth: 420 }}>
                          Aapne abhi tak duty Check-In nahi kiya hai. Pehle <strong>Step 2: Check-In</strong> complete karein.
                        </p>
                        <Button
                          type="button"
                          variant="primary"
                          icon={CheckCircle2}
                          onClick={() => setPunchMode('CHECK_IN')}
                          style={{ marginTop: 6 }}
                        >
                          Go to Step 2: Check-In
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
                          icon={ArrowRight}
                          onClick={() => setPunchMode('SITE_OUT')}
                          style={{ alignSelf: 'flex-start', marginTop: 6, fontSize: '0.82rem', padding: '6px 14px' }}
                        >
                          Proceed to Step 4: Site-Out
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
                            placeholder="e.g. Completed client audit and territory inspection"
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
                          Confirm Field Check-Out (Step 3)
                        </Button>
                      </>
                    )}
                  </div>
                )}

                {/* ---------------------------------------------------- */}
                {/* VIEW 4: STEP 4 - SITE-OUT (Site Departure & Evidence) */}
                {/* ---------------------------------------------------- */}
                {punchMode === 'SITE_OUT' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {/* STRICT LOCK CHECK: Pehle Check-Out karein! */}
                    {workflowState.dutyCheckedIn && !workflowState.dutyCheckedOut ? (
                      <div
                        style={{
                          padding: '24px 18px',
                          borderRadius: 12,
                          background: '#fef2f2',
                          border: '1px solid #fecaca',
                          textAlign: 'center',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: 10,
                        }}
                      >
                        <Lock size={34} color="#dc2626" />
                        <div style={{ fontWeight: 800, fontSize: '1.05rem', color: '#991b1b' }}>
                          Step 4: Site-Out is Locked
                        </div>
                        <p style={{ margin: 0, fontSize: '0.86rem', color: '#b91c1c', maxWidth: 420 }}>
                          Field staff duty abhi active hai. <strong>Checkout karne ke baad hi Site-Out kar sakte hain!</strong> Pehle Step 3: Check-Out karein.
                        </p>
                        <Button
                          type="button"
                          variant="warning"
                          icon={LogOut}
                          onClick={() => setPunchMode('CHECK_OUT')}
                          style={{ marginTop: 6, fontWeight: 700 }}
                        >
                          Go to Step 3: Check-Out
                        </Button>
                      </div>
                    ) : !workflowState.siteInDone ? (
                      <div
                        style={{
                          padding: '24px 18px',
                          borderRadius: 12,
                          background: '#f8fafc',
                          border: '1px solid #cbd5e1',
                          textAlign: 'center',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: 10,
                        }}
                      >
                        <Lock size={34} color="#64748b" />
                        <div style={{ fontWeight: 800, fontSize: '1.05rem', color: '#334155' }}>
                          Site-Out Unavailable
                        </div>
                        <p style={{ margin: 0, fontSize: '0.86rem', color: '#64748b', maxWidth: 420 }}>
                          Aapne abhi tak <strong>Site-In</strong> nahi kiya hai. Pehle Step 1: Site-In complete karein.
                        </p>
                        <Button
                          type="button"
                          variant="primary"
                          icon={LogIn}
                          onClick={() => setPunchMode('SITE_IN')}
                          style={{ marginTop: 6 }}
                        >
                          Go to Step 1: Site-In
                        </Button>
                      </div>
                    ) : workflowState.siteOutDone ? (
                      <div style={{ padding: 14, borderRadius: 10, background: '#f0fdf4', border: '1px solid #bbf7d0', display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, color: '#166534', fontSize: '0.9rem' }}>
                          <CheckCircle2 size={16} /> Site Visit Concluded (Site-Out Completed)
                        </div>
                        <div style={{ fontSize: '0.82rem', color: '#15803d' }}>
                          Site-Out recorded at <strong>{workflowState.siteOutTime ? new Date(workflowState.siteOutTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}</strong>.
                        </div>
                        <Button
                          type="button"
                          variant="primary"
                          icon={RotateCcw}
                          onClick={handleStartNextVisit}
                          style={{ alignSelf: 'flex-start', marginTop: 6, fontSize: '0.82rem', padding: '6px 14px' }}
                        >
                          Start Next Site Visit
                        </Button>
                      </div>
                    ) : (
                      <>
                        <div style={{ padding: '10px 14px', borderRadius: 8, background: '#f0fdf4', border: '1px solid #bbf7d0', fontSize: '0.82rem', color: '#166534', display: 'flex', alignItems: 'center', gap: 6 }}>
                          <CheckCircle2 size={15} />
                          <span>Duty Check-Out Verified. Ready for Site Departure Evidence.</span>
                        </div>

                        {/* Exit Photo Evidence */}
                        <div style={{ border: '1px solid var(--border-color)', borderRadius: 10, padding: 14, background: 'var(--bg-subtle)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-main)' }}>
                              <ImageIcon size={16} color="var(--primary)" />
                              Mandatory Exit Photograph (Site Evidence):
                            </div>
                            {!cameraActive && !capturedPhoto && (
                              <Button size="sm" variant="primary" icon={Camera} onClick={startCamera}>
                                Take Photo
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
                                  Capture Exit Photo
                                </Button>
                                <Button size="sm" variant="light" icon={X} onClick={stopCamera}>
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          )}

                          {capturedPhoto && (
                            <div style={{ textAlign: 'center', marginBottom: 10 }}>
                              <img
                                src={capturedPhoto}
                                alt="Exit Photo"
                                style={{ width: 130, height: 130, objectFit: 'cover', borderRadius: 8, border: '2px solid var(--success)' }}
                              />
                              <div style={{ fontSize: '0.76rem', color: 'var(--success)', fontWeight: 600, marginTop: 4, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                <CheckCircle2 size={13} />
                                <span>Exit Photo Attached</span>
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
                                Retake
                              </Button>
                            </div>
                          )}

                          {/* Secondary URL photo upload */}
                          <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                            <input
                              type="text"
                              placeholder="Or paste image URL (Cloudinary / CDN)..."
                              value={siteOutPhotoUrl}
                              onChange={(e) => setSiteOutPhotoUrl(e.target.value)}
                              style={{ flex: 1, padding: '6px 10px', fontSize: '0.82rem', borderRadius: 6, border: '1px solid var(--border-color)' }}
                            />
                            <Button size="sm" variant="light" onClick={addSiteOutPhoto}>
                              Add URL
                            </Button>
                          </div>

                          {siteOutPhotos.length > 0 && (
                            <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                              {siteOutPhotos.map((url, idx) => (
                                <div key={idx} style={{ position: 'relative' }}>
                                  <img src={url} alt="Site" style={{ width: 48, height: 48, borderRadius: 6, objectFit: 'cover', border: '1px solid #cbd5e1' }} />
                                  <button
                                    type="button"
                                    onClick={() => removeSiteOutPhoto(idx)}
                                    style={{
                                      position: 'absolute',
                                      top: -5,
                                      right: -5,
                                      background: '#dc2626',
                                      color: '#fff',
                                      border: 'none',
                                      borderRadius: '50%',
                                      width: 16,
                                      height: 16,
                                      fontSize: '0.65rem',
                                      cursor: 'pointer',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                    }}
                                  >
                                    ×
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Exit Remarks */}
                        <div>
                          <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: 4 }}>
                            Site Exit & Handover Remarks *:
                          </label>
                          <textarea
                            rows={3}
                            value={siteOutRemarks}
                            onChange={(e) => setSiteOutRemarks(e.target.value)}
                            placeholder="e.g. Completed site inspection, client sign-off obtained, departed site"
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

                        {/* Task Completed checkbox */}
                        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.84rem', cursor: 'pointer', userSelect: 'none' }}>
                          <input
                            type="checkbox"
                            checked={taskCompleted}
                            onChange={(e) => setTaskCompleted(e.target.checked)}
                            style={{ width: 16, height: 16, accentColor: 'var(--primary)' }}
                          />
                          <span style={{ fontWeight: 600 }}>Mark associated site task as completed upon exit</span>
                        </label>

                        <Button
                          type="submit"
                          variant="primary"
                          icon={Navigation}
                          loading={submittingPunch}
                          style={{ padding: '12px', fontSize: '0.94rem', fontWeight: 700 }}
                        >
                          Confirm Site-Out Exit (Step 4)
                        </Button>
                      </>
                    )}
                  </div>
                )}

                {/* ---------------------------------------------------- */}
                {/* VIEW 5: COMPLETED VISIT */}
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
                      Site Visit Cycle Finished!
                    </div>
                    <p style={{ margin: 0, fontSize: '0.86rem', color: '#047857', maxWidth: 440 }}>
                      Aapne Site-In, Check-In, Check-Out aur Site-Out chaaron steps successfully complete kar liye hain.
                    </p>
                    <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                      <Button variant="primary" icon={RotateCcw} onClick={handleStartNextVisit}>
                        Start Next Site Visit
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
                    {punchResult.mode === 'SITE_IN'
                      ? 'Step 1: Site-In Confirmed'
                      : punchResult.mode === 'CHECK_IN'
                      ? 'Step 2: Field Check-In Confirmed'
                      : punchResult.mode === 'CHECK_OUT'
                      ? 'Step 3: Field Check-Out Confirmed'
                      : 'Step 4: Site-Out Exit Confirmed'}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: '0.85rem' }}>
                    <div>Attendance ID: <strong>{punchResult.data?.attendanceId || punchResult.data?._id || 'REC-' + Math.floor(100000 + Math.random() * 900000)}</strong></div>
                    <div>Timestamp: <strong>{new Date().toLocaleTimeString()}</strong></div>
                    <div>
                      Coordinates: <strong>{coords?.latitude?.toFixed(4)}° N, {coords?.longitude?.toFixed(4)}° E</strong>
                    </div>

                    {punchResult.mode === 'SITE_IN' && (
                      <div style={{ marginTop: 8, padding: 10, background: '#ffffff', borderRadius: 8, border: '1px solid var(--success-border)' }}>
                        <div>Site: <strong>{punchResult.site?.name || 'Project Site'}</strong></div>
                        <div>Task: <strong>{punchResult.site?.taskTitle || 'Field Work'}</strong></div>
                        <div style={{ color: 'var(--primary)', fontWeight: 600, marginTop: 4 }}>
                          ➔ Next Step: Proceed to Step 2: Check-In
                        </div>
                      </div>
                    )}

                    {punchResult.mode === 'CHECK_IN' && (
                      <div style={{ marginTop: 8, padding: 10, background: '#ffffff', borderRadius: 8, border: '1px solid var(--success-border)' }}>
                        <div>Duty Status: <Badge variant="primary">ACTIVE ON DUTY</Badge></div>
                        <div>Required Working Hours: <strong>{punchResult.data?.requiredWorkingHours ?? 8} hrs</strong></div>
                        <div style={{ color: 'var(--primary)', fontWeight: 600, marginTop: 4 }}>
                          ➔ Next Step: Field duty active. When visit completes, punch Check-Out.
                        </div>
                      </div>
                    )}

                    {punchResult.mode === 'CHECK_OUT' && (
                      <div style={{ marginTop: 8, padding: 10, background: '#ffffff', borderRadius: 8, border: '1px solid var(--success-border)' }}>
                        <div>Total Hours Worked: <strong>{punchResult.data?.totalWorkingHours ?? workflowState.workHours} hrs</strong></div>
                        <div>Shortfall: <strong style={{ color: punchResult.data?.shortfallHours > 0 ? 'var(--danger)' : 'var(--success)' }}>{punchResult.data?.shortfallHours ?? 0} hrs</strong></div>
                        <div>Overtime: <strong style={{ color: 'var(--success)' }}>+{punchResult.data?.overtimeHours ?? 0} hrs</strong></div>
                        <div>Final Status: <Badge variant={punchResult.data?.attendanceStatus === 'SHORTFALL' ? 'warning' : 'success'}>{punchResult.data?.attendanceStatus || 'PRESENT'}</Badge></div>
                        <div style={{ color: '#7c3aed', fontWeight: 600, marginTop: 4 }}>
                          ➔ Next Step: Proceed to Step 4: Site-Out to exit site.
                        </div>
                      </div>
                    )}

                    {punchResult.mode === 'SITE_OUT' && (
                      <div style={{ marginTop: 8, padding: 10, background: '#ffffff', borderRadius: 8, border: '1px solid var(--success-border)' }}>
                        <div>Exit Status: <Badge variant="success">VISIT CONCLUDED</Badge></div>
                        <div>Photos Uploaded: <strong>{punchResult.data?.photos?.length || 1} photo(s)</strong></div>
                        <div style={{ color: 'var(--success)', fontWeight: 600, marginTop: 4 }}>
                          ✓ Full lifecycle complete (Site-In ➔ Check-In ➔ Check-Out ➔ Site-Out).
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
                    Follow the 4-step sequence: Start with Site-In, then Check-In, then Check-Out, and conclude with Site-Out.
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
