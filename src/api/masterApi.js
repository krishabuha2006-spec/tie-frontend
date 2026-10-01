import apiClient from './client';
import { roleApi } from './roleApi';

export const masterApi = {
  // Clear any legacy skip flags on module load
  clearLegacySkipFlags: (() => {
    try {
      sessionStorage.removeItem('tie_skip_companies_api');
      sessionStorage.removeItem('tie_skip_branches_api');
    } catch {}
  })(),

  // Companies
  getCompanies: async (params) => {
    try {
      const res = await apiClient.get('/companies', { params });
      return res.data;
    } catch (err) {
      if (err.response?.status === 403) {
        let list = [];
        try {
          const accessible = localStorage.getItem('tie_accessible_companies');
          if (accessible) list = JSON.parse(accessible);
        } catch {}
        if (!list.length) {
          try {
            const saved = localStorage.getItem('tie_user');
            if (saved) {
              const u = JSON.parse(saved);
              if (u.company) list = [u.company];
            }
          } catch {}
        }
        return { success: true, data: list, companies: list };
      }
      throw err;
    }
  },
  getCompanyById: async (id) => {
    const res = await apiClient.get(`/companies/${id}`);
    return res.data?.data || res.data;
  },
  createCompany: async (data) => {
    const res = await apiClient.post('/companies', data);
    return res.data?.data || res.data;
  },
  updateCompany: async (id, data) => {
    const res = await apiClient.put(`/companies/${id}`, data);
    return res.data?.data || res.data;
  },
  deleteCompany: async (id) => {
    try {
      const res = await apiClient.delete(`/companies/${id}`);
      return res.data?.data || res.data;
    } catch (err) {
      if (err.response?.status === 409) {
        const msg = err.response?.data?.message || 'Cannot delete company. It contains active branches. Remove or reassign them first.';
        const conflictErr = new Error(msg);
        conflictErr.status = 409;
        conflictErr.response = err.response;
        throw conflictErr;
      }
      throw err;
    }
  },

  // Branches
  getBranches: async (params) => {
    try {
      const res = await apiClient.get('/branches', { params });
      return res.data;
    } catch (err) {
      if (err.response?.status === 403) {
        let list = [];
        try {
          const cached = localStorage.getItem('tie_all_branches');
          if (cached) list = JSON.parse(cached);
        } catch {}
        if (!list.length) {
          try {
            const saved = localStorage.getItem('tie_user');
            if (saved) {
              const u = JSON.parse(saved);
              if (u.branch) list = [u.branch];
            }
          } catch {}
        }
        return { success: true, data: list, branches: list };
      }
      throw err;
    }
  },
  getBranchById: async (id) => {
    const res = await apiClient.get(`/branches/${id}`);
    return res.data?.data || res.data;
  },
  createBranch: async (data) => {
    const res = await apiClient.post('/branches', data);
    return res.data?.data || res.data;
  },
  updateBranch: async (id, data) => {
    const res = await apiClient.put(`/branches/${id}`, data);
    return res.data?.data || res.data;
  },
  deleteBranch: async (id) => {
    try {
      const res = await apiClient.delete(`/branches/${id}`);
      return res.data?.data || res.data;
    } catch (err) {
      if (err.response?.status === 409) {
        const msg = err.response?.data?.message || 'Cannot delete branch. It has associated users or records. Reassign them first.';
        const conflictErr = new Error(msg);
        conflictErr.status = 409;
        conflictErr.response = err.response;
        throw conflictErr;
      }
      throw err;
    }
  },

  // Departments
  getDepartments: async (params) => {
    const res = await apiClient.get('/departments', { params });
    return res.data;
  },
  getDepartmentById: async (id) => {
    const res = await apiClient.get(`/departments/${id}`);
    return res.data;
  },
  createDepartment: async (data) => {
    const res = await apiClient.post('/departments', data);
    return res.data;
  },
  updateDepartment: async (id, data) => {
    const res = await apiClient.put(`/departments/${id}`, data);
    return res.data;
  },
  deleteDepartment: async (id) => {
    const res = await apiClient.delete(`/departments/${id}`);
    return res.data;
  },

  // Designations
  getDesignations: async (params) => {
    const res = await apiClient.get('/designations', { params });
    return res.data;
  },

  // GET /designations/levels — Returns enterprise levels 1-10 from backend
  getDesignationLevels: async () => {
    const res = await apiClient.get('/designations/levels');
    return res.data;
  },

  // GET /designations/:id
  getDesignationById: async (id) => {
    const res = await apiClient.get(`/designations/${id}`);
    return res.data;
  },

  // POST /designations
  createDesignation: async (data) => {
    const res = await apiClient.post('/designations', data);
    return res.data;
  },

  // PUT /designations/:id
  updateDesignation: async (id, data) => {
    const res = await apiClient.put(`/designations/${id}`, data);
    return res.data;
  },

  // DELETE /designations/:id
  deleteDesignation: async (id) => {
    const res = await apiClient.delete(`/designations/${id}`);
    return res.data;
  },


  // Roles & Permissions (delegated to dedicated roleApi)
  getRoles: (params) => roleApi.getRoles(params),
  getRoleById: (id) => roleApi.getRoleById(id),
  createRole: (data) => roleApi.createRole(data),
  updateRole: (id, data) => roleApi.updateRole(id, data),
  deleteRole: (id) => roleApi.deleteRole(id),
  getPermissionCatalog: () => roleApi.getPermissionCatalog(),
  updateRolePermissions: (id, permissions) => roleApi.updateRolePermissions(id, permissions),

  // Users
  getUsers: async (params) => {
    const res = await apiClient.get('/users', { params });
    return res.data;
  },
  getUserById: async (id) => {
    const res = await apiClient.get(`/users/${id}`);
    return res.data;
  },
  createUser: async (data) => {
    const res = await apiClient.post('/users', data);
    return res.data;
  },
  updateUser: async (id, data) => {
    const res = await apiClient.put(`/users/${id}`, data);
    return res.data;
  },
  deleteUser: async (id) => {
    try {
      const res = await apiClient.delete(`/users/${id}`);
      return res.data;
    } catch (err) {
      if (err.response?.status === 409) {
        const msg = err.response?.data?.message || 'Cannot delete user. They have associated records. Please deactivate them instead.';
        const conflictErr = new Error(msg);
        conflictErr.status = 409;
        conflictErr.response = err.response;
        throw conflictErr;
      }
      throw err;
    }
  },
  updateUserStatus: async (id, isActive) => {
    try {
      const res = await apiClient.put(`/users/${id}/status`, { isActive });
      return res.data;
    } catch {
      const res = await apiClient.put(`/users/${id}/deactivate`);
      return res.data;
    }
  },
  deactivateUser: async (id) => {
    const res = await apiClient.put(`/users/${id}/deactivate`);
    return res.data;
  },

  // Employee Documents & Deactivation (Module 2 Centralized Master)
  getEmployeeDocuments: async (employeeId) => {
    const res = await apiClient.get(`/employees/${employeeId}/documents`);
    return res.data;
  },
  uploadEmployeeDocument: async (employeeId, docData) => {
    const isFormData = typeof FormData !== 'undefined' && docData instanceof FormData;
    const config = isFormData ? { headers: { 'Content-Type': 'multipart/form-data' } } : {};
    const res = await apiClient.post(`/employees/${employeeId}/documents`, docData, config);
    return res.data;
  },
  deleteEmployeeDocument: async (employeeId, docIndex) => {
    const res = await apiClient.delete(`/employees/${employeeId}/documents/${docIndex}`);
    return res.data;
  },
  deactivateEmployee: async (employeeId) => {
    const res = await apiClient.put(`/employees/${employeeId}/deactivate`);
    return res.data;
  },
};

export { roleApi };
export default masterApi;

