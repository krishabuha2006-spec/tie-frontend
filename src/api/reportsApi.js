import apiClient from './client';

export const reportsApi = {
  // =========================================================================
  // Module 23: HR Reports & Analytics (All 6 Swagger Endpoints)
  // =========================================================================

  // 1. GET /reports/catalog - List available report definitions filtered by caller role permissions
  getReportCatalog: async (params = {}) => {
    const res = await apiClient.get('/reports/catalog', { params });
    return res.data;
  },

  // 2. POST /reports/catalog - Register a new report definition in catalog (Super Admin only)
  createReportDefinition: async (data) => {
    const payload = {
      reportKey: (data.reportKey || data.key || '').toLowerCase().replace(/\s+/g, '-'),
      name: data.name || data.title,
      description: data.description || '',
      category: data.category || 'ATTENDANCE',
      sourceModules: data.sourceModules || ['HRMS'],
      availableFilters: data.availableFilters || ['company', 'branch', 'department', 'from', 'to'],
      supportsExcelExport: data.supportsExcelExport ?? true,
      supportsPdfExport: data.supportsPdfExport ?? true,
      requiredRoles: data.requiredRoles || ['super_admin', 'director', 'hr_admin'],
    };
    const res = await apiClient.post('/reports/catalog', payload);
    return res.data;
  },

  // 3. PUT /reports/catalog/:id - Update an existing report definition in catalog (Super Admin only)
  updateReportDefinition: async (id, data) => {
    const payload = {
      name: data.name || data.title,
      description: data.description,
      availableFilters: data.availableFilters,
      requiredRoles: data.requiredRoles,
      isActive: data.isActive !== undefined ? data.isActive : true,
    };
    const res = await apiClient.put(`/reports/catalog/${id}`, payload);
    return res.data;
  },

  // 4. GET /reports/export-logs - Get audit logs of exported reports
  getExportLogs: async (params = {}) => {
    const res = await apiClient.get('/reports/export-logs', { params });
    return res.data;
  },

  // 5. GET /reports/:reportKey - Execute live report aggregation with declared filters & role scoping
  getReportData: async (reportKey, params = {}) => {
    if (!reportKey) throw new Error('reportKey is required');
    const allowed = ['company', 'branch', 'department', 'project', 'from', 'to', 'year', 'period', 'status'];
    const cleanParams = {};
    if (params) {
      if (params.startDate && !params.from) cleanParams.from = params.startDate;
      if (params.endDate && !params.to) cleanParams.to = params.endDate;
      for (const key of allowed) {
        if (params[key] !== undefined && params[key] !== '' && params[key] !== 'ALL') {
          cleanParams[key] = params[key];
        }
      }
    }
    const res = await apiClient.get(`/reports/${encodeURIComponent(reportKey)}`, { params: cleanParams });
    return res.data;
  },

  // 6. GET /reports/:reportKey/export - Export live aggregated report as XLSX / CSV / PDF stream and record audit log
  exportReport: async (reportKey, params = {}) => {
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
      } else {
        cleanParams.format = 'XLSX';
      }
      for (const key of allowed) {
        if (key !== 'format' && params[key] !== undefined && params[key] !== '' && params[key] !== 'ALL') {
          cleanParams[key] = params[key];
        }
      }
    }
    const res = await apiClient.get(`/reports/${encodeURIComponent(reportKey)}/export`, {
      params: cleanParams,
      responseType: 'blob',
    });
    return {
      data: res.data,
      blob: res.data,
      contentType: res.headers?.['content-type'] || res.data?.type || '',
      headers: res.headers,
    };
  },

  // Cross-module report endpoints (Modules 17, 18, 19, 20)
  getOverdueTasksReport: async (params = {}) => {
    const res = await apiClient.get('/tasks/reports/overdue', { params });
    return res.data;
  },

  getTaskCompletionRateReport: async (params = {}) => {
    const res = await apiClient.get('/tasks/reports/completion-rate', { params });
    return res.data;
  },

  getIncompleteSiteLogsReport: async (params = {}) => {
    const res = await apiClient.get('/site-logs/reports/incomplete', { params });
    return res.data;
  },

  getSiteLogIssuesReport: async (params = {}) => {
    const res = await apiClient.get('/site-logs/reports/issues', { params });
    return res.data;
  },

  getOutstandingSalaryPaymentsReport: async (params = {}) => {
    const res = await apiClient.get('/salary-payments/reports/outstanding', { params });
    return res.data;
  },
};

export default reportsApi;
