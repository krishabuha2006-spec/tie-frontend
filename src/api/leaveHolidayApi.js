import apiClient from './client';

export const leaveHolidayApi = {
  // --- Module 12: Leave Types ---
  // POST /leave-types
  createLeaveType: async (data) => {
    const res = await apiClient.post('/leave-types', data);
    return res.data;
  },

  // GET /leave-types
  getLeaveTypes: async (params) => {
    const res = await apiClient.get('/leave-types', { params });
    return res.data;
  },

  // PUT /leave-types/:id
  updateLeaveType: async (id, data) => {
    const res = await apiClient.put(`/leave-types/${id}`, data);
    return res.data;
  },

  // --- Module 12: Leave Balances & Accrual ---
  // POST /leave/balances/accrue
  accrueLeaveBalance: async (data) => {
    const res = await apiClient.post('/leave/balances/accrue', data);
    return res.data;
  },

  // GET /leave/employees/:employeeId/balance
  getEmployeeLeaveBalance: async (employeeId, params = {}) => {
    if (!employeeId || !/^[0-9a-fA-F]{24}$/.test(String(employeeId))) {
      return { success: true, data: [], balances: [] };
    }
    try {
      const res = await apiClient.get(`/leave/employees/${employeeId}/balance`, { params });
      return res.data;
    } catch (err) {
      if (err.response?.status === 404 || err.response?.status === 400) {
        return { success: true, data: [], balances: [] };
      }
      throw err;
    }
  },

  // --- Module 12: Leave Requests ---
  // POST /leave/requests
  applyLeave: async (data) => {
    const payload = {
      leaveType: data.leaveType,
      fromDate: data.fromDate || data.startDate,
      toDate: data.toDate || data.endDate,
      reason: data.reason,
      supportingDocument: data.supportingDocument || null,
    };
    const res = await apiClient.post('/leave/requests', payload);
    return res.data;
  },

  // GET /leave/requests/me
  getMyLeaveRequests: async (params) => {
    try {
      const res = await apiClient.get('/leave/requests/me', { params });
      return res.data;
    } catch (err) {
      if (err.response?.status === 400 || err.response?.status === 404) {
        return { success: true, data: [], requests: [], leaveRequests: [] };
      }
      throw err;
    }
  },

  // GET /leave/requests/pending-approval
  getPendingLeaveApprovals: async (params) => {
    try {
      const res = await apiClient.get('/leave/requests/pending-approval', { params });
      return res.data;
    } catch (err) {
      if (err.response?.status === 403 || err.response?.status === 404 || err.response?.status === 400) {
        return { success: true, count: 0, pendingRequests: [], requests: [], data: [] };
      }
      throw err;
    }
  },

  // GET /leave/requests/employees/:employeeId
  getEmployeeLeaveRequests: async (employeeId, params) => {
    try {
      const res = await apiClient.get(`/leave/requests/employees/${employeeId}`, { params });
      return res.data;
    } catch (err) {
      if (err.response?.status === 404 || err.response?.status === 400) {
        return { success: true, data: [], requests: [], leaveRequests: [] };
      }
      throw err;
    }
  },

  // PUT /leave/requests/:id/approve
  approveLeave: async (id, data = {}) => {
    const remark = typeof data === 'string' ? data : (data.remark || data.remarks || 'Approved');
    const res = await apiClient.put(`/leave/requests/${id}/approve`, { remark, remarks: remark });
    return res.data;
  },

  // PUT /leave/requests/:id/reject
  rejectLeave: async (id, data = {}) => {
    const remark = typeof data === 'string' ? data : (data.remark || data.reason || data.remarks || 'Rejected by Manager');
    const res = await apiClient.put(`/leave/requests/${id}/reject`, { remark, remarks: remark, reason: remark });
    return res.data;
  },

  // PUT /leave/requests/:id/cancel
  cancelLeave: async (id, data = {}) => {
    const res = await apiClient.put(`/leave/requests/${id}/cancel`, data);
    return res.data;
  },

  // Alias for backward compatibility
  getMyLeaves: async (params) => {
    return await leaveHolidayApi.getMyLeaveRequests(params);
  },

  getLeaveRequests: async (params) => {
    return await leaveHolidayApi.getMyLeaveRequests(params);
  },

  getAllLeaveRequests: async (params) => {
    try {
      const res = await apiClient.get('/leave/requests/pending-approval', { params });
      return {
        success: true,
        data: res.data?.pendingRequests || res.data?.data || (Array.isArray(res.data) ? res.data : []),
      };
    } catch {
      return { success: true, data: [] };
    }
  },

  // --- Module 13: Holiday Management ---
  // POST /holidays
  createHoliday: async (data) => {
    const scope = data.scope || (data.branch ? 'BRANCH' : 'COMPANY');
    const reference = data.reference || (scope === 'BRANCH' ? (data.branch || data.branchId) : (data.company || data.companyId));
    const payload = {
      name: data.name?.trim(),
      date: data.date,
      type: data.type || 'FESTIVAL',
      scope,
      reference,
      isOptional: Boolean(data.isOptional),
      isActive: data.isActive !== undefined ? Boolean(data.isActive) : true,
    };
    const res = await apiClient.post('/holidays', payload);
    return res.data;
  },

  // GET /holidays
  getHolidays: async (params = {}) => {
    const queryParams = { ...params };
    if (!queryParams.scope) {
      queryParams.scope = 'COMPANY';
    }
    const res = await apiClient.get('/holidays', { params: queryParams });
    return res.data;
  },

  // PUT /holidays/:id
  updateHoliday: async (id, data) => {
    const scope = data.scope || (data.branch ? 'BRANCH' : 'COMPANY');
    const reference = data.reference || (scope === 'BRANCH' ? (data.branch || data.branchId) : (data.company || data.companyId));
    const payload = {
      name: data.name?.trim(),
      date: data.date,
      type: data.type || 'FESTIVAL',
      scope,
      reference,
      isOptional: Boolean(data.isOptional),
      isActive: data.isActive !== undefined ? Boolean(data.isActive) : true,
    };
    const res = await apiClient.put(`/holidays/${id}`, payload);
    return res.data;
  },

  // DELETE /holidays/:id
  deleteHoliday: async (id) => {
    const res = await apiClient.delete(`/holidays/${id}`);
    return res.data;
  },

  // POST /holidays/copy-from-year
  copyHolidaysFromYear: async (data) => {
    const scope = data.scope || (data.branch ? 'BRANCH' : 'COMPANY');
    const reference = data.reference || (scope === 'BRANCH' ? (data.branch || data.branchId) : (data.company || data.companyId));
    const payload = {
      fromYear: Number(data.fromYear || data.sourceYear),
      toYear: Number(data.toYear || data.targetYear),
      scope,
      reference,
    };
    const res = await apiClient.post('/holidays/copy-from-year', payload);
    return res.data;
  },

  // GET /holidays/check-non-working-day
  checkNonWorkingDay: async (date, employeeId) => {
    const params = { date };
    if (employeeId) params.employeeId = employeeId;
    const res = await apiClient.get('/holidays/check-non-working-day', { params });
    return res.data;
  },

  // GET /holidays/upcoming
  getUpcomingHolidays: async (params) => {
    const res = await apiClient.get('/holidays/upcoming', { params });
    return res.data;
  },

  // --- Module 13: Weekly-Off Configs ---
  // POST /weekly-off-configs
  createWeeklyOffConfig: async (data) => {
    const res = await apiClient.post('/weekly-off-configs', data);
    return res.data;
  },

  // GET /weekly-off-configs
  getWeeklyOffConfigs: async (params) => {
    const res = await apiClient.get('/weekly-off-configs', { params });
    return res.data;
  },

  // PUT /weekly-off-configs/:id
  updateWeeklyOffConfig: async (id, data) => {
    const res = await apiClient.put(`/weekly-off-configs/${id}`, data);
    return res.data;
  },
};

export default leaveHolidayApi;
