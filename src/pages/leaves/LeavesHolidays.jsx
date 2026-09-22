import React, { useState, useEffect } from 'react';
import leaveHolidayApi from '../../api/leaveHolidayApi';
import employeeApi from '../../api/employeeApi';
import masterApi from '../../api/masterApi';
import { useToast } from '../../context/ToastContext';
import { useConfirm } from '../../context/ConfirmContext';
import { useAuth } from '../../context/AuthContext';
import { formatEmployeeOption, extractEmployeeList } from '../../utils/employeeUtils';
import {
  Plus,
  Check,
  X,
  CalendarOff,
  Calendar,
  FileText,
  Clock,
  RotateCcw,
  User,
  Trash2,
  Edit2,
  Copy,
  Layers,
  Search,
  CheckCircle2,
  AlertCircle,
  Ban,
  Settings,
  Sparkles,
  ShieldCheck,
} from 'lucide-react';
import Table from '../../components/common/Table';
import Modal from '../../components/common/Modal';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import Select from '../../components/common/Select';
import Badge from '../../components/common/Badge';

export const LeavesHolidays = () => {
  const confirm = useConfirm();
  const { user, isSuperAdmin, isHrAdmin } = useAuth();
  const { showToast } = useToast();
  const canManage = isSuperAdmin || isHrAdmin;

  // Active Tab
  const [activeTab, setActiveTab] = useState(canManage ? 'approvals' : 'my_leaves');
  // 'approvals' | 'my_leaves' | 'leave_types' | 'balances' | 'holidays' | 'weekly_offs'

  // Common Masters
  const [employees, setEmployees] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [leaveTypes, setLeaveTypes] = useState([]);

  // --- TAB 1: PENDING APPROVALS ---
  const [pendingRequests, setPendingRequests] = useState([]);
  const [loadingPending, setLoadingPending] = useState(false);

  // --- TAB 2: MY LEAVES ---
  const [myRequests, setMyRequests] = useState([]);
  const [loadingMyRequests, setLoadingMyRequests] = useState(false);
  const [applyModalOpen, setApplyModalOpen] = useState(false);
  const [submittingApply, setSubmittingApply] = useState(false);
  const [leaveForm, setLeaveForm] = useState({
    leaveType: '',
    fromDate: new Date().toISOString().split('T')[0],
    toDate: new Date(Date.now() + 86400000).toISOString().split('T')[0],
    reason: '',
  });

  // --- TAB 3: LEAVE TYPES ---
  const [loadingLeaveTypes, setLoadingLeaveTypes] = useState(false);
  const [leaveTypeModalOpen, setLeaveTypeModalOpen] = useState(false);
  const [submittingType, setSubmittingType] = useState(false);
  const [leaveTypeForm, setLeaveTypeForm] = useState({
    name: '',
    code: '',
    annualEntitlement: 12,
    isPaid: true,
    carryForwardAllowed: false,
    maxCarryForwardDays: 0,
    company: '',
  });

  // --- TAB 4: BALANCES & ACCRUAL ---
  const [selectedBalanceEmpId, setSelectedBalanceEmpId] = useState('');
  const [employeeBalance, setEmployeeBalance] = useState(null);
  const [loadingBalance, setLoadingBalance] = useState(false);
  const [accrueModalOpen, setAccrueModalOpen] = useState(false);
  const [submittingAccrue, setSubmittingAccrue] = useState(false);
  const [accrueForm, setAccrueForm] = useState({
    employeeId: '',
    leaveType: '',
    year: new Date().getFullYear(),
    entitledDays: 12,
    carriedForwardDays: 0,
  });

  // --- TAB 5: HOLIDAYS ---
  const [holidays, setHolidays] = useState([]);
  const [loadingHolidays, setLoadingHolidays] = useState(false);
  const [holidayModalOpen, setHolidayModalOpen] = useState(false);
  const [submittingHoliday, setSubmittingHoliday] = useState(false);
  const [holidayForm, setHolidayForm] = useState({
    name: '',
    date: new Date().toISOString().split('T')[0],
    type: 'FESTIVAL', // 'NATIONAL' | 'FESTIVAL' | 'COMPANY_SPECIFIC' | 'OPTIONAL'
    scope: 'COMPANY', // 'COMPANY' | 'BRANCH'
    reference: '',
    isOptional: false,
  });

  // Copy Holidays Modal
  const [copyHolidaysModalOpen, setCopyHolidaysModalOpen] = useState(false);
  const [copyForm, setCopyForm] = useState({
    fromYear: new Date().getFullYear() - 1,
    toYear: new Date().getFullYear(),
  });
  const [submittingCopy, setSubmittingCopy] = useState(false);

  // --- TAB 6: WEEKLY-OFF CONFIGS ---
  const [weeklyOffs, setWeeklyOffs] = useState([]);
  const [loadingWeeklyOffs, setLoadingWeeklyOffs] = useState(false);
  const [weeklyOffModalOpen, setWeeklyOffModalOpen] = useState(false);
  const [submittingWeeklyOff, setSubmittingWeeklyOff] = useState(false);
  const [weeklyOffForm, setWeeklyOffForm] = useState({
    scope: 'COMPANY',
    reference: '',
    offDays: [0], // Sunday by default
  });

  // Load Masters
  const loadMasters = async () => {
    try {
      const [eRes, cRes, ltRes] = await Promise.allSettled([
        employeeApi.getEmployees({ limit: 100 }),
        masterApi.getCompanies(),
        leaveHolidayApi.getLeaveTypes(),
      ]);

      if (eRes.status === 'fulfilled') {
        const list = extractEmployeeList(eRes.value);
        setEmployees(list);
        if (list.length > 0) {
          setSelectedBalanceEmpId(list[0]._id);
          setAccrueForm((prev) => ({ ...prev, employeeId: list[0]._id }));
        }
      }

      if (cRes.status === 'fulfilled') {
        const cList = Array.isArray(cRes.value)
          ? cRes.value
          : Array.isArray(cRes.value?.data)
          ? cRes.value.data
          : cRes.value?.companies || [];
        setCompanies(cList);
        if (cList.length > 0) {
          setHolidayForm((prev) => ({ ...prev, reference: cList[0]._id }));
          setWeeklyOffForm((prev) => ({ ...prev, reference: cList[0]._id }));
          setLeaveTypeForm((prev) => ({ ...prev, company: cList[0]._id }));
        }
      }

      if (ltRes.status === 'fulfilled') {
        const ltList = Array.isArray(ltRes.value)
          ? ltRes.value
          : Array.isArray(ltRes.value?.data)
          ? ltRes.value.data
          : ltRes.value?.leaveTypes || [];
        setLeaveTypes(ltList);
        if (ltList.length > 0) {
          setLeaveForm((prev) => ({ ...prev, leaveType: ltList[0]._id }));
          setAccrueForm((prev) => ({ ...prev, leaveType: ltList[0]._id }));
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Load Pending Approvals (GET /leave/requests/pending-approval)
  const loadPending = async () => {
    setLoadingPending(true);
    try {
      const res = await leaveHolidayApi.getPendingLeaveApprovals();
      const list = Array.isArray(res)
        ? res
        : Array.isArray(res?.data)
        ? res.data
        : res?.pendingRequests || res?.requests || [];
      setPendingRequests(list);
    } catch {
      setPendingRequests([]);
    } finally {
      setLoadingPending(false);
    }
  };

  // Load My Leaves (GET /leave/requests/me)
  const loadMyLeaves = async () => {
    setLoadingMyRequests(true);
    try {
      const res = await leaveHolidayApi.getMyLeaveRequests();
      const list = Array.isArray(res)
        ? res
        : Array.isArray(res?.data)
        ? res.data
        : res?.requests || [];
      setMyRequests(list);
    } catch {
      setMyRequests([]);
    } finally {
      setLoadingMyRequests(false);
    }
  };

  // Load Leave Types (GET /leave-types)
  const loadLeaveTypes = async () => {
    setLoadingLeaveTypes(true);
    try {
      const res = await leaveHolidayApi.getLeaveTypes();
      const list = Array.isArray(res)
        ? res
        : Array.isArray(res?.data)
        ? res.data
        : res?.leaveTypes || [];
      setLeaveTypes(list);
    } catch {
      setLeaveTypes([]);
    } finally {
      setLoadingLeaveTypes(false);
    }
  };

  // Load Employee Leave Balance (GET /leave/employees/:id/balance)
  const loadBalance = async (empId) => {
    if (!empId) return;
    setLoadingBalance(true);
    try {
      const res = await leaveHolidayApi.getEmployeeLeaveBalance(empId);
      setEmployeeBalance(res?.balance || res?.data || res);
    } catch {
      setEmployeeBalance(null);
    } finally {
      setLoadingBalance(false);
    }
  };

  // Load Holidays (GET /holidays)
  const loadHolidays = async () => {
    setLoadingHolidays(true);
    try {
      const res = await leaveHolidayApi.getHolidays();
      const list = Array.isArray(res)
        ? res
        : Array.isArray(res?.data)
        ? res.data
        : res?.holidays || [];
      setHolidays(list);
    } catch {
      setHolidays([]);
    } finally {
      setLoadingHolidays(false);
    }
  };

  // Load Weekly-Off Configs (GET /weekly-off-configs)
  const loadWeeklyOffs = async () => {
    setLoadingWeeklyOffs(true);
    try {
      const res = await leaveHolidayApi.getWeeklyOffConfigs();
      const list = Array.isArray(res)
        ? res
        : Array.isArray(res?.data)
        ? res.data
        : res?.configs || [];
      setWeeklyOffs(list);
    } catch {
      setWeeklyOffs([]);
    } finally {
      setLoadingWeeklyOffs(false);
    }
  };

  useEffect(() => {
    loadMasters();
  }, []);

  useEffect(() => {
    if (activeTab === 'approvals') loadPending();
    else if (activeTab === 'my_leaves') loadMyLeaves();
    else if (activeTab === 'leave_types') loadLeaveTypes();
    else if (activeTab === 'balances' && selectedBalanceEmpId) loadBalance(selectedBalanceEmpId);
    else if (activeTab === 'holidays') loadHolidays();
    else if (activeTab === 'weekly_offs') loadWeeklyOffs();
  }, [activeTab, selectedBalanceEmpId]);

  // Apply Leave (POST /leave/requests)
  const handleApplyLeave = async (e) => {
    e.preventDefault();
    if (!leaveForm.leaveType) {
      showToast('Please select a leave category', 'warning');
      return;
    }
    setSubmittingApply(true);
    try {
      await leaveHolidayApi.applyLeave(leaveForm);
      showToast('Leave request submitted successfully!', 'success');
      setApplyModalOpen(false);
      loadMyLeaves();
      if (canManage) loadPending();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to submit leave', 'error');
    } finally {
      setSubmittingApply(false);
    }
  };

  // Approve Leave (PUT /leave/requests/:id/approve)
  const handleApprove = async (id) => {
    try {
      await leaveHolidayApi.approveLeave(id, { remarks: 'Approved by Manager' });
      showToast('Leave request approved!', 'success');
      loadPending();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to approve', 'error');
    }
  };

  // Reject Leave (PUT /leave/requests/:id/reject)
  const handleReject = async (id) => {
    try {
      await leaveHolidayApi.rejectLeave(id, { reason: 'Rejected after balance/operational review' });
      showToast('Leave request rejected', 'info');
      loadPending();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to reject', 'error');
    }
  };

  // Cancel Leave (PUT /leave/requests/:id/cancel)
  const handleCancelLeave = async (id) => {
    const isConfirmed = await confirm({
      title: 'Cancel Leave Application',
      message: 'Are you sure you want to cancel this leave application? This action cannot be undone.',
      confirmText: 'Cancel Leave',
      cancelText: 'Keep',
      variant: 'warning',
    });
    if (!isConfirmed) return;
    try {
      await leaveHolidayApi.cancelLeave(id);
      showToast('Leave application withdrawn', 'info');
      loadMyLeaves();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to cancel leave', 'error');
    }
  };

  // Create Leave Type (POST /leave-types)
  const handleCreateLeaveType = async (e) => {
    e.preventDefault();
    setSubmittingType(true);
    try {
      await leaveHolidayApi.createLeaveType(leaveTypeForm);
      showToast('Leave type created successfully!', 'success');
      setLeaveTypeModalOpen(false);
      loadLeaveTypes();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to create leave type', 'error');
    } finally {
      setSubmittingType(false);
    }
  };

  // Accrue Balance (POST /leave/balances/accrue)
  const handleAccrueSubmit = async (e) => {
    e.preventDefault();
    setSubmittingAccrue(true);
    try {
      await leaveHolidayApi.accrueLeaveBalance({
        ...accrueForm,
        year: Number(accrueForm.year),
        entitledDays: Number(accrueForm.entitledDays),
        carriedForwardDays: Number(accrueForm.carriedForwardDays || 0),
      });
      showToast('Employee leave balance initialized/accrued!', 'success');
      setAccrueModalOpen(false);
      if (selectedBalanceEmpId) loadBalance(selectedBalanceEmpId);
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to accrue balance', 'error');
    } finally {
      setSubmittingAccrue(false);
    }
  };

  // Create Holiday (POST /holidays)
  const handleCreateHoliday = async (e) => {
    e.preventDefault();
    setSubmittingHoliday(true);
    try {
      await leaveHolidayApi.createHoliday(holidayForm);
      showToast('Holiday added to organization calendar!', 'success');
      setHolidayModalOpen(false);
      loadHolidays();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to create holiday', 'error');
    } finally {
      setSubmittingHoliday(false);
    }
  };

  // Delete Holiday (DELETE /holidays/:id)
  const handleDeleteHoliday = async (id) => {
    const isConfirmed = await confirm({
      title: 'Delete Holiday',
      message: 'Are you sure you want to delete this holiday entry from the organization calendar?',
      confirmText: 'Delete Holiday',
      cancelText: 'Cancel',
      variant: 'danger',
    });
    if (!isConfirmed) return;
    try {
      await leaveHolidayApi.deleteHoliday(id);
      showToast('Holiday deleted', 'info');
      loadHolidays();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to delete holiday', 'error');
    }
  };

  // Copy Holidays (POST /holidays/copy-from-year)
  const handleCopyHolidays = async (e) => {
    e.preventDefault();
    setSubmittingCopy(true);
    try {
      await leaveHolidayApi.copyHolidaysFromYear({
        fromYear: Number(copyForm.fromYear),
        toYear: Number(copyForm.toYear),
      });
      showToast(`Holidays successfully cloned from ${copyForm.fromYear} to ${copyForm.toYear}!`, 'success');
      setCopyHolidaysModalOpen(false);
      loadHolidays();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to copy holidays', 'error');
    } finally {
      setSubmittingCopy(false);
    }
  };

  // Create/Update Weekly-Off Config (POST /weekly-off-configs)
  const handleWeeklyOffSubmit = async (e) => {
    e.preventDefault();
    setSubmittingWeeklyOff(true);
    try {
      await leaveHolidayApi.createWeeklyOffConfig(weeklyOffForm);
      showToast('Weekly-off schedule saved successfully!', 'success');
      setWeeklyOffModalOpen(false);
      loadWeeklyOffs();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to configure weekly-offs', 'error');
    } finally {
      setSubmittingWeeklyOff(false);
    }
  };

  // Leave Requests Columns
  const leaveColumns = [
    {
      header: 'Employee',
      key: 'employee',
      render: (r) => (
        <div>
          <div style={{ fontWeight: 600 }}>
            {r.employee?.firstName ? `${r.employee.firstName} ${r.employee.lastName || ''}` : r.employee?.name || 'Staff Member'}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{r.employee?.employeeCode || '-'}</div>
        </div>
      ),
    },
    {
      header: 'Leave Type',
      key: 'leaveType',
      render: (r) => <Badge variant="primary">{r.leaveType?.name || 'Casual Leave'}</Badge>,
    },
    {
      header: 'Duration (Days Excl. Weekends)',
      key: 'duration',
      render: (r) => {
        const from = r.fromDate || r.startDate;
        const to = r.toDate || r.endDate;
        return (
          <div style={{ fontSize: '0.84rem' }}>
            <div>{from ? new Date(from).toLocaleDateString() : '-'} to {to ? new Date(to).toLocaleDateString() : '-'}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--primary)', fontWeight: 600 }}>{r.totalDays ?? 1} day(s)</div>
          </div>
        );
      },
    },
    {
      header: 'Reason',
      key: 'reason',
      render: (r) => <span style={{ fontSize: '0.82rem' }}>{r.reason || '-'}</span>,
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
          {activeTab === 'approvals' && r.status === 'PENDING' && (
            <>
              <Button
                size="sm"
                variant="primary"
                icon={Check}
                onClick={() => handleApprove(r._id)}
                style={{ fontSize: '0.74rem', padding: '4px 10px' }}
              >
                Approve
              </Button>
              <Button
                size="sm"
                variant="secondary"
                icon={X}
                onClick={() => handleReject(r._id)}
                style={{ fontSize: '0.74rem', padding: '4px 10px', color: '#dc2626' }}
              >
                Reject
              </Button>
            </>
          )}
          {activeTab === 'my_leaves' && r.status === 'PENDING' && (
            <Button
              size="sm"
              variant="light"
              icon={Ban}
              onClick={() => handleCancelLeave(r._id)}
              style={{ fontSize: '0.74rem', padding: '4px 10px', color: '#dc2626' }}
            >
              Cancel
            </Button>
          )}
        </div>
      ),
    },
  ];

  // Leave Types Columns
  const leaveTypeColumns = [
    {
      header: 'Category Name',
      key: 'name',
      render: (r) => (
        <div>
          <div style={{ fontWeight: 600 }}>{r.name}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Code: {r.code}</div>
        </div>
      ),
    },
    {
      header: 'Annual Entitlement',
      key: 'annualEntitlement',
      render: (r) => <strong>{r.annualEntitlement ?? 12} Days / Year</strong>,
    },
    {
      header: 'Paid Leave',
      key: 'isPaid',
      render: (r) => (
        <Badge variant={r.isPaid ? 'success' : 'neutral'}>
          {r.isPaid ? 'Paid' : 'Unpaid LWP'}
        </Badge>
      ),
    },
    {
      header: 'Carry-Forward',
      key: 'carryForward',
      render: (r) => (
        <span style={{ fontSize: '0.82rem' }}>
          {r.carryForwardAllowed ? `Yes (Max ${r.maxCarryForwardDays || 0}d)` : 'No'}
        </span>
      ),
    },
  ];

  // Holidays Columns
  const holidayColumns = [
    {
      header: 'Holiday Name',
      key: 'name',
      render: (r) => (
        <div>
          <div style={{ fontWeight: 600 }}>{r.name}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{r.type}</div>
        </div>
      ),
    },
    {
      header: 'Date',
      key: 'date',
      render: (r) => (
        <div style={{ fontWeight: 600, color: 'var(--primary)' }}>
          {r.date ? new Date(r.date).toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' }) : '-'}
        </div>
      ),
    },
    {
      header: 'Scope',
      key: 'scope',
      render: (r) => <Badge variant="neutral">{r.scope || 'COMPANY'}</Badge>,
    },
    {
      header: 'Optional',
      key: 'isOptional',
      render: (r) => (
        <Badge variant={r.isOptional ? 'warning' : 'info'}>
          {r.isOptional ? 'Optional' : 'Mandatory Holiday'}
        </Badge>
      ),
    },
    {
      header: 'Actions',
      key: 'actions',
      render: (r) => (
        <Button
          size="sm"
          variant="light"
          icon={Trash2}
          onClick={() => handleDeleteHoliday(r._id)}
          style={{ color: '#dc2626', padding: '3px 8px' }}
        />
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header Banner */}
      <div
        className="card"
        style={{
          display: 'flex',
          justify: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 16,
          padding: '20px 24px',
          background: 'var(--bg-surface)',
          borderRadius: 'var(--radius-lg, 12px)',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 10,
              background: 'linear-gradient(135deg, var(--primary) 0%, #1e565d 100%)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 10px rgba(46, 123, 133, 0.25)',
            }}
          >
            <Calendar size={22} />
          </div>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
              Leave &amp; Holiday Management
            </h2>
            <p style={{ margin: '3px 0 0', fontSize: '0.84rem', color: 'var(--text-muted)' }}>
              Manage leave applications, employee balances, company holidays, and weekly-off schedules.
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <Button variant="primary" icon={Plus} onClick={() => setApplyModalOpen(true)}>
            Apply Leave
          </Button>
          <Button
            variant="light"
            icon={RotateCcw}
            onClick={() => {
              if (activeTab === 'approvals') loadPending();
              else if (activeTab === 'my_leaves') loadMyLeaves();
              else if (activeTab === 'leave_types') loadLeaveTypes();
              else if (activeTab === 'balances') loadBalance(selectedBalanceEmpId);
              else if (activeTab === 'holidays') loadHolidays();
              else loadWeeklyOffs();
            }}
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* Dynamic KPI Cards */}
      <div className="dashboard-stats-grid">
        <div
          className="card"
          style={{
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            borderRadius: 'var(--radius-lg, 12px)',
            background: 'var(--bg-surface)',
          }}
        >
          <div
            style={{
              width: 42,
              height: 42,
              borderRadius: 10,
              background: 'rgba(217, 119, 6, 0.12)',
              color: '#d97706',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Clock size={20} />
          </div>
          <div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>PENDING APPROVALS</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-main)', marginTop: 2 }}>
              {pendingRequests.length}
            </div>
          </div>
        </div>

        <div
          className="card"
          style={{
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            borderRadius: 'var(--radius-lg, 12px)',
            background: 'var(--bg-surface)',
          }}
        >
          <div
            style={{
              width: 42,
              height: 42,
              borderRadius: 10,
              background: 'rgba(46, 123, 133, 0.12)',
              color: 'var(--primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Calendar size={20} />
          </div>
          <div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>MY LEAVES</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-main)', marginTop: 2 }}>
              {myRequests.length}
            </div>
          </div>
        </div>

        <div
          className="card"
          style={{
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            borderRadius: 'var(--radius-lg, 12px)',
            background: 'var(--bg-surface)',
          }}
        >
          <div
            style={{
              width: 42,
              height: 42,
              borderRadius: 10,
              background: 'rgba(59, 130, 246, 0.12)',
              color: '#3b82f6',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Settings size={20} />
          </div>
          <div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>LEAVE CATEGORIES</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-main)', marginTop: 2 }}>
              {leaveTypes.length}
            </div>
          </div>
        </div>

        <div
          className="card"
          style={{
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            borderRadius: 'var(--radius-lg, 12px)',
            background: 'var(--bg-surface)',
          }}
        >
          <div
            style={{
              width: 42,
              height: 42,
              borderRadius: 10,
              background: 'rgba(16, 185, 129, 0.12)',
              color: '#10b981',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <CalendarOff size={20} />
          </div>
          <div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>COMPANY HOLIDAYS</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-main)', marginTop: 2 }}>
              {holidays.length}
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 6,
          borderBottom: '1px solid var(--border-color)',
          paddingBottom: 2,
        }}
      >
        {canManage && (
          <button
            type="button"
            onClick={() => setActiveTab('approvals')}
            style={{
              padding: '10px 18px',
              background: 'none',
              border: 'none',
              outline: 'none',
              borderBottom: activeTab === 'approvals' ? '3px solid var(--primary)' : '3px solid transparent',
              color: activeTab === 'approvals' ? 'var(--primary)' : 'var(--text-muted)',
              fontWeight: activeTab === 'approvals' ? 700 : 500,
              cursor: 'pointer',
              fontSize: '0.9rem',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              transition: 'all 0.2s ease',
            }}
          >
            <Clock size={16} />
            Pending Approvals ({pendingRequests.length})
          </button>
        )}

        <button
          type="button"
          onClick={() => setActiveTab('my_leaves')}
          style={{
            padding: '10px 18px',
            background: 'none',
            border: 'none',
            outline: 'none',
            borderBottom: activeTab === 'my_leaves' ? '3px solid var(--primary)' : '3px solid transparent',
            color: activeTab === 'my_leaves' ? 'var(--primary)' : 'var(--text-muted)',
            fontWeight: activeTab === 'my_leaves' ? 700 : 500,
            cursor: 'pointer',
            fontSize: '0.9rem',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            transition: 'all 0.2s ease',
          }}
        >
          <Calendar size={16} />
          My Leaves ({myRequests.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('leave_types')}
          style={{
            padding: '10px 18px',
            background: 'none',
            border: 'none',
            outline: 'none',
            borderBottom: activeTab === 'leave_types' ? '3px solid var(--primary)' : '3px solid transparent',
            color: activeTab === 'leave_types' ? 'var(--primary)' : 'var(--text-muted)',
            fontWeight: activeTab === 'leave_types' ? 700 : 500,
            cursor: 'pointer',
            fontSize: '0.9rem',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            transition: 'all 0.2s ease',
          }}
        >
          <Settings size={16} />
          Leave Types ({leaveTypes.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('balances')}
          style={{
            padding: '10px 18px',
            background: 'none',
            border: 'none',
            outline: 'none',
            borderBottom: activeTab === 'balances' ? '3px solid var(--primary)' : '3px solid transparent',
            color: activeTab === 'balances' ? 'var(--primary)' : 'var(--text-muted)',
            fontWeight: activeTab === 'balances' ? 700 : 500,
            cursor: 'pointer',
            fontSize: '0.9rem',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            transition: 'all 0.2s ease',
          }}
        >
          <ShieldCheck size={16} />
          Leave Balances &amp; Accrual
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('holidays')}
          style={{
            padding: '10px 18px',
            background: 'none',
            border: 'none',
            outline: 'none',
            borderBottom: activeTab === 'holidays' ? '3px solid var(--primary)' : '3px solid transparent',
            color: activeTab === 'holidays' ? 'var(--primary)' : 'var(--text-muted)',
            fontWeight: activeTab === 'holidays' ? 700 : 500,
            cursor: 'pointer',
            fontSize: '0.9rem',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            transition: 'all 0.2s ease',
          }}
        >
          <CalendarOff size={16} />
          Holiday Calendar ({holidays.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('weekly_offs')}
          style={{
            padding: '10px 18px',
            background: 'none',
            border: 'none',
            outline: 'none',
            borderBottom: activeTab === 'weekly_offs' ? '3px solid var(--primary)' : '3px solid transparent',
            color: activeTab === 'weekly_offs' ? 'var(--primary)' : 'var(--text-muted)',
            fontWeight: activeTab === 'weekly_offs' ? 700 : 500,
            cursor: 'pointer',
            fontSize: '0.9rem',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            transition: 'all 0.2s ease',
          }}
        >
          <Layers size={16} />
          Weekly-Off Rules
        </button>
      </div>

      {/* TAB 1: PENDING APPROVALS */}
      {activeTab === 'approvals' && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <Table
            columns={leaveColumns}
            data={pendingRequests}
            loading={loadingPending}
            emptyMessage="No pending leave applications requiring approval."
          />
        </div>
      )}

      {/* TAB 2: MY LEAVES */}
      {activeTab === 'my_leaves' && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <Table
            columns={leaveColumns}
            data={myRequests}
            loading={loadingMyRequests}
            emptyMessage="No leave requests filed yet. Click 'Apply Leave' above."
          />
        </div>
      )}

      {/* TAB 3: LEAVE TYPES */}
      {activeTab === 'leave_types' && (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {canManage && (
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button size="sm" variant="primary" icon={Plus} onClick={() => setLeaveTypeModalOpen(true)}>
                Add Leave Category
              </Button>
            </div>
          )}
          <Table
            columns={leaveTypeColumns}
            data={leaveTypes}
            loading={loadingLeaveTypes}
            emptyMessage="No leave types configured yet."
          />
        </div>
      )}

      {/* TAB 4: BALANCES & ACCRUAL */}
      {activeTab === 'balances' && (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flex: 1, maxWidth: 400 }}>
              <select
                className="form-control"
                value={selectedBalanceEmpId}
                onChange={(e) => {
                  setSelectedBalanceEmpId(e.target.value);
                  loadBalance(e.target.value);
                }}
              >
                {employees.map((emp) => (
                  <option key={emp._id || emp.id} value={emp._id || emp.id}>
                    {formatEmployeeOption(emp, true)}
                  </option>
                ))}
              </select>
              <Button size="sm" variant="primary" icon={Search} onClick={() => loadBalance(selectedBalanceEmpId)}>
                Inspect
              </Button>
            </div>

            {canManage && (
              <Button size="sm" variant="primary" icon={Plus} onClick={() => setAccrueModalOpen(true)}>
                Accrue / Initialize Balance
              </Button>
            )}
          </div>

          {employeeBalance && (
            <div className="grid-4" style={{ background: 'var(--bg-subtle)', padding: 18, borderRadius: 'var(--radius-md)' }}>
              <div>
                <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)', fontWeight: 600 }}>TOTAL ENTITLED</span>
                <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--primary)' }}>
                  {employeeBalance.entitledDays ?? employeeBalance.totalEntitled ?? 12}d
                </div>
              </div>
              <div>
                <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)', fontWeight: 600 }}>DAYS CONSUMED</span>
                <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#dc2626' }}>
                  {employeeBalance.consumedDays ?? employeeBalance.used ?? 0}d
                </div>
              </div>
              <div>
                <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)', fontWeight: 600 }}>AVAILABLE BALANCE</span>
                <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--primary)' }}>
                  {employeeBalance.availableBalance ?? employeeBalance.remaining ?? 12}d
                </div>
              </div>
              <div>
                <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)', fontWeight: 600 }}>CARRIED FORWARD</span>
                <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#d97706' }}>
                  {employeeBalance.carriedForwardDays ?? 0}d
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 5: HOLIDAYS */}
      {activeTab === 'holidays' && (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {canManage && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <Button size="sm" variant="light" icon={Copy} onClick={() => setCopyHolidaysModalOpen(true)}>
                Copy from Past Year
              </Button>
              <Button size="sm" variant="primary" icon={Plus} onClick={() => setHolidayModalOpen(true)}>
                Add Holiday
              </Button>
            </div>
          )}
          <Table
            columns={holidayColumns}
            data={holidays}
            loading={loadingHolidays}
            emptyMessage="No holidays registered for the current calendar period."
          />
        </div>
      )}

      {/* TAB 6: WEEKLY-OFF RULES */}
      {activeTab === 'weekly_offs' && (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem' }}>Weekly-Off Configurations</h3>
              <p style={{ margin: '2px 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                Configured rest days are automatically excluded from leave deductions and attendance shortfall calculations.
              </p>
            </div>
            {canManage && (
              <Button size="sm" variant="primary" icon={Plus} onClick={() => setWeeklyOffModalOpen(true)}>
                Configure Schedule
              </Button>
            )}
          </div>

          <div className="grid-2">
            {weeklyOffs.length > 0 ? (
              weeklyOffs.map((w, idx) => (
                <div key={w._id || idx} style={{ border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', padding: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontWeight: 600 }}>{w.scope || 'COMPANY'} Scope</span>
                    <Badge variant="success">Active</Badge>
                  </div>
                  <div style={{ marginTop: 8, fontSize: '0.86rem' }}>
                    Rest Days: <strong>{(w.offDays || [0]).map((d) => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d]).join(', ')}</strong>
                  </div>
                </div>
              ))
            ) : (
              <div style={{ border: '1px dashed var(--border-light)', borderRadius: 'var(--radius-md)', padding: 20, textAlign: 'center', color: 'var(--text-muted)' }}>
                Standard Sunday Weekly-Off is currently applied system-wide.
              </div>
            )}
          </div>
        </div>
      )}

      {/* APPLY LEAVE MODAL (POST /leave/requests) */}
      <Modal isOpen={applyModalOpen} onClose={() => setApplyModalOpen(false)} title="Apply for Leave">
        <form onSubmit={handleApplyLeave}>
          <div className="form-group">
            <label className="form-label">Leave Category *</label>
            <select
              className="form-control"
              value={leaveForm.leaveType}
              onChange={(e) => setLeaveForm({ ...leaveForm, leaveType: e.target.value })}
              required
            >
              {leaveTypes.map((t) => (
                <option key={t._id} value={t._id}>
                  {t.name} ({t.code}) - {t.annualEntitlement || 12}d/yr
                </option>
              ))}
            </select>
          </div>

          <div className="grid-2" style={{ marginTop: 12 }}>
            <Input
              label="From Date *"
              type="date"
              value={leaveForm.fromDate}
              onChange={(e) => setLeaveForm({ ...leaveForm, fromDate: e.target.value })}
              required
            />
            <Input
              label="To Date *"
              type="date"
              value={leaveForm.toDate}
              onChange={(e) => setLeaveForm({ ...leaveForm, toDate: e.target.value })}
              required
            />
          </div>

          <div className="form-group" style={{ marginTop: 12 }}>
            <label className="form-label">Reason for Absence *</label>
            <textarea
              className="form-control"
              rows={3}
              value={leaveForm.reason}
              onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })}
              placeholder="Provide reason for planned leave"
              required
            />
          </div>

          <div className="modal-footer" style={{ margin: '18px -20px -20px' }}>
            <Button variant="secondary" onClick={() => setApplyModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" loading={submittingApply}>
              Submit Application
            </Button>
          </div>
        </form>
      </Modal>

      {/* CREATE LEAVE TYPE MODAL (POST /leave-types) */}
      <Modal isOpen={leaveTypeModalOpen} onClose={() => setLeaveTypeModalOpen(false)} title="Add Leave Category">
        <form onSubmit={handleCreateLeaveType}>
          <div className="grid-2">
            <Input
              label="Category Name *"
              value={leaveTypeForm.name}
              onChange={(e) => setLeaveTypeForm({ ...leaveTypeForm, name: e.target.value })}
              placeholder="e.g. Earned Leave"
              required
            />
            <Input
              label="Short Code *"
              value={leaveTypeForm.code}
              onChange={(e) => setLeaveTypeForm({ ...leaveTypeForm, code: e.target.value.toUpperCase() })}
              placeholder="EL"
              required
            />
          </div>

          <div className="grid-2" style={{ marginTop: 12 }}>
            <Input
              label="Annual Entitlement (Days) *"
              type="number"
              value={leaveTypeForm.annualEntitlement}
              onChange={(e) => setLeaveTypeForm({ ...leaveTypeForm, annualEntitlement: Number(e.target.value) })}
              required
            />
            <div className="form-group">
              <label className="form-label">Company</label>
              <select
                className="form-control"
                value={leaveTypeForm.company}
                onChange={(e) => setLeaveTypeForm({ ...leaveTypeForm, company: e.target.value })}
              >
                {companies.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="modal-footer" style={{ margin: '18px -20px -20px' }}>
            <Button variant="secondary" onClick={() => setLeaveTypeModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" loading={submittingType}>
              Save Category
            </Button>
          </div>
        </form>
      </Modal>

      {/* ACCRUE BALANCE MODAL (POST /leave/balances/accrue) */}
      <Modal isOpen={accrueModalOpen} onClose={() => setAccrueModalOpen(false)} title="Accrue / Initialize Leave Balance">
        <form onSubmit={handleAccrueSubmit}>
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Employee *</label>
              <select
                className="form-control"
                value={accrueForm.employeeId}
                onChange={(e) => setAccrueForm({ ...accrueForm, employeeId: e.target.value })}
                required
              >
                {employees.map((emp) => (
                  <option key={emp._id || emp.id} value={emp._id || emp.id}>
                    {formatEmployeeOption(emp, true)}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Leave Type *</label>
              <select
                className="form-control"
                value={accrueForm.leaveType}
                onChange={(e) => setAccrueForm({ ...accrueForm, leaveType: e.target.value })}
                required
              >
                {leaveTypes.map((t) => (
                  <option key={t._id} value={t._id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid-3" style={{ marginTop: 12 }}>
            <Input
              label="Calendar Year"
              type="number"
              value={accrueForm.year}
              onChange={(e) => setAccrueForm({ ...accrueForm, year: Number(e.target.value) })}
              required
            />
            <Input
              label="Entitled Days"
              type="number"
              value={accrueForm.entitledDays}
              onChange={(e) => setAccrueForm({ ...accrueForm, entitledDays: Number(e.target.value) })}
              required
            />
            <Input
              label="Carried Forward Days"
              type="number"
              value={accrueForm.carriedForwardDays}
              onChange={(e) => setAccrueForm({ ...accrueForm, carriedForwardDays: Number(e.target.value) })}
            />
          </div>

          <div className="modal-footer" style={{ margin: '18px -20px -20px' }}>
            <Button variant="secondary" onClick={() => setAccrueModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" loading={submittingAccrue} style={{ background: '#059669', borderColor: '#059669' }}>
              Confirm Accrual
            </Button>
          </div>
        </form>
      </Modal>

      {/* CREATE HOLIDAY MODAL (POST /holidays) */}
      <Modal isOpen={holidayModalOpen} onClose={() => setHolidayModalOpen(false)} title="Add Organization Holiday">
        <form onSubmit={handleCreateHoliday}>
          <div className="grid-2">
            <Input
              label="Holiday Name *"
              value={holidayForm.name}
              onChange={(e) => setHolidayForm({ ...holidayForm, name: e.target.value })}
              placeholder="e.g. Independence Day"
              required
            />
            <Input
              label="Date *"
              type="date"
              value={holidayForm.date}
              onChange={(e) => setHolidayForm({ ...holidayForm, date: e.target.value })}
              required
            />
          </div>

          <div className="grid-2" style={{ marginTop: 12 }}>
            <div className="form-group">
              <label className="form-label">Holiday Classification</label>
              <select
                className="form-control"
                value={holidayForm.type}
                onChange={(e) => setHolidayForm({ ...holidayForm, type: e.target.value })}
              >
                <option value="NATIONAL">NATIONAL</option>
                <option value="FESTIVAL">FESTIVAL</option>
                <option value="COMPANY_SPECIFIC">COMPANY_SPECIFIC</option>
                <option value="OPTIONAL">OPTIONAL</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Scope Company</label>
              <select
                className="form-control"
                value={holidayForm.reference}
                onChange={(e) => setHolidayForm({ ...holidayForm, reference: e.target.value })}
              >
                {companies.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="modal-footer" style={{ margin: '18px -20px -20px' }}>
            <Button variant="secondary" onClick={() => setHolidayModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" loading={submittingHoliday}>
              Save Holiday
            </Button>
          </div>
        </form>
      </Modal>

      {/* COPY HOLIDAYS MODAL (POST /holidays/copy-from-year) */}
      <Modal isOpen={copyHolidaysModalOpen} onClose={() => setCopyHolidaysModalOpen(false)} title="Duplicate Holidays from Previous Year">
        <form onSubmit={handleCopyHolidays}>
          <p style={{ margin: '0 0 12px', fontSize: '0.86rem', color: 'var(--text-muted)' }}>
            Clones recurring national and festival holidays from a base year into the target calendar year.
          </p>
          <div className="grid-2">
            <Input
              label="Source Year *"
              type="number"
              value={copyForm.fromYear}
              onChange={(e) => setCopyForm({ ...copyForm, fromYear: Number(e.target.value) })}
              required
            />
            <Input
              label="Target Year *"
              type="number"
              value={copyForm.toYear}
              onChange={(e) => setCopyForm({ ...copyForm, toYear: Number(e.target.value) })}
              required
            />
          </div>
          <div className="modal-footer" style={{ margin: '18px -20px -20px' }}>
            <Button variant="secondary" onClick={() => setCopyHolidaysModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" loading={submittingCopy}>
              Clone Calendar
            </Button>
          </div>
        </form>
      </Modal>

      {/* WEEKLY-OFF MODAL (POST /weekly-off-configs) */}
      <Modal isOpen={weeklyOffModalOpen} onClose={() => setWeeklyOffModalOpen(false)} title="Configure Weekly-Off Schedule">
        <form onSubmit={handleWeeklyOffSubmit}>
          <div className="form-group">
            <label className="form-label">Scope Company</label>
            <select
              className="form-control"
              value={weeklyOffForm.reference}
              onChange={(e) => setWeeklyOffForm({ ...weeklyOffForm, reference: e.target.value })}
            >
              {companies.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group" style={{ marginTop: 12 }}>
            <label className="form-label">Select Weekly Rest Days</label>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 6 }}>
              {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((day, idx) => {
                const isSelected = weeklyOffForm.offDays.includes(idx);
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => {
                      if (isSelected) {
                        setWeeklyOffForm((prev) => ({ ...prev, offDays: prev.offDays.filter((d) => d !== idx) }));
                      } else {
                        setWeeklyOffForm((prev) => ({ ...prev, offDays: [...prev.offDays, idx] }));
                      }
                    }}
                    style={{
                      padding: '6px 12px',
                      borderRadius: 'var(--radius-sm)',
                      border: isSelected ? '1px solid var(--primary)' : '1px solid var(--border-color)',
                      background: isSelected ? 'var(--primary)' : '#ffffff',
                      color: isSelected ? '#ffffff' : 'var(--text-main)',
                      fontSize: '0.84rem',
                      cursor: 'pointer',
                    }}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="modal-footer" style={{ margin: '18px -20px -20px' }}>
            <Button variant="secondary" onClick={() => setWeeklyOffModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" loading={submittingWeeklyOff}>
              Save Schedule
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default LeavesHolidays;
