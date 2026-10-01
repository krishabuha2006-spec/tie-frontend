import apiClient from './client';

export const taskApi = {
  // 1. POST /tasks - Create and Assign Task(s)
  createTask: async (data) => {
    const payload = {
      taskName: data.taskName || data.title,
      title: data.title || data.taskName,
      description: data.description || '',
      assignedTo: data.assignedTo,
      priority: data.priority || 'MEDIUM',
      dueDate: data.dueDate || data.deadline,
      project: data.project || data.projectId || undefined,
      site: data.site || data.siteId || undefined,
      roleResponsibility: data.roleResponsibility || undefined,
    };
    const res = await apiClient.post('/tasks', payload);
    return res.data?.data || res.data;
  },

  // 2. GET /tasks - Get Filtered Task List
  getTasks: async (params = {}) => {
    const res = await apiClient.get('/tasks', { params });
    const raw = res.data?.data || res.data?.tasks || (Array.isArray(res.data) ? res.data : []);
    return {
      success: res.data?.success ?? true,
      data: Array.isArray(raw) ? raw : [],
      count: res.data?.count || (Array.isArray(raw) ? raw.length : 0),
      total: res.data?.total || (Array.isArray(raw) ? raw.length : 0),
    };
  },

  // 3. GET /tasks/me - Get Logged-in Employee Tasks
  getMyTasks: async (params = {}) => {
    try {
      const res = await apiClient.get('/tasks/me', { params });
      const raw = res.data?.data || res.data?.tasks || (Array.isArray(res.data) ? res.data : []);
      return {
        success: res.data?.success ?? true,
        data: Array.isArray(raw) ? raw : [],
        count: res.data?.count || (Array.isArray(raw) ? raw.length : 0),
        total: res.data?.total || (Array.isArray(raw) ? raw.length : 0),
      };
    } catch (err) {
      if (err.response?.status === 404) return { success: true, data: [], count: 0, total: 0 };
      throw err;
    }
  },

  // 4. GET /tasks/employees/{employeeId} - Get Tasks for Specific Employee
  getEmployeeTasks: async (employeeId, params = {}) => {
    const res = await apiClient.get(`/tasks/employees/${employeeId}`, { params });
    const raw = res.data?.data || res.data?.tasks || (Array.isArray(res.data) ? res.data : []);
    return {
      success: res.data?.success ?? true,
      data: Array.isArray(raw) ? raw : [],
      count: res.data?.count || (Array.isArray(raw) ? raw.length : 0),
      total: res.data?.total || (Array.isArray(raw) ? raw.length : 0),
    };
  },

  // 5. GET /tasks/{id} - Get Task Details by ID
  getTaskById: async (id) => {
    const res = await apiClient.get(`/tasks/${id}`);
    return res.data?.data || res.data?.task || res.data;
  },

  // 6. PUT /tasks/{id} - Update Task Details
  updateTask: async (id, data) => {
    const res = await apiClient.put(`/tasks/${id}`, data);
    return res.data?.data || res.data;
  },

  // 7. PUT /tasks/{id}/status - Update Task Lifecycle Status
  updateTaskStatus: async (id, status) => {
    const res = await apiClient.put(`/tasks/${id}/status`, { status });
    return res.data?.data || res.data;
  },

  // 8. PUT /tasks/{id}/cancel - Cancel Task
  cancelTask: async (id, reason) => {
    const res = await apiClient.put(`/tasks/${id}/cancel`, { cancellationReason: reason || 'Cancelled by manager' });
    return res.data?.data || res.data;
  },

  // 9. GET /tasks/reports/overdue - Overdue Tasks Report
  getOverdueReport: async (params = {}) => {
    const res = await apiClient.get('/tasks/reports/overdue', { params });
    return res.data?.data || res.data?.report || res.data;
  },

  // 10. GET /tasks/reports/completion-rate - Task Completion Rate & On-Time Performance Report
  getCompletionRateReport: async (params = {}) => {
    const res = await apiClient.get('/tasks/reports/completion-rate', { params });
    return res.data?.data || res.data?.report || res.data;
  },

  // 11. POST /tasks/evaluate-overdue - Trigger Overdue Task Evaluation Job
  evaluateOverdueTasks: async () => {
    const res = await apiClient.post('/tasks/evaluate-overdue');
    return res.data?.data || res.data;
  },
};

export default taskApi;
