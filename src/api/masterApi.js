import apiClient from './client';

export const masterApi = {
  // Companies
  getCompanies: async (params) => {
    try {
      const res = await apiClient.get('/companies', { params });
      return res.data;
    } catch (err) {
      if (err.response?.status === 403) {
        const saved = localStorage.getItem('tie_user');
        if (saved) {
          try {
            const u = JSON.parse(saved);
            if (u.company) return { data: [u.company], companies: [u.company] };
          } catch {}
        }
        return { data: [], companies: [] };
      }
      throw err;
    }
  },
  getCompanyById: async (id) => {
    const res = await apiClient.get(`/companies/${id}`);
    return res.data;
  },
  createCompany: async (data) => {
    const res = await apiClient.post('/companies', data);
    return res.data;
  },
  updateCompany: async (id, data) => {
    const res = await apiClient.put(`/companies/${id}`, data);
    return res.data;
  },
  deleteCompany: async (id) => {
    const res = await apiClient.delete(`/companies/${id}`);
    return res.data;
  },

  // Branches
  getBranches: async (params) => {
    try {
      const res = await apiClient.get('/branches', { params });
      return res.data;
    } catch (err) {
      if (err.response?.status === 403) {
        const saved = localStorage.getItem('tie_user');
        if (saved) {
          try {
            const u = JSON.parse(saved);
            if (u.branch) return { data: [u.branch], branches: [u.branch] };
          } catch {}
        }
        return { data: [], branches: [] };
      }
      throw err;
    }
  },
  getBranchById: async (id) => {
    const res = await apiClient.get(`/branches/${id}`);
    return res.data;
  },
  createBranch: async (data) => {
    const res = await apiClient.post('/branches', data);
    return res.data;
  },
  updateBranch: async (id, data) => {
    const res = await apiClient.put(`/branches/${id}`, data);
    return res.data;
  },
  deleteBranch: async (id) => {
    const res = await apiClient.delete(`/branches/${id}`);
    return res.data;
  },

  // Departments
  getDepartments: async (params) => {
    try {
      const res = await apiClient.get('/departments', { params });
      return res.data;
    } catch (err) {
      if (err.response?.status === 403) {
        const saved = localStorage.getItem('tie_user');
        if (saved) {
          try {
            const u = JSON.parse(saved);
            if (u.department) return { data: [u.department], departments: [u.department] };
          } catch {}
        }
        return { data: [], departments: [] };
      }
      throw err;
    }
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
  // GET /designations — supports ?department=&search=&company= filters with robust fallback
  getDesignations: async (params) => {
    try {
      let cleanParams = undefined;
      let clientFilterDept = null;

      if (params) {
        cleanParams = {};
        if (params.search && typeof params.search === 'string' && params.search.trim()) {
          cleanParams.search = params.search.trim();
        }
        if (params.company && /^[0-9a-fA-F]{24}$/.test(params.company)) {
          cleanParams.company = params.company;
        }
        // Swagger expects department to be a 24-character hex ObjectId
        if (params.department) {
          if (/^[0-9a-fA-F]{24}$/.test(params.department)) {
            cleanParams.department = params.department;
          } else {
            // It's a department name (e.g. "Management & Leadership")
            // Filter client-side to prevent backend 404/400
            clientFilterDept = String(params.department).toLowerCase();
          }
        }
        if (Object.keys(cleanParams).length === 0) {
          cleanParams = undefined;
        }
      }

      let res;
      try {
        res = await apiClient.get('/designations', { params: cleanParams });
      } catch (err) {
        // If backend rejects query params with 404 or 400, fallback to fetching all designations
        if ((err.response?.status === 404 || err.response?.status === 400) && cleanParams) {
          res = await apiClient.get('/designations');
        } else if (err.response?.status === 403 || err.response?.status === 404) {
          return { data: [], designations: [] };
        } else {
          throw err;
        }
      }

      const resData = res?.data;
      let list = resData?.data || resData?.designations || (Array.isArray(resData) ? resData : []);

      // If client-side department filtering is needed
      if (clientFilterDept && Array.isArray(list)) {
        list = list.filter((item) => {
          const dName = typeof item.department === 'object' ? item.department?.name : '';
          const dVal = typeof item.department === 'string' ? item.department : '';
          return (
            (dName && dName.toLowerCase().includes(clientFilterDept)) ||
            (dVal && dVal.toLowerCase().includes(clientFilterDept))
          );
        });
        return { ...resData, data: list, designations: list };
      }

      return resData;
    } catch (err) {
      if (err.response?.status === 403 || err.response?.status === 404) {
        return { data: [], designations: [] };
      }
      throw err;
    }
  },

  // GET /designations/levels — Returns levels 1-10 (static or from backend)
  getDesignationLevels: async () => {
    try {
      const res = await apiClient.get('/designations/levels');
      return res.data;
    } catch {
      // Backend may not have this endpoint yet; return standard levels 1-10
      return { data: Array.from({ length: 10 }, (_, i) => ({ value: i + 1, label: `Level ${i + 1}` })) };
    }
  },

  // GET /designations/:id
  getDesignationById: async (id) => {
    const res = await apiClient.get(`/designations/${id}`);
    return res.data;
  },

  // POST /designations — Required: name, department. Optional: code, level, description, company, isActive
  createDesignation: async (data) => {
    const payload = {
      name: data.name || data.title, // support both field names
      department: data.department,
      code: data.code || undefined,
      level: data.level ? Number(data.level) : undefined,
      description: data.description || undefined,
      company: data.company || undefined,
      isActive: data.isActive !== false,
    };
    // Strip undefined keys
    Object.keys(payload).forEach((k) => payload[k] === undefined && delete payload[k]);
    const res = await apiClient.post('/designations', payload);
    return res.data;
  },

  // PUT /designations/:id — All fields optional
  updateDesignation: async (id, data) => {
    const payload = {
      name: data.name || data.title || undefined,
      department: data.department || undefined,
      code: data.code || undefined,
      level: data.level ? Number(data.level) : undefined,
      description: data.description !== undefined ? data.description : undefined,
      isActive: data.isActive !== undefined ? data.isActive : undefined,
    };
    Object.keys(payload).forEach((k) => payload[k] === undefined && delete payload[k]);
    const res = await apiClient.put(`/designations/${id}`, payload);
    return res.data;
  },

  // DELETE /designations/:id — Safe delete (blocked if employees assigned)
  deleteDesignation: async (id) => {
    const res = await apiClient.delete(`/designations/${id}`);
    return res.data;
  },


  // Roles & Permissions
  getRoles: async (params) => {
    try {
      const res = await apiClient.get('/roles', { params });
      return res.data;
    } catch (err) {
      if (err.response?.status === 403) return { data: [], roles: [] };
      throw err;
    }
  },
  getRoleById: async (id) => {
    const res = await apiClient.get(`/roles/${id}`);
    return res.data;
  },
  createRole: async (data) => {
    const res = await apiClient.post('/roles', data);
    return res.data;
  },
  updateRole: async (id, data) => {
    const res = await apiClient.put(`/roles/${id}`, data);
    return res.data;
  },
  deleteRole: async (id) => {
    const res = await apiClient.delete(`/roles/${id}`);
    return res.data;
  },
  getPermissionCatalog: async () => {
    try {
      const res = await apiClient.get('/roles/permission-catalog');
      return res.data;
    } catch (err) {
      if (err.response?.status === 403) return { data: null };
      throw err;
    }
  },
  updateRolePermissions: async (id, permissions) => {
    const res = await apiClient.put(`/roles/${id}/permissions`, { permissions });
    return res.data;
  },

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
    const res = await apiClient.delete(`/users/${id}`);
    return res.data;
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

export default masterApi;

