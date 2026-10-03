import React, { useState, useEffect } from 'react';
import regularizationApi from '../../api/regularizationApi';
import employeeApi from '../../api/employeeApi';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import {
  Plus,
  Check,
  X,
  Clock,
  FileText,
  CheckCircle2,
  XCircle,
  RotateCcw,
  User,
  Calendar,
  Layers,
  Filter,
  Search,
  AlertCircle,
  Ban,
} from 'lucide-react';
import Table from '../../components/common/Table';
import Modal from '../../components/common/Modal';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import TimePicker12 from '../../components/common/TimePicker12';
import Badge from '../../components/common/Badge';
import ModuleSubNav from '../../components/common/ModuleSubNav';
import { attendanceNav } from '../../routes/moduleNavConfig';

export const Regularization = () => {
  const { isSuperAdmin, isHrAdmin, user, branch: globalBranch } = useAuth();
  const { showToast } = useToast();
  const canReview = isSuperAdmin || isHrAdmin;

  const activeBranchId = globalBranch?._id || globalBranch?.id;
  const isAllBranches = !activeBranchId || activeBranchId === 'ALL';

  // Active Tab
  const [activeTab, setActiveTab] = useState(canReview ? 'pending' : 'my_requests'); // 'pending' | 'my_requests' | 'employee_history'

  // Masters
  const [employees, setEmployees] = useState([]);

  // Tab 1: Pending Approvals (GET /regularization/requests/pending-approval)
  const [pendingRequests, setPendingRequests] = useState([]);
  const [loadingPending, setLoadingPending] = useState(false);

  // Tab 2: My Requests (GET /regularization/requests/me)
  const [myRequests, setMyRequests] = useState([]);
  const [loadingMyRequests, setLoadingMyRequests] = useState(false);

  // Tab 3: Employee Regularization History (GET /regularization/requests/employees/:employeeId)
  const [selectedEmpId, setSelectedEmpId] = useState('');
  const [employeeRequests, setEmployeeRequests] = useState([]);
  const [loadingEmpRequests, setLoadingEmpRequests] = useState(false);

  // Apply Modal (POST /regularization/requests)
  const [applyModalOpen, setApplyModalOpen] = useState(false);
  const [submittingApply, setSubmittingApply] = useState(false);
  const [formData, setFormData] = useState({
    attendanceType: 'OFFICE', // 'OFFICE' | 'FIELD' | 'SITE'
    attendanceDate: new Date().toISOString().split('T')[0],
    requestType: 'WRONG_TIME_RECORDED', // 'MISSED_CHECK_IN' | 'MISSED_CHECK_OUT' | 'MISSED_ENTIRE_DAY' | 'WRONG_TIME_RECORDED'
    proposedCheckInTime: '09:00',
    proposedCheckOutTime: '18:00',
    reason: '',
  });

  // Review Modal (PUT /regularization/requests/:id/approve & reject)
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [reviewAction, setReviewAction] = useState('approve'); // 'approve' | 'reject'
  const [reviewRemarks, setReviewRemarks] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  // Cancel Modal (PUT /regularization/requests/:id/cancel)
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancellingRequest, setCancellingRequest] = useState(false);

  // Safe list extractor for backend responses
  const extractList = (res) => {
    if (!res) return [];
    if (Array.isArray(res)) return res;
    if (Array.isArray(res.data)) return res.data;
    if (Array.isArray(res.regularizations)) return res.regularizations;
    if (Array.isArray(res.pendingRequests)) return res.pendingRequests;
    if (Array.isArray(res.requests)) return res.requests;
    return [];
  };

  const getEmpName = (emp, reqItem) => {
    if (typeof emp === 'object' && emp !== null) {
      return (
        emp?.basicInfo?.fullName ||
        emp?.fullName ||
        (emp?.firstName ? `${emp.firstName} ${emp.lastName || ''}`.trim() : '') ||
        emp?.name ||
        'Employee'
      );
    }
    const empId = typeof emp === 'string' ? emp : (reqItem?.employee || reqItem?.employeeId);
    if (empId) {
      const found = employees.find((e) => (e._id || e.id) === empId);
      if (found) {
        return found?.basicInfo?.fullName || found?.fullName || found?.name || 'Employee';
      }
      if (user?.employee?._id === empId || user?.employee === empId || user?._id === empId) {
        return user?.name || user?.basicInfo?.fullName || 'Employee';
      }
    }
    return reqItem?.requestedBy?.name || user?.name || 'Employee';
  };

  const getEmpCode = (emp, reqItem) => {
    if (typeof emp === 'object' && emp !== null) {
      return emp?.basicInfo?.employeeCode || emp?.employeeCode || '-';
    }
    const empId = typeof emp === 'string' ? emp : (reqItem?.employee || reqItem?.employeeId);
    if (empId) {
      const found = employees.find((e) => (e._id || e.id) === empId);
      if (found) {
        return found?.basicInfo?.employeeCode || found?.employeeCode || '-';
      }
    }
    return '-';
  };

  // Load Masters
  const loadMasters = async () => {
    try {
      const res = await employeeApi.getEmployees({ limit: 100 });
      const list = extractList(res);
      setEmployees(list);
      if (list.length > 0) setSelectedEmpId(list[0]._id || list[0].id);
    } catch (err) {
      console.error(err);
    }
  };

  // Load Pending Approvals (GET /regularization/requests/pending-approval)
  const loadPending = async () => {
    setLoadingPending(true);
    try {
      const res = await regularizationApi.getPendingApprovals();
      setPendingRequests(extractList(res));
    } catch (err) {
      console.error(err);
      setPendingRequests([]);
    } finally {
      setLoadingPending(false);
    }
  };

  // Load My Regularizations (GET /regularization/requests/me)
  const loadMyRequests = async () => {
    setLoadingMyRequests(true);
    try {
      const res = await regularizationApi.getMyRegularizations();
      setMyRequests(extractList(res));
    } catch (err) {
      console.error(err);
      setMyRequests([]);
    } finally {
      setLoadingMyRequests(false);
    }
  };

  // Load Specific Employee Regularizations (GET /regularization/requests/employees/:id)
  const loadEmployeeRequests = async (empId) => {
    if (!empId) return;
    setLoadingEmpRequests(true);
    try {
      const res = await regularizationApi.getEmployeeRegularizations(empId);
      setEmployeeRequests(extractList(res));
    } catch (err) {
      console.error(err);
      setEmployeeRequests([]);
    } finally {
      setLoadingEmpRequests(false);
    }
  };

  useEffect(() => {
    loadMasters();
    loadMyRequests();
    if (canReview) {
      loadPending();
    }
  }, [canReview]);

  useEffect(() => {
    if (activeTab === 'pending') loadPending();
    else if (activeTab === 'my_requests') loadMyRequests();
    else if (activeTab === 'employee_history' && selectedEmpId) loadEmployeeRequests(selectedEmpId);
  }, [activeTab, selectedEmpId]);

  // Handle Apply Regularization (POST /regularization/requests)
  const handleApply = async (e) => {
    e.preventDefault();
    if (!formData.reason.trim()) {
      showToast('Please provide a justification reason', 'warning');
      return;
    }

    setSubmittingApply(true);
    try {
      const dateStr = formData.attendanceDate;
      const formatIso = (hhmm) => {
        if (!hhmm) return `${dateStr}T09:00:00.000Z`;
        if (hhmm.includes('T')) return hhmm;
        return `${dateStr}T${hhmm}:00.000Z`;
      };

      const payload = {
        attendanceType: formData.attendanceType || 'OFFICE',
        attendanceDate: dateStr,
        requestType: formData.requestType || 'WRONG_TIME_RECORDED',
        proposedCheckInTime: formatIso(formData.proposedCheckInTime),
        proposedCheckOutTime: formatIso(formData.proposedCheckOutTime),
        reason: formData.reason.trim(),
      };

      await regularizationApi.applyRegularization(payload);
      showToast('Attendance regularization request submitted successfully!', 'success');
      setApplyModalOpen(false);
      setFormData({
        attendanceType: 'OFFICE',
        attendanceDate: new Date().toISOString().split('T')[0],
        requestType: 'WRONG_TIME_RECORDED',
        proposedCheckInTime: '09:00',
        proposedCheckOutTime: '18:00',
        reason: '',
      });
      await loadMyRequests();
      if (canReview) await loadPending();
      if (selectedEmpId) await loadEmployeeRequests(selectedEmpId);
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to submit regularization', 'error');
    } finally {
      setSubmittingApply(false);
    }
  };

  // Open Review Modal
  const openReviewModal = (req, action) => {
    setSelectedRequest(req);
    setReviewAction(action);
    setReviewRemarks(action === 'approve' ? 'Authorized attendance verified and approved' : 'Rejected after inspection');
    setReviewModalOpen(true);
  };

  // Submit Review (PUT /regularization/requests/:id/approve & reject)
  const handleReviewSubmit = async (e) => {
    e.preventDefault();
    if (!selectedRequest) return;
    setSubmittingReview(true);
    try {
      if (reviewAction === 'approve') {
        await regularizationApi.approveRegularization(selectedRequest._id, {
          remark: reviewRemarks,
          reviewRemarks,
        });
        showToast('Regularization approved! Attendance write-through updated.', 'success');
      } else {
        await regularizationApi.rejectRegularization(selectedRequest._id, {
          remark: reviewRemarks,
          reviewRemarks,
        });
        showToast('Regularization request rejected', 'info');
      }
      setReviewModalOpen(false);
      loadPending();
      loadMyRequests();
      if (selectedEmpId) loadEmployeeRequests(selectedEmpId);
    } catch (err) {
      showToast(err.response?.data?.message || `Failed to ${reviewAction} request`, 'error');
    } finally {
      setSubmittingReview(false);
    }
  };

  // Open Cancel Modal
  const openCancelModal = (req) => {
    setSelectedRequest(req);
    setCancelModalOpen(true);
  };

  // Cancel Request (PUT /regularization/requests/:id/cancel)
  const handleCancelSubmit = async (e) => {
    e.preventDefault();
    if (!selectedRequest) return;
    setCancellingRequest(true);
    try {
      await regularizationApi.cancelRegularization(selectedRequest._id, 'Withdrawn by employee');
      showToast('Regularization request cancelled', 'info');
      setCancelModalOpen(false);
      loadMyRequests();
      if (canReview) loadPending();
      if (selectedEmpId) loadEmployeeRequests(selectedEmpId);
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to cancel request', 'error');
    } finally {
      setCancellingRequest(false);
    }
  };

  // Table Columns
  const columns = [
    {
      header: 'Employee',
      key: 'employee',
      render: (r) => (
        <div>
          <div style={{ fontWeight: 600 }}>
            {getEmpName(r.employee)}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{getEmpCode(r.employee)}</div>
        </div>
      ),
    },
    {
      header: 'Attendance Date & Type',
      key: 'attendanceDate',
      render: (r) => (
        <div>
          <div style={{ fontWeight: 600 }}>
            {r.attendanceDate ? new Date(r.attendanceDate).toLocaleDateString() : '-'}
          </div>
          <Badge variant="neutral" style={{ fontSize: '0.72rem', marginTop: 2 }}>
            {r.attendanceType || 'OFFICE'}
          </Badge>
        </div>
      ),
    },
    {
      header: 'Request Type',
      key: 'requestType',
      render: (r) => {
        const t = r.requestType || 'TIMING_CORRECTION';
        return <Badge variant="info" style={{ fontSize: '0.74rem' }}>{t.replace(/_/g, ' ')}</Badge>;
      },
    },
    {
      header: 'Proposed Timings',
      key: 'proposedTimings',
      render: (r) => {
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
        const inTime = format12(r.proposedCheckInTime || r.requestedCheckInTime);
        const outTime = format12(r.proposedCheckOutTime || r.requestedCheckOutTime);
        return (
          <div style={{ fontSize: '0.82rem' }}>
            <div>In: <strong style={{ color: '#16a34a' }}>{inTime}</strong></div>
            <div>Out: <strong style={{ color: 'var(--primary)' }}>{outTime}</strong></div>
          </div>
        );
      },
    },
    {
      header: 'Justification Reason',
      key: 'reason',
      render: (r) => (
        <div style={{ fontSize: '0.82rem', maxWidth: 220, color: 'var(--text-main)' }}>
          {r.reason || '-'}
        </div>
      ),
    },
    {
      header: 'Status',
      key: 'status',
      render: (r) => {
        const st = r.status || 'PENDING';
        return (
          <Badge
            variant={
              st === 'APPROVED'
                ? 'success'
                : st === 'REJECTED'
                ? 'danger'
                : st === 'CANCELLED'
                ? 'neutral'
                : 'warning'
            }
          >
            {st}
          </Badge>
        );
      },
    },
    {
      header: 'Actions',
      key: 'actions',
      render: (r) => (
        <div style={{ display: 'flex', gap: 6 }}>
          {(activeTab === 'pending' || activeTab === 'employee_history') && canReview && r.status === 'PENDING' && (
            <>
              <Button
                size="sm"
                variant="primary"
                icon={Check}
                onClick={() => openReviewModal(r, 'approve')}
                style={{ fontSize: '0.75rem', padding: '3px 8px', background: '#059669', borderColor: '#059669' }}
              >
                Approve
              </Button>
              <Button
                size="sm"
                variant="secondary"
                icon={X}
                onClick={() => openReviewModal(r, 'reject')}
                style={{ fontSize: '0.75rem', padding: '3px 8px', color: '#dc2626' }}
              >
                Reject
              </Button>
            </>
          )}
          {activeTab === 'my_requests' && r.status === 'PENDING' && (
            <Button
              size="sm"
              variant="light"
              icon={Ban}
              onClick={() => openCancelModal(r)}
              style={{ fontSize: '0.75rem', padding: '3px 8px', color: '#dc2626' }}
              title="Cancel Request (PUT /regularization/requests/:id/cancel)"
            >
              Cancel
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <ModuleSubNav items={attendanceNav} />

      {/* Header Banner */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>Regularization Management</h2>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <Button variant="primary" icon={Plus} onClick={() => setApplyModalOpen(true)}>
            Apply Regularization
          </Button>
        </div>
      </div>

      {/* Tab Switcher */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 10,
          borderBottom: '2px solid var(--border-light)',
          marginBottom: 6,
        }}
      >
        {canReview && (
          <button
            type="button"
            onClick={() => setActiveTab('pending')}
            style={{
              padding: '10px 16px',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'pending' ? '3px solid #d97706' : '3px solid transparent',
              color: activeTab === 'pending' ? '#d97706' : 'var(--text-muted)',
              fontWeight: activeTab === 'pending' ? 700 : 500,
              cursor: 'pointer',
              fontSize: '0.92rem',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <Clock size={17} />
            Pending Approvals ({pendingRequests.length})
          </button>
        )}

        <button
          type="button"
          onClick={() => setActiveTab('my_requests')}
          style={{
            padding: '10px 16px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'my_requests' ? '3px solid var(--primary)' : '3px solid transparent',
            color: activeTab === 'my_requests' ? 'var(--primary)' : 'var(--text-muted)',
            fontWeight: activeTab === 'my_requests' ? 700 : 500,
            cursor: 'pointer',
            fontSize: '0.92rem',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <Calendar size={17} />
          My Regularizations ({myRequests.length})
        </button>

        {canReview && (
          <button
            type="button"
            onClick={() => setActiveTab('employee_history')}
            style={{
              padding: '10px 16px',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'employee_history' ? '3px solid var(--primary)' : '3px solid transparent',
              color: activeTab === 'employee_history' ? 'var(--primary)' : 'var(--text-muted)',
              fontWeight: activeTab === 'employee_history' ? 700 : 500,
              cursor: 'pointer',
              fontSize: '0.92rem',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <User size={17} />
            Employee History ({employeeRequests.length})
          </button>
        )}
      </div>

      {/* TAB 1: PENDING APPROVALS */}
      {activeTab === 'pending' && (
        <div className="card">
          <Table
            columns={columns}
            data={pendingRequests}
            loading={loadingPending}
            emptyMessage="No pending attendance regularization requests awaiting approval."
          />
        </div>
      )}

      {/* TAB 2: MY REGULARIZATION REQUESTS */}
      {activeTab === 'my_requests' && (
        <div className="card">
          <Table
            columns={columns}
            data={myRequests}
            loading={loadingMyRequests}
            emptyMessage="You have not submitted any regularization requests yet."
          />
        </div>
      )}

      {/* TAB 3: EMPLOYEE REGULARIZATION HISTORY */}
      {activeTab === 'employee_history' && (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
            <div style={{ flex: 1, maxWidth: 320 }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: 4 }}>
                Select Employee:
              </label>
              <select
                className="form-control"
                value={selectedEmpId}
                onChange={(e) => {
                  setSelectedEmpId(e.target.value);
                  loadEmployeeRequests(e.target.value);
                }}
              >
                {employees.map((emp) => (
                  <option key={emp._id} value={emp._id}>
                    {getEmpName(emp)} ({getEmpCode(emp)})
                  </option>
                ))}
              </select>
            </div>
            <Button
              variant="primary"
              size="sm"
              icon={Search}
              onClick={() => loadEmployeeRequests(selectedEmpId)}
              loading={loadingEmpRequests}
              style={{ alignSelf: 'flex-end' }}
            >
              Fetch History
            </Button>
          </div>

          <Table
            columns={columns}
            data={employeeRequests}
            loading={loadingEmpRequests}
            emptyMessage="No regularization requests recorded for this employee."
          />
        </div>
      )}

      {/* APPLY REGULARIZATION MODAL (POST /regularization/requests) */}
      <Modal isOpen={applyModalOpen} onClose={() => setApplyModalOpen(false)} title="Submit Attendance Regularization Request">
        <form onSubmit={handleApply}>
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Attendance Type *</label>
              <select
                className="form-control"
                value={formData.attendanceType}
                onChange={(e) => setFormData({ ...formData, attendanceType: e.target.value })}
                required
              >
                <option value="OFFICE">OFFICE</option>
                <option value="FIELD">FIELD</option>
                <option value="SITE">SITE</option>
              </select>
            </div>

            <Input
              label="Attendance Date *"
              type="date"
              value={formData.attendanceDate}
              onChange={(e) => setFormData({ ...formData, attendanceDate: e.target.value })}
              required
            />
          </div>

          <div className="form-group" style={{ marginTop: 12 }}>
            <label className="form-label">Request Type *</label>
            <select
              className="form-control"
              value={formData.requestType}
              onChange={(e) => setFormData({ ...formData, requestType: e.target.value })}
              required
            >
              <option value="MISSED_CHECK_IN">Missed Check-In</option>
              <option value="MISSED_CHECK_OUT">Missed Check-Out</option>
              <option value="MISSED_ENTIRE_DAY">Missed Entire Day</option>
              <option value="WRONG_TIME_RECORDED">Wrong Time Recorded / Machine Glitch</option>
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
            <TimePicker12
              label="Proposed Check-In Time"
              value={formData.proposedCheckInTime}
              onChange={(val) => setFormData({ ...formData, proposedCheckInTime: val })}
              required
            />
            <TimePicker12
              label="Proposed Check-Out Time"
              value={formData.proposedCheckOutTime}
              onChange={(val) => setFormData({ ...formData, proposedCheckOutTime: val })}
              required
            />
          </div>

          <div className="form-group" style={{ marginTop: 12 }}>
            <label className="form-label">Justification Reason *</label>
            <textarea
              className="form-control"
              rows={3}
              value={formData.reason}
              onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
              placeholder="e.g. Biometric device network failure at branch office / verified with regional supervisor."
              required
            />
          </div>

          <div className="modal-footer" style={{ margin: '18px -20px -20px' }}>
            <Button variant="secondary" onClick={() => setApplyModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" loading={submittingApply}>
              Submit Request
            </Button>
          </div>
        </form>
      </Modal>

      {/* REVIEW MODAL (PUT /regularization/requests/:id/approve & reject) */}
      <Modal
        isOpen={reviewModalOpen}
        onClose={() => setReviewModalOpen(false)}
        title={`${reviewAction === 'approve' ? 'Approve' : 'Reject'} Attendance Regularization`}
      >
        <form onSubmit={handleReviewSubmit}>
          <p style={{ margin: '0 0 12px', fontSize: '0.88rem' }}>
            {reviewAction === 'approve'
              ? 'Approving will immediately write through and update the official Daily Attendance Record with the proposed times.'
              : 'Rejecting will retain the existing attendance record without modifications.'}
          </p>

          <div className="form-group">
            <label className="form-label">Administrative Review Remarks</label>
            <textarea
              className="form-control"
              rows={3}
              value={reviewRemarks}
              onChange={(e) => setReviewRemarks(e.target.value)}
              placeholder="Provide approval verification or reason for rejection"
              required
            />
          </div>

          <div className="modal-footer" style={{ margin: '18px -20px -20px' }}>
            <Button variant="secondary" onClick={() => setReviewModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              type="submit"
              loading={submittingReview}
              style={{
                background: reviewAction === 'approve' ? '#059669' : '#dc2626',
                borderColor: reviewAction === 'approve' ? '#059669' : '#dc2626',
              }}
            >
              Confirm {reviewAction === 'approve' ? 'Approval' : 'Rejection'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* CANCEL MODAL (PUT /regularization/requests/:id/cancel) */}
      <Modal isOpen={cancelModalOpen} onClose={() => setCancelModalOpen(false)} title="Withdraw Regularization Request">
        <form onSubmit={handleCancelSubmit}>
          <p style={{ margin: '0 0 12px', fontSize: '0.88rem', color: 'var(--text-muted)' }}>
            Are you sure you want to cancel this pending attendance regularization request?
          </p>
          <div className="modal-footer" style={{ margin: '18px -20px -20px' }}>
            <Button variant="secondary" onClick={() => setCancelModalOpen(false)}>
              Back
            </Button>
            <Button variant="primary" type="submit" loading={cancellingRequest} style={{ background: '#dc2626', borderColor: '#dc2626' }}>
              Confirm Cancellation
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Regularization;
