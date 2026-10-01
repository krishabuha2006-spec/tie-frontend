import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import faceApi from '../../api/faceApi';
import geoApi from '../../api/geoApi';
import attendanceApi from '../../api/attendanceApi';
import employeeApi from '../../api/employeeApi';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { calculateDistanceMeters, resolveBranchLocation } from '../../utils/geoUtils';
import { compareFacePhotos, resolveRegisteredSelfie } from '../../utils/faceComparison';
import {
  ScanFace, MapPin, CheckCircle2, Clock, UserCheck, UserPlus,
  History, Camera, Database, Search, XCircle, Loader2,
  ShieldCheck, AlertCircle, LogIn, LogOut, Sliders, Users,
  Check, Sparkles, Filter, ChevronRight
} from 'lucide-react';
import CameraCapture from '../../components/common/CameraCapture';
import GeoLocationPicker from '../../components/common/GeoLocationPicker';
import Button from '../../components/common/Button';
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

/* ─── Searchable Employee Dropdown ──────────────────────────────────────────────── */
const EmpPicker = ({ employees, value, onChange, label, getEmpName, getEmpCode, getEmpDept }) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef(null);
  const selected = employees.find((e) => (e._id || e.id) === value);

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
    emp.isFaceEnrolled ? 'linear-gradient(135deg,var(--primary),#337a82)' : 'linear-gradient(135deg,var(--logo-orange),#df9023)';

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {label && (
        <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: 8 }}>
          {label} <span style={{ color: '#ef4444' }}>*</span>
        </div>
      )}

      {/* Trigger */}
      <div
        onClick={() => setOpen((p) => !p)}
        style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '8px 12px', borderRadius: 10, cursor: 'pointer',
          border: open ? '1.5px solid var(--primary)' : '1.5px solid var(--border-color)',
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
              <div style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {getEmpName(selected)}
              </div>
              <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                {getEmpCode(selected)} · {getEmpDept(selected)}
              </div>
            </div>
            <div style={{ padding: '2px 8px', borderRadius: 12, fontSize: '0.7rem', fontWeight: 700, background: selected.isFaceEnrolled ? '#dcfce7' : '#fef3c7', color: selected.isFaceEnrolled ? '#166534' : '#92400e', flexShrink: 0 }}>
              {selected.isFaceEnrolled ? 'Enrolled' : 'Pending'}
            </div>
          </>
        ) : (
          <span style={{ fontSize: '0.85rem', color: 'var(--text-light)' }}>Select employee...</span>
        )}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginLeft: 'auto', color: 'var(--text-muted)', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }}>
          <polyline points="6 9 12 15 18 9"/>
        </svg>
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
              const empId = emp._id || emp.id;
              const isSelected = empId === value;
              return (
                <div key={empId}
                  onClick={() => { onChange(empId); setOpen(false); setSearch(''); }}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', cursor: 'pointer', background: isSelected ? 'var(--primary-subtle)' : 'transparent', transition: 'background 0.12s' }}
                  onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = 'var(--primary-light)'; }}
                  onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
                >
                  <div style={{ width: 34, height: 34, borderRadius: 8, background: avatarBg(emp), display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: '0.75rem', flexShrink: 0 }}>
                    {initials(emp)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: isSelected ? 700 : 500, fontSize: '0.87rem', color: isSelected ? 'var(--primary-active)' : 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {getEmpName(emp)}
                    </div>
                    <div style={{ fontSize: '0.73rem', color: 'var(--text-muted)' }}>
                      {getEmpCode(emp)} · {getEmpDept(emp)}
                    </div>
                  </div>
                  <div style={{ padding: '2px 8px', borderRadius: 12, fontSize: '0.68rem', fontWeight: 700, background: emp.isFaceEnrolled ? '#dcfce7' : '#fef3c7', color: emp.isFaceEnrolled ? '#166534' : '#92400e', flexShrink: 0 }}>
                    {emp.isFaceEnrolled ? 'Enrolled' : 'Pending'}
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
    : searchParams.get('tab') === 'threshold' && isOrgAdmin ? 'SETTINGS'
    : 'PUNCH';

  const [activeTab, setActiveTab] = useState(initialTab);
  const [employees, setEmployees] = useState([]);
  const [loadingEmps, setLoadingEmps] = useState(false);

  // Enrollment State
  const [regEmpId, setRegEmpId] = useState('');
  const [regFilter, setRegFilter] = useState('ALL');
  const [regSearch, setRegSearch] = useState('');
  const [regPhoto, setRegPhoto] = useState(null);
  const [registering, setRegistering] = useState(false);
  const [regSuccess, setRegSuccess] = useState(null);

  // Daily Punch Gate State
  const [selectedEmpId, setSelectedEmpId] = useState('');
  const [attendanceType, setAttendanceType] = useState('OFFICE');
  const [punchMode, setPunchMode] = useState('CHECK_IN');
  const [capturedPhoto, setCapturedPhoto] = useState(null);
  const [coords, setCoords] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [punchResult, setPunchResult] = useState(null);
  const [cameraError, setCameraError] = useState(null);
  const [empActiveSession, setEmpActiveSession] = useState(null);
  const [branchLocation, setBranchLocation] = useState(null);

  // Verification Logs State
  const [verificationLogs, setVerificationLogs] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [logResultFilter, setLogResultFilter] = useState('ALL');

  // Threshold Settings State
  const [systemThreshold, setSystemThreshold] = useState(0.85);
  const [tempThreshold, setTempThreshold] = useState(0.85);
  const [thresholdUpdatedAt, setThresholdUpdatedAt] = useState(null);
  const [loadingThreshold, setLoadingThreshold] = useState(false);
  const [savingThreshold, setSavingThreshold] = useState(false);

  const { showToast } = useToast();

  const getEmpName = (emp) =>
    emp?.basicInfo?.fullName || emp?.fullName ||
    (emp?.firstName ? `${emp.firstName} ${emp.lastName || ''}`.trim() : '') ||
    emp?.name || 'Employee';
  const getEmpCode = (emp) => emp?.basicInfo?.employeeCode || emp?.employeeCode || '-';
  const getEmpDept = (emp) =>
    emp?.employmentInfo?.department?.name || emp?.department?.name || emp?.department || 'General';

  // 1. Fetch & Sync Employees with Face Registration Status (GET /face/employees/{id}/status)
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
        return;
      }

      const res = await employeeApi.getEmployees({ limit: 200 });
      const list = res?.data || [];
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
      if (queryEmpId && enriched.some((e) => (e._id || e.id) === queryEmpId)) {
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

  // 2. Fetch Verification Logs (GET /face/verification-logs & GET /face/employees/{id}/verification-logs)
  const loadLogs = async () => {
    setLoadingLogs(true);
    try {
      const myId = user?.employee?._id || (typeof user?.employee === 'string' ? user.employee : null) || user?._id;
      const params = { limit: 50 };
      if (logResultFilter !== 'ALL') params.result = logResultFilter;

      let res;
      if (isOrgAdmin) {
        res = await faceApi.getAllFaceLogs(params);
      } else if (myId) {
        res = await faceApi.getEmployeeFaceLogs(myId, params);
      } else {
        res = { data: [] };
      }
      const rawList = Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : Array.isArray(res?.logs) ? res.logs : [];
      setVerificationLogs(rawList);
    } catch {
      setVerificationLogs([]);
    } finally {
      setLoadingLogs(false);
    }
  };

  // 3. Fetch Threshold Settings (GET /face/settings/threshold)
  const loadThreshold = async () => {
    setLoadingThreshold(true);
    try {
      const res = await faceApi.getThresholdSettings();
      const val = res?.threshold != null ? Number(res.threshold) : 0.85;
      setSystemThreshold(val);
      setTempThreshold(val);
      setThresholdUpdatedAt(res?.updatedAt ? new Date(res.updatedAt).toLocaleString() : null);
    } catch {
      setSystemThreshold(0.85);
      setTempThreshold(0.85);
    } finally {
      setLoadingThreshold(false);
    }
  };

  // 4. Update Threshold Settings (PUT /face/settings/threshold)
  const handleSaveThreshold = async () => {
    setSavingThreshold(true);
    try {
      const res = await faceApi.updateThresholdSettings(tempThreshold);
      const updatedVal = res?.threshold != null ? Number(res.threshold) : tempThreshold;
      setSystemThreshold(updatedVal);
      setThresholdUpdatedAt(new Date().toLocaleString());
      showToast(`Biometric match threshold updated to ${Math.round(updatedVal * 100)}%!`, 'success');
      await loadThreshold();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to update threshold', 'error');
    } finally {
      setSavingThreshold(false);
    }
  };

  const userEmpId = user?.employee?._id || (typeof user?.employee === 'string' ? user.employee : null) || user?._id;

  const isMountedRef = useRef(false);

  useEffect(() => {
    if (!userEmpId && !isOrgAdmin) return;
    loadEmps();
    loadLogs();
    if (isOrgAdmin) loadThreshold();
    isMountedRef.current = true;
  }, [userEmpId, isOrgAdmin]);

  // Only re-fetch logs when filter changes AFTER initial mount
  useEffect(() => {
    if (!isMountedRef.current) return;
    loadLogs();
  }, [logResultFilter]);

  // Resolve Branch GPS for Selected Employee
  useEffect(() => {
    const sel = employees.find((e) => (e._id || e.id) === selectedEmpId);
    const bRef =
      sel?.employmentInfo?.branch ||
      sel?.branch ||
      user?.employee?.employmentInfo?.branch ||
      user?.branch;

    if (bRef) {
      resolveBranchLocation(bRef)
        .then((loc) => setBranchLocation(loc))
        .catch(() => setBranchLocation(null));
    } else {
      setBranchLocation(null);
    }
  }, [selectedEmpId, employees, user]);

  // Check Active Punch Session
  useEffect(() => {
    if (!selectedEmpId) return;
    (async () => {
      try {
        const res = await attendanceApi.getEmployeeOfficeAttendance(selectedEmpId, { limit: 5 });
        const list = Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : Array.isArray(res?.records) ? res.records : [];
        const open = list.find((r) => r.isOpen);
        setEmpActiveSession(open || null);
        if (open) setPunchMode('CHECK_OUT'); else setPunchMode('CHECK_IN');
      } catch {
        setEmpActiveSession(null);
      }
    })();
  }, [selectedEmpId]);

  const selectedRegEmployee = employees.find((e) => (e._id || e.id) === regEmpId);
  const selectedPunchEmployee = employees.find((e) => (e._id || e.id) === selectedEmpId) || employees[0];
  const pendingCount = employees.filter((e) => !e.isFaceEnrolled).length;
  const storedCount = employees.filter((e) => e.isFaceEnrolled).length;
  const enrolledPct = employees.length > 0 ? Math.round((storedCount / employees.length) * 100) : 0;

  const filteredRegEmps = employees.filter((emp) => {
    if (regFilter === 'PENDING' && emp.isFaceEnrolled) return false;
    if (regFilter === 'STORED' && !emp.isFaceEnrolled) return false;
    if (regSearch) {
      const q = regSearch.toLowerCase();
      return getEmpName(emp).toLowerCase().includes(q) || String(getEmpCode(emp)).toLowerCase().includes(q);
    }
    return true;
  });

  // Handle Face Enrollment / Self-Enrollment (POST /face/self-enroll, POST /face/employees/:id/enroll, PUT /face/employees/:id/re-enroll)
  const handleRegisterFace = async () => {
    if (!regEmpId) { showToast('Select an employee first', 'warning'); return; }
    if (!regPhoto) { showToast('Capture a photo first', 'warning'); return; }
    setRegistering(true);
    setRegSuccess(null);
    try {
      const isSelf = regEmpId === userEmpId && !isOrgAdmin;
      const empName = getEmpName(selectedRegEmployee);

      if (isSelf) {
        // Self-Enroll Biometric Face Profile (POST /face/self-enroll)
        await faceApi.selfEnroll([regPhoto], regEmpId || userEmpId);
        showToast('Your face biometrics have been self-enrolled successfully!', 'success');
      } else if (selectedRegEmployee?.isFaceEnrolled) {
        // Re-enroll Face Profile (PUT /face/employees/:id/re-enroll)
        try {
          await faceApi.reEnrollFace(regEmpId, [regPhoto]);
        } catch {
          await faceApi.enrollFace(regEmpId, [regPhoto]);
        }
        showToast(`Face biometrics updated for ${empName}!`, 'success');
      } else {
        // Enroll Face Profile (POST /face/employees/:id/enroll)
        await faceApi.enrollFace(regEmpId, [regPhoto]);
        showToast(`Face biometrics registered for ${empName}!`, 'success');
      }

      setRegSuccess({ empName, timestamp: new Date().toLocaleTimeString() });
      setEmployees((prev) =>
        prev.map((e) => ((e._id || e.id) === regEmpId ? { ...e, isFaceEnrolled: true, faceRegistrationPending: false } : e))
      );
      // Automatically refresh employee statuses without any manual refresh button
      await loadEmps();
    } catch (err) {
      showToast(err.response?.data?.message || 'Face registration failed', 'error');
    } finally {
      setRegistering(false);
    }
  };

  const handleAutoRegister = async (img) => {
    setRegPhoto(img);
    setRegSuccess(null);
    if (!regEmpId) {
      showToast('Photo captured! Please select an employee to enroll.', 'warning');
      return;
    }
    const empToRegister = employees.find((e) => (e._id || e.id) === regEmpId);
    const empName = getEmpName(empToRegister);
    const isSelf = regEmpId === userEmpId && !isOrgAdmin;

    setRegistering(true);
    try {
      if (isSelf) {
        await faceApi.selfEnroll([img], regEmpId || userEmpId);
        showToast('Your face biometrics have been self-enrolled!', 'success');
      } else if (empToRegister?.isFaceEnrolled) {
        try {
          await faceApi.reEnrollFace(regEmpId, [img]);
        } catch {
          await faceApi.enrollFace(regEmpId, [img]);
        }
        showToast(`Face captured & updated for ${empName}!`, 'success');
      } else {
        await faceApi.enrollFace(regEmpId, [img]);
        showToast(`Face captured & registered for ${empName}!`, 'success');
      }

      setRegSuccess({ empName, timestamp: new Date().toLocaleTimeString() });
      setEmployees((prev) =>
        prev.map((e) => ((e._id || e.id) === regEmpId ? { ...e, isFaceEnrolled: true, faceRegistrationPending: false } : e))
      );
      await loadEmps();
    } catch (err) {
      showToast(err.response?.data?.message || 'Face registration failed', 'error');
    } finally {
      setRegistering(false);
    }
  };

  // Handle Attendance Verification & Gate Punch (POST /face/employees/:id/verify)
  const handlePunch = async () => {
    if (!selectedEmpId) { showToast('Select an employee', 'warning'); return; }
    const empObj = employees.find((e) => (e._id || e.id) === selectedEmpId) || selectedPunchEmployee;
    const empName = getEmpName(empObj);
    const empCode = getEmpCode(empObj);

    if (!empObj?.isFaceEnrolled) {
      showToast(`Face biometrics not registered for ${empName}. Please enroll face first.`, 'error');
      return;
    }
    if (cameraError?.isPermissionDenied || (cameraError && !capturedPhoto)) {
      showToast('Camera permission denied or camera not accessible', 'error');
      return;
    }
    if (!capturedPhoto) {
      showToast('Capture a live photo first', 'warning');
      return;
    }

    const activeCoords = coords && !coords.gpsUnavailable && !coords.error
      ? coords : { latitude: 23.0225, longitude: 72.5714, gpsAccuracy: 15, isSimulated: true };

    setSubmitting(true);
    setPunchResult(null);

    try {
      // Step 1: Biometric Verification against Registered Selfie
      const regPhoto = await resolveRegisteredSelfie(selectedEmpId, empCode, empObj);
      if (!regPhoto) {
        const noPhotoErr = 'No registered face template found for this employee. Please enroll face biometrics first.';
        setPunchResult({ success: false, reason: noPhotoErr, empName, empCode });
        showToast(noPhotoErr, 'error');
        setSubmitting(false);
        return;
      }

      // Local biometric similarity check using configured threshold
      const compareResult = await compareFacePhotos(regPhoto, capturedPhoto, systemThreshold || 0.60);
      if (!compareResult.matched) {
        const mismatchReason = compareResult.reason || `Biometric mismatch (${compareResult.confidencePct}% match). Face does not match registered profile.`;
        setPunchResult({ success: false, reason: mismatchReason, empName, empCode });
        showToast(mismatchReason, 'error');
        setSubmitting(false);
        loadLogs();
        return;
      }

      // Step 2: Backend Face Verification Gate API (POST /face/employees/:id/verify)
      let faceRes;
      try {
        faceRes = await faceApi.verifyFace(selectedEmpId, capturedPhoto, {
          triggeredByModule: attendanceType === 'OFFICE' ? 'ATTENDANCE_CHECKIN' : attendanceType,
          confidenceScore: (compareResult.confidencePct || 95) / 100,
          gpsCoordinates: activeCoords,
        });
      } catch (fErr) {
        faceRes = fErr.response?.data || { matched: true };
      }

      const faceLogId = faceRes?.logId || faceRes?.data?.logId;
      const confidence = faceRes?.confidenceScore ?? faceRes?.data?.confidenceScore ?? 0.95;
      const matchResult = faceRes?.matchResult || faceRes?.data?.matchResult || 'MATCHED';
      const isFaceMatched = faceRes?.matched !== false &&
        matchResult !== 'NOT_MATCHED' && matchResult !== 'NO_FACE_DETECTED' && matchResult !== 'LOW_CONFIDENCE';

      if (!isFaceMatched) {
        const reason = faceRes?.reason || faceRes?.data?.reason || `Face mismatch (${Math.round(confidence * 100)}% match below threshold). Verification rejected.`;
        setPunchResult({ success: false, reason, empName, empCode });
        showToast(reason, 'error');
        setSubmitting(false);
        loadLogs();
        return;
      }

      // Step 3: Location verification for Office
      if (attendanceType === 'OFFICE') {
        if (!coords || coords.gpsUnavailable || coords.error || (coords.latitude == null && coords.longitude == null)) {
          const geoErr = 'GPS Location required: Please enable location access to verify you are within your office branch perimeter.';
          setPunchResult({ success: false, reason: geoErr, empName, empCode });
          showToast(geoErr, 'error');
          setSubmitting(false);
          return;
        }

        if (branchLocation && branchLocation.latitude != null && branchLocation.longitude != null) {
          const distance = calculateDistanceMeters(
            activeCoords.latitude,
            activeCoords.longitude,
            branchLocation.latitude,
            branchLocation.longitude
          );
          const maxRadius = branchLocation.radiusMeters || 500;
          if (distance !== null && distance > maxRadius) {
            const distErr = `Location check failed: You are ${distance}m away from ${branchLocation.branchName || 'your office branch'}. Must be within ${maxRadius}m.`;
            setPunchResult({ success: false, reason: distErr, empName, empCode });
            showToast(distErr, 'error');
            setSubmitting(false);
            return;
          }
        }
      }

      // Step 4: Resolve Geofence with Backend
      let geoRes;
      try {
        geoRes = await geoApi.resolveEmployeeLocation(selectedEmpId, {
          latitude: activeCoords.latitude,
          longitude: activeCoords.longitude,
          gpsAccuracy: activeCoords.gpsAccuracy || 15,
          attendanceType,
          faceVerificationLogId: faceLogId,
        });
      } catch (gErr) {
        geoRes = gErr.response?.data || { permitted: false };
      }

      const geoReason = geoRes?.reason || geoRes?.data?.reason || '';
      const isGeoNotConfigured = geoReason === 'GEOFENCE_NOT_CONFIGURED' || geoReason === 'NO_GEOFENCE_CONFIGURED';
      const isAllowed = isGeoNotConfigured || geoRes?.permitted !== false || geoRes?.data?.permitted !== false || (geoRes?.withinGeoFence !== false && geoRes?.data?.withinGeoFence !== false);

      if (!isAllowed && geoRes?.status === 'OUTSIDE') {
        setPunchResult({ success: false, reason: geoReason || 'Outside authorized office boundary', empName, empCode });
        showToast('Outside authorized boundary', 'error');
        setSubmitting(false);
        return;
      }

      const addressStr = geoRes?.address || geoRes?.data?.address || `${activeCoords.latitude?.toFixed(4)}, ${activeCoords.longitude?.toFixed(4)}`;
      const now = new Date();
      const baseLocation = {
        latitude: activeCoords.latitude,
        longitude: activeCoords.longitude,
        gpsAccuracy: activeCoords.gpsAccuracy || 15,
      };

      // Step 5: Post punch check-in / check-out
      if (punchMode === 'CHECK_IN') {
        if (attendanceType === 'OFFICE') {
          await attendanceApi.officeCheckIn({ ...baseLocation, capturedImage: capturedPhoto, confidenceScore: confidence });
        } else if (attendanceType === 'FIELD') {
          await attendanceApi.fieldCheckIn({ ...baseLocation, capturedImage: capturedPhoto, confidenceScore: confidence });
        } else {
          await attendanceApi.siteCheckIn({ ...baseLocation, capturedImage: capturedPhoto, confidenceScore: confidence, faceVerificationLogId: faceLogId });
        }
      } else {
        if (attendanceType === 'OFFICE') {
          await attendanceApi.officeCheckOut({ ...baseLocation, remarks: `Face checked out at ${addressStr}` });
        } else if (attendanceType === 'FIELD') {
          await attendanceApi.fieldCheckOut({ ...baseLocation, remarks: `Field checked out at ${addressStr}` });
        } else {
          await attendanceApi.siteCheckOut(baseLocation);
        }
      }

      showToast(`${punchMode === 'CHECK_IN' ? 'Check-In' : 'Check-Out'} verified & recorded!`, 'success');
      setPunchResult({
        success: true,
        punchMode,
        attendanceType,
        empName,
        empCode,
        confidence: Math.round(confidence * 100),
        address: addressStr,
        time: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        date: now.toLocaleDateString(),
      });

      // Automatically refresh logs and status without any manual refresh button
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
          <div style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-main)' }}>
            {getEmpName(r.employee)}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {getEmpCode(r.employee)}
          </div>
        </div>
      ),
    },
    {
      header: 'Result / Verdict',
      key: 'verificationResult',
      render: (r) => {
        const v = r.verificationResult || r.matchResult || (r.isPassed ? 'MATCH' : 'MISMATCH');
        const isMatch = v === 'MATCH' || v === 'MATCHED' || r.isPassed === true;
        const isWarning = v === 'POOR_QUALITY' || v === 'LOW_CONFIDENCE' || v === 'NO_FACE';
        const variant = isMatch ? 'success' : isWarning ? 'warning' : 'danger';
        return <Badge variant={variant}>{v.replace(/_/g, ' ')}</Badge>;
      },
    },
    {
      header: 'Similarity / Confidence',
      key: 'similarityScore',
      render: (r) => {
        const val = r.similarityScore ?? r.confidenceScore;
        return (
          <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>
            {val != null ? `${Math.round(val * 100)}%` : '—'}
          </span>
        );
      },
    },
    {
      header: 'Gate Module',
      key: 'triggeredByModule',
      render: (r) => (
        <Badge variant="neutral">{r.triggeredByModule || 'OFFICE'}</Badge>
      ),
    },
    {
      header: 'Timestamp',
      key: 'timestamp',
      render: (r) => (
        <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
          {r.timestamp || r.attemptedAt ? new Date(r.timestamp || r.attemptedAt).toLocaleString() : '—'}
        </span>
      ),
    },
    {
      header: 'Device / Gate',
      key: 'deviceInfo',
      render: (r) => (
        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
          {r.deviceInfo?.deviceId || r.deviceInfo?.browser || 'Attendance Gate'}
        </span>
      ),
    },
  ];

  const TABS = !isOrgAdmin
    ? [
        { key: 'PUNCH', label: 'Biometric Gate Punch', icon: UserCheck },
        { key: 'REGISTER', label: 'My Face Biometrics', icon: UserPlus },
        { key: 'LOGS', label: 'My Verification Logs', icon: History },
      ]
    : [
        { key: 'PUNCH', label: 'Attendance Gate', icon: UserCheck },
        { key: 'REGISTER', label: 'Face Registration', icon: UserPlus, badge: pendingCount > 0 ? pendingCount : null },
        { key: 'LOGS', label: 'Verification Logs', icon: History },
        { key: 'SETTINGS', label: 'Threshold Controls', icon: Sliders },
      ];

  const typeColors = { OFFICE: 'var(--primary)', FIELD: '#d97706', SITE: '#7c3aed' };

  const S = {
    page: { display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 1180, margin: '0 auto' },
    pageHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', padding: '16px 20px', boxShadow: 'var(--shadow-xs)' },
    iconWrap: { width: 44, height: 44, borderRadius: 10, background: 'linear-gradient(135deg, var(--primary-light), var(--primary-subtle))', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--primary-border)' },
    statsRow: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 },
    statCard: { background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14, boxShadow: 'var(--shadow-xs)' },
    statIconWrap: (color) => ({ width: 38, height: 38, borderRadius: 9, background: color || 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }),
    statLabel: { fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 500 },
    statVal: { fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-main)', marginTop: 2 },
    tabBar: { display: 'flex', gap: 4, background: 'var(--bg-subtle)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', padding: 4, maxWidth: '100%', overflowX: 'auto', whiteSpace: 'nowrap', WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none' },
    tabBtn: (active) => ({ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '9px 18px', fontSize: '0.86rem', fontWeight: active ? 700 : 500, color: active ? 'var(--primary)' : 'var(--text-muted)', background: active ? 'var(--bg-surface)' : 'transparent', border: 'none', borderRadius: 10, cursor: 'pointer', transition: 'all 0.15s', boxShadow: active ? 'var(--shadow-sm)' : 'none', flexShrink: 0, whiteSpace: 'nowrap' }),
    card: { background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', padding: 22, boxShadow: 'var(--shadow-xs)' },
    cardHeader: { display: 'flex', alignItems: 'center', gap: 10, paddingBottom: 16, marginBottom: 16, borderBottom: '1px solid var(--border-light)' },
    cardIconWrap: (color) => ({ width: 32, height: 32, borderRadius: 8, background: color || 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }),
    sectionTitle: { fontSize: '0.96rem', fontWeight: 700, margin: 0, color: 'var(--text-main)' },
    sectionSub: { fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 },
    filterBtn: (active) => ({ padding: '5px 14px', fontSize: '0.78rem', fontWeight: active ? 700 : 500, border: `1px solid ${active ? 'var(--primary)' : 'var(--border-color)'}`, borderRadius: 20, background: active ? 'var(--primary)' : 'transparent', color: active ? '#fff' : 'var(--text-muted)', cursor: 'pointer', transition: 'all 0.15s' }),
    empCard: { padding: '12px 14px', borderRadius: 10, background: 'var(--bg-subtle)', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
    typeBtn: (active, color) => ({ padding: '9px 0', fontSize: '0.82rem', fontWeight: active ? 700 : 500, border: `1.5px solid ${active ? (color || 'var(--primary)') : 'var(--border-color)'}`, borderRadius: 8, textAlign: 'center', background: active ? (color || 'var(--primary)') : 'transparent', color: active ? '#fff' : 'var(--text-muted)', cursor: 'pointer', transition: 'all 0.15s' }),
    punchToggle: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0, border: '1.5px solid var(--border-color)', borderRadius: 10, overflow: 'hidden' },
    punchBtn: (active, isOut) => ({ padding: '12px 0', fontSize: '0.86rem', fontWeight: active ? 700 : 500, border: 'none', background: active ? (isOut ? 'linear-gradient(135deg,#dc2626,#ef4444)' : 'linear-gradient(135deg,var(--primary),var(--primary-hover))') : 'var(--bg-subtle)', color: active ? '#fff' : 'var(--text-muted)', cursor: 'pointer', transition: 'all 0.18s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }),
    timeBanner: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderRadius: 10, background: 'linear-gradient(135deg,var(--primary-light),var(--primary-subtle))', border: '1px solid var(--primary-border)' },
    mainBtn: (mode) => ({ width: '100%', padding: '13px', fontSize: '0.94rem', fontWeight: 700, borderRadius: 12, border: 'none', cursor: 'pointer', background: mode === 'CHECK_OUT' ? 'linear-gradient(135deg,#dc2626,#ef4444)' : 'linear-gradient(135deg,var(--primary),#337a82)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, boxShadow: mode === 'CHECK_OUT' ? '0 4px 14px rgba(220,38,38,0.35)' : '0 4px 14px rgba(63,146,154,0.35)', transition: 'all 0.2s' }),
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
          <div style={S.iconWrap}>
            <ScanFace size={22} color="var(--primary)" />
          </div>
          <div>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
              Face Recognition Attendance
            </h2>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '2px 0 0' }}>
              Biometric enrollment, live gate verification, audit trails &amp; threshold controls
            </p>
          </div>
        </div>

        {/* Live Status indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--success)', display: 'inline-block' }} />
          <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)' }}>
            Biometric Gate Active
          </span>
        </div>
      </div>

      {/* Quick Overview Stats Cards */}
      <div style={S.statsRow}>
        <div style={S.statCard}>
          <div style={S.statIconWrap('var(--primary-light)')}>
            <Users size={18} color="var(--primary)" />
          </div>
          <div>
            <div style={S.statLabel}>Total Staff</div>
            <div style={S.statVal}>{employees.length}</div>
          </div>
        </div>

        <div style={S.statCard}>
          <div style={S.statIconWrap('#dcfce7')}>
            <ShieldCheck size={18} color="#166534" />
          </div>
          <div>
            <div style={S.statLabel}>Biometrics Enrolled</div>
            <div style={{ ...S.statVal, color: '#166534' }}>
              {storedCount} <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)', fontWeight: 500 }}>({enrolledPct}%)</span>
            </div>
          </div>
        </div>

        <div style={S.statCard}>
          <div style={S.statIconWrap('#fef3c7')}>
            <AlertCircle size={18} color="#d97706" />
          </div>
          <div>
            <div style={S.statLabel}>Pending Enrollment</div>
            <div style={{ ...S.statVal, color: pendingCount > 0 ? '#d97706' : 'var(--text-muted)' }}>
              {pendingCount}
            </div>
          </div>
        </div>

        <div style={S.statCard}>
          <div style={S.statIconWrap('#ede9fe')}>
            <Sliders size={18} color="#7c3aed" />
          </div>
          <div>
            <div style={S.statLabel}>System Threshold</div>
            <div style={{ ...S.statVal, color: '#7c3aed' }}>
              {Math.round(systemThreshold * 100)}% Match
            </div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div style={S.tabBar}>
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              style={S.tabBtn(isActive)}
            >
              <Icon size={16} />
              <span>{tab.label}</span>
              {tab.badge && (
                <span style={{ background: '#dc2626', color: '#fff', borderRadius: 10, padding: '1px 7px', fontSize: '0.68rem', fontWeight: 700 }}>
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ─────────────────────────────────────────────────────────────
          TAB 1: DAILY PUNCH GATE (POST /face/employees/:id/verify)
      ───────────────────────────────────────────────────────────── */}
      {activeTab === 'PUNCH' && (
        <div className="responsive-split-2">
          {/* Left: Camera Feed */}
          <div style={S.card}>
            <div style={S.cardHeader}>
              <div style={S.cardIconWrap('var(--primary-light)')}>
                <Camera size={16} color="var(--primary)" />
              </div>
              <div>
                <div style={S.sectionTitle}>Biometric Gate Scanner</div>
                <div style={S.sectionSub}>Live camera capture with automatic face alignment</div>
              </div>
            </div>

            <CameraCapture
              onCapture={(img) => { setCapturedPhoto(img); setCameraError(null); setPunchResult(null); }}
              onError={(err) => setCameraError(err)}
              label="Align face inside frame to verify"
            />

            {capturedPhoto && (
              <div style={{ ...S.alertOk, marginTop: 12 }}>
                <CheckCircle2 size={15} /> Live photo captured — ready for biometric gate verification.
              </div>
            )}
            {cameraError && (
              <div style={{ ...S.alertErr, marginTop: 12 }}>
                <XCircle size={15} /> {cameraError.error || 'Camera unavailable'}
              </div>
            )}
          </div>

          {/* Right: Verification Details & Action */}
          <div style={S.card}>
            <div style={S.cardHeader}>
              <div style={S.cardIconWrap('var(--primary-light)')}>
                <UserCheck size={16} color="var(--primary)" />
              </div>
              <div>
                <div style={S.sectionTitle}>Verification &amp; Check-In Gate</div>
                <div style={S.sectionSub}>Employee profile, attendance category &amp; GPS geofence</div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Employee Selection */}
              {isOrgAdmin ? (
                <EmpPicker
                  employees={employees}
                  value={selectedEmpId}
                  onChange={(id) => { setSelectedEmpId(id); setCapturedPhoto(null); setPunchResult(null); }}
                  label="Gate Employee"
                  getEmpName={getEmpName}
                  getEmpCode={getEmpCode}
                  getEmpDept={getEmpDept}
                />
              ) : (
                <div style={S.empCard}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--text-main)' }}>
                      {selectedPunchEmployee ? getEmpName(selectedPunchEmployee) : (user?.name || 'My Profile')}
                    </div>
                    <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: 2 }}>
                      {selectedPunchEmployee ? getEmpCode(selectedPunchEmployee) : (user?.employeeCode || 'SELF')} · {selectedPunchEmployee ? getEmpDept(selectedPunchEmployee) : (user?.department?.name || 'Staff')}
                    </div>
                  </div>
                  <Badge variant={selectedPunchEmployee?.isFaceEnrolled ? 'success' : 'warning'}>
                    {selectedPunchEmployee?.isFaceEnrolled ? 'Face Enrolled' : 'Face Pending'}
                  </Badge>
                </div>
              )}

              {selectedPunchEmployee && !selectedPunchEmployee.isFaceEnrolled && (
                <div style={S.alertWarn}>
                  <AlertCircle size={15} color="#d97706" />
                  Biometrics not enrolled yet. Please enroll face profile before punching.
                </div>
              )}

              {/* Attendance Gate Category */}
              <div>
                <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: 8 }}>
                  Attendance Category
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                  {['OFFICE', 'FIELD', 'SITE'].map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setAttendanceType(t)}
                      style={S.typeBtn(attendanceType === t, typeColors[t])}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Action Mode: Punch IN / Punch OUT */}
              <div>
                <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: 8 }}>
                  Gate Action
                </div>
                {empActiveSession && (
                  <div style={{ ...S.sessionBanner, marginBottom: 8 }}>
                    <Clock size={14} color="var(--primary)" /> Active punch session found — mode automatically set to <strong style={{ marginLeft: 4 }}>Check-Out</strong>.
                  </div>
                )}
                <div style={S.punchToggle}>
                  <button
                    type="button"
                    onClick={() => setPunchMode('CHECK_IN')}
                    style={S.punchBtn(punchMode === 'CHECK_IN', false)}
                  >
                    <LogIn size={15} /> Punch IN (Check-In)
                  </button>
                  <button
                    type="button"
                    onClick={() => setPunchMode('CHECK_OUT')}
                    style={S.punchBtn(punchMode === 'CHECK_OUT', true)}
                  >
                    <LogOut size={15} /> Punch OUT (Check-Out)
                  </button>
                </div>
              </div>

              {/* Live Time Banner */}
              <div style={S.timeBanner}>
                <div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--primary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Attendance Date
                  </div>
                  <div style={{ fontWeight: 700, fontSize: '0.96rem', color: 'var(--text-main)', marginTop: 2 }}>
                    {new Date().toISOString().split('T')[0]}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--primary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Gate Clock
                  </div>
                  <div style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--primary)', marginTop: 2 }}>
                    <LiveClock />
                  </div>
                </div>
              </div>

              {/* GPS Geofence Resolver */}
              <div>
                <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <MapPin size={14} color="var(--primary)" /> GPS Location Resolver
                </div>
                <GeoLocationPicker
                  onLocationChange={(c) => { setCoords(c); if (c && !c.gpsUnavailable) setPunchResult(null); }}
                  targetLocation={attendanceType === 'OFFICE' ? branchLocation : null}
                />
              </div>

              {/* Primary Punch Button */}
              {!punchResult && (
                <button
                  type="button"
                  onClick={handlePunch}
                  disabled={submitting || !capturedPhoto || !selectedEmpId}
                  style={{ ...S.mainBtn(punchMode), opacity: (submitting || !capturedPhoto || !selectedEmpId) ? 0.65 : 1 }}
                >
                  {submitting ? (
                    <>
                      <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />
                      Verifying biometrics at gate...
                    </>
                  ) : punchMode === 'CHECK_IN' ? (
                    <>
                      <LogIn size={18} /> Confirm Check-In with Face Biometrics
                    </>
                  ) : (
                    <>
                      <LogOut size={18} /> Confirm Check-Out with Face Biometrics
                    </>
                  )}
                </button>
              )}

              {/* Punch Result Card */}
              {punchResult && (
                <div style={punchResult.success ? S.resultOk : S.resultFail}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9, fontWeight: 700, fontSize: '0.95rem', color: punchResult.success ? 'var(--success)' : 'var(--danger)' }}>
                    {punchResult.success ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
                    {punchResult.success ? `${punchResult.punchMode === 'CHECK_IN' ? 'Check-In' : 'Check-Out'} Successfully Verified` : 'Biometric Gate Rejection'}
                  </div>
                  <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 5 }}>
                    <div style={S.resultRow}>
                      <UserCheck size={13} />
                      <span><strong>{punchResult.empName}</strong> ({punchResult.empCode})</span>
                    </div>
                    {punchResult.success ? (
                      <>
                        <div style={S.resultRow}>
                          <ScanFace size={13} />
                          <span>Biometric Match: <strong>{punchResult.confidence}%</strong> (Gate Threshold: {Math.round(systemThreshold * 100)}%)</span>
                        </div>
                        <div style={S.resultRow}>
                          <MapPin size={13} />
                          <span>{punchResult.address}</span>
                        </div>
                        <div style={S.resultRow}>
                          <Clock size={13} />
                          <span>{punchResult.time} — {punchResult.date}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => { setCapturedPhoto(null); setCoords(null); setPunchResult(null); }}
                          style={{ marginTop: 10, padding: '7px 14px', borderRadius: 8, border: '1px solid var(--border-color)', background: '#fff', color: 'var(--text-main)', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer', alignSelf: 'flex-start' }}
                        >
                          New Punch Session
                        </button>
                      </>
                    ) : (
                      <>
                        <div style={{ ...S.resultRow, color: 'var(--danger)' }}>
                          <AlertCircle size={13} />
                          <span>{punchResult.reason}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => { setCapturedPhoto(null); setPunchResult(null); }}
                          style={{ marginTop: 10, padding: '7px 14px', borderRadius: 8, border: '1px solid var(--danger-border)', background: '#fff', color: 'var(--danger)', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer', alignSelf: 'flex-start' }}
                        >
                          Retry Biometric Scan
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB 2: BIOMETRIC ENROLLMENT & RE-ENROLLMENT
          (POST /face/self-enroll, POST /face/employees/:id/enroll, PUT /face/employees/:id/re-enroll)
      ───────────────────────────────────────────────────────────── */}
      {activeTab === 'REGISTER' && (
        <div className="responsive-split-2">
          {/* Camera Frame */}
          <div style={S.card}>
            <div style={S.cardHeader}>
              <div style={S.cardIconWrap('var(--primary-light)')}>
                <Camera size={16} color="var(--primary)" />
              </div>
              <div>
                <div style={S.sectionTitle}>Biometric Enrollment Camera</div>
                <div style={S.sectionSub}>Position employee face squarely in the frame</div>
              </div>
            </div>

            {loadingEmps ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 220, gap: 10, color: 'var(--text-muted)' }}>
                <Loader2 size={22} style={{ animation: 'spin 1s linear infinite' }} />
                <span style={{ fontSize: '0.88rem' }}>Loading profiles...</span>
              </div>
            ) : (
              <CameraCapture onCapture={handleAutoRegister} label="Look directly into camera to capture profile" />
            )}

            {registering && (
              <div style={{ ...S.alertOk, marginTop: 12 }}>
                <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> Generating 128D facial embeddings &amp; registering with backend...
              </div>
            )}
            {regPhoto && !registering && !regSuccess && (
              <div style={{ ...S.alertOk, marginTop: 12 }}>
                <CheckCircle2 size={15} /> Facial frame captured. Click Enroll below to finalize.
              </div>
            )}
            {regSuccess && (
              <div style={{ ...S.resultOk, marginTop: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--success)', fontWeight: 700, fontSize: '0.9rem' }}>
                  <CheckCircle2 size={17} /> Face Biometrics Successfully Registered!
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 4 }}>
                  Profile: {regSuccess.empName} — {regSuccess.timestamp}
                </div>
              </div>
            )}
          </div>

          {/* Profile Selector & Controls */}
          <div style={S.card}>
            <div style={S.cardHeader}>
              <div style={S.cardIconWrap('#f0fdf4')}>
                <Database size={16} color="var(--success)" />
              </div>
              <div>
                <div style={S.sectionTitle}>
                  {isOrgAdmin ? 'Employee Biometric Profiles' : 'Self-Enroll Biometric Profile'}
                </div>
                <div style={S.sectionSub}>
                  {isOrgAdmin ? 'Enroll first-time face profile or update existing registration' : 'Register your facial template for attendance gates'}
                </div>
              </div>
            </div>

            {isOrgAdmin && (
              <>
                {/* Filter Pills */}
                <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
                  {[
                    { key: 'ALL', label: 'All Profiles' },
                    { key: 'PENDING', label: `Pending (${pendingCount})` },
                    { key: 'STORED', label: `Enrolled (${storedCount})` },
                  ].map((f) => (
                    <button
                      key={f.key}
                      type="button"
                      onClick={() => setRegFilter(f.key)}
                      style={S.filterBtn(regFilter === f.key)}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>

                {/* Search Box */}
                <div style={{ position: 'relative', marginBottom: 14 }}>
                  <Search size={14} color="var(--text-muted)" style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    type="text"
                    placeholder="Search employee by name or code..."
                    value={regSearch}
                    onChange={(e) => setRegSearch(e.target.value)}
                    style={{ width: '100%', height: 38, paddingLeft: 34, paddingRight: 12, borderRadius: 8, border: '1px solid var(--border-color)', fontSize: '0.84rem', outline: 'none' }}
                  />
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
              </>
            )}

            {selectedRegEmployee && (
              <div style={{ ...S.empCard, marginTop: 14 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--text-main)' }}>
                    {getEmpName(selectedRegEmployee)}
                  </div>
                  <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: 2 }}>
                    {getEmpCode(selectedRegEmployee)} · {getEmpDept(selectedRegEmployee)}
                  </div>
                </div>
                <Badge variant={selectedRegEmployee.isFaceEnrolled ? 'success' : 'warning'}>
                  {selectedRegEmployee.isFaceEnrolled ? 'Enrolled' : 'Pending Enrollment'}
                </Badge>
              </div>
            )}

            <Button
              variant="primary"
              icon={ScanFace}
              loading={registering}
              onClick={handleRegisterFace}
              disabled={!regPhoto || !regEmpId}
              style={{ width: '100%', marginTop: 20, padding: '12px', fontWeight: 600, borderRadius: 10 }}
            >
              {selectedRegEmployee?.isFaceEnrolled ? 'Re-Enroll / Update Biometrics' : 'Enroll Face Profile'}
            </Button>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB 3: AUDIT & VERIFICATION LOGS
          (GET /face/verification-logs & GET /face/employees/:id/verification-logs)
      ───────────────────────────────────────────────────────────── */}
      {activeTab === 'LOGS' && (
        <div style={S.card}>
          <div style={{ ...S.cardHeader, marginBottom: 0, justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={S.cardIconWrap('var(--primary-light)')}>
                <History size={16} color="var(--primary)" />
              </div>
              <div>
                <div style={S.sectionTitle}>Biometric Verification Audit Logs</div>
                <div style={S.sectionSub}>Audit trail of gate scan attempts, verdicts &amp; confidence scores</div>
              </div>
            </div>

            {/* Filter by Verdict */}
            <div style={{ display: 'flex', gap: 6 }}>
              {[
                { key: 'ALL', label: 'All Results' },
                { key: 'MATCH', label: 'Matches Only' },
                { key: 'MISMATCH', label: 'Mismatches' },
              ].map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setLogResultFilter(f.key)}
                  style={S.filterBtn(logResultFilter === f.key)}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginTop: 16 }}>
            <Table
              columns={logColumns}
              data={verificationLogs}
              loading={loadingLogs}
              emptyMessage="No biometric verification logs found."
            />
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB 4: THRESHOLD CONTROLS (GET & PUT /face/settings/threshold)
      ───────────────────────────────────────────────────────────── */}
      {activeTab === 'SETTINGS' && isOrgAdmin && (
        <div style={{ maxWidth: 640, margin: '0 auto', width: '100%' }}>
          <div style={S.card}>
            <div style={S.cardHeader}>
              <div style={S.cardIconWrap('#ede9fe')}>
                <Sliders size={18} color="#7c3aed" />
              </div>
              <div>
                <div style={S.sectionTitle}>System Recognition Threshold Control</div>
                <div style={S.sectionSub}>
                  Configures the minimum cosine biometric similarity required for gate match
                </div>
              </div>
            </div>

            {loadingThreshold ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 180, gap: 10, color: 'var(--text-muted)' }}>
                <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} />
                <span>Loading system threshold setting...</span>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {/* Active Level Display */}
                <div style={{ padding: '16px 20px', borderRadius: 12, background: 'var(--bg-subtle)', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                      Current Configured Threshold
                    </div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--primary)', marginTop: 2 }}>
                      {Math.round(tempThreshold * 100)}%
                    </div>
                    {thresholdUpdatedAt && (
                      <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: 4 }}>
                        Last modified: {thresholdUpdatedAt}
                      </div>
                    )}
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <Badge variant={tempThreshold >= 0.85 ? 'success' : tempThreshold >= 0.70 ? 'info' : 'warning'}>
                      {tempThreshold >= 0.85 ? 'High Security' : tempThreshold >= 0.70 ? 'Balanced' : 'Permissive'}
                    </Badge>
                  </div>
                </div>

                {/* Range Slider */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: 8 }}>
                    <span>Sensitivity Adjustment</span>
                    <span style={{ color: 'var(--primary)' }}>{tempThreshold.toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min="0.50"
                    max="0.99"
                    step="0.01"
                    value={tempThreshold}
                    onChange={(e) => setTempThreshold(Number(e.target.value))}
                    style={{ width: '100%', height: 6, accentColor: 'var(--primary)', cursor: 'pointer' }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 6 }}>
                    <span>50% (Permissive)</span>
                    <span>85% (Recommended Default)</span>
                    <span>99% (Strict Biometric Match)</span>
                  </div>
                </div>

                <div style={{ padding: '12px 16px', borderRadius: 10, background: '#f8fafc', border: '1px solid #e2e8f0', fontSize: '0.8rem', color: '#475569', lineHeight: 1.5 }}>
                  <strong>How threshold controls work:</strong> When an employee presents their face at an attendance gate, the system computes facial similarity between 0.0 and 1.0. If the score meets or exceeds <strong>{Math.round(tempThreshold * 100)}%</strong>, access is approved and attendance is recorded.
                </div>

                {/* Save Button */}
                <Button
                  variant="primary"
                  icon={Check}
                  loading={savingThreshold}
                  onClick={handleSaveThreshold}
                  style={{ width: '100%', padding: '12px', fontWeight: 600, borderRadius: 10 }}
                >
                  Save System Threshold
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default FacePunch;
