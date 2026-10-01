import apiClient from './client';

/**
 * Normalizes backend responses from both /regularization/requests and legacy /attendance/office/regularizations.
 * Ensures data, regularizations, requests, and pendingRequests all point to the clean array of items.
 */
const normalizeResponse = (resData) => {
  if (!resData) {
    return { success: true, count: 0, total: 0, page: 1, totalPages: 1, data: [], regularizations: [], requests: [], pendingRequests: [] };
  }

  let list = [];
  if (Array.isArray(resData)) {
    list = resData;
  } else if (Array.isArray(resData.regularizations)) {
    list = resData.regularizations;
  } else if (Array.isArray(resData.pendingRequests)) {
    list = resData.pendingRequests;
  } else if (Array.isArray(resData.requests)) {
    list = resData.requests;
  } else if (Array.isArray(resData.data)) {
    list = resData.data;
  } else if (resData.regularization && typeof resData.regularization === 'object') {
    list = [resData.regularization];
  }

  return {
    ...resData,
    success: resData.success !== false,
    count: resData.count ?? list.length,
    total: resData.total ?? list.length,
    page: resData.page ?? 1,
    totalPages: resData.totalPages ?? 1,
    data: list,
    regularizations: list,
    requests: list,
    pendingRequests: list,
  };
};

/**
 * Helper to ensure a date-time value is formatted as a valid ISO string.
 */
const formatToIso = (dateStr, timeVal, defaultHhMm = '09:00') => {
  if (!timeVal) {
    return `${dateStr}T${defaultHhMm}:00.000Z`;
  }
  if (typeof timeVal === 'string' && timeVal.includes('T')) {
    return timeVal;
  }
  if (typeof timeVal === 'string' && /^\d{1,2}:\d{2}/.test(timeVal)) {
    const pad = timeVal.length === 4 ? `0${timeVal}` : timeVal.slice(0, 5);
    return `${dateStr}T${pad}:00.000Z`;
  }
  try {
    const d = new Date(timeVal);
    if (!isNaN(d.getTime())) return d.toISOString();
  } catch {
    // fallback
  }
  return `${dateStr}T${defaultHhMm}:00.000Z`;
};

