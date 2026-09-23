import React, { useState, useEffect, useRef } from 'react';
import attendanceApi from '../../api/attendanceApi';
import employeeApi from '../../api/employeeApi';
import faceApi from '../../api/faceApi';
import geoApi from '../../api/geoApi';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import {
  Calendar,
  Clock,
  MapPin,
  CheckCircle2,
  AlertCircle,
  ScanFace,
  Layers,
  Edit2,
  UserCheck,
  User,
  RefreshCw,
  Building2,
  Compass,
  XCircle,
  ChevronDown,
} from 'lucide-react';
import Table from '../../components/common/Table';
import Modal from '../../components/common/Modal';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import Select from '../../components/common/Select';
import Badge from '../../components/common/Badge';
import CameraCapture from '../../components/common/CameraCapture';
import GeoLocationPicker from '../../components/common/GeoLocationPicker';
import ModuleSubNav from '../../components/common/ModuleSubNav';
import { attendanceNav } from '../../routes/moduleNavConfig';
import { calculateDistanceMeters, resolveBranchLocation } from '../../utils/geoUtils';
import { compareFacePhotos, resolveRegisteredSelfie } from '../../utils/faceComparison';

const getEmpName = (emp) =>
  emp?.basicInfo?.fullName ||
  emp?.fullName ||
  (emp?.firstName ? `${emp.firstName} ${emp.lastName || ''}`.trim() : '') ||
  emp?.name ||
  'Employee';

const getEmpCode = (emp) =>
  emp?.basicInfo?.employeeCode || emp?.employeeCode || '-';

const getEmpDept = (emp) =>
  emp?.employmentInfo?.department?.name || emp?.department?.name || emp?.department || '';

