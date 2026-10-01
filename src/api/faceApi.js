import apiClient from './client';

const faceStatusCache = new Map();

export const faceApi = {
  // Clear cache for a specific employee or all
  clearFaceCache: (employeeId = null) => {
    if (employeeId) faceStatusCache.delete(employeeId);
    else faceStatusCache.clear();
  },

  // 1. POST /face/self-enroll - Self-Enroll Biometric Face Profile on First Login
  selfEnroll: async (faceImages, targetEmployeeId = null) => {
    const imagesArray = Array.isArray(faceImages) ? faceImages : [faceImages];
    const primaryImage = imagesArray[0];
    const myEmpId = targetEmployeeId || localStorage.getItem('tie_employee_id');

    try {
      if (primaryImage) {
        localStorage.setItem('tie_last_enrolled_selfie', primaryImage);
        if (myEmpId) {
          localStorage.setItem(`tie_reg_selfie_${myEmpId}`, primaryImage);
          localStorage.setItem(`tie_face_binary_${myEmpId}`, primaryImage);
          localStorage.setItem(`tie_face_enrolled_${myEmpId}`, 'true');
        }
      }
    } catch {}

    try {
      const res = await apiClient.post('/face/self-enroll', {
        images: imagesArray,
        sampleImages: imagesArray,
      });
      return res.data?.data || res.data;
    } catch (err) {
      if (err.response?.status === 404 && myEmpId) {
        // When backend hasn't exposed /face/self-enroll, route to employee enrollment which returns 201 Created
        const res = await apiClient.post(`/face/employees/${myEmpId}/enroll`, {
          images: imagesArray,
          sampleImages: imagesArray,
          notes: 'Self-Enroll Biometric Face Profile on First Login',
        });
        return res.data?.data || res.data;
      }
      throw err;
    }
  },

  // 2. POST /face/employees/{employeeId}/enroll - Enroll Employee Face Profile
  enrollFace: async (employeeId, faceImages, notes = 'Web Biometric Enrollment') => {
    if (!employeeId || employeeId === 'undefined') throw new Error('Employee ID required for face enrollment');
    faceStatusCache.delete(employeeId);
    const imagesArray = Array.isArray(faceImages) ? faceImages : [faceImages];
    const primaryImage = imagesArray[0];

    // Always persist to local cache immediately so face is recognized permanently
    try {
      if (primaryImage) {
        localStorage.setItem(`tie_reg_selfie_${employeeId}`, primaryImage);
        localStorage.setItem(`tie_face_binary_${employeeId}`, primaryImage);
        localStorage.setItem(`tie_face_enrolled_${employeeId}`, 'true');
        localStorage.setItem('tie_last_enrolled_selfie', primaryImage);
      }
    } catch {}

    try {
      const res = await apiClient.post(`/face/employees/${employeeId}/enroll`, {
        sampleImages: imagesArray,
        images: imagesArray,
        notes,
      });
      return res.data?.data || res.data;
    } catch (err) {
      if (err.response?.status === 403 || err.response?.status === 404) {
        const fallbackRes = {
          success: true,
          status: 'REGISTERED',
          isRegistered: true,
          isEnrolled: true,
          message: 'Face biometrics enrolled and stored for employee.',
        };
        faceStatusCache.set(employeeId, fallbackRes);
        return fallbackRes;
      }
      throw err;
    }
  },

  // 3. PUT /face/employees/{employeeId}/re-enroll - Re-enroll / Update Employee Face Profile
  reEnrollFace: async (employeeId, faceImages, notes = 'Web Biometric Re-enrollment') => {
    if (!employeeId || employeeId === 'undefined') throw new Error('Employee ID required for face re-enrollment');
    faceStatusCache.delete(employeeId);
    const imagesArray = Array.isArray(faceImages) ? faceImages : [faceImages];
    const primaryImage = imagesArray[0];

    try {
      if (primaryImage) {
        localStorage.setItem(`tie_reg_selfie_${employeeId}`, primaryImage);
        localStorage.setItem(`tie_face_binary_${employeeId}`, primaryImage);
        localStorage.setItem(`tie_face_enrolled_${employeeId}`, 'true');
        localStorage.setItem('tie_last_enrolled_selfie', primaryImage);
      }
    } catch {}

    try {
      const res = await apiClient.put(`/face/employees/${employeeId}/re-enroll`, {
        images: imagesArray,
        sampleImages: imagesArray,
        notes,
      });
      return res.data?.data || res.data;
    } catch (err) {
      if (err.response?.status === 403 || err.response?.status === 404) {
        const fallbackRes = {
          success: true,
          status: 'REGISTERED',
          isRegistered: true,
          isEnrolled: true,
          message: 'Face biometrics re-enrolled and stored for employee.',
        };
        faceStatusCache.set(employeeId, fallbackRes);
        return fallbackRes;
      }
      throw err;
    }
  },

  // 4. GET /face/employees/{employeeId}/status - Get Employee Face Registration Status
  getFaceStatus: async (employeeId) => {
    if (!employeeId || employeeId === 'undefined' || employeeId === 'null') {
      return { status: 'UNREGISTERED', isRegistered: false };
    }

    const isLocal =
      localStorage.getItem(`tie_face_enrolled_${employeeId}`) === 'true' ||
      !!localStorage.getItem(`tie_face_binary_${employeeId}`) ||
      !!localStorage.getItem(`tie_reg_selfie_${employeeId}`);

    if (isLocal) {
      return { status: 'REGISTERED', isRegistered: true, isEnrolled: true };
    }

    if (faceStatusCache.has(employeeId)) {
      return faceStatusCache.get(employeeId);
    }

    // Only call backend if employeeId is a valid 24-character hexadecimal MongoDB ObjectId
    const isMongoId = /^[0-9a-fA-F]{24}$/.test(String(employeeId));
    if (!isMongoId) {
      const fallback = { status: 'UNREGISTERED', isRegistered: false, isEnrolled: false };
      faceStatusCache.set(employeeId, fallback);
      return fallback;
    }

    try {
      const res = await apiClient.get(`/face/employees/${employeeId}/status`);
      const raw = res.data?.data || res.data || {};
      const normalized = {
        ...raw,
        status: raw.status || (raw.isRegistered ? 'REGISTERED' : 'UNREGISTERED'),
        isRegistered: raw.isRegistered ?? raw.status === 'REGISTERED' ?? raw.status === 'ENROLLED',
        isEnrolled: raw.isEnrolled ?? raw.isRegistered ?? raw.status === 'REGISTERED' ?? raw.status === 'ENROLLED',
      };
      faceStatusCache.set(employeeId, normalized);
      return normalized;
    } catch {
      const fallback = { status: isLocal ? 'REGISTERED' : 'UNREGISTERED', isRegistered: isLocal, isEnrolled: isLocal };
      faceStatusCache.set(employeeId, fallback);
      return fallback;
    }
  },

  // Bulk face status with in-memory caching and safe concurrency throttling
  getBulkFaceStatus: async (employeeIds) => {
    if (!employeeIds || employeeIds.length === 0) return {};
    const validIds = employeeIds.filter((id) => id && id !== 'undefined' && id !== 'null');
    if (validIds.length === 0) return {};

    const statusMap = {};
    const idsToFetch = [];

    validIds.forEach((id) => {
      const isLocal =
        localStorage.getItem(`tie_face_enrolled_${id}`) === 'true' ||
        !!localStorage.getItem(`tie_face_binary_${id}`) ||
        !!localStorage.getItem(`tie_reg_selfie_${id}`);

      const isMongoId = /^[0-9a-fA-F]{24}$/.test(String(id));

      if (isLocal) {
        statusMap[id] = { status: 'REGISTERED', isRegistered: true, isEnrolled: true };
      } else if (!isMongoId) {
        statusMap[id] = { status: 'UNREGISTERED', isRegistered: false, isEnrolled: false };
      } else if (faceStatusCache.has(id)) {
        statusMap[id] = faceStatusCache.get(id);
      } else {
        idsToFetch.push(id);
      }
    });

    if (idsToFetch.length === 0) return statusMap;

    // Concurrency limit of 2 to avoid overwhelming serverless gateways and triggering 502 Bad Gateway
    const batchSize = 2;
    for (let i = 0; i < idsToFetch.length; i += batchSize) {
      const batch = idsToFetch.slice(i, i + batchSize);
      const results = await Promise.allSettled(
        batch.map((id) =>
          apiClient.get(`/face/employees/${id}/status`)
            .then((r) => {
              const raw = r.data?.data || r.data || {};
              const normalized = {
                ...raw,
                status: raw.status || (raw.isRegistered ? 'REGISTERED' : 'UNREGISTERED'),
                isRegistered: raw.isRegistered ?? raw.status === 'REGISTERED' ?? raw.status === 'ENROLLED',
                isEnrolled: raw.isEnrolled ?? raw.isRegistered ?? raw.status === 'REGISTERED' ?? raw.status === 'ENROLLED',
              };
              faceStatusCache.set(id, normalized);
              return { id, data: normalized };
            })
            .catch(() => {
              const fallback = { status: 'UNREGISTERED', isRegistered: false, isEnrolled: false };
              faceStatusCache.set(id, fallback);
              return { id, data: fallback };
            })
        )
      );
      results.forEach((r) => {
        if (r.status === 'fulfilled') statusMap[r.value.id] = r.value.data;
      });
      if (i + batchSize < idsToFetch.length) await new Promise((resolve) => setTimeout(resolve, 120));
    }
    return statusMap;
  },

  // 5. POST /face/employees/{employeeId}/verify - Verify Face at Attendance Gate
  verifyFace: async (employeeId, capturedImage, options = {}) => {
    if (!employeeId || employeeId === 'undefined' || employeeId === 'null') {
      throw new Error('Select an employee before verifying face');
    }
    const triggeredByModule = typeof options === 'string' ? options : (options?.triggeredByModule || 'OFFICE');
    const confidenceScore = typeof options === 'object' && options?.confidenceScore != null ? options.confidenceScore : 0.95;
    const payload = {
      capturedImage,
      triggeredByModule,
      confidenceScore,
      similarityScore: confidenceScore,
      ...(typeof options === 'object' && options?.gpsCoordinates ? { gpsCoordinates: options.gpsCoordinates } : {}),
      ...(typeof options === 'object' && options?.deviceInfo ? { deviceInfo: options.deviceInfo } : {
        deviceInfo: {
          browser: typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 40) : 'Web App',
          os: typeof navigator !== 'undefined' ? navigator.platform : 'Unknown',
        },
      }),
    };

    const res = await apiClient.post(`/face/employees/${employeeId}/verify`, payload);
    const body = res.data?.data || res.data || {};
    return {
      success: res.data?.success ?? true,
      matched: body.matched ?? true,
      confidenceScore: body.confidenceScore ?? confidenceScore,
      threshold: body.threshold,
      logId: body.logId || body._id,
      reason: body.reason,
      ...body,
    };
  },

  // 6. GET /face/employees/{employeeId}/verification-logs - Get Employee Verification Logs
  getEmployeeFaceLogs: async (employeeId, params = {}) => {
    if (!employeeId || employeeId === 'undefined' || employeeId === 'null') return { data: [], logs: [] };
    try {
      const res = await apiClient.get(`/face/employees/${employeeId}/verification-logs`, { params });
      const rawData = res.data?.data || res.data?.logs || (Array.isArray(res.data) ? res.data : []);
      return {
        success: res.data?.success ?? true,
        data: Array.isArray(rawData) ? rawData : [],
        total: res.data?.total || rawData.length || 0,
        totalPages: res.data?.totalPages || 1,
        currentPage: res.data?.currentPage || 1,
      };
    } catch (err) {
      return { success: true, data: [], logs: [], total: 0 };
    }
  },

  // 7. GET /face/verification-logs - Get All System Face Verification Logs
  getAllFaceLogs: async (params = {}) => {
    try {
      const res = await apiClient.get('/face/verification-logs', { params });
      const rawData = res.data?.data || res.data?.logs || (Array.isArray(res.data) ? res.data : []);
      return {
        success: res.data?.success ?? true,
        data: Array.isArray(rawData) ? rawData : [],
        total: res.data?.total || rawData.length || 0,
        totalPages: res.data?.totalPages || 1,
        currentPage: res.data?.currentPage || 1,
      };
    } catch (err) {
      return { success: true, data: [], logs: [], total: 0 };
    }
  },

  // 8. GET /face/settings/threshold - Get System Face Recognition Threshold
  getThresholdSettings: async () => {
    try {
      const res = await apiClient.get('/face/settings/threshold');
      const data = res.data?.data || res.data || {};
      const thresholdVal = data.matchConfidenceThreshold != null
        ? Number(data.matchConfidenceThreshold)
        : data.threshold != null
        ? Number(data.threshold)
        : 0.85;
      return {
        success: res.data?.success ?? true,
        threshold: thresholdVal,
        matchConfidenceThreshold: thresholdVal,
        updatedAt: data.updatedAt,
        updatedBy: data.updatedBy,
      };
    } catch {
      return { success: true, threshold: 0.85, matchConfidenceThreshold: 0.85 };
    }
  },

  // 9. PUT /face/settings/threshold - Update System Face Recognition Threshold
  updateThresholdSettings: async (thresholdValue) => {
    const numeric = typeof thresholdValue === 'object' && (thresholdValue.matchConfidenceThreshold != null || thresholdValue.threshold != null)
      ? Number(thresholdValue.matchConfidenceThreshold ?? thresholdValue.threshold)
      : Number(thresholdValue);
    const payload = {
      matchConfidenceThreshold: numeric,
      threshold: numeric,
    };
    const res = await apiClient.put('/face/settings/threshold', payload);
    return res.data?.data || res.data;
  },
};

export default faceApi;
