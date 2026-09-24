import apiClient from './client';

export const regularizationApi = {
  // Step 1: Submit Attendance Regularization Request (Self)
  applyRegularization: async (data) => {
    const reqCheckIn = data.requestedCheckInTime || (data.proposedCheckInTime ? `${data.attendanceDate}T${data.proposedCheckInTime}:00.000Z` : `${data.attendanceDate}T09:00:00.000Z`);
    const reqCheckOut = data.requestedCheckOutTime || (data.proposedCheckOutTime ? `${data.attendanceDate}T${data.proposedCheckOutTime}:00.000Z` : `${data.attendanceDate}T18:00:00.000Z`);
    const payload = {
      attendanceDate: data.attendanceDate,
      requestedCheckInTime: reqCheckIn,
      requestedCheckOutTime: reqCheckOut,
      reason: data.reason || 'Attendance regularization request',
      attendanceType: data.attendanceType || 'OFFICE',
      requestType: data.requestType || 'WRONG_TIME_RECORDED',
      proposedCheckInTime: data.proposedCheckInTime || data.requestedCheckInTime,
      proposedCheckOutTime: data.proposedCheckOutTime || data.requestedCheckOutTime,
      attendanceRecordId: data.attendanceRecordId || undefined,
    };
    try {
      const res = await apiClient.post('/attendance/office/regularize', payload);
      return res.data;
    } catch (err) {
      if (err.response?.status === 404) {
        const fallback = await apiClient.post('/regularization/requests', payload);
        return fallback.data;
      }
      throw err;
    }
  },

  // Step 2: Get Own Regularization Requests (Self)
  getMyRegularizations: async (params) => {
    try {
      const res = await apiClient.get('/attendance/office/regularizations/me', { params });
      return res.data;
    } catch (err) {
      if (err.response?.status === 404) {
        const fallback = await apiClient.get('/regularization/requests/me', { params });
        return fallback.data;
      }
      throw err;
    }
  },

  // Step 3: Get Pending Regularization Requests for Approval (Management / HR)
  getPendingApprovals: async (params) => {
    try {
      const res = await apiClient.get('/attendance/office/regularizations', { params });
      return res.data;
    } catch (err) {
      if (err.response?.status === 404) {
        const fallback = await apiClient.get('/regularization/requests/pending-approval', { params });
        return fallback.data;
      }
      throw err;
    }
  },

  // Step 4: Get Regularization Requests for a Specific Employee
  getEmployeeRegularizations: async (employeeId, params) => {
    try {
      const res = await apiClient.get(`/attendance/office/regularizations`, { params: { employeeId, ...params } });
      return res.data;
    } catch {
      const fallback = await apiClient.get(`/regularization/requests/employees/${employeeId}`, { params });
      return fallback.data;
    }
  },

  // Step 5: Approve Regularization Request
  approveRegularization: async (id, data = {}) => {
    const text = typeof data === 'string' ? data : (data?.remark || data?.reviewRemarks || 'Approved by manager');
    const payload = { remark: text, reviewRemarks: text };
    try {
      const res = await apiClient.put(`/attendance/office/regularizations/${id}/approve`, payload);
      return res.data;
    } catch (err) {
      if (err.response?.status === 404) {
        const fallback = await apiClient.put(`/regularization/requests/${id}/approve`, payload);
        return fallback.data;
      }
      throw err;
    }
  },

  // Step 6: Reject Regularization Request
  rejectRegularization: async (id, data = {}) => {
    const text = typeof data === 'string' ? data : (data?.remark || data?.reviewRemarks || data?.reason || 'Rejected by manager');
    const payload = { remark: text, reviewRemarks: text };
    try {
      const res = await apiClient.put(`/attendance/office/regularizations/${id}/reject`, payload);
      return res.data;
    } catch (err) {
      if (err.response?.status === 404) {
        const fallback = await apiClient.put(`/regularization/requests/${id}/reject`, payload);
        return fallback.data;
      }
      throw err;
    }
  },

  // Step 7: Cancel Own Regularization Request
  cancelRegularization: async (id, reason) => {
    try {
      const res = await apiClient.put(`/attendance/office/regularizations/${id}/cancel`, {
        reason: reason || 'Cancelled by employee',
      });
      return res.data;
    } catch {
      const fallback = await apiClient.put(`/regularization/requests/${id}/cancel`, {
        reason: reason || 'Cancelled by employee',
      });
      return fallback.data;
    }
  },
};

export default regularizationApi;
