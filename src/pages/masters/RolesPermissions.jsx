import React, { useState, useEffect, useCallback, useMemo } from 'react';
import apiClient from '../../api/client';
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
  Users,
  FolderKanban,
  Building2,
  Info,
  Briefcase,
  Wrench,
  Layers,
} from 'lucide-react';
import Modal from '../../components/common/Modal';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import Badge from '../../components/common/Badge';
import { extractApiData } from '../../utils/apiUtils';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import ModuleSubNav from '../../components/common/ModuleSubNav';
import { mastersNav } from '../../routes/moduleNavConfig';

// All 12 actions — matches backend PermissionActions schema exactly
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

// Actions displayed in the matrix UI (the 6 most common)
export const MATRIX_UI_ACTIONS = ['view', 'create', 'edit', 'delete', 'approve', 'export'];

export const createActionsObject = (granted = true) => {
  const actions = {};
  ALL_ACTIONS.forEach((act) => {
    actions[act] = Boolean(granted);
  });
  return actions;
};

// ─── The 3 Sidebar Modules: HRM, Project Management, and Masters ──────────────
export const DEFAULT_PERMISSION_CATALOG = {
  totalModules: 3,
  availableActions: ALL_ACTIONS,
  modules: [
    {
      moduleKey: 'hrm',
      displayName: 'HRM',
      shortLabel: 'HRM',
      icon: Users,
      description: 'Human Resource Management (all HRMS options)',
      subModules: [
        { subModuleKey: 'recruitment', displayName: 'Recruitment & Jobs', description: 'Job openings, candidates, interviews & offers' },
        { subModuleKey: 'employees', displayName: 'Employees Directory', description: 'Employee master profiles, contact, lifecycle & documents' },
        { subModuleKey: 'attendance', displayName: 'Daily Attendance', description: 'Biometric punches, shift logs & geofence timesheets' },
        { subModuleKey: 'calendar', displayName: 'Work Calendar', description: 'Company schedule, shift plans & working calendar' },
        { subModuleKey: 'leaves', displayName: 'Leaves & Holidays', description: 'Leave requests, quota balances & approvals' },
        { subModuleKey: 'holidays', displayName: 'Holiday Calendar', description: 'Branch & corporate holiday schedule' },
        { subModuleKey: 'payroll', displayName: 'Payroll & Salaries', description: 'Monthly payroll calculations, salary sheets & payslips' },
        { subModuleKey: 'assets-claims', displayName: 'Assets & Claims', description: 'Hardware assets custody & expense reimbursements' },
        { subModuleKey: 'performance', displayName: 'Performance Reviews', description: 'KRA appraisals, quarter evaluations & scorecards' },
        { subModuleKey: 'reports', displayName: 'HR Reports & Analytics', description: 'Workforce analytics, attendance & statutory payroll export' },
      ],
    },
    {
      moduleKey: 'projectManagement',
      displayName: 'Project Management',
      shortLabel: 'Project Management',
      icon: FolderKanban,
      description: 'Project delivery, client sites, supervisor logs & task boards',
      subModules: [
        { subModuleKey: 'projects', displayName: 'Projects', description: 'Project delivery, milestones, phases & sites' },
        { subModuleKey: 'site-logs', displayName: 'Site Logs', description: 'Daily site supervisor logs, material usage & issue reports' },
        { subModuleKey: 'tasks', displayName: 'Tasks', description: 'Action items, team assignments & deadlines' },
      ],
    },
    {
      moduleKey: 'masters',
      displayName: 'Masters',
      shortLabel: 'Masters',
      icon: Building2,
      description: 'Organization master configurations and system access (Common)',
      subModules: [
        { subModuleKey: 'companies', displayName: 'Companies', description: 'Corporate entity setup, registration & business info' },
        { subModuleKey: 'branches', displayName: 'Branches', description: 'Regional branch offices, geofences & locations' },
        { subModuleKey: 'departments', displayName: 'Departments', description: 'Functional organizational departments' },
        { subModuleKey: 'designations', displayName: 'Designations', description: 'Job designations & title hierarchy' },
        { subModuleKey: 'roles', displayName: 'Roles & RBAC', description: 'Role profiles & granular permission matrices' },
        { subModuleKey: 'users', displayName: 'Users & Logins', description: 'User login credentials, active accounts & role assignments' },
      ],
    },
  ],
};

