import React, { useState, useEffect, useMemo } from 'react';
import assetsLoansApi from '../../api/assetsLoansApi';
import employeeApi from '../../api/employeeApi';
import masterApi from '../../api/masterApi';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { useConfirm } from '../../context/ConfirmContext';
import {
  getEmployeeName,
  getEmployeeCode,
  formatEmployeeOption,
  extractEmployeeList,
} from '../../utils/employeeUtils';
import {
  Plus,
  Laptop,
  Receipt,
  HandCoins,
  Check,
  X,
  History,
  RotateCcw,
  AlertTriangle,
  FileText,
  DollarSign,
  UserCheck,
  ShieldCheck,
  Ban,
  Clock,
  Eye,
  Settings,
  RefreshCw,
  FolderPlus,
  Edit2,
  Trash2,
  Calendar,
  Search,
  Filter,
  CheckCircle2,
  Building2,
  Printer,
  Download,
} from 'lucide-react';
import Table from '../../components/common/Table';
import Modal from '../../components/common/Modal';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import Select from '../../components/common/Select';
import Badge from '../../components/common/Badge';
import { extractApiData } from '../../utils/apiUtils';
import { formatDateOnlyIST, formatMoneyINR, getErrorMessage } from '../../utils/formatters';

export const AssetsClaimsLoans = () => {
  const { user, isSuperAdmin, isHrAdmin, branch: globalBranch } = useAuth();
  const canManage = isSuperAdmin || isHrAdmin;
  const { showToast } = useToast();
  const confirm = useConfirm();

  // Active Tab: 'assets' | 'clearance' | 'claims' | 'categories' | 'loans'
  const [activeTab, setActiveTab] = useState('assets');

  // Master Data
  const [employees, setEmployees] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [branches, setBranches] = useState([]);

  // =========================================================================
  // TAB 1: ASSET MANAGEMENT (Module 20)
  // =========================================================================
  const [assets, setAssets] = useState([]);
  const [loadingAssets, setLoadingAssets] = useState(false);
  const [assetModalOpen, setAssetModalOpen] = useState(false);
  const [editingAssetId, setEditingAssetId] = useState(null);
  const [submittingAsset, setSubmittingAsset] = useState(false);
  const [assetForm, setAssetForm] = useState({
    name: '',
    assetTag: '',
    category: 'LAPTOP',
    serialNumber: '',
    model: '',
    purchaseValue: '',
    purchaseDate: new Date().toISOString().split('T')[0],
    company: '',
    branch: '',
  });

  // Asset Search & Filters
  const [assetSearchTerm, setAssetSearchTerm] = useState('');
  const [assetCategoryFilter, setAssetCategoryFilter] = useState('ALL');
  const [assetStatusFilter, setAssetStatusFilter] = useState('ALL');
  const [assetCompanyFilter, setAssetCompanyFilter] = useState('ALL');

  // View Asset Details Modal (GET /assets/:id)
  const [viewAssetModalOpen, setViewAssetModalOpen] = useState(false);
  const [viewingAsset, setViewingAsset] = useState(null);
  const [loadingAssetDetail, setLoadingAssetDetail] = useState(false);

  // Assign Asset Modal
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [targetAsset, setTargetAsset] = useState(null);
  const [assignForm, setAssignForm] = useState({
    employeeId: '',
    conditionAtIssue: 'Brand new, good working condition',
    expectedReturnDate: '',
    notes: '',
  });
  const [submittingAssign, setSubmittingAssign] = useState(false);

  // Custody History Modal
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [custodyHistory, setCustodyHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Return Asset Modal
  const [returnModalOpen, setReturnModalOpen] = useState(false);
  const [targetAssignment, setTargetAssignment] = useState(null);
  const [returnCondition, setReturnCondition] = useState('GOOD');
  const [returnRemarks, setReturnRemarks] = useState('');
  const [submittingReturn, setSubmittingReturn] = useState(false);

  // Damage / Loss Report Modal
  const [damageModalOpen, setDamageModalOpen] = useState(false);
  const [damageForm, setDamageForm] = useState({
    incidentType: 'DAMAGED', // 'DAMAGED' | 'LOST'
    estimatedCost: '',
    incidentDescription: '',
  });
  const [submittingDamage, setSubmittingDamage] = useState(false);

  // Recovery Decision Modal
  const [recoveryModalOpen, setRecoveryModalOpen] = useState(false);
  const [recoveryForm, setRecoveryForm] = useState({
    recoveryAmount: '',
    recoveryMode: 'PAYROLL_DEDUCTION', // 'PAYROLL_DEDUCTION' | 'OUTSIDE_PAYROLL'
    decisionRemark: '',
  });
  const [submittingRecovery, setSubmittingRecovery] = useState(false);
  const [submittingOutsideRecovery, setSubmittingOutsideRecovery] = useState(false);

  // =========================================================================
  // TAB: EMPLOYEE CLEARANCES & NO-DUE (Module 20 Clearance & Recovery Link)
  // =========================================================================
  const [selectedClearanceEmployeeId, setSelectedClearanceEmployeeId] = useState('');
  const [clearanceCert, setClearanceCert] = useState(null);
  const [clearanceAssignments, setClearanceAssignments] = useState([]);
  const [clearancePendingRecoveries, setClearancePendingRecoveries] = useState([]);
  const [loadingClearance, setLoadingClearance] = useState(false);

  // =========================================================================
  // TAB 2: REIMBURSEMENTS & EXPENSE CLAIMS (Module 19)
  // =========================================================================
  const [claimsViewMode, setClaimsViewMode] = useState('my'); // 'my' | 'pending' | 'all'
  const [claims, setClaims] = useState([]);
  const [loadingClaims, setLoadingClaims] = useState(false);
  const [claimSearchTerm, setClaimSearchTerm] = useState('');
  const [claimStatusFilter, setClaimStatusFilter] = useState('ALL');
  const [claimMethodFilter, setClaimMethodFilter] = useState('ALL');

  // View Claim Details Modal (GET /reimbursements/claims/:id)
  const [viewClaimModalOpen, setViewClaimModalOpen] = useState(false);
  const [viewingClaim, setViewingClaim] = useState(null);
  const [loadingClaimDetail, setLoadingClaimDetail] = useState(false);

  // Submit Claim Modal (POST /reimbursements/claims)
  const [claimModalOpen, setClaimModalOpen] = useState(false);
  const [submittingClaim, setSubmittingClaim] = useState(false);
  const [claimForm, setClaimForm] = useState({
    title: '',
    disbursementMethod: 'PAYROLL', // 'PAYROLL' | 'DIRECT_PAYMENT'
    project: '',
    lineItems: [
      {
        category: '',
        description: '',
        amount: '',
        expenseDate: new Date().toISOString().split('T')[0],
        receiptUrl: '',
      },
    ],
  });

  // Decide Claim Modal (PUT /reimbursements/claims/:id/decide)
  const [claimDecideModalOpen, setClaimDecideModalOpen] = useState(false);
  const [selectedClaim, setSelectedClaim] = useState(null);
  const [claimDecision, setClaimDecision] = useState('APPROVED'); // 'APPROVED' | 'PARTIALLY_APPROVED' | 'REJECTED'
  const [approvedAmount, setApprovedAmount] = useState(0);
  const [decisionRemark, setDecisionRemark] = useState('');
  const [submittingClaimDecision, setSubmittingClaimDecision] = useState(false);

  // Direct Payment Settlement Modal (PUT /reimbursements/claims/:id/record-direct-payment)
  const [directPaymentModalOpen, setDirectPaymentModalOpen] = useState(false);
  const [directPaymentForm, setDirectPaymentForm] = useState({
    paymentReference: '',
    paidAt: new Date().toISOString().split('T')[0],
  });
  const [submittingDirectPayment, setSubmittingDirectPayment] = useState(false);

  // =========================================================================
  // TAB 3: REIMBURSEMENT CATEGORIES (Module 19)
  // =========================================================================
  const [categories, setCategories] = useState([]);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState(null);
  const [categoryForm, setCategoryForm] = useState({
    name: '',
    code: '',
    monthlyCap: 10000,
    isCapHardEnforced: false,
    company: '',
    isActive: true,
  });
  const [submittingCategory, setSubmittingCategory] = useState(false);

  // =========================================================================
  // TAB 4: LOANS & ADVANCES (Module 20)
  // =========================================================================
  const [loansViewMode, setLoansViewMode] = useState('all'); // 'all' | 'pending' | 'me' | 'loan_types'
  const [loans, setLoans] = useState([]);
  const [loadingLoans, setLoadingLoans] = useState(false);
  const [loanSearchTerm, setLoanSearchTerm] = useState('');
  const [loanStatusFilter, setLoanStatusFilter] = useState('ALL');
  const [loanTypeFilter, setLoanTypeFilter] = useState('ALL');

  // Loan Types State (GET/POST/PUT/DELETE /loan-types)
  const [loanTypes, setLoanTypes] = useState([]);
  const [loadingLoanTypes, setLoadingLoanTypes] = useState(false);
  const [loanTypeModalOpen, setLoanTypeModalOpen] = useState(false);
  const [editingLoanTypeId, setEditingLoanTypeId] = useState(null);
  const [submittingLoanType, setSubmittingLoanType] = useState(false);
  const [loanTypeForm, setLoanTypeForm] = useState({
    name: '',
    category: 'ADVANCE', // 'ADVANCE' | 'LOAN'
    company: '',
    maxAmount: 50000,
    maxTenureMonths: 6,
    interestRatePercent: 0,
    minimumServiceMonthsRequired: 0,
    isActive: true,
  });

  // Apply Loan Modal (POST /loans/requests)
  const [loanModalOpen, setLoanModalOpen] = useState(false);
  const [loanForm, setLoanForm] = useState({
    employeeId: '',
    loanTypeId: '',
    amount: '',
    tenureMonths: 6,
    purpose: '',
  });
  const [submittingLoan, setSubmittingLoan] = useState(false);

  // View Loan Details Modal (GET /loans/requests/:id)
  const [viewLoanModalOpen, setViewLoanModalOpen] = useState(false);
  const [viewingLoan, setViewingLoan] = useState(null);
  const [loadingLoanDetail, setLoadingLoanDetail] = useState(false);

  // Decide Loan Modal (PUT /loans/requests/:id/decide)
  const [loanDecideModalOpen, setLoanDecideModalOpen] = useState(false);
  const [selectedLoanForDecision, setSelectedLoanForDecision] = useState(null);
  const [loanDecision, setLoanDecision] = useState('APPROVED'); // 'APPROVED' | 'REJECTED'
  const [approvedLoanAmount, setApprovedLoanAmount] = useState('');
  const [approvedLoanTenure, setApprovedLoanTenure] = useState('');
  const [loanDecisionRemark, setLoanDecisionRemark] = useState('');
  const [submittingLoanDecision, setSubmittingLoanDecision] = useState(false);

  // Disburse Loan Modal (POST /loans/requests/:id/disburse)
  const [disburseModalOpen, setDisburseModalOpen] = useState(false);
  const [selectedLoanForDisburse, setSelectedLoanForDisburse] = useState(null);
  const [disburseForm, setDisburseForm] = useState({
    disbursementReference: '',
    disbursedAt: new Date().toISOString().split('T')[0],
  });
  const [submittingDisburse, setSubmittingDisburse] = useState(false);

  // Loan EMI Schedule Modal (GET /loans/:id/emi-schedule)
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [emiSchedule, setEmiSchedule] = useState([]);
  const [activeLoanForSchedule, setActiveLoanForSchedule] = useState(null);
  const [loadingSchedule, setLoadingSchedule] = useState(false);
  const [submittingMarkPaid, setSubmittingMarkPaid] = useState({});

  // -------------------------------------------------------------------------
  // INITIAL LOAD
  // -------------------------------------------------------------------------
  useEffect(() => {
    loadMasters();
  }, [globalBranch]);

  useEffect(() => {
    const handleContextChange = () => {
      loadMasters();
      if (activeTab === 'assets') loadAssets();
      else if (activeTab === 'claims') loadClaims();
      else if (activeTab === 'categories') loadCategories();
      else if (activeTab === 'loans') loadLoans();
    };
    window.addEventListener('tie:context-changed', handleContextChange);
    return () => window.removeEventListener('tie:context-changed', handleContextChange);
  }, [globalBranch, activeTab]);

  useEffect(() => {
    if (activeTab === 'assets') loadAssets();
    else if (activeTab === 'clearance') {
      const empId = selectedClearanceEmployeeId || employees[0]?._id || employees[0]?.id;
      if (empId) loadEmployeeClearance(empId);
    }
    else if (activeTab === 'claims') loadClaims();
    else if (activeTab === 'categories') loadCategories();
    else if (activeTab === 'loans') {
      if (loansViewMode === 'loan_types') {
        loadLoanTypes();
      } else {
        loadLoans();
      }
    }
  }, [activeTab, claimsViewMode, loansViewMode]);

  const loadMasters = async () => {
    try {
      const empParams = { limit: 200 };
      const branchId = globalBranch?._id || globalBranch?.id;
      if (branchId && branchId !== 'ALL') {
        empParams.branch = branchId;
      }
      const [eRes, cRes, bRes, catRes, ltRes] = await Promise.all([
        employeeApi.getEmployees(empParams).catch(() => ({ data: [] })),
        masterApi.getCompanies().catch(() => ({ data: [] })),
        masterApi.getBranches().catch(() => ({ data: [] })),
        assetsLoansApi.getReimbursementCategories().catch(() => ({ data: [] })),
        assetsLoansApi.getLoanTypes().catch(() => ({ data: [] })),
      ]);
      const empList = extractEmployeeList(eRes);
      const compList = Array.isArray(cRes) ? cRes : cRes?.data || [];
      const branchList = Array.isArray(bRes) ? bRes : bRes?.data || [];
      const catList = Array.isArray(catRes) ? catRes : catRes?.data || [];
      const ltList = Array.isArray(ltRes) ? ltRes : ltRes?.data || ltRes?.loanTypes || [];

      setEmployees(empList);
      setCompanies(compList);
      setBranches(branchList);
      setCategories(catList);
      setLoanTypes(ltList);

      if (compList.length > 0) {
        setAssetForm((prev) => ({
          ...prev,
          company: compList[0]._id,
          branch: branchList[0]?._id || '',
        }));
      }
      if (catList.length > 0) {
        setClaimForm((prev) => ({ ...prev, category: catList[0]._id }));
      }
      if (empList.length > 0) {
        const firstEmpId = empList[0]._id || empList[0].id;
        setAssignForm((prev) => ({ ...prev, employeeId: firstEmpId }));
        setSelectedClearanceEmployeeId(firstEmpId);
        setLoanForm((prev) => ({
          ...prev,
          employeeId: firstEmpId,
          loanTypeId: ltList[0]?._id || '',
          amount: ltList[0]?.maxAmount || 25000,
          tenureMonths: ltList[0]?.maxTenureMonths || 6,
        }));
      }
    } catch (err) {
      console.error('Failed to load masters:', err);
    }
  };

  // -------------------------------------------------------------------------
  // ASSET MANAGEMENT HANDLERS (TAB 1)
  // -------------------------------------------------------------------------
  const loadAssets = async () => {
    setLoadingAssets(true);
    try {
      const res = await assetsLoansApi.getAssets();
      const list = extractApiData(res, 'assets', 'data');
      setAssets(list);
    } catch (err) {
      showToast('Failed to load physical assets', 'error');
    } finally {
      setLoadingAssets(false);
    }
  };

  const getAssetStatus = (asset) => {
    if (!asset) return 'UNASSIGNED';
    return asset.currentStatus || asset.status || (asset.currentAssignment ? 'ASSIGNED' : 'UNASSIGNED');
  };

  // Memoized search & filter for assets
  const filteredAssets = useMemo(() => {
    return assets.filter((item) => {
      // 1. Text search across name, tag, serial, model, custodian
      if (assetSearchTerm.trim()) {
        const q = assetSearchTerm.toLowerCase();
        const matchesName = (item.name || '').toLowerCase().includes(q);
        const matchesTag = (item.assetTag || '').toLowerCase().includes(q);
        const matchesSerial = (item.serialNumber || '').toLowerCase().includes(q);
        const matchesModel = (item.model || '').toLowerCase().includes(q);
        const emp = item.currentAssignment?.employee || item.assignment?.employee;
        const matchesEmp = emp ? getEmployeeName(emp).toLowerCase().includes(q) : false;
        if (!matchesName && !matchesTag && !matchesSerial && !matchesModel && !matchesEmp) {
          return false;
        }
      }
      // 2. Category filter
      if (assetCategoryFilter !== 'ALL' && item.category !== assetCategoryFilter) {
        return false;
      }
      // 3. Status filter
      if (assetStatusFilter !== 'ALL') {
        const s = getAssetStatus(item);
        if (assetStatusFilter === 'UNASSIGNED') {
          if (s !== 'UNASSIGNED' && s !== 'AVAILABLE') return false;
        } else if (s !== assetStatusFilter) {
          return false;
        }
      }
      // 4. Company filter
      if (assetCompanyFilter !== 'ALL') {
        const cId = item.company?._id || item.company;
        if (cId !== assetCompanyFilter) return false;
      }
      return true;
    });
  }, [assets, assetSearchTerm, assetCategoryFilter, assetStatusFilter, assetCompanyFilter]);

  // View Asset Details Modal (GET /assets/:id)
  const openViewAssetModal = async (asset) => {
    setViewAssetModalOpen(true);
    setLoadingAssetDetail(true);
    setViewingAsset(asset);
    try {
      const res = await assetsLoansApi.getAssetById(asset._id);
      const detail = res?.data || res?.asset || res || asset;
      setViewingAsset(detail);
    } catch (err) {
      console.error('Failed to load asset details:', err);
      setViewingAsset(asset);
    } finally {
      setLoadingAssetDetail(false);
    }
  };

  // Mark Cost Recovered Outside Payroll (PUT /assets/assignments/:id/mark-recovered-outside-payroll)
  const handleMarkRecoveredOutsidePayroll = async (assignmentId) => {
    const isConfirmed = await confirm({
      title: 'Confirm Outside Recovery',
      message: 'Mark this asset cost as fully recovered outside payroll (e.g. direct cash/cheque reimbursement)?',
      confirmText: 'Mark Recovered',
      cancelText: 'Cancel',
      variant: 'info',
    });
    if (!isConfirmed) return;
    setSubmittingOutsideRecovery(true);
    try {
      await assetsLoansApi.markRecoveredOutsidePayroll(assignmentId, {
        remarks: 'Direct payment settled outside payroll',
      });
      showToast('Asset recovery recorded outside payroll!', 'success');
      loadAssets();
      if (selectedClearanceEmployeeId) {
        loadEmployeeClearance(selectedClearanceEmployeeId);
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to mark recovered outside payroll', 'error');
    } finally {
      setSubmittingOutsideRecovery(false);
    }
  };

  // Load Employee Clearance & No Due Certificate (Module 20 Endpoints)
  const loadEmployeeClearance = async (empId) => {
    if (!empId) return;
    setLoadingClearance(true);
    try {
      const [certRes, assignRes, recRes] = await Promise.allSettled([
        assetsLoansApi.getEmployeeNoDueClearance(empId),
        assetsLoansApi.getEmployeeAssetAssignments(empId),
        assetsLoansApi.getPendingRecovery(empId),
      ]);

      if (certRes.status === 'fulfilled') {
        setClearanceCert(certRes.value?.data || certRes.value || null);
      } else {
        setClearanceCert(null);
      }

      if (assignRes.status === 'fulfilled') {
        const list = extractApiData(assignRes.value, 'assignments', 'data');
        setClearanceAssignments(Array.isArray(list) ? list : []);
      } else {
        setClearanceAssignments([]);
      }

      if (recRes.status === 'fulfilled') {
        const val = recRes.value?.data || recRes.value || {};
        const recList = Array.isArray(val)
          ? val
          : val.pendingRecoveries || val.recoveries || (Array.isArray(val.data) ? val.data : []);
        setClearancePendingRecoveries(recList);
      } else {
        setClearancePendingRecoveries([]);
      }
    } catch (err) {
      console.error('Failed to load employee clearance details:', err);
    } finally {
      setLoadingClearance(false);
    }
  };

  const openAssetModal = (asset = null) => {
    if (asset) {
      setEditingAssetId(asset._id);
      setAssetForm({
        name: asset.name || '',
        assetTag: asset.assetTag || '',
        category: asset.category || 'LAPTOP',
        serialNumber: asset.serialNumber || '',
        model: asset.model || '',
        purchaseValue: asset.purchaseValue || '',
        purchaseDate: asset.purchaseDate ? asset.purchaseDate.split('T')[0] : new Date().toISOString().split('T')[0],
        company: asset.company?._id || asset.company || companies[0]?._id || '',
        branch: asset.branch?._id || asset.branch || branches[0]?._id || '',
        currentStatus: getAssetStatus(asset),
        condition: asset.condition || 'GOOD',
      });
    } else {
      setEditingAssetId(null);
      const rand = Math.floor(100000 + Math.random() * 900000);
      setAssetForm({
        name: '',
        assetTag: `AST-${new Date().getFullYear()}-${String(assets.length + 1).padStart(3, '0')}`,
        category: 'LAPTOP',
        serialNumber: `LAP-${new Date().getFullYear()}-${rand}`,
        model: '',
        purchaseValue: '',
        purchaseDate: new Date().toISOString().split('T')[0],
        company: companies[0]?._id || '',
        branch: branches[0]?._id || '',
        currentStatus: 'UNASSIGNED',
        condition: 'NEW',
      });
    }
    setAssetModalOpen(true);
  };

  const handleSaveAsset = async (e) => {
    e.preventDefault();

    const catPrefix = (assetForm.category || 'AST').slice(0, 3).toUpperCase();
    const finalSerial = assetForm.serialNumber?.trim() || `${catPrefix}-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;
    const finalTag = assetForm.assetTag?.trim() || `AST-${new Date().getFullYear()}-${String(assets.length + 1).padStart(3, '0')}`;
    const finalCategory = assetForm.category || 'LAPTOP';
    const finalName = assetForm.name?.trim();

    if (!finalName) {
      showToast('Asset name is required', 'warning');
      return;
    }

    setSubmittingAsset(true);
    try {
      const payload = {
        name: finalName,
        category: finalCategory,
        serialNumber: finalSerial,
        assetTag: finalTag,
        model: assetForm.model?.trim() || undefined,
        purchaseValue: Number(assetForm.purchaseValue) || 0,
        purchaseDate: assetForm.purchaseDate,
        company: assetForm.company || undefined,
        branch: assetForm.branch || undefined,
        condition: assetForm.condition || 'NEW',
        currentStatus: assetForm.currentStatus || 'UNASSIGNED',
      };
      if (editingAssetId) {
        await assetsLoansApi.updateAsset(editingAssetId, payload);
        showToast('Asset master record updated!', 'success');
      } else {
        await assetsLoansApi.createAsset(payload);
        showToast('New asset registered in inventory!', 'success');
      }
      setAssetModalOpen(false);
      loadAssets();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to save asset', 'error');
    } finally {
      setSubmittingAsset(false);
    }
  };

  const handleRetireAsset = async (id) => {
    const isConfirmed = await confirm({
      title: 'Retire Asset',
      message: 'Retire and write off this asset from active service? It will no longer be available for assignment.',
      confirmText: 'Retire Asset',
      cancelText: 'Cancel',
      variant: 'danger',
    });
    if (!isConfirmed) return;
    try {
      await assetsLoansApi.retireAsset(id);
      showToast('Asset marked as RETIRED', 'info');
      loadAssets();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to retire asset', 'error');
    }
  };

  const handleReactivateAsset = async (id) => {
    const isConfirmed = await confirm({
      title: 'Reactivate Asset',
      message: 'Reactivate this retired asset and return it to available inventory stock?',
      confirmText: 'Reactivate',
      cancelText: 'Cancel',
      variant: 'info',
    });
    if (!isConfirmed) return;
    try {
      await assetsLoansApi.reactivateAsset(id);
      showToast('Asset reactivated successfully and available for assignment!', 'success');
      loadAssets();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to reactivate asset', 'error');
    }
  };

  const openAssignModal = (asset) => {
    const status = getAssetStatus(asset);
    if (status === 'RETIRED') {
      showToast("This asset is RETIRED. Please reactivate it first before assignment.", 'warning');
      return;
    }
    setTargetAsset(asset);
    setAssignForm({
      employeeId: assignForm.employeeId || employees[0]?._id || employees[0]?.id || '',
      conditionAtIssue: 'Brand new, good working condition',
      notes: 'Issued for official project duties',
    });
    setAssignModalOpen(true);
  };

  const handleAssignAsset = async (e) => {
    e.preventDefault();
    if (!targetAsset) return;
    const status = getAssetStatus(targetAsset);
    if (status === 'RETIRED') {
      showToast("Asset is marked as RETIRED. Please reactivate it before issuing.", 'error');
      return;
    }
    if (!assignForm.employeeId) {
      showToast('Please select an employee', 'warning');
      return;
    }
    setSubmittingAssign(true);
    try {
      const payload = {
        employeeId: assignForm.employeeId,
        conditionAtIssue: assignForm.conditionAtIssue || 'Brand new, good working condition',
        notes: assignForm.notes || 'Issued for official project duties',
      };
      await assetsLoansApi.assignAsset(targetAsset._id, payload);
      showToast('Asset assigned to employee custody!', 'success');
      setAssignModalOpen(false);
      loadAssets();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to assign asset', 'error');
    } finally {
      setSubmittingAssign(false);
    }
  };

  const openHistoryModal = async (asset) => {
    setTargetAsset(asset);
    setHistoryModalOpen(true);
    setLoadingHistory(true);
    try {
      const res = await assetsLoansApi.getAssetHistory(asset._id);
      const list = Array.isArray(res) ? res : res?.data || res?.history || [];
      setCustodyHistory(list);
    } catch (err) {
      showToast('Failed to fetch custody assignment history', 'error');
    } finally {
      setLoadingHistory(false);
    }
  };

  const openReturnModal = (asset) => {
    const assignment = asset.currentAssignment || asset.assignment;
    setTargetAsset(asset);
    setTargetAssignment(assignment || { _id: asset._id });
    setReturnCondition('GOOD');
    setReturnRemarks('Returned in good working order');
    setReturnModalOpen(true);
  };

  const handleReturnAsset = async (e) => {
    e.preventDefault();
    setSubmittingReturn(true);
    try {
      const assignmentId = targetAssignment?._id || targetAsset?._id;
      await assetsLoansApi.returnAssetAssignment(assignmentId, {
        condition: returnCondition,
        remarks: returnRemarks,
      });
      showToast('Physical asset return recorded!', 'success');
      setReturnModalOpen(false);
      loadAssets();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to process return', 'error');
    } finally {
      setSubmittingReturn(false);
    }
  };

  const openDamageModal = (asset) => {
    setTargetAsset(asset);
    setTargetAssignment(asset.currentAssignment || { _id: asset._id });
    setDamageForm({
      incidentType: 'DAMAGED',
      estimatedCost: 5000,
      incidentDescription: '',
    });
    setDamageModalOpen(true);
  };

  const handleReportDamage = async (e) => {
    e.preventDefault();
    if (!damageForm.incidentDescription.trim()) {
      showToast('Incident description is required', 'error');
      return;
    }
    setSubmittingDamage(true);
    try {
      const assignmentId = targetAssignment?._id || targetAsset?._id;
      await assetsLoansApi.reportDamageLoss(assignmentId, damageForm);
      showToast('Damage / Loss incident recorded!', 'warning');
      setDamageModalOpen(false);
      loadAssets();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to report damage', 'error');
    } finally {
      setSubmittingDamage(false);
    }
  };

  const openRecoveryModal = (asset) => {
    setTargetAsset(asset);
    setTargetAssignment(asset.currentAssignment || { _id: asset._id });
    setRecoveryForm({
      recoveryAmount: 5000,
      recoveryMode: 'PAYROLL_DEDUCTION',
      decisionRemark: 'Approved recovery for damaged asset replacement',
    });
    setRecoveryModalOpen(true);
  };

  const handleRecoveryDecision = async (e) => {
    e.preventDefault();
    setSubmittingRecovery(true);
    try {
      const assignmentId = targetAssignment?._id || targetAsset?._id;
      await assetsLoansApi.recordRecoveryDecision(assignmentId, recoveryForm);
      showToast('Cost recovery decision recorded for payroll linkage!', 'success');
      setRecoveryModalOpen(false);
      loadAssets();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to record recovery', 'error');
    } finally {
      setSubmittingRecovery(false);
    }
  };

  // -------------------------------------------------------------------------
  // REIMBURSEMENTS & CLAIMS (TAB 2)
  // -------------------------------------------------------------------------
  const loadClaims = async () => {
    setLoadingClaims(true);
    try {
      let res;
      if (claimsViewMode === 'my') {
        res = await assetsLoansApi.getMyClaims();
      } else if (claimsViewMode === 'pending') {
        res = await assetsLoansApi.getPendingApprovalClaims();
      } else {
        res = await assetsLoansApi.getAllClaims();
      }
      const list = extractApiData(res, 'claims', 'data');
      setClaims(list);
    } catch (err) {
      showToast('Failed to load reimbursement claims', 'error');
    } finally {
      setLoadingClaims(false);
    }
  };

  // Filtered claims for instant dynamic search and filtering
  const filteredClaims = useMemo(() => {
    return claims.filter((claim) => {
      // 1. Search filter
      if (claimSearchTerm.trim()) {
        const q = claimSearchTerm.toLowerCase();
        const matchesTitle = (claim.title || '').toLowerCase().includes(q);
        const matchesDesc = (claim.description || '').toLowerCase().includes(q);
        const matchesEmp = claim.employee ? getEmployeeName(claim.employee).toLowerCase().includes(q) : false;
        const matchesCat = claim.category?.name ? claim.category.name.toLowerCase().includes(q) : false;
        const matchesRef = (claim.directPaymentReference || '').toLowerCase().includes(q);
        if (!matchesTitle && !matchesDesc && !matchesEmp && !matchesCat && !matchesRef) {
          return false;
        }
      }
      // 2. Status filter
      if (claimStatusFilter !== 'ALL') {
        const s = claim.status || 'PENDING';
        if (s !== claimStatusFilter) return false;
      }
      // 3. Disbursement method filter
      if (claimMethodFilter !== 'ALL') {
        const m = claim.disbursementMethod || claim.settlementType || 'PAYROLL';
        if (m !== claimMethodFilter) return false;
      }
      return true;
    });
  }, [claims, claimSearchTerm, claimStatusFilter, claimMethodFilter]);

  // View Claim Details Modal (GET /reimbursements/claims/:id)
  const openViewClaimModal = async (claim) => {
    setViewClaimModalOpen(true);
    setLoadingClaimDetail(true);
    setViewingClaim(claim);
    try {
      const res = await assetsLoansApi.getClaimById(claim._id);
      const detail = res?.data || res?.claim || res || claim;
      setViewingClaim(detail);
    } catch (err) {
      console.error('Failed to load full claim details:', err);
      setViewingClaim(claim);
    } finally {
      setLoadingClaimDetail(false);
    }
  };

  // Line item helpers for expense claim submission
  const handleAddClaimLineItem = () => {
    setClaimForm((prev) => ({
      ...prev,
      lineItems: [
        ...prev.lineItems,
        {
          category: categories[0]?._id || '',
          description: '',
          amount: '',
          expenseDate: new Date().toISOString().split('T')[0],
          receiptUrl: '',
        },
      ],
    }));
  };

  const handleRemoveClaimLineItem = (index) => {
    if (claimForm.lineItems.length <= 1) {
      showToast('A claim must have at least one receipt item', 'warning');
      return;
    }
    setClaimForm((prev) => ({
      ...prev,
      lineItems: prev.lineItems.filter((_, idx) => idx !== index),
    }));
  };

  const handleClaimLineItemChange = (index, field, value) => {
    setClaimForm((prev) => {
      const updated = [...prev.lineItems];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, lineItems: updated };
    });
  };

  const handleCreateClaim = async (e) => {
    e.preventDefault();
    setSubmittingClaim(true);
    try {
      // Validate line items
      const validLineItems = claimForm.lineItems.map((item) => ({
        category: item.category || categories[0]?._id,
        description: item.description || 'Out-of-pocket expense',
        amount: Number(item.amount) || 0,
        expenseDate: item.expenseDate || new Date().toISOString().split('T')[0],
        receiptUrl: item.receiptUrl || 'https://res.cloudinary.com/demo/image/upload/v1234/receipt1.jpg',
      }));

      const totalAmount = validLineItems.reduce((acc, it) => acc + it.amount, 0);
      if (totalAmount <= 0) {
        showToast('Please enter valid expense amounts greater than ₹0', 'warning');
        setSubmittingClaim(false);
        return;
      }

      const payload = {
        disbursementMethod: claimForm.disbursementMethod || 'PAYROLL',
        project: claimForm.project || undefined,
        lineItems: validLineItems,
        // Backward compatibility
        title: claimForm.title || validLineItems[0]?.description || 'Reimbursement Claim',
        amount: totalAmount,
      };

      await assetsLoansApi.createClaim(payload);
      showToast('Expense claim filed successfully with receipts!', 'success');
      setClaimModalOpen(false);
      // Reset form
      setClaimForm({
        title: '',
        disbursementMethod: 'PAYROLL',
        project: '',
        lineItems: [
          {
            category: categories[0]?._id || '',
            description: '',
            amount: '',
            expenseDate: new Date().toISOString().split('T')[0],
            receiptUrl: '',
          },
        ],
      });
      loadClaims();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to file claim', 'error');
    } finally {
      setSubmittingClaim(false);
    }
  };

  const openClaimDecideModal = (claim, decision) => {
    setSelectedClaim(claim);
    setClaimDecision(decision);
    setApprovedAmount(claim.approvedAmount || claim.totalClaimedAmount || claim.amount || 0);
    setDecisionRemark(decision === 'APPROVED' ? 'Bills verified and claim approved' : '');
    setClaimDecideModalOpen(true);
  };

  const handleSaveClaimDecision = async (e) => {
    e.preventDefault();
    setSubmittingClaimDecision(true);
    try {
      await assetsLoansApi.decideClaim(selectedClaim._id, {
        decision: claimDecision,
        approvedAmount: Number(approvedAmount),
        remark: decisionRemark,
        remarks: decisionRemark,
      });
      showToast(`Expense claim has been ${claimDecision}!`, 'success');
      setClaimDecideModalOpen(false);
      loadClaims();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to decide claim', 'error');
    } finally {
      setSubmittingClaimDecision(false);
    }
  };

  const handleCancelClaim = async (claimId) => {
    const isConfirmed = await confirm({
      title: 'Cancel Reimbursement Claim',
      message: 'Are you sure you want to cancel this pending reimbursement claim?',
      confirmText: 'Cancel Claim',
      cancelText: 'Keep Claim',
      variant: 'danger',
    });
    if (!isConfirmed) return;
    try {
      await assetsLoansApi.cancelClaim(claimId);
      showToast('Claim cancelled', 'info');
      loadClaims();
    } catch (err) {
      showToast(err.response?.data?.message || 'Cannot cancel this claim', 'error');
    }
  };

  const openDirectPaymentModal = (claim) => {
    setSelectedClaim(claim);
    setDirectPaymentForm({
      paymentReference: `IMPS-${Date.now().toString().slice(-8)}`,
      paidAt: new Date().toISOString().split('T')[0],
    });
    setDirectPaymentModalOpen(true);
  };

  const handleRecordDirectPayment = async (e) => {
    e.preventDefault();
    setSubmittingDirectPayment(true);
    try {
      await assetsLoansApi.recordDirectPayment(selectedClaim._id, {
        paymentReference: directPaymentForm.paymentReference,
        paidAt: new Date(directPaymentForm.paidAt).toISOString(),
      });
      showToast('Direct payment settlement recorded successfully!', 'success');
      setDirectPaymentModalOpen(false);
      loadClaims();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to record direct payment', 'error');
    } finally {
      setSubmittingDirectPayment(false);
    }
  };

  // -------------------------------------------------------------------------
  // CATEGORIES (TAB 3)
  // -------------------------------------------------------------------------
  const loadCategories = async () => {
    setLoadingCategories(true);
    try {
      const res = await assetsLoansApi.getReimbursementCategories();
      const list = Array.isArray(res) ? res : res?.data || res?.categories || [];
      setCategories(list);
    } catch (err) {
      showToast('Failed to load reimbursement categories', 'error');
    } finally {
      setLoadingCategories(false);
    }
  };

  const openCategoryModal = (cat = null) => {
    if (cat) {
      setEditingCategoryId(cat._id);
      setCategoryForm({
        name: cat.name || '',
        code: cat.code || '',
        monthlyCap: cat.monthlyCap ?? cat.maxLimit ?? 10000,
        isCapHardEnforced: cat.isCapHardEnforced ?? false,
        company: cat.company?._id || cat.company || companies[0]?._id || '',
        isActive: cat.isActive !== undefined ? cat.isActive : true,
      });
    } else {
      setEditingCategoryId(null);
      setCategoryForm({
        name: '',
        code: '',
        monthlyCap: 10000,
        isCapHardEnforced: false,
        company: companies[0]?._id || '',
        isActive: true,
      });
    }
    setCategoryModalOpen(true);
  };

  const handleSaveCategory = async (e) => {
    e.preventDefault();
    setSubmittingCategory(true);
    try {
      const payload = {
        name: categoryForm.name,
        code: (categoryForm.code || categoryForm.name || '').toUpperCase().replace(/\s+/g, '_'),
        monthlyCap: Number(categoryForm.monthlyCap) || 10000,
        isCapHardEnforced: Boolean(categoryForm.isCapHardEnforced),
        company: categoryForm.company || undefined,
        isActive: Boolean(categoryForm.isActive),
      };
      if (editingCategoryId) {
        await assetsLoansApi.updateReimbursementCategory(editingCategoryId, payload);
        showToast('Category updated successfully!', 'success');
      } else {
        await assetsLoansApi.createReimbursementCategory(payload);
        showToast('New reimbursement category created!', 'success');
      }
      setCategoryModalOpen(false);
      loadCategories();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to save category', 'error');
    } finally {
      setSubmittingCategory(false);
    }
  };

  // -------------------------------------------------------------------------
  // LOANS & ADVANCES (TAB 4)
  // -------------------------------------------------------------------------
  const loadLoans = async () => {
    setLoadingLoans(true);
    try {
      let res;
      if (loansViewMode === 'pending') {
        res = await assetsLoansApi.getPendingApprovalLoans();
      } else if (loansViewMode === 'me') {
        res = await assetsLoansApi.getMyLoans();
      } else {
        res = await assetsLoansApi.getAllLoans();
      }
      const list = extractApiData(res, 'loans', 'requests', 'data');
      setLoans(list);
    } catch (err) {
      showToast('Failed to load loan requests', 'error');
    } finally {
      setLoadingLoans(false);
    }
  };

  const loadLoanTypes = async () => {
    setLoadingLoanTypes(true);
    try {
      const res = await assetsLoansApi.getLoanTypes();
      const list = Array.isArray(res) ? res : res?.data || res?.loanTypes || [];
      setLoanTypes(list);
    } catch (err) {
      showToast('Failed to load loan types', 'error');
    } finally {
      setLoadingLoanTypes(false);
    }
  };

  // Filtered loans memo
  const filteredLoans = useMemo(() => {
    return loans.filter((item) => {
      // 1. Text search across employee name, code, loan type, reason, and disbursement reference
      if (loanSearchTerm.trim()) {
        const q = loanSearchTerm.toLowerCase();
        const empName = getEmployeeName(item.employee).toLowerCase();
        const empCode = getEmployeeCode(item.employee).toLowerCase();
        const typeName = (item.loanType?.name || item.loanType || '').toLowerCase();
        const reason = (item.reason || item.purpose || '').toLowerCase();
        const ref = (item.disbursementReference || '').toLowerCase();
        if (
          !empName.includes(q) &&
          !empCode.includes(q) &&
          !typeName.includes(q) &&
          !reason.includes(q) &&
          !ref.includes(q)
        ) {
          return false;
        }
      }

      // 2. Status filter
      if (loanStatusFilter !== 'ALL') {
        const s = item.status || 'PENDING';
        if (s !== loanStatusFilter) return false;
      }

      // 3. Loan Type filter
      if (loanTypeFilter !== 'ALL') {
        const tId = item.loanType?._id || item.loanType;
        if (tId !== loanTypeFilter) return false;
      }

      return true;
    });
  }, [loans, loanSearchTerm, loanStatusFilter, loanTypeFilter]);

  // View Loan Details Modal (GET /loans/requests/:id)
  const openViewLoanModal = async (loan) => {
    setViewLoanModalOpen(true);
    setLoadingLoanDetail(true);
    setViewingLoan(loan);
    try {
      const res = await assetsLoansApi.getLoanRequestById(loan._id);
      const detail = res?.data || res?.request || res || loan;
      setViewingLoan(detail);
    } catch (err) {
      console.error('Failed to load loan request details:', err);
      setViewingLoan(loan);
    } finally {
      setLoadingLoanDetail(false);
    }
  };

  // Open Apply for Loan Modal (POST /loans/requests)
  const openLoanModal = () => {
    const selectedType = loanTypes[0];
    setLoanForm({
      employeeId: loanForm.employeeId || employees[0]?._id || employees[0]?.id || '',
      loanTypeId: selectedType?._id || '',
      amount: selectedType?.maxAmount ? Math.min(25000, selectedType.maxAmount) : 25000,
      tenureMonths: selectedType?.maxTenureMonths ? Math.min(6, selectedType.maxTenureMonths) : 6,
      purpose: '',
    });
    setLoanModalOpen(true);
  };

  const handleCreateLoan = async (e) => {
    e.preventDefault();
    setSubmittingLoan(true);
    try {
      const selectedType = loanTypes.find((lt) => lt._id === loanForm.loanTypeId);
      const requestedAmt = Number(loanForm.amount);
      const requestedTenure = Number(loanForm.tenureMonths);

      if (selectedType) {
        if (selectedType.maxAmount && requestedAmt > selectedType.maxAmount) {
          showToast(`Amount exceeds policy maximum of ₹${selectedType.maxAmount.toLocaleString()}`, 'warning');
          setSubmittingLoan(false);
          return;
        }
        if (selectedType.maxTenureMonths && requestedTenure > selectedType.maxTenureMonths) {
          showToast(`Tenure exceeds policy maximum of ${selectedType.maxTenureMonths} months`, 'warning');
          setSubmittingLoan(false);
          return;
        }
      }

      const payload = {
        employee: loanForm.employeeId || (user?._id || user?.id),
        loanType: loanForm.loanTypeId || (loanTypes[0]?._id),
        requestedAmount: requestedAmt,
        requestedTenureMonths: requestedTenure,
        reason: loanForm.purpose || 'Salary Advance / Loan Request',
      };

      await assetsLoansApi.createLoanRequest(payload);
      showToast('Loan request submitted successfully!', 'success');
      setLoanModalOpen(false);
      loadLoans();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to submit loan request', 'error');
    } finally {
      setSubmittingLoan(false);
    }
  };

  // Open Decide Modal (PUT /loans/requests/:id/decide)
  const openLoanDecideModal = (loan, decision) => {
    setSelectedLoanForDecision(loan);
    setLoanDecision(decision);
    setApprovedLoanAmount(loan.approvedAmount || loan.requestedAmount || loan.amount || '');
    setApprovedLoanTenure(loan.approvedTenureMonths || loan.requestedTenureMonths || loan.tenureMonths || 6);
    setLoanDecisionRemark(decision === 'APPROVED' ? 'Approved for disbursement subject to standard payroll recovery' : '');
    setLoanDecideModalOpen(true);
  };

  const handleSaveLoanDecision = async (e) => {
    e.preventDefault();
    setSubmittingLoanDecision(true);
    try {
      await assetsLoansApi.decideLoanRequest(selectedLoanForDecision._id, {
        decision: loanDecision,
        approvedAmount: Number(approvedLoanAmount),
        approvedTenureMonths: Number(approvedLoanTenure),
        remark: loanDecisionRemark,
      });
      showToast(`Loan request has been ${loanDecision}!`, 'success');
      setLoanDecideModalOpen(false);
      loadLoans();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to decide loan request', 'error');
    } finally {
      setSubmittingLoanDecision(false);
    }
  };

  // Cancel Loan Request (PUT /loans/requests/:id/cancel)
  const handleCancelLoan = async (loanId) => {
    const isConfirmed = await confirm({
      title: 'Cancel Loan Request',
      message: 'Are you sure you want to cancel this pending loan request?',
      confirmText: 'Cancel Loan',
      cancelText: 'Keep Loan',
      variant: 'danger',
    });
    if (!isConfirmed) return;
    try {
      await assetsLoansApi.cancelLoanRequest(loanId);
      showToast('Loan request has been cancelled', 'info');
      loadLoans();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to cancel loan request', 'error');
    }
  };

  // Open Disburse Modal (POST /loans/requests/:id/disburse)
  const openDisburseModal = (loan) => {
    setSelectedLoanForDisburse(loan);
    setDisburseForm({
      disbursementReference: `BANK-TRF-LN-${Date.now().toString().slice(-6)}`,
      disbursedAt: new Date().toISOString().split('T')[0],
    });
    setDisburseModalOpen(true);
  };

  const handleDisburseLoan = async (e) => {
    e.preventDefault();
    setSubmittingDisburse(true);
    try {
      await assetsLoansApi.disburseLoan(selectedLoanForDisburse._id, {
        disbursementReference: disburseForm.disbursementReference,
        disbursedAt: new Date(disburseForm.disbursedAt).toISOString(),
      });
      showToast('Loan disbursed successfully! Repayment schedule created.', 'success');
      setDisburseModalOpen(false);
      loadLoans();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to disburse loan', 'error');
    } finally {
      setSubmittingDisburse(false);
    }
  };

  // Open EMI Schedule Modal (GET /loans/:id/emi-schedule)
  const handleOpenSchedule = async (loan) => {
    setActiveLoanForSchedule(loan);
    setScheduleModalOpen(true);
    setLoadingSchedule(true);
    try {
      const loanTargetId = loan.loan?._id || loan.loanId || loan._id;
      const res = await assetsLoansApi.getLoanEmiSchedule(loanTargetId);
      const list = Array.isArray(res) ? res : res?.data || res?.schedule || res?.emiSchedule || [];
      setEmiSchedule(list);
    } catch (err) {
      console.warn('EMI schedule endpoint error, falling back to details:', err);
      try {
        const detailRes = await assetsLoansApi.getLoanRequestById(loan._id);
        const req = detailRes?.data || detailRes?.request || detailRes;
        if (req?.emiSchedule || req?.loan?.emiSchedule) {
          setEmiSchedule(req.emiSchedule || req.loan.emiSchedule);
        } else {
          setEmiSchedule([]);
        }
      } catch {
        setEmiSchedule([]);
      }
    } finally {
      setLoadingSchedule(false);
    }
  };

  // Mark an EMI installment as PAID (PUT /loans/:loanId/emi-schedule/:periodKey/mark-paid)
  const handleMarkEmiPaid = async (periodKey, installmentNo) => {
    if (!periodKey) {
      showToast('Period identifier required to mark installment as paid', 'warning');
      return;
    }
    const targetLoanId = activeLoanForSchedule?.loan?._id || activeLoanForSchedule?.loanId || activeLoanForSchedule?._id;
    const actionKey = periodKey || installmentNo;
    setSubmittingMarkPaid((prev) => ({ ...prev, [actionKey]: true }));
    try {
      await assetsLoansApi.markEmiPaid(targetLoanId, periodKey, {
        paidAt: new Date().toISOString(),
      });
      showToast(`Installment (${periodKey}) marked as PAID!`, 'success');
      // Refresh EMI schedule
      const res = await assetsLoansApi.getLoanEmiSchedule(targetLoanId);
      const list = Array.isArray(res) ? res : res?.data || res?.schedule || res?.emiSchedule || [];
      setEmiSchedule(list);
      loadLoans();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to mark installment as paid', 'error');
    } finally {
      setSubmittingMarkPaid((prev) => ({ ...prev, [actionKey]: false }));
    }
  };

  // Loan Types Management Handlers (GET/POST/PUT/DELETE /loan-types)
  const openLoanTypeModal = (type = null) => {
    if (type) {
      setEditingLoanTypeId(type._id);
      setLoanTypeForm({
        name: type.name || '',
        category: type.category || 'ADVANCE',
        company: type.company?._id || type.company || companies[0]?._id || '',
        maxAmount: type.maxAmount ?? 50000,
        maxTenureMonths: type.maxTenureMonths ?? 6,
        interestRatePercent: type.interestRatePercent ?? 0,
        minimumServiceMonthsRequired: type.minimumServiceMonthsRequired ?? 0,
        isActive: type.isActive !== undefined ? type.isActive : true,
      });
    } else {
      setEditingLoanTypeId(null);
      setLoanTypeForm({
        name: '',
        category: 'ADVANCE',
        company: companies[0]?._id || '',
        maxAmount: 50000,
        maxTenureMonths: 6,
        interestRatePercent: 0,
        minimumServiceMonthsRequired: 0,
        isActive: true,
      });
    }
    setLoanTypeModalOpen(true);
  };

  const handleSaveLoanType = async (e) => {
    e.preventDefault();
    setSubmittingLoanType(true);
    try {
      const payload = {
        name: loanTypeForm.name,
        category: loanTypeForm.category,
        company: loanTypeForm.company || companies[0]?._id,
        maxAmount: Number(loanTypeForm.maxAmount),
        maxTenureMonths: Number(loanTypeForm.maxTenureMonths),
        interestRatePercent: Number(loanTypeForm.interestRatePercent) || 0,
        minimumServiceMonthsRequired: Number(loanTypeForm.minimumServiceMonthsRequired) || 0,
        isActive: Boolean(loanTypeForm.isActive),
      };
      if (editingLoanTypeId) {
        await assetsLoansApi.updateLoanType(editingLoanTypeId, payload);
        showToast('Loan type updated successfully!', 'success');
      } else {
        await assetsLoansApi.createLoanType(payload);
        showToast('New loan type created successfully!', 'success');
      }
      setLoanTypeModalOpen(false);
      loadLoanTypes();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to save loan type', 'error');
    } finally {
      setSubmittingLoanType(false);
    }
  };

  const handleDeleteLoanType = async (id) => {
    const isConfirmed = await confirm({
      title: 'Deactivate Loan Type',
      message: 'Are you sure you want to deactivate/delete this loan type?',
      confirmText: 'Deactivate',
      cancelText: 'Cancel',
      variant: 'danger',
    });
    if (!isConfirmed) return;
    try {
      await assetsLoansApi.deleteLoanType(id);
      showToast('Loan type removed/deactivated', 'info');
      loadLoanTypes();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to remove loan type', 'error');
    }
  };

  // =========================================================================
  // TABLE COLUMNS
  // =========================================================================

  // Assets Table Columns
  const assetColumns = [
    {
      header: 'Asset Details',
      key: 'name',
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
            <Laptop size={20} />
          </div>
          <div>
            <div style={{ fontWeight: 600 }}>{r.name}</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Tag: <strong>{r.assetTag}</strong> {r.model ? `• ${r.model}` : ''}
            </div>
          </div>
        </div>
      ),
    },
    {
      header: 'Category',
      key: 'category',
      render: (r) => <Badge variant="secondary">{r.category || 'Hardware'}</Badge>,
    },
    {
      header: 'Current Custody',
      key: 'assignedTo',
      render: (r) => {
        const emp = r.currentAssignment?.employee || r.assignment?.employee;
        return emp ? (
          <div>
            <div style={{ fontWeight: 600 }}>
              {getEmployeeName(emp)}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {getEmployeeCode(emp) !== '-' ? `Code: ${getEmployeeCode(emp)} • ` : ''}Since {new Date(r.currentAssignment?.assignedAt || Date.now()).toLocaleDateString()}
            </div>
          </div>
        ) : (
          <span style={{ color: 'var(--text-muted)' }}>In IT / Tool Stock</span>
        );
      },
    },
    {
      header: 'Status',
      key: 'status',
      render: (r) => {
        const s = getAssetStatus(r);
        const colors = {
          AVAILABLE: 'success',
          UNASSIGNED: 'success',
          ASSIGNED: 'primary',
          IN_REPAIR: 'warning',
          DAMAGED: 'warning',
          LOST: 'danger',
          RETIRED: 'danger',
        };
        const label = s === 'UNASSIGNED' ? 'AVAILABLE' : s;
        return <Badge variant={colors[s] || 'secondary'}>{label}</Badge>;
      },
    },
    {
      header: 'Actions',
      key: 'actions',
      render: (r) => {
        const s = getAssetStatus(r);
        const isAssigned = s === 'ASSIGNED' || Boolean(r.currentAssignment);
        const isRetired = s === 'RETIRED';
        const isAvailable = (s === 'UNASSIGNED' || s === 'AVAILABLE') && !isAssigned;

        return (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <Button size="sm" variant="outline" icon={Eye} title="View Asset Details" onClick={() => openViewAssetModal(r)} />
            {isAvailable && (
              <Button size="sm" variant="primary" icon={UserCheck} onClick={() => openAssignModal(r)}>
                Assign
              </Button>
            )}
            {isRetired && (
              <Button size="sm" variant="light" icon={RotateCcw} title="Reactivate asset to make available for assignment" onClick={() => handleReactivateAsset(r._id)}>
                Reactivate
              </Button>
            )}
            {isAssigned && (
              <>
                <Button size="sm" variant="secondary" icon={RotateCcw} onClick={() => openReturnModal(r)}>
                  Return
                </Button>
                <Button size="sm" variant="outline" icon={AlertTriangle} title="Report Damage / Loss" onClick={() => openDamageModal(r)} />
                <Button size="sm" variant="outline" icon={DollarSign} title="Cost Recovery Decision" onClick={() => openRecoveryModal(r)} />
                {(r.currentAssignment?.recoveryDecision || r.currentAssignment?.damageReported) && (
                  <Button
                    size="sm"
                    variant="light"
                    icon={CheckCircle2}
                    title="Mark Cost Recovered Outside Payroll (Cash / Cheque)"
                    onClick={() => handleMarkRecoveredOutsidePayroll(r.currentAssignment?._id || r._id)}
                  >
                    Outside Settlement
                  </Button>
                )}
              </>
            )}
            <Button size="sm" variant="outline" icon={History} title="Custody History" onClick={() => openHistoryModal(r)} />
            <Button size="sm" variant="outline" icon={Edit2} onClick={() => openAssetModal(r)} />
            {!isRetired && !isAssigned && (
              <Button size="sm" variant="danger" icon={Ban} title="Retire Asset" onClick={() => handleRetireAsset(r._id)} />
            )}
          </div>
        );
      },
    },
  ];

  // Claims Table Columns
  const claimColumns = [
    {
      header: 'Expense Claim',
      key: 'title',
      render: (r) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: '8px',
              backgroundColor: '#fff7e6',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fa8c16',
            }}
          >
            <Receipt size={20} />
          </div>
          <div>
            <div style={{ fontWeight: 600 }}>{r.title}</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              {r.category?.name || r.category || 'General'} • {r.description || 'No description'}
            </div>
          </div>
        </div>
      ),
    },
    {
      header: 'Claimed By',
      key: 'employee',
      render: (r) => (
        <div>
          <div style={{ fontWeight: 500 }}>
            {getEmployeeName(r.employee)}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{getEmployeeCode(r.employee)}</div>
        </div>
      ),
    },
    {
      header: 'Amount',
      key: 'amount',
      render: (r) => <span style={{ fontWeight: 700 }}>₹{(r.amount || 0).toLocaleString()}</span>,
    },
    {
      header: 'Settlement',
      key: 'settlementType',
      render: (r) => <Badge variant="neutral">{r.settlementType || 'PAYROLL'}</Badge>,
    },
    {
      header: 'Status',
      key: 'status',
      render: (r) => {
        const s = r.status || 'PENDING';
        const colors = {
          PENDING: 'warning',
          APPROVED: 'success',
          PARTIALLY_APPROVED: 'purple',
          REJECTED: 'danger',
          PAID: 'success',
          CANCELLED: 'secondary',
        };
        return <Badge variant={colors[s] || 'secondary'}>{s}</Badge>;
      },
    },
    {
      header: 'Actions',
      key: 'actions',
      render: (r) => {
        const isPending = r.status === 'PENDING';
        const isApproved = r.status === 'APPROVED' || r.status === 'PARTIALLY_APPROVED';
        const isDirect = (r.disbursementMethod === 'DIRECT_PAYMENT' || r.settlementType === 'DIRECT_PAYMENT');
        const isDirectPaid = Boolean(r.directPaymentPaidAt || r.paymentStatus === 'PAID');
        return (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <Button size="sm" variant="outline" icon={Eye} title="View Claim Details & Receipts" onClick={() => openViewClaimModal(r)} />
            {isPending && canManage && (
              <>
                <Button size="sm" variant="primary" icon={Check} onClick={() => openClaimDecideModal(r, 'APPROVED')}>
                  Approve
                </Button>
                <Button size="sm" variant="danger" icon={X} onClick={() => openClaimDecideModal(r, 'REJECTED')}>
                  Reject
                </Button>
              </>
            )}
            {isPending && !canManage && (
              <Button size="sm" variant="secondary" icon={Ban} onClick={() => handleCancelClaim(r._id)}>
                Cancel
              </Button>
            )}
            {isApproved && isDirect && !isDirectPaid && (
              <Button size="sm" variant="primary" icon={DollarSign} onClick={() => openDirectPaymentModal(r)}>
                Settle Payment
              </Button>
            )}
          </div>
        );
      },
    },
  ];

  // Categories Table Columns
  const categoryColumns = [
    {
      header: 'Category Name',
      key: 'name',
      render: (r) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Settings size={16} color="var(--primary)" />
          <span style={{ fontWeight: 600 }}>{r.name}</span>
        </div>
      ),
    },
    {
      header: 'Code',
      key: 'code',
      render: (r) => <code>{r.code || '-'}</code>,
    },
    {
      header: 'Monthly Limit / Cap',
      key: 'monthlyCap',
      render: (r) => {
        const cap = r.monthlyCap ?? r.maxLimit;
        return <span style={{ fontWeight: 600 }}>{cap ? `₹${Number(cap).toLocaleString()}` : 'No Cap'}</span>;
      },
    },
    {
      header: 'Cap Policy',
      key: 'isCapHardEnforced',
      render: (r) => (
        <Badge variant={r.isCapHardEnforced ? 'danger' : 'neutral'}>
          {r.isCapHardEnforced ? 'Hard Cap (Strict)' : 'Flexible Cap'}
        </Badge>
      ),
    },
    {
      header: 'Status',
      key: 'isActive',
      render: (r) => (
        <Badge variant={r.isActive !== false ? 'success' : 'secondary'}>
          {r.isActive !== false ? 'ACTIVE' : 'INACTIVE'}
        </Badge>
      ),
    },
    {
      header: 'Actions',
      key: 'actions',
      render: (r) => (
        <Button size="sm" variant="secondary" icon={Edit2} onClick={() => openCategoryModal(r)}>
          Edit Category
        </Button>
      ),
    },
  ];

  // Loans Table Columns
  const loanColumns = [
    {
      header: 'Borrower',
      key: 'employee',
      render: (r) => (
        <div>
          <div style={{ fontWeight: 600 }}>{getEmployeeName(r.employee)}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {getEmployeeCode(r.employee) !== '-' ? `Code: ${getEmployeeCode(r.employee)}` : ''}
            {r.employee?.department?.name ? ` • ${r.employee.department.name}` : ''}
          </div>
        </div>
      ),
    },
    {
      header: 'Loan Type & Purpose',
      key: 'loanType',
      render: (r) => {
        const typeName = r.loanType?.name || (typeof r.loanType === 'string' ? r.loanType : 'Salary Advance / Loan');
        const cat = r.loanType?.category || 'ADVANCE';
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: '8px',
                backgroundColor: cat === 'ADVANCE' ? '#e6f7ff' : '#f6ffed',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: cat === 'ADVANCE' ? '#1890ff' : '#52c41a',
              }}
            >
              <HandCoins size={20} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontWeight: 600 }}>{typeName}</span>
                <Badge variant={cat === 'ADVANCE' ? 'primary' : 'success'}>{cat}</Badge>
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {r.reason || r.purpose || 'No purpose recorded'}
              </div>
            </div>
          </div>
        );
      },
    },
    {
      header: 'Requested & Terms',
      key: 'amount',
      render: (r) => {
        const reqAmt = r.requestedAmount || r.amount || 0;
        const reqTenure = r.requestedTenureMonths || r.tenureMonths || 6;
        const appAmt = r.approvedAmount;
        const appTenure = r.approvedTenureMonths;
        const isApprovedOrDisbursed = r.status === 'APPROVED' || r.status === 'DISBURSED';
        const finalAmt = isApprovedOrDisbursed && appAmt ? appAmt : reqAmt;
        const finalTenure = isApprovedOrDisbursed && appTenure ? appTenure : reqTenure;
        const monthlyEmi = finalTenure > 0 ? Math.round(finalAmt / finalTenure) : 0;

        return (
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>
              ₹{finalAmt.toLocaleString()}
              {isApprovedOrDisbursed && appAmt && appAmt !== reqAmt && (
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textDecoration: 'line-through', marginLeft: 6 }}>
                  ₹{reqAmt.toLocaleString()}
                </span>
              )}
            </div>
            <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
              Tenure: {finalTenure} Mos • EMI: ~₹{monthlyEmi.toLocaleString()}/mo
            </div>
          </div>
        );
      },
    },
    {
      header: 'Status',
      key: 'status',
      render: (r) => {
        const s = r.status || 'PENDING';
        const colors = {
          PENDING: 'warning',
          APPROVED: 'primary',
          DISBURSED: 'success',
          REJECTED: 'danger',
          CANCELLED: 'secondary',
          CLOSED: 'secondary',
        };
        return <Badge variant={colors[s] || 'secondary'}>{s}</Badge>;
      },
    },
    {
      header: 'Actions',
      key: 'actions',
      render: (r) => {
        const isPending = r.status === 'PENDING';
        const isApproved = r.status === 'APPROVED';
        const isDisbursed = r.status === 'DISBURSED' || Boolean(r.disbursedAt);

        return (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {/* View Details */}
            <Button
              size="sm"
              variant="outline"
              icon={Eye}
              title="View Loan Details"
              onClick={() => openViewLoanModal(r)}
            />

            {/* Admin Decision Actions */}
            {isPending && canManage && (
              <>
                <Button
                  size="sm"
                  variant="primary"
                  icon={Check}
                  title="Approve Loan Request"
                  onClick={() => openLoanDecideModal(r, 'APPROVED')}
                >
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  icon={X}
                  title="Reject Loan Request"
                  onClick={() => openLoanDecideModal(r, 'REJECTED')}
                >
                  Reject
                </Button>
              </>
            )}

            {/* Cancel Pending Request */}
            {isPending && (
              <Button
                size="sm"
                variant="outline"
                icon={Ban}
                title="Cancel Request"
                onClick={() => handleCancelLoan(r._id)}
              />
            )}

            {/* Admin Disburse Action */}
            {isApproved && canManage && (
              <Button
                size="sm"
                variant="primary"
                icon={DollarSign}
                style={{ backgroundColor: '#52c41a', borderColor: '#52c41a' }}
                title="Disburse Funds & Generate EMI Schedule"
                onClick={() => openDisburseModal(r)}
              >
                Disburse
              </Button>
            )}

            {/* EMI Schedule Viewer */}
            {(isDisbursed || isApproved) && (
              <Button
                size="sm"
                variant="secondary"
                icon={Calendar}
                title="View Repayment Schedule"
                onClick={() => handleOpenSchedule(r)}
              >
                Schedule
              </Button>
            )}
          </div>
        );
      },
    },
  ];

  // Loan Types Table Columns
  const loanTypeColumns = [
    {
      header: 'Loan / Advance Type',
      key: 'name',
      render: (r) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: '8px',
              backgroundColor: '#f6ffed',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#52c41a',
            }}
          >
            <HandCoins size={20} />
          </div>
          <div>
            <div style={{ fontWeight: 600 }}>{r.name}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Category: <strong>{r.category || 'ADVANCE'}</strong>
              {r.company?.name ? ` • ${r.company.name}` : ''}
            </div>
          </div>
        </div>
      ),
    },
    {
      header: 'Category',
      key: 'category',
      render: (r) => (
        <Badge variant={r.category === 'ADVANCE' ? 'primary' : 'success'}>
          {r.category || 'ADVANCE'}
        </Badge>
      ),
    },
    {
      header: 'Limits & Policy',
      key: 'limits',
      render: (r) => (
        <div>
          <div style={{ fontWeight: 600 }}>Max: ₹{(r.maxAmount || 0).toLocaleString()}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Max Tenure: {r.maxTenureMonths || 0} Months
          </div>
        </div>
      ),
    },
    {
      header: 'Interest & Service',
      key: 'interest',
      render: (r) => (
        <div>
          <div style={{ fontWeight: 500 }}>
            {r.interestRatePercent ? `${r.interestRatePercent}% p.a.` : '0% Interest-Free'}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Min Service: {r.minimumServiceMonthsRequired || 0} Months
          </div>
        </div>
      ),
    },
    {
      header: 'Status',
      key: 'isActive',
      render: (r) => (
        <Badge variant={r.isActive ? 'success' : 'secondary'}>
          {r.isActive ? 'ACTIVE' : 'INACTIVE'}
        </Badge>
      ),
    },
    {
      header: 'Actions',
      key: 'actions',
      render: (r) => (
        <div style={{ display: 'flex', gap: 6 }}>
          <Button size="sm" variant="secondary" icon={Edit2} onClick={() => openLoanTypeModal(r)}>
            Edit
          </Button>
          <Button size="sm" variant="danger" icon={Trash2} onClick={() => handleDeleteLoanType(r._id)} />
        </div>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Top Header */}
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
            Assets, Claims &amp; Loans
          </h2>
        </div>

        {/* Tab Specific Action Buttons */}
        <div style={{ display: 'flex', gap: 8 }}>
          {activeTab === 'assets' && (
            <Button variant="primary" icon={Plus} onClick={() => openAssetModal()}>
              Register Asset
            </Button>
          )}
          {activeTab === 'claims' && (
            <Button variant="primary" icon={Plus} onClick={() => setClaimModalOpen(true)}>
              File Expense Claim
            </Button>
          )}
          {activeTab === 'categories' && (
            <Button variant="primary" icon={Plus} onClick={() => openCategoryModal()}>
              New Expense Category
            </Button>
          )}
          {activeTab === 'loans' && (
            <div style={{ display: 'flex', gap: 8 }}>
              {canManage && (
                <Button variant="secondary" icon={Settings} onClick={() => openLoanTypeModal()}>
                  New Loan Type
                </Button>
              )}
              <Button variant="primary" icon={Plus} onClick={openLoanModal}>
                Apply for Loan
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Modern Tab Bar */}
      <div
        style={{
          display: 'flex',
          gap: 6,
          background: '#fff',
          padding: '6px',
          borderRadius: 10,
          border: '1px solid var(--border-color)',
          width: 'fit-content',
          marginBottom: 16,
          flexWrap: 'wrap',
        }}
      >
        {[
          { key: 'assets', label: `Physical Assets (${assets.length})`, icon: Laptop },
          { key: 'clearance', label: 'Employee Asset Clearance & No-Due', icon: ShieldCheck },
          { key: 'claims', label: `Reimbursements & Claims (${claims.length})`, icon: Receipt },
          { key: 'categories', label: `Expense Categories (${categories.length})`, icon: Settings },
          { key: 'loans', label: `Loans & Advances (${loans.length})`, icon: HandCoins },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 16px',
                borderRadius: 7,
                border: 'none',
                fontSize: '0.84rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s ease-in-out',
                background: isActive ? 'var(--primary)' : 'transparent',
                color: isActive ? '#fff' : 'var(--text-muted)',
              }}
            >
              <Icon size={16} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: ASSETS CONTENT */}
      {activeTab === 'assets' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Quick Metrics Bar */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: 12,
            }}
          >
            <div className="card" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 8, background: '#e6f4ff', color: '#1677ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Laptop size={22} />
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Total Inventory</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>{assets.length}</div>
              </div>
            </div>

            <div className="card" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 8, background: '#f6ffed', color: '#52c41a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CheckCircle2 size={22} />
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Available in Stock</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#52c41a' }}>
                  {assets.filter((a) => {
                    const s = getAssetStatus(a);
                    return (s === 'UNASSIGNED' || s === 'AVAILABLE') && !a.currentAssignment;
                  }).length}
                </div>
              </div>
            </div>

            <div className="card" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 8, background: '#f0f5ff', color: '#2f54eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <UserCheck size={22} />
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Issued / In Custody</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#2f54eb' }}>
                  {assets.filter((a) => getAssetStatus(a) === 'ASSIGNED' || Boolean(a.currentAssignment)).length}
                </div>
              </div>
            </div>

            <div className="card" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 8, background: '#fffbe6', color: '#faad14', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <AlertTriangle size={22} />
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>In Repair / Damaged</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#d48806' }}>
                  {assets.filter((a) => {
                    const s = getAssetStatus(a);
                    return s === 'IN_REPAIR' || s === 'DAMAGED' || s === 'LOST';
                  }).length}
                </div>
              </div>
            </div>

            <div className="card" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 8, background: '#fff1f0', color: '#f5222d', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Ban size={22} />
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Retired</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#cf1322' }}>
                  {assets.filter((a) => getAssetStatus(a) === 'RETIRED').length}
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            {/* Search & Filters Bar */}
            <div
              style={{
                padding: '12px 16px',
                borderBottom: '1px solid var(--border-color)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 12,
                backgroundColor: 'var(--bg-subtle)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 260 }}>
                <div style={{ position: 'relative', width: '100%', maxWidth: 320 }}>
                  <Search
                    size={16}
                    style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}
                  />
                  <input
                    type="text"
                    value={assetSearchTerm}
                    onChange={(e) => setAssetSearchTerm(e.target.value)}
                    placeholder="Search name, tag, serial, employee..."
                    style={{
                      width: '100%',
                      padding: '7px 10px 7px 32px',
                      borderRadius: 6,
                      border: '1px solid var(--border-color)',
                      fontSize: '0.84rem',
                      outline: 'none',
                    }}
                  />
                </div>

                <select
                  value={assetCategoryFilter}
                  onChange={(e) => setAssetCategoryFilter(e.target.value)}
                  style={{
                    padding: '7px 12px',
                    borderRadius: 6,
                    border: '1px solid var(--border-color)',
                    fontSize: '0.84rem',
                    background: '#fff',
                    outline: 'none',
                  }}
                >
                  <option value="ALL">All Categories</option>
                  <option value="LAPTOP">Laptop</option>
                  <option value="MOBILE">Mobile</option>
                  <option value="ID_CARD">ID Card</option>
                  <option value="TOOL">Tool</option>
                  <option value="VEHICLE">Vehicle</option>
                  <option value="UNIFORM">Uniform</option>
                  <option value="OFFICE_EQUIPMENT">Office Equipment</option>
                  <option value="OTHER">Other</option>
                </select>

                <select
                  value={assetStatusFilter}
                  onChange={(e) => setAssetStatusFilter(e.target.value)}
                  style={{
                    padding: '7px 12px',
                    borderRadius: 6,
                    border: '1px solid var(--border-color)',
                    fontSize: '0.84rem',
                    background: '#fff',
                    outline: 'none',
                  }}
                >
                  <option value="ALL">All Statuses</option>
                  <option value="UNASSIGNED">Available / In Stock</option>
                  <option value="ASSIGNED">Assigned (In Custody)</option>
                  <option value="IN_REPAIR">In Repair</option>
                  <option value="DAMAGED">Damaged</option>
                  <option value="LOST">Lost</option>
                  <option value="RETIRED">Retired</option>
                </select>

                {companies.length > 1 && (
                  <select
                    value={assetCompanyFilter}
                    onChange={(e) => setAssetCompanyFilter(e.target.value)}
                    style={{
                      padding: '7px 12px',
                      borderRadius: 6,
                      border: '1px solid var(--border-color)',
                      fontSize: '0.84rem',
                      background: '#fff',
                      outline: 'none',
                    }}
                  >
                    <option value="ALL">All Companies</option>
                    {companies.map((c) => (
                      <option key={c._id} value={c._id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                  Showing {filteredAssets.length} of {assets.length} assets
                </span>
                <Button size="sm" variant="secondary" icon={RefreshCw} onClick={loadAssets}>
                  Refresh
                </Button>
              </div>
            </div>
            <Table columns={assetColumns} data={filteredAssets} loading={loadingAssets} emptyMessage="No matching assets found." />
          </div>
        </div>
      )}

      {/* TAB: EMPLOYEE ASSET CLEARANCE & NO-DUE (Module 20 Clearance & Recovery Link) */}
      {activeTab === 'clearance' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Employee Selector Bar */}
          <div
            className="card"
            style={{
              padding: '16px 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 16,
              background: '#fff',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 280 }}>
              <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-color)', whiteSpace: 'nowrap' }}>
                Employee to Audit:
              </div>
              <div style={{ flex: 1, maxWidth: 380 }}>
                <Select
                  value={selectedClearanceEmployeeId}
                  onChange={(e) => {
                    setSelectedClearanceEmployeeId(e.target.value);
                    loadEmployeeClearance(e.target.value);
                  }}
                  options={employees.map((emp) => ({
                    value: emp._id || emp.id,
                    label: formatEmployeeOption(emp, true),
                  }))}
                  placeholder="Select Employee..."
                />
              </div>
            </div>

            <Button
              size="sm"
              variant="secondary"
              icon={RefreshCw}
              loading={loadingClearance}
              onClick={() => loadEmployeeClearance(selectedClearanceEmployeeId)}
            >
              Refresh Clearance Audit
            </Button>
          </div>

          {/* No Due Clearance Status Banner */}
          {clearanceCert && (
            <div
              style={{
                padding: '18px 22px',
                borderRadius: 12,
                background: (clearanceCert.isCleared || clearanceCert.clearanceStatus === 'CLEARED')
                  ? 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)'
                  : 'linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%)',
                border: `1px solid ${(clearanceCert.isCleared || clearanceCert.clearanceStatus === 'CLEARED') ? '#a7f3d0' : '#fed7aa'}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 14,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: '50%',
                    backgroundColor: (clearanceCert.isCleared || clearanceCert.clearanceStatus === 'CLEARED') ? '#059669' : '#ea580c',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                  }}
                >
                  {(clearanceCert.isCleared || clearanceCert.clearanceStatus === 'CLEARED') ? (
                    <ShieldCheck size={28} />
                  ) : (
                    <AlertTriangle size={28} />
                  )}
                </div>
                <div>
                  <div
                    style={{
                      fontSize: '1.05rem',
                      fontWeight: 700,
                      color: (clearanceCert.isCleared || clearanceCert.clearanceStatus === 'CLEARED') ? '#065f46' : '#9a3412',
                    }}
                  >
                    {(clearanceCert.isCleared || clearanceCert.clearanceStatus === 'CLEARED')
                      ? 'No Due Clearance: APPROVED (Ready for Exit / F&F Settlement)'
                      : 'No Due Clearance: ON HOLD (Pending Asset Dues / Unreturned Items)'}
                  </div>
                  <div
                    style={{
                      fontSize: '0.85rem',
                      color: (clearanceCert.isCleared || clearanceCert.clearanceStatus === 'CLEARED') ? '#047857' : '#c2410c',
                      marginTop: 3,
                    }}
                  >
                    {clearanceCert.message || (
                      (clearanceCert.isCleared || clearanceCert.clearanceStatus === 'CLEARED')
                        ? 'Employee has zero pending asset dues and has returned all assigned physical equipment.'
                        : 'Employee still has active hardware in custody or unrecovered damage liability.'
                    )}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <Badge variant={(clearanceCert.isCleared || clearanceCert.clearanceStatus === 'CLEARED') ? 'success' : 'danger'}>
                  {clearanceCert.clearanceStatus || (clearanceCert.isCleared ? 'CLEARED' : 'PENDING')}
                </Badge>
              </div>
            </div>
          )}

          {/* Metrics summary */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: 12,
            }}
          >
            <div className="card" style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 42, height: 42, borderRadius: 8, background: '#f0f5ff', color: '#2f54eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Laptop size={22} />
              </div>
              <div>
                <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>Active Assets in Hand</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#2f54eb' }}>
                  {clearanceAssignments.filter((a) => a.status === 'ISSUED').length}
                </div>
              </div>
            </div>

            <div className="card" style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 42, height: 42, borderRadius: 8, background: '#f6ffed', color: '#52c41a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CheckCircle2 size={22} />
              </div>
              <div>
                <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>Returned Assets</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#52c41a' }}>
                  {clearanceAssignments.filter((a) => a.status === 'RETURNED').length}
                </div>
              </div>
            </div>

            <div className="card" style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 42, height: 42, borderRadius: 8, background: '#fff2e8', color: '#fa541c', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <DollarSign size={22} />
              </div>
              <div>
                <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>Pending Cost Recovery</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#fa541c' }}>
                  ₹{(clearancePendingRecoveries.reduce((sum, item) => sum + (Number(item.recoveryAmount || item.amount) || 0), 0)).toLocaleString()}
                </div>
              </div>
            </div>
          </div>

          {/* Table 1: Employee's Asset Assignments */}
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
              <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                Asset Custody Assignments ({clearanceAssignments.length})
              </div>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Active and historical equipment issued to this employee
              </span>
            </div>

            <Table
              loading={loadingClearance}
              data={clearanceAssignments}
              emptyMessage="No equipment assignments found for this employee."
              columns={[
                {
                  header: 'Asset Name & Tag',
                  key: 'asset',
                  render: (r) => {
                    const ast = r.asset || {};
                    return (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 34, height: 34, borderRadius: 6, background: '#e6f4ff', color: '#1677ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Laptop size={18} />
                        </div>
                        <div>
                          <div style={{ fontWeight: 600 }}>{ast.name || 'Equipment'}</div>
                          <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                            Tag: <strong>{ast.assetTag || r.assetTag || '-'}</strong> • Category: {ast.category || '-'}
                          </div>
                        </div>
                      </div>
                    );
                  },
                },
                {
                  header: 'Issued Date',
                  key: 'issuedAt',
                  render: (r) => (
                    <div>
                      <div>{r.issuedAt ? new Date(r.issuedAt).toLocaleDateString() : '-'}</div>
                      <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                        Condition: {r.conditionAtIssue || 'GOOD'}
                      </div>
                    </div>
                  ),
                },
                {
                  header: 'Return Details',
                  key: 'returnedAt',
                  render: (r) => (
                    <div>
                      <div>{r.returnedAt ? new Date(r.returnedAt).toLocaleDateString() : <span style={{ color: '#fa8c16' }}>Not Returned</span>}</div>
                      {r.conditionAtReturn && (
                        <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                          Condition: {r.conditionAtReturn}
                        </div>
                      )}
                    </div>
                  ),
                },
                {
                  header: 'Status',
                  key: 'status',
                  render: (r) => {
                    const st = r.status || (r.returnedAt ? 'RETURNED' : 'ISSUED');
                    const colorMap = {
                      ISSUED: 'primary',
                      RETURNED: 'success',
                      DAMAGED: 'warning',
                      LOST: 'danger',
                    };
                    return <Badge variant={colorMap[st] || 'secondary'}>{st}</Badge>;
                  },
                },
                {
                  header: 'Clearance Actions',
                  key: 'actions',
                  render: (r) => {
                    const isIssued = r.status === 'ISSUED' && !r.returnedAt;
                    const assetObj = r.asset || { _id: r.assetId, name: 'Asset' };
                    return (
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {isIssued && (
                          <>
                            <Button
                              size="sm"
                              variant="secondary"
                              icon={RotateCcw}
                              onClick={() => {
                                setTargetAsset(assetObj);
                                setTargetAssignment(r);
                                setReturnCondition('GOOD');
                                setReturnRemarks('Returned for clearance process');
                                setReturnModalOpen(true);
                              }}
                            >
                              Process Return
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              icon={AlertTriangle}
                              title="Report Damage or Loss"
                              onClick={() => {
                                setTargetAsset(assetObj);
                                setTargetAssignment(r);
                                setDamageForm({
                                  incidentType: 'DAMAGED',
                                  estimatedCost: 5000,
                                  incidentDescription: '',
                                });
                                setDamageModalOpen(true);
                              }}
                            />
                          </>
                        )}
                        {(r.status === 'DAMAGED' || r.status === 'LOST') && (
                          <Button
                            size="sm"
                            variant="light"
                            icon={CheckCircle2}
                            title="Mark Recovered Outside Payroll"
                            onClick={() => handleMarkRecoveredOutsidePayroll(r._id)}
                          >
                            Outside Settlement
                          </Button>
                        )}
                      </div>
                    );
                  },
                },
              ]}
            />
          </div>

          {/* Table 2: Pending Cost Recoveries */}
          {clearancePendingRecoveries.length > 0 && (
            <div className="card">
              <div
                style={{
                  padding: '14px 16px',
                  borderBottom: '1px solid var(--border-color)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  backgroundColor: '#fff7e6',
                }}
              >
                <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#d46b08' }}>
                  Pending Cost Recoveries ({clearancePendingRecoveries.length})
                </div>
                <span style={{ fontSize: '0.8rem', color: '#d46b08' }}>
                  Forward linked with Module 14 (Payroll deductions) or settled outside payroll
                </span>
              </div>

              <Table
                data={clearancePendingRecoveries}
                columns={[
                  {
                    header: 'Description',
                    key: 'description',
                    render: (r) => (
                      <div>
                        <div style={{ fontWeight: 600 }}>{r.description || r.incidentDescription || 'Asset Cost Recovery'}</div>
                        <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                          Asset: {r.asset?.name || r.assetName || 'Hardware Asset'}
                        </div>
                      </div>
                    ),
                  },
                  {
                    header: 'Amount',
                    key: 'recoveryAmount',
                    render: (r) => (
                      <span style={{ fontWeight: 700, color: '#cf1322' }}>
                        ₹{(Number(r.recoveryAmount || r.amount) || 0).toLocaleString()}
                      </span>
                    ),
                  },
                  {
                    header: 'Recovery Mode',
                    key: 'recoveryMode',
                    render: (r) => <Badge variant="secondary">{r.recoveryMode || 'PAYROLL_DEDUCTION'}</Badge>,
                  },
                  {
                    header: 'Status',
                    key: 'status',
                    render: (r) => <Badge variant="warning">{r.status || 'PENDING'}</Badge>,
                  },
                  {
                    header: 'Actions',
                    key: 'actions',
                    render: (r) => (
                      <Button
                        size="sm"
                        variant="primary"
                        icon={CheckCircle2}
                        loading={submittingOutsideRecovery}
                        onClick={() => handleMarkRecoveredOutsidePayroll(r._id || r.assignmentId || r.assignment)}
                      >
                        Settle Outside Payroll
                      </Button>
                    ),
                  },
                ]}
              />
            </div>
          )}
        </div>
      )}

      {/* TAB 2: CLAIMS CONTENT */}
      {activeTab === 'claims' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Claims Metrics Bar */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: 12,
            }}
          >
            <div className="card" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 8, background: '#e6f4ff', color: '#1677ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Receipt size={22} />
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Total Claims Filed</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>{claims.length}</div>
              </div>
            </div>

            <div className="card" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 8, background: '#fffbe6', color: '#faad14', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Clock size={22} />
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Pending Approvals</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#d48806' }}>
                  {claims.filter((c) => c.status === 'PENDING').length}
                </div>
              </div>
            </div>

            <div className="card" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 8, background: '#f6ffed', color: '#52c41a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CheckCircle2 size={22} />
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Approved / Settled</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#52c41a' }}>
                  {claims.filter((c) => c.status === 'APPROVED' || c.status === 'PAID').length}
                </div>
              </div>
            </div>

            <div className="card" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 8, background: '#f0f5ff', color: '#2f54eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <DollarSign size={22} />
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Total Claimed Value</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#2f54eb' }}>
                  ₹{(claims.reduce((acc, c) => acc + (Number(c.totalClaimedAmount || c.amount) || 0), 0)).toLocaleString()}
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            {/* View Mode & Filter Controls */}
            <div
              style={{
                padding: '12px 16px',
                borderBottom: '1px solid var(--border-color)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 12,
                backgroundColor: 'var(--bg-subtle)',
              }}
            >
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => setClaimsViewMode('my')}
                  className={`btn ${claimsViewMode === 'my' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                >
                  My Submitted Claims
                </button>
                {canManage && (
                  <>
                    <button
                      type="button"
                      onClick={() => setClaimsViewMode('pending')}
                      className={`btn ${claimsViewMode === 'pending' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                    >
                      Pending Approvals Queue
                    </button>
                    <button
                      type="button"
                      onClick={() => setClaimsViewMode('all')}
                      className={`btn ${claimsViewMode === 'all' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                    >
                      All Organization Claims
                    </button>
                  </>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <div style={{ position: 'relative', width: 220 }}>
                  <Search
                    size={16}
                    style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}
                  />
                  <input
                    type="text"
                    value={claimSearchTerm}
                    onChange={(e) => setClaimSearchTerm(e.target.value)}
                    placeholder="Search claims..."
                    style={{
                      width: '100%',
                      padding: '6px 10px 6px 32px',
                      borderRadius: 6,
                      border: '1px solid var(--border-color)',
                      fontSize: '0.82rem',
                      outline: 'none',
                    }}
                  />
                </div>

                <select
                  value={claimStatusFilter}
                  onChange={(e) => setClaimStatusFilter(e.target.value)}
                  style={{
                    padding: '6px 10px',
                    borderRadius: 6,
                    border: '1px solid var(--border-color)',
                    fontSize: '0.82rem',
                    background: '#fff',
                    outline: 'none',
                  }}
                >
                  <option value="ALL">All Statuses</option>
                  <option value="PENDING">Pending</option>
                  <option value="APPROVED">Approved</option>
                  <option value="PARTIALLY_APPROVED">Partially Approved</option>
                  <option value="REJECTED">Rejected</option>
                  <option value="PAID">Paid</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>

                <select
                  value={claimMethodFilter}
                  onChange={(e) => setClaimMethodFilter(e.target.value)}
                  style={{
                    padding: '6px 10px',
                    borderRadius: 6,
                    border: '1px solid var(--border-color)',
                    fontSize: '0.82rem',
                    background: '#fff',
                    outline: 'none',
                  }}
                >
                  <option value="ALL">All Routes</option>
                  <option value="PAYROLL">Payroll Addition</option>
                  <option value="DIRECT_PAYMENT">Direct Settlement</option>
                </select>

                <Button size="sm" variant="secondary" icon={RefreshCw} onClick={loadClaims}>
                  Refresh
                </Button>
              </div>
            </div>
            <Table columns={claimColumns} data={filteredClaims} loading={loadingClaims} emptyMessage="No matching expense claims found." />
          </div>
        </div>
      )}

      {/* TAB 3: CATEGORIES CONTENT */}
      {activeTab === 'categories' && (
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
              Expense types, allowed limits, and policy receipt mandates.
            </div>
            <Button size="sm" variant="secondary" icon={RefreshCw} onClick={loadCategories}>
              Refresh Categories
            </Button>
          </div>
          <Table columns={categoryColumns} data={categories} loading={loadingCategories} emptyMessage="No categories configured." />
        </div>
      )}

      {/* TAB 4: LOANS & ADVANCES CONTENT */}
      {activeTab === 'loans' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Quick Metrics Bar */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: 12,
            }}
          >
            <div className="card" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 8, background: '#e6f7ff', color: '#1890ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <HandCoins size={22} />
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Total Requests</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>{loans.length}</div>
              </div>
            </div>

            <div className="card" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 8, background: '#fffbe6', color: '#faad14', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Clock size={22} />
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Pending Approvals</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#faad14' }}>
                  {loans.filter((l) => l.status === 'PENDING').length}
                </div>
              </div>
            </div>

            <div className="card" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 8, background: '#f0f5ff', color: '#2f54eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CheckCircle2 size={22} />
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Approved / Ready</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#2f54eb' }}>
                  {loans.filter((l) => l.status === 'APPROVED').length}
                </div>
              </div>
            </div>

            <div className="card" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 8, background: '#f6ffed', color: '#52c41a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <DollarSign size={22} />
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Disbursed Active</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#52c41a' }}>
                  {loans.filter((l) => l.status === 'DISBURSED' || Boolean(l.disbursedAt)).length}
                </div>
              </div>
            </div>

            <div className="card" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 8, background: '#f9f0ff', color: '#722ed1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <DollarSign size={22} />
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Disbursed Volume</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#722ed1' }}>
                  ₹{(loans.reduce((acc, l) => {
                    if (l.status === 'DISBURSED' || Boolean(l.disbursedAt)) {
                      return acc + (Number(l.approvedAmount || l.requestedAmount || l.amount) || 0);
                    }
                    return acc;
                  }, 0)).toLocaleString()}
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            {/* View Mode & Filter Controls */}
            <div
              style={{
                padding: '12px 16px',
                borderBottom: '1px solid var(--border-color)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 12,
                backgroundColor: 'var(--bg-subtle)',
              }}
            >
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => setLoansViewMode('all')}
                  className={`btn ${loansViewMode === 'all' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                >
                  All Requests
                </button>
                {canManage && (
                  <button
                    type="button"
                    onClick={() => setLoansViewMode('pending')}
                    className={`btn ${loansViewMode === 'pending' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                    style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                  >
                    <span>Pending Approvals</span>
                    {loans.filter((l) => l.status === 'PENDING').length > 0 && (
                      <span
                        style={{
                          backgroundColor: '#faad14',
                          color: '#fff',
                          borderRadius: '10px',
                          padding: '1px 6px',
                          fontSize: '0.7rem',
                          fontWeight: 700,
                        }}
                      >
                        {loans.filter((l) => l.status === 'PENDING').length}
                      </span>
                    )}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setLoansViewMode('me')}
                  className={`btn ${loansViewMode === 'me' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                >
                  My Requests
                </button>
                {canManage && (
                  <button
                    type="button"
                    onClick={() => setLoansViewMode('loan_types')}
                    className={`btn ${loansViewMode === 'loan_types' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                    style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                  >
                    <Settings size={14} />
                    <span>Loan Types ({loanTypes.length})</span>
                  </button>
                )}
              </div>

              {loansViewMode !== 'loan_types' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <div style={{ position: 'relative', width: 220 }}>
                    <Search
                      size={16}
                      style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}
                    />
                    <input
                      type="text"
                      value={loanSearchTerm}
                      onChange={(e) => setLoanSearchTerm(e.target.value)}
                      placeholder="Search borrower, type, purpose..."
                      style={{
                        width: '100%',
                        padding: '6px 10px 6px 32px',
                        borderRadius: 6,
                        border: '1px solid var(--border-color)',
                        fontSize: '0.82rem',
                        outline: 'none',
                      }}
                    />
                  </div>

                  <select
                    value={loanStatusFilter}
                    onChange={(e) => setLoanStatusFilter(e.target.value)}
                    style={{
                      padding: '6px 10px',
                      borderRadius: 6,
                      border: '1px solid var(--border-color)',
                      fontSize: '0.82rem',
                      background: '#fff',
                      outline: 'none',
                    }}
                  >
                    <option value="ALL">All Statuses</option>
                    <option value="PENDING">Pending</option>
                    <option value="APPROVED">Approved</option>
                    <option value="DISBURSED">Disbursed</option>
                    <option value="REJECTED">Rejected</option>
                    <option value="CANCELLED">Cancelled</option>
                  </select>

                  {loanTypes.length > 0 && (
                    <select
                      value={loanTypeFilter}
                      onChange={(e) => setLoanTypeFilter(e.target.value)}
                      style={{
                        padding: '6px 10px',
                        borderRadius: 6,
                        border: '1px solid var(--border-color)',
                        fontSize: '0.82rem',
                        background: '#fff',
                        outline: 'none',
                      }}
                    >
                      <option value="ALL">All Loan Types</option>
                      {loanTypes.map((lt) => (
                        <option key={lt._id} value={lt._id}>
                          {lt.name}
                        </option>
                      ))}
                    </select>
                  )}

                  <Button size="sm" variant="secondary" icon={RefreshCw} onClick={loadLoans}>
                    Refresh
                  </Button>
                </div>
              )}

              {loansViewMode === 'loan_types' && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <Button size="sm" variant="primary" icon={Plus} onClick={() => openLoanTypeModal()}>
                    New Loan Type
                  </Button>
                  <Button size="sm" variant="secondary" icon={RefreshCw} onClick={loadLoanTypes}>
                    Refresh Types
                  </Button>
                </div>
              )}
            </div>

            {/* Table Display */}
            {loansViewMode === 'loan_types' ? (
              <Table
                columns={loanTypeColumns}
                data={loanTypes}
                loading={loadingLoanTypes}
                emptyMessage="No loan types configured. Click 'New Loan Type' to create Salary Advance, Emergency Loan, etc."
              />
            ) : (
              <Table
                columns={loanColumns}
                data={filteredLoans}
                loading={loadingLoans}
                emptyMessage="No loan or advance requests found."
              />
            )}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODALS */}
      {/* ===================================================================== */}

      {/* 1. ASSET MASTER MODAL */}
      <Modal
        isOpen={assetModalOpen}
        onClose={() => setAssetModalOpen(false)}
        title={editingAssetId ? 'Edit Asset Record' : 'Register Physical Asset'}
      >
        <form onSubmit={handleSaveAsset}>
          <Input
            label="Asset Name"
            value={assetForm.name}
            onChange={(e) => setAssetForm({ ...assetForm, name: e.target.value })}
            placeholder="e.g. Dell Latitude 7420 / MacBook Pro M3"
            required
          />
          <div className="grid-2">
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-main, #0f172a)' }}>
                  Asset Tag Code <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <button
                  type="button"
                  onClick={() => {
                    const newTag = `AST-${new Date().getFullYear()}-${String(assets.length + 1).padStart(3, '0')}`;
                    setAssetForm((prev) => ({ ...prev, assetTag: newTag }));
                  }}
                  style={{
                    background: '#f1f5f9',
                    border: '1px solid #cbd5e1',
                    borderRadius: 4,
                    color: 'var(--primary, #3f929a)',
                    fontSize: '0.72rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    padding: '2px 8px',
                  }}
                >
                  Auto
                </button>
              </div>
              <Input
                value={assetForm.assetTag}
                onChange={(e) => setAssetForm({ ...assetForm, assetTag: e.target.value })}
                placeholder="e.g. AST-2026-001"
                required
              />
            </div>
            <Select
              label="Category"
              value={assetForm.category}
              onChange={(e) => {
                const newCat = e.target.value;
                setAssetForm((prev) => {
                  const prefix = (newCat || 'AST').slice(0, 3).toUpperCase();
                  const currentSerial = prev.serialNumber;
                  const isAutoFormatted = !currentSerial || /^[A-Z]{3}-\d{4}-\d+$/.test(currentSerial);
                  const updatedSerial = (!editingAssetId && isAutoFormatted)
                    ? `${prefix}-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`
                    : currentSerial;
                  return { ...prev, category: newCat, serialNumber: updatedSerial };
                });
              }}
              options={[
                { value: 'LAPTOP', label: 'Laptop / Computer' },
                { value: 'MOBILE', label: 'Mobile Device' },
                { value: 'VEHICLE', label: 'Field Vehicle' },
                { value: 'TOOL', label: 'Engineering Tool' },
                { value: 'OFFICE_EQUIPMENT', label: 'Office Equipment' },
              ]}
              required
            />
          </div>
          <div className="grid-2">
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-main, #0f172a)' }}>
                  Serial Number <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <button
                  type="button"
                  onClick={() => {
                    const prefix = (assetForm.category || 'AST').slice(0, 3).toUpperCase();
                    const newSerial = `${prefix}-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;
                    setAssetForm((prev) => ({ ...prev, serialNumber: newSerial }));
                  }}
                  style={{
                    background: '#f1f5f9',
                    border: '1px solid #cbd5e1',
                    borderRadius: 4,
                    color: 'var(--primary, #3f929a)',
                    fontSize: '0.72rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    padding: '2px 8px',
                  }}
                >
                  Auto Generate
                </button>
              </div>
              <Input
                value={assetForm.serialNumber}
                onChange={(e) => setAssetForm({ ...assetForm, serialNumber: e.target.value })}
                placeholder="e.g. LAP-2026-892182"
                required
              />
            </div>
            <Input
              label="Model / Make"
              value={assetForm.model}
              onChange={(e) => setAssetForm({ ...assetForm, model: e.target.value })}
              placeholder="e.g. Latitude 7420"
            />
          </div>
          <div className="grid-2">
            <Input
              label="Purchase Value (₹)"
              type="number"
              value={assetForm.purchaseValue}
              onChange={(e) => setAssetForm({ ...assetForm, purchaseValue: Number(e.target.value) })}
              required
            />
            <Input
              label="Purchase Date"
              type="date"
              value={assetForm.purchaseDate || ''}
              onChange={(e) => setAssetForm({ ...assetForm, purchaseDate: e.target.value })}
            />
          </div>
          <div className="grid-2">
            <Select
              label="Company"
              value={assetForm.company}
              onChange={(e) => setAssetForm({ ...assetForm, company: e.target.value })}
              options={companies.map((c) => ({ value: c._id, label: c.name }))}
              required
            />
            <Select
              label="Branch"
              value={assetForm.branch || ''}
              onChange={(e) => setAssetForm({ ...assetForm, branch: e.target.value })}
              options={[
                { value: '', label: 'Select Branch (Optional)' },
                ...branches.map((b) => ({ value: b._id, label: b.name })),
              ]}
            />
          </div>

          {editingAssetId && (
            <div className="grid-2" style={{ marginTop: 12 }}>
              <Select
                label="Asset Status"
                value={assetForm.currentStatus || 'UNASSIGNED'}
                onChange={(e) => setAssetForm({ ...assetForm, currentStatus: e.target.value })}
                options={[
                  { value: 'UNASSIGNED', label: 'UNASSIGNED (Available for Assignment)' },
                  { value: 'ASSIGNED', label: 'ASSIGNED (Under Employee Custody)' },
                  { value: 'IN_REPAIR', label: 'IN_REPAIR (Under Maintenance)' },
                  { value: 'RETIRED', label: 'RETIRED (Decommissioned)' },
                ]}
              />
              <Select
                label="Physical Condition"
                value={assetForm.condition || 'GOOD'}
                onChange={(e) => setAssetForm({ ...assetForm, condition: e.target.value })}
                options={[
                  { value: 'NEW', label: 'Brand New / Pristine' },
                  { value: 'GOOD', label: 'Good Working Condition' },
                  { value: 'FAIR', label: 'Fair / Normal Wear & Tear' },
                  { value: 'DAMAGED', label: 'Damaged' },
                  { value: 'RETIRED', label: 'Retired' },
                ]}
              />
            </div>
          )}

          <div className="modal-footer" style={{ margin: '20px -20px -20px' }}>
            <Button variant="secondary" onClick={() => setAssetModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" loading={submittingAsset}>
              {editingAssetId ? 'Update Asset' : 'Register Asset'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* 2. ASSIGN ASSET MODAL */}
      <Modal
        isOpen={assignModalOpen}
        onClose={() => setAssignModalOpen(false)}
        title={`Assign Asset: ${targetAsset?.name || ''}`}
      >
        <form onSubmit={handleAssignAsset}>
          <div style={{ marginBottom: 12, padding: 10, backgroundColor: 'var(--bg-subtle)', borderRadius: 6 }}>
            Tag: <strong>{targetAsset?.assetTag}</strong> • Category: {targetAsset?.category}
          </div>

          {getAssetStatus(targetAsset) === 'RETIRED' && (
            <div style={{
              marginBottom: 14,
              padding: '12px 14px',
              backgroundColor: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 10
            }}>
              <div>
                <div style={{ fontWeight: 700, color: '#dc2626', fontSize: '0.84rem' }}>
                  Asset is not available for assignment
                </div>
                <div style={{ fontSize: '0.78rem', color: '#991b1b', marginTop: 2 }}>
                  Current status: &apos;RETIRED&apos;. Reactivate it to return to available stock.
                </div>
              </div>
              <Button
                size="sm"
                variant="light"
                icon={RotateCcw}
                onClick={async () => {
                  await handleReactivateAsset(targetAsset._id);
                  setAssignModalOpen(false);
                }}
              >
                Reactivate Asset
              </Button>
            </div>
          )}

          <Select
            label="Select Employee"
            placeholder="Select Employee..."
            value={assignForm.employeeId}
            onChange={(e) => setAssignForm({ ...assignForm, employeeId: e.target.value })}
            options={employees.map((emp) => ({
              value: emp._id || emp.id,
              label: formatEmployeeOption(emp, true),
            }))}
            required
          />
          <Select
            label="Condition at Issue"
            value={assignForm.conditionAtIssue || 'Brand new, good working condition'}
            onChange={(e) => setAssignForm({ ...assignForm, conditionAtIssue: e.target.value })}
            options={[
              { value: 'Brand new, good working condition', label: 'Brand New / Pristine' },
              { value: 'Good working condition', label: 'Good Working Condition' },
              { value: 'Fair / Normal wear', label: 'Fair / Normal Wear & Tear' },
            ]}
            required
          />
          <Input
            label="Custody Assignment Notes"
            value={assignForm.notes}
            onChange={(e) => setAssignForm({ ...assignForm, notes: e.target.value })}
          />

          <div className="modal-footer" style={{ margin: '20px -20px -20px' }}>
            <Button variant="secondary" onClick={() => setAssignModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              type="submit"
              loading={submittingAssign}
              disabled={getAssetStatus(targetAsset) === 'RETIRED'}
            >
              Issue Asset
            </Button>
          </div>
        </form>
      </Modal>

      {/* 3. RETURN ASSET MODAL */}
      <Modal
        isOpen={returnModalOpen}
        onClose={() => setReturnModalOpen(false)}
        title={`Process Physical Return: ${targetAsset?.name || ''}`}
      >
        <form onSubmit={handleReturnAsset}>
          <Select
            label="Asset Physical Condition"
            value={returnCondition}
            onChange={(e) => setReturnCondition(e.target.value)}
            options={[
              { value: 'GOOD', label: 'Good Working Condition' },
              { value: 'FAIR', label: 'Fair / Normal Wear & Tear' },
              { value: 'DAMAGED', label: 'Damaged (Requires Repair / Cost Recovery)' },
            ]}
          />
          <Input
            label="Return Remarks"
            value={returnRemarks}
            onChange={(e) => setReturnRemarks(e.target.value)}
            required
          />

          <div className="modal-footer" style={{ margin: '20px -20px -20px' }}>
            <Button variant="secondary" onClick={() => setReturnModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" loading={submittingReturn}>
              Confirm Return
            </Button>
          </div>
        </form>
      </Modal>

      {/* 4. DAMAGE / LOSS INCIDENT MODAL */}
      <Modal
        isOpen={damageModalOpen}
        onClose={() => setDamageModalOpen(false)}
        title="Report Asset Damage or Loss Incident"
      >
        <form onSubmit={handleReportDamage}>
          <Select
            label="Incident Type"
            value={damageForm.incidentType}
            onChange={(e) => setDamageForm({ ...damageForm, incidentType: e.target.value })}
            options={[
              { value: 'DAMAGED', label: 'Physical Damage' },
              { value: 'LOST', label: 'Lost / Stolen in Field' },
            ]}
          />
          <Input
            label="Estimated Replacement / Repair Cost (₹)"
            type="number"
            value={damageForm.estimatedCost}
            onChange={(e) => setDamageForm({ ...damageForm, estimatedCost: Number(e.target.value) })}
            required
          />
          <Input
            label="Incident Description (Mandatory)"
            value={damageForm.incidentDescription}
            onChange={(e) => setDamageForm({ ...damageForm, incidentDescription: e.target.value })}
            placeholder="Explain how damage or loss occurred"
            required
          />

          <div className="modal-footer" style={{ margin: '20px -20px -20px' }}>
            <Button variant="secondary" onClick={() => setDamageModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" type="submit" loading={submittingDamage}>
              Record Incident
            </Button>
          </div>
        </form>
      </Modal>

      {/* 5. RECOVERY DECISION MODAL */}
      <Modal
        isOpen={recoveryModalOpen}
        onClose={() => setRecoveryModalOpen(false)}
        title="Record Cost Recovery Decision (HR & Accounts)"
      >
        <form onSubmit={handleRecoveryDecision}>
          <Input
            label="Recovery Amount (₹)"
            type="number"
            value={recoveryForm.recoveryAmount}
            onChange={(e) => setRecoveryForm({ ...recoveryForm, recoveryAmount: Number(e.target.value) })}
            required
          />
          <Select
            label="Recovery Mode"
            value={recoveryForm.recoveryMode}
            onChange={(e) => setRecoveryForm({ ...recoveryForm, recoveryMode: e.target.value })}
            options={[
              { value: 'PAYROLL_DEDUCTION', label: 'Deduct from Monthly Payroll (Module 14 Link)' },
              { value: 'OUTSIDE_PAYROLL', label: 'Direct Cash / Bank Reimbursement Outside Payroll' },
            ]}
          />
          <Input
            label="Decision Remarks / Rationale"
            value={recoveryForm.decisionRemark}
            onChange={(e) => setRecoveryForm({ ...recoveryForm, decisionRemark: e.target.value })}
            placeholder="Document rationale approved by management"
            required
          />

          <div className="modal-footer" style={{ margin: '20px -20px -20px' }}>
            <Button variant="secondary" onClick={() => setRecoveryModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" loading={submittingRecovery}>
              Confirm Recovery
            </Button>
          </div>
        </form>
      </Modal>

      {/* 6. CUSTODY HISTORY MODAL */}
      <Modal
        isOpen={historyModalOpen}
        onClose={() => setHistoryModalOpen(false)}
        title={`Custody History: ${targetAsset?.name || ''}`}
        size="md"
      >
        {loadingHistory ? (
          <div style={{ textAlign: 'center', padding: 20 }}>Loading history...</div>
        ) : custodyHistory.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)' }}>
            No prior custody transitions recorded for this asset.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {custodyHistory.map((item, idx) => (
              <div
                key={idx}
                style={{
                  padding: 10,
                  border: '1px solid var(--border-color)',
                  borderRadius: 6,
                  backgroundColor: 'var(--bg-subtle)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
                  <span>
                    {getEmployeeName(item.employee)} ({getEmployeeCode(item.employee)})
                  </span>
                  <Badge variant={item.returnedAt ? 'secondary' : 'success'}>
                    {item.returnedAt ? 'Returned' : 'Current Custodian'}
                  </Badge>
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 4 }}>
                  Assigned: {new Date(item.assignedAt || Date.now()).toLocaleDateString()}{' '}
                  {item.returnedAt ? `• Returned: ${new Date(item.returnedAt).toLocaleDateString()}` : ''}
                </div>
              </div>
            ))}
          </div>
        )}
      </Modal>

      {/* VIEW ASSET DETAILS MODAL (GET /assets/:id) */}
      <Modal
        isOpen={viewAssetModalOpen}
        onClose={() => setViewAssetModalOpen(false)}
        title="Asset Specification & Custody Status"
        size="md"
      >
        {loadingAssetDetail ? (
          <div style={{ textAlign: 'center', padding: 30, color: 'var(--text-muted)' }}>
            <RefreshCw className="animate-spin" size={24} style={{ margin: '0 auto 8px' }} />
            <div>Loading live asset specification...</div>
          </div>
        ) : viewingAsset ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Header Banner */}
            <div
              style={{
                padding: '14px 18px',
                borderRadius: 8,
                background: 'var(--bg-subtle)',
                border: '1px solid var(--border-color)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 8,
                    background: '#e6f4ff',
                    color: '#1677ff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Laptop size={22} />
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>{viewingAsset.name}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Tag: <strong>{viewingAsset.assetTag || '-'}</strong> • Category: {viewingAsset.category || 'OTHER'}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <Badge variant="primary">{getAssetStatus(viewingAsset)}</Badge>
                <Badge variant="secondary">{viewingAsset.condition || 'GOOD'}</Badge>
              </div>
            </div>

            {/* Specification Grid */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: 12,
                fontSize: '0.85rem',
              }}
            >
              <div style={{ padding: '10px 14px', borderRadius: 6, background: '#fafafa', border: '1px solid #f0f0f0' }}>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Serial Number</div>
                <div style={{ fontWeight: 600, marginTop: 2 }}>{viewingAsset.serialNumber || 'N/A'}</div>
              </div>

              <div style={{ padding: '10px 14px', borderRadius: 6, background: '#fafafa', border: '1px solid #f0f0f0' }}>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Model / Make</div>
                <div style={{ fontWeight: 600, marginTop: 2 }}>{viewingAsset.model || 'Standard'}</div>
              </div>

              <div style={{ padding: '10px 14px', borderRadius: 6, background: '#fafafa', border: '1px solid #f0f0f0' }}>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Purchase Value</div>
                <div style={{ fontWeight: 700, color: 'var(--primary)', marginTop: 2 }}>
                  ₹{(Number(viewingAsset.purchaseValue) || 0).toLocaleString()}
                </div>
              </div>

              <div style={{ padding: '10px 14px', borderRadius: 6, background: '#fafafa', border: '1px solid #f0f0f0' }}>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Purchase Date</div>
                <div style={{ fontWeight: 600, marginTop: 2 }}>
                  {viewingAsset.purchaseDate ? new Date(viewingAsset.purchaseDate).toLocaleDateString() : 'Not Specified'}
                </div>
              </div>

              <div style={{ padding: '10px 14px', borderRadius: 6, background: '#fafafa', border: '1px solid #f0f0f0' }}>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Company Entity</div>
                <div style={{ fontWeight: 600, marginTop: 2 }}>
                  {viewingAsset.company?.name || viewingAsset.company || 'Enterprise Head Office'}
                </div>
              </div>

              <div style={{ padding: '10px 14px', borderRadius: 6, background: '#fafafa', border: '1px solid #f0f0f0' }}>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Branch / Location</div>
                <div style={{ fontWeight: 600, marginTop: 2 }}>
                  {viewingAsset.branch?.name || viewingAsset.branch || 'Central Warehouse / IT Depot'}
                </div>
              </div>
            </div>

            {/* Custody Information Box */}
            <div
              style={{
                padding: '14px 16px',
                borderRadius: 8,
                border: '1px solid var(--border-color)',
                backgroundColor: viewingAsset.currentAssignment ? '#f0f5ff' : '#f6ffed',
              }}
            >
              <div style={{ fontWeight: 700, fontSize: '0.88rem', marginBottom: 6, color: viewingAsset.currentAssignment ? '#1d39c4' : '#389e0d' }}>
                {viewingAsset.currentAssignment ? 'Current Active Custodian' : 'Stock & Availability Status'}
              </div>

              {viewingAsset.currentAssignment ? (
                <div style={{ fontSize: '0.84rem', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div>
                    <strong>Custodian: </strong>
                    {getEmployeeName(viewingAsset.currentAssignment.employee)}{' '}
                    ({getEmployeeCode(viewingAsset.currentAssignment.employee)})
                  </div>
                  <div>
                    <strong>Issued At: </strong>
                    {new Date(viewingAsset.currentAssignment.assignedAt || viewingAsset.currentAssignment.issuedAt || Date.now()).toLocaleDateString()}
                  </div>
                  {viewingAsset.currentAssignment.expectedReturnDate && (
                    <div>
                      <strong>Expected Return: </strong>
                      {new Date(viewingAsset.currentAssignment.expectedReturnDate).toLocaleDateString()}
                    </div>
                  )}
                  {viewingAsset.currentAssignment.conditionAtIssue && (
                    <div>
                      <strong>Condition at Issue: </strong>
                      {viewingAsset.currentAssignment.conditionAtIssue}
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ fontSize: '0.84rem', color: '#52c41a' }}>
                  This equipment is currently unassigned in stock and available to be allocated to any employee.
                </div>
              )}
            </div>

            {/* Quick Actions Footer */}
            <div className="modal-footer" style={{ margin: '10px -20px -20px', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
              <div style={{ display: 'flex', gap: 6 }}>
                {!viewingAsset.currentAssignment && getAssetStatus(viewingAsset) !== 'RETIRED' && (
                  <Button
                    size="sm"
                    variant="primary"
                    icon={UserCheck}
                    onClick={() => {
                      setViewAssetModalOpen(false);
                      openAssignModal(viewingAsset);
                    }}
                  >
                    Assign to Employee
                  </Button>
                )}
                {viewingAsset.currentAssignment && (
                  <>
                    <Button
                      size="sm"
                      variant="secondary"
                      icon={RotateCcw}
                      onClick={() => {
                        setViewAssetModalOpen(false);
                        openReturnModal(viewingAsset);
                      }}
                    >
                      Return
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      icon={AlertTriangle}
                      onClick={() => {
                        setViewAssetModalOpen(false);
                        openDamageModal(viewingAsset);
                      }}
                    >
                      Report Damage
                    </Button>
                  </>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  icon={History}
                  onClick={() => {
                    setViewAssetModalOpen(false);
                    openHistoryModal(viewingAsset);
                  }}
                >
                  History
                </Button>
              </div>

              <Button variant="secondary" onClick={() => setViewAssetModalOpen(false)}>
                Close
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>

      {/* 7. SUBMIT CLAIM MODAL (POST /reimbursements/claims) */}
      <Modal
        isOpen={claimModalOpen}
        onClose={() => setClaimModalOpen(false)}
        title="Submit Employee Reimbursement Claim"
        size="md"
      >
        <form onSubmit={handleCreateClaim}>
          <div className="grid-2" style={{ marginBottom: 12 }}>
            <Input
              label="Claim Title / Subject"
              value={claimForm.title}
              onChange={(e) => setClaimForm({ ...claimForm, title: e.target.value })}
              placeholder="e.g. Travel, Client Meetings & Supplies"
              required
            />
            <Select
              label="Disbursement Route"
              value={claimForm.disbursementMethod || 'PAYROLL'}
              onChange={(e) => setClaimForm({ ...claimForm, disbursementMethod: e.target.value })}
              options={[
                { value: 'PAYROLL', label: 'Include in Monthly Payroll (Salary Addition)' },
                { value: 'DIRECT_PAYMENT', label: 'Direct Payment Settlement (Bank / Cash)' },
              ]}
              required
            />
          </div>

          {/* Multi-line Receipts Container */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <label style={{ fontSize: '0.84rem', fontWeight: 600 }}>
                Receipts &amp; Expense Line Items ({claimForm.lineItems.length})
              </label>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                icon={Plus}
                onClick={handleAddClaimLineItem}
              >
                Add Expense Item
              </Button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 320, overflowY: 'auto', paddingRight: 4 }}>
              {claimForm.lineItems.map((item, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: '10px 12px',
                    borderRadius: 8,
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-subtle)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--primary)' }}>
                      Item #{idx + 1}
                    </span>
                    {claimForm.lineItems.length > 1 && (
                      <Button
                        type="button"
                        size="sm"
                        variant="danger"
                        icon={Trash2}
                        onClick={() => handleRemoveClaimLineItem(idx)}
                      />
                    )}
                  </div>

                  <div className="grid-2">
                    <Select
                      label="Expense Category"
                      value={item.category || categories[0]?._id}
                      onChange={(e) => handleClaimLineItemChange(idx, 'category', e.target.value)}
                      options={categories.map((c) => ({ value: c._id, label: c.name }))}
                      required
                    />
                    <Input
                      label="Expense Date"
                      type="date"
                      value={item.expenseDate}
                      onChange={(e) => handleClaimLineItemChange(idx, 'expenseDate', e.target.value)}
                      required
                    />
                  </div>

                  <div className="grid-2">
                    <Input
                      label="Amount (₹)"
                      type="number"
                      value={item.amount}
                      onChange={(e) => handleClaimLineItemChange(idx, 'amount', e.target.value)}
                      placeholder="0.00"
                      required
                    />
                    <Input
                      label="Description"
                      value={item.description}
                      onChange={(e) => handleClaimLineItemChange(idx, 'description', e.target.value)}
                      placeholder="e.g. Flight ticket or meal bill"
                      required
                    />
                  </div>

                  <Input
                    label="Receipt / Bill Link / URL"
                    value={item.receiptUrl}
                    onChange={(e) => handleClaimLineItemChange(idx, 'receiptUrl', e.target.value)}
                    placeholder="https://... or uploaded bill reference"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Total Claim Summary */}
          <div
            style={{
              padding: '12px 14px',
              borderRadius: 8,
              background: '#f6ffed',
              border: '1px solid #b7eb8f',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 16,
            }}
          >
            <span style={{ fontWeight: 600, color: '#389e0d', fontSize: '0.9rem' }}>Total Claimed Amount:</span>
            <span style={{ fontWeight: 800, fontSize: '1.2rem', color: '#52c41a' }}>
              ₹{claimForm.lineItems.reduce((acc, it) => acc + (Number(it.amount) || 0), 0).toLocaleString()}
            </span>
          </div>

          <div className="modal-footer" style={{ margin: '20px -20px -20px' }}>
            <Button variant="secondary" onClick={() => setClaimModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" loading={submittingClaim}>
              Submit Claim
            </Button>
          </div>
        </form>
      </Modal>

      {/* VIEW CLAIM DETAILS MODAL (GET /reimbursements/claims/:id) */}
      <Modal
        isOpen={viewClaimModalOpen}
        onClose={() => setViewClaimModalOpen(false)}
        title="Expense Claim Audit &amp; Receipts"
        size="md"
      >
        {loadingClaimDetail ? (
          <div style={{ textAlign: 'center', padding: 30, color: 'var(--text-muted)' }}>
            <RefreshCw className="animate-spin" size={24} style={{ margin: '0 auto 8px' }} />
            <div>Loading live claim details...</div>
          </div>
        ) : viewingClaim ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Header info banner */}
            <div
              style={{
                padding: '14px 18px',
                borderRadius: 8,
                background: 'var(--bg-subtle)',
                border: '1px solid var(--border-color)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 8,
                    background: '#fff7e6',
                    color: '#fa8c16',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Receipt size={22} />
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>{viewingClaim.title || 'Expense Claim'}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Filed By: <strong>{getEmployeeName(viewingClaim.employee)}</strong> ({getEmployeeCode(viewingClaim.employee)})
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <Badge variant={viewingClaim.status === 'APPROVED' ? 'success' : viewingClaim.status === 'REJECTED' ? 'danger' : 'warning'}>
                  {viewingClaim.status || 'PENDING'}
                </Badge>
                <Badge variant="neutral">
                  {viewingClaim.disbursementMethod || viewingClaim.settlementType || 'PAYROLL'}
                </Badge>
              </div>
            </div>

            {/* Financial Summary Grid */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 10,
              }}
            >
              <div style={{ padding: '10px 14px', borderRadius: 6, background: '#fafafa', border: '1px solid #f0f0f0' }}>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Claimed Amount</div>
                <div style={{ fontWeight: 700, fontSize: '1rem', marginTop: 2 }}>
                  ₹{(Number(viewingClaim.totalClaimedAmount || viewingClaim.amount) || 0).toLocaleString()}
                </div>
              </div>

              <div style={{ padding: '10px 14px', borderRadius: 6, background: '#fafafa', border: '1px solid #f0f0f0' }}>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Approved Amount</div>
                <div style={{ fontWeight: 700, fontSize: '1rem', color: '#52c41a', marginTop: 2 }}>
                  ₹{(Number(viewingClaim.approvedAmount ?? (viewingClaim.totalClaimedAmount || viewingClaim.amount)) || 0).toLocaleString()}
                </div>
              </div>

              <div style={{ padding: '10px 14px', borderRadius: 6, background: '#fafafa', border: '1px solid #f0f0f0' }}>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Applied Date</div>
                <div style={{ fontWeight: 600, fontSize: '0.88rem', marginTop: 2 }}>
                  {viewingClaim.appliedAt || viewingClaim.createdAt ? new Date(viewingClaim.appliedAt || viewingClaim.createdAt).toLocaleDateString() : 'Today'}
                </div>
              </div>
            </div>

            {/* Line Items Table */}
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.88rem', marginBottom: 8 }}>
                Itemized Receipts &amp; Proofs ({viewingClaim.lineItems?.length || 1})
              </div>
              <div style={{ border: '1px solid var(--border-color)', borderRadius: 8, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-subtle)', textAlign: 'left', borderBottom: '1px solid var(--border-color)' }}>
                      <th style={{ padding: '8px 12px' }}>Description</th>
                      <th style={{ padding: '8px 12px' }}>Category</th>
                      <th style={{ padding: '8px 12px' }}>Expense Date</th>
                      <th style={{ padding: '8px 12px' }}>Amount</th>
                      <th style={{ padding: '8px 12px' }}>Receipt Proof</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(viewingClaim.lineItems && viewingClaim.lineItems.length > 0 ? viewingClaim.lineItems : [viewingClaim]).map((item, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '8px 12px', fontWeight: 500 }}>{item.description || item.title || 'Expense'}</td>
                        <td style={{ padding: '8px 12px', color: 'var(--text-muted)' }}>
                          {item.category?.name || item.category || 'General'}
                        </td>
                        <td style={{ padding: '8px 12px' }}>
                          {item.expenseDate ? new Date(item.expenseDate).toLocaleDateString() : '-'}
                        </td>
                        <td style={{ padding: '8px 12px', fontWeight: 600 }}>
                          ₹{(Number(item.amount) || 0).toLocaleString()}
                        </td>
                        <td style={{ padding: '8px 12px' }}>
                          {item.receiptUrl ? (
                            <a
                              href={item.receiptUrl}
                              target="_blank"
                              rel="noreferrer"
                              style={{ color: 'var(--primary)', textDecoration: 'underline', fontWeight: 500 }}
                            >
                              View Receipt
                            </a>
                          ) : (
                            <span style={{ color: 'var(--text-muted)' }}>No URL</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Approval Decision Section */}
            {viewingClaim.approvalDecision && (
              <div
                style={{
                  padding: '12px 14px',
                  borderRadius: 8,
                  background: viewingClaim.approvalDecision.decision === 'REJECTED' ? '#fff1f0' : '#f6ffed',
                  border: `1px solid ${viewingClaim.approvalDecision.decision === 'REJECTED' ? '#ffccc7' : '#b7eb8f'}`,
                  fontSize: '0.84rem',
                }}
              >
                <div style={{ fontWeight: 700, marginBottom: 4 }}>
                  Decision: {viewingClaim.approvalDecision.decision} by {viewingClaim.approvalDecision.approver?.name || 'Management'}
                </div>
                {viewingClaim.approvalDecision.remark && (
                  <div style={{ color: 'var(--text-muted)' }}>
                    <strong>Remarks:</strong> {viewingClaim.approvalDecision.remark}
                  </div>
                )}
                {viewingClaim.approvalDecision.decidedAt && (
                  <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: 2 }}>
                    Decided on {new Date(viewingClaim.approvalDecision.decidedAt).toLocaleString()}
                  </div>
                )}
              </div>
            )}

            {/* Direct Payment Settlement info */}
            {viewingClaim.directPaymentReference && (
              <div
                style={{
                  padding: '12px 14px',
                  borderRadius: 8,
                  background: '#f0f5ff',
                  border: '1px solid #adc6ff',
                  fontSize: '0.84rem',
                }}
              >
                <div style={{ fontWeight: 700, color: '#1d39c4', marginBottom: 2 }}>
                  Direct Settlement Confirmed
                </div>
                <div>Payment Reference: <strong>{viewingClaim.directPaymentReference}</strong></div>
                {viewingClaim.directPaymentPaidAt && (
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 2 }}>
                    Paid on: {new Date(viewingClaim.directPaymentPaidAt).toLocaleString()}
                  </div>
                )}
              </div>
            )}

            {/* Footer with actions */}
            <div className="modal-footer" style={{ margin: '10px -20px -20px', display: 'flex', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', gap: 8 }}>
                {viewingClaim.status === 'PENDING' && canManage && (
                  <>
                    <Button
                      size="sm"
                      variant="primary"
                      icon={Check}
                      onClick={() => {
                        setViewClaimModalOpen(false);
                        openClaimDecideModal(viewingClaim, 'APPROVED');
                      }}
                    >
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      icon={X}
                      onClick={() => {
                        setViewClaimModalOpen(false);
                        openClaimDecideModal(viewingClaim, 'REJECTED');
                      }}
                    >
                      Reject
                    </Button>
                  </>
                )}
                {(viewingClaim.disbursementMethod === 'DIRECT_PAYMENT' || viewingClaim.settlementType === 'DIRECT_PAYMENT') &&
                  (viewingClaim.status === 'APPROVED' || viewingClaim.status === 'PARTIALLY_APPROVED') &&
                  !viewingClaim.directPaymentPaidAt &&
                  viewingClaim.paymentStatus !== 'PAID' && (
                    <Button
                      size="sm"
                      variant="primary"
                      icon={DollarSign}
                      onClick={() => {
                        setViewClaimModalOpen(false);
                        openDirectPaymentModal(viewingClaim);
                      }}
                    >
                      Settle Payment
                    </Button>
                  )}
              </div>

              <Button variant="secondary" onClick={() => setViewClaimModalOpen(false)}>
                Close
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>

      {/* 8. CLAIM DECISION MODAL */}
      <Modal
        isOpen={claimDecideModalOpen}
        onClose={() => setClaimDecideModalOpen(false)}
        title={`Decide Claim: ${selectedClaim?.title || ''}`}
      >
        <form onSubmit={handleSaveClaimDecision}>
          <div style={{ padding: 10, backgroundColor: 'var(--bg-subtle)', borderRadius: 6, marginBottom: 12 }}>
            Claimed Amount: <strong>₹{(selectedClaim?.amount || 0).toLocaleString()}</strong> by{' '}
            {selectedClaim?.employee?.name || 'Employee'}
          </div>
          <Select
            label="Decision"
            value={claimDecision}
            onChange={(e) => setClaimDecision(e.target.value)}
            options={[
              { value: 'APPROVED', label: 'Approve in Full' },
              { value: 'PARTIALLY_APPROVED', label: 'Partially Approve' },
              { value: 'REJECTED', label: 'Reject Claim' },
            ]}
          />
          {claimDecision === 'PARTIALLY_APPROVED' && (
            <Input
              label="Approved Amount (₹)"
              type="number"
              value={approvedAmount}
              onChange={(e) => setApprovedAmount(Number(e.target.value))}
              required
            />
          )}
          <Input
            label="Decision Remarks (Required for rejections)"
            value={decisionRemark}
            onChange={(e) => setDecisionRemark(e.target.value)}
            required={claimDecision === 'REJECTED'}
          />

          <div className="modal-footer" style={{ margin: '20px -20px -20px' }}>
            <Button variant="secondary" onClick={() => setClaimDecideModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant={claimDecision === 'REJECTED' ? 'danger' : 'primary'}
              type="submit"
              loading={submittingClaimDecision}
            >
              Confirm Decision
            </Button>
          </div>
        </form>
      </Modal>

      {/* 9. DIRECT PAYMENT SETTLEMENT MODAL */}
      <Modal
        isOpen={directPaymentModalOpen}
        onClose={() => setDirectPaymentModalOpen(false)}
        title="Record Direct Payment Settlement"
      >
        <form onSubmit={handleRecordDirectPayment}>
          <Select
            label="Payment Mode"
            value={directPaymentForm.paymentMode}
            onChange={(e) => setDirectPaymentForm({ ...directPaymentForm, paymentMode: e.target.value })}
            options={[
              { value: 'BANK_TRANSFER', label: 'Bank Transfer / NEFT' },
              { value: 'UPI', label: 'UPI' },
              { value: 'CASH', label: 'Cash Settlement' },
            ]}
          />
          <Input
            label="Transaction / Reference Number"
            value={directPaymentForm.referenceNumber}
            onChange={(e) =>
              setDirectPaymentForm({ ...directPaymentForm, referenceNumber: e.target.value })
            }
            required
          />
          <Input
            label="Payment Date"
            type="date"
            value={directPaymentForm.paymentDate}
            onChange={(e) =>
              setDirectPaymentForm({ ...directPaymentForm, paymentDate: e.target.value })
            }
            required
          />

          <div className="modal-footer" style={{ margin: '20px -20px -20px' }}>
            <Button variant="secondary" onClick={() => setDirectPaymentModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" loading={submittingDirectPayment}>
              Record Settlement
            </Button>
          </div>
        </form>
      </Modal>

      {/* 10. REIMBURSEMENT CATEGORY MODAL */}
      <Modal
        isOpen={categoryModalOpen}
        onClose={() => setCategoryModalOpen(false)}
        title={editingCategoryId ? 'Edit Category' : 'New Reimbursement Category'}
      >
        <form onSubmit={handleSaveCategory}>
          <Input
            label="Category Name"
            value={categoryForm.name}
            onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
            placeholder="e.g. Local Travel & Fuel"
            required
          />
          <div className="grid-2">
            <Input
              label="Category Code"
              value={categoryForm.code}
              onChange={(e) => setCategoryForm({ ...categoryForm, code: e.target.value.toUpperCase() })}
              placeholder="e.g. TRAVEL"
              required
            />
            <Input
              label="Monthly Cap / Maximum Allowed (₹)"
              type="number"
              value={categoryForm.monthlyCap}
              onChange={(e) => setCategoryForm({ ...categoryForm, monthlyCap: Number(e.target.value) })}
              required
            />
          </div>

          <div style={{ margin: '14px 0', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={categoryForm.isCapHardEnforced}
                onChange={(e) =>
                  setCategoryForm({ ...categoryForm, isCapHardEnforced: e.target.checked })
                }
              />
              <span><strong>Hard Enforce Cap:</strong> Automatically block claims exceeding monthly cap limit</span>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={categoryForm.isActive}
                onChange={(e) =>
                  setCategoryForm({ ...categoryForm, isActive: e.target.checked })
                }
              />
              <span><strong>Active Category:</strong> Available for employee claim filing</span>
            </label>
          </div>

          {companies.length > 0 && (
            <Select
              label="Assign to Company (Optional)"
              value={categoryForm.company}
              onChange={(e) => setCategoryForm({ ...categoryForm, company: e.target.value })}
              options={[
                { value: '', label: 'All Companies / Global' },
                ...companies.map((c) => ({ value: c._id, label: c.name })),
              ]}
            />
          )}

          <div className="modal-footer" style={{ margin: '20px -20px -20px' }}>
            <Button variant="secondary" onClick={() => setCategoryModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" loading={submittingCategory}>
              {editingCategoryId ? 'Update Category' : 'Create Category'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* 11. APPLY LOAN MODAL */}
      <Modal
        isOpen={loanModalOpen}
        onClose={() => setLoanModalOpen(false)}
        title="Apply for Employee Loan / Advance"
      >
        <form onSubmit={handleCreateLoan}>
          {canManage && (
            <Select
              label="Select Employee"
              placeholder="Select Employee..."
              value={loanForm.employeeId}
              onChange={(e) => setLoanForm({ ...loanForm, employeeId: e.target.value })}
              options={employees.map((emp) => ({
                value: emp._id || emp.id,
                label: formatEmployeeOption(emp, true),
              }))}
              required
            />
          )}

          <div style={{ marginBottom: 14 }}>
            <Select
              label="Loan / Advance Type"
              value={loanForm.loanTypeId}
              onChange={(e) => {
                const selected = loanTypes.find((lt) => lt._id === e.target.value);
                setLoanForm({
                  ...loanForm,
                  loanTypeId: e.target.value,
                  amount: selected?.maxAmount ? Math.min(Number(loanForm.amount) || 25000, selected.maxAmount) : loanForm.amount,
                  tenureMonths: selected?.maxTenureMonths ? Math.min(Number(loanForm.tenureMonths) || 6, selected.maxTenureMonths) : loanForm.tenureMonths,
                });
              }}
              options={loanTypes.map((lt) => ({
                value: lt._id,
                label: `${lt.name} (${lt.category || 'ADVANCE'}) - Max ₹${(lt.maxAmount || 0).toLocaleString()}`,
              }))}
              required
            />
            {(() => {
              const activeType = loanTypes.find((lt) => lt._id === loanForm.loanTypeId);
              if (!activeType) return null;
              return (
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>
                  Policy: Max ₹{(activeType.maxAmount || 0).toLocaleString()} • Max {activeType.maxTenureMonths || 0} Mos •{' '}
                  {activeType.interestRatePercent ? `${activeType.interestRatePercent}% interest` : 'Interest-Free'}
                </div>
              );
            })()}
          </div>

          <div className="grid-2">
            <Input
              label="Principal Requested Amount (₹)"
              type="number"
              value={loanForm.amount}
              onChange={(e) => setLoanForm({ ...loanForm, amount: Number(e.target.value) })}
              required
            />
            <Input
              label="Tenure (Months)"
              type="number"
              min="1"
              max="36"
              value={loanForm.tenureMonths}
              onChange={(e) => setLoanForm({ ...loanForm, tenureMonths: Number(e.target.value) })}
              required
            />
          </div>

          {/* Real-time Estimated EMI Calculation */}
          {Number(loanForm.amount) > 0 && Number(loanForm.tenureMonths) > 0 && (
            <div
              style={{
                padding: '10px 14px',
                borderRadius: 8,
                background: '#f6ffed',
                border: '1px solid #b7eb8f',
                marginBottom: 14,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span style={{ fontSize: '0.82rem', color: '#389e0d', fontWeight: 600 }}>Estimated Monthly EMI:</span>
              <span style={{ fontWeight: 800, color: '#52c41a', fontSize: '1rem' }}>
                ₹{Math.round(Number(loanForm.amount) / Number(loanForm.tenureMonths)).toLocaleString()} / month
              </span>
            </div>
          )}

          <Input
            label="Purpose of Advance / Loan"
            value={loanForm.purpose}
            onChange={(e) => setLoanForm({ ...loanForm, purpose: e.target.value })}
            placeholder="e.g. Home emergency, medical costs, relocation assistance"
            required
          />

          <div className="modal-footer" style={{ margin: '20px -20px -20px' }}>
            <Button variant="secondary" onClick={() => setLoanModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" loading={submittingLoan}>
              Submit Application
            </Button>
          </div>
        </form>
      </Modal>

      {/* 12. VIEW LOAN DETAILS MODAL (GET /loans/requests/:id) */}
      <Modal
        isOpen={viewLoanModalOpen}
        onClose={() => setViewLoanModalOpen(false)}
        title="Loan / Advance Request Audit"
        size="md"
      >
        {loadingLoanDetail ? (
          <div style={{ textAlign: 'center', padding: 30, color: 'var(--text-muted)' }}>
            <RefreshCw className="animate-spin" size={24} style={{ margin: '0 auto 8px' }} />
            <div>Loading live loan details...</div>
          </div>
        ) : viewingLoan ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Header Status Card */}
            <div
              style={{
                padding: '14px 18px',
                borderRadius: 8,
                background: 'var(--bg-subtle)',
                border: '1px solid var(--border-color)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 8,
                    background: '#e6f7ff',
                    color: '#1890ff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <HandCoins size={24} />
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '1rem' }}>
                    {viewingLoan.loanType?.name || 'Loan / Salary Advance'}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    Borrower: <strong>{getEmployeeName(viewingLoan.employee)}</strong> ({getEmployeeCode(viewingLoan.employee)})
                  </div>
                </div>
              </div>
              <Badge
                variant={
                  viewingLoan.status === 'APPROVED'
                    ? 'primary'
                    : viewingLoan.status === 'DISBURSED'
                    ? 'success'
                    : viewingLoan.status === 'PENDING'
                    ? 'warning'
                    : 'danger'
                }
              >
                {viewingLoan.status}
              </Badge>
            </div>

            {/* Financial Overview Grid */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                gap: 10,
              }}
            >
              <div style={{ padding: 10, borderRadius: 6, background: '#fafafa', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Requested Amount</div>
                <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>
                  ₹{(viewingLoan.requestedAmount || viewingLoan.amount || 0).toLocaleString()}
                </div>
              </div>

              <div style={{ padding: 10, borderRadius: 6, background: '#fafafa', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Requested Tenure</div>
                <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>
                  {viewingLoan.requestedTenureMonths || viewingLoan.tenureMonths || 6} Months
                </div>
              </div>

              {viewingLoan.approvedAmount !== undefined && (
                <div style={{ padding: 10, borderRadius: 6, background: '#f6ffed', border: '1px solid #b7eb8f' }}>
                  <div style={{ fontSize: '0.72rem', color: '#389e0d' }}>Approved Amount</div>
                  <div style={{ fontWeight: 800, fontSize: '1.1rem', color: '#52c41a' }}>
                    ₹{Number(viewingLoan.approvedAmount).toLocaleString()}
                  </div>
                </div>
              )}

              {viewingLoan.approvedTenureMonths !== undefined && (
                <div style={{ padding: 10, borderRadius: 6, background: '#f6ffed', border: '1px solid #b7eb8f' }}>
                  <div style={{ fontSize: '0.72rem', color: '#389e0d' }}>Approved Tenure</div>
                  <div style={{ fontWeight: 800, fontSize: '1.1rem', color: '#52c41a' }}>
                    {viewingLoan.approvedTenureMonths} Months
                  </div>
                </div>
              )}
            </div>

            {/* Purpose & Remarks */}
            <div style={{ fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div>
                <strong>Purpose:</strong> {viewingLoan.reason || viewingLoan.purpose || 'Personal advance'}
              </div>
              {viewingLoan.remark && (
                <div style={{ padding: '8px 12px', background: '#fffbe6', borderRadius: 6, border: '1px solid #ffe58f' }}>
                  <strong>Admin Remark:</strong> {viewingLoan.remark}
                </div>
              )}
              {viewingLoan.disbursementReference && (
                <div style={{ padding: '8px 12px', background: '#e6f7ff', borderRadius: 6, border: '1px solid #91d5ff' }}>
                  <strong>Disbursement Reference:</strong> {viewingLoan.disbursementReference}
                  {viewingLoan.disbursedAt && (
                    <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: 2 }}>
                      Disbursed on {new Date(viewingLoan.disbursedAt).toLocaleDateString()}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Actions footer */}
            <div className="modal-footer" style={{ margin: '10px -20px -20px', display: 'flex', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', gap: 8 }}>
                {viewingLoan.status === 'PENDING' && canManage && (
                  <>
                    <Button
                      size="sm"
                      variant="primary"
                      icon={Check}
                      onClick={() => {
                        setViewLoanModalOpen(false);
                        openLoanDecideModal(viewingLoan, 'APPROVED');
                      }}
                    >
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      icon={X}
                      onClick={() => {
                        setViewLoanModalOpen(false);
                        openLoanDecideModal(viewingLoan, 'REJECTED');
                      }}
                    >
                      Reject
                    </Button>
                  </>
                )}
                {viewingLoan.status === 'APPROVED' && canManage && (
                  <Button
                    size="sm"
                    variant="primary"
                    icon={DollarSign}
                    style={{ backgroundColor: '#52c41a', borderColor: '#52c41a' }}
                    onClick={() => {
                      setViewLoanModalOpen(false);
                      openDisburseModal(viewingLoan);
                    }}
                  >
                    Disburse Funds
                  </Button>
                )}
                {(viewingLoan.status === 'DISBURSED' || viewingLoan.status === 'APPROVED') && (
                  <Button
                    size="sm"
                    variant="secondary"
                    icon={Calendar}
                    onClick={() => {
                      setViewLoanModalOpen(false);
                      handleOpenSchedule(viewingLoan);
                    }}
                  >
                    View EMI Schedule
                  </Button>
                )}
              </div>
              <Button variant="secondary" onClick={() => setViewLoanModalOpen(false)}>
                Close
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>

      {/* 13. DECIDE LOAN MODAL (PUT /loans/requests/:id/decide) */}
      <Modal
        isOpen={loanDecideModalOpen}
        onClose={() => setLoanDecideModalOpen(false)}
        title={`Decide Loan Request: ${getEmployeeName(selectedLoanForDecision?.employee)}`}
      >
        <form onSubmit={handleSaveLoanDecision}>
          <div style={{ padding: 10, backgroundColor: 'var(--bg-subtle)', borderRadius: 6, marginBottom: 12 }}>
            Requested: <strong>₹{(selectedLoanForDecision?.requestedAmount || selectedLoanForDecision?.amount || 0).toLocaleString()}</strong> for{' '}
            <strong>{selectedLoanForDecision?.requestedTenureMonths || selectedLoanForDecision?.tenureMonths || 6} Months</strong>
          </div>

          <Select
            label="Decision"
            value={loanDecision}
            onChange={(e) => setLoanDecision(e.target.value)}
            options={[
              { value: 'APPROVED', label: 'Approve Loan Request' },
              { value: 'REJECTED', label: 'Reject Loan Request' },
            ]}
          />

          {loanDecision === 'APPROVED' && (
            <div className="grid-2">
              <Input
                label="Approved Principal Amount (₹)"
                type="number"
                value={approvedLoanAmount}
                onChange={(e) => setApprovedLoanAmount(e.target.value)}
                required
              />
              <Input
                label="Approved Tenure (Months)"
                type="number"
                min="1"
                max="36"
                value={approvedLoanTenure}
                onChange={(e) => setApprovedLoanTenure(e.target.value)}
                required
              />
            </div>
          )}

          <Input
            label="Decision Remarks / Conditions"
            value={loanDecisionRemark}
            onChange={(e) => setLoanDecisionRemark(e.target.value)}
            placeholder="e.g. Approved subject to payroll recovery deductions"
            required={loanDecision === 'REJECTED'}
          />

          <div className="modal-footer" style={{ margin: '20px -20px -20px' }}>
            <Button variant="secondary" onClick={() => setLoanDecideModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant={loanDecision === 'REJECTED' ? 'danger' : 'primary'}
              type="submit"
              loading={submittingLoanDecision}
            >
              Confirm Decision
            </Button>
          </div>
        </form>
      </Modal>

      {/* 14. DISBURSE LOAN MODAL (POST /loans/requests/:id/disburse) */}
      <Modal
        isOpen={disburseModalOpen}
        onClose={() => setDisburseModalOpen(false)}
        title="Disburse Approved Loan &amp; Generate Repayment Schedule"
      >
        <form onSubmit={handleDisburseLoan}>
          <div style={{ padding: 12, backgroundColor: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: 8, marginBottom: 14 }}>
            <div style={{ fontWeight: 600, color: '#389e0d' }}>
              Borrower: {getEmployeeName(selectedLoanForDisburse?.employee)}
            </div>
            <div style={{ fontSize: '0.84rem', marginTop: 2 }}>
              Approved Amount: <strong>₹{(selectedLoanForDisburse?.approvedAmount || selectedLoanForDisburse?.requestedAmount || selectedLoanForDisburse?.amount || 0).toLocaleString()}</strong> •{' '}
              Tenure: <strong>{selectedLoanForDisburse?.approvedTenureMonths || selectedLoanForDisburse?.requestedTenureMonths || 6} Months</strong>
            </div>
          </div>

          <Input
            label="Disbursement Reference (UTR / Bank Transaction / Cheque No.)"
            value={disburseForm.disbursementReference}
            onChange={(e) => setDisburseForm({ ...disburseForm, disbursementReference: e.target.value })}
            placeholder="e.g. BANK-TRF-LN-99210 or UTR-202604018"
            required
          />

          <Input
            label="Disbursement Date"
            type="date"
            value={disburseForm.disbursedAt}
            onChange={(e) => setDisburseForm({ ...disburseForm, disbursedAt: e.target.value })}
            required
          />

          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 14 }}>
            * Note: Disbursing will automatically generate the period-keyed monthly EMI repayment schedule linked directly to Module 14 Payroll Runs.
          </div>

          <div className="modal-footer" style={{ margin: '20px -20px -20px' }}>
            <Button variant="secondary" onClick={() => setDisburseModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" loading={submittingDisburse} style={{ backgroundColor: '#52c41a', borderColor: '#52c41a' }}>
              Confirm &amp; Disburse
            </Button>
          </div>
        </form>
      </Modal>

      {/* 15. LOAN TYPE MASTER MODAL (POST / PUT /loan-types) */}
      <Modal
        isOpen={loanTypeModalOpen}
        onClose={() => setLoanTypeModalOpen(false)}
        title={editingLoanTypeId ? 'Edit Loan Type Policy' : 'Create New Loan / Advance Type'}
      >
        <form onSubmit={handleSaveLoanType}>
          <Input
            label="Type Name"
            value={loanTypeForm.name}
            onChange={(e) => setLoanTypeForm({ ...loanTypeForm, name: e.target.value })}
            placeholder="e.g. Salary Advance, Emergency Loan, Education Loan"
            required
          />

          <div className="grid-2">
            <Select
              label="Category"
              value={loanTypeForm.category}
              onChange={(e) => setLoanTypeForm({ ...loanTypeForm, category: e.target.value })}
              options={[
                { value: 'ADVANCE', label: 'ADVANCE (Short-Term Salary Advance)' },
                { value: 'LOAN', label: 'LOAN (Long-Term Term Loan)' },
              ]}
              required
            />
            {companies.length > 0 && (
              <Select
                label="Company Allocation"
                value={loanTypeForm.company}
                onChange={(e) => setLoanTypeForm({ ...loanTypeForm, company: e.target.value })}
                options={[
                  { value: '', label: 'Select Company' },
                  ...companies.map((c) => ({ value: c._id, label: c.name })),
                ]}
                required
              />
            )}
          </div>

          <div className="grid-2">
            <Input
              label="Maximum Allowed Amount (₹)"
              type="number"
              value={loanTypeForm.maxAmount}
              onChange={(e) => setLoanTypeForm({ ...loanTypeForm, maxAmount: Number(e.target.value) })}
              required
            />
            <Input
              label="Maximum Tenure (Months)"
              type="number"
              min="1"
              max="60"
              value={loanTypeForm.maxTenureMonths}
              onChange={(e) => setLoanTypeForm({ ...loanTypeForm, maxTenureMonths: Number(e.target.value) })}
              required
            />
          </div>

          <div className="grid-2">
            <Input
              label="Interest Rate (% per annum)"
              type="number"
              step="0.1"
              value={loanTypeForm.interestRatePercent}
              onChange={(e) => setLoanTypeForm({ ...loanTypeForm, interestRatePercent: Number(e.target.value) })}
              placeholder="0 for interest-free"
            />
            <Input
              label="Min Service Months Required"
              type="number"
              min="0"
              value={loanTypeForm.minimumServiceMonthsRequired}
              onChange={(e) => setLoanTypeForm({ ...loanTypeForm, minimumServiceMonthsRequired: Number(e.target.value) })}
              placeholder="0 for immediate eligibility"
            />
          </div>

          <div style={{ margin: '14px 0' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={loanTypeForm.isActive}
                onChange={(e) => setLoanTypeForm({ ...loanTypeForm, isActive: e.target.checked })}
              />
              <span><strong>Active Loan Type:</strong> Available for employee application</span>
            </label>
          </div>

          <div className="modal-footer" style={{ margin: '20px -20px -20px' }}>
            <Button variant="secondary" onClick={() => setLoanTypeModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" loading={submittingLoanType}>
              {editingLoanTypeId ? 'Update Loan Type' : 'Create Loan Type'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* 16. EMI SCHEDULE MODAL (GET /loans/:id/emi-schedule & PUT mark-paid) */}
      <Modal
        isOpen={scheduleModalOpen}
        onClose={() => setScheduleModalOpen(false)}
        title={`Loan Repayment Schedule: ₹${(activeLoanForSchedule?.approvedAmount || activeLoanForSchedule?.requestedAmount || activeLoanForSchedule?.amount || 0).toLocaleString()}`}
        size="lg"
      >
        {loadingSchedule ? (
          <div style={{ textAlign: 'center', padding: 30, color: 'var(--text-muted)' }}>
            <RefreshCw className="animate-spin" size={24} style={{ margin: '0 auto 8px' }} />
            <div>Loading EMI schedule...</div>
          </div>
        ) : (
          <div>
            {/* Summary Metrics */}
            {(() => {
              const totalAmount = Number(activeLoanForSchedule?.approvedAmount || activeLoanForSchedule?.requestedAmount || activeLoanForSchedule?.amount || 0);
              const totalPaid = emiSchedule.reduce((acc, it) => acc + (it.isPaid || it.status === 'PAID' ? Number(it.amount || it.emiAmount || 0) : 0), 0);
              const remaining = Math.max(0, totalAmount - totalPaid);
              return (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                    gap: 10,
                    marginBottom: 16,
                  }}
                >
                  <div style={{ padding: 10, borderRadius: 6, background: '#fafafa', border: '1px solid var(--border-color)' }}>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Total Principal</div>
                    <div style={{ fontWeight: 700, fontSize: '1rem' }}>₹{totalAmount.toLocaleString()}</div>
                  </div>
                  <div style={{ padding: 10, borderRadius: 6, background: '#f6ffed', border: '1px solid #b7eb8f' }}>
                    <div style={{ fontSize: '0.72rem', color: '#389e0d' }}>Total Repaid</div>
                    <div style={{ fontWeight: 700, fontSize: '1rem', color: '#52c41a' }}>₹{totalPaid.toLocaleString()}</div>
                  </div>
                  <div style={{ padding: 10, borderRadius: 6, background: '#fff1f0', border: '1px solid #ffa39e' }}>
                    <div style={{ fontSize: '0.72rem', color: '#cf1322' }}>Outstanding Balance</div>
                    <div style={{ fontWeight: 700, fontSize: '1rem', color: '#f5222d' }}>₹{remaining.toLocaleString()}</div>
                  </div>
                </div>
              );
            })()}

            <div style={{ marginBottom: 12, fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              Monthly EMI deductions applied automatically during Payroll Run calculations, or can be marked paid manually below.
            </div>

            <table className="table" style={{ width: '100%', fontSize: '0.85rem' }}>
              <thead>
                <tr>
                  <th>Installment #</th>
                  <th>Period</th>
                  <th>EMI Amount</th>
                  <th>Status</th>
                  <th>Payment Details</th>
                  {canManage && <th>Action</th>}
                </tr>
              </thead>
              <tbody>
                {emiSchedule.length === 0 ? (
                  Array.from({ length: activeLoanForSchedule?.approvedTenureMonths || activeLoanForSchedule?.requestedTenureMonths || activeLoanForSchedule?.tenureMonths || 6 }).map((_, idx) => {
                    const totalAmt = activeLoanForSchedule?.approvedAmount || activeLoanForSchedule?.requestedAmount || activeLoanForSchedule?.amount || 30000;
                    const tenure = activeLoanForSchedule?.approvedTenureMonths || activeLoanForSchedule?.requestedTenureMonths || activeLoanForSchedule?.tenureMonths || 6;
                    const emiAmt = Math.round(totalAmt / (tenure || 1));
                    return (
                      <tr key={idx}>
                        <td>Installment #{idx + 1}</td>
                        <td>Month {idx + 1}</td>
                        <td>₹{emiAmt.toLocaleString()}</td>
                        <td><Badge variant="secondary">SCHEDULED</Badge></td>
                        <td style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>Pending disbursement</td>
                        {canManage && <td>-</td>}
                      </tr>
                    );
                  })
                ) : (
                  emiSchedule.map((item, idx) => {
                    const isPaid = item.isPaid || item.status === 'PAID';
                    const periodKey = item.periodKey || `Installment-${idx + 1}`;
                    const isProcessing = submittingMarkPaid[periodKey] || submittingMarkPaid[item.installmentNo || idx + 1];

                    return (
                      <tr key={idx}>
                        <td style={{ fontWeight: 600 }}>#{item.installmentNo || idx + 1}</td>
                        <td>{periodKey}</td>
                        <td style={{ fontWeight: 600 }}>₹{(item.amount || item.emiAmount || 0).toLocaleString()}</td>
                        <td>
                          <Badge variant={isPaid ? 'success' : 'warning'}>
                            {isPaid ? 'PAID' : 'DUE'}
                          </Badge>
                        </td>
                        <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                          {isPaid ? (
                            <div>
                              <div>Paid: {item.paidAt ? new Date(item.paidAt).toLocaleDateString() : 'Confirmed'}</div>
                              {item.paidInPayrollRun && <div>Run: {item.paidInPayrollRun}</div>}
                            </div>
                          ) : (
                            <span>Due for recovery</span>
                          )}
                        </td>
                        {canManage && (
                          <td>
                            {!isPaid ? (
                              <Button
                                size="sm"
                                variant="primary"
                                loading={isProcessing}
                                onClick={() => handleMarkEmiPaid(item.periodKey, item.installmentNo || idx + 1)}
                              >
                                Mark Paid
                              </Button>
                            ) : (
                              <span style={{ color: '#52c41a', fontWeight: 600, fontSize: '0.8rem' }}>
                                Settled
                              </span>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>

            <div className="modal-footer" style={{ margin: '20px -20px -20px' }}>
              <Button variant="secondary" onClick={() => setScheduleModalOpen(false)}>
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default AssetsClaimsLoans;
