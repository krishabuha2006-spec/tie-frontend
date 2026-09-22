import apiClient from './client';

export const performanceApi = {
  // =========================================================================
  // Module 21: Key Result Areas (KRA Templates)
  // =========================================================================

  // GET /kra-templates
  getKraTemplates: async (params) => {
    try {
      const res = await apiClient.get('/kra-templates', { params });
      return res.data;
    } catch (err) {
      if (err.response?.status === 400 || err.response?.status === 404) return { data: [], templates: [] };
      throw err;
    }
  },

  // POST /kra-templates
  createKraTemplate: async (data) => {
    const res = await apiClient.post('/kra-templates', data);
    return res.data;
  },

  // GET /kra-templates/:id
  getKraTemplateById: async (id) => {
    const res = await apiClient.get(`/kra-templates/${id}`);
    return res.data;
  },

  // PUT /kra-templates/:id
  updateKraTemplate: async (id, data) => {
    const res = await apiClient.put(`/kra-templates/${id}`, data);
    return res.data;
  },

  // DELETE /kra-templates/:id
  deactivateKraTemplate: async (id) => {
    const res = await apiClient.delete(`/kra-templates/${id}`);
    return res.data;
  },

  // =========================================================================
  // Module 21: Performance Review Cycles & Evaluations
  // =========================================================================

  // POST /performance-reviews/cycles/initiate
  initiateReviewCycle: async (data) => {
    const res = await apiClient.post('/performance-reviews/cycles/initiate', data);
    return res.data;
  },

  // GET /performance-reviews/me
  getMyReviews: async (params) => {
    try {
      const res = await apiClient.get('/performance-reviews/me', { params });
      return res.data;
    } catch (err) {
      if (err.response?.status === 400) {
        try {
          const userStr = localStorage.getItem('tie_user');
          const userData = userStr ? JSON.parse(userStr) : null;
          const empId = userData?.employeeId || userData?.employee?._id || (typeof userData?.employee === 'string' ? userData.employee : null);
          if (empId) {
            const fallback = await apiClient.get(`/performance-reviews/employees/${empId}`, { params });
            return fallback.data;
          }
        } catch {
          // ignore fallback error
        }
        return { success: true, data: [] };
      }
      throw err;
    }
  },

  // GET /performance-reviews/pending-my-review
  getPendingManagerReviews: async (params) => {
    try {
      const res = await apiClient.get('/performance-reviews/pending-my-review', { params });
      return res.data;
    } catch (err) {
      if (err.response?.status === 400 || err.response?.status === 404) return { data: [], reviews: [] };
      throw err;
    }
  },

  // GET /performance-reviews/employees/:employeeId
  getEmployeeReviews: async (employeeId, params) => {
    const res = await apiClient.get(`/performance-reviews/employees/${employeeId}`, { params });
    return res.data;
  },
  getReviewsByEmployee: async (employeeId, params) => {
    const res = await apiClient.get(`/performance-reviews/employees/${employeeId}`, { params });
    return res.data;
  },

  // GET /performance-reviews/:id
  getReviewById: async (id) => {
    const res = await apiClient.get(`/performance-reviews/${id}`);
    return res.data;
  },

  // PUT /performance-reviews/:id/self-assessment
  submitSelfAssessment: async (id, data) => {
    const res = await apiClient.put(`/performance-reviews/${id}/self-assessment`, data);
    return res.data;
  },

  // PUT /performance-reviews/:id/manager-review
  submitManagerReview: async (id, data) => {
    const res = await apiClient.put(`/performance-reviews/${id}/manager-review`, data);
    return res.data;
  },
};

export default performanceApi;
