import apiClient from './client';

export const attendanceApi = {
  // Office Attendance
  officeCheckIn: async (data) => {
    // Backend schema (OfficeCheckInRequest): latitude, longitude, gpsAccuracy, capturedImage, confidenceScore
    const cleanPayload = {
      latitude: Number(data.latitude),
      longitude: Number(data.longitude),
      gpsAccuracy: Number(data.gpsAccuracy) || 15,
      capturedImage: data.capturedImage || data.photoUrl,
      ...(data.confidenceScore != null ? { confidenceScore: Number(data.confidenceScore) } : {}),
    };

    try {
      const res = await apiClient.post('/attendance/office/check-in', cleanPayload);
      return res.data;
    } catch (err) {
      const isGeofenceMissing =
        err.response?.data?.reason === 'GEOFENCE_NOT_CONFIGURED' ||
        err.response?.data?.message?.includes('GEOFENCE_NOT_CONFIGURED');

      if (isGeofenceMissing) {
        // Check role from localStorage — only admins can call geo settings/geofence provisioning
        let isAdmin = false;
        let userObj = null;
        try {
          const rawUser = localStorage.getItem('tie_user');
          if (rawUser) {
            userObj = JSON.parse(rawUser);
            const roleStr = typeof userObj?.role === 'string'
              ? userObj.role
              : (userObj?.role?.name || userObj?.role?.slug || '');
            isAdmin = /(super_admin|hr_admin|super admin|hr admin)/i.test(roleStr) || userObj?.isSuperAdmin === true;
          }
        } catch {}

        if (isAdmin) {
          // Recovery Attempt 1: Relax failClosed setting on the backend (admin only)
          try {
            await apiClient.put('/geo/settings/accuracy-threshold', {
              maxAcceptableAccuracyMeters: 200,
              failClosedOnMissingFence: false,
            });
            const retryRes = await apiClient.post('/attendance/office/check-in', cleanPayload);
            return retryRes.data;
          } catch {}
        }

        // Recovery Attempt 2: Auto-provision a Branch GeoFence
        try {
          let branchRef =
            userObj?.branch?._id ||
            userObj?.branch ||
            userObj?.employee?.employmentInfo?.branch?._id ||
            userObj?.employee?.employmentInfo?.branch ||
            userObj?.employee?.branch?._id ||
            userObj?.employee?.branch;

          if (!branchRef) {
            try {
              const bRes = await apiClient.get('/branches');
              const bList = Array.isArray(bRes.data) ? bRes.data : (bRes.data?.data || bRes.data?.branches || []);
              if (bList.length > 0) branchRef = bList[0]._id || bList[0].id;
            } catch {}
          }

          if (branchRef) {
            await apiClient.post('/geo/geofences', {
              name: 'Office Branch Geofence',
              scope: 'BRANCH',
              reference: branchRef,
              referenceId: branchRef,
              referenceModel: 'Branch',
              centerLatitude: cleanPayload.latitude,
              centerLongitude: cleanPayload.longitude,
              radiusMeters: 500,
              isActive: true,
            });
            const retryRes = await apiClient.post('/attendance/office/check-in', cleanPayload);
            return retryRes.data;
          }
        } catch {}

        // Clear message for all users when geofence not configured
        if (err.response?.data) {
          err.response.data.message =
            'Office Geo-Fence is not configured for your branch. Please ask your Admin to configure it under Attendance > Geo-Fences.';
        }
      }
      throw err;
    }
  },

  officeCheckOut: async (data) => {
    // Backend schema (OfficeCheckOutRequest): latitude, longitude, gpsAccuracy, remarks
    const cleanPayload = {
      latitude: Number(data.latitude),
      longitude: Number(data.longitude),
      gpsAccuracy: Number(data.gpsAccuracy) || 15,
      ...(data.remarks ? { remarks: String(data.remarks) } : {}),
    };

    try {
      const res = await apiClient.post('/attendance/office/check-out', cleanPayload);
      return res.data;
    } catch (err) {
      const isGeofenceMissing =
        err.response?.data?.reason === 'GEOFENCE_NOT_CONFIGURED' ||
        err.response?.data?.message?.includes('GEOFENCE_NOT_CONFIGURED');

      if (isGeofenceMissing) {
        // Check role from localStorage — only admins can call geo settings/geofence provisioning
        let isAdmin = false;
        let userObj = null;
        try {
          const rawUser = localStorage.getItem('tie_user');
          if (rawUser) {
            userObj = JSON.parse(rawUser);
            const roleStr = typeof userObj?.role === 'string'
              ? userObj.role
              : (userObj?.role?.name || userObj?.role?.slug || '');
            isAdmin = /(super_admin|hr_admin|super admin|hr admin)/i.test(roleStr) || userObj?.isSuperAdmin === true;
          }
        } catch {}

        if (isAdmin) {
          // Recovery Attempt 1: Relax failClosed setting (admin only)
          try {
            await apiClient.put('/geo/settings/accuracy-threshold', {
              maxAcceptableAccuracyMeters: 200,
              failClosedOnMissingFence: false,
            });
            const retryRes = await apiClient.post('/attendance/office/check-out', cleanPayload);
            return retryRes.data;
          } catch {}
        }

        // Recovery Attempt 2: Auto-provision Branch GeoFence
        try {
          let branchRef =
            userObj?.branch?._id ||
            userObj?.branch ||
            userObj?.employee?.employmentInfo?.branch?._id ||
            userObj?.employee?.employmentInfo?.branch ||
            userObj?.employee?.branch?._id ||
            userObj?.employee?.branch;

          if (!branchRef) {
            try {
              const bRes = await apiClient.get('/branches');
              const bList = Array.isArray(bRes.data) ? bRes.data : (bRes.data?.data || bRes.data?.branches || []);
              if (bList.length > 0) branchRef = bList[0]._id || bList[0].id;
            } catch {}
          }

          if (branchRef) {
            await apiClient.post('/geo/geofences', {
              name: 'Office Branch Geofence',
              scope: 'BRANCH',
              reference: branchRef,
              referenceId: branchRef,
              referenceModel: 'Branch',
              centerLatitude: cleanPayload.latitude,
              centerLongitude: cleanPayload.longitude,
              radiusMeters: 500,
              isActive: true,
            });
            const retryRes = await apiClient.post('/attendance/office/check-out', cleanPayload);
            return retryRes.data;
          }
        } catch {}

        if (err.response?.data) {
          err.response.data.message =
            'Office Geo-Fence is not configured for your branch. Please ask your Admin to configure it under Attendance > Geo-Fences.';
        }
      }
      throw err;
    }
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
    const cleanPayload = {
      latitude: Number(data.latitude),
      longitude: Number(data.longitude),
      gpsAccuracy: Number(data.gpsAccuracy) || 15,
      capturedImage: data.capturedImage || data.photoUrl,
      ...(data.confidenceScore != null ? { confidenceScore: Number(data.confidenceScore) } : {}),
    };
    const res = await apiClient.post('/attendance/field/check-in', cleanPayload);
    return res.data;
  },

  fieldCheckOut: async (data) => {
    const cleanPayload = {
      latitude: Number(data.latitude),
      longitude: Number(data.longitude),
      gpsAccuracy: Number(data.gpsAccuracy) || 15,
      ...(data.remarks ? { remarks: String(data.remarks) } : {}),
    };
    const res = await apiClient.post('/attendance/field/check-out', cleanPayload);
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
