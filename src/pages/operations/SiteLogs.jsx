import React, { useState, useEffect } from 'react';
import siteLogApi from '../../api/siteLogApi';
import projectTaskApi from '../../api/projectTaskApi';
import employeeApi from '../../api/employeeApi';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { formatEmployeeOption, extractEmployeeList } from '../../utils/employeeUtils';
import {
  FileSpreadsheet,
  CheckCircle2,
  Clock,
  MapPin,
  Camera,
  AlertTriangle,
  RotateCcw,
  Building2,
  User,
  Search,
  Filter,
  Layers,
  Edit2,
  Compass,
  FileCheck,
  Image as ImageIcon,
  ExternalLink,
  ShieldAlert,
  Send,
  Lock,
  Eye,
  Plus,
} from 'lucide-react';
import Table from '../../components/common/Table';
import Modal from '../../components/common/Modal';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import Select from '../../components/common/Select';
import Badge from '../../components/common/Badge';
import ModuleSubNav from '../../components/common/ModuleSubNav';
import { operationsNav } from '../../routes/moduleNavConfig';

export const SiteLogs = () => {
  const { isSuperAdmin, isHrAdmin, user } = useAuth();
  const { showToast } = useToast();
  const canSupervise = isSuperAdmin || isHrAdmin || user?.role?.name === 'director' || user?.role?.name === 'project_executive';

  // Active Tab: Defaults to incomplete_queue for admins/supervisors without an employee profile
  const hasPersonalEmployee = !!(user?.employee || user?.employeeId);
  const [activeTab, setActiveTab] = useState(
    canSupervise && !hasPersonalEmployee ? 'incomplete_queue' : 'my_logs'
  );

  // Tab 1: My Logs State
  const [myLogs, setMyLogs] = useState([]);
  const [loadingMyLogs, setLoadingMyLogs] = useState(false);
  const [myLogsFilter, setMyLogsFilter] = useState({ isComplete: '' });

  // Tab 2: Incomplete Queue State
  const [incompleteQueue, setIncompleteQueue] = useState([]);
  const [loadingIncomplete, setLoadingIncomplete] = useState(false);

  // Tab 3: Issues Escalation State
  const [issuesReport, setIssuesReport] = useState([]);
  const [loadingIssues, setLoadingIssues] = useState(false);

  // Tab 4: Project Report State
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [projectReportData, setProjectReportData] = useState(null);
  const [loadingProjectReport, setLoadingProjectReport] = useState(false);

  // Tab 5: Employee Report State
  const [employees, setEmployees] = useState([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [employeeReportData, setEmployeeReportData] = useState(null);
  const [loadingEmployeeReport, setLoadingEmployeeReport] = useState(false);

  // Complete Narrative Modal State (Step 5)
  const [completeModalOpen, setCompleteModalOpen] = useState(false);
  const [selectedLogForComplete, setSelectedLogForComplete] = useState(null);
  const [narrativeForm, setNarrativeForm] = useState({
    workCompleted: '',
    pendingWork: '',
    issuesObservations: '',
  });
  const [submittingNarrative, setSubmittingNarrative] = useState(false);

  // Single Joined Log View Modal (Step 6)
  const [joinedModalOpen, setJoinedModalOpen] = useState(false);
  const [joinedLogData, setJoinedLogData] = useState(null);
  const [loadingJoined, setLoadingJoined] = useState(false);

  // Manual Internal Stub Modal State
  const [stubModalOpen, setStubModalOpen] = useState(false);
  const [stubRecordId, setStubRecordId] = useState('');
  const [creatingStub, setCreatingStub] = useState(false);

  // Load Masters
  const loadMasters = async () => {
    try {
      const [pRes, eRes] = await Promise.allSettled([
        projectTaskApi.getProjects(),
        employeeApi.getEmployees({ limit: 100 }),
      ]);
      if (pRes.status === 'fulfilled') {
        const pList = pRes.value?.projects || pRes.value?.data || [];
        setProjects(pList);
        if (pList.length > 0) setSelectedProjectId(pList[0]._id);
      }
      if (eRes.status === 'fulfilled') {
        const eList = extractEmployeeList(eRes.value);
        setEmployees(eList);
        if (eList.length > 0) setSelectedEmployeeId(eList[0]._id || eList[0].id);
      }
    } catch (e) {
      console.error('Failed to load masters', e);
    }
  };

  // Load My Logs (Step 4)
  const loadMyLogs = async () => {
    if (!hasPersonalEmployee && (isSuperAdmin || isHrAdmin)) {
      setMyLogs([]);
      return;
    }
    setLoadingMyLogs(true);
    try {
      const params = {};
      if (myLogsFilter.isComplete !== '') params.isComplete = myLogsFilter.isComplete === 'true';
      const res = await siteLogApi.getMySiteLogs(params);
      const list = Array.isArray(res)
        ? res
        : Array.isArray(res?.data)
        ? res.data
        : res?.logs || res?.records || [];
      setMyLogs(list);
    } catch (err) {
      if (err.response?.status !== 404) {
        console.error('Failed to load site logs:', err);
      }
      setMyLogs([]);
    } finally {
      setLoadingMyLogs(false);
    }
  };

  // Load Incomplete Queue (Step 3)
  const loadIncompleteQueue = async () => {
    setLoadingIncomplete(true);
    try {
      const res = await siteLogApi.getIncompleteQueue();
      const list = Array.isArray(res)
        ? res
        : Array.isArray(res?.data)
        ? res.data
        : res?.incompleteLogs || res?.records || [];
      setIncompleteQueue(list);
    } catch (err) {
      console.error(err);
      showToast('Failed to load incomplete site logs queue', 'error');
    } finally {
      setLoadingIncomplete(false);
    }
  };

  // Load Issues Escalation Report (Step 7)
  const loadIssuesReport = async () => {
    setLoadingIssues(true);
    try {
      const res = await siteLogApi.getIssuesReport();
      const list = Array.isArray(res)
        ? res
        : Array.isArray(res?.data)
        ? res.data
        : res?.issues || res?.records || [];
      setIssuesReport(list);
    } catch (err) {
      console.error(err);
      showToast('Failed to load issues report', 'error');
    } finally {
      setLoadingIssues(false);
    }
  };

  // Load Project Report (Step 7)
  const loadProjectReport = async (projId) => {
    if (!projId) return;
    setLoadingProjectReport(true);
    try {
      const res = await siteLogApi.getProjectReport(projId);
      setProjectReportData(res?.data || res);
    } catch (err) {
      console.error(err);
      showToast('Failed to load project site log report', 'error');
    } finally {
      setLoadingProjectReport(false);
    }
  };

  // Load Employee Report (Step 7)
  const loadEmployeeReport = async (empId) => {
    if (!empId) return;
    setLoadingEmployeeReport(true);
    try {
      const res = await siteLogApi.getEmployeeReport(empId);
      setEmployeeReportData(res?.data || res);
    } catch (err) {
      console.error(err);
      showToast('Failed to load employee site log report', 'error');
    } finally {
      setLoadingEmployeeReport(false);
    }
  };

  useEffect(() => {
    loadMasters();
  }, []);

  useEffect(() => {
    if (activeTab === 'my_logs') loadMyLogs();
    if (activeTab === 'incomplete_queue') loadIncompleteQueue();
    if (activeTab === 'issues_report') loadIssuesReport();
    if (activeTab === 'project_report' && selectedProjectId) loadProjectReport(selectedProjectId);
    if (activeTab === 'employee_report' && selectedEmployeeId) loadEmployeeReport(selectedEmployeeId);
  }, [activeTab, myLogsFilter]);

  // Open Complete Modal (Step 5)
  const openCompleteModal = (log) => {
    setSelectedLogForComplete(log);
    setNarrativeForm({
      workCompleted: log.workCompleted || '',
      pendingWork: log.pendingWork || '',
      issuesObservations: log.issuesObservations || '',
    });
    setCompleteModalOpen(true);
  };

  // Submit Complete Narrative (Step 5)
  const handleNarrativeSubmit = async (e) => {
    e.preventDefault();
    if (!selectedLogForComplete) return;

    if (!narrativeForm.workCompleted.trim()) {
      showToast('Mandatory: Work completed description is required', 'warning');
      return;
    }
    if (!narrativeForm.pendingWork.trim()) {
      showToast('Mandatory: Pending work / next steps description is required', 'warning');
      return;
    }

    setSubmittingNarrative(true);
    try {
      await siteLogApi.completeSiteLog(selectedLogForComplete._id, {
        workCompleted: narrativeForm.workCompleted.trim(),
        pendingWork: narrativeForm.pendingWork.trim(),
        issuesObservations: narrativeForm.issuesObservations.trim() || null,
      });

      showToast('Site log narrative submitted and permanently locked!', 'success');
      setCompleteModalOpen(false);
      loadMyLogs();
      if (activeTab === 'incomplete_queue') loadIncompleteQueue();
    } catch (err) {
      console.error(err);
      showToast(err.response?.data?.message || 'Failed to submit site log narrative', 'error');
    } finally {
      setSubmittingNarrative(false);
    }
  };

  // Open Single Joined Log View (Step 6)
  const openJoinedModal = async (logId) => {
    setLoadingJoined(true);
    setJoinedModalOpen(true);
    try {
      const res = await siteLogApi.getSiteLogById(logId);
      setJoinedLogData(res?.data || null);
    } catch (err) {
      console.error(err);
      showToast('Failed to fetch joined log details', 'error');
    } finally {
      setLoadingJoined(false);
    }
  };

  // Create Manual Internal Stub (Step 5.1)
  const handleCreateStub = async (e) => {
    e.preventDefault();
    if (!stubRecordId.trim()) {
      showToast('Site Attendance Record ID is required', 'warning');
      return;
    }

    setCreatingStub(true);
    try {
      await siteLogApi.createStub(stubRecordId.trim());
      showToast('Site log stub created/verified successfully!', 'success');
      setStubModalOpen(false);
      setStubRecordId('');
      loadIncompleteQueue();
    } catch (err) {
      console.error(err);
      showToast(err.response?.data?.message || 'Failed to create stub', 'error');
    } finally {
      setCreatingStub(false);
    }
  };

  // Table Columns: My Logs
  const myLogsColumns = [
    {
      header: 'Project & Site',
      key: 'project',
      render: (r) => {
        const att = r.siteAttendanceRecord || {};
        return (
          <div>
            <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>
              {att.project?.name || 'Project Site'}
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Site: <strong style={{ color: '#d97706' }}>{att.site?.name || 'Site Yard'}</strong>
            </div>
          </div>
        );
      },
    },
    {
      header: 'Assigned Task',
      key: 'assignedTask',
      render: (r) => {
        const att = r.siteAttendanceRecord || {};
        return (
          <div style={{ fontSize: '0.84rem' }}>
            <div style={{ fontWeight: 600 }}>{att.assignedTask?.title || 'Inspection'}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Hours: {att.totalSiteHours ? `${att.totalSiteHours} hrs` : '-'}
            </div>
          </div>
        );
      },
    },
    {
      header: 'Work Completed Today',
      key: 'workCompleted',
      render: (r) => (
        <div style={{ fontSize: '0.84rem', maxWidth: 220 }}>
          {r.workCompleted ? (
            <span style={{ color: '#1e293b' }}>{r.workCompleted}</span>
          ) : (
            <span style={{ color: '#d97706', fontStyle: 'italic', fontWeight: 600 }}>
              ⚠ Pending Narrative Submission
            </span>
          )}
        </div>
      ),
    },
    {
      header: 'Pending Work',
      key: 'pendingWork',
      render: (r) => (
        <div style={{ fontSize: '0.82rem', color: '#64748b', maxWidth: 180 }}>
          {r.pendingWork || '-'}
        </div>
      ),
    },
    {
      header: 'Issues Flagged',
      key: 'issuesObservations',
      render: (r) => (
        <div>
          {r.issuesObservations ? (
            <Badge variant="warning">
              ⚠ Issue Flagged
            </Badge>
          ) : (
            <span style={{ fontSize: '0.76rem', color: '#16a34a' }}>None</span>
          )}
        </div>
      ),
    },
    {
      header: 'Status',
      key: 'isComplete',
      render: (r) => (
        <Badge variant={r.isComplete ? 'success' : 'danger'}>
          {r.isComplete ? '✓ Complete & Locked' : 'Pending Narrative'}
        </Badge>
      ),
    },
    {
      header: 'Actions',
      key: 'actions',
      render: (r) => (
        <div style={{ display: 'flex', gap: 6 }}>
          {!r.isComplete ? (
            <Button
              size="sm"
              variant="primary"
              icon={Edit2}
              onClick={() => openCompleteModal(r)}
              style={{ fontSize: '0.76rem', background: '#d97706', borderColor: '#d97706' }}
            >
              Complete Narrative
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              icon={Eye}
              onClick={() => openJoinedModal(r._id)}
              style={{ fontSize: '0.76rem' }}
            >
              View Joined Log
            </Button>
          )}
        </div>
      ),
    },
  ];

  // Table Columns: Incomplete Queue
  const incompleteColumns = [
    {
      header: 'Field Worker',
      key: 'employee',
      render: (r) => (
        <div>
          <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>
            {r.employee?.basicInfo?.fullName || r.employee?.name || 'Site Staff'}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            Code: {r.employee?.basicInfo?.employeeCode || '-'} | {r.employee?.employmentInfo?.designation || 'Engineer'}
          </div>
        </div>
      ),
    },
    {
      header: 'Project & Site',
      key: 'project',
      render: (r) => (
        <div style={{ fontSize: '0.84rem' }}>
          <div>{r.project?.name || 'Project'}</div>
          <div style={{ color: '#d97706', fontSize: '0.78rem', fontWeight: 600 }}>
            {r.site?.name || 'Site'}
          </div>
        </div>
      ),
    },
    {
      header: 'Site Attendance Timestamps',
      key: 'siteInTime',
      render: (r) => (
        <div style={{ fontSize: '0.82rem' }}>
          <div>In: {r.siteInTime ? new Date(r.siteInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}</div>
          <div>Out: {r.siteOutTime ? new Date(r.siteOutTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}</div>
          <div style={{ color: '#059669', fontWeight: 600 }}>Total: {r.totalSiteHours ?? 0} hrs</div>
        </div>
      ),
    },
    {
      header: 'Checkout Evidence',
      key: 'photosCount',
      render: (r) => (
        <div style={{ fontSize: '0.8rem' }}>
          <div>{r.photosCount || 0} Photo(s) Attached</div>
          {r.remarks && <div style={{ color: 'var(--text-muted)', fontSize: '0.74rem' }}>"{r.remarks}"</div>}
        </div>
      ),
    },
    {
      header: 'Follow-Up Status',
      key: 'status',
      render: () => (
        <Badge variant="danger">
          Narrative Pending
        </Badge>
      ),
    },
  ];

  // Table Columns: Issues Report
  const issuesColumns = [
    {
      header: 'Project & Site',
      key: 'project',
      render: (r) => {
        const att = r.siteAttendanceRecord || {};
        return (
          <div>
            <div style={{ fontWeight: 600 }}>{att.project?.name || 'Project'}</div>
            <div style={{ fontSize: '0.78rem', color: '#d97706' }}>{att.site?.name || 'Site'}</div>
          </div>
        );
      },
    },
    {
      header: 'Reporting Engineer',
      key: 'employee',
      render: (r) => {
        const emp = r.siteAttendanceRecord?.employee || {};
        return (
          <div style={{ fontSize: '0.85rem' }}>
            <strong>{emp.basicInfo?.fullName || emp.name || 'Engineer'}</strong>
          </div>
        );
      },
    },
    {
      header: 'Escalated Issues / Observations',
      key: 'issuesObservations',
      render: (r) => (
        <div
          style={{
            fontSize: '0.85rem',
            color: '#b91c1c',
            background: '#fee2e2',
            padding: '8px 12px',
            borderRadius: 8,
            border: '1px solid #fca5a5',
            fontWeight: 500,
          }}
        >
          {r.issuesObservations}
        </div>
      ),
    },
    {
      header: 'Reported At',
      key: 'submittedAt',
      render: (r) => (
        <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
          {r.submittedAt ? new Date(r.submittedAt).toLocaleString() : '-'}
        </span>
      ),
    },
    {
      header: 'Actions',
      key: 'actions',
      render: (r) => (
        <Button size="sm" variant="light" icon={Eye} onClick={() => openJoinedModal(r._id)}>
          View Log
        </Button>
      ),
    },
  ];

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto', background: '#f8fafc', minHeight: '100vh' }}>
      {/* Sub Navigation */}
      <ModuleSubNav items={operationsNav} title="Operations & Site Management" />

      {/* Header Banner */}
      <div
        style={{
          background: '#ffffff',
          borderRadius: 16,
          padding: '24px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
          marginBottom: '24px',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: 'linear-gradient(135deg, #0f766e 0%, #0d9488 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
                boxShadow: '0 4px 10px rgba(15, 118, 110, 0.25)',
              }}
            >
              <FileSpreadsheet size={24} />
            </div>
            <div>
              <h1 style={{ fontSize: '1.45rem', fontWeight: 700, margin: 0, color: '#0f172a' }}>
                Module 10: Site Log & Activity Narrative Reporting
              </h1>
              <p style={{ margin: '4px 0 0', fontSize: '0.88rem', color: '#64748b' }}>
                Structured textual work narratives, task progress tracking, supervisor follow-up queue, and executive project/issues reports.
              </p>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          {canSupervise && (
            <Button
              variant="outline"
              icon={Plus}
              onClick={() => setStubModalOpen(true)}
              style={{ borderColor: '#0f766e', color: '#0f766e' }}
            >
              Verify / Create Stub
            </Button>
          )}
          <Button
            variant="light"
            icon={RotateCcw}
            onClick={() => {
              if (activeTab === 'my_logs') loadMyLogs();
              if (activeTab === 'incomplete_queue') loadIncompleteQueue();
              if (activeTab === 'issues_report') loadIssuesReport();
              if (activeTab === 'project_report' && selectedProjectId) loadProjectReport(selectedProjectId);
              if (activeTab === 'employee_report' && selectedEmployeeId) loadEmployeeReport(selectedEmployeeId);
            }}
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* KPI Principles Strip */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: 16,
          marginBottom: 24,
        }}
      >
        <div
          style={{
            background: '#ffffff',
            borderRadius: 14,
            padding: '18px 20px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#64748b' }}>ACTIVITY NARRATIVE LAYER</span>
            <FileCheck size={18} color="#0f766e" />
          </div>
          <div style={{ fontSize: '1.35rem', fontWeight: 700, color: '#0f172a' }}>
            Zero Duplication
          </div>
          <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: 4 }}>
            Thin textual layer dynamically populated over Module 9 Attendance
          </div>
        </div>

        <div
          style={{
            background: '#ffffff',
            borderRadius: 14,
            padding: '18px 20px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#64748b' }}>AUTO-STUB ON SITE-OUT</span>
            <Clock size={18} color="#d97706" />
          </div>
          <div style={{ fontSize: '1.35rem', fontWeight: 700, color: '#d97706' }}>
            Auto-Generated Stubs
          </div>
          <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: 4 }}>
            Pending stubs (isComplete: false) auto-created upon site departure
          </div>
        </div>

        <div
          style={{
            background: '#ffffff',
            borderRadius: 14,
            padding: '18px 20px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#64748b' }}>IMMUTABILITY ENFORCED</span>
            <Lock size={18} color="#0284c7" />
          </div>
          <div style={{ fontSize: '1.35rem', fontWeight: 700, color: '#0284c7' }}>
            Locked on Complete
          </div>
          <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: 4 }}>
            Completed narratives cannot be tampered with or resubmitted
          </div>
        </div>

        <div
          style={{
            background: '#ffffff',
            borderRadius: 14,
            padding: '18px 20px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#64748b' }}>SAFETY & ESCALATIONS</span>
            <ShieldAlert size={18} color="#dc2626" />
          </div>
          <div style={{ fontSize: '1.35rem', fontWeight: 700, color: '#dc2626' }}>
            Issues Stream
          </div>
          <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: 4 }}>
            Instant escalation of flagged site issues directly to management
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 10,
          borderBottom: '2px solid #e2e8f0',
          marginBottom: 20,
        }}
      >
        <button
          type="button"
          onClick={() => setActiveTab('my_logs')}
          style={{
            padding: '12px 18px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'my_logs' ? '3px solid #0f766e' : '3px solid transparent',
            color: activeTab === 'my_logs' ? '#0f766e' : '#64748b',
            fontWeight: activeTab === 'my_logs' ? 700 : 500,
            cursor: 'pointer',
            fontSize: '0.94rem',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <FileSpreadsheet size={18} />
          My Site Logs ({myLogs.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('incomplete_queue')}
          style={{
            padding: '12px 18px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'incomplete_queue' ? '3px solid #0f766e' : '3px solid transparent',
            color: activeTab === 'incomplete_queue' ? '#0f766e' : '#64748b',
            fontWeight: activeTab === 'incomplete_queue' ? 700 : 500,
            cursor: 'pointer',
            fontSize: '0.94rem',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <Clock size={18} />
          Incomplete Follow-Up Queue ({incompleteQueue.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('issues_report')}
          style={{
            padding: '12px 18px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'issues_report' ? '3px solid #0f766e' : '3px solid transparent',
            color: activeTab === 'issues_report' ? '#0f766e' : '#64748b',
            fontWeight: activeTab === 'issues_report' ? 700 : 500,
            cursor: 'pointer',
            fontSize: '0.94rem',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <ShieldAlert size={18} />
          Issues & Observations Stream ({issuesReport.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('project_report')}
          style={{
            padding: '12px 18px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'project_report' ? '3px solid #0f766e' : '3px solid transparent',
            color: activeTab === 'project_report' ? '#0f766e' : '#64748b',
            fontWeight: activeTab === 'project_report' ? 700 : 500,
            cursor: 'pointer',
            fontSize: '0.94rem',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <Building2 size={18} />
          Project Executive Report
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('employee_report')}
          style={{
            padding: '12px 18px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'employee_report' ? '3px solid #0f766e' : '3px solid transparent',
            color: activeTab === 'employee_report' ? '#0f766e' : '#64748b',
            fontWeight: activeTab === 'employee_report' ? 700 : 500,
            cursor: 'pointer',
            fontSize: '0.94rem',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <User size={18} />
          Employee Site Report
        </button>
      </div>

      {/* TAB 1: MY SITE LOGS */}
      {activeTab === 'my_logs' && (
        <div style={{ background: '#ffffff', borderRadius: 14, padding: 20, border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#0f172a' }}>My Site Daily Activity Logs</h3>
              <p style={{ margin: '4px 0 0', fontSize: '0.84rem', color: '#64748b' }}>
                Complete activity narratives for your site departures with work completed, pending work, and safety observations.
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <select
                value={myLogsFilter.isComplete}
                onChange={(e) => setMyLogsFilter({ isComplete: e.target.value })}
                style={{
                  padding: '7px 12px',
                  borderRadius: 8,
                  border: '1px solid #cbd5e1',
                  fontSize: '0.86rem',
                  background: '#ffffff',
                }}
              >
                <option value="">All Logs</option>
                <option value="false">Pending Narrative</option>
                <option value="true">Completed & Locked</option>
              </select>
            </div>
          </div>

          <Table
            columns={myLogsColumns}
            data={myLogs}
            loading={loadingMyLogs}
            emptyMessage="No site activity logs found for your account. Perform Site-Out in Module 9 to generate a log stub."
          />
        </div>
      )}

      {/* TAB 2: INCOMPLETE QUEUE */}
      {activeTab === 'incomplete_queue' && (
        <div style={{ background: '#ffffff', borderRadius: 14, padding: 20, border: '1px solid #e2e8f0' }}>
          <div style={{ marginBottom: 16 }}>
            <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#0f172a' }}>
              Incomplete Site Logs Follow-Up Queue
            </h3>
            <p style={{ margin: '4px 0 0', fontSize: '0.84rem', color: '#64748b' }}>
              Site engineers who have checked out from a project site but have not submitted their structured narrative report.
            </p>
          </div>

          <Table
            columns={incompleteColumns}
            data={incompleteQueue}
            loading={loadingIncomplete}
            emptyMessage="✓ All checked-out site visits have their narratives completed! Incomplete queue is empty."
          />
        </div>
      )}

      {/* TAB 3: ISSUES & OBSERVATIONS STREAM */}
      {activeTab === 'issues_report' && (
        <div style={{ background: '#ffffff', borderRadius: 14, padding: 20, border: '1px solid #e2e8f0' }}>
          <div style={{ marginBottom: 16 }}>
            <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#0f172a' }}>
              Site Safety, Civil & Electrical Issues Escalation
            </h3>
            <p style={{ margin: '4px 0 0', fontSize: '0.84rem', color: '#64748b' }}>
              Consolidated stream of all site logs with non-empty observations for executive review and prompt resolution.
            </p>
          </div>

          <Table
            columns={issuesColumns}
            data={issuesReport}
            loading={loadingIssues}
            emptyMessage="No escalated site issues or hazards flagged across project sites."
          />
        </div>
      )}

      {/* TAB 4: PROJECT EXECUTIVE REPORT */}
      {activeTab === 'project_report' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Project Selector */}
          <div style={{ background: '#ffffff', borderRadius: 14, padding: 20, border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center' }}>
              <div style={{ flex: 1, minWidth: 260 }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#475569', marginBottom: 4 }}>
                  Select Project:
                </label>
                <select
                  value={selectedProjectId}
                  onChange={(e) => {
                    setSelectedProjectId(e.target.value);
                    loadProjectReport(e.target.value);
                  }}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: 8,
                    border: '1px solid #cbd5e1',
                    fontSize: '0.9rem',
                    background: '#ffffff',
                  }}
                >
                  {projects.map((p) => (
                    <option key={p._id} value={p._id}>
                      {p.name} ({p.code || 'NO-CODE'})
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ alignSelf: 'flex-end' }}>
                <Button
                  variant="primary"
                  icon={Search}
                  onClick={() => loadProjectReport(selectedProjectId)}
                  loading={loadingProjectReport}
                  style={{ background: '#0f766e', borderColor: '#0f766e' }}
                >
                  Generate Project Summary
                </Button>
              </div>
            </div>
          </div>

          {/* Project Summary Strip */}
          {projectReportData && (
            <div style={{ background: '#ffffff', borderRadius: 14, padding: 24, border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#0f172a' }}>
                    {projectReportData.project?.name || 'Project'} Activity Summary
                  </h3>
                  <span style={{ fontSize: '0.82rem', color: '#64748b' }}>
                    Code: <strong>{projectReportData.project?.code}</strong> | Status: <Badge variant="success">{projectReportData.project?.status || 'ACTIVE'}</Badge>
                  </span>
                </div>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                  gap: 14,
                  marginBottom: 20,
                }}
              >
                <div style={{ background: '#f8fafc', padding: 14, borderRadius: 10, textAlign: 'center', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>TOTAL SITE VISITS</div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#0f172a', marginTop: 4 }}>
                    {projectReportData.summary?.totalSiteVisits ?? 0}
                  </div>
                </div>

                <div style={{ background: '#f8fafc', padding: 14, borderRadius: 10, textAlign: 'center', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>COMPLETED LOGS</div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#059669', marginTop: 4 }}>
                    {projectReportData.summary?.completedLogs ?? 0}
                  </div>
                </div>

                <div style={{ background: '#f8fafc', padding: 14, borderRadius: 10, textAlign: 'center', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>INCOMPLETE LOGS</div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 800, color: projectReportData.summary?.incompleteLogs > 0 ? '#dc2626' : '#2563eb', marginTop: 4 }}>
                    {projectReportData.summary?.incompleteLogs ?? 0}
                  </div>
                </div>

                <div style={{ background: '#f8fafc', padding: 14, borderRadius: 10, textAlign: 'center', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>TOTAL SITE HOURS</div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#0f766e', marginTop: 4 }}>
                    {projectReportData.summary?.totalSiteHours ?? 0} hrs
                  </div>
                </div>

                <div style={{ background: '#f8fafc', padding: 14, borderRadius: 10, textAlign: 'center', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>FLAGGED ISSUES</div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#d97706', marginTop: 4 }}>
                    {projectReportData.summary?.flaggedIssuesCount ?? 0}
                  </div>
                </div>
              </div>

              {/* Logs Table */}
              <h4 style={{ margin: '0 0 12px', fontSize: '0.98rem', color: '#334155' }}>
                Recent Project Site Logs ({projectReportData.data?.length || 0}):
              </h4>
              <Table
                columns={myLogsColumns}
                data={projectReportData.data || []}
                emptyMessage="No logs recorded under this project yet."
              />
            </div>
          )}
        </div>
      )}

      {/* TAB 5: EMPLOYEE SITE REPORT */}
      {activeTab === 'employee_report' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Employee Selector */}
          <div style={{ background: '#ffffff', borderRadius: 14, padding: 20, border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center' }}>
              <div style={{ flex: 1, minWidth: 260 }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#475569', marginBottom: 4 }}>
                  Select Employee:
                </label>
                <select
                  value={selectedEmployeeId}
                  onChange={(e) => {
                    setSelectedEmployeeId(e.target.value);
                    loadEmployeeReport(e.target.value);
                  }}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: 8,
                    border: '1px solid #cbd5e1',
                    fontSize: '0.9rem',
                    background: '#ffffff',
                  }}
                >
                  {employees.map((emp) => (
                    <option key={emp._id || emp.id} value={emp._id || emp.id}>
                      {formatEmployeeOption(emp, true)}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ alignSelf: 'flex-end' }}>
                <Button
                  variant="primary"
                  icon={Search}
                  onClick={() => loadEmployeeReport(selectedEmployeeId)}
                  loading={loadingEmployeeReport}
                  style={{ background: '#0f766e', borderColor: '#0f766e' }}
                >
                  Fetch Employee Logs
                </Button>
              </div>
            </div>
          </div>

          {/* Employee Summary Strip */}
          {employeeReportData && (
            <div style={{ background: '#ffffff', borderRadius: 14, padding: 24, border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#0f172a' }}>
                    {employeeReportData.employee?.fullName || 'Employee'} Site Log Metrics
                  </h3>
                  <span style={{ fontSize: '0.82rem', color: '#64748b' }}>
                    Code: <strong>{employeeReportData.employee?.employeeCode}</strong>
                  </span>
                </div>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                  gap: 14,
                  marginBottom: 20,
                }}
              >
                <div style={{ background: '#f8fafc', padding: 14, borderRadius: 10, textAlign: 'center', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>TOTAL SITE VISITS</div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#0f172a', marginTop: 4 }}>
                    {employeeReportData.summary?.totalSiteVisits ?? 0}
                  </div>
                </div>

                <div style={{ background: '#f8fafc', padding: 14, borderRadius: 10, textAlign: 'center', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>COMPLETED LOGS</div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#059669', marginTop: 4 }}>
                    {employeeReportData.summary?.completedLogs ?? 0}
                  </div>
                </div>

                <div style={{ background: '#f8fafc', padding: 14, borderRadius: 10, textAlign: 'center', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>INCOMPLETE LOGS</div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 800, color: employeeReportData.summary?.incompleteLogs > 0 ? '#dc2626' : '#2563eb', marginTop: 4 }}>
                    {employeeReportData.summary?.incompleteLogs ?? 0}
                  </div>
                </div>

                <div style={{ background: '#f8fafc', padding: 14, borderRadius: 10, textAlign: 'center', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>TOTAL SITE HOURS</div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#0f766e', marginTop: 4 }}>
                    {employeeReportData.summary?.totalSiteHours ?? 0} hrs
                  </div>
                </div>
              </div>

              {/* Logs Table */}
              <Table
                columns={myLogsColumns}
                data={employeeReportData.data || []}
                emptyMessage="No site activity logs found for this employee."
              />
            </div>
          )}
        </div>
      )}

      {/* STEP 5: COMPLETE SITE LOG MODAL */}
      <Modal
        isOpen={completeModalOpen}
        onClose={() => setCompleteModalOpen(false)}
        title="Submit Site Daily Activity Narrative"
      >
        <form onSubmit={handleNarrativeSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {selectedLogForComplete && (
            <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0', fontSize: '0.84rem' }}>
              <div>
                Site: <strong>{selectedLogForComplete.siteAttendanceRecord?.site?.name || 'Project Site'}</strong>
              </div>
              <div>
                Task: <strong>{selectedLogForComplete.siteAttendanceRecord?.assignedTask?.title || 'Inspection'}</strong>
              </div>
            </div>
          )}

          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#475569', marginBottom: 4 }}>
              Work Completed Today (Mandatory):
            </label>
            <textarea
              rows={3}
              value={narrativeForm.workCompleted}
              onChange={(e) => setNarrativeForm({ ...narrativeForm, workCompleted: e.target.value })}
              placeholder="e.g. Installed 50m cable conduit and completed safety grounding tests."
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 8,
                border: '1px solid #cbd5e1',
                fontSize: '0.88rem',
                fontFamily: 'inherit',
                resize: 'vertical',
              }}
              required
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#475569', marginBottom: 4 }}>
              Pending Work / Next Shift Steps (Mandatory):
            </label>
            <textarea
              rows={3}
              value={narrativeForm.pendingWork}
              onChange={(e) => setNarrativeForm({ ...narrativeForm, pendingWork: e.target.value })}
              placeholder="e.g. Remaining 30m conduit connection pending switchgear arrival."
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 8,
                border: '1px solid #cbd5e1',
                fontSize: '0.88rem',
                fontFamily: 'inherit',
                resize: 'vertical',
              }}
              required
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#475569', marginBottom: 4 }}>
              Issues / Observations / Safety Alerts (Optional):
            </label>
            <textarea
              rows={2}
              value={narrativeForm.issuesObservations}
              onChange={(e) => setNarrativeForm({ ...narrativeForm, issuesObservations: e.target.value })}
              placeholder="e.g. Water seepage observed near substation panel B floor; flagged for civil team."
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 8,
                border: '1px solid #cbd5e1',
                fontSize: '0.88rem',
                fontFamily: 'inherit',
                resize: 'vertical',
              }}
            />
            <span style={{ fontSize: '0.74rem', color: '#64748b' }}>
              Note: Submitting will lock this log permanently (Immutable). It cannot be altered later.
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
            <Button variant="light" type="button" onClick={() => setCompleteModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              type="submit"
              loading={submittingNarrative}
              style={{ background: '#0f766e', borderColor: '#0f766e' }}
            >
              Submit & Lock Narrative
            </Button>
          </div>
        </form>
      </Modal>

      {/* STEP 6: SINGLE JOINED LOG VIEW MODAL */}
      <Modal
        isOpen={joinedModalOpen}
        onClose={() => setJoinedModalOpen(false)}
        title="Site Log Full Joined Record"
      >
        {loadingJoined ? (
          <div style={{ textAlign: 'center', padding: 30 }}>Loading full record...</div>
        ) : joinedLogData ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Header Box */}
            <div style={{ background: '#f8fafc', padding: 14, borderRadius: 10, border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 700, fontSize: '1rem', color: '#0f172a' }}>
                  {joinedLogData.siteAttendanceRecord?.project?.name}
                </span>
                <Badge variant={joinedLogData.isComplete ? 'success' : 'danger'}>
                  {joinedLogData.isComplete ? '✓ Locked & Complete' : 'Incomplete'}
                </Badge>
              </div>
              <div style={{ fontSize: '0.84rem', color: '#64748b', marginTop: 4 }}>
                Site: <strong>{joinedLogData.siteAttendanceRecord?.site?.name}</strong> ({joinedLogData.siteAttendanceRecord?.site?.address})
              </div>
              <div style={{ fontSize: '0.82rem', color: '#64748b', marginTop: 2 }}>
                Engineer: <strong>{joinedLogData.siteAttendanceRecord?.employee?.basicInfo?.fullName}</strong> (Code: {joinedLogData.siteAttendanceRecord?.employee?.basicInfo?.employeeCode})
              </div>
            </div>

            {/* Attendance & Task Details */}
            <div className="grid-2" style={{ fontSize: '0.84rem' }}>
              <div style={{ padding: 10, background: '#f0fdf4', borderRadius: 8, border: '1px solid #bbf7d0' }}>
                <div style={{ fontWeight: 600, color: '#166534' }}>Attendance Hours</div>
                <div>In: {joinedLogData.siteAttendanceRecord?.siteInTime ? new Date(joinedLogData.siteAttendanceRecord.siteInTime).toLocaleTimeString() : '-'}</div>
                <div>Out: {joinedLogData.siteAttendanceRecord?.siteOutTime ? new Date(joinedLogData.siteAttendanceRecord.siteOutTime).toLocaleTimeString() : '-'}</div>
                <div>Total: <strong>{joinedLogData.siteAttendanceRecord?.totalSiteHours} hrs</strong></div>
              </div>

              <div style={{ padding: 10, background: '#f0fdfa', borderRadius: 8, border: '1px solid #99f6e4' }}>
                <div style={{ fontWeight: 600, color: '#0f766e' }}>Assigned Task</div>
                <div>Title: <strong>{joinedLogData.siteAttendanceRecord?.assignedTask?.title}</strong></div>
                <div>Status: <Badge variant="success">{joinedLogData.siteAttendanceRecord?.assignedTask?.status || 'COMPLETED'}</Badge></div>
              </div>
            </div>

            {/* Work Completed */}
            <div style={{ padding: 12, borderRadius: 8, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
              <div style={{ fontWeight: 600, fontSize: '0.84rem', color: '#334155', marginBottom: 4 }}>
                Work Completed:
              </div>
              <div style={{ fontSize: '0.86rem', color: '#0f172a' }}>
                {joinedLogData.workCompleted || 'None recorded'}
              </div>
            </div>

            {/* Pending Work */}
            <div style={{ padding: 12, borderRadius: 8, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
              <div style={{ fontWeight: 600, fontSize: '0.84rem', color: '#334155', marginBottom: 4 }}>
                Pending Work / Next Steps:
              </div>
              <div style={{ fontSize: '0.86rem', color: '#0f172a' }}>
                {joinedLogData.pendingWork || 'None recorded'}
              </div>
            </div>

            {/* Issues Flagged */}
            {joinedLogData.issuesObservations && (
              <div style={{ padding: 12, borderRadius: 8, background: '#fee2e2', border: '1px solid #fca5a5' }}>
                <div style={{ fontWeight: 700, fontSize: '0.84rem', color: '#b91c1c', marginBottom: 4 }}>
                  Flagged Issues / Observations:
                </div>
                <div style={{ fontSize: '0.86rem', color: '#991b1b' }}>
                  {joinedLogData.issuesObservations}
                </div>
              </div>
            )}

            {/* Attached Photos */}
            {joinedLogData.siteAttendanceRecord?.photos?.length > 0 && (
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.84rem', color: '#334155', marginBottom: 6 }}>
                  Exit Photographs ({joinedLogData.siteAttendanceRecord.photos.length}):
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8 }}>
                  {joinedLogData.siteAttendanceRecord.photos.map((url, idx) => (
                    <a key={idx} href={url} target="_blank" rel="noreferrer">
                      <img src={url} alt="Site" style={{ width: '100%', height: 90, objectFit: 'cover', borderRadius: 6 }} />
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : null}
      </Modal>

      {/* INTERNAL STUB GENERATION MODAL */}
      <Modal
        isOpen={stubModalOpen}
        onClose={() => setStubModalOpen(false)}
        title="Verify / Create Internal Site Log Stub"
      >
        <form onSubmit={handleCreateStub} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#475569', marginBottom: 4 }}>
              Site Attendance Record ObjectId:
            </label>
            <Input
              type="text"
              value={stubRecordId}
              onChange={(e) => setStubRecordId(e.target.value)}
              placeholder="e.g. 66dc2001e3b0c44298fc1c66"
              required
            />
            <span style={{ fontSize: '0.74rem', color: '#64748b' }}>
              Idempotent endpoint: If a stub already exists for this attendance record, it will return the existing stub.
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
            <Button variant="light" type="button" onClick={() => setStubModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              type="submit"
              loading={creatingStub}
              style={{ background: '#0f766e', borderColor: '#0f766e' }}
            >
              Verify / Create
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default SiteLogs;
