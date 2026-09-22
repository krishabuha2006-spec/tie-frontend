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
  History, RefreshCw, Camera, Database, Search, XCircle, Loader2,
  ShieldCheck, AlertCircle, LogIn, LogOut,
} from 'lucide-react';
import CameraCapture from '../../components/common/CameraCapture';
import GeoLocationPicker from '../../components/common/GeoLocationPicker';
import Button from '../../components/common/Button';
import Select from '../../components/common/Select';
import Badge from '../../components/common/Badge';
import Table from '../../components/common/Table';
import ModuleSubNav from '../../components/common/ModuleSubNav';
import { attendanceNav } from '../../routes/moduleNavConfig';

const LiveClock = () => {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <span style={{ fontVariantNumeric: 'tabular-nums', letterSpacing: '0.04em' }}>
      {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
    </span>
  );
};

/* ─── Employee Picker ──────────────────────────────────────────────── */
const EmpPicker = ({ employees, value, onChange, label, getEmpName, getEmpCode, getEmpDept }) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = React.useRef(null);
  const selected = employees.find((e) => e._id === value);

  useEffect(() => {
    const handler = (ev) => { if (ref.current && !ref.current.contains(ev.target)) setOpen(false); };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const filtered = search
    ? employees.filter((e) =>
        getEmpName(e).toLowerCase().includes(search.toLowerCase()) ||
        String(getEmpCode(e)).toLowerCase().includes(search.toLowerCase())
      )
    : employees;

  const initials = (emp) => {
    const n = getEmpName(emp);
    const parts = n.split(' ');
    return parts.length >= 2 ? `${parts[0][0]}${parts[1][0]}`.toUpperCase() : n.slice(0, 2).toUpperCase();
  };

  const avatarBg = (emp) =>
    emp.isFaceEnrolled ? 'linear-gradient(135deg,#2e7b85,#3d9ba6)' : 'linear-gradient(135deg,#d97706,#f59e0b)';

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {label && <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: 8 }}>{label} <span style={{ color: '#ef4444' }}>*</span></div>}

      {/* Trigger */}
      <div
        onClick={() => setOpen((p) => !p)}
        style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '8px 12px', borderRadius: 10, cursor: 'pointer',
          border: open ? '1.5px solid var(--primary)' : '1.5px solid var(--border-dark)',
          background: '#fff',
          boxShadow: open ? '0 0 0 3px var(--primary-ring)' : 'none',
          transition: 'all 0.15s',
        }}
      >
        {selected ? (
          <>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: avatarBg(selected), display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: '0.75rem', flexShrink: 0 }}>
              {initials(selected)}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{getEmpName(selected)}</div>
              <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>{getEmpCode(selected)} · {getEmpDept(selected)}</div>
            </div>
            <div style={{ padding: '2px 8px', borderRadius: 12, fontSize: '0.7rem', fontWeight: 700, background: selected.isFaceEnrolled ? '#dcfce7' : '#fef3c7', color: selected.isFaceEnrolled ? '#166534' : '#92400e', flexShrink: 0 }}>
              {selected.isFaceEnrolled ? '✓ Enrolled' : 'Pending'}
            </div>
          </>
        ) : (
          <span style={{ fontSize: '0.85rem', color: 'var(--text-light)' }}>Select employee...</span>
        )}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginLeft: 'auto', color: 'var(--text-muted)', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }}><polyline points="6 9 12 15 18 9"/></svg>
      </div>

      {/* Dropdown */}
      {open && (
        <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, background: '#fff', border: '1.5px solid var(--primary-border)', borderRadius: 12, boxShadow: '0 10px 25px -5px rgba(46,123,133,0.2)', zIndex: 1100, overflow: 'hidden' }}>
          {employees.length > 5 && (
            <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Search size={13} color="var(--text-muted)" />
              <input autoFocus type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name or code..." style={{ border: 'none', outline: 'none', fontSize: '0.82rem', width: '100%', background: 'transparent', color: 'var(--text-main)' }} />
            </div>
          )}
          <div style={{ maxHeight: 240, overflowY: 'auto' }}>
            {filtered.length === 0 && <div style={{ padding: '12px 14px', fontSize: '0.82rem', color: 'var(--text-muted)', textAlign: 'center' }}>No employees found</div>}
            {filtered.map((emp) => {
              const isSelected = emp._id === value;
              return (
                <div key={emp._id}
                  onClick={() => { onChange(emp._id); setOpen(false); setSearch(''); }}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', cursor: 'pointer', background: isSelected ? 'var(--primary-subtle)' : 'transparent', transition: 'background 0.12s' }}
                  onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = 'var(--primary-light)'; }}
                  onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
                >
                  <div style={{ width: 34, height: 34, borderRadius: 8, background: avatarBg(emp), display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: '0.75rem', flexShrink: 0 }}>
                    {initials(emp)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: isSelected ? 700 : 500, fontSize: '0.87rem', color: isSelected ? 'var(--primary-active)' : 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{getEmpName(emp)}</div>
                    <div style={{ fontSize: '0.73rem', color: 'var(--text-muted)' }}>{getEmpCode(emp)} · {getEmpDept(emp)}</div>
                  </div>
                  <div style={{ padding: '2px 8px', borderRadius: 12, fontSize: '0.68rem', fontWeight: 700, background: emp.isFaceEnrolled ? '#dcfce7' : '#fef3c7', color: emp.isFaceEnrolled ? '#166534' : '#92400e', flexShrink: 0 }}>
                    {emp.isFaceEnrolled ? '✓ Enrolled' : 'Pending'}
                  </div>
                  {isSelected && <CheckCircle2 size={15} color="var(--primary)" style={{ flexShrink: 0 }} />}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export const FacePunch = () => {
  const { user, isSuperAdmin, isHrAdmin, isDirector, isBranchManager } = useAuth();
  const isOrgAdmin = isSuperAdmin || isHrAdmin || isDirector || isBranchManager;
  const [searchParams] = useSearchParams();
  const initialTab =
    searchParams.get('tab') === 'register' && isOrgAdmin ? 'REGISTER'
    : searchParams.get('tab') === 'logs' ? 'LOGS'
    : 'PUNCH';

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
  const [empActiveSession, setEmpActiveSession] = useState(null);

  const { showToast } = useToast();

  const getEmpName = (emp) =>
    emp?.basicInfo?.fullName || emp?.fullName ||
    (emp?.firstName ? `${emp.firstName} ${emp.lastName || ''}`.trim() : '') ||
    emp?.name || 'Employee';
  const getEmpCode = (emp) => emp?.basicInfo?.employeeCode || emp?.employeeCode || '-';
  const getEmpDept = (emp) =>
    emp?.employmentInfo?.department?.name || emp?.department?.name || emp?.department || 'General';

  const loadEmps = async () => {
    setLoadingEmps(true);
    try {
      const myId = user?.employee?._id || (typeof user?.employee === 'string' ? user.employee : null) || user?._id;
      if (!isOrgAdmin) {
        let selfEmp = typeof user?.employee === 'object' && user.employee !== null ? { ...user.employee } : {
          _id: myId, id: myId, fullName: user?.name || 'Current User',
          basicInfo: { fullName: user?.name, employeeCode: user?.employeeCode || 'SELF' },
          employmentInfo: { designation: user?.designation, department: user?.department },
        };
        let isEnrolled = false;
        if (myId) {
          try {
            const sData = await faceApi.getFaceStatus(myId);
            isEnrolled =
              sData?.isRegistered === true ||
              sData?.status === 'REGISTERED' ||
              sData?.status === 'ENROLLED' ||
              sData?.isEnrolled === true;
            selfEmp = { ...selfEmp, isFaceEnrolled: isEnrolled, faceRegistrationPending: !isEnrolled };
          } catch {}
        }
        setEmployees([selfEmp]);
        setRegEmpId(myId);
        setSelectedEmpId(myId);
        if (!searchParams.get('tab')) setActiveTab('PUNCH');
        return;
      }
      const res = await employeeApi.getEmployees({ limit: 200 });
      const list = res?.data || [];
      // Bulk face status check — single API call (or batched 5-at-a-time) instead of N individual calls
      const empIds = list.map((e) => e._id || e.id).filter(Boolean);
      const statusMap = await faceApi.getBulkFaceStatus(empIds);
      const enriched = list.map((emp) => {
        const empId = emp._id || emp.id;
        const sData = statusMap[empId] || {};
        const isEnrolled =
          sData?.isRegistered === true ||
          sData?.status === 'REGISTERED' ||
          sData?.status === 'ENROLLED' ||
          sData?.status === 'ACTIVE' ||
          sData?.data?.status === 'ENROLLED' ||
          sData?.data?.status === 'REGISTERED' ||
          sData?.data?.isRegistered === true ||
          sData?.isEnrolled === true;
        return { ...emp, isFaceEnrolled: isEnrolled, faceRegistrationPending: !isEnrolled };
      });
      setEmployees(enriched);
      const queryEmpId = searchParams.get('empId');
      if (queryEmpId && enriched.some((e) => e._id === queryEmpId)) {
        setRegEmpId(queryEmpId); setSelectedEmpId(queryEmpId);
      } else if (enriched.length > 0) {
        const pendingOne = enriched.find((e) => !e.isFaceEnrolled);
        setRegEmpId(pendingOne?._id || enriched[0]._id);
        setSelectedEmpId(myId || enriched[0]._id);
      }
    } catch { showToast('Failed to load employees', 'error'); }
    finally { setLoadingEmps(false); }
  };

  const loadLogs = async () => {
    setLoadingLogs(true);
    try {
      const myId = user?.employee?._id || (typeof user?.employee === 'string' ? user.employee : null) || user?._id;
      let res;
      if (isOrgAdmin) res = await faceApi.getAllFaceLogs({ limit: 20 });
      else if (myId) res = await faceApi.getEmployeeFaceLogs(myId, { limit: 20 });
      else res = { data: [] };
      setVerificationLogs(Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : Array.isArray(res?.logs) ? res.logs : []);
    } catch { setVerificationLogs([]); }
    finally { setLoadingLogs(false); }
  };

  const userEmpId = user?.employee?._id || (typeof user?.employee === 'string' ? user.employee : null) || user?._id;
  useEffect(() => {
    if (!userEmpId && !isOrgAdmin) return;
    loadEmps();
    loadLogs();
  }, [userEmpId, isOrgAdmin]);

  useEffect(() => {
    if (!selectedEmpId) return;
    (async () => {
      try {
        const res = await attendanceApi.getEmployeeOfficeAttendance(selectedEmpId, { limit: 5 });
        const list = Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : Array.isArray(res?.records) ? res.records : [];
        const open = list.find((r) => r.isOpen);
        setEmpActiveSession(open || null);
        if (open) setPunchMode('CHECK_OUT'); else setPunchMode('CHECK_IN');
      } catch { setEmpActiveSession(null); }
    })();
  }, [selectedEmpId]);

  const selectedRegEmployee = employees.find((e) => e._id === regEmpId);
  const selectedPunchEmployee = employees.find((e) => e._id === selectedEmpId) || employees[0];
  const pendingCount = employees.filter((e) => !e.isFaceEnrolled).length;
  const storedCount = employees.filter((e) => e.isFaceEnrolled).length;

  const filteredRegEmps = employees.filter((emp) => {
    if (regFilter === 'PENDING' && emp.isFaceEnrolled) return false;
    if (regFilter === 'STORED' && !emp.isFaceEnrolled) return false;
    if (regSearch) {
      const q = regSearch.toLowerCase();
      return getEmpName(emp).toLowerCase().includes(q) || String(getEmpCode(emp)).toLowerCase().includes(q);
    }
    return true;
  });

  const handleRegisterFace = async () => {
    if (!regEmpId) { showToast('Select an employee first', 'warning'); return; }
    if (!regPhoto) { showToast('Capture a photo first', 'warning'); return; }
    setRegistering(true); setRegSuccess(null);
    try {
      const empName = getEmpName(selectedRegEmployee);
      if (selectedRegEmployee?.isFaceEnrolled) {
        try { await faceApi.reEnrollFace(regEmpId, [regPhoto]); }
        catch { await faceApi.enrollFace(regEmpId, [regPhoto]); }
      } else { await faceApi.enrollFace(regEmpId, [regPhoto]); }
      showToast(`Face biometrics stored for ${empName}!`, 'success');
      setRegSuccess({ empName, timestamp: new Date().toLocaleTimeString() });
      setEmployees((prev) =>
        prev.map((e) => ((e._id || e.id) === regEmpId ? { ...e, isFaceEnrolled: true, faceRegistrationPending: false } : e))
      );
      await loadEmps();
    } catch (err) { showToast(err.response?.data?.message || 'Face registration failed', 'error'); }
    finally { setRegistering(false); }
  };

  const handleAutoRegister = async (img) => {
    setRegPhoto(img); setRegSuccess(null);
    if (!regEmpId) { showToast('Photo captured! Please select an employee to enroll.', 'warning'); return; }
    const empToRegister = employees.find((e) => e._id === regEmpId);
    const empName = getEmpName(empToRegister);
    setRegistering(true);
    try {
      if (empToRegister?.isFaceEnrolled) {
        try { await faceApi.reEnrollFace(regEmpId, [img]); }
        catch { await faceApi.enrollFace(regEmpId, [img]); }
      } else { await faceApi.enrollFace(regEmpId, [img]); }
      showToast(`Face captured & registered for ${empName}!`, 'success');
      setRegSuccess({ empName, timestamp: new Date().toLocaleTimeString() });
      setEmployees((prev) =>
        prev.map((e) => ((e._id || e.id) === regEmpId ? { ...e, isFaceEnrolled: true, faceRegistrationPending: false } : e))
      );
      await loadEmps();
    } catch (err) { showToast(err.response?.data?.message || 'Face registration failed', 'error'); }
    finally { setRegistering(false); }
  };

  const handlePunch = async () => {
    if (!selectedEmpId) { showToast('Select an employee', 'warning'); return; }
    const empObj = employees.find((e) => e._id === selectedEmpId) || selectedPunchEmployee;
    const empName = getEmpName(empObj);
    const empCode = getEmpCode(empObj);
    if (!empObj?.isFaceEnrolled) { showToast(`Face not registered for ${empName}. Please enroll face first.`, 'error'); return; }
    if (cameraError?.isPermissionDenied || (cameraError && !capturedPhoto)) { showToast('Camera permission denied', 'error'); return; }
    if (!capturedPhoto) { showToast('Capture a photo first', 'warning'); return; }

    const activeCoords = coords && !coords.gpsUnavailable && !coords.error
      ? coords : { latitude: 23.0225, longitude: 72.5714, gpsAccuracy: 15, isSimulated: true };

    setSubmitting(true); setPunchResult(null);
    try {
      let faceRes;
      try { faceRes = await faceApi.verifyFace(selectedEmpId, capturedPhoto, attendanceType); }
      catch (fErr) { faceRes = fErr.response?.data || { matched: false }; }
      const faceLogId = faceRes?.logId || faceRes?.data?.logId;
      const confidence = faceRes?.confidenceScore ?? faceRes?.data?.confidenceScore ?? 0;
      const matchResult = faceRes?.matchResult || faceRes?.data?.matchResult || (faceRes?.matched !== false ? 'MATCHED' : 'NOT_MATCHED');
      const isFaceMatched = faceRes?.matched !== false && faceRes?.data?.matched !== false &&
        matchResult !== 'NOT_MATCHED' && matchResult !== 'NO_FACE_DETECTED' && matchResult !== 'LOW_CONFIDENCE';
      if (!isFaceMatched) {
        setPunchResult({ success: false, reason: faceRes?.reason || faceRes?.data?.reason || `Face biometric mismatch (${Math.round(confidence * 100)}% match below threshold).`, empName, empCode });
        showToast('Face biometric match failed', 'error');
        setSubmitting(false); loadLogs(); return;
      }
      let geoRes;
      try {
        geoRes = await geoApi.resolveEmployeeLocation(selectedEmpId, { latitude: activeCoords.latitude, longitude: activeCoords.longitude, gpsAccuracy: activeCoords.gpsAccuracy || 15, attendanceType, faceVerificationLogId: faceLogId });
      } catch (gErr) { geoRes = gErr.response?.data || { permitted: false }; }
      const geoReason = geoRes?.reason || geoRes?.data?.reason || '';
      const isGeoNotConfigured = geoReason === 'GEOFENCE_NOT_CONFIGURED' || geoReason === 'NO_GEOFENCE_CONFIGURED';
      const isAllowed = isGeoNotConfigured || geoRes?.permitted !== false || geoRes?.data?.permitted !== false || (geoRes?.withinGeoFence !== false && geoRes?.data?.withinGeoFence !== false);
      if (!isAllowed && geoRes?.status === 'OUTSIDE') {
        setPunchResult({ success: false, reason: geoReason || 'Outside authorized geofence', empName, empCode });
        showToast('Outside authorized location boundary', 'error'); setSubmitting(false); return;
      }
      const addressStr = geoRes?.address || geoRes?.data?.address || `${activeCoords.latitude?.toFixed(4)}, ${activeCoords.longitude?.toFixed(4)}`;
      const now = new Date();
      const baseLocation = {
        latitude: activeCoords.latitude,
        longitude: activeCoords.longitude,
        gpsAccuracy: activeCoords.gpsAccuracy || 15,
      };

      if (punchMode === 'CHECK_IN') {
        if (attendanceType === 'OFFICE') {
          await attendanceApi.officeCheckIn({
            ...baseLocation,
            capturedImage: capturedPhoto,
            confidenceScore: confidence,
          });
        } else if (attendanceType === 'FIELD') {
          await attendanceApi.fieldCheckIn({
            ...baseLocation,
            capturedImage: capturedPhoto,
            confidenceScore: confidence,
          });
        } else {
          await attendanceApi.siteCheckIn({
            ...baseLocation,
            capturedImage: capturedPhoto,
            confidenceScore: confidence,
            faceVerificationLogId: faceLogId,
          });
        }
      } else {
        if (attendanceType === 'OFFICE') {
          await attendanceApi.officeCheckOut({
            ...baseLocation,
            remarks: `Face checked out at ${addressStr}`,
          });
        } else if (attendanceType === 'FIELD') {
          await attendanceApi.fieldCheckOut({
            ...baseLocation,
            remarks: `Field checked out at ${addressStr}`,
          });
        } else {
          await attendanceApi.siteCheckOut(baseLocation);
        }
      }
      showToast(`${punchMode === 'CHECK_IN' ? 'Check-In' : 'Check-Out'} recorded successfully!`, 'success');
      setPunchResult({ success: true, punchMode, attendanceType, empName, empCode, confidence: Math.round(confidence * 100), address: addressStr, time: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), date: now.toLocaleDateString() });
      loadLogs();
    } catch (err) {
      const msg = err.response?.data?.message || 'Attendance punch failed';
      showToast(msg, 'error'); setPunchResult({ success: false, reason: msg, empName, empCode }); loadLogs();
    } finally { setSubmitting(false); }
  };

  const logColumns = [
    { header: 'Employee', key: 'employee', render: (r) => (<div><div style={{ fontWeight: 600, fontSize: '0.88rem' }}>{getEmpName(r.employee)}</div><div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{getEmpCode(r.employee)}</div></div>) },
    { header: 'Verdict', key: 'matchResult', render: (r) => { const v = r.matchResult || 'UNKNOWN'; const variant = v === 'MATCHED' ? 'success' : v === 'LOW_CONFIDENCE' ? 'warning' : 'danger'; return <Badge variant={variant}>{v.replace(/_/g, ' ')}</Badge>; } },
    { header: 'Confidence', key: 'confidenceScore', render: (r) => <span style={{ fontWeight: 600 }}>{r.confidenceScore != null ? `${Math.round(r.confidenceScore * 100)}%` : '—'}</span> },
    { header: 'Type', key: 'triggeredByModule', render: (r) => <Badge variant="neutral">{r.triggeredByModule || 'OFFICE'}</Badge> },
    { header: 'Date & Time', key: 'attemptedAt', render: (r) => <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{r.attemptedAt ? new Date(r.attemptedAt).toLocaleString() : '—'}</span> },
  ];

  const TABS = !isOrgAdmin
    ? [{ key: 'PUNCH', label: 'Daily Punch', icon: UserCheck }, { key: 'LOGS', label: 'My Face Logs', icon: History }]
    : [
        { key: 'REGISTER', label: 'Face Registration', icon: UserPlus, badge: pendingCount > 0 ? pendingCount : null },
        { key: 'PUNCH', label: 'Daily Punch', icon: UserCheck },
        { key: 'LOGS', label: 'Verification Logs', icon: History },
      ];

  const typeColors = { OFFICE: 'var(--primary)', FIELD: '#d97706', SITE: '#7c3aed' };

  const S = {
    page: { display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 1080, margin: '0 auto' },
    pageHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', padding: '16px 20px', boxShadow: 'var(--shadow-xs)' },
    iconWrap: { width: 42, height: 42, borderRadius: 10, background: 'linear-gradient(135deg, var(--primary-light), var(--primary-subtle))', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--primary-border)' },
    stat: { display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem', padding: '5px 12px', borderRadius: 20, background: 'var(--bg-subtle)', border: '1px solid var(--border-color)' },
    tabBar: { display: 'flex', gap: 4, background: 'var(--bg-subtle)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', padding: 4 },
    tabBtn: (active) => ({ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 18px', fontSize: '0.85rem', fontWeight: active ? 700 : 500, color: active ? 'var(--primary)' : 'var(--text-muted)', background: active ? 'var(--bg-surface)' : 'transparent', border: 'none', borderRadius: 10, cursor: 'pointer', transition: 'all 0.15s', boxShadow: active ? 'var(--shadow-sm)' : 'none' }),
    card: { background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', padding: 24, boxShadow: 'var(--shadow-xs)' },
    cardHeader: { display: 'flex', alignItems: 'center', gap: 10, paddingBottom: 16, marginBottom: 16, borderBottom: '1px solid var(--border-light)' },
    cardIconWrap: (color) => ({ width: 32, height: 32, borderRadius: 8, background: color || 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }),
    sectionTitle: { fontSize: '0.95rem', fontWeight: 700, margin: 0, color: 'var(--text-main)' },
    sectionSub: { fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 1 },
    filterBtn: (active) => ({ padding: '5px 14px', fontSize: '0.78rem', fontWeight: active ? 700 : 500, border: `1px solid ${active ? 'var(--primary)' : 'var(--border-color)'}`, borderRadius: 20, background: active ? 'var(--primary)' : 'transparent', color: active ? '#fff' : 'var(--text-muted)', cursor: 'pointer', transition: 'all 0.15s' }),
    empCard: { padding: '12px 14px', borderRadius: 10, background: 'var(--bg-subtle)', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
    typeBtn: (active, color) => ({ padding: '9px 0', fontSize: '0.82rem', fontWeight: active ? 700 : 500, border: `1.5px solid ${active ? (color || 'var(--primary)') : 'var(--border-color)'}`, borderRadius: 8, textAlign: 'center', background: active ? (color || 'var(--primary)') : 'transparent', color: active ? '#fff' : 'var(--text-muted)', cursor: 'pointer', transition: 'all 0.15s' }),
    punchToggle: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0, border: '1.5px solid var(--border-color)', borderRadius: 10, overflow: 'hidden' },
    punchBtn: (active, isOut) => ({ padding: '12px 0', fontSize: '0.85rem', fontWeight: active ? 700 : 500, border: 'none', background: active ? (isOut ? 'linear-gradient(135deg,#dc2626,#ef4444)' : 'linear-gradient(135deg,var(--primary),var(--primary-hover))') : 'var(--bg-subtle)', color: active ? '#fff' : 'var(--text-muted)', cursor: 'pointer', transition: 'all 0.18s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }),
    timeBanner: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderRadius: 10, background: 'linear-gradient(135deg,#f0f9ff,#e0f2fe)', border: '1px solid #bae6fd' },
    mainBtn: (mode) => ({ width: '100%', padding: '14px', fontSize: '0.95rem', fontWeight: 700, borderRadius: 12, border: 'none', cursor: 'pointer', background: mode === 'CHECK_OUT' ? 'linear-gradient(135deg,#dc2626,#ef4444)' : 'linear-gradient(135deg,var(--primary),#3d9ba6)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, boxShadow: mode === 'CHECK_OUT' ? '0 4px 14px rgba(220,38,38,0.35)' : '0 4px 14px rgba(46,123,133,0.35)', transition: 'all 0.2s', letterSpacing: '0.02em' }),
    resultOk: { padding: '16px 18px', borderRadius: 12, background: 'linear-gradient(135deg,#f0fdf4,#dcfce7)', border: '1px solid var(--success-border)' },
    resultFail: { padding: '16px 18px', borderRadius: 12, background: 'linear-gradient(135deg,#fef2f2,#fee2e2)', border: '1px solid var(--danger-border)' },
    resultRow: { display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: 6 },
    sessionBanner: { padding: '9px 14px', borderRadius: 8, background: '#eff6ff', border: '1px solid #bfdbfe', display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8rem', color: '#1e40af' },
    alertWarn: { padding: '9px 14px', borderRadius: 8, background: 'var(--warning-light)', border: '1px solid var(--warning-border)', display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8rem', color: '#92400e' },
    alertErr: { padding: '9px 14px', borderRadius: 8, background: 'var(--danger-light)', border: '1px solid var(--danger-border)', display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8rem', color: 'var(--danger)' },
    alertOk: { padding: '9px 14px', borderRadius: 8, background: 'var(--success-light)', border: '1px solid var(--success-border)', display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8rem', color: 'var(--success)' },
  };

  return (
    <div style={S.page}>
      <ModuleSubNav items={attendanceNav} />

      {/* Page Header */}
      <div style={S.pageHeader}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={S.iconWrap}><ScanFace size={20} color="var(--primary)" /></div>
          <div>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>Face Registration &amp; Biometric Punch</h2>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0 }}>Live face verification &amp; GPS-authenticated attendance</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {isOrgAdmin && (<>
            <div style={{ ...S.stat, color: '#92400e' }}><AlertCircle size={13} color="#d97706" /><span>Pending: <strong>{pendingCount}</strong></span></div>
            <div style={{ ...S.stat, color: 'var(--success)' }}><ShieldCheck size={13} color="var(--success)" /><span>Enrolled: <strong>{storedCount}</strong></span></div>
          </>)}
          <Button variant="light" size="sm" icon={RefreshCw} onClick={() => { loadEmps(); loadLogs(); }}>Refresh</Button>
        </div>
      </div>

      {/* Tab Bar */}
      <div style={S.tabBar}>
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button key={tab.key} type="button" onClick={() => setActiveTab(tab.key)} style={S.tabBtn(isActive)}>
              <Icon size={15} /><span>{tab.label}</span>
              {tab.badge && <span style={{ background: '#dc2626', color: '#fff', borderRadius: 10, padding: '1px 7px', fontSize: '0.68rem', fontWeight: 700 }}>{tab.badge}</span>}
            </button>
          );
        })}
      </div>

      {/* TAB: REGISTER */}
      {activeTab === 'REGISTER' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div style={S.card}>
            <div style={S.cardHeader}>
              <div style={S.cardIconWrap('var(--primary-light)')}><Camera size={16} color="var(--primary)" /></div>
              <div><div style={S.sectionTitle}>Live Registration Camera</div><div style={S.sectionSub}>Position employee face in frame</div></div>
            </div>
            {loadingEmps ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 220, gap: 10, color: 'var(--text-muted)' }}>
                <Loader2 size={22} style={{ animation: 'spin 1s linear infinite' }} />
                <span style={{ fontSize: '0.88rem' }}>Loading employee list...</span>
              </div>
            ) : (
              <CameraCapture onCapture={handleAutoRegister} label="Look into camera to register" />
            )}
            {registering && <div style={{ ...S.alertOk, marginTop: 12 }}><Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> Storing face biometrics...</div>}
            {regPhoto && !registering && !regSuccess && <div style={{ ...S.alertOk, marginTop: 12 }}><CheckCircle2 size={15} /> Photo captured successfully.</div>}
            {regSuccess && (
              <div style={{ ...S.resultOk, marginTop: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--success)', fontWeight: 700, fontSize: '0.9rem' }}><CheckCircle2 size={17} /> Face Registered Successfully</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 4 }}>{regSuccess.empName} — {regSuccess.timestamp}</div>
              </div>
            )}
          </div>

          <div style={S.card}>
            <div style={S.cardHeader}>
              <div style={S.cardIconWrap('#f0fdf4')}><Database size={16} color="var(--success)" /></div>
              <div><div style={S.sectionTitle}>Employee Biometric Enrollment</div><div style={S.sectionSub}>Select employee to register or re-enroll</div></div>
            </div>
            {isOrgAdmin && (<>
              <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
                {[{ key: 'ALL', label: 'All' }, { key: 'PENDING', label: `Pending (${pendingCount})` }, { key: 'STORED', label: `Enrolled (${storedCount})` }].map((f) => (
                  <button key={f.key} type="button" onClick={() => setRegFilter(f.key)} style={S.filterBtn(regFilter === f.key)}>{f.label}</button>
                ))}
              </div>
              <div style={{ position: 'relative', marginBottom: 14 }}>
                <Search size={13} color="var(--text-muted)" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
                <input type="text" className="form-control" placeholder="Search employee..." value={regSearch} onChange={(e) => setRegSearch(e.target.value)} style={{ paddingLeft: 30, fontSize: '0.83rem', height: 36 }} />
              </div>
              <EmpPicker
                employees={filteredRegEmps}
                value={regEmpId}
                onChange={(id) => { setRegEmpId(id); setRegPhoto(null); setRegSuccess(null); }}
                label="Select Employee"
                getEmpName={getEmpName}
                getEmpCode={getEmpCode}
                getEmpDept={getEmpDept}
              />

            </>)}
            {selectedRegEmployee && (
              <div style={{ ...S.empCard, marginTop: 14 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--text-main)' }}>{getEmpName(selectedRegEmployee)}</div>
                  <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: 2 }}>{getEmpCode(selectedRegEmployee)} · {getEmpDept(selectedRegEmployee)}</div>
                </div>
                <Badge variant={selectedRegEmployee.isFaceEnrolled ? 'success' : 'warning'}>{selectedRegEmployee.isFaceEnrolled ? '✓ Enrolled' : 'Pending'}</Badge>
              </div>
            )}
            <Button variant="primary" icon={ScanFace} loading={registering} onClick={handleRegisterFace} disabled={!regPhoto || !regEmpId}
              style={{ width: '100%', marginTop: 18, padding: '12px', fontWeight: 600, borderRadius: 10 }}>
              {selectedRegEmployee?.isFaceEnrolled ? 'Update / Re-Enroll Biometrics' : 'Register & Store Face'}
            </Button>
          </div>
        </div>
      )}

      {/* TAB: PUNCH */}
      {activeTab === 'PUNCH' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {/* Left — Camera */}
          <div style={S.card}>
            <div style={S.cardHeader}>
              <div style={S.cardIconWrap('var(--primary-light)')}><Camera size={16} color="var(--primary)" /></div>
              <div><div style={S.sectionTitle}>Face Verification Camera Feed</div><div style={S.sectionSub}>Live biometric capture for attendance</div></div>
            </div>
            <CameraCapture
              onCapture={(img) => { setCapturedPhoto(img); setCameraError(null); setPunchResult(null); }}
              onError={(err) => setCameraError(err)}
              label="Capture for Verification"
            />
            {capturedPhoto && <div style={{ ...S.alertOk, marginTop: 12 }}><CheckCircle2 size={15} /> Photo captured — ready to verify.</div>}
            {cameraError && <div style={{ ...S.alertErr, marginTop: 12 }}><XCircle size={15} /> {cameraError.error || 'Camera unavailable'}</div>}
          </div>

          {/* Right — Details */}
          <div style={S.card}>
            <div style={S.cardHeader}>
              <div style={S.cardIconWrap('var(--primary-light)')}><UserCheck size={16} color="var(--primary)" /></div>
              <div><div style={S.sectionTitle}>Attendance Details</div><div style={S.sectionSub}>Employee, type &amp; mode</div></div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Employee */}
              {isOrgAdmin ? (
                <EmpPicker
                  employees={employees}
                  value={selectedEmpId}
                  onChange={(id) => { setSelectedEmpId(id); setCapturedPhoto(null); setPunchResult(null); }}
                  label="Select Employee"
                  getEmpName={getEmpName}
                  getEmpCode={getEmpCode}
                  getEmpDept={getEmpDept}
                />

              ) : (
                <div style={S.empCard}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--text-main)' }}>{selectedPunchEmployee ? getEmpName(selectedPunchEmployee) : (user?.name || 'My Profile')}</div>
                    <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: 2 }}>{selectedPunchEmployee ? getEmpCode(selectedPunchEmployee) : (user?.employeeCode || 'SELF')} · {selectedPunchEmployee ? getEmpDept(selectedPunchEmployee) : (user?.department?.name || 'Staff')}</div>
                  </div>
                  <Badge variant={selectedPunchEmployee?.isFaceEnrolled ? 'success' : 'warning'}>{selectedPunchEmployee?.isFaceEnrolled ? '✓ Face Enrolled' : 'Face Pending'}</Badge>
                </div>
              )}

              {selectedPunchEmployee && !selectedPunchEmployee.isFaceEnrolled && (
                <div style={S.alertWarn}><AlertCircle size={15} color="#d97706" /> Biometrics not enrolled. Register face before punching.</div>
              )}

              {/* Attendance Type */}
              <div>
                <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: 8 }}>Attendance Type</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                  {['OFFICE', 'FIELD', 'SITE'].map((t) => (
                    <button key={t} type="button" onClick={() => setAttendanceType(t)} style={S.typeBtn(attendanceType === t, typeColors[t])}>{t}</button>
                  ))}
                </div>
              </div>

              {/* Punch Mode */}
              <div>
                <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: 8 }}>Action Mode</div>
                {empActiveSession && (
                  <div style={{ ...S.sessionBanner, marginBottom: 8 }}>
                    <Clock size={14} color="#2563eb" /> Active session detected — mode set to <strong style={{ marginLeft: 3 }}>Check-Out</strong>.
                  </div>
                )}
                <div style={S.punchToggle}>
                  <button type="button" onClick={() => setPunchMode('CHECK_IN')} style={S.punchBtn(punchMode === 'CHECK_IN', false)}><LogIn size={15} /> Punch IN (Check-In)</button>
                  <button type="button" onClick={() => setPunchMode('CHECK_OUT')} style={S.punchBtn(punchMode === 'CHECK_OUT', true)}><LogOut size={15} /> Punch OUT (Check-Out)</button>
                </div>
              </div>

              {/* Time Banner */}
              <div style={S.timeBanner}>
                <div>
                  <div style={{ fontSize: '0.72rem', color: '#0284c7', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Date &amp; Time Stamp</div>
                  <div style={{ fontWeight: 700, fontSize: '1rem', color: '#0c4a6e', marginTop: 2 }}>{new Date().toISOString().split('T')[0]}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.72rem', color: '#0284c7', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Live Clock</div>
                  <div style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--primary)', marginTop: 2 }}><LiveClock /></div>
                </div>
              </div>

              {/* GPS */}
              <div>
                <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <MapPin size={14} color="#0284c7" /> GPS Location Resolver
                </div>
                <GeoLocationPicker onLocationChange={(c) => { setCoords(c); if (c && !c.gpsUnavailable) setPunchResult(null); }} />
              </div>

              {/* Punch Button */}
              {!punchResult && (
                <button type="button" onClick={handlePunch} disabled={submitting || !capturedPhoto || !selectedEmpId}
                  style={{ ...S.mainBtn(punchMode), opacity: (submitting || !capturedPhoto || !selectedEmpId) ? 0.65 : 1 }}>
                  {submitting ? (<><Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> Verifying biometrics...</>)
                    : punchMode === 'CHECK_IN' ? (<><LogIn size={18} /> Confirm Check-In with Face &amp; GPS</>)
                    : (<><LogOut size={18} /> Confirm Check-Out with Face &amp; GPS</>)}
                </button>
              )}

              {/* Punch Result */}
              {punchResult && (
                <div style={punchResult.success ? S.resultOk : S.resultFail}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9, fontWeight: 700, fontSize: '0.95rem', color: punchResult.success ? 'var(--success)' : 'var(--danger)' }}>
                    {punchResult.success ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
                    {punchResult.success ? `${punchResult.punchMode === 'CHECK_IN' ? 'Check-In' : 'Check-Out'} Recorded` : 'Attendance Rejected'}
                  </div>
                  <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 5 }}>
                    <div style={S.resultRow}><UserCheck size={13} /><span><strong>{punchResult.empName}</strong> ({punchResult.empCode})</span></div>
                    {punchResult.success ? (<>
                      <div style={S.resultRow}><ScanFace size={13} /><span>Face Match: <strong>{punchResult.confidence}%</strong> confidence</span></div>
                      <div style={S.resultRow}><MapPin size={13} /><span>{punchResult.address}</span></div>
                      <div style={S.resultRow}><Clock size={13} /><span>{punchResult.time} — {punchResult.date}</span></div>
                      <Button variant="light" size="sm" icon={RefreshCw} onClick={() => { setCapturedPhoto(null); setCoords(null); setPunchResult(null); }} style={{ marginTop: 8, alignSelf: 'flex-start' }}>New Punch</Button>
                    </>) : (<>
                      <div style={{ ...S.resultRow, color: 'var(--danger)' }}><AlertCircle size={13} /><span>{punchResult.reason}</span></div>
                      <Button variant="light" size="sm" icon={RefreshCw} onClick={() => { setCapturedPhoto(null); setPunchResult(null); }} style={{ marginTop: 8, alignSelf: 'flex-start' }}>Retry</Button>
                    </>)}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB: LOGS */}
      {activeTab === 'LOGS' && (
        <div style={S.card}>
          <div style={{ ...S.cardHeader, marginBottom: 0 }}>
            <div style={S.cardIconWrap('var(--primary-light)')}><History size={16} color="var(--primary)" /></div>
            <div style={{ flex: 1 }}><div style={S.sectionTitle}>Biometric Verification Log</div><div style={S.sectionSub}>Recent face scan attempts &amp; results</div></div>
            <Button variant="light" size="sm" icon={RefreshCw} onClick={loadLogs} loading={loadingLogs}>Refresh</Button>
          </div>
          <div style={{ marginTop: 16 }}>
            <Table columns={logColumns} data={verificationLogs} loading={loadingLogs} emptyMessage="No verification logs found." />
          </div>
        </div>
      )}
    </div>
  );
};

export default FacePunch;
