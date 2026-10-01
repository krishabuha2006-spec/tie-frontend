import apiClient from './client';

export const timingApi = {
  // 1. POST /timing/configs - Create timing & grace rules configuration
  createTimingConfig: async (data) => {
    const res = await apiClient.post('/timing/configs', data);
    return res.data?.data || res.data;
  },

  // 2. GET /timing/configs - Get All Timing Configurations
  getTimingConfigs: async (params) => {
    const res = await apiClient.get('/timing/configs', { params });
    const raw = res.data?.data || res.data?.configs || (Array.isArray(res.data) ? res.data : []);
    return {
      success: res.data?.success ?? true,
      data: Array.isArray(raw) ? raw : [],
      count: res.data?.count || (Array.isArray(raw) ? raw.length : 0),
    };
  },

  // 3. GET /timing/configs/{id} - Get Timing Configuration by ID
  getTimingConfigById: async (id) => {
    const res = await apiClient.get(`/timing/configs/${id}`);
    return res.data?.data || res.data;
  },

  // 4. PUT /timing/configs/{id} - Update Timing Configuration
  updateTimingConfig: async (id, data) => {
    const res = await apiClient.put(`/timing/configs/${id}`, data);
    return res.data?.data || res.data;
  },

  // 5. DELETE /timing/configs/{id} - Deactivate Timing Configuration
  deleteTimingConfig: async (id) => {
    const res = await apiClient.delete(`/timing/configs/${id}`);
    return res.data?.data || res.data;
  },

  // 6. POST /timing/attendance-records/{attendanceRecordId}/evaluate-checkin - Evaluate Check-In Timing & Grace Rules
  evaluateCheckIn: async (attendanceRecordId) => {
    const res = await apiClient.post(`/timing/attendance-records/${attendanceRecordId}/evaluate-checkin`);
    return res.data?.data || res.data;
  },

  // 7. POST /timing/attendance-records/{attendanceRecordId}/evaluate-checkout - Evaluate Check-Out Stay-Back Exemption
  evaluateCheckOut: async (attendanceRecordId) => {
    const res = await apiClient.post(`/timing/attendance-records/${attendanceRecordId}/evaluate-checkout`);
    return res.data?.data || res.data;
  },

  // 8. GET /timing/employees/{employeeId}/late-occurrences - Get Employee Late Occurrence History
  getEmployeeLateOccurrences: async (employeeId, params) => {
    const res = await apiClient.get(`/timing/employees/${employeeId}/late-occurrences`, { params });
    const raw = res.data?.data || res.data?.lateOccurrences || (Array.isArray(res.data) ? res.data : []);
    return {
      success: res.data?.success ?? true,
      data: Array.isArray(raw) ? raw : [],
      count: res.data?.count || (Array.isArray(raw) ? raw.length : 0),
    };
  },

  // 9. GET /timing/employees/{employeeId}/occurrence-count - Get Employee Late Occurrence Count & Balance
  getEmployeeOccurrenceCount: async (employeeId, params) => {
    const res = await apiClient.get(`/timing/employees/${employeeId}/occurrence-count`, { params });
    return res.data?.data || res.data;
  },

  // 10. GET /timing/late-occurrences - Get Org-Wide Late Occurrences (HR Report Stream)
  getLateOccurrences: async (params) => {
    const res = await apiClient.get('/timing/late-occurrences', { params });
    const raw = res.data?.data || res.data?.lateOccurrences || (Array.isArray(res.data) ? res.data : []);
    return {
      success: res.data?.success ?? true,
      data: Array.isArray(raw) ? raw : [],
      count: res.data?.count || (Array.isArray(raw) ? raw.length : 0),
    };
  },

  // 11. PUT /timing/late-occurrences/{id}/exempt - Manual Administrative Exemption Override
  exemptLateOccurrence: async (id, data) => {
    const res = await apiClient.put(`/timing/late-occurrences/${id}/exempt`, data);
    return res.data?.data || res.data;
  },
};

export default timingApi;
