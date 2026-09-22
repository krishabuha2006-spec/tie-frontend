import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import faceApi from '../../api/faceApi';
import geoApi from '../../api/geoApi';
import attendanceApi from '../../api/attendanceApi';
import employeeApi from '../../api/employeeApi';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import {
  ScanFace, MapPin, CheckCircle2, Clock, UserCheck, UserPlus,
  History, RefreshCw, Camera, Check, Database, Search, XCircle, Loader2, Building2,
} from 'lucide-react';
import CameraCapture from '../../components/common/CameraCapture';
import GeoLocationPicker from '../../components/common/GeoLocationPicker';
import Button from '../../components/common/Button';
import Select from '../../components/common/Select';
import Badge from '../../components/common/Badge';
import Table from '../../components/common/Table';
import ModuleSubNav from '../../components/common/ModuleSubNav';
import { attendanceNav } from '../../routes/moduleNavConfig';

export const FacePunch = () => {
  const { user, isSuperAdmin, isHrAdmin, isDirector, isBranchManager } = useAuth();
  const isOrgAdmin = isSuperAdmin || isHrAdmin || isDirector || isBranchManager;
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') === 'punch' ? 'PUNCH' : searchParams.get('tab') === 'logs' ? 'LOGS' : 'REGISTER';

  const [activeTab, setActiveTab] = useState(initialTab);
  const [employees, setEmployees] = useState([]);
  const [loadingEmps, setLoadingEmps] = useState(false);

  const [regEmpId, setRegEmpId] = useState('');
  const [regFilter, setRegFilter] = useState('ALL');
  const [regSearch, setRegSearch] = useState('');
  const [regPhoto, setRegPhoto] = useState(null);
  const [registering, setRegistering] = useState(false);
  const [regSuccess, setRegSuccess] = useState(null);

  const [selectedEmpId, setSelectedEmpId] = useState('');
  const [attendanceType, setAttendanceType] = useState('OFFICE');
  const [punchMode, setPunchMode] = useState('CHECK_IN');
  const [capturedPhoto, setCapturedPhoto] = useState(null);
  const [coords, setCoords] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [punchResult, setPunchResult] = useState(null);
  const [cameraError, setCameraError] = useState(null);

  const [verificationLogs, setVerificationLogs] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  const { showToast } = useToast();

  const getEmpName = (emp) =>
    emp?.basicInfo?.fullName ||
    emp?.fullName ||
    (emp?.firstName ? `${emp.firstName} ${emp.lastName || ''}`.trim() : '') ||
    emp?.name ||
    'Employee';

  const getEmpCode = (emp) =>
    emp?.basicInfo?.employeeCode || emp?.employeeCode || '-';

  const getEmpDept = (emp) =>
    emp?.employmentInfo?.department?.name || emp?.department?.name || emp?.department || 'General';

  const loadEmps = async () => {
    setLoadingEmps(true);
    try {
      const myId = user?.employee?._id || (typeof user?.employee === 'string' ? user.employee : null) || user?._id;
      if (!isOrgAdmin) {
        let selfEmp = typeof user?.employee === 'object' && user.employee !== null ? { ...user.employee } : {
          _id: myId,
          id: myId,
          fullName: user?.name || 'Current User',
          basicInfo: { fullName: user?.name, employeeCode: user?.employeeCode || 'SELF' },
          employmentInfo: { designation: user?.designation, department: user?.department },
        };
        let isEnrolled = false;
        if (myId) {
          try {
            const statusRes = await faceApi.getFaceStatus(myId);
            isEnrolled = statusRes?.status === 'ENROLLED' || statusRes?.isEnrolled === true;
            selfEmp = {
              ...selfEmp,
              isFaceEnrolled: isEnrolled,
              faceRegistrationPending: !isEnrolled,
            };
          } catch {}
        }
        setEmployees([selfEmp]);
        setRegEmpId(myId);
        setSelectedEmpId(myId);
        // If employee has registered face, default directly to PUNCH tab
        if (isEnrolled && !searchParams.get('tab')) {
          setActiveTab('PUNCH');
        }
        return;
      }

      const res = await employeeApi.getEmployees({ limit: 200 });
      const list = res?.data || [];
      // Enrich each employee with real face status from backend
      const enriched = await Promise.all(
        list.map(async (emp) => {
          try {
            const statusRes = await faceApi.getFaceStatus(emp._id || emp.id);
            const isEnrolled = statusRes?.status === 'ENROLLED' || statusRes?.isEnrolled === true;
            return {
              ...emp,
              isFaceEnrolled: isEnrolled,
              faceRegistrationPending: !isEnrolled,
            };
          } catch {
            return {
              ...emp,
              isFaceEnrolled: false,
              faceRegistrationPending: true,
            };
          }
        })
      );
      setEmployees(enriched);
      const queryEmpId = searchParams.get('empId');
      if (queryEmpId && enriched.some((e) => e._id === queryEmpId)) {
        setRegEmpId(queryEmpId);
        setSelectedEmpId(queryEmpId);
      } else if (enriched.length > 0) {
        const pendingOne = enriched.find((e) => !e.isFaceEnrolled);
        setRegEmpId(pendingOne?._id || enriched[0]._id);
        setSelectedEmpId(myId || enriched[0]._id);
      }
    } catch {
      showToast('Failed to load employees', 'error');
    } finally {
      setLoadingEmps(false);
    }
  };

  const loadLogs = async () => {
    setLoadingLogs(true);
    try {
      const res = await faceApi.getAllFaceLogs({ limit: 20 });
      setVerificationLogs(Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : []);
    } catch {
      setVerificationLogs([]);
    } finally {
      setLoadingLogs(false);
    }
  };

  const [empActiveSession, setEmpActiveSession] = useState(null);

  useEffect(() => { loadEmps(); loadLogs(); }, [user]);

  useEffect(() => {
    if (!selectedEmpId) return;
    (async () => {
      try {
        const res = await attendanceApi.getEmployeeOfficeAttendance(selectedEmpId, { limit: 5 });
        const list = Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : Array.isArray(res?.records) ? res.records : [];
        const open = list.find((r) => r.isOpen);
        setEmpActiveSession(open || null);
        if (open) {
          setPunchMode('CHECK_OUT');
        } else {
          setPunchMode('CHECK_IN');
        }
      } catch {
        setEmpActiveSession(null);
      }
    })();
  }, [selectedEmpId]);

  const selectedRegEmployee = employees.find((e) => e._id === regEmpId);
  const pendingCount = employees.filter((e) => !e.isFaceEnrolled).length;
  const storedCount = employees.filter((e) => e.isFaceEnrolled).length;

  const filteredRegEmps = employees.filter((emp) => {
    const isEnrolled = emp.isFaceEnrolled;
    if (regFilter === 'PENDING' && isEnrolled) return false;
    if (regFilter === 'STORED' && !isEnrolled) return false;
    if (regSearch) {
      const q = regSearch.toLowerCase();
      const name = getEmpName(emp).toLowerCase();
      return name.includes(q) || String(getEmpCode(emp)).toLowerCase().includes(q);
    }
    return true;
  });

  const handleRegisterFace = async () => {
    if (!regEmpId) { showToast('Select an employee first', 'warning'); return; }
    if (!regPhoto) { showToast('Capture a photo first', 'warning'); return; }
    setRegistering(true);
    setRegSuccess(null);
    try {
      const empName = getEmpName(selectedRegEmployee);
      if (selectedRegEmployee?.isFaceEnrolled) {
        try { await faceApi.reEnrollFace(regEmpId, [regPhoto]); }
        catch { await faceApi.enrollFace(regEmpId, [regPhoto]); }
      } else {
        await faceApi.enrollFace(regEmpId, [regPhoto]);
      }
      showToast(`✓ Face biometrics stored and registered for ${empName}!`, 'success');
      setRegSuccess({ empName, timestamp: new Date().toLocaleTimeString() });
      await loadEmps();
    } catch (err) {
      showToast(err.response?.data?.message || 'Face registration failed', 'error');
    } finally {
      setRegistering(false);
    }
  };

  // Auto-register face immediately upon camera capture
  const handleAutoRegister = async (img) => {
    setRegPhoto(img);
    setRegSuccess(null);
    if (!regEmpId) {
      showToast('Photo captured! Please select an employee to enroll.', 'warning');
      return;
    }
    const empToRegister = employees.find((e) => e._id === regEmpId);
    const empName = getEmpName(empToRegister);
    setRegistering(true);
    try {
      if (empToRegister?.isFaceEnrolled) {
        try { await faceApi.reEnrollFace(regEmpId, [img]); }
        catch { await faceApi.enrollFace(regEmpId, [img]); }
      } else {
        await faceApi.enrollFace(regEmpId, [img]);
      }
      showToast(`✓ Face captured & registered for ${empName}!`, 'success');
      setRegSuccess({ empName, timestamp: new Date().toLocaleTimeString() });
      await loadEmps();
    } catch (err) {
      showToast(err.response?.data?.message || 'Face registration failed', 'error');
    } finally {
      setRegistering(false);
    }
  };

  const handlePunch = async () => {
    if (!selectedEmpId) { showToast('Select an employee', 'warning'); return; }
    const empObj = employees.find((e) => e._id === selectedEmpId);
    const empName = getEmpName(empObj);
    const empCode = getEmpCode(empObj);
    // Guard: Face must be registered before attendance
    if (!empObj?.isFaceEnrolled) {
      showToast(`Face not registered for ${empName}. Go to Face Registration tab first.`, 'error');
      return;
    }
    if (cameraError?.isPermissionDenied || (cameraError && !capturedPhoto)) { showToast('Camera permission denied', 'error'); return; }
    if (!capturedPhoto) { showToast('Capture a photo first', 'warning'); return; }
    if (!coords || coords.error) { showToast('GPS location not available. Use "Use Office Location" button.', 'error'); return; }
    setSubmitting(true);
    setPunchResult(null);
    try {
      let faceRes;
      try { faceRes = await faceApi.verifyFace(selectedEmpId, capturedPhoto, attendanceType); }
      catch (fErr) { faceRes = fErr.response?.data || { matched: false }; }
      const faceLogId = faceRes?.logId || faceRes?.data?.logId;
      const confidence = faceRes?.confidenceScore ?? faceRes?.data?.confidenceScore ?? 0;
      const matchResult = faceRes?.matchResult || faceRes?.data?.matchResult || (faceRes?.matched !== false ? 'MATCHED' : 'NOT_MATCHED');
      const isFaceMatched = faceRes?.matched !== false && faceRes?.data?.matched !== false && matchResult !== 'NOT_MATCHED' && matchResult !== 'NO_FACE_DETECTED' && matchResult !== 'LOW_CONFIDENCE';
      if (!isFaceMatched) {
        setPunchResult({ success: false, reason: faceRes?.reason || faceRes?.data?.reason || `Face mismatch (${Math.round(confidence * 100)}%)`, empName, empCode });
        showToast('Face biometric match failed', 'error');
        setSubmitting(false);
        loadLogs();
        return;
      }
      let geoRes;
      try {
        geoRes = await geoApi.resolveEmployeeLocation(selectedEmpId, { latitude: coords.latitude, longitude: coords.longitude, gpsAccuracy: coords.gpsAccuracy || 15, attendanceType, faceVerificationLogId: faceLogId });
      } catch (gErr) { geoRes = gErr.response?.data || { permitted: false }; }
      // GEOFENCE_NOT_CONFIGURED = no fence set up → allow attendance
      const geoReason = geoRes?.reason || geoRes?.data?.reason || '';
      const isGeoNotConfigured = geoReason === 'GEOFENCE_NOT_CONFIGURED' || geoReason === 'NO_GEOFENCE_CONFIGURED';
      const isAllowed = isGeoNotConfigured || geoRes?.permitted !== false || geoRes?.data?.permitted !== false ||
        (geoRes?.withinGeoFence !== false && geoRes?.data?.withinGeoFence !== false);
      if (!isAllowed && geoRes?.status === 'OUTSIDE') {
        setPunchResult({ success: false, reason: geoReason || 'Outside authorized geofence', empName, empCode });
        showToast('Outside authorized location boundary', 'error');
        setSubmitting(false);
        return;
      }
      const addressStr = geoRes?.address || geoRes?.data?.address || `${coords.latitude?.toFixed(4)}, ${coords.longitude?.toFixed(4)}`;
      const now = new Date();
      const punchPayload = {
        latitude: coords.latitude, longitude: coords.longitude, address: addressStr,
        date: now.toISOString().split('T')[0],
        time: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        gpsAccuracy: coords.gpsAccuracy || 15, attendanceType, employee: selectedEmpId,
        faceVerificationStatus: matchResult, faceVerificationLogId: faceLogId,
        capturedImage: capturedPhoto, photoUrl: capturedPhoto, confidenceScore: confidence,
        remarks: `Face verified (${Math.round(confidence * 100)}%) at ${addressStr}`,
      };
      if (punchMode === 'CHECK_IN') {
        if (attendanceType === 'OFFICE') await attendanceApi.officeCheckIn(punchPayload);
        else if (attendanceType === 'FIELD') await attendanceApi.fieldCheckIn(punchPayload);
        else await attendanceApi.siteCheckIn(punchPayload);
      } else {
        if (attendanceType === 'OFFICE') await attendanceApi.officeCheckOut(punchPayload);
        else if (attendanceType === 'FIELD') await attendanceApi.fieldCheckOut(punchPayload);
        else await attendanceApi.siteCheckOut(punchPayload);
      }
      showToast(`${punchMode === 'CHECK_IN' ? 'Check-In' : 'Check-Out'} recorded!`, 'success');
      setPunchResult({ success: true, punchMode, attendanceType, empName, empCode, confidence: Math.round(confidence * 100), address: addressStr, time: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), date: now.toLocaleDateString() });
      loadLogs();
    } catch (err) {
      const msg = err.response?.data?.message || 'Attendance punch failed';
      showToast(msg, 'error');
      setPunchResult({ success: false, reason: msg, empName, empCode });
      loadLogs();
    } finally {
      setSubmitting(false);
    }
  };

  const logColumns = [
    {
      header: 'Employee',
      key: 'employee',
      render: (r) => (
        <div>
          <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>{getEmpName(r.employee)}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{getEmpCode(r.employee)}</div>
        </div>
      ),
    },
    { header: 'Verdict', key: 'matchResult', render: (r) => { const v = r.matchResult || 'UNKNOWN'; const variant = v === 'MATCHED' ? 'success' : v === 'LOW_CONFIDENCE' ? 'warning' : 'danger'; return <Badge variant={variant}>{v.replace(/_/g, ' ')}</Badge>; } },
    { header: 'Confidence', key: 'confidenceScore', render: (r) => <span style={{ fontWeight: 600 }}>{r.confidenceScore != null ? `${Math.round(r.confidenceScore * 100)}%` : '—'}</span> },
    { header: 'Type', key: 'triggeredByModule', render: (r) => <Badge variant="neutral">{r.triggeredByModule || 'OFFICE'}</Badge> },
    { header: 'Date & Time', key: 'attemptedAt', render: (r) => <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{r.attemptedAt ? new Date(r.attemptedAt).toLocaleString() : '—'}</span> },
  ];

  const TABS = [
    { key: 'REGISTER', label: 'Face Registration', icon: UserPlus, badge: pendingCount > 0 ? pendingCount : null },
    { key: 'PUNCH', label: 'Daily Punch', icon: UserCheck },
    { key: 'LOGS', label: 'Verification Logs', icon: History },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 1100, margin: '0 auto' }}>
      <ModuleSubNav items={attendanceNav} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <ScanFace size={20} color="var(--primary)" />
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>Face Registration & Biometric Punch</h2>
        </div>
        <div style={{ display: 'flex', gap: 20, alignItems: 'center', fontSize: '0.82rem' }}>
          <span>Pending: <strong style={{ color: '#d97706' }}>{pendingCount}</strong></span>
          <span>Enrolled: <strong style={{ color: '#16a34a' }}>{storedCount}</strong></span>
          <Button variant="light" size="sm" icon={RefreshCw} onClick={() => { loadEmps(); loadLogs(); }}>Refresh</Button>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid var(--border-color)' }}>
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button key={tab.key} type="button" onClick={() => setActiveTab(tab.key)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '10px 18px', fontSize: '0.88rem', fontWeight: isActive ? 700 : 500, color: isActive ? 'var(--primary)' : 'var(--text-muted)', background: 'none', border: 'none', borderBottom: isActive ? '2px solid var(--primary)' : '2px solid transparent', marginBottom: -2, cursor: 'pointer', transition: 'all 0.15s' }}>
              <Icon size={15} />
              <span>{tab.label}</span>
              {tab.badge && <span style={{ backgroundColor: '#dc2626', color: '#fff', borderRadius: 10, padding: '1px 6px', fontSize: '0.7rem', fontWeight: 700 }}>{tab.badge}</span>}
            </button>
          );
        })}
      </div>
      {activeTab === 'REGISTER' && (
        <div className="responsive-split-2">
          <div className="card" style={{ padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <Camera size={17} color="var(--primary)" />
              <h3 style={{ fontSize: '0.95rem', fontWeight: 600, margin: 0 }}>Live Registration Camera</h3>
            </div>
            {loadingEmps ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 200, gap: 10, color: 'var(--text-muted)' }}>
                <Loader2 size={22} style={{ animation: 'spin 1s linear infinite' }} />
                <span style={{ fontSize: '0.88rem' }}>Loading employees...</span>
              </div>
            ) : (
              <CameraCapture onCapture={handleAutoRegister} label="Look into camera to register" />
            )}
            {registering && (
              <div style={{ marginTop: 10, padding: '8px 12px', backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 8, color: '#1d4ed8', fontSize: '0.82rem' }}>
                <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> Storing face biometrics on backend...
              </div>
            )}
            {regPhoto && !registering && !regSuccess && (
              <div style={{ marginTop: 10, padding: '8px 12px', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 8, color: '#166534', fontSize: '0.82rem' }}>
                <CheckCircle2 size={15} /> Photo captured.
              </div>
            )}
            {regSuccess && (
              <div style={{ marginTop: 10, padding: '12px 14px', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#166534', fontWeight: 700, fontSize: '0.9rem', marginBottom: 4 }}>
                  <CheckCircle2 size={17} /> Face Registered Successfully
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{regSuccess.empName} — {regSuccess.timestamp}</div>
              </div>
            )}
          </div>
          <div className="card" style={{ padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <Database size={17} color="var(--primary)" />
              <h3 style={{ fontSize: '0.95rem', fontWeight: 600, margin: 0 }}>Employee Biometric Enrollment</h3>
            </div>
            {isOrgAdmin ? (
              <>
                <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                  {[{ key: 'ALL', label: 'All' }, { key: 'PENDING', label: `Pending (${pendingCount})` }, { key: 'STORED', label: `Enrolled (${storedCount})` }].map((f) => (
                    <button key={f.key} type="button" onClick={() => setRegFilter(f.key)}
                      className={`btn ${regFilter === f.key ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                      style={{ fontSize: '0.78rem', padding: '3px 10px' }}>{f.label}</button>
                  ))}
                </div>
                <div style={{ position: 'relative', marginBottom: 12 }}>
                  <Search size={13} color="var(--text-muted)" style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)' }} />
                  <input type="text" className="form-control" placeholder="Search employee..." value={regSearch} onChange={(e) => setRegSearch(e.target.value)} style={{ paddingLeft: 28, fontSize: '0.84rem', height: 34 }} />
                </div>
                <Select label="Select Employee" value={regEmpId}
                  onChange={(e) => { setRegEmpId(e.target.value); setRegPhoto(null); setRegSuccess(null); }}
                  options={filteredRegEmps.map((e) => {
                    const statusTag = e.isFaceEnrolled ? '[Enrolled] ' : '[Pending] ';
                    return { value: e._id, label: `${statusTag}${getEmpCode(e)} — ${getEmpName(e)} (${getEmpDept(e)})` };
                  })} required />
              </>
            ) : null}
            {selectedRegEmployee && (
              <div style={{ marginTop: 12, padding: '12px 14px', backgroundColor: 'var(--bg-secondary)', borderRadius: 8, border: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{getEmpName(selectedRegEmployee)}</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{getEmpCode(selectedRegEmployee)} &middot; {getEmpDept(selectedRegEmployee)}</div>
                  </div>
                  <Badge variant={selectedRegEmployee.isFaceEnrolled ? 'success' : 'warning'}>{selectedRegEmployee.isFaceEnrolled ? 'Enrolled' : 'Pending'}</Badge>
                </div>
              </div>
            )}
            <Button variant="primary" icon={ScanFace} loading={registering} onClick={handleRegisterFace} disabled={!regPhoto || !regEmpId} style={{ width: '100%', marginTop: 16, padding: '11px', fontWeight: 600 }}>
              {selectedRegEmployee?.isFaceEnrolled ? 'Update / Re-Enroll Biometrics' : 'Register & Store Face'}
            </Button>
          </div>
        </div>
      )}
      {activeTab === 'PUNCH' && (
        <div className="responsive-split-2">
          <div className="card" style={{ padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <Camera size={17} color="var(--primary)" />
              <h3 style={{ fontSize: '0.95rem', fontWeight: 600, margin: 0 }}>Face Verification Camera</h3>
            </div>
            <CameraCapture onCapture={(img) => { setCapturedPhoto(img); setCameraError(null); setPunchResult(null); }} onError={(err) => setCameraError(err)} label="Capture for Verification" />
            {capturedPhoto && (
              <div style={{ marginTop: 10, padding: '8px 12px', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 8, color: '#166534', fontSize: '0.82rem' }}>
                <CheckCircle2 size={15} /> Photo captured. Ready to verify.
              </div>
            )}
            {cameraError && (
              <div style={{ marginTop: 10, padding: '8px 12px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 8, color: '#dc2626', fontSize: '0.82rem' }}>
                <XCircle size={15} /> {cameraError.error || 'Camera unavailable'}
              </div>
            )}
          </div>
          <div className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
              <UserCheck size={17} color="var(--primary)" />
              <h3 style={{ fontSize: '0.95rem', fontWeight: 600, margin: 0 }}>Attendance Details</h3>
            </div>
            {isOrgAdmin ? (
              <Select label="Employee" value={selectedEmpId}
                onChange={(e) => { setSelectedEmpId(e.target.value); setCapturedPhoto(null); setPunchResult(null); }}
                options={employees.map((e) => {
                  const statusTag = e.isFaceEnrolled ? '✓ ' : '⚠️ [Pending Face] ';
                  return { value: e._id, label: `${statusTag}${getEmpCode(e)} — ${getEmpName(e)} (${getEmpDept(e)})` };
                })} required />
            ) : (
              <div
                style={{
                  padding: '12px 14px',
                  borderRadius: 8,
                  backgroundColor: 'var(--bg-subtle)',
                  border: '1px solid var(--border-color)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--text-main)' }}>
                    {selectedEmployee ? getEmpName(selectedEmployee) : (user?.name || 'My Profile')}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    {selectedEmployee ? getEmpCode(selectedEmployee) : (user?.employeeCode || 'SELF')} &bull; {selectedEmployee ? getEmpDept(selectedEmployee) : (user?.department?.name || 'Staff')}
                  </div>
                </div>
                <Badge variant={selectedEmployee?.isFaceEnrolled ? 'success' : 'warning'}>
                  {selectedEmployee?.isFaceEnrolled ? 'Face Enrolled' : 'Face Pending'}
                </Badge>
              </div>
            )}
            <div>
              <label className="form-label" style={{ fontWeight: 600, marginBottom: 6, display: 'block' }}>Attendance Type</label>
              <div style={{ display: 'flex', gap: 6 }}>
                {['OFFICE', 'FIELD', 'SITE'].map((t) => (
                  <button key={t} type="button" onClick={() => setAttendanceType(t)}
                    className={`btn ${attendanceType === t ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                    style={{ flex: 1 }}>{t}</button>
                ))}
              </div>
            </div>
            <div>
              {empActiveSession && (
                <div style={{ padding: '8px 12px', borderRadius: 6, backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', fontSize: '0.78rem', color: '#1e40af', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <Clock size={14} color="#2563eb" />
                  <span>Active session on duty. Mode automatically switched to <strong>Check-Out</strong>.</span>
                </div>
              )}
              <label className="form-label" style={{ fontWeight: 600, marginBottom: 6, display: 'block' }}>Punch Mode</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <button type="button" onClick={() => setPunchMode('CHECK_IN')} className={`btn ${punchMode === 'CHECK_IN' ? 'btn-primary' : 'btn-secondary'} btn-sm`}>Check-In</button>
                <button type="button" onClick={() => setPunchMode('CHECK_OUT')} className="btn btn-secondary btn-sm" style={punchMode === 'CHECK_OUT' ? { backgroundColor: '#dc2626', color: '#fff', borderColor: '#dc2626' } : {}}>Check-Out</button>
              </div>
            </div>
            <div>
              <label className="form-label" style={{ fontWeight: 600, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                <MapPin size={14} color="#0284c7" /> GPS Location
              </label>
              <GeoLocationPicker onLocationChange={(c) => { setCoords(c); if (c && !c.gpsUnavailable) setPunchResult(null); }} />
            </div>
            <Button variant="primary" icon={punchMode === 'CHECK_IN' ? Check : Clock} loading={submitting} onClick={handlePunch} disabled={!capturedPhoto || !selectedEmpId || !coords} style={{ padding: '11px', fontWeight: 600 }}>
              {submitting ? 'Verifying...' : punchMode === 'CHECK_IN' ? 'Submit Check-In' : 'Submit Check-Out'}
            </Button>
            {punchResult && (
              <div style={{ padding: '14px 16px', borderRadius: 8, border: `1px solid ${punchResult.success ? '#bbf7d0' : '#fecaca'}`, backgroundColor: punchResult.success ? '#f0fdf4' : '#fef2f2' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, color: punchResult.success ? '#166534' : '#dc2626', marginBottom: 6 }}>
                  {punchResult.success ? <CheckCircle2 size={17} /> : <XCircle size={17} />}
                  {punchResult.success ? `${punchResult.punchMode === 'CHECK_IN' ? 'Check-In' : 'Check-Out'} Recorded` : 'Attendance Rejected'}
                </div>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-main)', display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <div><strong>Employee:</strong> {punchResult.empName} ({punchResult.empCode})</div>
                  {punchResult.success ? (
                    <>
                      <div><strong>Face Match:</strong> {punchResult.confidence}% confidence</div>
                      <div><strong>Location:</strong> {punchResult.address}</div>
                      <div><strong>Time:</strong> {punchResult.time} — {punchResult.date}</div>
                    </>
                  ) : (
                    <div><strong>Reason:</strong> {punchResult.reason}</div>
                  )}
                </div>
                {punchResult.success && (
                  <Button variant="light" size="sm" icon={RefreshCw} onClick={() => { setCapturedPhoto(null); setCoords(null); setPunchResult(null); }} style={{ marginTop: 10 }}>New Punch</Button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
      {activeTab === 'LOGS' && (
        <div className="card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <History size={17} color="var(--primary)" />
              <h3 style={{ fontSize: '0.95rem', fontWeight: 600, margin: 0 }}>Biometric Verification Log</h3>
            </div>
            <Button variant="light" size="sm" icon={RefreshCw} onClick={loadLogs} loading={loadingLogs}>Refresh</Button>
          </div>
          <Table columns={logColumns} data={verificationLogs} loading={loadingLogs} emptyMessage="No verification logs found." />
        </div>
      )}
    </div>
  );
};

export default FacePunch;
