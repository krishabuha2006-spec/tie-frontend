import apiClient from './client';

export const timingApi = {
  // Step 1: Create timing & grace rules configuration (POST /api/timing/configs)
  createTimingConfig: async (data) => {
    const res = await apiClient.post('/timing/configs', data);
    return res.data;
  },

  // Get list of active timing rules (GET /api/timing/configs)
  getTimingConfigs: async (params) => {
    const res = await apiClient.get('/timing/configs', { params });
    return res.data;
  },

  // Get single timing config (GET /api/timing/configs/:id)
  getTimingConfigById: async (id) => {
    const res = await apiClient.get(`/timing/configs/${id}`);
    return res.data;
  },

  // Update timing configuration (PUT /api/timing/configs/:id)
  updateTimingConfig: async (id, data) => {
    const res = await apiClient.put(`/timing/configs/${id}`, data);
    return res.data;
  },

  // Deactivate timing configuration (DELETE /api/timing/configs/:id)
  deleteTimingConfig: async (id) => {
    const res = await apiClient.delete(`/timing/configs/${id}`);
    return res.data;
  },

  // Internal evaluation: Check-in (POST /api/timing/attendance-records/:id/evaluate-checkin)
  evaluateCheckIn: async (attendanceRecordId) => {
    const res = await apiClient.post(`/timing/attendance-records/${attendanceRecordId}/evaluate-checkin`);
    return res.data;
  },

  // Internal evaluation: Check-out stay-back (POST /api/timing/attendance-records/:id/evaluate-checkout)
  evaluateCheckOut: async (attendanceRecordId) => {
    const res = await apiClient.post(`/timing/attendance-records/${attendanceRecordId}/evaluate-checkout`);
    return res.data;
  },

  // Step 4: Employee late occurrence history (GET /api/timing/employees/:id/late-occurrences)
  getEmployeeLateOccurrences: async (employeeId, params) => {
    const res = await apiClient.get(`/timing/employees/${employeeId}/late-occurrences`, { params });
    return res.data;
  },

  // Step 4: Employee late count & balance (GET /api/timing/employees/:id/occurrence-count)
  getEmployeeOccurrenceCount: async (employeeId, params) => {
    const res = await apiClient.get(`/timing/employees/${employeeId}/occurrence-count`, { params });
    return res.data;
  },

  // Org-wide late monitoring stream (GET /api/timing/late-occurrences)
  getLateOccurrences: async (params) => {
    const res = await apiClient.get('/timing/late-occurrences', { params });
    return res.data;
  },

  // Step 5: Manual HR Exemption override (PUT /api/timing/late-occurrences/:id/exempt)
  exemptLateOccurrence: async (id, data) => {
    const res = await apiClient.put(`/timing/late-occurrences/${id}/exempt`, data);
    return res.data;
  }
};

export default timingApi;
