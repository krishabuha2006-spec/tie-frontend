import React, { useState, useEffect } from 'react';
import assetsLoansApi from '../../api/assetsLoansApi';
import employeeApi from '../../api/employeeApi';
import masterApi from '../../api/masterApi';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
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
} from 'lucide-react';
import Table from '../../components/common/Table';
import Modal from '../../components/common/Modal';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import Select from '../../components/common/Select';
import Badge from '../../components/common/Badge';
import { extractApiData } from '../../utils/apiUtils';

export const AssetsClaimsLoans = () => {
  const { user, isSuperAdmin, isHrAdmin } = useAuth();
  const canManage = isSuperAdmin || isHrAdmin;
  const { showToast } = useToast();

  // Active Tab: 'assets' | 'claims' | 'categories' | 'loans'
  const [activeTab, setActiveTab] = useState('assets');

  // Master Data
  const [employees, setEmployees] = useState([]);
  const [companies, setCompanies] = useState([]);

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
    company: '',
  });

  // Assign Asset Modal
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [targetAsset, setTargetAsset] = useState(null);
  const [assignForm, setAssignForm] = useState({
    employeeId: '',
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

  // =========================================================================
  // TAB 2: REIMBURSEMENTS & EXPENSE CLAIMS (Module 18)
  // =========================================================================
  const [claimsViewMode, setClaimsViewMode] = useState('my'); // 'my' | 'pending' | 'all'
  const [claims, setClaims] = useState([]);
  const [loadingClaims, setLoadingClaims] = useState(false);
  const [claimModalOpen, setClaimModalOpen] = useState(false);
  const [submittingClaim, setSubmittingClaim] = useState(false);
  const [claimForm, setClaimForm] = useState({
    category: '',
    title: '',
    amount: '',
    description: '',
    receiptUrl: '',
    settlementType: 'PAYROLL', // 'PAYROLL' | 'DIRECT_PAYMENT'
  });

  // Decide Claim Modal
  const [claimDecideModalOpen, setClaimDecideModalOpen] = useState(false);
  const [selectedClaim, setSelectedClaim] = useState(null);
  const [claimDecision, setClaimDecision] = useState('APPROVED'); // 'APPROVED' | 'PARTIALLY_APPROVED' | 'REJECTED'
  const [approvedAmount, setApprovedAmount] = useState(0);
  const [decisionRemark, setDecisionRemark] = useState('');
  const [submittingClaimDecision, setSubmittingClaimDecision] = useState(false);

  // Direct Payment Settlement Modal
  const [directPaymentModalOpen, setDirectPaymentModalOpen] = useState(false);
  const [directPaymentForm, setDirectPaymentForm] = useState({
    paymentMode: 'BANK_TRANSFER', // 'BANK_TRANSFER' | 'CASH' | 'UPI'
    referenceNumber: '',
    paymentDate: new Date().toISOString().split('T')[0],
  });
  const [submittingDirectPayment, setSubmittingDirectPayment] = useState(false);

  // =========================================================================
  // TAB 3: REIMBURSEMENT CATEGORIES (Module 18)
  // =========================================================================
  const [categories, setCategories] = useState([]);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState(null);
  const [categoryForm, setCategoryForm] = useState({
    name: '',
    code: '',
    maxLimit: '',
    requiresReceipt: true,
    description: '',
  });
  const [submittingCategory, setSubmittingCategory] = useState(false);

  // =========================================================================
  // TAB 4: LOANS & ADVANCES (Module 19)
  // =========================================================================
  const [loansViewMode, setLoansViewMode] = useState('all'); // 'all' | 'me'
  const [loans, setLoans] = useState([]);
  const [loadingLoans, setLoadingLoans] = useState(false);
  const [loanModalOpen, setLoanModalOpen] = useState(false);
  const [loanForm, setLoanForm] = useState({
    amount: '',
    tenureMonths: '',
    purpose: '',
    employeeId: '',
  });
  const [submittingLoan, setSubmittingLoan] = useState(false);

  // Loan EMI Schedule Modal
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [emiSchedule, setEmiSchedule] = useState([]);
  const [activeLoanForSchedule, setActiveLoanForSchedule] = useState(null);
  const [loadingSchedule, setLoadingSchedule] = useState(false);

  // -------------------------------------------------------------------------
  // INITIAL LOAD
  // -------------------------------------------------------------------------
  useEffect(() => {
    loadMasters();
  }, []);

  useEffect(() => {
    if (activeTab === 'assets') loadAssets();
    else if (activeTab === 'claims') loadClaims();
    else if (activeTab === 'categories') loadCategories();
    else if (activeTab === 'loans') loadLoans();
  }, [activeTab, claimsViewMode, loansViewMode]);

  const loadMasters = async () => {
    try {
      const [eRes, cRes, catRes] = await Promise.all([
        employeeApi.getEmployees({ limit: 200 }).catch(() => ({ data: [] })),
        masterApi.getCompanies().catch(() => ({ data: [] })),
        assetsLoansApi.getReimbursementCategories().catch(() => ({ data: [] })),
      ]);
      const empList = extractEmployeeList(eRes);
      const compList = Array.isArray(cRes) ? cRes : cRes?.data || [];
      const catList = Array.isArray(catRes) ? catRes : catRes?.data || [];

      setEmployees(empList);
      setCompanies(compList);
      setCategories(catList);

      if (compList.length > 0) {
        setAssetForm((prev) => ({ ...prev, company: compList[0]._id }));
      }
      if (catList.length > 0) {
        setClaimForm((prev) => ({ ...prev, category: catList[0]._id }));
      }
      if (empList.length > 0) {
        setAssignForm((prev) => ({ ...prev, employeeId: empList[0]._id || empList[0].id }));
        setLoanForm((prev) => ({ ...prev, employeeId: empList[0]._id || empList[0].id }));
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
        company: asset.company?._id || asset.company || companies[0]?._id || '',
        currentStatus: getAssetStatus(asset),
        condition: asset.condition || 'GOOD',
      });
    } else {
      setEditingAssetId(null);
      setAssetForm({
        name: '',
        assetTag: `AST-${new Date().getFullYear()}-${String(assets.length + 1).padStart(3, '0')}`,
        category: 'LAPTOP',
        serialNumber: '',
        model: '',
        purchaseValue: '',
        company: companies[0]?._id || '',
        currentStatus: 'UNASSIGNED',
        condition: 'NEW',
      });
    }
    setAssetModalOpen(true);
  };

  const handleSaveAsset = async (e) => {
    e.preventDefault();
    setSubmittingAsset(true);
    try {
      if (editingAssetId) {
        await assetsLoansApi.updateAsset(editingAssetId, assetForm);
        showToast('Asset master record updated!', 'success');
      } else {
        await assetsLoansApi.createAsset(assetForm);
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
    if (!window.confirm('Retire and write off this asset from active service?')) return;
    try {
      await assetsLoansApi.retireAsset(id);
      showToast('Asset marked as RETIRED', 'info');
      loadAssets();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to retire asset', 'error');
    }
  };

  const handleReactivateAsset = async (id) => {
    if (!window.confirm('Reactivate this retired asset and return it to available inventory stock?')) return;
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

  const handleCreateClaim = async (e) => {
    e.preventDefault();
    setSubmittingClaim(true);
    try {
      await assetsLoansApi.createClaim({
        ...claimForm,
        amount: Number(claimForm.amount),
      });
      showToast('Expense claim filed successfully!', 'success');
      setClaimModalOpen(false);
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
    setApprovedAmount(claim.amount || 0);
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
    if (!window.confirm('Cancel this pending claim?')) return;
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
      paymentMode: 'BANK_TRANSFER',
      referenceNumber: `TXN-${Date.now().toString().slice(-6)}`,
      paymentDate: new Date().toISOString().split('T')[0],
    });
    setDirectPaymentModalOpen(true);
  };

  const handleRecordDirectPayment = async (e) => {
    e.preventDefault();
    setSubmittingDirectPayment(true);
    try {
      await assetsLoansApi.recordDirectPayment(selectedClaim._id, directPaymentForm);
      showToast('Direct payment settlement recorded!', 'success');
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
        maxLimit: cat.maxLimit || 10000,
        requiresReceipt: cat.requiresReceipt ?? true,
        description: cat.description || '',
      });
    } else {
      setEditingCategoryId(null);
      setCategoryForm({
        name: '',
        code: '',
        maxLimit: 10000,
        requiresReceipt: true,
        description: '',
      });
    }
    setCategoryModalOpen(true);
  };

  const handleSaveCategory = async (e) => {
    e.preventDefault();
    setSubmittingCategory(true);
    try {
      if (editingCategoryId) {
        await assetsLoansApi.updateReimbursementCategory(editingCategoryId, categoryForm);
        showToast('Category updated!', 'success');
      } else {
        await assetsLoansApi.createReimbursementCategory(categoryForm);
        showToast('Category created!', 'success');
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
      if (loansViewMode === 'me') {
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

  const openLoanModal = () => {
    setLoanForm({
      amount: '',
      tenureMonths: 12,
      purpose: '',
      employeeId: loanForm.employeeId || employees[0]?._id || employees[0]?.id || '',
    });
    setLoanModalOpen(true);
  };

  const handleCreateLoan = async (e) => {
    e.preventDefault();
    setSubmittingLoan(true);
    try {
      await assetsLoansApi.createLoanRequest({
        ...loanForm,
        amount: Number(loanForm.amount),
        tenureMonths: Number(loanForm.tenureMonths),
      });
      showToast('Loan request submitted successfully!', 'success');
      setLoanModalOpen(false);
      loadLoans();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to apply for loan', 'error');
    } finally {
      setSubmittingLoan(false);
    }
  };

  const handleOpenSchedule = async (loan) => {
    setActiveLoanForSchedule(loan);
    setScheduleModalOpen(true);
    setLoadingSchedule(true);
    try {
      const res = await assetsLoansApi.getLoanEmiSchedule(loan._id);
      const list = Array.isArray(res) ? res : res?.data || res?.schedule || [];
      setEmiSchedule(list);
    } catch (err) {
      showToast('Failed to load EMI schedule', 'error');
    } finally {
      setLoadingSchedule(false);
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
        return (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
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
            {isApproved && r.settlementType === 'DIRECT_PAYMENT' && r.paymentStatus !== 'PAID' && (
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
      header: 'Max Allowed Limit',
      key: 'maxLimit',
      render: (r) => (r.maxLimit ? `₹${r.maxLimit.toLocaleString()}` : 'No Limit'),
    },
    {
      header: 'Receipt Mandatory',
      key: 'requiresReceipt',
      render: (r) => (
        <Badge variant={r.requiresReceipt !== false ? 'primary' : 'secondary'}>
          {r.requiresReceipt !== false ? 'Receipt Required' : 'Self-Declared'}
        </Badge>
      ),
    },
    {
      header: 'Actions',
      key: 'actions',
      render: (r) => (
        <Button size="sm" variant="secondary" icon={Edit2} onClick={() => openCategoryModal(r)}>
          Edit
        </Button>
      ),
    },
  ];

  // Loans Table Columns
  const loanColumns = [
    {
      header: 'Loan Details',
      key: 'purpose',
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
            <div style={{ fontWeight: 600 }}>{r.purpose || 'Personal Advance'}</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Tenure: {r.tenureMonths || 12} Months • Monthly EMI: ₹{Math.round((r.amount || 0) / (r.tenureMonths || 12)).toLocaleString()}
            </div>
          </div>
        </div>
      ),
    },
    {
      header: 'Borrower',
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
      header: 'Principal Amount',
      key: 'amount',
      render: (r) => <span style={{ fontWeight: 700 }}>₹{(r.amount || 0).toLocaleString()}</span>,
    },
    {
      header: 'Status',
      key: 'status',
      render: (r) => {
        const s = r.status || 'PENDING';
        const colors = {
          PENDING: 'warning',
          APPROVED: 'success',
          DISBURSED: 'primary',
          REJECTED: 'danger',
          COMPLETED: 'secondary',
        };
        return <Badge variant={colors[s] || 'secondary'}>{s}</Badge>;
      },
    },
    {
      header: 'Actions',
      key: 'actions',
      render: (r) => (
        <div style={{ display: 'flex', gap: 6 }}>
          <Button size="sm" variant="secondary" icon={Calendar} onClick={() => handleOpenSchedule(r)}>
            EMI Schedule
          </Button>
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
            <Button variant="primary" icon={Plus} onClick={openLoanModal}>
              Apply for Loan
            </Button>
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
              Hardware custody tracking, serial tags, condition returns, and damage recovery.
            </div>
            <Button size="sm" variant="secondary" icon={RefreshCw} onClick={loadAssets}>
              Refresh Assets
            </Button>
          </div>
          <Table columns={assetColumns} data={assets} loading={loadingAssets} emptyMessage="No assets registered yet." />
        </div>
      )}

      {/* TAB 2: CLAIMS CONTENT */}
      {activeTab === 'claims' && (
        <div className="card">
          <div
            style={{
              padding: '14px 16px',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 10,
              backgroundColor: 'var(--bg-subtle)',
            }}
          >
            <div style={{ display: 'flex', gap: 8 }}>
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
            <Button size="sm" variant="secondary" icon={RefreshCw} onClick={loadClaims}>
              Refresh Claims
            </Button>
          </div>
          <Table columns={claimColumns} data={claims} loading={loadingClaims} emptyMessage="No expense claims filed." />
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

      {/* TAB 4: LOANS CONTENT */}
      {activeTab === 'loans' && (
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
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={() => setLoansViewMode('all')}
                className={`btn ${loansViewMode === 'all' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
              >
                All Loans
              </button>
              <button
                type="button"
                onClick={() => setLoansViewMode('me')}
                className={`btn ${loansViewMode === 'me' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
              >
                My Loans
              </button>
            </div>
            <Button size="sm" variant="secondary" icon={RefreshCw} onClick={loadLoans}>
              Refresh Loans
            </Button>
          </div>
          <Table columns={loanColumns} data={loans} loading={loadingLoans} emptyMessage="No loan records found." />
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
            <Input
              label="Asset Tag Code"
              value={assetForm.assetTag}
              onChange={(e) => setAssetForm({ ...assetForm, assetTag: e.target.value })}
              required
            />
            <Select
              label="Category"
              value={assetForm.category}
              onChange={(e) => setAssetForm({ ...assetForm, category: e.target.value })}
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
            <Input
              label="Serial Number"
              value={assetForm.serialNumber}
              onChange={(e) => setAssetForm({ ...assetForm, serialNumber: e.target.value })}
              placeholder="e.g. SN-89218209"
            />
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
            <Select
              label="Company"
              value={assetForm.company}
              onChange={(e) => setAssetForm({ ...assetForm, company: e.target.value })}
              options={companies.map((c) => ({ value: c._id, label: c.name }))}
              required
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

      {/* 7. SUBMIT CLAIM MODAL */}
      <Modal
        isOpen={claimModalOpen}
        onClose={() => setClaimModalOpen(false)}
        title="Submit Employee Reimbursement Claim"
      >
        <form onSubmit={handleCreateClaim}>
          <Select
            label="Expense Category"
            value={claimForm.category}
            onChange={(e) => setClaimForm({ ...claimForm, category: e.target.value })}
            options={categories.map((c) => ({ value: c._id, label: c.name }))}
            required
          />
          <Input
            label="Claim Title"
            value={claimForm.title}
            onChange={(e) => setClaimForm({ ...claimForm, title: e.target.value })}
            placeholder="e.g. Site Visit Travel & Meals"
            required
          />
          <div className="grid-2">
            <Input
              label="Amount (₹)"
              type="number"
              value={claimForm.amount}
              onChange={(e) => setClaimForm({ ...claimForm, amount: e.target.value })}
              required
            />
            <Select
              label="Disbursement Route"
              value={claimForm.settlementType}
              onChange={(e) => setClaimForm({ ...claimForm, settlementType: e.target.value })}
              options={[
                { value: 'PAYROLL', label: 'Include in Monthly Payroll' },
                { value: 'DIRECT_PAYMENT', label: 'Direct Bank / Cash Settlement' },
              ]}
            />
          </div>
          <Input
            label="Description / Purpose"
            value={claimForm.description}
            onChange={(e) => setClaimForm({ ...claimForm, description: e.target.value })}
            placeholder="Details of trip or expense"
            required
          />
          <Input
            label="Receipt / Bill Reference (URL or Voucher No.)"
            value={claimForm.receiptUrl}
            onChange={(e) => setClaimForm({ ...claimForm, receiptUrl: e.target.value })}
            placeholder="e.g. REC-8921 or uploaded bill reference"
          />

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
            placeholder="e.g. Travel & Conveyance"
            required
          />
          <div className="grid-2">
            <Input
              label="Category Code"
              value={categoryForm.code}
              onChange={(e) => setCategoryForm({ ...categoryForm, code: e.target.value.toUpperCase() })}
              placeholder="e.g. TRV"
              required
            />
            <Input
              label="Max Limit (₹)"
              type="number"
              value={categoryForm.maxLimit}
              onChange={(e) => setCategoryForm({ ...categoryForm, maxLimit: Number(e.target.value) })}
            />
          </div>
          <div style={{ margin: '12px 0' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem' }}>
              <input
                type="checkbox"
                checked={categoryForm.requiresReceipt}
                onChange={(e) =>
                  setCategoryForm({ ...categoryForm, requiresReceipt: e.target.checked })
                }
              />
              Mandatory Receipt / Tax Invoice
            </label>
          </div>
          <Input
            label="Category Policy Description"
            value={categoryForm.description}
            onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })}
          />

          <div className="modal-footer" style={{ margin: '20px -20px -20px' }}>
            <Button variant="secondary" onClick={() => setCategoryModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" loading={submittingCategory}>
              Save Category
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
          <div className="grid-2">
            <Input
              label="Principal Loan Amount (₹)"
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
          <Input
            label="Purpose of Loan"
            value={loanForm.purpose}
            onChange={(e) => setLoanForm({ ...loanForm, purpose: e.target.value })}
            placeholder="e.g. Medical emergency or home renovation"
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

      {/* 12. EMI SCHEDULE MODAL */}
      <Modal
        isOpen={scheduleModalOpen}
        onClose={() => setScheduleModalOpen(false)}
        title={`Loan EMI Schedule - ₹${(activeLoanForSchedule?.amount || 0).toLocaleString()}`}
        size="md"
      >
        {loadingSchedule ? (
          <div style={{ textAlign: 'center', padding: 20 }}>Loading EMI schedule...</div>
        ) : (
          <div>
            <div style={{ marginBottom: 12, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Monthly EMI deductions applied automatically during Payroll Run calculations.
            </div>
            <table className="table" style={{ width: '100%', fontSize: '0.85rem' }}>
              <thead>
                <tr>
                  <th>Installment #</th>
                  <th>Period</th>
                  <th>EMI Amount</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {emiSchedule.length === 0 ? (
                  Array.from({ length: activeLoanForSchedule?.tenureMonths || 6 }).map((_, idx) => (
                    <tr key={idx}>
                      <td>Installment {idx + 1}</td>
                      <td>Month {idx + 1}</td>
                      <td>₹{Math.round((activeLoanForSchedule?.amount || 50000) / (activeLoanForSchedule?.tenureMonths || 6)).toLocaleString()}</td>
                      <td><Badge variant="secondary">SCHEDULED</Badge></td>
                    </tr>
                  ))
                ) : (
                  emiSchedule.map((item, idx) => (
                    <tr key={idx}>
                      <td>#{item.installmentNo || idx + 1}</td>
                      <td>{item.periodKey || `Month ${idx + 1}`}</td>
                      <td>₹{(item.amount || 0).toLocaleString()}</td>
                      <td><Badge variant={item.isPaid ? 'success' : 'secondary'}>{item.isPaid ? 'PAID' : 'DUE'}</Badge></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default AssetsClaimsLoans;
