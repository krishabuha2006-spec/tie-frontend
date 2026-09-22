import apiClient from './client';

export const faceApi = {
  getFaceStatus: async (employeeId) => {
    if (!employeeId || employeeId === 'undefined' || employeeId === 'null') return { status: 'UNREGISTERED', isRegistered: false };
    try {
      const res = await apiClient.get(`/face/employees/${employeeId}/status`);
      return res.data;
    } catch (err) {
      if (err.response?.status === 404 || err.response?.status === 400) return { status: 'UNREGISTERED', isRegistered: false };
      return { status: 'UNREGISTERED', isRegistered: false };
    }
  },

  // Bulk face status — batched individual calls (5 at a time) to avoid rate limiting
  // Note: no bulk endpoint on backend, so we use efficient batching directly
  getBulkFaceStatus: async (employeeIds) => {
    if (!employeeIds || employeeIds.length === 0) return {};
    const validIds = employeeIds.filter((id) => id && id !== 'undefined' && id !== 'null');
    if (validIds.length === 0) return {};

    const statusMap = {};
    const batchSize = 5;
    for (let i = 0; i < validIds.length; i += batchSize) {
      const batch = validIds.slice(i, i + batchSize);
      const results = await Promise.allSettled(
        batch.map((id) =>
          apiClient.get(`/face/employees/${id}/status`)
            .then((r) => ({ id, data: r.data }))
            .catch(() => ({ id, data: { status: 'UNREGISTERED', isRegistered: false } }))
        )
      );
      results.forEach((r) => {
        if (r.status === 'fulfilled') statusMap[r.value.id] = r.value.data;
      });
      // Small delay between batches to be kind to the backend
      if (i + batchSize < validIds.length) await new Promise((resolve) => setTimeout(resolve, 80));
    }
    return statusMap;
  },

  enrollFace: async (employeeId, faceImages) => {
    if (!employeeId || employeeId === 'undefined') throw new Error('Employee ID required for face enrollment');
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
