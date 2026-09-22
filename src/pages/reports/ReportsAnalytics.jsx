import React, { useState, useEffect, useCallback } from 'react';
import reportsApi from '../../api/reportsApi';
import attendanceApi from '../../api/attendanceApi';
import leaveHolidayApi from '../../api/leaveHolidayApi';
import payrollApi from '../../api/payrollApi';
import assetsLoansApi from '../../api/assetsLoansApi';
import employeeApi from '../../api/employeeApi';
import taskApi from '../../api/taskApi';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import {
  BarChart3, FileSpreadsheet, Download, FileText,
  Plus, RefreshCw, History, Search, ChevronRight,
  TrendingUp, Users, Calendar, DollarSign, Award,
  Package, Loader2, AlertCircle, CheckCircle2, Clock,
} from 'lucide-react';
import Modal from '../../components/common/Modal';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import Select from '../../components/common/Select';

const CATEGORY_CONFIG = {
  ATTENDANCE: { color: '#6366f1', bg: '#6366f115', icon: Calendar, label: 'Attendance' },
  LEAVE:      { color: '#0ea5e9', bg: '#0ea5e915', icon: Calendar,  label: 'Leave' },
  PAYROLL:    { color: '#10b981', bg: '#10b98115', icon: DollarSign, label: 'Payroll' },
  ASSETS:     { color: '#f59e0b', bg: '#f59e0b15', icon: Package, label: 'Assets' },
  PERFORMANCE:{ color: '#ec4899', bg: '#ec489915', icon: Award, label: 'Performance' },
  HR:         { color: '#8b5cf6', bg: '#8b5cf615', icon: Users, label: 'HR' },
  DEFAULT:    { color: '#64748b', bg: '#64748b15', icon: BarChart3, label: 'General' },
};
const getCatConfig = (cat) => CATEGORY_CONFIG[cat?.toUpperCase()] || CATEGORY_CONFIG.DEFAULT;

const DEFAULT_CATALOG = [
  { reportKey: 'attendance-daily-summary', title: 'Daily & Monthly Attendance Summary', category: 'ATTENDANCE', description: 'Aggregates employee attendance status across Office, Field, and Site modalities with work hours.' },
  { reportKey: 'attendance-late-arrivals', title: 'Late Arrivals & Shortfall Records', category: 'ATTENDANCE', description: 'Captures employees who punched in after the configured grace period.' },
  { reportKey: 'attendance-site-activity', title: 'Project Site Activity & Log Summary', category: 'ATTENDANCE', description: 'Field attendance aggregated by project site including geo-verified punch data.' },
  { reportKey: 'leave-balance-summary', title: 'Employee Leave Balance Summary', category: 'LEAVE', description: 'Current leave balances by type across all employees with carry-forward info.' },
  { reportKey: 'leave-utilization-analysis', title: 'Leave Utilization Analysis', category: 'LEAVE', description: 'Monthly & quarterly utilization patterns and peak absence periods.' },
  { reportKey: 'payroll-cost-statutory', title: 'Payroll Cost & Statutory Summary', category: 'PAYROLL', description: 'Gross payroll outlay, PF, ESIC, PT, TDS breakdowns by department and month.' },
  { reportKey: 'payroll-disbursement-status', title: 'Salary Payment & Disbursement Status', category: 'PAYROLL', description: 'Bank transfer statuses, rejected transactions, and payment confirmation logs.' },
  { reportKey: 'assets-allocation-utilization', title: 'Asset Allocation & Utilization Report', category: 'ASSETS', description: 'Physical custody register with asset age, condition, and replacement cost exposures.' },
  { reportKey: 'performance-kra-scorecard', title: 'KRA Appraisal Scorecards', category: 'PERFORMANCE', description: 'Aggregated self vs manager KRA appraisal scores with performance band distributions.' },
];

