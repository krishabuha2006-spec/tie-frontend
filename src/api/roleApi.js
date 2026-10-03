import apiClient from './client';

export const ALL_PERMISSION_ACTIONS = [
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

export const roleApi = {
  // 1. Get Master Permission Catalog (GET /roles/permission-catalog)
  getPermissionCatalog: async () => {
    try {
      const res = await apiClient.get('/roles/permission-catalog');
      return res.data;
    } catch (err) {
      if (err.response?.status === 403 || err.response?.status === 401) return { data: null };
      throw err;
    }
  },

  // 2. List All Roles (GET /roles) — backend is single source of truth
  getRoles: async (params) => {
    let fallbackRole = null;
    let isNonAdmin = false;
    try {
      const savedUser = localStorage.getItem('tie_user');
      if (savedUser) {
        const u = JSON.parse(savedUser);
        fallbackRole = u?.role;
        const roleStr = String(u?.role?.name || u?.role || '').toLowerCase();
        if (roleStr && !/(super_admin|director|hr_admin)/i.test(roleStr) && !u?.isSuperAdmin) {
          isNonAdmin = true;
        }
      }
    } catch {}

    // On the Roles & Permissions admin page, always fetch fresh from backend
    const onRolesPage = typeof window !== 'undefined' && window.location.pathname.includes('/masters/roles');
    const shouldSkip = (sessionStorage.getItem('tie_skip_roles_api') === 'true' || isNonAdmin) && !onRolesPage;

    if (shouldSkip) {
      let list = [];
      try {
        const cached = localStorage.getItem('tie_roles');
        if (cached) list = JSON.parse(cached);
      } catch {}
      if (!list.length && fallbackRole) list = [fallbackRole];
      return { success: true, data: list, roles: list };
    }

    try {
      const res = await apiClient.get('/roles', { params });
      // Normalise the response shape
      let list = res.data?.data || res.data?.roles || (Array.isArray(res.data) ? res.data : []);
      if (list && typeof list === 'object' && !Array.isArray(list) && Array.isArray(list.roles)) {
        list = list.roles;
      }
      if (Array.isArray(list) && list.length > 0) {
        // Cache backend result as-is — backend is the source of truth
        try { localStorage.setItem('tie_roles', JSON.stringify(list)); } catch {}
        return { success: true, data: list, roles: list };
      }
      return res.data;
    } catch (err) {
      if (err.response?.status === 403) {
        try { sessionStorage.setItem('tie_skip_roles_api', 'true'); } catch {}
      }
      // Fallback to cache on network error
      let list = [];
      try {
        const cached = localStorage.getItem('tie_roles');
        if (cached) list = JSON.parse(cached);
      } catch {}
      if (!list.length && fallbackRole) list = [fallbackRole];
      return { success: true, data: list, roles: list };
    }
  },

  // 3. Create Custom Role (POST /roles)
  createRole: async (data) => {
    const res = await apiClient.post('/roles', data);
    return res.data?.data || res.data;
  },

  // 4. Get Role by ID (GET /roles/:id)
  getRoleById: async (id) => {
    const res = await apiClient.get(`/roles/${id}`);
    return res.data?.data || res.data;
  },

  // 5. Update Role Details (PUT /roles/:id)
  updateRole: async (id, data) => {
    const res = await apiClient.put(`/roles/${id}`, data);
    return res.data?.data || res.data;
  },

  // 6. Delete Role (DELETE /roles/:id)
  deleteRole: async (id) => {
    try {
      const res = await apiClient.delete(`/roles/${id}`);
      return res.data?.data || res.data;
    } catch (err) {
      if (err.response?.status === 409) {
        const msg =
          err.response?.data?.message ||
          'Cannot delete role. It is assigned to active users. Reassign them first.';
        const conflictErr = new Error(msg);
        conflictErr.status = 409;
        conflictErr.response = err.response;
        throw conflictErr;
      }
      throw err;
    }
  },

  // PUT /roles/:id/permissions  — body: { permissions: { ... } }
  updateRolePermissions: async (id, permissions) => {
    const sanitized = {};
    if (permissions && typeof permissions === 'object') {
      for (const [k, v] of Object.entries(permissions)) {
        if (!k || typeof k !== 'string') continue;

        // Only keep canonical dotKey entries (e.g. "hrm.employees")
        // Skip bare module keys or bare submodule keys without a dot
        // (those are legacy alias copies we no longer write)
        if (!k.includes('.')) continue;

        const actObj = {};
        ALL_PERMISSION_ACTIONS.forEach((a) => {
          if (v === true) actObj[a] = true;
          else if (v === false || !v) actObj[a] = false;
          else if (typeof v === 'object') actObj[a] = Boolean(v[a]);
          else actObj[a] = false;
        });
        sanitized[k] = actObj;
      }
    }

    // Update cached roles list so session reflects changes immediately
    try {
      const cached = localStorage.getItem('tie_roles');
      if (cached) {
        const rolesList = JSON.parse(cached);
        if (Array.isArray(rolesList)) {
          const idx = rolesList.findIndex((r) => r._id === id || r.id === id);
          if (idx !== -1) {
            rolesList[idx] = { ...rolesList[idx], permissions: sanitized };
            localStorage.setItem('tie_roles', JSON.stringify(rolesList));
          }
        }
      }
    } catch {}

    try {
      const res = await apiClient.put(`/roles/${id}/permissions`, { permissions: sanitized }, { timeout: 30000 });
      return res.data;
    } catch (err) {
      if (err.response?.status === 404 || err.response?.status === 405) {
        const res = await apiClient.put(`/roles/${id}`, { permissions: sanitized }, { timeout: 30000 });
        return res.data;
      }
      throw err;
    }
  },
};

export default roleApi;
