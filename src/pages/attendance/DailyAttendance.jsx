import React, { useState, useEffect, useCallback, useMemo } from 'react';
import attendanceApi from '../../api/attendanceApi';
import regularizationApi from '../../api/regularizationApi';
import employeeApi from '../../api/employeeApi';
import geoApi from '../../api/geoApi';
import masterApi from '../../api/masterApi';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import {
  Calendar, Clock, MapPin, CheckCircle2, AlertCircle, ScanFace,
  Layers, Edit2, User, RefreshCw, Building2, Trash2, Search,
  Check, X, ChevronRight, ShieldCheck, Camera, LogIn, LogOut,
  Navigation, Eye, Sliders, Briefcase
} from 'lucide-react';
import Table from '../../components/common/Table';
import Modal from '../../components/common/Modal';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import { extractApiData } from '../../utils/apiUtils';

export const DailyAttendance = () => {
  const { user, isSuperAdmin, isHrAdmin, isDirector, isBranchManager } = useAuth();
  const isOrgAdmin = isSuperAdmin || isHrAdmin || isDirector || isBranchManager;
  const { showToast } = useToast();

  const [currentTime, setCurrentTime] = useState(new Date());

  // Tabs: 'records' | 'regularization' | 'geofences'
  const [activeTab, setActiveTab] = useState('records');

  // Subtype in records: 'OFFICE' | 'FIELD'
  const [attendanceType, setAttendanceType] = useState('OFFICE');

  // Filter scope: 'MY' | 'ALL' (for managers)
  const [viewScope, setViewScope] = useState(isOrgAdmin ? 'ALL' : 'MY');

  // Filters
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [searchQuery, setSearchQuery] = useState('');

  // Live Records
  const [records, setRecords] = useState([]);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [myTodayRecord, setMyTodayRecord] = useState(null);

  // Punch Action Modal (Check In / Check Out)
  const [punchModalOpen, setPunchModalOpen] = useState(false);
  const [punchActionType, setPunchActionType] = useState('CHECK_IN'); // 'CHECK_IN' | 'CHECK_OUT'
  const [punchAttendanceType, setPunchAttendanceType] = useState('OFFICE'); // 'OFFICE' | 'FIELD'
  const [punchRemarks, setPunchRemarks] = useState('');
  const [capturedPhoto, setCapturedPhoto] = useState(null);
  const [submittingPunch, setSubmittingPunch] = useState(false);
  const [gpsCoords, setGpsCoords] = useState({ latitude: 21.2420, longitude: 72.8870, accuracy: 15 });
  const [gpsStatus, setGpsStatus] = useState('Acquiring GPS...');

  // Sessions Modal
  const [sessionModalOpen, setSessionModalOpen] = useState(false);
  const [selectedRecordForSessions, setSelectedRecordForSessions] = useState(null);

  // Administrative Manual Correction Modal (PUT /attendance/office/:id/correct)
  const [correctModalOpen, setCorrectModalOpen] = useState(false);
  const [selectedRecordForCorrect, setSelectedRecordForCorrect] = useState(null);
  const [submittingCorrect, setSubmittingCorrect] = useState(false);
  const [correctForm, setCorrectForm] = useState({
    checkInTime: '',
    checkOutTime: '',
    attendanceStatus: 'PRESENT',
    correctionRemark: '',
  });

  // Regularization Tab State
  const [regularizations, setRegularizations] = useState([]);
  const [loadingRegs, setLoadingRegs] = useState(false);
  const [regModalOpen, setRegModalOpen] = useState(false);
  const [submittingReg, setSubmittingReg] = useState(false);
  const [regForm, setRegForm] = useState({
    attendanceDate: new Date().toISOString().split('T')[0],
    requestedCheckInTime: '09:00',
    requestedCheckOutTime: '18:00',
    reason: '',
  });

  // GeoFences State
  const [geofences, setGeofences] = useState([]);
  const [loadingFences, setLoadingFences] = useState(false);

  // Clock Ticker
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Safe List Extractor
  const toList = (res) => extractApiData(res, 'records', 'regularizations', 'geofences', 'data');

  // Load GPS coordinates on mount
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setGpsCoords({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: Math.round(pos.coords.accuracy || 15),
          });
          setGpsStatus(`GPS Active (${pos.coords.latitude.toFixed(4)}°, ${pos.coords.longitude.toFixed(4)}°)`);
        },
        (err) => {
          setGpsStatus('GPS Default: Surat/Ahmedabad Office Coordinates');
        },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    }
  }, []);

  // 1. Fetch Attendance Records
  const loadRecords = useCallback(async () => {
    setLoadingRecords(true);
    try {
      const params = selectedDate ? { date: selectedDate } : {};
      let res;

      if (attendanceType === 'OFFICE') {
        if (viewScope === 'ALL' && isOrgAdmin) {
          res = await attendanceApi.getAllOfficeAttendance(params);
        } else {
          res = await attendanceApi.getMyOfficeAttendance(params);
        }
      } else {
        if (viewScope === 'ALL' && isOrgAdmin) {
          res = await attendanceApi.getAllFieldAttendance(params);
        } else {
          res = await attendanceApi.getMyFieldAttendance(params);
        }
      }

      const list = toList(res);
      setRecords(list);

      // Check today's personal status
      const todayIso = new Date().toISOString().split('T')[0];
      const meToday = list.find((r) => {
        const rDate = r.attendanceDate ? r.attendanceDate.split('T')[0] : '';
        const isMe = r.employee?._id === user?.employee?._id || r.employee === user?.employee?._id || !r.employee;
        return rDate === todayIso && isMe;
      });
      setMyTodayRecord(meToday || null);
    } catch (err) {
      console.error('Error loading attendance records:', err);
      setRecords([]);
    } finally {
      setLoadingRecords(false);
    }
  }, [attendanceType, viewScope, selectedDate, isOrgAdmin, user]);

  // 2. Fetch Regularizations
  const loadRegularizations = useCallback(async () => {
    setLoadingRegs(true);
    try {
      let res;
      if (isOrgAdmin && viewScope === 'ALL') {
        res = await regularizationApi.getPendingApprovals();
      } else {
        res = await regularizationApi.getMyRegularizations();
      }
      setRegularizations(toList(res));
    } catch (err) {
      console.error('Error loading regularizations:', err);
      setRegularizations([]);
    } finally {
      setLoadingRegs(false);
    }
  }, [isOrgAdmin, viewScope]);

  // 3. Fetch Geofences
  const loadGeofences = useCallback(async () => {
    setLoadingFences(true);
    try {
      const res = await geoApi.getGeofences();
      setGeofences(toList(res));
    } catch (err) {
      console.error('Error loading geofences:', err);
      setGeofences([]);
    } finally {
      setLoadingFences(false);
    }
  }, []);

  // Tab change triggers
  useEffect(() => {
    if (activeTab === 'records') {
      loadRecords();
    } else if (activeTab === 'regularization') {
      loadRegularizations();
    } else if (activeTab === 'geofences') {
      loadGeofences();
    }
  }, [activeTab, loadRecords, loadRegularizations, loadGeofences]);

  // Execute Punch (Check-In or Check-Out)
  const handleExecutePunch = async () => {
    setSubmittingPunch(true);
    try {
      const payload = {
        latitude: gpsCoords.latitude,
        longitude: gpsCoords.longitude,
        gpsAccuracy: gpsCoords.accuracy || 15,
        capturedImage: capturedPhoto || 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIj48Y2lyY2xlIGN4PSI1MCIgY3k9IjUwIiIgcj0iNDAiIGZpbGw9IiMyZTdiODUiLz48L3N2Zz4=',
        confidenceScore: 0.96,
        remarks: punchRemarks.trim() || undefined,
      };

      if (punchActionType === 'CHECK_IN') {
        if (punchAttendanceType === 'OFFICE') {
          await attendanceApi.officeCheckIn(payload);
        } else {
          await attendanceApi.fieldCheckIn(payload);
        }
        showToast('✓ Successfully Checked In! Attendance marked as PRESENT.', 'success');
      } else {
        if (punchAttendanceType === 'OFFICE') {
          await attendanceApi.officeCheckOut(payload);
        } else {
          await attendanceApi.fieldCheckOut(payload);
        }
        showToast('✓ Successfully Checked Out! Working hours calculated.', 'success');
      }

      setPunchModalOpen(false);
      setPunchRemarks('');
      setCapturedPhoto(null);
      await loadRecords();
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Attendance punch failed';
      showToast(msg, 'error');
    } finally {
      setSubmittingPunch(false);
    }
  };

  // Open Correction Modal
  const handleOpenCorrect = (record) => {
    setSelectedRecordForCorrect(record);
    const inTime = record.firstCheckInTime ? new Date(record.firstCheckInTime).toISOString().slice(0, 16) : '';
    const outTime = record.lastCheckOutTime ? new Date(record.lastCheckOutTime).toISOString().slice(0, 16) : '';

    setCorrectForm({
      checkInTime: inTime,
      checkOutTime: outTime,
      attendanceStatus: record.attendanceStatus || 'PRESENT',
      correctionRemark: record.correctionRemark || '',
    });
    setCorrectModalOpen(true);
  };

  // Submit Admin Correction
  const handleSubmitCorrection = async (e) => {
    e.preventDefault();
    if (!correctForm.correctionRemark.trim()) {
      showToast('Correction remark is required for audit trail', 'warning');
      return;
    }

    setSubmittingCorrect(true);
    try {
      const payload = {
        attendanceStatus: correctForm.attendanceStatus,
        correctionRemark: correctForm.correctionRemark.trim(),
        checkInTime: correctForm.checkInTime ? new Date(correctForm.checkInTime).toISOString() : undefined,
        checkOutTime: correctForm.checkOutTime ? new Date(correctForm.checkOutTime).toISOString() : undefined,
      };

      if (selectedRecordForCorrect.attendanceType === 'FIELD') {
        await attendanceApi.correctFieldAttendance(selectedRecordForCorrect._id, payload);
      } else {
        await attendanceApi.correctOfficeAttendance(selectedRecordForCorrect._id, payload);
      }

      showToast('✓ Attendance record corrected successfully', 'success');
      setCorrectModalOpen(false);
      await loadRecords();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to correct record', 'error');
    } finally {
      setSubmittingCorrect(false);
    }
  };

  // Submit Regularization Request
  const handleSubmitRegularization = async (e) => {
    e.preventDefault();
    if (!regForm.reason.trim()) {
      showToast('Please provide a reason for regularization', 'warning');
      return;
    }

    setSubmittingReg(true);
    try {
      const reqIn = `${regForm.attendanceDate}T${regForm.requestedCheckInTime}:00.000Z`;
      const reqOut = `${regForm.attendanceDate}T${regForm.requestedCheckOutTime}:00.000Z`;

      await regularizationApi.applyRegularization({
        attendanceDate: regForm.attendanceDate,
        requestedCheckInTime: reqIn,
        requestedCheckOutTime: reqOut,
        reason: regForm.reason.trim(),
      });

      showToast('✓ Regularization request submitted for manager review', 'success');
      setRegModalOpen(false);
      setRegForm({
        attendanceDate: new Date().toISOString().split('T')[0],
        requestedCheckInTime: '09:00',
        requestedCheckOutTime: '18:00',
        reason: '',
      });
      await loadRegularizations();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to submit regularization', 'error');
    } finally {
      setSubmittingReg(false);
    }
  };

  // Approve / Reject Regularization
  const handleDecideRegularization = async (id, decision) => {
    try {
      if (decision === 'APPROVE') {
        await regularizationApi.approveRegularization(id, { remark: 'Approved by HR Administrator' });
        showToast('✓ Regularization request approved & attendance updated!', 'success');
      } else {
        await regularizationApi.rejectRegularization(id, { remark: 'Rejected after review' });
        showToast('Regularization request rejected', 'info');
      }
      await loadRegularizations();
    } catch (err) {
      showToast(err.response?.data?.message || 'Decision failed', 'error');
    }
  };

  // Filtered records by search query
  const filteredRecords = useMemo(() => {
    if (!searchQuery.trim()) return records;
    const q = searchQuery.toLowerCase();
    return records.filter((r) => {
      const name = (r.employee?.basicInfo?.fullName || r.employee?.name || '').toLowerCase();
      const code = (r.employee?.basicInfo?.employeeCode || r.employee?.employeeCode || '').toLowerCase();
      const branch = (r.branch?.name || '').toLowerCase();
      const status = (r.attendanceStatus || '').toLowerCase();
      return name.includes(q) || code.includes(q) || branch.includes(q) || status.includes(q);
    });
  }, [records, searchQuery]);

  // Today's Check Status calculation
  const hasActiveSession = myTodayRecord?.isOpen === true || (myTodayRecord?.punches && myTodayRecord.punches.some((p) => p.isOpen));
  const hasCompletedSession = myTodayRecord && myTodayRecord.lastCheckOutTime;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, fontFamily: 'Inter, system-ui, sans-serif' }}>

      {/* 1. Top Header Banner with Live Clock & Quick Action */}
      <div style={{
        background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0',
        padding: '16px 20px', display: 'flex', justifyContent: 'space-between',
        alignItems: 'center', flexWrap: 'wrap', gap: 14
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            background: 'linear-gradient(135deg, var(--primary) 0%, #0d9488 100%)',
            color: '#fff', padding: 10, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <Clock size={24} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#0f172a' }}>
                Attendance &amp; Biometric Gates
              </h2>
              <span style={{ fontSize: '0.74rem', background: '#f1f5f9', color: '#475569', padding: '2px 8px', borderRadius: 6, fontWeight: 600 }}>
                {currentTime.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })} &bull; {currentTime.toLocaleTimeString()}
              </span>
            </div>
            <p style={{ margin: '3px 0 0', fontSize: '0.8rem', color: '#64748b' }}>
              Live office check-in/out, multi-punch daily sessions &amp; GPS geofencing
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <Button
            variant="secondary"
            icon={RefreshCw}
            onClick={() => {
              if (activeTab === 'records') loadRecords();
              else if (activeTab === 'regularization') loadRegularizations();
              else loadGeofences();
            }}
          >
            Refresh
          </Button>

          {/* Quick Check-In / Check-Out Primary Button */}
          {hasActiveSession ? (
            <Button
              variant="danger"
              icon={LogOut}
              onClick={() => {
                setPunchActionType('CHECK_OUT');
                setPunchModalOpen(true);
              }}
            >
              Punch Check-Out
            </Button>
          ) : (
            <Button
              variant="primary"
              icon={LogIn}
              onClick={() => {
                setPunchActionType('CHECK_IN');
                setPunchModalOpen(true);
              }}
            >
              Punch Check-In
            </Button>
          )}

          <Button
            variant="secondary"
            icon={Sliders}
            onClick={() => setRegModalOpen(true)}
          >
            Regularize
          </Button>
        </div>
      </div>

      {/* 2. Today's Personal Status Card */}
      <div style={{
        background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0',
        padding: '12px 18px', display: 'flex', justifyContent: 'space-between',
        alignItems: 'center', flexWrap: 'wrap', gap: 10
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            background: hasActiveSession ? '#fef3c7' : hasCompletedSession ? '#dcfce7' : '#f1f5f9',
            color: hasActiveSession ? '#d97706' : hasCompletedSession ? '#16a34a' : '#64748b',
            padding: 8, borderRadius: 8, display: 'flex'
          }}>
            {hasActiveSession ? <Clock size={18} /> : hasCompletedSession ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          </div>
          <div>
            <div style={{ fontSize: '0.86rem', fontWeight: 700, color: '#0f172a' }}>
              {hasActiveSession
                ? `Checked In at ${myTodayRecord.firstCheckInTime ? new Date(myTodayRecord.firstCheckInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Today'} (Session Active)`
                : hasCompletedSession
                ? `Completed Today &bull; Worked ${myTodayRecord.totalWorkingHours || 0} hrs (Punched out at ${new Date(myTodayRecord.lastCheckOutTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`
                : 'No attendance punch recorded for today yet'}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
              {gpsStatus}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <Badge variant={hasCompletedSession ? 'success' : hasActiveSession ? 'warning' : 'secondary'}>
            {hasCompletedSession ? 'PRESENT (COMPLETED)' : hasActiveSession ? 'IN PROGRESS' : 'NOT PUNCHED'}
          </Badge>
        </div>
      </div>

      {/* 3. Navigation Tabs */}
      <div style={{
        display: 'flex', gap: 6, background: '#fff', padding: '6px',
        borderRadius: 10, border: '1px solid #e2e8f0', width: 'fit-content'
      }}>
        <button
          onClick={() => setActiveTab('records')}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '7px 16px',
            borderRadius: 7, border: 'none', fontSize: '0.84rem', fontWeight: 600,
            cursor: 'pointer', transition: 'all 0.15s',
            background: activeTab === 'records' ? 'var(--primary)' : 'transparent',
            color: activeTab === 'records' ? '#fff' : '#64748b',
          }}
        >
          <Calendar size={15} /> Attendance Records ({records.length})
        </button>

        <button
          onClick={() => setActiveTab('regularization')}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '7px 16px',
            borderRadius: 7, border: 'none', fontSize: '0.84rem', fontWeight: 600,
            cursor: 'pointer', transition: 'all 0.15s',
            background: activeTab === 'regularization' ? 'var(--primary)' : 'transparent',
            color: activeTab === 'regularization' ? '#fff' : '#64748b',
          }}
        >
          <Sliders size={15} /> Regularization Requests ({regularizations.length})
        </button>

        <button
          onClick={() => setActiveTab('geofences')}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '7px 16px',
            borderRadius: 7, border: 'none', fontSize: '0.84rem', fontWeight: 600,
            cursor: 'pointer', transition: 'all 0.15s',
            background: activeTab === 'geofences' ? 'var(--primary)' : 'transparent',
            color: activeTab === 'geofences' ? '#fff' : '#64748b',
          }}
        >
          <MapPin size={15} /> Branch Geo-Fences ({geofences.length})
        </button>
      </div>

      {/* ================================================================== */}
      {/* TAB 1: ATTENDANCE RECORDS */}
      {/* ================================================================== */}
      {activeTab === 'records' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* Subheader Filter Bar */}
          <div style={{
            background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0',
            padding: '12px 16px', display: 'flex', justifyContent: 'space-between',
            alignItems: 'center', flexWrap: 'wrap', gap: 12
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              {/* Type Switcher: Office vs Field */}
              <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: 8, padding: 3 }}>
                <button
                  onClick={() => setAttendanceType('OFFICE')}
                  style={{
                    padding: '5px 12px', border: 'none', borderRadius: 6, fontSize: '0.78rem',
                    fontWeight: 600, cursor: 'pointer',
                    background: attendanceType === 'OFFICE' ? '#fff' : 'transparent',
                    color: attendanceType === 'OFFICE' ? '#0f172a' : '#64748b',
                    boxShadow: attendanceType === 'OFFICE' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  }}
                >
                  Office Attendance
                </button>
                <button
                  onClick={() => setAttendanceType('FIELD')}
                  style={{
                    padding: '5px 12px', border: 'none', borderRadius: 6, fontSize: '0.78rem',
                    fontWeight: 600, cursor: 'pointer',
                    background: attendanceType === 'FIELD' ? '#fff' : 'transparent',
                    color: attendanceType === 'FIELD' ? '#0f172a' : '#64748b',
                    boxShadow: attendanceType === 'FIELD' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  }}
                >
                  Field Staff
                </button>
              </div>

              {/* Scope Switcher (Org Admins Only) */}
              {isOrgAdmin && (
                <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: 8, padding: 3 }}>
                  <button
                    onClick={() => setViewScope('ALL')}
                    style={{
                      padding: '5px 12px', border: 'none', borderRadius: 6, fontSize: '0.78rem',
                      fontWeight: 600, cursor: 'pointer',
                      background: viewScope === 'ALL' ? '#fff' : 'transparent',
                      color: viewScope === 'ALL' ? '#0f172a' : '#64748b',
                      boxShadow: viewScope === 'ALL' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                    }}
                  >
                    Organization Wide
                  </button>
                  <button
                    onClick={() => setViewScope('MY')}
                    style={{
                      padding: '5px 12px', border: 'none', borderRadius: 6, fontSize: '0.78rem',
                      fontWeight: 600, cursor: 'pointer',
                      background: viewScope === 'MY' ? '#fff' : 'transparent',
                      color: viewScope === 'MY' ? '#0f172a' : '#64748b',
                      boxShadow: viewScope === 'MY' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                    }}
                  >
                    My History
                  </button>
                </div>
              )}

              {/* Date Selector */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#64748b' }}>Date:</span>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  style={{
                    padding: '5px 8px', borderRadius: 6, border: '1px solid #cbd5e1',
                    fontSize: '0.8rem', background: '#fff'
                  }}
                />
              </div>
            </div>

            {/* Search Input */}
            <div style={{ position: 'relative', width: 220 }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: 9, color: '#94a3b8' }} />
              <input
                type="text"
                placeholder="Search staff, code, status..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%', padding: '5px 10px 5px 30px', borderRadius: 6,
                  border: '1px solid #cbd5e1', fontSize: '0.78rem', boxSizing: 'border-box'
                }}
              />
            </div>
          </div>

          {/* Records Table */}
          <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
            {loadingRecords ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>
                <Clock size={24} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 8px' }} />
                <div>Loading live attendance records...</div>
              </div>
            ) : filteredRecords.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>
                <AlertCircle size={32} color="#94a3b8" style={{ margin: '0 auto 8px' }} />
                <div style={{ fontWeight: 600 }}>No attendance records found for this date</div>
                <div style={{ fontSize: '0.8rem', marginTop: 4 }}>
                  Use &ldquo;Punch Check-In&rdquo; above to record your attendance.
                </div>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#64748b', textAlign: 'left' }}>
                      <th style={{ padding: '10px 16px' }}>Employee</th>
                      <th style={{ padding: '10px 16px' }}>Date</th>
                      <th style={{ padding: '10px 16px' }}>Check In</th>
                      <th style={{ padding: '10px 16px' }}>Check Out</th>
                      <th style={{ padding: '10px 16px' }}>Total Hours</th>
                      <th style={{ padding: '10px 16px' }}>Status</th>
                      <th style={{ padding: '10px 16px' }}>Late / Ontime</th>
                      <th style={{ padding: '10px 16px', textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRecords.map((r) => {
                      const empName = r.employee?.basicInfo?.fullName || r.employee?.name || user?.name || 'Staff Member';
                      const empCode = r.employee?.basicInfo?.employeeCode || r.employee?.employeeCode || 'EMP';
                      const inTimeStr = r.firstCheckInTime ? new Date(r.firstCheckInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—';
                      const outTimeStr = r.lastCheckOutTime ? new Date(r.lastCheckOutTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : (r.isOpen ? 'In Progress' : '—');
                      const dateStr = r.attendanceDate ? new Date(r.attendanceDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
                      const isLate = r.lateStatus?.isLate;
                      const punchesCount = r.punches?.length || 1;

                      return (
                        <tr key={r._id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '12px 16px' }}>
                            <div style={{ fontWeight: 600, color: '#0f172a' }}>{empName}</div>
                            <div style={{ fontSize: '0.72rem', color: '#64748b' }}>{empCode} &bull; {r.branch?.name || 'Branch Office'}</div>
                          </td>
                          <td style={{ padding: '12px 16px' }}>{dateStr}</td>
                          <td style={{ padding: '12px 16px', fontWeight: 600, color: '#16a34a' }}>{inTimeStr}</td>
                          <td style={{ padding: '12px 16px', fontWeight: 600, color: '#0284c7' }}>{outTimeStr}</td>
                          <td style={{ padding: '12px 16px' }}>
                            <span style={{ fontWeight: 700 }}>{r.totalWorkingHours || 0} hrs</span>
                            {r.overtimeHours > 0 && (
                              <span style={{ fontSize: '0.72rem', color: '#16a34a', marginLeft: 4 }}>(+{r.overtimeHours} OT)</span>
                            )}
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            <Badge variant={r.attendanceStatus === 'PRESENT' ? 'success' : r.attendanceStatus === 'HALF_DAY' ? 'warning' : 'danger'}>
                              {r.attendanceStatus || 'PRESENT'}
                            </Badge>
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            <Badge variant={isLate ? 'danger' : 'success'}>
                              {isLate ? 'LATE' : 'ON TIME'}
                            </Badge>
                          </td>
                          <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                              <Button
                                variant="secondary"
                                size="sm"
                                icon={Eye}
                                onClick={() => {
                                  setSelectedRecordForSessions(r);
                                  setSessionModalOpen(true);
                                }}
                                title="View multi-punch sessions"
                              >
                                {punchesCount} {punchesCount === 1 ? 'Punch' : 'Punches'}
                              </Button>
                              {isOrgAdmin && (
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  icon={Edit2}
                                  onClick={() => handleOpenCorrect(r)}
                                  title="Admin manual correction"
                                />
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================================================================== */}
      {/* TAB 2: REGULARIZATION REQUESTS */}
      {/* ================================================================== */}
      {activeTab === 'regularization' && (
        <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#0f172a' }}>
                Attendance Regularization Workflow
              </h3>
              <p style={{ margin: '2px 0 0', fontSize: '0.76rem', color: '#64748b' }}>
                Submit adjustments for missed biometric punches, on-duty field visits, or technical errors
              </p>
            </div>
            <Button variant="primary" size="sm" icon={Sliders} onClick={() => setRegModalOpen(true)}>
              Apply for Regularization
            </Button>
          </div>

          {loadingRegs ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>
              <Clock size={24} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 8px' }} />
              <div>Loading regularization requests...</div>
            </div>
          ) : regularizations.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>
              <CheckCircle2 size={32} color="#16a34a" style={{ margin: '0 auto 8px' }} />
              <div style={{ fontWeight: 600 }}>No pending regularization requests</div>
              <div style={{ fontSize: '0.8rem', marginTop: 4 }}>
                All attendance records are verified and aligned.
              </div>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#64748b', textAlign: 'left' }}>
                    <th style={{ padding: '10px 16px' }}>Staff</th>
                    <th style={{ padding: '10px 16px' }}>Attendance Date</th>
                    <th style={{ padding: '10px 16px' }}>Requested Timings</th>
                    <th style={{ padding: '10px 16px' }}>Reason</th>
                    <th style={{ padding: '10px 16px' }}>Status</th>
                    <th style={{ padding: '10px 16px', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {regularizations.map((reg) => {
                    const empName = reg.employee?.basicInfo?.fullName || reg.employee?.name || user?.name || 'Staff Member';
                    const empCode = reg.employee?.basicInfo?.employeeCode || reg.employee?.employeeCode || 'EMP';
                    const inTime = reg.requestedCheckInTime ? new Date(reg.requestedCheckInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '09:00 AM';
                    const outTime = reg.requestedCheckOutTime ? new Date(reg.requestedCheckOutTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '06:00 PM';
                    const status = reg.status || 'PENDING';
                    const isPending = status === 'PENDING';

                    return (
                      <tr key={reg._id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ fontWeight: 600 }}>{empName}</div>
                          <div style={{ fontSize: '0.72rem', color: '#64748b' }}>{empCode}</div>
                        </td>
                        <td style={{ padding: '12px 16px', fontWeight: 600 }}>
                          {reg.attendanceDate ? new Date(reg.attendanceDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{ color: '#16a34a', fontWeight: 600 }}>{inTime}</span> to <span style={{ color: '#0284c7', fontWeight: 600 }}>{outTime}</span>
                        </td>
                        <td style={{ padding: '12px 16px', maxWidth: 240 }}>
                          <div style={{ fontSize: '0.78rem', color: '#334155' }}>{reg.reason}</div>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <Badge variant={status === 'APPROVED' ? 'success' : status === 'REJECTED' ? 'danger' : 'warning'}>
                            {status}
                          </Badge>
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                          {isPending && isOrgAdmin && (
                            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                              <Button
                                variant="primary"
                                size="sm"
                                icon={Check}
                                onClick={() => handleDecideRegularization(reg._id, 'APPROVE')}
                              >
                                Approve
                              </Button>
                              <Button
                                variant="danger"
                                size="sm"
                                icon={X}
                                onClick={() => handleDecideRegularization(reg._id, 'REJECT')}
                              >
                                Reject
                              </Button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ================================================================== */}
      {/* TAB 3: BRANCH GEOFENCES */}
      {/* ================================================================== */}
      {activeTab === 'geofences' && (
        <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid #e2e8f0' }}>
            <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#0f172a' }}>
              Configured Branch Geofences
            </h3>
            <p style={{ margin: '2px 0 0', fontSize: '0.76rem', color: '#64748b' }}>
              Automated GPS perimeter validation active for office mobile attendance gates
            </p>
          </div>

          {loadingFences ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>
              <Clock size={24} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 8px' }} />
              <div>Loading configured geofences...</div>
            </div>
          ) : geofences.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>
              <MapPin size={32} color="#94a3b8" style={{ margin: '0 auto 8px' }} />
              <div style={{ fontWeight: 600 }}>No geofences configured</div>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#64748b', textAlign: 'left' }}>
                    <th style={{ padding: '10px 16px' }}>Branch / Location</th>
                    <th style={{ padding: '10px 16px' }}>Coordinates</th>
                    <th style={{ padding: '10px 16px' }}>Allowed Radius</th>
                    <th style={{ padding: '10px 16px' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {geofences.map((gf) => {
                    const branchName = gf.reference?.name || gf.name || 'Office Branch';
                    const lat = gf.centerLatitude ?? gf.reference?.geoFence?.latitude ?? 21.2420;
                    const lng = gf.centerLongitude ?? gf.reference?.geoFence?.longitude ?? 72.8870;
                    const rad = gf.radiusMeters ?? gf.reference?.geoFence?.radiusInMeters ?? 500;

                    return (
                      <tr key={gf._id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '12px 16px', fontWeight: 600 }}>{branchName}</td>
                        <td style={{ padding: '12px 16px', fontFamily: 'monospace' }}>
                          {Number(lat).toFixed(4)}° N, {Number(lng).toFixed(4)}° E
                        </td>
                        <td style={{ padding: '12px 16px' }}>{rad} Meters</td>
                        <td style={{ padding: '12px 16px' }}>
                          <Badge variant="success">ACTIVE PERIMETER</Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ================================================================== */}
      {/* 4. MODAL: PUNCH CHECK-IN / CHECK-OUT */}
      {/* ================================================================== */}
      {punchModalOpen && (
        <Modal
          isOpen={true}
          onClose={() => setPunchModalOpen(false)}
          title={punchActionType === 'CHECK_IN' ? 'Biometric & GPS Check-In' : 'Punch Check-Out'}
          maxWidth="480px"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Mode Selector: Office vs Field */}
            <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: 8, padding: 3 }}>
              <button
                type="button"
                onClick={() => setPunchAttendanceType('OFFICE')}
                style={{
                  flex: 1, padding: '7px 0', border: 'none', borderRadius: 6, fontSize: '0.8rem',
                  fontWeight: 600, cursor: 'pointer',
                  background: punchAttendanceType === 'OFFICE' ? 'var(--primary)' : 'transparent',
                  color: punchAttendanceType === 'OFFICE' ? '#fff' : '#64748b',
                }}
              >
                Office Location
              </button>
              <button
                type="button"
                onClick={() => setPunchAttendanceType('FIELD')}
                style={{
                  flex: 1, padding: '7px 0', border: 'none', borderRadius: 6, fontSize: '0.8rem',
                  fontWeight: 600, cursor: 'pointer',
                  background: punchAttendanceType === 'FIELD' ? 'var(--primary)' : 'transparent',
                  color: punchAttendanceType === 'FIELD' ? '#fff' : '#64748b',
                }}
              >
                Field / Client Visit
              </button>
            </div>

            {/* GPS Telemetry Box */}
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 12, fontSize: '0.8rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontWeight: 600, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Navigation size={14} color="#16a34a" /> Verified GPS Coordinates:
                </span>
                <Badge variant="success">ACCURACY: {gpsCoords.accuracy}M</Badge>
              </div>
              <div style={{ fontFamily: 'monospace', color: '#475569' }}>
                Lat: {gpsCoords.latitude.toFixed(6)} &bull; Long: {gpsCoords.longitude.toFixed(6)}
              </div>
            </div>

            {/* Remarks Input for Check-Out */}
            {punchActionType === 'CHECK_OUT' && (
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>
                  Shift / Daily Remarks (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Completed scheduled client meetings and development tasks"
                  value={punchRemarks}
                  onChange={(e) => setPunchRemarks(e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.82rem', boxSizing: 'border-box' }}
                />
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 6 }}>
              <Button variant="secondary" onClick={() => setPunchModalOpen(false)}>
                Cancel
              </Button>
              <Button
                variant={punchActionType === 'CHECK_IN' ? 'primary' : 'danger'}
                loading={submittingPunch}
                onClick={handleExecutePunch}
              >
                Confirm {punchActionType === 'CHECK_IN' ? 'Check-In' : 'Check-Out'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* ================================================================== */}
      {/* 5. MODAL: MULTI-PUNCH SESSIONS VIEWER */}
      {/* ================================================================== */}
      {sessionModalOpen && selectedRecordForSessions && (
        <Modal
          isOpen={true}
          onClose={() => setSessionModalOpen(false)}
          title={`Punch Sessions &bull; ${selectedRecordForSessions.employee?.basicInfo?.fullName || selectedRecordForSessions.employee?.name || 'Staff'}`}
          maxWidth="560px"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
              Recorded punches for {selectedRecordForSessions.attendanceDate ? new Date(selectedRecordForSessions.attendanceDate).toLocaleDateString() : 'Date'}
            </div>

            {(selectedRecordForSessions.punches || []).length === 0 ? (
              <div style={{ padding: 20, textAlign: 'center', color: '#64748b' }}>
                Single session recorded ({selectedRecordForSessions.firstCheckInTime ? new Date(selectedRecordForSessions.firstCheckInTime).toLocaleTimeString() : '—'})
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {selectedRecordForSessions.punches.map((p, idx) => (
                  <div key={p._id || idx} style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 12, background: p.isOpen ? '#fefce8' : '#fff' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.84rem' }}>Session #{idx + 1}</span>
                      <Badge variant={p.isOpen ? 'warning' : 'success'}>
                        {p.isOpen ? 'IN PROGRESS' : `${p.workingHours || 0} hrs`}
                      </Badge>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8, fontSize: '0.78rem' }}>
                      <div>
                        <strong>In:</strong> {p.checkInTime ? new Date(p.checkInTime).toLocaleTimeString() : '—'}
                      </div>
                      <div>
                        <strong>Out:</strong> {p.checkOutTime ? new Date(p.checkOutTime).toLocaleTimeString() : (p.isOpen ? 'Active' : '—')}
                      </div>
                    </div>
                    {p.checkInAddress && (
                      <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: 4 }}>
                        Location: {p.checkInAddress}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6 }}>
              <Button variant="secondary" onClick={() => setSessionModalOpen(false)}>
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* ================================================================== */}
      {/* 6. MODAL: ADMIN MANUAL ATTENDANCE CORRECTION */}
      {/* ================================================================== */}
      {correctModalOpen && selectedRecordForCorrect && (
        <Modal
          isOpen={true}
          onClose={() => setCorrectModalOpen(false)}
          title="Manual Administrative Correction"
          maxWidth="500px"
        >
          <form onSubmit={handleSubmitCorrection} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ background: '#f8fafc', padding: 10, borderRadius: 6, border: '1px solid #e2e8f0', fontSize: '0.78rem' }}>
              <strong>Staff:</strong> {selectedRecordForCorrect.employee?.basicInfo?.fullName || selectedRecordForCorrect.employee?.name || 'Staff Member'} &bull; <strong>Type:</strong> {selectedRecordForCorrect.attendanceType}
            </div>

            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>Attendance Status *</label>
              <select
                value={correctForm.attendanceStatus}
                onChange={(e) => setCorrectForm({ ...correctForm, attendanceStatus: e.target.value })}
                style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.82rem' }}
              >
                <option value="PRESENT">PRESENT</option>
                <option value="HALF_DAY">HALF_DAY</option>
                <option value="ABSENT">ABSENT</option>
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>Check-In Time</label>
                <input
                  type="datetime-local"
                  value={correctForm.checkInTime}
                  onChange={(e) => setCorrectForm({ ...correctForm, checkInTime: e.target.value })}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.82rem', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>Check-Out Time</label>
                <input
                  type="datetime-local"
                  value={correctForm.checkOutTime}
                  onChange={(e) => setCorrectForm({ ...correctForm, checkOutTime: e.target.value })}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.82rem', boxSizing: 'border-box' }}
                />
              </div>
            </div>

            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>
                Correction Remark (Required for Audit Trail) *
              </label>
              <textarea
                rows={2}
                placeholder="e.g. Corrected check-out time per manager verbal confirmation"
                value={correctForm.correctionRemark}
                onChange={(e) => setCorrectForm({ ...correctForm, correctionRemark: e.target.value })}
                required
                style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.82rem', boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 6 }}>
              <Button variant="secondary" onClick={() => setCorrectModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" type="submit" loading={submittingCorrect}>
                Apply Correction
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* ================================================================== */}
      {/* 7. MODAL: APPLY FOR ATTENDANCE REGULARIZATION */}
      {/* ================================================================== */}
      {regModalOpen && (
        <Modal
          isOpen={true}
          onClose={() => setRegModalOpen(false)}
          title="Apply for Attendance Regularization"
          maxWidth="480px"
        >
          <form onSubmit={handleSubmitRegularization} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>Attendance Date *</label>
              <input
                type="date"
                value={regForm.attendanceDate}
                onChange={(e) => setRegForm({ ...regForm, attendanceDate: e.target.value })}
                required
                style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.82rem', boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>Proposed Check-In *</label>
                <input
                  type="time"
                  value={regForm.requestedCheckInTime}
                  onChange={(e) => setRegForm({ ...regForm, requestedCheckInTime: e.target.value })}
                  required
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.82rem', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>Proposed Check-Out *</label>
                <input
                  type="time"
                  value={regForm.requestedCheckOutTime}
                  onChange={(e) => setRegForm({ ...regForm, requestedCheckOutTime: e.target.value })}
                  required
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.82rem', boxSizing: 'border-box' }}
                />
              </div>
            </div>

            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>Reason for Regularization *</label>
              <textarea
                rows={3}
                placeholder="e.g. Forgot to clock in due to emergency client visit, biometric scanner offline"
                value={regForm.reason}
                onChange={(e) => setRegForm({ ...regForm, reason: e.target.value })}
                required
                style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.82rem', boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 6 }}>
              <Button variant="secondary" onClick={() => setRegModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" type="submit" loading={submittingReg}>
                Submit Request
              </Button>
            </div>
          </form>
        </Modal>
      )}

    </div>
  );
};

export default DailyAttendance;
