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

  // PUT /projects/:id — Update project details
  updateProject: async (id, data) => {
    const res = await apiClient.put(`/projects/${id}`, data);
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

  // Site Tasks (Module 9 & 11 - GET & POST /projects/tasks and /tasks)
  getSiteTasks: async (params) => {
    try {
      const res = await apiClient.get('/projects/tasks', { params });
      return res.data;
    } catch (err) {
      if (err.response?.status === 404 || err.response?.status === 400) {
        try {
          const fallback = await apiClient.get('/tasks', { params });
          return fallback.data;
        } catch {
          return { success: true, data: [], tasks: [] };
        }
      }
      return { success: true, data: [], tasks: [] };
    }
  },

  createSiteTask: async (data) => {
    let siteRef = data.site || data.siteId;
    let projRef = data.project || data.projectId;

    // If site is missing, attempt to fetch first site of project
    if (!siteRef && projRef) {
      try {
        const sRes = await apiClient.get(`/projects/${projRef}/sites`);
        const sites = Array.isArray(sRes.data) ? sRes.data : (sRes.data?.data || sRes.data?.sites || []);
        if (sites.length > 0) {
          siteRef = sites[0]._id || sites[0].id;
        }
      } catch {}
    }

    const payload = {
      taskName: data.taskName || data.title,
      title: data.title || data.taskName,
      project: projRef,
      projectId: projRef,
      site: siteRef,
      siteId: siteRef,
      assignedTo: data.assignedTo || data.employeeId,
      employeeId: data.employeeId || data.assignedTo,
      dueDate: data.dueDate || data.deadline,
      deadline: data.deadline || data.dueDate,
      priority: data.priority || 'MEDIUM',
      description: data.description || '',
    };

    try {
      const res = await apiClient.post('/projects/tasks', payload);
      return res.data;
    } catch (err) {
      if (err.response?.status === 404 || err.response?.status === 400) {
        const fallback = await apiClient.post('/tasks', payload);
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

  // GET /site-logs/employees/:employeeId — Employee site log history
  getEmployeeSiteLogs: async (employeeId, params) => {
    const res = await apiClient.get(`/site-logs/employees/${employeeId}`, { params });
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
    const res = await apiClient.get('/tasks', { params });
    return res.data;
  },

  getMyTasks: async (params) => {
    const res = await apiClient.get('/tasks/me', { params });
    return res.data;
  },

  // GET /tasks/employees/:employeeId
  getEmployeeTasks: async (employeeId, params) => {
    const res = await apiClient.get(`/tasks/employees/${employeeId}`, { params });
    return res.data;
  },

  createTask: async (data) => {
    const res = await apiClient.post('/tasks', data);
    return res.data;
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

