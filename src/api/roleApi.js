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

  // 2. List All Roles (GET /roles)
  getRoles: async (params) => {
    try {
      const res = await apiClient.get('/roles', { params });
      return res.data;
    } catch (err) {
      if (err.response?.status === 403) return { success: false, data: [], roles: [] };
      throw err;
    }
  },

  // 3. Create Custom Role (POST /roles)
  createRole: async (data) => {
    const res = await apiClient.post('/roles', data);
    return res.data;
  },

  // 4. Get Role by ID (GET /roles/:id)
  getRoleById: async (id) => {
    const res = await apiClient.get(`/roles/${id}`);
    return res.data;
  },

  // 5. Update Role Details (PUT /roles/:id)
  updateRole: async (id, data) => {
    const res = await apiClient.put(`/roles/${id}`, data);
    return res.data;
  },

  // 6. Delete Role (DELETE /roles/:id)
  deleteRole: async (id) => {
    try {
      const res = await apiClient.delete(`/roles/${id}`);
      return res.data;
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


  updateRolePermissions: async (id, permissions) => {
    // Sanitize permissions to ensure all values are valid 12-action PermissionActions objects
    const sanitized = {};
    if (permissions && typeof permissions === 'object') {
      for (const [k, v] of Object.entries(permissions)) {
        if (!k || typeof k !== 'string') continue;
        if (v === true) {
          const actObj = {};
          ALL_PERMISSION_ACTIONS.forEach((a) => {
            actObj[a] = true;
          });
          sanitized[k] = actObj;
        } else if (v === false) {
          const actObj = {};
          ALL_PERMISSION_ACTIONS.forEach((a) => {
            actObj[a] = false;
          });
          sanitized[k] = actObj;
        } else if (typeof v === 'object' && v !== null) {
          const actObj = {};
          ALL_PERMISSION_ACTIONS.forEach((a) => {
            actObj[a] = v[a] !== undefined ? Boolean(v[a]) : Object.values(v).some(Boolean);
          });
          sanitized[k] = actObj;
        }
      }
    }

    try {
      const res = await apiClient.put(
        `/roles/${id}/permissions`,
        { permissions: sanitized },
        { timeout: 30000 }
      );
      return res.data;
    } catch (err) {
      console.warn(
        'updateRolePermissions primary payload failed, attempting resilient fallback:',
        err.message
      );
      if (
        err.response?.status === 500 ||
        err.code === 'ECONNABORTED' ||
        err.message?.includes('timeout')
      ) {
        try {
          const res2 = await apiClient.put(`/roles/${id}/permissions`, sanitized, { timeout: 15000 });
          return res2.data;
        } catch {
          try {
            const res3 = await apiClient.put(
              `/roles/${id}`,
              { permissions: sanitized },
              { timeout: 15000 }
            );
            return res3.data;
          } catch {
            throw err;
          }
        }
      }
      throw err;
    }
  },
};

export default roleApi;
