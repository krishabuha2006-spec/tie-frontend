import apiClient from './client';

export const faceApi = {
  getFaceStatus: async (employeeId) => {
    if (!employeeId || employeeId === 'undefined' || employeeId === 'null') return { status: 'UNREGISTERED' };
    try {
      const res = await apiClient.get(`/face/employees/${employeeId}/status`);
      return res.data;
    } catch (err) {
      if (err.response?.status === 404) return { status: 'UNREGISTERED' };
      throw err;
    }
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
    if (!employeeId || employeeId === 'undefined') return { data: [], logs: [] };
    try {
      const res = await apiClient.get(`/face/employees/${employeeId}/verification-logs`, { params });
      return res.data;
    } catch (err) {
      if (err.response?.status === 404) return { data: [], logs: [] };
      throw err;
    }
  },

  getAllFaceLogs: async (params) => {
    const res = await apiClient.get('/face/verification-logs', { params });
    return res.data;
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
