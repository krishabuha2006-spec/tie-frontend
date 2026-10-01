import apiClient from './client';

export const departmentApi = {
  // GET /departments - List Departments (Pure API)
  getDepartments: async (params) => {
    const res = await apiClient.get('/departments', { params });
    return res.data;
  },

  // GET /departments/{id} - Get Department by ID (Pure API)
  getDepartmentById: async (id) => {
    const res = await apiClient.get(`/departments/${id}`);
    return res.data;
  },

  // POST /departments - Create Department (Pure API)
  createDepartment: async (data) => {
    const res = await apiClient.post('/departments', data);
    return res.data;
  },

  // PUT /departments/{id} - Update Department (Pure API)
  updateDepartment: async (id, data) => {
    const res = await apiClient.put(`/departments/${id}`, data);
    return res.data;
  },

  // DELETE /departments/{id} - Delete Department (Pure API)
  deleteDepartment: async (id) => {
    const res = await apiClient.delete(`/departments/${id}`);
    return res.data;
  },
};

export default departmentApi;