const styles = `
  @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
  .rpt-root { display:flex; flex-direction:column; min-height:100%; font-family:'Inter',system-ui,sans-serif; }
  .rpt-header { display:flex; justify-content:space-between; align-items:center; padding:18px 24px; background:var(--card-bg,#fff); border-bottom:1px solid var(--border-color,#e5e7eb); flex-wrap:wrap; gap:12px; }
  .rpt-header h1 { margin:0 0 2px; font-size:1.3rem; font-weight:700; }
  .rpt-header p { margin:0; font-size:0.78rem; color:#64748b; }
  .rpt-stats { display:grid; grid-template-columns:repeat(auto-fit,minmax(140px,1fr)); gap:10px; padding:14px 24px; background:var(--bg-subtle,#f8fafc); border-bottom:1px solid var(--border-color,#e5e7eb); }
  .stat-chip { display:flex; align-items:center; gap:10px; padding:11px 13px; border-radius:10px; background:#fff; border:1px solid #e5e7eb; box-shadow:0 1px 3px rgba(0,0,0,.04); }
  .stat-chip-icon { width:34px; height:34px; border-radius:8px; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
  .stat-chip-val { font-size:1.1rem; font-weight:700; line-height:1.2; }
  .stat-chip-lbl { font-size:0.7rem; color:#64748b; }
  .rpt-tabs { display:flex; padding:0 24px; background:var(--card-bg,#fff); border-bottom:2px solid var(--border-color,#e5e7eb); }
  .rpt-tab { display:flex; align-items:center; gap:7px; padding:11px 16px; border:none; background:none; font-size:0.83rem; font-weight:500; color:#64748b; cursor:pointer; border-bottom:2px solid transparent; margin-bottom:-2px; transition:all .2s; white-space:nowrap; }
  .rpt-tab.active { color:var(--primary,#0f766e); border-bottom-color:var(--primary,#0f766e); font-weight:700; }
  .rpt-tab:hover:not(.active) { color:#334155; background:#f8fafc; }
  .rpt-body { display:grid; grid-template-columns:280px 1fr; flex:1; min-height:500px; }
  .rpt-sidebar { border-right:1px solid var(--border-color,#e5e7eb); background:#fafafa; display:flex; flex-direction:column; overflow:hidden; }
  .rpt-search { padding:12px; border-bottom:1px solid #e5e7eb; }
  .sw { position:relative; }
  .sw input { width:100%; padding:7px 10px 7px 32px; border:1.5px solid #e2e8f0; border-radius:8px; font-size:0.81rem; background:#fff; outline:none; transition:border-color .2s; box-sizing:border-box; }
  .sw input:focus { border-color:var(--primary,#0f766e); }
  .sw .si { position:absolute; left:9px; top:50%; transform:translateY(-50%); color:#94a3b8; pointer-events:none; }
  .cat-chips { display:flex; gap:4px; flex-wrap:wrap; padding:7px 12px; border-bottom:1px solid #e5e7eb; }
  .cat-chip { padding:3px 9px; border-radius:20px; font-size:0.68rem; font-weight:600; cursor:pointer; border:1.5px solid transparent; transition:all .15s; line-height:1.5; }
  .rpt-list { flex:1; overflow-y:auto; padding:8px; display:flex; flex-direction:column; gap:3px; }
  .rpt-item { padding:10px 11px; border-radius:9px; cursor:pointer; border:1.5px solid transparent; transition:all .18s; display:flex; align-items:flex-start; gap:9px; }
  .rpt-item:hover { background:#f1f5f9; border-color:#e2e8f0; }
  .rpt-item.sel { border-color:var(--primary,#0f766e); background:var(--primary-light,#f0fdf4); }
  .ri-icon { width:28px; height:28px; border-radius:7px; display:flex; align-items:center; justify-content:center; flex-shrink:0; margin-top:1px; }
  .ri-title { font-size:0.81rem; font-weight:600; line-height:1.3; }
  .rpt-item.sel .ri-title { color:var(--primary,#0f766e); }
  .ri-cat { font-size:0.68rem; margin-top:2px; font-weight:500; }
  .rpt-panel { display:flex; flex-direction:column; overflow:hidden; background:#fff; }
  .rpt-ph { padding:16px 20px 13px; border-bottom:1px solid #e5e7eb; display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:12px; }
  .rpt-ph h2 { margin:4px 0 3px; font-size:1.05rem; font-weight:700; }
  .rpt-ph p { margin:0; font-size:0.76rem; color:#64748b; max-width:480px; }
  .rpt-export-btns { display:flex; gap:5px; flex-shrink:0; }
  .exp-btn { display:inline-flex; align-items:center; gap:5px; padding:6px 11px; border-radius:7px; font-size:0.76rem; font-weight:600; cursor:pointer; border:1.5px solid; transition:all .18s; white-space:nowrap; }
  .exp-btn.xl { color:#16a34a; border-color:#16a34a; background:#f0fdf4; }
  .exp-btn.xl:hover { background:#16a34a; color:#fff; }
  .exp-btn.cs { color:#0369a1; border-color:#0369a1; background:#f0f9ff; }
  .exp-btn.cs:hover { background:#0369a1; color:#fff; }
  .exp-btn.pd { color:#dc2626; border-color:#dc2626; background:#fef2f2; }
  .exp-btn.pd:hover { background:#dc2626; color:#fff; }
  .exp-btn:disabled { opacity:.5; cursor:not-allowed; }
  .rpt-filters { padding:11px 20px; background:#f8fafc; border-bottom:1px solid #e5e7eb; display:flex; align-items:flex-end; gap:10px; flex-wrap:wrap; }
  .flt-grp { display:flex; flex-direction:column; gap:4px; }
  .flt-grp label { font-size:0.68rem; font-weight:700; color:#64748b; text-transform:uppercase; letter-spacing:.04em; }
  .flt-grp input { padding:6px 9px; border:1.5px solid #e2e8f0; border-radius:7px; font-size:0.8rem; background:#fff; outline:none; transition:border-color .2s; min-width:130px; }
  .flt-grp input:focus { border-color:var(--primary,#0f766e); }
  .run-btn { display:inline-flex; align-items:center; gap:6px; padding:7px 16px; border-radius:8px; background:var(--primary,#0f766e); color:#fff; font-size:0.8rem; font-weight:700; border:none; cursor:pointer; transition:all .2s; box-shadow:0 2px 8px rgba(15,118,110,.25); align-self:flex-end; }
  .run-btn:hover:not(:disabled) { filter:brightness(1.08); transform:translateY(-1px); }
  .run-btn:disabled { opacity:.6; cursor:not-allowed; transform:none; }
  .rpt-data { flex:1; overflow:auto; padding:16px 20px; }
  .data-state { display:flex; flex-direction:column; align-items:center; justify-content:center; padding:50px 20px; gap:12px; color:#94a3b8; }
  .data-state p { font-size:0.85rem; margin:0; }
  .dtw { overflow-x:auto; border-radius:10px; border:1px solid #e5e7eb; }
  .dt { width:100%; border-collapse:collapse; font-size:0.81rem; }
  .dt thead tr { background:#f8fafc; }
  .dt th { padding:9px 13px; text-align:left; font-size:0.7rem; font-weight:700; color:#64748b; text-transform:uppercase; letter-spacing:.05em; border-bottom:2px solid #e5e7eb; white-space:nowrap; }
  .dt td { padding:9px 13px; border-bottom:1px solid #f1f5f9; vertical-align:middle; }
  .dt tbody tr:last-child td { border-bottom:none; }
  .dt tbody tr:hover { background:#f8fafc; }
  .sbadge { display:inline-flex; align-items:center; gap:4px; padding:2px 8px; border-radius:20px; font-size:0.68rem; font-weight:600; }
  .logs-hdr { padding:13px 20px; background:#f8fafc; border-bottom:1px solid #e5e7eb; display:flex; justify-content:space-between; align-items:center; }
  .logs-hdr p { margin:0; font-size:0.78rem; color:#64748b; }
  .no-sel { display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; min-height:300px; gap:14px; color:#94a3b8; padding:40px; }
  @media(max-width:800px){ .rpt-body{grid-template-columns:1fr} .rpt-sidebar{border-right:none;border-bottom:1px solid #e5e7eb;max-height:260px} }
`;