// ─── 1-Click Role Presets (Templates to populate permission matrix) ─────────
export const ROLE_PRESETS = [
  {
    id: 'office_staff',
    name: 'Office Staff / Employee',
    badge: 'Office Staff',
    color: '#0d9488',
    description: 'Attendance office punch, Work Calendar, Leaves, Holidays & personal Payslips view',
    permissions: {
      'hrm.attendance': { view: true, create: true, edit: false, delete: false, approve: false, reject: false, export: false, print: true, download: true, uploadDocuments: false, assignTasks: false, viewReports: false },
      'hrm.calendar': { view: true, create: false, edit: false, delete: false, approve: false, reject: false, export: false, print: true, download: true, uploadDocuments: false, assignTasks: false, viewReports: false },
      'hrm.leaves': { view: true, create: true, edit: false, delete: false, approve: false, reject: false, export: false, print: false, download: true, uploadDocuments: true, assignTasks: false, viewReports: false },
      'hrm.holidays': { view: true, create: false, edit: false, delete: false, approve: false, reject: false, export: false, print: true, download: true, uploadDocuments: false, assignTasks: false, viewReports: false },
      'hrm.payroll': { view: true, create: false, edit: false, delete: false, approve: false, reject: false, export: false, print: true, download: true, uploadDocuments: false, assignTasks: false, viewReports: false },
    },
  },
  {
    id: 'field_staff',
    name: 'Field Staff / Site Engineer',
    badge: 'Field / AMC Staff',
    color: '#0284c7',
    description: 'Site In/Out punch, Work Calendar, Leaves, Holidays, Active Projects, Site Logs & Tasks',
    permissions: {
      'hrm.attendance': { view: true, create: true, edit: false, delete: false, approve: false, reject: false, export: false, print: true, download: true, uploadDocuments: false, assignTasks: false, viewReports: false },
      'hrm.calendar': { view: true, create: false, edit: false, delete: false, approve: false, reject: false, export: false, print: true, download: true, uploadDocuments: false, assignTasks: false, viewReports: false },
      'hrm.leaves': { view: true, create: true, edit: false, delete: false, approve: false, reject: false, export: false, print: false, download: true, uploadDocuments: true, assignTasks: false, viewReports: false },
      'hrm.holidays': { view: true, create: false, edit: false, delete: false, approve: false, reject: false, export: false, print: true, download: true, uploadDocuments: false, assignTasks: false, viewReports: false },
      'hrm.payroll': { view: true, create: false, edit: false, delete: false, approve: false, reject: false, export: false, print: true, download: true, uploadDocuments: false, assignTasks: false, viewReports: false },
      'projectManagement.projects': { view: true, create: false, edit: false, delete: false, approve: false, reject: false, export: false, print: false, download: true, uploadDocuments: false, assignTasks: false, viewReports: false },
      'projectManagement.site-logs': { view: true, create: true, edit: true, delete: false, approve: false, reject: false, export: false, print: true, download: true, uploadDocuments: true, assignTasks: false, viewReports: false },
      'projectManagement.tasks': { view: true, create: false, edit: true, delete: false, approve: false, reject: false, export: false, print: false, download: true, uploadDocuments: true, assignTasks: false, viewReports: false },
    },
  },
  {
    id: 'hr_admin',
    name: 'HR Admin / Manager',
    badge: 'HR Admin',
    color: '#8b5cf6',
    description: 'Full management of Recruitment, Employees, Attendance, Calendar, Leaves, Holidays, Payroll, Assets, Reviews & Reports',
    permissions: {
      'hrm.recruitment': { view: true, create: true, edit: true, delete: true, approve: true, reject: true, export: true, print: true, download: true, uploadDocuments: true, assignTasks: true, viewReports: true },
      'hrm.employees': { view: true, create: true, edit: true, delete: true, approve: true, reject: true, export: true, print: true, download: true, uploadDocuments: true, assignTasks: true, viewReports: true },
      'hrm.attendance': { view: true, create: true, edit: true, delete: true, approve: true, reject: true, export: true, print: true, download: true, uploadDocuments: true, assignTasks: true, viewReports: true },
      'hrm.calendar': { view: true, create: true, edit: true, delete: true, approve: true, reject: true, export: true, print: true, download: true, uploadDocuments: true, assignTasks: true, viewReports: true },
      'hrm.leaves': { view: true, create: true, edit: true, delete: true, approve: true, reject: true, export: true, print: true, download: true, uploadDocuments: true, assignTasks: true, viewReports: true },
      'hrm.holidays': { view: true, create: true, edit: true, delete: true, approve: true, reject: true, export: true, print: true, download: true, uploadDocuments: true, assignTasks: true, viewReports: true },
      'hrm.payroll': { view: true, create: true, edit: true, delete: true, approve: true, reject: true, export: true, print: true, download: true, uploadDocuments: true, assignTasks: true, viewReports: true },
      'hrm.assets-claims': { view: true, create: true, edit: true, delete: true, approve: true, reject: true, export: true, print: true, download: true, uploadDocuments: true, assignTasks: true, viewReports: true },
      'hrm.performance': { view: true, create: true, edit: true, delete: true, approve: true, reject: true, export: true, print: true, download: true, uploadDocuments: true, assignTasks: true, viewReports: true },
      'hrm.reports': { view: true, create: true, edit: true, delete: true, approve: true, reject: true, export: true, print: true, download: true, uploadDocuments: true, assignTasks: true, viewReports: true },
      'projectManagement.projects': { view: true, create: false, edit: false, delete: false, approve: false, reject: false, export: false, print: false, download: true, uploadDocuments: false, assignTasks: false, viewReports: false },
    },
  },
  {
    id: 'project_manager',
    name: 'Project Manager / Supervisor',
    badge: 'Project Lead',
    color: '#059669',
    description: 'Projects delivery, Site Logs, Task delegations, plus personal attendance & leave approvals',
    permissions: {
      'projectManagement.projects': { view: true, create: true, edit: true, delete: false, approve: true, reject: true, export: true, print: true, download: true, uploadDocuments: true, assignTasks: true, viewReports: true },
      'projectManagement.site-logs': { view: true, create: true, edit: true, delete: false, approve: true, reject: true, export: true, print: true, download: true, uploadDocuments: true, assignTasks: true, viewReports: true },
      'projectManagement.tasks': { view: true, create: true, edit: true, delete: false, approve: true, reject: true, export: true, print: true, download: true, uploadDocuments: true, assignTasks: true, viewReports: true },
      'hrm.attendance': { view: true, create: true, edit: false, delete: false, approve: true, reject: false, export: true, print: true, download: true, uploadDocuments: false, assignTasks: false, viewReports: false },
      'hrm.calendar': { view: true, create: false, edit: false, delete: false, approve: false, reject: false, export: false, print: true, download: true, uploadDocuments: false, assignTasks: false, viewReports: false },
      'hrm.leaves': { view: true, create: true, edit: false, delete: false, approve: true, reject: true, export: false, print: false, download: true, uploadDocuments: false, assignTasks: false, viewReports: false },
      'hrm.holidays': { view: true, create: false, edit: false, delete: false, approve: false, reject: false, export: false, print: true, download: true, uploadDocuments: false, assignTasks: false, viewReports: false },
    },
  },
  {
    id: 'branch_manager',
    name: 'Branch Manager',
    badge: 'Branch Manager',
    color: '#d97706',
    description: 'Branch Employees, Staff Attendance & Leaves approvals, Projects, Tasks & Site Logs',
    permissions: {
      'hrm.employees': { view: true, create: true, edit: true, delete: false, approve: false, reject: false, export: true, print: true, download: true, uploadDocuments: true, assignTasks: true, viewReports: true },
      'hrm.attendance': { view: true, create: true, edit: true, delete: false, approve: true, reject: true, export: true, print: true, download: true, uploadDocuments: true, assignTasks: false, viewReports: true },
      'hrm.calendar': { view: true, create: false, edit: false, delete: false, approve: false, reject: false, export: false, print: true, download: true, uploadDocuments: false, assignTasks: false, viewReports: false },
      'hrm.leaves': { view: true, create: true, edit: false, delete: false, approve: true, reject: true, export: true, print: false, download: true, uploadDocuments: true, assignTasks: false, viewReports: false },
      'hrm.holidays': { view: true, create: false, edit: false, delete: false, approve: false, reject: false, export: false, print: true, download: true, uploadDocuments: false, assignTasks: false, viewReports: false },
      'projectManagement.projects': { view: true, create: true, edit: true, delete: false, approve: true, reject: false, export: true, print: true, download: true, uploadDocuments: true, assignTasks: true, viewReports: true },
      'projectManagement.site-logs': { view: true, create: true, edit: true, delete: false, approve: true, reject: false, export: true, print: true, download: true, uploadDocuments: true, assignTasks: true, viewReports: true },
      'projectManagement.tasks': { view: true, create: true, edit: true, delete: false, approve: true, reject: false, export: true, print: true, download: true, uploadDocuments: true, assignTasks: true, viewReports: true },
      'hrm.reports': { view: true, create: false, edit: false, delete: false, approve: false, reject: false, export: true, print: true, download: true, uploadDocuments: false, assignTasks: false, viewReports: true },
    },
  },
  {
    id: 'accountant',
    name: 'Accountant / Finance Head',
    badge: 'Accountant',
    color: '#0891b2',
    description: 'Payroll cycles & Payslips, Assets & Reimbursement claims, Financial & Statutory Reports',
    permissions: {
      'hrm.payroll': { view: true, create: true, edit: true, delete: false, approve: true, reject: true, export: true, print: true, download: true, uploadDocuments: true, assignTasks: false, viewReports: true },
      'hrm.assets-claims': { view: true, create: true, edit: true, delete: false, approve: true, reject: true, export: true, print: true, download: true, uploadDocuments: true, assignTasks: false, viewReports: true },
      'hrm.reports': { view: true, create: true, edit: false, delete: false, approve: false, reject: false, export: true, print: true, download: true, uploadDocuments: false, assignTasks: false, viewReports: true },
      'hrm.attendance': { view: true, create: true, edit: false, delete: false, approve: false, reject: false, export: true, print: true, download: true, uploadDocuments: false, assignTasks: false, viewReports: true },
      'hrm.calendar': { view: true, create: false, edit: false, delete: false, approve: false, reject: false, export: false, print: true, download: true, uploadDocuments: false, assignTasks: false, viewReports: false },
      'hrm.leaves': { view: true, create: true, edit: false, delete: false, approve: false, reject: false, export: true, print: false, download: true, uploadDocuments: false, assignTasks: false, viewReports: false },
      'hrm.holidays': { view: true, create: false, edit: false, delete: false, approve: false, reject: false, export: false, print: true, download: true, uploadDocuments: false, assignTasks: false, viewReports: false },
    },
  },
];