export const regularizationApi = {
  // Step 1: Submit Attendance Regularization Request (Self) - POST /regularization/requests
  applyRegularization: async (data) => {
    const dateStr = data.attendanceDate || data.date || new Date().toISOString().split('T')[0];
    const proposedIn = data.proposedCheckInTime || data.requestedCheckInTime || '09:00';
    const proposedOut = data.proposedCheckOutTime || data.requestedCheckOutTime || '18:00';

    const inIso = formatToIso(dateStr, proposedIn, '09:00');
    const outIso = formatToIso(dateStr, proposedOut, '18:00');

    const payload = {
      attendanceDate: dateStr,
      attendanceType: data.attendanceType || 'OFFICE',
      requestType: data.requestType || 'WRONG_TIME_RECORDED',
      proposedCheckInTime: inIso,
      proposedCheckOutTime: outIso,
      requestedCheckInTime: inIso,
      requestedCheckOutTime: outIso,
      reason: (data.reason || 'Attendance regularization request').trim(),
    };

    if (data.attendanceRecordId && typeof data.attendanceRecordId === 'string' && data.attendanceRecordId.trim().length === 24) {
      payload.attendanceRecordId = data.attendanceRecordId.trim();
    }

    try {
      const res = await apiClient.post('/regularization/requests', payload);
      const resData = res.data;
      return {
        ...resData,
        data: resData.regularization || resData.data || resData,
      };
    } catch (err) {
      if (err.response?.status === 404) {
        // Fallback for office regularization endpoint
        const fallback = await apiClient.post('/attendance/office/regularize', payload);
        return {
          ...fallback.data,
          data: fallback.data.regularization || fallback.data.data || fallback.data,
        };
      }
      throw err;
    }
  },

  // Step 2: Get Own Regularization Requests (Self) - GET /regularization/requests/me
  getMyRegularizations: async (params) => {
    try {
      const res = await apiClient.get('/regularization/requests/me', { params });
      return normalizeResponse(res.data);
    } catch (err) {
      if (err.response?.status === 404) {
        try {
          const fallback = await apiClient.get('/attendance/office/regularizations/me', { params });
          return normalizeResponse(fallback.data);
        } catch {
          return normalizeResponse({ success: true, regularizations: [] });
        }
      }
      if (err.response?.status === 400 || err.response?.status === 403) {
        return normalizeResponse({ success: true, regularizations: [] });
      }
      throw err;
    }
  },

  // Step 3: Get Pending Regularization Requests for Approval - GET /regularization/requests/pending-approval
  getPendingApprovals: async (params) => {
    try {
      const res = await apiClient.get('/regularization/requests/pending-approval', { params });
      return normalizeResponse(res.data);
    } catch (err) {
      if (err.response?.status === 404 || err.response?.status === 403) {
        try {
          const fallback = await apiClient.get('/attendance/office/regularizations', {
            params: { status: 'PENDING', ...params }
          });
          return normalizeResponse(fallback.data);
        } catch {
          return normalizeResponse({ success: true, pendingRequests: [] });
        }
      }
      if (err.response?.status === 400) {
        return normalizeResponse({ success: true, pendingRequests: [] });
      }
      throw err;
    }
  },

  // Step 4: Get Regularization Requests for a Specific Employee - GET /regularization/requests/employees/:employeeId
  getEmployeeRegularizations: async (employeeId, params) => {
    if (!employeeId) return normalizeResponse({ success: true, regularizations: [] });
    try {
      const res = await apiClient.get(`/regularization/requests/employees/${employeeId}`, { params });
      return normalizeResponse(res.data);
    } catch (err) {
      if (err.response?.status === 404 || err.response?.status === 403) {
        try {
          const fallback = await apiClient.get('/attendance/office/regularizations', {
            params: { employeeId, ...params }
          });
          return normalizeResponse(fallback.data);
        } catch {
          return normalizeResponse({ success: true, regularizations: [] });
        }
      }
      if (err.response?.status === 400) {
        return normalizeResponse({ success: true, regularizations: [] });
      }
      throw err;
    }
  },

  // Step 5: Get All Regularizations (Admin/HR View) - GET /attendance/office/regularizations
  getAllRegularizations: async (params) => {
    try {
      const res = await apiClient.get('/attendance/office/regularizations', { params });
      return normalizeResponse(res.data);
    } catch (err) {
      if (err.response?.status === 404 || err.response?.status === 403) {
        try {
          const fallback = await apiClient.get('/regularization/requests/pending-approval', { params });
          return normalizeResponse(fallback.data);
        } catch {
          return normalizeResponse({ success: true, regularizations: [] });
        }
      }
      if (err.response?.status === 400) {
        return normalizeResponse({ success: true, regularizations: [] });
      }
      throw err;
    }
  },

  // Step 6: Approve Regularization Request (with Write-Through) - PUT /regularization/requests/:id/approve
  approveRegularization: async (id, data = {}) => {
    const text = typeof data === 'string' ? data : (data?.remark || data?.reviewRemarks || data?.remarks || 'Approved by authorized manager');
    const payload = {
      remark: text,
      reviewRemarks: text,
      remarks: text,
    };
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

  // Step 7: Reject Regularization Request - PUT /regularization/requests/:id/reject
  rejectRegularization: async (id, data = {}) => {
    const text = typeof data === 'string' ? data : (data?.remark || data?.reviewRemarks || data?.remarks || data?.reason || 'Rejected after review');
    const payload = {
      remark: text,
      reviewRemarks: text,
      remarks: text,
      reason: text,
    };
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

  // Step 8: Cancel Own Regularization Request - PUT /regularization/requests/:id/cancel
  cancelRegularization: async (id, reason = 'Withdrawn by employee') => {
    const payload = { reason };
    try {
      const res = await apiClient.put(`/regularization/requests/${id}/cancel`, payload);
      return res.data;
    } catch (err) {
      if (err.response?.status === 404) {
        const fallback = await apiClient.put(`/attendance/office/regularizations/${id}/cancel`, payload);
        return fallback.data;
      }
      throw err;
    }
  },
};

export default regularizationApi;
