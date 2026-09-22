import apiClient from './client';

export const siteLogApi = {
  // Step 2 & 5.1: Create / verify internal stub for site log (POST /api/site-logs/internal/stub)
  createStub: async (siteAttendanceRecordId) => {
    const res = await apiClient.post('/site-logs/internal/stub', { siteAttendanceRecordId });
    return res.data;
  },

  // Step 5 & 5.2: Submit / complete site log narrative (PUT /api/site-logs/:id/complete)
  completeSiteLog: async (id, data) => {
    const res = await apiClient.put(`/site-logs/${id}/complete`, data);
    return res.data;
  },

  // Step 4 & 5.3: Get own site log history (GET /api/site-logs/me)
  getMySiteLogs: async (params) => {
    try {
      const res = await apiClient.get('/site-logs/me', { params });
      return res.data;
    } catch (err) {
      if (err.response?.status === 404) {
        return { success: true, data: [] };
      }
      throw err;
    }
  },

  // Step 6 & 5.8: Single joined log view with attendance, task & photos (GET /api/site-logs/:id)
  getSiteLogById: async (id) => {
    const res = await apiClient.get(`/site-logs/${id}`);
    return res.data;
  },

  // Step 7 & 5.4: Project-wise site log report & summary (GET /api/site-logs/reports/project/:projectId)
  getProjectReport: async (projectId, params) => {
    const res = await apiClient.get(`/site-logs/reports/project/${projectId}`, { params });
    return res.data;
  },

  // Step 7 & 5.5: Employee-wise site log report (GET /api/site-logs/reports/employee/:employeeId)
  getEmployeeReport: async (employeeId, params) => {
    const res = await apiClient.get(`/site-logs/reports/employee/${employeeId}`, { params });
    return res.data;
  },

  // Step 3 & 5.6: Incomplete site logs follow-up queue (GET /api/site-logs/reports/incomplete)
  getIncompleteQueue: async (params) => {
    const res = await apiClient.get('/site-logs/reports/incomplete', { params });
    return res.data;
  },

  // Step 7 & 5.7: Issues & observations escalation report (GET /api/site-logs/reports/issues)
  getIssuesReport: async (params) => {
    const res = await apiClient.get('/site-logs/reports/issues', { params });
    return res.data;
  },
};

export default siteLogApi;
