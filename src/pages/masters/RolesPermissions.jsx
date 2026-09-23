import React, { useState, useEffect, useCallback, useMemo } from 'react';
import masterApi from '../../api/masterApi';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import {
  Shield,
  ShieldCheck,
  Plus,
  Save,
  Trash2,
  Edit2,
  RefreshCw,
  Search,
  Check,
  Sliders,
  ChevronDown,
  ChevronRight,
  CheckSquare,
  Square,
  Sparkles,
} from 'lucide-react';
import Modal from '../../components/common/Modal';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import Badge from '../../components/common/Badge';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import ModuleSubNav from '../../components/common/ModuleSubNav';
import { mastersNav } from '../../routes/moduleNavConfig';

// Standard 12 granular actions conforming to Backend PermissionActionsSchema
export const ALL_ACTIONS = [
  'view',
  'create',
  'edit',
  'delete',
  'approve',
  'reject',
  'export',
  'print',
  'download',
  'uploadDocuments',
  'assignTasks',
  'viewReports',
];

export const createActionsObject = (granted = true) => {
  const actions = {};
  ALL_ACTIONS.forEach((act) => {
    actions[act] = Boolean(granted);
  });
  return actions;
};

// Canonical 10 Enterprise Modules & 56 Sub-modules from Backend Permission Catalog
export const DEFAULT_PERMISSION_CATALOG = {
  totalModules: 10,
  totalSubModules: 56,
  availableActions: ALL_ACTIONS,
  modules: [
    {
      moduleKey: 'crm',
      displayName: 'CRM (Customer Relationship Management)',
      shortLabel: 'CRM',
      description: 'Lead tracking, follow-ups, quotation workflow, and AMC proposals.',
      subModules: [
        { subModuleKey: 'leadManagement', displayName: 'Lead Management', description: 'Lead info, follow-up scheduling, timeline, activity logs, duplicate prevention' },
        { subModuleKey: 'quotationManagement', displayName: 'Quotation Management', description: 'Quotation workflow, templates, revisions, pricing negotiation & discounts' },
        { subModuleKey: 'addonQuotation', displayName: 'Add-on Quotation / AMC Quotation', description: 'Supplementary quotes, AMC contract proposals, and value-added services' },
      ],
    },
    {
      moduleKey: 'erpInventory',
      displayName: 'ERP & Inventory Management',
      shortLabel: 'ERP & Inv',
      description: 'Product master, stock movements, vendor management, POs, and reorder alerts.',
      subModules: [
        { subModuleKey: 'productMaster', displayName: 'Product Structure & Master', description: 'Categories, variants, SKUs, specifications, units of measurement (UOM)' },
        { subModuleKey: 'vendorManagement', displayName: 'Vendor Management', description: 'Vendor onboarding, performance evaluation, rate contracts, and contact repository' },
        { subModuleKey: 'warehouseStock', displayName: 'Warehouse & Stock Management', description: 'Multi-warehouse stock levels, bin locations, and live inventory tracking' },
        { subModuleKey: 'inventoryApproval', displayName: 'Inventory Approval Workflow', description: 'Requisition approvals, stock transfer approvals, and threshold authorizations' },
        { subModuleKey: 'purchaseOrderGen', displayName: 'Purchase Order Generation', description: 'Automated and manual PO generation, vendor terms, and order dispatch' },
        { subModuleKey: 'materialReceiptIssue', displayName: 'Material Receipt / Issue / Return', description: 'Goods receipt notes (GRN), site material issue slips, and surplus returns' },
        { subModuleKey: 'reorderForecast', displayName: 'Reorder Rules & Inventory Forecasting', description: 'Minimum stock thresholds, automated reorder triggers, and consumption forecasting' },
        { subModuleKey: 'stockAdjustments', displayName: 'Stock Adjustments', description: 'Physical audit reconciliations, damage write-offs, and stock correction logs' },
      ],
    },
    {
      moduleKey: 'projectManagement',
      displayName: 'Project Management System',
      shortLabel: 'Projects',
      description: 'Project lifecycles, milestone tracking, drawings, TMS, and project accounting.',
      subModules: [
        { subModuleKey: 'projectCreation', displayName: 'Project Creation & Team Assignment', description: 'New project setup, scope definition, budget allocation, and team staffing' },
        { subModuleKey: 'stakeholderManagement', displayName: 'Stakeholder Management', description: 'Client contacts, consultants, site engineers, and third-party contractors' },
        { subModuleKey: 'drawingManagement', displayName: 'Drawing Management', description: 'Architectural drawings, CAD revisions, version control, and markup notes' },
        { subModuleKey: 'designApproval', displayName: 'Design Approval Workflow', description: 'Internal design review, consultant sign-offs, and client design approvals' },
        { subModuleKey: 'taskManagement', displayName: 'Task Management System (TMS)', description: 'Site tasks, milestone checklists, deadlines, dependencies, and daily progress' },
        { subModuleKey: 'issueManagement', displayName: 'Issue Management', description: 'Site impediments, snag lists, escalation matrices, and resolution tracking' },
        { subModuleKey: 'paymentPhaseExpenses', displayName: 'Payment Phase & Project Expenses', description: 'Milestone billing stages, site imprest cash, and direct project expenditures' },
      ],
    },
    {
      moduleKey: 'installationQC',
      displayName: 'Installation & Quality Control',
      shortLabel: 'Install & QC',
      description: 'Site execution standards, QC inspections, commissioning, and test approvals.',
      subModules: [
        { subModuleKey: 'installationWorkflow', displayName: 'Installation Workflow', description: 'Hydrant, Sprinkler, Fire Alarm, Pump House, and Ventilation execution workflows' },
        { subModuleKey: 'qcChecklist', displayName: 'Quality Control (QC) Checklist', description: 'Pressure testing, weld inspections, equipment alignment, and safety audits' },
        { subModuleKey: 'qcApproval', displayName: 'QC Approval Workflow', description: 'Multi-stage QC clearance, non-conformance reports (NCR), and handover sign-off' },
      ],
    },
    {
      moduleKey: 'nocProcessing',
      displayName: 'NOC Processing',
      shortLabel: 'NOC',
      description: 'Fire authority approvals, compliance checklists, document dossiers, and renewals.',
      subModules: [
        { subModuleKey: 'preNocChecklist', displayName: 'Pre-NOC Checklist', description: 'Statutory compliance verification, architectural clearance, and site readiness' },
        { subModuleKey: 'nocApplication', displayName: 'NOC Application', description: 'Basic project details, fire authority jurisdiction, and statutory document uploads' },
        { subModuleKey: 'nocApproval', displayName: 'NOC Approval Workflow', description: 'Fire officer site inspection tracking, query replies, and provisional/final certificate issues' },
        { subModuleKey: 'nocRenewalReminder', displayName: 'NOC Renewal Reminder', description: 'Automated expiry alerts, renewal filing timelines, and compliance tracking' },
      ],
    },
    {
      moduleKey: 'amcManagement',
      displayName: 'AMC (Annual Maintenance Contract)',
      shortLabel: 'AMC',
      description: 'Contract lifecycles, routine service schedules, preventive visits, and renewals.',
      subModules: [
        { subModuleKey: 'amcContracts', displayName: 'AMC Types & Contract Details', description: 'Comprehensive/Non-comprehensive terms, asset scopes, pricing, and SLAs' },
        { subModuleKey: 'amcVisitManagement', displayName: 'AMC Visit Management', description: 'Quarterly/Monthly visit scheduling, engineer dispatch, and site service logs' },
        { subModuleKey: 'amcInspectionChecklist', displayName: 'AMC Inspection Checklist', description: 'Pump testing, alarm simulation, extinguisher recharge checks, and client signatures' },
        { subModuleKey: 'amcRenewalWorkflow', displayName: 'Renewal Workflow', description: 'Contract expiration forecasts, renewal quotation generation, and re-signing' },
      ],
    },
    {
      moduleKey: 'accountingFinance',
      displayName: 'Accounting & Financial Management',
      shortLabel: 'Accounts',
      description: 'Project-level costing, Pakka (GST) / Kachha accounting, ledgers, and P&L.',
      subModules: [
        { subModuleKey: 'projectAccounting', displayName: 'Project-wise Accounting', description: 'Project revenue, budget vs actual variance, work-in-progress (WIP), and profit margins' },
        { subModuleKey: 'pakkaAccounting', displayName: 'Pakka Accounting (GST)', description: 'Tax invoices, GST input/output calculation, GSTR reporting, and official audits' },
        { subModuleKey: 'kachhaAccounting', displayName: 'Kachha Accounting (HUF / Labour)', description: 'Daily wage payouts, contractor cash books, site vouchers, and HUF ledgers' },
        { subModuleKey: 'ledgerManagement', displayName: 'Ledger Management', description: 'General ledger, debtor/creditor accounts, bank reconciliation, and journal entries' },
        { subModuleKey: 'purchaseAccounting', displayName: 'Purchase Accounting', description: 'Vendor bill booking, payment processing, debit/credit notes, and TDS deductions' },
        { subModuleKey: 'expenseManagement', displayName: 'Expense Management', description: 'Employee travel claims, branch operational overheads, and petty cash logs' },
        { subModuleKey: 'outstandingManagement', displayName: 'Outstanding Management', description: 'Accounts receivable aging, payment follow-up alerts, and debtor statements' },
        { subModuleKey: 'profitLossAssets', displayName: 'Profit & Loss / Asset Management', description: 'Fixed asset registers, depreciation schedules, trial balance, and P&L statements' },
        { subModuleKey: 'multiBranchAccounting', displayName: 'Multi-Branch / Multi-Company Accounting', description: 'Inter-branch transfers, consolidated balance sheets, and company-level accounting' },
      ],
    },
    {
      moduleKey: 'hrms',
      displayName: 'Human Resource Management System (HRMS)',
      shortLabel: 'HRMS',
      description: 'Employee profiles, biometric & geofenced attendance, leaves, payroll, and KRAs.',
      subModules: [
        { subModuleKey: 'employeeMaster', displayName: 'Employee Master', description: 'Centralized employee repository, personal/employment info, and document custody' },
        { subModuleKey: 'attendance', displayName: 'Attendance Management', description: 'Face recognition, 500m geofencing, site attendance logs, and regularizations' },
        { subModuleKey: 'leaveManagement', displayName: 'Leave Management', description: 'Leave applications, approvals, leave balances, policy rules, and holiday calendars' },
        { subModuleKey: 'payrollManagement', displayName: 'Payroll Management', description: 'Salary structures, PF/ESIC deductions, monthly payslip generation, and disbursements' },
        { subModuleKey: 'kraManagement', displayName: 'KRA & Appraisal Management', description: 'Key Result Areas (KRAs), quarterly KPI reviews, ratings, and promotions' },
        { subModuleKey: 'assetCustody', displayName: 'Employee Custody & Asset Management', description: 'Company laptops, tools, safety gear, ID cards, and handover/return tracking' },
        { subModuleKey: 'hrmsReports', displayName: 'HRMS Reports', description: 'Attrition rates, attendance summaries, statutory compliance reports, and headcount' },
      ],
    },
    {
      moduleKey: 'procurement',
      displayName: 'Sales, Purchase & Procurement Management',
      shortLabel: 'Procurement',
      description: 'Sales order processing, purchase requisitions, supplier tracking, and GRN.',
      subModules: [
        { subModuleKey: 'salesOrderManagement', displayName: 'Sales Order Management', description: 'Customer SO registration, billing schedule, and delivery milestones' },
        { subModuleKey: 'purchaseRequisitionPO', displayName: 'Purchase Requisition & Purchase Order', description: 'Site indent requisitions, comparative quotes, and PO issuance' },
        { subModuleKey: 'vendorProcurement', displayName: 'Vendor Procurement Management', description: 'Vendor ratings, delivery SLA monitoring, and payment terms negotiation' },
        { subModuleKey: 'materialReceiptGRN', displayName: 'Material Receipt (GRN)', description: 'Site delivery inspections, quantity/quality verification, and GRN clearance' },
        { subModuleKey: 'procurementTracking', displayName: 'Procurement Tracking', description: 'Real-time transit tracking, vendor dispatch status, and lead-time analytics' },
      ],
    },
    {
      moduleKey: 'administration',
      displayName: 'Administration & Settings',
      shortLabel: 'Admin',
      description: 'Executive dashboards, role-based security, audit trails, and multi-tenant setup.',
      subModules: [
        { subModuleKey: 'dashboardOverview', displayName: 'Dashboard Overview', description: 'Executive KPI cards, real-time alerts, project health, and financial snapshots' },
        { subModuleKey: 'systemSettings', displayName: 'System & Business Settings', description: 'Email server configs, SMS gateways, currency formats, and global business rules' },
        { subModuleKey: 'rolePermissionManagement', displayName: 'Role & Permission Management', description: 'Role creation, 12-action sub-module matrix configuration, and user assignment' },
        { subModuleKey: 'notificationCenter', displayName: 'Notification Center', description: 'In-app notifications, email broadcast templates, and escalation triggers' },
        { subModuleKey: 'reportCenter', displayName: 'Report Center', description: 'Custom report builder, automated scheduled exports, and analytics dashboards' },
        { subModuleKey: 'multiBranchCompany', displayName: 'Multi-Branch & Multi-Company Management', description: 'Company tenants, branch geofencing parameters, and corporate hierarchy' },
      ],
    },
  ],
};