// READ-ONLY aliases: used only when READING permissions back from backend
// (backend may have stored them under old keys from previous sessions)
const LEGACY_ALIASES = {
  recruitment: ['hrm.recruitment', 'crm.leadManagement', 'hrms.recruitment', 'recruitment'],
  employees: ['hrm.employees', 'hrms.employeeMaster', 'hrms.employees', 'employees'],
  attendance: ['hrm.attendance', 'hrms.attendance', 'attendance'],
  calendar: ['hrm.calendar', 'hrms.calendar', 'calendar'],
  leaves: ['hrm.leaves', 'hrms.leaveManagement', 'hrms.leaves', 'leaves'],
  holidays: ['hrm.holidays', 'hrms.holidays', 'holidays'],
  payroll: ['hrm.payroll', 'hrms.payrollManagement', 'hrms.payroll', 'payroll'],
  'assets-claims': ['hrm.assets-claims', 'hrms.assetCustody', 'hrms.assets', 'assets-claims', 'assets'],
  performance: ['hrm.performance', 'hrms.kraManagement', 'hrms.kra', 'performance'],
  reports: ['hrm.reports', 'hrms.hrmsReports', 'reports'],
  projects: ['projectManagement.projects', 'operations.projects', 'projects'],
  'site-logs': ['projectManagement.site-logs', 'operations.site-logs', 'site-logs'],
  tasks: ['projectManagement.tasks', 'operations.tasks', 'tasks'],
  companies: ['masters.companies', 'administration.multiBranchCompany', 'companies'],
  branches: ['masters.branches', 'administration.multiBranchCompany', 'branches'],
  departments: ['masters.departments', 'administration.systemSettings', 'departments'],
  designations: ['masters.designations', 'administration.systemSettings', 'designations'],
  roles: ['masters.roles', 'administration.rolePermissionManagement', 'roles'],
  users: ['masters.users', 'administration.rolePermissionManagement', 'users'],
};

export const getModuleShortName = (mod) => {
  if (!mod) return '';
  return mod.shortLabel || mod.displayName;
};

// Check if role has access to a module or any of its submodules
export function checkModuleAccess(role, permissionsMap, modKey, subModules = []) {
  if (!role) return false;
  if (role.isSuperAdmin || role.name === 'super_admin' || String(role.name || '').toLowerCase() === 'super admin') return true;

  const perms = permissionsMap || role.permissions;
  if (!perms || typeof perms !== 'object') return false;

  // 1. Direct check on moduleKey
  const modVal = perms[modKey];
  if (modVal === true) return true;
  if (modVal && typeof modVal === 'object' && (modVal.view || Object.values(modVal).some(Boolean))) return true;

  // 2. Check any submodule
  if (Array.isArray(subModules) && subModules.length > 0) {
    for (const sub of subModules) {
      const sk = typeof sub === 'string' ? sub : sub.subModuleKey || sub.key;
      const dotKey = `${modKey}.${sk}`;
      const subVal = perms[dotKey] ?? perms[sk];
      if (subVal === true) return true;
      if (subVal && typeof subVal === 'object' && (subVal.view || Object.values(subVal).some(Boolean))) return true;

      // Check legacy aliases
      const aliases = LEGACY_ALIASES[sk] || [];
      for (const al of aliases) {
        const alVal = perms[al];
        if (alVal === true || (alVal && typeof alVal === 'object' && (alVal.view || Object.values(alVal).some(Boolean)))) return true;
      }
    }
  }

  // 3. Fallback prefix check
  const prefix = `${modKey}.`;
  for (const [k, val] of Object.entries(perms)) {
    if (k.startsWith(prefix) || k.toLowerCase().startsWith(modKey.toLowerCase())) {
      if (val === true) return true;
      if (typeof val === 'object' && val !== null && (val.view || Object.values(val).some(Boolean))) return true;
    }
  }

  return false;
}

