import apiClient from './client';

export const lifecycleApi = {
  // =========================================================================
  // Module 22: Employee Lifecycle Management
  // =========================================================================

  // POST /lifecycle-events/confirmation
  initiateConfirmation: async (data) => {
    const res = await apiClient.post('/lifecycle-events/confirmation', data);
    return res.data;
  },

  // POST /lifecycle-events/promotion
  initiatePromotion: async (data) => {
    const res = await apiClient.post('/lifecycle-events/promotion', data);
    return res.data;
  },

  // POST /lifecycle-events/transfer
  initiateTransfer: async (data) => {
    const res = await apiClient.post('/lifecycle-events/transfer', data);
    return res.data;
  },

  // POST /lifecycle-events/exit
  initiateExit: async (data) => {
    const payload = {
      employeeId: data.employeeId,
      exitReason: data.exitReason || data.exitType || 'RESIGNATION',
      resignationDate: data.resignationDate || new Date().toISOString().split('T')[0],
      lastWorkingDay: data.lastWorkingDay || new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
      supportingDocuments: data.supportingDocuments || [],
    };
    const res = await apiClient.post('/lifecycle-events/exit', payload);
    return res.data;
  },

  // PUT /lifecycle-events/:id/decide
  decideLifecycleEvent: async (id, decisionData) => {
    const res = await apiClient.put(`/lifecycle-events/${id}/decide`, decisionData);
    return res.data;
  },

  // GET /lifecycle-events/:id/checklist
  getExitChecklist: async (id) => {
    const res = await apiClient.get(`/lifecycle-events/${id}/checklist`);
    return res.data;
  },

  // PUT /lifecycle-events/:id/checklist/:itemKey/confirm
  confirmChecklistItem: async (id, itemKey, data = {}) => {
    const res = await apiClient.put(`/lifecycle-events/${id}/checklist/${itemKey}/confirm`, data);
    return res.data;
  },

  // PUT /lifecycle-events/:id/finalize-exit
  finalizeExit: async (id, data = {}) => {
    const res = await apiClient.put(`/lifecycle-events/${id}/finalize-exit`, data);
    return res.data;
  },

  // GET /lifecycle-events/me
  getMyLifecycleEvents: async (params) => {
    try {
      const res = await apiClient.get('/lifecycle-events/me', { params });
      return res.data;
    } catch (err) {
      if (err.response?.status === 400) {
        // User account (e.g. Super Admin) is not bound to a personal employee profile
        return { data: [] };
      }
      throw err;
    }
  },

  // GET /lifecycle-events/employees/:employeeId
  getEmployeeLifecycleEvents: async (employeeId, params) => {
    const res = await apiClient.get(`/lifecycle-events/employees/${employeeId}`, { params });
    return res.data;
  },

  // GET /lifecycle-events
  getAllLifecycleEvents: async (params) => {
    const res = await apiClient.get('/lifecycle-events', { params });
    return res.data;
  },

  // GET /lifecycle-events/:id
  getLifecycleEventById: async (id) => {
    const res = await apiClient.get(`/lifecycle-events/${id}`);
    return res.data;
  },
};

export default lifecycleApi;
