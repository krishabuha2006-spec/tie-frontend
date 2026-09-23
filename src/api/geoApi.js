import apiClient from './client';

export const geoApi = {
  // Module 5: GeoFence Management
  getGeoFences: async (params) => {
    try {
      const res = await apiClient.get('/geo/geofences', { params });
      return res.data;
    } catch {
      const fallback = await apiClient.get('/geo/fences', { params });
      return fallback.data;
    }
  },

  getGeoFenceById: async (id) => {
    try {
      const res = await apiClient.get(`/geo/geofences/${id}`);
      return res.data;
    } catch {
      const fallback = await apiClient.get(`/geo/fences/${id}`);
      return fallback.data;
    }
  },

  createGeoFence: async (data) => {
    const ref = data.reference || data.referenceId;
    const payload = {
      name: data.name,
      scope: data.scope || 'BRANCH',
      reference: ref,
      referenceId: ref,
      referenceModel: data.referenceModel || (data.scope === 'BRANCH' ? 'Branch' : 'ProjectSite'),
      centerLatitude: Number(data.centerLatitude),
      centerLongitude: Number(data.centerLongitude),
      radiusMeters: Number(data.radiusMeters) || 100,
      isActive: data.isActive !== false,
    };
    try {
      const res = await apiClient.post('/geo/geofences', payload);
      return res.data;
    } catch {
      const fallback = await apiClient.post('/geo/fences', payload);
      return fallback.data;
    }
  },

  updateGeoFence: async (id, data) => {
    try {
      const res = await apiClient.put(`/geo/geofences/${id}`, data);
      return res.data;
    } catch {
      const fallback = await apiClient.put(`/geo/fences/${id}`, data);
      return fallback.data;
    }
  },

  deactivateGeoFence: async (id) => {
    try {
      const res = await apiClient.put(`/geo/geofences/${id}/deactivate`);
      return res.data;
    } catch {
      const fallback = await apiClient.put(`/geo/fences/${id}/deactivate`);
      return fallback.data;
    }
  },

  // Module 5: Core Gate API - Resolve Employee Geo-Location (POST /geo/employees/:employeeId/resolve)
  resolveLocation: async (locationPayload, employeeId = null) => {
    const empId = employeeId || locationPayload.employeeId || locationPayload.employee;
    if (empId) {
      try {
        const res = await apiClient.post(`/geo/employees/${empId}/resolve`, locationPayload);
        return res.data;
      } catch (err) {
        if (err.response?.status !== 404) throw err;
      }
    }
    const res = await apiClient.post('/geo/resolve-location', locationPayload);
    return res.data;
  },

  resolveEmployeeLocation: async (employeeId, locationPayload) => {
    return geoApi.resolveLocation(locationPayload, employeeId);
  },

  // Module 5: Location Audit Logs
  getAllLocationLogs: async (params) => {
    try {
      const res = await apiClient.get('/geo/location-logs', { params });
      return res.data;
    } catch (err) {
      if (err.response?.status === 403 || err.response?.status === 404) {
        return { success: true, data: [], logs: [] };
      }
      try {
        const fallback = await apiClient.get('/geo/logs', { params });
        return fallback.data;
      } catch {
        return { success: true, data: [], logs: [] };
      }
    }
  },

  getEmployeeLocationLogs: async (employeeId, params) => {
    try {
      const res = await apiClient.get(`/geo/employees/${employeeId}/location-logs`, { params });
      return res.data;
    } catch {
      const fallback = await apiClient.get(`/geo/employees/${employeeId}/logs`, { params });
      return fallback.data;
    }
  },

  // Module 5: Maximum Acceptable GPS Accuracy Threshold
  getAccuracySettings: async () => {
    const res = await apiClient.get('/geo/settings/accuracy-threshold');
    return res.data;
  },

  updateAccuracySettings: async (accuracyData) => {
    const payload = typeof accuracyData === 'object' ? {
      maxAcceptableAccuracyMeters: Number(accuracyData.maxAcceptableAccuracyMeters || accuracyData.threshold || 100),
      failClosedOnMissingFence: accuracyData.failClosedOnMissingFence !== undefined ? Boolean(accuracyData.failClosedOnMissingFence) : false,
    } : {
      maxAcceptableAccuracyMeters: Number(accuracyData) || 100,
      failClosedOnMissingFence: false,
    };
    const res = await apiClient.put('/geo/settings/accuracy-threshold', payload);
    return res.data;
  },
};

export default geoApi;