// Count active submodules for a module
export function countActiveSubModules(role, permissionsMap, modKey, subModules = []) {
  if (!role) return 0;
  if (role.isSuperAdmin || role.name === 'super_admin' || String(role.name || '').toLowerCase() === 'super admin') {
    return subModules.length;
  }
  const perms = permissionsMap || role.permissions || {};
  let count = 0;
  for (const sub of subModules) {
    const sk = sub.subModuleKey;
    const dotKey = `${modKey}.${sk}`;
    const val = perms[dotKey] ?? perms[sk];
    if (val === true || (val && typeof val === 'object' && (val.view || Object.values(val).some(Boolean)))) {
      count++;
    } else {
      const aliases = LEGACY_ALIASES[sk] || [];
      for (const al of aliases) {
        const alVal = perms[al];
        if (alVal === true || (alVal && typeof alVal === 'object' && (alVal.view || Object.values(alVal).some(Boolean)))) {
          count++;
          break;
        }
      }
    }
  }
  return count;
}

// Get action status for a submodule
export function getSubModuleActions(perms, modKey, subModuleKey) {
  if (!perms || typeof perms !== 'object') return createActionsObject(false);
  const dotKey = `${modKey}.${subModuleKey}`;
  const val = perms[dotKey] ?? perms[subModuleKey] ?? perms[modKey];

  if (val === true) return createActionsObject(true);
  if (!val || val === false) {
    const aliases = LEGACY_ALIASES[subModuleKey] || [];
    for (const al of aliases) {
      if (perms[al]) return getSubModuleActions({ [dotKey]: perms[al] }, modKey, subModuleKey);
    }
    return createActionsObject(false);
  }
  if (typeof val === 'object') {
    const act = {};
    ALL_ACTIONS.forEach((a) => {
      if (a === 'edit' && val.edit === undefined && val.update !== undefined) {
        act.edit = Boolean(val.update);
      } else {
        act[a] = Boolean(val[a]);
      }
    });
    return act;
  }
  return createActionsObject(false);
}

