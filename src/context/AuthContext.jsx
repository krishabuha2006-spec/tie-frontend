import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import authApi from '../api/authApi';
import userApi from '../api/userApi';
import masterApi from '../api/masterApi';
import employeeApi from '../api/employeeApi';
import { ensureValidToken, clearAuthSession } from '../api/client';
import { saveRegisteredSelfie } from '../utils/faceComparison';
import { extractApiData } from '../utils/apiUtils';

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
  accessibleCompanies: [],
  accessibleBranches: [],
  allBranches: [],
  backendMenu: [],
  dashboardWidgets: [],
  hasRole: () => false,
  hasPermission: () => false,
  canAccessModule: () => false,
  hasBackendMenu: () => false,
  hasWidget: () => false,
  login: async () => {},
  selectCompany: async () => {},
  selectBranch: () => {},
  refreshCompanies: async () => [],
  refreshBranches: async () => [],
  logout: async () => {},
  refreshSession: async () => {},
  fetchUserProfile: async () => null,
  refreshRoles: async () => [],
  updateProfile: async () => {},
  changePassword: async () => {},
};

const MODULE_TO_MENU_KEYS = {
  dashboard: ['dashboard'],
  employees: ['hrms', 'hrm', 'hrms.employees', 'hrm.employees', '/hrms/employees', '/employees'],
  attendance: ['hrms', 'hrm', 'hrms.attendance', 'hrm.attendance', 'project.attendance', '/hrms/attendance', '/attendance'],
  calendar: ['hrms', 'hrm', 'hrms.attendance', 'hrm.calendar', 'attendance', 'calendar', '/calendar', '/attendance/calendar'],
  leaves: ['hrms', 'hrm', 'hrms.leaves', 'hrm.leaves', 'leaves', '/hrms/leaves', '/leaves'],
  holidays: ['hrms', 'hrm', 'hrms.leaves', 'hrm.holidays', 'leaves', 'holidays', '/hrms/leaves', '/leaves', '/holidays'],
  payroll: ['hrms', 'hrm', 'hrms.payroll', 'hrm.payroll', 'accounting', 'payroll', '/hrms/payroll', '/accounting', '/payroll'],
  recruitment: ['hrms', 'hrm', 'hrm.recruitment', 'crm', 'crm.leads', '/recruitment', '/recruitment/jobs'],
  'assets-claims': ['hrms', 'hrm', 'hrm.assets-claims', 'hrms.assets', 'accounting', 'inventory', '/assets-claims', '/accounting'],
  assets: ['hrms', 'hrm', 'hrm.assets', 'hrms.assets', 'accounting', 'inventory', '/assets-claims'],
  claims: ['hrms', 'hrm', 'hrm.claims', 'hrms.assets', 'accounting', '/assets-claims'],
  performance: ['hrms', 'hrm', 'hrm.performance', 'hrms.kra', '/performance'],
  lifecycle: ['hrms', 'hrm', 'hrms.employees', '/lifecycle', '/employees'],
  reports: ['reports', 'hrm', 'hrm.reports', 'hrms', '/reports'],
  projects: ['project', 'operations', 'operations.projects', 'installation-qc', 'noc-amc', '/project', '/operations/projects'],
  'site-logs': ['project', 'operations', 'operations.site-logs', 'installation-qc', '/operations/site-logs'],
  tasks: ['project', 'operations', 'operations.tasks', 'project.tasks', '/project/tasks', '/operations/tasks'],
  companies: ['admin', 'masters', 'masters.companies', 'admin.settings', '/admin', '/masters/companies'],
  branches: ['admin', 'masters', 'masters.branches', 'admin.settings', '/admin', '/masters/branches'],
  departments: ['admin', 'masters', 'masters.departments', 'admin.settings', '/admin', '/masters/departments'],
  designations: ['admin', 'masters', 'masters.designations', 'admin.settings', '/admin', '/masters/designations'],
  roles: ['admin', 'masters', 'masters.roles', 'admin.roles', '/admin/roles', '/masters/roles'],
  users: ['admin', 'masters', 'masters.users', 'admin.users', '/admin/users', '/masters/users'],
  masters: ['admin', 'masters', 'admin.settings', 'admin.roles', 'admin.users', '/admin'],
  hrm: ['hrm', 'hrms'],
  operations: ['operations', 'project'],
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
  const [accessibleCompanies, setAccessibleCompanies] = useState(() => {
    try {
      const saved = localStorage.getItem('tie_accessible_companies');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [allBranches, setAllBranches] = useState(() => {
    try {
      const saved = localStorage.getItem('tie_all_branches');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [activeBranchState, setActiveBranchState] = useState(() => {
    try {
      const saved = localStorage.getItem('tie_active_branch');
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });

  // ─── Multi-Role Helpers ────────────────────────────────────────────────────

  const getRoleIdentifiers = (u) => {
    if (!u) return [];
    const list = [];
    const addRole = (r) => {
      if (!r) return;
      if (typeof r === 'string') {
        list.push(r.toLowerCase());
      } else if (typeof r === 'object') {
        if (r.name) list.push(String(r.name).toLowerCase());
        if (r.displayName) list.push(String(r.displayName).toLowerCase());
        if (r.slug) list.push(String(r.slug).toLowerCase());
        if (r._id) list.push(String(r._id).toLowerCase());
      }
    };
    if (Array.isArray(u.roles) && u.roles.length > 0) {
      u.roles.forEach(addRole);
    }
    if (u.role) {
      addRole(u.role);
    }
    return [...new Set(list)];
  };

  const getRoleIdentifier = (u) => getRoleIdentifiers(u)[0] || '';

  const getMergedPermissions = (u, rolesList = []) => {
    const merged = {};
    const roles = Array.isArray(u?.roles) && u.roles.length > 0 ? u.roles : (u?.role ? [u.role] : []);
    for (const roleRef of roles) {
      let roleObj = typeof roleRef === 'object' && roleRef !== null ? roleRef : null;
      const refId = roleObj?._id || (typeof roleRef === 'string' ? roleRef : null);
      const refName = roleObj?.name;

      // Always prioritize latest permissions from rolesList (which gets reloaded whenever Super Admin saves)
      if (rolesList.length > 0 && (refId || refName)) {
        const fresh = rolesList.find((r) => (refId && (r._id === refId || String(r._id) === String(refId))) || (refName && r.name === refName));
        if (fresh && fresh.permissions) {
          roleObj = fresh;
        }
      }

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

  // ─── Computed RBAC Flags (available early for context scoping) ────────────
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

  const rolesLoadedRef = useRef(false);

  const refreshRoles = useCallback(async () => {
    try {
      const savedUser = localStorage.getItem('tie_user');
      let isAdmin = false;
      if (savedUser) {
        try {
          const u = JSON.parse(savedUser);
          const roleStr = String(u?.role?.name || u?.role || '').toLowerCase();
          isAdmin = Boolean(u?.isSuperAdmin || /(super_admin|director|hr_admin)/i.test(roleStr));
        } catch {}
      }
      if (!isAdmin) {
        const cached = localStorage.getItem('tie_roles');
        if (cached) {
          try {
            const list = JSON.parse(cached);
            if (Array.isArray(list) && list.length > 0) return list;
          } catch {}
        }
        return [];
      }
      const res = await masterApi.getRoles();
      const list = extractApiData(res, 'roles', 'data');
      if (Array.isArray(list) && list.length > 0) {
        rolesLoadedRef.current = true;
        setAllRoles(list);
        try { localStorage.setItem('tie_roles', JSON.stringify(list)); } catch {}
        return list;
      }
    } catch (err) {
      console.warn('Roles fetch error (using cache if available):', err?.message || err);
    }
    return [];
  }, []);

  const refreshCompanies = useCallback(async () => {
    try {
      const savedUser = localStorage.getItem('tie_user');
      let isAdmin = false;
      if (savedUser) {
        try {
          const u = JSON.parse(savedUser);
          const roleStr = String(u?.role?.name || u?.role || '').toLowerCase();
          isAdmin = Boolean(u?.isSuperAdmin || /(super_admin|director|hr_admin)/i.test(roleStr));
        } catch {}
      }
      if (!isAdmin) {
        const cached = localStorage.getItem('tie_accessible_companies');
        if (cached) {
          try {
            const list = JSON.parse(cached);
            if (Array.isArray(list) && list.length > 0) return list;
          } catch {}
        }
        return [];
      }
      const res = await masterApi.getCompanies();
      const list = extractApiData(res, 'companies', 'data') || (Array.isArray(res) ? res : []);
      if (Array.isArray(list) && list.length > 0) {
        setAccessibleCompanies((prev) => {
          const seen = new Set(list.map((c) => String(c._id || c.id)));
          const combined = [...list];
          for (const p of prev) {
            const pid = String(p._id || p.id);
            if (!seen.has(pid)) {
              seen.add(pid);
              combined.push(p);
            }
          }
          localStorage.setItem('tie_accessible_companies', JSON.stringify(combined));
          return combined;
        });
        return list;
      }
    } catch (err) {
      console.warn('Companies refresh note:', err?.message || err);
    }
    return [];
  }, []);

  const refreshBranches = useCallback(async (companyId = null) => {
    try {
      const savedUser = localStorage.getItem('tie_user');
      let isAdmin = false;
      if (savedUser) {
        try {
          const u = JSON.parse(savedUser);
          const roleStr = String(u?.role?.name || u?.role || '').toLowerCase();
          isAdmin = Boolean(u?.isSuperAdmin || /(super_admin|director|hr_admin|branch_manager)/i.test(roleStr));
        } catch {}
      }
      if (!isAdmin) {
        const cached = localStorage.getItem('tie_all_branches');
        if (cached) {
          try {
            const list = JSON.parse(cached);
            if (Array.isArray(list) && list.length > 0) return list;
          } catch {}
        }
        return [];
      }
      const params = companyId ? { company: companyId } : undefined;
      const res = await masterApi.getBranches(params);
      const list = extractApiData(res, 'branches', 'data') || (Array.isArray(res) ? res : []);
      if (Array.isArray(list) && list.length > 0) {
        setAllBranches((prev) => {
          const seen = new Set(list.map((b) => String(b._id || b.id)));
          const merged = [...list];
          for (const b of prev) {
            const bid = String(b._id || b.id);
            if (!seen.has(bid)) {
              seen.add(bid);
              merged.push(b);
            }
          }
          localStorage.setItem('tie_all_branches', JSON.stringify(merged));
          return merged;
        });
        return list;
      }
    } catch (err) {
      console.warn('Branches refresh note:', err?.message || err);
    }
    return [];
  }, []);

  const fetchUserProfile = useCallback(async () => {
    const token = localStorage.getItem('tie_access_token');
    if (!token) return null;
    try {
      await ensureValidToken();
      const res = await authApi.getProfile();
      let userData = res?.data?.user || res?.data?.data?.user || res?.user || res?.data || res;
      if (userData?.user && typeof userData.user === 'object') {
        userData = userData.user;
      }
      if (userData && (userData._id || userData.id || userData.email)) {
        let rolesToUse = [];
        try {
          const cached = localStorage.getItem('tie_roles');
          if (cached) rolesToUse = JSON.parse(cached);
        } catch {}

        const userRoleStr = String(userData?.role?.name || userData?.role || '').toLowerCase();
        const isAdminUser = Boolean(userData?.isSuperAdmin || /(super_admin|director|hr_admin)/i.test(userRoleStr));

        if (isAdminUser && (!rolesLoadedRef.current || rolesToUse.length === 0)) {
          try {
            const rolesRes = await masterApi.getRoles();
            const fetchedRoles = extractApiData(rolesRes, 'roles', 'data');
            if (Array.isArray(fetchedRoles) && fetchedRoles.length > 0) {
              rolesToUse = fetchedRoles;
              rolesLoadedRef.current = true;
              setAllRoles(fetchedRoles);
              try { localStorage.setItem('tie_roles', JSON.stringify(fetchedRoles)); } catch {}
            }
          } catch {}
        } else if (!isAdminUser && userData.role && typeof userData.role === 'object') {
          rolesToUse = [userData.role];
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
        if (userData.employee && typeof userData.employee === 'string' && /^[0-9a-fA-F]{24}$/.test(userData.employee)) {
          try {
            const eRes = await employeeApi.getEmployeeById(userData.employee);
            const eData = eRes?.data || eRes?.employee || eRes;
            if (eData && (eData._id || eData.id)) {
              userData.employee = eData;
              if (!userData.designation) {
                userData.designation = eData.employmentInfo?.designation || eData.designation;
              }
            }
          } catch {}
        } else if (!userData.designation && !userData.employee && isOrgAdmin && /(super_admin|hr_admin|director)/i.test(String(userData?.role?.name || ''))) {
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
        } else if (empId && typeof userData.employee !== 'object') {
          employeeApi.getEmployeeById(empId).then((eRes) => {
            const eData = eRes?.data || eRes?.employee || eRes;
            const p = eData?.basicInfo?.photo || eData?.photo;
            if (p) saveRegisteredSelfie(empId, empCode || eData?.basicInfo?.employeeCode, p);
          }).catch(() => {});
        }

        // If an active company was explicitly chosen, preserve that session company
        const savedActiveCompanyId = localStorage.getItem('tie_active_company_id');
        if (savedActiveCompanyId) {
          try {
            const savedCompanies = localStorage.getItem('tie_accessible_companies');
            const compList = savedCompanies ? JSON.parse(savedCompanies) : [];
            const activeCompObj = compList.find((c) => String(c._id || c.id) === String(savedActiveCompanyId));
            if (activeCompObj) {
              userData.company = activeCompObj;
              userData.companyId = savedActiveCompanyId;
            }
          } catch {}
        }

        setUser(userData);
        localStorage.setItem('tie_user', JSON.stringify(userData));
        return userData;
      }
    } catch (err) {
      const status = err.response?.status;
      if (status === 401) {
        const isLoginPage = typeof window !== 'undefined' && window.location.pathname.startsWith('/login');
        if (!isLoginPage) {
          console.warn('Session expired (401). Clearing auth state.');
        }
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
      const activeCompanyId = localStorage.getItem('tie_active_company_id');
      const activeBranchId = localStorage.getItem('tie_active_branch_id');
      if (token) {
        // Validate or refresh token before hydrating session
        const validToken = await ensureValidToken();
        if (!validToken) {
          localStorage.removeItem('tie_access_token');
          localStorage.removeItem('tie_refresh_token');
          localStorage.removeItem('tie_user');
          setUser(null);
          setLoading(false);
          return;
        }

        if (savedUser) {
          try {
            const parsed = JSON.parse(savedUser);
            if (activeCompanyId) {
              const savedComps = localStorage.getItem('tie_accessible_companies');
              const compList = savedComps ? JSON.parse(savedComps) : [];
              const activeComp = compList.find((c) => String(c._id || c.id) === String(activeCompanyId));
              if (activeComp) parsed.company = activeComp;
            }
            if (activeBranchId) {
              if (activeBranchId === 'ALL') {
                const allBr = { _id: 'ALL', id: 'ALL', name: 'All Branches' };
                parsed.branch = allBr;
                setActiveBranchState(allBr);
              } else {
                const savedBranches = localStorage.getItem('tie_all_branches');
                const branchList = savedBranches ? JSON.parse(savedBranches) : [];
                const activeBr = branchList.find((b) => String(b._id || b.id) === String(activeBranchId));
                if (activeBr) {
                  parsed.branch = activeBr;
                  setActiveBranchState(activeBr);
                }
              }
            }
            setUser(parsed);
          } catch (e) {
            console.error('Failed to parse cached user:', e);
          }
        }
        await fetchUserProfile();
        const freshUserStr = localStorage.getItem('tie_user');
        let isAdmin = false;
        if (freshUserStr) {
          try {
            const u = JSON.parse(freshUserStr);
            const roleStr = String(u?.role?.name || u?.role || '').toLowerCase();
            isAdmin = Boolean(u?.isSuperAdmin || /(super_admin|director|hr_admin)/i.test(roleStr));
          } catch {}
        }
        if (isAdmin) {
          refreshCompanies();
          refreshBranches();
        }
      }
      setLoading(false);
    };
    initializeAuth();
  }, [fetchUserProfile, refreshCompanies, refreshBranches]);

  // 1. Session Expiration Listener: Immediately auto-refresh and redirect to login
  useEffect(() => {
    const handleSessionExpired = (e) => {
      setUser(null);
      const msg = e.detail?.message || 'You were logged in from another device.';
      try {
        sessionStorage.setItem('tie_session_expired_notice', msg);
      } catch {}

      // Automatically refresh and navigate to login screen immediately
      if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
        window.location.href = '/login?expired=1';
      }
    };
    window.addEventListener('tie:session-expired', handleSessionExpired);
    return () => window.removeEventListener('tie:session-expired', handleSessionExpired);
  }, []);

  // 2. Proactive Session Heartbeat & Concurrent Login Monitor:
  // Detects if user logged in on another device and auto-refreshes/logs out immediately
  useEffect(() => {
    if (!user) return;

    let isChecking = false;
    const checkActiveSession = async () => {
      if (isChecking) return;
      const token = localStorage.getItem('tie_access_token');
      if (!token) return;

      isChecking = true;
      try {
        // Quick verify session validity against backend
        await authApi.getProfile();
      } catch (err) {
        const status = err.response?.status;
        const msg = String(err.response?.data?.message || err.message || '');
        const code = String(err.response?.data?.code || '');
        if (
          status === 401 ||
          code === 'SESSION_EXPIRED' ||
          msg.toLowerCase().includes('another device') ||
          msg.toLowerCase().includes('session expired') ||
          msg.toLowerCase().includes('invalid session')
        ) {
          clearAuthSession({
            reason: 'SESSION_EXPIRED',
            message: 'You were logged in from another device.',
          });
        }
      } finally {
        isChecking = false;
      }
    };

    // 1. Periodic Heartbeat every 4 seconds for instant logout
    const intervalId = setInterval(checkActiveSession, 4000);

    // 2. Immediate check on Tab Focus or Window Visibility Change
    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible') {
        checkActiveSession();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);
    window.addEventListener('focus', handleVisibilityOrFocus);

    // 3. Cross-Tab Sync (if user logged in on same browser in another tab/window)
    const handleStorageEvent = (e) => {
      if (e.key === 'tie_access_token' || e.key === 'tie_session_id') {
        checkActiveSession();
      }
    };
    window.addEventListener('storage', handleStorageEvent);

    return () => {
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      window.removeEventListener('focus', handleVisibilityOrFocus);
      window.removeEventListener('storage', handleStorageEvent);
    };
  }, [user]);

  useEffect(() => {
    const handlePermissionsUpdated = () => {
      fetchUserProfile().catch(() => {});
      refreshRoles().catch(() => {});
    };
    window.addEventListener('tie:permissions-updated', handlePermissionsUpdated);
    return () => window.removeEventListener('tie:permissions-updated', handlePermissionsUpdated);
  }, [fetchUserProfile, refreshRoles]);

  const login = async (email, password) => {
    const response = await authApi.login({ email, password });
    const accessToken = response?.data?.accessToken || response?.accessToken;
    const refreshToken = response?.data?.refreshToken || response?.refreshToken;
    const sessionId = response?.data?.sessionId || response?.sessionId;
    const companiesList = response?.data?.accessibleCompanies || response?.accessibleCompanies || [];
    let loggedUser = response?.data?.user || response?.user;

    if (accessToken) localStorage.setItem('tie_access_token', accessToken);
    if (refreshToken) localStorage.setItem('tie_refresh_token', refreshToken);
    if (sessionId) localStorage.setItem('tie_session_id', sessionId);
    if (Array.isArray(companiesList) && companiesList.length > 0) {
      setAccessibleCompanies(companiesList);
      localStorage.setItem('tie_accessible_companies', JSON.stringify(companiesList));
    }
    const initialCompanyId = loggedUser?.company?._id || loggedUser?.company || companiesList[0]?._id || companiesList[0]?.id;
    if (initialCompanyId) {
      localStorage.setItem('tie_active_company_id', String(initialCompanyId));
    }
    const initialBranchId = loggedUser?.branch?._id || loggedUser?.branch || loggedUser?.branchId;
    if (initialBranchId) {
      localStorage.setItem('tie_active_branch_id', String(initialBranchId));
    }
    if (loggedUser) { setUser(loggedUser); localStorage.setItem('tie_user', JSON.stringify(loggedUser)); }
    if (accessToken) {
      try { const freshProfile = await fetchUserProfile(); if (freshProfile) loggedUser = freshProfile; }
      catch {}
      const roleStr = String(loggedUser?.role?.name || loggedUser?.role || '').toLowerCase();
      const isAdmin = Boolean(loggedUser?.isSuperAdmin || /(super_admin|director|hr_admin)/i.test(roleStr));
      if (isAdmin) {
        refreshCompanies();
        refreshBranches();
      }
    }
    return response;
  };

  const selectCompany = async (companyId) => {
    const resolvedCompId = typeof companyId === 'object' && companyId !== null ? (companyId._id || companyId.id) : companyId;
    let res = null;
    try {
      res = await authApi.selectCompany(resolvedCompId);
    } catch {}

    const newAccessToken = res?.data?.accessToken || res?.accessToken;
    const newRefreshToken = res?.data?.refreshToken || res?.refreshToken;
    if (newAccessToken) localStorage.setItem('tie_access_token', newAccessToken);
    if (newRefreshToken) localStorage.setItem('tie_refresh_token', newRefreshToken);

    // Save active company id
    localStorage.setItem('tie_active_company_id', String(companyId));

    // Resolve company object from accessibleCompanies or backend
    let targetCompany = accessibleCompanies.find(
      (c) => String(c._id || c.id) === String(companyId)
    );

    if (!targetCompany && res?.data?.activeCompany) {
      targetCompany = res.data.activeCompany;
    }

    if (!targetCompany) {
      try {
        const compRes = await masterApi.getCompanyById(companyId);
        if (compRes) targetCompany = compRes;
      } catch {}
    }

    // Ensure accessibleCompanies contains this company
    if (targetCompany) {
      setAccessibleCompanies((prev) => {
        const exists = prev.some((c) => String(c._id || c.id) === String(companyId));
        if (!exists) {
          const next = [...prev, targetCompany];
          localStorage.setItem('tie_accessible_companies', JSON.stringify(next));
          return next;
        }
        return prev;
      });
    }

    // Dynamically filter/fetch branches for this newly selected company
    let compBranches = allBranches.filter((b) => {
      const bComp = b.company?._id || b.company?.id || (typeof b.company === 'string' ? b.company : '');
      return String(bComp) === String(companyId);
    });

    if (compBranches.length === 0) {
      try {
        const brRes = await masterApi.getBranches({ company: companyId });
        const fetched = extractApiData(brRes, 'branches', 'data');
        if (Array.isArray(fetched) && fetched.length > 0) {
          compBranches = fetched;
          setAllBranches((prev) => {
            const seen = new Set(prev.map((b) => String(b._id || b.id)));
            const merged = [...prev];
            for (const b of fetched) {
              if (!seen.has(String(b._id || b.id))) {
                seen.add(String(b._id || b.id));
                merged.push(b);
              }
            }
            localStorage.setItem('tie_all_branches', JSON.stringify(merged));
            return merged;
          });
        }
      } catch {}
    }

    // Automatically synchronize the active branch to the new company's branch
    const newBranch = compBranches[0] || null;
    setActiveBranchState(newBranch);
    if (newBranch?._id) {
      localStorage.setItem('tie_active_branch_id', String(newBranch._id));
      localStorage.setItem('tie_active_branch', JSON.stringify(newBranch));
    } else {
      localStorage.removeItem('tie_active_branch_id');
      localStorage.removeItem('tie_active_branch');
    }

    // Refetch profile if new JWT was issued
    let updatedUser = null;
    if (newAccessToken) {
      try {
        updatedUser = await fetchUserProfile();
      } catch {}
    }

    // Update user state immediately with active company and active branch
    setUser((prevUser) => {
      if (!prevUser) return prevUser;
      const resolvedCompany = targetCompany || { _id: companyId, name: prevUser.company?.name || 'Active Company' };
      const updated = {
        ...prevUser,
        company: resolvedCompany,
        companyId: companyId,
        branch: newBranch,
        branchId: newBranch?._id || undefined,
      };
      localStorage.setItem('tie_user', JSON.stringify(updated));
      return updated;
    });

    // Notify all active application views of company & branch context update
    window.dispatchEvent(new CustomEvent('tie:context-changed', {
      detail: {
        companyId,
        branchId: newBranch?._id,
        company: targetCompany,
        branch: newBranch,
      }
    }));

    return updatedUser || res || { success: true, message: 'Active company switched' };
  };

  const selectBranch = useCallback((branchId) => {
    // Strict Branch Isolation: Non-Super Admin / Non-Director cannot switch to 'ALL' or other branches
    if (!isSuperAdmin && !isDirector) {
      const uBId = String(user?.branch?._id || user?.branch?.id || (typeof user?.branch === 'string' ? user?.branch : ''));
      if (uBId && String(branchId) !== uBId) {
        return;
      }
    }

    const currentCompId = user?.company?._id || user?.company?.id || (typeof user?.company === 'string' ? user?.company : '') || localStorage.getItem('tie_active_company_id');

    if (!branchId || branchId === 'ALL') {
      if (!isSuperAdmin && !isDirector) return;

      const allBranchObj = { _id: 'ALL', id: 'ALL', name: 'All Branches' };
      setActiveBranchState(allBranchObj);
      localStorage.setItem('tie_active_branch_id', 'ALL');
      localStorage.setItem('tie_active_branch', JSON.stringify(allBranchObj));
      setUser((prev) => {
        if (!prev) return prev;
        const updated = { ...prev, branch: allBranchObj, branchId: 'ALL' };
        localStorage.setItem('tie_user', JSON.stringify(updated));
        return updated;
      });

      window.dispatchEvent(new CustomEvent('tie:context-changed', {
        detail: {
          companyId: currentCompId,
          branchId: 'ALL',
          branch: allBranchObj,
        }
      }));
      return;
    }

    const targetBranch = allBranches.find((b) => String(b._id || b.id) === String(branchId)) || { _id: branchId, name: 'Branch' };

    setActiveBranchState(targetBranch);
    localStorage.setItem('tie_active_branch_id', String(branchId));
    localStorage.setItem('tie_active_branch', JSON.stringify(targetBranch));
    setUser((prev) => {
      if (!prev) return prev;
      const updated = { ...prev, branch: targetBranch, branchId };
      localStorage.setItem('tie_user', JSON.stringify(updated));
      return updated;
    });

    window.dispatchEvent(new CustomEvent('tie:context-changed', {
      detail: {
        companyId: currentCompId,
        branchId,
        branch: targetBranch,
      }
    }));
  }, [allBranches, user?.company, user?.branch, isSuperAdmin, isDirector]);

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
      localStorage.removeItem('tie_session_id');
      localStorage.removeItem('tie_accessible_companies');
      localStorage.removeItem('tie_active_company_id');
      localStorage.removeItem('tie_active_branch_id');
      localStorage.removeItem('tie_active_branch');
      localStorage.removeItem('tie_all_branches');
      setActiveBranchState(null);
      setAllBranches([]);
      setUser(null);
      setAccessibleCompanies([]);
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

  // ─── RBAC Helpers ─────────────────────────────────────────────────────────

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
    if (permEntry === false || !permEntry) return false;
    if (typeof permEntry !== 'object') return false;
    if (permEntry['*'] === true || permEntry.all === true) return true;

    let targetAct = action;
    if (action === 'update' && permEntry.update === undefined && permEntry.edit !== undefined) {
      targetAct = 'edit';
    } else if (action === 'edit' && permEntry.edit === undefined && permEntry.update !== undefined) {
      targetAct = 'update';
    }

    if (permEntry[targetAct] !== undefined) {
      return Boolean(permEntry[targetAct]);
    }

    if (action === 'view') {
      if (permEntry.view !== undefined) return Boolean(permEntry.view);
      return Object.values(permEntry).some(Boolean);
    }
    return false;
  };

  const MODULE_PERMISSIONS_MAP = {
    employees:       { subKeys: ['hrm.employees', 'hrm', 'hrms', 'hrms.employeeMaster', 'hrms.employees', 'employees', 'employeeMaster', 'hrmEmployees'], parentKey: 'hrm' },
    attendance:      { subKeys: ['hrm.attendance', 'hrm', 'hrms', 'hrms.attendance', 'attendance', 'attendanceManagement'], parentKey: 'hrm' },
    calendar:        { subKeys: ['hrm.calendar', 'hrm', 'hrms.calendar', 'calendar', 'hrm.attendance', 'attendance'], parentKey: 'hrm' },
    leaves:          { subKeys: ['hrm.leaves', 'hrm', 'hrms', 'hrms.leaveManagement', 'hrms.leaves', 'leaves', 'leaveManagement'], parentKey: 'hrm' },
    holidays:        { subKeys: ['hrm.holidays', 'hrm', 'hrms.holidays', 'holidays', 'hrm.leaves', 'leaves'], parentKey: 'hrm' },
    payroll:         { subKeys: ['hrm.payroll', 'hrms.payrollManagement', 'hrms.payroll', 'payroll', 'accounting', 'payrollManagement'], parentKey: 'hrm' },
    'assets-claims': { subKeys: ['hrm.assets-claims', 'hrm', 'hrms.assetCustody', 'hrms.assets', 'assets-claims', 'assets', 'claims'], parentKey: 'hrm' },
    performance:     { subKeys: ['hrm.performance', 'hrm', 'hrms.kraManagement', 'hrms.kra', 'performance', 'kraManagement'], parentKey: 'hrm' },
    reports:         { subKeys: ['hrm.reports', 'hrm', 'hrms.hrmsReports', 'reports', 'hrmsReports', 'administration.reportCenter'], parentKey: 'hrm' },
    recruitment:     { subKeys: ['hrm.recruitment', 'crm.leadManagement', 'hrms.recruitment', 'recruitment', 'crm'], parentKey: 'hrm' },
    lifecycle:       { subKeys: ['hrm.employees', 'hrm', 'hrms.employeeMaster', 'hrms.employees', 'employees', 'lifecycle'], parentKey: 'hrm' },
    projects:        { subKeys: ['projectManagement.projects', 'projectManagement', 'operations.projects', 'operations', 'projects', 'project'], parentKey: 'projectManagement' },
    'site-logs':     { subKeys: ['projectManagement.site-logs', 'projectManagement', 'operations.site-logs', 'operations', 'site-logs'], parentKey: 'projectManagement' },
    tasks:           { subKeys: ['projectManagement.tasks', 'projectManagement', 'operations.tasks', 'operations', 'tasks'], parentKey: 'projectManagement' },
    companies:       { subKeys: ['masters.companies', 'masters', 'administration.multiBranchCompany', 'companies', 'admin'], parentKey: 'masters' },
    branches:        { subKeys: ['masters.branches', 'masters', 'administration.multiBranchCompany', 'branches', 'admin'], parentKey: 'masters' },
    departments:     { subKeys: ['masters.departments', 'masters', 'administration.systemSettings', 'departments', 'admin'], parentKey: 'masters' },
    designations:    { subKeys: ['masters.designations', 'masters', 'administration.systemSettings', 'designations', 'admin'], parentKey: 'masters' },
    roles:           { subKeys: ['masters.roles', 'masters', 'administration.rolePermissionManagement', 'roles', 'admin.roles'], parentKey: 'masters' },
    users:           { subKeys: ['masters.users', 'masters.roles', 'masters', 'administration.rolePermissionManagement', 'users', 'admin.users'], parentKey: 'masters' },
    claims:          { subKeys: ['hrm.assets-claims', 'hrms.assetCustody', 'assets-claims', 'claims', 'accounting'], parentKey: 'hrm' },
    assets:          { subKeys: ['hrm.assets-claims', 'hrms.assetCustody', 'hrms.assets', 'assets-claims', 'assets'], parentKey: 'hrm' },
    amc:             { subKeys: ['amc', 'amc.contracts', 'amc.visits', 'amcManagement', 'amcContracts'], parentKey: 'amc' },
    noc:             { subKeys: ['noc', 'noc.applications', 'noc.approvals', 'nocProcessing', 'nocApplication'], parentKey: 'noc' },
    hrm:             { isGroup: true, groupChildren: ['recruitment', 'employees', 'attendance', 'calendar', 'leaves', 'holidays', 'payroll', 'assets-claims', 'performance', 'reports'] },
    projectManagement: { isGroup: true, groupChildren: ['projects', 'site-logs', 'tasks'] },
    operations:      { isGroup: true, groupChildren: ['projects', 'site-logs', 'tasks'] },
    masters:         { isGroup: true, groupChildren: ['companies', 'branches', 'departments', 'designations', 'roles', 'users'] },
    accounting:      { isGroup: true, groupChildren: ['payroll', 'claims'] },
    inventory:       { isGroup: true, groupChildren: ['assets', 'assets-claims'] },
    crm:             { isGroup: true, groupChildren: ['recruitment'] },
  };

  const hasPermission = useCallback(
    (permissionKey, actionParam) => {
      if (isSuperAdmin) return true;
      if (!user) return false;
      let perms = getMergedPermissions(user, allRoles);
      const hasConfiguredPerms = perms && typeof perms === 'object' && !Array.isArray(perms) && Object.keys(perms).length > 0;

      let mod = permissionKey;
      let act = actionParam || 'view';
      if (!actionParam && permissionKey && permissionKey.includes('.')) {
        const parts = permissionKey.split('.');
        if (parts.length === 2) {
          mod = parts[0];
          act = parts[1];
        } else if (parts.length === 3) {
          mod = parts[1];
          act = parts[2];
        }
      }

      if (Array.isArray(perms)) {
        if (perms.includes('*') || perms.includes('all')) return true;
        return perms.some((p) => {
          if (typeof p === 'string') {
            if (p === permissionKey || p === '*' || p === 'all' || p === mod) return true;
            if (p.endsWith('.*') && permissionKey.startsWith(p.replace('.*', ''))) return true;
            return false;
          }
          if (typeof p === 'object' && p !== null) {
            const key = p.key || p.name || p.slug;
            return key === permissionKey || key === '*' || key === 'all' || key === mod;
          }
          return false;
        });
      }

      // 1. If explicit permissions are configured in matrix, check them:
      if (hasConfiguredPerms) {
        if (perms['*'] === true || perms.all === true) return true;

        // 1. Direct flat check: perms['employees']
        if (perms[mod] !== undefined && isActionGranted(perms[mod], act)) return true;

        // 2. Direct exact permission string: perms['employees.create']
        if (perms[permissionKey] !== undefined && isActionGranted(perms[permissionKey], act)) return true;

        // 3. Check group dot-notation keys
        for (const prefix of ['hrm', 'operations', 'masters', 'hrms', 'admin', 'project', 'projectManagement']) {
          const dk = `${prefix}.${mod}`;
          if (perms[dk] !== undefined && isActionGranted(perms[dk], act)) return true;
        }

        // 4. Check aliases from MODULE_PERMISSIONS_MAP
        const config = MODULE_PERMISSIONS_MAP[mod];
        if (config?.subKeys) {
          for (const sk of config.subKeys) {
            if (perms[sk] !== undefined && isActionGranted(perms[sk], act)) return true;
          }
        }
        return false;
      }

      // 2. Fallback for unconfigured roles (matrix ma permission nathi to intelligent role-based fallback)
      if (isDirector) return true;
      if (isHrAdmin) {
        const hrmSubmods = ['recruitment', 'employees', 'attendance', 'calendar', 'leaves', 'holidays', 'payroll', 'assets-claims', 'performance', 'reports'];
        if (hrmSubmods.includes(mod) || mod === 'hrm') return true;
      }
      if (isBranchManager) {
        const bmSubmods = ['employees', 'attendance', 'calendar', 'leaves', 'holidays', 'projects', 'site-logs', 'tasks', 'reports'];
        if (bmSubmods.includes(mod) || ['hrm', 'operations', 'projectManagement'].includes(mod)) return true;
      }
      if (isProjectExecutive) {
        const peSubmods = ['projects', 'site-logs', 'tasks', 'attendance', 'calendar', 'leaves', 'holidays'];
        if (peSubmods.includes(mod) || ['operations', 'projectManagement'].includes(mod)) return true;
      }
      if (isAccountant) {
        const accSubmods = ['payroll', 'assets-claims', 'assets', 'claims', 'reports', 'attendance', 'calendar', 'leaves', 'holidays'];
        if (accSubmods.includes(mod) || ['accounting', 'hrm'].includes(mod)) return true;
      }
      if (isEmployee) {
        if (isFieldStaff) {
          const fsSubmods = ['attendance', 'calendar', 'leaves', 'holidays', 'projects', 'site-logs', 'tasks'];
          if (fsSubmods.includes(mod) || ['operations', 'projectManagement'].includes(mod)) {
            if (['view', 'create', 'download', 'print'].includes(act)) return true;
            if (['tasks', 'site-logs'].includes(mod) && (act === 'edit' || act === 'uploadDocuments')) return true;
            if (act === 'view') return true;
          }
          if (mod === 'payroll' && (act === 'view' || act === 'download' || act === 'print')) return true; // payslips
        } else {
          // Standard Office Employee
          const empSubmods = ['attendance', 'calendar', 'leaves', 'holidays'];
          if (empSubmods.includes(mod)) {
            if (['view', 'create', 'download', 'print'].includes(act)) return true;
            if (act === 'view') return true;
          }
          if (mod === 'payroll' && (act === 'view' || act === 'download' || act === 'print')) return true; // payslips
        }
      }

      return false;
    },
    [isSuperAdmin, user, allRoles, isDirector, isHrAdmin, isBranchManager, isProjectExecutive, isAccountant, isEmployee, isFieldStaff]
  );

  const canAccessModule = useCallback(
    (moduleKey, visited = new Set()) => {
      if (isSuperAdmin) return true;
      if (!user) return false;
      if (moduleKey === 'dashboard') return true;
      if (!moduleKey || visited.has(moduleKey)) return false;

      const nextVisited = new Set(visited);
      nextVisited.add(moduleKey);

      const config = MODULE_PERMISSIONS_MAP[moduleKey];
      if (config?.isGroup && Array.isArray(config.groupChildren)) {
        return config.groupChildren.some((child) => {
          if (child === moduleKey) return false;
          return canAccessModule(child, nextVisited);
        });
      }

      const bMenu = getMergedMenu(user);
      const perms = getMergedPermissions(user, allRoles);
      const hasConfiguredPerms = perms && typeof perms === 'object' && !Array.isArray(perms) && Object.keys(perms).length > 0;
      const hasBackendMenuConfig = Array.isArray(bMenu) && bMenu.length > 0;

      // 1. Check Granular RBAC Permissions saved in Role (Primary Source of Truth configured by Super Admin)
      if (hasConfiguredPerms) {
        if (perms['*'] === true || perms.all === true) return true;

        // Direct flat module key check (e.g. 'payroll', 'attendance')
        if (perms[moduleKey] !== undefined) {
          return isActionGranted(perms[moduleKey], 'view');
        }

        // Check group prefix keys (e.g. 'hrm.payroll', 'projectManagement.projects')
        for (const prefix of ['hrm', 'operations', 'masters', 'hrms', 'admin', 'project', 'projectManagement']) {
          const dk = `${prefix}.${moduleKey}`;
          if (perms[dk] !== undefined) {
            return isActionGranted(perms[dk], 'view');
          }
        }

        // Check subKeys in config map
        if (config?.subKeys) {
          for (const sk of config.subKeys) {
            if (perms[sk] !== undefined) {
              return isActionGranted(perms[sk], 'view');
            }
          }
        }

        const mLower = moduleKey.toLowerCase();
        for (const [pk, pval] of Object.entries(perms)) {
          const pkLower = pk.toLowerCase();
          if (pkLower === mLower || pkLower.endsWith(`.${mLower}`) || pkLower.startsWith(`${mLower}.`)) {
            if (isActionGranted(pval, 'view')) return true;
          }
        }

        // STRICT RBAC: If Super Admin has configured permissions for this role,
        // NEVER leak unauthorized modules! Only what Super Admin gave is visible!
        return false;
      }

      // 2. Custom backend menu configuration if explicitly assigned to role without permissions matrix
      if (hasBackendMenuConfig && checkBackendMenuAccess(bMenu, moduleKey)) return true;

      // 3. Fallback for unconfigured/legacy roles without explicit permissions matrix
      if (isDirector) return true;
      if (isHrAdmin) return ['hrm', 'employees', 'attendance', 'calendar', 'leaves', 'holidays', 'payroll', 'recruitment', 'performance', 'reports', 'assets-claims'].includes(moduleKey);
      if (isBranchManager) return ['hrm', 'attendance', 'calendar', 'leaves', 'holidays', 'operations', 'projects', 'site-logs', 'tasks', 'employees', 'projectManagement', 'reports'].includes(moduleKey);
      if (isProjectExecutive) return ['operations', 'projects', 'site-logs', 'tasks', 'attendance', 'calendar', 'leaves', 'holidays', 'projectManagement'].includes(moduleKey);
      if (isAccountant) return ['payroll', 'assets-claims', 'assets', 'claims', 'reports', 'attendance', 'calendar', 'leaves', 'holidays', 'hrm', 'accounting'].includes(moduleKey);
      if (isEmployee) {
        if (isFieldStaff) {
          return ['attendance', 'calendar', 'leaves', 'holidays', 'operations', 'projects', 'site-logs', 'tasks', 'projectManagement', 'payroll'].includes(moduleKey);
        }
        return ['attendance', 'calendar', 'leaves', 'holidays', 'payroll'].includes(moduleKey);
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

  const activeCompanyId = useMemo(() => {
    const c = user?.company;
    return String(c?._id || c?.id || (typeof c === 'string' ? c : '') || localStorage.getItem('tie_active_company_id') || '');
  }, [user?.company]);

  const accessibleBranches = useMemo(() => {
    // Strict Multi-Branch Isolation:
    // If NOT Super Admin and NOT Director, user is restricted ONLY to their assigned branch.
    if (!isSuperAdmin && !isDirector) {
      const uBranch = user?.branch;
      if (uBranch) {
        const uBranchId = String(uBranch._id || uBranch.id || uBranch);
        const match = allBranches.find((b) => String(b._id || b.id) === uBranchId || b.name === uBranchId);
        if (match) return [match];
        if (typeof uBranch === 'object' && uBranch.name) return [uBranch];
        return [{ _id: uBranchId, id: uBranchId, name: 'Assigned Branch' }];
      }
      return [];
    }

    if (!activeCompanyId) return allBranches;
    const filtered = allBranches.filter((b) => {
      const bComp = b.company?._id || b.company?.id || (typeof b.company === 'string' ? b.company : '');
      return !bComp || String(bComp) === String(activeCompanyId);
    });
    if (filtered.length === 0 && activeBranchState) {
      const stateComp = activeBranchState.company?._id || activeBranchState.company?.id || (typeof activeBranchState.company === 'string' ? activeBranchState.company : '');
      if (!stateComp || String(stateComp) === String(activeCompanyId)) {
        return [activeBranchState];
      }
    }
    return filtered;
  }, [allBranches, activeCompanyId, activeBranchState, isSuperAdmin, isDirector, user?.branch]);

  const branch = useMemo(() => {
    // Non-Super Admin / Non-Director is strictly locked to their assigned branch:
    if (!isSuperAdmin && !isDirector) {
      const uBranch = user?.branch;
      if (uBranch) {
        const uBranchId = String(uBranch._id || uBranch.id || uBranch);
        const match = allBranches.find((b) => String(b._id || b.id) === uBranchId || b.name === uBranchId);
        if (match) return match;
        if (typeof uBranch === 'object' && uBranch.name) return uBranch;
        return { _id: uBranchId, id: uBranchId, name: 'Assigned Branch' };
      }
      return null;
    }

    if (activeBranchState) {
      if (activeBranchState._id === 'ALL' || activeBranchState.id === 'ALL') {
        return activeBranchState;
      }
      const bComp = activeBranchState.company?._id || activeBranchState.company?.id || (typeof activeBranchState.company === 'string' ? activeBranchState.company : '');
      if (!bComp || !activeCompanyId || String(bComp) === String(activeCompanyId)) {
        return activeBranchState;
      }
    }
    const savedActiveBranchId = localStorage.getItem('tie_active_branch_id');
    if (savedActiveBranchId === 'ALL') {
      return { _id: 'ALL', id: 'ALL', name: 'All Branches' };
    }
    if (savedActiveBranchId && allBranches.length > 0) {
      const match = allBranches.find((b) => String(b._id || b.id) === String(savedActiveBranchId));
      if (match) return match;
    }
    if (accessibleBranches.length > 0) {
      return accessibleBranches[0];
    }
    const uBranch = user?.branch;
    if (uBranch && typeof uBranch === 'object') {
      const ubComp = uBranch.company?._id || uBranch.company?.id || (typeof uBranch.company === 'string' ? uBranch.company : '');
      if (!ubComp || !activeCompanyId || String(ubComp) === String(activeCompanyId)) {
        return uBranch;
      }
    }
    return null;
  }, [activeBranchState, accessibleBranches, activeCompanyId, user?.branch, allBranches, isSuperAdmin, isDirector]);

  const company = useMemo(() => {
    if (user?.company && typeof user.company === 'object') return user.company;
    if (activeCompanyId) {
      const found = accessibleCompanies.find((c) => String(c._id || c.id) === String(activeCompanyId));
      if (found) return found;
    }
    return user?.company || null;
  }, [user?.company, activeCompanyId, accessibleCompanies]);

  const value = useMemo(
    () => ({
      user, loading, isAuthenticated: !!user, roleId, userRole,
      company, branch,
      isSuperAdmin, isDirector, isHrAdmin, isBranchManager, isProjectExecutive, isAccountant, isEmployee, isFieldStaff,
      allRoles, accessibleCompanies, accessibleBranches, allBranches, backendMenu, dashboardWidgets,
      hasRole, hasPermission, canAccessModule, hasBackendMenu, hasWidget,
      login, selectCompany, selectBranch, refreshCompanies, refreshBranches, logout, refreshSession, fetchUserProfile, refreshRoles, updateProfile, changePassword,
    }),
    [user, loading, roleId, userRole, company, branch, isSuperAdmin, isDirector, isHrAdmin, isBranchManager, isProjectExecutive,
     isAccountant, isEmployee, isFieldStaff, allRoles, accessibleCompanies, accessibleBranches, allBranches, backendMenu, dashboardWidgets, hasRole, hasPermission, canAccessModule,
     hasBackendMenu, hasWidget, login, selectCompany, selectBranch, refreshCompanies, refreshBranches, logout, refreshSession, fetchUserProfile, refreshRoles, updateProfile, changePassword]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  return context || defaultAuthValue;
};

export default AuthContext;
