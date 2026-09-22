import React, { useState, useEffect } from 'react';
import timingApi from '../../api/timingApi';
import masterApi from '../../api/masterApi';
import employeeApi from '../../api/employeeApi';
import attendanceApi from '../../api/attendanceApi';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { formatEmployeeOption, extractEmployeeList } from '../../utils/employeeUtils';
import {
  Clock,
  Plus,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Calendar,
  Building2,
  User,
  Search,
  Filter,
  ArrowRight,
  Sparkles,
  Zap,
  Info,
  Check,
  Edit2,
  Trash2,
  ArrowDown,
  LogIn,
  LogOut,
  Timer,
  TrendingUp,
  XCircle,
  CheckCircle,
} from 'lucide-react';
import Table from '../../components/common/Table';
import Modal from '../../components/common/Modal';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import Select from '../../components/common/Select';
import Badge from '../../components/common/Badge';
import ModuleSubNav from '../../components/common/ModuleSubNav';
import { attendanceNav } from '../../routes/moduleNavConfig';

export const TimingRules = () => {
  const { isSuperAdmin, isHrAdmin, user } = useAuth();
  const { showToast } = useToast();
  const canManage = isSuperAdmin || isHrAdmin;

  // Active View Tab
  const [activeTab, setActiveTab] = useState('configs'); // 'configs' | 'occurrences' | 'balance' | 'evaluator'

  // Data States
  const [configs, setConfigs] = useState([]);
  const [loadingConfigs, setLoadingConfigs] = useState(false);

  const [lateOccurrences, setLateOccurrences] = useState([]);
  const [loadingOccurrences, setLoadingOccurrences] = useState(false);
  const [occurrenceFilter, setOccurrenceFilter] = useState({
    period: new Date().toISOString().slice(0, 7), // YYYY-MM
    exempted: '',
  });

  // Balance Check State
  const [employees, setEmployees] = useState([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [balancePeriod, setBalancePeriod] = useState(new Date().toISOString().slice(0, 7));
  const [balanceData, setBalanceData] = useState(null);
  const [employeeHistory, setEmployeeHistory] = useState([]);
  const [loadingBalance, setLoadingBalance] = useState(false);

  // Master Data for Config Modal
  const [companies, setCompanies] = useState([]);
  const [branches, setBranches] = useState([]);

  // Create / Edit Config Modal
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [editingConfigId, setEditingConfigId] = useState(null);
  const [configForm, setConfigForm] = useState({
    scope: 'BRANCH',
    reference: '',
    referenceModel: 'Branch',
    standardCheckInTime: '09:00',
    standardCheckOutTime: '19:00',
    lateCutoffTime: '09:15',
    allowedLateOccurrences: 5,
    stayBackExemptionTime: '19:15',
  });
  const [savingConfig, setSavingConfig] = useState(false);

  // HR Exemption Modal
  const [exemptModalOpen, setExemptModalOpen] = useState(false);
  const [selectedOccurrence, setSelectedOccurrence] = useState(null);
  const [exemptRemark, setExemptRemark] = useState('');
  const [submittingExempt, setSubmittingExempt] = useState(false);

  // Live Evaluator Tester
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [evaluatingRecordId, setEvaluatingRecordId] = useState(null);
  const [evalResult, setEvalResult] = useState(null);

  // Late Rule Simulator
  const [simCheckIn, setSimCheckIn] = useState('09:20');
  const [simCheckOut, setSimCheckOut] = useState('19:30');
  const [simOccurrence, setSimOccurrence] = useState(3);
  const [simResult, setSimResult] = useState(null);

  // Simulate the late rule logic client-side
  const runLateSimulation = () => {
    const STANDARD_IN = '09:00';
    const LATE_CUTOFF = '09:15';
    const STANDARD_OUT = '19:00';
    const STAY_BACK_THRESHOLD = '19:15';
    const MAX_ALLOWED_OCCURRENCES = 5;

    const toMins = (hhmm) => {
      const [h, m] = hhmm.split(':').map(Number);
      return h * 60 + m;
    };

    const checkInMins = toMins(simCheckIn);
    const cutoffMins = toMins(LATE_CUTOFF);
    const checkOutMins = toMins(simCheckOut);
    const stayBackMins = toMins(STAY_BACK_THRESHOLD);

    const isLate = checkInMins > cutoffMins;
    const minutesLate = isLate ? checkInMins - toMins(STANDARD_IN) : 0;
    const hasStayBack = checkOutMins >= stayBackMins;
    const projectedOccurrence = isLate ? simOccurrence : simOccurrence; // occurrence only increments if late and not exempted
    const isExemptedByStayBack = isLate && hasStayBack;
    const effectiveOccurrence = isLate && !isExemptedByStayBack ? simOccurrence : simOccurrence;
    const exceedsLimit = isLate && !isExemptedByStayBack && simOccurrence > MAX_ALLOWED_OCCURRENCES;
    const attendanceStatus = exceedsLimit ? 'HALF_DAY' : 'PRESENT';

    setSimResult({
      isLate,
      minutesLate,
      hasStayBack,
      isExemptedByStayBack,
      exceedsLimit,
      attendanceStatus,
      occurrenceNumber: isLate && !isExemptedByStayBack ? simOccurrence : null,
      checkInTime: simCheckIn,
      checkOutTime: simCheckOut,
    });
  };

  // Load Configurations
  const loadConfigs = async () => {
    setLoadingConfigs(true);
    try {
      const res = await timingApi.getTimingConfigs();
      const list = Array.isArray(res) ? res : (Array.isArray(res?.configs) ? res.configs : (Array.isArray(res?.data) ? res.data : []));
      setConfigs(list);
    } catch (err) {
      console.error(err);
      showToast('Failed to load timing configurations', 'error');
    } finally {
      setLoadingConfigs(false);
    }
  };

  // Load Org-Wide Late Occurrences
  const loadLateOccurrences = async () => {
    setLoadingOccurrences(true);
    try {
      const params = {};
      if (occurrenceFilter.period) params.period = occurrenceFilter.period;
      if (occurrenceFilter.exempted !== '') params.exempted = occurrenceFilter.exempted === 'true';

      const res = await timingApi.getLateOccurrences(params);
      const list = Array.isArray(res) ? res : (Array.isArray(res?.occurrences) ? res.occurrences : (Array.isArray(res?.data) ? res.data : []));
      setLateOccurrences(list);
    } catch (err) {
      console.error(err);
      showToast('Failed to load late occurrences ledger', 'error');
    } finally {
      setLoadingOccurrences(false);
    }
  };

  // Load Employees and Masters
  const loadMasters = async () => {
    try {
      const [compRes, branchRes, empRes] = await Promise.allSettled([
        masterApi.getCompanies(),
        masterApi.getBranches(),
        employeeApi.getEmployees({ limit: 100 }),
      ]);

      if (compRes.status === 'fulfilled') {
        setCompanies(compRes.value?.data || compRes.value?.companies || []);
      }
      if (branchRes.status === 'fulfilled') {
        const brList = branchRes.value?.data || branchRes.value?.branches || [];
        setBranches(brList);
        if (brList.length > 0 && !configForm.reference) {
          setConfigForm((prev) => ({ ...prev, reference: brList[0]._id }));
        }
      }
      if (empRes.status === 'fulfilled') {
        const empList = extractEmployeeList(empRes.value);
        setEmployees(empList);
        if (empList.length > 0) {
          setSelectedEmployeeId(empList[0]._id || empList[0].id);
        }
      }
    } catch (e) {
      console.error('Error loading masters:', e);
    }
  };

  useEffect(() => {
    loadConfigs();
    loadMasters();
  }, []);

  useEffect(() => {
    if (activeTab === 'occurrences') {
      loadLateOccurrences();
    }
  }, [activeTab, occurrenceFilter]);

  // Fetch Employee Balance & History
  const fetchEmployeeBalance = async (empId, period) => {
    if (!empId) return;
    setLoadingBalance(true);
    try {
      const [countRes, historyRes] = await Promise.allSettled([
        timingApi.getEmployeeOccurrenceCount(empId, { period }),
        timingApi.getEmployeeLateOccurrences(empId, { period }),
      ]);

      if (countRes.status === 'fulfilled') {
        setBalanceData(countRes.value);
      }
      if (historyRes.status === 'fulfilled') {
        setEmployeeHistory(historyRes.value?.occurrences || historyRes.value?.data || []);
      }
    } catch (err) {
      console.error(err);
      showToast('Failed to fetch employee balance', 'error');
    } finally {
      setLoadingBalance(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'balance' && selectedEmployeeId) {
      fetchEmployeeBalance(selectedEmployeeId, balancePeriod);
    }
  }, [activeTab, selectedEmployeeId, balancePeriod]);

  // Load Recent Attendance for Evaluation Tester
  const loadRecentAttendance = async () => {
    try {
      const res = await attendanceApi.getAllOfficeAttendance({
        date: new Date().toISOString().split('T')[0],
      });
      setAttendanceRecords(res?.data || []);
    } catch (e) {
      console.error('Failed to load recent attendance records', e);
    }
  };

  useEffect(() => {
    if (activeTab === 'evaluator') {
      loadRecentAttendance();
    }
  }, [activeTab]);

  // Open Create/Edit Config Modal
  const openCreateConfigModal = () => {
    setEditingConfigId(null);
    setConfigForm({
      scope: 'BRANCH',
      reference: branches[0]?._id || '',
      referenceModel: 'Branch',
      standardCheckInTime: '09:00',
      standardCheckOutTime: '19:00',
      lateCutoffTime: '09:15',
      allowedLateOccurrences: 5,
      stayBackExemptionTime: '19:15',
    });
    setConfigModalOpen(true);
  };

  const openEditConfigModal = (cfg) => {
    setEditingConfigId(cfg._id);
    setConfigForm({
      scope: cfg.scope || 'BRANCH',
      reference: cfg.reference?._id || cfg.reference || '',
      referenceModel: cfg.referenceModel || (cfg.scope === 'COMPANY' ? 'Company' : 'Branch'),
      standardCheckInTime: cfg.standardCheckInTime || '09:00',
      standardCheckOutTime: cfg.standardCheckOutTime || '19:00',
      lateCutoffTime: cfg.lateCutoffTime || '09:15',
      allowedLateOccurrences: cfg.allowedLateOccurrences ?? 5,
      stayBackExemptionTime: cfg.stayBackExemptionTime || '19:15',
    });
    setConfigModalOpen(true);
  };

  // Save Config Submit (Step 1)
  const handleSaveConfig = async (e) => {
    e.preventDefault();
    if (!configForm.reference) {
      showToast('Please select a reference company or branch', 'warning');
      return;
    }

    setSavingConfig(true);
    try {
      const payload = {
        scope: configForm.scope,
        reference: configForm.reference,
        referenceModel: configForm.scope === 'COMPANY' ? 'Company' : 'Branch',
        standardCheckInTime: configForm.standardCheckInTime,
        standardCheckOutTime: configForm.standardCheckOutTime,
        lateCutoffTime: configForm.lateCutoffTime,
        allowedLateOccurrences: Number(configForm.allowedLateOccurrences),
        stayBackExemptionTime: configForm.stayBackExemptionTime,
      };

      if (editingConfigId) {
        await timingApi.updateTimingConfig(editingConfigId, payload);
        showToast('Timing configuration updated successfully', 'success');
      } else {
        await timingApi.createTimingConfig(payload);
        showToast('Timing configuration created successfully', 'success');
      }

      setConfigModalOpen(false);
      loadConfigs();
    } catch (err) {
      console.error(err);
      showToast(err.response?.data?.message || 'Failed to save timing configuration', 'error');
    } finally {
      setSavingConfig(false);
    }
  };

  // Deactivate Config
  const handleDeleteConfig = async (id) => {
    if (!window.confirm('Are you sure you want to deactivate this timing configuration?')) return;
    try {
      await timingApi.deleteTimingConfig(id);
      showToast('Timing configuration deactivated', 'success');
      loadConfigs();
    } catch (err) {
      console.error(err);
      showToast('Failed to deactivate timing configuration', 'error');
    }
  };

  // Open HR Exemption Modal (Step 5)
  const openExemptModal = (occ) => {
    setSelectedOccurrence(occ);
    setExemptRemark('');
    setExemptModalOpen(true);
  };

  // Submit HR Exemption Override (Step 5)
  const handleExemptSubmit = async (e) => {
    e.preventDefault();
    if (!selectedOccurrence) return;
    if (!exemptRemark.trim()) {
      showToast('Mandatory remark is required for HR override exemption', 'warning');
      return;
    }

    setSubmittingExempt(true);
    try {
      await timingApi.exemptLateOccurrence(selectedOccurrence._id, {
        remark: exemptRemark.trim(),
      });
      showToast('Late occurrence exempted successfully. Reverted any half-day penalty.', 'success');
      setExemptModalOpen(false);
      loadLateOccurrences();
      if (selectedEmployeeId) {
        fetchEmployeeBalance(selectedEmployeeId, balancePeriod);
      }
    } catch (err) {
      console.error(err);
      showToast(err.response?.data?.message || 'Failed to exempt late occurrence', 'error');
    } finally {
      setSubmittingExempt(false);
    }
  };

  // Trigger Evaluator for Check-in or Check-out
  const runEvaluation = async (recordId, type) => {
    setEvaluatingRecordId(recordId);
    setEvalResult(null);
    try {
      let res;
      if (type === 'checkin') {
        res = await timingApi.evaluateCheckIn(recordId);
      } else {
        res = await timingApi.evaluateCheckOut(recordId);
      }
      setEvalResult({
        type,
        recordId,
        data: res,
      });
      showToast(`Evaluation (${type}) executed successfully!`, 'success');
      loadRecentAttendance();
      loadLateOccurrences();
    } catch (err) {
      console.error(err);
      showToast(err.response?.data?.message || `Evaluation for ${type} failed`, 'error');
    } finally {
      setEvaluatingRecordId(null);
    }
  };

  // Table Columns: Timing Configurations
  const configColumns = [
    {
      header: 'Scope & Target',
      key: 'scope',
      render: (cfg) => (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, color: 'var(--text-main)' }}>
            <Building2 size={16} color="var(--primary)" />
            {cfg.reference?.name || cfg.referenceModel || 'All Organization'}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            Scope: <span style={{ fontWeight: 600 }}>{cfg.scope}</span> ({cfg.reference?.code || '-'})
          </div>
        </div>
      ),
    },
    {
      header: 'Office Hours',
      key: 'standardCheckInTime',
      render: (cfg) => (
        <div style={{ fontSize: '0.86rem' }}>
          <div>Standard In: <strong style={{ color: 'var(--primary)' }}>{cfg.standardCheckInTime || '09:00'}</strong></div>
          <div style={{ color: 'var(--text-muted)' }}>Standard Out: <strong>{cfg.standardCheckOutTime || '19:00'}</strong></div>
        </div>
      ),
    },
    {
      header: 'Grace & Cutoff Rules',
      key: 'lateCutoffTime',
      render: (cfg) => (
        <div style={{ fontSize: '0.86rem' }}>
          <div>Cutoff: <strong style={{ color: '#d97706' }}>{cfg.lateCutoffTime || '09:15'}</strong> (15-min grace)</div>
          <div style={{ color: 'var(--text-muted)' }}>
            Allowed Late: <strong style={{ color: 'var(--text-main)' }}>{cfg.allowedLateOccurrences ?? 5} / month</strong>
          </div>
        </div>
      ),
    },
    {
      header: 'Same-Day Stay-Back',
      key: 'stayBackExemptionTime',
      render: (cfg) => (
        <div style={{ fontSize: '0.84rem' }}>
          <Badge variant="info">Stay-Back: ≥ {cfg.stayBackExemptionTime || '19:15'}</Badge>
          <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: 4 }}>
            Exempts today's late arrival
          </div>
        </div>
      ),
    },
    {
      header: 'Status',
      key: 'isActive',
      render: (cfg) => (
        <Badge variant={cfg.isActive ? 'success' : 'danger'}>
          {cfg.isActive ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
    {
      header: 'Actions',
      key: 'actions',
      render: (cfg) => (
        <div style={{ display: 'flex', gap: 6 }}>
          {canManage && (
            <>
              <Button
                size="sm"
                variant="light"
                icon={Edit2}
                onClick={() => openEditConfigModal(cfg)}
                title="Edit Timing Rules"
              />
              <Button
                size="sm"
                variant="danger"
                icon={Trash2}
                onClick={() => handleDeleteConfig(cfg._id)}
                title="Deactivate Configuration"
              />
            </>
          )}
        </div>
      ),
    },
  ];

  // Table Columns: Org-Wide Late Occurrences
  const occurrenceColumns = [
    {
      header: 'Employee',
      key: 'employee',
      render: (occ) => (
        <div>
          <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>
            {occ.employee?.firstName ? `${occ.employee.firstName} ${occ.employee.lastName || ''}` : occ.employee?.name || 'Employee'}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            Code: {occ.employee?.employeeCode || '-'}
          </div>
        </div>
      ),
    },
    {
      header: 'Attendance Date',
      key: 'attendanceDate',
      render: (occ) => (
        <div style={{ fontSize: '0.86rem' }}>
          <strong>{occ.attendanceDate ? new Date(occ.attendanceDate).toLocaleDateString() : '-'}</strong>
          <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
            Period: {occ.trackingPeriodKey || '-'}
          </div>
        </div>
      ),
    },
    {
      header: 'Arrival Timing',
      key: 'checkInTime',
      render: (occ) => {
        const checkIn = occ.checkInTime ? new Date(occ.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-';
        return (
          <div style={{ fontSize: '0.86rem' }}>
            <div>Check-in: <strong style={{ color: '#b91c1c' }}>{checkIn}</strong></div>
            <div style={{ fontSize: '0.78rem', color: '#b91c1c', fontWeight: 600 }}>
              +{occ.minutesLate || 0} mins late
            </div>
          </div>
        );
      },
    },
    {
      header: 'Monthly Occurrence #',
      key: 'occurrenceNumber',
      render: (occ) => {
        const num = occ.occurrenceNumber || 1;
        const isHalfDay = num > 5;
        return (
          <div>
            <Badge variant={isHalfDay ? 'danger' : num >= 4 ? 'warning' : 'info'}>
              #{num} in Month {isHalfDay ? '(HALF_DAY Escalation)' : '(Allowed Grace)'}
            </Badge>
          </div>
        );
      },
    },
    {
      header: 'Exemption Verdict',
      key: 'exempted',
      render: (occ) => {
        if (occ.exempted) {
          const isStayBack = occ.exemptionReason === 'STAY_BACK_UNTIL_7_15PM';
          return (
            <div>
              <Badge variant="success">
                {isStayBack ? 'Stayed Back ≥ 19:15' : 'HR Manual Override'}
              </Badge>
              {occ.manualExemptRemark && (
                <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: 4, maxWidth: 200 }}>
                  Remark: {occ.manualExemptRemark}
                </div>
              )}
            </div>
          );
        }
        return (
          <Badge variant="danger">
            Late Not Exempted
          </Badge>
        );
      },
    },
    {
      header: 'Actions',
      key: 'actions',
      render: (occ) => (
        <div>
          {!occ.exempted && canManage ? (
            <Button
              size="sm"
              variant="outline"
              icon={CheckCircle2}
              onClick={() => openExemptModal(occ)}
              style={{ fontSize: '0.76rem', borderColor: 'var(--success)', color: 'var(--success)' }}
            >
              HR Exempt
            </Button>
          ) : occ.exempted ? (
            <span style={{ fontSize: '0.78rem', color: 'var(--success)', fontWeight: 600 }}>
              Settled
            </span>
          ) : (
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Read Only</span>
          )}
        </div>
      ),
    },
  ];

  const activeConfigsCount = configs.filter((c) => c.isActive !== false).length;
  const totalLateOccurrencesCount = lateOccurrences.length;
  const exemptedCount = lateOccurrences.filter((o) => o.isExempted).length;
  const penaltyCount = lateOccurrences.filter((o) => (o.occurrenceNumber > 5 || o.status === 'HALF_DAY') && !o.isExempted).length;

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto', background: 'var(--bg-app)', minHeight: '100vh' }}>
      {/* Attendance Sub Navigation */}
      <ModuleSubNav items={attendanceNav} title="Attendance & Timing Operations" />

      {/* Header Banner */}
      <div
        style={{
          background: 'var(--bg-surface)',
          borderRadius: 16,
          padding: '24px',
          border: '1px solid var(--border-color)',
          boxShadow: 'var(--shadow-sm)',
          marginBottom: '24px',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 14,
              background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-hover) 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-white)',
              boxShadow: '0 4px 12px var(--primary-ring)',
            }}
          >
            <Clock size={26} />
          </div>
          <div>
            <h1 style={{ fontSize: '1.45rem', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
              Attendance Timing & Grace Rules
            </h1>
            <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Configure shift timings, grace windows, 5-occurrence monthly limits, and HR exemptions
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          {canManage && (
            <Button
              variant="primary"
              icon={Plus}
              onClick={openCreateConfigModal}
              style={{ fontWeight: 600 }}
            >
              Configure Timing Rules
            </Button>
          )}
          <Button
            variant="light"
            icon={RotateCcw}
            onClick={() => {
              loadConfigs();
              if (activeTab === 'occurrences') loadLateOccurrences();
              if (activeTab === 'balance' && selectedEmployeeId) fetchEmployeeBalance(selectedEmployeeId, balancePeriod);
            }}
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* Dynamic Real-Time KPI Cards from Backend Data */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: 16,
          marginBottom: 24,
        }}
      >
        {/* Card 1: Shift Timing Configs */}
        <div
          style={{
            background: 'var(--bg-surface)',
            borderRadius: 14,
            padding: '18px 20px',
            border: '1px solid var(--border-color)',
            boxShadow: 'var(--shadow-xs)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>SHIFT TIMING CONFIGS</span>
            <Building2 size={20} color="var(--primary)" />
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-main)' }}>
            {activeConfigsCount}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 4 }}>
            Active timing profiles configured
          </div>
        </div>

        {/* Card 2: Late Occurrences */}
        <div
          style={{
            background: 'var(--bg-surface)',
            borderRadius: 14,
            padding: '18px 20px',
            border: '1px solid var(--border-color)',
            boxShadow: 'var(--shadow-xs)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>LATE OCCURRENCES</span>
            <AlertTriangle size={20} color="var(--warning)" />
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--warning)' }}>
            {totalLateOccurrencesCount}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 4 }}>
            Punches logged past late cutoff
          </div>
        </div>

        {/* Card 3: HR Exempted */}
        <div
          style={{
            background: 'var(--bg-surface)',
            borderRadius: 14,
            padding: '18px 20px',
            border: '1px solid var(--border-color)',
            boxShadow: 'var(--shadow-xs)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>HR EXEMPTED PUNCHES</span>
            <ShieldAlert size={20} color="var(--success)" />
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--success)' }}>
            {exemptedCount}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 4 }}>
            Stay-back or HR waived entries
          </div>
        </div>

        {/* Card 4: Half-Day Penalties */}
        <div
          style={{
            background: 'var(--bg-surface)',
            borderRadius: 14,
            padding: '18px 20px',
            border: '1px solid var(--border-color)',
            boxShadow: 'var(--shadow-xs)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>HALF-DAY PENALTIES</span>
            <XCircle size={20} color="var(--danger)" />
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--danger)' }}>
            {penaltyCount}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 4 }}>
            Exceeded 5-occurrence monthly limit
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div
        style={{
          display: 'flex',
          gap: 8,
          borderBottom: '2px solid var(--border-color)',
          marginBottom: 20,
        }}
      >
        <button
          type="button"
          onClick={() => setActiveTab('configs')}
          style={{
            padding: '12px 20px',
            background: 'none',
            border: 'none',
            outline: 'none',
            borderBottom: activeTab === 'configs' ? '3px solid var(--primary)' : '3px solid transparent',
            color: activeTab === 'configs' ? 'var(--primary)' : 'var(--text-muted)',
            fontWeight: activeTab === 'configs' ? 600 : 500,
            cursor: 'pointer',
            fontSize: '0.94rem',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            transition: 'all 0.15s ease',
          }}
        >
          <Building2 size={18} />
          Timing Configurations ({configs.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('occurrences')}
          style={{
            padding: '12px 20px',
            background: 'none',
            border: 'none',
            outline: 'none',
            borderBottom: activeTab === 'occurrences' ? '3px solid var(--primary)' : '3px solid transparent',
            color: activeTab === 'occurrences' ? 'var(--primary)' : 'var(--text-muted)',
            fontWeight: activeTab === 'occurrences' ? 600 : 500,
            cursor: 'pointer',
            fontSize: '0.94rem',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            transition: 'all 0.15s ease',
          }}
        >
          <ShieldAlert size={18} />
          Late Occurrences Ledger ({lateOccurrences.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('balance')}
          style={{
            padding: '12px 20px',
            background: 'none',
            border: 'none',
            outline: 'none',
            borderBottom: activeTab === 'balance' ? '3px solid var(--primary)' : '3px solid transparent',
            color: activeTab === 'balance' ? 'var(--primary)' : 'var(--text-muted)',
            fontWeight: activeTab === 'balance' ? 600 : 500,
            cursor: 'pointer',
            fontSize: '0.94rem',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            transition: 'all 0.15s ease',
          }}
        >
          <User size={18} />
          Employee Grace Balance
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('evaluator')}
          style={{
            padding: '12px 20px',
            background: 'none',
            border: 'none',
            outline: 'none',
            borderBottom: activeTab === 'evaluator' ? '3px solid var(--primary)' : '3px solid transparent',
            color: activeTab === 'evaluator' ? 'var(--primary)' : 'var(--text-muted)',
            fontWeight: activeTab === 'evaluator' ? 600 : 500,
            cursor: 'pointer',
            fontSize: '0.94rem',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            transition: 'all 0.15s ease',
          }}
        >
          <Sparkles size={18} />
          Live Write-Back Tester
        </button>

        <button
          type="button"
          onClick={() => { setActiveTab('simulator'); setSimResult(null); }}
          style={{
            padding: '12px 20px',
            background: 'none',
            border: 'none',
            outline: 'none',
            borderBottom: activeTab === 'simulator' ? '3px solid var(--primary)' : '3px solid transparent',
            color: activeTab === 'simulator' ? 'var(--primary)' : 'var(--text-muted)',
            fontWeight: activeTab === 'simulator' ? 600 : 500,
            cursor: 'pointer',
            fontSize: '0.94rem',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            transition: 'all 0.15s ease',
          }}
        >
          <Timer size={18} />
          Late Rule Simulator
        </button>
      </div>

      {/* TAB 1: TIMING CONFIGURATIONS */}
      {activeTab === 'configs' && (
        <div style={{ background: '#ffffff', borderRadius: 14, padding: 20, border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#0f172a' }}>Active Company & Branch Timing Rules</h3>
              <p style={{ margin: '4px 0 0', fontSize: '0.84rem', color: '#64748b' }}>
                Defines standard check-in/out hours, 15-minute grace tolerance, and stay-back exemption criteria.
              </p>
            </div>
            {canManage && (
              <Button size="sm" variant="primary" icon={Plus} onClick={openCreateConfigModal}>
                Add Rule
              </Button>
            )}
          </div>

          <Table
            columns={configColumns}
            data={configs}
            loading={loadingConfigs}
            emptyMessage="No timing configurations configured yet. Click 'Configure Timing Rules' to set up default rules."
          />
        </div>
      )}

      {/* TAB 2: ORG-WIDE LATE OCCURRENCES LEDGER */}
      {activeTab === 'occurrences' && (
        <div style={{ background: '#ffffff', borderRadius: 14, padding: 20, border: '1px solid #e2e8f0' }}>
          {/* Filters Bar */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 14,
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 18,
              padding: '12px 16px',
              background: '#f8fafc',
              borderRadius: 10,
              border: '1px solid #e2e8f0',
            }}
          >
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Calendar size={16} color="#64748b" />
                <span style={{ fontSize: '0.84rem', fontWeight: 600, color: '#334155' }}>Period (YYYY-MM):</span>
                <input
                  type="month"
                  value={occurrenceFilter.period}
                  onChange={(e) => setOccurrenceFilter((prev) => ({ ...prev, period: e.target.value }))}
                  style={{
                    padding: '6px 10px',
                    borderRadius: 6,
                    border: '1px solid #cbd5e1',
                    fontSize: '0.85rem',
                  }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Filter size={16} color="#64748b" />
                <span style={{ fontSize: '0.84rem', fontWeight: 600, color: '#334155' }}>Status:</span>
                <select
                  value={occurrenceFilter.exempted}
                  onChange={(e) => setOccurrenceFilter((prev) => ({ ...prev, exempted: e.target.value }))}
                  style={{
                    padding: '6px 10px',
                    borderRadius: 6,
                    border: '1px solid #cbd5e1',
                    fontSize: '0.85rem',
                    background: '#ffffff',
                  }}
                >
                  <option value="">All Late Records</option>
                  <option value="false">Non-Exempted (Active Late)</option>
                  <option value="true">Exempted (Stay-Back / HR Override)</option>
                </select>
              </div>
            </div>

            <Button size="sm" variant="light" icon={RotateCcw} onClick={loadLateOccurrences}>
              Apply Filter
            </Button>
          </div>

          <Table
            columns={occurrenceColumns}
            data={lateOccurrences}
            loading={loadingOccurrences}
            emptyMessage="No late occurrences recorded for the selected period."
          />
        </div>
      )}

      {/* TAB 3: EMPLOYEE GRACE BALANCE */}
      {activeTab === 'balance' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Employee & Period Selector Card */}
          <div style={{ background: '#ffffff', borderRadius: 14, padding: 20, border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center' }}>
              <div style={{ flex: 1, minWidth: 260 }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#475569', marginBottom: 6 }}>
                  Select Employee:
                </label>
                <select
                  value={selectedEmployeeId}
                  onChange={(e) => setSelectedEmployeeId(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
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

              <div style={{ width: 200 }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#475569', marginBottom: 6 }}>
                  Tracking Period:
                </label>
                <input
                  type="month"
                  value={balancePeriod}
                  onChange={(e) => setBalancePeriod(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: 8,
                    border: '1px solid #cbd5e1',
                    fontSize: '0.9rem',
                  }}
                />
              </div>

              <div style={{ alignSelf: 'flex-end' }}>
                <Button
                  variant="primary"
                  icon={Search}
                  onClick={() => fetchEmployeeBalance(selectedEmployeeId, balancePeriod)}
                  loading={loadingBalance}
                >
                  Check Balance
                </Button>
              </div>
            </div>
          </div>

          {/* Balance Metrics Card */}
          {balanceData && (
            <div
              style={{
                background: '#ffffff',
                borderRadius: 14,
                padding: 24,
                border: '1px solid #e2e8f0',
                boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#0f172a' }}>
                    Monthly Late Grace Balance Summary
                  </h3>
                  <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: 4 }}>
                    Employee Code: <strong>{balanceData.employeeCode || '-'}</strong> | Period: <strong>{balanceData.trackingPeriodKey}</strong>
                  </div>
                </div>

                <Badge
                  variant={balanceData.hasExceededThreshold ? 'danger' : balanceData.remainingBeforeHalfDay <= 1 ? 'warning' : 'success'}
                  style={{ padding: '8px 14px', fontSize: '0.85rem' }}
                >
                  {balanceData.hasExceededThreshold
                    ? 'THRESHOLD EXCEEDED (HALF-DAY ACTIVE)'
                    : `WITHIN LIMIT (${balanceData.remainingBeforeHalfDay} LATES REMAINING)`}
                </Badge>
              </div>

              {/* Counter Grid */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                  gap: 16,
                  marginBottom: 20,
                }}
              >
                <div style={{ background: '#f8fafc', padding: 16, borderRadius: 10, border: '1px solid #e2e8f0', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>ALLOWED LATE / MO</div>
                  <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#0f172a', marginTop: 4 }}>
                    {balanceData.allowedLateOccurrences ?? 5}
                  </div>
                </div>

                <div style={{ background: '#f8fafc', padding: 16, borderRadius: 10, border: '1px solid #e2e8f0', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>TOTAL LATE RECORDED</div>
                  <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#d97706', marginTop: 4 }}>
                    {balanceData.totalLateOccurrences ?? 0}
                  </div>
                </div>

                <div style={{ background: '#f8fafc', padding: 16, borderRadius: 10, border: '1px solid #e2e8f0', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>EXEMPTED (SETTLED)</div>
                  <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#059669', marginTop: 4 }}>
                    {balanceData.exemptedLateCount ?? 0}
                  </div>
                </div>

                <div style={{ background: '#f8fafc', padding: 16, borderRadius: 10, border: '1px solid #e2e8f0', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>NON-EXEMPTED (CHARGED)</div>
                  <div style={{ fontSize: '1.8rem', fontWeight: 800, color: balanceData.nonExemptedLateCount >= 5 ? '#dc2626' : '#2563eb', marginTop: 4 }}>
                    {balanceData.nonExemptedLateCount ?? 0}
                  </div>
                </div>

                <div style={{ background: '#f8fafc', padding: 16, borderRadius: 10, border: '1px solid #e2e8f0', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>REMAINING BEFORE HALF-DAY</div>
                  <div style={{ fontSize: '1.8rem', fontWeight: 800, color: balanceData.remainingBeforeHalfDay <= 1 ? '#dc2626' : '#059669', marginTop: 4 }}>
                    {balanceData.remainingBeforeHalfDay ?? 0}
                  </div>
                </div>
              </div>

              {/* Employee's Individual Late Occurrences History Table */}
              <h4 style={{ margin: '16px 0 12px', fontSize: '1rem', color: '#0f172a' }}>
                Late Arrivals for this Employee ({employeeHistory.length})
              </h4>
              <Table
                columns={occurrenceColumns}
                data={employeeHistory}
                emptyMessage="No late occurrences recorded for this employee in the selected period."
              />
            </div>
          )}
        </div>
      )}

      {/* TAB 4: LIVE WRITE-BACK TESTER */}
      {activeTab === 'evaluator' && (
        <div style={{ background: '#ffffff', borderRadius: 14, padding: 24, border: '1px solid #e2e8f0' }}>
          <div style={{ marginBottom: 20 }}>
            <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#0f172a' }}>
              Attendance Timing Write-Back Engine Evaluator
            </h3>
            <p style={{ margin: '6px 0 0', fontSize: '0.86rem', color: '#64748b' }}>
              Trigger automated evaluations on today's AttendanceRecords to verify check-in cutoff thresholds (09:15) and same-day stay-back settlement (19:15).
            </p>
          </div>

          {evalResult && (
            <div
              style={{
                marginBottom: 20,
                padding: 16,
                background: '#f0fdf4',
                border: '1px solid #86efac',
                borderRadius: 10,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, color: '#15803d', marginBottom: 6 }}>
                <CheckCircle2 size={18} />
                Evaluator Execution Result ({evalResult.type.toUpperCase()})
              </div>
              <pre
                style={{
                  background: '#ffffff',
                  padding: 12,
                  borderRadius: 6,
                  border: '1px solid #bbf7d0',
                  fontSize: '0.82rem',
                  overflowX: 'auto',
                }}
              >
                {JSON.stringify(evalResult.data, null, 2)}
              </pre>
            </div>
          )}

          <h4 style={{ margin: '0 0 12px', fontSize: '0.95rem', color: '#334155' }}>
            Today's Attendance Records for Evaluation:
          </h4>

          {attendanceRecords.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: '#94a3b8' }}>
              No office attendance punches recorded yet for today. Use the Biometric Face Punch or Daily Register to create punches.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {attendanceRecords.map((rec) => {
                const inTime = rec.firstCheckInTime ? new Date(rec.firstCheckInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-';
                const outTime = rec.lastCheckOutTime ? new Date(rec.lastCheckOutTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : rec.isOpen ? 'On Duty' : '-';

                return (
                  <div
                    key={rec._id}
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '14px 18px',
                      background: '#f8fafc',
                      borderRadius: 10,
                      border: '1px solid #e2e8f0',
                      gap: 12,
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, color: '#0f172a' }}>
                        {rec.employee?.firstName ? `${rec.employee.firstName} ${rec.employee.lastName || ''}` : rec.employee?.name || 'Employee'}
                      </div>
                      <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                        Punch In: <strong>{inTime}</strong> | Punch Out: <strong>{outTime}</strong> | Status:{' '}
                        <span style={{ fontWeight: 700, color: rec.attendanceStatus === 'HALF_DAY' ? '#d97706' : '#059669' }}>
                          {rec.attendanceStatus || 'PRESENT'}
                        </span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 8 }}>
                      <Button
                        size="sm"
                        variant="outline"
                        loading={evaluatingRecordId === rec._id}
                        onClick={() => runEvaluation(rec._id, 'checkin')}
                        style={{ fontSize: '0.78rem' }}
                      >
                        Evaluate Check-In (09:15)
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        loading={evaluatingRecordId === rec._id}
                        onClick={() => runEvaluation(rec._id, 'checkout')}
                        style={{ fontSize: '0.78rem', borderColor: '#7c3aed', color: '#7c3aed' }}
                      >
                        Evaluate Stay-Back (19:15)
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 5: LATE RULE SIMULATOR */}
      {activeTab === 'simulator' && (
        <div style={{ background: '#ffffff', borderRadius: 14, padding: 24, border: '1px solid #e2e8f0' }}>
          <div style={{ marginBottom: 20 }}>
            <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Timer size={20} color="#7c3aed" /> Late Rule Simulator
            </h3>
            <p style={{ margin: '6px 0 0', fontSize: '0.86rem', color: '#64748b' }}>
              Enter a check-in time, check-out time, and current occurrence number to see what the system will decide.
            </p>
          </div>

          {/* Input Panel */}
          <div
            className="grid-3"
            style={{
              padding: '18px 20px',
              backgroundColor: '#f8fafc',
              borderRadius: 10,
              border: '1px solid #e2e8f0',
              marginBottom: 16,
            }}
          >
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#475569', marginBottom: 6 }}>
                Check-In Time (HH:mm)
              </label>
              <input
                type="time"
                value={simCheckIn}
                onChange={(e) => { setSimCheckIn(e.target.value); setSimResult(null); }}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '1rem', fontFamily: 'monospace', boxSizing: 'border-box' }}
              />
              <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: 4 }}>Standard: 09:00 | Cutoff: 09:15</div>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#475569', marginBottom: 6 }}>
                Check-Out Time (HH:mm)
              </label>
              <input
                type="time"
                value={simCheckOut}
                onChange={(e) => { setSimCheckOut(e.target.value); setSimResult(null); }}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '1rem', fontFamily: 'monospace', boxSizing: 'border-box' }}
              />
              <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: 4 }}>Standard: 19:00 | Stay-Back: ≥ 19:15</div>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#475569', marginBottom: 6 }}>
                This Month's Occurrence No.
              </label>
              <input
                type="number"
                min={1}
                max={10}
                value={simOccurrence}
                onChange={(e) => { setSimOccurrence(Number(e.target.value)); setSimResult(null); }}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '1rem', boxSizing: 'border-box' }}
              />
              <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: 4 }}>e.g. 3 = this would be the 3rd late this month</div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
            <Button variant="primary" icon={Zap} onClick={runLateSimulation} style={{ background: '#7c3aed', borderColor: '#7c3aed', padding: '10px 28px' }}>
              Run Simulation
            </Button>
          </div>

          {/* Simulation Result */}
          {simResult && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Status Banner */}
              <div
                style={{
                  padding: '16px 20px',
                  borderRadius: 10,
                  backgroundColor: simResult.attendanceStatus === 'HALF_DAY' ? '#fef2f2' : simResult.isLate && !simResult.isExemptedByStayBack ? '#fffbeb' : '#f0fdf4',
                  border: `2px solid ${simResult.attendanceStatus === 'HALF_DAY' ? '#fecaca' : simResult.isLate && !simResult.isExemptedByStayBack ? '#fde68a' : '#bbf7d0'}`,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                }}
              >
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor:
                      simResult.attendanceStatus === 'HALF_DAY' ? '#dc2626' :
                      simResult.isLate && !simResult.isExemptedByStayBack ? '#d97706' : '#16a34a',
                    flexShrink: 0,
                  }}
                >
                  {simResult.attendanceStatus === 'HALF_DAY' ? <XCircle size={24} color="#fff" /> :
                   simResult.isLate && !simResult.isExemptedByStayBack ? <AlertTriangle size={24} color="#fff" /> :
                   <CheckCircle size={24} color="#fff" />}
                </div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: '1.15rem', color: simResult.attendanceStatus === 'HALF_DAY' ? '#991b1b' : simResult.isLate && !simResult.isExemptedByStayBack ? '#92400e' : '#166534' }}>
                    Attendance Status: {simResult.attendanceStatus}
                  </div>
                  <div style={{ fontSize: '0.86rem', color: '#475569', marginTop: 2 }}>
                    {simResult.isExemptedByStayBack
                      ? `Late arrival (${simCheckIn}) but stayed till ${simCheckOut} — occurrence EXEMPTED by Stay-Back rule.`
                      : simResult.isLate
                      ? `Arrived ${simResult.minutesLate} minutes late. Occurrence #${simOccurrence} charged.${simResult.exceedsLimit ? ' Exceeded 5-limit → HALF_DAY applied.' : ' Within 5-occurrence limit → PRESENT maintained.'}`
                      : `On-time arrival (${simCheckIn} ≤ 09:15). No late occurrence recorded.`}
                  </div>
                </div>
              </div>

              {/* Decision breakdown */}
              <div className="grid-2">
                {[
                  {
                    label: 'Check-In: ' + simResult.checkInTime,
                    desc: simResult.isLate ? `${simResult.minutesLate} mins after 09:00 standard` : 'Within grace period (≤ 09:15)',
                    status: simResult.isLate ? 'late' : 'ok',
                    Icon: LogIn,
                  },
                  {
                    label: 'Late Cutoff: 09:15 AM',
                    desc: simResult.isLate ? `${simCheckIn} exceeds 09:15 → flagged as LATE` : `${simCheckIn} is within 09:15 → ON-TIME`,
                    status: simResult.isLate ? 'late' : 'ok',
                    Icon: AlertTriangle,
                  },
                  {
                    label: `Occurrence #${simOccurrence} this month`,
                    desc: !simResult.isLate
                      ? 'No occurrence recorded — not late'
                      : simResult.isExemptedByStayBack
                      ? 'Occurrence recorded but EXEMPTED by stay-back'
                      : simResult.exceedsLimit
                      ? `Exceeds 5-limit → 6th+ occurrence triggers HALF_DAY`
                      : `Within 5-occurrence allowance → PRESENT`,
                    status: !simResult.isLate ? 'neutral' : simResult.isExemptedByStayBack ? 'ok' : simResult.exceedsLimit ? 'halfday' : 'warn',
                    Icon: ShieldAlert,
                  },
                  {
                    label: 'Check-Out: ' + simResult.checkOutTime,
                    desc: simResult.hasStayBack
                      ? `${simCheckOut} ≥ 19:15 → Stay-Back exemption ${simResult.isLate ? 'APPLIED' : 'eligible (not late today)'}`
                      : `${simCheckOut} < 19:15 → No stay-back exemption`,
                    status: simResult.hasStayBack && simResult.isLate ? 'ok' : simResult.hasStayBack ? 'neutral' : 'warn',
                    Icon: LogOut,
                  },
                ].map((card, i) => {
                  const colors = {
                    ok: { bg: '#f0fdf4', border: '#bbf7d0', text: '#166534', icon: '#16a34a' },
                    late: { bg: '#fef2f2', border: '#fecaca', text: '#991b1b', icon: '#dc2626' },
                    warn: { bg: '#fffbeb', border: '#fde68a', text: '#92400e', icon: '#d97706' },
                    halfday: { bg: '#fef2f2', border: '#fecaca', text: '#991b1b', icon: '#dc2626' },
                    neutral: { bg: '#f8fafc', border: '#e2e8f0', text: '#334155', icon: '#64748b' },
                  };
                  const c = colors[card.status];
                  const Icon = card.Icon;
                  return (
                    <div key={i} style={{ padding: '12px 14px', backgroundColor: c.bg, borderRadius: 8, border: `1px solid ${c.border}` }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontWeight: 700, color: c.text, fontSize: '0.86rem', marginBottom: 5 }}>
                        <Icon size={15} color={c.icon} />
                        {card.label}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: '#475569' }}>{card.desc}</div>
                    </div>
                  );
                })}
              </div>

              {/* Quick test scenarios */}
              <div style={{ padding: '12px 14px', backgroundColor: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: '0.82rem' }}>
                <div style={{ fontWeight: 700, color: '#334155', marginBottom: 8 }}>Quick Test Scenarios:</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {[
                    { label: 'On-Time (9:00 → 19:00)', checkIn: '09:00', checkOut: '19:00', occ: 1 },
                    { label: 'Late #3 (9:25 → 18:00)', checkIn: '09:25', checkOut: '18:00', occ: 3 },
                    { label: 'Late #5 (9:30 → 19:00)', checkIn: '09:30', checkOut: '19:00', occ: 5 },
                    { label: 'Late #6 → HALF_DAY', checkIn: '09:20', checkOut: '18:30', occ: 6 },
                    { label: 'Late #6 + Stay-Back (→ PRESENT)', checkIn: '09:25', checkOut: '19:20', occ: 6 },
                  ].map((sc, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => { setSimCheckIn(sc.checkIn); setSimCheckOut(sc.checkOut); setSimOccurrence(sc.occ); setSimResult(null); }}
                      style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #e2e8f0', backgroundColor: '#fff', fontSize: '0.76rem', cursor: 'pointer', color: '#334155', fontWeight: 500 }}
                    >
                      {sc.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* CREATE / EDIT TIMING CONFIG MODAL (Step 1) */}
      <Modal
        isOpen={configModalOpen}
        onClose={() => setConfigModalOpen(false)}
        title={editingConfigId ? 'Edit Timing & Grace Rules' : 'Configure Timing & Grace Rules'}
      >
        <form onSubmit={handleSaveConfig} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#475569', marginBottom: 4 }}>
              Configuration Scope:
            </label>
            <select
              value={configForm.scope}
              onChange={(e) => {
                const sc = e.target.value;
                setConfigForm((prev) => ({
                  ...prev,
                  scope: sc,
                  referenceModel: sc === 'COMPANY' ? 'Company' : 'Branch',
                  reference: sc === 'COMPANY' ? (companies[0]?._id || '') : (branches[0]?._id || ''),
                }));
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
              <option value="BRANCH">Branch Level</option>
              <option value="COMPANY">Company Level</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#475569', marginBottom: 4 }}>
              {configForm.scope === 'COMPANY' ? 'Select Company:' : 'Select Branch:'}
            </label>
            <select
              value={configForm.reference}
              onChange={(e) => setConfigForm((prev) => ({ ...prev, reference: e.target.value }))}
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: 8,
                border: '1px solid #cbd5e1',
                fontSize: '0.9rem',
                background: '#ffffff',
              }}
              required
            >
              {configForm.scope === 'COMPANY'
                ? companies.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.name} ({c.code})
                    </option>
                  ))
                : branches.map((b) => (
                    <option key={b._id} value={b._id}>
                      {b.name} ({b.code})
                    </option>
                  ))}
            </select>
          </div>

          <div className="grid-2">
            <Input
              label="Standard Check-In (HH:mm)"
              type="text"
              value={configForm.standardCheckInTime}
              onChange={(e) => setConfigForm({ ...configForm, standardCheckInTime: e.target.value })}
              placeholder="09:00"
              required
            />
            <Input
              label="Standard Check-Out (HH:mm)"
              type="text"
              value={configForm.standardCheckOutTime}
              onChange={(e) => setConfigForm({ ...configForm, standardCheckOutTime: e.target.value })}
              placeholder="19:00"
              required
            />
          </div>

          <div className="grid-2">
            <Input
              label="Late Cutoff (HH:mm)"
              type="text"
              value={configForm.lateCutoffTime}
              onChange={(e) => setConfigForm({ ...configForm, lateCutoffTime: e.target.value })}
              placeholder="09:15"
              helperText="15-min grace threshold"
              required
            />
            <Input
              label="Allowed Late Occurrences / Mo"
              type="number"
              value={configForm.allowedLateOccurrences}
              onChange={(e) => setConfigForm({ ...configForm, allowedLateOccurrences: Number(e.target.value) })}
              placeholder="5"
              helperText="Escalates to HALF_DAY on 6th+"
              required
            />
          </div>

          <Input
            label="Same-Day Stay-Back Exemption Time (HH:mm)"
            type="text"
            value={configForm.stayBackExemptionTime}
            onChange={(e) => setConfigForm({ ...configForm, stayBackExemptionTime: e.target.value })}
            placeholder="19:15"
            helperText="Check-out at or after this time settles today's late occurrence"
            required
          />

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 12 }}>
            <Button variant="light" type="button" onClick={() => setConfigModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" loading={savingConfig}>
              {editingConfigId ? 'Update Rules' : 'Save Rules'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* MANUAL HR EXEMPTION OVERRIDE MODAL (Step 5) */}
      <Modal
        isOpen={exemptModalOpen}
        onClose={() => setExemptModalOpen(false)}
        title="Manual Administrative Exemption Override"
      >
        <form onSubmit={handleExemptSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {selectedOccurrence && (
            <div style={{ background: '#f8fafc', padding: 14, borderRadius: 8, border: '1px solid #e2e8f0', fontSize: '0.85rem' }}>
              <div>
                Employee: <strong>{selectedOccurrence.employee?.name || selectedOccurrence.employee?.firstName || 'Staff'}</strong>
              </div>
              <div>
                Date: <strong>{selectedOccurrence.attendanceDate ? new Date(selectedOccurrence.attendanceDate).toLocaleDateString() : '-'}</strong>
              </div>
              <div>
                Minutes Late: <strong style={{ color: '#dc2626' }}>{selectedOccurrence.minutesLate} mins</strong> (Occurrence #{selectedOccurrence.occurrenceNumber})
              </div>
            </div>
          )}

          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#475569', marginBottom: 4 }}>
              Mandatory Exemption Remark / Reason:
            </label>
            <textarea
              rows={3}
              value={exemptRemark}
              onChange={(e) => setExemptRemark(e.target.value)}
              placeholder="e.g. Medical emergency on road, hospital receipt verified by HR"
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
            <span style={{ fontSize: '0.74rem', color: '#64748b' }}>
              Exempting this occurrence will reduce the employee's chargeable late count and automatically revert HALF_DAY status to PRESENT.
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
            <Button variant="light" type="button" onClick={() => setExemptModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" loading={submittingExempt} style={{ background: '#059669', borderColor: '#059669' }}>
              Grant Exemption
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default TimingRules;
