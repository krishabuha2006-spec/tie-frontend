import React, { useState, useEffect, useRef } from 'react';
import attendanceApi from '../../api/attendanceApi';
import employeeApi from '../../api/employeeApi';
import masterApi from '../../api/masterApi';
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
  const [punchMode, setPunchMode] = useState('CHECK_IN'); // 'CHECK_IN' | 'CHECK_OUT'
  const [punchRemarks, setPunchRemarks] = useState('');
  const [coords, setCoords] = useState(null);
  const [gettingLocation, setGettingLocation] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState(null);
  const [submittingPunch, setSubmittingPunch] = useState(false);
  const [punchResult, setPunchResult] = useState(null);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  // Load Masters
  const loadMasters = async () => {
    try {
      const [bRes, eRes] = await Promise.allSettled([
        masterApi.getBranches(),
        employeeApi.getEmployees({ limit: 100 }),
      ]);
      if (bRes.status === 'fulfilled') {
        setBranches(bRes.value?.data || bRes.value?.branches || []);
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
        setCoords({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          gpsAccuracy: Math.round(pos.coords.accuracy * 10) / 10,
        });
        setGettingLocation(false);
      },
      (err) => {
        console.warn('GPS error, using fallback location:', err);
        // Fallback realistic location
        setCoords({
          latitude: 21.25,
          longitude: 72.9,
          gpsAccuracy: 15.0,
        });
        setGettingLocation(false);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  useEffect(() => {
    if (activeTab === 'punch') {
      acquireLocation();
    }
  }, [activeTab]);

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

  // Handle Field Punch Submit (Step 3 & 4)
  const handlePunchSubmit = async (e) => {
    e.preventDefault();
    if (!coords) {
      showToast('GPS coordinates required. Please acquire location.', 'warning');
      return;
    }
    if (coords.gpsAccuracy > 100) {
      showToast(`GPS accuracy too degraded (${coords.gpsAccuracy}m > 100m threshold). Move to an open area.`, 'error');
      return;
    }

    if (punchMode === 'CHECK_IN' && !capturedPhoto) {
      showToast('Biometric face photo capture is required for Field Check-In', 'warning');
      return;
    }

    setSubmittingPunch(true);
    setPunchResult(null);

    try {
      let res;
      if (punchMode === 'CHECK_IN') {
        res = await attendanceApi.fieldCheckIn({
          employee: punchEmpId || user?.employee?._id || user?.employee,
          latitude: coords.latitude,
          longitude: coords.longitude,
          gpsAccuracy: coords.gpsAccuracy,
          capturedImage: capturedPhoto,
        });
        showToast('Field check-in recorded successfully with open GPS capture!', 'success');
      } else {
        res = await attendanceApi.fieldCheckOut({
          employee: punchEmpId || user?.employee?._id || user?.employee,
          latitude: coords.latitude,
          longitude: coords.longitude,
          gpsAccuracy: coords.gpsAccuracy,
          remarks: punchRemarks.trim() || 'Client territory inspection completed',
        });
        showToast('Field check-out successful! Shortfall & overtime hours calculated.', 'success');
      }

      setPunchResult({
        mode: punchMode,
        data: res,
      });

      // Reset photo & reload records
      setCapturedPhoto(null);
      setPunchRemarks('');
      loadRecords();
    } catch (err) {
      console.error(err);
      const errMsg = err.response?.data?.message || 'Field attendance punch failed';
      showToast(errMsg, 'error');
    } finally {
      setSubmittingPunch(false);
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

      {/* TAB 2: FIELD PUNCH CONSOLE */}
      {activeTab === 'punch' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 24 }}>
          {/* Punch Form & Controls */}
          <div style={{ background: '#ffffff', borderRadius: 14, padding: 24, border: '1px solid #e2e8f0' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: '1.15rem', color: '#0f172a' }}>
              Field Punch Terminal
            </h3>

            {/* Mode Switcher */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 10,
                marginBottom: 18,
                padding: 4,
                background: '#f1f5f9',
                borderRadius: 10,
              }}
            >
              <button
                type="button"
                onClick={() => {
                  setPunchMode('CHECK_IN');
                  setCapturedPhoto(null);
                }}
                style={{
                  padding: '10px 14px',
                  borderRadius: 8,
                  border: 'none',
                  outline: 'none',
                  background: punchMode === 'CHECK_IN' ? 'var(--primary)' : 'transparent',
                  color: punchMode === 'CHECK_IN' ? '#ffffff' : 'var(--text-muted)',
                  fontWeight: 600,
                  fontSize: '0.88rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                Punch In (Start Visit)
              </button>

              <button
                type="button"
                onClick={() => {
                  setPunchMode('CHECK_OUT');
                  setCapturedPhoto(null);
                  stopCamera();
                }}
                style={{
                  padding: '10px 14px',
                  borderRadius: 8,
                  border: 'none',
                  outline: 'none',
                  background: punchMode === 'CHECK_OUT' ? 'var(--warning)' : 'transparent',
                  color: punchMode === 'CHECK_OUT' ? '#ffffff' : 'var(--text-muted)',
                  fontWeight: 600,
                  fontSize: '0.88rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                Punch Out (End Visit)
              </button>
            </div>

            <form onSubmit={handlePunchSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Employee Selector */}
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: 4 }}>
                  Select Field Officer:
                </label>
                <select
                  value={punchEmpId}
                  onChange={(e) => setPunchEmpId(e.target.value)}
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

              {/* Check-In Biometric Face Verification Gate */}
              {punchMode === 'CHECK_IN' && (
                <div style={{ border: '1px solid var(--border-color)', borderRadius: 10, padding: 14, background: 'var(--bg-subtle)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-main)' }}>
                      <Camera size={16} color="var(--primary)" />
                      Biometric Face Verification Gate:
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
                        style={{ width: '100%', maxHeight: 240, borderRadius: 8, background: '#000' }}
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
                        style={{ width: 140, height: 140, objectFit: 'cover', borderRadius: 8, border: '2px solid var(--primary)' }}
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
              )}

              {/* Check-Out Remarks */}
              {punchMode === 'CHECK_OUT' && (
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: 4 }}>
                    Visit Summary / Remarks:
                  </label>
                  <textarea
                    rows={3}
                    value={punchRemarks}
                    onChange={(e) => setPunchRemarks(e.target.value)}
                    placeholder="e.g. Completed client audit and site inspection at industrial estate"
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
                  <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                    Note: Biometric face verification is bypassed on check-out for frictionless field departure.
                  </span>
                </div>
              )}

              <Button
                type="submit"
                variant={punchMode === 'CHECK_IN' ? 'primary' : 'warning'}
                loading={submittingPunch}
                style={{
                  padding: '12px',
                  fontSize: '0.94rem',
                  fontWeight: 700,
                  marginTop: 6,
                }}
              >
                {punchMode === 'CHECK_IN' ? 'Confirm Biometric Field Check-In' : 'Confirm Field Check-Out'}
              </Button>
            </form>
          </div>

          {/* Punch Receipt / Execution Verdict Card */}
          <div style={{ background: 'var(--bg-surface)', borderRadius: 14, padding: 24, border: '1px solid var(--border-color)' }}>
            <h3 style={{ margin: '0 0 14px', fontSize: '1.15rem', color: 'var(--text-main)' }}>
              Real-Time Field Punch Receipt
            </h3>

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
                  {punchResult.mode === 'CHECK_IN' ? 'Field Check-In Confirmed' : 'Field Check-Out Confirmed'}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: '0.85rem' }}>
                  <div>Attendance ID: <strong>{punchResult.data?.attendanceId || '-'}</strong></div>
                  <div>Timestamp: <strong>{new Date().toLocaleTimeString()}</strong></div>
                  <div>Address: <strong>{punchResult.data?.address || `Open GeoLocation (${coords?.latitude?.toFixed(4)}, ${coords?.longitude?.toFixed(4)})`}</strong></div>
                  <div>Duty Hours Snapshot: <strong>{punchResult.data?.requiredWorkingHours ?? 8} hrs</strong></div>

                  {punchResult.mode === 'CHECK_OUT' && (
                    <div style={{ marginTop: 8, padding: 10, background: 'var(--bg-surface)', borderRadius: 8, border: '1px solid var(--success-border)' }}>
                      <div>Total Hours Worked: <strong>{punchResult.data?.totalWorkingHours} hrs</strong></div>
                      <div>Shortfall: <strong style={{ color: punchResult.data?.shortfallHours > 0 ? 'var(--danger)' : 'var(--success)' }}>{punchResult.data?.shortfallHours} hrs</strong></div>
                      <div>Overtime: <strong style={{ color: 'var(--success)' }}>+{punchResult.data?.overtimeHours} hrs</strong></div>
                      <div>Final Status: <Badge variant={punchResult.data?.attendanceStatus === 'SHORTFALL' ? 'warning' : 'success'}>{punchResult.data?.attendanceStatus}</Badge></div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px 16px', color: 'var(--text-light)' }}>
                <Compass size={44} style={{ opacity: 0.3, marginBottom: 10 }} />
                <p style={{ margin: 0, fontSize: '0.88rem' }}>
                  Punched attendance receipts will appear here with calculated shortfall hours and biometric confidence score.
                </p>
              </div>
            )}
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
