import apiClient from './client';

export const taskApi = {
  // Step 1: Create and Assign Task(s) (POST /tasks)
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
    return res.data;
  },

  // Step 2: Get Filtered Task List (GET /tasks)
  getTasks: async (params) => {
    const res = await apiClient.get('/tasks', { params });
    return res.data;
  },

  // Step 3: Get Logged-in Employee Tasks (GET /tasks/me)
  getMyTasks: async (params) => {
    try {
      const res = await apiClient.get('/tasks/me', { params });
      return res.data;
    } catch (err) {
      if (err.response?.status === 404) return { success: true, tasks: [], data: [] };
      throw err;
    }
  },

  // Step 4: Get Tasks for Specific Employee (GET /tasks/employees/:employeeId)
  getEmployeeTasks: async (employeeId, params) => {
    const res = await apiClient.get(`/tasks/employees/${employeeId}`, { params });
    return res.data;
  },

  // Step 5: Get Task Details by ID (GET /tasks/:id)
  getTaskById: async (id) => {
    const res = await apiClient.get(`/tasks/${id}`);
    return res.data;
  },

  // Step 6: Update Task Details (PUT /tasks/:id)
  updateTask: async (id, data) => {
    const res = await apiClient.put(`/tasks/${id}`, data);
    return res.data;
  },

  // Step 7: Update Task Lifecycle Status (PUT /tasks/:id/status)
  updateTaskStatus: async (id, status) => {
    const res = await apiClient.put(`/tasks/${id}/status`, { status });
    return res.data;
  },

  // Step 8: Cancel Task (PUT /tasks/:id/cancel)
  cancelTask: async (id, reason) => {
    const res = await apiClient.put(`/tasks/${id}/cancel`, { cancellationReason: reason || 'Cancelled by manager' });
    return res.data;
  },

  // Step 9: Overdue Tasks Report (GET /tasks/reports/overdue)
  getOverdueReport: async (params) => {
    const res = await apiClient.get('/tasks/reports/overdue', { params });
    return res.data;
  },

  // Step 10: Task Completion Rate & On-Time Performance Report (GET /tasks/reports/completion-rate)
  getCompletionRateReport: async (params) => {
    const res = await apiClient.get('/tasks/reports/completion-rate', { params });
    return res.data;
  },

  // Step 11: Trigger Overdue Task Evaluation Job (POST /tasks/evaluate-overdue)
  evaluateOverdueTasks: async () => {
    const res = await apiClient.post('/tasks/evaluate-overdue');
    return res.data;
  },
};

export default taskApi;
