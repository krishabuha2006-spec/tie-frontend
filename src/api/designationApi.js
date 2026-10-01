import apiClient from './client';

export const designationApi = {
  // GET /designations - List Designations (Pure API)
  getDesignations: async (params) => {
    const res = await apiClient.get('/designations', { params });
    return res.data;
  },

  // GET /designations/levels - Get All Available Designation Levels (1 to 10) (Pure API)
  getDesignationLevels: async () => {
    const res = await apiClient.get('/designations/levels');
    return res.data;
  },

  // GET /designations/{id} - Get Designation by ID (Pure API)
  getDesignationById: async (id) => {
    const res = await apiClient.get(`/designations/${id}`);
    return res.data;
  },

  // POST /designations - Create Designation (Pure API)
  createDesignation: async (data) => {
    const res = await apiClient.post('/designations', data);
    return res.data;
  },

  // PUT /designations/{id} - Update Designation (Pure API)
  updateDesignation: async (id, data) => {
    const res = await apiClient.put(`/designations/${id}`, data);
    return res.data;
  },

  // DELETE /designations/{id} - Delete Designation (Pure API)
  deleteDesignation: async (id) => {
    const res = await apiClient.delete(`/designations/${id}`);
    return res.data;
  },
};

export default designationApi;
