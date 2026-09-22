import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import authApi from '../api/authApi';
import userApi from '../api/userApi';
import masterApi from '../api/masterApi';
import employeeApi from '../api/employeeApi';

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
  allRoles: [],
  hasRole: () => false,
  hasPermission: () => false,
  canAccessModule: () => false,
  login: async () => {},
  logout: async () => {},
  refreshSession: async () => {},
  fetchUserProfile: async () => null,
  refreshRoles: async () => [],
  updateProfile: async () => {},
  changePassword: async () => {},
};

const AuthContext = createContext(defaultAuthValue);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [allRoles, setAllRoles] = useState(() => {
    try {
      const saved = localStorage.getItem('tie_roles');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Helper to extract role name string
  const getRoleIdentifier = (u) => {
    if (!u || !u.role) return '';
    if (typeof u.role === 'string') return u.role.toLowerCase();
    const str = u.role.name || u.role.displayName || u.role.slug || (u.role._id ? String(u.role._id) : '');
    return String(str || '').toLowerCase();
  };

  // Helper to extract designation / job title string
  const getDesignationIdentifier = (u) => {
    if (!u) return '';
    const d = u.designation || u.employee?.employmentInfo?.designation || u.employee?.designation;
    if (typeof d === 'string') return d.toLowerCase();
    if (d && typeof d === 'object') return (d.name || d.title || '').toLowerCase();
    if (u.jobTitle) return String(u.jobTitle).toLowerCase();
    if (u.title) return String(u.title).toLowerCase();
    return '';
  };

  // Fetch all system roles from backend masterApi (Super Admin only)
  const refreshRoles = useCallback(async () => {
    const savedUser = localStorage.getItem('tie_user');
    let userIsSA = false;
    if (savedUser) {
      try {
        const parsed = JSON.parse(savedUser);
        const rId = getRoleIdentifier(parsed);
        userIsSA = rId === 'super_admin' || rId.includes('super_admin') || parsed?.isSuperAdmin === true;
      } catch {}
    }
    if (!userIsSA) {
      return allRoles;
    }
    try {
      const res = await masterApi.getRoles();
      const list = res?.data || res?.roles || (Array.isArray(res) ? res : []);
      if (Array.isArray(list) && list.length > 0) {
        setAllRoles(list);
        localStorage.setItem('tie_roles', JSON.stringify(list));
        return list;
      }
    } catch (err) {
      console.warn('Roles fetch error (using cache if available):', err?.message || err);
    }
    return allRoles;
  }, [allRoles]);

  // Step 2: Fetch and verify current logged-in user profile with complete roles & permissions
  const fetchUserProfile = useCallback(async () => {
    const token = localStorage.getItem('tie_access_token');
    if (!token) return null;

    try {
      // 1. Fetch user profile from /auth/me
      const res = await userApi.getProfile();
      let userData = res?.data || res?.user || res;

      if (userData && (userData._id || userData.email)) {
        const userRoleId = getRoleIdentifier(userData);
        const userIsSA =
          userRoleId === 'super_admin' ||
          userRoleId.includes('super_admin') ||
          userData?.role?.isSuperAdmin === true ||
          userData?.isSuperAdmin === true;

        // 2. Collect latest system roles ONLY for Super Admin
        let rolesToUse = allRoles;
        if (userIsSA) {
          try {
            const rolesRes = await masterApi.getRoles();
            const fetchedRoles = rolesRes?.data || rolesRes?.roles || (Array.isArray(rolesRes) ? rolesRes : null);
            if (Array.isArray(fetchedRoles) && fetchedRoles.length > 0) {
              rolesToUse = fetchedRoles;
              setAllRoles(fetchedRoles);
              localStorage.setItem('tie_roles', JSON.stringify(fetchedRoles));
            }
          } catch {}
        }

        // 3. Resolve employee details if designation is not present on userData
        if (!userData.designation && userData.employee && typeof userData.employee === 'object') {
          userData.designation = userData.employee.employmentInfo?.designation || userData.employee.designation;
        }

        const isOrgAdmin = userIsSA || userRoleId === 'hr_admin' || userRoleId === 'director' || userRoleId === 'branch_manager';
        if (!userData.designation && (!userData.employee || typeof userData.employee === 'string') && isOrgAdmin) {
          try {
            const empRes = await employeeApi.getEmployees({ search: userData.email, limit: 5 });
            const empList = empRes?.data?.employees || empRes?.data || empRes?.employees || [];
            if (Array.isArray(empList)) {
              const matched = empList.find(
                (e) =>
                  (e.basicInfo?.email || e.email)?.toLowerCase() === userData.email?.toLowerCase() ||
                  e._id === userData.employee ||
                  e.user === userData._id
              );
              if (matched) {
                userData.employee = matched;
                userData.designation = matched.employmentInfo?.designation || matched.designation;
              }
            }
          } catch {
            // Non-critical fallback
          }
        }

        // 4. Resolve exact RBAC role and its permissions matrix from rolesToUse
        const roleIdStr = typeof userData.role === 'string' ? userData.role : userData.role?._id || userData.role?.name;
        const desigStr = getDesignationIdentifier(userData);
        const isUserAcc =
          (roleIdStr && (String(roleIdStr).toLowerCase().includes('account') || String(roleIdStr).toLowerCase().includes('finance'))) ||
          (desigStr && (desigStr.includes('account') || desigStr.includes('finance')));

        if (Array.isArray(rolesToUse) && rolesToUse.length > 0) {
          let matchedRole = null;
          // If user designation or role indicates Accountant, match to Accountant role from backend
          if (isUserAcc) {
            matchedRole = rolesToUse.find(
              (r) =>
                r.name === 'accountant' ||
                r.name?.includes('account') ||
                r.displayName?.toLowerCase().includes('account')
            );
          }

          // Otherwise match by ID or name
          if (!matchedRole && roleIdStr) {
            matchedRole = rolesToUse.find(
              (r) =>
                r._id === roleIdStr ||
                r.name === roleIdStr ||
                r.displayName?.toLowerCase() === String(roleIdStr).toLowerCase()
            );
          }

          if (matchedRole) {
            const existingPerms = typeof userData.role === 'object' ? userData.role?.permissions : null;
            userData.role = {
              ...matchedRole,
              ...(typeof userData.role === 'object' ? userData.role : {}),
              permissions: matchedRole.permissions || existingPerms || {},
            };
          }
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
          try {
            const cached = JSON.parse(savedUser);
            setUser(cached);
            return cached;
          } catch (e) {
            console.error('Failed to parse cached user:', e);
          }
        }
      }
    }
    return null;
  }, [allRoles]);

  // Initialize from localStorage and verify with /users/profile (or /auth/me)
  useEffect(() => {
    const initializeAuth = async () => {
      const token = localStorage.getItem('tie_access_token');
      const savedUser = localStorage.getItem('tie_user');

      if (token) {
        if (savedUser) {
          try {
            setUser(JSON.parse(savedUser));
          } catch (e) {
            console.error('Failed to parse cached user:', e);
          }
        }
        await fetchUserProfile();
      }
      setLoading(false);
    };

    initializeAuth();
  }, [fetchUserProfile]);

  // Step 1: User Login
  const login = async (email, password) => {
    const response = await authApi.login({ email, password });

    const accessToken = response?.data?.accessToken || response?.accessToken;
    const refreshToken = response?.data?.refreshToken || response?.refreshToken;
    let loggedUser = response?.data?.user || response?.user;

    if (accessToken) {
      localStorage.setItem('tie_access_token', accessToken);
    }
    if (refreshToken) {
      localStorage.setItem('tie_refresh_token', refreshToken);
    }

    if (loggedUser) {
      setUser(loggedUser);
      localStorage.setItem('tie_user', JSON.stringify(loggedUser));
    }

    // Load full profile and role permissions
    if (accessToken) {
      try {
        const freshProfile = await fetchUserProfile();
        if (freshProfile) {
          loggedUser = freshProfile;
        }
      } catch {
        // Fallback to returned login user
      }
    }

    return response;
  };

  // Step 4: Access Token Refresh helper
  const refreshSession = async () => {
    const refreshToken = localStorage.getItem('tie_refresh_token');
    if (!refreshToken) throw new Error('No refresh token available');
    const res = await authApi.refreshToken(refreshToken);
    const newAccessToken = res?.data?.accessToken || res?.accessToken;
    if (newAccessToken) {
      localStorage.setItem('tie_access_token', newAccessToken);
    }
    return newAccessToken;
  };

  // Step 7: User Logout
  const logout = useCallback(async () => {
    const refreshToken = localStorage.getItem('tie_refresh_token');
    try {
      if (refreshToken) {
        await authApi.logout(refreshToken);
      }
    } catch (e) {
      console.warn('Logout API error:', e);
    } finally {
      localStorage.removeItem('tie_access_token');
      localStorage.removeItem('tie_refresh_token');
      localStorage.removeItem('tie_user');
      setUser(null);
      window.location.href = '/login';
    }
  }, []);

  // Self Profile Updates
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

  // RBAC Helpers & Role / Designation Scoping
  const roleId = getRoleIdentifier(user);
  const desigId = getDesignationIdentifier(user);

  const isSuperAdmin =
    roleId === 'super_admin' ||
    roleId.includes('super_admin') ||
    roleId.includes('super admin') ||
    user?.role?.isSuperAdmin === true ||
    user?.isSuperAdmin === true;

  const isDirector = roleId === 'director' || roleId.includes('director') || desigId.includes('director');

  const isHrAdmin =
    roleId === 'hr_admin' ||
    roleId.includes('hr_admin') ||
    roleId.includes('hr admin') ||
    roleId.includes('human resource') ||
    desigId.includes('hr') ||
    desigId.includes('human resource');

  const isBranchManager =
    roleId === 'branch_manager' ||
    roleId.includes('branch_manager') ||
    roleId.includes('branch manager') ||
    desigId.includes('branch manager');

  const isProjectExecutive =
    roleId === 'project_executive' ||
    roleId.includes('project_executive') ||
    roleId.includes('project executive') ||
    desigId.includes('project executive');

  const isAccountant =
    roleId === 'accountant' ||
    roleId === 'finance_head' ||
    roleId.includes('account') ||
    roleId.includes('finance') ||
    desigId.includes('account') ||
    desigId.includes('finance');

  const isEmployee =
    roleId === 'employee' ||
    (!isSuperAdmin && !isDirector && !isHrAdmin && !isBranchManager && !isProjectExecutive && !isAccountant);

  const hasRole = useCallback(
    (roles) => {
      if (isSuperAdmin) return true;
      if (!user) return false;
      const list = Array.isArray(roles) ? roles : [roles];
      const currentRole = getRoleIdentifier(user);
      const currentDesig = getDesignationIdentifier(user);
      return list.some((r) => {
        const target = r.toLowerCase();
        return (
          currentRole === target ||
          currentRole.includes(target) ||
          currentDesig === target ||
          currentDesig.includes(target)
        );
      });
    },
    [isSuperAdmin, user]
  );

  // Deep helper to inspect if an action (e.g. 'view', 'create') or flag is granted in an arbitrary nested structure
  const checkLeafPermission = (node, action = 'view') => {
    if (node === true) return true;
    if (node === false) return false;
    if (!node || typeof node !== 'object') return false;

    if (node[action] === true || node['*'] === true || node.all === true) return true;
    if (node[action] === false) return false;

    for (const val of Object.values(node)) {
      if (val === true && action === 'view') return true;
      if (typeof val === 'object' && val !== null) {
        if (checkLeafPermission(val, action)) return true;
      }
    }
    return false;
  };

  const hasPermission = useCallback(
    (permissionKey) => {
      if (isSuperAdmin) return true;
      if (!user) return false;

      const roleObj = typeof user.role === 'object' && user.role !== null ? user.role : null;
      let perms = roleObj?.permissions || user.permissions;

      // Fallback: check accountant role permissions if user is accountant
      if ((!perms || Object.keys(perms).length === 0) && isAccountant && allRoles.length > 0) {
        const accRole = allRoles.find(
          (r) =>
            r.name === 'accountant' ||
            r.name?.includes('account') ||
            r.displayName?.toLowerCase().includes('account')
        );
        if (accRole?.permissions) perms = accRole.permissions;
      }

      if (!perms) return false;

      // 1. Array format: ['employees.view', 'payroll.view', ...]
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

      // 2. Object map format
      if (typeof perms === 'object') {
        if (perms['*'] === true || perms.all === true) return true;
        if (perms[permissionKey] === true) return true;
        if (perms[permissionKey] === false) return false;

        const parts = permissionKey.split('.');
        const [mod, act = 'view'] = parts;

        if (perms[mod]) {
          if (perms[mod] === true) return true;
          if (perms[mod] === false) return false;
          if (typeof perms[mod] === 'object' && checkLeafPermission(perms[mod], act)) {
            return true;
          }
        }
      }

      return false;
    },
    [isSuperAdmin, user, isAccountant, allRoles]
  );

  // Check if a navigation group or functional module should be visible/accessible
  // STRICTLY RESPECTS permissions matrix configured in Roles & Permissions (/masters/roles)
  const canAccessModule = useCallback(
    (moduleKey) => {
      if (isSuperAdmin) return true;
      if (!user) return false;

      // 1. Resolve role object and its permissions
      const roleObj = typeof user.role === 'object' && user.role !== null ? user.role : null;
      let perms = roleObj?.permissions || user.permissions || {};

      // If user is accountant and perms are not yet populated on user.role, retrieve from allRoles
      if ((!perms || Object.keys(perms).length === 0) && isAccountant && allRoles.length > 0) {
        const accRole = allRoles.find(
          (r) =>
            r.name === 'accountant' ||
            r.name?.includes('account') ||
            r.displayName?.toLowerCase().includes('account')
        );
        if (accRole?.permissions) {
          perms = accRole.permissions;
        }
      }

      const hasConfiguredPerms = perms && typeof perms === 'object' && Object.keys(perms).length > 0;

      // Helper to evaluate permission key against configured perms matrix
      const evalPerm = (primaryKey, aliases = []) => {
        if (!hasConfiguredPerms) return null;
        const keys = [primaryKey, ...aliases];

        for (const k of keys) {
          if (perms[k] === false) return false;
          if (perms[k] === true) return true;
          if (typeof perms[k] === 'object' && perms[k] !== null) {
            if (perms[k].view === false) return false;
            if (Object.values(perms[k]).some(Boolean)) return true;
          }
        }

        // Fuzzy match: check if any perms key contains module identifier
        const pLower = primaryKey.toLowerCase();
        for (const [pk, pval] of Object.entries(perms)) {
          const lk = pk.toLowerCase();
          if (lk === pLower || (pLower.length > 4 && lk.includes(pLower)) || (lk.length > 4 && pLower.includes(lk))) {
            if (pval === false) return false;
            if (pval === true) return true;
            if (typeof pval === 'object' && pval !== null) {
              if (pval.view === false) return false;
              if (Object.values(pval).some(Boolean)) return true;
            }
          }
        }

        return null;
      };

      switch (moduleKey) {
        case 'dashboard':
          return true;

        // HRM Submodules
        case 'employees': {
          if (isAccountant || isEmployee) return false;
          if (!isSuperAdmin && !isHrAdmin && !isDirector && !isBranchManager) return false;
          const explicit = evalPerm('employees', ['hrmEmployees', 'hrms.employeeMaster']);
          if (explicit !== null) return explicit;
          if (hasConfiguredPerms) return false;
          return hasRole(['hr_admin', 'director', 'branch_manager']);
        }

        case 'attendance': {
          // Self-service attendance & face punch available to all active staff
          return true;
        }

        case 'leaves': {
          // Self-service leaves & holiday calendar available to all active staff
          return true;
        }

        case 'payroll': {
          if (isAccountant) return true;
          const explicit = evalPerm('payroll', ['hrms.payrollManagement', 'accountingFinance']);
          if (explicit !== null) return explicit;
          if (hasConfiguredPerms) return false;
          return hasRole(['accountant', 'finance_head', 'hr_admin', 'director']);
        }

        case 'recruitment': {
          if (isAccountant || isEmployee) return false;
          if (!isSuperAdmin && !isHrAdmin && !isDirector) return false;
          const explicit = evalPerm('recruitment', ['recruitmentMaster']);
          if (explicit !== null) return explicit;
          if (hasConfiguredPerms) return false;
          return hasRole(['hr_admin', 'director']);
        }

        case 'assets':
        case 'assets-claims':
        case 'claims': {
          if (isAccountant) return true;
          const explicit = evalPerm('assets', ['assetsClaims', 'claims', 'hrms.assetCustody']);
          if (explicit !== null) return explicit;
          if (hasConfiguredPerms) return false;
          return hasRole(['accountant', 'finance_head', 'hr_admin', 'director', 'inventory_manager']);
        }

        case 'performance': {
          if (isAccountant || isEmployee) return false;
          if (!isSuperAdmin && !isHrAdmin && !isDirector && !isBranchManager) return false;
          const explicit = evalPerm('performance', ['hrms.kraManagement']);
          if (explicit !== null) return explicit;
          if (hasConfiguredPerms) return false;
          return hasRole(['hr_admin', 'director', 'branch_manager']);
        }

        case 'lifecycle': {
          if (isAccountant || isEmployee) return false;
          return canAccessModule('employees') || hasRole(['hr_admin', 'director']);
        }

        case 'reports': {
          if (isAccountant) return true;
          const explicit = evalPerm('reports', ['hrms.hrmsReports', 'administration.reportCenter']);
          if (explicit !== null) return explicit;
          if (hasConfiguredPerms) return false;
          return hasRole(['accountant', 'finance_head', 'hr_admin', 'director', 'branch_manager']);
        }

        case 'hrm':
          return (
            canAccessModule('employees') ||
            canAccessModule('attendance') ||
            canAccessModule('leaves') ||
            canAccessModule('payroll') ||
            canAccessModule('recruitment') ||
            canAccessModule('assets-claims') ||
            canAccessModule('performance') ||
            canAccessModule('reports')
          );

        // Operations Submodules
        case 'projects': {
          if (isAccountant || isEmployee) return false;
          const explicit = evalPerm('projects', ['operations', 'projectManagement.projectCreation', 'projectManagement.projectSite']);
          if (explicit !== null) return explicit;
          if (hasConfiguredPerms) return false;
          return hasRole(['branch_manager', 'project_executive', 'designer', 'director']);
        }

        case 'site-logs': {
          if (isAccountant || isEmployee) return false;
          const explicit = evalPerm('projects', ['operations', 'siteLogs', 'projectManagement.siteLog', 'projectManagement.issueManagement']);
          if (explicit !== null) return explicit;
          if (hasConfiguredPerms) return false;
          return hasRole(['branch_manager', 'project_executive', 'designer', 'director']);
        }

        case 'tasks': {
          if (isAccountant || isEmployee) return false;
          const explicit = evalPerm('projects', ['operations', 'tasks', 'projectManagement.taskManagement', 'projectManagement.taskMilestone']);
          if (explicit !== null) return explicit;
          if (hasConfiguredPerms) return false;
          return hasRole(['branch_manager', 'project_executive', 'designer', 'director']);
        }

        case 'operations':
          return (
            canAccessModule('projects') ||
            canAccessModule('site-logs') ||
            canAccessModule('tasks')
          );

        // Organization Masters Submodules
        case 'companies':
        case 'branches':
        case 'departments':
        case 'designations':
        case 'roles':
        case 'users':
        case 'masters': {
          if (isAccountant || isEmployee) return false;
          if (!isSuperAdmin && !isDirector) return false;
          const explicit = evalPerm('masters', [
            'administration.multiBranchCompany',
            'roles',
            'users',
            'administration.rolePermissionManagement',
            'administration.systemSettings',
          ]);
          if (explicit !== null) return explicit;
          if (hasConfiguredPerms) return false;
          return hasRole(['super_admin', 'director']);
        }

        default:
          if (hasConfiguredPerms) {
            const exp = evalPerm(moduleKey);
            return exp === true;
          }
          return false;
      }
    },
    [isSuperAdmin, user, isAccountant, allRoles, hasRole]
  );

  // Active user role or designation label
  const userRole = useMemo(() => {
    if (isSuperAdmin) return 'Super Admin';
    const desig = user?.designation || user?.employee?.employmentInfo?.designation;
    const desigName = typeof desig === 'string' ? desig : desig?.name || desig?.title;
    if (desigName) return desigName;
    return user?.role?.displayName || user?.role?.name || (isAccountant ? 'Accountant' : 'Employee');
  }, [isSuperAdmin, user, isAccountant]);

  const value = {
    user,
    loading,
    isAuthenticated: !!user,
    roleId,
    userRole,
    company: user?.company,
    branch: user?.branch || user?.branchId,
    isSuperAdmin,
    isDirector,
    isHrAdmin,
    isBranchManager,
    isProjectExecutive,
    isAccountant,
    isEmployee,
    allRoles,
    hasRole,
    hasPermission,
    canAccessModule,
    login,
    logout,
    refreshSession,
    fetchUserProfile,
    refreshRoles,
    updateProfile,
    changePassword,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  return context || defaultAuthValue;
};

export default AuthContext;
