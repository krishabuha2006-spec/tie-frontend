import apiClient from './client';

export const attendanceApi = {
  // Office Attendance
  officeCheckIn: async (data) => {
    const res = await apiClient.post('/attendance/office/check-in', data);
    return res.data;
  },

  officeCheckOut: async (data) => {
    const res = await apiClient.post('/attendance/office/check-out', data);
    return res.data;
  },

  getMyOfficeAttendance: async (params) => {
    const res = await apiClient.get('/attendance/office/me', { params });
    return res.data;
  },

  getAllOfficeAttendance: async (params) => {
    try {
      const res = await apiClient.get('/attendance/office', { params });
      return res.data;
    } catch (err) {
      if (err.response?.status === 403) {
        return await attendanceApi.getMyOfficeAttendance(params);
      }
      throw err;
    }
  },

  getEmployeeOfficeAttendance: async (employeeId, params) => {
    const res = await apiClient.get(`/attendance/office/employees/${employeeId}`, { params });
    return res.data;
  },

  // Step 8: Admin Manual Correction
  correctOfficeAttendance: async (id, data) => {
    const res = await apiClient.put(`/attendance/office/${id}/correct`, data);
    return res.data;
  },

  // Field Attendance
  fieldCheckIn: async (data) => {
    const res = await apiClient.post('/attendance/field/check-in', data);
    return res.data;
  },

  fieldCheckOut: async (data) => {
    const res = await apiClient.post('/attendance/field/check-out', data);
    return res.data;
  },

  getMyFieldAttendance: async (params) => {
    try {
      const res = await apiClient.get('/attendance/field/me', { params });
      return res.data;
    } catch (err) {
      if (err.response?.status === 404) return { data: [], records: [] };
      throw err;
    }
  },

  getEmployeeFieldAttendance: async (employeeId, params) => {
    if (!employeeId) return { data: [], records: [] };
    try {
      const res = await apiClient.get(`/attendance/field/employees/${employeeId}`, { params });
      return res.data;
    } catch (err) {
      if (err.response?.status === 404) return { data: [], records: [] };
      throw err;
    }
  },

  getAllFieldAttendance: async (params) => {
    try {
      const res = await apiClient.get('/attendance/field', { params });
      return res.data;
    } catch (err) {
      if (err.response?.status === 403) {
        return await attendanceApi.getMyFieldAttendance(params);
      }
      if (err.response?.status === 404) return { data: [], records: [] };
      throw err;
    }
  },

  correctFieldAttendance: async (id, data) => {
    const res = await apiClient.put(`/attendance/field/${id}/correct`, data);
    return res.data;
  },

  // Site Attendance
  detectSites: async (coords) => {
    const res = await apiClient.post('/attendance/site/detect-sites', coords);
    return res.data;
  },

  siteCheckIn: async (data) => {
    const res = await apiClient.post('/attendance/site/check-in', data);
    return res.data;
  },

  siteCheckOut: async (data) => {
    const res = await apiClient.post('/attendance/site/check-out', data);
    return res.data;
  },

  getMySiteAttendance: async (params) => {
    const res = await apiClient.get('/attendance/site/me', { params });
    return res.data;
  },

  getAllSiteAttendance: async (params) => {
    try {
      const res = await apiClient.get('/attendance/site', { params });
      return res.data;
    } catch (err) {
      if (err.response?.status === 403) {
        return await attendanceApi.getMySiteAttendance(params);
      }
      if (err.response?.status === 404) return { data: [], records: [] };
      throw err;
    }
  },

  getEmployeeSiteAttendance: async (employeeId, params) => {
    const res = await apiClient.get(`/attendance/site/employees/${employeeId}`, { params });
    return res.data;
  },

  correctSiteAttendance: async (id, data) => {
    const res = await apiClient.put(`/attendance/site/${id}/correct`, data);
    return res.data;
  },

  // Regularization (Module 12: POST, GET, PUT /regularization/requests with legacy fallbacks)
  applyRegularization: async (data) => {
    try {
      const res = await apiClient.post('/regularization/requests', data);
      return res.data;
    } catch (err) {
      if (err.response?.status === 404) {
        const fallback = await apiClient.post('/attendance/office/regularize', data);
        return fallback.data;
      }
      throw err;
    }
  },

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

  getAllRegularizations: async (params) => {
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

  approveRegularization: async (id, data) => {
    try {
      const res = await apiClient.put(`/regularization/requests/${id}/approve`, data);
      return res.data;
    } catch (err) {
      if (err.response?.status === 404) {
        const fallback = await apiClient.put(`/attendance/office/regularizations/${id}/approve`, data);
        return fallback.data;
      }
      throw err;
    }
  },

  rejectRegularization: async (id, data) => {
    try {
      const res = await apiClient.put(`/regularization/requests/${id}/reject`, data);
      return res.data;
    } catch (err) {
      if (err.response?.status === 404) {
        const fallback = await apiClient.put(`/attendance/office/regularizations/${id}/reject`, data);
        return fallback.data;
      }
      throw err;
    }
  },

  // Timing Config & Late Occurrences (Module 7)
  createTimingConfig: async (data) => {
    const res = await apiClient.post('/timing/configs', data);
    return res.data;
  },

  getTimingConfigs: async (params) => {
    const res = await apiClient.get('/timing/configs', { params });
    return res.data;
  },

  updateTimingConfig: async (id, data) => {
    const res = await apiClient.put(`/timing/configs/${id}`, data);
    return res.data;
  },

  deleteTimingConfig: async (id) => {
    const res = await apiClient.delete(`/timing/configs/${id}`);
    return res.data;
  },

  getLateOccurrences: async (params) => {
    const res = await apiClient.get('/timing/late-occurrences', { params });
    return res.data;
  },

  getEmployeeLateOccurrences: async (employeeId, params) => {
    const res = await apiClient.get(`/timing/employees/${employeeId}/late-occurrences`, { params });
    return res.data;
  },

  getEmployeeOccurrenceCount: async (employeeId, params) => {
    const res = await apiClient.get(`/timing/employees/${employeeId}/occurrence-count`, { params });
    return res.data;
  },

  exemptLateOccurrence: async (id, data) => {
    const res = await apiClient.put(`/timing/late-occurrences/${id}/exempt`, data);
    return res.data;
  },

  evaluateCheckInTiming: async (id) => {
    const res = await apiClient.post(`/timing/attendance-records/${id}/evaluate-checkin`);
    return res.data;
  },

  evaluateCheckOutTiming: async (id) => {
    const res = await apiClient.post(`/timing/attendance-records/${id}/evaluate-checkout`);
    return res.data;
  },
};

export default attendanceApi;
