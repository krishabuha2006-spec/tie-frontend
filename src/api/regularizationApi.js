import apiClient from './client';

export const regularizationApi = {
  // Step 1: Submit Attendance Regularization Request (Self) (POST /regularization/requests)
  applyRegularization: async (data) => {
    const reqCheckIn = data.requestedCheckInTime || (data.proposedCheckInTime ? `${data.attendanceDate}T${data.proposedCheckInTime}:00.000Z` : undefined);
    const reqCheckOut = data.requestedCheckOutTime || (data.proposedCheckOutTime ? `${data.attendanceDate}T${data.proposedCheckOutTime}:00.000Z` : undefined);
    const payload = {
      ...data,
      attendanceType: data.attendanceType || 'OFFICE',
      attendanceDate: data.attendanceDate,
      requestType: data.requestType || 'WRONG_TIME_RECORDED',
      proposedCheckInTime: data.proposedCheckInTime || data.requestedCheckInTime,
      proposedCheckOutTime: data.proposedCheckOutTime || data.requestedCheckOutTime,
      requestedCheckInTime: reqCheckIn,
      requestedCheckOutTime: reqCheckOut,
      reason: data.reason,
      attendanceRecordId: data.attendanceRecordId || undefined,
    };
    try {
      const res = await apiClient.post('/regularization/requests', payload);
      return res.data;
    } catch (err) {
      if (err.response?.status === 404) {
        // Fallback to Module 6 office regularization route
        const fallback = await apiClient.post('/attendance/office/regularize', payload);
        return fallback.data;
      }
      throw err;
    }
  },

  // Step 2: Get Own Regularization Requests (Self) (GET /regularization/requests/me)
  getMyRegularizations: async (params) => {
    try {
      const res = await apiClient.get('/regularization/requests/me', { params });
      return res.data;
    } catch (err) {
      if (err.response?.status === 404) {
        const fallback = await apiClient.get('/attendance/office/regularizations/me', { params });
        return fallback.data;
      }
      throw err;
    }
  },

  // Step 3: Get Pending Regularization Requests for Approval (GET /regularization/requests/pending-approval)
  getPendingApprovals: async (params) => {
    try {
      const res = await apiClient.get('/regularization/requests/pending-approval', { params });
      return res.data;
    } catch (err) {
      if (err.response?.status === 404) {
        const fallback = await apiClient.get('/attendance/office/regularizations', { params });
        return fallback.data;
      }
      throw err;
    }
  },

  // Step 4: Get Regularization Requests for a Specific Employee (GET /regularization/requests/employees/:employeeId)
  getEmployeeRegularizations: async (employeeId, params) => {
    const res = await apiClient.get(`/regularization/requests/employees/${employeeId}`, { params });
    return res.data;
  },

  // Step 5: Approve Regularization Request (with Write-Through) (PUT /regularization/requests/:id/approve)
  approveRegularization: async (id, data = {}) => {
    const text = typeof data === 'string' ? data : (data?.remark || data?.reviewRemarks || 'Approved by manager');
    const payload = { remark: text, reviewRemarks: text };
    try {
      const res = await apiClient.put(`/regularization/requests/${id}/approve`, payload);
      return res.data;
    } catch (err) {
      if (err.response?.status === 404) {
        const fallback = await apiClient.put(`/attendance/office/regularizations/${id}/approve`, payload);
        return fallback.data;
      }
      throw err;
    }
  },

  // Step 6: Reject Regularization Request (PUT /regularization/requests/:id/reject)
  rejectRegularization: async (id, data = {}) => {
    const text = typeof data === 'string' ? data : (data?.remark || data?.reviewRemarks || data?.reason || 'Rejected by manager');
    const payload = { remark: text, reviewRemarks: text };
    try {
      const res = await apiClient.put(`/regularization/requests/${id}/reject`, payload);
      return res.data;
    } catch (err) {
      if (err.response?.status === 404) {
        const fallback = await apiClient.put(`/attendance/office/regularizations/${id}/reject`, payload);
        return fallback.data;
      }
      throw err;
    }
  },

  // Step 7: Cancel Own Regularization Request (PUT /regularization/requests/:id/cancel)
  cancelRegularization: async (id, reason) => {
    const res = await apiClient.put(`/regularization/requests/${id}/cancel`, {
      reason: reason || 'Cancelled by employee',
    });
    return res.data;
  },
};

export default regularizationApi;
