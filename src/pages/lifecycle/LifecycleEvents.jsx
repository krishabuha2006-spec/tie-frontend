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
  Plus,
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
  Building,
  Briefcase,
  AlertTriangle,
  Award,
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

  // Active Tab: 'events' | 'self' | 'approvals' | 'clearance'
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
  const [eventTypeFilter, setEventTypeFilter] = useState('ALL');


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
    effectiveDate: new Date().toISOString().split('T')[0],
    salaryRevisionRemark: '',
  });

  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [transferForm, setTransferForm] = useState({
    employeeId: '',
    newBranch: '',
    newDepartment: '',
    effectiveDate: new Date().toISOString().split('T')[0],
    reason: '',
  });

  const [exitModalOpen, setExitModalOpen] = useState(false);
  const [exitForm, setExitForm] = useState({
    employeeId: '',
    exitType: 'RESIGNATION', // 'RESIGNATION' | 'TERMINATION' | 'RETIREMENT'
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
  const [decisionChoice, setDecisionChoice] = useState('APPROVED'); // 'APPROVED' | 'REJECTED'
  const [decisionRemark, setDecisionRemark] = useState('');
  const [submittingDecision, setSubmittingDecision] = useState(false);

  // =========================================================================
  // TAB 4: EXIT & FNF CLEARANCE CHECKLIST
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

  // -------------------------------------------------------------------------
  // INITIAL LOAD
  // -------------------------------------------------------------------------
  useEffect(() => {
    loadMasters();
  }, []);

  useEffect(() => {
    if (activeTab === 'events' || activeTab === 'approvals') loadAllEvents();
    else if (activeTab === 'self') loadMyEvents();
  }, [activeTab]);

  const loadMasters = async () => {
    try {
      const [eRes, desRes, depRes, bRes] = await Promise.all([
        employeeApi.getEmployees({ limit: 200 }).catch(() => ({ data: [] })),
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
        setConfirmationForm((prev) => ({ ...prev, employeeId: empList[0]._id || empList[0].id }));
        setPromotionForm((prev) => ({ ...prev, employeeId: empList[0]._id || empList[0].id }));
        setTransferForm((prev) => ({ ...prev, employeeId: empList[0]._id || empList[0].id }));
        setExitForm((prev) => ({ ...prev, employeeId: empList[0]._id || empList[0].id }));
      }
      if (desList.length > 0) setPromotionForm((prev) => ({ ...prev, newDesignation: desList[0]._id }));
      if (bList.length > 0) setTransferForm((prev) => ({ ...prev, newBranch: bList[0]._id }));
      if (depList.length > 0) setTransferForm((prev) => ({ ...prev, newDepartment: depList[0]._id }));
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
      setEvents(list);
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
      setMyEvents(list);
    } catch (err) {
      showToast('Failed to load personal transitions', 'error');
    } finally {
      setLoadingMyEvents(false);
    }
  };

  const handleInitiateConfirmation = async (e) => {
    e.preventDefault();
    setSubmittingAction(true);
    try {
      await lifecycleApi.initiateConfirmation(confirmationForm);
      showToast('Confirmation workflow initiated!', 'success');
      setConfirmationModalOpen(false);
      loadAllEvents();
    } catch (err) {
      showToast(err.response?.data?.message || 'Initiation failed', 'error');
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleInitiatePromotion = async (e) => {
    e.preventDefault();
    setSubmittingAction(true);
    try {
      await lifecycleApi.initiatePromotion(promotionForm);
      showToast('Promotion workflow initiated!', 'success');
      setPromotionModalOpen(false);
      loadAllEvents();
    } catch (err) {
      showToast(err.response?.data?.message || 'Initiation failed', 'error');
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleInitiateTransfer = async (e) => {
    e.preventDefault();
    setSubmittingAction(true);
    try {
      await lifecycleApi.initiateTransfer(transferForm);
      showToast('Transfer workflow initiated!', 'success');
      setTransferModalOpen(false);
      loadAllEvents();
    } catch (err) {
      showToast(err.response?.data?.message || 'Initiation failed', 'error');
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleInitiateExit = async (e) => {
    e.preventDefault();
    setSubmittingAction(true);
    try {
      const res = await lifecycleApi.initiateExit(exitForm);
      showToast('Exit workflow initiated and clearance checklist created!', 'warning');
      setExitModalOpen(false);
      loadAllEvents();
      if (res?.data?._id || res?._id) {
        handleOpenChecklist(res.data || res);
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Initiation failed', 'error');
    } finally {
      setSubmittingAction(false);
    }
  };

  const openDecideModal = (event, choice) => {
    setSelectedEvent(event);
    setDecisionChoice(choice);
    setDecisionRemark(choice === 'APPROVED' ? 'Transition approved and verified' : '');
    setDecideModalOpen(true);
  };

  const handleSaveDecision = async (e) => {
    e.preventDefault();
    setSubmittingDecision(true);
    try {
      await lifecycleApi.decideLifecycleEvent(selectedEvent._id, {
        decision: decisionChoice,
        remarks: decisionRemark,
      });
      showToast(`Lifecycle transition ${decisionChoice}!`, 'success');
      setDecideModalOpen(false);
      loadAllEvents();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to submit decision', 'error');
    } finally {
      setSubmittingDecision(false);
    }
  };

  // -------------------------------------------------------------------------
  // EXIT CLEARANCE CHECKLIST (MODULE 22 GATED GATEWAY)
  // -------------------------------------------------------------------------
  const handleOpenChecklist = async (event) => {
    setActiveExitEvent(event);
    setActiveTab('clearance');
    setLoadingChecklist(true);
    try {
      const res = await lifecycleApi.getExitChecklist(event._id);
      setChecklist(res?.data || res);
    } catch (err) {
      showToast('Failed to load live exit clearance checklist', 'error');
    } finally {
      setLoadingChecklist(false);
    }
  };

  const openConfirmItemModal = (itemKey) => {
    setTargetItemKey(itemKey);
    setItemRemarks('Verified and physically handed over');
    setConfirmItemModalOpen(true);
  };

  const handleConfirmItem = async (e) => {
    e.preventDefault();
    setSubmittingItemConfirm(true);
    try {
      await lifecycleApi.confirmChecklistItem(activeExitEvent._id, targetItemKey, {
        remarks: itemRemarks,
      });
      showToast('Clearance checklist item confirmed!', 'success');
      setConfirmItemModalOpen(false);
      // Reload checklist
      const res = await lifecycleApi.getExitChecklist(activeExitEvent._id);
      setChecklist(res?.data || res);
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to confirm item', 'error');
    } finally {
      setSubmittingItemConfirm(false);
    }
  };

  const handleFinalizeExit = async () => {
    const isConfirmed = await confirm({
      title: 'Finalize Employee Exit',
      message: 'Are you sure you want to finalize this employee exit? This will mark employeeStatus as EXITED, revoke portal logins, and initiate full-and-final settlement.',
      confirmText: 'Finalize Exit',
      cancelText: 'Cancel',
      variant: 'danger',
    });
    if (!isConfirmed) return;
    setSubmittingFinalize(true);
    try {
      await lifecycleApi.finalizeExit(activeExitEvent._id);
      showToast('Exit finalized! Employee marked as EXITED and access revoked.', 'success');
      loadAllEvents();
      setActiveTab('events');
    } catch (err) {
      showToast(err.response?.data?.message || 'Gated exit failed: clearance not 100%', 'error');
    } finally {
      setSubmittingFinalize(false);
    }
  };

  const handleViewDetails = async (event) => {
    try {
      const res = await lifecycleApi.getLifecycleEventById(event._id);
      setActiveEventDetails(res?.data || res || event);
    } catch (err) {
      setActiveEventDetails(event);
    }
    setDetailsModalOpen(true);
  };

  // Filtered Events
  const filteredEvents = events.filter((ev) => {
    if (eventTypeFilter === 'ALL') return true;
    return ev.type === eventTypeFilter || ev.eventType === eventTypeFilter;
  });

  const pendingApprovals = events.filter(
    (ev) => ev.status === 'PENDING_APPROVAL' || ev.status === 'PENDING'
  );

  // =========================================================================
  // TABLE COLUMNS
  // =========================================================================

  const eventColumns = [
    {
      header: 'Employee',
      key: 'employee',
      render: (r) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: '8px',
              backgroundColor: 'var(--primary-light)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--primary)',
            }}
          >
            <GitFork size={20} />
          </div>
          <div>
            <div style={{ fontWeight: 600 }}>
              {r.employee?.basicInfo?.fullName || r.employee?.name || (r.employee?.firstName ? `${r.employee.firstName} ${r.employee.lastName || ''}`.trim() : 'Staff Member')}
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              {r.employee?.basicInfo?.employeeCode || r.employee?.employeeCode || '-'} • {r.employee?.designation?.name || r.employee?.designation?.title || (typeof r.employee?.designation === 'string' ? r.employee.designation : 'Staff')}
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
        const cfg = map[t] || { label: t, variant: 'secondary' };
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
      header: 'Effective Date',
      key: 'effectiveDate',
      render: (r) => new Date(r.effectiveDate || r.lastWorkingDay || Date.now()).toLocaleDateString(),
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
          CLEARANCE_IN_PROGRESS: 'primary',
          FINALIZED: 'purple',
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
        return (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <Button size="sm" variant="secondary" icon={Eye} onClick={() => handleViewDetails(r)}>
              Details
            </Button>
            {isExit && (
              <Button size="sm" variant="primary" icon={FileCheck} onClick={() => handleOpenChecklist(r)}>
                Clearance Checklist
              </Button>
            )}
            {r.status === 'PENDING_APPROVAL' && canManage && (
              <>
                <Button size="sm" variant="primary" icon={Check} onClick={() => openDecideModal(r, 'APPROVED')}>
                  Approve
                </Button>
                <Button size="sm" variant="danger" icon={X} onClick={() => openDecideModal(r, 'REJECTED')}>
                  Reject
                </Button>
              </>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>
            Employee Lifecycle Transitions
          </h2>
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
            <Button variant="primary" icon={LogOut} onClick={() => setExitModalOpen(true)}>
              Initiate Exit
            </Button>
          </div>
        )}
      </div>

      {/* Tabs Navigation */}
      <div
        style={{
          display: 'flex',
          gap: 4,
          borderBottom: '1px solid var(--border-color)',
          overflowX: 'auto',
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
              padding: '10px 16px',
              border: 'none',
              background: 'none',
              borderBottom: activeTab === 'events' ? '3px solid var(--primary)' : '3px solid transparent',
              color: activeTab === 'events' ? 'var(--primary)' : 'var(--text-muted)',
              fontWeight: activeTab === 'events' ? 700 : 500,
              cursor: 'pointer',
            }}
          >
            <GitFork size={16} />
            <span>Lifecycle Registry ({events.length})</span>
          </button>
        )}

        <button
          type="button"
          onClick={() => setActiveTab('self')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 16px',
            border: 'none',
            background: 'none',
            borderBottom: activeTab === 'self' ? '3px solid var(--primary)' : '3px solid transparent',
            color: activeTab === 'self' ? 'var(--primary)' : 'var(--text-muted)',
            fontWeight: activeTab === 'self' ? 700 : 500,
            cursor: 'pointer',
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
              padding: '10px 16px',
              border: 'none',
              background: 'none',
              borderBottom: activeTab === 'approvals' ? '3px solid var(--primary)' : '3px solid transparent',
              color: activeTab === 'approvals' ? 'var(--primary)' : 'var(--text-muted)',
              fontWeight: activeTab === 'approvals' ? 700 : 500,
              cursor: 'pointer',
            }}
          >
            <Clock size={16} />
            <span>Pending Approvals ({pendingApprovals.length})</span>
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
              padding: '10px 16px',
              border: 'none',
              background: 'none',
              borderBottom: activeTab === 'clearance' ? '3px solid var(--primary)' : '3px solid transparent',
              color: activeTab === 'clearance' ? 'var(--primary)' : 'var(--text-muted)',
              fontWeight: activeTab === 'clearance' ? 700 : 500,
              cursor: 'pointer',
            }}
          >
            <ShieldCheck size={16} />
            <span>Exit Clearance ({activeExitEvent.employee?.firstName || 'Employee'})</span>
          </button>
        )}
      </div>

      {/* TAB 1: ALL LIFECYCLE EVENTS */}
      {activeTab === 'events' && (
        <div className="card">
          <div
            style={{
              padding: '14px 16px',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 12,
              backgroundColor: 'var(--bg-subtle)',
            }}
          >
            <div style={{ display: 'flex', gap: 6 }}>
              {['ALL', 'CONFIRMATION', 'PROMOTION', 'TRANSFER', 'EXIT'].map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setEventTypeFilter(t)}
                  className={`btn ${eventTypeFilter === t ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                >
                  {t}
                </button>
              ))}
            </div>
            <Button size="sm" variant="secondary" icon={RefreshCw} onClick={loadAllEvents}>
              Refresh Events
            </Button>
          </div>
          <Table columns={eventColumns} data={filteredEvents} loading={loadingEvents} emptyMessage="No lifecycle transition events recorded." />
        </div>
      )}

      {/* TAB 2: MY TRANSITIONS */}
      {activeTab === 'self' && (
        <div className="card">
          <div
            style={{
              padding: '14px 16px',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: 'var(--bg-subtle)',
            }}
          >
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Your career confirmation, promotions, relocations, and clearance records.
            </div>
            <Button size="sm" variant="secondary" icon={RefreshCw} onClick={loadMyEvents}>
              Refresh
            </Button>
          </div>
          <Table columns={eventColumns} data={myEvents} loading={loadingMyEvents} emptyMessage="No personal lifecycle events found." />
        </div>
      )}

      {/* TAB 3: PENDING APPROVALS */}
      {activeTab === 'approvals' && (
        <div className="card">
          <div
            style={{
              padding: '14px 16px',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: 'var(--bg-subtle)',
            }}
          >
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Transitions awaiting HR and Department Head sign-off.
            </div>
            <Button size="sm" variant="secondary" icon={RefreshCw} onClick={loadAllEvents}>
              Refresh
            </Button>
          </div>
          <Table columns={eventColumns} data={pendingApprovals} loading={loadingEvents} emptyMessage="No pending transitions awaiting approval." />
        </div>
      )}

      {/* TAB 4: LIVE EXIT CLEARANCE CHECKLIST */}
      {activeTab === 'clearance' && activeExitEvent && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div
            style={{
              padding: 16,
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border-color)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 12,
            }}
          >
            <div>
              <h3 style={{ margin: '0 0 4px', fontSize: '1.1rem' }}>
                Exit Clearance for {activeExitEvent.employee?.firstName} {activeExitEvent.employee?.lastName} ({activeExitEvent.employee?.employeeCode})
              </h3>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Multi-Module verification across Hardware Assets (M20), Loans & Advances (M19), Expense Claims (M18), Payroll (M17), and Leaves (M12).
              </div>
            </div>

            <Button
              variant="danger"
              icon={ShieldCheck}
              loading={submittingFinalize}
              disabled={checklist?.clearedPercentage < 100 && !isSuperAdmin}
              onClick={handleFinalizeExit}
            >
              Finalize Exit & Revoke Access
            </Button>
          </div>

          <div className="card" style={{ padding: 20 }}>
            {loadingChecklist ? (
              <div style={{ textAlign: 'center', padding: 20 }}>Evaluating multi-module live clearances...</div>
            ) : checklist ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontWeight: 600 }}>Overall Clearance Status:</div>
                  <Badge variant={checklist.clearedPercentage === 100 ? 'success' : 'warning'}>
                    {checklist.clearedPercentage || 0}% Cleared
                  </Badge>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {checklist.items && checklist.items.length > 0 ? (
                    checklist.items.map((item, idx) => (
                      <div
                        key={idx}
                        style={{
                          padding: 12,
                          border: '1px solid var(--border-color)',
                          borderRadius: 6,
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          backgroundColor: item.status === 'CLEARED' ? '#f6ffed' : 'var(--bg-subtle)',
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 600 }}>{item.label || item.key}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            {item.autoVerified ? '✓ Auto-verified by core database' : 'Manual department sign-off required'}
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <Badge variant={item.status === 'CLEARED' ? 'success' : 'warning'}>
                            {item.status}
                          </Badge>
                          {item.status !== 'CLEARED' && canManage && (
                            <Button size="sm" variant="primary" onClick={() => openConfirmItemModal(item.key)}>
                              Confirm Clearance
                            </Button>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.86rem' }}>
                      No clearance checklist items generated yet for this exit event.
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODALS */}
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
            value={confirmationForm.remarks}
            onChange={(e) => setConfirmationForm({ ...confirmationForm, remarks: e.target.value })}
            required
          />

          <div className="modal-footer" style={{ margin: '20px -20px -20px' }}>
            <Button variant="secondary" onClick={() => setConfirmationModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" loading={submittingAction}>
              Submit Confirmation
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
            options={designations.map((d) => ({ value: d._id, label: d.title }))}
            required
          />
          <Input
            label="Effective Promotion Date"
            type="date"
            value={promotionForm.effectiveDate}
            onChange={(e) => setPromotionForm({ ...promotionForm, effectiveDate: e.target.value })}
            required
          />
          <Input
            label="Salary / Grade Revision Remarks"
            value={promotionForm.salaryRevisionRemark}
            onChange={(e) => setPromotionForm({ ...promotionForm, salaryRevisionRemark: e.target.value })}
            required
          />

          <div className="modal-footer" style={{ margin: '20px -20px -20px' }}>
            <Button variant="secondary" onClick={() => setPromotionModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" loading={submittingAction}>
              Submit Promotion
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
              options={branches.map((b) => ({ value: b._id, label: b.name }))}
            />
            <Select
              label="New Department"
              value={transferForm.newDepartment}
              onChange={(e) => setTransferForm({ ...transferForm, newDepartment: e.target.value })}
              options={departments.map((d) => ({ value: d._id, label: d.name }))}
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
            value={transferForm.reason}
            onChange={(e) => setTransferForm({ ...transferForm, reason: e.target.value })}
            required
          />

          <div className="modal-footer" style={{ margin: '20px -20px -20px' }}>
            <Button variant="secondary" onClick={() => setTransferModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" loading={submittingAction}>
              Submit Transfer
            </Button>
          </div>
        </form>
      </Modal>

      {/* 4. INITIATE EXIT MODAL */}
      <Modal
        isOpen={exitModalOpen}
        onClose={() => setExitModalOpen(false)}
        title="Initiate Employee Exit & Generate Clearance"
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
              value={exitForm.exitType}
              onChange={(e) => setExitForm({ ...exitForm, exitType: e.target.value })}
              options={[
                { value: 'RESIGNATION', label: 'Voluntary Resignation' },
                { value: 'TERMINATION', label: 'Company Termination' },
                { value: 'RETIREMENT', label: 'Superannuation / Retirement' },
              ]}
            />
            <Input
              label="Last Working Day"
              type="date"
              value={exitForm.lastWorkingDay}
              onChange={(e) => setExitForm({ ...exitForm, lastWorkingDay: e.target.value })}
              required
            />
          </div>
          <Input
            label="Exit Reason Details"
            value={exitForm.reason}
            onChange={(e) => setExitForm({ ...exitForm, reason: e.target.value })}
            required
          />

          <div className="modal-footer" style={{ margin: '20px -20px -20px' }}>
            <Button variant="secondary" onClick={() => setExitModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" type="submit" loading={submittingAction}>
              Initiate Exit Workflow
            </Button>
          </div>
        </form>
      </Modal>

      {/* 5. DECISION MODAL (APPROVE / REJECT) */}
      <Modal
        isOpen={decideModalOpen}
        onClose={() => setDecideModalOpen(false)}
        title={`Decide Lifecycle Transition: ${selectedEvent?.type || ''}`}
      >
        <form onSubmit={handleSaveDecision}>
          <div style={{ padding: 10, backgroundColor: 'var(--bg-subtle)', borderRadius: 6, marginBottom: 12 }}>
            Employee: <strong>{selectedEvent?.employee?.firstName} {selectedEvent?.employee?.lastName}</strong> • Transition: {selectedEvent?.type}
          </div>
          <Select
            label="Decision"
            value={decisionChoice}
            onChange={(e) => setDecisionChoice(e.target.value)}
            options={[
              { value: 'APPROVED', label: 'Approve Transition' },
              { value: 'REJECTED', label: 'Reject Transition' },
            ]}
          />
          <Input
            label="Decision Remarks"
            value={decisionRemark}
            onChange={(e) => setDecisionRemark(e.target.value)}
            required={decisionChoice === 'REJECTED'}
          />

          <div className="modal-footer" style={{ margin: '20px -20px -20px' }}>
            <Button variant="secondary" onClick={() => setDecideModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant={decisionChoice === 'APPROVED' ? 'primary' : 'danger'}
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
        title={`Confirm Clearance Item: ${targetItemKey}`}
      >
        <form onSubmit={handleConfirmItem}>
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
              Sign Off Item
            </Button>
          </div>
        </form>
      </Modal>

      {/* 7. EVENT DETAILS MODAL */}
      <Modal
        isOpen={detailsModalOpen}
        onClose={() => setDetailsModalOpen(false)}
        title="Lifecycle Transition Details"
        size="md"
      >
        {activeEventDetails && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ padding: 12, backgroundColor: 'var(--bg-subtle)', borderRadius: 6 }}>
              <div style={{ fontWeight: 600 }}>
                {activeEventDetails.employee?.firstName} {activeEventDetails.employee?.lastName}
              </div>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                Type: {activeEventDetails.type || activeEventDetails.eventType} • Status: <Badge>{activeEventDetails.status}</Badge>
              </div>
            </div>
            <div style={{ fontSize: '0.85rem' }}>
              <strong>Effective Date:</strong> {new Date(activeEventDetails.effectiveDate || activeEventDetails.lastWorkingDay || Date.now()).toLocaleDateString()}
            </div>
            {activeEventDetails.remarks && (
              <div style={{ fontSize: '0.85rem' }}>
                <strong>Remarks:</strong> {activeEventDetails.remarks}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default LifecycleEvents;
