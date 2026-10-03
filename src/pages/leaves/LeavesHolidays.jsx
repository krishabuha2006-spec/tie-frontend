import React, { useState, useEffect, useCallback, useMemo } from 'react';
import leaveHolidayApi from '../../api/leaveHolidayApi';
import employeeApi from '../../api/employeeApi';
import masterApi from '../../api/masterApi';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { useConfirm } from '../../context/ConfirmContext';
import {
  Calendar, Clock, CheckCircle2, AlertCircle, Plus, Edit2,
  Trash2, Search, Check, X, ShieldCheck, Settings, CalendarOff,
  User, Layers, FileText, Ban, Filter, ArrowRight, RefreshCw,
  Info, AlertTriangle
} from 'lucide-react';
import Modal from '../../components/common/Modal';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import StaffPicker from '../../components/common/StaffPicker';
import { extractApiData } from '../../utils/apiUtils';
import { formatDateOnlyIST, getErrorMessage } from '../../utils/formatters';

export const LeavesHolidays = () => {
  const { user, isSuperAdmin, isHrAdmin, isDirector, isBranchManager, userRole, hasPermission, branch: globalBranch } = useAuth();
  const { showToast } = useToast();
  const confirm = useConfirm();

  // ─── Strict Role & Permission Gatekeeping ────────────────────────────────────
  // Backend rule: Only CEO, Directors, or HR/Admin can view and decide pending leave requests.
  const canApprove = Boolean(
    isSuperAdmin ||
    isDirector ||
    isHrAdmin ||
    hasPermission('leaves.approve') ||
    hasPermission('hrms.leaveManagement.approve') ||
    (typeof userRole === 'string' && ['ceo', 'director', 'hr', 'superadmin', 'admin'].some((r) => userRole.toLowerCase().includes(r))) ||
    (Array.isArray(user?.roles) && user.roles.some((r) => ['admin', 'hr', 'director', 'ceo'].includes((r.name || r).toLowerCase())))
  );

  const canManagePolicy = Boolean(
    isSuperAdmin ||
    isDirector ||
    isHrAdmin ||
    hasPermission('leaves.manage') ||
    hasPermission('hrms.leaveManagement.manage')
  );

  // Active Tab: approvers default to 'approvals', regular employees to 'my_leaves'
  const [activeTab, setActiveTab] = useState(canApprove ? 'approvals' : 'my_leaves');

  // Master Data
  const [employees, setEmployees] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [loadingMasters, setLoadingMasters] = useState(false);

  // Filter & Search States
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

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
  const [rejectionModalOpen, setRejectionModalOpen] = useState(false);
  const [rejectingRequest, setRejectingRequest] = useState(null);
  const [rejectionRemark, setRejectionRemark] = useState('');
  const [submittingReject, setSubmittingReject] = useState(false);

  // 3. Withdraw / Cancel Modal State
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancellingRequest, setCancellingRequest] = useState(null);
  const [submittingCancel, setSubmittingCancel] = useState(false);

  // 4. Balances & Accrual State
  const myEmpId = user?.employee?._id || (typeof user?.employee === 'string' && /^[0-9a-fA-F]{24}$/.test(user.employee) ? user.employee : null);
  const [selectedBalanceEmpId, setSelectedBalanceEmpId] = useState(myEmpId || '');
  const [employeeBalances, setEmployeeBalances] = useState([]);
  const [myBalances, setMyBalances] = useState([]);
  const [loadingBalance, setLoadingBalance] = useState(false);
  const [loadingMyBalance, setLoadingMyBalance] = useState(false);
  const [employeeRequests, setEmployeeRequests] = useState([]);
  const [loadingEmpRequests, setLoadingEmpRequests] = useState(false);
  const [accrueModalOpen, setAccrueModalOpen] = useState(false);
  const [submittingAccrue, setSubmittingAccrue] = useState(false);
  const [accrueForm, setAccrueForm] = useState({
    employeeId: '',
    leaveType: '',
    year: new Date().getFullYear(),
    entitledDays: 12,
    carriedForwardDays: 0,
  });

  // 5. Leave Types Configuration State
  const [loadingTypes, setLoadingTypes] = useState(false);
  const [typeModalOpen, setTypeModalOpen] = useState(false);
  const [editTypeModalOpen, setEditTypeModalOpen] = useState(false);
  const [editingType, setEditingType] = useState(null);
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
  const [editTypeForm, setEditTypeForm] = useState({
    name: '',
    code: '',
    annualEntitlement: 12,
    isPaid: true,
    carryForwardAllowed: false,
    maxCarryForwardDays: 0,
    isActive: true,
  });



  // Safe list extractor
  const toList = (res, ...keys) =>
    extractApiData(res, ...keys, 'leaveRequests', 'pendingRequests', 'leaveTypes', 'holidays', 'balances', 'data');

  // Load Masters (Employees, Companies, Leave Types)
  const loadMasters = useCallback(async () => {
    setLoadingMasters(true);
    try {
      const calls = [leaveHolidayApi.getLeaveTypes(), masterApi.getCompanies()];
      if (canApprove || canManagePolicy) {
        const empParams = { limit: 150 };
        const branchId = globalBranch?._id || globalBranch?.id;
        if (branchId && branchId !== 'ALL') {
          empParams.branch = branchId;
        }
        calls.push(employeeApi.getEmployees(empParams));
      }
      const results = await Promise.allSettled(calls);

      const typeList = results[0].status === 'fulfilled' ? toList(results[0].value, 'leaveTypes') : [];
      const compList = results[1].status === 'fulfilled' ? toList(results[1].value, 'companies') : [];
      const empList = results[2]?.status === 'fulfilled' ? toList(results[2].value, 'employees') : [];

      setLeaveTypes(typeList);
      setCompanies(compList);
      setEmployees(empList);

      if (empList.length > 0 && !selectedBalanceEmpId) {
        const defaultEmp = myEmpId || empList[0]._id;
        setSelectedBalanceEmpId(defaultEmp);
        setAccrueForm((prev) => ({ ...prev, employeeId: defaultEmp }));
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
  }, [canApprove, canManagePolicy, myEmpId, selectedBalanceEmpId]);

  // 1. Load My Leaves (GET /leave/requests/me)
  const loadMyLeaves = useCallback(async () => {
    if (!myEmpId) {
      setMyRequests([]);
      return;
    }
    setLoadingMyRequests(true);
    try {
      const res = await leaveHolidayApi.getMyLeaveRequests({ year: selectedYear });
      setMyRequests(toList(res, 'leaveRequests', 'requests'));
    } catch (err) {
      console.error('Error loading my leaves:', err);
      setMyRequests([]);
    } finally {
      setLoadingMyRequests(false);
    }
  }, [myEmpId, selectedYear]);

  // 2. Load My Own Balance (GET /leave/employees/:myEmpId/balance)
  const loadMyBalance = useCallback(async () => {
    if (!myEmpId) {
      setMyBalances([]);
      return;
    }
    setLoadingMyBalance(true);
    try {
      const res = await leaveHolidayApi.getEmployeeLeaveBalance(myEmpId, { year: selectedYear });
      const bList = res?.balances || res?.data?.balances || (Array.isArray(res?.data) ? res.data : []);
      setMyBalances(bList);
    } catch (err) {
      console.error('Error loading personal leave balance:', err);
      setMyBalances([]);
    } finally {
      setLoadingMyBalance(false);
    }
  }, [myEmpId, selectedYear]);

  // 3. Load Pending Approvals (GET /leave/requests/pending-approval)
  const loadPending = useCallback(async () => {
    if (!canApprove) return;
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
  }, [canApprove]);

  // 4. Load Staff Leave Balance for selected employee (GET /leave/employees/:id/balance)
  const loadBalance = useCallback(async (empId) => {
    if (!empId) return;
    setLoadingBalance(true);
    try {
      const res = await leaveHolidayApi.getEmployeeLeaveBalance(empId, { year: selectedYear });
      const bList = res?.balances || res?.data?.balances || (Array.isArray(res?.data) ? res.data : []);
      setEmployeeBalances(bList);
    } catch (err) {
      console.error('Error loading staff leave balance:', err);
      setEmployeeBalances([]);
    } finally {
      setLoadingBalance(false);
    }
  }, [selectedYear]);

  // 4b. Load Specific Staff Leave Requests (GET /leave/requests/employees/:id)
  const loadEmpRequests = useCallback(async (empId) => {
    if (!empId) return;
    setLoadingEmpRequests(true);
    try {
      const res = await leaveHolidayApi.getEmployeeLeaveRequests(empId, { year: selectedYear });
      const list = toList(res, 'leaveRequests', 'requests');
      setEmployeeRequests(list);
    } catch (err) {
      console.error('Error loading employee leave requests:', err);
      setEmployeeRequests([]);
    } finally {
      setLoadingEmpRequests(false);
    }
  }, [selectedYear]);

  // 5. Load Leave Types (GET /leave-types)
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



  // Initial mount
  useEffect(() => {
    loadMasters();
    loadMyLeaves();
    loadMyBalance();
    if (canApprove) loadPending();

    const handleContextChange = () => {
      loadMasters();
      loadMyLeaves();
      loadMyBalance();
      if (canApprove) loadPending();
    };
    window.addEventListener('tie:context-changed', handleContextChange);
    return () => window.removeEventListener('tie:context-changed', handleContextChange);
  }, [loadMasters, loadMyLeaves, loadMyBalance, loadPending, canApprove]);

  // Tab switch effect: dynamically refresh tab data
  useEffect(() => {
    if (activeTab === 'my_leaves') {
      loadMyLeaves();
      loadMyBalance();
    } else if (activeTab === 'approvals' && canApprove) {
      loadPending();
    } else if (activeTab === 'my_balances') {
      loadMyBalance();
    } else if (activeTab === 'balances') {
      const targetEmp = selectedBalanceEmpId || myEmpId;
      if (targetEmp) {
        loadBalance(targetEmp);
        loadEmpRequests(targetEmp);
      }
    } else if (activeTab === 'leave_types') {
      loadLeaveTypes();
    }
  }, [activeTab, selectedBalanceEmpId, loadMyLeaves, loadMyBalance, loadPending, loadBalance, loadEmpRequests, loadLeaveTypes, canApprove, myEmpId]);

  // Dynamic Duration Calculator
  const calculatedDays = useMemo(() => {
    if (!leaveForm.fromDate || !leaveForm.toDate) return 1;
    const d1 = new Date(leaveForm.fromDate);
    const d2 = new Date(leaveForm.toDate);
    const diffTime = d2.getTime() - d1.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return diffDays > 0 ? diffDays : 0;
  }, [leaveForm.fromDate, leaveForm.toDate]);

  // Apply for Leave (POST /leave/requests with auto-accrual recovery)
  const handleApplyLeave = async (e) => {
    e.preventDefault();
    if (!leaveForm.leaveType) {
      showToast('Please select a leave category', 'warning');
      return;
    }
    if (!leaveForm.fromDate || !leaveForm.toDate) {
      showToast('From Date and To Date are required', 'warning');
      return;
    }
    if (new Date(leaveForm.toDate) < new Date(leaveForm.fromDate)) {
      showToast('To Date cannot be before From Date', 'warning');
      return;
    }
    if (!leaveForm.reason.trim()) {
      showToast('Please provide a reason for your leave', 'warning');
      return;
    }

    setSubmittingApply(true);
    try {
      // First attempt: apply directly
      try {
        await leaveHolidayApi.applyLeave({
          leaveType: leaveForm.leaveType,
          fromDate: leaveForm.fromDate,
          toDate: leaveForm.toDate,
          reason: leaveForm.reason.trim(),
        });
      } catch (err) {
        const errMsg = err.response?.data?.message || err.message || '';
        // If error is missing balance record, auto-accrue the standard quota and retry
        if (errMsg.toLowerCase().includes('no leave balance record found') && myEmpId) {
          const selectedTypeObj = leaveTypes.find((t) => t._id === leaveForm.leaveType);
          const quota = selectedTypeObj?.annualEntitlement || 12;
          const year = new Date(leaveForm.fromDate).getFullYear() || new Date().getFullYear();

          await leaveHolidayApi.accrueLeaveBalance({
            employeeId: myEmpId,
            leaveType: leaveForm.leaveType,
            year: Number(year),
            entitledDays: Number(quota),
            carriedForwardDays: 0,
          });

          // Retry application with newly created balance
          await leaveHolidayApi.applyLeave({
            leaveType: leaveForm.leaveType,
            fromDate: leaveForm.fromDate,
            toDate: leaveForm.toDate,
            reason: leaveForm.reason.trim(),
          });
        } else {
          throw err;
        }
      }

      showToast('Leave request submitted and routed for approval!', 'success');
      setApplyModalOpen(false);
      setLeaveForm((prev) => ({
        ...prev,
        reason: '',
      }));
      await loadMyLeaves();
      await loadMyBalance();
      if (canApprove) await loadPending();
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
      await leaveHolidayApi.approveLeave(id, { remark: 'Approved by Manager' });
      showToast('Leave request approved successfully!', 'success');
      await loadPending();
      if (selectedBalanceEmpId) {
        await loadBalance(selectedBalanceEmpId);
        await loadEmpRequests(selectedBalanceEmpId);
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to approve leave', 'error');
    } finally {
      setActingRequestId(null);
    }
  };

  // Open Rejection Modal
  const handleOpenRejectModal = (req) => {
    setRejectingRequest(req);
    setRejectionRemark('');
    setRejectionModalOpen(true);
  };

  // Submit Rejection (PUT /leave/requests/:id/reject with required remark)
  const handleSubmitReject = async (e) => {
    e.preventDefault();
    if (!rejectingRequest?._id) return;
    if (!rejectionRemark.trim()) {
      showToast('Please provide a reason for rejection', 'warning');
      return;
    }

    setSubmittingReject(true);
    try {
      await leaveHolidayApi.rejectLeave(rejectingRequest._id, {
        remark: rejectionRemark.trim(),
      });
      showToast('Leave request rejected', 'info');
      setRejectionModalOpen(false);
      setRejectingRequest(null);
      await loadPending();
      if (selectedBalanceEmpId) {
        await loadBalance(selectedBalanceEmpId);
        await loadEmpRequests(selectedBalanceEmpId);
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to reject leave', 'error');
    } finally {
      setSubmittingReject(false);
    }
  };

  // Open Cancel / Withdraw Modal
  const handleOpenCancelModal = (req) => {
    setCancellingRequest(req);
    setCancelModalOpen(true);
  };

  // Confirm Cancel (PUT /leave/requests/:id/cancel)
  const handleConfirmCancel = async () => {
    if (!cancellingRequest?._id) return;
    setSubmittingCancel(true);
    try {
      await leaveHolidayApi.cancelLeave(cancellingRequest._id);
      showToast('Leave request withdrawn successfully', 'info');
      setCancelModalOpen(false);
      setCancellingRequest(null);
      await loadMyLeaves();
      await loadMyBalance();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to cancel leave', 'error');
    } finally {
      setSubmittingCancel(false);
    }
  };

  // Accrue Balance (POST /leave/balances/accrue)
  const handleAccrueBalance = async (e) => {
    e.preventDefault();
    if (!accrueForm.employeeId || !accrueForm.leaveType) {
      showToast('Staff member and Leave Category are required', 'warning');
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

      showToast('Leave balance allocated successfully!', 'success');
      setAccrueModalOpen(false);
      await loadBalance(accrueForm.employeeId);
      await loadEmpRequests(accrueForm.employeeId);
      if (accrueForm.employeeId === myEmpId) {
        await loadMyBalance();
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to allocate balance', 'error');
    } finally {
      setSubmittingAccrue(false);
    }
  };

  // Open Edit Leave Type Modal (PUT /leave-types/:id)
  const handleOpenEditType = (type) => {
    setEditingType(type);
    setEditTypeForm({
      name: type.name || '',
      code: type.code || '',
      annualEntitlement: type.annualEntitlement || 12,
      isPaid: type.isPaid !== undefined ? Boolean(type.isPaid) : true,
      carryForwardAllowed: Boolean(type.carryForwardAllowed),
      maxCarryForwardDays: type.maxCarryForwardDays || 0,
      isActive: type.isActive !== undefined ? Boolean(type.isActive) : true,
    });
    setEditTypeModalOpen(true);
  };

  // Update Leave Type (PUT /leave-types/:id)
  const handleUpdateLeaveType = async (e) => {
    e.preventDefault();
    if (!editingType?._id) return;
    setSubmittingType(true);
    try {
      await leaveHolidayApi.updateLeaveType(editingType._id, {
        name: editTypeForm.name.trim(),
        code: editTypeForm.code.trim().toUpperCase(),
        annualEntitlement: Number(editTypeForm.annualEntitlement) || 12,
        isPaid: Boolean(editTypeForm.isPaid),
        carryForwardAllowed: Boolean(editTypeForm.carryForwardAllowed),
        maxCarryForwardDays: Number(editTypeForm.maxCarryForwardDays || 0),
        isActive: Boolean(editTypeForm.isActive),
      });

      showToast('Leave category updated successfully!', 'success');
      setEditTypeModalOpen(false);
      setEditingType(null);
      await loadLeaveTypes();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to update leave category', 'error');
    } finally {
      setSubmittingType(false);
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

      showToast('Leave Category created successfully!', 'success');
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
      showToast(err.response?.data?.message || 'Failed to create leave category', 'error');
    } finally {
      setSubmittingType(false);
    }
  };

  // Filtered "My Leaves" by Status & Search
  const filteredMyRequests = useMemo(() => {
    return myRequests.filter((r) => {
      const matchesStatus = statusFilter === 'ALL' || r.status === statusFilter;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        (r.leaveType?.name && r.leaveType.name.toLowerCase().includes(q)) ||
        (r.reason && r.reason.toLowerCase().includes(q)) ||
        (r.status && r.status.toLowerCase().includes(q));
      return matchesStatus && matchesSearch;
    });
  }, [myRequests, statusFilter, searchQuery]);

  // Balances summary calculations
  const displayedBalances = canApprove && activeTab === 'balances' ? employeeBalances : myBalances;
  const totalEntitledSum = displayedBalances.reduce((acc, b) => acc + (b.entitledDays || 0), 0);
  const totalRemainingSum = displayedBalances.reduce(
    (acc, b) => acc + (b.remainingDays != null ? b.remainingDays : (b.entitledDays || 0) - (b.usedDays || 0)),
    0
  );
  const totalUsedSum = displayedBalances.reduce((acc, b) => acc + (b.usedDays || 0), 0);
  const myPendingCount = myRequests.filter((r) => r.status === 'PENDING').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, fontFamily: 'var(--font-family)' }}>
      {/* ─── 1. Header Card ────────────────────────────────────────────────── */}
      <div
        style={{
          background: '#fff',
          borderRadius: 10,
          border: '1px solid #e2e8f0',
          padding: '16px 20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 14,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              background: 'linear-gradient(135deg, var(--primary) 0%, #337a82 100%)',
              color: '#fff',
              padding: 10,
              borderRadius: 10,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <CalendarOff size={24} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, color: '#0f172a' }}>
                Leave Management &amp; Accrual
              </h2>
              <span
                style={{
                  fontSize: '0.73rem',
                  background: 'var(--primary-light, #edf7f8)',
                  color: 'var(--primary, #3f929a)',
                  padding: '2px 8px',
                  borderRadius: 6,
                  fontWeight: 600,
                }}
              >
                {canApprove ? 'Manager / HR Scope' : 'Employee Self-Service'}
              </span>
            </div>
            <p style={{ margin: '3px 0 0', fontSize: '0.78rem', color: '#64748b' }}>
              Live annual quotas, personal balances &amp; application approvals
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <Button
            variant="primary"
            icon={Plus}
            onClick={() => setApplyModalOpen(true)}
            style={{
              background: 'var(--primary)',
              borderColor: 'var(--primary)',
              color: '#fff',
              fontWeight: 700,
              boxShadow: '0 2px 6px rgba(63, 146, 154, 0.35)',
            }}
          >
            Apply for Leave
          </Button>

          {canManagePolicy && activeTab === 'leave_types' && (
            <Button variant="secondary" icon={Plus} onClick={() => setTypeModalOpen(true)}>
              New Category
            </Button>
          )}
        </div>
      </div>

      {/* ─── 2. Dynamic KPI Metric Cards ───────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 12 }}>
        {/* Total Applications */}
        <div style={{ background: '#fff', padding: '14px 18px', borderRadius: 10, border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ background: 'var(--primary-light, #edf7f8)', color: 'var(--primary, #3f929a)', padding: 10, borderRadius: 8 }}>
            <Calendar size={20} />
          </div>
          <div>
            <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0f172a' }}>
              {myRequests.length}
            </div>
            <div style={{ fontSize: '0.74rem', color: '#64748b' }}>My Total Applications</div>
          </div>
        </div>

        {/* Pending Review: Approvals for manager, or own pending for employee */}
        <div style={{ background: '#fff', padding: '14px 18px', borderRadius: 10, border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ background: 'var(--logo-orange-light, #fef8ee)', color: 'var(--logo-orange, #f5a532)', padding: 10, borderRadius: 8 }}>
            <Clock size={20} />
          </div>
          <div>
            <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--logo-orange, #f5a532)' }}>
              {canApprove ? pendingRequests.length : myPendingCount}
            </div>
            <div style={{ fontSize: '0.74rem', color: '#64748b' }}>
              {canApprove ? 'Pending Approval (Action Req)' : 'My Pending Submissions'}
            </div>
          </div>
        </div>

        {/* Available Balance Days */}
        <div style={{ background: '#fff', padding: '14px 18px', borderRadius: 10, border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ background: 'var(--logo-green-light, #f4f9ed)', color: 'var(--logo-green, #8bc54a)', padding: 10, borderRadius: 8 }}>
            <ShieldCheck size={20} />
          </div>
          <div>
            <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--logo-green, #8bc54a)' }}>
              {totalRemainingSum} Days
            </div>
            <div style={{ fontSize: '0.74rem', color: '#64748b' }}>
              Available Balance ({displayedBalances.length} Categories)
            </div>
          </div>
        </div>

        {/* Organization Leave Categories */}
        <div style={{ background: '#fff', padding: '14px 18px', borderRadius: 10, border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ background: '#f8fafc', color: '#64748b', padding: 10, borderRadius: 8 }}>
            <Settings size={20} />
          </div>
          <div>
            <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0f172a' }}>
              {leaveTypes.length}
            </div>
            <div style={{ fontSize: '0.74rem', color: '#64748b' }}>Configured Leave Categories</div>
          </div>
        </div>
      </div>

      {/* ─── 3. Navigation Tab Bar (Strictly Role-Based) ────────────────────── */}
      <div
        style={{
          display: 'flex',
          gap: 6,
          background: '#fff',
          padding: '6px',
          borderRadius: 10,
          border: '1px solid #e2e8f0',
          width: 'fit-content',
          flexWrap: 'wrap',
        }}
      >
        {/* Approvals tab: only rendered for authorized approvers (CEO, Director, HR, Manager) */}
        {canApprove && (
          <button
            onClick={() => setActiveTab('approvals')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '7px 16px',
              borderRadius: 7,
              border: 'none',
              fontSize: '0.84rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s',
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
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '7px 16px',
            borderRadius: 7,
            border: 'none',
            fontSize: '0.84rem',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.15s',
            background: activeTab === 'my_leaves' ? 'var(--primary)' : 'transparent',
            color: activeTab === 'my_leaves' ? '#fff' : '#64748b',
          }}
        >
          <Calendar size={15} /> My Leaves ({myRequests.length})
        </button>

        {/* My Balances Tab (Regular Staff) */}
        {!canApprove && (
          <button
            onClick={() => setActiveTab('my_balances')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '7px 16px',
              borderRadius: 7,
              border: 'none',
              fontSize: '0.84rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s',
              background: activeTab === 'my_balances' ? 'var(--primary)' : 'transparent',
              color: activeTab === 'my_balances' ? '#fff' : '#64748b',
            }}
          >
            <ShieldCheck size={15} /> My Leave Balances ({myBalances.length})
          </button>
        )}

        {/* Staff Balances & Accrual (Managers & HR) */}
        {canApprove && (
          <button
            onClick={() => setActiveTab('balances')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '7px 16px',
              borderRadius: 7,
              border: 'none',
              fontSize: '0.84rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s',
              background: activeTab === 'balances' ? 'var(--primary)' : 'transparent',
              color: activeTab === 'balances' ? '#fff' : '#64748b',
            }}
          >
            <ShieldCheck size={15} /> Staff Balances &amp; Accrual
          </button>
        )}

        <button
          onClick={() => setActiveTab('leave_types')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '7px 16px',
            borderRadius: 7,
            border: 'none',
            fontSize: '0.84rem',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.15s',
            background: activeTab === 'leave_types' ? 'var(--primary)' : 'transparent',
            color: activeTab === 'leave_types' ? '#fff' : '#64748b',
          }}
        >
          <Settings size={15} /> Leave Policies ({leaveTypes.length})
        </button>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* TAB 1: PENDING APPROVALS (AUTHORIZED APPROVERS ONLY)                  */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'approvals' && canApprove && (
        <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          <div
            style={{
              padding: '14px 18px',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 10,
            }}
          >
            <div>
              <h3 style={{ margin: 0, fontSize: '0.96rem', fontWeight: 700, color: '#0f172a' }}>
                Pending Leave Applications for Approval
              </h3>
              <p style={{ margin: '2px 0 0', fontSize: '0.76rem', color: '#64748b' }}>
                Review and approve/reject leave submissions from your subordinates
              </p>
            </div>
            <span
              style={{
                fontSize: '0.76rem',
                background: 'var(--logo-orange-light, #fef8ee)',
                color: 'var(--logo-orange, #f5a532)',
                padding: '4px 10px',
                borderRadius: 6,
                fontWeight: 700,
              }}
            >
              {pendingRequests.length} Pending Actions
            </span>
          </div>

          {loadingPending ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>
              <Clock size={24} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 8px' }} />
              <div>Loading pending applications from backend...</div>
            </div>
          ) : pendingRequests.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>
              <CheckCircle2 size={36} color="var(--logo-green, #8bc54a)" style={{ margin: '0 auto 8px' }} />
              <div style={{ fontWeight: 700, fontSize: '0.92rem', color: '#0f172a' }}>
                No pending leave applications
              </div>
              <div style={{ fontSize: '0.8rem', marginTop: 4 }}>
                All leave submissions in your reporting line have been reviewed.
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
                    <th style={{ padding: '10px 16px', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingRequests.map((req) => {
                    const empName = req.employee?.basicInfo?.fullName || req.employee?.name || 'Staff Member';
                    const empCode = req.employee?.basicInfo?.employeeCode || req.employee?.employeeCode || 'EMP';
                    const fromStr = req.fromDate
                      ? new Date(req.fromDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
                      : '—';
                    const toStr = req.toDate
                      ? new Date(req.toDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                      : '—';
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
                        <td style={{ padding: '12px 16px', fontWeight: 600, color: '#0f172a' }}>
                          {fromStr} &ndash; {toStr}
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{ fontWeight: 700, color: 'var(--primary)' }}>{days} Day(s)</span>
                        </td>
                        <td style={{ padding: '12px 16px', maxWidth: 220 }}>
                          <div style={{ fontSize: '0.78rem', color: '#334155' }}>{req.reason}</div>
                        </td>
                        <td style={{ padding: '12px 16px', color: '#64748b' }}>
                          {req.appliedAt || req.createdAt
                            ? new Date(req.appliedAt || req.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
                            : 'Today'}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                            <Button
                              variant="success"
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
                              onClick={() => handleOpenRejectModal(req)}
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

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* TAB 2: MY LEAVES (ALL STAFF)                                         */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'my_leaves' && (
        <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          {/* Filter and Action Header */}
          <div
            style={{
              padding: '14px 18px',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 12,
            }}
          >
            <div>
              <h3 style={{ margin: 0, fontSize: '0.96rem', fontWeight: 700, color: '#0f172a' }}>
                My Leave Submissions &amp; Status
              </h3>
              <p style={{ margin: '2px 0 0', fontSize: '0.76rem', color: '#64748b' }}>
                Track your active, approved, and past leave submissions
              </p>
            </div>

            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              {/* Status Pill Filters */}
              <div style={{ display: 'flex', gap: 4, background: '#f1f5f9', padding: 3, borderRadius: 8 }}>
                {['ALL', 'PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'].map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setStatusFilter(st)}
                    style={{
                      border: 'none',
                      padding: '4px 10px',
                      borderRadius: 6,
                      fontSize: '0.73rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      background: statusFilter === st ? 'var(--primary)' : 'transparent',
                      color: statusFilter === st ? '#fff' : '#64748b',
                      transition: 'all 0.12s',
                    }}
                  >
                    {st}
                  </button>
                ))}
              </div>

              {/* Search */}
              <div style={{ position: 'relative', width: 200 }}>
                <Search size={14} color="#94a3b8" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type="text"
                  placeholder="Search reason..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '6px 10px 6px 30px',
                    fontSize: '0.8rem',
                    borderRadius: 6,
                    border: '1px solid #cbd5e1',
                    boxSizing: 'border-box',
                    outline: 'none',
                  }}
                />
              </div>

              <Button variant="primary" size="sm" icon={Plus} onClick={() => setApplyModalOpen(true)}>
                Apply for Leave
              </Button>
            </div>
          </div>

          {loadingMyRequests ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>
              <Clock size={24} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 8px' }} />
              <div>Loading your leave applications...</div>
            </div>
          ) : filteredMyRequests.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>
              <Calendar size={36} color="#94a3b8" style={{ margin: '0 auto 8px' }} />
              <div style={{ fontWeight: 700, fontSize: '0.92rem', color: '#0f172a' }}>
                No leave applications found
              </div>
              <div style={{ fontSize: '0.8rem', marginTop: 4 }}>
                {statusFilter !== 'ALL'
                  ? `No applications with status "${statusFilter}". Try selecting "ALL".`
                  : 'Click "Apply for Leave" above to submit a planned leave.'}
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
                    <th style={{ padding: '10px 16px' }}>Remarks / Decision</th>
                    <th style={{ padding: '10px 16px', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMyRequests.map((req) => {
                    const fromStr = req.fromDate
                      ? new Date(req.fromDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                      : '—';
                    const toStr = req.toDate
                      ? new Date(req.toDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                      : '—';
                    const days = req.numberOfDays ?? req.totalDays ?? 1;
                    const st = req.status || 'PENDING';
                    const remark = req.approvalDecision?.remark || req.rejectionReason || req.remarks || '—';

                    return (
                      <tr key={req._id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '12px 16px' }}>
                          <Badge variant="primary">{req.leaveType?.name || 'Leave'}</Badge>
                        </td>
                        <td style={{ padding: '12px 16px', fontWeight: 600 }}>{fromStr}</td>
                        <td style={{ padding: '12px 16px', fontWeight: 600 }}>{toStr}</td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{ fontWeight: 700, color: 'var(--primary)' }}>{days} Day(s)</span>
                        </td>
                        <td style={{ padding: '12px 16px', maxWidth: 220 }}>
                          <div style={{ fontSize: '0.78rem', color: '#334155' }}>{req.reason}</div>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <Badge
                            variant={
                              st === 'APPROVED' ? 'success'
                              : st === 'REJECTED' ? 'danger'
                              : st === 'CANCELLED' ? 'secondary'
                              : 'warning'
                            }
                          >
                            {st}
                          </Badge>
                        </td>
                        <td style={{ padding: '12px 16px', color: '#64748b', fontSize: '0.78rem', maxWidth: 180 }}>
                          {remark}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                          {st === 'PENDING' && (
                            <Button
                              variant="secondary"
                              size="sm"
                              icon={Ban}
                              onClick={() => handleOpenCancelModal(req)}
                              style={{ color: '#dc2626' }}
                              title="Withdraw this pending request"
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

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* TAB 3A: MY BALANCES (FOR REGULAR EMPLOYEES)                          */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'my_balances' && !canApprove && (
        <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0', padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '0.96rem', fontWeight: 700, color: '#0f172a' }}>
                My Personal Leave Entitlement &amp; Balances ({selectedYear})
              </h3>
              <p style={{ margin: '2px 0 0', fontSize: '0.76rem', color: '#64748b' }}>
                Breakdown of allotted quotas, consumed leaves, and remaining balance
              </p>
            </div>
            <Button variant="primary" size="sm" icon={Plus} onClick={() => setApplyModalOpen(true)}>
              Apply for Leave
            </Button>
          </div>

          {loadingMyBalance ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>
              <Clock size={24} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 8px' }} />
              <div>Loading leave balances...</div>
            </div>
          ) : myBalances.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#64748b', background: '#f8fafc', borderRadius: 8, border: '1px dashed #cbd5e1' }}>
              <ShieldCheck size={36} color="#94a3b8" style={{ margin: '0 auto 8px' }} />
              <div style={{ fontWeight: 700, color: '#0f172a' }}>
                Annual leave balance not yet initialized for {selectedYear}
              </div>
              <div style={{ fontSize: '0.8rem', marginTop: 4 }}>
                When you submit your first leave application, your annual category quota will automatically be credited.
              </div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>
              {myBalances.map((b) => {
                const typeName = b.leaveType?.name || 'Leave Category';
                const typeCode = b.leaveType?.code || 'LV';
                const entitled = b.entitledDays || 0;
                const used = b.usedDays || 0;
                const remaining = b.remainingDays != null ? b.remainingDays : entitled - used;
                const carried = b.carriedForwardDays || 0;
                const pct = entitled > 0 ? Math.min(100, Math.round((remaining / entitled) * 100)) : 0;

                return (
                  <div
                    key={b._id}
                    style={{
                      background: '#f8fafc',
                      borderRadius: 10,
                      border: '1px solid #e2e8f0',
                      padding: 16,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 12,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.92rem', color: '#0f172a' }}>{typeName}</span>
                      <Badge variant="primary">{typeCode}</Badge>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <div>
                        <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>ALLOTTED QUOTA</div>
                        <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a' }}>{entitled}d</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.72rem', color: '#dc2626', fontWeight: 600 }}>CONSUMED</div>
                        <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#dc2626' }}>{used}d</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--logo-green, #8bc54a)', fontWeight: 600 }}>AVAILABLE</div>
                        <div style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--logo-green, #8bc54a)' }}>{remaining}d</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.72rem', color: '#d97706', fontWeight: 600 }}>CARRIED OVER</div>
                        <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#d97706' }}>{carried}d</div>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div style={{ width: '100%', height: 6, background: '#e2e8f0', borderRadius: 3, overflow: 'hidden' }}>
                      <div
                        style={{
                          width: `${pct}%`,
                          height: '100%',
                          background: remaining > 3 ? 'var(--logo-green, #8bc54a)' : remaining > 0 ? 'var(--logo-orange, #f5a532)' : '#dc2626',
                          transition: 'width 0.3s',
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* TAB 3B: STAFF BALANCES & ACCRUAL (MANAGERS & HR)                     */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'balances' && canApprove && (
        <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0', padding: 18, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Executive Employee Picker & Action Bar */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 16,
              background: '#f8fafc',
              padding: '14px 18px',
              borderRadius: 12,
              border: '1px solid #e2e8f0',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 260 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Layers size={18} color="var(--primary, #3f929a)" />
                <span style={{ fontSize: '0.92rem', fontWeight: 700, color: '#0f172a' }}>
                  Staff Leave Ledger & Quotas
                </span>
              </div>
              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                Select any employee to inspect live leave quotas, consumption, and entitlement
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', flex: 1, justifyContent: 'flex-end' }}>
              <div style={{ minWidth: 280, maxWidth: 420, flex: 1 }}>
                <StaffPicker
                  employees={employees}
                  value={selectedBalanceEmpId}
                  onChange={(empId) => {
                    setSelectedBalanceEmpId(empId);
                    loadBalance(empId);
                    loadEmpRequests(empId);
                  }}
                  placeholder="Select staff member to inspect..."
                />
              </div>

              {canManagePolicy && (
                <Button variant="primary" size="md" icon={Plus} onClick={() => setAccrueModalOpen(true)}>
                  Accrue / Credit Leave
                </Button>
              )}
            </div>
          </div>

          {loadingBalance ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>
              <Clock size={24} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 8px' }} />
              <div>Loading leave balances from backend...</div>
            </div>
          ) : employeeBalances.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#64748b', background: '#f8fafc', borderRadius: 8, border: '1px dashed #cbd5e1' }}>
              <ShieldCheck size={32} color="#94a3b8" style={{ margin: '0 auto 8px' }} />
              <div style={{ fontWeight: 600 }}>No leave balance records found for selected employee ({selectedYear})</div>
              <div style={{ fontSize: '0.8rem', marginTop: 4 }}>
                Click &ldquo;Accrue / Credit Leave Balance&rdquo; above to initialize annual leave days for this staff member.
              </div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
              {employeeBalances.map((b) => {
                const typeName = b.leaveType?.name || 'Leave Category';
                const typeCode = b.leaveType?.code || 'LV';
                const entitled = b.entitledDays || 0;
                const used = b.usedDays || 0;
                const remaining = b.remainingDays != null ? b.remainingDays : entitled - used;
                const carried = b.carriedForwardDays || 0;

                return (
                  <div
                    key={b._id}
                    style={{
                      background: '#f8fafc',
                      borderRadius: 8,
                      border: '1px solid #e2e8f0',
                      padding: 16,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 10,
                    }}
                  >
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
                        <div style={{ fontSize: '0.72rem', color: 'var(--logo-green, #8bc54a)' }}>AVAILABLE</div>
                        <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--logo-green, #8bc54a)' }}>{remaining}d</div>
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

          {/* Selected Staff Member Leave History */}
          <div style={{ marginTop: 12, borderTop: '1px solid #e2e8f0', paddingTop: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
              <div>
                <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700, color: '#0f172a' }}>
                  Employee Leave Request History
                </h4>
                <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: '#64748b' }}>
                  Live application log and manager approvals for selected staff
                </p>
              </div>
              <span style={{ fontSize: '0.76rem', color: '#64748b', fontWeight: 600 }}>
                {employeeRequests.length} Application(s) Recorded
              </span>
            </div>

            {loadingEmpRequests ? (
              <div style={{ padding: 30, textAlign: 'center', color: '#64748b' }}>
                <Clock size={20} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 6px' }} />
                <div style={{ fontSize: '0.8rem' }}>Loading employee leave applications...</div>
              </div>
            ) : employeeRequests.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', color: '#64748b', background: '#f8fafc', borderRadius: 8, border: '1px dashed #cbd5e1' }}>
                <FileText size={26} color="#94a3b8" style={{ margin: '0 auto 6px' }} />
                <div style={{ fontWeight: 600, fontSize: '0.82rem' }}>No leave requests found for this staff member</div>
              </div>
            ) : (
              <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: 8 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#64748b', textAlign: 'left' }}>
                      <th style={{ padding: '9px 14px' }}>Category</th>
                      <th style={{ padding: '9px 14px' }}>Period</th>
                      <th style={{ padding: '9px 14px' }}>Days</th>
                      <th style={{ padding: '9px 14px' }}>Reason</th>
                      <th style={{ padding: '9px 14px' }}>Status</th>
                      <th style={{ padding: '9px 14px', textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {employeeRequests.map((req) => {
                      const fromStr = req.fromDate
                        ? new Date(req.fromDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
                        : '—';
                      const toStr = req.toDate
                        ? new Date(req.toDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                        : '—';
                      const days = req.numberOfDays ?? req.totalDays ?? 1;
                      const st = req.status || 'PENDING';

                      return (
                        <tr key={req._id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '10px 14px' }}>
                            <Badge variant="primary">{req.leaveType?.name || 'Leave'}</Badge>
                          </td>
                          <td style={{ padding: '10px 14px', fontWeight: 600 }}>{fromStr} &ndash; {toStr}</td>
                          <td style={{ padding: '10px 14px' }}>
                            <span style={{ fontWeight: 700, color: 'var(--primary)' }}>{days} Day(s)</span>
                          </td>
                          <td style={{ padding: '10px 14px', maxWidth: 220 }}>
                            <div style={{ fontSize: '0.76rem', color: '#334155' }}>{req.reason}</div>
                          </td>
                          <td style={{ padding: '10px 14px' }}>
                            <Badge
                              variant={
                                st === 'APPROVED' ? 'success'
                                : st === 'REJECTED' ? 'danger'
                                : st === 'CANCELLED' ? 'secondary'
                                : 'warning'
                              }
                            >
                              {st}
                            </Badge>
                          </td>
                          <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                            {st === 'PENDING' && canApprove && (
                              <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                                <Button
                                  variant="success"
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
                                  onClick={() => handleOpenRejectModal(req)}
                                >
                                  Reject
                                </Button>
                              </div>
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
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* TAB 4: LEAVE POLICIES CONFIGURATION                                   */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'leave_types' && (
        <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          <div
            style={{
              padding: '14px 18px',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 10,
            }}
          >
            <div>
              <h3 style={{ margin: 0, fontSize: '0.96rem', fontWeight: 700, color: '#0f172a' }}>
                Organization Leave Categories &amp; Policy
              </h3>
              <p style={{ margin: '2px 0 0', fontSize: '0.76rem', color: '#64748b' }}>
                Annual entitlement quotas, paid status, and rollover guidelines
              </p>
            </div>
            {canManagePolicy && (
              <Button variant="primary" size="sm" icon={Plus} onClick={() => setTypeModalOpen(true)}>
                New Category
              </Button>
            )}
          </div>

          {loadingTypes ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>
              <Clock size={24} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 8px' }} />
              <div>Loading configured leave categories...</div>
            </div>
          ) : leaveTypes.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>
              <AlertCircle size={32} color="#94a3b8" style={{ margin: '0 auto 8px' }} />
              <div style={{ fontWeight: 600 }}>No leave categories configured</div>
              <div style={{ fontSize: '0.8rem', marginTop: 4 }}>
                {canManagePolicy ? 'Click "New Category" above to configure your leave types.' : 'Contact HR Admin.'}
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
                    <th style={{ padding: '10px 16px' }}>Paid Status</th>
                    <th style={{ padding: '10px 16px' }}>Carry-Forward</th>
                    <th style={{ padding: '10px 16px' }}>Status</th>
                    {canManagePolicy && <th style={{ padding: '10px 16px', textAlign: 'right' }}>Actions</th>}
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
                        <Badge variant={t.isActive === false ? 'danger' : 'success'}>
                          {t.isActive === false ? 'INACTIVE' : 'ACTIVE'}
                        </Badge>
                      </td>
                      {canManagePolicy && (
                        <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                          <Button variant="secondary" size="sm" icon={Edit2} onClick={() => handleOpenEditType(t)}>
                            Edit
                          </Button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* MODAL 1: APPLY FOR LEAVE                                             */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {applyModalOpen && (
        <Modal
          isOpen={true}
          onClose={() => setApplyModalOpen(false)}
          title="Apply for Leave"
          maxWidth="500px"
        >
          <form onSubmit={handleApplyLeave} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>
                Leave Category *
              </label>
              <select
                value={leaveForm.leaveType}
                onChange={(e) => setLeaveForm({ ...leaveForm, leaveType: e.target.value })}
                required
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: 10,
                  border: '1px solid #cbd5e1',
                  fontSize: '0.84rem',
                  background: '#ffffff',
                  color: '#0f172a',
                  outline: 'none',
                  appearance: 'none',
                  backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e")`,
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'right 12px center',
                  backgroundSize: '16px',
                  paddingRight: '36px',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                }}
              >
                {leaveTypes
                  .filter((t) => t.isActive !== false)
                  .map((t) => (
                    <option key={t._id} value={t._id}>
                      {t.name} ({t.code}) &bull; {t.annualEntitlement || 12} days/year
                    </option>
                  ))}
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>
                  From Date *
                </label>
                <input
                  type="date"
                  value={leaveForm.fromDate}
                  onChange={(e) => setLeaveForm({ ...leaveForm, fromDate: e.target.value })}
                  required
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '0.82rem', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>
                  To Date *
                </label>
                <input
                  type="date"
                  value={leaveForm.toDate}
                  onChange={(e) => setLeaveForm({ ...leaveForm, toDate: e.target.value })}
                  required
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '0.82rem', boxSizing: 'border-box' }}
                />
              </div>
            </div>

            {/* Calculated Days Banner */}
            <div
              style={{
                background: 'var(--primary-light, #edf7f8)',
                border: '1px solid var(--primary-border, #b1dce1)',
                padding: '10px 14px',
                borderRadius: 8,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span style={{ fontSize: '0.8rem', color: '#334155', fontWeight: 500 }}>
                Total Leave Duration:
              </span>
              <span style={{ fontSize: '0.92rem', fontWeight: 800, color: 'var(--primary, #3f929a)' }}>
                {calculatedDays} {calculatedDays === 1 ? 'Day' : 'Days'}
              </span>
            </div>

            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>
                Reason for Leave *
              </label>
              <textarea
                rows={3}
                placeholder="Explain the reason for your planned absence (e.g. Personal travel, health checkup, family wedding)"
                value={leaveForm.reason}
                onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })}
                required
                style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '0.84rem', boxSizing: 'border-box', resize: 'vertical' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
              <Button variant="secondary" onClick={() => setApplyModalOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                type="submit"
                loading={submittingApply}
                style={{
                  background: 'var(--primary)',
                  borderColor: 'var(--primary)',
                  color: '#fff',
                  fontWeight: 700,
                }}
              >
                Submit Application
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* MODAL 2: REJECT LEAVE APPLICATION (WITH MANDATORY REMARK)            */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {rejectionModalOpen && rejectingRequest && (
        <Modal
          isOpen={true}
          onClose={() => setRejectionModalOpen(false)}
          title="Reject Leave Application"
          maxWidth="460px"
        >
          <form onSubmit={handleSubmitReject} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', padding: '10px 14px', borderRadius: 8, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <AlertTriangle size={18} color="#dc2626" style={{ marginTop: 2, flexShrink: 0 }} />
              <div style={{ fontSize: '0.8rem', color: '#991b1b' }}>
                You are rejecting the leave request from{' '}
                <strong>{rejectingRequest.employee?.basicInfo?.fullName || rejectingRequest.employee?.name || 'Staff Member'}</strong>{' '}
                ({rejectingRequest.numberOfDays || 1} days).
              </div>
            </div>

            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>
                Rejection Remark / Reason *
              </label>
              <textarea
                rows={3}
                placeholder="Explain why this leave application is being rejected..."
                value={rejectionRemark}
                onChange={(e) => setRejectionRemark(e.target.value)}
                required
                style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '0.84rem', boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <Button variant="secondary" onClick={() => setRejectionModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="danger" type="submit" loading={submittingReject}>
                Confirm Rejection
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* MODAL 3: WITHDRAW / CANCEL LEAVE APPLICATION                         */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {cancelModalOpen && cancellingRequest && (
        <Modal
          isOpen={true}
          onClose={() => setCancelModalOpen(false)}
          title="Withdraw Leave Application"
          maxWidth="420px"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <div style={{ padding: 10, borderRadius: '50%', background: '#fee2e2', color: '#dc2626' }}>
                <Ban size={22} />
              </div>
              <div style={{ fontSize: '0.88rem', color: '#0f172a' }}>
                Are you sure you want to withdraw your pending leave application for{' '}
                <strong>{cancellingRequest.leaveType?.name || 'Leave'}</strong> ({cancellingRequest.numberOfDays || 1} days)?
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
              <Button variant="secondary" onClick={() => setCancelModalOpen(false)}>
                Keep Application
              </Button>
              <Button variant="danger" onClick={handleConfirmCancel} loading={submittingCancel}>
                Withdraw Application
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* MODAL 4: ACCRUE LEAVE BALANCE                                        */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {accrueModalOpen && (
        <Modal
          isOpen={true}
          onClose={() => setAccrueModalOpen(false)}
          title="Credit / Accrue Leave Quota"
          maxWidth="480px"
        >
          <form onSubmit={handleAccrueBalance} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <StaffPicker
                label="Select Staff Member"
                required
                employees={employees}
                value={accrueForm.employeeId}
                onChange={(empId) => setAccrueForm((prev) => ({ ...prev, employeeId: empId }))}
                placeholder="Choose staff member to credit..."
              />
            </div>

            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>
                Leave Category *
              </label>
              <select
                value={accrueForm.leaveType}
                onChange={(e) => setAccrueForm({ ...accrueForm, leaveType: e.target.value })}
                required
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: 10,
                  border: '1px solid #cbd5e1',
                  fontSize: '0.84rem',
                  background: '#ffffff',
                  color: '#0f172a',
                  outline: 'none',
                  appearance: 'none',
                  backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e")`,
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'right 12px center',
                  backgroundSize: '16px',
                  paddingRight: '36px',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                }}
              >
                {leaveTypes.map((t) => (
                  <option key={t._id} value={t._id}>
                    {t.name} ({t.code}) &bull; Standard: {t.annualEntitlement || 12}d
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>
                  Entitled Days *
                </label>
                <input
                  type="number"
                  value={accrueForm.entitledDays}
                  onChange={(e) => setAccrueForm({ ...accrueForm, entitledDays: Number(e.target.value) })}
                  required
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '0.82rem', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>
                  Carried Forward Days
                </label>
                <input
                  type="number"
                  value={accrueForm.carriedForwardDays}
                  onChange={(e) => setAccrueForm({ ...accrueForm, carriedForwardDays: Number(e.target.value) })}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '0.82rem', boxSizing: 'border-box' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
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

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* MODAL 5: CREATE LEAVE CATEGORY                                       */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {typeModalOpen && (
        <Modal
          isOpen={true}
          onClose={() => setTypeModalOpen(false)}
          title="Create New Leave Category"
          maxWidth="480px"
        >
          <form onSubmit={handleCreateLeaveType} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>
                Category Name *
              </label>
              <input
                type="text"
                placeholder="e.g. Paternity Leave, Marriage Leave"
                value={newTypeForm.name}
                onChange={(e) => setNewTypeForm({ ...newTypeForm, name: e.target.value })}
                required
                style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '0.82rem', boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>
                  Code *
                </label>
                <input
                  type="text"
                  placeholder="e.g. ML"
                  value={newTypeForm.code}
                  onChange={(e) => setNewTypeForm({ ...newTypeForm, code: e.target.value })}
                  required
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '0.82rem', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>
                  Annual Quota (Days) *
                </label>
                <input
                  type="number"
                  value={newTypeForm.annualEntitlement}
                  onChange={(e) => setNewTypeForm({ ...newTypeForm, annualEntitlement: Number(e.target.value) })}
                  required
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '0.82rem', boxSizing: 'border-box' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 18, alignItems: 'center' }}>
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

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
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

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* MODAL 6: EDIT LEAVE CATEGORY                                         */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {editTypeModalOpen && (
        <Modal
          isOpen={true}
          onClose={() => {
            setEditTypeModalOpen(false);
            setEditingType(null);
          }}
          title={`Edit Leave Category: ${editingType?.name || ''}`}
          maxWidth="480px"
        >
          <form onSubmit={handleUpdateLeaveType} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>
                Category Name *
              </label>
              <input
                type="text"
                value={editTypeForm.name}
                onChange={(e) => setEditTypeForm({ ...editTypeForm, name: e.target.value })}
                required
                style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '0.82rem', boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>
                  Code *
                </label>
                <input
                  type="text"
                  value={editTypeForm.code}
                  onChange={(e) => setEditTypeForm({ ...editTypeForm, code: e.target.value })}
                  required
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '0.82rem', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>
                  Annual Quota (Days) *
                </label>
                <input
                  type="number"
                  value={editTypeForm.annualEntitlement}
                  onChange={(e) => setEditTypeForm({ ...editTypeForm, annualEntitlement: Number(e.target.value) })}
                  required
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '0.82rem', boxSizing: 'border-box' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 18, alignItems: 'center' }}>
              <label style={{ fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={editTypeForm.isPaid}
                  onChange={(e) => setEditTypeForm({ ...editTypeForm, isPaid: e.target.checked })}
                />
                Paid Leave
              </label>

              <label style={{ fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={editTypeForm.carryForwardAllowed}
                  onChange={(e) => setEditTypeForm({ ...editTypeForm, carryForwardAllowed: e.target.checked })}
                />
                Carry-Forward Allowed
              </label>

              <label style={{ fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={editTypeForm.isActive}
                  onChange={(e) => setEditTypeForm({ ...editTypeForm, isActive: e.target.checked })}
                />
                Status Active
              </label>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
              <Button
                variant="secondary"
                onClick={() => {
                  setEditTypeModalOpen(false);
                  setEditingType(null);
                }}
              >
                Cancel
              </Button>
              <Button variant="primary" type="submit" loading={submittingType}>
                Save Changes
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};

export default LeavesHolidays;
