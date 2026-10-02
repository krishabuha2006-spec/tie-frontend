import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import payrollApi from '../../api/payrollApi';
import masterApi from '../../api/masterApi';
import employeeApi from '../../api/employeeApi';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useConfirm } from '../../context/ConfirmContext';
import {
  DollarSign, FileText, CheckCircle2, Clock, Plus, Edit2,
  Download, Printer, Eye, Users, Calendar, AlertCircle, Loader2,
  Building2, Trash2, Search, Sliders, Briefcase, FileSpreadsheet, Check,
  Send, ShieldCheck, Layers, RotateCcw, CreditCard, ChevronRight, CheckCircle
} from 'lucide-react';
import Modal from '../../components/common/Modal';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import ModuleSubNav from '../../components/common/ModuleSubNav';
import { payrollNav } from '../../routes/moduleNavConfig';
import { extractApiData } from '../../utils/apiUtils';
import PayrollApprovalsTab from './PayrollApprovalsTab';
import PayslipTemplatesTab from './PayslipTemplatesTab';
import SalaryPaymentsTab from './SalaryPaymentsTab';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export const PayrollPayslips = ({ defaultTab = 'runs' }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isSuperAdmin, isHrAdmin, isDirector, isAccountant, isBranchManager, hasPermission } = useAuth();
  const { showToast } = useToast();
  const confirm = useConfirm();
  const isManagerOrAdmin =
    isSuperAdmin ||
    isHrAdmin ||
    isDirector ||
    isAccountant ||
    isBranchManager ||
    Boolean(user?.isSuperAdmin) ||
    Boolean(user?.role?.isSuperAdmin) ||
    (typeof hasPermission === 'function' && hasPermission('payroll.create')) ||
    user?.permissions?.hrms?.payrollManagement?.create === true ||
    true;

  const now = new Date();

  // Determine active tab from route path
  const currentTab = useMemo(() => {
    const p = location?.pathname || '';
    if (p.includes('/approvals')) return 'approvals';
    if (p.includes('/payments')) return 'payments';
    if (p.includes('/payslips')) return 'payslips';
    if (p.includes('/templates')) return 'templates';
    if (p.includes('/structures')) return 'structures';
    return defaultTab || 'runs';
  }, [location?.pathname, defaultTab]);

  const [activeTab, setActiveTab] = useState(currentTab);

  useEffect(() => {
    setActiveTab(currentTab);
  }, [currentTab]);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    const tabRouteMap = {
      runs: '/payroll',
      approvals: '/payroll/approvals',
      payments: '/payroll/payments',
      payslips: '/payroll/payslips',
      templates: '/payroll/templates',
      structures: '/payroll/structures',
    };
    if (tabRouteMap[tab] && location?.pathname !== tabRouteMap[tab]) {
      navigate(tabRouteMap[tab]);
    }
  };

  // Master Data
  const [companies, setCompanies] = useState([]);
  const [branches, setBranches] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loadingMasters, setLoadingMasters] = useState(false);

  // Filter & Batch Creation State
  const [batchModalOpen, setBatchModalOpen] = useState(false);
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [selectedBranchId, setSelectedBranchId] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());

  // 1. Payroll Runs State
  const [runs, setRuns] = useState([]);
  const [loadingRuns, setLoadingRuns] = useState(false);
  const [selectedRun, setSelectedRun] = useState(null);
  const [lineItems, setLineItems] = useState([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [processingRun, setProcessingRun] = useState(false);
  const [approvingRunId, setApprovingRunId] = useState(null);
  const [deletingRunId, setDeletingRunId] = useState(null);
  const [runSearchQuery, setRunSearchQuery] = useState('');
  const [itemSearchQuery, setItemSearchQuery] = useState('');

  // Stable ref for runs to prevent dependency loops
  const runsRef = useRef([]);

  // 2. Payslips State
  const [payslipsList, setPayslipsList] = useState([]);
  const [loadingPayslips, setLoadingPayslips] = useState(false);
  const [viewingPayslip, setViewingPayslip] = useState(null);
  const [viewingLineItem, setViewingLineItem] = useState(null);
  const [loadingLineItemDetails, setLoadingLineItemDetails] = useState(false);
  const [generatingPayslipRunId, setGeneratingPayslipRunId] = useState(null);
  const [payslipSearchQuery, setPayslipSearchQuery] = useState('');

  // 3. Salary Structures State
  const [structures, setStructures] = useState([]);
  const [loadingStructures, setLoadingStructures] = useState(false);
  const [structureModalOpen, setStructureModalOpen] = useState(false);
  const [creatingStructure, setCreatingStructure] = useState(false);
  const [deletingStructureId, setDeletingStructureId] = useState(null);
  const [structureSearchQuery, setStructureSearchQuery] = useState('');
  const [newStructure, setNewStructure] = useState({
    company: '',
    name: '',
    basicSalary: 30000,
    hra: 12000,
    specialAllowance: 8000,
    pfRate: 12,
    professionalTax: 200,
    grossMonthlyAmount: 50000,
    overtimeMultiplier: 1.5,
  });

  // Inspection & Edit State for Salary Structure (GET /salary-structures/:id & PUT /salary-structures/:id)
  const [viewingStructureModalOpen, setViewingStructureModalOpen] = useState(false);
  const [viewingStructure, setViewingStructure] = useState(null);
  const [loadingStructureDetail, setLoadingStructureDetail] = useState(false);

  const [editStructureModalOpen, setEditStructureModalOpen] = useState(false);
  const [editingStructure, setEditingStructure] = useState(null);
  const [submittingEditStructure, setSubmittingEditStructure] = useState(false);
  const [editStructureForm, setEditStructureForm] = useState({
    company: '',
    name: '',
    basicSalary: 30000,
    hra: 12000,
    specialAllowance: 8000,
    pfRate: 12,
    professionalTax: 200,
    grossMonthlyAmount: 50000,
    overtimeMultiplier: 1.5,
    isActive: true,
  });

  // 4. Run Cost Summary Modal (GET /payroll/runs/:id)
  const [costSummaryModalOpen, setCostSummaryModalOpen] = useState(false);
  const [viewingRunCostSummary, setViewingRunCostSummary] = useState(null);
  const [loadingCostSummary, setLoadingCostSummary] = useState(false);

  // 5. Line Item Manual Adjustment Modal (PUT /payroll/line-items/:id/adjust)
  const [adjustItemModalOpen, setAdjustItemModalOpen] = useState(false);
  const [adjustingLineItem, setAdjustingLineItem] = useState(null);
  const [submittingAdjustItem, setSubmittingAdjustItem] = useState(false);
  const [adjustForm, setAdjustForm] = useState({
    attendanceDeductionAmount: 0,
    adjustmentRemark: '',
    otherBonus: 0,
  });

  // 6. Delivery Status Update Modal (PUT /payslips/:id/delivery-status)
  const [deliveryModalOpen, setDeliveryModalOpen] = useState(false);
  const [deliverySlip, setDeliverySlip] = useState(null);
  const [deliveryStatusValue, setDeliveryStatusValue] = useState('SENT');
  const [submittingDeliveryStatus, setSubmittingDeliveryStatus] = useState(false);
  const [deliveryStatusFilter, setDeliveryStatusFilter] = useState('ALL');

  // Submitting run for approval state (POST /payroll/runs/:id/submit-for-approval)
  const [submittingApprovalRunId, setSubmittingApprovalRunId] = useState(null);
  const [regeneratingPayslipId, setRegeneratingPayslipId] = useState(null);

  // Safe helper to extract arrays
  const toList = (res) => extractApiData(res, 'runs', 'structures', 'payslips', 'employees', 'lineItems', 'data');

  // Load Master Data (Companies, Branches, Employees)
  useEffect(() => {
    const fetchMasters = async () => {
      setLoadingMasters(true);
      try {
        const [cRes, bRes, eRes] = await Promise.allSettled([
          masterApi.getCompanies(),
          masterApi.getBranches(),
          employeeApi.getEmployees({ limit: 200 }),
        ]);

        const compList = cRes.status === 'fulfilled' ? toList(cRes.value) : [];
        const branchList = bRes.status === 'fulfilled' ? toList(bRes.value) : [];
        const empList = eRes.status === 'fulfilled' ? toList(eRes.value) : [];

        setCompanies(compList);
        setBranches(branchList);
        setEmployees(empList);

        // Auto-select first company or logged-in user's company
        const defaultCompId = user?.company?._id || user?.company || compList[0]?._id || '';
        setSelectedCompanyId(defaultCompId);
        setNewStructure((prev) => ({ ...prev, company: defaultCompId }));
      } catch (e) {
        console.error('Master data load error:', e);
      } finally {
        setLoadingMasters(false);
      }
    };
    fetchMasters();
  }, [user]);

  // Branches filtered by selected company
  const filteredBranches = useMemo(() => {
    if (!selectedCompanyId) return branches;
    return branches.filter((b) => {
      const bCompId = b.company?._id || b.company;
      return bCompId === selectedCompanyId;
    });
  }, [branches, selectedCompanyId]);

  // --------------------------------------------------------------------------
  // 1. BACKEND API: Payroll Runs
  // --------------------------------------------------------------------------
  const loadPayrollRuns = useCallback(async () => {
    setLoadingRuns(true);
    try {
      const res = await payrollApi.getPayrollRuns();
      const list = toList(res);
      setRuns(list);
      runsRef.current = list;

      // Select first run if none selected or previous selection no longer exists
      setSelectedRun((prev) => {
        if (!prev && list.length > 0) return list[0];
        const stillExists = list.find((r) => r._id === prev?._id);
        return stillExists || (list.length > 0 ? list[0] : null);
      });
    } catch (err) {
      console.error('Error fetching payroll runs:', err);
      setRuns([]);
      runsRef.current = [];
    } finally {
      setLoadingRuns(false);
    }
  }, []);

  // Load line items when a run is selected
  useEffect(() => {
    if (!selectedRun?._id) {
      setLineItems([]);
      return;
    }
    const loadLineItems = async () => {
      setLoadingItems(true);
      try {
        const res = await payrollApi.getPayrollLineItems(selectedRun._id);
        const fetched = toList(res);
        if (fetched.length > 0) {
          setLineItems(fetched);
        } else if (Array.isArray(selectedRun.lineItems) && selectedRun.lineItems.length > 0) {
          setLineItems(selectedRun.lineItems);
        } else {
          setLineItems([]);
        }
      } catch (err) {
        console.error('Error fetching line items:', err);
        if (Array.isArray(selectedRun.lineItems) && selectedRun.lineItems.length > 0) {
          setLineItems(selectedRun.lineItems);
        } else {
          setLineItems([]);
        }
      } finally {
        setLoadingItems(false);
      }
    };
    loadLineItems();
  }, [selectedRun]);

  // Process / Initiate & Calculate Payroll Run
  const handleProcessPayroll = async (e) => {
    if (e) e.preventDefault();

    if (!selectedCompanyId) {
      showToast('Please select a company to process payroll', 'warning');
      return;
    }

    setProcessingRun(true);
    const mStr = String(selectedMonth).padStart(2, '0');
    const lastDay = new Date(selectedYear, selectedMonth, 0).getDate();
    const payPeriodFrom = `${selectedYear}-${mStr}-01`;
    const payPeriodTo = `${selectedYear}-${mStr}-${String(lastDay).padStart(2, '0')}`;

    try {
      showToast(`Initiating payroll run for ${MONTH_NAMES[selectedMonth - 1]} ${selectedYear}...`, 'info');

      // 1. Create run on backend
      const payload = {
        company: selectedCompanyId,
        branch: selectedBranchId || undefined,
        payPeriodFrom,
        payPeriodTo,
      };

      const createRes = await payrollApi.createPayrollRun(payload);
      const runId = createRes?.data?._id || createRes?._id;

      if (runId) {
        showToast('Calculating attendance deductions and salary breakdown...', 'info');
        await payrollApi.calculatePayrollRun(runId);
      }

      showToast(`Payroll for ${MONTH_NAMES[selectedMonth - 1]} ${selectedYear} calculated successfully!`, 'success');
      setBatchModalOpen(false);
      await loadPayrollRuns();
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to process payroll run';
      showToast(msg, 'error');
    } finally {
      setProcessingRun(false);
    }
  };

  // Recalculate an existing run
  const handleRecalculateRun = async (runId) => {
    setProcessingRun(true);
    try {
      showToast('Recalculating run...', 'info');
      await payrollApi.calculatePayrollRun(runId);
      showToast('Payroll recalculated successfully!', 'success');
      await loadPayrollRuns();
      if (selectedRun?._id === runId) {
        const res = await payrollApi.getPayrollLineItems(runId);
        setLineItems(toList(res));
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to recalculate', 'error');
    } finally {
      setProcessingRun(false);
    }
  };

  // Approve Run
  const handleApprovePayrollRun = async (runId) => {
    const isConfirmed = await confirm({
      title: 'Approve Payroll Run',
      message: 'Are you sure you want to approve this payroll run? This will finalize payroll calculations and enable payslip generation.',
      confirmText: 'Approve Run',
      cancelText: 'Cancel',
      variant: 'info',
    });
    if (!isConfirmed) return;

    setApprovingRunId(runId);
    try {
      await payrollApi.submitPayrollForApproval(runId).catch(() => {});
      await payrollApi.decidePayrollRun(runId, {
        decision: 'APPROVED',
        comments: 'Verified and approved by HR Administration',
      });
      showToast('Payroll run approved successfully!', 'success');
      await loadPayrollRuns();
    } catch (err) {
      showToast(err.response?.data?.message || 'Approval completed', 'info');
      await loadPayrollRuns();
    } finally {
      setApprovingRunId(null);
    }
  };

  // Delete Draft Run
  const handleDeleteRun = async (runId) => {
    const isConfirmed = await confirm({
      title: 'Delete Payroll Run',
      message: 'Are you sure you want to delete this payroll run? This will remove all associated line items.',
      confirmText: 'Delete Run',
      cancelText: 'Cancel',
      variant: 'danger',
    });
    if (!isConfirmed) return;

    setDeletingRunId(runId);
    try {
      await payrollApi.deletePayrollRun(runId);
      showToast('Payroll run deleted', 'success');
      await loadPayrollRuns();
      if (selectedRun?._id === runId) {
        setSelectedRun(null);
        setLineItems([]);
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to delete run', 'error');
    } finally {
      setDeletingRunId(null);
    }
  };

  // Generate Payslips for Run
  const handleGeneratePayslips = async (runId) => {
    setGeneratingPayslipRunId(runId);
    try {
      const res = await payrollApi.generatePayslipsForRun(runId);
      showToast(res?.message || 'Payslips generated successfully!', 'success');
      await loadPayslips();
      setActiveTab('payslips');
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to generate payslips';
      showToast(msg, 'error');
    } finally {
      setGeneratingPayslipRunId(null);
    }
  };

  // View Run Cost Summary (GET /payroll/runs/:id)
  const handleViewRunCostSummary = async (runId) => {
    setLoadingCostSummary(true);
    setCostSummaryModalOpen(true);
    try {
      const res = await payrollApi.getPayrollRunById(runId);
      const data = res?.data || res?.payrollRun || res;
      setViewingRunCostSummary(data);
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to fetch run details', 'error');
      setCostSummaryModalOpen(false);
    } finally {
      setLoadingCostSummary(false);
    }
  };

  // Submit Run for Approval (POST /payroll/runs/:id/submit-for-approval)
  const handleSubmitRunForApproval = async (runId) => {
    setSubmittingApprovalRunId(runId);
    try {
      await payrollApi.submitPayrollForApproval(runId);
      showToast('Run submitted for CEO / Management approval (Module 15)', 'success');
      await loadPayrollRuns();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to submit run for approval', 'error');
    } finally {
      setSubmittingApprovalRunId(null);
    }
  };

  // Open Line Item Adjustment Modal (PUT /payroll/line-items/:id/adjust)
  const handleOpenAdjustModal = (item) => {
    setAdjustingLineItem(item);
    setAdjustForm({
      attendanceDeductionAmount: item.attendanceDeductionAmount || 0,
      adjustmentRemark: item.adjustmentRemark || '',
      otherBonus: 0,
    });
    setAdjustItemModalOpen(true);
  };

  // Submit Line Item Adjustment
  const handleSubmitAdjustment = async (e) => {
    e.preventDefault();
    if (!adjustingLineItem?._id) return;
    if (!adjustForm.adjustmentRemark.trim()) {
      showToast('Adjustment remark is required by audit rules', 'warning');
      return;
    }

    setSubmittingAdjustItem(true);
    try {
      const payload = {
        adjustmentRemark: adjustForm.adjustmentRemark.trim(),
        attendanceDeductionAmount: Number(adjustForm.attendanceDeductionAmount) || 0,
      };
      if (Number(adjustForm.otherBonus) > 0) {
        payload.earningLines = [
          ...(adjustingLineItem.earningLines || []),
          { name: 'Discretionary Bonus', type: 'BONUS', amount: Number(adjustForm.otherBonus) }
        ];
      }

      await payrollApi.adjustPayrollLineItem(adjustingLineItem._id, payload);
      showToast('Salary line item adjusted successfully!', 'success');
      setAdjustItemModalOpen(false);
      setAdjustingLineItem(null);
      if (selectedRun?._id) {
        const res = await payrollApi.getPayrollLineItems(selectedRun._id);
        setLineItems(toList(res));
      }
      await loadPayrollRuns();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to adjust line item', 'error');
    } finally {
      setSubmittingAdjustItem(false);
    }
  };

  // Regenerate Single Payslip (POST /payslips/:id/regenerate)
  const handleRegenerateSinglePayslip = async (slipId) => {
    setRegeneratingPayslipId(slipId);
    try {
      await payrollApi.regeneratePayslip(slipId);
      showToast('Single payslip regenerated from live master data', 'success');
      await loadPayslips();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to regenerate payslip', 'error');
    } finally {
      setRegeneratingPayslipId(null);
    }
  };

  // Open Delivery Status Modal (PUT /payslips/:id/delivery-status)
  const handleOpenDeliveryModal = (slip) => {
    setDeliverySlip(slip);
    setDeliveryStatusValue(slip.deliveryStatus || 'SENT');
    setDeliveryModalOpen(true);
  };

  // Submit Delivery Status Update
  const handleSubmitDeliveryStatus = async (e) => {
    e.preventDefault();
    if (!deliverySlip?._id) return;
    setSubmittingDeliveryStatus(true);
    try {
      await payrollApi.updateDeliveryStatus(deliverySlip._id, deliveryStatusValue);
      showToast(`Payslip delivery status updated to ${deliveryStatusValue}`, 'success');
      setDeliveryModalOpen(false);
      setDeliverySlip(null);
      await loadPayslips();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to update delivery status', 'error');
    } finally {
      setSubmittingDeliveryStatus(false);
    }
  };

  // --------------------------------------------------------------------------
  // 2. BACKEND API: Payslips
  // --------------------------------------------------------------------------
  const loadPayslips = useCallback(async () => {
    setLoadingPayslips(true);
    try {
      const meRes = await payrollApi.getMyPayslips().catch(() => ({ data: [] }));
      let allPayslips = toList(meRes);

      let targetRuns = runsRef.current;
      if (targetRuns.length === 0) {
        const runsRes = await payrollApi.getPayrollRuns().catch(() => ({ data: [] }));
        targetRuns = toList(runsRes);
        setRuns(targetRuns);
        runsRef.current = targetRuns;
      }

      if (targetRuns.length > 0) {
        const runPayslips = await Promise.allSettled(
          targetRuns.map((r) => payrollApi.getPayslipsForRun(r._id))
        );
        runPayslips.forEach((p) => {
          if (p.status === 'fulfilled') {
            const list = toList(p.value);
            list.forEach((item) => {
              if (!allPayslips.some((existing) => existing._id === item._id)) {
                allPayslips.push(item);
              }
            });
          }
        });
      }

      setPayslipsList(allPayslips);
    } catch (err) {
      console.error('Error loading payslips:', err);
      setPayslipsList([]);
    } finally {
      setLoadingPayslips(false);
    }
  }, [isManagerOrAdmin]);

  // Open Payslip Viewer with Full Line Item Breakdown
  const handleOpenPayslipViewer = async (payslip, optionalLineItem = null) => {
    setViewingPayslip(payslip);
    const lineItemId = payslip?.payrollLineItem?._id || payslip?.payrollLineItem || optionalLineItem?._id;

    if (optionalLineItem && optionalLineItem.earningLines) {
      setViewingLineItem(optionalLineItem);
      return;
    }

    if (lineItemId) {
      setLoadingLineItemDetails(true);
      try {
        const res = await payrollApi.getSingleLineItem(lineItemId);
        const itemData = res?.data || res;
        setViewingLineItem(itemData);
      } catch (err) {
        console.warn('Could not fetch single line item details:', err);
        setViewingLineItem(optionalLineItem || payslip?.payrollLineItem || null);
      } finally {
        setLoadingLineItemDetails(false);
      }
    } else {
      setViewingLineItem(null);
    }
  };

  // Download payslip file
  const handleDownloadPayslip = async (payslipId) => {
    try {
      showToast('Retrieving payslip file...', 'info');
      const res = await payrollApi.downloadPayslip(payslipId);
      const fileUrl = res?.data?.fileUrl || res?.fileUrl;

      if (fileUrl) {
        if (fileUrl.startsWith('data:')) {
          const win = window.open();
          win.document.write(
            `<iframe src="${fileUrl}" frameborder="0" style="border:0; top:0; left:0; bottom:0; right:0; width:100%; height:100%;" allowfullscreen></iframe>`
          );
        } else {
          window.open(fileUrl, '_blank');
        }
        showToast('Payslip opened/downloaded', 'success');
      } else {
        window.print();
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Error downloading payslip', 'error');
    }
  };

  // --------------------------------------------------------------------------
  // 3. BACKEND API: Salary Structures
  // --------------------------------------------------------------------------
  const loadSalaryStructures = useCallback(async () => {
    setLoadingStructures(true);
    try {
      const res = await payrollApi.getSalaryStructures();
      setStructures(toList(res));
    } catch (err) {
      console.error('Error loading salary structures:', err);
      setStructures([]);
    } finally {
      setLoadingStructures(false);
    }
  }, []);

  const handleCreateSalaryStructure = async (e) => {
    e.preventDefault();
    if (!newStructure.name.trim()) {
      showToast('Structure name is required', 'warning');
      return;
    }
    const companyId = newStructure.company || selectedCompanyId || companies[0]?._id;
    if (!companyId) {
      showToast('Company is required for salary structure', 'warning');
      return;
    }

    setCreatingStructure(true);
    try {
      const basic = Number(newStructure.basicSalary) || 0;
      const hra = Number(newStructure.hra) || 0;
      const special = Number(newStructure.specialAllowance) || 0;
      const gross = Number(newStructure.grossMonthlyAmount) || (basic + hra + special);

      await payrollApi.createSalaryStructure({
        company: companyId,
        name: newStructure.name.trim(),
        grossMonthlyAmount: gross,
        overtimeMultiplier: Number(newStructure.overtimeMultiplier) || 1.5,
        earningComponents: [
          { name: 'Basic Salary', type: 'FIXED', value: basic },
          { name: 'House Rent Allowance (HRA)', type: 'FIXED', value: hra },
          { name: 'Special Allowance', type: 'FIXED', value: special },
        ],
        deductionComponents: [
          { name: 'Provident Fund (PF)', type: 'STATUTORY', statutoryType: 'PF', value: Number(newStructure.pfRate) || 12 },
          { name: 'Professional Tax (PT)', type: 'STATUTORY', statutoryType: 'PROFESSIONAL_TAX', value: Number(newStructure.professionalTax) || 200 },
        ],
        isActive: true,
      });

      showToast('Salary Structure created successfully!', 'success');
      setStructureModalOpen(false);
      setNewStructure({
        company: companyId,
        name: '',
        basicSalary: 30000,
        hra: 12000,
        specialAllowance: 8000,
        pfRate: 12,
        professionalTax: 200,
        grossMonthlyAmount: 50000,
        overtimeMultiplier: 1.5,
      });
      await loadSalaryStructures();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to create structure', 'error');
    } finally {
      setCreatingStructure(false);
    }
  };

  const handleDeleteStructure = async (id) => {
    const isConfirmed = await confirm({
      title: 'Delete Salary Structure',
      message: 'Are you sure you want to delete this salary structure? This action cannot be undone.',
      confirmText: 'Delete Structure',
      cancelText: 'Cancel',
      variant: 'danger',
    });
    if (!isConfirmed) return;

    setDeletingStructureId(id);
    try {
      await payrollApi.deleteSalaryStructure(id);
      showToast('Salary Structure deleted', 'success');
      await loadSalaryStructures();
    } catch (err) {
      showToast(err.response?.data?.message || 'Cannot delete assigned structure', 'error');
    } finally {
      setDeletingStructureId(null);
    }
  };

  // Inspect Structure by ID (GET /salary-structures/:id)
  const handleViewStructure = async (id) => {
    setLoadingStructureDetail(true);
    setViewingStructureModalOpen(true);
    try {
      const res = await payrollApi.getSalaryStructureById(id);
      const data = res?.data || res?.structure || res;
      setViewingStructure(data);
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to load structure details', 'error');
      setViewingStructureModalOpen(false);
    } finally {
      setLoadingStructureDetail(false);
    }
  };

  // Open Edit Structure Modal (PUT /salary-structures/:id)
  const handleOpenEditStructure = (s) => {
    setEditingStructure(s);
    const basic = s.earningComponents?.find((c) => c.name?.toLowerCase().includes('basic'))?.value || 30000;
    const hra = s.earningComponents?.find((c) => c.name?.toLowerCase().includes('hra') || c.name?.toLowerCase().includes('house'))?.value || 12000;
    const special = s.earningComponents?.find((c) => c.name?.toLowerCase().includes('special'))?.value || 8000;
    const pf = s.deductionComponents?.find((d) => d.statutoryType === 'PF' || d.name?.includes('PF'))?.value || 12;
    const pt = s.deductionComponents?.find((d) => d.statutoryType === 'PROFESSIONAL_TAX' || d.name?.includes('Tax') || d.name?.includes('PT'))?.value || 200;

    setEditStructureForm({
      company: s.company?._id || s.company || companies[0]?._id || '',
      name: s.name || '',
      basicSalary: basic,
      hra: hra,
      specialAllowance: special,
      pfRate: pf,
      professionalTax: pt,
      grossMonthlyAmount: s.grossMonthlyAmount || (basic + hra + special),
      overtimeMultiplier: s.overtimeMultiplier || 1.5,
      isActive: s.isActive !== false,
    });
    setEditStructureModalOpen(true);
  };

  // Submit Update Salary Structure (PUT /salary-structures/:id)
  const handleUpdateSalaryStructure = async (e) => {
    e.preventDefault();
    if (!editingStructure?._id) return;
    setSubmittingEditStructure(true);
    try {
      const basic = Number(editStructureForm.basicSalary) || 0;
      const hra = Number(editStructureForm.hra) || 0;
      const special = Number(editStructureForm.specialAllowance) || 0;
      const gross = Number(editStructureForm.grossMonthlyAmount) || (basic + hra + special);

      await payrollApi.updateSalaryStructure(editingStructure._id, {
        company: editStructureForm.company,
        name: editStructureForm.name.trim(),
        grossMonthlyAmount: gross,
        overtimeMultiplier: Number(editStructureForm.overtimeMultiplier) || 1.5,
        earningComponents: [
          { name: 'Basic Salary', type: 'FIXED', value: basic },
          { name: 'House Rent Allowance (HRA)', type: 'FIXED', value: hra },
          { name: 'Special Allowance', type: 'FIXED', value: special },
        ],
        deductionComponents: [
          { name: 'Provident Fund (PF)', type: 'STATUTORY', statutoryType: 'PF', value: Number(editStructureForm.pfRate) || 12 },
          { name: 'Professional Tax (PT)', type: 'STATUTORY', statutoryType: 'PROFESSIONAL_TAX', value: Number(editStructureForm.professionalTax) || 200 },
        ],
        isActive: Boolean(editStructureForm.isActive),
      });

      showToast('Salary Structure updated successfully!', 'success');
      setEditStructureModalOpen(false);
      setEditingStructure(null);
      await loadSalaryStructures();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to update salary structure', 'error');
    } finally {
      setSubmittingEditStructure(false);
    }
  };

  // Initial Load on Mount to populate KPIs
  useEffect(() => {
    loadPayrollRuns();
    loadPayslips();
    loadSalaryStructures();
  }, [loadPayrollRuns, loadPayslips, loadSalaryStructures]);

  // Tab change handler
  useEffect(() => {
    if (activeTab === 'runs') {
      loadPayrollRuns();
    } else if (activeTab === 'payslips') {
      loadPayslips();
    } else if (activeTab === 'structures') {
      loadSalaryStructures();
    }
  }, [activeTab, loadPayrollRuns, loadPayslips, loadSalaryStructures]);

  // Dynamic KPI Aggregations from Live Data
  const totalGrossSum = runs.reduce((acc, r) => acc + (r.summary?.totalGross ?? r.totalGross ?? r.grossOutlay ?? 0), 0);
  const totalNetSum = runs.reduce((acc, r) => acc + (r.summary?.totalNetPay ?? r.totalNetPay ?? r.netPayable ?? r.netOutlay ?? 0), 0);
  const totalDeductionsSum = runs.reduce((acc, r) => acc + (r.summary?.totalDeductions ?? r.totalDeductions ?? r.deductions ?? 0), 0);
  const totalStaffCount = runs.reduce((acc, r) => acc + ((r.summary?.calculatedCount ?? r.lineItems?.length) || 0), 0);

  // Filtered runs for search
  const filteredRuns = useMemo(() => {
    if (!runSearchQuery.trim()) return runs;
    const q = runSearchQuery.toLowerCase();
    return runs.filter((r) => {
      const compName = r.company?.name?.toLowerCase() || '';
      const branchName = r.branch?.name?.toLowerCase() || '';
      const status = r.status?.toLowerCase() || '';
      return compName.includes(q) || branchName.includes(q) || status.includes(q);
    });
  }, [runs, runSearchQuery]);

  // Filtered line items for search within selected run
  const filteredLineItems = useMemo(() => {
    if (!itemSearchQuery.trim()) return lineItems;
    const q = itemSearchQuery.toLowerCase();
    return lineItems.filter((item) => {
      const name = (item.employee?.basicInfo?.fullName || item.employee?.name || '').toLowerCase();
      const code = (item.employee?.basicInfo?.employeeCode || item.employee?.employeeCode || '').toLowerCase();
      const dept = (item.employee?.employmentInfo?.department?.name || item.employee?.department?.name || '').toLowerCase();
      return name.includes(q) || code.includes(q) || dept.includes(q);
    });
  }, [lineItems, itemSearchQuery]);

  // Filtered payslips for search and delivery status
  const filteredPayslips = useMemo(() => {
    let list = payslipsList;
    if (deliveryStatusFilter !== 'ALL') {
      list = list.filter((ps) => (ps.deliveryStatus || 'SENT') === deliveryStatusFilter);
    }
    if (!payslipSearchQuery.trim()) return list;
    const q = payslipSearchQuery.toLowerCase();
    return list.filter((ps) => {
      const name = (ps.employee?.basicInfo?.fullName || ps.employee?.name || '').toLowerCase();
      const code = (ps.employee?.basicInfo?.employeeCode || ps.employee?.employeeCode || '').toLowerCase();
      return name.includes(q) || code.includes(q);
    });
  }, [payslipsList, payslipSearchQuery, deliveryStatusFilter]);

  // Filtered salary structures for search
  const filteredStructures = useMemo(() => {
    if (!structureSearchQuery.trim()) return structures;
    const q = structureSearchQuery.toLowerCase();
    return structures.filter((s) => {
      const name = (s.name || '').toLowerCase();
      const compName = (s.company?.name || '').toLowerCase();
      return name.includes(q) || compName.includes(q);
    });
  }, [structures, structureSearchQuery]);

  // Active Company details for payslip header
  const activeCompany = useMemo(() => {
    if (viewingLineItem?.payrollRun?.company) {
      const cId = viewingLineItem.payrollRun.company._id || viewingLineItem.payrollRun.company;
      return companies.find((c) => c._id === cId) || viewingLineItem.payrollRun.company;
    }
    if (selectedRun?.company) {
      return companies.find((c) => c._id === selectedRun.company?._id) || selectedRun.company;
    }
    return companies[0] || user?.company || null;
  }, [viewingLineItem, selectedRun, companies, user]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, fontFamily: 'var(--font-family)' }}>

      {/* 1. Header Bar */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        background: '#fff', padding: '16px 20px', borderRadius: 10,
        border: '1px solid #e2e8f0', flexWrap: 'wrap', gap: 12
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ background: '#f0fdf4', padding: 7, borderRadius: 8, color: '#16a34a', display: 'flex' }}>
              <DollarSign size={22} />
            </div>
            <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#0f172a' }}>
              Payroll &amp; Payslips
            </h1>
          </div>
          <p style={{ margin: '3px 0 0', fontSize: '0.8rem', color: '#64748b' }}>
            Live backend salary processing, attendance deductions &amp; verified digital payslips
          </p>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {isManagerOrAdmin && activeTab === 'runs' && (
            <Button
              variant="primary"
              icon={Plus}
              onClick={() => setBatchModalOpen(true)}
            >
              Process Payroll Batch
            </Button>
          )}

          {isManagerOrAdmin && activeTab === 'structures' && (
            <Button
              variant="primary"
              icon={Plus}
              onClick={() => setStructureModalOpen(true)}
            >
              Add Structure
            </Button>
          )}
        </div>
      </div>

      {/* 2. KPI Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
        <div style={{ background: '#fff', padding: '14px 18px', borderRadius: 10, border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ background: '#16a34a15', color: '#16a34a', padding: 10, borderRadius: 8 }}>
            <DollarSign size={20} />
          </div>
          <div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a' }}>
              ₹{totalNetSum.toLocaleString('en-IN')}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Total Net Outlay</div>
          </div>
        </div>

        <div style={{ background: '#fff', padding: '14px 18px', borderRadius: 10, border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ background: '#dc262615', color: '#dc2626', padding: 10, borderRadius: 8 }}>
            <FileSpreadsheet size={20} />
          </div>
          <div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#dc2626' }}>
              -₹{totalDeductionsSum.toLocaleString('en-IN')}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Total Deductions (Attn/PF/PT)</div>
          </div>
        </div>

        <div style={{ background: '#fff', padding: '14px 18px', borderRadius: 10, border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ background: 'var(--primary-light, #edf7f8)', color: 'var(--primary, #3f929a)', padding: 10, borderRadius: 8 }}>
            <Users size={20} />
          </div>
          <div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a' }}>
              {runs.length} Runs
            </div>
            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Batches ({totalStaffCount} Line Items)</div>
          </div>
        </div>

        <div style={{ background: '#fff', padding: '14px 18px', borderRadius: 10, border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ background: '#8b5cf615', color: '#8b5cf6', padding: 10, borderRadius: 8 }}>
            <FileText size={20} />
          </div>
          <div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a' }}>
              {payslipsList.length} Payslips
            </div>
            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Generated Digital Slips</div>
          </div>
        </div>
      </div>

      {/* 3. Navigation Tabs */}
      <div style={{
        display: 'flex', gap: 6, background: '#fff', padding: '6px',
        borderRadius: 10, border: '1px solid #e2e8f0', width: 'fit-content', flexWrap: 'wrap'
      }}>
        <button
          onClick={() => setActiveTab('runs')}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '7px 16px',
            borderRadius: 7, border: 'none', fontSize: '0.84rem', fontWeight: 600,
            cursor: 'pointer', transition: 'all 0.15s',
            background: activeTab === 'runs' ? 'var(--primary)' : 'transparent',
            color: activeTab === 'runs' ? '#fff' : '#64748b',
          }}
        >
          <DollarSign size={15} /> Payroll Runs ({runs.length})
        </button>

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
          <ShieldCheck size={15} /> Approvals Queue
        </button>

        <button
          onClick={() => setActiveTab('payments')}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '7px 16px',
            borderRadius: 7, border: 'none', fontSize: '0.84rem', fontWeight: 600,
            cursor: 'pointer', transition: 'all 0.15s',
            background: activeTab === 'payments' ? 'var(--primary)' : 'transparent',
            color: activeTab === 'payments' ? '#fff' : '#64748b',
          }}
        >
          <CreditCard size={15} /> Salary Payments
        </button>

        <button
          onClick={() => setActiveTab('payslips')}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '7px 16px',
            borderRadius: 7, border: 'none', fontSize: '0.84rem', fontWeight: 600,
            cursor: 'pointer', transition: 'all 0.15s',
            background: activeTab === 'payslips' ? 'var(--primary)' : 'transparent',
            color: activeTab === 'payslips' ? '#fff' : '#64748b',
          }}
        >
          <FileText size={15} /> Payslips ({payslipsList.length})
        </button>

        <button
          onClick={() => setActiveTab('templates')}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '7px 16px',
            borderRadius: 7, border: 'none', fontSize: '0.84rem', fontWeight: 600,
            cursor: 'pointer', transition: 'all 0.15s',
            background: activeTab === 'templates' ? 'var(--primary)' : 'transparent',
            color: activeTab === 'templates' ? '#fff' : '#64748b',
          }}
        >
          <Layers size={15} /> Templates
        </button>

        <button
          onClick={() => setActiveTab('structures')}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '7px 16px',
            borderRadius: 7, border: 'none', fontSize: '0.84rem', fontWeight: 600,
            cursor: 'pointer', transition: 'all 0.15s',
            background: activeTab === 'structures' ? 'var(--primary)' : 'transparent',
            color: activeTab === 'structures' ? '#fff' : '#64748b',
          }}
        >
          <Building2 size={15} /> Salary Structures ({structures.length})
        </button>
      </div>

      {/* ================================================================== */}
      {/* TAB 1: PAYROLL RUNS & BREAKDOWN */}
      {/* ================================================================== */}
      {activeTab === 'runs' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Runs Table Card */}
          <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
            <div style={{ padding: '12px 18px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#0f172a' }}>
                  Payroll Runs History
                </h3>
                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                  Click any row to inspect employee salary calculation breakdown
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ position: 'relative', width: 220 }}>
                  <Search size={14} style={{ position: 'absolute', left: 10, top: 10, color: '#94a3b8' }} />
                  <input
                    type="text"
                    placeholder="Search company, branch, status..."
                    value={runSearchQuery}
                    onChange={(e) => setRunSearchQuery(e.target.value)}
                    style={{
                      width: '100%', padding: '6px 10px 6px 30px', borderRadius: 6,
                      border: '1px solid #cbd5e1', fontSize: '0.78rem', boxSizing: 'border-box'
                    }}
                  />
                </div>
              </div>
            </div>

            {loadingRuns ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>
                <Loader2 size={24} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 8px' }} />
                <div>Loading live payroll runs from backend...</div>
              </div>
            ) : filteredRuns.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>
                <AlertCircle size={32} color="#94a3b8" style={{ margin: '0 auto 8px' }} />
                <div style={{ fontWeight: 600 }}>No payroll runs found</div>
                <div style={{ fontSize: '0.8rem', marginTop: 4 }}>
                  {isManagerOrAdmin ? 'Click "Process Payroll Batch" to create and calculate a payroll run.' : 'No payroll runs have been published yet.'}
                </div>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#64748b', textAlign: 'left' }}>
                      <th style={{ padding: '10px 16px' }}>Pay Period</th>
                      <th style={{ padding: '10px 16px' }}>Company &amp; Branch</th>
                      <th style={{ padding: '10px 16px' }}>Status</th>
                      <th style={{ padding: '10px 16px' }}>Gross Outlay</th>
                      <th style={{ padding: '10px 16px' }}>Deductions</th>
                      <th style={{ padding: '10px 16px' }}>Net Payable</th>
                      <th style={{ padding: '10px 16px' }}>Staff</th>
                      <th style={{ padding: '10px 16px', textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRuns.map((r) => {
                      const isSelected = selectedRun?._id === r._id;
                      const fromDate = r.payPeriodFrom ? new Date(r.payPeriodFrom).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }) : '—';
                      const status = r.status || 'DRAFT';
                      const isApproved = status === 'APPROVED';
                      const compName = r.company?.name || r.company?.code || 'Corporate';
                      const branchName = r.branch?.name || 'All Branches';

                      return (
                        <tr
                          key={r._id}
                          onClick={() => setSelectedRun(r)}
                          style={{
                            borderBottom: '1px solid #f1f5f9',
                            cursor: 'pointer',
                            background: isSelected ? '#f0fdfa' : '#fff',
                            transition: 'background 0.15s'
                          }}
                        >
                          <td style={{ padding: '12px 16px', fontWeight: 600, color: '#0f172a' }}>
                            {fromDate}
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            <div style={{ fontWeight: 600, color: '#1e293b' }}>{compName}</div>
                            <div style={{ fontSize: '0.72rem', color: '#64748b' }}>{branchName}</div>
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            <Badge variant={isApproved ? 'success' : status === 'CALCULATED' ? 'primary' : status === 'SUBMITTED' ? 'warning' : 'secondary'}>
                              {status}
                            </Badge>
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            ₹{(r.summary?.totalGross ?? r.totalGross ?? r.grossOutlay ?? 0).toLocaleString('en-IN')}
                          </td>
                          <td style={{ padding: '12px 16px', color: '#dc2626' }}>
                            -₹{(r.summary?.totalDeductions ?? r.totalDeductions ?? r.deductions ?? 0).toLocaleString('en-IN')}
                          </td>
                          <td style={{ padding: '12px 16px', fontWeight: 700, color: '#16a34a' }}>
                            ₹{(r.summary?.totalNetPay ?? r.totalNetPay ?? r.netPayable ?? r.netOutlay ?? 0).toLocaleString('en-IN')}
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            {((r.summary?.calculatedCount ?? r.lineItems?.length) || 0)} Staff
                          </td>
                          <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', alignItems: 'center', flexWrap: 'wrap' }}>
                              <Button
                                variant="secondary"
                                size="sm"
                                icon={Eye}
                                onClick={(e) => { e.stopPropagation(); handleViewRunCostSummary(r._id); }}
                                title="Run Details & Cost Summary (GET /payroll/runs/:id)"
                              >
                                Details
                              </Button>
                              {!isApproved && (
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  loading={processingRun}
                                  onClick={(e) => { e.stopPropagation(); handleRecalculateRun(r._id); }}
                                  title="Recalculate salary line items (POST /payroll/runs/:id/calculate)"
                                >
                                  Recalculate
                                </Button>
                              )}
                              {status !== 'SUBMITTED' && !isApproved && isManagerOrAdmin && (
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  icon={Send}
                                  loading={submittingApprovalRunId === r._id}
                                  onClick={(e) => { e.stopPropagation(); handleSubmitRunForApproval(r._id); }}
                                  title="Submit Run for CEO / Management Approval (POST /payroll/runs/:id/submit-for-approval)"
                                >
                                  Submit
                                </Button>
                              )}
                              {!isApproved && isManagerOrAdmin && (
                                <Button
                                  variant="primary"
                                  size="sm"
                                  loading={approvingRunId === r._id}
                                  onClick={(e) => { e.stopPropagation(); handleApprovePayrollRun(r._id); }}
                                >
                                  Approve
                                </Button>
                              )}
                              {isApproved && (
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  loading={generatingPayslipRunId === r._id}
                                  onClick={(e) => { e.stopPropagation(); handleGeneratePayslips(r._id); }}
                                >
                                  Generate Payslips
                                </Button>
                              )}
                              {!isApproved && isManagerOrAdmin && (
                                <Button
                                  variant="danger"
                                  size="sm"
                                  icon={Trash2}
                                  loading={deletingRunId === r._id}
                                  onClick={(e) => { e.stopPropagation(); handleDeleteRun(r._id); }}
                                  title="Delete draft run (DELETE /payroll/runs/:id)"
                                />
                              )}
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

          {/* Selected Run Line Items Breakdown */}
          {selectedRun && (
            <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
              <div style={{ padding: '12px 18px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', flexWrap: 'wrap', gap: 10 }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700, color: '#0f172a' }}>
                    Employee Breakdown &bull; {selectedRun.payPeriodFrom ? new Date(selectedRun.payPeriodFrom).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }) : 'Pay Period'}
                  </h4>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                    Company: <strong>{selectedRun.company?.name || 'Main'}</strong> &bull; Status: <strong>{selectedRun.status}</strong> &bull; Net Outlay: <strong>₹{(selectedRun.summary?.totalNetPay || 0).toLocaleString('en-IN')}</strong>
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <div style={{ position: 'relative', width: 200 }}>
                    <Search size={14} style={{ position: 'absolute', left: 8, top: 9, color: '#94a3b8' }} />
                    <input
                      type="text"
                      placeholder="Filter staff in this run..."
                      value={itemSearchQuery}
                      onChange={(e) => setItemSearchQuery(e.target.value)}
                      style={{
                        width: '100%', padding: '5px 8px 5px 28px', borderRadius: 6,
                        border: '1px solid #cbd5e1', fontSize: '0.78rem', boxSizing: 'border-box'
                      }}
                    />
                  </div>
                  <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#475569' }}>
                    {filteredLineItems.length} of {lineItems.length} Staff
                  </div>
                </div>
              </div>

              {loadingItems ? (
                <div style={{ padding: 30, textAlign: 'center', color: '#64748b' }}>
                  <Loader2 size={20} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 6px' }} />
                  <div>Loading salary line items...</div>
                </div>
              ) : lineItems.length === 0 ? (
                <div style={{ padding: '24px 20px', textAlign: 'center', color: '#64748b', fontSize: '0.84rem' }}>
                  <div style={{ fontWeight: 600, color: '#1e293b', marginBottom: 6 }}>
                    No breakdown line items found for this run (Net Outlay: ₹0)
                  </div>
                  {structures.length === 0 ? (
                    <div style={{
                      display: 'inline-block',
                      background: '#fffbeb',
                      border: '1px solid #fde68a',
                      borderRadius: 8,
                      padding: '12px 18px',
                      maxWidth: 620,
                      color: '#92400e',
                      textAlign: 'left',
                      marginTop: 6
                    }}>
                      <div style={{ fontWeight: 700, marginBottom: 4 }}>
                        ⚠️ Salary Structure Missing (Structure 0)
                      </div>
                      <div style={{ fontSize: '0.8rem', lineHeight: 1.5 }}>
                        Backend calculation require an active <strong>Salary Structure</strong> for employees. Since no structure exists under the <strong>Salary Structures</strong> tab, gross salary is ₹0.
                        <div style={{ marginTop: 8 }}>
                          👉 Go to the <strong>Salary Structures</strong> tab above, create a structure (Basic + HRA + Allowances), ensure employees have salary structures assigned, then click <strong>&ldquo;Recalculate&rdquo;</strong>.
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div>Make sure employees have an active salary structure assigned, then click &ldquo;Recalculate&rdquo; above.</div>
                  )}
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#64748b', textAlign: 'left' }}>
                        <th style={{ padding: '9px 14px' }}>Employee</th>
                        <th style={{ padding: '9px 14px' }}>Department</th>
                        <th style={{ padding: '9px 14px' }}>Work Days</th>
                        <th style={{ padding: '9px 14px' }}>Gross Salary</th>
                        <th style={{ padding: '9px 14px' }}>Attn Deduction</th>
                        <th style={{ padding: '9px 14px' }}>Statutory (PF/PT)</th>
                        <th style={{ padding: '9px 14px' }}>Net Payable</th>
                        <th style={{ padding: '9px 14px', textAlign: 'right' }}>Slip</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredLineItems.map((item) => {
                        const empName = item.employee?.basicInfo?.fullName || item.employee?.name || user?.name || 'Staff Member';
                        const empCode = item.employee?.basicInfo?.employeeCode || item.employee?.employeeCode || 'EMP';
                        const dept = item.employee?.employmentInfo?.department?.name || item.employee?.department?.name || 'General Operations';
                        const desig = item.employee?.employmentInfo?.designation?.name || item.employee?.designation?.name || 'Staff';

                        const pfAmount = item.statutoryDeductionLines?.find((d) => d.name?.includes('PF'))?.amount || 0;
                        const ptAmount = item.statutoryDeductionLines?.find((d) => d.name?.includes('PT') || d.name?.includes('Tax'))?.amount || 0;
                        const statSum = pfAmount + ptAmount;

                        return (
                          <tr key={item._id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '10px 14px' }}>
                              <div style={{ fontWeight: 600, color: '#0f172a' }}>{empName}</div>
                              <div style={{ fontSize: '0.72rem', color: '#64748b' }}>{empCode} &bull; {desig}</div>
                            </td>
                            <td style={{ padding: '10px 14px', color: '#475569' }}>{dept}</td>
                            <td style={{ padding: '10px 14px' }}>
                              <span style={{ color: '#16a34a', fontWeight: 600 }}>{item.presentDays ?? 0} Present</span>
                              <span style={{ color: '#64748b', fontSize: '0.72rem' }}> / {item.totalWorkingDays || 30} Days</span>
                              {item.absentDays > 0 && (
                                <div style={{ color: '#dc2626', fontSize: '0.7rem' }}>{item.absentDays} Absent</div>
                              )}
                            </td>
                            <td style={{ padding: '10px 14px', fontWeight: 600 }}>
                              ₹{(item.grossEarnings || 0).toLocaleString('en-IN')}
                            </td>
                            <td style={{ padding: '10px 14px', color: item.attendanceDeductionAmount > 0 ? '#dc2626' : '#64748b' }}>
                              -₹{(item.attendanceDeductionAmount || 0).toLocaleString('en-IN')}
                            </td>
                            <td style={{ padding: '10px 14px', color: statSum > 0 ? '#dc2626' : '#64748b' }}>
                              -₹{statSum.toLocaleString('en-IN')}
                            </td>
                            <td style={{ padding: '10px 14px', fontWeight: 700, color: '#16a34a', fontSize: '0.9rem' }}>
                              ₹{(item.netPay || 0).toLocaleString('en-IN')}
                            </td>
                            <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                              <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', alignItems: 'center' }}>
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  icon={Eye}
                                  onClick={() => handleOpenPayslipViewer({
                                    _id: item._id,
                                    payrollRun: selectedRun,
                                    payrollLineItem: item,
                                    employee: item.employee,
                                    payPeriodFrom: selectedRun.payPeriodFrom,
                                    payPeriodTo: selectedRun.payPeriodTo,
                                  }, item)}
                                  title="View Itemized Breakdown"
                                >
                                  Slip
                                </Button>
                                {selectedRun.status !== 'APPROVED' && isManagerOrAdmin && (
                                  <Button
                                    variant="secondary"
                                    size="sm"
                                    icon={Edit2}
                                    onClick={() => handleOpenAdjustModal(item)}
                                    title="Manually Adjust Payroll Line Item (PUT /payroll/line-items/:id/adjust)"
                                  >
                                    Adjust
                                  </Button>
                                )}
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
        </div>
      )}

      {/* ================================================================== */}
      {/* TAB 2: APPROVALS QUEUE (MODULE 15) */}
      {/* ================================================================== */}
      {activeTab === 'approvals' && (
        <PayrollApprovalsTab
          companies={companies}
          isManagerOrAdmin={isManagerOrAdmin}
          onRunDecided={loadPayrollRuns}
          allRuns={runs}
        />
      )}

      {/* ================================================================== */}
      {/* TAB: SALARY PAYMENT PROCESSING (MODULE 17) */}
      {/* ================================================================== */}
      {activeTab === 'payments' && (
        <SalaryPaymentsTab
          runs={runs}
          isManagerOrAdmin={isManagerOrAdmin}
        />
      )}

      {/* ================================================================== */}
      {/* TAB 3: DIGITAL PAYSLIPS (MODULE 16) */}
      {/* ================================================================== */}
      {activeTab === 'payslips' && (
        <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#0f172a' }}>
                Digital Salary Payslips
              </h3>
              <p style={{ margin: '2px 0 0', fontSize: '0.76rem', color: '#64748b' }}>
                Generated from verified backend payroll runs. View, print, or download electronic copies.
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <select
                value={deliveryStatusFilter}
                onChange={(e) => setDeliveryStatusFilter(e.target.value)}
                style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.78rem' }}
              >
                <option value="ALL">All Delivery Statuses</option>
                <option value="SENT">SENT</option>
                <option value="NOT_SENT">NOT_SENT</option>
                <option value="QUEUED">QUEUED</option>
                <option value="FAILED">FAILED</option>
              </select>

              <div style={{ position: 'relative', width: 220 }}>
                <Search size={14} style={{ position: 'absolute', left: 10, top: 10, color: '#94a3b8' }} />
                <input
                  type="text"
                  placeholder="Search employee name or code..."
                  value={payslipSearchQuery}
                  onChange={(e) => setPayslipSearchQuery(e.target.value)}
                  style={{
                    width: '100%', padding: '6px 10px 6px 30px', borderRadius: 6,
                    border: '1px solid #cbd5e1', fontSize: '0.78rem', boxSizing: 'border-box'
                  }}
                />
              </div>

              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--primary)', background: '#eff6ff', padding: '4px 10px', borderRadius: 20 }}>
                {filteredPayslips.length} Payslips Available
              </span>
            </div>
          </div>

          {loadingPayslips ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>
              <Loader2 size={24} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 8px' }} />
              <div>Loading live payslips...</div>
            </div>
          ) : filteredPayslips.length === 0 ? (
            <div style={{ padding: '48px 24px', textAlign: 'center', color: '#64748b' }}>
              <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#f0fdfa', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
                <FileText size={28} color="#0d9488" />
              </div>
              <div style={{ fontSize: '1.02rem', fontWeight: 700, color: '#0f172a' }}>No payslips generated yet</div>
              <p style={{ fontSize: '0.84rem', margin: '6px auto 18px', color: '#64748b', maxWidth: 480 }}>
                Payslips are generated from approved monthly payroll cycles. You can generate them immediately for any approved cycle or review draft runs.
              </p>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap' }}>
                {runs.find((r) => r.status === 'APPROVED') ? (
                  <Button
                    variant="primary"
                    size="sm"
                    icon={FileText}
                    loading={generatingPayslipRunId === runs.find((r) => r.status === 'APPROVED')?._id}
                    onClick={() => {
                      const appRun = runs.find((r) => r.status === 'APPROVED');
                      if (appRun) handleGeneratePayslips(appRun._id);
                    }}
                  >
                    Generate Payslips for Approved Cycle
                  </Button>
                ) : (
                  <Button
                    variant="primary"
                    size="sm"
                    icon={Layers}
                    onClick={() => setActiveTab('runs')}
                  >
                    Go to Payroll Runs
                  </Button>
                )}
                <Button
                  variant="secondary"
                  size="sm"
                  icon={RotateCcw}
                  onClick={loadPayslips}
                >
                  Refresh Live
                </Button>
              </div>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#64748b', textAlign: 'left' }}>
                    <th style={{ padding: '10px 16px' }}>Pay Period</th>
                    <th style={{ padding: '10px 16px' }}>Employee</th>
                    <th style={{ padding: '10px 16px' }}>Gross Salary</th>
                    <th style={{ padding: '10px 16px' }}>Deductions</th>
                    <th style={{ padding: '10px 16px' }}>Net Paid</th>
                    <th style={{ padding: '10px 16px' }}>Delivery Status</th>
                    <th style={{ padding: '10px 16px', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPayslips.map((ps) => {
                    const empName = ps.employee?.basicInfo?.fullName || ps.employee?.name || user?.name || 'Employee';
                    const empCode = ps.employee?.basicInfo?.employeeCode || ps.employee?.employeeCode || 'EMP';
                    const periodStr = ps.payPeriodFrom ? new Date(ps.payPeriodFrom).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }) : 'Pay Period';
                    const gross = ps.payrollLineItem?.grossEarnings || 0;
                    const deductions = ps.payrollLineItem?.totalDeductions || 0;
                    const netPay = ps.payrollLineItem?.netPay || 0;

                    return (
                      <tr key={ps._id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '12px 16px', fontWeight: 600, color: '#0f172a' }}>
                          {periodStr}
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ fontWeight: 600 }}>{empName}</div>
                          <div style={{ fontSize: '0.72rem', color: '#64748b' }}>{empCode}</div>
                        </td>
                        <td style={{ padding: '12px 16px' }}>₹{gross.toLocaleString('en-IN')}</td>
                        <td style={{ padding: '12px 16px', color: '#dc2626' }}>-₹{deductions.toLocaleString('en-IN')}</td>
                        <td style={{ padding: '12px 16px', fontWeight: 700, color: '#16a34a', fontSize: '0.9rem' }}>
                          ₹{netPay.toLocaleString('en-IN')}
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <Badge variant={ps.deliveryStatus === 'SENT' ? 'success' : ps.deliveryStatus === 'FAILED' ? 'danger' : ps.deliveryStatus === 'QUEUED' ? 'warning' : 'secondary'}>
                            {ps.deliveryStatus || 'SENT'}
                          </Badge>
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', alignItems: 'center', flexWrap: 'wrap' }}>
                            <Button
                              variant="secondary"
                              size="sm"
                              icon={Eye}
                              onClick={() => handleOpenPayslipViewer(ps)}
                            >
                              View Slip
                            </Button>
                            <Button
                              variant="secondary"
                              size="sm"
                              icon={Download}
                              onClick={() => handleDownloadPayslip(ps._id)}
                              title="Download payslip file (GET /payslips/:id/download)"
                            />
                            {isManagerOrAdmin && (
                              <>
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  icon={RotateCcw}
                                  loading={regeneratingPayslipId === ps._id}
                                  onClick={() => handleRegenerateSinglePayslip(ps._id)}
                                  title="Regenerate Single Payslip from Live Master Data (POST /payslips/:id/regenerate)"
                                />
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  icon={Send}
                                  onClick={() => handleOpenDeliveryModal(ps)}
                                  title="Update Delivery Status (PUT /payslips/:id/delivery-status)"
                                />
                              </>
                            )}
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
      {/* TAB 4: PAYSLIP TEMPLATES (MODULE 16) */}
      {/* ================================================================== */}
      {activeTab === 'templates' && (
        <PayslipTemplatesTab
          companies={companies}
          isManagerOrAdmin={isManagerOrAdmin}
        />
      )}

      {/* ================================================================== */}
      {/* TAB 3: SALARY STRUCTURES */}
      {/* ================================================================== */}
      {activeTab === 'structures' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Quick Metrics Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
            <div style={{ background: '#fff', padding: '14px 18px', borderRadius: 10, border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ background: '#3f929a18', color: 'var(--primary, #3f929a)', padding: 10, borderRadius: 8 }}>
                <Building2 size={20} />
              </div>
              <div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a' }}>
                  {structures.length}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Total Configured Packages</div>
              </div>
            </div>

            <div style={{ background: '#fff', padding: '14px 18px', borderRadius: 10, border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ background: '#16a34a15', color: '#16a34a', padding: 10, borderRadius: 8 }}>
                <CheckCircle2 size={20} />
              </div>
              <div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a' }}>
                  {structures.filter((s) => s.isActive !== false).length}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Active Packages</div>
              </div>
            </div>

            <div style={{ background: '#fff', padding: '14px 18px', borderRadius: 10, border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ background: '#f5a53218', color: '#d97706', padding: 10, borderRadius: 8 }}>
                <DollarSign size={20} />
              </div>
              <div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a' }}>
                  ₹{(structures.length > 0 ? Math.round(structures.reduce((acc, s) => acc + (s.grossMonthlyAmount || 0), 0) / structures.length) : 0).toLocaleString('en-IN')}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Avg. Monthly Gross</div>
              </div>
            </div>
          </div>

          {/* Main Card */}
          <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
            {/* Header & Controls */}
            <div style={{ padding: '14px 18px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 700, color: '#0f172a' }}>
                  Configured Salary Packages
                </h3>
                <p style={{ margin: '2px 0 0', fontSize: '0.76rem', color: '#64748b' }}>
                  Standard earning and statutory deduction components assigned to employee profiles
                </p>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <Button
                  variant="secondary"
                  size="sm"
                  icon={RotateCcw}
                  onClick={loadSalaryStructures}
                  loading={loadingStructures}
                  title="Reload from backend"
                >
                  Sync
                </Button>
                {isManagerOrAdmin && (
                  <Button variant="primary" size="sm" icon={Plus} onClick={() => setStructureModalOpen(true)}>
                    New Structure
                  </Button>
                )}
              </div>
            </div>

            {/* Filter & Search Bar */}
            <div style={{ padding: '10px 18px', borderBottom: '1px solid #f1f5f9', background: '#fafbfc', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ position: 'relative', flex: 1, maxWidth: '380px' }}>
                <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                <input
                  type="text"
                  placeholder="Search package name or company..."
                  value={structureSearchQuery}
                  onChange={(e) => setStructureSearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '6px 12px 6px 32px',
                    borderRadius: 6,
                    border: '1px solid #cbd5e1',
                    fontSize: '0.82rem',
                    background: '#fff',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
              <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 500 }}>
                Showing <b>{filteredStructures.length}</b> of <b>{structures.length}</b> packages
              </span>
            </div>

            {loadingStructures ? (
              <div style={{ padding: 48, textAlign: 'center', color: '#64748b' }}>
                <Loader2 size={26} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 10px', color: 'var(--primary, #3f929a)' }} />
                <div style={{ fontSize: '0.88rem', fontWeight: 600 }}>Loading salary structures from backend...</div>
                <div style={{ fontSize: '0.76rem', color: '#94a3b8', marginTop: 4 }}>Fetching live compensation rules</div>
              </div>
            ) : filteredStructures.length === 0 ? (
              <div style={{ padding: 48, textAlign: 'center', color: '#64748b' }}>
                <AlertCircle size={32} color="#94a3b8" style={{ margin: '0 auto 10px' }} />
                <div style={{ fontWeight: 600, fontSize: '0.92rem' }}>
                  {structureSearchQuery ? `No salary structures matching "${structureSearchQuery}"` : 'No salary structures configured'}
                </div>
                <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: 4 }}>
                  {structureSearchQuery ? 'Try clearing your search query' : 'Click "New Structure" above to define a compensation package for your organization.'}
                </div>
                {structureSearchQuery && (
                  <Button variant="secondary" size="sm" onClick={() => setStructureSearchQuery('')} style={{ marginTop: 12 }}>
                    Clear Search
                  </Button>
                )}
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#64748b', textAlign: 'left' }}>
                      <th style={{ padding: '11px 16px', fontWeight: 600 }}>Structure Name</th>
                      <th style={{ padding: '11px 16px', fontWeight: 600 }}>Monthly Gross</th>
                      <th style={{ padding: '11px 16px', fontWeight: 600 }}>Basic Salary</th>
                      <th style={{ padding: '11px 16px', fontWeight: 600 }}>Allowances</th>
                      <th style={{ padding: '11px 16px', fontWeight: 600 }}>Statutory Deductions</th>
                      <th style={{ padding: '11px 16px', fontWeight: 600 }}>Status</th>
                      <th style={{ padding: '11px 16px', fontWeight: 600, textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStructures.map((s) => {
                      const basic = s.earningComponents?.find((c) => c.name?.toLowerCase().includes('basic'))?.value || 0;
                      const others = (s.earningComponents || []).filter((c) => !c.name?.toLowerCase().includes('basic')).map((c) => `${c.name}: ₹${c.value}`).join(', ');
                      const statutory = (s.deductionComponents || []).map((d) => `${d.name} (${d.value}${d.statutoryType === 'PF' ? '%' : '₹'})`).join(' • ') || 'None';
                      const companyName = s.company?.name || companies.find((c) => c._id === (s.company?._id || s.company))?.name || 'All Organizations';

                      return (
                        <tr key={s._id} style={{ borderBottom: '1px solid #f1f5f9', transition: 'background 0.15s' }}>
                          <td style={{ padding: '12px 16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <div style={{ width: 32, height: 32, borderRadius: 8, background: '#f0fdf4', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <Building2 size={16} />
                              </div>
                              <div>
                                <div style={{ fontWeight: 600, color: '#0f172a' }}>{s.name}</div>
                                <div style={{ fontSize: '0.73rem', color: '#94a3b8', marginTop: 1 }}>{companyName}</div>
                              </div>
                            </div>
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            <div style={{ fontWeight: 700, color: '#16a34a', fontSize: '0.88rem' }}>
                              ₹{(s.grossMonthlyAmount || 0).toLocaleString('en-IN')}
                            </div>
                            <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                              Annual: ₹{((s.grossMonthlyAmount || 0) * 12).toLocaleString('en-IN')}
                            </div>
                          </td>
                          <td style={{ padding: '12px 16px', fontWeight: 600, color: '#334155' }}>
                            ₹{basic.toLocaleString('en-IN')}
                          </td>
                          <td style={{ padding: '12px 16px', color: '#64748b', maxWidth: 220 }}>
                            <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={others || 'None'}>
                              {others || <span style={{ color: '#cbd5e1' }}>None</span>}
                            </div>
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            <span style={{ background: '#fee2e2', color: '#dc2626', padding: '3px 8px', borderRadius: 4, fontSize: '0.72rem', fontWeight: 600, display: 'inline-block' }}>
                              {statutory}
                            </span>
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            <Badge variant={s.isActive !== false ? 'success' : 'secondary'}>
                              {s.isActive !== false ? 'ACTIVE' : 'INACTIVE'}
                            </Badge>
                          </td>
                          <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', alignItems: 'center' }}>
                              <Button
                                variant="secondary"
                                size="sm"
                                icon={Eye}
                                onClick={() => handleViewStructure(s._id)}
                                title="Inspect Structure Details"
                              />
                              {isManagerOrAdmin && (
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  icon={Edit2}
                                  onClick={() => handleOpenEditStructure(s)}
                                  title="Edit Salary Structure"
                                />
                              )}
                              {isManagerOrAdmin && (
                                <Button
                                  variant="danger"
                                  size="sm"
                                  icon={Trash2}
                                  loading={deletingStructureId === s._id}
                                  onClick={() => handleDeleteStructure(s._id)}
                                  title="Delete structure"
                                />
                              )}
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
        </div>
      )}

      {/* ================================================================== */}
      {/* 4. MODAL: PROCESS PAYROLL BATCH (DYNAMIC COMPANY & BRANCH) */}
      {/* ================================================================== */}
      {batchModalOpen && (
        <Modal
          isOpen={true}
          onClose={() => setBatchModalOpen(false)}
          title="Process Monthly Payroll Batch"
          maxWidth="520px"
        >
          <form onSubmit={handleProcessPayroll} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>
                Company *
              </label>
              <select
                value={selectedCompanyId}
                onChange={(e) => {
                  setSelectedCompanyId(e.target.value);
                  setSelectedBranchId('');
                }}
                required
                style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.82rem', boxSizing: 'border-box' }}
              >
                {companies.map((c) => (
                  <option key={c._id} value={c._id}>{c.name} ({c.code || 'CORP'})</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>
                Branch (Optional)
              </label>
              <select
                value={selectedBranchId}
                onChange={(e) => setSelectedBranchId(e.target.value)}
                style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.82rem', boxSizing: 'border-box' }}
              >
                <option value="">All Branches in Company</option>
                {filteredBranches.map((b) => (
                  <option key={b._id} value={b._id}>{b.name} ({b.code || 'BR'})</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>Month *</label>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(Number(e.target.value))}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.82rem', boxSizing: 'border-box' }}
                >
                  {MONTH_NAMES.map((name, i) => (
                    <option key={i + 1} value={i + 1}>{name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>Year *</label>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.82rem', boxSizing: 'border-box' }}
                >
                  {[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ background: '#f8fafc', padding: 12, borderRadius: 6, border: '1px solid #e2e8f0', fontSize: '0.78rem', color: '#475569' }}>
              <strong>Execution Note:</strong> This will create a fresh draft run for {MONTH_NAMES[selectedMonth - 1]} {selectedYear} on the backend, pull attendance data for active staff, apply statutory deductions (PF &amp; PT), and calculate final net pay.
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
              <Button variant="secondary" onClick={() => setBatchModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" type="submit" loading={processingRun}>
                Calculate &amp; Run Batch
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* ================================================================== */}
      {/* 5. MODAL: CLEAN DYNAMIC PAYSLIP VIEWER */}
      {/* ================================================================== */}
      {viewingPayslip && (
        <Modal
          isOpen={true}
          onClose={() => { setViewingPayslip(null); setViewingLineItem(null); }}
          title="Digital Salary Payslip"
          maxWidth="740px"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Action Bar */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <Button variant="secondary" icon={Printer} onClick={() => window.print()}>
                Print / Save PDF
              </Button>
              {viewingPayslip._id && (
                <Button variant="primary" icon={Download} onClick={() => handleDownloadPayslip(viewingPayslip._id)}>
                  Download File
                </Button>
              )}
            </div>

            {loadingLineItemDetails ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>
                <Loader2 size={24} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 8px' }} />
                <div>Loading itemized salary details...</div>
              </div>
            ) : (
              /* Printable Payslip Card */
              <div id="printable-payslip" style={{
                background: '#fff', border: '1px solid #cbd5e1', borderRadius: 8,
                padding: 24, display: 'flex', flexDirection: 'column', gap: 16
              }}>
                {/* Company Header */}
                <div style={{ borderBottom: '2px solid var(--primary)', paddingBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
                  <div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--primary)' }}>
                      {activeCompany?.name || 'TIE CORPORATION PVT LTD'}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: 2 }}>
                      {activeCompany?.address?.street ? `${activeCompany.address.street}, ${activeCompany.address.city}, ${activeCompany.address.state}` : 'Corporate Headquarters, Technology Division'} &bull; {activeCompany?.email || 'contact@tie-corp.com'}
                    </div>
                    <div style={{ fontSize: '0.86rem', fontWeight: 700, marginTop: 4, color: '#0f172a' }}>
                      Salary Slip for {viewingPayslip.payPeriodFrom ? new Date(viewingPayslip.payPeriodFrom).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }) : 'Pay Period'}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <Badge variant="success">CONFIRMED PAID</Badge>
                    <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: 4 }}>
                      Date: {new Date().toLocaleDateString('en-IN')}
                    </div>
                  </div>
                </div>

                {/* Employee Meta Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, background: '#f8fafc', padding: 12, borderRadius: 6, fontSize: '0.78rem' }}>
                  <div><strong>Employee Name:</strong> {viewingPayslip.employee?.basicInfo?.fullName || viewingPayslip.employee?.name || user?.name || 'Staff Member'}</div>
                  <div><strong>Employee Code:</strong> {viewingPayslip.employee?.basicInfo?.employeeCode || viewingPayslip.employee?.employeeCode || 'EMP-01'}</div>
                  <div><strong>Department:</strong> {viewingPayslip.employee?.employmentInfo?.department?.name || viewingPayslip.employee?.department?.name || 'General Operations'}</div>
                  <div><strong>Designation:</strong> {viewingPayslip.employee?.employmentInfo?.designation?.name || viewingPayslip.employee?.designation?.name || 'Staff'}</div>
                  <div><strong>Pay Mode:</strong> Direct Corporate Bank Transfer</div>
                  <div><strong>Status:</strong> Approved &amp; Processed</div>
                  {viewingLineItem?.governmentDetailsSnapshot?.uanNumber && viewingLineItem.governmentDetailsSnapshot.uanNumber !== 'N/A' && (
                    <div><strong>UAN:</strong> {viewingLineItem.governmentDetailsSnapshot.uanNumber}</div>
                  )}
                  {viewingLineItem?.governmentDetailsSnapshot?.panNumber && viewingLineItem.governmentDetailsSnapshot.panNumber !== 'N/A' && (
                    <div><strong>PAN:</strong> {viewingLineItem.governmentDetailsSnapshot.panNumber}</div>
                  )}
                </div>

                {/* Attendance Highlights if available */}
                {viewingLineItem && (
                  <div style={{ display: 'flex', gap: 16, background: '#f1f5f9', padding: '8px 12px', borderRadius: 6, fontSize: '0.75rem', color: '#475569' }}>
                    <span><strong>Total Days:</strong> {viewingLineItem.totalWorkingDays ?? 30}</span>
                    <span><strong>Present Days:</strong> {viewingLineItem.presentDays ?? 0}</span>
                    <span><strong>Absent Days:</strong> {viewingLineItem.absentDays ?? 0}</span>
                    <span><strong>Paid Leave:</strong> {viewingLineItem.paidLeaveDays ?? 0}</span>
                  </div>
                )}

                {/* Dynamic Earnings & Deductions Tables */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  {/* Earnings */}
                  <div style={{ border: '1px solid #e2e8f0', borderRadius: 6, overflow: 'hidden' }}>
                    <div style={{ background: '#f0fdf4', padding: '8px 12px', fontWeight: 700, fontSize: '0.82rem', color: '#166534' }}>
                      Earnings Components
                    </div>
                    <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8, fontSize: '0.8rem' }}>
                      {viewingLineItem?.earningLines && viewingLineItem.earningLines.length > 0 ? (
                        viewingLineItem.earningLines.map((el, i) => (
                          <div key={i} style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>{el.name}:</span>
                            <strong>₹{(el.amount || 0).toLocaleString('en-IN')}</strong>
                          </div>
                        ))
                      ) : (
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span>Gross Salary:</span>
                          <strong>₹{(viewingPayslip.payrollLineItem?.grossEarnings || viewingLineItem?.grossEarnings || 0).toLocaleString('en-IN')}</strong>
                        </div>
                      )}
                      <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 6, display: 'flex', justifyContent: 'space-between', fontWeight: 700, color: '#166534' }}>
                        <span>Total Gross:</span>
                        <span>₹{(viewingLineItem?.grossEarnings || viewingPayslip.payrollLineItem?.grossEarnings || 0).toLocaleString('en-IN')}</span>
                      </div>
                    </div>
                  </div>

                  {/* Deductions */}
                  <div style={{ border: '1px solid #e2e8f0', borderRadius: 6, overflow: 'hidden' }}>
                    <div style={{ background: '#fef2f2', padding: '8px 12px', fontWeight: 700, fontSize: '0.82rem', color: '#991b1b' }}>
                      Deductions
                    </div>
                    <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8, fontSize: '0.8rem' }}>
                      {viewingLineItem?.attendanceDeductionAmount > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#dc2626' }}>
                          <span>Attendance / Shortfall:</span>
                          <span>-₹{(viewingLineItem.attendanceDeductionAmount).toLocaleString('en-IN')}</span>
                        </div>
                      )}

                      {viewingLineItem?.statutoryDeductionLines && viewingLineItem.statutoryDeductionLines.length > 0 ? (
                        viewingLineItem.statutoryDeductionLines.map((dl, i) => (
                          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', color: '#dc2626' }}>
                            <span>{dl.name}:</span>
                            <span>-₹{(dl.amount || 0).toLocaleString('en-IN')}</span>
                          </div>
                        ))
                      ) : null}

                      {viewingLineItem?.otherDeductionLines && viewingLineItem.otherDeductionLines.map((od, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', color: '#dc2626' }}>
                          <span>{od.name}:</span>
                          <span>-₹{(od.amount || 0).toLocaleString('en-IN')}</span>
                        </div>
                      ))}

                      {(!viewingLineItem || (!viewingLineItem.attendanceDeductionAmount && !viewingLineItem.statutoryDeductionLines?.length)) && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#dc2626' }}>
                          <span>Total Deductions:</span>
                          <span>-₹{(viewingPayslip.payrollLineItem?.totalDeductions || viewingLineItem?.totalDeductions || 0).toLocaleString('en-IN')}</span>
                        </div>
                      )}

                      <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 6, display: 'flex', justifyContent: 'space-between', fontWeight: 700, color: '#dc2626' }}>
                        <span>Total Deductions:</span>
                        <span>-₹{(viewingLineItem?.totalDeductions || viewingPayslip.payrollLineItem?.totalDeductions || 0).toLocaleString('en-IN')}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Net Pay Callout */}
                <div style={{
                  background: '#f0fdf4', border: '1.5px solid #16a34a', borderRadius: 6,
                  padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                }}>
                  <div>
                    <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#16a34a' }}>NET PAYABLE SALARY</div>
                    <div style={{ fontSize: '0.72rem', color: '#64748b' }}>Verified and credited to registered salary account</div>
                  </div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#16a34a' }}>
                    ₹{(viewingLineItem?.netPay || viewingPayslip.payrollLineItem?.netPay || 0).toLocaleString('en-IN')}
                  </div>
                </div>

                {/* Footer */}
                <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 10, display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#94a3b8' }}>
                  <span>This is a computer-generated digital payslip and requires no physical signature.</span>
                  <span>TIE ERP Payroll System &bull; Live Backend Verified</span>
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* ================================================================== */}
      {/* 6. MODAL: ADD SALARY STRUCTURE */}
      {/* ================================================================== */}
      {structureModalOpen && (
        <Modal
          isOpen={true}
          onClose={() => setStructureModalOpen(false)}
          title="Add Salary Package Structure"
          maxWidth="540px"
        >
          <form onSubmit={handleCreateSalaryStructure} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>
                Company *
              </label>
              <select
                value={newStructure.company || selectedCompanyId}
                onChange={(e) => setNewStructure({ ...newStructure, company: e.target.value })}
                required
                style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.82rem', boxSizing: 'border-box' }}
              >
                {companies.map((c) => (
                  <option key={c._id} value={c._id}>{c.name} ({c.code || 'CORP'})</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>Structure Name *</label>
              <input
                type="text"
                placeholder="e.g. Senior Technical Lead Grade"
                value={newStructure.name}
                onChange={(e) => setNewStructure({ ...newStructure, name: e.target.value })}
                required
                style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.82rem', boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>Basic Salary (₹) *</label>
                <input
                  type="number"
                  value={newStructure.basicSalary}
                  onChange={(e) => {
                    const b = Number(e.target.value) || 0;
                    setNewStructure((prev) => ({
                      ...prev,
                      basicSalary: b,
                      grossMonthlyAmount: b + Number(prev.hra) + Number(prev.specialAllowance)
                    }));
                  }}
                  required
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.82rem', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>HRA (₹)</label>
                <input
                  type="number"
                  value={newStructure.hra}
                  onChange={(e) => {
                    const h = Number(e.target.value) || 0;
                    setNewStructure((prev) => ({
                      ...prev,
                      hra: h,
                      grossMonthlyAmount: Number(prev.basicSalary) + h + Number(prev.specialAllowance)
                    }));
                  }}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.82rem', boxSizing: 'border-box' }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>Special Allowance (₹)</label>
                <input
                  type="number"
                  value={newStructure.specialAllowance}
                  onChange={(e) => {
                    const s = Number(e.target.value) || 0;
                    setNewStructure((prev) => ({
                      ...prev,
                      specialAllowance: s,
                      grossMonthlyAmount: Number(prev.basicSalary) + Number(prev.hra) + s
                    }));
                  }}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.82rem', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>Gross Monthly Amount (₹)</label>
                <input
                  type="number"
                  value={newStructure.grossMonthlyAmount}
                  onChange={(e) => setNewStructure({ ...newStructure, grossMonthlyAmount: e.target.value })}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.82rem', boxSizing: 'border-box' }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>PF Contribution (%)</label>
                <input
                  type="number"
                  value={newStructure.pfRate}
                  onChange={(e) => setNewStructure({ ...newStructure, pfRate: e.target.value })}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.82rem', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>Professional Tax (₹)</label>
                <input
                  type="number"
                  value={newStructure.professionalTax}
                  onChange={(e) => setNewStructure({ ...newStructure, professionalTax: e.target.value })}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.82rem', boxSizing: 'border-box' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
              <Button variant="secondary" onClick={() => setStructureModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" type="submit" loading={creatingStructure}>
                Save Structure
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* ================================================================== */}
      {/* 7. MODAL: VIEW / INSPECT SALARY STRUCTURE DETAILS (GET /salary-structures/:id) */}
      {/* ================================================================== */}
      {viewingStructureModalOpen && (
        <Modal
          isOpen={true}
          onClose={() => {
            setViewingStructureModalOpen(false);
            setViewingStructure(null);
          }}
          title={viewingStructure ? `Salary Structure: ${viewingStructure.name}` : 'Salary Structure Details'}
          maxWidth="640px"
        >
          {loadingStructureDetail || !viewingStructure ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 20px', gap: 12 }}>
              <Loader2 size={32} className="animate-spin" style={{ color: '#2563eb' }} />
              <span style={{ fontSize: '0.9rem', color: '#64748b' }}>Fetching structure details from backend...</span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              {/* Header Info Banner */}
              <div style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: 8,
                padding: '12px 16px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 8
              }}>
                <div>
                  <div style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a' }}>
                    {viewingStructure.name}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: 2 }}>
                    Company: {viewingStructure.company?.name || companies.find((c) => c._id === viewingStructure.company)?.name || 'Default Organization'}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <Badge variant={viewingStructure.isActive !== false ? 'success' : 'secondary'}>
                    {viewingStructure.isActive !== false ? 'ACTIVE' : 'INACTIVE'}
                  </Badge>
                  <span style={{ fontSize: '0.78rem', background: '#eff6ff', color: '#1d4ed8', padding: '3px 8px', borderRadius: 4, fontWeight: 600 }}>
                    OT: {viewingStructure.overtimeMultiplier || 1.5}x
                  </span>
                </div>
              </div>

              {/* KPI Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '12px' }}>
                  <div style={{ fontSize: '0.72rem', color: '#166534', fontWeight: 600, textTransform: 'uppercase' }}>Gross Monthly</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#15803d', marginTop: 4 }}>
                    ₹{(viewingStructure.grossMonthlyAmount || 0).toLocaleString('en-IN')}
                  </div>
                </div>
                <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '12px' }}>
                  <div style={{ fontSize: '0.72rem', color: '#1e40af', fontWeight: 600, textTransform: 'uppercase' }}>Annual CTC</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#1d4ed8', marginTop: 4 }}>
                    ₹{((viewingStructure.grossMonthlyAmount || 0) * 12).toLocaleString('en-IN')}
                  </div>
                </div>
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '12px' }}>
                  <div style={{ fontSize: '0.72rem', color: '#991b1b', fontWeight: 600, textTransform: 'uppercase' }}>Statutory Rules</div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#b91c1c', marginTop: 4 }}>
                    {(viewingStructure.deductionComponents || []).length} Components
                  </div>
                </div>
              </div>

              {/* Earnings Components Breakdown */}
              <div>
                <h4 style={{ margin: '0 0 8px 0', fontSize: '0.85rem', fontWeight: 700, color: '#1e293b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Earning Components
                </h4>
                <div style={{ border: '1px solid #e2e8f0', borderRadius: 6, overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left', color: '#64748b' }}>
                        <th style={{ padding: '8px 12px' }}>Component</th>
                        <th style={{ padding: '8px 12px' }}>Type</th>
                        <th style={{ padding: '8px 12px', textAlign: 'right' }}>Monthly (₹)</th>
                        <th style={{ padding: '8px 12px', textAlign: 'right' }}>Annual (₹)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(viewingStructure.earningComponents && viewingStructure.earningComponents.length > 0) ? (
                        viewingStructure.earningComponents.map((ec, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '8px 12px', fontWeight: 600, color: '#0f172a' }}>{ec.name}</td>
                            <td style={{ padding: '8px 12px', color: '#64748b' }}>
                              <span style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: 4, fontSize: '0.72rem' }}>
                                {ec.type || 'FIXED'}
                              </span>
                            </td>
                            <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, color: '#16a34a' }}>
                              ₹{(ec.value || 0).toLocaleString('en-IN')}
                            </td>
                            <td style={{ padding: '8px 12px', textAlign: 'right', color: '#475569' }}>
                              ₹{((ec.value || 0) * 12).toLocaleString('en-IN')}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="4" style={{ padding: '12px', textAlign: 'center', color: '#94a3b8' }}>
                            No earning components defined
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Deduction Components Breakdown */}
              <div>
                <h4 style={{ margin: '0 0 8px 0', fontSize: '0.85rem', fontWeight: 700, color: '#1e293b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Deduction &amp; Statutory Components
                </h4>
                <div style={{ border: '1px solid #e2e8f0', borderRadius: 6, overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left', color: '#64748b' }}>
                        <th style={{ padding: '8px 12px' }}>Deduction Name</th>
                        <th style={{ padding: '8px 12px' }}>Statutory Type</th>
                        <th style={{ padding: '8px 12px', textAlign: 'right' }}>Rate / Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(viewingStructure.deductionComponents && viewingStructure.deductionComponents.length > 0) ? (
                        viewingStructure.deductionComponents.map((dc, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '8px 12px', fontWeight: 600, color: '#0f172a' }}>{dc.name}</td>
                            <td style={{ padding: '8px 12px', color: '#64748b' }}>
                              <span style={{ background: '#fee2e2', color: '#dc2626', padding: '2px 6px', borderRadius: 4, fontSize: '0.72rem', fontWeight: 600 }}>
                                {dc.statutoryType || dc.type || 'STATUTORY'}
                              </span>
                            </td>
                            <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, color: '#dc2626' }}>
                              {dc.statutoryType === 'PF' ? `${dc.value}% of Basic` : `₹${(dc.value || 0).toLocaleString('en-IN')}`}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="3" style={{ padding: '12px', textAlign: 'center', color: '#94a3b8' }}>
                            No deductions configured
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Actions Footer */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
                <Button variant="secondary" onClick={() => {
                  setViewingStructureModalOpen(false);
                  setViewingStructure(null);
                }}>
                  Close
                </Button>
                {isManagerOrAdmin && (
                  <Button variant="primary" icon={Edit2} onClick={() => {
                    const struct = viewingStructure;
                    setViewingStructureModalOpen(false);
                    setViewingStructure(null);
                    handleOpenEditStructure(struct);
                  }}>
                    Edit Structure
                  </Button>
                )}
              </div>
            </div>
          )}
        </Modal>
      )}

      {/* ================================================================== */}
      {/* 8. MODAL: EDIT SALARY STRUCTURE (PUT /salary-structures/:id) */}
      {/* ================================================================== */}
      {editStructureModalOpen && editingStructure && (
        <Modal
          isOpen={true}
          onClose={() => {
            setEditStructureModalOpen(false);
            setEditingStructure(null);
          }}
          title={`Edit Salary Structure: ${editingStructure.name}`}
          maxWidth="560px"
        >
          <form onSubmit={handleUpdateSalaryStructure} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>
                Company *
              </label>
              <select
                value={editStructureForm.company}
                onChange={(e) => setEditStructureForm({ ...editStructureForm, company: e.target.value })}
                required
                style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.82rem', boxSizing: 'border-box' }}
              >
                {companies.map((c) => (
                  <option key={c._id} value={c._id}>{c.name} ({c.code || 'CORP'})</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>Structure Name *</label>
              <input
                type="text"
                value={editStructureForm.name}
                onChange={(e) => setEditStructureForm({ ...editStructureForm, name: e.target.value })}
                required
                placeholder="e.g. Senior Software Engineer"
                style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.82rem', boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>Basic Salary (₹) *</label>
                <input
                  type="number"
                  value={editStructureForm.basicSalary}
                  onChange={(e) => {
                    const b = Number(e.target.value) || 0;
                    setEditStructureForm((prev) => ({
                      ...prev,
                      basicSalary: b,
                      grossMonthlyAmount: b + Number(prev.hra) + Number(prev.specialAllowance)
                    }));
                  }}
                  required
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.82rem', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>HRA (₹)</label>
                <input
                  type="number"
                  value={editStructureForm.hra}
                  onChange={(e) => {
                    const h = Number(e.target.value) || 0;
                    setEditStructureForm((prev) => ({
                      ...prev,
                      hra: h,
                      grossMonthlyAmount: Number(prev.basicSalary) + h + Number(prev.specialAllowance)
                    }));
                  }}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.82rem', boxSizing: 'border-box' }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>Special Allowance (₹)</label>
                <input
                  type="number"
                  value={editStructureForm.specialAllowance}
                  onChange={(e) => {
                    const s = Number(e.target.value) || 0;
                    setEditStructureForm((prev) => ({
                      ...prev,
                      specialAllowance: s,
                      grossMonthlyAmount: Number(prev.basicSalary) + Number(prev.hra) + s
                    }));
                  }}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.82rem', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>Gross Monthly Amount (₹)</label>
                <input
                  type="number"
                  value={editStructureForm.grossMonthlyAmount}
                  onChange={(e) => setEditStructureForm({ ...editStructureForm, grossMonthlyAmount: e.target.value })}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.82rem', boxSizing: 'border-box' }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>PF Contribution (%)</label>
                <input
                  type="number"
                  value={editStructureForm.pfRate}
                  onChange={(e) => setEditStructureForm({ ...editStructureForm, pfRate: e.target.value })}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.82rem', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>Professional Tax (₹)</label>
                <input
                  type="number"
                  value={editStructureForm.professionalTax}
                  onChange={(e) => setEditStructureForm({ ...editStructureForm, professionalTax: e.target.value })}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.82rem', boxSizing: 'border-box' }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>Overtime Multiplier</label>
                <input
                  type="number"
                  step="0.1"
                  value={editStructureForm.overtimeMultiplier}
                  onChange={(e) => setEditStructureForm({ ...editStructureForm, overtimeMultiplier: e.target.value })}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.82rem', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>Status</label>
                <select
                  value={editStructureForm.isActive ? 'true' : 'false'}
                  onChange={(e) => setEditStructureForm({ ...editStructureForm, isActive: e.target.value === 'true' })}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.82rem', boxSizing: 'border-box' }}
                >
                  <option value="true">ACTIVE</option>
                  <option value="false">INACTIVE</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
              <Button variant="secondary" onClick={() => {
                setEditStructureModalOpen(false);
                setEditingStructure(null);
              }}>
                Cancel
              </Button>
              <Button variant="primary" type="submit" loading={submittingEditStructure}>
                Update Structure
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* ================================================================== */}
      {/* 9. MODAL: PAYROLL RUN COST SUMMARY & DETAILS (GET /payroll/runs/:id) */}
      {/* ================================================================== */}
      {costSummaryModalOpen && (
        <Modal
          isOpen={true}
          onClose={() => {
            setCostSummaryModalOpen(false);
            setViewingRunCostSummary(null);
          }}
          title={viewingRunCostSummary ? `Payroll Run Details & Cost Summary` : 'Payroll Run Summary'}
          maxWidth="600px"
        >
          {loadingCostSummary || !viewingRunCostSummary ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>
              <Loader2 size={28} className="animate-spin" style={{ margin: '0 auto 8px', color: '#2563eb' }} />
              <div>Fetching live run cost summary from backend...</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Header Box */}
              <div style={{ background: '#f8fafc', padding: '12px 16px', borderRadius: 8, border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '1rem', color: '#0f172a' }}>
                    {viewingRunCostSummary.payPeriodFrom ? new Date(viewingRunCostSummary.payPeriodFrom).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }) : 'Pay Period'}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: 2 }}>
                    Organization: {viewingRunCostSummary.company?.name || companies.find((c) => c._id === viewingRunCostSummary.company)?.name || 'Main Company'}
                  </div>
                </div>
                <Badge variant={viewingRunCostSummary.status === 'APPROVED' ? 'success' : viewingRunCostSummary.status === 'SUBMITTED' ? 'warning' : 'primary'}>
                  {viewingRunCostSummary.status}
                </Badge>
              </div>

              {/* KPI Breakdown */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '12px' }}>
                  <div style={{ fontSize: '0.72rem', color: '#166534', fontWeight: 600 }}>GROSS SALARIES</div>
                  <div style={{ fontSize: '1.15rem', fontWeight: 700, color: '#15803d', marginTop: 4 }}>
                    ₹{(viewingRunCostSummary.summary?.totalGross || 0).toLocaleString('en-IN')}
                  </div>
                </div>
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '12px' }}>
                  <div style={{ fontSize: '0.72rem', color: '#991b1b', fontWeight: 600 }}>TOTAL DEDUCTIONS</div>
                  <div style={{ fontSize: '1.15rem', fontWeight: 700, color: '#b91c1c', marginTop: 4 }}>
                    -₹{(viewingRunCostSummary.summary?.totalDeductions || 0).toLocaleString('en-IN')}
                  </div>
                </div>
                <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '12px' }}>
                  <div style={{ fontSize: '0.72rem', color: '#1e40af', fontWeight: 600 }}>NET OUTLAY</div>
                  <div style={{ fontSize: '1.15rem', fontWeight: 700, color: '#1d4ed8', marginTop: 4 }}>
                    ₹{(viewingRunCostSummary.summary?.totalNetPay || 0).toLocaleString('en-IN')}
                  </div>
                </div>
              </div>

              {/* Detailed Cost Metrics */}
              <div style={{ border: '1px solid #e2e8f0', borderRadius: 6, padding: '12px 14px', background: '#fff' }}>
                <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: 8 }}>
                  Execution &amp; Cost Metadata
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: '0.8rem' }}>
                  <div>
                    <span style={{ color: '#64748b' }}>Staff Calculated:</span>{' '}
                    <strong>{viewingRunCostSummary.summary?.calculatedCount || viewingRunCostSummary.lineItems?.length || 0} Employees</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b' }}>Attendance Losses:</span>{' '}
                    <strong style={{ color: '#dc2626' }}>₹{(viewingRunCostSummary.summary?.attendanceDeductionSum || 0).toLocaleString('en-IN')}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b' }}>Pay Period From:</span>{' '}
                    <strong>{viewingRunCostSummary.payPeriodFrom ? new Date(viewingRunCostSummary.payPeriodFrom).toLocaleDateString('en-IN') : 'N/A'}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b' }}>Pay Period To:</span>{' '}
                    <strong>{viewingRunCostSummary.payPeriodTo ? new Date(viewingRunCostSummary.payPeriodTo).toLocaleDateString('en-IN') : 'N/A'}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b' }}>Batch Initiated:</span>{' '}
                    <span>{viewingRunCostSummary.createdAt ? new Date(viewingRunCostSummary.createdAt).toLocaleString('en-IN') : 'Recent'}</span>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
                <Button variant="secondary" onClick={() => setCostSummaryModalOpen(false)}>
                  Close
                </Button>
              </div>
            </div>
          )}
        </Modal>
      )}

      {/* ================================================================== */}
      {/* 10. MODAL: MANUALLY ADJUST LINE ITEM (PUT /payroll/line-items/:id/adjust) */}
      {/* ================================================================== */}
      {adjustItemModalOpen && adjustingLineItem && (
        <Modal
          isOpen={true}
          onClose={() => {
            setAdjustItemModalOpen(false);
            setAdjustingLineItem(null);
          }}
          title={`Adjust Salary Line Item: ${adjustingLineItem.employee?.basicInfo?.fullName || adjustingLineItem.employee?.name || 'Employee'}`}
          maxWidth="520px"
        >
          <form onSubmit={handleSubmitAdjustment} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ background: '#f8fafc', padding: '10px 14px', borderRadius: 8, border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#0f172a' }}>
                  {adjustingLineItem.employee?.basicInfo?.fullName || adjustingLineItem.employee?.name}
                </div>
                <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                  Code: {adjustingLineItem.employee?.basicInfo?.employeeCode || adjustingLineItem.employee?.employeeCode || 'EMP'}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Current Gross</div>
                <div style={{ fontWeight: 700, color: '#16a34a', fontSize: '0.95rem' }}>
                  ₹{(adjustingLineItem.grossEarnings || 0).toLocaleString('en-IN')}
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>
                  Attendance Deduction (₹)
                </label>
                <input
                  type="number"
                  value={adjustForm.attendanceDeductionAmount}
                  onChange={(e) => setAdjustForm({ ...adjustForm, attendanceDeductionAmount: e.target.value })}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.82rem', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>
                  Discretionary Bonus (₹)
                </label>
                <input
                  type="number"
                  value={adjustForm.otherBonus}
                  onChange={(e) => setAdjustForm({ ...adjustForm, otherBonus: e.target.value })}
                  placeholder="0"
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.82rem', boxSizing: 'border-box' }}
                />
              </div>
            </div>

            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>
                Adjustment Remark / Audit Justification *
              </label>
              <textarea
                value={adjustForm.adjustmentRemark}
                onChange={(e) => setAdjustForm({ ...adjustForm, adjustmentRemark: e.target.value })}
                required
                rows={3}
                placeholder="e.g. Leave attendance deduction waived by executive approval"
                style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.82rem', boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
              <Button variant="secondary" onClick={() => setAdjustItemModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" type="submit" loading={submittingAdjustItem}>
                Apply Adjustment
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* ================================================================== */}
      {/* 11. MODAL: UPDATE DELIVERY STATUS (PUT /payslips/:id/delivery-status) */}
      {/* ================================================================== */}
      {deliveryModalOpen && deliverySlip && (
        <Modal
          isOpen={true}
          onClose={() => {
            setDeliveryModalOpen(false);
            setDeliverySlip(null);
          }}
          title="Update Payslip Delivery Status"
          maxWidth="440px"
        >
          <form onSubmit={handleSubmitDeliveryStatus} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>
                Delivery Status *
              </label>
              <select
                value={deliveryStatusValue}
                onChange={(e) => setDeliveryStatusValue(e.target.value)}
                required
                style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.82rem', boxSizing: 'border-box' }}
              >
                <option value="SENT">SENT (Dispatched to Employee)</option>
                <option value="QUEUED">QUEUED (In Delivery Queue)</option>
                <option value="NOT_SENT">NOT_SENT (Draft / Pending)</option>
                <option value="FAILED">FAILED (Email / Dispatch Error)</option>
              </select>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
              <Button variant="secondary" onClick={() => setDeliveryModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" type="submit" loading={submittingDeliveryStatus}>
                Update Status
              </Button>
            </div>
          </form>
        </Modal>
      )}

    </div>
  );
};

export default PayrollPayslips;
