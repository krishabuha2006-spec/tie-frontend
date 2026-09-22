import apiClient from './client';

export const reportsApi = {
  // =========================================================================
  // Module 23: HR Reports & Analytics
  // =========================================================================

  // GET /reports/catalog
  getReportCatalog: async (params) => {
    const res = await apiClient.get('/reports/catalog', { params });
    return res.data;
  },

  // POST /reports/catalog
  createReportDefinition: async (data) => {
    const res = await apiClient.post('/reports/catalog', data);
    return res.data;
  },

  // PUT /reports/catalog/:id
  updateReportDefinition: async (id, data) => {
    const res = await apiClient.put(`/reports/catalog/${id}`, data);
    return res.data;
  },

  // GET /reports/export-logs
  getExportLogs: async (params) => {
    const res = await apiClient.get('/reports/export-logs', { params });
    return res.data;
  },

  // GET /reports/:reportKey
  getReportData: async (reportKey, params) => {
    if (!reportKey) throw new Error('reportKey is required');
    const allowed = ['company', 'branch', 'department', 'project', 'from', 'to', 'year', 'period', 'status'];
    const cleanParams = {};
    if (params) {
      if (params.startDate && !params.from) cleanParams.from = params.startDate;
      if (params.endDate && !params.to) cleanParams.to = params.endDate;
      for (const key of allowed) {
        if (params[key] !== undefined && params[key] !== '') {
          cleanParams[key] = params[key];
        }
      }
    }
    try {
      const res = await apiClient.get(`/reports/${encodeURIComponent(reportKey)}`, { params: cleanParams });
      return res.data;
    } catch (err) {
      if (err.response?.status === 400 || err.response?.status === 404) {
        return { success: false, data: null, rows: [] };
      }
      throw err;
    }
  },

  // GET /reports/:reportKey/export
  exportReport: async (reportKey, params) => {
    if (!reportKey) throw new Error('reportKey is required');
    const allowed = ['format', 'company', 'branch', 'department', 'from', 'to'];
    const cleanParams = {};
    if (params) {
      if (params.startDate && !params.from) cleanParams.from = params.startDate;
      if (params.endDate && !params.to) cleanParams.to = params.endDate;
      if (params.format) {
        let fmt = String(params.format).toUpperCase();
        if (fmt === 'EXCEL') fmt = 'XLSX';
        cleanParams.format = fmt;
      }
      for (const key of allowed) {
        if (key !== 'format' && params[key] !== undefined && params[key] !== '') {
          cleanParams[key] = params[key];
        }
      }
    }
    const res = await apiClient.get(`/reports/${encodeURIComponent(reportKey)}/export`, {
      params: cleanParams,
      responseType: 'blob',
    });
    return res.data;
  },
};

export default reportsApi;