// Check if role has access to a module or any of its sub-modules
export function checkModuleAccess(role, permissionsMap, modKey, subModules = []) {
  if (!role) return false;
  if (role.isSuperAdmin || role.name === 'super_admin') return true;

  const perms = permissionsMap || role.permissions;
  if (!perms || typeof perms !== 'object') return false;

  // 1. Direct check on moduleKey
  const modVal = perms[modKey];
  if (modVal === true) return true;
  if (modVal && typeof modVal === 'object' && Object.values(modVal).some(Boolean)) return true;

  // 2. Check any submodule: modKey.subModuleKey
  if (Array.isArray(subModules)) {
    for (const sub of subModules) {
      const subKey = typeof sub === 'string' ? sub : `${modKey}.${sub.subModuleKey || sub.key}`;
      const subVal = perms[subKey];
      if (subVal === true) return true;
      if (subVal && typeof subVal === 'object' && Object.values(subVal).some(Boolean)) return true;
    }
  }

  // 3. Fallback prefix check
  const prefix = `${modKey}.`;
  for (const [k, val] of Object.entries(perms)) {
    if (k.startsWith(prefix) || k.toLowerCase().startsWith(modKey.toLowerCase())) {
      if (val === true) return true;
      if (typeof val === 'object' && val !== null && Object.values(val).some(Boolean)) return true;
    }
  }

  return false;
}

