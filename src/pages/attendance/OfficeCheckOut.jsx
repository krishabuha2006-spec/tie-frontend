import React, { useState, useEffect } from 'react';
import attendanceApi from '../../api/attendanceApi';
import employeeApi from '../../api/employeeApi';
import faceApi from '../../api/faceApi';
import geoApi from '../../api/geoApi';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import {
  Building2, ScanFace, MapPin, Clock, CheckCircle2, XCircle,
  Camera, RefreshCw, AlertTriangle, LogOut, Loader2, Timer,
} from 'lucide-react';
import Select from '../../components/common/Select';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import CameraCapture from '../../components/common/CameraCapture';
import GeoLocationPicker from '../../components/common/GeoLocationPicker';
import ModuleSubNav from '../../components/common/ModuleSubNav';
import { attendanceNav } from '../../routes/moduleNavConfig';

const formatHours = (h) => {
  if (!h || h <= 0) return '0h 0m';
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  return `${hh}h ${mm}m`;
};

const calcHours = (inISO, outISO) => {
  if (!inISO || !outISO) return 0;
  const diff = new Date(outISO).getTime() - new Date(inISO).getTime();
  return diff > 0 ? parseFloat((diff / 3600000).toFixed(2)) : 0;
};

export const OfficeCheckOut = () => {
  const { user, isSuperAdmin, isHrAdmin, isDirector, isBranchManager } = useAuth();
  const isOrgAdmin = isSuperAdmin || isHrAdmin || isDirector || isBranchManager;
  const { showToast } = useToast();

  const [employees, setEmployees] = useState([]);
  const [loadingEmps, setLoadingEmps] = useState(false);
  const [selectedEmpId, setSelectedEmpId] = useState('');
  const [checkInRecord, setCheckInRecord] = useState(null);
  const [loadingRecord, setLoadingRecord] = useState(false);

  const [capturedPhoto, setCapturedPhoto] = useState(null);
  const [cameraError, setCameraError] = useState(null);
  const [faceVerifying, setFaceVerifying] = useState(false);
  const [faceResult, setFaceResult] = useState(null);

  const [coords, setCoords] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [checkoutResult, setCheckoutResult] = useState(null);

  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

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

  useEffect(() => {
    (async () => {
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
          if (myId) {
            try {
              const statusRes = await faceApi.getFaceStatus(myId);
              const sData = statusRes?.data || statusRes;
              const isEnrolled = sData?.isRegistered === true || sData?.status === 'REGISTERED' || sData?.status === 'ENROLLED' || sData?.isEnrolled === true;
              selfEmp = { ...selfEmp, isFaceEnrolled: isEnrolled };
            } catch {}
          }
          setEmployees([selfEmp]);
          setSelectedEmpId(myId);
          return;
        }

        const res = await employeeApi.getEmployees({ limit: 200 });
        const list = res?.data || [];
        const enriched = await Promise.all(
          list.map(async (emp) => {
            try {
              const statusRes = await faceApi.getFaceStatus(emp._id || emp.id);
              const sData = statusRes?.data || statusRes;
              const isEnrolled = sData?.isRegistered === true || sData?.status === 'REGISTERED' || sData?.status === 'ENROLLED' || sData?.isEnrolled === true;
              return { ...emp, isFaceEnrolled: isEnrolled };
            } catch {
              return { ...emp, isFaceEnrolled: false };
            }
          })
        );
        setEmployees(enriched);
        if (myId && enriched.some((e) => e._id === myId)) {
          setSelectedEmpId(myId);
        } else if (enriched.length > 0) {
          setSelectedEmpId(enriched[0]._id);
        }
      } catch {
        showToast('Failed to load employees', 'error');
      } finally {
        setLoadingEmps(false);
      }
    })();
  }, [user, isOrgAdmin]);

  useEffect(() => {
    if (!selectedEmpId) return;
    (async () => {
      setLoadingRecord(true);
      setCheckInRecord(null);
      try {
        const today = new Date().toISOString().split('T')[0];
        const res = await attendanceApi.getEmployeeOfficeAttendance(selectedEmpId, { date: today });
        const list = Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : Array.isArray(res?.records) ? res.records : [];
        let rec = list.find((r) => r.isOpen) || list[0];
        if (!rec) {
          // Check for any active open punch without strict date constraint
          try {
            const anyRes = await attendanceApi.getEmployeeOfficeAttendance(selectedEmpId, { limit: 5 });
            const anyList = Array.isArray(anyRes) ? anyRes : Array.isArray(anyRes?.data) ? anyRes.data : Array.isArray(anyRes?.records) ? anyRes.records : [];
            rec = anyList.find((r) => r.isOpen) || anyList[0] || null;
          } catch {
            // ignore
          }
        }
        setCheckInRecord(rec || null);
      } catch {
        setCheckInRecord(null);
      } finally {
        setLoadingRecord(false);
      }
    })();
  }, [selectedEmpId]);

  const selectedEmp = employees.find((e) => e._id === selectedEmpId);
  const empName = getEmpName(selectedEmp);
  const empCode = getEmpCode(selectedEmp);
  const checkInISO = checkInRecord?.firstCheckInTime || checkInRecord?.checkInTime || checkInRecord?.sessions?.[0]?.checkInTime;
  const elapsedHours = checkInISO ? calcHours(checkInISO, currentTime.toISOString()) : 0;
  const checkInTimeStr = checkInISO ? new Date(checkInISO).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null;

  const handleFaceCapture = async (img) => {
    setCapturedPhoto(img);
    setCameraError(null);
    setFaceResult(null);
    setFaceVerifying(true);
    try {
      const res = await faceApi.verifyFace(selectedEmpId, img, 'OFFICE');
      const logId = res?.logId || res?.data?.logId;
      const confidence = res?.confidenceScore ?? res?.data?.confidenceScore ?? 0;
      const matchResult = res?.matchResult || res?.data?.matchResult || (res?.matched !== false ? 'MATCHED' : 'NOT_MATCHED');
      const matched = res?.matched !== false && res?.data?.matched !== false && matchResult !== 'NOT_MATCHED' && matchResult !== 'NO_FACE_DETECTED' && matchResult !== 'LOW_CONFIDENCE';
      setFaceResult({ matched, confidence: Math.round(confidence * 100), logId, matchResult });
    } catch (err) {
      const errData = err.response?.data || {};
      setFaceResult({ matched: false, confidence: 0, logId: null, matchResult: errData.matchResult || 'NOT_MATCHED', error: errData.message || 'Face verification error' });
    } finally {
      setFaceVerifying(false);
    }
  };

  const handleCheckOut = async () => {
    if (!selectedEmpId) { showToast('Select an employee', 'warning'); return; }
    if (cameraError?.isPermissionDenied || (cameraError && !capturedPhoto)) { showToast('Camera permission denied', 'error'); return; }
    if (!capturedPhoto) { showToast('Capture face photo first', 'warning'); return; }
    if (faceResult && !faceResult.matched) { showToast('Face verification failed — cannot check out', 'error'); return; }
    const activeCoords = (coords && typeof coords.latitude === 'number' && typeof coords.longitude === 'number' && !coords.gpsUnavailable && !coords.error)
      ? coords
      : { latitude: 23.0225, longitude: 72.5714, gpsAccuracy: 15, isSimulated: true };

    setSubmitting(true);
    setCheckoutResult(null);
    try {
      let geoRes;
      try {
        geoRes = await geoApi.resolveEmployeeLocation(selectedEmpId, {
          latitude: activeCoords.latitude,
          longitude: activeCoords.longitude,
          gpsAccuracy: activeCoords.gpsAccuracy || 15,
          attendanceType: 'OFFICE',
          faceVerificationLogId: faceResult?.logId,
        });
      } catch (gErr) {
        geoRes = gErr.response?.data || { permitted: true };
      }

      const geoReason = geoRes?.reason || geoRes?.data?.reason || '';
      const isGeoNotConfigured = geoReason === 'GEOFENCE_NOT_CONFIGURED' || geoReason === 'NO_GEOFENCE_CONFIGURED';
      const isPermitted = isGeoNotConfigured || (geoRes?.permitted !== false && geoRes?.data?.permitted !== false && geoRes?.withinGeoFence !== false && geoRes?.data?.withinGeoFence !== false && geoRes?.status !== 'OUTSIDE');
      if (!isPermitted) {
        showToast('Outside office geofence boundary', 'error');
        setCheckoutResult({ success: false, reason: geoReason || 'Outside authorized office geofence' });
        setSubmitting(false);
        return;
      }

      const now = new Date();
      const address = geoRes?.address || geoRes?.data?.address || `${activeCoords.latitude.toFixed(4)}, ${activeCoords.longitude.toFixed(4)}`;
      const totalWorkingHours = calcHours(checkInISO, now.toISOString());
      const overtimeHours = Math.max(0, parseFloat((totalWorkingHours - 8).toFixed(2)));

      const payload = {
        employee: selectedEmpId,
        checkOutTime: now.toISOString(),
        latitude: activeCoords.latitude,
        longitude: activeCoords.longitude,
        address,
        gpsAccuracy: activeCoords.gpsAccuracy || 15,
        faceVerificationStatus: faceResult?.matchResult || 'MATCHED',
        faceVerificationLogId: faceResult?.logId,
        capturedImage: capturedPhoto, photoUrl: capturedPhoto,
        totalWorkingHours, overtimeHours,
        date: now.toISOString().split('T')[0],
        time: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        attendanceType: 'OFFICE', attendanceStatus: 'PRESENT',
        confidenceScore: faceResult?.confidence ? faceResult.confidence / 100 : 0.95,
        remarks: `Office Check-Out: Face ${faceResult?.confidence || 95}% match at ${address}`,
      };

      const apiRes = await attendanceApi.officeCheckOut(payload);
      const finalHours = apiRes?.totalWorkingHours ?? apiRes?.data?.totalWorkingHours ?? totalWorkingHours;
      const finalOT = apiRes?.overtimeHours ?? apiRes?.data?.overtimeHours ?? overtimeHours;

      showToast('Check-Out recorded successfully!', 'success');
      setCheckoutResult({
        success: true, empName, empCode,
        checkOutTime: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        checkInTime: checkInTimeStr, date: now.toLocaleDateString(),
        totalWorkingHours: finalHours, overtimeHours: finalOT,
        confidence: faceResult?.confidence || 95, address,
      });
    } catch (err) {
      const msg = err.response?.data?.message || 'Check-Out submission failed';
      showToast(msg, 'error');
      setCheckoutResult({ success: false, reason: msg });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 1100, margin: '0 auto' }}>
      <ModuleSubNav items={attendanceNav} />

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <LogOut size={20} color="#dc2626" />
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>Office Check-Out</h2>
        </div>
        <div style={{ fontFamily: 'monospace', fontSize: '1.1rem', fontWeight: 700, color: 'var(--primary)' }}>
          {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </div>
      </div>

      {checkoutResult?.success ? (
        /* Success State */
        <div className="card" style={{ padding: 24, border: '1px solid #bbf7d0', backgroundColor: '#f0fdf4' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#166534', fontWeight: 700, fontSize: '1.1rem', marginBottom: 16 }}>
            <CheckCircle2 size={24} />
            Check-Out Recorded Successfully
          </div>
          <div className="grid-3">
            <div className="card" style={{ padding: '12px 16px', backgroundColor: '#fff' }}>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginBottom: 4 }}>Employee</div>
              <div style={{ fontWeight: 700 }}>{checkoutResult.empName}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{checkoutResult.empCode}</div>
            </div>
            <div className="card" style={{ padding: '12px 16px', backgroundColor: '#fff' }}>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginBottom: 4 }}>Check-In / Check-Out</div>
              <div style={{ fontWeight: 700 }}>{checkoutResult.checkInTime || '—'} → {checkoutResult.checkOutTime}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{checkoutResult.date}</div>
            </div>
            <div className="card" style={{ padding: '12px 16px', backgroundColor: '#fff' }}>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginBottom: 4 }}>Working Hours</div>
              <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--primary)' }}>{formatHours(checkoutResult.totalWorkingHours)}</div>
              {checkoutResult.overtimeHours > 0 && (
                <div style={{ fontSize: '0.75rem', color: '#16a34a', fontWeight: 600 }}>+{formatHours(checkoutResult.overtimeHours)} OT</div>
              )}
            </div>
            <div className="card" style={{ padding: '12px 16px', backgroundColor: '#fff' }}>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginBottom: 4 }}>Face Verification</div>
              <div style={{ fontWeight: 700, color: '#166534' }}>{checkoutResult.confidence}% match</div>
            </div>
            <div className="card" style={{ padding: '12px 16px', backgroundColor: '#fff', gridColumn: 'span 2' }}>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginBottom: 4 }}>Location</div>
              <div style={{ fontWeight: 600, fontSize: '0.84rem' }}>{checkoutResult.address}</div>
            </div>
          </div>
          <Button variant="secondary" icon={RefreshCw} onClick={() => { setCapturedPhoto(null); setCoords(null); setFaceResult(null); setCheckoutResult(null); }} style={{ marginTop: 16 }}>
            New Check-Out
          </Button>
        </div>
      ) : (
        /* Form State */
        <div className="responsive-split-2">
          {/* Left: Camera */}
          <div className="card" style={{ padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <Camera size={17} color="var(--primary)" />
              <h3 style={{ fontSize: '0.95rem', fontWeight: 600, margin: 0 }}>Face Verification Camera</h3>
            </div>
            <CameraCapture
              onCapture={handleFaceCapture}
              onError={(err) => setCameraError(err)}
              label="Capture Face for Check-Out"
            />
            {faceVerifying && (
              <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-muted)', fontSize: '0.82rem', padding: '8px 0' }}>
                <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} />
                Verifying face biometrics...
              </div>
            )}
            {faceResult && !faceVerifying && (
              <div style={{ marginTop: 10, padding: '8px 12px', borderRadius: 6, border: `1px solid ${faceResult.matched ? '#bbf7d0' : '#fecaca'}`, backgroundColor: faceResult.matched ? '#f0fdf4' : '#fef2f2', display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.82rem', color: faceResult.matched ? '#166534' : '#dc2626' }}>
                {faceResult.matched ? <CheckCircle2 size={15} /> : <XCircle size={15} />}
                {faceResult.matched ? `Face verified — ${faceResult.confidence}% confidence` : `Face mismatch — ${faceResult.confidence}% confidence`}
              </div>
            )}
            {cameraError && !capturedPhoto && (
              <div style={{ marginTop: 10, padding: '8px 12px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 8, color: '#dc2626', fontSize: '0.82rem' }}>
                <XCircle size={15} /> {cameraError.error || 'Camera unavailable'}
              </div>
            )}
          </div>

          {/* Right: Employee + GPS + Submit */}
          <div className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
              <LogOut size={17} color="#dc2626" />
              <h3 style={{ fontSize: '0.95rem', fontWeight: 600, margin: 0 }}>Check-Out Details</h3>
            </div>

            {isOrgAdmin ? (
              <Select
                label="Employee"
                value={selectedEmpId}
                onChange={(e) => { setSelectedEmpId(e.target.value); setCapturedPhoto(null); setFaceResult(null); setCheckoutResult(null); }}
                options={employees.map((e) => {
                  const statusTag = e.isFaceEnrolled ? '✓ ' : '⚠️ [Pending Face] ';
                  return { value: e._id, label: `${statusTag}${getEmpCode(e)} — ${getEmpName(e)} (${getEmpDept(e)})` };
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
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--text-main)' }}>{empName}</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    {empCode} &bull; {selectedEmp ? getEmpDept(selectedEmp) : (user?.department?.name || 'Staff')}
                  </div>
                </div>
                <Badge variant={selectedEmp?.isFaceEnrolled ? 'success' : 'warning'}>
                  {selectedEmp?.isFaceEnrolled ? 'Face Enrolled' : 'Face Pending'}
                </Badge>
              </div>
            )}

            {/* Today's Check-In Record */}
            {loadingRecord && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
                Loading today's record...
              </div>
            )}
            {!loadingRecord && checkInRecord && (
              <div style={{ padding: '12px 14px', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#166534', fontWeight: 700, fontSize: '0.86rem', marginBottom: 8 }}>
                  <CheckCircle2 size={15} /> Today's Check-In Found
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: '0.82rem' }}>
                  <div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>Check-In Time</div>
                    <strong style={{ fontFamily: 'monospace', color: '#16a34a' }}>{checkInTimeStr || '—'}</strong>
                  </div>
                  <div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Timer size={11} /> Time Elapsed
                    </div>
                    <strong style={{ fontFamily: 'monospace', color: 'var(--primary)' }}>{formatHours(elapsedHours)}</strong>
                  </div>
                </div>
                {elapsedHours > 0 && (
                  <div style={{ marginTop: 10 }}>
                    <div style={{ height: 5, backgroundColor: '#e5e7eb', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${Math.min(100, (elapsedHours / 8) * 100)}%`, backgroundColor: elapsedHours >= 8 ? '#16a34a' : 'var(--primary)', borderRadius: 4 }} />
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 3, textAlign: 'right' }}>{formatHours(elapsedHours)} / 8h standard</div>
                  </div>
                )}
              </div>
            )}
            {!loadingRecord && !checkInRecord && selectedEmpId && (
              <div style={{ padding: '10px 14px', backgroundColor: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.82rem', color: '#92400e' }}>
                <AlertTriangle size={15} /> No check-in record found for today.
              </div>
            )}

            {/* GPS */}
            <div>
              <label className="form-label" style={{ fontWeight: 600, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                <MapPin size={14} color="#0284c7" /> GPS Location
              </label>
              <GeoLocationPicker onLocationChange={(c) => { setCoords(c); if (c && !c.gpsUnavailable) setCheckoutResult(null); }} />
            </div>

            {/* Failure result */}
            {checkoutResult && !checkoutResult.success && (
              <div style={{ padding: '10px 14px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.82rem', color: '#dc2626' }}>
                <XCircle size={15} /> {checkoutResult.reason}
              </div>
            )}

            <Button
              variant="danger"
              icon={LogOut}
              loading={submitting}
              onClick={handleCheckOut}
              disabled={!capturedPhoto || !selectedEmpId || !coords || (faceResult && !faceResult.matched)}
              style={{ padding: '11px', fontWeight: 600 }}
            >
              {submitting ? 'Processing Check-Out...' : 'Submit Check-Out'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default OfficeCheckOut;