export const RolesPermissions = () => {
  const [roles, setRoles] = useState([]);
  const [catalog] = useState(DEFAULT_PERMISSION_CATALOG);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Pending changes: roleId -> permissions object
  const [pendingChanges, setPendingChanges] = useState({});
  const [savingRoleId, setSavingRoleId] = useState(null);
  const [savingAll, setSavingAll] = useState(false);

  // Role Metadata Modal (Create / Edit)
  const [roleModalOpen, setRoleModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState(null);
  const [roleForm, setRoleForm] = useState({ name: '', displayName: '', description: '' });
  const [submittingRole, setSubmittingRole] = useState(false);

  // Granular Matrix Modal
  const [matrixModalOpen, setMatrixModalOpen] = useState(false);
  const [matrixRole, setMatrixRole] = useState(null);
  const [matrixActiveMod, setMatrixActiveMod] = useState('hrm');
  const [matrixSearch, setMatrixSearch] = useState('');

  // Delete Confirm Dialog
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [roleToDelete, setRoleToDelete] = useState(null);
  const [deletingRole, setDeletingRole] = useState(false);

  const { showToast } = useToast();
  const { fetchUserProfile, refreshRoles } = useAuth();

  // ── Permission Override Helpers ─────────────────────────────────────────────
  // We persist saved permissions locally so they survive refresh even when
  // the backend returns stale / different-shaped data.
  const PERMS_STORE_KEY = 'tie_permissions_override';

  const readPermOverrides = () => {
    try { return JSON.parse(localStorage.getItem(PERMS_STORE_KEY) || '{}'); } catch { return {}; }
  };

  const writePermOverride = (roleId, perms) => {
    try {
      const store = readPermOverrides();
      store[roleId] = perms;
      localStorage.setItem(PERMS_STORE_KEY, JSON.stringify(store));
    } catch {}
  };

  // Merge locally-saved permission overrides on top of roles fetched from backend
  const mergeOverrides = (list) => {
    const overrides = readPermOverrides();
    if (!Object.keys(overrides).length) return list;
    return list.map((r) => {
      const id = r._id || r.id;
      if (overrides[id]) {
        return { ...r, permissions: overrides[id] };
      }
      return r;
    });
  };

  const loadRoles = useCallback(async () => {
    setLoading(true);
    try {
      // Always load fresh from backend on this admin page
      try { sessionStorage.removeItem('tie_skip_roles_api'); } catch {}
      const res = await masterApi.getRoles();
      const list = extractApiData(res, 'roles', 'data');
      if (Array.isArray(list) && list.length > 0) {
        // Merge locally-saved permission overrides so saved perms survive refresh
        const merged = mergeOverrides(list);
        setRoles(merged);
        try { localStorage.setItem('tie_roles', JSON.stringify(merged)); } catch {}
      } else {
        // Fall back to cache only when backend returns nothing
        const cached = localStorage.getItem('tie_roles');
        if (cached) {
          const cachedList = JSON.parse(cached);
          setRoles(mergeOverrides(cachedList));
        }
      }
      setPendingChanges({});
    } catch (err) {
      console.error('Failed to load roles:', err);
      try {
        const cached = localStorage.getItem('tie_roles');
        if (cached) {
          const cachedList = JSON.parse(cached);
          setRoles(mergeOverrides(cachedList));
        }
      } catch {}
      showToast('Failed to load roles from backend API', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadRoles();
  }, [loadRoles]);

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

  // Toggle whole module from the quick-toggle pill on the card (HRM, Project Management, Masters)
  const handleToggleModule = (role, mod) => {
    if (role.isSuperAdmin || role.name === 'super_admin') return;

    const currentPerms = { ...getRolePerms(role) };
    const modKey = mod.moduleKey;
    const subModules = mod.subModules || [];
    const hasAccess = checkModuleAccess(role, currentPerms, modKey, subModules);

    const updatedPerms = { ...currentPerms };
    const targetActions = hasAccess ? createActionsObject(false) : createActionsObject(true);

    // Write only canonical dotKeys
    subModules.forEach((sub) => {
      updatedPerms[`${modKey}.${sub.subModuleKey || sub.key}`] = targetActions;
    });

    setPendingChanges((prev) => ({ ...prev, [role._id]: updatedPerms }));
  };

  // Select all modules for a role
  const handleSelectAll = (role) => {
    if (role.isSuperAdmin || role.name === 'super_admin') return;
    const updatedPerms = {};
    const allActions = createActionsObject(true);

    catalog.modules.forEach((mod) => {
      if (mod.subModules) {
        mod.subModules.forEach((sub) => {
          updatedPerms[`${mod.moduleKey}.${sub.subModuleKey || sub.key}`] = allActions;
        });
      }
    });

    setPendingChanges((prev) => ({ ...prev, [role._id]: updatedPerms }));
  };

  // Clear all modules for a role
  const handleClearAll = (role) => {
    if (role.isSuperAdmin || role.name === 'super_admin') return;
    const updatedPerms = {};
    const zeroActions = createActionsObject(false);

    catalog.modules.forEach((mod) => {
      if (mod.subModules) {
        mod.subModules.forEach((sub) => {
          updatedPerms[`${mod.moduleKey}.${sub.subModuleKey || sub.key}`] = zeroActions;
        });
      }
    });

    setPendingChanges((prev) => ({ ...prev, [role._id]: updatedPerms }));
  };

  // Apply a 1-click Preset Template to a role
  const handleApplyPreset = (role, preset) => {
    if (!role || role.isSuperAdmin || role.name === 'super_admin') {
      showToast('Super Admin already has full access to all features.', 'info');
      return;
    }

    const updatedPerms = {};
    const zeroActions = createActionsObject(false);

    // Initialize all catalog submodules as ungranted
    catalog.modules.forEach((mod) => {
      if (mod.subModules) {
        mod.subModules.forEach((sub) => {
          updatedPerms[`${mod.moduleKey}.${sub.subModuleKey || sub.key}`] = zeroActions;
        });
      }
    });

    // Populate preset permissions
    for (const [dotKey, acts] of Object.entries(preset.permissions || {})) {
      const fullActObj = {};
      ALL_ACTIONS.forEach((a) => {
        fullActObj[a] = Boolean(acts[a]);
      });
      updatedPerms[dotKey] = fullActObj;
    }

    setPendingChanges((prev) => ({ ...prev, [role._id]: updatedPerms }));
    showToast(`Applied "${preset.name}" preset! Review and click Save to confirm.`, 'success');
  };

  // Toggle a specific action in the Granular Matrix Modal
  const handleToggleSubModuleAction = (roleId, modKey, subModuleKey, actionName) => {
    const role = roles.find((r) => r._id === roleId);
    if (!role || role.isSuperAdmin || role.name === 'super_admin') return;

    const currentPerms = { ...getRolePerms(role) };
    const dotKey = `${modKey}.${subModuleKey}`;
    const currentActions = getSubModuleActions(currentPerms, modKey, subModuleKey);

    const nextVal = !currentActions[actionName];
    const updatedActions = { ...currentActions, [actionName]: nextVal };

    // If enabling any action other than view -> auto-enable view
    if (nextVal && actionName !== 'view') updatedActions.view = true;
    // If disabling view -> disable all
    if (actionName === 'view' && !nextVal) ALL_ACTIONS.forEach((a) => { updatedActions[a] = false; });

    // Write only the canonical dotKey — backend is source of truth
    const updatedPerms = { ...currentPerms, [dotKey]: updatedActions };

    setPendingChanges((prev) => ({ ...prev, [roleId]: updatedPerms }));
  };

  // Grant or clear all actions for a specific submodule
  const handleToggleAllActionsForSubModule = (roleId, modKey, subModuleKey, grantAll = true) => {
    const role = roles.find((r) => r._id === roleId);
    if (!role || role.isSuperAdmin || role.name === 'super_admin') return;

    const currentPerms = { ...getRolePerms(role) };
    const dotKey = `${modKey}.${subModuleKey}`;
    const newActions = createActionsObject(grantAll);

    // Write only the canonical dotKey
    const updatedPerms = { ...currentPerms, [dotKey]: newActions };

    setPendingChanges((prev) => ({ ...prev, [roleId]: updatedPerms }));
  };

  // Grant or clear all actions for an entire module inside the Matrix
  const handleToggleAllForModule = (roleId, modKey, grantAll = true) => {
    const role = roles.find((r) => r._id === roleId);
    if (!role || role.isSuperAdmin || role.name === 'super_admin') return;

    const currentPerms = { ...getRolePerms(role) };
    const mod = catalog.modules.find((m) => m.moduleKey === modKey);
    if (!mod) return;

    const newActions = createActionsObject(grantAll);
    const updatedPerms = { ...currentPerms };

    // Write only canonical dotKeys per submodule
    mod.subModules.forEach((sub) => {
      updatedPerms[`${modKey}.${sub.subModuleKey}`] = newActions;
    });

    setPendingChanges((prev) => ({ ...prev, [roleId]: updatedPerms }));
  };

  // Save changes for one role
  const handleSaveRole = async (roleId) => {
    const role = roles.find((r) => r._id === roleId || r.id === roleId || String(r._id) === String(roleId));
    if (!role) return;

    if (role.isSuperAdmin || role.name === 'super_admin') {
      showToast('Super Admin has full access to all features', 'info');
      return;
    }

    const permsToSave = pendingChanges[roleId] || role.permissions || {};
    setSavingRoleId(roleId);

    try {
      // 1. Persist to guaranteed localStorage override FIRST (survives refresh)
      writePermOverride(roleId, permsToSave);

      // 2. Send to backend
      await masterApi.updateRolePermissions(roleId, permsToSave);

      // 3. Try to re-fetch the actual stored state from backend to stay in sync
      let finalPerms = permsToSave;
      try {
        const freshRes = await apiClient.get(`/roles/${roleId}`);
        const freshRole = freshRes.data?.data || freshRes.data?.role || freshRes.data;
        if (freshRole?.permissions && typeof freshRole.permissions === 'object' && Object.keys(freshRole.permissions).length > 0) {
          finalPerms = freshRole.permissions;
          // Update override with whatever backend actually stored
          writePermOverride(roleId, finalPerms);
        }
      } catch {
        // Backend re-fetch failed — keep the locally saved permsToSave
      }

      // 4. Update React state and localStorage cache
      const updatedRoles = roles.map((r) =>
        r._id === roleId || r.id === roleId ? { ...r, permissions: finalPerms } : r
      );
      setRoles(updatedRoles);
      try { localStorage.setItem('tie_roles', JSON.stringify(updatedRoles)); } catch {}

      // 5. Keep matrixRole in sync if modal is open
      setMatrixRole((prev) =>
        prev && (prev._id === roleId || prev.id === roleId)
          ? { ...prev, permissions: finalPerms }
          : prev
      );

      setPendingChanges((prev) => {
        const next = { ...prev };
        delete next[roleId];
        return next;
      });

      showToast(`Permissions saved for ${role.displayName || role.name}!`, 'success');

      if (refreshRoles) await refreshRoles();
      if (fetchUserProfile) await fetchUserProfile();
      window.dispatchEvent(new CustomEvent('tie:permissions-updated', { detail: { roleId } }));
    } catch (err) {
      console.error(err);
      showToast(err?.response?.data?.message || err?.message || 'Failed to save permissions', 'error');
    } finally {
      setSavingRoleId(null);
    }
  };

  // Save all pending roles
  const handleSaveAll = async () => {
    const ids = Object.keys(pendingChanges);
    if (ids.length === 0) return;

    setSavingAll(true);
    try {
      for (const roleId of ids) {
        const perms = pendingChanges[roleId] || {};
        // Persist to localStorage override FIRST
        writePermOverride(roleId, perms);
        await masterApi.updateRolePermissions(roleId, perms);
      }

      const updatedRoles = roles.map((r) =>
        pendingChanges[r._id] ? { ...r, permissions: pendingChanges[r._id] } : r
      );
      setRoles(updatedRoles);
      try { localStorage.setItem('tie_roles', JSON.stringify(updatedRoles)); } catch {}
      setPendingChanges({});

      showToast(`Successfully saved permissions for all ${ids.length} modified roles!`, 'success');

      if (refreshRoles) await refreshRoles();
      if (fetchUserProfile) await fetchUserProfile();
      window.dispatchEvent(new CustomEvent('tie:permissions-updated', { detail: {} }));
    } catch (err) {
      console.error(err);
      showToast('Error saving all permissions', 'error');
    } finally {
      setSavingAll(false);
    }
  };

  // Save Role Metadata (Create / Edit)
  const handleSaveRoleMetadata = async (e) => {
    e.preventDefault();
    if (!roleForm.name.trim()) {
      showToast('Role code is required', 'error');
      return;
    }

    setSubmittingRole(true);
    try {
      if (editingRole) {
        const res = await masterApi.updateRole(editingRole._id, {
          displayName: roleForm.displayName || roleForm.name,
          description: roleForm.description,
        });
        const updated = extractApiData(res, 'role', 'data') || res.data || res;
        setRoles((prev) => prev.map((r) => (r._id === editingRole._id ? { ...r, ...updated } : r)));
        showToast('Role updated successfully', 'success');
      } else {
        const res = await masterApi.createRole({
          name: roleForm.name.toLowerCase().replace(/\s+/g, '_').trim(),
          displayName: roleForm.displayName || roleForm.name,
          description: roleForm.description,
          permissions: {},
        });
        const created = extractApiData(res, 'role', 'data') || res.data || res;
        setRoles((prev) => [...prev, created]);
        showToast('Role created successfully', 'success');
      }
      setRoleModalOpen(false);
      setEditingRole(null);
      if (refreshRoles) await refreshRoles();
    } catch (err) {
      console.error(err);
      showToast(err?.response?.data?.message || err?.message || 'Failed to save role', 'error');
    } finally {
      setSubmittingRole(false);
    }
  };

  // Delete Role
  const handleDeleteRole = async () => {
    if (!roleToDelete) return;
    setDeletingRole(true);
    try {
      await masterApi.deleteRole(roleToDelete._id);
      setRoles((prev) => prev.filter((r) => r._id !== roleToDelete._id));
      showToast('Role deleted successfully', 'success');
      setDeleteModalOpen(false);
      setRoleToDelete(null);
      if (refreshRoles) await refreshRoles();
    } catch (err) {
      console.error(err);
      showToast(err?.response?.data?.message || err?.message || 'Failed to delete role', 'error');
    } finally {
      setDeletingRole(false);
    }
  };

  const filteredRoles = useMemo(() => {
    if (!search.trim()) return roles;
    const s = search.toLowerCase();
    return roles.filter(
      (r) =>
        r.name.toLowerCase().includes(s) ||
        r.displayName?.toLowerCase().includes(s) ||
        r.description?.toLowerCase().includes(s)
    );
  }, [roles, search]);

  const pendingCount = Object.keys(pendingChanges).length;

  const selectedMatrixModule = useMemo(() => {
    return catalog.modules.find((m) => m.moduleKey === matrixActiveMod) || catalog.modules[0];
  }, [catalog.modules, matrixActiveMod]);

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
            Manage access for <strong>HRM</strong>, <strong>Project Management</strong>, and <strong>Masters</strong>, then configure granular permissions in Matrix.
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <Button
            variant="secondary"
            icon={RefreshCw}
            onClick={loadRoles}
            loading={loading}
            title="Reload roles from backend"
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
            Allowed
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

      {/* ═══════════════════════════════════════════════════════════════════
          ROLES LIST: ROLE INFO ON LEFT, 3 MODULES IN CENTER, SAVE ON RIGHT
         ═══════════════════════════════════════════════════════════════════ */}
      {loading ? (
        <div className="card" style={{ padding: '36px 20px', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, color: 'var(--text-muted)' }}>
            <span className="spinner-ring" />
            <span style={{ fontSize: '0.88rem', color: 'var(--text-main)', fontWeight: 500 }}>
              Loading roles from backend...
            </span>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filteredRoles.map((role) => {
            const isSuper = role.isSuperAdmin || role.name === 'super_admin' || String(role.name || '').toLowerCase() === 'super admin';
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
                  padding: '12px 16px',
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
                          setMatrixActiveMod('hrm');
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
                        title="Configure granular permissions across submodules"
                      >
                        <Sliders size={11} />
                        Matrix
                      </button>
                    </div>
                  )}
                </div>

                {/* CENTER: Exact 3 Outside Options (HRM, Project Management, Masters) */}
                <div
                  style={{
                    flex: 1,
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                    gap: 10,
                    minWidth: 0,
                  }}
                >
                  {catalog.modules.map((mod) => {
                    const hasAccess = checkModuleAccess(role, perms, mod.moduleKey, mod.subModules);
                    const activeSubs = countActiveSubModules(role, perms, mod.moduleKey, mod.subModules);
                    const ModIcon = mod.icon;

                    return (
                      <label
                        key={mod.moduleKey}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 10,
                          padding: '8px 12px',
                          borderRadius: 7,
                          border: hasAccess
                            ? '1.5px solid var(--primary)'
                            : '1px solid var(--border-color)',
                          backgroundColor: hasAccess
                            ? 'rgba(42, 171, 160, 0.08)'
                            : '#ffffff',
                          cursor: isSuper ? 'default' : 'pointer',
                          userSelect: 'none',
                          transition: 'all 0.12s ease',
                          margin: 0,
                          boxSizing: 'border-box',
                        }}
                        title={`${mod.displayName}: ${mod.description || ''}`}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                          <input
                            type="checkbox"
                            checked={hasAccess}
                            disabled={isSuper}
                            onChange={() => handleToggleModule(role, mod)}
                            style={{
                              width: 15,
                              height: 15,
                              accentColor: 'var(--primary)',
                              cursor: isSuper ? 'default' : 'pointer',
                              margin: 0,
                              flexShrink: 0,
                            }}
                          />
                          <ModIcon size={16} color={hasAccess ? 'var(--primary)' : 'var(--text-muted)'} style={{ flexShrink: 0 }} />
                          <span
                            style={{
                              fontSize: '0.84rem',
                              fontWeight: hasAccess ? 700 : 500,
                              color: hasAccess ? 'var(--text-main)' : 'var(--text-muted)',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                          >
                            {getModuleShortName(mod)}
                          </span>
                        </div>

                        <span
                          style={{
                            fontSize: '0.68rem',
                            fontWeight: 600,
                            padding: '1px 6px',
                            borderRadius: 10,
                            backgroundColor: hasAccess ? 'var(--primary)' : 'var(--bg-subtle, #e2e8f0)',
                            color: hasAccess ? '#ffffff' : 'var(--text-muted)',
                            whiteSpace: 'nowrap',
                            flexShrink: 0,
                          }}
                        >
                          {isSuper ? 'All' : `${activeSubs}/${mod.subModules.length}`}
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
                        padding: '4px 10px',
                        fontSize: '0.76rem',
                        height: 28,
                        minWidth: 62,
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
                          padding: '3px 4px',
                          cursor: 'pointer',
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
                          color: '#ef4444',
                          padding: '3px 4px',
                          cursor: 'pointer',
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
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          GRANULAR PERMISSIONS MATRIX MODAL (Proper options inside)
         ═══════════════════════════════════════════════════════════════════ */}
      <Modal
        isOpen={matrixModalOpen}
        onClose={() => setMatrixModalOpen(false)}
        title={
          matrixRole
            ? `Permission Matrix: ${matrixRole.displayName || matrixRole.name}`
            : 'Permission Matrix'
        }
        size="2xl"
        maxWidth="1220px"
        width="95vw"
        style={{ maxHeight: '92vh' }}
      >
        {(() => {
          const currentRole = matrixRole
            ? roles.find(
                (r) =>
                  r._id === matrixRole._id ||
                  r.id === matrixRole._id ||
                  r.name === matrixRole.name
              ) || matrixRole
            : null;

          if (!currentRole) return null;

          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* Modal Subheader with Role Info & Quick Actions */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 10,
                  padding: '10px 16px',
                  backgroundColor: 'var(--bg-subtle, #f8fafc)',
                  borderRadius: 8,
                  border: '1px solid var(--border-color)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--text-main)' }}>
                    Configuring Role:
                  </span>
                  <span
                    style={{
                      fontSize: '0.88rem',
                      color: 'var(--primary)',
                      fontWeight: 700,
                      backgroundColor: 'rgba(42, 171, 160, 0.1)',
                      padding: '2px 10px',
                      borderRadius: 6,
                    }}
                  >
                    {currentRole.displayName || currentRole.name}
                  </span>
                  <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                    ({currentRole.isSystem ? 'System Role' : 'Custom Role'})
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Button
                    size="sm"
                    variant="ghost"
                    type="button"
                    onClick={() => handleSelectAll(currentRole)}
                    style={{ fontSize: '0.76rem', padding: '4px 10px' }}
                  >
                    Grant All Modules
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    type="button"
                    onClick={() => handleClearAll(currentRole)}
                    style={{ fontSize: '0.76rem', padding: '4px 10px', color: '#ef4444' }}
                  >
                    Clear All
                  </Button>
                  <Button
                    size="sm"
                    variant="primary"
                    type="button"
                    icon={Save}
                    loading={savingRoleId === currentRole._id}
                    onClick={async () => {
                      await handleSaveRole(currentRole._id);
                      setMatrixModalOpen(false);
                    }}
                    style={{ fontSize: '0.76rem', padding: '4px 14px' }}
                  >
                    Save &amp; Close
                  </Button>
                </div>
              </div>



              {/* The 3 Main Tabs: HRM (10), Project Management (3), Masters (6) */}
              <div
                style={{
                  display: 'flex',
                  gap: 6,
                  borderBottom: '2px solid var(--border-color)',
                  paddingBottom: 0,
                }}
              >
                {catalog.modules.map((m) => {
                  const isSel = m.moduleKey === matrixActiveMod;
                  const perms = getRolePerms(currentRole);
                  const activeSubs = countActiveSubModules(currentRole, perms, m.moduleKey, m.subModules);
                  const MIcon = m.icon;

                  return (
                    <button
                      key={m.moduleKey}
                      type="button"
                      onClick={() => {
                        setMatrixActiveMod(m.moduleKey);
                        setMatrixSearch('');
                      }}
                      style={{
                        padding: '10px 18px',
                        fontSize: '0.86rem',
                        fontWeight: isSel ? 700 : 500,
                        color: isSel ? 'var(--primary)' : 'var(--text-main)',
                        border: 'none',
                        borderBottom: isSel ? '3px solid var(--primary)' : '3px solid transparent',
                        background: isSel ? 'rgba(42, 171, 160, 0.08)' : 'transparent',
                        borderRadius: '6px 6px 0 0',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        marginBottom: -2,
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <MIcon size={17} />
                      <span>{m.displayName}</span>
                      <span
                        style={{
                          fontSize: '0.72rem',
                          padding: '1px 7px',
                          borderRadius: 10,
                          backgroundColor: isSel ? 'var(--primary)' : 'var(--bg-subtle, #e2e8f0)',
                          color: isSel ? '#ffffff' : 'var(--text-muted)',
                          fontWeight: 700,
                        }}
                      >
                        {activeSubs}/{m.subModules.length}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Matrix Search & Module Quick Toggles */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 10,
                  padding: '2px 0',
                }}
              >
                <div style={{ position: 'relative', width: 280 }}>
                  <Input
                    placeholder={`Search ${selectedMatrixModule?.displayName} options...`}
                    value={matrixSearch}
                    onChange={(e) => setMatrixSearch(e.target.value)}
                    style={{ paddingLeft: 30, fontSize: '0.8rem', height: 32, marginBottom: 0 }}
                  />
                  <Search
                    size={14}
                    color="var(--text-muted)"
                    style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)' }}
                  />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    Showing {filteredSubModules.length} options
                  </span>
                  <button
                    type="button"
                    onClick={() => handleToggleAllForModule(currentRole._id, selectedMatrixModule.moduleKey, true)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--primary)',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      textDecoration: 'underline',
                    }}
                  >
                    Grant All {selectedMatrixModule?.displayName}
                  </button>
                  <span style={{ color: 'var(--border-color)' }}>|</span>
                  <button
                    type="button"
                    onClick={() => handleToggleAllForModule(currentRole._id, selectedMatrixModule.moduleKey, false)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-muted)',
                      fontSize: '0.78rem',
                      cursor: 'pointer',
                      textDecoration: 'underline',
                    }}
                  >
                    Clear {selectedMatrixModule?.displayName}
                  </button>
                </div>
              </div>

              {/* Granular Sub-modules Table with Sticky Header & NO Horizontal Scroll */}
              <div
                style={{
                  maxHeight: 'min(60vh, 460px)',
                  overflowY: 'auto',
                  overflowX: 'hidden',
                  border: '1px solid var(--border-color)',
                  borderRadius: 8,
                  backgroundColor: 'var(--bg-surface, #ffffff)',
                }}
              >
                <table
                  style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    fontSize: '0.84rem',
                    tableLayout: 'fixed',
                  }}
                >
                  <thead>
                    <tr
                      style={{
                        position: 'sticky',
                        top: 0,
                        zIndex: 2,
                        background: 'var(--bg-subtle, #f8fafc)',
                        borderBottom: '2px solid var(--border-color)',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                      }}
                    >
                      <th
                        style={{
                          padding: '11px 16px',
                          textAlign: 'left',
                          fontWeight: 700,
                          width: '36%',
                          color: 'var(--text-main)',
                        }}
                      >
                        {selectedMatrixModule?.displayName} Sub-Module / Feature
                      </th>
                      {MATRIX_UI_ACTIONS.map((action) => (
                        <th
                          key={action}
                          style={{
                            padding: '11px 4px',
                            textAlign: 'center',
                            fontWeight: 700,
                            textTransform: 'capitalize',
                            width: '8%',
                            color: 'var(--text-main)',
                            fontSize: '0.8rem',
                          }}
                        >
                          {action === 'edit' ? 'Edit' : action}
                        </th>
                      ))}
                      <th
                        style={{
                          padding: '11px 14px',
                          textAlign: 'center',
                          fontWeight: 700,
                          width: '16%',
                          color: 'var(--text-main)',
                        }}
                      >
                        Quick Action
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredSubModules.map((sub, idx) => {
                      const perms = getRolePerms(currentRole);
                      const actions = getSubModuleActions(perms, selectedMatrixModule.moduleKey, sub.subModuleKey);
                      const allGranted = MATRIX_UI_ACTIONS.every((a) => actions[a]);
                      const anyGranted = Object.values(actions).some(Boolean);

                      return (
                        <tr
                          key={sub.subModuleKey}
                          style={{
                            borderBottom: '1px solid var(--border-color)',
                            backgroundColor: anyGranted ? 'rgba(42, 171, 160, 0.03)' : 'transparent',
                            transition: 'background-color 0.15s ease',
                          }}
                        >
                          <td style={{ padding: '10px 16px', overflow: 'hidden' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <span
                                style={{
                                  width: 22,
                                  height: 22,
                                  borderRadius: 5,
                                  backgroundColor: anyGranted ? 'var(--primary)' : 'var(--bg-subtle, #e2e8f0)',
                                  color: anyGranted ? '#fff' : 'var(--text-muted)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: '0.72rem',
                                  fontWeight: 700,
                                  flexShrink: 0,
                                }}
                              >
                                {idx + 1}
                              </span>
                              <div style={{ minWidth: 0, flex: 1 }}>
                                <div
                                  style={{
                                    fontWeight: 600,
                                    color: 'var(--text-main)',
                                    fontSize: '0.85rem',
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                  }}
                                  title={sub.displayName}
                                >
                                  {sub.displayName}
                                </div>
                                {sub.description && (
                                  <div
                                    style={{
                                      fontSize: '0.72rem',
                                      color: 'var(--text-muted)',
                                      marginTop: 1,
                                      whiteSpace: 'nowrap',
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                    }}
                                    title={sub.description}
                                  >
                                    {sub.description}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>

                          {MATRIX_UI_ACTIONS.map((action) => (
                            <td
                              key={action}
                              style={{
                                padding: '8px 4px',
                                textAlign: 'center',
                                verticalAlign: 'middle',
                              }}
                            >
                              <input
                                type="checkbox"
                                id={`chk_${currentRole._id}_${selectedMatrixModule.moduleKey}_${sub.subModuleKey}_${action}`}
                                checked={Boolean(actions[action])}
                                onChange={() =>
                                  handleToggleSubModuleAction(
                                    currentRole._id,
                                    selectedMatrixModule.moduleKey,
                                    sub.subModuleKey,
                                    action
                                  )
                                }
                                style={{
                                  width: 17,
                                  height: 17,
                                  accentColor: 'var(--primary)',
                                  cursor: 'pointer',
                                }}
                              />
                            </td>
                          ))}

                          <td style={{ padding: '8px 14px', textAlign: 'center' }}>
                            <button
                              type="button"
                              onClick={() =>
                                handleToggleAllActionsForSubModule(
                                  currentRole._id,
                                  selectedMatrixModule.moduleKey,
                                  sub.subModuleKey,
                                  !allGranted
                                )
                              }
                              style={{
                                padding: '4px 12px',
                                fontSize: '0.74rem',
                                fontWeight: 600,
                                borderRadius: 5,
                                border: '1px solid var(--border-color)',
                                background: allGranted ? 'var(--primary)' : 'var(--bg-subtle, #f1f5f9)',
                                color: allGranted ? '#fff' : 'var(--text-main)',
                                cursor: 'pointer',
                                whiteSpace: 'nowrap',
                                transition: 'all 0.15s ease',
                              }}
                            >
                              {allGranted ? 'Revoke All' : 'Grant All'}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Modal Footer with Status & Save */}
              <div
                className="modal-footer"
                style={{
                  margin: '6px -20px -20px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '12px 20px',
                  borderTop: '1px solid var(--border-color)',
                }}
              >
                <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                  Changes will be permanently applied to{' '}
                  <strong>{currentRole.displayName || currentRole.name}</strong>.
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <Button variant="secondary" type="button" onClick={() => setMatrixModalOpen(false)}>
                    Close
                  </Button>
                  <Button
                    variant="primary"
                    type="button"
                    icon={Save}
                    loading={savingRoleId === currentRole._id}
                    onClick={async () => {
                      await handleSaveRole(currentRole._id);
                      setMatrixModalOpen(false);
                    }}
                  >
                    Save Permissions
                  </Button>
                </div>
              </div>
            </div>
          );
        })()}
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
