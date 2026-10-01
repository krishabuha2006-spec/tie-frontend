import apiClient from './client';

export const holidayApi = {
  // 1. POST /holidays - Create Holiday
  createHoliday: async (data) => {
    const scope = data.scope || (data.branch ? 'BRANCH' : 'COMPANY');
    const reference = data.reference || (scope === 'BRANCH' ? (data.branch || data.branchId) : (data.company || data.companyId));
    const payload = {
      name: data.name?.trim(),
      date: data.date,
      type: data.type || 'FESTIVAL',
      scope,
      reference,
      isOptional: Boolean(data.isOptional),
      isActive: data.isActive !== undefined ? Boolean(data.isActive) : true,
    };
    const res = await apiClient.post('/holidays', payload);
    return res.data;
  },

  // 2. GET /holidays - Get Holidays
  getHolidays: async (params = {}) => {
    const queryParams = { ...params };
    // Default to COMPANY scope if not specified to ensure backend matches records
    if (!queryParams.scope) {
      queryParams.scope = 'COMPANY';
    }
    const res = await apiClient.get('/holidays', { params: queryParams });
    return res.data;
  },

  // 3. PUT /holidays/:id - Update Holiday
  updateHoliday: async (id, data) => {
    const scope = data.scope || (data.branch ? 'BRANCH' : 'COMPANY');
    const reference = data.reference || (scope === 'BRANCH' ? (data.branch || data.branchId) : (data.company || data.companyId));
    const payload = {
      name: data.name?.trim(),
      date: data.date,
      type: data.type || 'FESTIVAL',
      scope,
      reference,
      isOptional: Boolean(data.isOptional),
      isActive: data.isActive !== undefined ? Boolean(data.isActive) : true,
    };
    const res = await apiClient.put(`/holidays/${id}`, payload);
    return res.data;
  },

  // 4. DELETE /holidays/:id - Delete Holiday
  deleteHoliday: async (id) => {
    const res = await apiClient.delete(`/holidays/${id}`);
    return res.data;
  },

  // 5. POST /holidays/copy-from-year - Copy Holidays from Year
  copyHolidaysFromYear: async (data) => {
    const scope = data.scope || (data.branch ? 'BRANCH' : 'COMPANY');
    const reference = data.reference || (scope === 'BRANCH' ? (data.branch || data.branchId) : (data.company || data.companyId));
    const payload = {
      fromYear: Number(data.fromYear || data.sourceYear),
      toYear: Number(data.toYear || data.targetYear),
      scope,
      reference,
    };
    const res = await apiClient.post('/holidays/copy-from-year', payload);
    return res.data;
  },

  // 6. GET /holidays/check-non-working-day - Check Non-Working Day
  checkNonWorkingDay: async (date, employeeId) => {
    const params = { date };
    if (employeeId) params.employeeId = employeeId;
    const res = await apiClient.get('/holidays/check-non-working-day', { params });
    return res.data;
  },

  // 7. GET /holidays/upcoming - Get Upcoming Holidays
  getUpcomingHolidays: async (params) => {
    const res = await apiClient.get('/holidays/upcoming', { params });
    return res.data;
  },

  // 8. POST /weekly-off-configs - Create or Update Weekly-Off Config
  createWeeklyOffConfig: async (data) => {
    const payload = {
      name: data.name || 'Default Weekly Off',
      days: data.days || ['SUNDAY'],
      alternateSaturdays: Boolean(data.alternateSaturdays),
      company: data.company || undefined,
      branch: data.branch || undefined,
      effectiveFrom: data.effectiveFrom || undefined,
    };
    const res = await apiClient.post('/weekly-off-configs', payload);
    return res.data;
  },

  // 9. GET /weekly-off-configs - Get Weekly-Off Configs
  getWeeklyOffConfigs: async (params) => {
    const res = await apiClient.get('/weekly-off-configs', { params });
    return res.data;
  },

  // 10. PUT /weekly-off-configs/:id - Update Weekly-Off Config by ID
  updateWeeklyOffConfig: async (id, data) => {
    const payload = {
      name: data.name || undefined,
      days: data.days || undefined,
      alternateSaturdays: data.alternateSaturdays !== undefined ? Boolean(data.alternateSaturdays) : undefined,
      company: data.company || undefined,
      branch: data.branch || undefined,
      effectiveFrom: data.effectiveFrom || undefined,
    };
    const res = await apiClient.put(`/weekly-off-configs/${id}`, payload);
    return res.data;
  },
};

export default holidayApi;
