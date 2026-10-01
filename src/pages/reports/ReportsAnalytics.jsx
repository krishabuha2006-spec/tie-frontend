import React, { useState, useEffect, useCallback } from 'react';
import reportsApi from '../../api/reportsApi';
import masterApi from '../../api/masterApi';
import attendanceApi from '../../api/attendanceApi';
import leaveHolidayApi from '../../api/leaveHolidayApi';
import payrollApi from '../../api/payrollApi';
import assetsLoansApi from '../../api/assetsLoansApi';
import performanceApi from '../../api/performanceApi';
import employeeApi from '../../api/employeeApi';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { useConfirm } from '../../context/ConfirmContext';
import {
  BarChart3,
  FileSpreadsheet,
  Download,
  FileText,
  Plus,
  RefreshCw,
  History,
  Search,
  ChevronRight,
  TrendingUp,
  Users,
  Calendar,
  DollarSign,
  Award,
  Package,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Clock,
  Filter,
  Layers,
  Edit2,
  Shield,
  CreditCard,
  Briefcase,
} from 'lucide-react';
import Modal from '../../components/common/Modal';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import Select from '../../components/common/Select';
import Badge from '../../components/common/Badge';
import { extractApiData } from '../../utils/apiUtils';

const CATEGORY_CONFIG = {
  ATTENDANCE: { color: '#6366f1', bg: 'rgba(99, 102, 241, 0.1)', icon: Calendar, label: 'Attendance' },
  LEAVE: { color: '#0ea5e9', bg: 'rgba(14, 165, 233, 0.1)', icon: Calendar, label: 'Leave' },
  PAYROLL: { color: '#10b981', bg: 'rgba(16, 185, 129, 0.1)', icon: DollarSign, label: 'Payroll' },
  ASSETS: { color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)', icon: Package, label: 'Assets' },
  REIMBURSEMENTS: { color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.1)', icon: CreditCard, label: 'Reimbursements' },
  LOANS: { color: '#14b8a6', bg: 'rgba(20, 184, 166, 0.1)', icon: DollarSign, label: 'Loans & Advances' },
  PERFORMANCE: { color: '#ec4899', bg: 'rgba(236, 72, 153, 0.1)', icon: Award, label: 'Performance' },
  LIFECYCLE: { color: '#f43f5e', bg: 'rgba(244, 63, 94, 0.1)', icon: Users, label: 'Lifecycle' },
  HR: { color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.1)', icon: Users, label: 'HR' },
  DEFAULT: { color: '#64748b', bg: 'rgba(100, 116, 139, 0.1)', icon: BarChart3, label: 'General' },
};

const getCatConfig = (cat) => CATEGORY_CONFIG[cat?.toUpperCase()] || CATEGORY_CONFIG.DEFAULT;

const DEFAULT_CATALOG = [
  {
    reportKey: 'attendance-daily-summary',
    name: 'Daily & Monthly Attendance Summary',
    category: 'ATTENDANCE',
    description: 'Aggregates employee attendance status across Office, Field, and Site modalities with work hours.',
    supportsExcelExport: true,
    supportsPdfExport: true,
  },
  {
    reportKey: 'attendance-late-arrivals',
    name: 'Late Arrivals & Shortfall Records',
    category: 'ATTENDANCE',
    description: 'Captures employees who punched in after the configured grace period with late minutes.',
    supportsExcelExport: true,
    supportsPdfExport: true,
  },
  {
    reportKey: 'leave-balance-summary',
    name: 'Employee Leave Balance Summary',
    category: 'LEAVE',
    description: 'Current leave balances by type across all employees with carry-forward info.',
    supportsExcelExport: true,
    supportsPdfExport: true,
  },
  {
    reportKey: 'leave-utilization-analysis',
    name: 'Leave Utilization Analysis',
    category: 'LEAVE',
    description: 'Monthly & quarterly utilization patterns and peak absence periods.',
    supportsExcelExport: true,
    supportsPdfExport: true,
  },
  {
    reportKey: 'payroll-cost-statutory',
    name: 'Payroll Cost & Statutory Summary',
    category: 'PAYROLL',
    description: 'Gross payroll outlay, PF, ESIC, PT, TDS breakdowns by department and month.',
    supportsExcelExport: true,
    supportsPdfExport: true,
  },
  {
    reportKey: 'payroll-disbursement-status',
    name: 'Salary Payment & Disbursement Status',
    category: 'PAYROLL',
    description: 'Bank transfer statuses, payment confirmation logs, and disbursement modes.',
    supportsExcelExport: true,
    supportsPdfExport: true,
  },
  {
    reportKey: 'assets-allocation-utilization',
    name: 'Asset Allocation & Utilization Report',
    category: 'ASSETS',
    description: 'Physical custody register with asset age, condition, and assignment states.',
    supportsExcelExport: true,
    supportsPdfExport: true,
  },
  {
    reportKey: 'loans-ledger-summary',
    name: 'Loans & Advances Ledger Summary',
    category: 'LOANS',
    description: 'Employee loan disbursements, EMI payment records, and remaining balances.',
    supportsExcelExport: true,
    supportsPdfExport: true,
  },
  {
    reportKey: 'performance-kra-scorecard',
    name: 'KRA Appraisal Scorecards',
    category: 'PERFORMANCE',
    description: 'Aggregated self vs manager KRA appraisal scores with performance band distributions.',
    supportsExcelExport: true,
    supportsPdfExport: true,
  },
  {
    reportKey: 'lifecycle-transitions-registry',
    name: 'Lifecycle Transitions Registry',
    category: 'LIFECYCLE',
    description: 'Probation confirmations, role promotions, site relocations, and exit clearance logs.',
    supportsExcelExport: true,
    supportsPdfExport: true,
  },
  {
    reportKey: 'tasks-overdue',
    name: 'Overdue Operational Tasks',
    category: 'DEFAULT',
    description: 'Cross-project analysis of pending and delayed action items with assigned owners.',
    supportsExcelExport: true,
    supportsPdfExport: true,
  },
  {
    reportKey: 'tasks-completion',
    name: 'Task Completion & Velocity Rates',
    category: 'DEFAULT',
    description: 'Completion metrics, throughput rate and sprint achievement percentages.',
    supportsExcelExport: true,
    supportsPdfExport: true,
  },
  {
    reportKey: 'site-logs-incomplete',
    name: 'Incomplete Site Logs Register',
    category: 'DEFAULT',
    description: 'Daily construction/field work logs awaiting signoff, weather delays, and work summaries.',
    supportsExcelExport: true,
    supportsPdfExport: true,
  },
  {
    reportKey: 'salary-payments-outstanding',
    name: 'Outstanding Salary Disbursements',
    category: 'PAYROLL',
    description: 'Unpaid and pending multi-leg salary disbursements across active payroll runs.',
    supportsExcelExport: true,
    supportsPdfExport: true,
  },
];

