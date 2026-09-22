import apiClient from './client';

const faceStatusCache = new Map();

export const faceApi = {
  // Clear cache for a specific employee or all
  clearFaceCache: (employeeId = null) => {
    if (employeeId) faceStatusCache.delete(employeeId);
    else faceStatusCache.clear();
  },

  getFaceStatus: async (employeeId) => {
    if (!employeeId || employeeId === 'undefined' || employeeId === 'null') return { status: 'UNREGISTERED', isRegistered: false };
    if (faceStatusCache.has(employeeId)) {
      return faceStatusCache.get(employeeId);
    }
    try {
      const res = await apiClient.get(`/face/employees/${employeeId}/status`);
      faceStatusCache.set(employeeId, res.data);
      return res.data;
    } catch (err) {
      const fallback = { status: 'UNREGISTERED', isRegistered: false };
      faceStatusCache.set(employeeId, fallback);
      return fallback;
    }
  },

  // Bulk face status with in-memory caching — only un-cached IDs trigger network calls
  getBulkFaceStatus: async (employeeIds) => {
    if (!employeeIds || employeeIds.length === 0) return {};
    const validIds = employeeIds.filter((id) => id && id !== 'undefined' && id !== 'null');
    if (validIds.length === 0) return {};

    const statusMap = {};
    const idsToFetch = [];

    validIds.forEach((id) => {
      if (faceStatusCache.has(id)) {
        statusMap[id] = faceStatusCache.get(id);
      } else {
        idsToFetch.push(id);
      }
    });

    if (idsToFetch.length === 0) return statusMap;

    const batchSize = 5;
    for (let i = 0; i < idsToFetch.length; i += batchSize) {
      const batch = idsToFetch.slice(i, i + batchSize);
      const results = await Promise.allSettled(
        batch.map((id) =>
          apiClient.get(`/face/employees/${id}/status`)
            .then((r) => {
              faceStatusCache.set(id, r.data);
              return { id, data: r.data };
            })
            .catch(() => {
              const fallback = { status: 'UNREGISTERED', isRegistered: false };
              faceStatusCache.set(id, fallback);
              return { id, data: fallback };
            })
        )
      );
      results.forEach((r) => {
        if (r.status === 'fulfilled') statusMap[r.value.id] = r.value.data;
      });
      if (i + batchSize < idsToFetch.length) await new Promise((resolve) => setTimeout(resolve, 80));
    }
    return statusMap;
  },

  enrollFace: async (employeeId, faceImages) => {
    if (!employeeId || employeeId === 'undefined') throw new Error('Employee ID required for face enrollment');
    faceStatusCache.delete(employeeId);
    const imagesArray = Array.isArray(faceImages) ? faceImages : [faceImages];
    const res = await apiClient.post(`/face/employees/${employeeId}/enroll`, {
      sampleImages: imagesArray,
      images: imagesArray,
      notes: 'Web Biometric Enrollment',
    });
    return res.data;
  },

  reEnrollFace: async (employeeId, faceImages, notes = 'Web Biometric Re-enrollment') => {
    if (!employeeId || employeeId === 'undefined') throw new Error('Employee ID required for face re-enrollment');
    faceStatusCache.delete(employeeId);
    const imagesArray = Array.isArray(faceImages) ? faceImages : [faceImages];
    const res = await apiClient.put(`/face/employees/${employeeId}/re-enroll`, {
      images: imagesArray,
      sampleImages: imagesArray,
      notes,
    });
    return res.data;
  },

  verifyFace: async (employeeId, capturedImage, triggeredByModule = 'OFFICE') => {
    if (!employeeId || employeeId === 'undefined' || employeeId === 'null') {
      throw new Error('Select an employee before verifying face');
    }
    const res = await apiClient.post(`/face/employees/${employeeId}/verify`, {
      capturedImage,
      triggeredByModule,
    });
    return res.data;
  },

  getEmployeeFaceLogs: async (employeeId, params) => {
    if (!employeeId || employeeId === 'undefined' || employeeId === 'null') return { data: [], logs: [] };
    try {
      const res = await apiClient.get(`/face/employees/${employeeId}/verification-logs`, { params });
      return res.data;
    } catch (err) {
      if (err.response?.status === 404 || err.response?.status === 403) return { data: [], logs: [] };
      return { data: [], logs: [] };
    }
  },

  getAllFaceLogs: async (params) => {
    try {
      const res = await apiClient.get('/face/verification-logs', { params });
      return res.data;
    } catch (err) {
      if (err.response?.status === 403 || err.response?.status === 404) {
        return { success: true, data: [], logs: [] };
      }
      return { success: true, data: [], logs: [] };
    }
  },

  getThresholdSettings: async () => {
    const res = await apiClient.get('/face/settings/threshold');
    return res.data;
  },

  updateThresholdSettings: async (thresholdValue) => {
    const payload = typeof thresholdValue === 'object' ? thresholdValue : { threshold: Number(thresholdValue) };
    const res = await apiClient.put('/face/settings/threshold', payload);
    return res.data;
  },
};

export default faceApi;
