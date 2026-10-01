import React, { useState, useEffect, useCallback, useMemo } from 'react';
import attendanceApi from '../../api/attendanceApi';
import { regularizationApi } from '../../api/regularizationApi';
import { faceApi } from '../../api/faceApi';
import { geoApi } from '../../api/geoApi';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import {
  Calendar, Clock, MapPin, CheckCircle2, AlertCircle, ScanFace,
  Edit2, RefreshCw, Building2, Search,
  Check, X, ShieldCheck, LogIn, LogOut,
  Navigation, Eye, Sliders, AlertTriangle, XCircle, Users, TrendingUp
} from 'lucide-react';
import Modal from '../../components/common/Modal';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import CameraCapture from '../../components/common/CameraCapture';
import TimePicker12 from '../../components/common/TimePicker12';
import { extractApiData } from '../../utils/apiUtils';

export const DailyAttendance = () => {
  const { user, isSuperAdmin, isHrAdmin, isDirector, isBranchManager } = useAuth();
  const isOrgAdmin = isSuperAdmin || isHrAdmin || isDirector || isBranchManager;
  const { showToast } = useToast();

  const [currentTime, setCurrentTime] = useState(new Date());

  // Work type from employee profile
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

  const isFieldStaff = userWorkType === 'FIELD';
  const isHybridStaff = userWorkType === 'HYBRID';
  const isOfficeAllowed = isOrgAdmin || userWorkType === 'OFFICE' || userWorkType === 'HYBRID';
  const isFieldAllowed = isOrgAdmin || userWorkType === 'FIELD' || userWorkType === 'HYBRID';

  // Tabs
  const [activeTab, setActiveTab] = useState('records');

  // Attendance type filter in records tab
  const [attendanceType, setAttendanceType] = useState(() => (isFieldStaff ? 'FIELD' : 'OFFICE'));

  // View scope: MY vs ALL (for org admins)
  const [viewScope, setViewScope] = useState(isOrgAdmin ? 'ALL' : 'MY');

  // Filters
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [searchQuery, setSearchQuery] = useState('');

  // Records data
  const [records, setRecords] = useState([]);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [myTodayRecord, setMyTodayRecord] = useState(null);

  // KPI stats — loaded independently on mount from today's data
  const [kpiData, setKpiData] = useState({
    presentCount: 0,
    lateCount: 0,
    absentCount: 0,
    fieldCount: 0,
    loadingKpi: true,
  });

  // Face verification states
  const [verifyingFace, setVerifyingFace] = useState(false);
  const [faceMatchResult, setFaceMatchResult] = useState(null); // null | 'matched' | 'failed'
  const [verifyResult, setVerifyResult] = useState(null); // { logId, confidenceScore }
  const [punchError, setPunchError] = useState(null);

  // Punch modal
  const [punchModalOpen, setPunchModalOpen] = useState(false);
  const [punchActionType, setPunchActionType] = useState('CHECK_IN');
  const [punchAttendanceType, setPunchAttendanceType] = useState(() => (isFieldStaff ? 'FIELD' : 'OFFICE'));
  const [punchRemarks, setPunchRemarks] = useState('');
  const [capturedPhoto, setCapturedPhoto] = useState(null);
  const [submittingPunch, setSubmittingPunch] = useState(false);
  const [gpsCoords, setGpsCoords] = useState({ latitude: 21.2420, longitude: 72.8870, accuracy: 15 });
  const [gpsStatus, setGpsStatus] = useState('Acquiring GPS...');

  // Site attendance
  const [detectedSites, setDetectedSites] = useState([]);
  const [detectingSites, setDetectingSites] = useState(false);
  const [selectedSiteId, setSelectedSiteId] = useState('');
  const [selectedTaskId, setSelectedTaskId] = useState('');

  // Sessions detail modal
  const [sessionModalOpen, setSessionModalOpen] = useState(false);
  const [selectedRecordForSessions, setSelectedRecordForSessions] = useState(null);

  // Admin correction modal
  const [correctModalOpen, setCorrectModalOpen] = useState(false);
  const [selectedRecordForCorrect, setSelectedRecordForCorrect] = useState(null);
  const [submittingCorrect, setSubmittingCorrect] = useState(false);
  const [correctForm, setCorrectForm] = useState({
    checkInTime: '',
    checkOutTime: '',
    attendanceStatus: 'PRESENT',
    correctionRemark: '',
  });

  // Regularization
  const [regularizations, setRegularizations] = useState([]);
  const [loadingRegs, setLoadingRegs] = useState(false);
  const [regModalOpen, setRegModalOpen] = useState(false);
  const [submittingReg, setSubmittingReg] = useState(false);
  const [regForm, setRegForm] = useState({
    attendanceDate: new Date().toISOString().split('T')[0],
    attendanceType: 'OFFICE',
    requestType: 'WRONG_TIME_RECORDED',
    proposedCheckInTime: '09:00',
    proposedCheckOutTime: '18:00',
    reason: '',
  });

  // Geofences
  const [geofences, setGeofences] = useState([]);
  const [loadingFences, setLoadingFences] = useState(false);

  // ─── Live Clock ────────────────────────────────────────────────────────────
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // ─── GPS ───────────────────────────────────────────────────────────────────
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
        () => {
          setGpsStatus('GPS Default: Office Coordinates');
        },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    }
  }, []);

  // ─── Safe List Extractor ───────────────────────────────────────────────────
  // Handles backend keys: requests, data, records, regularizations, geofences
  const toList = (res) => {
    if (!res) return [];
    const raw = res.data ?? res;
    if (Array.isArray(raw)) return raw;
    // Try known keys in priority order
    for (const key of ['requests', 'records', 'regularizations', 'geofences', 'data', 'pendingRequests']) {
      if (Array.isArray(raw[key])) return raw[key];
    }
    // Top-level array
    if (Array.isArray(res)) return res;
    return [];
  };

  // ─── Build correct params per endpoint ────────────────────────────────────
  // /attendance/office/me & /attendance/field/me accept: from, to, page, limit
  // /attendance/office & /attendance/field accept: date, branch, attendanceStatus, isOpen, page, limit
  const buildParams = useCallback((scope) => {
    if (!selectedDate) return { limit: 100 };
    if (scope === 'MY') {
      return { from: selectedDate, to: selectedDate, limit: 100 };
    }
    return { date: selectedDate, limit: 100 };
  }, [selectedDate]);

  // ─── 1. Load Attendance Records (+ KPI + Today Status in one pass) ──────
  // Single API call per load — KPI stats and today's record are derived from
  // the same data, avoiding redundant parallel fetches on mount.
  const loadRecords = useCallback(async () => {
    setLoadingRecords(true);
    const todayIso = new Date().toISOString().split('T')[0];
    const isToday = selectedDate === todayIso;

    try {
      const myParams = buildParams('MY');
      const allParams = buildParams('ALL');

      // For org admins on today + records tab, fetch both office AND field together
      // so we can populate KPI cards from the same single round-trip
      let officeList = [];
      let fieldList = [];
      let siteList = [];

      if (attendanceType === 'OFFICE') {
        if (viewScope === 'ALL' && isOrgAdmin) {
          // Fetch office (primary) + field (for KPI) in parallel — 2 calls total
          const [offRes, fldRes] = await Promise.allSettled([
            attendanceApi.getAllOfficeAttendance(allParams),
            isToday ? attendanceApi.getAllFieldAttendance({ date: todayIso, limit: 200 }) : Promise.resolve(null),
          ]);
          officeList = offRes.status === 'fulfilled' ? toList(offRes.value) : [];
          fieldList = fldRes.status === 'fulfilled' && fldRes.value ? toList(fldRes.value) : [];
        } else {
          const res = await attendanceApi.getMyOfficeAttendance(myParams);
          officeList = toList(res);
        }
      } else if (attendanceType === 'FIELD') {
        if (viewScope === 'ALL' && isOrgAdmin) {
          const res = await attendanceApi.getAllFieldAttendance(allParams);
          fieldList = toList(res);
        } else {
          const res = await attendanceApi.getMyFieldAttendance(myParams);
          fieldList = toList(res);
        }
      } else if (attendanceType === 'SITE') {
        if (viewScope === 'ALL' && isOrgAdmin) {
          const res = await (attendanceApi.getAllSiteAttendance?.(allParams) || Promise.resolve({ data: [] }));
          siteList = toList(res);
        } else {
          const res = await attendanceApi.getMySiteAttendance(myParams);
          siteList = toList(res);
        }
      }

      // Primary list for the table
      const primaryList =
        attendanceType === 'OFFICE' ? officeList
        : attendanceType === 'FIELD' ? fieldList
        : siteList;

      setRecords(primaryList);

      // ── Derive today's personal record (no extra API call needed) ──
      if (viewScope === 'MY') {
        const meToday = primaryList.find((r) => {
          const rDate = (r.attendanceDate || r.siteInTime || r.firstCheckInTime || '').split('T')[0];
          return rDate === todayIso;
        }) || (isToday && primaryList.length > 0 ? primaryList[0] : null);
        if (meToday) setMyTodayRecord(meToday);
      } else if (isOrgAdmin) {
        // For org admins, pick own record from the full list
        const myEmpId = user?.employee?._id || (typeof user?.employee === 'string' ? user.employee : null);
        if (myEmpId) {
          const mine = primaryList.find((r) => {
            const recEmpId = r.employee?._id || r.employee || r.employeeId;
            return String(recEmpId) === String(myEmpId);
          });
          if (mine) setMyTodayRecord(mine);
        }
      }

      // ── Derive KPI stats from already-fetched data (zero extra calls) ──
      if (isToday) {
        const combined = [...officeList, ...fieldList, ...siteList];
        const presentCount = combined.filter(
          (r) => r.attendanceStatus === 'PRESENT' || r.attendanceStatus === 'HALF_DAY'
        ).length;
        const lateCount = combined.filter((r) => r.lateStatus?.isLate === true).length;
        const absentCount = combined.filter((r) => r.attendanceStatus === 'ABSENT').length;
        const fieldCount = fieldList.length;
        setKpiData({ presentCount, lateCount, absentCount, fieldCount, loadingKpi: false });
      }
    } catch (err) {
      console.error('Error loading attendance records:', err);
      setRecords([]);
      setKpiData((prev) => ({ ...prev, loadingKpi: false }));
    } finally {
      setLoadingRecords(false);
    }
  }, [attendanceType, viewScope, selectedDate, isOrgAdmin, user, buildParams]);

  // ─── 2. Load Regularizations ──────────────────────────────────────────────
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

  // ─── 3. Load Geofences ────────────────────────────────────────────────────
  const loadGeofences = useCallback(async () => {
    setLoadingFences(true);
    try {
      const fetchFences = geoApi.getGeofences || geoApi.getGeoFences;
      const res = fetchFences ? await fetchFences() : { data: [] };
      setGeofences(toList(res));
    } catch (err) {
      console.error('Error loading geofences:', err);
      setGeofences([]);
    } finally {
      setLoadingFences(false);
    }
  }, []);

  // ─── Tab switch triggers (single effect — no duplicate mount calls) ──────
  // loadRecords already handles KPI + today status derivation internally.
  useEffect(() => {
    if (activeTab === 'records') loadRecords();
    else if (activeTab === 'regularization') loadRegularizations();
    else if (activeTab === 'geofences') loadGeofences();
  }, [activeTab, loadRecords, loadRegularizations, loadGeofences]);

  // ─── Detect nearby sites ──────────────────────────────────────────────────
  const handleDetectNearbySites = useCallback(async () => {
    setDetectingSites(true);
    try {
      const res = await attendanceApi.detectSites({
        latitude: gpsCoords.latitude,
        longitude: gpsCoords.longitude,
        gpsAccuracy: gpsCoords.accuracy || 15,
      });
      const list =
        res?.candidateSites ||
        res?.sites ||
        res?.data?.candidateSites ||
        res?.data?.sites ||
        (Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []));
      setDetectedSites(list);
      if (list.length > 0) {
        const first = list[0];
        const sId = first.siteId || first._id || first.id;
        setSelectedSiteId(sId);
        const tasks = first.eligibleTasks || first.assignedTasks || [];
        if (tasks.length > 0) setSelectedTaskId(tasks[0]._id || tasks[0].id);
      }
    } catch (err) {
      console.warn('Site detection note:', err?.message);
    } finally {
      setDetectingSites(false);
    }
  }, [gpsCoords]);

  useEffect(() => {
    if (punchModalOpen && punchAttendanceType === 'SITE' && detectedSites.length === 0) {
      handleDetectNearbySites();
    }
  }, [punchModalOpen, punchAttendanceType, detectedSites.length, handleDetectNearbySites]);

  // ─── STEP 2: Backend Face Verification (SECURE — uses AI endpoint) ────────
  const handleVerifyFace = async () => {
    if (!capturedPhoto) {
      showToast('Please capture your face photo first', 'warning');
      return;
    }
    const myEmpId =
      user?.employee?._id ||
      (typeof user?.employee === 'string' ? user.employee : null) ||
      user?._id;
    if (!myEmpId) {
      showToast('Employee profile not found', 'error');
      return;
    }

    setVerifyingFace(true);
    setFaceMatchResult(null);
    setPunchError(null);
    setVerifyResult(null);

    try {
      // Call backend AI biometric endpoint — POST /face/employees/{employeeId}/verify
      const result = await faceApi.verifyFace(myEmpId, capturedPhoto, {
        triggeredByModule: punchAttendanceType,  // 'OFFICE' | 'FIELD' | 'SITE'
        confidenceScore: 0.95,
        gpsCoordinates: {
          latitude: gpsCoords.latitude,
          longitude: gpsCoords.longitude,
        },
      });

      if (result.matched) {
        setFaceMatchResult('matched');
        setVerifyResult({ logId: result.logId, confidenceScore: result.confidenceScore });
        showToast(
          `Face verified — ${Math.round((result.confidenceScore || 0.95) * 100)}% biometric confidence`,
          'success'
        );
      } else {
        const reason =
          result.reason ||
          `Face mismatch (score: ${Math.round((result.confidenceScore || 0) * 100)}%). Try better lighting or recapture.`;
        setFaceMatchResult('failed');
        setPunchError(reason);
        showToast(reason, 'error');
      }
    } catch (err) {
      // If employee not enrolled in backend, surface a clear message
      const status = err.response?.status;
      let msg = err.response?.data?.message || err.message || 'Face verification failed';
      if (status === 404 || status === 400) {
        msg = 'Face biometric not enrolled for this employee. Ask your HR Admin to enroll your face in Employee Master.';
      }
      setFaceMatchResult('failed');
      setPunchError(msg);
      showToast(msg, 'error');
    } finally {
      setVerifyingFace(false);
    }
  };

  // ─── STEP 3: Execute Punch (with backend-verified logId + confidenceScore) ─
  const handleExecutePunch = async () => {
    if (!capturedPhoto) {
      showToast('Please capture your face photo first', 'warning');
      return;
    }
    if (faceMatchResult !== 'matched') {
      showToast('Face verification required before check-in/check-out', 'error');
      return;
    }
    setSubmittingPunch(true);
    try {
      const payload = {
        latitude: gpsCoords.latitude,
        longitude: gpsCoords.longitude,
        gpsAccuracy: gpsCoords.accuracy || 15,
        capturedImage: capturedPhoto,
        // Use backend-verified confidence score (from AI) if available, else safe default
        confidenceScore: verifyResult?.confidenceScore ?? 0.95,
        // Pass biometric audit log ID from backend verify response
        ...(verifyResult?.logId ? { faceVerificationLogId: verifyResult.logId } : {}),
        ...(punchRemarks.trim() ? { remarks: punchRemarks.trim() } : {}),
      };

      if (punchActionType === 'CHECK_IN') {
        let pRes;
        if (punchAttendanceType === 'OFFICE') {
          pRes = await attendanceApi.officeCheckIn(payload);
          showToast('Office Check-In recorded. Face & GPS verified.', 'success');
        } else if (punchAttendanceType === 'FIELD') {
          pRes = await attendanceApi.fieldCheckIn(payload);
          showToast('Field Staff Check-In recorded. Face & GPS verified.', 'success');
        } else {
          if (!selectedSiteId || !selectedTaskId) {
            showToast('Select a project site and task to proceed with Site check-in.', 'warning');
            setSubmittingPunch(false);
            return;
          }
          pRes = await attendanceApi.siteCheckIn({
            ...payload,
            selectedSiteId,
            taskId: selectedTaskId,
            employee: user?.employee?._id || user?.employee,
            address: gpsStatus,
            siteInAddress: gpsStatus,
          });
          showToast('Site-In recorded. Project site & biometric verified.', 'success');
        }
        const rec = pRes?.record || pRes?.data?.record || pRes?.data;
        setMyTodayRecord(rec && typeof rec === 'object' ? { ...rec, isOpen: true } : { isOpen: true, firstCheckInTime: new Date().toISOString(), attendanceStatus: 'PRESENT' });
      } else {
        let pRes;
        if (punchAttendanceType === 'OFFICE') {
          pRes = await attendanceApi.officeCheckOut(payload);
          showToast('Office Check-Out recorded. Working hours calculated.', 'success');
        } else if (punchAttendanceType === 'FIELD') {
          pRes = await attendanceApi.fieldCheckOut(payload);
          showToast('Field Staff Check-Out recorded. Working hours calculated.', 'success');
        } else {
          pRes = await attendanceApi.siteCheckOut({
            ...payload,
            employee: user?.employee?._id || user?.employee,
            photos: [capturedPhoto],
            activityRemarks: punchRemarks.trim() || 'Site execution completed',
          });
          showToast('Site-Out recorded. Site hours & activity logged.', 'success');
        }
        const rec = pRes?.record || pRes?.data?.record || pRes?.data;
        setMyTodayRecord(rec && typeof rec === 'object' ? { ...rec, isOpen: false } : { isOpen: false, lastCheckOutTime: new Date().toISOString(), attendanceStatus: 'PRESENT' });
      }

      setPunchModalOpen(false);
      setPunchRemarks('');
      setCapturedPhoto(null);
      setFaceMatchResult(null);
      setVerifyResult(null);
      setPunchError(null);
      // Refresh table + KPI boxes + personal status
      await Promise.all([loadRecords(), loadKpiData(), loadMyTodayStatus()]);

    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Attendance punch failed';
      showToast(msg, 'error');
      setPunchError(msg);
    } finally {
      setSubmittingPunch(false);
    }
  };

  // ─── Admin Correction ─────────────────────────────────────────────────────
  const handleOpenCorrect = (record) => {
    setSelectedRecordForCorrect(record);
    const inTime = record.firstCheckInTime
      ? new Date(record.firstCheckInTime).toISOString().slice(0, 16)
      : '';
    const outTime = record.lastCheckOutTime
      ? new Date(record.lastCheckOutTime).toISOString().slice(0, 16)
      : '';
    setCorrectForm({
      checkInTime: inTime,
      checkOutTime: outTime,
      attendanceStatus: record.attendanceStatus || 'PRESENT',
      correctionRemark: '',
    });
    setCorrectModalOpen(true);
  };

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
        checkInTime: correctForm.checkInTime
          ? new Date(correctForm.checkInTime).toISOString()
          : undefined,
        checkOutTime: correctForm.checkOutTime
          ? new Date(correctForm.checkOutTime).toISOString()
          : undefined,
      };
      if (selectedRecordForCorrect.attendanceType === 'FIELD') {
        await attendanceApi.correctFieldAttendance(selectedRecordForCorrect._id, payload);
      } else {
        await attendanceApi.correctOfficeAttendance(selectedRecordForCorrect._id, payload);
      }
      showToast('Attendance record corrected successfully', 'success');
      setCorrectModalOpen(false);
      await loadRecords();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to correct record', 'error');
    } finally {
      setSubmittingCorrect(false);
    }
  };

  // ─── Regularization ───────────────────────────────────────────────────────
  const handleSubmitRegularization = async (e) => {
    e.preventDefault();
    if (!regForm.reason.trim()) {
      showToast('Please provide a reason for regularization', 'warning');
      return;
    }
    setSubmittingReg(true);
    try {
      // Build ISO date-time strings for proposedCheckInTime / proposedCheckOutTime
      const dateStr = regForm.attendanceDate;
      const toIso = (hhmm) => `${dateStr}T${hhmm}:00.000Z`;

      await regularizationApi.applyRegularization({
        attendanceDate: dateStr,
        attendanceType: regForm.attendanceType,
        requestType: regForm.requestType,
        proposedCheckInTime: toIso(regForm.proposedCheckInTime),
        proposedCheckOutTime: toIso(regForm.proposedCheckOutTime),
        reason: regForm.reason.trim(),
      });
      showToast('Regularization request submitted for manager review', 'success');
      setRegModalOpen(false);
      setRegForm({
        attendanceDate: new Date().toISOString().split('T')[0],
        attendanceType: 'OFFICE',
        requestType: 'WRONG_TIME_RECORDED',
        proposedCheckInTime: '09:00',
        proposedCheckOutTime: '18:00',
        reason: '',
      });
      await loadRegularizations();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to submit regularization', 'error');
    } finally {
      setSubmittingReg(false);
    }
  };

  const handleDecideRegularization = async (id, decision) => {
    try {
      if (decision === 'APPROVE') {
        await regularizationApi.approveRegularization(id, { remark: 'Approved by HR Administrator' });
        showToast('Regularization request approved and attendance updated', 'success');
      } else {
        await regularizationApi.rejectRegularization(id, { remark: 'Rejected after review' });
        showToast('Regularization request rejected', 'info');
      }
      await loadRegularizations();
    } catch (err) {
      showToast(err.response?.data?.message || 'Decision failed', 'error');
    }
  };

  // ─── Filtered records ─────────────────────────────────────────────────────
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

  // ─── Derive open sessions from current records view ─────────────────────
  const openSessionCount = useMemo(
    () => records.filter((r) => r.isOpen === true).length,
    [records]
  );

  // ─── Today's personal status ──────────────────────────────────────────────
  const hasActiveSession = Boolean(
    myTodayRecord &&
    (
      myTodayRecord.isOpen === true ||
      (Array.isArray(myTodayRecord.punches) && myTodayRecord.punches.some((p) => p.isOpen === true || (!p.checkOutTime && p.checkInTime))) ||
      (myTodayRecord.firstCheckInTime && !myTodayRecord.lastCheckOutTime)
    )
  );

  const hasCompletedSession = Boolean(
    myTodayRecord &&
    !hasActiveSession &&
    (
      myTodayRecord.lastCheckOutTime ||
      (Array.isArray(myTodayRecord.punches) && myTodayRecord.punches.length > 0 && myTodayRecord.punches.every((p) => Boolean(p.checkOutTime))) ||
      myTodayRecord.attendanceStatus === 'PRESENT' ||
      myTodayRecord.attendanceStatus === 'HALF_DAY'
    )
  );

  // ─── Reset face state when punch modal closes ─────────────────────────────
  const closePunchModal = () => {
    setPunchModalOpen(false);
    setCapturedPhoto(null);
    setFaceMatchResult(null);
    setVerifyResult(null);
    setPunchError(null);
    setPunchRemarks('');
  };

  // ─── Styles ───────────────────────────────────────────────────────────────
  const S = {
    page: {
      display: 'flex',
      flexDirection: 'column',
      gap: 14,
      fontFamily: 'var(--font-family)',
      width: '100%',
    },
    card: {
      background: '#fff',
      borderRadius: 10,
      border: '1px solid #e2e8f0',
      overflow: 'hidden',
    },
    headerCard: {
      background: '#fff',
      borderRadius: 10,
      border: '1px solid #e2e8f0',
      padding: '14px 20px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 12,
    },
    kpiGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
      gap: 12,
    },
    kpiCard: (accentColor, bgTint) => ({
      background: '#fff',
      borderRadius: 10,
      border: '1px solid #e2e8f0',
      borderTop: `3px solid ${accentColor}`,
      padding: '16px 18px',
      display: 'flex',
      alignItems: 'center',
      gap: 14,
      transition: 'box-shadow 0.15s',
    }),
    kpiIcon: (bg, color) => ({
      background: bg,
      color,
      width: 42,
      height: 42,
      borderRadius: 10,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    }),
    tabBar: {
      background: '#fff',
      borderRadius: 10,
      border: '1px solid #e2e8f0',
      padding: 6,
      display: 'flex',
      gap: 4,
      overflowX: 'auto',
      scrollbarWidth: 'none',
    },
    tab: (active) => ({
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      padding: '7px 14px',
      borderRadius: 7,
      border: 'none',
      fontSize: '0.83rem',
      fontWeight: 600,
      cursor: 'pointer',
      whiteSpace: 'nowrap',
      flexShrink: 0,
      background: active ? 'var(--primary)' : 'transparent',
      color: active ? '#fff' : '#64748b',
      transition: 'all 0.15s',
    }),
    filterBar: {
      padding: '10px 14px',
      borderBottom: '1px solid #e2e8f0',
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      flexWrap: 'wrap',
    },
    pill: (active) => ({
      padding: '5px 12px',
      borderRadius: 20,
      border: '1px solid',
      borderColor: active ? 'var(--primary)' : '#e2e8f0',
      background: active ? 'var(--primary-light, #f0fdfa)' : '#fff',
      color: active ? 'var(--primary)' : '#64748b',
      fontSize: '0.78rem',
      fontWeight: 600,
      cursor: 'pointer',
      whiteSpace: 'nowrap',
    }),
    th: {
      padding: '10px 14px',
      fontSize: '0.78rem',
      fontWeight: 600,
      color: '#64748b',
      textAlign: 'left',
      background: '#f8fafc',
    },
    td: {
      padding: '11px 14px',
      fontSize: '0.82rem',
      borderBottom: '1px solid #f1f5f9',
    },
    emptyState: {
      padding: '40px 20px',
      textAlign: 'center',
      color: '#64748b',
    },
  };

  return (
    <div style={S.page}>

      {/* ── 1. HEADER ─────────────────────────────────────────────────────── */}
      <div style={S.headerCard}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            background: 'linear-gradient(135deg, var(--primary) 0%, #337a82 100%)',
            color: '#fff', padding: 10, borderRadius: 10,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Clock size={22} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#0f172a' }}>
                Attendance &amp; Biometric Gates
              </h2>
              <span style={{
                fontSize: '0.73rem', background: '#f1f5f9', color: '#475569',
                padding: '2px 8px', borderRadius: 6, fontWeight: 600,
              }}>
                {currentTime.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                {' \u2022 '}
                {currentTime.toLocaleTimeString()}
              </span>
            </div>
            <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: '#64748b' }}>
              Live check-in/out with biometric face verification &amp; GPS geofencing
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {hasActiveSession ? (
            <Button
              variant="danger"
              icon={LogOut}
              onClick={() => { setPunchActionType('CHECK_OUT'); setPunchModalOpen(true); }}
              style={{ background: '#dc2626', borderColor: '#dc2626', color: '#fff', fontWeight: 700, boxShadow: '0 2px 4px rgba(220,38,38,0.25)' }}
            >
              Punch Check-Out
            </Button>
          ) : (
            <Button
              variant="primary"
              icon={LogIn}
              onClick={() => { setPunchActionType('CHECK_IN'); setPunchModalOpen(true); }}
              style={{ background: 'var(--primary)', borderColor: 'var(--primary)', color: '#fff', fontWeight: 700, boxShadow: '0 2px 6px rgba(63, 146, 154, 0.35)' }}
            >
              {hasCompletedSession ? 'Punch Check-In (New Session)' : 'Punch Check-In'}
            </Button>
          )}
          <Button variant="secondary" icon={Sliders} onClick={() => setRegModalOpen(true)}>
            Regularize
          </Button>
        </div>
      </div>

      {/* ── 2. TODAY'S PERSONAL STATUS ────────────────────────────────────── */}
      <div style={{
        background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0',
        padding: '11px 18px', display: 'flex', justifyContent: 'space-between',
        alignItems: 'center', flexWrap: 'wrap', gap: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            background: hasActiveSession ? '#fef3c7' : hasCompletedSession ? 'var(--logo-green-light, #f4f9ed)' : '#f1f5f9',
            color: hasActiveSession ? 'var(--logo-orange, #f5a532)' : hasCompletedSession ? 'var(--logo-green, #8bc54a)' : '#64748b',
            padding: 8, borderRadius: 8, display: 'flex', flexShrink: 0,
          }}>
            {hasActiveSession
              ? <Clock size={17} />
              : hasCompletedSession
                ? <CheckCircle2 size={17} />
                : <AlertCircle size={17} />}
          </div>
          <div>
            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0f172a' }}>
              {hasActiveSession
                ? `Checked In at ${myTodayRecord?.firstCheckInTime
                  ? new Date(myTodayRecord.firstCheckInTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
                  : 'Today'} — Session Active`
                : hasCompletedSession
                  ? `Completed Today — ${myTodayRecord?.totalWorkingHours || 0} hrs worked`
                  : 'No attendance punch recorded for today yet'}
            </div>
            <div style={{ fontSize: '0.74rem', color: '#64748b' }}>{gpsStatus}</div>
          </div>
        </div>
        <Badge variant={hasCompletedSession ? 'success' : hasActiveSession ? 'warning' : 'secondary'}>
          {hasCompletedSession ? 'PRESENT' : hasActiveSession ? 'IN PROGRESS' : 'NOT PUNCHED'}
        </Badge>
      </div>

      {/* ── 3. KPI METRIC CARDS ─────────────────────────────────────────── */}
      <div style={S.kpiGrid}>

        {/* Present Today */}
        <div style={S.kpiCard('var(--logo-green, #8bc54a)')}>
          <div style={S.kpiIcon('var(--logo-green-light, #f4f9ed)', 'var(--logo-green, #8bc54a)')}>
            <CheckCircle2 size={20} />
          </div>
          <div>
            <div style={{ fontSize: '1.9rem', fontWeight: 800, color: '#0f172a', lineHeight: 1, letterSpacing: '-1px' }}>
              {kpiData.loadingKpi
                ? <span style={{ fontSize: '1rem', color: '#94a3b8', fontWeight: 500 }}>Loading...</span>
                : kpiData.presentCount}
            </div>
            <div style={{ fontSize: '0.73rem', color: '#64748b', marginTop: 5, fontWeight: 500 }}>
              {isOrgAdmin ? 'Present Today' : 'My Present Records'}
            </div>
          </div>
        </div>

        {/* Late Arrivals */}
        <div style={S.kpiCard('var(--logo-orange, #f5a532)')}>
          <div style={S.kpiIcon('var(--logo-orange-light, #fef8ee)', 'var(--logo-orange, #f5a532)')}>
            <AlertTriangle size={20} />
          </div>
          <div>
            <div style={{ fontSize: '1.9rem', fontWeight: 800, color: '#0f172a', lineHeight: 1, letterSpacing: '-1px' }}>
              {kpiData.loadingKpi
                ? <span style={{ fontSize: '1rem', color: '#94a3b8', fontWeight: 500 }}>Loading...</span>
                : kpiData.lateCount}
            </div>
            <div style={{ fontSize: '0.73rem', color: '#64748b', marginTop: 5, fontWeight: 500 }}>Late Arrivals</div>
          </div>
        </div>

        {/* Absent / Marked */}
        <div style={S.kpiCard('#ef4444')}>
          <div style={S.kpiIcon('#fef2f2', '#ef4444')}>
            <XCircle size={20} />
          </div>
          <div>
            <div style={{ fontSize: '1.9rem', fontWeight: 800, color: '#0f172a', lineHeight: 1, letterSpacing: '-1px' }}>
              {kpiData.loadingKpi
                ? <span style={{ fontSize: '1rem', color: '#94a3b8', fontWeight: 500 }}>Loading...</span>
                : kpiData.absentCount}
            </div>
            <div style={{ fontSize: '0.73rem', color: '#64748b', marginTop: 5, fontWeight: 500 }}>Absent / Marked</div>
          </div>
        </div>

        {/* Field Punches Today */}
        <div style={S.kpiCard('var(--primary)')}>
          <div style={S.kpiIcon('var(--primary-light)', 'var(--primary)')}>
            <Navigation size={20} />
          </div>
          <div>
            <div style={{ fontSize: '1.9rem', fontWeight: 800, color: '#0f172a', lineHeight: 1, letterSpacing: '-1px' }}>
              {kpiData.loadingKpi
                ? <span style={{ fontSize: '1rem', color: '#94a3b8', fontWeight: 500 }}>Loading...</span>
                : kpiData.fieldCount}
            </div>
            <div style={{ fontSize: '0.73rem', color: '#64748b', marginTop: 5, fontWeight: 500 }}>Field Punches Today</div>
          </div>
        </div>

      </div>


      {/* ── 4. NAVIGATION TABS ────────────────────────────────────────────── */}
      <div style={S.tabBar}>
        <button style={S.tab(activeTab === 'records')} onClick={() => setActiveTab('records')}>
          <Calendar size={14} /> Attendance Records ({records.length})
        </button>
        <button style={S.tab(activeTab === 'regularization')} onClick={() => setActiveTab('regularization')}>
          <Sliders size={14} /> Regularization ({regularizations.length})
        </button>
        <button style={S.tab(activeTab === 'geofences')} onClick={() => setActiveTab('geofences')}>
          <MapPin size={14} /> Geo-Fences ({geofences.length})
        </button>
      </div>

      {/* ── 5. TAB CONTENT ────────────────────────────────────────────────── */}

      {/* ── TAB 1: ATTENDANCE RECORDS ──────────────────────────────────────── */}
      {activeTab === 'records' && (
        <div style={S.card}>
          {/* Filter Bar */}
          <div style={S.filterBar}>
            {/* Type pills */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button style={S.pill(attendanceType === 'OFFICE')} onClick={() => setAttendanceType('OFFICE')}>
                Office
              </button>
              <button style={S.pill(attendanceType === 'FIELD')} onClick={() => setAttendanceType('FIELD')}>
                Field Staff
              </button>
            </div>

            {/* Scope pills for org admins */}
            {isOrgAdmin && (
              <div style={{ display: 'flex', gap: 6 }}>
                <button style={S.pill(viewScope === 'ALL')} onClick={() => setViewScope('ALL')}>
                  Organization
                </button>
                <button style={S.pill(viewScope === 'MY')} onClick={() => setViewScope('MY')}>
                  My History
                </button>
              </div>
            )}

            {/* Date picker */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto' }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#64748b' }}>Date:</span>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                style={{
                  padding: '5px 9px', borderRadius: 6, border: '1px solid #cbd5e1',
                  fontSize: '0.81rem', background: '#fff',
                }}
              />
            </div>

            {/* Search */}
            <div style={{ position: 'relative', flex: '1 1 180px', minWidth: 160 }}>
              <Search size={13} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input
                type="text"
                placeholder="Search staff, code, status..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%', padding: '6px 9px 6px 28px', borderRadius: 6,
                  border: '1px solid #cbd5e1', fontSize: '0.81rem', background: '#fff',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {/* Refresh */}
            <button
              onClick={loadRecords}
              title="Refresh records"
              style={{
                border: '1px solid #e2e8f0', borderRadius: 6, padding: '5px 8px',
                background: '#fff', cursor: 'pointer', color: '#64748b', display: 'flex',
              }}
            >
              <RefreshCw size={14} />
            </button>
          </div>

          {/* Records Table */}
          {loadingRecords ? (
            <div style={S.emptyState}>
              <Clock size={24} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 8px', display: 'block' }} />
              <div>Loading attendance records...</div>
            </div>
          ) : filteredRecords.length === 0 ? (
            <div style={S.emptyState}>
              <AlertCircle size={30} color="#94a3b8" style={{ margin: '0 auto 8px', display: 'block' }} />
              <div style={{ fontWeight: 600, marginBottom: 4 }}>No attendance records found for this date</div>
              <div style={{ fontSize: '0.79rem' }}>Use &ldquo;Punch Check-In&rdquo; above to record your attendance.</div>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <th style={S.th}>Employee</th>
                    <th style={S.th}>Date</th>
                    <th style={S.th}>Check In</th>
                    <th style={S.th}>Check Out</th>
                    <th style={S.th}>Hours</th>
                    <th style={S.th}>Status</th>
                    <th style={S.th}>Timing</th>
                    <th style={{ ...S.th, textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRecords.map((r) => {
                    const empName = r.employee?.basicInfo?.fullName || r.employee?.name || user?.name || 'Staff Member';
                    const empCode = r.employee?.basicInfo?.employeeCode || r.employee?.employeeCode || 'EMP';
                    const rawIn = r.firstCheckInTime || r.siteInTime;
                    const inTimeStr = rawIn
                      ? new Date(rawIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                      : '—';
                    const rawOut = r.lastCheckOutTime || r.siteOutTime;
                    const outTimeStr = rawOut
                      ? new Date(rawOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                      : r.isOpen ? 'In Progress' : '—';
                    const rawDate = r.attendanceDate || r.siteInTime || r.createdAt;
                    const dateStr = rawDate
                      ? new Date(rawDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                      : '—';
                    const isLate = r.lateStatus?.isLate;
                    const totalHrs = r.totalWorkingHours ?? r.totalHours ?? r.hours ?? 0;
                    const punchesCount = r.punches?.length || 1;
                    const locationLabel = r.branch?.name || (attendanceType === 'FIELD' ? 'Field Route' : 'Branch Office');

                    return (
                      <tr key={r._id} style={{ borderBottom: '1px solid #f8fafc' }}>
                        <td style={S.td}>
                          <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '0.83rem' }}>{empName}</div>
                          <div style={{ fontSize: '0.72rem', color: '#64748b' }}>{empCode} &bull; {locationLabel}</div>
                        </td>
                        <td style={{ ...S.td, color: '#334155' }}>{dateStr}</td>
                        <td style={{ ...S.td, fontWeight: 600, color: '#16a34a' }}>{inTimeStr}</td>
                        <td style={{ ...S.td, fontWeight: 600, color: 'var(--primary)' }}>{outTimeStr}</td>
                        <td style={S.td}>
                          <span style={{ fontWeight: 700 }}>{totalHrs} hrs</span>
                          {r.overtimeHours > 0 && (
                            <span style={{ fontSize: '0.71rem', color: '#16a34a', marginLeft: 4 }}>
                              +{r.overtimeHours} OT
                            </span>
                          )}
                        </td>
                        <td style={S.td}>
                          <Badge
                            variant={
                              r.attendanceStatus === 'PRESENT' ? 'success'
                                : r.attendanceStatus === 'HALF_DAY' ? 'warning'
                                  : r.attendanceStatus === 'ABSENT' ? 'danger'
                                    : 'secondary'
                            }
                          >
                            {r.attendanceStatus || 'PRESENT'}
                          </Badge>
                        </td>
                        <td style={S.td}>
                          <Badge variant={isLate ? 'warning' : 'success'}>
                            {isLate ? 'LATE' : 'ON TIME'}
                          </Badge>
                        </td>
                        <td style={{ ...S.td, textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                            <Button
                              variant="secondary"
                              size="sm"
                              icon={Eye}
                              onClick={() => { setSelectedRecordForSessions(r); setSessionModalOpen(true); }}
                              title="View punch sessions"
                            >
                              {punchesCount} {punchesCount === 1 ? 'Punch' : 'Punches'}
                            </Button>
                            {isOrgAdmin && (
                              <Button
                                variant="secondary"
                                size="sm"
                                icon={Edit2}
                                onClick={() => handleOpenCorrect(r)}
                                title="Admin correction"
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
      )}

      {/* ── TAB 2: REGULARIZATION ─────────────────────────────────────────── */}
      {activeTab === 'regularization' && (
        <div style={S.card}>
          {/* Toolbar */}
          <div style={{
            padding: '12px 16px', borderBottom: '1px solid #e2e8f0',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8,
          }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#0f172a' }}>Regularization Requests</div>
              <div style={{ fontSize: '0.74rem', color: '#64748b' }}>
                {isOrgAdmin
                  ? 'Pending requests from employees awaiting approval'
                  : 'Submit requests for missed punches or time corrections'}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button
                onClick={loadRegularizations}
                title="Refresh"
                style={{ border: '1px solid #e2e8f0', borderRadius: 6, padding: '5px 8px', background: '#fff', cursor: 'pointer', color: '#64748b', display: 'flex' }}
              >
                <RefreshCw size={14} />
              </button>
              <Button variant="primary" size="sm" icon={Sliders} onClick={() => setRegModalOpen(true)}>
                Apply Request
              </Button>
            </div>
          </div>

          {loadingRegs ? (
            <div style={S.emptyState}>
              <Clock size={22} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 8px', display: 'block' }} />
              <div>Loading regularization requests...</div>
            </div>
          ) : regularizations.length === 0 ? (
            <div style={S.emptyState}>
              <CheckCircle2 size={28} color="#16a34a" style={{ margin: '0 auto 8px', display: 'block' }} />
              <div style={{ fontWeight: 600, marginBottom: 4 }}>No regularization requests found</div>
              <div style={{ fontSize: '0.79rem' }}>Click "Apply Request" to submit a new regularization.</div>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <th style={S.th}>Staff</th>
                    <th style={S.th}>Date</th>
                    <th style={S.th}>Type</th>
                    <th style={S.th}>Proposed Timings</th>
                    <th style={S.th}>Reason</th>
                    <th style={S.th}>Status</th>
                    <th style={{ ...S.th, textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {regularizations.map((reg) => {
                    const empName =
                      reg.employee?.basicInfo?.fullName ||
                      reg.employee?.name ||
                      reg.requestedBy?.basicInfo?.fullName ||
                      user?.name ||
                      'Staff';
                    const empCode =
                      reg.employee?.basicInfo?.employeeCode ||
                      reg.employee?.employeeCode || '';

                    // Backend may use proposedCheckInTime or requestedCheckInTime (formatted in 12-hour AM/PM)
                    const format12 = (val) => {
                      if (!val) return '—';
                      if (typeof val === 'string' && /^\d{1,2}:\d{2}/.test(val) && !val.includes('T')) {
                        const [hStr, mStr] = val.split(':');
                        let h = parseInt(hStr, 10);
                        const m = mStr.slice(0, 2);
                        const period = h >= 12 ? 'PM' : 'AM';
                        h = h % 12;
                        if (h === 0) h = 12;
                        return `${h}:${m} ${period}`;
                      }
                      try {
                        const d = new Date(val);
                        if (!isNaN(d.getTime())) {
                          return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
                        }
                      } catch {}
                      return String(val);
                    };

                    const inTime = format12(reg.proposedCheckInTime || reg.requestedCheckInTime);
                    const outTime = format12(reg.proposedCheckOutTime || reg.requestedCheckOutTime);

                    const status = reg.status || reg.approvalStatus || 'PENDING';
                    const reqType = (reg.requestType || 'WRONG_TIME_RECORDED').replace(/_/g, ' ');
                    const attType = reg.attendanceType || 'OFFICE';

                    // Check if this is the logged-in user's own request
                    const myEmpId = user?.employee?._id || user?.employee;
                    const isMyRequest =
                      !myEmpId ||
                      reg.employee?._id === myEmpId ||
                      reg.employee === myEmpId ||
                      reg.requestedBy?._id === myEmpId ||
                      reg.requestedBy === myEmpId;

                    return (
                      <tr key={reg._id} style={{ borderBottom: '1px solid #f8fafc' }}>
                        <td style={S.td}>
                          <div style={{ fontWeight: 600, fontSize: '0.83rem' }}>{empName}</div>
                          {empCode && <div style={{ fontSize: '0.72rem', color: '#64748b' }}>{empCode}</div>}
                        </td>
                        <td style={{ ...S.td, whiteSpace: 'nowrap', fontWeight: 600 }}>
                          {reg.attendanceDate
                            ? new Date(reg.attendanceDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                            : '—'}
                        </td>
                        <td style={S.td}>
                          <div style={{ fontSize: '0.79rem', fontWeight: 600, color: '#334155' }}>{attType}</div>
                          <div style={{ fontSize: '0.71rem', color: '#94a3b8', marginTop: 2 }}>{reqType}</div>
                        </td>
                        <td style={{ ...S.td, whiteSpace: 'nowrap' }}>
                          <span style={{ color: '#16a34a', fontWeight: 600 }}>{inTime}</span>
                          {' – '}
                          <span style={{ color: 'var(--primary)', fontWeight: 600 }}>{outTime}</span>
                        </td>
                        <td style={{ ...S.td, maxWidth: 180, fontSize: '0.78rem', color: '#334155' }}>
                          {reg.reason || '—'}
                        </td>
                        <td style={S.td}>
                          <Badge variant={
                            status === 'APPROVED' ? 'success'
                              : status === 'REJECTED' ? 'danger'
                                : 'warning'
                          }>
                            {status}
                          </Badge>
                        </td>
                        <td style={{ ...S.td, textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                            {/* Admin approve / reject */}
                            {status === 'PENDING' && isOrgAdmin && (
                              <>
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
                              </>
                            )}
                            {/* Employee self-cancel their own pending request */}
                            {status === 'PENDING' && isMyRequest && !isOrgAdmin && (
                              <Button
                                variant="secondary"
                                size="sm"
                                icon={X}
                                onClick={async () => {
                                  try {
                                    await regularizationApi.cancelRegularization(reg._id);
                                    showToast('Regularization request cancelled', 'info');
                                    loadRegularizations();
                                  } catch {
                                    showToast('Failed to cancel request', 'error');
                                  }
                                }}
                              >
                                Cancel
                              </Button>
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
      )}


      {/* ── TAB 3: GEOFENCES ─────────────────────────────────────────────── */}
      {activeTab === 'geofences' && (
        <div style={S.card}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #e2e8f0' }}>
            <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#0f172a' }}>
              Branch Geo-Fences
            </div>
            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
              GPS perimeter validation zones configured for office attendance gates
            </div>
          </div>

          {loadingFences ? (
            <div style={S.emptyState}>
              <Clock size={22} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 8px', display: 'block' }} />
              <div>Loading geofences...</div>
            </div>
          ) : geofences.length === 0 ? (
            <div style={S.emptyState}>
              <MapPin size={28} color="#94a3b8" style={{ margin: '0 auto 8px', display: 'block' }} />
              <div style={{ fontWeight: 600 }}>No geofences configured</div>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <th style={S.th}>Branch / Location</th>
                    <th style={S.th}>Coordinates</th>
                    <th style={S.th}>Radius</th>
                    <th style={S.th}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {geofences.map((gf) => {
                    const name = gf.reference?.name || gf.name || 'Office Branch';
                    const lat = gf.centerLatitude ?? gf.reference?.geoFence?.latitude ?? 0;
                    const lng = gf.centerLongitude ?? gf.reference?.geoFence?.longitude ?? 0;
                    const rad = gf.radiusMeters ?? gf.reference?.geoFence?.radiusInMeters ?? 500;
                    return (
                      <tr key={gf._id} style={{ borderBottom: '1px solid #f8fafc' }}>
                        <td style={{ ...S.td, fontWeight: 600 }}>{name}</td>
                        <td style={{ ...S.td, fontFamily: 'monospace', fontSize: '0.79rem' }}>
                          {Number(lat).toFixed(4)}° N, {Number(lng).toFixed(4)}° E
                        </td>
                        <td style={S.td}>{rad} m</td>
                        <td style={S.td}>
                          <Badge variant={gf.isActive === false ? 'secondary' : 'success'}>
                            {gf.isActive === false ? 'INACTIVE' : 'ACTIVE'}
                          </Badge>
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

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* MODAL: BIOMETRIC PUNCH CHECK-IN / CHECK-OUT                        */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {punchModalOpen && (
        <Modal
          isOpen={true}
          onClose={closePunchModal}
          title={punchActionType === 'CHECK_IN' ? 'Biometric Check-In' : 'Biometric Check-Out'}
          maxWidth="480px"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* Attendance type selector */}
            <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: 8, padding: 3, gap: 3 }}>
              {(isOrgAdmin || isOfficeAllowed) && (
                <button
                  type="button"
                  onClick={() => setPunchAttendanceType('OFFICE')}
                  style={{
                    flex: 1, padding: '7px 0', border: 'none', borderRadius: 6,
                    fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
                    background: punchAttendanceType === 'OFFICE' ? 'var(--primary)' : 'transparent',
                    color: punchAttendanceType === 'OFFICE' ? '#fff' : '#64748b',
                  }}
                >
                  Office Location
                </button>
              )}
              {(isOrgAdmin || isFieldAllowed) && (
                <button
                  type="button"
                  onClick={() => setPunchAttendanceType('FIELD')}
                  style={{
                    flex: 1, padding: '7px 0', border: 'none', borderRadius: 6,
                    fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
                    background: punchAttendanceType === 'FIELD' ? 'var(--primary)' : 'transparent',
                    color: punchAttendanceType === 'FIELD' ? '#fff' : '#64748b',
                  }}
                >
                  Field Staff
                </button>
              )}
            </div>

            {/* Hybrid badge */}
            {isHybridStaff && (
              <div style={{
                background: '#faf5ff', border: '1px solid #e9d5ff', borderRadius: 6,
                padding: '6px 12px', color: '#7e22ce', fontSize: '0.75rem', fontWeight: 600,
                display: 'flex', alignItems: 'center', gap: 6,
              }}>
                <ShieldCheck size={13} />
                Work Type: <strong>Hybrid</strong> — Office &amp; Field punches both authorized
              </div>
            )}

            {/* GPS status */}
            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                <span style={{ fontWeight: 700, color: '#15803d', fontSize: '0.79rem', display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Navigation size={12} /> GPS Captured
                </span>
                <Badge variant="success">±{gpsCoords.accuracy}m</Badge>
              </div>
              <span style={{ fontFamily: 'monospace', fontSize: '0.78rem', color: '#374151' }}>
                {gpsCoords.latitude.toFixed(6)}°, {gpsCoords.longitude.toFixed(6)}°
              </span>
            </div>

            {/* Site selector (site attendance only) */}
            {punchAttendanceType === 'SITE' && punchActionType === 'CHECK_IN' && (
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Building2 size={14} color="var(--primary)" /> Select Project Site &amp; Task
                  </span>
                  <button
                    type="button"
                    onClick={handleDetectNearbySites}
                    disabled={detectingSites}
                    style={{
                      border: 'none', background: 'var(--primary-light)', color: 'var(--primary)',
                      padding: '3px 8px', borderRadius: 6, fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: 4,
                    }}
                  >
                    <RefreshCw size={11} /> {detectingSites ? 'Scanning...' : 'Scan 500m'}
                  </button>
                </div>
                {detectedSites.length === 0 ? (
                  <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                    No project sites within 500m. Switch to <em>Field Staff</em> for open field check-in.
                  </div>
                ) : (
                  <>
                    <select
                      value={selectedSiteId}
                      onChange={(e) => {
                        setSelectedSiteId(e.target.value);
                        const chosen = detectedSites.find((s) => (s.siteId || s._id || s.id) === e.target.value);
                        const tasks = chosen?.eligibleTasks || chosen?.assignedTasks || [];
                        if (tasks.length > 0) setSelectedTaskId(tasks[0]._id || tasks[0].id);
                      }}
                      style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.8rem' }}
                    >
                      {detectedSites.map((s) => (
                        <option key={s.siteId || s._id || s.id} value={s.siteId || s._id || s.id}>
                          {s.siteName || s.name || 'Project Site'} {s.distanceMeters ? `(${s.distanceMeters}m)` : ''}
                        </option>
                      ))}
                    </select>
                    <select
                      value={selectedTaskId}
                      onChange={(e) => setSelectedTaskId(e.target.value)}
                      style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.8rem' }}
                    >
                      {(() => {
                        const chosen = detectedSites.find((s) => (s.siteId || s._id || s.id) === selectedSiteId) || detectedSites[0];
                        const tasks = chosen?.eligibleTasks || chosen?.assignedTasks || [];
                        if (tasks.length === 0) return <option value="general_task">General Site Task</option>;
                        return tasks.map((t) => (
                          <option key={t._id || t.id} value={t._id || t.id}>
                            {t.title || t.name || 'Site Task'} ({t.status || 'ASSIGNED'})
                          </option>
                        ));
                      })()}
                    </select>
                  </>
                )}
              </div>
            )}

            {/* STEP 1 — Face Capture */}
            <div style={{ border: '1.5px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
              <div style={{
                padding: '8px 12px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0',
                display: 'flex', alignItems: 'center', gap: 6,
              }}>
                <ScanFace size={15} color="var(--primary)" />
                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#0f172a' }}>
                  Step 1 — Capture Face Photo
                </span>
                {faceMatchResult === 'matched' && (
                  <span style={{ marginLeft: 'auto', background: '#dcfce7', color: '#16a34a', padding: '2px 8px', borderRadius: 20, fontSize: '0.72rem', fontWeight: 700 }}>
                    VERIFIED
                  </span>
                )}
                {faceMatchResult === 'failed' && (
                  <span style={{ marginLeft: 'auto', background: '#fee2e2', color: '#dc2626', padding: '2px 8px', borderRadius: 20, fontSize: '0.72rem', fontWeight: 700 }}>
                    MISMATCH
                  </span>
                )}
              </div>
              <div style={{ padding: 10 }}>
                {capturedPhoto ? (
                  <div style={{ position: 'relative' }}>
                    <img
                      src={capturedPhoto}
                      alt="Captured"
                      style={{
                        width: '100%', height: 150, objectFit: 'cover', borderRadius: 8,
                        border: faceMatchResult === 'matched'
                          ? '3px solid #16a34a'
                          : faceMatchResult === 'failed'
                            ? '3px solid #dc2626'
                            : '2px solid #cbd5e1',
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => { setCapturedPhoto(null); setFaceMatchResult(null); setVerifyResult(null); setPunchError(null); }}
                      style={{
                        position: 'absolute', top: 6, right: 6, background: 'rgba(0,0,0,0.6)',
                        border: 'none', borderRadius: 20, color: '#fff', fontSize: '0.7rem',
                        padding: '3px 8px', cursor: 'pointer', fontWeight: 600,
                      }}
                    >
                      Retake
                    </button>
                  </div>
                ) : (
                  <CameraCapture
                    onCapture={(photo) => {
                      setCapturedPhoto(photo);
                      setFaceMatchResult(null);
                      setVerifyResult(null);
                      setPunchError(null);
                    }}
                    compact={true}
                  />
                )}
              </div>
            </div>

            {/* STEP 2 — Backend AI Verify */}
            {capturedPhoto && faceMatchResult !== 'matched' && (
              <button
                type="button"
                onClick={handleVerifyFace}
                disabled={verifyingFace}
                style={{
                  width: '100%', padding: '10px 0', borderRadius: 8, border: 'none',
                  background: verifyingFace ? '#94a3b8' : 'linear-gradient(135deg, #0d9488, #0f766e)',
                  color: '#fff', fontWeight: 700, fontSize: '0.88rem',
                  cursor: verifyingFace ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                }}
              >
                <ScanFace size={16} />
                {verifyingFace ? 'Verifying with AI...' : 'Step 2 — Verify Biometric (AI)'}
              </button>
            )}

            {/* Face match success */}
            {faceMatchResult === 'matched' && verifyResult && (
              <div style={{ background: '#dcfce7', border: '1px solid #86efac', borderRadius: 8, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
                <CheckCircle2 size={18} color="#16a34a" />
                <div>
                  <div style={{ fontSize: '0.84rem', fontWeight: 700, color: '#15803d' }}>
                    Biometric Verified — {Math.round(verifyResult.confidenceScore * 100)}% confidence
                  </div>
                  <div style={{ fontSize: '0.73rem', color: '#166534' }}>
                    AI face match confirmed. Audit log: {verifyResult.logId?.slice(-8) || 'recorded'}
                  </div>
                </div>
              </div>
            )}

            {/* Error display */}
            {punchError && (
              <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, padding: '10px 14px', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <XCircle size={16} color="#dc2626" style={{ marginTop: 2, flexShrink: 0 }} />
                <div style={{ fontSize: '0.78rem', color: '#b91c1c' }}>{punchError}</div>
              </div>
            )}

            {/* Remarks (check-out only) */}
            {punchActionType === 'CHECK_OUT' && (
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: 4, color: '#374151' }}>
                  Shift Remarks (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Completed client meetings and development tasks"
                  value={punchRemarks}
                  onChange={(e) => setPunchRemarks(e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.82rem', boxSizing: 'border-box', resize: 'none' }}
                />
              </div>
            )}

            {/* Action buttons */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 4, borderTop: '1px solid #f1f5f9' }}>
              <Button variant="secondary" onClick={closePunchModal}>Cancel</Button>
              <Button
                variant={punchActionType === 'CHECK_IN' ? 'primary' : 'danger'}
                loading={submittingPunch}
                onClick={handleExecutePunch}
                disabled={faceMatchResult !== 'matched' || submittingPunch}
              >
                {faceMatchResult === 'matched'
                  ? `Confirm ${punchActionType === 'CHECK_IN' ? 'Check-In' : 'Check-Out'}`
                  : 'Verify Face First'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* MODAL: PUNCH SESSIONS VIEWER                                        */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {sessionModalOpen && selectedRecordForSessions && (
        <Modal
          isOpen={true}
          onClose={() => setSessionModalOpen(false)}
          title={`Punch Sessions — ${selectedRecordForSessions.employee?.basicInfo?.fullName || selectedRecordForSessions.employee?.name || 'Staff'}`}
          maxWidth="520px"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
              Recorded punches for{' '}
              {selectedRecordForSessions.attendanceDate
                ? new Date(selectedRecordForSessions.attendanceDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                : 'this date'}
            </div>

            {(selectedRecordForSessions.punches || []).length === 0 ? (
              <div style={{ padding: 20, textAlign: 'center', color: '#64748b', fontSize: '0.82rem' }}>
                Single session —{' '}
                {selectedRecordForSessions.firstCheckInTime
                  ? new Date(selectedRecordForSessions.firstCheckInTime).toLocaleTimeString()
                  : '—'}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {selectedRecordForSessions.punches.map((p, idx) => (
                  <div key={p._id || idx} style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 12, background: p.isOpen ? '#fefce8' : '#fff' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <span style={{ fontWeight: 700, fontSize: '0.84rem' }}>Session #{idx + 1}</span>
                      <Badge variant={p.isOpen ? 'warning' : 'success'}>
                        {p.isOpen ? 'IN PROGRESS' : `${p.workingHours || 0} hrs`}
                      </Badge>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: '0.78rem' }}>
                      <div><strong>In:</strong> {p.checkInTime ? new Date(p.checkInTime).toLocaleTimeString() : '—'}</div>
                      <div><strong>Out:</strong> {p.checkOutTime ? new Date(p.checkOutTime).toLocaleTimeString() : (p.isOpen ? 'Active' : '—')}</div>
                    </div>
                    {p.checkInAddress && (
                      <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: 4 }}>
                        {p.checkInAddress}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
              <Button variant="secondary" onClick={() => setSessionModalOpen(false)}>Close</Button>
            </div>
          </div>
        </Modal>
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* MODAL: ADMIN MANUAL CORRECTION                                      */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {correctModalOpen && selectedRecordForCorrect && (
        <Modal
          isOpen={true}
          onClose={() => setCorrectModalOpen(false)}
          title="Manual Attendance Correction"
          maxWidth="480px"
        >
          <form onSubmit={handleSubmitCorrection} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ background: '#f8fafc', padding: 10, borderRadius: 6, border: '1px solid #e2e8f0', fontSize: '0.78rem' }}>
              <strong>Staff:</strong>{' '}
              {selectedRecordForCorrect.employee?.basicInfo?.fullName || selectedRecordForCorrect.employee?.name || 'Staff Member'}
              {' \u2022 '}
              <strong>Type:</strong> {selectedRecordForCorrect.attendanceType}
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

            <div className="form-grid-2">
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
                Correction Remark (Audit Trail) *
              </label>
              <textarea
                rows={2}
                placeholder="e.g. Corrected check-out per manager verbal confirmation"
                value={correctForm.correctionRemark}
                onChange={(e) => setCorrectForm({ ...correctForm, correctionRemark: e.target.value })}
                required
                style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.82rem', boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
              <Button variant="secondary" onClick={() => setCorrectModalOpen(false)}>Cancel</Button>
              <Button variant="primary" type="submit" loading={submittingCorrect}>Apply Correction</Button>
            </div>
          </form>
        </Modal>
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* MODAL: APPLY REGULARIZATION                                         */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {regModalOpen && (
        <Modal
          isOpen={true}
          onClose={() => setRegModalOpen(false)}
          title="Attendance Regularization Request"
          maxWidth="480px"
        >
          <form onSubmit={handleSubmitRegularization} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

            {/* Attendance Date */}
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: 4, color: '#374151' }}>
                Attendance Date *
              </label>
              <input
                type="date"
                value={regForm.attendanceDate}
                onChange={(e) => setRegForm({ ...regForm, attendanceDate: e.target.value })}
                required
                max={new Date().toISOString().split('T')[0]}
                style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.82rem', boxSizing: 'border-box' }}
              />
            </div>

            {/* Attendance Type + Request Type */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: 4, color: '#374151' }}>
                  Attendance Type *
                </label>
                <select
                  value={regForm.attendanceType}
                  onChange={(e) => setRegForm({ ...regForm, attendanceType: e.target.value })}
                  required
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.82rem', background: '#fff' }}
                >
                  <option value="OFFICE">Office</option>
                  <option value="FIELD">Field Staff</option>
                  <option value="SITE">Project Site</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: 4, color: '#374151' }}>
                  Request Type *
                </label>
                <select
                  value={regForm.requestType}
                  onChange={(e) => setRegForm({ ...regForm, requestType: e.target.value })}
                  required
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.82rem', background: '#fff' }}
                >
                  <option value="WRONG_TIME_RECORDED">Wrong Time</option>
                  <option value="MISSED_CHECK_IN">Missed Check-In</option>
                  <option value="MISSED_CHECK_OUT">Missed Check-Out</option>
                  <option value="MISSED_ENTIRE_DAY">Missed Entire Day</option>
                </select>
              </div>
            </div>

            {/* Proposed timings (12-hour AM/PM) */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <TimePicker12
                label="Proposed Check-In"
                value={regForm.proposedCheckInTime}
                onChange={(val) => setRegForm({ ...regForm, proposedCheckInTime: val })}
                required
              />
              <TimePicker12
                label="Proposed Check-Out"
                value={regForm.proposedCheckOutTime}
                onChange={(val) => setRegForm({ ...regForm, proposedCheckOutTime: val })}
                required
              />
            </div>

            {/* Reason */}
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: 4, color: '#374151' }}>
                Reason *
              </label>
              <textarea
                rows={3}
                placeholder="e.g. Biometric device offline, forgot to punch, power cut on site..."
                value={regForm.reason}
                onChange={(e) => setRegForm({ ...regForm, reason: e.target.value })}
                required
                style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.82rem', boxSizing: 'border-box', resize: 'none' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 4, borderTop: '1px solid #f1f5f9' }}>
              <Button variant="secondary" onClick={() => setRegModalOpen(false)}>Cancel</Button>
              <Button variant="primary" type="submit" loading={submittingReg}>Submit Request</Button>
            </div>
          </form>
        </Modal>
      )}


    </div>
  );
};

export default DailyAttendance;