export const ReportsAnalytics = () => {
  const { isSuperAdmin, isHrAdmin } = useAuth();
  const canManageCatalog = isSuperAdmin;
  const { showToast } = useToast();

  // Active Tab: 'catalog' | 'export_logs'
  const [activeTab, setActiveTab] = useState('catalog');

  // Master Lists for Filters
  const [branches, setBranches] = useState([]);
  const [departments, setDepartments] = useState([]);

  // Catalog State
  const [catalog, setCatalog] = useState([]);
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [catFilter, setCatFilter] = useState('ALL');

  // Live Query & Aggregated Data State
  const [reportData, setReportData] = useState(null);
  const [loadingData, setLoadingData] = useState(false);
  const [filters, setFilters] = useState({
    startDate: new Date().getFullYear() + '-01-01',
    endDate: new Date().toISOString().split('T')[0],
    branch: 'ALL',
    department: 'ALL',
    status: 'ALL',
  });
  const [activePreset, setActivePreset] = useState('year');

  const applyDatePreset = (preset) => {
    setActivePreset(preset);
    const today = new Date();
    const toStr = today.toISOString().split('T')[0];
    let fromStr = toStr;

    if (preset === 'today') {
      fromStr = toStr;
    } else if (preset === 'month') {
      fromStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
    } else if (preset === '30days') {
      const past = new Date(today);
      past.setDate(past.getDate() - 30);
      fromStr = past.toISOString().split('T')[0];
    } else if (preset === 'quarter') {
      const qMonth = Math.floor(today.getMonth() / 3) * 3 + 1;
      fromStr = `${today.getFullYear()}-${String(qMonth).padStart(2, '0')}-01`;
    } else if (preset === 'year') {
      fromStr = `${today.getFullYear()}-01-01`;
    } else if (preset === 'all') {
      fromStr = '2024-01-01';
    }

    const updated = { ...filters, startDate: fromStr, endDate: toStr };
    setFilters(updated);
    if (selectedReport) {
      handleSelectReport(selectedReport, updated);
    }
  };

  // Export State
  const [exportingFormat, setExportingFormat] = useState(null);
  const [exportLogs, setExportLogs] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  // Register / Edit Definition Modal
  const [definitionModalOpen, setDefinitionModalOpen] = useState(false);
  const [isEditingDef, setIsEditingDef] = useState(false);
  const [definitionForm, setDefinitionForm] = useState({
    id: '',
    reportKey: '',
    name: '',
    category: 'ATTENDANCE',
    description: '',
    supportsExcelExport: true,
    supportsPdfExport: true,
  });
  const [submittingDef, setSubmittingDef] = useState(false);

  // Initial Load
  useEffect(() => {
    loadMasters();
    loadCatalog();
  }, []);

  useEffect(() => {
    if (activeTab === 'export_logs') {
      loadExportLogs();
    }
  }, [activeTab]);

  const loadMasters = async () => {
    try {
      const [bRes, dRes] = await Promise.all([
        masterApi.getBranches().catch(() => ({ data: [] })),
        masterApi.getDepartments().catch(() => ({ data: [] })),
      ]);
      setBranches(extractApiData(bRes, 'branches', 'data'));
      setDepartments(extractApiData(dRes, 'departments', 'data'));
    } catch (err) {
      console.error('Failed to load masters:', err);
    }
  };

  // -------------------------------------------------------------------------
  // 1. GET /reports/catalog - Load Catalog Definitions
  // -------------------------------------------------------------------------
  const loadCatalog = useCallback(async () => {
    setLoadingCatalog(true);
    try {
      const res = await reportsApi.getReportCatalog();
      const raw = extractApiData(res, 'catalog', 'data', 'reports');
      const normalized = (Array.isArray(raw) ? raw : []).map((item, i) => ({
        ...item,
        _id: item._id || item.id,
        reportKey: item.reportKey || item.key || item.code || `report_${i}`,
        name: item.name || item.title || item.reportKey || `Report ${i + 1}`,
        category: item.category || 'DEFAULT',
        description: item.description || '',
        supportsExcelExport: item.supportsExcelExport ?? true,
        supportsPdfExport: item.supportsPdfExport ?? true,
      }));

      // Combine backend catalog with default presets if backend returns empty
      const combined = normalized.length > 0 ? normalized : DEFAULT_CATALOG;
      setCatalog(combined);
      if (combined.length > 0) {
        handleSelectReport(combined[0]);
      }
    } catch {
      setCatalog(DEFAULT_CATALOG);
      handleSelectReport(DEFAULT_CATALOG[0]);
    } finally {
      setLoadingCatalog(false);
    }
  }, []);

  // -------------------------------------------------------------------------
  // 2. GET /reports/:reportKey - Execute Live Aggregation Query
  // -------------------------------------------------------------------------
  const handleSelectReport = useCallback(
    async (report, overrideFilters) => {
      const rKey = report?.reportKey || report?.key;
      if (!rKey) return;

      setSelectedReport(report);
      setReportData(null);
      setLoadingData(true);

      const f = overrideFilters || filters;
      const queryParams = {
        from: f.startDate,
        to: f.endDate,
        branch: f.branch !== 'ALL' ? f.branch : undefined,
        department: f.department !== 'ALL' ? f.department : undefined,
        status: f.status !== 'ALL' ? f.status : undefined,
      };

      try {
        // Step 1: Call live backend API endpoint GET /reports/:reportKey
        const res = await reportsApi.getReportData(rKey, queryParams);

        if (res?.data && (res.data.columns || res.data.rows || Array.isArray(res.data))) {
          setReportData(res.data);
          return;
        }
        if (res && (res.columns || res.rows || Array.isArray(res))) {
          setReportData(res);
          return;
        }

        // Step 2: Fallback query directly across corresponding live domain modules
        const fallbackData = await fetchReportFallback(rKey, report?.category, f);
        setReportData(fallbackData);
      } catch (err) {
        // Step 3: Gracefully fallback to domain module if report definition is dynamic
        try {
          const fallbackData = await fetchReportFallback(rKey, report?.category, f);
          setReportData(fallbackData);
        } catch {
          setReportData({
            columns: ['Record Code', 'Entity Name', 'Department', 'Date', 'Status'],
            rows: [],
            summary: { total: 0, period: `${f.startDate} to ${f.endDate}` },
          });
        }
      } finally {
        setLoadingData(false);
      }
    },
    [filters]
  );

  // Helper Fallback across live domain endpoints
  const fetchReportFallback = async (rKey, category, f) => {
    const cat = category?.toUpperCase() || '';

    // Attendance
    if (cat === 'ATTENDANCE' || rKey.includes('attendance')) {
      const attRes = await attendanceApi
        .getAllOfficeAttendance({ from: f.startDate, to: f.endDate })
        .catch(() => attendanceApi.getMyOfficeAttendance({ from: f.startDate, to: f.endDate }));
      const list = extractApiData(attRes, 'records', 'data');
      if (list.length > 0) {
        const isLate = rKey.includes('late');
        const rows = list
          .filter((item) => !isLate || item.isLate || item.status === 'LATE' || item.lateMinutes > 0)
          .map((item) => {
            const emp = item.employee || {};
            const empName = emp.basicInfo?.fullName || emp.name || item.employeeName || 'Staff Member';
            const empCode = emp.employeeCode || emp.code || '—';
            const dept = emp.employmentInfo?.department?.name || emp.department?.name || 'Operations';
            const date = item.date ? String(item.date).substring(0, 10) : '—';
            const punchIn = item.checkIn?.time || item.punchIn || '—';
            const punchOut = item.checkOut?.time || item.punchOut || '—';
            const workHrs = item.workHours != null ? `${item.workHours} hrs` : '—';
            const status = item.status || (item.isLate ? 'LATE' : 'PRESENT');
            return [empCode, empName, dept, date, punchIn, punchOut, workHrs, status];
          });
        return {
          columns: ['Employee Code', 'Employee Name', 'Department', 'Date', 'Punch In', 'Punch Out', 'Work Hours', 'Status'],
          rows,
          summary: { total: rows.length, period: `${f.startDate} to ${f.endDate}` },
        };
      }
    }

    // Leave
    if (cat === 'LEAVE' || rKey.includes('leave')) {
      const leaveRes = await leaveHolidayApi
        .getLeaveRequests({ from: f.startDate, to: f.endDate })
        .catch(() => leaveHolidayApi.getMyLeaves());
      const list = extractApiData(leaveRes, 'leaveRequests', 'requests', 'data');
      if (list.length > 0) {
        const rows = list.map((item) => {
          const emp = item.employee || {};
          const empName = emp.basicInfo?.fullName || emp.name || 'Staff Member';
          const empCode = emp.employeeCode || emp.code || '—';
          const leaveType = item.leaveType?.name || item.leaveType?.code || 'General Leave';
          const fromDate = item.startDate ? String(item.startDate).substring(0, 10) : '—';
          const toDate = item.endDate ? String(item.endDate).substring(0, 10) : '—';
          const days = item.daysCount || item.days || item.numberOfDays || 1;
          const status = item.status || 'PENDING';
          return [empCode, empName, leaveType, fromDate, toDate, `${days} day(s)`, status];
        });
        return {
          columns: ['Employee Code', 'Employee Name', 'Leave Type', 'Start Date', 'End Date', 'Duration', 'Approval Status'],
          rows,
          summary: { total: rows.length, period: `${f.startDate} to ${f.endDate}` },
        };
      }
    }

    // Payroll
    if (cat === 'PAYROLL' || rKey.includes('payroll')) {
      const payRes = await payrollApi.getPayrollRuns();
      const list = Array.isArray(payRes) ? payRes : payRes?.data || payRes?.runs || [];
      if (list.length > 0) {
        const rows = list.map((item) => {
          const period = `${item.month || '—'}/${item.year || '—'}`;
          const empCount = item.totalEmployees || item.employeeCount || 0;
          const gross = item.totalGross || item.grossPay ? `₹${Number(item.totalGross || item.grossPay).toLocaleString('en-IN')}` : '₹0';
          const deductions = item.totalDeductions ? `₹${Number(item.totalDeductions).toLocaleString('en-IN')}` : '₹0';
          const net = item.totalNet || item.netPay ? `₹${Number(item.totalNet || item.netPay).toLocaleString('en-IN')}` : '₹0';
          const status = item.status || 'DRAFT';
          return [period, `${item.payPeriodFrom || '—'} to ${item.payPeriodTo || '—'}`, empCount, gross, deductions, net, status];
        });
        return {
          columns: ['Pay Period', 'Date Range', 'Employees', 'Gross Outlay', 'Total Deductions', 'Net Disbursed', 'Status'],
          rows,
          summary: { total: rows.length, period: `${f.startDate} to ${f.endDate}` },
        };
      }
    }

    // Assets
    if (cat === 'ASSETS' || rKey.includes('asset')) {
      const assetRes = await assetsLoansApi.getAssets();
      const list = Array.isArray(assetRes) ? assetRes : assetRes?.data || assetRes?.assets || [];
      if (list.length > 0) {
        const rows = list.map((item) => {
          const tag = item.assetTag || item.tag || '—';
          const name = item.name || item.title || '—';
          const catName = item.category || 'Hardware';
          const condition = item.condition || 'Good';
          const assigned = item.currentAssignment?.employee?.name || item.assignedTo?.name || 'In Stock';
          const status = item.status || 'AVAILABLE';
          return [tag, name, catName, condition, assigned, status];
        });
        return {
          columns: ['Asset Tag', 'Asset Name', 'Category', 'Condition', 'Custody Assignment', 'Status'],
          rows,
          summary: { total: rows.length, period: 'Current Physical Register' },
        };
      }
    }

    // Performance / KRA Appraisal Scorecards
    if (cat === 'PERFORMANCE' || rKey.includes('performance') || rKey.includes('kra')) {
      const [myRes, pendingRes] = await Promise.allSettled([
        performanceApi.getMyReviews(),
        performanceApi.getPendingManagerReviews(),
      ]);
      const myReviews = myRes.status === 'fulfilled' ? extractApiData(myRes.value, 'reviews', 'data') : [];
      const pendingReviews = pendingRes.status === 'fulfilled' ? extractApiData(pendingRes.value, 'reviews', 'data') : [];
      const map = new Map();
      [...myReviews, ...pendingReviews].forEach((r) => {
        if (r?._id) map.set(r._id, r);
      });
      const list = Array.from(map.values());
      if (list.length > 0) {
        const rows = list.map((item) => {
          const emp = item.employee?.basicInfo?.fullName || item.employee?.name || 'Staff Member';
          const cycle = item.reviewCycle || 'Q3-2026';
          const tpl = item.kraTemplate?.name || 'Standard KRA';
          const self = item.selfScore || item.overallSelfRating ? `${Number(item.selfScore || item.overallSelfRating).toFixed(1)} / 5.0` : 'Pending';
          const manager = item.overallScore || item.managerScore ? `${Number(item.overallScore || item.managerScore).toFixed(1)} / 5.0` : 'Pending';
          const status = item.status || 'SELF_ASSESSMENT_PENDING';
          return [cycle, emp, tpl, self, manager, status];
        });
        return {
          columns: ['Review Cycle', 'Reviewee / Employee', 'KRA Template', 'Self Rating', 'Manager Rating', 'Evaluation Status'],
          rows,
          summary: { total: rows.length, period: `${f.startDate} to ${f.endDate}` },
        };
      }
    }

    // Loans & Advances Ledger
    if (cat === 'LOANS' || rKey.includes('loan')) {
      const loanRes = await assetsLoansApi
        .getAllLoans({ from: f.startDate, to: f.endDate })
        .catch(() => assetsLoansApi.getMyLoans());
      const list = extractApiData(loanRes, 'loanRequests', 'requests', 'loans', 'data');
      if (list.length > 0) {
        const rows = list.map((item) => {
          const code = item.loanCode || item.applicationNumber || 'LOAN';
          const emp = item.employee?.basicInfo?.fullName || item.employee?.name || 'Employee';
          const type = item.loanType?.name || 'Personal Advance';
          const amt = item.principalAmount || item.amount ? `₹${Number(item.principalAmount || item.amount).toLocaleString('en-IN')}` : '₹0';
          const emi = item.monthlyEmi ? `₹${Number(item.monthlyEmi).toLocaleString('en-IN')}` : '—';
          const status = item.status || 'PENDING';
          return [code, emp, type, amt, emi, status];
        });
        return {
          columns: ['Loan Code', 'Employee', 'Loan Type', 'Principal Amount', 'Monthly EMI', 'Status'],
          rows,
          summary: { total: rows.length, period: 'Active Loan Applications' },
        };
      }
    }

    // Operational Tasks (Overdue & Velocity)
    if (rKey.includes('task')) {
      try {
        const tRes = rKey.includes('overdue')
          ? await reportsApi.getOverdueTasksReport()
          : await reportsApi.getTaskCompletionRateReport();
        const list = extractApiData(tRes, 'tasks', 'reports', 'data');
        if (Array.isArray(list) && list.length > 0) {
          const rows = list.map((item) => {
            const title = item.title || item.taskName || 'Operational Task';
            const assignee = item.assignedTo?.name || item.employee?.name || 'Unassigned';
            const project = item.project?.name || 'General';
            const due = item.dueDate ? String(item.dueDate).substring(0, 10) : '—';
            const status = item.status || 'OVERDUE';
            return [title, project, assignee, due, status];
          });
          return {
            columns: ['Task Name', 'Project / Site', 'Assignee', 'Due Date', 'Status'],
            rows,
            summary: { total: rows.length, period: 'Task Operations' },
          };
        }
      } catch {
        // continue
      }
    }

    // Outstanding Salary Disbursements
    if (rKey.includes('salary-payments-outstanding')) {
      try {
        const pRes = await reportsApi.getOutstandingSalaryPaymentsReport();
        const list = extractApiData(pRes, 'payments', 'outstanding', 'data');
        if (Array.isArray(list) && list.length > 0) {
          const rows = list.map((item) => {
            const emp = item.employee?.name || 'Employee';
            const run = item.payrollRun?.payPeriodFrom ? `${item.payrollRun.payPeriodFrom.substring(0, 7)}` : 'Current Run';
            const net = item.netPayable ? `₹${Number(item.netPayable).toLocaleString('en-IN')}` : '₹0';
            const paid = item.paidAmount ? `₹${Number(item.paidAmount).toLocaleString('en-IN')}` : '₹0';
            const status = item.paymentStatus || 'PENDING';
            return [emp, run, net, paid, status];
          });
          return {
            columns: ['Employee', 'Payroll Period', 'Net Payable', 'Disbursed Amount', 'Payment Status'],
            rows,
            summary: { total: rows.length, period: 'Outstanding Payroll Disbursements' },
          };
        }
      } catch {
        // continue
      }
    }

    // Default Employee Directory
    const empRes = await employeeApi.getEmployees({ limit: 100 });
    const list = extractApiData(empRes, 'employees', 'data');
    const rows = list.map((item) => {
      const code = item.employeeCode || item.basicInfo?.employeeCode || '—';
      const name = item.basicInfo?.fullName || item.name || `${item.firstName || ''} ${item.lastName || ''}`.trim();
      const dept = item.employmentInfo?.department?.name || item.department?.name || 'General';
      const desig = item.employmentInfo?.designation?.title || item.designation?.title || 'Staff';
      const status = item.status || 'ACTIVE';
      return [code, name, dept, desig, status];
    });
    return {
      columns: ['Employee Code', 'Full Name', 'Department', 'Designation', 'Status'],
      rows,
      summary: { total: rows.length, period: 'Live Workforce Directory' },
    };
  };

  // -------------------------------------------------------------------------
  // 3. GET /reports/:reportKey/export - Multi-Format Export (Excel, CSV, PDF)
  // -------------------------------------------------------------------------
  const handleExport = async (format) => {
    if (!selectedReport) {
      showToast('Select a report first', 'warning');
      return;
    }
    const rKey = selectedReport.reportKey || selectedReport.key;
    const reportTitle = selectedReport.name || selectedReport.title || rKey;
    const cat = selectedReport.category || 'GENERAL';
    const periodStr = `${filters.startDate} to ${filters.endDate}`;
    const filename = `${rKey}_${filters.startDate}_${filters.endDate}`;

    const { columns, rows } = extractTableData(reportData);
    setExportingFormat(format);
    const apiFormat = format === 'excel' ? 'XLSX' : format.toUpperCase();

    try {
      // Call live backend endpoint: GET /reports/:reportKey/export
      let backendBlob = null;
      let contentType = '';
      try {
        const res = await reportsApi.exportReport(rKey, {
          from: filters.startDate,
          to: filters.endDate,
          format: apiFormat,
          branch: filters.branch !== 'ALL' ? filters.branch : undefined,
          department: filters.department !== 'ALL' ? filters.department : undefined,
        });
        backendBlob = res?.blob || res?.data || res;
        contentType = res?.contentType || backendBlob?.type || '';
      } catch (apiErr) {
        console.warn('Backend binary stream notice, applying direct data export:', apiErr);
      }

      // Deliver file to browser
      if (format === 'csv') {
        if (backendBlob && backendBlob.size > 50 && (contentType.includes('csv') || !contentType.includes('json'))) {
          const text = await backendBlob.text();
          const cleanText = text.startsWith('\uFEFF') ? text : '\uFEFF' + text;
          triggerBlobDownload(new Blob([cleanText], { type: 'text/csv;charset=utf-8;' }), `${filename}.csv`);
        } else {
          exportTableToCsv(filename, columns, rows);
        }
        showToast('CSV report downloaded successfully!', 'success');
      } else if (format === 'excel') {
        if (
          backendBlob &&
          backendBlob.size > 50 &&
          (contentType.includes('spreadsheet') || contentType.includes('excel') || contentType.includes('octet-stream'))
        ) {
          triggerBlobDownload(backendBlob, `${filename}.xlsx`);
        } else {
          exportTableToExcel(filename, reportTitle, columns, rows);
        }
        showToast('Excel report downloaded successfully!', 'success');
      } else if (format === 'pdf') {
        if (backendBlob && backendBlob.size > 100 && contentType.includes('pdf')) {
          triggerBlobDownload(backendBlob, `${filename}.pdf`);
          showToast('PDF report downloaded successfully!', 'success');
        } else {
          openReportPrintPdf(reportTitle, cat, periodStr, columns, rows);
          showToast('Printable PDF report preview generated!', 'success');
        }
      }

      // Refresh export logs
      loadExportLogs().catch(() => {});
    } catch (err) {
      console.error('Export error:', err);
      showToast('Export failed. Please try again.', 'error');
    } finally {
      setExportingFormat(null);
    }
  };

  // Helper Downloads
  const triggerBlobDownload = (blob, name) => {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', name);
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => window.URL.revokeObjectURL(url), 1500);
  };

  const exportTableToCsv = (filename, columns = [], rows = []) => {
    const escapeCsv = (val) => `"${getCleanCellText(val).replace(/"/g, '""')}"`;
    const headerLine = columns.map(escapeCsv).join(',');
    const rowLines = rows.map((r) => (Array.isArray(r) ? r : Object.values(r)).map(escapeCsv).join(','));
    const fullContent = '\uFEFF' + [headerLine, ...rowLines].join('\r\n');
    const blob = new Blob([fullContent], { type: 'text/csv;charset=utf-8;' });
    triggerBlobDownload(blob, filename.endsWith('.csv') ? filename : `${filename}.csv`);
  };

  const exportTableToExcel = (filename, reportTitle, columns = [], rows = []) => {
    const tableHeader = columns.map((c) => `<th>${String(c).replace(/_/g, ' ')}</th>`).join('');
    const tableRows = rows
      .map(
        (r) => `
      <tr>
        ${(Array.isArray(r) ? r : Object.values(r))
          .map((v) => `<td>${getCleanCellText(v)}</td>`)
          .join('')}
      </tr>
    `
      )
      .join('');

    const xml = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta http-equiv="content-type" content="text/plain; charset=UTF-8"/>
        <style>
          th { background-color: #4f46e5; color: #ffffff; font-weight: bold; font-family: Arial, sans-serif; font-size: 11pt; height: 32px; padding: 6px 12px; border: 1px solid #4338ca; }
          td { font-family: Arial, sans-serif; font-size: 10pt; padding: 6px 10px; border: 1px solid #e2e8f0; vertical-align: middle; }
          .title { font-size: 15pt; font-weight: bold; color: #4f46e5; font-family: Arial, sans-serif; height: 36px; }
          .meta { font-size: 9pt; color: #64748b; font-family: Arial, sans-serif; height: 22px; }
        </style>
      </head>
      <body>
        <table>
          <tr><td colspan="${Math.max(columns.length, 1)}" class="title">${reportTitle}</td></tr>
          <tr><td colspan="${Math.max(columns.length, 1)}" class="meta">Exported from TIE Corporation HRMS &bull; Generated on ${new Date().toLocaleString()}</td></tr>
          <tr></tr>
          <thead><tr>${tableHeader}</tr></thead>
          <tbody>${tableRows}</tbody>
        </table>
      </body>
      </html>
    `;
    const blob = new Blob(['\uFEFF' + xml], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    triggerBlobDownload(blob, filename.endsWith('.xls') ? filename : `${filename}.xls`);
  };

  const openReportPrintPdf = (reportTitle, category, period, columns = [], rows = []) => {
    const printWin = window.open('', '_blank', 'width=1100,height=850');
    if (!printWin) {
      showToast('Please allow browser popups to preview the printable PDF report', 'warning');
      return;
    }
    const tableRows = rows
      .map(
        (r, idx) => `
      <tr style="background: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'};">
        ${(Array.isArray(r) ? r : Object.values(r))
          .map(
            (v) =>
              `<td style="padding: 8px 10px; border-bottom: 1px solid #e2e8f0; font-size: 11px; color: #1e293b;">${
                getCleanCellText(v) || '—'
              }</td>`
          )
          .join('')}
      </tr>
    `
      )
      .join('');

    const doc = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>${reportTitle} - TIE HRMS Report</title>
        <style>
          @page { size: landscape; margin: 12mm; }
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; margin: 0; padding: 20px; color: #0f172a; background: #fff; }
          .hdr { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #4f46e5; padding-bottom: 12px; margin-bottom: 16px; }
          .corp-name { font-size: 18px; font-weight: 800; color: #4f46e5; letter-spacing: -0.3px; }
          .corp-sub { font-size: 10px; color: #64748b; margin-top: 2px; }
          .rep-title { font-size: 15px; font-weight: 700; color: #0f172a; margin: 4px 0 2px; }
          .rep-meta { font-size: 11px; color: #475569; display: flex; gap: 16px; margin-top: 4px; }
          .badge { display: inline-block; padding: 3px 8px; border-radius: 10px; font-size: 10px; font-weight: 700; background: rgba(79, 70, 229, 0.1); color: #4f46e5; text-transform: uppercase; }
          table { width: 100%; border-collapse: collapse; margin-top: 12px; }
          th { background: #4f46e5; color: #ffffff; text-align: left; padding: 8px 10px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }
          .ftr { margin-top: 20px; padding-top: 10px; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; font-size: 10px; color: #94a3b8; }
          @media print {
            body { padding: 0; }
            .no-print { display: none !important; }
          }
        </style>
      </head>
      <body>
        <div class="no-print" style="margin-bottom: 14px; display: flex; gap: 10px; align-items: center; background: #f0fdf4; border: 1px solid #bbf7d0; padding: 10px 14px; border-radius: 8px;">
          <span style="font-size: 12px; font-weight: 600; color: #166534;">Printable Report Ready</span>
          <button onclick="window.print()" style="margin-left: auto; background: #4f46e5; color: #fff; border: none; padding: 6px 14px; border-radius: 6px; font-weight: 600; cursor: pointer; font-size: 11px;">Print / Save as PDF</button>
          <button onclick="window.close()" style="background: #e2e8f0; color: #475569; border: none; padding: 6px 10px; border-radius: 6px; font-weight: 600; cursor: pointer; font-size: 11px;">Close</button>
        </div>
        <div class="hdr">
          <div>
            <div class="corp-name">TIE CORPORATION</div>
            <div class="corp-sub">Human Resource Management &amp; Enterprise Analytics Layer</div>
            <div class="rep-title">${reportTitle}</div>
            <div class="rep-meta">
              <span><strong>Period:</strong> ${period}</span>
              <span><strong>Total Records:</strong> ${rows.length}</span>
              <span><strong>Generated:</strong> ${new Date().toLocaleString()}</span>
            </div>
          </div>
          <div><span class="badge">${category}</span></div>
        </div>
        <table>
          <thead><tr>${columns.map((c) => `<th>${String(c).replace(/_/g, ' ')}</th>`).join('')}</tr></thead>
          <tbody>${tableRows}</tbody>
        </table>
        <div class="ftr">
          <span>Confidential &bull; Internal HR &amp; Executive Management Use</span>
          <span>Generated by TIE Corporation Enterprise Layer</span>
        </div>
        <script>
          window.addEventListener('load', () => { setTimeout(() => { window.print(); }, 400); });
        </script>
      </body>
      </html>
    `;
    printWin.document.open();
    printWin.document.write(doc);
    printWin.document.close();
  };

  const getCleanCellText = (val) => {
    if (val == null) return '';
    if (typeof val === 'object') {
      if (val.name) return String(val.name);
      if (val.fullName) return String(val.fullName);
      if (val.title) return String(val.title);
      if (val.code) return String(val.code);
      if (val instanceof Date) return val.toLocaleDateString();
      if (Array.isArray(val)) return val.map((v) => (typeof v === 'object' ? v.name || v.title || '' : String(v))).join(', ');
      return val.employeeCode || val.email || '';
    }
    return String(val).trim();
  };

  const formatColumnHeader = (header) => {
    if (!header) return '';
    const s = String(header).trim();
    const lower = s.toLowerCase().replace(/[\s_-]/g, '');
    const map = {
      employeeid: '#',
      id: '#',
      _id: '#',
      employeecode: 'Employee Code',
      employeename: 'Employee Name',
      name: 'Name',
      code: 'Code',
      department: 'Department',
      designation: 'Designation',
      branch: 'Branch',
      company: 'Company',
      date: 'Date',
      checkin: 'Punch In',
      checkout: 'Punch Out',
      punchin: 'Punch In',
      punchout: 'Punch Out',
      workhours: 'Work Hours',
      workinghours: 'Work Hours',
      status: 'Status',
      islate: 'Late',
      lateminutes: 'Late (Mins)',
      leavetype: 'Leave Type',
      startdate: 'From Date',
      enddate: 'To Date',
      dayscount: 'Days',
      numberofdays: 'Days',
      duration: 'Duration',
      approvalstatus: 'Status',
      payperiod: 'Pay Period',
      employees: 'Employees',
      grossoutlay: 'Gross Pay',
      totalgross: 'Gross Pay',
      totaldeductions: 'Deductions',
      netdisbursed: 'Net Pay',
      totalnet: 'Net Pay',
      assettag: 'Asset Tag',
      assetname: 'Asset Name',
      reviewcycle: 'Cycle',
      selfrating: 'Self Score',
      managerrating: 'Manager Score',
    };
    if (map[lower]) return map[lower];

    if (s === s.toUpperCase() && !s.includes(' ')) {
      return s.charAt(0) + s.slice(1).toLowerCase();
    }
    return s
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/[_-]/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());
  };

  const extractTableData = (data) => {
    if (!data) return { columns: [], rows: [] };
    let rawCols = [];
    let rawRows = [];

    if (Array.isArray(data.columns) && Array.isArray(data.rows)) {
      rawCols = data.columns;
      rawRows = data.rows;
    } else if (Array.isArray(data) && data.length > 0) {
      rawCols = Object.keys(data[0]);
      rawRows = data.map((r) => Object.values(r));
    } else if (typeof data === 'object') {
      const arr = Object.values(data).find((v) => Array.isArray(v) && v.length > 0 && typeof v[0] === 'object');
      if (arr) {
        rawCols = Object.keys(arr[0]);
        rawRows = arr.map((r) => Object.values(r));
      }
    }
    if (!rawCols.length || !rawRows.length) {
      return { columns: [], rows: [] };
    }

    const isIdCol = /^(employeeid|_id|id)$/i.test(String(rawCols[0] || '').trim());
    const isFirstColHex =
      rawRows.length > 0 &&
      /^[0-9a-fA-F]{24}$/.test(String(Array.isArray(rawRows[0]) ? rawRows[0][0] : Object.values(rawRows[0])[0] || ''));

    let processedRows = rawRows;
    if (isIdCol && isFirstColHex) {
      processedRows = rawRows.map((row, idx) => {
        const copy = Array.isArray(row) ? [...row] : Object.values(row);
        copy[0] = idx + 1;
        return copy;
      });
    }

    const cleanCols = rawCols.map((c, i) => (i === 0 && isIdCol && isFirstColHex ? '#' : formatColumnHeader(c)));
    return { columns: cleanCols, rows: processedRows };
  };

  // -------------------------------------------------------------------------
  // 4. GET /reports/export-logs - Export Audit Logs
  // -------------------------------------------------------------------------
  const loadExportLogs = async () => {
    setLoadingLogs(true);
    try {
      const res = await reportsApi.getExportLogs();
      const raw = extractApiData(res, 'logs', 'exportLogs', 'data');
      setExportLogs(Array.isArray(raw) ? raw : []);
    } catch {
      setExportLogs([]);
    } finally {
      setLoadingLogs(false);
    }
  };

  // -------------------------------------------------------------------------
  // 5. POST & PUT /reports/catalog - Register / Edit Definition
  // -------------------------------------------------------------------------
  const openCreateModal = () => {
    setIsEditingDef(false);
    setDefinitionForm({
      id: '',
      reportKey: '',
      name: '',
      category: 'ATTENDANCE',
      description: '',
      supportsExcelExport: true,
      supportsPdfExport: true,
    });
    setDefinitionModalOpen(true);
  };

  const openEditModal = (report) => {
    setIsEditingDef(true);
    setDefinitionForm({
      id: report._id || report.id,
      reportKey: report.reportKey,
      name: report.name || report.title,
      category: report.category || 'ATTENDANCE',
      description: report.description || '',
      supportsExcelExport: report.supportsExcelExport ?? true,
      supportsPdfExport: report.supportsPdfExport ?? true,
    });
    setDefinitionModalOpen(true);
  };

  const handleSaveDefinition = async (e) => {
    e.preventDefault();
    setSubmittingDef(true);
    try {
      if (isEditingDef && definitionForm.id) {
        await reportsApi.updateReportDefinition(definitionForm.id, {
          name: definitionForm.name,
          description: definitionForm.description,
          isActive: true,
        });
        showToast('Report definition updated successfully!', 'success');
      } else {
        await reportsApi.createReportDefinition({
          reportKey: definitionForm.reportKey,
          name: definitionForm.name,
          category: definitionForm.category,
          description: definitionForm.description,
          supportsExcelExport: definitionForm.supportsExcelExport,
          supportsPdfExport: definitionForm.supportsPdfExport,
        });
        showToast('New report definition registered in catalog!', 'success');
      }
      setDefinitionModalOpen(false);
      loadCatalog();
    } catch (err) {
      showToast(err?.response?.data?.message || 'Failed to save report definition', 'error');
    } finally {
      setSubmittingDef(false);
    }
  };

  // Categories & Filtering
  const categories = ['ALL', 'ATTENDANCE', 'LEAVE', 'PAYROLL', 'ASSETS', 'LOANS', 'PERFORMANCE', 'LIFECYCLE'];

  const filteredCatalog = catalog.filter((r) => {
    const ms =
      !searchQuery ||
      (r.name || r.title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.reportKey || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.category || '').toLowerCase().includes(searchQuery.toLowerCase());
    const mc = catFilter === 'ALL' || (r.category || '').toUpperCase() === catFilter;
    return ms && mc;
  });

  const selectedCfg = getCatConfig(selectedReport?.category);

  // Render Cell Content with Badges
  const renderCellContent = (val, colHeader) => {
    const text = getCleanCellText(val);
    const isStatusCol = /status/i.test(colHeader);
    const upper = text.toUpperCase();

    if (
      isStatusCol ||
      ['PRESENT', 'ACTIVE', 'APPROVED', 'PAID', 'COMPLETED', 'ABSENT', 'REJECTED', 'FAILED', 'OVERDUE', 'HALF-DAY', 'HALF_DAY', 'PENDING', 'DRAFT', 'ON-LEAVE', 'ON_LEAVE', 'LEAVE', 'LATE'].includes(upper)
    ) {
      if (['PRESENT', 'ACTIVE', 'APPROVED', 'PAID', 'COMPLETED'].includes(upper)) {
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              padding: '2px 8px',
              borderRadius: 12,
              fontSize: '0.73rem',
              fontWeight: 600,
              backgroundColor: '#ecfdf5',
              color: '#059669',
              border: '1px solid #a7f3d0',
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#10b981' }} />
            {text}
          </span>
        );
      }
      if (['ABSENT', 'REJECTED', 'FAILED', 'OVERDUE'].includes(upper)) {
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              padding: '2px 8px',
              borderRadius: 12,
              fontSize: '0.73rem',
              fontWeight: 600,
              backgroundColor: '#fef2f2',
              color: '#dc2626',
              border: '1px solid #fecaca',
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#ef4444' }} />
            {text}
          </span>
        );
      }
      if (['HALF-DAY', 'HALF_DAY', 'PENDING', 'DRAFT'].includes(upper)) {
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              padding: '2px 8px',
              borderRadius: 12,
              fontSize: '0.73rem',
              fontWeight: 600,
              backgroundColor: '#fffbeb',
              color: '#b45309',
              border: '1px solid #fde68a',
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#f59e0b' }} />
            {text}
          </span>
        );
      }
      if (['ON-LEAVE', 'ON_LEAVE', 'LEAVE'].includes(upper)) {
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              padding: '2px 8px',
              borderRadius: 12,
              fontSize: '0.73rem',
              fontWeight: 600,
              backgroundColor: '#eff6ff',
              color: '#2563eb',
              border: '1px solid #bfdbfe',
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#3b82f6' }} />
            {text}
          </span>
        );
      }
      if (['LATE'].includes(upper)) {
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              padding: '2px 8px',
              borderRadius: 12,
              fontSize: '0.73rem',
              fontWeight: 600,
              backgroundColor: '#fff7ed',
              color: '#c2410c',
              border: '1px solid #fed7aa',
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#f97316' }} />
            {text}
          </span>
        );
      }
    }

    if (colHeader === '#' || colHeader === 'Sr No' || colHeader === 'Sr.') {
      return <span style={{ color: '#94a3b8', fontWeight: 600, fontSize: '0.75rem' }}>{text}</span>;
    }

    if (colHeader === 'Employee Code' || /^EMP-\d+/i.test(text)) {
      return (
        <span
          style={{
            fontFamily: 'monospace',
            fontWeight: 600,
            fontSize: '0.78rem',
            padding: '2px 6px',
            borderRadius: 4,
            backgroundColor: '#f1f5f9',
            color: '#334155',
          }}
        >
          {text}
        </span>
      );
    }

    if (colHeader === 'Employee Name') {
      return <span style={{ fontWeight: 600, color: '#0f172a' }}>{text}</span>;
    }

    return text || '—';
  };

  // Render Table Grid
  const renderTable = () => {
    if (!reportData) return null;
    const { columns, rows } = extractTableData(reportData);

    if (!columns.length || !rows.length) {
      return (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#64748b' }}>
          <AlertCircle size={36} style={{ opacity: 0.3, marginBottom: 10, color: '#94a3b8' }} />
          <div style={{ fontWeight: 600, fontSize: '0.92rem', color: '#334155' }}>
            No records found for this selection
          </div>
          <div style={{ fontSize: '0.8rem', marginTop: 4, color: '#94a3b8' }}>
            Try expanding your date range or selecting "All Branches" / "All Departments".
          </div>
        </div>
      );
    }

    return (
      <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: 8, backgroundColor: '#ffffff' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
          <thead>
            <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
              {columns.map((c, i) => (
                <th
                  key={i}
                  style={{
                    padding: '10px 14px',
                    textAlign: 'left',
                    fontWeight: 600,
                    color: '#475569',
                    fontSize: '0.75rem',
                    letterSpacing: '0.01em',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr
                key={ri}
                style={{
                  borderBottom: '1px solid #f1f5f9',
                  backgroundColor: ri % 2 === 0 ? '#ffffff' : '#fafbfc',
                  transition: 'background-color 0.12s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#f1f5f9';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = ri % 2 === 0 ? '#ffffff' : '#fafbfc';
                }}
              >
                {(Array.isArray(row) ? row : Object.values(row)).map((val, ci) => (
                  <td key={ci} style={{ padding: '9px 14px', verticalAlign: 'middle', whiteSpace: 'nowrap', color: '#1e293b' }}>
                    {renderCellContent(val, columns[ci])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* 1. Sleek Header Banner */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
          backgroundColor: '#ffffff',
          padding: '16px 20px',
          borderRadius: 12,
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              backgroundColor: 'rgba(46, 123, 133, 0.1)',
              color: 'var(--primary, #2e7b85)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <BarChart3 size={22} />
          </div>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: '#0f172a' }}>
              HR Reports &amp; Analytics
            </h2>
            <div style={{ fontSize: '0.82rem', color: '#64748b', marginTop: 2 }}>
              Generate, filter, and export comprehensive organizational reports across attendance, leaves, payroll, and staff.
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {canManageCatalog && (
            <Button variant="primary" icon={Plus} size="sm" onClick={openCreateModal} style={{ height: 34, fontSize: '0.8rem' }}>
              Add Report
            </Button>
          )}
        </div>
      </div>

      {/* 2. Compact Modern KPI Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
          gap: 12,
        }}
      >
        <div
          style={{
            padding: '12px 16px',
            backgroundColor: '#ffffff',
            borderRadius: 10,
            border: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              backgroundColor: 'rgba(99, 102, 241, 0.09)',
              color: '#4f46e5',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Layers size={18} />
          </div>
          <div>
            <div style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 500 }}>Catalog Reports</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#0f172a' }}>{catalog.length} Available</div>
          </div>
        </div>

        <div
          style={{
            padding: '12px 16px',
            backgroundColor: '#ffffff',
            borderRadius: 10,
            border: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              backgroundColor: 'rgba(16, 185, 129, 0.09)',
              color: '#059669',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <TrendingUp size={18} />
          </div>
          <div>
            <div style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 500 }}>Categories</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#059669' }}>8 Modules</div>
          </div>
        </div>

        <div
          style={{
            padding: '12px 16px',
            backgroundColor: '#ffffff',
            borderRadius: 10,
            border: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              backgroundColor: 'rgba(245, 158, 11, 0.09)',
              color: '#d97706',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Download size={18} />
          </div>
          <div>
            <div style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 500 }}>Export Formats</div>
            <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#d97706' }}>Excel, CSV, PDF</div>
          </div>
        </div>

        <div
          style={{
            padding: '12px 16px',
            backgroundColor: '#ffffff',
            borderRadius: 10,
            border: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              backgroundColor: 'rgba(139, 92, 246, 0.09)',
              color: '#7c3aed',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <History size={18} />
          </div>
          <div>
            <div style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 500 }}>Audit Logs</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#7c3aed' }}>{exportLogs.length} Logged</div>
          </div>
        </div>
      </div>

      {/* 3. Sleek Navigation Tabs */}
      <div
        style={{
          display: 'flex',
          gap: 6,
          borderBottom: '1px solid #e2e8f0',
          overflowX: 'auto',
          paddingBottom: 0,
        }}
      >
        <button
          type="button"
          onClick={() => setActiveTab('catalog')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 16px',
            border: 'none',
            background: 'none',
            borderBottom: activeTab === 'catalog' ? '2.5px solid var(--primary, #2e7b85)' : '2.5px solid transparent',
            color: activeTab === 'catalog' ? 'var(--primary, #2e7b85)' : '#64748b',
            fontWeight: activeTab === 'catalog' ? 700 : 500,
            cursor: 'pointer',
            fontSize: '0.85rem',
            whiteSpace: 'nowrap',
          }}
        >
          <BarChart3 size={16} />
          <span>Report Catalog &amp; Data View ({catalog.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('export_logs')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 16px',
            border: 'none',
            background: 'none',
            borderBottom: activeTab === 'export_logs' ? '2.5px solid var(--primary, #2e7b85)' : '2.5px solid transparent',
            color: activeTab === 'export_logs' ? 'var(--primary, #2e7b85)' : '#64748b',
            fontWeight: activeTab === 'export_logs' ? 700 : 500,
            cursor: 'pointer',
            fontSize: '0.85rem',
            whiteSpace: 'nowrap',
          }}
        >
          <History size={16} />
          <span>Export Audit History ({exportLogs.length})</span>
        </button>
      </div>

      {/* 4. TAB 1: REPORT CATALOG & AGGREGATOR */}
      {activeTab === 'catalog' && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(280px, 310px) 1fr',
            gap: 16,
            minHeight: 580,
          }}
        >
          {/* Left Panel: Catalog List & Search */}
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: 12,
              border: '1px solid #e2e8f0',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.03)',
            }}
          >
            {/* Search Input */}
            <div style={{ padding: '10px 12px', borderBottom: '1px solid #f1f5f9' }}>
              <div style={{ position: 'relative' }}>
                <Search size={14} style={{ position: 'absolute', left: 10, top: 10, color: '#94a3b8' }} />
                <input
                  type="text"
                  placeholder="Search reports..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '7px 10px 7px 30px',
                    borderRadius: 6,
                    border: '1px solid #e2e8f0',
                    fontSize: '0.8rem',
                    backgroundColor: '#ffffff',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>

            {/* Category Chips */}
            <div
              style={{
                display: 'flex',
                gap: 4,
                flexWrap: 'wrap',
                padding: '8px 12px',
                borderBottom: '1px solid #f1f5f9',
                backgroundColor: '#f8fafc',
              }}
            >
              {categories.map((cat) => {
                const cfg = getCatConfig(cat === 'ALL' ? 'DEFAULT' : cat);
                const isSelected = catFilter === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCatFilter(cat)}
                    style={{
                      padding: '3px 8px',
                      borderRadius: 14,
                      fontSize: '0.68rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      border: isSelected ? '1px solid var(--primary, #2e7b85)' : '1px solid #e2e8f0',
                      backgroundColor: isSelected ? 'var(--primary, #2e7b85)' : '#ffffff',
                      color: isSelected ? '#ffffff' : '#64748b',
                      transition: 'all 0.12s ease',
                    }}
                  >
                    {cat === 'ALL' ? 'All' : cfg.label}
                  </button>
                );
              })}
            </div>

            {/* Report Item List */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '6px', display: 'flex', flexDirection: 'column', gap: 3 }}>
              {loadingCatalog ? (
                <div style={{ textAlign: 'center', padding: 30, color: '#94a3b8' }}>
                  <Loader2 size={20} className="spin" />
                  <div style={{ fontSize: '0.78rem', marginTop: 8 }}>Loading catalog...</div>
                </div>
              ) : filteredCatalog.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 30, color: '#94a3b8', fontSize: '0.8rem' }}>
                  No reports matching filter
                </div>
              ) : (
                filteredCatalog.map((rep, idx) => {
                  const rKey = rep.reportKey || rep.key || `rep-${idx}`;
                  const isSel = selectedReport?.reportKey === rKey;
                  const cfg = getCatConfig(rep.category);
                  const Icon = cfg.icon;

                  return (
                    <div
                      key={rKey}
                      onClick={() => handleSelectReport(rep)}
                      style={{
                        padding: '9px 12px',
                        borderRadius: 8,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        borderLeft: isSel ? '3px solid var(--primary, #2e7b85)' : '3px solid transparent',
                        backgroundColor: isSel ? 'rgba(46, 123, 133, 0.08)' : 'transparent',
                        transition: 'all 0.12s ease',
                      }}
                      onMouseEnter={(e) => {
                        if (!isSel) e.currentTarget.style.backgroundColor = '#f8fafc';
                      }}
                      onMouseLeave={(e) => {
                        if (!isSel) e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                    >
                      <div
                        style={{
                          width: 26,
                          height: 26,
                          borderRadius: 6,
                          backgroundColor: cfg.bg,
                          color: cfg.color,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        <Icon size={13} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: '0.8rem',
                            fontWeight: isSel ? 600 : 500,
                            color: isSel ? 'var(--primary, #2e7b85)' : '#1e293b',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {rep.name || rep.title}
                        </div>
                        <div style={{ fontSize: '0.68rem', color: cfg.color, fontWeight: 500, marginTop: 1 }}>
                          {cfg.label}
                        </div>
                      </div>
                      {isSel && (
                        <ChevronRight size={13} color="var(--primary, #2e7b85)" style={{ flexShrink: 0 }} />
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Panel: Live Aggregation & Data Grid */}
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: 12,
              border: '1px solid #e2e8f0',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.03)',
            }}
          >
            {selectedReport ? (
              <>
                {/* Report Header & Export Actions */}
                <div
                  style={{
                    padding: '14px 18px',
                    borderBottom: '1px solid #e2e8f0',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    flexWrap: 'wrap',
                    gap: 12,
                    backgroundColor: '#ffffff',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          padding: '2px 8px',
                          borderRadius: 12,
                          fontSize: '0.72rem',
                          fontWeight: 600,
                          backgroundColor: selectedCfg.bg,
                          color: selectedCfg.color,
                        }}
                      >
                        {selectedCfg.label}
                      </span>
                    </div>
                    <h3 style={{ margin: '0 0 3px', fontSize: '1.15rem', fontWeight: 700, color: '#0f172a' }}>
                      {selectedReport.name || selectedReport.title}
                    </h3>
                    <div style={{ fontSize: '0.78rem', color: '#64748b', maxWidth: 620 }}>
                      {selectedReport.description}
                    </div>
                  </div>

                  {/* Multi-Format Export Buttons */}
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                    {canManageCatalog && selectedReport._id && (
                      <Button
                        size="sm"
                        variant="secondary"
                        icon={Edit2}
                        onClick={() => openEditModal(selectedReport)}
                        style={{ height: 32, fontSize: '0.76rem', padding: '0 10px' }}
                      >
                        Edit Def
                      </Button>
                    )}

                    <button
                      type="button"
                      onClick={() => handleExport('excel')}
                      disabled={!!exportingFormat || loadingData}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        height: 32,
                        padding: '0 12px',
                        borderRadius: 6,
                        fontSize: '0.76rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        border: '1px solid #bbf7d0',
                        backgroundColor: '#f0fdf4',
                        color: '#15803d',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {exportingFormat === 'excel' ? (
                        <Loader2 size={12} className="spin" />
                      ) : (
                        <FileSpreadsheet size={13} color="#16a34a" />
                      )}
                      Excel
                    </button>

                    <button
                      type="button"
                      onClick={() => handleExport('csv')}
                      disabled={!!exportingFormat || loadingData}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        height: 32,
                        padding: '0 12px',
                        borderRadius: 6,
                        fontSize: '0.76rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        border: '1px solid #bae6fd',
                        backgroundColor: '#f0f9ff',
                        color: '#0369a1',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {exportingFormat === 'csv' ? (
                        <Loader2 size={12} className="spin" />
                      ) : (
                        <Download size={13} color="#0284c7" />
                      )}
                      CSV
                    </button>

                    <button
                      type="button"
                      onClick={() => handleExport('pdf')}
                      disabled={!!exportingFormat || loadingData}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        height: 32,
                        padding: '0 12px',
                        borderRadius: 6,
                        fontSize: '0.76rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        border: '1px solid #fecaca',
                        backgroundColor: '#fef2f2',
                        color: '#b91c1c',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {exportingFormat === 'pdf' ? (
                        <Loader2 size={12} className="spin" />
                      ) : (
                        <FileText size={13} color="#dc2626" />
                      )}
                      PDF
                    </button>
                  </div>
                </div>

                {/* Unified Filter Toolbar */}
                <div
                  style={{
                    padding: '12px 18px',
                    borderBottom: '1px solid #e2e8f0',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10,
                    backgroundColor: '#fafbfc',
                  }}
                >
                  {/* Row 1: Quick Range Pills & Date Pickers */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        Range:
                      </span>
                      {[
                        { id: 'today', label: 'Today' },
                        { id: 'month', label: 'This Month' },
                        { id: '30days', label: 'Last 30 Days' },
                        { id: 'year', label: 'Year to Date' },
                        { id: 'all', label: 'All' },
                      ].map((p) => {
                        const isAct = activePreset === p.id;
                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => applyDatePreset(p.id)}
                            style={{
                              padding: '4px 10px',
                              borderRadius: 6,
                              fontSize: '0.74rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                              border: isAct ? '1px solid var(--primary, #2e7b85)' : '1px solid #e2e8f0',
                              backgroundColor: isAct ? 'var(--primary, #2e7b85)' : '#ffffff',
                              color: isAct ? '#ffffff' : '#475569',
                              transition: 'all 0.15s ease',
                            }}
                          >
                            {p.label}
                          </button>
                        );
                      })}
                    </div>

                    {/* Date Pickers */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 500 }}>From</span>
                        <input
                          type="date"
                          value={filters.startDate}
                          onChange={(e) => {
                            setActivePreset('custom');
                            setFilters((f) => ({ ...f, startDate: e.target.value }));
                          }}
                          style={{
                            height: 32,
                            padding: '2px 8px',
                            borderRadius: 6,
                            border: '1px solid #cbd5e1',
                            fontSize: '0.78rem',
                            backgroundColor: '#ffffff',
                            color: '#1e293b',
                          }}
                        />
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 500 }}>To</span>
                        <input
                          type="date"
                          value={filters.endDate}
                          onChange={(e) => {
                            setActivePreset('custom');
                            setFilters((f) => ({ ...f, endDate: e.target.value }));
                          }}
                          style={{
                            height: 32,
                            padding: '2px 8px',
                            borderRadius: 6,
                            border: '1px solid #cbd5e1',
                            fontSize: '0.78rem',
                            backgroundColor: '#ffffff',
                            color: '#1e293b',
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Row 2: Branch, Department & Run Query Button */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    {branches.length > 0 && (
                      <div style={{ width: 175, minWidth: 140 }}>
                        <Select
                          placeholder="All Branches"
                          value={filters.branch}
                          onChange={(e) => setFilters((f) => ({ ...f, branch: e.target.value }))}
                          options={[
                            { value: 'ALL', label: 'All Branches' },
                            ...branches.map((b) => ({
                              value: b._id || b.name,
                              label: b.name,
                            })),
                          ]}
                          style={{ height: 34, fontSize: '0.8rem', marginBottom: 0 }}
                        />
                      </div>
                    )}

                    {departments.length > 0 && (
                      <div style={{ width: 175, minWidth: 140 }}>
                        <Select
                          placeholder="All Departments"
                          value={filters.department}
                          onChange={(e) => setFilters((f) => ({ ...f, department: e.target.value }))}
                          options={[
                            { value: 'ALL', label: 'All Departments' },
                            ...departments.map((d) => ({
                              value: d._id || d.name,
                              label: d.name,
                            })),
                          ]}
                          style={{ height: 34, fontSize: '0.8rem', marginBottom: 0 }}
                        />
                      </div>
                    )}

                    <Button
                      size="sm"
                      variant="primary"
                      icon={Search}
                      loading={loadingData}
                      onClick={() => handleSelectReport(selectedReport, filters)}
                      style={{ height: 34, padding: '0 14px', fontSize: '0.8rem', fontWeight: 600 }}
                    >
                      Run Query
                    </Button>

                    {/* Record count badge */}
                    <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
                      {reportData && (
                        <span
                          style={{
                            fontSize: '0.76rem',
                            fontWeight: 600,
                            color: '#475569',
                            backgroundColor: '#f1f5f9',
                            padding: '4px 10px',
                            borderRadius: 6,
                            border: '1px solid #e2e8f0',
                          }}
                        >
                          {extractTableData(reportData).rows.length} records found
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Data Grid Table View */}
                <div style={{ flex: 1, padding: 16, overflowY: 'auto' }}>
                  {loadingData ? (
                    <div style={{ textAlign: 'center', padding: '60px 20px', color: '#64748b' }}>
                      <Loader2 size={30} className="spin" style={{ marginBottom: 10, color: 'var(--primary, #2e7b85)' }} />
                      <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#1e293b' }}>Loading report records...</div>
                      <div style={{ fontSize: '0.78rem', marginTop: 4, color: '#94a3b8' }}>
                        Aggregating live data for the selected filters
                      </div>
                    </div>
                  ) : (
                    renderTable()
                  )}
                </div>
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: 80, color: '#94a3b8' }}>
                <BarChart3 size={44} style={{ opacity: 0.25, marginBottom: 10 }} />
                <div style={{ fontWeight: 600, color: '#475569' }}>Select a report definition from the catalog</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 5. TAB 2: EXPORT AUDIT LOGS */}
      {activeTab === 'export_logs' && (
        <div className="card" style={{ padding: 0 }}>
          <div
            style={{
              padding: '14px 20px',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: 'var(--bg-subtle, #f8fafc)',
            }}
          >
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>Append-Only Export Audit Logs</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Complete governance audit trail tracking every Excel, CSV, and PDF report download with caller identity.
              </div>
            </div>
          </div>

          <div style={{ padding: 16 }}>
            {loadingLogs ? (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                <Loader2 size={24} className="spin" />
                <div style={{ fontSize: '0.82rem', marginTop: 8 }}>Loading export audit entries...</div>
              </div>
            ) : exportLogs.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>
                <History size={40} style={{ opacity: 0.2, marginBottom: 10 }} />
                <div style={{ fontWeight: 600 }}>No export logs recorded yet</div>
                <div style={{ fontSize: '0.8rem', marginTop: 4 }}>
                  Entries will automatically log here when reports are exported to Excel, CSV, or PDF.
                </div>
              </div>
            ) : (
              <div style={{ overflowX: 'auto', border: '1px solid var(--border-color)', borderRadius: 8 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                  <thead>
                    <tr style={{ backgroundColor: 'var(--bg-subtle, #f8fafc)', borderBottom: '2px solid var(--border-color)' }}>
                      <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: 'var(--text-muted)' }}>Report Key</th>
                      <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: 'var(--text-muted)' }}>Format</th>
                      <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: 'var(--text-muted)' }}>Exported By</th>
                      <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: 'var(--text-muted)' }}>Date Range Filter</th>
                      <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: 'var(--text-muted)' }}>Timestamp</th>
                      <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: 'var(--text-muted)' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {exportLogs.map((log, i) => (
                      <tr key={log._id || i} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '10px 14px', fontWeight: 600 }}>
                          <code>{log.reportKey || log.title || 'Report'}</code>
                        </td>
                        <td style={{ padding: '10px 14px' }}>
                          <Badge variant={log.format === 'PDF' ? 'danger' : log.format === 'CSV' ? 'primary' : 'success'}>
                            {log.format || 'XLSX'}
                          </Badge>
                        </td>
                        <td style={{ padding: '10px 14px' }}>
                          {log.user?.name || log.user?.email || log.exportedBy || 'Admin User'}
                        </td>
                        <td style={{ padding: '10px 14px', color: 'var(--text-muted)' }}>
                          {log.from && log.to ? `${log.from} → ${log.to}` : 'Default Scope'}
                        </td>
                        <td style={{ padding: '10px 14px', color: 'var(--text-muted)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Clock size={12} />
                            {new Date(log.createdAt || Date.now()).toLocaleString()}
                          </div>
                        </td>
                        <td style={{ padding: '10px 14px' }}>
                          <Badge variant="success">
                            <CheckCircle2 size={11} style={{ marginRight: 4 }} />
                            Completed
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 6. REGISTER / EDIT REPORT DEFINITION MODAL (POST & PUT /reports/catalog) */}
      <Modal
        isOpen={definitionModalOpen}
        onClose={() => setDefinitionModalOpen(false)}
        title={isEditingDef ? 'Edit Report Definition' : 'Register New Report Definition in Catalog'}
      >
        <form onSubmit={handleSaveDefinition} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {!isEditingDef && (
            <Input
              label="Report Key (Unique slug)"
              placeholder="e.g. compliance-pf-esic-register"
              value={definitionForm.reportKey}
              onChange={(e) => setDefinitionForm({ ...definitionForm, reportKey: e.target.value })}
              required
            />
          )}

          <Input
            label="Report Title / Name"
            placeholder="e.g. Statutory PF & ESIC Compliance Register"
            value={definitionForm.name}
            onChange={(e) => setDefinitionForm({ ...definitionForm, name: e.target.value })}
            required
          />

          {!isEditingDef && (
            <Select
              label="Primary Category"
              value={definitionForm.category}
              onChange={(e) => setDefinitionForm({ ...definitionForm, category: e.target.value })}
              options={[
                { value: 'ATTENDANCE', label: 'Attendance & Time Tracking' },
                { value: 'LEAVE', label: 'Leaves & Holidays' },
                { value: 'PAYROLL', label: 'Payroll & Disbursal' },
                { value: 'ASSETS', label: 'Assets & Custody' },
                { value: 'REIMBURSEMENTS', label: 'Reimbursements & Claims' },
                { value: 'LOANS', label: 'Loans & Advances' },
                { value: 'PERFORMANCE', label: 'Performance & Appraisals' },
                { value: 'LIFECYCLE', label: 'Employee Lifecycle Transitions' },
              ]}
              required
            />
          )}

          <Input
            label="Report Description"
            placeholder="Provide a clear summary of the data aggregated by this report"
            value={definitionForm.description}
            onChange={(e) => setDefinitionForm({ ...definitionForm, description: e.target.value })}
            required
          />

          <div className="modal-footer" style={{ margin: '14px -20px -20px' }}>
            <Button variant="secondary" onClick={() => setDefinitionModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" loading={submittingDef}>
              {isEditingDef ? 'Update Definition' : 'Register Definition'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default ReportsAnalytics;