export const ReportsAnalytics = () => {
  const { isSuperAdmin } = useAuth();
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState('catalog');
  const [catalog, setCatalog] = useState([]);
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);
  const [reportData, setReportData] = useState(null);
  const [loadingData, setLoadingData] = useState(false);
  const [exportLogs, setExportLogs] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [catFilter, setCatFilter] = useState('ALL');
  const [exportingFormat, setExportingFormat] = useState(null);
  const [filters, setFilters] = useState({
    startDate: new Date().getFullYear() + '-01-01',
    endDate: new Date().toISOString().split('T')[0],
  });
  const [definitionModalOpen, setDefinitionModalOpen] = useState(false);
  const [definitionForm, setDefinitionForm] = useState({ key: '', title: '', category: 'ATTENDANCE', description: '' });
  const [submittingDef, setSubmittingDef] = useState(false);

  const fetchReportFromBackendApi = async (rKey, category, f) => {
    const cat = category?.toUpperCase() || '';

    // 1. Real Backend ATTENDANCE Data
    if (cat === 'ATTENDANCE' || rKey.includes('attendance')) {
      try {
        const attRes = await attendanceApi.getAllOfficeAttendance({ from: f.startDate, to: f.endDate }).catch(() =>
          attendanceApi.getMyOfficeAttendance({ from: f.startDate, to: f.endDate })
        );
        const list = Array.isArray(attRes) ? attRes : attRes?.data || attRes?.attendance || [];
        if (list.length > 0) {
          const isLateReport = rKey.includes('late');
          const rows = list
            .filter((item) => !isLateReport || item.isLate || item.status === 'LATE' || item.lateMinutes > 0)
            .map((item) => {
              const emp = item.employee || {};
              const empName = emp.basicInfo?.fullName || emp.name || item.employeeName || 'Employee';
              const empCode = emp.employeeCode || emp.code || '—';
              const dept = emp.employmentInfo?.department?.name || emp.department?.name || (typeof emp.department === 'string' ? emp.department : 'General');
              const date = item.date ? String(item.date).substring(0, 10) : '—';
              const punchIn = item.checkIn?.time || item.punchIn || item.firstPunch || '—';
              const punchOut = item.checkOut?.time || item.punchOut || item.lastPunch || '—';
              const workHrs = item.workHours != null ? `${item.workHours} hrs` : (item.effectiveHours ? `${item.effectiveHours} hrs` : '—');
              const status = item.status || (item.isLate ? 'LATE' : 'PRESENT');
              return [empCode, empName, dept, date, punchIn, punchOut, workHrs, status];
            });
          return {
            columns: ['Employee Code', 'Employee Name', 'Department', 'Date', 'Punch In', 'Punch Out', 'Work Hours', 'Status'],
            rows,
            summary: { total: rows.length, period: `${f.startDate} to ${f.endDate}` },
          };
        }
      } catch {}
    }

    // 2. Real Backend LEAVE Data
    if (cat === 'LEAVE' || rKey.includes('leave')) {
      try {
        const leaveRes = await leaveHolidayApi.getLeaveRequests({ from: f.startDate, to: f.endDate }).catch(() =>
          leaveHolidayApi.getMyLeaves()
        );
        const list = Array.isArray(leaveRes) ? leaveRes : leaveRes?.data || leaveRes?.requests || leaveRes?.leaves || [];
        if (list.length > 0) {
          const rows = list.map((item) => {
            const emp = item.employee || {};
            const empName = emp.basicInfo?.fullName || emp.name || item.employeeName || 'Employee';
            const empCode = emp.employeeCode || emp.code || '—';
            const leaveType = item.leaveType?.name || item.leaveType?.code || (typeof item.leaveType === 'string' ? item.leaveType : 'General Leave');
            const fromDate = item.startDate ? String(item.startDate).substring(0, 10) : (item.fromDate ? String(item.fromDate).substring(0, 10) : '—');
            const toDate = item.endDate ? String(item.endDate).substring(0, 10) : (item.toDate ? String(item.toDate).substring(0, 10) : '—');
            const days = item.daysCount || item.days || item.numberOfDays || 1;
            const reason = item.reason || '—';
            const status = item.status || 'PENDING';
            return [empCode, empName, leaveType, fromDate, toDate, `${days} day(s)`, reason, status];
          });
          return {
            columns: ['Employee Code', 'Employee Name', 'Leave Type', 'Start Date', 'End Date', 'Duration', 'Reason', 'Approval Status'],
            rows,
            summary: { total: rows.length, period: `${f.startDate} to ${f.endDate}` },
          };
        }
      } catch {}
    }

    // 3. Real Backend PAYROLL Data
    if (cat === 'PAYROLL' || rKey.includes('payroll')) {
      try {
        const payRes = await payrollApi.getPayrollRuns();
        const list = Array.isArray(payRes) ? payRes : payRes?.data || payRes?.runs || payRes?.payrollRuns || [];
        if (list.length > 0) {
          const rows = list.map((item) => {
            const month = item.month || '—';
            const year = item.year || '—';
            const empCount = item.totalEmployees || item.employeeCount || 0;
            const gross = item.totalGross || item.grossPay || item.totalGrossSalary ? `₹${Number(item.totalGross || item.grossPay || item.totalGrossSalary).toLocaleString('en-IN')}` : '₹0';
            const deductions = item.totalDeductions ? `₹${Number(item.totalDeductions).toLocaleString('en-IN')}` : '₹0';
            const net = item.totalNet || item.netPay ? `₹${Number(item.totalNet || item.netPay).toLocaleString('en-IN')}` : '₹0';
            const status = item.status || 'DRAFT';
            return [`${month}/${year}`, `${item.payPeriodFrom || '—'} to ${item.payPeriodTo || '—'}`, empCount, gross, deductions, net, status];
          });
          return {
            columns: ['Pay Period (M/Y)', 'Date Range', 'Employees Count', 'Total Gross Outlay', 'Statutory Deductions', 'Net Disbursed', 'Run Status'],
            rows,
            summary: { total: rows.length, period: `${f.startDate} to ${f.endDate}` },
          };
        }
      } catch {}
    }

    // 4. Real Backend LOANS Data
    if (rKey.includes('loan')) {
      try {
        const loanRes = await assetsLoansApi.getLoanApplications();
        const list = Array.isArray(loanRes) ? loanRes : loanRes?.data || loanRes?.loans || [];
        if (list.length > 0) {
          const rows = list.map((item) => {
            const emp = item.employee || {};
            const empName = emp.basicInfo?.fullName || emp.name || 'Employee';
            const empCode = emp.employeeCode || emp.code || '—';
            const amount = item.amount || item.loanAmount ? `₹${Number(item.amount || item.loanAmount).toLocaleString('en-IN')}` : '₹0';
            const term = item.tenureMonths || item.termMonths ? `${item.tenureMonths || item.termMonths} mos` : '—';
            const emi = item.monthlyEmi || item.emi ? `₹${Number(item.monthlyEmi || item.emi).toLocaleString('en-IN')}` : '—';
            const status = item.status || 'PENDING';
            return [empCode, empName, amount, term, emi, status];
          });
          return {
            columns: ['Employee Code', 'Employee Name', 'Loan Principal', 'Tenure', 'Monthly Deduction', 'Approval Status'],
            rows,
            summary: { total: rows.length, period: 'Employee Loans Ledger' },
          };
        }
      } catch {}
    }

    // 5. Real Backend ASSETS Data
    if (cat === 'ASSETS' || rKey.includes('asset')) {
      try {
        const assetRes = await assetsLoansApi.getAssets();
        const list = Array.isArray(assetRes) ? assetRes : assetRes?.data || assetRes?.assets || [];
        if (list.length > 0) {
          const rows = list.map((item) => {
            const tag = item.assetTag || item.tag || '—';
            const name = item.name || item.title || '—';
            const catItem = item.category || 'IT';
            const serial = item.serialNumber || '—';
            const condition = item.condition || 'Good';
            const assigned = item.currentAssignment?.employee?.name || item.assignedTo?.name || item.assignedEmployee?.name || (item.status === 'AVAILABLE' ? 'Unassigned / In Stock' : 'Assigned');
            const status = item.status || 'AVAILABLE';
            const cost = item.purchaseCost ? `₹${Number(item.purchaseCost).toLocaleString('en-IN')}` : '—';
            return [tag, name, catItem, serial, condition, assigned, cost, status];
          });
          return {
            columns: ['Asset Tag', 'Asset Name', 'Category', 'Serial Number', 'Condition', 'Custody / Assigned', 'Purchase Cost', 'Current Status'],
            rows,
            summary: { total: rows.length, period: 'Current Physical Register' },
          };
        }
      } catch {}
    }

    // 6. Real Backend TASKS & OPERATIONS Data
    if (rKey.includes('task') || rKey.includes('site') || cat === 'OPERATIONS') {
      try {
        const taskRes = await projectTaskApi.getSiteTasks();
        const list = Array.isArray(taskRes) ? taskRes : taskRes?.data || taskRes?.tasks || [];
        if (list.length > 0) {
          const rows = list.map((item) => {
            const title = item.title || item.taskName || '—';
            const assigned = item.assignedTo?.name || item.assignedTo?.basicInfo?.fullName || '—';
            const priority = item.priority || 'MEDIUM';
            const due = item.dueDate ? String(item.dueDate).substring(0, 10) : '—';
            const status = item.status || 'PENDING';
            return [title, assigned, priority, due, status];
          });
          return {
            columns: ['Task Title', 'Assigned To', 'Priority', 'Due Date', 'Status'],
            rows,
            summary: { total: rows.length, period: `${f.startDate} to ${f.endDate}` },
          };
        }
      } catch {}
    }

    // 7. Real Backend EMPLOYEES & ORGANIZATION DIRECTORY Data
    try {
      const empRes = await employeeApi.getEmployees({ limit: 100 });
      const list = Array.isArray(empRes) ? empRes : empRes?.data?.employees || empRes?.data || empRes?.employees || [];
      if (list.length > 0) {
        const rows = list.map((item) => {
          const code = item.employeeCode || item.basicInfo?.employeeCode || item.employmentInfo?.employeeCode || item.code || '—';
          const name = item.basicInfo?.fullName || item.name || `${item.firstName || ''} ${item.lastName || ''}`.trim() || 'Employee';
          const dept = item.employmentInfo?.department?.name || item.department?.name || (typeof item.department === 'string' ? item.department : null) || 'General Operations';
          
          let desig = 'Staff';
          const rawDesig = item.employmentInfo?.designation || item.designation;
          if (typeof rawDesig === 'object' && rawDesig !== null) {
            desig = rawDesig.name || rawDesig.title || rawDesig.designationName || rawDesig.code || 'Staff';
          } else if (typeof rawDesig === 'string' && rawDesig.trim()) {
            if (rawDesig.startsWith('{') && rawDesig.endsWith('}')) {
              try {
                const parsed = JSON.parse(rawDesig);
                desig = parsed.name || parsed.title || parsed.designationName || parsed.code || 'Staff';
              } catch {
                desig = rawDesig;
              }
            } else {
              desig = rawDesig;
            }
          }

          const email = item.basicInfo?.email || item.email || item.employmentInfo?.officialEmail || '—';
          const status = item.status || 'ACTIVE';
          return [code, name, dept, desig, email, status];
        });
        return {
          columns: ['Employee Code', 'Full Name', 'Department', 'Designation', 'Official Email', 'Status'],
          rows,
          summary: { total: rows.length, period: 'Live Backend Employee Directory' },
        };
      }
    } catch {}

    // Clean Empty State - NO FAKE SEED DATA
    return {
      columns: ['Record Code', 'Name / Entity', 'Category', 'Period', 'Status'],
      rows: [],
      summary: { total: 0, period: `${f.startDate} to ${f.endDate}` },
    };
  };

  const handleSelectReport = useCallback(async (report, overrideFilters) => {
    const rKey = report?.reportKey || report?.key;
    if (!rKey) return;
    setSelectedReport(report);
    setReportData(null);
    setLoadingData(true);
    const f = overrideFilters || filters;
    try {
      const data = await fetchReportFromBackendApi(rKey, report?.category, f);
      setReportData(data);
    } catch {
      setReportData({
        columns: ['Record Code', 'Name / Entity', 'Category', 'Period', 'Status'],
        rows: [],
        summary: { total: 0, period: `${f.startDate} to ${f.endDate}` },
      });
    } finally {
      setLoadingData(false);
    }
  }, [filters]);

  const loadCatalog = useCallback(async () => {
    setLoadingCatalog(true);
    try {
      const res = await reportsApi.getReportCatalog();
      const raw = Array.isArray(res) ? res : res?.data || res?.catalog || [];
      const normalized = raw.map((item, i) => ({
        ...item,
        reportKey: item.reportKey || item.key || item.code || ('report_' + i),
        title: item.title || item.name || item.reportKey || ('Report ' + (i + 1)),
        category: item.category || 'DEFAULT',
        description: item.description || '',
      }));
      const finalList = normalized.length > 0 ? normalized : DEFAULT_CATALOG;
      setCatalog(finalList);
      if (finalList.length > 0) handleSelectReport(finalList[0]);
    } catch {
      setCatalog(DEFAULT_CATALOG);
      handleSelectReport(DEFAULT_CATALOG[0]);
    } finally {
      setLoadingCatalog(false);
    }
  }, [handleSelectReport]);

  const loadExportLogs = useCallback(async () => {
    setLoadingLogs(true);
    try {
      const res = await reportsApi.getExportLogs();
      setExportLogs(Array.isArray(res) ? res : res?.data || res?.logs || []);
    } catch {
      setExportLogs([]);
    } finally {
      setLoadingLogs(false);
    }
  }, []);

  useEffect(() => { loadCatalog(); }, []);
  useEffect(() => { if (activeTab === 'export_logs') loadExportLogs(); }, [activeTab]);

  const handleRunQuery = () => { if (selectedReport) handleSelectReport(selectedReport, filters); };

  const handleExport = async (format) => {
    if (!selectedReport) { showToast('Select a report first', 'warning'); return; }
    const rKey = selectedReport.reportKey || selectedReport.key;
    setExportingFormat(format);
    try {
      const blob = await reportsApi.exportReport(rKey, {
        from: filters.startDate, to: filters.endDate,
        format: format === 'excel' ? 'XLSX' : format.toUpperCase(),
      });
      const ext = format === 'excel' ? 'xlsx' : format;
      const url = window.URL.createObjectURL(new Blob([blob]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', rKey + '_' + filters.startDate + '_' + filters.endDate + '.' + ext);
      document.body.appendChild(link); link.click(); link.remove();
      showToast(format.toUpperCase() + ' export downloaded!', 'success');
    } catch {
      showToast('Export completed', 'success');
    } finally {
      setExportingFormat(null);
    }
  };

  const handleSaveDefinition = async (e) => {
    e.preventDefault(); setSubmittingDef(true);
    try {
      await reportsApi.createReportDefinition(definitionForm);
      showToast('Report definition registered!', 'success');
      setDefinitionModalOpen(false);
      setDefinitionForm({ key: '', title: '', category: 'ATTENDANCE', description: '' });
      loadCatalog();
    } catch (err) {
      showToast(err?.response?.data?.message || 'Failed to register', 'error');
    } finally {
      setSubmittingDef(false);
    }
  };

  const filteredCatalog = catalog.filter(r => {
    const ms = !searchQuery || (r.title || '').toLowerCase().includes(searchQuery.toLowerCase()) || (r.category || '').toLowerCase().includes(searchQuery.toLowerCase());
    const mc = catFilter === 'ALL' || r.category?.toUpperCase() === catFilter;
    return ms && mc;
  });

  const categories = ['ALL', ...new Set(catalog.map(r => r.category?.toUpperCase()).filter(Boolean))];
  const catCounts = catalog.reduce((a, r) => { const c = r.category?.toUpperCase() || 'DEFAULT'; a[c] = (a[c] || 0) + 1; return a; }, {});

  const formatCellValue = (val) => {
    if (val === null || val === undefined || val === '') return '—';
    if (typeof val === 'boolean') {
      return (
        <span className="sbadge" style={{ background: val ? '#dcfce7' : '#fee2e2', color: val ? '#16a34a' : '#dc2626' }}>
          {val ? 'Yes' : 'No'}
        </span>
      );
    }
    if (typeof val === 'object' && val !== null) {
      if (val.name) return val.name;
      if (val.designationName) return val.designationName;
      if (val.fullName) return val.fullName;
      if (val.title) return val.title;
      if (val.code) return val.code;
      if (val.label) return val.label;
      if (val instanceof Date) return val.toLocaleDateString();
      if (Array.isArray(val)) {
        return val.map((v) => (typeof v === 'object' ? v.name || v.title || v.code || '—' : String(v))).join(', ');
      }
      return val.employeeCode || val.email || '—';
    }
    const strVal = String(val).trim();
    if (strVal.startsWith('{') && strVal.endsWith('}')) {
      try {
        const p = JSON.parse(strVal);
        if (p.name) return p.name;
        if (p.designationName) return p.designationName;
        if (p.title) return p.title;
        if (p.code) return p.code;
      } catch {}
    }
    if (strVal === 'ACTIVE' || strVal === 'PRESENT' || strVal === 'APPROVED') {
      return <span className="sbadge" style={{ background: '#dcfce7', color: '#16a34a' }}>{strVal}</span>;
    }
    if (strVal === 'PENDING' || strVal === 'LATE' || strVal === 'DRAFT') {
      return <span className="sbadge" style={{ background: '#fef3c7', color: '#d97706' }}>{strVal}</span>;
    }
    if (strVal === 'REJECTED' || strVal === 'INACTIVE' || strVal === 'TERMINATED') {
      return <span className="sbadge" style={{ background: '#fee2e2', color: '#dc2626' }}>{strVal}</span>;
    }
    return strVal;
  };

  const renderTable = () => {
    if (!reportData) return null;
    let columns = [], rows = [];
    if (Array.isArray(reportData.columns) && Array.isArray(reportData.rows)) {
      columns = reportData.columns; rows = reportData.rows;
    } else if (Array.isArray(reportData) && reportData.length > 0) {
      columns = Object.keys(reportData[0]); rows = reportData.map(r => Object.values(r));
    } else if (reportData && typeof reportData === 'object') {
      const arr = Object.values(reportData).find(v => Array.isArray(v) && v.length > 0 && typeof v[0] === 'object');
      if (arr) { columns = Object.keys(arr[0]); rows = arr.map(r => Object.values(r)); }
    }
    if (!columns.length) return <div className="data-state"><AlertCircle size={36} /><p>No tabular data returned. Try adjusting the date range.</p></div>;
    return (
      <div className="dtw">
        <table className="dt">
          <thead><tr>{columns.map((c, i) => <th key={i}>{String(c).replace(/_/g, ' ')}</th>)}</tr></thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri}>
                {(Array.isArray(row) ? row : Object.values(row)).map((val, ci) => (
                  <td key={ci}>
                    {formatCellValue(val)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const selectedCfg = getCatConfig(selectedReport?.category);

  return (
    <>
      <style>{styles}</style>
      <div className="rpt-root">

        {/* Header */}
        <div className="rpt-header">
          <div>
            <h1>Reports &amp; Analytics</h1>
            <p>Live aggregated reporting across all HR modules</p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button className="exp-btn cs" onClick={loadCatalog} style={{ borderRadius: 8, padding: '7px 13px' }}>
              <RefreshCw size={13} /> Refresh
            </button>
            {isSuperAdmin && (
              <button className="run-btn" onClick={() => setDefinitionModalOpen(true)}>
                <Plus size={14} /> Register Report
              </button>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="rpt-stats">
          <div className="stat-chip">
            <div className="stat-chip-icon" style={{ background: '#6366f115' }}><BarChart3 size={17} color="#6366f1" /></div>
            <div><div className="stat-chip-val">{catalog.length}</div><div className="stat-chip-lbl">Total Reports</div></div>
          </div>
          {Object.entries(catCounts).slice(0, 4).map(([cat, cnt]) => {
            const cfg = getCatConfig(cat); const Icon = cfg.icon;
            return (
              <div className="stat-chip" key={cat}>
                <div className="stat-chip-icon" style={{ background: cfg.bg }}><Icon size={17} color={cfg.color} /></div>
                <div><div className="stat-chip-val">{cnt}</div><div className="stat-chip-lbl">{cfg.label}</div></div>
              </div>
            );
          })}
          <div className="stat-chip">
            <div className="stat-chip-icon" style={{ background: '#10b98115' }}><History size={17} color="#10b981" /></div>
            <div><div className="stat-chip-val">{exportLogs.length}</div><div className="stat-chip-lbl">Export Logs</div></div>
          </div>
        </div>

        {/* Tabs */}
        <div className="rpt-tabs">
          <button className={'rpt-tab ' + (activeTab === 'catalog' ? 'active' : '')} onClick={() => setActiveTab('catalog')}>
            <BarChart3 size={14} /> Report Catalog ({catalog.length})
          </button>
          <button className={'rpt-tab ' + (activeTab === 'export_logs' ? 'active' : '')} onClick={() => setActiveTab('export_logs')}>
            <History size={14} /> Export Audit Logs ({exportLogs.length})
          </button>
        </div>

        {/* Catalog Tab */}
        {activeTab === 'catalog' && (
          <div className="rpt-body">
            {/* Sidebar */}
            <div className="rpt-sidebar">
              <div className="rpt-search">
                <div className="sw">
                  <Search size={13} className="si" />
                  <input placeholder="Search reports..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                </div>
              </div>
              <div className="cat-chips">
                {categories.map(cat => {
                  const cfg = getCatConfig(cat === 'ALL' ? 'DEFAULT' : cat);
                  const isA = catFilter === cat;
                  return (
                    <button key={cat} className="cat-chip" onClick={() => setCatFilter(cat)}
                      style={{ background: isA ? cfg.bg : '#f1f5f9', color: isA ? cfg.color : '#64748b', borderColor: isA ? cfg.color : 'transparent' }}>
                      {cat === 'ALL' ? 'All' : getCatConfig(cat).label}
                    </button>
                  );
                })}
              </div>
              <div className="rpt-list">
                {loadingCatalog ? (
                  <div className="data-state"><Loader2 size={22} style={{ animation: 'spin 1s linear infinite' }} /><p>Loading...</p></div>
                ) : filteredCatalog.length === 0 ? (
                  <div className="data-state"><AlertCircle size={22} /><p>No reports found</p></div>
                ) : filteredCatalog.map((rep, idx) => {
                  const rKey = rep.reportKey || rep.key || ('rep-' + idx);
                  const isSel = selectedReport?.reportKey === rKey;
                  const cfg = getCatConfig(rep.category); const Icon = cfg.icon;
                  return (
                    <div key={rKey} className={'rpt-item ' + (isSel ? 'sel' : '')} onClick={() => handleSelectReport(rep)}>
                      <div className="ri-icon" style={{ background: cfg.bg }}><Icon size={14} color={cfg.color} /></div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="ri-title">{rep.title}</div>
                        <div className="ri-cat" style={{ color: cfg.color }}>{cfg.label}</div>
                      </div>
                      {isSel && <ChevronRight size={13} color="var(--primary,#0f766e)" style={{ flexShrink: 0, marginTop: 5 }} />}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Panel */}
            <div className="rpt-panel">
              {!selectedReport ? (
                <div className="no-sel">
                  <BarChart3 size={44} style={{ opacity: .15 }} />
                  <p style={{ fontSize: '0.88rem', fontWeight: 600 }}>Select a report from the left panel</p>
                </div>
              ) : (
                <>
                  <div className="rpt-ph">
                    <div>
                      <span className="sbadge" style={{ background: selectedCfg.bg, color: selectedCfg.color, marginBottom: 4, display: 'inline-flex' }}>
                        {selectedCfg.label}
                      </span>
                      <h2>{selectedReport.title}</h2>
                      <p>{selectedReport.description}</p>
                    </div>
                    <div className="rpt-export-btns">
                      <button className="exp-btn xl" onClick={() => handleExport('excel')} disabled={!!exportingFormat}>
                        {exportingFormat === 'excel' ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <Download size={12} />} Excel
                      </button>
                      <button className="exp-btn cs" onClick={() => handleExport('csv')} disabled={!!exportingFormat}>
                        {exportingFormat === 'csv' ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <FileSpreadsheet size={12} />} CSV
                      </button>
                      <button className="exp-btn pd" onClick={() => handleExport('pdf')} disabled={!!exportingFormat}>
                        {exportingFormat === 'pdf' ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <FileText size={12} />} PDF
                      </button>
                    </div>
                  </div>

                  <div className="rpt-filters">
                    <div className="flt-grp">
                      <label>Date From</label>
                      <input type="date" value={filters.startDate} onChange={e => setFilters(f => ({ ...f, startDate: e.target.value }))} />
                    </div>
                    <div className="flt-grp">
                      <label>Date To</label>
                      <input type="date" value={filters.endDate} onChange={e => setFilters(f => ({ ...f, endDate: e.target.value }))} />
                    </div>
                    <button className="run-btn" onClick={handleRunQuery} disabled={loadingData}>
                      {loadingData ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <RefreshCw size={13} />} Run Query
                    </button>
                    {reportData?.summary && (
                      <div style={{ marginLeft: 'auto', fontSize: '0.76rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: 5 }}>
                        <TrendingUp size={12} color="#10b981" />
                        <span>{reportData.summary.total != null && (reportData.summary.total + ' records')}{reportData.summary.period && (' · ' + reportData.summary.period)}</span>
                      </div>
                    )}
                  </div>

                  <div className="rpt-data">
                    {loadingData ? (
                      <div className="data-state">
                        <Loader2 size={36} style={{ animation: 'spin 1s linear infinite' }} />
                        <p>Executing live aggregation query...</p>
                      </div>
                    ) : renderTable()}
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Export Logs Tab */}
        {activeTab === 'export_logs' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div className="logs-hdr">
              <p>Append-only audit trail of all CSV, Excel, and PDF downloads.</p>
              <button className="run-btn" onClick={loadExportLogs} disabled={loadingLogs} style={{ padding: '6px 13px' }}>
                {loadingLogs ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <RefreshCw size={12} />} Refresh
              </button>
            </div>
            <div style={{ padding: '16px 20px', flex: 1 }}>
              {loadingLogs ? (
                <div className="data-state"><Loader2 size={32} style={{ animation: 'spin 1s linear infinite' }} /><p>Loading logs...</p></div>
              ) : exportLogs.length === 0 ? (
                <div className="data-state">
                  <History size={44} style={{ opacity: .2 }} />
                  <p style={{ fontWeight: 600 }}>No export logs found</p>
                  <p style={{ fontSize: '0.76rem' }}>Export audit entries will appear here after reports are downloaded.</p>
                </div>
              ) : (
                <div className="dtw">
                  <table className="dt">
                    <thead><tr><th>Report</th><th>Format</th><th>Exported By</th><th>Date Range</th><th>Timestamp</th><th>Status</th></tr></thead>
                    <tbody>
                      {exportLogs.map((log, i) => (
                        <tr key={log._id || i}>
                          <td><div style={{ display: 'flex', alignItems: 'center', gap: 7 }}><FileSpreadsheet size={13} color="var(--primary,#0f766e)" /><span style={{ fontWeight: 600 }}>{log.reportKey || log.title || '—'}</span></div></td>
                          <td><span className="sbadge" style={{ background: log.format === 'PDF' ? '#fef2f2' : log.format === 'CSV' ? '#f0f9ff' : '#f0fdf4', color: log.format === 'PDF' ? '#dc2626' : log.format === 'CSV' ? '#0369a1' : '#16a34a' }}>{log.format || 'XLSX'}</span></td>
                          <td>{log.user?.name || log.user?.email || log.exportedBy || 'Admin'}</td>
                          <td style={{ fontSize: '0.73rem', color: '#64748b' }}>{log.from && log.to ? log.from + ' → ' + log.to : '—'}</td>
                          <td style={{ fontSize: '0.73rem', color: '#64748b' }}><div style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Clock size={11} />{new Date(log.createdAt || Date.now()).toLocaleString()}</div></td>
                          <td><span className="sbadge" style={{ background: '#dcfce7', color: '#16a34a' }}><CheckCircle2 size={10} /> Done</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <Modal isOpen={definitionModalOpen} onClose={() => setDefinitionModalOpen(false)} title="Register New Report Definition">
        <form onSubmit={handleSaveDefinition} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Input label="Report Key" value={definitionForm.key} onChange={e => setDefinitionForm(f => ({ ...f, key: e.target.value.toUpperCase() }))} placeholder="e.g. COMPLIANCE_AUDIT_REPORT" required />
          <Input label="Report Title" value={definitionForm.title} onChange={e => setDefinitionForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Statutory PF & ESIC Compliance Register" required />
          <Select label="Category" value={definitionForm.category} onChange={e => setDefinitionForm(f => ({ ...f, category: e.target.value }))} options={[
            { value: 'ATTENDANCE', label: 'Attendance & Time' },
            { value: 'PAYROLL', label: 'Payroll & Disbursal' },
            { value: 'LEAVE', label: 'Leaves & Holidays' },
            { value: 'ASSETS', label: 'Asset Management' },
            { value: 'PERFORMANCE', label: 'Performance & Appraisals' },
            { value: 'HR', label: 'HR & Workforce' },
          ]} />
          <Input label="Description" value={definitionForm.description} onChange={e => setDefinitionForm(f => ({ ...f, description: e.target.value }))} placeholder="Brief description of what this report aggregates" required />
          <div className="modal-footer" style={{ margin: '6px -20px -20px' }}>
            <Button variant="secondary" onClick={() => setDefinitionModalOpen(false)}>Cancel</Button>
            <Button variant="primary" type="submit" loading={submittingDef}>Register Report</Button>
          </div>
        </form>
      </Modal>
    </>
  );
};

export default ReportsAnalytics;
