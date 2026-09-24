import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import authApi from '../api/authApi';
import userApi from '../api/userApi';
import masterApi from '../api/masterApi';
import employeeApi from '../api/employeeApi';
import { saveRegisteredSelfie } from '../utils/faceComparison';

const defaultAuthValue = {
  user: null,
  loading: false,
  isAuthenticated: false,
  roleId: '',
  userRole: '',
  company: null,
  branch: null,
  isSuperAdmin: false,
  isDirector: false,
  isHrAdmin: false,
  isBranchManager: false,
  isProjectExecutive: false,
  isAccountant: false,
  isEmployee: false,
  isFieldStaff: false,
  allRoles: [],
  backendMenu: [],
  dashboardWidgets: [],
  hasRole: () => false,
  hasPermission: () => false,
  canAccessModule: () => false,
  hasBackendMenu: () => false,
  hasWidget: () => false,
  login: async () => {},
  logout: async () => {},
  refreshSession: async () => {},
  fetchUserProfile: async () => null,
  refreshRoles: async () => [],
  updateProfile: async () => {},
  changePassword: async () => {},
};

const MODULE_TO_MENU_KEYS = {
  dashboard: ['dashboard'],
  employees: ['hrms', 'hrms.employees', '/hrms/employees', '/employees'],
  attendance: ['hrms', 'hrms.attendance', 'project.attendance', '/hrms/attendance', '/attendance'],
  leaves: ['hrms', 'hrms.leaves', 'leaves', '/hrms/leaves', '/leaves'],
  payroll: ['hrms', 'hrms.payroll', 'accounting', 'payroll', '/hrms/payroll', '/accounting', '/payroll'],
  recruitment: ['hrms', 'crm', 'crm.leads', '/recruitment'],
  'assets-claims': ['hrms', 'hrms.assets', 'accounting', 'inventory', '/assets-claims', '/accounting'],
  assets: ['hrms', 'hrms.assets', 'accounting', 'inventory', '/assets-claims'],
  claims: ['hrms', 'hrms.assets', 'accounting', '/assets-claims'],
  performance: ['hrms', 'hrms.kra', '/performance'],
  lifecycle: ['hrms', 'hrms.employees', '/lifecycle', '/employees'],
  reports: ['reports', 'hrms', '/reports'],
  projects: ['project', 'installation-qc', 'noc-amc', '/project', '/operations/projects'],
  'site-logs': ['project', 'installation-qc', '/operations/site-logs'],
  tasks: ['project', 'project.tasks', '/project/tasks', '/operations/tasks'],
  companies: ['admin', 'admin.settings', '/admin', '/masters/companies'],
  branches: ['admin', 'admin.settings', '/admin', '/masters/branches'],
  departments: ['admin', 'admin.settings', '/admin', '/masters/departments'],
  designations: ['admin', 'admin.settings', '/admin', '/masters/designations'],
  roles: ['admin', 'admin.roles', '/admin/roles', '/masters/roles'],
  users: ['admin', 'admin.users', '/admin/users', '/masters/users'],
  masters: ['admin', 'admin.settings', 'admin.roles', 'admin.users', '/admin'],
};

export const checkBackendMenuAccess = (menuList, moduleKey) => {
  if (!Array.isArray(menuList) || menuList.length === 0) return false;
  const targetKeys = MODULE_TO_MENU_KEYS[moduleKey] || [moduleKey];
  for (const item of menuList) {
    if (!item) continue;
    const itemKey = item.key?.toLowerCase();
    const itemRoute = item.route?.toLowerCase();
    for (const tk of targetKeys) {
      const tkLower = tk.toLowerCase();
      if (itemKey === tkLower || itemRoute === tkLower) return true;
    }
    if (Array.isArray(item.children) && item.children.length > 0) {
      for (const child of item.children) {
        if (!child) continue;
        const childKey = child.key?.toLowerCase();
        const childRoute = child.route?.toLowerCase();
        for (const tk of targetKeys) {
          const tkLower = tk.toLowerCase();
          if (childKey === tkLower || childRoute === tkLower) return true;
        }
      }
    }
  }
  return false;
};

