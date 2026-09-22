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

  // Bulk face status — tries a single bulk endpoint first, then falls back to batched individual calls
  getBulkFaceStatus: async (employeeIds) => {
    if (!employeeIds || employeeIds.length === 0) return {};
    const validIds = employeeIds.filter((id) => id && id !== 'undefined' && id !== 'null');
    if (validIds.length === 0) return {};

    // Try bulk endpoint first
    try {
      const res = await apiClient.post('/face/employees/bulk-status', { employeeIds: validIds });
      const data = res.data?.data || res.data || {};
      // Normalize to { [empId]: { isRegistered, status } }
      if (typeof data === 'object' && !Array.isArray(data)) return data;
      if (Array.isArray(data)) {
        const map = {};
        data.forEach((item) => { if (item.employeeId || item._id) map[item.employeeId || item._id] = item; });
        return map;
      }
    } catch {
      // Bulk endpoint not available — fall through to batched individual calls
    }

    // Batched individual calls (5 at a time) to avoid rate limiting
    const statusMap = {};
    const batchSize = 5;
    for (let i = 0; i < validIds.length; i += batchSize) {
      const batch = validIds.slice(i, i + batchSize);
      const results = await Promise.allSettled(
        batch.map((id) => apiClient.get(`/face/employees/${id}/status`).then((r) => ({ id, data: r.data }))
          .catch(() => ({ id, data: { status: 'UNREGISTERED', isRegistered: false } }))
        )
      );
      results.forEach((r) => {
        if (r.status === 'fulfilled') statusMap[r.value.id] = r.value.data;
        else statusMap[r.reason?.id || ''] = { status: 'UNREGISTERED', isRegistered: false };
      });
      // Small delay between batches to avoid overwhelming backend
      if (i + batchSize < validIds.length) await new Promise((res) => setTimeout(res, 100));
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
