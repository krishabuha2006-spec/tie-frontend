import React, { useState, useEffect, useCallback, useMemo } from 'react';
import leaveHolidayApi from '../../api/leaveHolidayApi';
import employeeApi from '../../api/employeeApi';
import masterApi from '../../api/masterApi';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import {
  Calendar, Clock, CheckCircle2, AlertCircle, Plus, RefreshCw,
  Trash2, Search, Check, X, ShieldCheck, Settings, CalendarOff,
  User, Layers, FileText, Ban
} from 'lucide-react';
import Modal from '../../components/common/Modal';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import { extractApiData } from '../../utils/apiUtils';

export const LeavesHolidays = () => {
  const { user, isSuperAdmin, isHrAdmin, isDirector, isBranchManager } = useAuth();
  const isManagerOrAdmin = isSuperAdmin || isHrAdmin || isDirector || isBranchManager;
  const { showToast } = useToast();

  // Active Tab: 'my_leaves' | 'approvals' | 'balances' | 'leave_types' | 'holidays'
  const [activeTab, setActiveTab] = useState(isManagerOrAdmin ? 'approvals' : 'my_leaves');

  // Master Data
  const [employees, setEmployees] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [loadingMasters, setLoadingMasters] = useState(false);

  // 1. My Leaves State
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

  // 2. Pending Approvals State (HR / Managers)
  const [pendingRequests, setPendingRequests] = useState([]);
  const [loadingPending, setLoadingPending] = useState(false);
  const [actingRequestId, setActingRequestId] = useState(null);

  // 3. Balances & Accrual State
  const [selectedBalanceEmpId, setSelectedBalanceEmpId] = useState('');
  const [employeeBalances, setEmployeeBalances] = useState([]);
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

  // 4. Leave Types Configuration State
  const [loadingTypes, setLoadingTypes] = useState(false);
  const [typeModalOpen, setTypeModalOpen] = useState(false);
  const [submittingType, setSubmittingType] = useState(false);
  const [newTypeForm, setNewTypeForm] = useState({
    name: '',
    code: '',
    annualEntitlement: 12,
    isPaid: true,
    carryForwardAllowed: false,
    maxCarryForwardDays: 0,
    company: '',
  });

  // 5. Holidays State
  const [holidays, setHolidays] = useState([]);
  const [loadingHolidays, setLoadingHolidays] = useState(false);
  const [holidayModalOpen, setHolidayModalOpen] = useState(false);
  const [submittingHoliday, setSubmittingHoliday] = useState(false);
  const [holidayForm, setHolidayForm] = useState({
    name: '',
    date: new Date().toISOString().split('T')[0],
    type: 'FESTIVAL',
    scope: 'COMPANY',
    isOptional: false,
  });

  // Safe list extractor
  const toList = (res, ...keys) => extractApiData(res, ...keys, 'leaveRequests', 'pendingRequests', 'leaveTypes', 'holidays', 'balances', 'data');

  // Load Masters (Employees, Companies, Leave Types)
  const loadMasters = useCallback(async () => {
    setLoadingMasters(true);
    try {
      const [eRes, cRes, ltRes] = await Promise.allSettled([
        employeeApi.getEmployees({ limit: 150 }),
        masterApi.getCompanies(),
        leaveHolidayApi.getLeaveTypes(),
      ]);

      const empList = eRes.status === 'fulfilled' ? toList(eRes.value, 'employees') : [];
      const compList = cRes.status === 'fulfilled' ? toList(cRes.value, 'companies') : [];
      const typeList = ltRes.status === 'fulfilled' ? toList(ltRes.value, 'leaveTypes') : [];

      setEmployees(empList);
      setCompanies(compList);
      setLeaveTypes(typeList);

      if (empList.length > 0 && !selectedBalanceEmpId) {
        const myEmpId = user?.employee?._id || user?.employee || empList[0]._id;
        setSelectedBalanceEmpId(myEmpId);
        setAccrueForm((prev) => ({ ...prev, employeeId: myEmpId }));
      }

      if (typeList.length > 0) {
        setLeaveForm((prev) => ({ ...prev, leaveType: prev.leaveType || typeList[0]._id }));
        setAccrueForm((prev) => ({ ...prev, leaveType: prev.leaveType || typeList[0]._id }));
      }
    } catch (err) {
      console.error('Error loading masters:', err);
    } finally {
      setLoadingMasters(false);
    }
  }, [user, selectedBalanceEmpId]);

  // 1. Load My Leaves (GET /leave/requests/me)
  const loadMyLeaves = useCallback(async () => {
    setLoadingMyRequests(true);
    try {
      const res = await leaveHolidayApi.getMyLeaveRequests();
      setMyRequests(toList(res, 'leaveRequests', 'requests'));
    } catch (err) {
      console.error('Error loading my leaves:', err);
      setMyRequests([]);
    } finally {
      setLoadingMyRequests(false);
    }
  }, []);

  // 2. Load Pending Approvals (GET /leave/requests/pending-approval)
  const loadPending = useCallback(async () => {
    setLoadingPending(true);
    try {
      const res = await leaveHolidayApi.getPendingLeaveApprovals();
      setPendingRequests(toList(res, 'pendingRequests', 'requests'));
    } catch (err) {
      console.error('Error loading pending leaves:', err);
      setPendingRequests([]);
    } finally {
      setLoadingPending(false);
    }
  }, []);

  // 3. Load Employee Leave Balance (GET /leave/employees/:id/balance)
  const loadBalance = useCallback(async (empId) => {
    if (!empId) return;
    setLoadingBalance(true);
    try {
      const res = await leaveHolidayApi.getEmployeeLeaveBalance(empId);
      const bList = res?.balances || res?.data?.balances || (Array.isArray(res?.data) ? res.data : []);
      setEmployeeBalances(bList);
    } catch (err) {
      console.error('Error loading leave balance:', err);
      setEmployeeBalances([]);
    } finally {
      setLoadingBalance(false);
    }
  }, []);

  // 4. Load Leave Types (GET /leave-types)
  const loadLeaveTypes = useCallback(async () => {
    setLoadingTypes(true);
    try {
      const res = await leaveHolidayApi.getLeaveTypes();
      const list = toList(res, 'leaveTypes');
      setLeaveTypes(list);
      if (list.length > 0 && !leaveForm.leaveType) {
        setLeaveForm((prev) => ({ ...prev, leaveType: list[0]._id }));
        setAccrueForm((prev) => ({ ...prev, leaveType: list[0]._id }));
      }
    } catch (err) {
      console.error('Error loading leave types:', err);
      setLeaveTypes([]);
    } finally {
      setLoadingTypes(false);
    }
  }, [leaveForm.leaveType]);

  // 5. Load Holidays (GET /holidays)
  const loadHolidays = useCallback(async () => {
    setLoadingHolidays(true);
    try {
      const res = await leaveHolidayApi.getHolidays();
      setHolidays(toList(res, 'holidays'));
    } catch (err) {
      console.error('Error loading holidays:', err);
      setHolidays([]);
    } finally {
      setLoadingHolidays(false);
    }
  }, []);

  // Initial mount
  useEffect(() => {
    loadMasters();
  }, [loadMasters]);

  // Tab switch effect
  useEffect(() => {
    if (activeTab === 'my_leaves') loadMyLeaves();
    else if (activeTab === 'approvals') loadPending();
    else if (activeTab === 'balances') {
      const targetEmp = selectedBalanceEmpId || user?.employee?._id || user?.employee;
      if (targetEmp) loadBalance(targetEmp);
    } else if (activeTab === 'leave_types') loadLeaveTypes();
    else if (activeTab === 'holidays') loadHolidays();
  }, [activeTab, selectedBalanceEmpId, loadMyLeaves, loadPending, loadBalance, loadLeaveTypes, loadHolidays, user]);

  // Apply for Leave (POST /leave/requests)
  const handleApplyLeave = async (e) => {
    e.preventDefault();
    if (!leaveForm.leaveType) {
      showToast('Please select a leave category', 'warning');
      return;
    }
    if (!leaveForm.fromDate || !leaveForm.toDate) {
      showToast('From date and To date are required', 'warning');
      return;
    }
    if (new Date(leaveForm.toDate) < new Date(leaveForm.fromDate)) {
      showToast('To Date cannot be before From Date', 'warning');
      return;
    }
    if (!leaveForm.reason.trim()) {
      showToast('Reason is required', 'warning');
      return;
    }

    setSubmittingApply(true);
    try {
      await leaveHolidayApi.applyLeave({
        leaveType: leaveForm.leaveType,
        fromDate: leaveForm.fromDate,
        toDate: leaveForm.toDate,
        reason: leaveForm.reason.trim(),
      });

      showToast('✓ Leave request submitted and routed for approval!', 'success');
      setApplyModalOpen(false);
      setLeaveForm((prev) => ({
        ...prev,
        reason: '',
      }));
      await loadMyLeaves();
      if (isManagerOrAdmin) await loadPending();
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to submit leave request';
      showToast(msg, 'error');
    } finally {
      setSubmittingApply(false);
    }
  };

  // Approve Leave (PUT /leave/requests/:id/approve)
  const handleApproveLeave = async (id) => {
    setActingRequestId(id);
    try {
      await leaveHolidayApi.approveLeave(id, { remarks: 'Approved by Manager' });
      showToast('✓ Leave request approved!', 'success');
      await loadPending();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to approve leave', 'error');
    } finally {
      setActingRequestId(null);
    }
  };

  // Reject Leave (PUT /leave/requests/:id/reject)
  const handleRejectLeave = async (id) => {
    const reason = window.prompt('Please provide a reason for rejecting this leave request:');
    if (reason === null) return;

    setActingRequestId(id);
    try {
      await leaveHolidayApi.rejectLeave(id, { reason: reason || 'Rejected by Manager' });
      showToast('Leave request rejected', 'info');
      await loadPending();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to reject leave', 'error');
    } finally {
      setActingRequestId(null);
    }
  };

  // Cancel Own Leave (PUT /leave/requests/:id/cancel)
  const handleCancelLeave = async (id) => {
    if (!window.confirm('Are you sure you want to withdraw this pending leave application?')) return;
    try {
      await leaveHolidayApi.cancelLeave(id);
      showToast('✓ Leave request withdrawn', 'info');
      await loadMyLeaves();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to cancel leave', 'error');
    }
  };

  // Accrue Balance (POST /leave/balances/accrue)
  const handleAccrueBalance = async (e) => {
    e.preventDefault();
    if (!accrueForm.employeeId || !accrueForm.leaveType) {
      showToast('Employee and Leave Category are required', 'warning');
      return;
    }

    setSubmittingAccrue(true);
    try {
      await leaveHolidayApi.accrueLeaveBalance({
        employeeId: accrueForm.employeeId,
        leaveType: accrueForm.leaveType,
        year: Number(accrueForm.year),
        entitledDays: Number(accrueForm.entitledDays),
        carriedForwardDays: Number(accrueForm.carriedForwardDays || 0),
      });

      showToast('✓ Leave balance allocated successfully!', 'success');
      setAccrueModalOpen(false);
      await loadBalance(accrueForm.employeeId);
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to allocate balance', 'error');
    } finally {
      setSubmittingAccrue(false);
    }
  };

  // Create Leave Type (POST /leave-types)
  const handleCreateLeaveType = async (e) => {
    e.preventDefault();
    if (!newTypeForm.name.trim() || !newTypeForm.code.trim()) {
      showToast('Category name and code are required', 'warning');
      return;
    }

    setSubmittingType(true);
    try {
      await leaveHolidayApi.createLeaveType({
        name: newTypeForm.name.trim(),
        code: newTypeForm.code.trim().toUpperCase(),
        annualEntitlement: Number(newTypeForm.annualEntitlement) || 12,
        isPaid: Boolean(newTypeForm.isPaid),
        carryForwardAllowed: Boolean(newTypeForm.carryForwardAllowed),
        maxCarryForwardDays: Number(newTypeForm.maxCarryForwardDays || 0),
        company: newTypeForm.company || companies[0]?._id || undefined,
      });

      showToast('✓ Leave Type created successfully!', 'success');
      setTypeModalOpen(false);
      setNewTypeForm({
        name: '',
        code: '',
        annualEntitlement: 12,
        isPaid: true,
        carryForwardAllowed: false,
        maxCarryForwardDays: 0,
        company: '',
      });
      await loadLeaveTypes();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to create leave type', 'error');
    } finally {
      setSubmittingType(false);
    }
  };

  // Initialize Default Standard Leave Categories
  const handleInitDefaultCategories = async () => {
    setSubmittingType(true);
    try {
      const standard = [
        { name: 'Casual Leave', code: 'CL', annualEntitlement: 12, isPaid: true, carryForwardAllowed: false },
        { name: 'Sick Leave', code: 'SL', annualEntitlement: 10, isPaid: true, carryForwardAllowed: false },
        { name: 'Paid Privilege Leave', code: 'PL', annualEntitlement: 18, isPaid: true, carryForwardAllowed: true, maxCarryForwardDays: 9 },
      ];

      for (const cat of standard) {
        await leaveHolidayApi.createLeaveType(cat).catch(() => {});
      }

      showToast('✓ Standard leave categories initialized on backend!', 'success');
      await loadLeaveTypes();
    } catch (err) {
      showToast('Error initializing categories', 'error');
    } finally {
      setSubmittingType(false);
    }
  };

  // Create Holiday (POST /holidays)
  const handleCreateHoliday = async (e) => {
    e.preventDefault();
    if (!holidayForm.name.trim() || !holidayForm.date) {
      showToast('Holiday name and date are required', 'warning');
      return;
    }

    setSubmittingHoliday(true);
    try {
      await leaveHolidayApi.createHoliday({
        name: holidayForm.name.trim(),
        date: holidayForm.date,
        type: holidayForm.type,
        scope: holidayForm.scope,
        isOptional: Boolean(holidayForm.isOptional),
      });

      showToast('✓ Holiday added to company calendar!', 'success');
      setHolidayModalOpen(false);
      setHolidayForm({
        name: '',
        date: new Date().toISOString().split('T')[0],
        type: 'FESTIVAL',
        scope: 'COMPANY',
        isOptional: false,
      });
      await loadHolidays();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to add holiday', 'error');
    } finally {
      setSubmittingHoliday(false);
    }
  };

  // Delete Holiday (DELETE /holidays/:id)
  const handleDeleteHoliday = async (id) => {
    if (!window.confirm('Are you sure you want to remove this holiday?')) return;
    try {
      await leaveHolidayApi.deleteHoliday(id);
      showToast('✓ Holiday removed', 'info');
      await loadHolidays();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to delete holiday', 'error');
    }
  };

  // Calculate total entitled and remaining from live balance cards
  const totalEntitledSum = employeeBalances.reduce((acc, b) => acc + (b.entitledDays || 0), 0);
  const totalRemainingSum = employeeBalances.reduce((acc, b) => acc + (b.remainingDays != null ? b.remainingDays : (b.entitledDays - (b.usedDays || 0))), 0);
  const totalUsedSum = employeeBalances.reduce((acc, b) => acc + (b.usedDays || 0), 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, fontFamily: 'Inter, system-ui, sans-serif' }}>

      {/* 1. Header Card */}
      <div style={{
        background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0',
        padding: '16px 20px', display: 'flex', justifyContent: 'space-between',
        alignItems: 'center', flexWrap: 'wrap', gap: 14
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            background: 'linear-gradient(135deg, var(--primary) 0%, #1e565d 100%)',
            color: '#fff', padding: 10, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <CalendarOff size={24} />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#0f172a' }}>
              Leave &amp; Holiday Management
            </h2>
            <p style={{ margin: '3px 0 0', fontSize: '0.8rem', color: '#64748b' }}>
              Live annual leave balances, application approvals &amp; organization calendar
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <Button
            variant="secondary"
            icon={RefreshCw}
            onClick={() => {
              if (activeTab === 'my_leaves') loadMyLeaves();
              else if (activeTab === 'approvals') loadPending();
              else if (activeTab === 'balances') loadBalance(selectedBalanceEmpId);
              else if (activeTab === 'leave_types') loadLeaveTypes();
              else loadHolidays();
            }}
          >
            Refresh
          </Button>

          <Button
            variant="primary"
            icon={Plus}
            onClick={() => setApplyModalOpen(true)}
          >
            Apply for Leave
          </Button>

          {isManagerOrAdmin && activeTab === 'leave_types' && (
            <Button
              variant="secondary"
              icon={Plus}
              onClick={() => setTypeModalOpen(true)}
            >
              Add Category
            </Button>
          )}

          {isManagerOrAdmin && activeTab === 'holidays' && (
            <Button
              variant="secondary"
              icon={Plus}
              onClick={() => setHolidayModalOpen(true)}
            >
              Add Holiday
            </Button>
          )}
        </div>
      </div>

      {/* 2. KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
        <div style={{ background: '#fff', padding: '14px 18px', borderRadius: 10, border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ background: '#16a34a15', color: '#16a34a', padding: 10, borderRadius: 8 }}>
            <Calendar size={20} />
          </div>
          <div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a' }}>
              {myRequests.length} Applications
            </div>
            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>My Total Leave Requests</div>
          </div>
        </div>

        <div style={{ background: '#fff', padding: '14px 18px', borderRadius: 10, border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ background: '#d9770615', color: '#d97706', padding: 10, borderRadius: 8 }}>
            <Clock size={20} />
          </div>
          <div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#d97706' }}>
              {pendingRequests.length} Pending
            </div>
            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Awaiting Manager Review</div>
          </div>
        </div>

        <div style={{ background: '#fff', padding: '14px 18px', borderRadius: 10, border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ background: '#0284c715', color: '#0284c7', padding: 10, borderRadius: 8 }}>
            <ShieldCheck size={20} />
          </div>
          <div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a' }}>
              {totalRemainingSum} Days
            </div>
            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Available Balance ({employeeBalances.length} Categories)</div>
          </div>
        </div>

        <div style={{ background: '#fff', padding: '14px 18px', borderRadius: 10, border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ background: '#8b5cf615', color: '#8b5cf6', padding: 10, borderRadius: 8 }}>
            <Settings size={20} />
          </div>
          <div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a' }}>
              {leaveTypes.length} Categories
            </div>
            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Configured Leave Types</div>
          </div>
        </div>
      </div>

      {/* 3. Navigation Tabs */}
      <div style={{
        display: 'flex', gap: 6, background: '#fff', padding: '6px',
        borderRadius: 10, border: '1px solid #e2e8f0', width: 'fit-content'
      }}>
        {isManagerOrAdmin && (
          <button
            onClick={() => setActiveTab('approvals')}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '7px 16px',
              borderRadius: 7, border: 'none', fontSize: '0.84rem', fontWeight: 600,
              cursor: 'pointer', transition: 'all 0.15s',
              background: activeTab === 'approvals' ? 'var(--primary)' : 'transparent',
              color: activeTab === 'approvals' ? '#fff' : '#64748b',
            }}
          >
            <Clock size={15} /> Pending Approvals ({pendingRequests.length})
          </button>
        )}

        <button
          onClick={() => setActiveTab('my_leaves')}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '7px 16px',
            borderRadius: 7, border: 'none', fontSize: '0.84rem', fontWeight: 600,
            cursor: 'pointer', transition: 'all 0.15s',
            background: activeTab === 'my_leaves' ? 'var(--primary)' : 'transparent',
            color: activeTab === 'my_leaves' ? '#fff' : '#64748b',
          }}
        >
          <Calendar size={15} /> My Leaves ({myRequests.length})
        </button>

        <button
          onClick={() => setActiveTab('balances')}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '7px 16px',
            borderRadius: 7, border: 'none', fontSize: '0.84rem', fontWeight: 600,
            cursor: 'pointer', transition: 'all 0.15s',
            background: activeTab === 'balances' ? 'var(--primary)' : 'transparent',
            color: activeTab === 'balances' ? '#fff' : '#64748b',
          }}
        >
          <ShieldCheck size={15} /> Balances &amp; Accrual
        </button>

        <button
          onClick={() => setActiveTab('leave_types')}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '7px 16px',
            borderRadius: 7, border: 'none', fontSize: '0.84rem', fontWeight: 600,
            cursor: 'pointer', transition: 'all 0.15s',
            background: activeTab === 'leave_types' ? 'var(--primary)' : 'transparent',
            color: activeTab === 'leave_types' ? '#fff' : '#64748b',
          }}
        >
          <Settings size={15} /> Leave Types ({leaveTypes.length})
        </button>

        <button
          onClick={() => setActiveTab('holidays')}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '7px 16px',
            borderRadius: 7, border: 'none', fontSize: '0.84rem', fontWeight: 600,
            cursor: 'pointer', transition: 'all 0.15s',
            background: activeTab === 'holidays' ? 'var(--primary)' : 'transparent',
            color: activeTab === 'holidays' ? '#fff' : '#64748b',
          }}
        >
          <CalendarOff size={15} /> Holiday Calendar ({holidays.length})
        </button>
      </div>

      {/* ================================================================== */}
      {/* TAB 1: PENDING APPROVALS (HR / MANAGERS) */}
      {/* ================================================================== */}
      {activeTab === 'approvals' && (
        <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          <div style={{ padding: '12px 18px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#0f172a' }}>
              Pending Leave Applications for Approval
            </h3>
            <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
              {pendingRequests.length} Requests Awaiting Review
            </span>
          </div>

          {loadingPending ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>
              <Clock size={24} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 8px' }} />
              <div>Loading pending applications...</div>
            </div>
          ) : pendingRequests.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>
              <CheckCircle2 size={32} color="#16a34a" style={{ margin: '0 auto 8px' }} />
              <div style={{ fontWeight: 600 }}>No pending leave applications</div>
              <div style={{ fontSize: '0.8rem', marginTop: 4 }}>
                All submitted leave requests have been reviewed.
              </div>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#64748b', textAlign: 'left' }}>
                    <th style={{ padding: '10px 16px' }}>Staff Member</th>
                    <th style={{ padding: '10px 16px' }}>Category</th>
                    <th style={{ padding: '10px 16px' }}>Leave Period</th>
                    <th style={{ padding: '10px 16px' }}>Days</th>
                    <th style={{ padding: '10px 16px' }}>Reason</th>
                    <th style={{ padding: '10px 16px' }}>Applied Date</th>
                    <th style={{ padding: '10px 16px', textAlign: 'right' }}>Decision</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingRequests.map((req) => {
                    const empName = req.employee?.basicInfo?.fullName || req.employee?.name || 'Staff Member';
                    const empCode = req.employee?.basicInfo?.employeeCode || req.employee?.employeeCode || 'EMP';
                    const fromStr = req.fromDate ? new Date(req.fromDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—';
                    const toStr = req.toDate ? new Date(req.toDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
                    const days = req.numberOfDays ?? req.totalDays ?? 1;

                    return (
                      <tr key={req._id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ fontWeight: 600, color: '#0f172a' }}>{empName}</div>
                          <div style={{ fontSize: '0.72rem', color: '#64748b' }}>{empCode}</div>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <Badge variant="primary">{req.leaveType?.name || 'Leave'}</Badge>
                        </td>
                        <td style={{ padding: '12px 16px', fontWeight: 600 }}>
                          {fromStr} &ndash; {toStr}
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{ fontWeight: 700, color: '#0284c7' }}>{days} Day(s)</span>
                        </td>
                        <td style={{ padding: '12px 16px', maxWidth: 220 }}>
                          <div style={{ fontSize: '0.78rem', color: '#334155' }}>{req.reason}</div>
                        </td>
                        <td style={{ padding: '12px 16px', color: '#64748b' }}>
                          {req.createdAt ? new Date(req.createdAt).toLocaleDateString('en-IN') : 'Today'}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                            <Button
                              variant="primary"
                              size="sm"
                              icon={Check}
                              loading={actingRequestId === req._id}
                              onClick={() => handleApproveLeave(req._id)}
                            >
                              Approve
                            </Button>
                            <Button
                              variant="danger"
                              size="sm"
                              icon={X}
                              loading={actingRequestId === req._id}
                              onClick={() => handleRejectLeave(req._id)}
                            >
                              Reject
                            </Button>
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

      {/* ================================================================== */}
      {/* TAB 2: MY LEAVES */}
      {/* ================================================================== */}
      {activeTab === 'my_leaves' && (
        <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#0f172a' }}>
                My Leave Application History
              </h3>
              <p style={{ margin: '2px 0 0', fontSize: '0.76rem', color: '#64748b' }}>
                Track your active, approved, and past leave submissions
              </p>
            </div>
            <Button variant="primary" size="sm" icon={Plus} onClick={() => setApplyModalOpen(true)}>
              Apply for Leave
            </Button>
          </div>

          {loadingMyRequests ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>
              <Clock size={24} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 8px' }} />
              <div>Loading your leave applications...</div>
            </div>
          ) : myRequests.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>
              <Calendar size={32} color="#94a3b8" style={{ margin: '0 auto 8px' }} />
              <div style={{ fontWeight: 600 }}>No leave applications filed yet</div>
              <div style={{ fontSize: '0.8rem', marginTop: 4 }}>
                Click &ldquo;Apply for Leave&rdquo; above to submit a planned absence.
              </div>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#64748b', textAlign: 'left' }}>
                    <th style={{ padding: '10px 16px' }}>Category</th>
                    <th style={{ padding: '10px 16px' }}>From Date</th>
                    <th style={{ padding: '10px 16px' }}>To Date</th>
                    <th style={{ padding: '10px 16px' }}>Duration</th>
                    <th style={{ padding: '10px 16px' }}>Reason</th>
                    <th style={{ padding: '10px 16px' }}>Status</th>
                    <th style={{ padding: '10px 16px', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {myRequests.map((req) => {
                    const fromStr = req.fromDate ? new Date(req.fromDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
                    const toStr = req.toDate ? new Date(req.toDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
                    const days = req.numberOfDays ?? req.totalDays ?? 1;
                    const st = req.status || 'PENDING';

                    return (
                      <tr key={req._id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '12px 16px' }}>
                          <Badge variant="primary">{req.leaveType?.name || 'Leave Category'}</Badge>
                        </td>
                        <td style={{ padding: '12px 16px', fontWeight: 600 }}>{fromStr}</td>
                        <td style={{ padding: '12px 16px', fontWeight: 600 }}>{toStr}</td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{ fontWeight: 700, color: '#0284c7' }}>{days} Day(s)</span>
                        </td>
                        <td style={{ padding: '12px 16px', maxWidth: 220 }}>
                          <div style={{ fontSize: '0.78rem', color: '#334155' }}>{req.reason}</div>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <Badge variant={st === 'APPROVED' ? 'success' : st === 'REJECTED' ? 'danger' : st === 'CANCELLED' ? 'secondary' : 'warning'}>
                            {st}
                          </Badge>
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                          {st === 'PENDING' && (
                            <Button
                              variant="secondary"
                              size="sm"
                              icon={Ban}
                              onClick={() => handleCancelLeave(req._id)}
                              style={{ color: '#dc2626' }}
                            >
                              Withdraw
                            </Button>
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
      {/* TAB 3: BALANCES & ACCRUAL */}
      {/* ================================================================== */}
      {activeTab === 'balances' && (
        <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0', padding: 18, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, maxWidth: 440 }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b' }}>Staff Member:</span>
              <select
                value={selectedBalanceEmpId}
                onChange={(e) => {
                  setSelectedBalanceEmpId(e.target.value);
                  loadBalance(e.target.value);
                }}
                style={{ padding: '7px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.82rem', flex: 1 }}
              >
                {employees.map((emp) => {
                  const name = emp.basicInfo?.fullName || emp.name || 'Staff Member';
                  const code = emp.basicInfo?.employeeCode || emp.employeeCode || '';
                  return (
                    <option key={emp._id} value={emp._id}>{name} ({code})</option>
                  );
                })}
              </select>
            </div>

            {isManagerOrAdmin && (
              <Button variant="primary" size="sm" icon={Plus} onClick={() => setAccrueModalOpen(true)}>
                Accrue / Credit Leave Balance
              </Button>
            )}
          </div>

          {loadingBalance ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>
              <Clock size={24} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 8px' }} />
              <div>Loading leave balances from backend...</div>
            </div>
          ) : employeeBalances.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#64748b', background: '#f8fafc', borderRadius: 8, border: '1px dashed #cbd5e1' }}>
              <ShieldCheck size={32} color="#94a3b8" style={{ margin: '0 auto 8px' }} />
              <div style={{ fontWeight: 600 }}>No leave balance records found for {new Date().getFullYear()}</div>
              <div style={{ fontSize: '0.8rem', marginTop: 4 }}>
                {isManagerOrAdmin ? 'Click "Accrue / Credit Leave Balance" above to initialize annual leave days for this employee.' : 'Contact HR Administration to credit your annual leave package.'}
              </div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
              {employeeBalances.map((b) => {
                const typeName = b.leaveType?.name || 'Leave Category';
                const typeCode = b.leaveType?.code || 'LV';
                const entitled = b.entitledDays || 0;
                const used = b.usedDays || 0;
                const remaining = b.remainingDays != null ? b.remainingDays : (entitled - used);
                const carried = b.carriedForwardDays || 0;

                return (
                  <div key={b._id} style={{
                    background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0',
                    padding: 16, display: 'flex', flexDirection: 'column', gap: 10
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#0f172a' }}>{typeName}</span>
                      <Badge variant="primary">{typeCode}</Badge>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 4 }}>
                      <div>
                        <div style={{ fontSize: '0.72rem', color: '#64748b' }}>TOTAL ENTITLED</div>
                        <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a' }}>{entitled}d</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.72rem', color: '#dc2626' }}>DAYS CONSUMED</div>
                        <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#dc2626' }}>{used}d</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.72rem', color: '#16a34a' }}>AVAILABLE</div>
                        <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#16a34a' }}>{remaining}d</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.72rem', color: '#d97706' }}>CARRIED FORWARD</div>
                        <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#d97706' }}>{carried}d</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ================================================================== */}
      {/* TAB 4: LEAVE TYPES CONFIGURATION */}
      {/* ================================================================== */}
      {activeTab === 'leave_types' && (
        <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#0f172a' }}>
                Configured Organization Leave Categories
              </h3>
              <p style={{ margin: '2px 0 0', fontSize: '0.76rem', color: '#64748b' }}>
                Defines annual entitlement quotas, paid status, and rollover guidelines
              </p>
            </div>
            {isManagerOrAdmin && (
              <div style={{ display: 'flex', gap: 8 }}>
                {leaveTypes.length === 0 && (
                  <Button variant="secondary" size="sm" loading={submittingType} onClick={handleInitDefaultCategories}>
                    Initialize Standard Categories
                  </Button>
                )}
                <Button variant="primary" size="sm" icon={Plus} onClick={() => setTypeModalOpen(true)}>
                  New Category
                </Button>
              </div>
            )}
          </div>

          {loadingTypes ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>
              <Clock size={24} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 8px' }} />
              <div>Loading configured leave types...</div>
            </div>
          ) : leaveTypes.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>
              <AlertCircle size={32} color="#94a3b8" style={{ margin: '0 auto 8px' }} />
              <div style={{ fontWeight: 600 }}>No leave categories configured in database</div>
              <div style={{ fontSize: '0.8rem', marginTop: 4 }}>
                Click &ldquo;Initialize Standard Categories&rdquo; to populate Casual, Sick, and Paid leave categories.
              </div>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#64748b', textAlign: 'left' }}>
                    <th style={{ padding: '10px 16px' }}>Category Name</th>
                    <th style={{ padding: '10px 16px' }}>Code</th>
                    <th style={{ padding: '10px 16px' }}>Annual Quota</th>
                    <th style={{ padding: '10px 16px' }}>Paid / Unpaid</th>
                    <th style={{ padding: '10px 16px' }}>Carry-Forward</th>
                    <th style={{ padding: '10px 16px' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {leaveTypes.map((t) => (
                    <tr key={t._id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '12px 16px', fontWeight: 600, color: '#0f172a' }}>{t.name}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ fontFamily: 'monospace', fontWeight: 700, background: '#f1f5f9', padding: '2px 6px', borderRadius: 4 }}>
                          {t.code}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--primary)' }}>
                        {t.annualEntitlement || 12} Days / Year
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <Badge variant={t.isPaid ? 'success' : 'secondary'}>
                          {t.isPaid ? 'PAID LEAVE' : 'UNPAID / LWP'}
                        </Badge>
                      </td>
                      <td style={{ padding: '12px 16px', color: '#475569' }}>
                        {t.carryForwardAllowed ? `Allowed (Max ${t.maxCarryForwardDays || 0}d)` : 'Not Allowed'}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <Badge variant="success">ACTIVE</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ================================================================== */}
      {/* TAB 5: HOLIDAY CALENDAR */}
      {/* ================================================================== */}
      {activeTab === 'holidays' && (
        <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#0f172a' }}>
                Corporate Holiday Calendar
              </h3>
              <p style={{ margin: '2px 0 0', fontSize: '0.76rem', color: '#64748b' }}>
                Mandatory gazetted and optional company holidays automatically excluded from work shortfall
              </p>
            </div>
            {isManagerOrAdmin && (
              <Button variant="primary" size="sm" icon={Plus} onClick={() => setHolidayModalOpen(true)}>
                Add Holiday
              </Button>
            )}
          </div>

          {loadingHolidays ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>
              <Clock size={24} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 8px' }} />
              <div>Loading holiday calendar...</div>
            </div>
          ) : holidays.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>
              <CalendarOff size={32} color="#94a3b8" style={{ margin: '0 auto 8px' }} />
              <div style={{ fontWeight: 600 }}>No holidays registered yet</div>
              <div style={{ fontSize: '0.8rem', marginTop: 4 }}>
                Click &ldquo;Add Holiday&rdquo; to register public or festival holidays.
              </div>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#64748b', textAlign: 'left' }}>
                    <th style={{ padding: '10px 16px' }}>Holiday Name</th>
                    <th style={{ padding: '10px 16px' }}>Date</th>
                    <th style={{ padding: '10px 16px' }}>Type</th>
                    <th style={{ padding: '10px 16px' }}>Classification</th>
                    <th style={{ padding: '10px 16px', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {holidays.map((h) => {
                    const dateStr = h.date ? new Date(h.date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) : '—';

                    return (
                      <tr key={h._id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '12px 16px', fontWeight: 600, color: '#0f172a' }}>{h.name}</td>
                        <td style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--primary)' }}>{dateStr}</td>
                        <td style={{ padding: '12px 16px' }}>
                          <Badge variant="neutral">{h.type || 'FESTIVAL'}</Badge>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <Badge variant={h.isOptional ? 'warning' : 'success'}>
                            {h.isOptional ? 'OPTIONAL' : 'MANDATORY'}
                          </Badge>
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                          {isManagerOrAdmin && (
                            <Button
                              variant="danger"
                              size="sm"
                              icon={Trash2}
                              onClick={() => handleDeleteHoliday(h._id)}
                            />
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
      {/* 4. MODAL: APPLY FOR LEAVE (POST /leave/requests) */}
      {/* ================================================================== */}
      {applyModalOpen && (
        <Modal
          isOpen={true}
          onClose={() => setApplyModalOpen(false)}
          title="Apply for Leave"
          maxWidth="500px"
        >
          <form onSubmit={handleApplyLeave} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>Leave Category *</label>
              <select
                value={leaveForm.leaveType}
                onChange={(e) => setLeaveForm({ ...leaveForm, leaveType: e.target.value })}
                required
                style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.82rem' }}
              >
                {leaveTypes.map((t) => (
                  <option key={t._id} value={t._id}>
                    {t.name} ({t.code}) &bull; {t.annualEntitlement || 12}d/yr
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>From Date *</label>
                <input
                  type="date"
                  value={leaveForm.fromDate}
                  onChange={(e) => setLeaveForm({ ...leaveForm, fromDate: e.target.value })}
                  required
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.82rem', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>To Date *</label>
                <input
                  type="date"
                  value={leaveForm.toDate}
                  onChange={(e) => setLeaveForm({ ...leaveForm, toDate: e.target.value })}
                  required
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.82rem', boxSizing: 'border-box' }}
                />
              </div>
            </div>

            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>Reason for Leave *</label>
              <textarea
                rows={3}
                placeholder="Provide clear rationale for planned leave"
                value={leaveForm.reason}
                onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })}
                required
                style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.82rem', boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 6 }}>
              <Button variant="secondary" onClick={() => setApplyModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" type="submit" loading={submittingApply}>
                Submit Application
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* ================================================================== */}
      {/* 5. MODAL: ACCRUE LEAVE BALANCE (POST /leave/balances/accrue) */}
      {/* ================================================================== */}
      {accrueModalOpen && (
        <Modal
          isOpen={true}
          onClose={() => setAccrueModalOpen(false)}
          title="Accrue / Credit Leave Balance"
          maxWidth="480px"
        >
          <form onSubmit={handleAccrueBalance} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>Select Staff Member *</label>
              <select
                value={accrueForm.employeeId}
                onChange={(e) => setAccrueForm({ ...accrueForm, employeeId: e.target.value })}
                required
                style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.82rem' }}
              >
                {employees.map((emp) => (
                  <option key={emp._id} value={emp._id}>
                    {emp.basicInfo?.fullName || emp.name} ({emp.basicInfo?.employeeCode || emp.employeeCode})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>Leave Category *</label>
              <select
                value={accrueForm.leaveType}
                onChange={(e) => setAccrueForm({ ...accrueForm, leaveType: e.target.value })}
                required
                style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.82rem' }}
              >
                {leaveTypes.map((t) => (
                  <option key={t._id} value={t._id}>
                    {t.name} ({t.code})
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>Entitled Days *</label>
                <input
                  type="number"
                  value={accrueForm.entitledDays}
                  onChange={(e) => setAccrueForm({ ...accrueForm, entitledDays: Number(e.target.value) })}
                  required
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.82rem', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>Carried Forward</label>
                <input
                  type="number"
                  value={accrueForm.carriedForwardDays}
                  onChange={(e) => setAccrueForm({ ...accrueForm, carriedForwardDays: Number(e.target.value) })}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.82rem', boxSizing: 'border-box' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 6 }}>
              <Button variant="secondary" onClick={() => setAccrueModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" type="submit" loading={submittingAccrue}>
                Credit Balance
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* ================================================================== */}
      {/* 6. MODAL: ADD LEAVE TYPE (POST /leave-types) */}
      {/* ================================================================== */}
      {typeModalOpen && (
        <Modal
          isOpen={true}
          onClose={() => setTypeModalOpen(false)}
          title="Create New Leave Category"
          maxWidth="480px"
        >
          <form onSubmit={handleCreateLeaveType} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>Category Name *</label>
              <input
                type="text"
                placeholder="e.g. Bereavement Leave, Marriage Leave"
                value={newTypeForm.name}
                onChange={(e) => setNewTypeForm({ ...newTypeForm, name: e.target.value })}
                required
                style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.82rem', boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>Code *</label>
                <input
                  type="text"
                  placeholder="e.g. BL"
                  value={newTypeForm.code}
                  onChange={(e) => setNewTypeForm({ ...newTypeForm, code: e.target.value })}
                  required
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.82rem', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>Annual Entitlement *</label>
                <input
                  type="number"
                  value={newTypeForm.annualEntitlement}
                  onChange={(e) => setNewTypeForm({ ...newTypeForm, annualEntitlement: Number(e.target.value) })}
                  required
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.82rem', boxSizing: 'border-box' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginTop: 4 }}>
              <label style={{ fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={newTypeForm.isPaid}
                  onChange={(e) => setNewTypeForm({ ...newTypeForm, isPaid: e.target.checked })}
                />
                Paid Leave
              </label>

              <label style={{ fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={newTypeForm.carryForwardAllowed}
                  onChange={(e) => setNewTypeForm({ ...newTypeForm, carryForwardAllowed: e.target.checked })}
                />
                Carry-Forward Allowed
              </label>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
              <Button variant="secondary" onClick={() => setTypeModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" type="submit" loading={submittingType}>
                Create Category
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* ================================================================== */}
      {/* 7. MODAL: ADD HOLIDAY (POST /holidays) */}
      {/* ================================================================== */}
      {holidayModalOpen && (
        <Modal
          isOpen={true}
          onClose={() => setHolidayModalOpen(false)}
          title="Add Holiday to Calendar"
          maxWidth="460px"
        >
          <form onSubmit={handleCreateHoliday} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>Holiday Name *</label>
              <input
                type="text"
                placeholder="e.g. Diwali, Republic Day"
                value={holidayForm.name}
                onChange={(e) => setHolidayForm({ ...holidayForm, name: e.target.value })}
                required
                style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.82rem', boxSizing: 'border-box' }}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>Date *</label>
              <input
                type="date"
                value={holidayForm.date}
                onChange={(e) => setHolidayForm({ ...holidayForm, date: e.target.value })}
                required
                style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.82rem', boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
              <label style={{ fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={holidayForm.isOptional}
                  onChange={(e) => setHolidayForm({ ...holidayForm, isOptional: e.target.checked })}
                />
                Optional / Floating Holiday
              </label>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
              <Button variant="secondary" onClick={() => setHolidayModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" type="submit" loading={submittingHoliday}>
                Save Holiday
              </Button>
            </div>
          </form>
        </Modal>
      )}

    </div>
  );
};

export default LeavesHolidays;
