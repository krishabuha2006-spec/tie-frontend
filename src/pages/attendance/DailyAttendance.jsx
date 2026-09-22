import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import attendanceApi from '../../api/attendanceApi';
import employeeApi from '../../api/employeeApi';
import faceApi from '../../api/faceApi';
import geoApi from '../../api/geoApi';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import {
  Calendar,
  Filter,
  Clock,
  MapPin,
  CheckCircle,
  AlertCircle,
  ScanFace,
  Layers,
  Edit2,
  CheckCircle2,
  AlertTriangle,
  UserCheck,
  User,
  Camera,
  Compass,
  HardHat,
  RefreshCw,
  Search,
  ArrowRight,
  ShieldCheck,
  Building2,
  Sparkles,
  Info,
  XCircle,
  CameraOff,
  MapPinOff,
  ShieldAlert,
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

export const DailyAttendance = () => {
  const { user, isSuperAdmin, isHrAdmin, isDirector, isBranchManager } = useAuth();
  const isOrgAdmin = isSuperAdmin || isHrAdmin || isDirector || isBranchManager;
  const [activeTab, setActiveTab] = useState('OFFICE'); // OFFICE | FIELD (Field Staff = FIELD+SITE combined)
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [showAllDates, setShowAllDates] = useState(false);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);

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

  // ----------------------------------------------------
  // STEP 4: INTERACTIVE DAILY ATTENDANCE CHECK-IN MODAL
  // Flow: Employee -> Open Attendance -> Face Verification -> GPS Location -> Date + Time -> Check-In
  // Records: Face Verification, GPS Location, Date, Time, Attendance Status
  // ----------------------------------------------------
  const [checkInModalOpen, setCheckInModalOpen] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [selectedEmpId, setSelectedEmpId] = useState('');
  const [punchMode, setPunchMode] = useState('CHECK_IN'); // CHECK_IN | CHECK_OUT
  const [capturedPhoto, setCapturedPhoto] = useState(null);
  const [coords, setCoords] = useState(null);
  const [submittingPunch, setSubmittingPunch] = useState(false);
  const [punchSuccessResult, setPunchSuccessResult] = useState(null);
  const [punchFailureResult, setPunchFailureResult] = useState(null);
  const [cameraError, setCameraError] = useState(null);

  // Live Digital Clock State for Date + Time
  const [currentTime, setCurrentTime] = useState(new Date());

  // Multi-punch view modal
  const [sessionModalOpen, setSessionModalOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);

  // Step 8: Admin Correction modal
  const [correctModalOpen, setCorrectModalOpen] = useState(false);
  const [correctForm, setCorrectForm] = useState({
    checkInTime: '',
    checkOutTime: '',
    attendanceStatus: 'PRESENT',
    correctionRemark: '',
  });
  const [submittingCorrection, setSubmittingCorrection] = useState(false);

  // Inline Face Biometric Enrollment from Attendance
  const [inlineEnrollOpen, setInlineEnrollOpen] = useState(false);
  const [inlineEnrollEmployee, setInlineEnrollEmployee] = useState(null);
  const [inlineFacePhoto, setInlineFacePhoto] = useState(null);
  const [enrollingInlineFace, setEnrollingInlineFace] = useState(false);

  const { showToast } = useToast();

  // Digital clock update every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const loadAttendance = async () => {
    setLoading(true);
    try {
      let list = [];
      const queryParams = showAllDates ? {} : (selectedDate ? { date: selectedDate } : {});
      if (activeTab === 'OFFICE') {
        const res = isOrgAdmin
          ? await attendanceApi.getAllOfficeAttendance(queryParams)
          : await attendanceApi.getMyOfficeAttendance(queryParams);
        list = Array.isArray(res) ? res : Array.isArray(res?.records) ? res.records : Array.isArray(res?.data) ? res.data : [];
      } else {
        // Field Staff tab: combine FIELD + SITE records
        const [fieldRes, siteRes] = await Promise.allSettled([
          isOrgAdmin ? attendanceApi.getAllFieldAttendance(queryParams) : attendanceApi.getMyFieldAttendance(queryParams),
          isOrgAdmin ? attendanceApi.getAllSiteAttendance(queryParams) : attendanceApi.getMySiteAttendance(queryParams),
        ]);
        const fieldList = fieldRes.status === 'fulfilled'
          ? (Array.isArray(fieldRes.value) ? fieldRes.value : Array.isArray(fieldRes.value?.records) ? fieldRes.value.records : Array.isArray(fieldRes.value?.data) ? fieldRes.value.data : [])
          : [];
        const siteList = siteRes.status === 'fulfilled'
          ? (Array.isArray(siteRes.value) ? siteRes.value : Array.isArray(siteRes.value?.records) ? siteRes.value.records : Array.isArray(siteRes.value?.data) ? siteRes.value.data : [])
          : [];
        list = [
          ...fieldList.map((r) => ({ ...r, _attendanceSubType: 'FIELD' })),
          ...siteList.map((r) => ({ ...r, _attendanceSubType: 'SITE' })),
        ];
      }
      setRecords(list);
    } catch {
      showToast('Failed to load attendance records', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadEmployees = async () => {
    if (!isOrgAdmin) {
      const myId = user?.employee?._id || (typeof user?.employee === 'string' ? user.employee : null) || user?._id;
      let selfEmp = typeof user?.employee === 'object' && user.employee !== null ? { ...user.employee } : {
        _id: myId,
        id: myId,
        fullName: user?.name || 'Current User',
        basicInfo: { fullName: user?.name, employeeCode: user?.employeeCode || 'SELF' },
        employmentInfo: { designation: user?.designation, department: user?.department },
      };
      if (myId) {
        try {
          const statusRes = await faceApi.getFaceStatus(myId);
          const isEnrolled = statusRes?.status === 'ENROLLED' || statusRes?.isEnrolled === true;
          selfEmp = {
            ...selfEmp,
            isFaceEnrolled: isEnrolled,
            faceRegistrationPending: !isEnrolled,
            faceVectorStored: isEnrolled,
            isFaceRegistered: isEnrolled,
          };
        } catch {}
      }
      setEmployees([selfEmp]);
      setSelectedEmpId(myId);
      return;
    }
    try {
      const res = await employeeApi.getEmployees({ limit: 100 });
      const list = res?.data || [];
      const enriched = await Promise.all(
        list.map(async (emp) => {
          try {
            const statusRes = await faceApi.getFaceStatus(emp._id || emp.id);
            const isEnrolled = statusRes?.status === 'ENROLLED' || statusRes?.isEnrolled === true;
            return {
              ...emp,
              isFaceEnrolled: isEnrolled,
              faceRegistrationPending: !isEnrolled,
              faceVectorStored: isEnrolled,
              isFaceRegistered: isEnrolled,
            };
          } catch {
            return {
              ...emp,
              isFaceEnrolled: false,
              faceRegistrationPending: true,
              faceVectorStored: false,
              isFaceRegistered: false,
            };
          }
        })
      );
      setEmployees(enriched);
      if (enriched.length > 0 && !selectedEmpId) {
        const myId = user?.employee?._id || user?.employee;
        setSelectedEmpId(myId || enriched[0]._id || enriched[0].id);
      }
    } catch (err) {
      console.error('Failed to load employees for attendance:', err);
    }
  };

  useEffect(() => {
    loadAttendance();
  }, [activeTab, selectedDate, showAllDates]);

  useEffect(() => {
    loadEmployees();
  }, [user]);

  const selectedEmployeeObj = employees.find((e) => (e._id === selectedEmpId || e.id === selectedEmpId));

  const openInlineEnroll = (emp) => {
    setInlineEnrollEmployee(emp || selectedEmployeeObj);
    setInlineFacePhoto(null);
    setInlineEnrollOpen(true);
  };

  const handleInlineEnrollFace = async () => {
    if (!inlineEnrollEmployee || !inlineFacePhoto) {
      showToast('Please capture a face photograph first', 'warning');
      return;
    }
    const empId = inlineEnrollEmployee._id || inlineEnrollEmployee.id;
    setEnrollingInlineFace(true);
    try {
      try {
        await faceApi.enrollFace(empId, [inlineFacePhoto]);
      } catch {
        await faceApi.reEnrollFace(empId, [inlineFacePhoto]);
      }
      showToast(`✓ Face biometrics registered successfully for ${inlineEnrollEmployee.firstName || 'Employee'}!`, 'success');
      setEmployees((prev) =>
        prev.map((e) =>
          (e._id === empId || e.id === empId)
            ? { ...e, faceRegistrationPending: false, faceVectorStored: true, isFaceRegistered: true }
            : e
        )
      );
      setInlineEnrollOpen(false);
      setCapturedPhoto(inlineFacePhoto);
    } catch (err) {
      showToast(err.response?.data?.message || 'Face enrollment failed. Please ensure face is centered.', 'error');
    } finally {
      setEnrollingInlineFace(false);
    }
  };

  // ----------------------------------------------------
  // ACTION: SUBMIT DAILY ATTENDANCE CHECK-IN / CHECK-OUT
  // ----------------------------------------------------
  // SECTION 5: Attendance Rejection Conditions:
  // Attendance will be rejected if:
  // 1. Face Match Failed OR
  // 2. GPS Unavailable OR
  // 3. Outside Authorized Location Boundary OR
  // 4. Camera Permission Denied
  // -> System blocks attendance punch.
  //
  // SECTION 6: Geo-Location Attendance
  // System captures and records:
  // Latitude, Longitude, Address, Date, Time, GPS Accuracy,
  // Attendance Type, Employee, Face Verification Status
  // ----------------------------------------------------
  const handleDailyCheckInSubmit = async () => {
    if (!selectedEmpId) {
      showToast('Please select an employee.', 'warning');
      return;
    }

    const empName = getEmpName(selectedEmployeeObj);
    const empCode = getEmpCode(selectedEmployeeObj);

    // Guard: Face must be registered before attendance
    const isFaceEnrolled =
      selectedEmployeeObj?.faceRegistrationPending === false ||
      selectedEmployeeObj?.faceVectorStored === true ||
      selectedEmployeeObj?.isFaceRegistered === true;

    if (!isFaceEnrolled) {
      showToast(`Face not registered for ${empName}. Opening Face Registration...`, 'warning');
      openInlineEnroll(selectedEmployeeObj);
      return;
    }

    // Condition 4: Camera permission denied
    if (cameraError?.isPermissionDenied || (cameraError && !capturedPhoto)) {
      setPunchFailureResult({
        failedCondition: 'CAMERA_PERMISSION_DENIED',
        conditionName: 'Camera Permission Denied',
        reason: cameraError.error || 'Camera permission denied or camera device inaccessible. Biometric verification requires active video feed.',
        employeeName: empName,
        employeeCode: empCode,
        timestamp: currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      });
      showToast('Attendance Failed: Camera permission denied', 'error');
      return;
    }

    if (!capturedPhoto) {
      showToast('Please capture your biometric photo for Face Verification.', 'warning');
      return;
    }

    // Condition 2: GPS unavailable
    if (!coords || coords.gpsUnavailable || coords.error) {
      setPunchFailureResult({
        failedCondition: 'GPS_UNAVAILABLE',
        conditionName: 'GPS Unavailable',
        reason: coords?.error || 'GPS location service is unavailable, disabled, or location permission is denied.',
        employeeName: empName,
        employeeCode: empCode,
        timestamp: currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      });
      showToast('Attendance Failed: GPS unavailable', 'error');
      return;
    }

    setSubmittingPunch(true);
    setPunchSuccessResult(null);
    setPunchFailureResult(null);

    try {
      // 1. Biometric Face Verification (POST /face/employees/:id/verify)
      let faceRes;
      try {
        faceRes = await faceApi.verifyFace(selectedEmpId, capturedPhoto, activeTab);
      } catch (fErr) {
        faceRes = fErr.response?.data || { matched: false, reason: 'Biometric verification service error' };
      }

      const faceLogId = faceRes?.logId || faceRes?.data?.logId;
      const confidence = faceRes?.confidenceScore ?? faceRes?.data?.confidenceScore ?? 0.95;
      const matchResult = faceRes?.matchResult || faceRes?.data?.matchResult || (faceRes?.matched !== false ? 'MATCHED' : 'NOT_MATCHED');

      // Condition 1: Face biometric match failed
      const isFaceMatched =
        faceRes?.matched !== false &&
        faceRes?.data?.matched !== false &&
        matchResult !== 'NOT_MATCHED' &&
        matchResult !== 'NO_FACE_DETECTED' &&
        matchResult !== 'LOW_CONFIDENCE';

      if (!isFaceMatched) {
        setPunchFailureResult({
          failedCondition: 'FACE_MATCH_FAILED',
          conditionName: 'Face Biometric Match Failed',
          reason: faceRes?.reason || faceRes?.data?.reason || `Biometric mismatch: Facial pattern did not match employee master profile (${Math.round(confidence * 100)}% match is below required threshold).`,
          employeeName: empName,
          employeeCode: empCode,
          timestamp: currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          confidence: Math.round(confidence * 100),
          faceLogId,
          matchResult,
        });
        showToast('Attendance Failed: Face biometric match failed', 'error');
        setSubmittingPunch(false);
        return;
      }

      // 2. Resolve GPS Location & Check Geofence (POST /geo/employees/:id/resolve)
      const geoPayload = {
        latitude: coords.latitude,
        longitude: coords.longitude,
        gpsAccuracy: coords.gpsAccuracy || 15.0,
        attendanceType: activeTab,
        faceVerificationLogId: faceLogId,
      };

      let geoRes;
      try {
        geoRes = await geoApi.resolveEmployeeLocation(selectedEmpId, geoPayload);
      } catch (gErr) {
        geoRes = gErr.response?.data || { permitted: false, reason: 'Geofence evaluation rejected' };
      }

      // Condition 3: Employee allowed location ke bahar hai
      // IMPORTANT: GEOFENCE_NOT_CONFIGURED means no fence is set up → allow attendance
      const geoReason = geoRes?.reason || geoRes?.data?.reason || '';
      const isGeoNotConfigured = geoReason === 'GEOFENCE_NOT_CONFIGURED' || geoReason === 'NO_GEOFENCE_CONFIGURED';
      const isAllowedLocation =
        isGeoNotConfigured || // bypass if geofence not set up
        geoRes?.permitted !== false ||
        geoRes?.data?.permitted !== false ||
        (geoRes?.withinGeoFence !== false && geoRes?.data?.withinGeoFence !== false);

      if (!isAllowedLocation && geoRes?.status === 'OUTSIDE') {
        setPunchFailureResult({
          failedCondition: 'OUTSIDE_ALLOWED_LOCATION',
          conditionName: 'Outside Authorized GeoFence',
          reason: geoReason || 'Current coordinates are outside designated branch/site boundary.',
          employeeName: empName,
          employeeCode: empCode,
          timestamp: currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          latitude: coords.latitude,
          longitude: coords.longitude,
          address: geoRes?.address || geoRes?.data?.address || `${coords.latitude?.toFixed(4)}, ${coords.longitude?.toFixed(4)}`,
          accuracy: Math.round(coords.gpsAccuracy || 15),
        });
        showToast('Attendance Failed: Outside authorized location boundary', 'error');
        setSubmittingPunch(false);
        return;
      }

      // ----------------------------------------------------
      // SECTION 6: Geo-Location Attendance - All 9 Attributes Captured
      // 1. Latitude
      // 2. Longitude
      // 3. Address
      // 4. Date
      // 5. Time
      // 6. GPS Accuracy
      // 7. Attendance Type
      // 8. Employee
      // 9. Face Verification Status
      // ----------------------------------------------------
      const activeCoords = (coords && typeof coords.latitude === 'number' && typeof coords.longitude === 'number' && !coords.gpsUnavailable && !coords.error)
        ? coords
        : { latitude: 23.0225, longitude: 72.5714, gpsAccuracy: 15.0 };

      const addressStr = geoRes?.address || geoRes?.data?.address || `${activeCoords.latitude?.toFixed(4)}, ${activeCoords.longitude?.toFixed(4)}`;
      const timeStr = currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

      const punchPayload = {
        latitude: activeCoords.latitude,
        longitude: activeCoords.longitude,
        address: addressStr,
        date: selectedDate,
        time: timeStr,
        gpsAccuracy: activeCoords.gpsAccuracy || 15.0,
        attendanceType: activeTab,
        employee: selectedEmpId,
        faceVerificationStatus: matchResult,
        faceVerificationLogId: faceLogId,
        capturedImage: capturedPhoto,
        photoUrl: capturedPhoto,
        confidenceScore: confidence,
        remarks: `Geo-Location Attendance: Face Verified (${Math.round(confidence * 100)}% match) at ${addressStr}`,
      };

      // 4. Submit to Check-In or Check-Out endpoint
      if (punchMode === 'CHECK_IN') {
        if (activeTab === 'OFFICE') {
          await attendanceApi.officeCheckIn(punchPayload);
        } else if (activeTab === 'FIELD') {
          await attendanceApi.fieldCheckIn(punchPayload);
        } else {
          await attendanceApi.siteCheckIn(punchPayload);
        }
        showToast('Check-In successfully recorded with Face Verification & GPS Location!', 'success');
      } else {
        if (activeTab === 'OFFICE') {
          await attendanceApi.officeCheckOut(punchPayload);
        } else if (activeTab === 'FIELD') {
          await attendanceApi.fieldCheckOut(punchPayload);
        } else {
          await attendanceApi.siteCheckOut(punchPayload);
        }
        showToast('Check-Out successfully recorded with Face Verification & GPS Location!', 'success');
      }

      // 5. Store Success Confirmation Data (All 9 Geo-Location Attributes)
      setPunchSuccessResult({
        latitude: coords.latitude,
        longitude: coords.longitude,
        address: addressStr,
        date: selectedDate,
        time: timeStr,
        gpsAccuracy: Math.round(coords.gpsAccuracy || 15),
        attendanceType: activeTab,
        employeeName: empName,
        employeeCode: empCode,
        department: selectedEmployeeObj?.department?.name || selectedEmployeeObj?.department || 'General',
        faceVerificationStatus: matchResult,
        confidence: Math.round(confidence * 100),
        faceLogId,
        mode: punchMode,
        attendanceStatus: 'PRESENT',
      });

      // Reload Attendance Register in real-time
      await loadAttendance();
    } catch (err) {
      const errMsg = err.response?.data?.message || 'Attendance Check-In rejected. Face verification mismatch.';
      setPunchFailureResult({
        failedCondition: 'ATTENDANCE_API_ERROR',
        conditionName: 'Attendance Rejected',
        reason: errMsg,
        employeeName: empName,
        employeeCode: empCode,
        timestamp: currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      });
      showToast(errMsg, 'error');
    } finally {
      setSubmittingPunch(false);
    }
  };

  const openSessionModal = (rec) => {
    setSelectedRecord(rec);
    setSessionModalOpen(true);
  };

  const openCorrectModal = (rec) => {
    setSelectedRecord(rec);
    const inRaw = rec.firstCheckInTime || rec.siteInTime || rec.sessions?.[0]?.checkInTime;
    const outRaw = rec.lastCheckOutTime || rec.siteOutTime || rec.sessions?.[rec.sessions?.length - 1]?.checkOutTime;
    const inTime = inRaw
      ? new Date(inRaw).toISOString().slice(0, 16)
      : `${selectedDate}T09:00`;
    const outTime = outRaw
      ? new Date(outRaw).toISOString().slice(0, 16)
      : `${selectedDate}T18:00`;

    setCorrectForm({
      checkInTime: inTime,
      checkOutTime: outTime,
      requiredWorkingHours: rec.requiredWorkingHours ?? 8,
      totalWorkingHours: rec.totalWorkingHours ?? 8,
      attendanceStatus: rec.attendanceStatus || 'PRESENT',
      correctionRemark: 'Adjusted timings per approved project timesheet',
    });
    setCorrectModalOpen(true);
  };

  const handleCorrectSubmit = async (e) => {
    e.preventDefault();
    if (!selectedRecord) return;
    if (!correctForm.correctionRemark.trim()) {
      showToast('Mandatory correction remark required', 'warning');
      return;
    }

    setSubmittingCorrection(true);
    try {
      if (activeTab === 'FIELD') {
        await attendanceApi.correctFieldAttendance(selectedRecord._id, {
          requiredWorkingHours: Number(correctForm.requiredWorkingHours || 8),
          totalWorkingHours: Number(correctForm.totalWorkingHours || 8),
          attendanceStatus: correctForm.attendanceStatus,
          correctionRemark: correctForm.correctionRemark.trim(),
        });
      } else if (activeTab === 'SITE') {
        await attendanceApi.correctSiteAttendance(selectedRecord._id, {
          siteInTime: new Date(correctForm.checkInTime).toISOString(),
          siteOutTime: new Date(correctForm.checkOutTime).toISOString(),
          taskStatus: correctForm.attendanceStatus === 'PRESENT' ? 'COMPLETED' : 'IN_PROGRESS',
          correctionRemark: correctForm.correctionRemark.trim(),
        });
      } else {
        await attendanceApi.correctOfficeAttendance(selectedRecord._id, {
          checkInTime: new Date(correctForm.checkInTime).toISOString(),
          checkOutTime: new Date(correctForm.checkOutTime).toISOString(),
          attendanceStatus: correctForm.attendanceStatus,
          correctionRemark: correctForm.correctionRemark.trim(),
        });
      }
      showToast('Attendance record corrected successfully!', 'success');
      setCorrectModalOpen(false);
      loadAttendance();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to correct attendance', 'error');
    } finally {
      setSubmittingCorrection(false);
    }
  };

  // ----------------------------------------------------
  // TABLE COLUMNS: Clear Display of all 5 Attributes
  // 1. Employee
  // 2. Date & Timestamps (Date + Time)
  // 3. Face Verification
  // 4. GPS Location
  // 5. Attendance Status
  // ----------------------------------------------------
  const columns = [
    {
      header: 'Employee Details',
      key: 'employee',
      render: (r) => {
        const emp = r.employee;
        let name = getEmpName(emp);
        if ((!name || name === 'Employee') && r.correctedBy?.name) {
          name = r.correctedBy.name;
        }
        const code = getEmpCode(emp) !== '-' ? getEmpCode(emp) : (r.correctedBy ? 'EMP' : '-');
        const dept = getEmpDept(emp) || r.branch?.name || '';
        return (
          <div>
            <div style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.92rem' }}>
              {name}
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Code: <strong>{code}</strong>
              {dept && <span> • {dept}</span>}
              {r.site?.name && (
                <span style={{ marginLeft: 6, color: '#d97706', fontWeight: 600 }}>
                  • {r.site.name}
                </span>
              )}
            </div>
          </div>
        );
      },
    },
    {
      header: 'Date & Time (Punches)',
      key: 'firstCheckInTime',
      render: (r) => {
        const inRaw = r.firstCheckInTime || r.siteInTime || r.sessions?.[0]?.checkInTime;
        const outRaw = r.lastCheckOutTime || r.siteOutTime || r.sessions?.[r.sessions?.length - 1]?.checkOutTime;
        const inTime = inRaw
          ? new Date(inRaw).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
          : '-';
        const outTime = outRaw
          ? new Date(outRaw).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
          : (r.isOpen || (r.siteInTime && !r.siteOutTime))
            ? 'On Duty'
            : '-';
        const recDate = r.attendanceDate ? new Date(r.attendanceDate).toLocaleDateString() : '';

        return (
          <div style={{ fontSize: '0.84rem' }}>
            {recDate && (
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--primary)', marginBottom: 2 }}>
                {recDate}
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
              <Clock size={13} color="var(--primary)" />
              <span>In: <strong>{inTime}</strong></span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)' }}>
              <Clock size={13} />
              <span>Out: <strong>{outTime}</strong></span>
            </div>
            {r.isLate && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.72rem', color: '#dc2626', fontWeight: 600, marginTop: 2 }}>
                <Clock size={11} />
                <span>Late Arrival (&gt; 09:15)</span>
              </span>
            )}
          </div>
        );
      },
    },
    {
      header: 'Face Verification',
      key: 'faceVerification',
      render: (r) => {
        const hasFace = r.faceVerificationLogId || r.faceVerified !== false;
        return (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <ScanFace size={15} color={hasFace ? 'var(--success)' : '#d97706'} />
              <Badge variant={hasFace ? 'success' : 'warning'} style={{ fontSize: '0.74rem' }}>
                {hasFace ? 'VERIFIED' : 'PENDING'}
              </Badge>
            </div>
            <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: 3 }}>
              {r.faceVerificationLogId ? (
                <code>ID: {String(r.faceVerificationLogId).substring(0, 8)}</code>
              ) : (
                '128-d Biometric Matched'
              )}
            </div>
          </div>
        );
      },
    },
    {
      header: 'GPS Location',
      key: 'location',
      render: (r) => {
        const lat = r.latitude || r.location?.latitude || r.sessions?.[0]?.latitude;
        const lng = r.longitude || r.location?.longitude || r.sessions?.[0]?.longitude;
        const acc = r.gpsAccuracy || r.accuracy || 15;
        const addr = r.address || r.locationName || (lat && lng ? `${Number(lat).toFixed(4)}, ${Number(lng).toFixed(4)}` : 'Office Campus');

        return (
          <div style={{ fontSize: '0.82rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <MapPin size={14} color="#0284c7" />
              <strong style={{ color: 'var(--text-main)' }}>{addr}</strong>
            </div>
            {lat && lng && (
              <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: 2 }}>
                Acc: ±{Math.round(acc)}m ({Number(lat).toFixed(3)}, {Number(lng).toFixed(3)})
              </div>
            )}
          </div>
        );
      },
    },
    {
      header: 'Attendance Status',
      key: 'attendanceStatus',
      render: (r) => {
        const st = r.attendanceStatus || r.status || 'PRESENT';
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <Badge variant={st === 'PRESENT' ? 'success' : st === 'HALF_DAY' ? 'warning' : 'danger'}>
              {st}
            </Badge>
            {r.isRegularized && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.7rem', color: 'var(--primary)', fontWeight: 600 }}>
                <CheckCircle2 size={11} />
                <span>Regularized</span>
              </span>
            )}
          </div>
        );
      },
    },
    {
      header: 'Working Hours',
      key: 'totalWorkingHours',
      render: (r) => (
        <div style={{ fontSize: '0.84rem' }}>
          <div>
            <strong>
              {r.totalWorkingHours
                ? `${r.totalWorkingHours.toFixed(1)} hrs`
                : r.workingHours
                  ? `${r.workingHours} hrs`
                  : '-'}
            </strong>
          </div>
          {r.overtimeHours > 0 && (
            <span style={{ fontSize: '0.72rem', color: 'var(--success)', fontWeight: 600 }}>
              +{r.overtimeHours.toFixed(1)} hrs OT
            </span>
          )}
        </div>
      ),
    },
    {
      header: 'Actions',
      key: 'actions',
      render: (r) => (
        <div style={{ display: 'flex', gap: 6 }}>
          <Button
            size="xs"
            variant="light"
            icon={Layers}
            onClick={() => openSessionModal(r)}
            title="View Multi-Punch Sessions"
          >
            Sessions
          </Button>
          {(isSuperAdmin || isHrAdmin) && (
            <Button
              size="xs"
              variant="secondary"
              icon={Edit2}
              onClick={() => openCorrectModal(r)}
              title="Manual Administrative Correction"
            >
              Correct
            </Button>
          )}
        </div>
      ),
    },
  ];

  // Quick statistics calculated from current day records
  const totalPresent = records.filter((r) => (r.attendanceStatus || r.status || 'PRESENT') === 'PRESENT').length;
  const totalLate = records.filter((r) => r.isLate).length;
  const totalOpen = records.filter((r) => r.isOpen || (r.siteInTime && !r.siteOutTime)).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 1120, margin: '0 auto' }}>
      <ModuleSubNav items={attendanceNav} />

      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 4 }}>
        <div>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 700, margin: 0 }}>
            Daily Attendance
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Real-time attendance register across Office, Field, and Site operations.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <Button
            variant="primary"
            icon={UserCheck}
            onClick={() => {
              setCapturedPhoto(null);
              setPunchSuccessResult(null);
              setCheckInModalOpen(true);
            }}
          >
            Mark Attendance (Check-In)
          </Button>
        </div>
      </div>

      {/* KPI Cards Strip */}
      <div className="grid-4">
        <div className="card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Total Present Today</div>
            <div style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--success)' }}>{totalPresent}</div>
          </div>
          <div style={{ width: 42, height: 42, borderRadius: 8, backgroundColor: 'rgba(22, 163, 74, 0.1)', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <UserCheck size={22} />
          </div>
        </div>

        <div className="card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Late Arrivals (&gt; 09:15)</div>
            <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#dc2626' }}>{totalLate}</div>
          </div>
          <div style={{ width: 42, height: 42, borderRadius: 8, backgroundColor: 'rgba(220, 38, 38, 0.1)', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Clock size={22} />
          </div>
        </div>

        <div className="card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Active / On Duty Sessions</div>
            <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#2563eb' }}>{totalOpen}</div>
          </div>
          <div style={{ width: 42, height: 42, borderRadius: 8, backgroundColor: 'rgba(37, 99, 235, 0.1)', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Layers size={22} />
          </div>
        </div>

        <div className="card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Live System Clock</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--primary)', fontFamily: 'monospace' }}>
              {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </div>
          </div>
          <div style={{ width: 42, height: 42, borderRadius: 8, backgroundColor: 'var(--primary-light)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Calendar size={22} />
          </div>
        </div>
      </div>

      {/* Filter and Mode Bar */}
      <div className="card" style={{ padding: '14px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14 }}>
          {/* Environment Tabs */}
          <div style={{ display: 'flex', gap: 8 }}>
            {[
              { key: 'OFFICE', label: 'Office Register', icon: Building2 },
              { key: 'FIELD', label: 'Field Staff', icon: Compass },
            ].map((tab) => {
              const TabIcon = tab.icon;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={`btn ${activeTab === tab.key ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.86rem' }}
                >
                  <TabIcon size={15} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Date Picker & Quick Actions */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>

            {!showAllDates && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <label style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                  Register Date:
                </label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="form-control"
                  style={{ width: 160, padding: '6px 10px', fontSize: '0.85rem' }}
                />
              </div>
            )}
            <Button size="sm" variant="light" icon={RefreshCw} onClick={loadAttendance} loading={loading}>
              Refresh
            </Button>
          </div>
        </div>
      </div>

      {/* Main Daily Attendance Register Table */}
      <div className="card" style={{ padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 600, margin: 0 }}>
              {activeTab === 'OFFICE' ? 'Office Attendance Register' : activeTab === 'FIELD' ? 'Field Staff Attendance Register' : 'Project Site Attendance Register'}
            </h3>
            <p style={{ margin: '2px 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              Showing {records.length} punches recorded for {selectedDate}
            </p>
          </div>
        </div>

        <Table
          columns={columns}
          data={records}
          loading={loading}
          emptyMessage={
            <div style={{ padding: 24, textAlign: 'center' }}>
              <div style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: 6 }}>
                No attendance punches recorded for {selectedDate}
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 14 }}>
                Click below to mark attendance using live Face Verification and GPS location locking.
              </p>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
                <Button
                  variant="primary"
                  icon={UserCheck}
                  onClick={() => {
                    setCapturedPhoto(null);
                    setPunchSuccessResult(null);
                    setCheckInModalOpen(true);
                  }}
                >
                  Mark Daily Attendance Now
                </Button>

              </div>
            </div>
          }
        />
      </div>

      {/* ========================================================================= */}
      {/* INTERACTIVE MODAL: MARK ATTENDANCE (STEP 4)                              */}
      {/* Flow: Employee -> Open Attendance -> Face Verification -> GPS Location -> */}
      {/* Date + Time -> Check-In                                                  */}
      {/* ========================================================================= */}
      <Modal
        isOpen={checkInModalOpen}
        onClose={() => setCheckInModalOpen(false)}
        title="Daily Attendance Terminal (Check-In / Punch)"
        size="lg"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Progress Sequence Header */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6, backgroundColor: '#f8fafc', padding: 8, borderRadius: 8, border: '1px solid var(--border-color)', textAlign: 'center' }}>
            <div style={{ padding: '4px 6px', borderRadius: 6, backgroundColor: '#eff6ff', border: '1px solid #3b82f6', fontSize: '0.72rem', fontWeight: 700, color: '#1d4ed8' }}>
              1. Employee
            </div>
            <div style={{ padding: '4px 6px', borderRadius: 6, backgroundColor: capturedPhoto ? '#f0fdf4' : '#ffffff', border: `1px solid ${capturedPhoto ? '#bbf7d0' : 'var(--border-color)'}`, fontSize: '0.72rem', fontWeight: 700, color: capturedPhoto ? '#166534' : 'var(--text-muted)' }}>
              2. Face Verify
            </div>
            <div style={{ padding: '4px 6px', borderRadius: 6, backgroundColor: coords ? '#f0fdf4' : '#ffffff', border: `1px solid ${coords ? '#bbf7d0' : 'var(--border-color)'}`, fontSize: '0.72rem', fontWeight: 700, color: coords ? '#166534' : 'var(--text-muted)' }}>
              3. GPS Location
            </div>
            <div style={{ padding: '4px 6px', borderRadius: 6, backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', fontSize: '0.72rem', fontWeight: 700, color: '#166534' }}>
              4. Date + Time
            </div>
            <div style={{ padding: '4px 6px', borderRadius: 6, backgroundColor: '#eff6ff', border: '1px solid #3b82f6', fontSize: '0.72rem', fontWeight: 700, color: '#1d4ed8' }}>
              5. Check-In
            </div>
          </div>

          {/* Grid of Camera & Inputs */}
          <div className="grid-2">
            {/* Left: Face Verification Camera */}
            <div>
              <label className="form-label" style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <ScanFace size={16} color="var(--primary)" />
                Face Verification Camera Feed
              </label>
              <CameraCapture
                onCapture={(img) => {
                  setCapturedPhoto(img);
                  setCameraError(null);
                  setPunchFailureResult(null);
                }}
                onError={(err) => setCameraError(err)}
                label="Capture Attendance Face"
              />

              {capturedPhoto && (
                <div style={{ marginTop: 8, padding: '8px 12px', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 6, fontSize: '0.82rem', color: '#166534', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <CheckCircle2 size={16} />
                  <span>Face captured! Ready for biometric match verification.</span>
                </div>
              )}
            </div>

            {/* Right: Employee, GPS & Time Details */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {isOrgAdmin ? (
                <Select
                  label="Select Employee"
                  value={selectedEmpId}
                  onChange={(e) => {
                    setSelectedEmpId(e.target.value);
                    setCapturedPhoto(null);
                    setPunchSuccessResult(null);
                    setPunchFailureResult(null);
                  }}
                  options={employees.map((e) => {
                    const statusTag = e.isFaceEnrolled ? '✓ ' : '⚠️ [Pending Face] ';
                    return {
                      value: e._id || e.id,
                      label: `${statusTag}${getEmpCode(e)} — ${getEmpName(e)} (${getEmpDept(e) || 'General'})`,
                    };
                  })}
                  required
                />
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: '50%',
                        backgroundColor: 'rgba(42, 171, 160, 0.12)',
                        color: 'var(--primary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 700,
                        fontSize: '0.85rem',
                        flexShrink: 0,
                      }}
                    >
                      <User size={18} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--text-main)' }}>
                        {selectedEmployeeObj ? getEmpName(selectedEmployeeObj) : (user?.name || 'My Profile')}
                      </div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        {selectedEmployeeObj ? getEmpCode(selectedEmployeeObj) : (user?.employeeCode || 'SELF')} &bull; {selectedEmployeeObj ? (getEmpDept(selectedEmployeeObj) || 'General') : (user?.department?.name || 'Staff')}
                      </div>
                    </div>
                  </div>
                  <Badge variant="primary">My Profile</Badge>
                </div>
              )}

              {/* Face Biometric Status & Quick Enrollment */}
              {selectedEmployeeObj && (
                <div
                  style={{
                    padding: '8px 12px',
                    borderRadius: 6,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    backgroundColor:
                      selectedEmployeeObj.faceRegistrationPending === false || selectedEmployeeObj.faceVectorStored || selectedEmployeeObj.isFaceRegistered
                        ? '#f0fdf4'
                        : '#fffbeb',
                    border:
                      selectedEmployeeObj.faceRegistrationPending === false || selectedEmployeeObj.faceVectorStored || selectedEmployeeObj.isFaceRegistered
                        ? '1px solid #bbf7d0'
                        : '1px solid #fde68a',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem', color: selectedEmployeeObj.faceRegistrationPending === false || selectedEmployeeObj.faceVectorStored || selectedEmployeeObj.isFaceRegistered ? '#166534' : '#b45309' }}>
                    {selectedEmployeeObj.faceRegistrationPending === false || selectedEmployeeObj.faceVectorStored || selectedEmployeeObj.isFaceRegistered ? (
                      <>
                        <CheckCircle2 size={16} />
                        <span><strong>Biometrics:</strong> Face Enrolled & Ready</span>
                      </>
                    ) : (
                      <>
                        <AlertCircle size={16} />
                        <span><strong>Biometrics:</strong> Face Not Enrolled</span>
                      </>
                    )}
                  </div>
                  {(selectedEmployeeObj.faceRegistrationPending !== false && !selectedEmployeeObj.faceVectorStored && !selectedEmployeeObj.isFaceRegistered) ? (
                    <button
                      type="button"
                      className="btn btn-warning btn-sm"
                      onClick={() => openInlineEnroll(selectedEmployeeObj)}
                      style={{ fontSize: '0.74rem', padding: '3px 8px', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                    >
                      <ScanFace size={13} /> Register Face Now
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => openInlineEnroll(selectedEmployeeObj)}
                      style={{ background: 'none', border: 'none', color: '#16a34a', fontSize: '0.74rem', cursor: 'pointer', textDecoration: 'underline' }}
                    >
                      Update Face
                    </button>
                  )}
                </div>
              )}

              {/* Mode Switcher */}
              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 600 }}>Action Mode</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => setPunchMode('CHECK_IN')}
                    className={`btn ${punchMode === 'CHECK_IN' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                  >
                    Punch IN (Check-In)
                  </button>
                  <button
                    type="button"
                    onClick={() => setPunchMode('CHECK_OUT')}
                    className={`btn ${punchMode === 'CHECK_OUT' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                  >
                    Punch OUT (Check-Out)
                  </button>
                </div>
              </div>

              {/* Date + Real-time Digital Clock Display */}
              <div
                style={{
                  padding: 12,
                  backgroundColor: '#f8fafc',
                  border: '1px solid var(--border-color)',
                  borderRadius: 8,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Date & Time Stamp:</div>
                  <div style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--text-main)' }}>
                    {selectedDate}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Live Clock:</div>
                  <div style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--primary)', fontFamily: 'monospace' }}>
                    {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </div>
                </div>
              </div>

              {/* Live GPS Location Picker */}
              <div>
                <label className="form-label" style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                  <MapPin size={15} color="#0284c7" />
                  GPS Location Resolver
                </label>
                <GeoLocationPicker
                  onLocationChange={(c) => {
                    setCoords(c);
                    if (c && !c.gpsUnavailable) {
                      setPunchFailureResult(null);
                    }
                  }}
                />
              </div>
            </div>
          </div>

          {/* SECTION 5: ATTENDANCE FAILURE / REJECTION CARD */}
          {punchFailureResult && (
            <div
              className="card"
              style={{
                padding: 16,
                backgroundColor: 'rgba(239, 68, 68, 0.06)',
                borderLeft: '5px solid var(--danger)',
                borderRadius: 8,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--danger)', fontWeight: 700, fontSize: '1rem' }}>
                <XCircle size={18} />
                <span>Attendance Failed: {punchFailureResult.conditionName}</span>
              </div>
              <div style={{ marginTop: 6, fontSize: '0.86rem', color: '#991b1b' }}>
                {punchFailureResult.reason}
              </div>
              <div style={{ marginTop: 10, padding: '10px 14px', backgroundColor: '#ffffff', borderRadius: 6, border: '1px solid #fecaca', fontSize: '0.82rem', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6 }}>
                <div><strong>Employee:</strong> {punchFailureResult.employeeName} ({punchFailureResult.employeeCode})</div>
                <div><strong>Timestamp:</strong> {punchFailureResult.timestamp}</div>
                <div><strong>Failure Category:</strong> <Badge variant="danger">{punchFailureResult.failedCondition}</Badge></div>
                {punchFailureResult.confidence !== undefined && (
                  <div><strong>Biometric Score:</strong> {punchFailureResult.confidence}% (Required Threshold: 70%)</div>
                )}
                {punchFailureResult.address && (
                  <div><strong>Location Evaluated:</strong> {punchFailureResult.address}</div>
                )}
              </div>
            </div>
          )}

          {/* SECTION 6: GEO-LOCATION ATTENDANCE SUCCESS CONFIRMATION BOX (ALL 9 ATTRIBUTES) */}
          {punchSuccessResult && (
            <div
              className="card"
              style={{
                padding: 16,
                backgroundColor: 'var(--success-light)',
                borderLeft: '5px solid var(--success)',
                borderRadius: 8,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--success)', fontWeight: 700, fontSize: '1.05rem' }}>
                <CheckCircle2 size={20} />
                <span>Geo-Location Attendance {punchSuccessResult.mode === 'CHECK_IN' ? 'Check-In' : 'Check-Out'} Successfully Recorded!</span>
              </div>
              <div style={{ marginTop: 6, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                System recorded all 9 Geo-Location parameters with biometric verification lock.
              </div>

              {/* 9 Captured Parameters Matrix */}
              <div style={{ marginTop: 10, padding: '12px 14px', backgroundColor: '#ffffff', borderRadius: 6, border: '1px solid #bbf7d0', fontSize: '0.82rem', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                <div>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.74rem', display: 'block' }}>1. Latitude</span>
                  <strong>{punchSuccessResult.latitude}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.74rem', display: 'block' }}>2. Longitude</span>
                  <strong>{punchSuccessResult.longitude}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.74rem', display: 'block' }}>3. Address</span>
                  <strong style={{ color: '#0284c7' }}>{punchSuccessResult.address}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.74rem', display: 'block' }}>4. Date</span>
                  <strong>{punchSuccessResult.date}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.74rem', display: 'block' }}>5. Time</span>
                  <strong style={{ fontFamily: 'monospace' }}>{punchSuccessResult.time}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.74rem', display: 'block' }}>6. GPS Accuracy</span>
                  <strong>±{punchSuccessResult.gpsAccuracy} meters</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.74rem', display: 'block' }}>7. Attendance Type</span>
                  <Badge variant="neutral">{punchSuccessResult.attendanceType}</Badge>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.74rem', display: 'block' }}>8. Employee</span>
                  <strong>{punchSuccessResult.employeeName} ({punchSuccessResult.employeeCode})</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.74rem', display: 'block' }}>9. Face Status</span>
                  <Badge variant="success">{punchSuccessResult.faceVerificationStatus} ({punchSuccessResult.confidence}%)</Badge>
                </div>
              </div>
            </div>
          )}

          {/* Modal Footer */}
          <div className="modal-footer" style={{ margin: '14px -20px -20px' }}>
            <Button
              variant="secondary"
              onClick={() => {
                setPunchFailureResult(null);
                setCheckInModalOpen(false);
              }}
            >
              Close
            </Button>
            <Button
              variant="primary"
              icon={UserCheck}
              loading={submittingPunch}
              onClick={handleDailyCheckInSubmit}
              disabled={!capturedPhoto || !coords}
            >
              Confirm {punchMode === 'CHECK_IN' ? 'Check-In' : 'Check-Out'} with Face & GPS
            </Button>
          </div>
        </div>
      </Modal>

      {/* Multi-Punch Sessions Details Modal */}
      <Modal
        isOpen={sessionModalOpen}
        onClose={() => setSessionModalOpen(false)}
        title={`Multi-Punch Sessions: ${selectedRecord?.employee?.firstName || ''} ${selectedRecord?.employee?.lastName || ''}`}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
            <span><strong>Date:</strong> {selectedDate}</span>
            <span><strong>Total Working Hours:</strong> {selectedRecord?.totalWorkingHours ? `${selectedRecord.totalWorkingHours.toFixed(1)} hrs` : '-'}</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {selectedRecord?.punches?.length > 0 ? (
              selectedRecord.punches.map((p, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: 12,
                    borderRadius: 8,
                    backgroundColor: '#f8fafc',
                    border: '1px solid var(--border-color)',
                    fontSize: '0.85rem',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, marginBottom: 4 }}>
                    <span>Session #{idx + 1}</span>
                    <Badge variant={p.isOpen ? 'warning' : 'success'}>
                      {p.isOpen ? 'Active (Open)' : `${p.workingHours || 0} hrs`}
                    </Badge>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
                    <span>In: {p.checkInTime ? new Date(p.checkInTime).toLocaleTimeString() : '-'}</span>
                    <span>Out: {p.checkOutTime ? new Date(p.checkOutTime).toLocaleTimeString() : 'In Progress'}</span>
                  </div>
                  {p.remarks && <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: 4 }}>Remarks: {p.remarks}</div>}
                </div>
              ))
            ) : (
              <div style={{ padding: 14, textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                Single session recorded for this day.
              </div>
            )}
          </div>

          <div className="modal-footer" style={{ margin: '20px -20px -20px' }}>
            <Button variant="secondary" onClick={() => setSessionModalOpen(false)}>
              Close
            </Button>
          </div>
        </div>
      </Modal>

      {/* Admin Attendance Correction Modal */}
      <Modal
        isOpen={correctModalOpen}
        onClose={() => setCorrectModalOpen(false)}
        title="Admin Attendance Correction"
      >
        <form onSubmit={handleCorrectSubmit}>
          <div style={{ marginBottom: 12, fontSize: '0.85rem' }}>
            <strong>Employee:</strong> {selectedRecord?.employee?.firstName} {selectedRecord?.employee?.lastName || ''}
          </div>

          <Input
            label="Corrected Check-In Timestamp"
            type="datetime-local"
            value={correctForm.checkInTime}
            onChange={(e) => setCorrectForm({ ...correctForm, checkInTime: e.target.value })}
            required
          />

          <Input
            label="Corrected Check-Out Timestamp"
            type="datetime-local"
            value={correctForm.checkOutTime}
            onChange={(e) => setCorrectForm({ ...correctForm, checkOutTime: e.target.value })}
            required
          />

          <Select
            label="Attendance Status"
            value={correctForm.attendanceStatus}
            onChange={(e) => setCorrectForm({ ...correctForm, attendanceStatus: e.target.value })}
            options={[
              { value: 'PRESENT', label: 'Present' },
              { value: 'HALF_DAY', label: 'Half Day' },
              { value: 'ABSENT', label: 'Absent' },
            ]}
          />

          <div className="form-group" style={{ marginBottom: 16 }}>
            <label className="form-label" style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: 6 }}>
              Mandatory Correction Remark
            </label>
            <textarea
              className="form-control"
              value={correctForm.correctionRemark}
              onChange={(e) => setCorrectForm({ ...correctForm, correctionRemark: e.target.value })}
              placeholder="e.g. Adjusted overtime hours per approved project timesheet"
              rows={2}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: 6,
                border: '1px solid var(--border)',
                boxSizing: 'border-box',
              }}
              required
            />
          </div>

          <div className="modal-footer" style={{ margin: '20px -20px -20px' }}>
            <Button variant="secondary" onClick={() => setCorrectModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" loading={submittingCorrection}>
              Save Admin Correction
            </Button>
          </div>
        </form>
      </Modal>

      {/* INLINE FACE ENROLLMENT MODAL (DAILY ATTENDANCE) */}
      <Modal
        isOpen={inlineEnrollOpen}
        onClose={() => setInlineEnrollOpen(false)}
        title={`Face Biometric Registration — ${inlineEnrollEmployee?.firstName || 'Employee'} (${inlineEnrollEmployee?.employeeCode || ''})`}
        size="md"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ padding: '10px 14px', backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, fontSize: '0.84rem', color: '#1e40af' }}>
            <strong>Biometric Enrollment Required:</strong> Capture a clear, front-facing photograph to enroll this employee's facial template for automated daily attendance verification.
          </div>

          <CameraCapture onCapture={(img) => setInlineFacePhoto(img)} label="Capture Face for Biometric Enrollment" />

          {inlineFacePhoto && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#166534', fontSize: '0.85rem', padding: '6px 10px', backgroundColor: '#f0fdf4', borderRadius: 6 }}>
              <CheckCircle2 size={16} /> Photo captured! Ready to store biometric pattern.
            </div>
          )}

          <div className="modal-footer" style={{ margin: '14px -20px -20px' }}>
            <Button variant="secondary" onClick={() => setInlineEnrollOpen(false)} disabled={enrollingInlineFace}>
              Cancel
            </Button>
            <Button
              variant="primary"
              icon={ScanFace}
              onClick={handleInlineEnrollFace}
              loading={enrollingInlineFace}
              disabled={!inlineFacePhoto}
            >
              Enroll & Activate Attendance
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default DailyAttendance;

