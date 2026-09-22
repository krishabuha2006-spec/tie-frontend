import apiClient from './client';

export const projectTaskApi = {
  // Projects & Sites
  getProjects: async (params) => {
    const res = await apiClient.get('/projects', { params });
    return res.data;
  },

  getProjectById: async (id) => {
    const res = await apiClient.get(`/projects/${id}`);
    return res.data;
  },

  createProject: async (data) => {
    const res = await apiClient.post('/projects', data);
    return res.data;
  },

  getProjectSites: async (projectId) => {
    const res = await apiClient.get(`/projects/${projectId}/sites`);
    return res.data;
  },

  createProjectSite: async (projectId, data) => {
    const res = await apiClient.post(`/projects/${projectId}/sites`, data);
    return res.data;
  },

  deactivateProjectSite: async (siteId) => {
    const res = await apiClient.put(`/projects/sites/${siteId}/deactivate`);
    return res.data;
  },

  // Site Tasks (Module 9 - GET & POST /projects/tasks)
  getSiteTasks: async (params) => {
    try {
      const res = await apiClient.get('/projects/tasks', { params });
      return res.data;
    } catch (err) {
      if (err.response?.status === 404) {
        const fallback = await apiClient.get('/tasks', { params });
        return fallback.data;
      }
      throw err;
    }
  },

  createSiteTask: async (data) => {
    try {
      const res = await apiClient.post('/projects/tasks', data);
      return res.data;
    } catch (err) {
      if (err.response?.status === 404) {
        const fallback = await apiClient.post('/tasks', data);
        return fallback.data;
      }
      throw err;
    }
  },

  // Site Activity Logs (Module 10)
  createSiteLogStub: async (siteAttendanceRecordId) => {
    const res = await apiClient.post('/site-logs/internal/stub', { siteAttendanceRecordId });
    return res.data;
  },

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

  getSiteLogById: async (id) => {
    const res = await apiClient.get(`/site-logs/${id}`);
    return res.data;
  },

  getSiteLogsByProject: async (projectId, params) => {
    const res = await apiClient.get(`/site-logs/reports/project/${projectId}`, { params });
    return res.data;
  },

  getEmployeeSiteLogReport: async (employeeId, params) => {
    const res = await apiClient.get(`/site-logs/reports/employee/${employeeId}`, { params });
    return res.data;
  },

  getIncompleteSiteLogs: async (params) => {
    const res = await apiClient.get('/site-logs/reports/incomplete', { params });
    return res.data;
  },

  getIssuesReport: async (params) => {
    const res = await apiClient.get('/site-logs/reports/issues', { params });
    return res.data;
  },

  completeSiteLog: async (id, data) => {
    const res = await apiClient.put(`/site-logs/${id}/complete`, data);
    return res.data;
  },

  // Tasks (Module 9 & Module 11)
  getTasks: async (params) => {
    try {
      const res = await apiClient.get('/projects/tasks', { params });
      return res.data;
    } catch {
      const fallback = await apiClient.get('/tasks', { params });
      return fallback.data;
    }
  },

  getMyTasks: async (params) => {
    const res = await apiClient.get('/tasks/me', { params });
    return res.data;
  },

  createTask: async (data) => {
    try {
      const res = await apiClient.post('/projects/tasks', data);
      return res.data;
    } catch {
      const fallback = await apiClient.post('/tasks', data);
      return fallback.data;
    }
  },

  updateTaskStatus: async (id, status) => {
    const res = await apiClient.put(`/tasks/${id}/status`, { status });
    return res.data;
  },

  cancelTask: async (id, reason) => {
    const res = await apiClient.put(`/tasks/${id}/cancel`, { reason });
    return res.data;
  },
};

export default projectTaskApi;
