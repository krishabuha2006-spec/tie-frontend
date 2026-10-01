import apiClient from './client';

export const geoApi = {
  // 1. POST /geo/geofences - Configure GeoFence (Branch / Project Site)
  createGeoFence: async (data) => {
    const ref = data.reference || data.referenceId;
    const scope = data.scope || 'BRANCH';
    const payload = {
      name: data.name ? data.name.trim() : undefined,
      scope,
      reference: ref,
      referenceId: ref,
      referenceModel: data.referenceModel || (scope === 'BRANCH' ? 'Branch' : 'ProjectSite'),
      centerLatitude: Number(data.centerLatitude),
      centerLongitude: Number(data.centerLongitude),
      radiusMeters: Number(data.radiusMeters) || (scope === 'BRANCH' ? 200 : 500),
      isActive: data.isActive !== false,
    };
    try {
      const res = await apiClient.post('/geo/geofences', payload);
      return res.data?.data || res.data;
    } catch (err) {
      if (err.response?.status === 404) {
        const fallback = await apiClient.post('/geo/fences', payload);
        return fallback.data?.data || fallback.data;
      }
      throw err;
    }
  },

  // 2. GET /geo/geofences - List GeoFences
  getGeoFences: async (params = {}) => {
    try {
      const res = await apiClient.get('/geo/geofences', { params });
      const raw = res.data?.data || res.data?.geofences || res.data?.fences || (Array.isArray(res.data) ? res.data : []);
      return {
        success: res.data?.success ?? true,
        data: Array.isArray(raw) ? raw : [],
        count: res.data?.count || (Array.isArray(raw) ? raw.length : 0),
      };
    } catch (err) {
      try {
        const fallback = await apiClient.get('/geo/fences', { params });
        const raw = fallback.data?.data || fallback.data?.geofences || fallback.data?.fences || (Array.isArray(fallback.data) ? fallback.data : []);
        return {
          success: fallback.data?.success ?? true,
          data: Array.isArray(raw) ? raw : [],
          count: fallback.data?.count || (Array.isArray(raw) ? raw.length : 0),
        };
      } catch {
        return { success: true, data: [], count: 0 };
      }
    }
  },

  // Alias for getGeoFences (camelCase / lower f)
  getGeofences: async function (params = {}) {
    return geoApi.getGeoFences(params);
  },

  // GET /geo/geofences/{id} - Get GeoFence by ID
  getGeoFenceById: async (id) => {
    try {
      const res = await apiClient.get(`/geo/geofences/${id}`);
      return res.data?.data || res.data;
    } catch {
      const fallback = await apiClient.get(`/geo/fences/${id}`);
      return fallback.data?.data || fallback.data;
    }
  },

  // 3. PUT /geo/geofences/{id} - Update GeoFence
  updateGeoFence: async (id, data) => {
    const payload = {
      ...(data.name ? { name: data.name.trim() } : {}),
      ...(data.centerLatitude != null ? { centerLatitude: Number(data.centerLatitude) } : {}),
      ...(data.centerLongitude != null ? { centerLongitude: Number(data.centerLongitude) } : {}),
      ...(data.radiusMeters != null ? { radiusMeters: Number(data.radiusMeters) } : {}),
      ...(data.isActive !== undefined ? { isActive: Boolean(data.isActive) } : {}),
    };
    try {
      const res = await apiClient.put(`/geo/geofences/${id}`, payload);
      return res.data?.data || res.data;
    } catch (err) {
      if (err.response?.status === 404) {
        const fallback = await apiClient.put(`/geo/fences/${id}`, payload);
        return fallback.data?.data || fallback.data;
      }
      throw err;
    }
  },

  // 4. PUT /geo/geofences/{id}/deactivate - Deactivate GeoFence
  deactivateGeoFence: async (id) => {
    try {
      const res = await apiClient.put(`/geo/geofences/${id}/deactivate`);
      return res.data?.data || res.data;
    } catch (err) {
      if (err.response?.status === 404) {
        const fallback = await apiClient.put(`/geo/fences/${id}/deactivate`);
        return fallback.data?.data || fallback.data;
      }
      throw err;
    }
  },

  // 5. POST /geo/employees/{employeeId}/resolve - Resolve Employee Geo-Location (Attendance Gate)
  resolveEmployeeLocation: async (employeeId, locationPayload) => {
    const empId = employeeId || locationPayload?.employeeId || locationPayload?.employee;
    const payload = {
      latitude: Number(locationPayload?.latitude),
      longitude: Number(locationPayload?.longitude),
      gpsAccuracy: locationPayload?.gpsAccuracy != null ? Number(locationPayload.gpsAccuracy) : 15,
      attendanceType: locationPayload?.attendanceType || 'OFFICE',
      ...(locationPayload?.faceVerificationLogId ? { faceVerificationLogId: locationPayload.faceVerificationLogId } : {}),
    };

    if (empId) {
      try {
        const res = await apiClient.post(`/geo/employees/${empId}/resolve`, payload);
        return res.data?.data || res.data;
      } catch (err) {
        if (err.response?.status !== 404) throw err;
      }
    }
    const res = await apiClient.post('/geo/resolve-location', payload);
    return res.data?.data || res.data;
  },

  // Alias for backward compatibility
  resolveLocation: async (locationPayload, employeeId = null) => {
    return geoApi.resolveEmployeeLocation(employeeId, locationPayload);
  },

  // 6. GET /geo/employees/{employeeId}/location-logs - Get Single Employee Location Logs
  getEmployeeLocationLogs: async (employeeId, params = {}) => {
    if (!employeeId || employeeId === 'undefined' || employeeId === 'null') {
      return { success: true, data: [], count: 0, total: 0 };
    }
    try {
      const res = await apiClient.get(`/geo/employees/${employeeId}/location-logs`, { params });
      const raw = res.data?.data || res.data?.locationLogs || res.data?.logs || (Array.isArray(res.data) ? res.data : []);
      return {
        success: res.data?.success ?? true,
        data: Array.isArray(raw) ? raw : [],
        count: res.data?.count || (Array.isArray(raw) ? raw.length : 0),
        total: res.data?.total || (Array.isArray(raw) ? raw.length : 0),
        totalPages: res.data?.totalPages || 1,
        currentPage: res.data?.currentPage || 1,
      };
    } catch (err) {
      try {
        const fallback = await apiClient.get(`/geo/employees/${employeeId}/logs`, { params });
        const raw = fallback.data?.data || fallback.data?.locationLogs || fallback.data?.logs || (Array.isArray(fallback.data) ? fallback.data : []);
        return {
          success: fallback.data?.success ?? true,
          data: Array.isArray(raw) ? raw : [],
          count: fallback.data?.count || (Array.isArray(raw) ? raw.length : 0),
          total: fallback.data?.total || (Array.isArray(raw) ? raw.length : 0),
        };
      } catch {
        return { success: true, data: [], count: 0, total: 0 };
      }
    }
  },

  // 7. GET /geo/location-logs - Get All System Location Logs
  getAllLocationLogs: async (params = {}) => {
    try {
      const res = await apiClient.get('/geo/location-logs', { params });
      const raw = res.data?.data || res.data?.locationLogs || res.data?.logs || (Array.isArray(res.data) ? res.data : []);
      return {
        success: res.data?.success ?? true,
        data: Array.isArray(raw) ? raw : [],
        count: res.data?.count || (Array.isArray(raw) ? raw.length : 0),
        total: res.data?.total || (Array.isArray(raw) ? raw.length : 0),
        totalPages: res.data?.totalPages || 1,
        currentPage: res.data?.currentPage || 1,
      };
    } catch (err) {
      try {
        const fallback = await apiClient.get('/geo/logs', { params });
        const raw = fallback.data?.data || fallback.data?.locationLogs || fallback.data?.logs || (Array.isArray(fallback.data) ? fallback.data : []);
        return {
          success: fallback.data?.success ?? true,
          data: Array.isArray(raw) ? raw : [],
          count: fallback.data?.count || (Array.isArray(raw) ? raw.length : 0),
          total: fallback.data?.total || (Array.isArray(raw) ? raw.length : 0),
        };
      } catch {
        return { success: true, data: [], count: 0, total: 0 };
      }
    }
  },

  // 8. GET /geo/settings/accuracy-threshold - Get Maximum Acceptable GPS Accuracy Threshold
  getAccuracySettings: async () => {
    try {
      const res = await apiClient.get('/geo/settings/accuracy-threshold');
      const data = res.data?.data || res.data || {};
      return {
        success: res.data?.success ?? true,
        maxAcceptableAccuracyMeters: data.maxAcceptableAccuracyMeters != null ? Number(data.maxAcceptableAccuracyMeters) : 100,
        failClosedOnMissingFence: data.failClosedOnMissingFence !== undefined ? Boolean(data.failClosedOnMissingFence) : true,
      };
    } catch {
      return {
        success: true,
        maxAcceptableAccuracyMeters: 100,
        failClosedOnMissingFence: true,
      };
    }
  },

  // 9. PUT /geo/settings/accuracy-threshold - Update Maximum Acceptable GPS Accuracy Threshold
  updateAccuracySettings: async (accuracyData) => {
    const payload = typeof accuracyData === 'object' ? {
      maxAcceptableAccuracyMeters: Number(accuracyData.maxAcceptableAccuracyMeters || accuracyData.threshold || 100),
      failClosedOnMissingFence: accuracyData.failClosedOnMissingFence !== undefined ? Boolean(accuracyData.failClosedOnMissingFence) : false,
    } : {
      maxAcceptableAccuracyMeters: Number(accuracyData) || 100,
      failClosedOnMissingFence: false,
    };
    const res = await apiClient.put('/geo/settings/accuracy-threshold', payload);
    return res.data?.data || res.data;
  },
};

export default geoApi;
