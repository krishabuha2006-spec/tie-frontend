import React, { useState, useEffect } from 'react';
import lifecycleApi from '../../api/lifecycleApi';
import employeeApi from '../../api/employeeApi';
import masterApi from '../../api/masterApi';
import { useToast } from '../../context/ToastContext';
import { useConfirm } from '../../context/ConfirmContext';
import { useAuth } from '../../context/AuthContext';
import {
  getEmployeeName,
  getEmployeeCode,
  formatEmployeeOption,
  extractEmployeeList,
} from '../../utils/employeeUtils';
import {
  GitFork,
  CheckCircle2,
  XCircle,
  Clock,
  UserCheck,
  TrendingUp,
  ArrowRightLeft,
  LogOut,
  ShieldCheck,
  FileCheck,
  Eye,
  RefreshCw,
  Check,
  X,
  Search,
  Filter,
  Building,
  Briefcase,
  AlertTriangle,
  Award,
  Users,
  Calendar,
  DollarSign,
  ChevronRight,
  Info,
} from 'lucide-react';
import Table from '../../components/common/Table';
import Modal from '../../components/common/Modal';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import Select from '../../components/common/Select';
import Badge from '../../components/common/Badge';
import { extractApiData } from '../../utils/apiUtils';

export const LifecycleEvents = () => {
  const confirm = useConfirm();
  const { user, isSuperAdmin, isHrAdmin } = useAuth();
  const canManage = isSuperAdmin || isHrAdmin;
  const { showToast } = useToast();

  // Active Tab: 'events' | 'self' | 'approvals' | 'employeeHistory' | 'clearance'
  const [activeTab, setActiveTab] = useState(canManage ? 'events' : 'self');

  // Master Data
  const [employees, setEmployees] = useState([]);
  const [designations, setDesignations] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [branches, setBranches] = useState([]);

  // =========================================================================
  // TAB 1: ALL LIFECYCLE EVENTS
  // =========================================================================
  const [events, setEvents] = useState([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [eventTypeFilter, setEventTypeFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Initiation Modals State
  const [confirmationModalOpen, setConfirmationModalOpen] = useState(false);
  const [confirmationForm, setConfirmationForm] = useState({
    employeeId: '',
    effectiveDate: new Date().toISOString().split('T')[0],
    remarks: '',
  });

  const [promotionModalOpen, setPromotionModalOpen] = useState(false);
  const [promotionForm, setPromotionForm] = useState({
    employeeId: '',
    newDesignation: '',
    newSalaryStructure: '',
    effectiveFromPayrollPeriod: new Date().toISOString().slice(0, 7), // e.g. "2026-10"
    effectiveDate: new Date().toISOString().split('T')[0],
    salaryRevisionRemark: '',
  });

  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [transferForm, setTransferForm] = useState({
    employeeId: '',
    newBranch: '',
    newDepartment: '',
    effectiveDate: new Date().toISOString().split('T')[0],
    transferReason: '',
  });

  const [exitModalOpen, setExitModalOpen] = useState(false);
  const [exitForm, setExitForm] = useState({
    employeeId: '',
    exitReason: 'RESIGNATION', // 'RESIGNATION' | 'TERMINATION' | 'RETIREMENT' | 'END_OF_CONTRACT' | 'OTHER'
    resignationDate: new Date().toISOString().split('T')[0],
    lastWorkingDay: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
    reason: '',
  });

  const [submittingAction, setSubmittingAction] = useState(false);

  // =========================================================================
  // TAB 2: MY TRANSITIONS (SELF-SERVICE)
  // =========================================================================
  const [myEvents, setMyEvents] = useState([]);
  const [loadingMyEvents, setLoadingMyEvents] = useState(false);

  // =========================================================================
  // TAB 3: PENDING APPROVALS QUEUE
  // =========================================================================
  const [decideModalOpen, setDecideModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [decisionChoice, setDecisionChoice] = useState('APPROVED'); // 'APPROVED' | 'REJECTED' | 'EXTENDED'
  const [extendedByMonths, setExtendedByMonths] = useState(3);
  const [decisionRemark, setDecisionRemark] = useState('');
  const [submittingDecision, setSubmittingDecision] = useState(false);

  // =========================================================================
  // TAB 4: EMPLOYEE HISTORY EXPLORER
  // =========================================================================
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [employeeHistory, setEmployeeHistory] = useState([]);
  const [loadingEmployeeHistory, setLoadingEmployeeHistory] = useState(false);

  // =========================================================================
  // TAB 5: EXIT & FNF CLEARANCE CHECKLIST
  // =========================================================================
  const [activeExitEvent, setActiveExitEvent] = useState(null);
  const [checklist, setChecklist] = useState(null);
  const [loadingChecklist, setLoadingChecklist] = useState(false);
  const [confirmItemModalOpen, setConfirmItemModalOpen] = useState(false);
  const [targetItemKey, setTargetItemKey] = useState('');
  const [itemRemarks, setItemRemarks] = useState('');
  const [submittingItemConfirm, setSubmittingItemConfirm] = useState(false);
  const [submittingFinalize, setSubmittingFinalize] = useState(false);

  // Details Modal
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [activeEventDetails, setActiveEventDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // -------------------------------------------------------------------------
  // INITIAL LOAD
  // -------------------------------------------------------------------------
  useEffect(() => {
    loadMasters();
  }, []);

  useEffect(() => {
    if (activeTab === 'events' || activeTab === 'approvals') {
      loadAllEvents();
    } else if (activeTab === 'self') {
      loadMyEvents();
    } else if (activeTab === 'employeeHistory' && selectedEmployeeId) {
      loadEmployeeHistory(selectedEmployeeId);
    }
  }, [activeTab]);

  const loadMasters = async () => {
    try {
      const [eRes, desRes, depRes, bRes] = await Promise.all([
        employeeApi.getEmployees({ limit: 300 }).catch(() => ({ data: [] })),
        masterApi.getDesignations().catch(() => ({ data: [] })),
        masterApi.getDepartments().catch(() => ({ data: [] })),
        masterApi.getBranches().catch(() => ({ data: [] })),
      ]);
      const empList = extractEmployeeList(eRes);
      const desList = extractApiData(desRes, 'designations', 'data');
      const depList = extractApiData(depRes, 'departments', 'data');
      const bList = extractApiData(bRes, 'branches', 'data');

      setEmployees(empList);
      setDesignations(desList);
      setDepartments(depList);
      setBranches(bList);

      if (empList.length > 0) {
        const firstId = empList[0]._id || empList[0].id;
        setConfirmationForm((prev) => ({ ...prev, employeeId: firstId }));
        setPromotionForm((prev) => ({ ...prev, employeeId: firstId }));
        setTransferForm((prev) => ({ ...prev, employeeId: firstId }));
        setExitForm((prev) => ({ ...prev, employeeId: firstId }));
        setSelectedEmployeeId(firstId);
      }
      if (desList.length > 0) setPromotionForm((prev) => ({ ...prev, newDesignation: desList[0]._id || desList[0].title }));
      if (bList.length > 0) setTransferForm((prev) => ({ ...prev, newBranch: bList[0]._id || bList[0].name }));
      if (depList.length > 0) setTransferForm((prev) => ({ ...prev, newDepartment: depList[0]._id || depList[0].name }));
    } catch (err) {
      console.error('Failed to load masters:', err);
    }
  };

  // -------------------------------------------------------------------------
  // EVENTS LOAD & CRUD
  // -------------------------------------------------------------------------
  const loadAllEvents = async () => {
    setLoadingEvents(true);
    try {
      const res = await lifecycleApi.getAllLifecycleEvents();
      const list = extractApiData(res, 'events', 'lifecycleEvents', 'data');
      setEvents(Array.isArray(list) ? list : []);
    } catch (err) {
      showToast('Failed to load lifecycle events', 'error');
    } finally {
      setLoadingEvents(false);
    }
  };

  const loadMyEvents = async () => {
    setLoadingMyEvents(true);
    try {
      const res = await lifecycleApi.getMyLifecycleEvents();
      const list = extractApiData(res, 'events', 'lifecycleEvents', 'data');
      setMyEvents(Array.isArray(list) ? list : []);
    } catch (err) {
      showToast('Failed to load personal transitions', 'error');
    } finally {
      setLoadingMyEvents(false);
    }
  };

  const loadEmployeeHistory = async (empId) => {
    if (!empId) return;
    setLoadingEmployeeHistory(true);
    try {
      const res = await lifecycleApi.getEmployeeLifecycleEvents(empId);
      const list = extractApiData(res, 'events', 'lifecycleEvents', 'data');
      setEmployeeHistory(Array.isArray(list) ? list : []);
    } catch (err) {
      showToast('Failed to load history for selected employee', 'error');
    } finally {
      setLoadingEmployeeHistory(false);
    }
  };

  // -------------------------------------------------------------------------
  // WORKFLOW INITIATIONS (POST /lifecycle-events/...)
  // -------------------------------------------------------------------------
  const handleInitiateConfirmation = async (e) => {
    e.preventDefault();
    setSubmittingAction(true);
    try {
      await lifecycleApi.initiateConfirmation(confirmationForm);
      showToast('Confirmation workflow initiated at probation end!', 'success');
      setConfirmationModalOpen(false);
      loadAllEvents();
    } catch (err) {
      showToast(err.response?.data?.message || 'Confirmation initiation failed', 'error');
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleInitiatePromotion = async (e) => {
    e.preventDefault();
    setSubmittingAction(true);
    try {
      await lifecycleApi.initiatePromotion({
        ...promotionForm,
        supportingDocuments: promotionForm.salaryRevisionRemark ? [promotionForm.salaryRevisionRemark] : [],
      });
      showToast('Promotion workflow initiated and routed for Director approval!', 'success');
      setPromotionModalOpen(false);
      loadAllEvents();
    } catch (err) {
      showToast(err.response?.data?.message || 'Promotion initiation failed', 'error');
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleInitiateTransfer = async (e) => {
    e.preventDefault();
    setSubmittingAction(true);
    try {
      await lifecycleApi.initiateTransfer({
        ...transferForm,
        transferReason: transferForm.transferReason || 'Branch/department relocation',
      });
      showToast('Transfer workflow initiated and routed to destination branch!', 'success');
      setTransferModalOpen(false);
      loadAllEvents();
    } catch (err) {
      showToast(err.response?.data?.message || 'Transfer initiation failed', 'error');
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleInitiateExit = async (e) => {
    e.preventDefault();
    setSubmittingAction(true);
    try {
      const res = await lifecycleApi.initiateExit({
        employeeId: exitForm.employeeId,
        exitReason: exitForm.exitReason,
        resignationDate: exitForm.resignationDate,
        lastWorkingDay: exitForm.lastWorkingDay,
        supportingDocuments: exitForm.reason ? [exitForm.reason] : [],
      });
      showToast('Exit workflow initiated & live clearance checklist generated!', 'warning');
      setExitModalOpen(false);
      loadAllEvents();
      const createdEvent = res?.data || res;
      if (createdEvent?._id) {
        handleOpenChecklist(createdEvent);
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Exit initiation failed', 'error');
    } finally {
      setSubmittingAction(false);
    }
  };

  // -------------------------------------------------------------------------
  // DECISION WORKFLOW (PUT /lifecycle-events/:id/decide)
  // -------------------------------------------------------------------------
  const openDecideModal = (event, choice = 'APPROVED') => {
    setSelectedEvent(event);
    setDecisionChoice(choice);
    setExtendedByMonths(3);
    setDecisionRemark(
      choice === 'APPROVED'
        ? 'Transition approved and verified'
        : choice === 'EXTENDED'
        ? 'Probation period extended based on evaluation'
        : ''
    );
    setDecideModalOpen(true);
  };

  const handleSaveDecision = async (e) => {
    e.preventDefault();
    setSubmittingDecision(true);
    try {
      await lifecycleApi.decideLifecycleEvent(selectedEvent._id, {
        decision: decisionChoice,
        extendedByMonths: decisionChoice === 'EXTENDED' ? Number(extendedByMonths) : undefined,
        remark: decisionRemark,
      });
      showToast(`Lifecycle decision '${decisionChoice}' recorded successfully!`, 'success');
      setDecideModalOpen(false);
      loadAllEvents();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to submit decision', 'error');
    } finally {
      setSubmittingDecision(false);
    }
  };

  // -------------------------------------------------------------------------
  // EXIT CLEARANCE CHECKLIST (GET /checklist & PUT /confirm & PUT /finalize-exit)
  // -------------------------------------------------------------------------
  const handleOpenChecklist = async (event) => {
    setActiveExitEvent(event);
    setActiveTab('clearance');
    setLoadingChecklist(true);
    try {
      const res = await lifecycleApi.getExitChecklist(event._id);
      setChecklist(res?.data || res);
    } catch (err) {
      showToast('Failed to load live multi-module exit checklist', 'error');
    } finally {
      setLoadingChecklist(false);
    }
  };

  const openConfirmItemModal = (itemKey) => {
    setTargetItemKey(itemKey);
    setItemRemarks('Verified and physically handed over / cleared');
    setConfirmItemModalOpen(true);
  };

  const handleConfirmItem = async (e) => {
    e.preventDefault();
    setSubmittingItemConfirm(true);
    try {
      await lifecycleApi.confirmChecklistItem(activeExitEvent._id, targetItemKey, {
        remark: itemRemarks,
      });
      showToast(`Checklist item '${targetItemKey}' verified and cleared!`, 'success');
      setConfirmItemModalOpen(false);
      // Reload checklist
      const res = await lifecycleApi.getExitChecklist(activeExitEvent._id);
      setChecklist(res?.data || res);
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to confirm checklist item', 'error');
    } finally {
      setSubmittingItemConfirm(false);
    }
  };

  const handleFinalizeExit = async () => {
    const isConfirmed = await confirm({
      title: 'Finalize Employee Exit & Revoke Access',
      message:
        'Are you sure you want to finalize this exit? This will permanently mark employeeStatus=EXITED, immediately revoke user login credentials, and trigger full-and-final (FNF) settlement.',
      confirmText: 'Finalize Exit & Revoke Access',
      cancelText: 'Cancel',
      variant: 'danger',
    });
    if (!isConfirmed) return;

    setSubmittingFinalize(true);
    try {
      await lifecycleApi.finalizeExit(activeExitEvent._id);
      showToast('Exit finalized! Employee status set to EXITED and portal login revoked.', 'success');
      loadAllEvents();
      setActiveTab('events');
    } catch (err) {
      showToast(err.response?.data?.message || 'Gated exit failed: All checklist items must be 100% cleared.', 'error');
    } finally {
      setSubmittingFinalize(false);
    }
  };

  // -------------------------------------------------------------------------
  // DETAILS VIEW (GET /lifecycle-events/:id)
  // -------------------------------------------------------------------------
  const handleViewDetails = async (event) => {
    setLoadingDetails(true);
    setDetailsModalOpen(true);
    try {
      const res = await lifecycleApi.getLifecycleEventById(event._id);
      setActiveEventDetails(res?.data || res || event);
    } catch (err) {
      setActiveEventDetails(event);
    } finally {
      setLoadingDetails(false);
    }
  };

  // -------------------------------------------------------------------------
  // METRICS COMPUTATIONS
  // -------------------------------------------------------------------------
  const totalEvents = events.length;
  const pendingApprovalsCount = events.filter(
    (ev) => ev.status === 'PENDING' || ev.status === 'PENDING_APPROVAL'
  ).length;
  const confirmationsCount = events.filter(
    (ev) => (ev.type || ev.eventType) === 'CONFIRMATION'
  ).length;
  const promotionsCount = events.filter(
    (ev) => (ev.type || ev.eventType) === 'PROMOTION'
  ).length;
  const transfersCount = events.filter(
    (ev) => (ev.type || ev.eventType) === 'TRANSFER'
  ).length;
  const exitsCount = events.filter(
    (ev) => (ev.type || ev.eventType) === 'EXIT'
  ).length;

  // Filtered Events
  const filteredEvents = events.filter((ev) => {
    const evType = ev.type || ev.eventType || '';
    if (eventTypeFilter !== 'ALL' && evType !== eventTypeFilter) return false;
    if (statusFilter !== 'ALL' && (ev.status || '') !== statusFilter) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const empName = (
        ev.employee?.basicInfo?.fullName ||
        ev.employee?.name ||
        `${ev.employee?.firstName || ''} ${ev.employee?.lastName || ''}`
      ).toLowerCase();
      const empCode = (ev.employee?.basicInfo?.employeeCode || ev.employee?.employeeCode || '').toLowerCase();
      const des = (ev.employee?.designation?.title || ev.employee?.designation?.name || '').toLowerCase();
      const typeStr = evType.toLowerCase();
      return empName.includes(q) || empCode.includes(q) || des.includes(q) || typeStr.includes(q);
    }
    return true;
  });

  const pendingApprovalsList = events.filter(
    (ev) => ev.status === 'PENDING' || ev.status === 'PENDING_APPROVAL'
  );

  // -------------------------------------------------------------------------
  // TABLE COLUMNS CONFIGURATION
  // -------------------------------------------------------------------------
  const eventColumns = [
    {
      header: 'Employee',
      key: 'employee',
      render: (r) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: '8px',
              backgroundColor: 'var(--primary-light, #e0e7ff)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--primary, #4f46e5)',
              flexShrink: 0,
            }}
          >
            <GitFork size={18} />
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>
              {r.employee?.basicInfo?.fullName ||
                r.employee?.name ||
                (r.employee?.firstName ? `${r.employee.firstName} ${r.employee.lastName || ''}`.trim() : 'Staff Member')}
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              {r.employee?.basicInfo?.employeeCode || r.employee?.employeeCode || 'EMP-ID'} •{' '}
              {r.employee?.designation?.title ||
                r.employee?.designation?.name ||
                (typeof r.employee?.designation === 'string' ? r.employee.designation : 'Staff')}
            </div>
          </div>
        </div>
      ),
    },
    {
      header: 'Transition Type',
      key: 'type',
      render: (r) => {
        const t = r.type || r.eventType || 'CONFIRMATION';
        const map = {
          CONFIRMATION: { label: 'Confirmation', variant: 'success', icon: Award },
          PROMOTION: { label: 'Promotion', variant: 'primary', icon: TrendingUp },
          TRANSFER: { label: 'Transfer', variant: 'purple', icon: ArrowRightLeft },
          EXIT: { label: 'Exit / FNF', variant: 'danger', icon: LogOut },
        };
        const cfg = map[t] || { label: t, variant: 'secondary', icon: GitFork };
        const Icon = cfg.icon;
        return (
          <Badge variant={cfg.variant}>
            {Icon && <Icon size={12} style={{ marginRight: 4 }} />}
            {cfg.label}
          </Badge>
        );
      },
    },
    {
      header: 'Transition Details',
      key: 'details',
      render: (r) => {
        const t = r.type || r.eventType;
        if (t === 'PROMOTION') {
          return (
            <div style={{ fontSize: '0.82rem' }}>
              <div style={{ fontWeight: 600, color: 'var(--primary)' }}>
                {r.newDesignation || r.promotionDetails?.newDesignation || 'Designation Upgrade'}
              </div>
              <div style={{ color: 'var(--text-muted)' }}>
                {r.effectiveFromPayrollPeriod ? `Period: ${r.effectiveFromPayrollPeriod}` : 'Payroll structure revised'}
              </div>
            </div>
          );
        }
        if (t === 'TRANSFER') {
          return (
            <div style={{ fontSize: '0.82rem' }}>
              <div>Branch: <strong>{r.newBranch || r.transferDetails?.newBranch || 'Relocated'}</strong></div>
              <div style={{ color: 'var(--text-muted)' }}>{r.transferReason || r.reason || 'Operational relocation'}</div>
            </div>
          );
        }
        if (t === 'EXIT') {
          return (
            <div style={{ fontSize: '0.82rem' }}>
              <div style={{ fontWeight: 600, color: 'var(--danger, #ef4444)' }}>
                {r.exitReason || r.exitType || 'RESIGNATION'}
              </div>
              <div style={{ color: 'var(--text-muted)' }}>
                LWD: {r.lastWorkingDay ? new Date(r.lastWorkingDay).toLocaleDateString() : 'Pending'}
              </div>
            </div>
          );
        }
        return (
          <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            Probation Sign-Off
          </div>
        );
      },
    },
    {
      header: 'Effective Date',
      key: 'effectiveDate',
      render: (r) => (
        <span style={{ fontSize: '0.85rem' }}>
          {new Date(r.effectiveDate || r.lastWorkingDay || Date.now()).toLocaleDateString()}
        </span>
      ),
    },
    {
      header: 'Status',
      key: 'status',
      render: (r) => {
        const s = r.status || 'PENDING';
        const colors = {
          PENDING: 'warning',
          PENDING_APPROVAL: 'warning',
          APPROVED: 'success',
          REJECTED: 'danger',
          EXTENDED: 'purple',
          CLEARANCE_IN_PROGRESS: 'primary',
          FINALIZED: 'purple',
          COMPLETED: 'success',
          EXITED: 'danger',
        };
        return <Badge variant={colors[s] || 'secondary'}>{s}</Badge>;
      },
    },
    {
      header: 'Actions',
      key: 'actions',
      render: (r) => {
        const t = r.type || r.eventType;
        const isExit = t === 'EXIT';
        const isPending = r.status === 'PENDING' || r.status === 'PENDING_APPROVAL';

        return (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <Button size="sm" variant="secondary" icon={Eye} onClick={() => handleViewDetails(r)}>
              Details
            </Button>
            {isExit && (
              <Button size="sm" variant="primary" icon={FileCheck} onClick={() => handleOpenChecklist(r)}>
                Checklist
              </Button>
            )}
            {isPending && canManage && (
              <>
                <Button size="sm" variant="primary" icon={Check} onClick={() => openDecideModal(r, 'APPROVED')}>
                  Approve
                </Button>
                <Button size="sm" variant="danger" icon={X} onClick={() => openDecideModal(r, 'REJECTED')}>
                  Reject
                </Button>
                {t === 'CONFIRMATION' && (
                  <Button size="sm" variant="outline" onClick={() => openDecideModal(r, 'EXTENDED')}>
                    Extend
                  </Button>
                )}
              </>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* 1. Header Banner */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 16,
          backgroundColor: 'var(--bg-surface)',
          padding: '20px 24px',
          borderRadius: 'var(--radius-lg, 12px)',
          border: '1px solid var(--border-color)',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: '10px',
                backgroundColor: 'var(--primary-light, #e0e7ff)',
                color: 'var(--primary, #4f46e5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <GitFork size={22} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.35rem', fontWeight: 700, margin: 0 }}>
                Employee Lifecycle Management
              </h2>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                5 Gated Transitions: Confirmation • Promotion • Relocation Transfer • Exit / F&F Settlement • Multi-Module Clearance
              </div>
            </div>
          </div>
        </div>

        {canManage && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Button variant="outline" icon={Award} onClick={() => setConfirmationModalOpen(true)}>
              Confirmation
            </Button>
            <Button variant="outline" icon={TrendingUp} onClick={() => setPromotionModalOpen(true)}>
              Promotion
            </Button>
            <Button variant="outline" icon={ArrowRightLeft} onClick={() => setTransferModalOpen(true)}>
              Transfer
            </Button>
            <Button variant="danger" icon={LogOut} onClick={() => setExitModalOpen(true)}>
              Initiate Exit
            </Button>
          </div>
        )}
      </div>

      {/* 2. Top Metric Analytics Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
          gap: 16,
        }}
      >
        <div className="card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 10,
              backgroundColor: 'rgba(79, 70, 229, 0.1)',
              color: '#4f46e5',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <GitFork size={22} />
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 500 }}>Total Transitions</div>
            <div style={{ fontSize: '1.45rem', fontWeight: 700 }}>{totalEvents}</div>
          </div>
        </div>

        <div className="card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 10,
              backgroundColor: 'rgba(234, 179, 8, 0.1)',
              color: '#eab308',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Clock size={22} />
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 500 }}>Pending Sign-Offs</div>
            <div style={{ fontSize: '1.45rem', fontWeight: 700, color: '#eab308' }}>
              {pendingApprovalsCount}
            </div>
          </div>
        </div>

        <div className="card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 10,
              backgroundColor: 'rgba(34, 197, 94, 0.1)',
              color: '#22c55e',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Award size={22} />
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 500 }}>Confirmations</div>
            <div style={{ fontSize: '1.45rem', fontWeight: 700, color: '#22c55e' }}>{confirmationsCount}</div>
          </div>
        </div>

        <div className="card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 10,
              backgroundColor: 'rgba(168, 85, 247, 0.1)',
              color: '#a855f7',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <TrendingUp size={22} />
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 500 }}>Promotions & Roles</div>
            <div style={{ fontSize: '1.45rem', fontWeight: 700 }}>{promotionsCount}</div>
          </div>
        </div>

        <div className="card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 10,
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              color: '#ef4444',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <LogOut size={22} />
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 500 }}>Exit & F&F Pipelines</div>
            <div style={{ fontSize: '1.45rem', fontWeight: 700, color: '#ef4444' }}>{exitsCount}</div>
          </div>
        </div>
      </div>

      {/* 3. Navigation Tabs */}
      <div
        style={{
          display: 'flex',
          gap: 6,
          borderBottom: '1px solid var(--border-color)',
          overflowX: 'auto',
          paddingBottom: 2,
        }}
      >
        {canManage && (
          <button
            type="button"
            onClick={() => setActiveTab('events')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '12px 18px',
              border: 'none',
              background: 'none',
              borderBottom: activeTab === 'events' ? '3px solid var(--primary)' : '3px solid transparent',
              color: activeTab === 'events' ? 'var(--primary)' : 'var(--text-muted)',
              fontWeight: activeTab === 'events' ? 700 : 500,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            <GitFork size={16} />
            <span>All Transitions ({events.length})</span>
          </button>
        )}

        <button
          type="button"
          onClick={() => setActiveTab('self')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '12px 18px',
            border: 'none',
            background: 'none',
            borderBottom: activeTab === 'self' ? '3px solid var(--primary)' : '3px solid transparent',
            color: activeTab === 'self' ? 'var(--primary)' : 'var(--text-muted)',
            fontWeight: activeTab === 'self' ? 700 : 500,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          <UserCheck size={16} />
          <span>My Transitions ({myEvents.length})</span>
        </button>

        {canManage && (
          <button
            type="button"
            onClick={() => setActiveTab('approvals')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '12px 18px',
              border: 'none',
              background: 'none',
              borderBottom: activeTab === 'approvals' ? '3px solid var(--primary)' : '3px solid transparent',
              color: activeTab === 'approvals' ? 'var(--primary)' : 'var(--text-muted)',
              fontWeight: activeTab === 'approvals' ? 700 : 500,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            <Clock size={16} />
            <span>Pending Approvals Queue ({pendingApprovalsList.length})</span>
          </button>
        )}

        {canManage && (
          <button
            type="button"
            onClick={() => {
              setActiveTab('employeeHistory');
              if (selectedEmployeeId) loadEmployeeHistory(selectedEmployeeId);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '12px 18px',
              border: 'none',
              background: 'none',
              borderBottom: activeTab === 'employeeHistory' ? '3px solid var(--primary)' : '3px solid transparent',
              color: activeTab === 'employeeHistory' ? 'var(--primary)' : 'var(--text-muted)',
              fontWeight: activeTab === 'employeeHistory' ? 700 : 500,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            <Users size={16} />
            <span>Employee History Explorer</span>
          </button>
        )}

        {activeExitEvent && (
          <button
            type="button"
            onClick={() => setActiveTab('clearance')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '12px 18px',
              border: 'none',
              background: 'none',
              borderBottom: activeTab === 'clearance' ? '3px solid var(--primary)' : '3px solid transparent',
              color: activeTab === 'clearance' ? 'var(--primary)' : 'var(--text-muted)',
              fontWeight: activeTab === 'clearance' ? 700 : 500,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            <ShieldCheck size={16} />
            <span>Exit Clearance ({activeExitEvent.employee?.firstName || 'Active Exit'})</span>
          </button>
        )}
      </div>

      {/* ===================================================================== */}
      {/* TAB 1: ALL LIFECYCLE EVENTS */}
      {/* ===================================================================== */}
      {activeTab === 'events' && (
        <div className="card">
          {/* Filter Bar */}
          <div
            style={{
              padding: '14px 18px',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 12,
              backgroundColor: 'var(--bg-subtle, #f8fafc)',
            }}
          >
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              {/* Search */}
              <div style={{ position: 'relative', width: 220 }}>
                <Search size={15} style={{ position: 'absolute', left: 10, top: 10, color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  placeholder="Search staff, code, role..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '6px 10px 6px 32px',
                    borderRadius: 6,
                    border: '1px solid var(--border-color)',
                    fontSize: '0.85rem',
                    backgroundColor: 'var(--bg-surface)',
                  }}
                />
              </div>

              {/* Event Type Filter */}
              <div style={{ display: 'flex', gap: 4 }}>
                {['ALL', 'CONFIRMATION', 'PROMOTION', 'TRANSFER', 'EXIT'].map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setEventTypeFilter(t)}
                    className={`btn ${eventTypeFilter === t ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                    style={{ fontSize: '0.75rem', padding: '4px 10px' }}
                  >
                    {t}
                  </button>
                ))}
              </div>

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{
                  padding: '5px 10px',
                  borderRadius: 6,
                  border: '1px solid var(--border-color)',
                  fontSize: '0.82rem',
                  backgroundColor: 'var(--bg-surface)',
                }}
              >
                <option value="ALL">All Statuses</option>
                <option value="PENDING">Pending</option>
                <option value="PENDING_APPROVAL">Pending Approval</option>
                <option value="APPROVED">Approved</option>
                <option value="REJECTED">Rejected</option>
                <option value="COMPLETED">Completed</option>
              </select>
            </div>

            <Button size="sm" variant="secondary" icon={RefreshCw} onClick={loadAllEvents}>
              Refresh Registry
            </Button>
          </div>

          <Table
            columns={eventColumns}
            data={filteredEvents}
            loading={loadingEvents}
            emptyMessage="No lifecycle transition events found matching criteria."
          />
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 2: MY TRANSITIONS (SELF-SERVICE) */}
      {/* ===================================================================== */}
      {activeTab === 'self' && (
        <div className="card">
          <div
            style={{
              padding: '14px 18px',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: 'var(--bg-subtle, #f8fafc)',
            }}
          >
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>Personal Career Milestones</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Your formal probation confirmation, role promotions, relocation records, and exit statuses.
              </div>
            </div>
            <Button size="sm" variant="secondary" icon={RefreshCw} onClick={loadMyEvents}>
              Refresh
            </Button>
          </div>
          <Table
            columns={eventColumns}
            data={myEvents}
            loading={loadingMyEvents}
            emptyMessage="No personal lifecycle milestones recorded under your account."
          />
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 3: PENDING APPROVALS QUEUE */}
      {/* ===================================================================== */}
      {activeTab === 'approvals' && (
        <div className="card">
          <div
            style={{
              padding: '14px 18px',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: 'var(--bg-subtle, #f8fafc)',
            }}
          >
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>Pending Approval Actions</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Lifecycle transitions requiring HR, Manager, or Executive Director sign-off.
              </div>
            </div>
            <Button size="sm" variant="secondary" icon={RefreshCw} onClick={loadAllEvents}>
              Refresh Queue
            </Button>
          </div>
          <Table
            columns={eventColumns}
            data={pendingApprovalsList}
            loading={loadingEvents}
            emptyMessage="No pending transitions currently awaiting approval."
          />
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 4: EMPLOYEE HISTORY EXPLORER (GET /lifecycle-events/employees/:id) */}
      {/* ===================================================================== */}
      {activeTab === 'employeeHistory' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card" style={{ padding: 18 }}>
            <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div style={{ flex: '1', minWidth: 280 }}>
                <Select
                  label="Select Employee to View Complete Lifecycle History"
                  value={selectedEmployeeId}
                  onChange={(e) => {
                    setSelectedEmployeeId(e.target.value);
                    loadEmployeeHistory(e.target.value);
                  }}
                  options={employees.map((emp) => ({
                    value: emp._id || emp.id,
                    label: formatEmployeeOption(emp, true),
                  }))}
                />
              </div>
              <Button
                variant="secondary"
                icon={RefreshCw}
                onClick={() => loadEmployeeHistory(selectedEmployeeId)}
                disabled={!selectedEmployeeId}
              >
                Fetch History
              </Button>
            </div>
          </div>

          <div className="card">
            <div
              style={{
                padding: '14px 18px',
                borderBottom: '1px solid var(--border-color)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                backgroundColor: 'var(--bg-subtle, #f8fafc)',
              }}
            >
              <div style={{ fontWeight: 600, fontSize: '0.92rem' }}>
                Complete Career History for Selected Staff ({employeeHistory.length} Events)
              </div>
            </div>
            <Table
              columns={eventColumns}
              data={employeeHistory}
              loading={loadingEmployeeHistory}
              emptyMessage="No lifecycle records logged for this employee."
            />
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 5: LIVE EXIT & FNF CLEARANCE CHECKLIST */}
      {/* ===================================================================== */}
      {activeTab === 'clearance' && activeExitEvent && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* Clearance Header Card */}
          <div
            style={{
              padding: 20,
              borderRadius: 'var(--radius-lg, 12px)',
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border-color)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 16,
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Badge variant="danger">
                  <LogOut size={12} style={{ marginRight: 4 }} />
                  {activeExitEvent.exitReason || activeExitEvent.exitType || 'EXIT'}
                </Badge>
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700 }}>
                  Exit Clearance: {activeExitEvent.employee?.basicInfo?.fullName || activeExitEvent.employee?.name || `${activeExitEvent.employee?.firstName || ''} ${activeExitEvent.employee?.lastName || ''}`} ({activeExitEvent.employee?.basicInfo?.employeeCode || activeExitEvent.employee?.employeeCode || 'EMP'})
                </h3>
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: 4 }}>
                Last Working Day:{' '}
                <strong>
                  {activeExitEvent.lastWorkingDay
                    ? new Date(activeExitEvent.lastWorkingDay).toLocaleDateString()
                    : 'Not specified'}
                </strong>{' '}
                • Live Verification across Assets (M20), Loans (M19), Payroll (M17), Leaves (M12), and IT.
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <Button
                variant="secondary"
                size="sm"
                icon={RefreshCw}
                onClick={() => handleOpenChecklist(activeExitEvent)}
              >
                Re-evaluate Live
              </Button>
              <Button
                variant="danger"
                icon={ShieldCheck}
                loading={submittingFinalize}
                disabled={
                  (checklist?.isAllCleared === false ||
                    (checklist?.clearedPercentage !== undefined && checklist.clearedPercentage < 100)) &&
                  !isSuperAdmin
                }
                onClick={handleFinalizeExit}
              >
                Finalize Exit & Revoke Access
              </Button>
            </div>
          </div>

          {/* Clearance Progress & Items */}
          <div className="card" style={{ padding: 22 }}>
            {loadingChecklist ? (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                <RefreshCw size={24} className="spin" style={{ marginBottom: 10 }} />
                <div>Evaluating live multi-module clearances from core database...</div>
              </div>
            ) : checklist ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {/* Progress Bar */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>
                      Exit Gate Progress: {checklist.clearedCount !== undefined ? `${checklist.clearedCount} of ${checklist.totalCount} Cleared` : ''}
                    </div>
                    <Badge variant={checklist.clearedPercentage === 100 || checklist.isAllCleared ? 'success' : 'warning'}>
                      {checklist.clearedPercentage ?? (checklist.isAllCleared ? 100 : 0)}% Cleared
                    </Badge>
                  </div>
                  <div
                    style={{
                      height: 10,
                      width: '100%',
                      backgroundColor: 'var(--bg-subtle, #f1f5f9)',
                      borderRadius: 6,
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        height: '100%',
                        width: `${checklist.clearedPercentage ?? (checklist.isAllCleared ? 100 : 0)}%`,
                        backgroundColor:
                          (checklist.clearedPercentage === 100 || checklist.isAllCleared) ? '#22c55e' : '#eab308',
                        transition: 'width 0.3s ease',
                      }}
                    />
                  </div>
                </div>

                {/* Items List */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {Array.isArray(checklist.checklist || checklist.items) &&
                  (checklist.checklist || checklist.items).length > 0 ? (
                    (checklist.checklist || checklist.items).map((item, idx) => {
                      const isCleared = item.isCleared || item.status === 'CLEARED';
                      const isAuto = item.clearanceType === 'AUTO' || item.autoVerified;
                      return (
                        <div
                          key={item.itemKey || item.key || idx}
                          style={{
                            padding: '14px 16px',
                            border: '1px solid var(--border-color)',
                            borderRadius: 8,
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            backgroundColor: isCleared ? 'rgba(34, 197, 94, 0.05)' : 'var(--bg-subtle, #f8fafc)',
                          }}
                        >
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              {isCleared ? (
                                <CheckCircle2 size={18} color="#22c55e" />
                              ) : (
                                <AlertTriangle size={18} color="#eab308" />
                              )}
                              <span style={{ fontWeight: 600, fontSize: '0.92rem' }}>
                                {item.label || item.itemKey || item.key}
                              </span>
                              {item.module && (
                                <Badge variant="secondary" style={{ fontSize: '0.7rem' }}>
                                  {item.module}
                                </Badge>
                              )}
                            </div>
                            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 4 }}>
                              {isAuto
                                ? 'Automatically verified by live database query across corresponding module'
                                : 'Manual department handover / letter confirmation required'}
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <Badge variant={isCleared ? 'success' : 'warning'}>
                              {isCleared ? 'CLEARED' : 'PENDING'}
                            </Badge>
                            {!isCleared && !isAuto && canManage && (
                              <Button
                                size="sm"
                                variant="primary"
                                onClick={() => openConfirmItemModal(item.itemKey || item.key)}
                              >
                                Sign Off Item
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                      No clearance checklist items generated yet for this exit event.
                    </div>
                  )}
                </div>

                {/* Gated Note */}
                <div
                  style={{
                    padding: 12,
                    borderRadius: 8,
                    backgroundColor: 'rgba(239, 68, 68, 0.06)',
                    border: '1px solid rgba(239, 68, 68, 0.2)',
                    fontSize: '0.82rem',
                    color: 'var(--danger, #dc2626)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <Info size={16} />
                  <span>
                    <strong>Gated Exit Protection:</strong> Full-and-Final settlement computation and automated user credential revocation will only execute when all checklist items reach 100% clearance.
                  </span>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 4. MODALS */}
      {/* ===================================================================== */}

      {/* 1. INITIATE CONFIRMATION MODAL */}
      <Modal
        isOpen={confirmationModalOpen}
        onClose={() => setConfirmationModalOpen(false)}
        title="Initiate Employee Confirmation (Probation Sign-Off)"
      >
        <form onSubmit={handleInitiateConfirmation}>
          <Select
            label="Select Employee on Probation"
            placeholder="Select Employee..."
            value={confirmationForm.employeeId}
            onChange={(e) => setConfirmationForm({ ...confirmationForm, employeeId: e.target.value })}
            options={employees.map((emp) => ({
              value: emp._id || emp.id,
              label: formatEmployeeOption(emp, true),
            }))}
            required
          />
          <Input
            label="Effective Confirmation Date"
            type="date"
            value={confirmationForm.effectiveDate}
            onChange={(e) => setConfirmationForm({ ...confirmationForm, effectiveDate: e.target.value })}
            required
          />
          <Input
            label="Probation Evaluation Remarks"
            placeholder="e.g. Completed 6-month probation successfully with commendable performance"
            value={confirmationForm.remarks}
            onChange={(e) => setConfirmationForm({ ...confirmationForm, remarks: e.target.value })}
            required
          />

          <div className="modal-footer" style={{ margin: '20px -20px -20px' }}>
            <Button variant="secondary" onClick={() => setConfirmationModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" loading={submittingAction}>
              Initiate Confirmation
            </Button>
          </div>
        </form>
      </Modal>

      {/* 2. INITIATE PROMOTION MODAL */}
      <Modal
        isOpen={promotionModalOpen}
        onClose={() => setPromotionModalOpen(false)}
        title="Initiate Employee Promotion"
      >
        <form onSubmit={handleInitiatePromotion}>
          <Select
            label="Select Employee"
            placeholder="Select Employee..."
            value={promotionForm.employeeId}
            onChange={(e) => setPromotionForm({ ...promotionForm, employeeId: e.target.value })}
            options={employees.map((emp) => ({
              value: emp._id || emp.id,
              label: formatEmployeeOption(emp, true),
            }))}
            required
          />
          <Select
            label="New Designation / Title"
            value={promotionForm.newDesignation}
            onChange={(e) => setPromotionForm({ ...promotionForm, newDesignation: e.target.value })}
            options={designations.map((d) => ({
              value: d.title || d.name || d._id,
              label: d.title || d.name,
            }))}
            required
          />
          <div className="grid-2">
            <Input
              label="New Salary Structure / Grade"
              placeholder="e.g. Band A - Lead Grade"
              value={promotionForm.newSalaryStructure}
              onChange={(e) => setPromotionForm({ ...promotionForm, newSalaryStructure: e.target.value })}
            />
            <Input
              label="Effective From Payroll Period"
              type="month"
              value={promotionForm.effectiveFromPayrollPeriod}
              onChange={(e) => setPromotionForm({ ...promotionForm, effectiveFromPayrollPeriod: e.target.value })}
              required
            />
          </div>
          <Input
            label="Effective Promotion Date"
            type="date"
            value={promotionForm.effectiveDate}
            onChange={(e) => setPromotionForm({ ...promotionForm, effectiveDate: e.target.value })}
            required
          />
          <Input
            label="Salary / Grade Revision Justification"
            placeholder="e.g. Annual appraisal recommendation and expanded scope of responsibilities"
            value={promotionForm.salaryRevisionRemark}
            onChange={(e) => setPromotionForm({ ...promotionForm, salaryRevisionRemark: e.target.value })}
            required
          />

          <div className="modal-footer" style={{ margin: '20px -20px -20px' }}>
            <Button variant="secondary" onClick={() => setPromotionModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" loading={submittingAction}>
              Initiate Promotion
            </Button>
          </div>
        </form>
      </Modal>

      {/* 3. INITIATE TRANSFER MODAL */}
      <Modal
        isOpen={transferModalOpen}
        onClose={() => setTransferModalOpen(false)}
        title="Initiate Relocation / Department Transfer"
      >
        <form onSubmit={handleInitiateTransfer}>
          <Select
            label="Select Employee"
            placeholder="Select Employee..."
            value={transferForm.employeeId}
            onChange={(e) => setTransferForm({ ...transferForm, employeeId: e.target.value })}
            options={employees.map((emp) => ({
              value: emp._id || emp.id,
              label: formatEmployeeOption(emp, true),
            }))}
            required
          />
          <div className="grid-2">
            <Select
              label="New Branch / Site Location"
              value={transferForm.newBranch}
              onChange={(e) => setTransferForm({ ...transferForm, newBranch: e.target.value })}
              options={branches.map((b) => ({ value: b.name || b._id, label: b.name }))}
              required
            />
            <Select
              label="New Department"
              value={transferForm.newDepartment}
              onChange={(e) => setTransferForm({ ...transferForm, newDepartment: e.target.value })}
              options={departments.map((d) => ({ value: d.name || d._id, label: d.name }))}
            />
          </div>
          <Input
            label="Effective Transfer Date"
            type="date"
            value={transferForm.effectiveDate}
            onChange={(e) => setTransferForm({ ...transferForm, effectiveDate: e.target.value })}
            required
          />
          <Input
            label="Transfer Reason"
            placeholder="e.g. Operational expansion at regional hub"
            value={transferForm.transferReason}
            onChange={(e) => setTransferForm({ ...transferForm, transferReason: e.target.value })}
            required
          />

          <div className="modal-footer" style={{ margin: '20px -20px -20px' }}>
            <Button variant="secondary" onClick={() => setTransferModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" loading={submittingAction}>
              Initiate Transfer
            </Button>
          </div>
        </form>
      </Modal>

      {/* 4. INITIATE EXIT MODAL */}
      <Modal
        isOpen={exitModalOpen}
        onClose={() => setExitModalOpen(false)}
        title="Initiate Employee Exit & Generate Live Clearance"
      >
        <form onSubmit={handleInitiateExit}>
          <Select
            label="Select Employee"
            placeholder="Select Employee..."
            value={exitForm.employeeId}
            onChange={(e) => setExitForm({ ...exitForm, employeeId: e.target.value })}
            options={employees.map((emp) => ({
              value: emp._id || emp.id,
              label: formatEmployeeOption(emp, true),
            }))}
            required
          />
          <div className="grid-2">
            <Select
              label="Exit Reason Type"
              value={exitForm.exitReason}
              onChange={(e) => setExitForm({ ...exitForm, exitReason: e.target.value })}
              options={[
                { value: 'RESIGNATION', label: 'Voluntary Resignation' },
                { value: 'TERMINATION', label: 'Company Termination' },
                { value: 'RETIREMENT', label: 'Superannuation / Retirement' },
                { value: 'END_OF_CONTRACT', label: 'End of Contract' },
                { value: 'OTHER', label: 'Other Separation' },
              ]}
              required
            />
            <Input
              label="Resignation / Notice Date"
              type="date"
              value={exitForm.resignationDate}
              onChange={(e) => setExitForm({ ...exitForm, resignationDate: e.target.value })}
              required
            />
          </div>
          <Input
            label="Last Working Day"
            type="date"
            value={exitForm.lastWorkingDay}
            onChange={(e) => setExitForm({ ...exitForm, lastWorkingDay: e.target.value })}
            required
          />
          <Input
            label="Exit Details / Separation Notes"
            placeholder="e.g. Formal resignation letter tendered with 30-day notice period"
            value={exitForm.reason}
            onChange={(e) => setExitForm({ ...exitForm, reason: e.target.value })}
            required
          />

          <div className="modal-footer" style={{ margin: '20px -20px -20px' }}>
            <Button variant="secondary" onClick={() => setExitModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" type="submit" loading={submittingAction}>
              Initiate Exit & Create Checklist
            </Button>
          </div>
        </form>
      </Modal>

      {/* 5. DECISION MODAL (APPROVE / REJECT / EXTEND) */}
      <Modal
        isOpen={decideModalOpen}
        onClose={() => setDecideModalOpen(false)}
        title={`Decide Lifecycle Transition: ${selectedEvent?.type || selectedEvent?.eventType || ''}`}
      >
        <form onSubmit={handleSaveDecision}>
          <div
            style={{
              padding: 12,
              backgroundColor: 'var(--bg-subtle, #f8fafc)',
              borderRadius: 8,
              marginBottom: 14,
              fontSize: '0.86rem',
            }}
          >
            Staff:{' '}
            <strong>
              {selectedEvent?.employee?.basicInfo?.fullName ||
                selectedEvent?.employee?.name ||
                `${selectedEvent?.employee?.firstName || ''} ${selectedEvent?.employee?.lastName || ''}`}
            </strong>{' '}
            • Type: <strong>{selectedEvent?.type || selectedEvent?.eventType}</strong>
          </div>

          <Select
            label="Approval Decision"
            value={decisionChoice}
            onChange={(e) => setDecisionChoice(e.target.value)}
            options={[
              { value: 'APPROVED', label: 'Approve Transition' },
              { value: 'REJECTED', label: 'Reject Transition' },
              ...(selectedEvent?.type === 'CONFIRMATION' || selectedEvent?.eventType === 'CONFIRMATION'
                ? [{ value: 'EXTENDED', label: 'Extend Probation' }]
                : []),
            ]}
          />

          {decisionChoice === 'EXTENDED' && (
            <Input
              label="Extend Probation By (Months)"
              type="number"
              min="1"
              max="12"
              value={extendedByMonths}
              onChange={(e) => setExtendedByMonths(e.target.value)}
              required
            />
          )}

          <Input
            label="Decision Remarks / Justification"
            placeholder="Provide official rationale for this decision"
            value={decisionRemark}
            onChange={(e) => setDecisionRemark(e.target.value)}
            required={decisionChoice !== 'APPROVED'}
          />

          <div className="modal-footer" style={{ margin: '20px -20px -20px' }}>
            <Button variant="secondary" onClick={() => setDecideModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant={decisionChoice === 'APPROVED' ? 'primary' : decisionChoice === 'EXTENDED' ? 'secondary' : 'danger'}
              type="submit"
              loading={submittingDecision}
            >
              Confirm {decisionChoice}
            </Button>
          </div>
        </form>
      </Modal>

      {/* 6. CONFIRM CHECKLIST ITEM MODAL */}
      <Modal
        isOpen={confirmItemModalOpen}
        onClose={() => setConfirmItemModalOpen(false)}
        title={`Sign-Off Clearance Item: ${targetItemKey}`}
      >
        <form onSubmit={handleConfirmItem}>
          <div style={{ marginBottom: 12, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Confirming that this manual requirement has been fully verified and physically completed.
          </div>
          <Input
            label="Department Sign-Off Remarks"
            value={itemRemarks}
            onChange={(e) => setItemRemarks(e.target.value)}
            required
          />

          <div className="modal-footer" style={{ margin: '20px -20px -20px' }}>
            <Button variant="secondary" onClick={() => setConfirmItemModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" loading={submittingItemConfirm}>
              Confirm Item Clearance
            </Button>
          </div>
        </form>
      </Modal>

      {/* 7. EVENT DETAILS MODAL (GET /lifecycle-events/:id) */}
      <Modal
        isOpen={detailsModalOpen}
        onClose={() => setDetailsModalOpen(false)}
        title="Lifecycle Transition Audit Record"
        size="md"
      >
        {loadingDetails ? (
          <div style={{ textAlign: 'center', padding: 20 }}>Loading event record details...</div>
        ) : activeEventDetails ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div
              style={{
                padding: 14,
                backgroundColor: 'var(--bg-subtle, #f8fafc)',
                borderRadius: 8,
                border: '1px solid var(--border-color)',
              }}
            >
              <div style={{ fontWeight: 700, fontSize: '1rem' }}>
                {activeEventDetails.employee?.basicInfo?.fullName ||
                  activeEventDetails.employee?.name ||
                  `${activeEventDetails.employee?.firstName || ''} ${activeEventDetails.employee?.lastName || ''}`}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Code: {activeEventDetails.employee?.basicInfo?.employeeCode || activeEventDetails.employee?.employeeCode || '-'} •{' '}
                Designation: {activeEventDetails.employee?.designation?.title || activeEventDetails.employee?.designation?.name || '-'}
              </div>
            </div>

            <div className="grid-2" style={{ fontSize: '0.86rem' }}>
              <div>
                <strong>Event ID:</strong> {activeEventDetails._id || activeEventDetails.id}
              </div>
              <div>
                <strong>Transition Type:</strong> <Badge>{activeEventDetails.type || activeEventDetails.eventType}</Badge>
              </div>
              <div>
                <strong>Current Status:</strong> <Badge>{activeEventDetails.status}</Badge>
              </div>
              <div>
                <strong>Effective Date:</strong>{' '}
                {new Date(activeEventDetails.effectiveDate || activeEventDetails.lastWorkingDay || Date.now()).toLocaleDateString()}
              </div>
              {activeEventDetails.resignationDate && (
                <div>
                  <strong>Resignation Date:</strong>{' '}
                  {new Date(activeEventDetails.resignationDate).toLocaleDateString()}
                </div>
              )}
              {activeEventDetails.newDesignation && (
                <div>
                  <strong>New Designation:</strong> {activeEventDetails.newDesignation}
                </div>
              )}
              {activeEventDetails.newBranch && (
                <div>
                  <strong>New Branch:</strong> {activeEventDetails.newBranch}
                </div>
              )}
              {activeEventDetails.effectiveFromPayrollPeriod && (
                <div>
                  <strong>Effective Payroll Period:</strong> {activeEventDetails.effectiveFromPayrollPeriod}
                </div>
              )}
            </div>

            {activeEventDetails.remark || activeEventDetails.remarks ? (
              <div
                style={{
                  padding: 10,
                  borderRadius: 6,
                  backgroundColor: 'var(--bg-surface)',
                  border: '1px solid var(--border-color)',
                  fontSize: '0.84rem',
                }}
              >
                <strong>Remarks / Decision Audit:</strong> {activeEventDetails.remark || activeEventDetails.remarks}
              </div>
            ) : null}
          </div>
        ) : null}
      </Modal>
    </div>
  );
};

export default LifecycleEvents;
