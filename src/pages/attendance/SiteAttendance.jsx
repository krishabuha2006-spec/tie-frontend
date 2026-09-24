import React, { useState, useEffect, useRef } from 'react';
import attendanceApi from '../../api/attendanceApi';
import projectTaskApi from '../../api/projectTaskApi';
import employeeApi from '../../api/employeeApi';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import {
  HardHat,
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
  MapPin,
  FolderKanban,
  FileCheck,
  Image as ImageIcon,
  ExternalLink,
} from 'lucide-react';
import Table from '../../components/common/Table';
import Modal from '../../components/common/Modal';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import Select from '../../components/common/Select';
import Badge from '../../components/common/Badge';
import ModuleSubNav from '../../components/common/ModuleSubNav';
import { attendanceNav } from '../../routes/moduleNavConfig';

export const SiteAttendance = () => {
  const { isSuperAdmin, isHrAdmin, user } = useAuth();
  const { showToast } = useToast();
  const canCorrect = isSuperAdmin || isHrAdmin;

  // Active Tab
  const [activeTab, setActiveTab] = useState('records'); // 'records' | 'punch' | 'my_history' | 'history'

  // Org-wide site records
  const [records, setRecords] = useState([]);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [filters, setFilters] = useState({
    date: new Date().toISOString().split('T')[0],
    project: '',
    site: '',
    taskStatus: '',
    isOpen: '',
  });

  // Masters
  const [projects, setProjects] = useState([]);
  const [employees, setEmployees] = useState([]);

  const getEmpName = (emp) =>
    emp?.basicInfo?.fullName ||
    emp?.fullName ||
    (emp?.firstName ? `${emp.firstName} ${emp.lastName || ''}`.trim() : '') ||
    emp?.name ||
    'Engineer';

  const getEmpCode = (emp) =>
    emp?.basicInfo?.employeeCode || emp?.employeeCode || '-';

  const getAddressStr = (addr, fallback = 'Site Area') => {
    if (!addr) return fallback;
    if (typeof addr === 'string') return addr;
    if (typeof addr === 'object') {
      const parts = [addr.street, addr.city, addr.state].filter(Boolean);
      return parts.length > 0 ? parts.join(', ') : (addr.city || fallback);
    }
    return fallback;
  };

  // Photos & Evidence Viewer Modal
  const [evidenceModalOpen, setEvidenceModalOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);

  // Step 8: Admin Correction Modal
  const [correctModalOpen, setCorrectModalOpen] = useState(false);
  const [correctForm, setCorrectForm] = useState({
    siteInTime: '',
    siteOutTime: '',
    taskStatus: 'COMPLETED',
    correctionRemark: '',
  });
  const [submittingCorrect, setSubmittingCorrect] = useState(false);

  // My Site History (GET /attendance/site/me)
  const [myHistory, setMyHistory] = useState([]);
  const [loadingMyHistory, setLoadingMyHistory] = useState(false);

  // Employee history tab (GET /attendance/site/employees/:id)
  const [selectedEmpId, setSelectedEmpId] = useState('');
  const [employeeHistory, setEmployeeHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // --- Step 4, 5, 6: Site Punch Station States ---
  const [coords, setCoords] = useState({ latitude: 21.1705, longitude: 72.8315, gpsAccuracy: 12.5 });
  const [detectingSites, setDetectingSites] = useState(false);
  const [detectedSites, setDetectedSites] = useState([]);
  const [selectedCandidateSite, setSelectedCandidateSite] = useState(null);
  const [selectedTaskId, setSelectedTaskId] = useState('');

  // Camera & Face Verification for Check-In
  const [cameraActive, setCameraActive] = useState(false);
  const [capturedFaceImage, setCapturedFaceImage] = useState(null);
  const [submittingCheckIn, setSubmittingCheckIn] = useState(false);

  // Check-Out State (Mandatory Photos & Remarks)
  const [siteOutRemarks, setSiteOutRemarks] = useState('');
  const [siteOutPhotoUrl, setSiteOutPhotoUrl] = useState('');
  const [attachedPhotos, setAttachedPhotos] = useState([]);
  const [taskCompleted, setTaskCompleted] = useState(true);
  const [submittingCheckOut, setSubmittingCheckOut] = useState(false);

  // Punch Result Receipt
  const [punchReceipt, setPunchReceipt] = useState(null);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  // Load Masters
  const loadMasters = async () => {
    try {
      const [pRes, eRes] = await Promise.allSettled([
        projectTaskApi.getProjects(),
        employeeApi.getEmployees({ limit: 100 }),
      ]);
      if (pRes.status === 'fulfilled') {
        setProjects(pRes.value?.projects || pRes.value?.data || []);
      }
      if (eRes.status === 'fulfilled') {
        const list = eRes.value?.data || eRes.value?.employees || [];
        setEmployees(list);
        if (list.length > 0) {
          const defaultEmp = user?.employee?._id || user?.employee || list[0]._id;
          setSelectedEmpId(defaultEmp);
        }
      }
    } catch (e) {
      console.error('Failed to load projects/employees masters', e);
    }
  };

  // Load Org-Wide Site Records
  const loadRecords = async () => {
    setLoadingRecords(true);
    try {
      const params = {};
      if (filters.date) params.date = filters.date;
      if (filters.project) params.project = filters.project;
      if (filters.site) params.site = filters.site;
      if (filters.taskStatus) params.taskStatus = filters.taskStatus;
      if (filters.isOpen !== '') params.isOpen = filters.isOpen === 'true';

      const res = await attendanceApi.getAllSiteAttendance(params);
      const list = Array.isArray(res) ? res : (Array.isArray(res?.records) ? res.records : (Array.isArray(res?.data) ? res.data : []));
      setRecords(list);
    } catch (err) {
      console.error(err);
      showToast('Failed to load site attendance records', 'error');
    } finally {
      setLoadingRecords(false);
    }
  };

  // Load Employee Site History (Step 7 - GET /attendance/site/employees/:id)
  const loadEmployeeHistory = async (empId) => {
    if (!empId) return;
    setLoadingHistory(true);
    try {
      const res = await attendanceApi.getEmployeeSiteAttendance(empId);
      const list = Array.isArray(res) ? res : (Array.isArray(res?.records) ? res.records : (Array.isArray(res?.data) ? res.data : []));
      setEmployeeHistory(list);
    } catch (err) {
      console.error(err);
      showToast('Failed to load employee site history', 'error');
    } finally {
      setLoadingHistory(false);
    }
  };

  // Load Own Site History (Step 7 - GET /attendance/site/me)
  const loadMyHistory = async () => {
    setLoadingMyHistory(true);
    try {
      const res = await attendanceApi.getMySiteAttendance();
      const list = Array.isArray(res) ? res : (Array.isArray(res?.records) ? res.records : (Array.isArray(res?.data) ? res.data : []));
      setMyHistory(list);
    } catch (err) {
      console.error(err);
      showToast('Failed to load your personal site history', 'error');
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
    } else if (activeTab === 'history' && selectedEmpId) {
      loadEmployeeHistory(selectedEmpId);
    }
  }, [activeTab, filters, selectedEmpId]);

  // GPS Acquisition
  const acquireLocation = () => {
    if (!navigator.geolocation) {
      showToast('Geolocation is not supported by your browser', 'error');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          gpsAccuracy: Math.round(pos.coords.accuracy * 10) / 10,
        });
      },
      (err) => {
        console.warn('GPS error, using default site location:', err);
        setCoords({
          latitude: 21.1705,
          longitude: 72.8315,
          gpsAccuracy: 12.5,
        });
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  // Step 4: Detect Nearby Sites (500m GeoFence)
  const handleDetectSites = async () => {
    setDetectingSites(true);
    setDetectedSites([]);
    setSelectedCandidateSite(null);
    setSelectedTaskId('');
    try {
      const res = await attendanceApi.detectSites({
        latitude: coords.latitude,
        longitude: coords.longitude,
        gpsAccuracy: coords.gpsAccuracy,
      });

      const sitesList =
        res?.candidateSites ||
        res?.sites ||
        res?.data?.candidateSites ||
        res?.data?.sites ||
        (Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []));
      setDetectedSites(sitesList);

      if (sitesList.length > 0) {
        setSelectedCandidateSite(sitesList[0]);
        const tasks = sitesList[0].eligibleTasks || sitesList[0].assignedTasks || [];
        if (tasks.length > 0) {
          setSelectedTaskId(tasks[0]._id || tasks[0].id);
        }
        showToast(`Detected ${sitesList.length} candidate project site(s) within 500m!`, 'success');
      } else {
        showToast('No active project sites detected within 500m of your position.', 'warning');
      }
    } catch (err) {
      console.error(err);
      showToast(err.response?.data?.message || 'Site detection failed. Ensure you are within 500m.', 'error');
    } finally {
      setDetectingSites(false);
    }
  };

  // Camera Management
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
      console.error('Camera error:', err);
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
    setCapturedFaceImage(dataUrl);
    stopCamera();
  };

  // Step 5: Site Check-In Submit
  const handleSiteCheckIn = async (e) => {
    e.preventDefault();
    if (!selectedCandidateSite) {
      showToast('Please detect and select a project site first', 'warning');
      return;
    }
    if (!selectedTaskId) {
      showToast('Mandatory Task Linking: Select an assigned task for this site', 'warning');
      return;
    }
    if (!capturedFaceImage) {
      showToast('Biometric face capture is required for Site Check-In', 'warning');
      return;
    }

    setSubmittingCheckIn(true);
    try {
      const formattedAddress = getAddressStr(
        selectedCandidateSite.address,
        selectedCandidateSite.siteName || selectedCandidateSite.name || 'Project Site'
      );

      const res = await attendanceApi.siteCheckIn({
        employee: selectedEmpId || user?.employee?._id || user?.employee,
        latitude: coords.latitude,
        longitude: coords.longitude,
        gpsAccuracy: coords.gpsAccuracy,
        capturedImage: capturedFaceImage,
        selectedSiteId: selectedCandidateSite.siteId || selectedCandidateSite._id,
        taskId: selectedTaskId,
        address: formattedAddress,
        siteInAddress: formattedAddress,
      });

      showToast('Site check-in verified and recorded successfully!', 'success');
      setPunchReceipt({
        mode: 'CHECK_IN',
        data: res,
      });
      setCapturedFaceImage(null);
      loadRecords();
    } catch (err) {
      console.error(err);
      showToast(err.response?.data?.message || 'Site check-in rejected', 'error');
    } finally {
      setSubmittingCheckIn(false);
    }
  };

  // Add Photo URL to Check-Out Evidence
  const addPhotoUrl = () => {
    if (!siteOutPhotoUrl.trim()) return;
    setAttachedPhotos((prev) => [...prev, siteOutPhotoUrl.trim()]);
    setSiteOutPhotoUrl('');
  };

  const removePhotoUrl = (idx) => {
    setAttachedPhotos((prev) => prev.filter((_, i) => i !== idx));
  };

  // Step 6: Site Check-Out Submit
  const handleSiteCheckOut = async (e) => {
    e.preventDefault();
    if (attachedPhotos.length === 0) {
      showToast('Mandatory: At least 1 site photograph is required for Site-Out exit', 'warning');
      return;
    }
    if (!siteOutRemarks.trim()) {
      showToast('Mandatory: Activity remarks are required for Site-Out exit', 'warning');
      return;
    }

    setSubmittingCheckOut(true);
    try {
      const res = await attendanceApi.siteCheckOut({
        employee: selectedEmpId || user?.employee?._id || user?.employee,
        latitude: coords.latitude,
        longitude: coords.longitude,
        gpsAccuracy: coords.gpsAccuracy,
        photos: attachedPhotos,
        remarks: siteOutRemarks.trim(),
        taskCompleted,
      });

      showToast('Site check-out submitted successfully! Total site hours computed.', 'success');
      setPunchReceipt({
        mode: 'CHECK_OUT',
        data: res,
      });
      setAttachedPhotos([]);
      setSiteOutRemarks('');
      loadRecords();
    } catch (err) {
      console.error(err);
      showToast(err.response?.data?.message || 'Site check-out failed', 'error');
    } finally {
      setSubmittingCheckOut(false);
    }
  };

  // Step 8: Admin Correction Modal Open
  const openCorrectModal = (rec) => {
    setSelectedRecord(rec);
    setCorrectForm({
      siteInTime: rec.siteInTime ? new Date(rec.siteInTime).toISOString().slice(0, 16) : '',
      siteOutTime: rec.siteOutTime ? new Date(rec.siteOutTime).toISOString().slice(0, 16) : '',
      taskStatus: rec.taskStatus || 'COMPLETED',
      correctionRemark: 'Adjusted check-in time per supervisor manual sign-off sheet',
    });
    setCorrectModalOpen(true);
  };

  // Step 8: Admin Correction Submit
  const handleCorrectSubmit = async (e) => {
    e.preventDefault();
    if (!selectedRecord) return;
    if (!correctForm.correctionRemark.trim()) {
      showToast('Mandatory audit correction remark required', 'warning');
      return;
    }

    setSubmittingCorrect(true);
    try {
      await attendanceApi.correctSiteAttendance(selectedRecord._id, {
        siteInTime: new Date(correctForm.siteInTime).toISOString(),
        siteOutTime: new Date(correctForm.siteOutTime).toISOString(),
        taskStatus: correctForm.taskStatus,
        correctionRemark: correctForm.correctionRemark.trim(),
      });
      showToast('Site attendance record corrected successfully', 'success');
      setCorrectModalOpen(false);
      loadRecords();
      if (selectedEmpId) loadEmployeeHistory(selectedEmpId);
    } catch (err) {
      console.error(err);
      showToast(err.response?.data?.message || 'Failed to correct site record', 'error');
    } finally {
      setSubmittingCorrect(false);
    }
  };

  // Table Columns
  const recordColumns = [
    {
      header: 'Site Engineer / Staff',
      key: 'employee',
      render: (r) => {
        const emp = r.employee;
        let name = getEmpName(emp);
        if ((!name || name === 'Engineer') && r.correctedBy?.name) {
          name = r.correctedBy.name;
        }
        const code = getEmpCode(emp) !== '-' ? getEmpCode(emp) : (r.correctedBy ? 'EMP' : '-');
        return (
          <div>
            <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{name}</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Code: {code}</div>
          </div>
        );
      },
    },
    {
      header: 'Project & Site Location',
      key: 'project',
      render: (r) => (
        <div style={{ fontSize: '0.85rem' }}>
          <div style={{ fontWeight: 600, color: '#0f172a' }}>
            {r.project?.name || 'Project'}
          </div>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>
            Site: <strong style={{ color: '#0284c7' }}>{r.site?.name || r.site?.code || 'Site Yard'}</strong>
          </div>
        </div>
      ),
    },
    {
      header: 'Assigned Task Link',
      key: 'assignedTask',
      render: (r) => (
        <div style={{ fontSize: '0.84rem' }}>
          <div style={{ fontWeight: 600 }}>{r.assignedTask?.title || r.assignedTask?.taskName || 'Site Inspection'}</div>
          <Badge variant={r.taskStatus === 'COMPLETED' ? 'success' : 'warning'}>
            Task: {r.taskStatus || 'IN_PROGRESS'}
          </Badge>
        </div>
      ),
    },
    {
      header: 'Site Timestamps',
      key: 'siteInTime',
      render: (r) => {
        const inTime = r.siteInTime ? new Date(r.siteInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-';
        const outTime = r.siteOutTime ? new Date(r.siteOutTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : r.isOpen ? 'Active On Site' : '-';
        return (
          <div style={{ fontSize: '0.84rem' }}>
            <div>In: <strong>{inTime}</strong> | Out: <strong>{outTime}</strong></div>
            <div style={{ color: '#059669', fontWeight: 600, fontSize: '0.78rem' }}>
              Total: {r.totalSiteHours ? `${r.totalSiteHours.toFixed(1)} hrs` : '-'}
            </div>
          </div>
        );
      },
    },
    {
      header: 'Exit Evidence',
      key: 'photos',
      render: (r) => {
        const photoCount = r.photos?.length || 0;
        return (
          <div style={{ fontSize: '0.8rem' }}>
            <Button
              size="sm"
              variant="light"
              icon={ImageIcon}
              onClick={() => {
                setSelectedRecord(r);
                setEvidenceModalOpen(true);
              }}
              style={{ fontSize: '0.75rem', padding: '2px 8px' }}
            >
              {photoCount} {photoCount === 1 ? 'Photo' : 'Photos'}
            </Button>
            {r.remarks && (
              <div style={{ color: 'var(--text-muted)', fontSize: '0.74rem', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2 }}>
                {r.remarks}
              </div>
            )}
          </div>
        );
      },
    },
    {
      header: 'Status',
      key: 'isOpen',
      render: (r) => (
        <Badge variant={r.isOpen ? 'info' : 'success'}>
          {r.isOpen ? 'Active on Site' : 'Completed'}
        </Badge>
      ),
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
              title="Manual Administrative Time Correction (Step 8)"
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
          background: '#ffffff',
          borderRadius: 16,
          padding: '24px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
          marginBottom: '24px',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: 'linear-gradient(135deg, #d97706 0%, #b45309 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
                boxShadow: '0 4px 10px rgba(217, 119, 6, 0.25)',
              }}
            >
              <HardHat size={24} />
            </div>
            <div>
              <h1 style={{ fontSize: '1.45rem', fontWeight: 700, margin: 0, color: '#0f172a' }}>
                Module 9: Site Attendance Management
              </h1>
              <p style={{ margin: '4px 0 0', fontSize: '0.88rem', color: '#64748b' }}>
                500m Multi-Site GeoFence Detection, Biometric Face Check-In Gate, Mandatory Task Linking, and Site-Out Photo/Remark Evidence.
              </p>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <Button
            variant="primary"
            icon={HardHat}
            onClick={() => setActiveTab('punch')}
            style={{ background: '#d97706', borderColor: '#d97706' }}
          >
            Site Punch Terminal
          </Button>
          <Button
            variant="light"
            icon={RotateCcw}
            onClick={() => {
              loadRecords();
              if (selectedEmpId) loadEmployeeHistory(selectedEmpId);
            }}
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
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
            background: '#ffffff',
            borderRadius: 14,
            padding: '18px 20px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#64748b' }}>500M SITE DETECTION</span>
            <MapPin size={18} color="#d97706" />
          </div>
          <div style={{ fontSize: '1.35rem', fontWeight: 700, color: '#0f172a' }}>
            500m GeoFence
          </div>
          <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: 4 }}>
            Detects candidate project sites and filters worker's assigned tasks
          </div>
        </div>

        <div
          style={{
            background: '#ffffff',
            borderRadius: 14,
            padding: '18px 20px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#64748b' }}>BIOMETRIC FACE GATE</span>
            <Camera size={18} color="#0284c7" />
          </div>
          <div style={{ fontSize: '1.35rem', fontWeight: 700, color: '#0284c7' }}>
            Face Gate (Site-In)
          </div>
          <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: 4 }}>
            Live facial recognition match required at check-in point
          </div>
        </div>

        <div
          style={{
            background: '#ffffff',
            borderRadius: 14,
            padding: '18px 20px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#64748b' }}>MANDATORY TASK LINK</span>
            <FileCheck size={18} color="#059669" />
          </div>
          <div style={{ fontSize: '1.35rem', fontWeight: 700, color: '#059669' }}>
            Task Linking
          </div>
          <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: 4 }}>
            Every site check-in must link with worker's open site task
          </div>
        </div>

        <div
          style={{
            background: '#ffffff',
            borderRadius: 14,
            padding: '18px 20px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#64748b' }}>SITE-OUT EVIDENCE</span>
            <ImageIcon size={18} color="#7c3aed" />
          </div>
          <div style={{ fontSize: '1.35rem', fontWeight: 700, color: '#7c3aed' }}>
            Photos & Remarks
          </div>
          <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: 4 }}>
            Mandatory 1+ site photographs and activity remarks on exit
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div
        style={{
          display: 'flex',
          gap: 10,
          borderBottom: '2px solid #e2e8f0',
          marginBottom: 20,
        }}
      >
        <button
          type="button"
          onClick={() => setActiveTab('records')}
          style={{
            padding: '12px 18px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'records' ? '3px solid #d97706' : '3px solid transparent',
            color: activeTab === 'records' ? '#d97706' : '#64748b',
            fontWeight: activeTab === 'records' ? 700 : 500,
            cursor: 'pointer',
            fontSize: '0.94rem',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <HardHat size={18} />
          Org-Wide Site Register ({records.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('punch')}
          style={{
            padding: '12px 18px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'punch' ? '3px solid #d97706' : '3px solid transparent',
            color: activeTab === 'punch' ? '#d97706' : '#64748b',
            fontWeight: activeTab === 'punch' ? 700 : 500,
            cursor: 'pointer',
            fontSize: '0.94rem',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <Navigation size={18} />
          Site Detection & Punch Terminal (Steps 4, 5, 6)
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('my_history')}
          style={{
            padding: '12px 18px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'my_history' ? '3px solid #d97706' : '3px solid transparent',
            color: activeTab === 'my_history' ? '#d97706' : '#64748b',
            fontWeight: activeTab === 'my_history' ? 700 : 500,
            cursor: 'pointer',
            fontSize: '0.94rem',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <Calendar size={18} />
          My Site History ({myHistory.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('history')}
          style={{
            padding: '12px 18px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'history' ? '3px solid #d97706' : '3px solid transparent',
            color: activeTab === 'history' ? '#d97706' : '#64748b',
            fontWeight: activeTab === 'history' ? 700 : 500,
            cursor: 'pointer',
            fontSize: '0.94rem',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <User size={18} />
          Employee Site History ({employeeHistory.length})
        </button>
      </div>

      {/* TAB 1: ORG-WIDE SITE REGISTER */}
      {activeTab === 'records' && (
        <div style={{ background: '#ffffff', borderRadius: 14, padding: 20, border: '1px solid #e2e8f0' }}>
          {/* Filters Bar */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 14,
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 18,
              padding: '12px 16px',
              background: '#f8fafc',
              borderRadius: 10,
              border: '1px solid #e2e8f0',
            }}
          >
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
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
                  }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <FolderKanban size={16} color="#64748b" />
                <span style={{ fontSize: '0.84rem', fontWeight: 600, color: '#334155' }}>Project:</span>
                <select
                  value={filters.project}
                  onChange={(e) => setFilters((prev) => ({ ...prev, project: e.target.value }))}
                  style={{
                    padding: '6px 10px',
                    borderRadius: 6,
                    border: '1px solid #cbd5e1',
                    fontSize: '0.85rem',
                    background: '#ffffff',
                  }}
                >
                  <option value="">All Projects</option>
                  {projects.map((p) => (
                    <option key={p._id} value={p._id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Filter size={16} color="#64748b" />
                <span style={{ fontSize: '0.84rem', fontWeight: 600, color: '#334155' }}>Task Status:</span>
                <select
                  value={filters.taskStatus}
                  onChange={(e) => setFilters((prev) => ({ ...prev, taskStatus: e.target.value }))}
                  style={{
                    padding: '6px 10px',
                    borderRadius: 6,
                    border: '1px solid #cbd5e1',
                    fontSize: '0.85rem',
                    background: '#ffffff',
                  }}
                >
                  <option value="">All Tasks</option>
                  <option value="IN_PROGRESS">IN_PROGRESS</option>
                  <option value="COMPLETED">COMPLETED</option>
                </select>
              </div>
            </div>

            <Button size="sm" variant="light" icon={RotateCcw} onClick={loadRecords}>
              Filter
            </Button>
          </div>

          <Table
            columns={recordColumns}
            data={records}
            loading={loadingRecords}
            emptyMessage="No site attendance records found for the selected filter criteria."
          />
        </div>
      )}

      {/* TAB 2: SITE DETECTION & PUNCH TERMINAL */}
      {activeTab === 'punch' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 24 }}>
          {/* Step 4 & 5: Detect & Site-In Card */}
          <div style={{ background: '#ffffff', borderRadius: 14, padding: 24, border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <div style={{ background: '#fef3c7', padding: 8, borderRadius: 8 }}>
                <MapPin size={20} color="#d97706" />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#0f172a' }}>
                  Step 4 & 5: Detect Sites & Check-In
                </h3>
                <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
                  Auto-detect active 500m project sites and link assigned tasks
                </span>
              </div>
            </div>

            {/* GPS Detection Bar */}
            <div
              style={{
                padding: 14,
                borderRadius: 8,
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                marginBottom: 16,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: '0.82rem', color: '#334155' }}>
                  GPS Position: <strong>{coords.latitude.toFixed(4)}° N, {coords.longitude.toFixed(4)}° E</strong> (±{coords.gpsAccuracy}m)
                </div>
                <Button size="sm" variant="outline" icon={RotateCcw} onClick={acquireLocation}>
                  GPS
                </Button>
              </div>
              <div style={{ marginTop: 10 }}>
                <Button
                  size="sm"
                  variant="primary"
                  icon={Search}
                  onClick={handleDetectSites}
                  loading={detectingSites}
                  style={{ width: '100%', background: '#d97706', borderColor: '#d97706' }}
                >
                  Scan 500m GeoFence for Sites
                </Button>
              </div>
            </div>

            {/* Candidate Sites Detected List */}
            {detectedSites.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#475569', marginBottom: 6 }}>
                  Detected Sites within 500m:
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {detectedSites.map((s) => {
                    const isSelected = selectedCandidateSite?.siteId === s.siteId || selectedCandidateSite?._id === s.siteId;
                    return (
                      <div
                        key={s.siteId}
                        onClick={() => {
                          setSelectedCandidateSite(s);
                          if (s.eligibleTasks?.length > 0) {
                            setSelectedTaskId(s.eligibleTasks[0]._id);
                          } else {
                            setSelectedTaskId('');
                          }
                        }}
                        style={{
                          padding: '12px 14px',
                          borderRadius: 8,
                          border: isSelected ? '2px solid #d97706' : '1px solid #cbd5e1',
                          background: isSelected ? '#fffbeb' : '#ffffff',
                          cursor: 'pointer',
                        }}
                      >
                        <div style={{ fontWeight: 700, color: '#0f172a' }}>{s.siteName}</div>
                        <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                          Project: {s.project?.name || '-'} | {getAddressStr(s.address)}
                        </div>
                        <div style={{ fontSize: '0.74rem', color: '#d97706', marginTop: 4, fontWeight: 600 }}>
                          {s.eligibleTasks?.length || 0} Open Eligible Task(s)
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Mandatory Task Selector */}
            {selectedCandidateSite && (
              <form onSubmit={handleSiteCheckIn} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#475569', marginBottom: 4 }}>
                    Mandatory Task Link:
                  </label>
                  {selectedCandidateSite.eligibleTasks?.length > 0 ? (
                    <select
                      value={selectedTaskId}
                      onChange={(e) => setSelectedTaskId(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '9px 12px',
                        borderRadius: 8,
                        border: '1px solid #cbd5e1',
                        fontSize: '0.88rem',
                        background: '#ffffff',
                      }}
                      required
                    >
                      {selectedCandidateSite.eligibleTasks.map((t) => (
                        <option key={t._id} value={t._id}>
                          {t.title} ({t.status})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div style={{ padding: 10, background: '#fee2e2', borderRadius: 8, color: '#b91c1c', fontSize: '0.82rem' }}>
                      ⚠ No tasks currently assigned to you for this site. A task must be assigned before Site-In.
                    </div>
                  )}
                </div>

                {/* Biometric Face Verification Gate */}
                <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: 14, background: '#fafafa' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.84rem', fontWeight: 600, color: '#334155' }}>
                      <Camera size={16} color="#0284c7" />
                      Biometric Face Gate (Site-In):
                    </div>
                    {!cameraActive && !capturedFaceImage && (
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
                        style={{ width: '100%', maxHeight: 200, borderRadius: 8, background: '#000' }}
                      />
                      <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginTop: 8 }}>
                        <Button size="sm" variant="success" icon={Check} onClick={captureFrame}>
                          Capture Face
                        </Button>
                        <Button size="sm" variant="light" icon={X} onClick={stopCamera}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}

                  {capturedFaceImage && (
                    <div style={{ textAlign: 'center' }}>
                      <img
                        src={capturedFaceImage}
                        alt="Biometric Capture"
                        style={{ width: 120, height: 120, objectFit: 'cover', borderRadius: 8, border: '2px solid #059669' }}
                      />
                      <div style={{ fontSize: '0.76rem', color: '#059669', fontWeight: 600, marginTop: 4, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <CheckCircle2 size={13} />
                        <span>Biometric Sample Captured</span>
                      </div>
                    </div>
                  )}

                  <canvas ref={canvasRef} style={{ display: 'none' }} />
                </div>

                <Button
                  type="submit"
                  variant="primary"
                  loading={submittingCheckIn}
                  disabled={!selectedTaskId}
                  style={{
                    padding: '12px',
                    fontSize: '0.94rem',
                    fontWeight: 700,
                    background: '#059669',
                    borderColor: '#059669',
                  }}
                >
                  Confirm Biometric Site Check-In
                </Button>
              </form>
            )}
          </div>

          {/* Step 6: Site-Out with Photos & Remarks Card */}
          <div style={{ background: '#ffffff', borderRadius: 14, padding: 24, border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <div style={{ background: '#ede9fe', padding: 8, borderRadius: 8 }}>
                <ImageIcon size={20} color="#7c3aed" />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#0f172a' }}>
                  Step 6: Site-Out (Exit Evidence)
                </h3>
                <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
                  Mandatory photographs and activity remarks required to complete site exit
                </span>
              </div>
            </div>

            <form onSubmit={handleSiteCheckOut} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Mandatory Photos */}
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#475569', marginBottom: 4 }}>
                  Attach Site Photograph URL (1+ Mandatory):
                </label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <Input
                    type="url"
                    value={siteOutPhotoUrl}
                    onChange={(e) => setSiteOutPhotoUrl(e.target.value)}
                    placeholder="https://res.cloudinary.com/tie/.../site_work.jpg"
                  />
                  <Button type="button" variant="light" onClick={addPhotoUrl}>
                    Attach
                  </Button>
                </div>

                {/* Attached Photos Chips */}
                {attachedPhotos.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
                    {attachedPhotos.map((p, idx) => (
                      <div
                        key={idx}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          background: '#f1f5f9',
                          padding: '4px 10px',
                          borderRadius: 6,
                          fontSize: '0.78rem',
                        }}
                      >
                        <ImageIcon size={14} color="#7c3aed" />
                        <span style={{ maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          Photo #{idx + 1}
                        </span>
                        <X size={14} style={{ cursor: 'pointer' }} onClick={() => removePhotoUrl(idx)} />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Mandatory Remarks */}
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#475569', marginBottom: 4 }}>
                  Activity Remarks (Mandatory):
                </label>
                <textarea
                  rows={3}
                  value={siteOutRemarks}
                  onChange={(e) => setSiteOutRemarks(e.target.value)}
                  placeholder="e.g. Completed transformer circuit testing and cable dressing with safety engineer"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 8,
                    border: '1px solid #cbd5e1',
                    fontSize: '0.88rem',
                    fontFamily: 'inherit',
                    resize: 'vertical',
                  }}
                  required
                />
              </div>

              {/* Task Completed Toggle */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="checkbox"
                  id="taskCompletedCheck"
                  checked={taskCompleted}
                  onChange={(e) => setTaskCompleted(e.target.checked)}
                  style={{ width: 16, height: 16 }}
                />
                <label htmlFor="taskCompletedCheck" style={{ fontSize: '0.85rem', color: '#334155', cursor: 'pointer' }}>
                  Mark linked site task as <strong>COMPLETED</strong>
                </label>
              </div>

              <Button
                type="submit"
                variant="warning"
                loading={submittingCheckOut}
                style={{
                  padding: '12px',
                  fontSize: '0.94rem',
                  fontWeight: 700,
                  background: '#d97706',
                  borderColor: '#d97706',
                }}
              >
                Confirm Site-Out Exit
              </Button>
            </form>

            {/* Receipt Result */}
            {punchReceipt && (
              <div
                style={{
                  marginTop: 18,
                  padding: 14,
                  borderRadius: 10,
                  background: '#f0fdf4',
                  border: '1px solid #86efac',
                  fontSize: '0.84rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, color: '#15803d' }}>
                  <CheckCircle2 size={18} />
                  {punchReceipt.mode === 'CHECK_IN' ? 'Site Check-In Recorded' : 'Site-Out Completed'}
                </div>
                <div style={{ marginTop: 6, color: '#166534' }}>
                  Attendance ID: <strong>{punchReceipt.data?.attendanceId || '-'}</strong>
                  {punchReceipt.data?.totalSiteHours && (
                    <div>Total Site Hours: <strong>{punchReceipt.data.totalSiteHours} hrs</strong></div>
                  )}
                  <div>Task Status: <strong>{punchReceipt.data?.taskStatus || 'IN_PROGRESS'}</strong></div>
                  {punchReceipt.mode === 'CHECK_OUT' && (
                    <div style={{ marginTop: 8, padding: 8, background: '#ecfdf5', borderRadius: 6, border: '1px solid #a7f3d0' }}>
                      <span style={{ fontSize: '0.78rem', color: '#065f46', fontWeight: 600 }}>
                        Step 2 Auto-Trigger: Site Log Stub created. Complete your daily work narrative in{' '}
                        <a href="/operations/site-logs" style={{ textDecoration: 'underline', color: '#0f766e', fontWeight: 700 }}>
                          Site Activity Logs
                        </a>.
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: MY SITE ATTENDANCE HISTORY (GET /attendance/site/me) */}
      {activeTab === 'my_history' && (
        <div style={{ background: '#ffffff', borderRadius: 14, padding: 20, border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#0f172a' }}>My Site Attendance History</h3>
              <p style={{ margin: '4px 0 0', fontSize: '0.84rem', color: '#64748b' }}>
                Your personal site visits, check-in face verification, task linking, checkout photos, and duty hours.
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
            emptyMessage="No personal site attendance history recorded yet."
          />
        </div>
      )}

      {/* TAB 4: EMPLOYEE SITE HISTORY (GET /attendance/site/employees/:id) */}
      {activeTab === 'history' && (
        <div style={{ background: '#ffffff', borderRadius: 14, padding: 20, border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center', marginBottom: 20 }}>
            <div style={{ flex: 1, minWidth: 260 }}>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#475569', marginBottom: 4 }}>
                Select Employee:
              </label>
              <select
                value={selectedEmpId}
                onChange={(e) => setSelectedEmpId(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: 8,
                  border: '1px solid #cbd5e1',
                  fontSize: '0.88rem',
                  background: '#ffffff',
                }}
              >
                {employees.map((emp) => (
                  <option key={emp._id} value={emp._id}>
                    {getEmpName(emp)} ({getEmpCode(emp)})
                  </option>
                ))}
              </select>
            </div>

            <div style={{ alignSelf: 'flex-end' }}>
              <Button
                variant="primary"
                icon={Search}
                onClick={() => loadEmployeeHistory(selectedEmpId)}
                loading={loadingHistory}
                style={{ background: '#d97706', borderColor: '#d97706' }}
              >
                Fetch Site History
              </Button>
            </div>
          </div>

          <Table
            columns={recordColumns}
            data={employeeHistory}
            loading={loadingHistory}
            emptyMessage="No site attendance logs found for this employee."
          />
        </div>
      )}

      {/* EVIDENCE / PHOTOS MODAL */}
      <Modal
        isOpen={evidenceModalOpen}
        onClose={() => setEvidenceModalOpen(false)}
        title="Site-Out Evidence (Photographs & Remarks)"
      >
        {selectedRecord && (
          <div>
            <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, marginBottom: 14, fontSize: '0.85rem' }}>
              <div>Site: <strong>{selectedRecord.site?.name || 'Project Site'}</strong></div>
              <div>Task: <strong>{selectedRecord.assignedTask?.title || 'Inspection'}</strong></div>
              <div>Remarks: <em>"{selectedRecord.remarks || 'No remarks recorded'}"</em></div>
            </div>

            <h4 style={{ margin: '0 0 10px', fontSize: '0.92rem', color: '#0f172a' }}>
              Attached Photos ({selectedRecord.photos?.length || 0}):
            </h4>

            {selectedRecord.photos?.length > 0 ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
                {selectedRecord.photos.map((p, idx) => (
                  <a
                    key={idx}
                    href={p}
                    target="_blank"
                    rel="noreferrer"
                    style={{ display: 'block', borderRadius: 8, overflow: 'hidden', border: '1px solid #e2e8f0' }}
                  >
                    <img src={p} alt={`Site evidence ${idx + 1}`} style={{ width: '100%', height: 120, objectFit: 'cover' }} />
                  </a>
                ))}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: 20, color: '#94a3b8' }}>
                No photos attached to this session.
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* STEP 8: ADMIN CORRECTION MODAL */}
      <Modal
        isOpen={correctModalOpen}
        onClose={() => setCorrectModalOpen(false)}
        title="Manual Administrative Site Attendance Correction"
      >
        <form onSubmit={handleCorrectSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {selectedRecord && (
            <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0', fontSize: '0.84rem' }}>
              <div>Employee: <strong>{selectedRecord.employee?.name || selectedRecord.employee?.firstName || 'Engineer'}</strong></div>
              <div>Site: <strong>{selectedRecord.site?.name || 'Project Site'}</strong></div>
            </div>
          )}

          <div className="grid-2">
            <Input
              label="Site-In Time"
              type="datetime-local"
              value={correctForm.siteInTime}
              onChange={(e) => setCorrectForm({ ...correctForm, siteInTime: e.target.value })}
              required
            />
            <Input
              label="Site-Out Time"
              type="datetime-local"
              value={correctForm.siteOutTime}
              onChange={(e) => setCorrectForm({ ...correctForm, siteOutTime: e.target.value })}
              required
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#475569', marginBottom: 4 }}>
              Task Status:
            </label>
            <select
              value={correctForm.taskStatus}
              onChange={(e) => setCorrectForm({ ...correctForm, taskStatus: e.target.value })}
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: 8,
                border: '1px solid #cbd5e1',
                fontSize: '0.88rem',
                background: '#ffffff',
              }}
            >
              <option value="COMPLETED">COMPLETED</option>
              <option value="IN_PROGRESS">IN_PROGRESS</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#475569', marginBottom: 4 }}>
              Mandatory Correction Remark:
            </label>
            <textarea
              rows={3}
              value={correctForm.correctionRemark}
              onChange={(e) => setCorrectForm({ ...correctForm, correctionRemark: e.target.value })}
              placeholder="e.g. Adjusted check-in time per supervisor manual sign-off sheet"
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 8,
                border: '1px solid #cbd5e1',
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
            <Button variant="primary" type="submit" loading={submittingCorrect} style={{ background: '#d97706', borderColor: '#d97706' }}>
              Save Correction
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default SiteAttendance;