const AuthContext = createContext(defaultAuthValue);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [allRoles, setAllRoles] = useState(() => {
    try {
      const saved = localStorage.getItem('tie_roles');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  // ─── Multi-Role Helpers ────────────────────────────────────────────────────

  const getRoleIdentifiers = (u) => {
    if (!u) return [];
    if (Array.isArray(u.roles) && u.roles.length > 0) {
      return u.roles.map((r) => {
        if (typeof r === 'string') return r.toLowerCase();
        return String(r.name || r.displayName || r.slug || r._id || '').toLowerCase();
      });
    }
    if (u.role) {
      const r = u.role;
      const str = typeof r === 'string' ? r : (r.name || r.displayName || r.slug || String(r._id || ''));
      return [str.toLowerCase()];
    }
    return [];
  };

  const getRoleIdentifier = (u) => getRoleIdentifiers(u)[0] || '';

  const getMergedPermissions = (u, rolesList = []) => {
    const merged = {};
    const roles = Array.isArray(u?.roles) && u.roles.length > 0 ? u.roles : (u?.role ? [u.role] : []);
    for (const roleRef of roles) {
      let roleObj = typeof roleRef === 'object' && roleRef !== null ? roleRef : null;
      if (!roleObj && typeof roleRef === 'string' && rolesList.length > 0) {
        roleObj = rolesList.find((r) => r._id === roleRef || r.name === roleRef);
      }
      const perms = roleObj?.permissions;
      if (perms && typeof perms === 'object' && !Array.isArray(perms)) {
        for (const [key, val] of Object.entries(perms)) {
          if (merged[key] === undefined) {
            merged[key] = val;
          } else if (typeof val === 'object' && val !== null && typeof merged[key] === 'object') {
            merged[key] = { ...merged[key], ...val };
          } else {
            merged[key] = merged[key] === true || val === true ? true : merged[key];
          }
        }
      }
    }
    const directPerms = u?.permissions;
    if (directPerms && typeof directPerms === 'object' && !Array.isArray(directPerms)) {
      for (const [key, val] of Object.entries(directPerms)) {
        if (merged[key] === undefined) merged[key] = val;
      }
    }
    return merged;
  };

  const getMergedMenu = (u) => {
    const seen = new Set();
    const merged = [];
    const roles = Array.isArray(u?.roles) && u.roles.length > 0 ? u.roles : (u?.role ? [u.role] : []);
    for (const roleRef of roles) {
      const roleObj = typeof roleRef === 'object' && roleRef !== null ? roleRef : null;
      if (!roleObj) continue;
      const menu = Array.isArray(roleObj.menu) ? roleObj.menu : [];
      for (const item of menu) {
        const key = item?.key || item?.route || JSON.stringify(item);
        if (!seen.has(key)) { seen.add(key); merged.push(item); }
      }
    }
    if (merged.length === 0 && Array.isArray(u?.menu)) return u.menu;
    return merged;
  };

  const getMergedWidgets = (u) => {
    const seen = new Set();
    const roles = Array.isArray(u?.roles) && u.roles.length > 0 ? u.roles : (u?.role ? [u.role] : []);
    for (const roleRef of roles) {
      const roleObj = typeof roleRef === 'object' && roleRef !== null ? roleRef : null;
      if (!roleObj) continue;
      const widgets = Array.isArray(roleObj.dashboardWidgets) ? roleObj.dashboardWidgets : [];
      widgets.forEach((w) => seen.add(w));
    }
    if (seen.size === 0) {
      const fallback = u?.role?.dashboardWidgets || u?.dashboardWidgets || [];
      fallback.forEach((w) => seen.add(w));
    }
    return [...seen];
  };

  const getDesignationIdentifier = (u) => {
    if (!u) return '';
    const d = u.designation || u.employee?.employmentInfo?.designation || u.employee?.designation;
    if (typeof d === 'string') return d.toLowerCase();
    if (d && typeof d === 'object') return (d.name || d.title || '').toLowerCase();
    if (u.jobTitle) return String(u.jobTitle).toLowerCase();
    if (u.title) return String(u.title).toLowerCase();
    return '';
  };

  const rolesLoadedRef = useRef(false);

  const refreshRoles = useCallback(async () => {
    try {
      const res = await masterApi.getRoles();
      const list = res?.data || res?.roles || (Array.isArray(res) ? res : []);
      if (Array.isArray(list) && list.length > 0) {
        rolesLoadedRef.current = true;
        setAllRoles(list);
        localStorage.setItem('tie_roles', JSON.stringify(list));
        return list;
      }
    } catch (err) {
      console.warn('Roles fetch error (using cache if available):', err?.message || err);
    }
    return [];
  }, []);

  const fetchUserProfile = useCallback(async () => {
    const token = localStorage.getItem('tie_access_token');
    if (!token) return null;
    try {
      const res = await userApi.getProfile();
      let userData = res?.data || res?.user || res;
      if (userData && (userData._id || userData.email)) {
        let rolesToUse = [];
        try {
          const cached = localStorage.getItem('tie_roles');
          if (cached) rolesToUse = JSON.parse(cached);
        } catch {}
        if (!rolesLoadedRef.current || rolesToUse.length === 0) {
          try {
            const rolesRes = await masterApi.getRoles();
            const fetchedRoles = rolesRes?.data || rolesRes?.roles || (Array.isArray(rolesRes) ? rolesRes : null);
            if (Array.isArray(fetchedRoles) && fetchedRoles.length > 0) {
              rolesToUse = fetchedRoles;
              rolesLoadedRef.current = true;
              setAllRoles(fetchedRoles);
              localStorage.setItem('tie_roles', JSON.stringify(fetchedRoles));
            }
          } catch {}
        }

        // Normalize user.roles to array of fully-resolved role objects
        let normalizedRoles = [];
        if (Array.isArray(userData.roles) && userData.roles.length > 0) {
          for (const roleRef of userData.roles) {
            if (typeof roleRef === 'object' && roleRef !== null && roleRef.permissions) {
              normalizedRoles.push(roleRef);
            } else {
              const roleId = typeof roleRef === 'string' ? roleRef : (roleRef._id || roleRef.name);
              let found = roleId && rolesToUse.length > 0
                ? rolesToUse.find((r) => r._id === roleId || String(r._id) === String(roleId) || r.name === roleId || r.displayName?.toLowerCase() === String(roleId).toLowerCase())
                : null;
              if (found) {
                normalizedRoles.push(found);
              } else if (typeof roleRef === 'object' && roleRef !== null) {
                normalizedRoles.push(roleRef);
                if (roleId && typeof roleId === 'string' && roleId.length === 24) {
                  try {
                    const singleRoleRes = await masterApi.getRoleById(roleId);
                    const roleData = singleRoleRes?.data || singleRoleRes?.role || singleRoleRes;
                    if (roleData && roleData.permissions) normalizedRoles[normalizedRoles.length - 1] = roleData;
                  } catch {}
                }
              }
            }
          }
        }

        if (normalizedRoles.length === 0) {
          const singleRole = userData.role;
          if (singleRole) {
            if (typeof singleRole === 'object' && singleRole !== null && singleRole.permissions) {
              normalizedRoles.push(singleRole);
            } else {
              const roleId = typeof singleRole === 'string' ? singleRole : singleRole._id;
              let found = roleId && rolesToUse.length > 0
                ? rolesToUse.find((r) => r._id === roleId || String(r._id) === String(roleId) || r.name === roleId || r.displayName?.toLowerCase() === String(roleId).toLowerCase())
                : null;
              if (found) {
                normalizedRoles.push(found);
              } else if (typeof singleRole === 'object' && singleRole !== null) {
                normalizedRoles.push(singleRole);
              }
              if (!found && roleId && typeof roleId === 'string' && roleId.length === 24) {
                try {
                  const singleRoleRes = await masterApi.getRoleById(roleId);
                  const roleData = singleRoleRes?.data || singleRoleRes?.role || singleRoleRes;
                  if (roleData && roleData.permissions) {
                    if (normalizedRoles.length === 0) normalizedRoles.push(roleData);
                    else normalizedRoles[0] = roleData;
                  }
                } catch {}
              }
            }
          }
        }

        if (normalizedRoles.length > 0) {
          userData.roles = normalizedRoles;
          userData.role = normalizedRoles[0];
          userData.permissions = getMergedPermissions(userData, rolesToUse);
        }

        if (!userData.designation && userData.employee && typeof userData.employee === 'object') {
          userData.designation = userData.employee.employmentInfo?.designation || userData.employee.designation;
        }
        const userRoleIds = getRoleIdentifiers(userData);
        const isOrgAdmin =
          userRoleIds.some((rid) => rid.includes('super_admin') || rid === 'director' || rid.includes('hr_admin') || rid.includes('branch_manager')) ||
          normalizedRoles.some((r) => r.isSuperAdmin);
        if (!userData.designation && (!userData.employee || typeof userData.employee === 'string') && isOrgAdmin) {
          try {
            const empRes = await employeeApi.getEmployees({ search: userData.email, limit: 5 });
            const empList = empRes?.data?.employees || empRes?.data || empRes?.employees || [];
            if (Array.isArray(empList)) {
              const matched = empList.find(
                (e) => (e.basicInfo?.email || e.email)?.toLowerCase() === userData.email?.toLowerCase() ||
                  e._id === userData.employee || e.user === userData._id
              );
              if (matched) { userData.employee = matched; userData.designation = matched.employmentInfo?.designation || matched.designation; }
            }
          } catch {}
        }

        const empId = typeof userData.employee === 'string' ? userData.employee : userData.employee?._id;
        const empCode = userData.employee?.basicInfo?.employeeCode || userData.employeeCode;
        const photo = userData.employee?.basicInfo?.photo || userData.employee?.photo || userData.photo;
        if (photo) {
          saveRegisteredSelfie(empId, empCode, photo);
        } else if (empId) {
          employeeApi.getEmployeeById(empId).then((eRes) => {
            const eData = eRes?.data || eRes?.employee || eRes;
            const p = eData?.basicInfo?.photo || eData?.photo;
            if (p) saveRegisteredSelfie(empId, empCode || eData?.basicInfo?.employeeCode, p);
          }).catch(() => {});
        }

        setUser(userData);
        localStorage.setItem('tie_user', JSON.stringify(userData));
        return userData;
      }
    } catch (err) {
      const status = err.response?.status;
      if (status === 401) {
        console.warn('Session expired (401). Clearing auth state.');
        localStorage.removeItem('tie_access_token');
        localStorage.removeItem('tie_refresh_token');
        localStorage.removeItem('tie_user');
        setUser(null);
      } else {
        console.warn('Profile fetch failed (non-401), using cached session:', err.message || err);
        const savedUser = localStorage.getItem('tie_user');
        if (savedUser) {
          try { const cached = JSON.parse(savedUser); setUser(cached); return cached; }
          catch (e) { console.error('Failed to parse cached user:', e); }
        }
      }
    }
    return null;
  }, []);

  useEffect(() => {
    const initializeAuth = async () => {
      const token = localStorage.getItem('tie_access_token');
      const savedUser = localStorage.getItem('tie_user');
      if (token) {
        if (savedUser) { try { setUser(JSON.parse(savedUser)); } catch (e) { console.error('Failed to parse cached user:', e); } }
        await fetchUserProfile();
      }
      setLoading(false);
    };
    initializeAuth();
  }, []);

  const login = async (email, password) => {
    const response = await authApi.login({ email, password });
    const accessToken = response?.data?.accessToken || response?.accessToken;
    const refreshToken = response?.data?.refreshToken || response?.refreshToken;
    let loggedUser = response?.data?.user || response?.user;
    if (accessToken) localStorage.setItem('tie_access_token', accessToken);
    if (refreshToken) localStorage.setItem('tie_refresh_token', refreshToken);
    if (loggedUser) { setUser(loggedUser); localStorage.setItem('tie_user', JSON.stringify(loggedUser)); }
    if (accessToken) {
      try { const freshProfile = await fetchUserProfile(); if (freshProfile) loggedUser = freshProfile; }
      catch {}
    }
    return response;
  };

  const refreshSession = async () => {
    const refreshToken = localStorage.getItem('tie_refresh_token');
    if (!refreshToken) throw new Error('No refresh token available');
    const res = await authApi.refreshToken(refreshToken);
    const newAccessToken = res?.data?.accessToken || res?.accessToken;
    if (newAccessToken) localStorage.setItem('tie_access_token', newAccessToken);
    return newAccessToken;
  };

  const logout = useCallback(async () => {
    const refreshToken = localStorage.getItem('tie_refresh_token');
    try { if (refreshToken) await authApi.logout(refreshToken); }
    catch (e) { console.warn('Logout API error:', e); }
    finally {
      localStorage.removeItem('tie_access_token');
      localStorage.removeItem('tie_refresh_token');
      localStorage.removeItem('tie_user');
      setUser(null);
      window.location.href = '/login';
    }
  }, []);

  const updateProfile = async (data) => {
    const userId = user?._id || user?.id;
    const res = await userApi.updateProfile(data, userId);
    await fetchUserProfile();
    return res;
  };

  const changePassword = async (passwords) => {
    const userId = user?._id || user?.id;
    return await userApi.changePassword(passwords, userId);
  };

  // ─── Computed RBAC Flags (checked across ALL roles) ───────────────────────

  const roleId = getRoleIdentifier(user);
  const roleIds = getRoleIdentifiers(user);
  const desigId = getDesignationIdentifier(user);

  const isSuperAdmin =
    (Array.isArray(user?.roles) ? user.roles : []).some((r) => r?.isSuperAdmin === true) ||
    user?.role?.isSuperAdmin === true ||
    user?.isSuperAdmin === true ||
    roleIds.some((rid) => rid.includes('super_admin') || rid.includes('super admin'));

  const isDirector = roleIds.some((rid) => rid === 'director' || rid.includes('director')) || desigId.includes('director');

  const isHrAdmin =
    roleIds.some((rid) => rid === 'hr_admin' || rid.includes('hr_admin') || rid.includes('hr admin') || rid.includes('human resource')) ||
    desigId.includes('hr') || desigId.includes('human resource');

  const isBranchManager =
    roleIds.some((rid) => rid === 'branch_manager' || rid.includes('branch_manager') || rid.includes('branch manager')) ||
    desigId.includes('branch manager');

  const isProjectExecutive =
    roleIds.some((rid) => rid === 'project_executive' || rid.includes('project_executive') || rid.includes('project executive')) ||
    desigId.includes('project executive');

  const isAccountant =
    roleIds.some((rid) => rid === 'accountant' || rid === 'finance_head' || rid.includes('account') || rid.includes('finance')) ||
    desigId.includes('account') || desigId.includes('finance');

  const isEmployee = !isSuperAdmin && !isDirector && !isHrAdmin && !isBranchManager && !isProjectExecutive && !isAccountant;

  const isFieldStaff =
    String(user?.employee?.employmentInfo?.workType || user?.employee?.workType || user?.workType || '').toUpperCase().includes('FIELD') ||
    String(user?.employee?.employmentInfo?.workType || user?.employee?.workType || user?.workType || '').toUpperCase().includes('SITE') ||
    roleIds.some((rid) => rid.includes('field') || rid.includes('site'));

  const hasRole = useCallback(
    (roles) => {
      if (isSuperAdmin) return true;
      if (!user) return false;
      const list = Array.isArray(roles) ? roles : [roles];
      const currentDesig = getDesignationIdentifier(user);
      return list.some((r) => {
        const target = r.toLowerCase();
        return roleIds.some((rid) => rid === target || rid.includes(target)) ||
          currentDesig === target || currentDesig.includes(target);
      });
    },
    [isSuperAdmin, user, roleIds]
  );

  // ─── Permission Evaluation Helpers ────────────────────────────────────────

  const isActionGranted = (permEntry, action = 'view') => {
    if (permEntry === true) return true;
    if (permEntry === false) return false;
    if (!permEntry || typeof permEntry !== 'object') return false;
    if (permEntry[action] === true) return true;
    if (permEntry[action] === false && action !== 'view') return false;
    if (permEntry['*'] === true || permEntry.all === true) return true;
    if (action === 'view') {
      if (permEntry.view === false) return false;
      if (permEntry.view === true) return true;
      return Object.values(permEntry).some(Boolean);
    }
    return false;
  };

  const MODULE_PERMISSIONS_MAP = {
    employees: { subKeys: ['hrms.employeeMaster', 'hrms.employees', 'employeeMaster', 'employees', 'hrmEmployees'], parentKey: 'hrms' },
    attendance: { subKeys: ['hrms.attendance', 'project.attendance', 'attendance', 'attendanceManagement'], parentKey: 'hrms' },
    leaves: { subKeys: ['hrms.leaveManagement', 'hrms.leaves', 'leaveManagement', 'leaves'], parentKey: 'hrms' },
    payroll: { subKeys: ['hrms.payrollManagement', 'hrms.payroll', 'payrollManagement', 'payroll', 'accountingFinance.pakkaAccounting', 'accountingFinance.kachhaAccounting'], parentKey: 'hrms' },
    recruitment: { subKeys: ['crm.leadManagement', 'crm.leads', 'crm.quotations', 'recruitment', 'recruitmentMaster'], parentKey: 'crm' },
    'assets-claims': { subKeys: ['hrms.assetCustody', 'hrms.assets', 'assetCustody', 'assets-claims', 'assetsClaims', 'accountingFinance.expenseManagement', 'accountingFinance.profitLossAssets'], parentKey: 'hrms' },
    assets: { subKeys: ['hrms.assetCustody', 'hrms.assets', 'assetCustody', 'assets', 'accountingFinance.profitLossAssets'], parentKey: 'hrms' },
    claims: { subKeys: ['hrms.assetCustody', 'hrms.assets', 'accountingFinance.expenseManagement', 'claims', 'assetsClaims'], parentKey: 'hrms' },
    performance: { subKeys: ['hrms.kraManagement', 'hrms.kra', 'kraManagement', 'performance'], parentKey: 'hrms' },
    lifecycle: { subKeys: ['hrms.employeeMaster', 'hrms.employees', 'lifecycle', 'employees'], parentKey: 'hrms' },
    reports: { subKeys: ['hrms.hrmsReports', 'hrmsReports', 'administration.reportCenter', 'reportCenter', 'reports'], parentKey: 'hrms' },
    projects: { subKeys: ['projectManagement.projectCreation', 'projectCreation', 'projects', 'projectManagement.projectSite', 'project.tasks', 'project.drawings'], parentKey: 'projectManagement' },
    'site-logs': { subKeys: ['projectManagement.issueManagement', 'issueManagement', 'siteLogs', 'site-logs', 'projectManagement.siteLog', 'installationQC.installationWorkflow', 'installation-qc.checklists'], parentKey: 'projectManagement' },
    tasks: { subKeys: ['projectManagement.taskManagement', 'taskManagement', 'tasks', 'projectManagement.taskMilestone'], parentKey: 'projectManagement' },
    companies: { subKeys: ['administration.multiBranchCompany', 'multiBranchCompany', 'companies', 'admin.settings'], parentKey: 'administration' },
    branches: { subKeys: ['administration.multiBranchCompany', 'multiBranchCompany', 'branches', 'admin.settings'], parentKey: 'administration' },
    departments: { subKeys: ['administration.systemSettings', 'systemSettings', 'departments', 'admin.settings'], parentKey: 'administration' },
    designations: { subKeys: ['administration.systemSettings', 'systemSettings', 'designations', 'admin.settings'], parentKey: 'administration' },
    roles: { subKeys: ['administration.rolePermissionManagement', 'rolePermissionManagement', 'roles', 'admin.roles'], parentKey: 'administration' },
    users: { subKeys: ['administration.rolePermissionManagement', 'rolePermissionManagement', 'users', 'admin.users'], parentKey: 'administration' },
    masters: { subKeys: ['administration.multiBranchCompany', 'administration.systemSettings', 'administration.rolePermissionManagement', 'admin.roles', 'admin.users', 'admin.settings', 'masters'], parentKey: 'administration' },
    hrm: { isGroup: true, groupChildren: ['recruitment', 'employees', 'attendance', 'leaves', 'payroll', 'assets-claims', 'performance', 'reports'] },
    operations: { isGroup: true, groupChildren: ['projects', 'site-logs', 'tasks'] },
  };

  const hasPermission = useCallback(
    (permissionKey) => {
      if (isSuperAdmin) return true;
      if (!user) return false;
      let perms = getMergedPermissions(user, allRoles);
      if (!perms || Object.keys(perms).length === 0) return false;
      if (Array.isArray(perms)) {
        if (perms.includes('*') || perms.includes('all')) return true;
        return perms.some((p) => {
          if (typeof p === 'string') {
            if (p === permissionKey || p === '*' || p === 'all') return true;
            if (p.endsWith('.*') && permissionKey.startsWith(p.replace('.*', ''))) return true;
            return false;
          }
          if (typeof p === 'object' && p !== null) {
            const key = p.key || p.name || p.slug;
            return key === permissionKey || key === '*' || key === 'all';
          }
          return false;
        });
      }
      if (typeof perms === 'object') {
        if (perms['*'] === true || perms.all === true) return true;
        if (perms[permissionKey] === true) return true;
        if (perms[permissionKey] === false) return false;
        if (typeof perms[permissionKey] === 'object' && perms[permissionKey] !== null) {
          return Object.values(perms[permissionKey]).some(Boolean);
        }
        const parts = permissionKey.split('.');
        if (parts.length === 2) {
          const [mod, act] = parts;
          const config = MODULE_PERMISSIONS_MAP[mod];
          const candidateKeys = [...(config?.subKeys || []), mod];
          for (const ck of candidateKeys) {
            if (perms[ck] !== undefined && isActionGranted(perms[ck], act)) return true;
          }
        } else if (parts.length === 3) {
          const [group, mod, act] = parts;
          const dotKey = `${group}.${mod}`;
          if (perms[dotKey] !== undefined && isActionGranted(perms[dotKey], act)) return true;
        }
      }
      return false;
    },
    [isSuperAdmin, user, allRoles]
  );

  const canAccessModule = useCallback(
    (moduleKey) => {
      if (isSuperAdmin) return true;
      if (!user) return false;
      if (moduleKey === 'dashboard') return true;

      const config = MODULE_PERMISSIONS_MAP[moduleKey];
      if (config?.isGroup && Array.isArray(config.groupChildren)) {
        return config.groupChildren.some((child) => canAccessModule(child));
      }

      const bMenu = getMergedMenu(user);
      const perms = getMergedPermissions(user, allRoles);
      const hasBackendMenuConfig = Array.isArray(bMenu) && bMenu.length > 0;
      const hasConfiguredPerms = perms && typeof perms === 'object' && !Array.isArray(perms) && Object.keys(perms).length > 0;

      // 1. Check custom backend menu configuration if explicitly assigned to role
      if (hasBackendMenuConfig && checkBackendMenuAccess(bMenu, moduleKey)) return true;

      // 2. Check Granular RBAC Permissions saved in Role
      if (hasConfiguredPerms) {
        if (perms['*'] === true || perms.all === true) return true;

        // Check specific subkeys
        if (config?.subKeys) {
          for (const sk of config.subKeys) {
            if (perms[sk] !== undefined && isActionGranted(perms[sk], 'view')) return true;
          }
        }

        // Check exact module key
        if (perms[moduleKey] !== undefined && isActionGranted(perms[moduleKey], 'view')) return true;

        // Check parent module key only if it is boolean true or has non-empty view access
        if (config?.parentKey && perms[config.parentKey] === true) return true;

        const mLower = moduleKey.toLowerCase();
        for (const [pk, pval] of Object.entries(perms)) {
          const pkLower = pk.toLowerCase();
          if (pkLower === mLower || pkLower.endsWith(`.${mLower}`)) {
            if (isActionGranted(pval, 'view')) return true;
          }
        }

        // If user has configured role permissions, strictly abide by them (do not leak unauthorized menus)
        return false;
      }

      // 3. Fallback for unconfigured/legacy roles without explicit permissions matrix
      if (isDirector) return true;
      if (isHrAdmin) return ['hrm', 'employees', 'attendance', 'leaves', 'payroll', 'recruitment', 'performance', 'reports', 'assets-claims'].includes(moduleKey);
      if (isBranchManager) return ['hrm', 'attendance', 'leaves', 'operations', 'projects', 'tasks', 'employees'].includes(moduleKey);
      if (isProjectExecutive) return ['operations', 'projects', 'site-logs', 'tasks', 'attendance', 'leaves'].includes(moduleKey);
      if (isAccountant) return ['payroll', 'assets-claims', 'assets', 'claims', 'reports', 'attendance', 'leaves', 'hrm'].includes(moduleKey);
      if (isEmployee) {
        if (isFieldStaff) {
          return ['attendance', 'leaves', 'operations', 'site-logs', 'tasks'].includes(moduleKey);
        }
        return ['attendance', 'leaves'].includes(moduleKey);
      }
      return false;
    },
    [isSuperAdmin, user, allRoles, isDirector, isHrAdmin, isBranchManager, isProjectExecutive, isAccountant, isEmployee, isFieldStaff]
  );

  // ─── Derived State ─────────────────────────────────────────────────────────

  const userRole = useMemo(() => {
    if (isSuperAdmin) return 'Super Admin';
    const desig = user?.designation || user?.employee?.employmentInfo?.designation;
    const desigName = typeof desig === 'string' ? desig : desig?.name || desig?.title;
    if (desigName) return desigName;
    if (Array.isArray(user?.roles) && user.roles.length > 1) {
      const names = user.roles.map((r) => (typeof r === 'object' ? r.displayName || r.name : r)).filter(Boolean);
      return names.join(', ');
    }
    return user?.role?.displayName || user?.role?.name || (isAccountant ? 'Accountant' : (isFieldStaff ? 'Field Staff' : 'Employee'));
  }, [isSuperAdmin, user, isAccountant, isFieldStaff]);

  const backendMenu = useMemo(() => getMergedMenu(user), [user]);
  const dashboardWidgets = useMemo(() => getMergedWidgets(user), [user]);

  const hasWidget = useCallback(
    (widgetId) => {
      if (isSuperAdmin) return true;
      if (!dashboardWidgets || dashboardWidgets.length === 0) return true;
      return dashboardWidgets.includes(widgetId);
    },
    [isSuperAdmin, dashboardWidgets]
  );

  const hasBackendMenu = useCallback(
    (keyOrRoute) => {
      if (isSuperAdmin) return true;
      return checkBackendMenuAccess(backendMenu, keyOrRoute);
    },
    [isSuperAdmin, backendMenu]
  );

  const value = useMemo(
    () => ({
      user, loading, isAuthenticated: !!user, roleId, userRole,
      company: user?.company, branch: user?.branch || user?.branchId,
      isSuperAdmin, isDirector, isHrAdmin, isBranchManager, isProjectExecutive, isAccountant, isEmployee, isFieldStaff,
      allRoles, backendMenu, dashboardWidgets,
      hasRole, hasPermission, canAccessModule, hasBackendMenu, hasWidget,
      login, logout, refreshSession, fetchUserProfile, refreshRoles, updateProfile, changePassword,
    }),
    [user, loading, roleId, userRole, isSuperAdmin, isDirector, isHrAdmin, isBranchManager, isProjectExecutive,
     isAccountant, isEmployee, isFieldStaff, allRoles, backendMenu, dashboardWidgets, hasRole, hasPermission, canAccessModule,
     hasBackendMenu, hasWidget, login, logout, refreshSession, fetchUserProfile, refreshRoles, updateProfile, changePassword]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  return context || defaultAuthValue;
};

export default AuthContext;