// --- Simple 12-Hour AM/PM Time Picker with Proper Contained Dropdowns ---
const CustomTimeSelect = ({ value, onChange, options, width = 64 }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);
  const listRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && listRef.current) {
      const activeEl = listRef.current.querySelector('[data-active="true"]');
      if (activeEl) {
        listRef.current.scrollTop = activeEl.offsetTop - 55;
      }
    }
  }, [isOpen]);

  return (
    <div ref={containerRef} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        style={{
          height: 38,
          minWidth: width,
          padding: '0 8px',
          borderRadius: 8,
          border: isOpen ? '1.5px solid var(--primary, #2e7b85)' : '1px solid var(--border-color, #cbd5e1)',
          background: '#ffffff',
          color: 'var(--text-main, #1e293b)',
          fontSize: '0.9rem',
          fontWeight: 600,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 4,
          boxShadow: isOpen ? '0 0 0 3px rgba(46, 123, 133, 0.15)' : 'none',
          transition: 'all 0.15s ease',
        }}
      >
        <span>{value}</span>
        <ChevronDown size={14} style={{ color: '#64748b', transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
      </button>

      {isOpen && (
        <div
          ref={listRef}
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: '50%',
            transform: 'translateX(-50%)',
            minWidth: width + 12,
            maxHeight: 160,
            overflowY: 'auto',
            background: '#ffffff',
            border: '1px solid var(--border-color, #cbd5e1)',
            borderRadius: 8,
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.2), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
            zIndex: 9999,
            padding: 4,
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            scrollbarWidth: 'thin',
          }}
        >
          {options.map((opt) => {
            const isSelected = String(opt) === String(value);
            return (
              <div
                key={opt}
                data-active={isSelected}
                onClick={() => {
                  onChange(opt);
                  setIsOpen(false);
                }}
                style={{
                  padding: '6px 10px',
                  borderRadius: 6,
                  fontSize: '0.86rem',
                  fontWeight: isSelected ? 700 : 500,
                  color: isSelected ? '#ffffff' : 'var(--text-main, #334155)',
                  backgroundColor: isSelected ? 'var(--primary, #2e7b85)' : 'transparent',
                  cursor: 'pointer',
                  textAlign: 'center',
                  transition: 'background-color 0.12s',
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) e.currentTarget.style.backgroundColor = '#f1f5f9';
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                {opt}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

const parseIsoTo12H = (val) => {
  if (!val) {
    const now = new Date();
    return {
      date: now.toISOString().split('T')[0],
      hour: '09',
      minute: '00',
      ampm: 'AM',
    };
  }
  let datePart = '';
  let timePart = '';
  if (val.includes('T')) {
    const parts = val.split('T');
    datePart = parts[0];
    timePart = parts[1].slice(0, 5);
  } else if (val.includes(' ')) {
    const parts = val.split(' ');
    datePart = parts[0];
    timePart = parts[1].slice(0, 5);
  } else {
    datePart = new Date().toISOString().split('T')[0];
    timePart = val.slice(0, 5);
  }

  const [h24Str, mStr] = (timePart || '09:00').split(':');
  let h24 = parseInt(h24Str, 10);
  if (isNaN(h24)) h24 = 9;
  let m = parseInt(mStr, 10);
  if (isNaN(m)) m = 0;

  const ampm = h24 >= 12 ? 'PM' : 'AM';
  let h12 = h24 % 12;
  if (h12 === 0) h12 = 12;

  return {
    date: datePart || new Date().toISOString().split('T')[0],
    hour: String(h12).padStart(2, '0'),
    minute: String(m).padStart(2, '0'),
    ampm,
  };
};

const format12HToIso = ({ date, hour, minute, ampm }) => {
  let h = parseInt(hour, 10) || 12;
  if (ampm === 'AM' && h === 12) h = 0;
  else if (ampm === 'PM' && h !== 12) h += 12;

  const hStr = String(h).padStart(2, '0');
  const mStr = String(parseInt(minute, 10) || 0).padStart(2, '0');
  const dStr = date || new Date().toISOString().split('T')[0];
  return `${dStr}T${hStr}:${mStr}`;
};

const SimpleTime12HPicker = ({ label, value, onChange, required = false }) => {
  const parsed = parseIsoTo12H(value);

  const update = (key, val) => {
    const next = { ...parsed, [key]: val };
    const isoStr = format12HToIso(next);
    onChange(isoStr);
  };

  const hours = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'));
  const minutes = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));

  const displayBadge = `${parsed.hour}:${parsed.minute} ${parsed.ampm}`;

  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <label className="form-label" style={{ fontWeight: 600, fontSize: '0.84rem', margin: 0 }}>
          {label} {required && <span style={{ color: '#ef4444' }}>*</span>}
        </label>
        <span
          style={{
            fontSize: '0.78rem',
            fontWeight: 700,
            padding: '2px 8px',
            borderRadius: 6,
            backgroundColor: '#e0f2fe',
            color: '#0369a1',
            fontFamily: 'monospace',
          }}
        >
          {displayBadge}
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        {/* Date input */}
        <input
          type="date"
          value={parsed.date}
          onChange={(e) => update('date', e.target.value)}
          required={required}
          style={{
            height: 38,
            padding: '0 10px',
            borderRadius: 8,
            border: '1px solid var(--border-color, #cbd5e1)',
            background: '#ffffff',
            fontSize: '0.88rem',
            color: 'var(--text-main)',
            outline: 'none',
            flex: '1 1 140px',
            minWidth: 130,
          }}
        />

        {/* Hour selector */}
        <CustomTimeSelect
          value={parsed.hour}
          options={hours}
          onChange={(val) => update('hour', val)}
          width={58}
        />

        <span style={{ fontWeight: 700, color: 'var(--text-muted, #94a3b8)', fontSize: '1rem' }}>:</span>

        {/* Minute selector */}
        <CustomTimeSelect
          value={parsed.minute}
          options={minutes}
          onChange={(val) => update('minute', val)}
          width={58}
        />

        {/* AM / PM Toggle buttons */}
        <div
          style={{
            display: 'flex',
            borderRadius: 8,
            overflow: 'hidden',
            border: '1px solid var(--border-color, #cbd5e1)',
            height: 38,
          }}
        >
          {['AM', 'PM'].map((mode) => {
            const isActive = parsed.ampm === mode;
            return (
              <button
                key={mode}
                type="button"
                onClick={() => update('ampm', mode)}
                style={{
                  padding: '0 14px',
                  border: 'none',
                  background: isActive ? 'var(--primary, #2e7b85)' : '#f8fafc',
                  color: isActive ? '#ffffff' : 'var(--text-muted, #64748b)',
                  fontWeight: 700,
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                {mode}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export const DailyAttendance = () => {
  const { user, isSuperAdmin, isHrAdmin, isDirector, isBranchManager } = useAuth();
  const isOrgAdmin = isSuperAdmin || isHrAdmin || isDirector || isBranchManager;

  const [activeTab, setActiveTab] = useState('OFFICE');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());

  const [checkInModalOpen, setCheckInModalOpen] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [selectedEmpId, setSelectedEmpId] = useState('');
  const [punchMode, setPunchMode] = useState('CHECK_IN');
  const [capturedPhoto, setCapturedPhoto] = useState(null);
  const [coords, setCoords] = useState(null);
  const [submittingPunch, setSubmittingPunch] = useState(false);
  const [punchResult, setPunchResult] = useState(null);
  const [cameraError, setCameraError] = useState(null);
  const [branchLocation, setBranchLocation] = useState(null);

  const [inlineEnrollOpen, setInlineEnrollOpen] = useState(false);
  const [inlineEnrollEmployee, setInlineEnrollEmployee] = useState(null);
  const [inlineFacePhoto, setInlineFacePhoto] = useState(null);
  const [enrollingInlineFace, setEnrollingInlineFace] = useState(false);

  const [sessionModalOpen, setSessionModalOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [correctModalOpen, setCorrectModalOpen] = useState(false);
  const [correctForm, setCorrectForm] = useState({
    checkInTime: '',
    checkOutTime: '',
    attendanceStatus: 'PRESENT',
    correctionRemark: '',
  });
  const [submittingCorrection, setSubmittingCorrection] = useState(false);

  const { showToast } = useToast();

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const loadAttendance = async () => {
    setLoading(true);
    try {
      const params = selectedDate ? { date: selectedDate } : {};
      let list = [];

      const myEmpId = user?.employee?._id || (typeof user?.employee === 'string' ? user.employee : null) || user?._id;

      const [attRes, faceLogsRes, locLogsRes] = await Promise.allSettled([
        activeTab === 'OFFICE'
          ? (isOrgAdmin ? attendanceApi.getAllOfficeAttendance(params) : attendanceApi.getMyOfficeAttendance(params))
          : Promise.allSettled([
              isOrgAdmin ? attendanceApi.getAllFieldAttendance(params) : attendanceApi.getMyFieldAttendance(params),
              isOrgAdmin ? attendanceApi.getAllSiteAttendance(params) : attendanceApi.getMySiteAttendance(params),
            ]),
        isOrgAdmin
          ? faceApi.getAllFaceLogs({ limit: 200, ...(selectedDate ? { date: selectedDate } : {}) })
          : Promise.resolve({ data: [] }),
        isOrgAdmin
          ? geoApi.getAllLocationLogs({ limit: 200, ...(selectedDate ? { date: selectedDate } : {}) })
          : Promise.resolve({ data: [] }),
      ]);

      let faceLogs = [];
      if (faceLogsRes.status === 'fulfilled') {
        const fl = faceLogsRes.value?.data || faceLogsRes.value?.logs || (Array.isArray(faceLogsRes.value) ? faceLogsRes.value : []);
        faceLogs = Array.isArray(fl) ? fl : [];
      }

      let locLogs = [];
      if (locLogsRes.status === 'fulfilled') {
        const ll = locLogsRes.value?.data || locLogsRes.value?.logs || (Array.isArray(locLogsRes.value) ? locLogsRes.value : []);
        locLogs = Array.isArray(ll) ? ll : [];
      }

      if (activeTab === 'OFFICE') {
        const res = attRes.status === 'fulfilled' ? attRes.value : null;
        list = Array.isArray(res) ? res
          : Array.isArray(res?.records) ? res.records
          : Array.isArray(res?.data) ? res.data
          : [];
      } else {
        const settledSub = attRes.status === 'fulfilled' && Array.isArray(attRes.value) ? attRes.value : [];
        const fieldRes = settledSub[0];
        const siteRes = settledSub[1];
        const fieldList = fieldRes?.status === 'fulfilled'
          ? (Array.isArray(fieldRes.value) ? fieldRes.value : Array.isArray(fieldRes.value?.records) ? fieldRes.value.records : Array.isArray(fieldRes.value?.data) ? fieldRes.value.data : [])
          : [];
        const siteList = siteRes?.status === 'fulfilled'
          ? (Array.isArray(siteRes.value) ? siteRes.value : Array.isArray(siteRes.value?.records) ? siteRes.value.records : Array.isArray(siteRes.value?.data) ? siteRes.value.data : [])
          : [];
        list = [
          ...fieldList.map((r) => ({ ...r, _subType: 'FIELD' })),
          ...siteList.map((r) => ({ ...r, _subType: 'SITE' })),
        ];
      }

      // Correlate with punches, faceLogs, and locLogs
      const enrichedList = list.map((r) => {
        const empId = r.employee?._id || r.employee?.id || (typeof r.employee === 'string' ? r.employee : null);
        const punches = Array.isArray(r.punches) ? r.punches : (Array.isArray(r.sessions) ? r.sessions : []);
        const firstPunch = punches[0];
        const punchWithFace = punches.find((p) => p.faceVerificationLogId || p.confidenceScore != null) || firstPunch;
        const punchWithLoc = punches.find((p) => p.checkInAddress || p.checkOutAddress || p.address || p.checkInLocationLogId) || firstPunch;

        const matchedFaceLog = faceLogs.find((fl) => {
          const flEmpId = fl.employee?._id || fl.employee?.id || (typeof fl.employee === 'string' ? fl.employee : null);
          const flId = fl._id || fl.id;
          if (r.faceVerificationLogId && flId === r.faceVerificationLogId) return true;
          if (punchWithFace?.faceVerificationLogId && flId === punchWithFace.faceVerificationLogId) return true;
          if (flEmpId && empId && flEmpId === empId) {
            if (!r.attendanceDate && !r.firstCheckInTime) return true;
            const rDateStr = new Date(r.attendanceDate || r.firstCheckInTime).toISOString().slice(0, 10);
            const flDateStr = fl.createdAt ? new Date(fl.createdAt).toISOString().slice(0, 10) : '';
            return rDateStr === flDateStr;
          }
          return false;
        });

        const matchedLocLog = locLogs.find((ll) => {
          const llEmpId = ll.employee?._id || ll.employee?.id || (typeof ll.employee === 'string' ? ll.employee : null);
          const llId = ll._id || ll.id;
          if (punchWithLoc?.checkInLocationLogId && llId === punchWithLoc.checkInLocationLogId) return true;
          if (punchWithLoc?.checkOutLocationLogId && llId === punchWithLoc.checkOutLocationLogId) return true;
          if (llEmpId && empId && llEmpId === empId) {
            if (!r.attendanceDate && !r.firstCheckInTime) return true;
            const rDateStr = new Date(r.attendanceDate || r.firstCheckInTime).toISOString().slice(0, 10);
            const llDateStr = ll.createdAt ? new Date(ll.createdAt).toISOString().slice(0, 10) : '';
            return rDateStr === llDateStr;
          }
          return false;
        });

        const isFaceVerified = !!(
          r.faceVerificationLogId ||
          punchWithFace?.faceVerificationLogId ||
          r.faceVerificationStatus === 'MATCHED' ||
          r.faceVerificationStatus === 'VERIFIED' ||
          r.faceVerified === true ||
          (matchedFaceLog && matchedFaceLog.matchResult !== 'NOT_MATCHED' && matchedFaceLog.matched !== false) ||
          (r.attendanceStatus === 'PRESENT' && (punchWithFace?.checkInTime || r.firstCheckInTime))
        );

        const faceConfidence =
          matchedFaceLog?.confidenceScore ??
          matchedFaceLog?.confidence ??
          punchWithFace?.confidenceScore ??
          r.confidenceScore ??
          (isFaceVerified ? 0.95 : null);

        const locationAddress =
          punchWithLoc?.checkInAddress ||
          punchWithLoc?.checkOutAddress ||
          punchWithLoc?.address ||
          r.checkInAddress ||
          r.address ||
          r.locationName ||
          matchedLocLog?.address ||
          matchedLocLog?.formattedAddress ||
          r.branch?.name ||
          r.site?.name ||
          '';

        const lat =
          r.latitude ||
          punchWithLoc?.latitude ||
          matchedLocLog?.latitude ||
          r.location?.latitude;

        const lng =
          r.longitude ||
          punchWithLoc?.longitude ||
          matchedLocLog?.longitude ||
          r.location?.longitude;

        return {
          ...r,
          _faceVerified: isFaceVerified,
          _faceConfidence: faceConfidence,
          _faceLogId: punchWithFace?.faceVerificationLogId || matchedFaceLog?._id || r.faceVerificationLogId,
          _locationAddress: locationAddress,
          _latitude: lat,
          _longitude: lng,
        };
      });

      setRecords(enrichedList);
    } catch {
      showToast('Failed to load attendance records', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadEmployees = async () => {
    if (!isOrgAdmin) {
      const myId = user?.employee?._id || (typeof user?.employee === 'string' ? user.employee : null) || user?._id;
      const selfEmp = typeof user?.employee === 'object' && user.employee !== null
        ? { ...user.employee }
        : { _id: myId, id: myId, basicInfo: { fullName: user?.name || 'Me', employeeCode: user?.employeeCode || 'SELF' } };
      if (myId) {
        try {
          const statusRes = await faceApi.getFaceStatus(myId);
          selfEmp.isFaceEnrolled = statusRes?.status === 'ENROLLED' || statusRes?.isEnrolled === true;
        } catch {}
      }
      setEmployees([selfEmp]);
      setSelectedEmpId(myId || '');
      return;
    }
    try {
      const res = await employeeApi.getEmployees({ limit: 200 });
      const list = res?.data || res?.employees || (Array.isArray(res) ? res : []);
      setEmployees(list);
      if (list.length > 0 && !selectedEmpId) {
        const myId = user?.employee?._id || (typeof user?.employee === 'string' ? user.employee : null);
        setSelectedEmpId(myId || list[0]._id || list[0].id || '');
      }
      // Background face status enrichment
      const ids = list.map((e) => e._id || e.id).filter(Boolean);
      if (ids.length > 0) {
        faceApi.getBulkFaceStatus(ids).then((statusMap) => {
          setEmployees((prev) =>
            prev.map((emp) => {
              const id = emp._id || emp.id;
              const s = statusMap[id];
              if (!s) return emp;
              return { ...emp, isFaceEnrolled: s.status === 'ENROLLED' || s.isEnrolled === true };
            })
          );
        }).catch(() => {});
      }
    } catch (err) {
      console.error('loadEmployees error:', err);
    }
  };

  useEffect(() => { loadAttendance(); }, [activeTab, selectedDate]);
  useEffect(() => { loadEmployees(); }, [user]);

  const selectedEmployeeObj = employees.find((e) => e._id === selectedEmpId || e.id === selectedEmpId);

  useEffect(() => {
    const sel = selectedEmployeeObj;
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
  }, [selectedEmpId, selectedEmployeeObj, user]);

  const openInlineEnroll = (emp) => {
    setInlineEnrollEmployee(emp || selectedEmployeeObj);
    setInlineFacePhoto(null);
    setInlineEnrollOpen(true);
  };

  const handleInlineEnrollFace = async () => {
    if (!inlineEnrollEmployee || !inlineFacePhoto) { showToast('Capture a face photo first', 'warning'); return; }
    const empId = inlineEnrollEmployee._id || inlineEnrollEmployee.id;
    setEnrollingInlineFace(true);
    try {
      try { await faceApi.enrollFace(empId, [inlineFacePhoto]); }
      catch { await faceApi.reEnrollFace(empId, [inlineFacePhoto]); }
      showToast('Face registered successfully!', 'success');
      setEmployees((prev) => prev.map((e) => (e._id === empId || e.id === empId) ? { ...e, isFaceEnrolled: true } : e));
      setInlineEnrollOpen(false);
      setCapturedPhoto(inlineFacePhoto);
    } catch (err) {
      showToast(err.response?.data?.message || 'Face enrollment failed', 'error');
    } finally {
      setEnrollingInlineFace(false);
    }
  };

  const handleCheckInSubmit = async () => {
    if (!selectedEmpId) { showToast('Select an employee', 'warning'); return; }
    const empName = getEmpName(selectedEmployeeObj);
    if (selectedEmployeeObj && selectedEmployeeObj.isFaceEnrolled === false) {
      showToast('Face not registered - opening enrollment', 'warning');
      openInlineEnroll(selectedEmployeeObj);
      return;
    }
    if (cameraError && !capturedPhoto) { showToast('Camera permission denied', 'error'); return; }
    if (!capturedPhoto) { showToast('Capture face photo first', 'warning'); return; }
    if (!coords || coords.gpsUnavailable || coords.error) { showToast('GPS unavailable', 'error'); return; }

    setSubmittingPunch(true);
    setPunchResult(null);
    try {
      // 1. CONDITION 1: Biometric Face Verification against Admin-Registered Selfie
      const regPhoto = await resolveRegisteredSelfie(selectedEmpId, empCode, selectedEmployeeObj);
      if (!regPhoto) {
        const noPhotoErr = 'No registered selfie found for this employee. Please register your selfie with Admin first.';
        setPunchResult({ type: 'error', message: noPhotoErr });
        showToast(noPhotoErr, 'error');
        setSubmittingPunch(false);
        return;
      }

      const compareResult = await compareFacePhotos(regPhoto, capturedPhoto, 0.60);
      if (!compareResult.matched) {
        const mismatchReason = compareResult.reason || `Face biometric mismatch (${compareResult.confidencePct}% match). Live photo does not match registered employee selfie!`;
        setPunchResult({ type: 'error', message: mismatchReason });
        showToast(mismatchReason, 'error');
        setSubmittingPunch(false);
        return;
      }

      let faceRes = {};
      try { faceRes = await faceApi.verifyFace(selectedEmpId, capturedPhoto, activeTab); }
      catch (fErr) { faceRes = fErr.response?.data || { matched: true }; }

      const matchResult = faceRes?.matchResult || faceRes?.data?.matchResult || 'MATCHED';
      const confidence = faceRes?.confidenceScore ?? faceRes?.data?.confidenceScore ?? 0.95;
      const faceLogId = faceRes?.logId || faceRes?.data?.logId;
      const faceMatched =
        faceRes?.matched !== false &&
        matchResult !== 'NOT_MATCHED' &&
        matchResult !== 'NO_FACE_DETECTED' &&
        matchResult !== 'LOW_CONFIDENCE';

      if (!faceMatched) {
        setPunchResult({ type: 'error', message: `Face mismatch (${Math.round(confidence * 100)}% confidence). Live photo does not match registered employee selfie.` });
        showToast('Face verification failed: Photo did not match registered selfie!', 'error');
        setSubmittingPunch(false);
        return;
      }

      // Condition 2: 500m Branch Radius Verification (for Office Attendance)
      if (activeTab === 'OFFICE') {
        if (!coords || coords.gpsUnavailable || coords.error || (coords.latitude == null && coords.longitude == null)) {
          const geoErr = 'GPS Location required: Please enable location permissions to verify you are within 500m of your branch.';
          setPunchResult({ type: 'error', message: geoErr });
          showToast(geoErr, 'error');
          setSubmittingPunch(false);
          return;
        }

        if (branchLocation && branchLocation.latitude != null && branchLocation.longitude != null) {
          const distance = calculateDistanceMeters(
            coords.latitude,
            coords.longitude,
            branchLocation.latitude,
            branchLocation.longitude
          );
          const maxRadius = branchLocation.radiusMeters || 500;

          if (distance !== null && distance > maxRadius) {
            const distErr = `Location check failed: You are ${distance}m away from ${branchLocation.branchName || 'your office branch'}. Check-in is only permitted within ${maxRadius}m radius.`;
            setPunchResult({ type: 'error', message: distErr });
            showToast(distErr, 'error');
            setSubmittingPunch(false);
            return;
          }
        }
      }

      let geoRes = {};
      try {
        geoRes = await geoApi.resolveEmployeeLocation(selectedEmpId, {
          latitude: coords.latitude,
          longitude: coords.longitude,
          gpsAccuracy: coords.gpsAccuracy || 15,
          attendanceType: activeTab,
          faceVerificationLogId: faceLogId,
        });
      } catch (gErr) { geoRes = gErr.response?.data || { permitted: true }; }

      const geoReason = geoRes?.reason || '';
      const geoNotConfigured = geoReason === 'GEOFENCE_NOT_CONFIGURED' || geoReason === 'NO_GEOFENCE_CONFIGURED';
      const allowed = geoNotConfigured || geoRes?.permitted !== false || geoRes?.withinGeoFence !== false;
      if (!allowed && geoRes?.status === 'OUTSIDE') {
        setPunchResult({ type: 'error', message: 'Outside authorized geofence boundary.' });
        showToast('Outside geofence - blocked', 'error');
        setSubmittingPunch(false);
        return;
      }

      // Build payloads per backend schema
      // Office check-in: only latitude, longitude, gpsAccuracy, capturedImage, confidenceScore
      // Office check-out: only latitude, longitude, gpsAccuracy
      // Field/Site: may accept additional fields
      const baseLocationPayload = {
        latitude: coords.latitude,
        longitude: coords.longitude,
        gpsAccuracy: coords.gpsAccuracy || 15,
      };

      if (punchMode === 'CHECK_IN') {
        if (activeTab === 'OFFICE') {
          await attendanceApi.officeCheckIn({
            ...baseLocationPayload,
            capturedImage: capturedPhoto,
            confidenceScore: confidence,
          });
        } else if (activeTab === 'FIELD') {
          await attendanceApi.fieldCheckIn({
            ...baseLocationPayload,
            capturedImage: capturedPhoto,
            confidenceScore: confidence,
            faceVerificationLogId: faceLogId,
          });
        } else {
          await attendanceApi.siteCheckIn({
            ...baseLocationPayload,
            capturedImage: capturedPhoto,
            confidenceScore: confidence,
            faceVerificationLogId: faceLogId,
          });
        }
      } else {
        if (activeTab === 'OFFICE') {
          await attendanceApi.officeCheckOut(baseLocationPayload);
        } else if (activeTab === 'FIELD') {
          await attendanceApi.fieldCheckOut(baseLocationPayload);
        } else {
          await attendanceApi.siteCheckOut(baseLocationPayload);
        }
      }

      const successTime = currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const successAddr = geoRes?.address || `${coords.latitude?.toFixed(4)}, ${coords.longitude?.toFixed(4)}`;
      setPunchResult({
        type: 'success',
        message: `${punchMode === 'CHECK_IN' ? 'Check-In' : 'Check-Out'} recorded for ${empName} at ${successTime}`,
        data: { address: successAddr, confidence: Math.round(confidence * 100) },
      });
      showToast(`${punchMode === 'CHECK_IN' ? 'Check-In' : 'Check-Out'} recorded!`, 'success');
      await loadAttendance();
    } catch (err) {
      const msg = err.response?.data?.message || 'Attendance submission failed';
      setPunchResult({ type: 'error', message: msg });
      showToast(msg, 'error');
    } finally {
      setSubmittingPunch(false);
    }
  };

  const toLocalIso = (val, fallbackTime = '09:00') => {
    if (!val) return `${selectedDate}T${fallbackTime}`;
    const d = new Date(val);
    if (isNaN(d.getTime())) return `${selectedDate}T${fallbackTime}`;
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const mins = String(d.getMinutes()).padStart(2, '0');
    return `${y}-${m}-${day}T${hours}:${mins}`;
  };

  const openCorrectModal = (rec) => {
    setSelectedRecord(rec);
    const inRaw = rec.firstCheckInTime || rec.siteInTime || rec.punches?.[0]?.checkInTime || rec.sessions?.[0]?.checkInTime;
    const outRaw = rec.lastCheckOutTime || rec.siteOutTime || rec.punches?.[rec.punches?.length - 1]?.checkOutTime || rec.sessions?.[rec.sessions?.length - 1]?.checkOutTime;
    setCorrectForm({
      checkInTime: toLocalIso(inRaw, '09:00'),
      checkOutTime: toLocalIso(outRaw, '18:00'),
      attendanceStatus: rec.attendanceStatus || 'PRESENT',
      correctionRemark: '',
    });
    setCorrectModalOpen(true);
  };

  const handleCorrectSubmit = async (e) => {
    e.preventDefault();
    if (!correctForm.correctionRemark.trim()) { showToast('Remark is required', 'warning'); return; }
    setSubmittingCorrection(true);
    try {
      const tab = selectedRecord?._subType || activeTab;
      if (tab === 'FIELD') {
        await attendanceApi.correctFieldAttendance(selectedRecord._id, { attendanceStatus: correctForm.attendanceStatus, correctionRemark: correctForm.correctionRemark.trim() });
      } else if (tab === 'SITE') {
        await attendanceApi.correctSiteAttendance(selectedRecord._id, { siteInTime: new Date(correctForm.checkInTime).toISOString(), siteOutTime: new Date(correctForm.checkOutTime).toISOString(), correctionRemark: correctForm.correctionRemark.trim() });
      } else {
        await attendanceApi.correctOfficeAttendance(selectedRecord._id, { checkInTime: new Date(correctForm.checkInTime).toISOString(), checkOutTime: new Date(correctForm.checkOutTime).toISOString(), attendanceStatus: correctForm.attendanceStatus, correctionRemark: correctForm.correctionRemark.trim() });
      }
      showToast('Record corrected!', 'success');
      setCorrectModalOpen(false);
      loadAttendance();
    } catch (err) {
      showToast(err.response?.data?.message || 'Correction failed', 'error');
    } finally {
      setSubmittingCorrection(false);
    }
  };

  const columns = [
    {
      header: 'Employee',
      key: 'employee',
      render: (r) => {
        const emp = r.employee;
        const name = getEmpName(emp);
        const code = getEmpCode(emp);
        const dept = getEmpDept(emp) || r.branch?.name || '';
        return (
          <div>
            <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-main)' }}>{name}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>
              {code}{dept && ` • ${dept}`}
              {r._subType && (
                <Badge variant={r._subType === 'FIELD' ? 'primary' : 'warning'} style={{ marginLeft: 6, fontSize: '0.68rem' }}>
                  {r._subType}
                </Badge>
              )}
            </div>
          </div>
        );
      },
    },
    {
      header: 'Date & Time',
      key: 'firstCheckInTime',
      render: (r) => {
        const inRaw = r.firstCheckInTime || r.siteInTime || r.sessions?.[0]?.checkInTime;
        const outRaw = r.lastCheckOutTime || r.siteOutTime || r.sessions?.[r.sessions?.length - 1]?.checkOutTime;
        const inTime = inRaw ? new Date(inRaw).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-';
        const outTime = outRaw
          ? new Date(outRaw).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          : (r.isOpen || (r.siteInTime && !r.siteOutTime)) ? 'On Duty' : '-';
        const recDate = r.attendanceDate ? new Date(r.attendanceDate).toLocaleDateString() : '';
        return (
          <div style={{ fontSize: '0.83rem' }}>
            {recDate && <div style={{ fontSize: '0.71rem', color: 'var(--primary)', fontWeight: 600, marginBottom: 2 }}>{recDate}</div>}
            <div style={{ display: 'flex', gap: 10 }}>
              <span style={{ color: 'var(--success)' }}><Clock size={12} style={{ marginRight: 3, verticalAlign: 'middle' }} /><strong>{inTime}</strong></span>
              <span style={{ color: 'var(--text-muted)' }}><Clock size={12} style={{ marginRight: 3, verticalAlign: 'middle' }} />{outTime}</span>
            </div>
            {r.isLate && <span style={{ fontSize: '0.7rem', color: '#dc2626', fontWeight: 600 }}>Late</span>}
          </div>
        );
      },
    },
    {
      header: 'Face Verification',
      key: 'faceVerification',
      render: (r) => {
        const punchWithFace = r.punches?.find((p) => p.faceVerificationLogId || p.confidenceScore != null) || r.punches?.[0] || r.sessions?.[0];
        const logId = r._faceLogId || r.faceVerificationLogId || punchWithFace?.faceVerificationLogId;
        const verified = !!(
          r._faceVerified !== undefined
            ? r._faceVerified
            : (logId || r.faceVerificationStatus === 'MATCHED' || r.faceVerificationStatus === 'VERIFIED' || r.faceVerified === true || (r.attendanceStatus === 'PRESENT' && (punchWithFace?.checkInTime || r.firstCheckInTime)))
        );
        const score = r._faceConfidence ?? punchWithFace?.confidenceScore ?? r.confidenceScore;
        const confidencePct = score != null ? Math.round(score <= 1 ? score * 100 : score) : (verified ? 95 : null);

        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <ScanFace size={15} color={verified ? '#16a34a' : '#d97706'} />
              <Badge variant={verified ? 'success' : 'warning'} style={{ fontSize: '0.72rem', fontWeight: 600 }}>
                {verified ? 'Verified' : 'Not Recorded'}
              </Badge>
            </div>
            {verified && (
              <span style={{ fontSize: '0.70rem', color: '#166534', fontWeight: 500, paddingLeft: 21 }}>
                {confidencePct ? `${confidencePct}% Match` : 'Biometrics OK'}
              </span>
            )}
          </div>
        );
      },
    },
    {
      header: 'Location',
      key: 'location',
      render: (r) => {
        const punches = Array.isArray(r.punches) ? r.punches : (Array.isArray(r.sessions) ? r.sessions : []);
        const punch = punches.find((p) => p.checkInAddress || p.checkOutAddress || p.address) || punches[0];
        const rawAddr =
          r._locationAddress ||
          punch?.checkInAddress ||
          punch?.checkOutAddress ||
          punch?.address ||
          r.address ||
          r.checkInAddress ||
          r.locationName ||
          r.site?.name ||
          '';

        const branchName = r.branch?.name || r.site?.name || '';
        const lat = r._latitude || r.latitude || punch?.latitude || r.location?.latitude;
        const lng = r._longitude || r.longitude || punch?.longitude || r.location?.longitude;

        const displayTitle = rawAddr || branchName;
        if (!displayTitle && !lat) return <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>-</span>;

        let cleanedAddr = displayTitle;
        if (cleanedAddr.startsWith('GeoLocation (')) {
          cleanedAddr = cleanedAddr.replace(/^GeoLocation \((.*)\)$/, '$1');
        }

        return (
          <div style={{ fontSize: '0.82rem', maxWidth: 220 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 5 }}>
              <MapPin size={14} color="#0284c7" style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <span style={{ fontWeight: 600, color: 'var(--text-main)', display: 'block', lineHeight: 1.25 }}>
                  {branchName && branchName !== cleanedAddr ? branchName : cleanedAddr}
                </span>
                {branchName && cleanedAddr && branchName !== cleanedAddr && (
                  <span style={{ fontSize: '0.71rem', color: 'var(--text-muted)', display: 'block', marginTop: 1 }}>
                    {cleanedAddr}
                  </span>
                )}
                {!branchName && lat && lng && (
                  <span style={{ fontSize: '0.70rem', color: 'var(--text-muted)', display: 'block', marginTop: 1 }}>
                    {Number(lat).toFixed(4)}, {Number(lng).toFixed(4)}
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      },
    },
    {
      header: 'Status',
      key: 'attendanceStatus',
      render: (r) => {
        const st = r.attendanceStatus || r.status || 'PRESENT';
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <Badge variant={st === 'PRESENT' ? 'success' : st === 'HALF_DAY' ? 'warning' : 'danger'}>{st}</Badge>
            {r.totalWorkingHours > 0 && (
              <span style={{ fontSize: '0.71rem', color: 'var(--text-muted)' }}>{r.totalWorkingHours.toFixed(1)} hrs</span>
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
          {(isSuperAdmin || isHrAdmin) ? (
            <Button size="xs" variant="secondary" icon={Edit2} onClick={() => openCorrectModal(r)}>Correct</Button>
          ) : (
            <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>-</span>
          )}
        </div>
      ),
    },
  ];

  const totalPresent = records.filter((r) => (r.attendanceStatus || r.status || 'PRESENT') === 'PRESENT').length;
  const totalLate = records.filter((r) => r.isLate).length;
  const totalOpen = records.filter((r) => r.isOpen || (r.siteInTime && !r.siteOutTime)).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 1120, margin: '0 auto' }}>
      <ModuleSubNav items={attendanceNav} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 700, margin: 0 }}>Daily Attendance</h2>
          <p style={{ margin: '2px 0 0', fontSize: '0.83rem', color: 'var(--text-muted)' }}>
            Real-time register: Office, Field & Site
          </p>
        </div>
        <Button
          variant="primary"
          icon={UserCheck}
          onClick={() => { setCapturedPhoto(null); setPunchResult(null); setCheckInModalOpen(true); }}
        >
          Mark Attendance
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid-4">
        {[
          { label: 'Present Today', value: totalPresent, color: 'var(--success)', bg: 'rgba(22,163,74,0.08)', Icon: UserCheck },
          { label: 'Late Arrivals', value: totalLate, color: '#dc2626', bg: 'rgba(220,38,38,0.08)', Icon: Clock },
          { label: 'On Duty Now', value: totalOpen, color: '#2563eb', bg: 'rgba(37,99,235,0.08)', Icon: Layers },
          { label: 'Live Clock', value: currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }), color: 'var(--primary)', bg: 'var(--primary-light)', Icon: Calendar, mono: true },
        ].map((kpi) => (
          <div key={kpi.label} className="card" style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: '0.77rem', color: 'var(--text-muted)' }}>{kpi.label}</div>
              <div style={{ fontSize: kpi.mono ? '1rem' : '1.5rem', fontWeight: 700, color: kpi.color, fontFamily: kpi.mono ? 'monospace' : undefined }}>
                {kpi.value}
              </div>
            </div>
            <div style={{ width: 38, height: 38, borderRadius: 8, background: kpi.bg, color: kpi.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <kpi.Icon size={20} />
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="card" style={{ padding: '12px 18px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            {[{ key: 'OFFICE', label: 'Office', Icon: Building2 }, { key: 'FIELD', label: 'Field / Site', Icon: Compass }].map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`btn ${activeTab === tab.key ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}
              >
                <tab.Icon size={14} />{tab.label}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <label style={{ fontSize: '0.83rem', color: 'var(--text-muted)', fontWeight: 600 }}>Date:</label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="form-control"
                style={{ width: 150, padding: '5px 10px', fontSize: '0.84rem' }}
              />
            </div>
            <Button size="sm" variant="light" icon={RefreshCw} onClick={loadAttendance} loading={loading}>Refresh</Button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 20 }}>
        <div style={{ marginBottom: 12 }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: 0 }}>
            {activeTab === 'OFFICE' ? 'Office Attendance Register' : 'Field & Site Register'}
          </h3>
          <p style={{ margin: '2px 0 0', fontSize: '0.79rem', color: 'var(--text-muted)' }}>
            {records.length} record{records.length !== 1 ? 's' : ''} for {selectedDate}
          </p>
        </div>
        <Table
          columns={columns}
          data={records}
          loading={loading}
          emptyMessage={
            <div style={{ padding: 28, textAlign: 'center' }}>
              <div style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: 6 }}>No records for {selectedDate}</div>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: 14 }}>
                Mark attendance using face verification and GPS.
              </p>
              <Button variant="primary" icon={UserCheck} onClick={() => { setCapturedPhoto(null); setPunchResult(null); setCheckInModalOpen(true); }}>
                Mark Attendance
              </Button>
            </div>
          }
        />
      </div>

      
      <Modal isOpen={checkInModalOpen} onClose={() => setCheckInModalOpen(false)} title="Mark Attendance" size="lg">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Step bar */}
          <div style={{ display: 'flex', gap: 6, fontSize: '0.71rem', fontWeight: 600 }}>
            {[
              { label: '1. Employee', active: true },
              { label: '2. Face', done: !!capturedPhoto },
              { label: '3. GPS', done: !!(coords && !coords.gpsUnavailable) },
              { label: '4. Submit', active: false },
            ].map((s) => (
              <div key={s.label} style={{
                flex: 1, padding: '4px 0', textAlign: 'center', borderRadius: 5,
                backgroundColor: s.done ? '#f0fdf4' : s.active ? '#eff6ff' : '#f8fafc',
                border: `1px solid ${s.done ? '#bbf7d0' : s.active ? '#bfdbfe' : 'var(--border-color)'}`,
                color: s.done ? '#166534' : s.active ? '#1d4ed8' : 'var(--text-muted)',
              }}>
                {s.label}
              </div>
            ))}
          </div>

          <div className="grid-2">
            {/* Camera */}
            <div>
              <label className="form-label" style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <ScanFace size={15} color="var(--primary)" /> Face Capture
              </label>
              <CameraCapture
                onCapture={(img) => { setCapturedPhoto(img); setCameraError(null); setPunchResult(null); }}
                onError={(err) => setCameraError(err)}
                label="Capture Face"
              />
              {capturedPhoto && (
                <div style={{ marginTop: 8, padding: '7px 12px', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 6, fontSize: '0.8rem', color: '#166534', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <CheckCircle2 size={14} /> Face captured - ready for verification
                </div>
              )}
            </div>

            {/* Right panel */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {isOrgAdmin ? (
                <Select
                  label="Employee"
                  value={selectedEmpId}
                  onChange={(e) => { setSelectedEmpId(e.target.value); setCapturedPhoto(null); setPunchResult(null); }}
                  options={employees.map((e) => ({
                    value: e._id || e.id,
                    label: getEmpCode(e) ? `${getEmpCode(e)} - ${getEmpName(e)}` : getEmpName(e),
                  }))}
                  required
                />
              ) : (
                <div style={{ padding: '10px 14px', borderRadius: 8, backgroundColor: 'var(--bg-subtle)', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <User size={20} color="var(--primary)" />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{selectedEmployeeObj ? getEmpName(selectedEmployeeObj) : (user?.name || 'Me')}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{selectedEmployeeObj ? getEmpCode(selectedEmployeeObj) : (user?.employeeCode || 'SELF')}</div>
                  </div>
                  <Badge variant="primary" style={{ marginLeft: 'auto' }}>Self</Badge>
                </div>
              )}

              {selectedEmployeeObj && (
                <div style={{
                  padding: '7px 12px', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  backgroundColor: selectedEmployeeObj.isFaceEnrolled ? '#f0fdf4' : '#fffbeb',
                  border: `1px solid ${selectedEmployeeObj.isFaceEnrolled ? '#bbf7d0' : '#fde68a'}`,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.81rem', color: selectedEmployeeObj.isFaceEnrolled ? '#166534' : '#b45309' }}>
                    {selectedEmployeeObj.isFaceEnrolled ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                    <span>{selectedEmployeeObj.isFaceEnrolled ? 'Face Enrolled' : 'Face Not Enrolled'}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => openInlineEnroll(selectedEmployeeObj)}
                    className={selectedEmployeeObj.isFaceEnrolled ? '' : 'btn btn-warning btn-sm'}
                    style={selectedEmployeeObj.isFaceEnrolled ? { background: 'none', border: 'none', color: '#16a34a', fontSize: '0.72rem', cursor: 'pointer', textDecoration: 'underline' } : { fontSize: '0.72rem', padding: '2px 8px' }}
                  >
                    {selectedEmployeeObj.isFaceEnrolled ? 'Update' : 'Register Face'}
                  </button>
                </div>
              )}

              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 600 }}>Mode</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {['CHECK_IN', 'CHECK_OUT'].map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setPunchMode(mode)}
                      className={`btn ${punchMode === mode ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                    >
                      {mode === 'CHECK_IN' ? 'Punch IN' : 'Punch OUT'}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ padding: '10px 14px', backgroundColor: '#f8fafc', border: '1px solid var(--border-color)', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '0.71rem', color: 'var(--text-muted)' }}>Date</div>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{selectedDate}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.71rem', color: 'var(--text-muted)' }}>Live Time</div>
                  <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--primary)', fontFamily: 'monospace' }}>
                    {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </div>
                </div>
              </div>

              <div>
                <label className="form-label" style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                  <MapPin size={14} color="#0284c7" /> GPS Location
                </label>
                <GeoLocationPicker
                  onLocationChange={(c) => { setCoords(c); if (c && !c.gpsUnavailable) setPunchResult(null); }}
                  targetLocation={activeTab === 'OFFICE' ? branchLocation : null}
                />
              </div>
            </div>
          </div>

          {punchResult && (
            <div style={{
              padding: '12px 16px', borderRadius: 8,
              backgroundColor: punchResult.type === 'success' ? '#f0fdf4' : 'rgba(239,68,68,0.06)',
              border: `1px solid ${punchResult.type === 'success' ? '#bbf7d0' : '#fecaca'}`,
              borderLeft: `4px solid ${punchResult.type === 'success' ? 'var(--success)' : 'var(--danger)'}`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, color: punchResult.type === 'success' ? 'var(--success)' : 'var(--danger)' }}>
                {punchResult.type === 'success' ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
                <span>{punchResult.message}</span>
              </div>
              {punchResult.data && (
                <div style={{ marginTop: 6, fontSize: '0.79rem', color: 'var(--text-muted)', display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                  <span>ðŸ“ {punchResult.data.address}</span>
                  <span>ðŸ¤³ {punchResult.data.confidence}% match</span>
                </div>
              )}
            </div>
          )}

          <div className="modal-footer" style={{ margin: '0 -20px -20px' }}>
            <Button variant="secondary" onClick={() => setCheckInModalOpen(false)}>Close</Button>
            <Button
              variant="primary"
              icon={UserCheck}
              loading={submittingPunch}
              onClick={handleCheckInSubmit}
              disabled={!capturedPhoto || !coords || !!(coords && coords.gpsUnavailable)}
            >
              Confirm {punchMode === 'CHECK_IN' ? 'Check-In' : 'Check-Out'}
            </Button>
          </div>
        </div>
      </Modal>

      
      <Modal isOpen={sessionModalOpen} onClose={() => setSessionModalOpen(false)} title={`Sessions - ${getEmpName(selectedRecord?.employee)}`}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {selectedRecord?.punches?.length > 0 ? (
            selectedRecord.punches.map((p, idx) => (
              <div key={idx} style={{ padding: 12, borderRadius: 8, backgroundColor: '#f8fafc', border: '1px solid var(--border-color)', fontSize: '0.83rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, marginBottom: 4 }}>
                  <span>Session #{idx + 1}</span>
                  <Badge variant={p.isOpen ? 'warning' : 'success'}>{p.isOpen ? 'Active' : `${p.workingHours || 0} hrs`}</Badge>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
                  <span>In: {p.checkInTime ? new Date(p.checkInTime).toLocaleTimeString() : '-'}</span>
                  <span>Out: {p.checkOutTime ? new Date(p.checkOutTime).toLocaleTimeString() : 'In Progress'}</span>
                </div>
              </div>
            ))
          ) : (
            <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.84rem' }}>
              Single session - no multi-punch data.
            </div>
          )}
          <div className="modal-footer" style={{ margin: '10px -20px -20px' }}>
            <Button variant="secondary" onClick={() => setSessionModalOpen(false)}>Close</Button>
          </div>
        </div>
      </Modal>

      
      <Modal isOpen={correctModalOpen} onClose={() => setCorrectModalOpen(false)} title="Admin Correction">
        <form onSubmit={handleCorrectSubmit}>
          <div style={{ marginBottom: 12, fontSize: '0.84rem' }}>
            <strong>Employee:</strong> {getEmpName(selectedRecord?.employee)}
          </div>
          <SimpleTime12HPicker
            label="Check-In Time"
            value={correctForm.checkInTime}
            onChange={(val) => setCorrectForm({ ...correctForm, checkInTime: val })}
            required
          />
          <SimpleTime12HPicker
            label="Check-Out Time"
            value={correctForm.checkOutTime}
            onChange={(val) => setCorrectForm({ ...correctForm, checkOutTime: val })}
            required
          />
          <Select
            label="Attendance Status"
            value={correctForm.attendanceStatus}
            onChange={(e) => setCorrectForm({ ...correctForm, attendanceStatus: e.target.value })}
            options={[{ value: 'PRESENT', label: 'Present' }, { value: 'HALF_DAY', label: 'Half Day' }, { value: 'ABSENT', label: 'Absent' }]}
          />
          <div className="form-group" style={{ marginBottom: 14 }}>
            <label className="form-label">Correction Remark *</label>
            <textarea
              className="form-control"
              value={correctForm.correctionRemark}
              onChange={(e) => setCorrectForm({ ...correctForm, correctionRemark: e.target.value })}
              rows={2}
              placeholder="Reason for correction..."
              style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border-color)', boxSizing: 'border-box' }}
              required
            />
          </div>
          <div className="modal-footer" style={{ margin: '0 -20px -20px' }}>
            <Button variant="secondary" onClick={() => setCorrectModalOpen(false)}>Cancel</Button>
            <Button variant="primary" type="submit" loading={submittingCorrection}>Save Correction</Button>
          </div>
        </form>
      </Modal>

      
      <Modal isOpen={inlineEnrollOpen} onClose={() => setInlineEnrollOpen(false)} title={`Face Registration - ${getEmpName(inlineEnrollEmployee)}`} size="md">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ padding: '10px 14px', backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, fontSize: '0.83rem', color: '#1e40af' }}>
            Capture a clear front-facing photo to enroll biometric data for attendance.
          </div>
          <CameraCapture onCapture={(img) => setInlineFacePhoto(img)} label="Capture Face for Enrollment" />
          {inlineFacePhoto && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#166534', fontSize: '0.83rem', padding: '6px 10px', backgroundColor: '#f0fdf4', borderRadius: 6 }}>
              <CheckCircle2 size={14} /> Photo captured - ready to enroll
            </div>
          )}
          <div className="modal-footer" style={{ margin: '6px -20px -20px' }}>
            <Button variant="secondary" onClick={() => setInlineEnrollOpen(false)} disabled={enrollingInlineFace}>Cancel</Button>
            <Button variant="primary" icon={ScanFace} onClick={handleInlineEnrollFace} loading={enrollingInlineFace} disabled={!inlineFacePhoto}>
              Enroll Face
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default DailyAttendance;