// Check sub-module action status
export function getSubModuleActions(perms, modKey, subModuleKey) {
  if (!perms || typeof perms !== 'object') return createActionsObject(false);
  const dotKey = `${modKey}.${subModuleKey}`;
  const val = perms[dotKey] ?? perms[subModuleKey] ?? perms[modKey];

  if (val === true) return createActionsObject(true);
  if (!val || val === false) return createActionsObject(false);
  if (typeof val === 'object') {
    const act = {};
    ALL_ACTIONS.forEach((a) => {
      act[a] = Boolean(val[a]);
    });
    return act;
  }
  return createActionsObject(false);
}

export const RolesPermissions = () => {
  const [roles, setRoles] = useState([]);
  const [catalog, setCatalog] = useState(DEFAULT_PERMISSION_CATALOG);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Pending changes map: roleId -> permissions object
  const [pendingChanges, setPendingChanges] = useState({});
  const [savingRoleId, setSavingRoleId] = useState(null);
  const [savingAll, setSavingAll] = useState(false);

  // Create / Edit Role Metadata Modal
  const [roleModalOpen, setRoleModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState(null);
  const [roleForm, setRoleForm] = useState({ name: '', displayName: '', description: '' });
  const [submittingRole, setSubmittingRole] = useState(false);

  // Granular Permissions Matrix Modal (Sub-modules & 12 Actions)
  const [matrixModalOpen, setMatrixModalOpen] = useState(false);
  const [matrixRole, setMatrixRole] = useState(null);
  const [matrixActiveMod, setMatrixActiveMod] = useState('crm');
  const [matrixSearch, setMatrixSearch] = useState('');

  // Delete Confirm Dialog
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [roleToDelete, setRoleToDelete] = useState(null);
  const [deletingRole, setDeletingRole] = useState(false);

  const { showToast } = useToast();
  const { fetchUserProfile, refreshRoles } = useAuth();

  // Load roles & permission catalog dynamically from backend API
  const loadRolesAndCatalog = useCallback(async () => {
    setLoading(true);
    try {
      const [rolesRes, catalogRes] = await Promise.allSettled([
        masterApi.getRoles(),
        masterApi.getPermissionCatalog(),
      ]);

      if (rolesRes.status === 'fulfilled') {
        const list = rolesRes.value?.data || rolesRes.value?.roles || (Array.isArray(rolesRes.value) ? rolesRes.value : []);
        setRoles(list);
        setPendingChanges({});
      } else {
        console.error('Failed to load roles:', rolesRes.reason);
        showToast('Failed to load roles from server', 'error');
      }

      if (catalogRes.status === 'fulfilled' && catalogRes.value) {
        const catPayload = catalogRes.value?.data || catalogRes.value;
        if (catPayload && Array.isArray(catPayload.modules) && catPayload.modules.length > 0) {
          // Merge with shortLabel enhancements
          const enrichedModules = catPayload.modules.map((m) => {
            const defMatch = DEFAULT_PERMISSION_CATALOG.modules.find((dm) => dm.moduleKey === m.moduleKey);
            return {
              ...m,
              shortLabel: defMatch?.shortLabel || m.displayName.split(' ')[0],
            };
          });

          setCatalog({
            totalModules: catPayload.totalModules || enrichedModules.length,
            totalSubModules: catPayload.totalSubModules || 56,
            availableActions: catPayload.availableActions || ALL_ACTIONS,
            modules: enrichedModules,
            permissionKeys: catPayload.permissionKeys || [],
          });
        }
      }
    } catch (err) {
      console.error('Error in loadRolesAndCatalog:', err);
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadRolesAndCatalog();
  }, [loadRolesAndCatalog]);

  // Get effective permissions for a role
  const getRolePerms = useCallback(
    (role) => {
      if (!role) return {};
      if (pendingChanges[role._id]) {
        return pendingChanges[role._id];
      }
      return role.permissions || {};
    },
    [pendingChanges]
  );

  // Quick toggle whole module (sets moduleKey & all subModules)
  const handleToggleModule = (role, mod) => {
    if (role.isSuperAdmin || role.name === 'super_admin') return;

    const currentPerms = { ...getRolePerms(role) };
    const modKey = mod.moduleKey;
    const subModules = mod.subModules || [];
    const hasAccess = checkModuleAccess(role, currentPerms, modKey, subModules);

    const updatedPerms = { ...currentPerms };
    const allActions = createActionsObject(true);
    const zeroActions = createActionsObject(false);

    if (hasAccess) {
      // Revoke module and all submodules
      updatedPerms[modKey] = zeroActions;
      subModules.forEach((sub) => {
        const subKey = `${modKey}.${sub.subModuleKey || sub.key}`;
        updatedPerms[subKey] = zeroActions;
      });
    } else {
      // Grant module and all submodules with full 12 actions
      updatedPerms[modKey] = allActions;
      subModules.forEach((sub) => {
        const subKey = `${modKey}.${sub.subModuleKey || sub.key}`;
        updatedPerms[subKey] = allActions;
      });
    }

    setPendingChanges((prev) => ({
      ...prev,
      [role._id]: updatedPerms,
    }));
  };

  // Select all modules for a role
  const handleSelectAll = (role) => {
    if (role.isSuperAdmin || role.name === 'super_admin') return;
    const updatedPerms = { ...getRolePerms(role) };
    const allActions = createActionsObject(true);

    catalog.modules.forEach((mod) => {
      updatedPerms[mod.moduleKey] = allActions;
      if (mod.subModules) {
        mod.subModules.forEach((sub) => {
          const subKey = `${mod.moduleKey}.${sub.subModuleKey || sub.key}`;
          updatedPerms[subKey] = allActions;
        });
      }
    });

    setPendingChanges((prev) => ({
      ...prev,
      [role._id]: updatedPerms,
    }));
  };

  // Clear all modules for a role
  const handleClearAll = (role) => {
    if (role.isSuperAdmin || role.name === 'super_admin') return;
    const updatedPerms = {};
    const zeroActions = createActionsObject(false);

    catalog.modules.forEach((mod) => {
      updatedPerms[mod.moduleKey] = zeroActions;
      if (mod.subModules) {
        mod.subModules.forEach((sub) => {
          const subKey = `${mod.moduleKey}.${sub.subModuleKey || sub.key}`;
          updatedPerms[subKey] = zeroActions;
        });
      }
    });

    setPendingChanges((prev) => ({
      ...prev,
      [role._id]: updatedPerms,
    }));
  };

  // Toggle a specific action in the Granular Matrix Modal
  const handleToggleSubModuleAction = (roleId, modKey, subModuleKey, actionName) => {
    const role = roles.find((r) => r._id === roleId);
    if (!role || role.isSuperAdmin || role.name === 'super_admin') return;

    const currentPerms = { ...getRolePerms(role) };
    const dotKey = `${modKey}.${subModuleKey}`;
    const currentActions = getSubModuleActions(currentPerms, modKey, subModuleKey);

    const updatedActions = {
      ...currentActions,
      [actionName]: !currentActions[actionName],
    };

    const updatedPerms = {
      ...currentPerms,
      [dotKey]: updatedActions,
    };

    // Update parent module access state
    const parentModule = catalog.modules.find((m) => m.moduleKey === modKey);
    const subModules = parentModule?.subModules || [];
    const anySubHasAccess = subModules.some((sub) => {
      const sKey = `${modKey}.${sub.subModuleKey || sub.key}`;
      const acts = sKey === dotKey ? updatedActions : getSubModuleActions(updatedPerms, modKey, sub.subModuleKey);
      return Object.values(acts).some(Boolean);
    });

    updatedPerms[modKey] = createActionsObject(anySubHasAccess);

    setPendingChanges((prev) => ({
      ...prev,
      [roleId]: updatedPerms,
    }));
  };

  // Grant or clear all actions for a specific sub-module
  const handleToggleAllActionsForSubModule = (roleId, modKey, subModuleKey, grantAll = true) => {
    const role = roles.find((r) => r._id === roleId);
    if (!role || role.isSuperAdmin || role.name === 'super_admin') return;

    const currentPerms = { ...getRolePerms(role) };
    const dotKey = `${modKey}.${subModuleKey}`;
    const newActions = createActionsObject(grantAll);

    const updatedPerms = {
      ...currentPerms,
      [dotKey]: newActions,
    };

    // Update parent module
    const parentModule = catalog.modules.find((m) => m.moduleKey === modKey);
    const subModules = parentModule?.subModules || [];
    const anySubHasAccess = subModules.some((sub) => {
      const sKey = `${modKey}.${sub.subModuleKey || sub.key}`;
      const acts = sKey === dotKey ? newActions : getSubModuleActions(updatedPerms, modKey, sub.subModuleKey);
      return Object.values(acts).some(Boolean);
    });

    updatedPerms[modKey] = createActionsObject(anySubHasAccess);

    setPendingChanges((prev) => ({
      ...prev,
      [roleId]: updatedPerms,
    }));
  };

  // Save changes for one role
  const handleSaveRole = async (roleId) => {
    const role = roles.find((r) => r._id === roleId);
    if (!role) return;

    if (role.isSuperAdmin || role.name === 'super_admin') {
      showToast('Super Admin has full access to all features', 'info');
      return;
    }

    const permsToSave = pendingChanges[roleId] || role.permissions || {};
    setSavingRoleId(roleId);

    try {
      await masterApi.updateRolePermissions(roleId, permsToSave);

      setRoles((prev) =>
        prev.map((r) => (r._id === roleId ? { ...r, permissions: permsToSave } : r))
      );

      setPendingChanges((prev) => {
        const next = { ...prev };
        delete next[roleId];
        return next;
      });

      showToast(`Permissions saved for ${role.displayName || role.name}!`, 'success');

      if (refreshRoles) await refreshRoles();
      if (fetchUserProfile) await fetchUserProfile();
    } catch (err) {
      console.error(err);
      showToast(err?.response?.data?.message || 'Failed to save permissions', 'error');
    } finally {
      setSavingRoleId(null);
    }
  };

  // Save all roles with pending changes
  const handleSaveAll = async () => {
    const roleIdsWithChanges = Object.keys(pendingChanges);
    if (roleIdsWithChanges.length === 0) {
      showToast('No changes to save', 'info');
      return;
    }

    setSavingAll(true);
    try {
      for (const rId of roleIdsWithChanges) {
        const role = roles.find((r) => r._id === rId);
        if (role) {
          const perms = pendingChanges[rId];
          await masterApi.updateRolePermissions(rId, perms);
        }
      }

      showToast('All role permissions updated successfully!', 'success');
      await loadRolesAndCatalog();
      if (refreshRoles) await refreshRoles();
      if (fetchUserProfile) await fetchUserProfile();
    } catch (err) {
      console.error(err);
      showToast(err?.response?.data?.message || 'Failed to save some permissions', 'error');
    } finally {
      setSavingAll(false);
    }
  };

  // Save new or edited role metadata
  const handleSaveRoleMetadata = async (e) => {
    e.preventDefault();
    if (!roleForm.name.trim()) {
      showToast('Role code is required', 'error');
      return;
    }

    setSubmittingRole(true);
    const slug = roleForm.name.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
    const payload = {
      name: slug,
      displayName: roleForm.displayName.trim() || roleForm.name.trim(),
      description: roleForm.description.trim(),
    };

    try {
      if (editingRole) {
        await masterApi.updateRole(editingRole._id, payload);
        showToast('Role updated successfully', 'success');
      } else {
        await masterApi.createRole({ ...payload, permissions: {} });
        showToast('New role created! Tick checkboxes to grant permissions.', 'success');
      }
      setRoleModalOpen(false);
      await loadRolesAndCatalog();
    } catch (err) {
      showToast(err?.response?.data?.message || 'Failed to save role', 'error');
    } finally {
      setSubmittingRole(false);
    }
  };

  // Delete custom role
  const handleDeleteRole = async () => {
    if (!roleToDelete) return;
    setDeletingRole(true);
    try {
      await masterApi.deleteRole(roleToDelete._id);
      showToast(`Role "${roleToDelete.displayName || roleToDelete.name}" deleted`, 'success');
      setDeleteModalOpen(false);
      setRoleToDelete(null);
      await loadRolesAndCatalog();
    } catch (err) {
      showToast(err?.response?.data?.message || 'Failed to delete role', 'error');
    } finally {
      setDeletingRole(false);
    }
  };

  // Filtered roles based on search
  const filteredRoles = useMemo(() => {
    if (!search.trim()) return roles;
    const s = search.toLowerCase();
    return roles.filter(
      (r) =>
        r.name?.toLowerCase().includes(s) ||
        r.displayName?.toLowerCase().includes(s) ||
        r.description?.toLowerCase().includes(s)
    );
  }, [roles, search]);

  const pendingCount = Object.keys(pendingChanges).length;

  // Active module in matrix modal
  const selectedMatrixModule = useMemo(() => {
    return catalog.modules.find((m) => m.moduleKey === matrixActiveMod) || catalog.modules[0];
  }, [catalog.modules, matrixActiveMod]);

  // Filtered sub-modules inside matrix modal
  const filteredSubModules = useMemo(() => {
    if (!selectedMatrixModule?.subModules) return [];
    if (!matrixSearch.trim()) return selectedMatrixModule.subModules;
    const ms = matrixSearch.toLowerCase();
    return selectedMatrixModule.subModules.filter(
      (sub) =>
        sub.displayName.toLowerCase().includes(ms) ||
        sub.subModuleKey.toLowerCase().includes(ms) ||
        sub.description?.toLowerCase().includes(ms)
    );
  }, [selectedMatrixModule, matrixSearch]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Sub Navigation */}
      <ModuleSubNav items={mastersNav} />

      {/* Page Header */}
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ShieldCheck size={22} color="var(--primary)" />
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
              Roles &amp; Permissions
            </h2>
            <Badge variant="primary">Access Control</Badge>
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 2 }}>
            Connected to Live Backend Permission Catalog: <strong>{catalog.totalModules} Enterprise Modules</strong> &amp;{' '}
            <strong>{catalog.totalSubModules} Sub-modules</strong> with 12 Granular Actions.
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <Button
            variant="secondary"
            icon={RefreshCw}
            onClick={loadRolesAndCatalog}
            loading={loading}
            title="Reload roles and permission catalog from backend"
          >
            Refresh
          </Button>

          {pendingCount > 0 && (
            <Button variant="primary" icon={Save} onClick={handleSaveAll} loading={savingAll}>
              Save All Changes ({pendingCount})
            </Button>
          )}

          <Button
            variant="secondary"
            icon={Plus}
            onClick={() => {
              setEditingRole(null);
              setRoleForm({ name: '', displayName: '', description: '' });
              setRoleModalOpen(true);
            }}
          >
            Create Role
          </Button>
        </div>
      </div>

      {/* Search Bar & Legend */}
      <div
        className="card"
        style={{
          padding: '8px 14px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 240 }}>
          <div style={{ position: 'relative', width: '100%', maxWidth: 300 }}>
            <Input
              placeholder="Search role..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ paddingLeft: 30, fontSize: '0.82rem', height: 32 }}
            />
            <Search
              size={13}
              color="var(--text-muted)"
              style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)' }}
            />
          </div>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
            {filteredRoles.length} Roles
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Status:</span>
          <span
            style={{
              fontSize: '0.74rem',
              fontWeight: 600,
              padding: '2px 7px',
              borderRadius: 4,
              backgroundColor: 'rgba(42, 171, 160, 0.12)',
              color: 'var(--primary)',
            }}
          >
            ✓ Allowed
          </span>
          <span
            style={{
              fontSize: '0.74rem',
              fontWeight: 500,
              padding: '2px 7px',
              borderRadius: 4,
              backgroundColor: 'var(--bg-subtle)',
              color: 'var(--text-muted)',
              border: '1px solid var(--border-color)',
            }}
          >
            Restricted
          </span>
        </div>
      </div>

      {/* ROLES LIST: ROLE INFO ON LEFT, 10 BACKEND MODULES (5x2 GRID) IN CENTER, ACTIONS ON RIGHT */}
      {loading ? (
        <div className="card" style={{ padding: '36px 20px', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, color: 'var(--text-muted)' }}>
            <span className="spinner-ring" />
            <span style={{ fontSize: '0.88rem', color: 'var(--text-main)', fontWeight: 500 }}>
              Loading roles and permission catalog from backend...
            </span>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filteredRoles.map((role) => {
            const isSuper = role.isSuperAdmin || role.name === 'super_admin';
            const perms = getRolePerms(role);
            const isPending = !!pendingChanges[role._id];
            const isSavingThis = savingRoleId === role._id;

            // Count granted modules
            const grantedCount = isSuper
              ? catalog.modules.length
              : catalog.modules.filter((m) => checkModuleAccess(role, perms, m.moduleKey, m.subModules)).length;

            return (
              <div
                key={role._id}
                className="card"
                style={{
                  padding: '10px 14px',
                  border: isPending
                    ? '1.5px solid #f59e0b'
                    : isSuper
                    ? '1px solid #fde68a'
                    : '1px solid var(--border-color)',
                  backgroundColor: isSuper
                    ? '#fffdf9'
                    : isPending
                    ? 'rgba(254, 243, 199, 0.08)'
                    : '#ffffff',
                  boxShadow: isPending
                    ? '0 1px 4px rgba(245, 158, 11, 0.12)'
                    : '0 1px 2px rgba(0,0,0,0.02)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 16,
                  flexWrap: 'wrap',
                  transition: 'all 0.12s ease',
                }}
              >
                {/* LEFT COLUMN: Role Name, Badge, & Granular Matrix Trigger */}
                <div style={{ width: 220, flexShrink: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 3 }}>
                    <div
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: 5,
                        backgroundColor: isSuper
                          ? '#fef3c7'
                          : role.isSystem
                          ? '#eff6ff'
                          : 'rgba(42, 171, 160, 0.1)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: isSuper ? '#d97706' : role.isSystem ? '#2563eb' : 'var(--primary)',
                        flexShrink: 0,
                      }}
                    >
                      <Shield size={13} />
                    </div>

                    <span
                      style={{
                        fontSize: '0.88rem',
                        fontWeight: 700,
                        color: 'var(--text-main)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                      title={role.displayName || role.name}
                    >
                      {role.displayName || role.name}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
                    <span
                      style={{
                        fontSize: '0.7rem',
                        padding: '1px 5px',
                        borderRadius: 4,
                        backgroundColor: isSuper ? '#fef3c7' : 'var(--bg-subtle)',
                        color: isSuper ? '#92400e' : 'var(--text-muted)',
                        fontWeight: 600,
                        border: '1px solid var(--border-color)',
                      }}
                    >
                      {isSuper ? 'Super Admin' : role.isSystem ? 'System' : 'Custom'}
                    </span>

                    <span
                      style={{
                        fontSize: '0.7rem',
                        fontWeight: 600,
                        padding: '1px 5px',
                        borderRadius: 4,
                        backgroundColor: isSuper || grantedCount > 0 ? 'rgba(42, 171, 160, 0.1)' : 'var(--bg-subtle)',
                        color: isSuper || grantedCount > 0 ? 'var(--primary)' : 'var(--text-muted)',
                      }}
                    >
                      {isSuper ? 'Full' : `${grantedCount}/${catalog.modules.length}`}
                    </span>

                    {isPending && (
                      <span
                        style={{
                          fontSize: '0.68rem',
                          fontWeight: 700,
                          padding: '1px 4px',
                          borderRadius: 3,
                          backgroundColor: '#fef3c7',
                          color: '#b45309',
                        }}
                      >
                        Unsaved
                      </span>
                    )}
                  </div>

                  {!isSuper && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 5 }}>
                      <button
                        type="button"
                        onClick={() => handleSelectAll(role)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--primary)',
                          fontSize: '0.7rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          padding: 0,
                          textDecoration: 'underline',
                        }}
                      >
                        All
                      </button>
                      <span style={{ color: 'var(--border-color)', fontSize: '0.7rem' }}>·</span>
                      <button
                        type="button"
                        onClick={() => handleClearAll(role)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--text-muted)',
                          fontSize: '0.7rem',
                          fontWeight: 500,
                          cursor: 'pointer',
                          padding: 0,
                          textDecoration: 'underline',
                        }}
                      >
                        Clear
                      </button>
                      <span style={{ color: 'var(--border-color)', fontSize: '0.7rem' }}>·</span>
                      <button
                        type="button"
                        onClick={() => {
                          setMatrixRole(role);
                          setMatrixActiveMod(catalog.modules[0]?.moduleKey || 'crm');
                          setMatrixSearch('');
                          setMatrixModalOpen(true);
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--primary-active, #1c525a)',
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          padding: 0,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 3,
                        }}
                        title="Configure granular 12 actions across 56 submodules"
                      >
                        <Sliders size={11} />
                        Matrix
                      </button>
                    </div>
                  )}
                </div>

                {/* CENTER: Exact 10 Backend Modules (Balanced 5 columns x 2 rows) */}
                <div className="roles-checkbox-grid">
                  {catalog.modules.map((mod) => {
                    const hasAccess = checkModuleAccess(role, perms, mod.moduleKey, mod.subModules);

                    return (
                      <label
                        key={mod.moduleKey}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          padding: '4px 7px',
                          borderRadius: 5,
                          border: hasAccess
                            ? '1px solid var(--primary)'
                            : '1px solid var(--border-color)',
                          backgroundColor: hasAccess
                            ? 'rgba(42, 171, 160, 0.08)'
                            : '#ffffff',
                          cursor: isSuper ? 'default' : 'pointer',
                          userSelect: 'none',
                          transition: 'all 0.12s ease',
                          margin: 0,
                          height: 26,
                          boxSizing: 'border-box',
                        }}
                        title={`${mod.displayName}: ${mod.description || ''}`}
                      >
                        <input
                          type="checkbox"
                          checked={hasAccess}
                          disabled={isSuper}
                          onChange={() => handleToggleModule(role, mod)}
                          style={{
                            width: 13,
                            height: 13,
                            accentColor: 'var(--primary)',
                            cursor: isSuper ? 'default' : 'pointer',
                            margin: 0,
                            flexShrink: 0,
                          }}
                        />
                        <span
                          style={{
                            fontSize: '0.76rem',
                            fontWeight: hasAccess ? 600 : 400,
                            color: hasAccess ? 'var(--text-main)' : 'var(--text-muted)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {mod.shortLabel || mod.displayName}
                        </span>
                      </label>
                    );
                  })}
                </div>

                {/* RIGHT COLUMN: Save Button & Manage Icons */}
                <div
                  style={{
                    width: 100,
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    gap: 6,
                  }}
                >
                  {!isSuper ? (
                    <Button
                      size="sm"
                      variant={isPending ? 'primary' : 'light'}
                      icon={isPending ? Save : Check}
                      loading={isSavingThis}
                      onClick={() => handleSaveRole(role._id)}
                      style={{
                        padding: '3px 8px',
                        fontSize: '0.74rem',
                        height: 26,
                        minWidth: 58,
                      }}
                    >
                      {isPending ? 'Save' : 'Saved'}
                    </Button>
                  ) : (
                    <span
                      style={{
                        fontSize: '0.72rem',
                        color: '#d97706',
                        fontWeight: 600,
                        backgroundColor: '#fef3c7',
                        padding: '2px 6px',
                        borderRadius: 4,
                      }}
                    >
                      Full
                    </span>
                  )}

                  {/* Edit / Delete for custom roles */}
                  {!role.isSystem && !isSuper && (
                    <div style={{ display: 'flex', gap: 2 }}>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingRole(role);
                          setRoleForm({
                            name: role.name,
                            displayName: role.displayName || role.name,
                            description: role.description || '',
                          });
                          setRoleModalOpen(true);
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--text-muted)',
                          cursor: 'pointer',
                          padding: 2,
                        }}
                        title="Edit Role Name"
                      >
                        <Edit2 size={12} />
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setRoleToDelete(role);
                          setDeleteModalOpen(true);
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--danger)',
                          cursor: 'pointer',
                          padding: 2,
                        }}
                        title="Delete Role"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {filteredRoles.length === 0 && (
            <div className="card" style={{ textAlign: 'center', padding: 28, color: 'var(--text-muted)', fontSize: '0.84rem' }}>
              No roles match your search "{search}".
            </div>
          )}
        </div>
      )}

      {/* GRANULAR PERMISSION MATRIX MODAL (12 ACTIONS PER SUB-MODULE) */}
      <Modal
        isOpen={matrixModalOpen}
        onClose={() => setMatrixModalOpen(false)}
        title={`Permission Matrix: ${matrixRole?.displayName || matrixRole?.name}`}
        size="lg"
      >
        {matrixRole && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Header info */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 8,
                padding: '10px 14px',
                backgroundColor: 'var(--bg-app, #f8fafc)',
                borderRadius: 'var(--radius-md, 8px)',
                border: '1px solid var(--border-color)',
              }}
            >
              <div>
                <span style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-main)' }}>
                  Configuring 12 granular actions for {matrixRole.displayName || matrixRole.name}
                </span>
                <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                  Select a module on the left to configure its sub-modules. Click checkboxes or action shortcuts.
                </div>
              </div>

              <div style={{ position: 'relative', width: 220 }}>
                <Input
                  placeholder="Filter sub-modules..."
                  value={matrixSearch}
                  onChange={(e) => setMatrixSearch(e.target.value)}
                  style={{ fontSize: '0.78rem', height: 30, paddingLeft: 28, marginBottom: 0 }}
                />
                <Search size={12} color="var(--text-muted)" style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)' }} />
              </div>
            </div>

            {/* Two-Column Layout: Modules on Left (tabs), Sub-modules & 12 Actions on Right */}
            <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 14, minHeight: 380 }}>
              {/* Left Column: 10 Module Selector */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 3,
                  borderRight: '1px solid var(--border-color)',
                  paddingRight: 10,
                }}
              >
                {catalog.modules.map((m) => {
                  const isSelected = m.moduleKey === selectedMatrixModule?.moduleKey;
                  const perms = getRolePerms(matrixRole);
                  const hasAccess = checkModuleAccess(matrixRole, perms, m.moduleKey, m.subModules);

                  return (
                    <button
                      key={m.moduleKey}
                      type="button"
                      onClick={() => setMatrixActiveMod(m.moduleKey)}
                      style={{
                        textAlign: 'left',
                        padding: '8px 10px',
                        borderRadius: 6,
                        border: isSelected ? '1px solid var(--primary)' : '1px solid transparent',
                        backgroundColor: isSelected ? 'rgba(42, 171, 160, 0.1)' : 'transparent',
                        color: isSelected ? 'var(--primary)' : 'var(--text-main)',
                        fontWeight: isSelected ? 700 : 500,
                        fontSize: '0.8rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        transition: 'all 0.12s ease',
                      }}
                    >
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {m.displayName}
                      </span>
                      <span
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          backgroundColor: hasAccess ? 'var(--primary, #2e7b85)' : 'var(--border-dark, #cbd5e1)',
                          flexShrink: 0,
                          marginLeft: 6,
                        }}
                      />
                    </button>
                  );
                })}
              </div>

              {/* Right Column: Sub-Modules and 12 Granular Actions */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 440, overflowY: 'auto', paddingRight: 4 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h4 style={{ margin: 0, fontSize: '0.94rem', fontWeight: 700, color: 'var(--text-main)' }}>
                    {selectedMatrixModule?.displayName}
                  </h4>
                  <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                    {filteredSubModules.length} Sub-modules
                  </span>
                </div>

                {filteredSubModules.map((sub) => {
                  const perms = getRolePerms(matrixRole);
                  const actions = getSubModuleActions(perms, selectedMatrixModule.moduleKey, sub.subModuleKey);
                  const activeActionCount = Object.values(actions).filter(Boolean).length;
                  const allActive = activeActionCount === ALL_ACTIONS.length;

                  return (
                    <div
                      key={sub.subModuleKey}
                      style={{
                        border: activeActionCount > 0 ? '1px solid var(--primary-border, #bce1e6)' : '1px solid var(--border-color)',
                        borderRadius: 6,
                        padding: '10px 12px',
                        backgroundColor: activeActionCount > 0 ? 'rgba(42, 171, 160, 0.03)' : '#ffffff',
                      }}
                    >
                      {/* Sub-module title & bulk triggers */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8, gap: 8 }}>
                        <div>
                          <div style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-main)' }}>
                            {sub.displayName}
                          </div>
                          {sub.description && (
                            <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: 2 }}>
                              {sub.description}
                            </div>
                          )}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                          <button
                            type="button"
                            onClick={() => handleToggleAllActionsForSubModule(matrixRole._id, selectedMatrixModule.moduleKey, sub.subModuleKey, !allActive)}
                            style={{
                              padding: '2px 7px',
                              fontSize: '0.72rem',
                              fontWeight: 600,
                              borderRadius: 4,
                              border: '1px solid var(--border-color)',
                              backgroundColor: allActive ? 'var(--primary)' : 'var(--bg-subtle)',
                              color: allActive ? '#ffffff' : 'var(--text-main)',
                              cursor: 'pointer',
                            }}
                          >
                            {allActive ? 'Clear All' : 'Grant All (12)'}
                          </button>
                        </div>
                      </div>

                      {/* 12 Action Checkboxes */}
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(4, 1fr)',
                          gap: 6,
                          paddingTop: 6,
                          borderTop: '1px solid var(--border-color)',
                        }}
                      >
                        {ALL_ACTIONS.map((action) => {
                          const isChecked = Boolean(actions[action]);
                          return (
                            <label
                              key={action}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 5,
                                fontSize: '0.74rem',
                                color: isChecked ? 'var(--text-main)' : 'var(--text-muted)',
                                fontWeight: isChecked ? 600 : 400,
                                cursor: 'pointer',
                                margin: 0,
                                userSelect: 'none',
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => handleToggleSubModuleAction(matrixRole._id, selectedMatrixModule.moduleKey, sub.subModuleKey, action)}
                                style={{
                                  width: 12,
                                  height: 12,
                                  accentColor: 'var(--primary)',
                                  margin: 0,
                                }}
                              />
                              <span style={{ textTransform: 'capitalize' }}>
                                {action.replace(/([A-Z])/g, ' $1')}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="modal-footer" style={{ margin: '14px -20px -20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                {pendingChanges[matrixRole._id] ? (
                  <span style={{ color: '#b45309', fontWeight: 600 }}>Unsaved permissions changes detected</span>
                ) : (
                  <span>All matrix permissions aligned with backend</span>
                )}
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <Button variant="secondary" type="button" onClick={() => setMatrixModalOpen(false)}>
                  Close
                </Button>
                <Button
                  variant="primary"
                  type="button"
                  icon={Save}
                  loading={savingRoleId === matrixRole._id}
                  onClick={async () => {
                    await handleSaveRole(matrixRole._id);
                    setMatrixModalOpen(false);
                  }}
                >
                  Save Permissions
                </Button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* CREATE / EDIT ROLE MODAL */}
      <Modal
        isOpen={roleModalOpen}
        onClose={() => setRoleModalOpen(false)}
        title={editingRole ? `Edit Role: ${editingRole.displayName || editingRole.name}` : 'Create New Role'}
      >
        <form onSubmit={handleSaveRoleMetadata}>
          <Input
            label="Role Code (Unique identifier)"
            value={roleForm.name}
            onChange={(e) => {
              const val = e.target.value;
              setRoleForm((p) => ({
                ...p,
                name: val,
                displayName: p.displayName || val,
              }));
            }}
            placeholder="e.g. sales_officer, site_supervisor"
            disabled={editingRole?.isSystem || editingRole?.isSuperAdmin}
            required
          />

          <Input
            label="Display Name (UI Label)"
            value={roleForm.displayName}
            onChange={(e) => setRoleForm({ ...roleForm, displayName: e.target.value })}
            placeholder="e.g. Sales Officer, Site Supervisor"
            required
          />

          <Input
            label="Description & Responsibilities"
            value={roleForm.description}
            onChange={(e) => setRoleForm({ ...roleForm, description: e.target.value })}
            placeholder="e.g. Handles field sales and leads access"
          />

          <div className="modal-footer" style={{ margin: '20px -20px -20px' }}>
            <Button variant="secondary" type="button" onClick={() => setRoleModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" loading={submittingRole}>
              {editingRole ? 'Save Changes' : 'Create Role'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* DELETE CONFIRM DIALOG */}
      <ConfirmDialog
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={handleDeleteRole}
        title="Delete Role"
        message={`Delete role "${roleToDelete?.displayName || roleToDelete?.name}"? Users assigned to this role will lose their privileges.`}
        confirmText="Delete Role"
        confirmVariant="danger"
        loading={deletingRole}
      />
    </div>
  );
};

export default RolesPermissions;
