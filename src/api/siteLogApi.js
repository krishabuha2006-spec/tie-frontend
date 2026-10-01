import apiClient from './client';

export const siteLogApi = {
  // 1. POST /site-logs/internal/stub - Create or Retrieve Site Log Stub (Internal / Automated)
  createStub: async (siteAttendanceRecordId) => {
    const res = await apiClient.post('/site-logs/internal/stub', { siteAttendanceRecordId });
    return res.data?.data || res.data;
  },

  // 2. PUT /site-logs/{id}/complete - Submit / Complete Site Log Activity Narrative (Self-Only)
  completeSiteLog: async (id, data) => {
    const res = await apiClient.put(`/site-logs/${id}/complete`, data);
    return res.data?.data || res.data;
  },

  // 3. GET /site-logs/me - Get Own Site Log History (Self)
  getMySiteLogs: async (params = {}) => {
    try {
      const res = await apiClient.get('/site-logs/me', { params });
      const raw = res.data?.data || res.data?.logs || (Array.isArray(res.data) ? res.data : []);
      return {
        success: res.data?.success ?? true,
        data: Array.isArray(raw) ? raw : [],
        count: res.data?.count || (Array.isArray(raw) ? raw.length : 0),
        total: res.data?.total || (Array.isArray(raw) ? raw.length : 0),
      };
    } catch (err) {
      if (err.response?.status === 404) {
        return { success: true, data: [], count: 0, total: 0 };
      }
      throw err;
    }
  },

  // 4. GET /site-logs/reports/project/{projectId} - Project-Wise Site Log Report & Summary
  getProjectReport: async (projectId, params = {}) => {
    const res = await apiClient.get(`/site-logs/reports/project/${projectId}`, { params });
    return res.data?.data || res.data;
  },

  // 5. GET /site-logs/reports/employee/{employeeId} - Employee-Wise Site Log Report & Summary
  getEmployeeReport: async (employeeId, params = {}) => {
    const res = await apiClient.get(`/site-logs/reports/employee/${employeeId}`, { params });
    return res.data?.data || res.data;
  },

  // 6. GET /site-logs/reports/incomplete - Incomplete Site Logs Follow-Up Queue
  getIncompleteQueue: async (params = {}) => {
    const res = await apiClient.get('/site-logs/reports/incomplete', { params });
    const raw = res.data?.data || res.data?.incompleteLogs || res.data?.logs || (Array.isArray(res.data) ? res.data : []);
    return {
      success: res.data?.success ?? true,
      data: Array.isArray(raw) ? raw : [],
      count: res.data?.count || (Array.isArray(raw) ? raw.length : 0),
      total: res.data?.total || (Array.isArray(raw) ? raw.length : 0),
    };
  },

  // 7. GET /site-logs/reports/issues - Issues & Observations Escalation Report
  getIssuesReport: async (params = {}) => {
    const res = await apiClient.get('/site-logs/reports/issues', { params });
    const raw = res.data?.data || res.data?.issues || res.data?.logs || (Array.isArray(res.data) ? res.data : []);
    return {
      success: res.data?.success ?? true,
      data: Array.isArray(raw) ? raw : [],
      count: res.data?.count || (Array.isArray(raw) ? raw.length : 0),
      total: res.data?.total || (Array.isArray(raw) ? raw.length : 0),
    };
  },

  // 8. GET /site-logs/employees/{employeeId} - Get Specific Employee Site Logs
  getEmployeeSiteLogs: async (employeeId, params = {}) => {
    try {
      const res = await apiClient.get(`/site-logs/employees/${employeeId}`, { params });
      const raw = res.data?.data || res.data?.logs || (Array.isArray(res.data) ? res.data : []);
      return {
        success: res.data?.success ?? true,
        data: Array.isArray(raw) ? raw : [],
        count: res.data?.count || (Array.isArray(raw) ? raw.length : 0),
        total: res.data?.total || (Array.isArray(raw) ? raw.length : 0),
      };
    } catch (err) {
      if (err.response?.status === 404) {
        return { success: true, data: [], count: 0, total: 0 };
      }
      throw err;
    }
  },

  // 9. GET /site-logs/{id} - Get Single Joined Site Log by ID
  getSiteLogById: async (id) => {
    const res = await apiClient.get(`/site-logs/${id}`);
    return res.data?.data || res.data;
  },
};

export default siteLogApi;
