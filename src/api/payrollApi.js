import apiClient from './client';

export const payrollApi = {
  // --- Module 14: Salary Structures ---
  // POST /salary-structures
  createSalaryStructure: async (data) => {
    const res = await apiClient.post('/salary-structures', data);
    return res.data;
  },

  // GET /salary-structures
  getSalaryStructures: async (params) => {
    const res = await apiClient.get('/salary-structures', { params });
    return res.data;
  },

  // GET /salary-structures/:id
  getSalaryStructureById: async (id) => {
    const res = await apiClient.get(`/salary-structures/${id}`);
    return res.data;
  },

  // PUT /salary-structures/:id
  updateSalaryStructure: async (id, data) => {
    const res = await apiClient.put(`/salary-structures/${id}`, data);
    return res.data;
  },

  // DELETE /salary-structures/:id
  deleteSalaryStructure: async (id) => {
    const res = await apiClient.delete(`/salary-structures/${id}`);
    return res.data;
  },

  // --- Module 14: Payroll Runs & Calculation ---
  // POST /payroll/runs
  createPayrollRun: async (data) => {
    const res = await apiClient.post('/payroll/runs', data);
    return res.data;
  },

  // GET /payroll/runs
  getPayrollRuns: async (params) => {
    const res = await apiClient.get('/payroll/runs', { params });
    return res.data;
  },

  // GET /payroll/runs/:id
  getPayrollRunById: async (id) => {
    const res = await apiClient.get(`/payroll/runs/${id}`);
    return res.data;
  },

  // DELETE /payroll/runs/:id
  deletePayrollRun: async (id) => {
    const res = await apiClient.delete(`/payroll/runs/${id}`);
    return res.data;
  },

  // POST /payroll/runs/:id/calculate
  calculatePayrollRun: async (id) => {
    const res = await apiClient.post(`/payroll/runs/${id}/calculate`);
    return res.data;
  },

  // GET /payroll/runs/:id/line-items
  getPayrollLineItems: async (id, params) => {
    const res = await apiClient.get(`/payroll/runs/${id}/line-items`, { params });
    return res.data;
  },

  // GET /payroll/line-items/:id
  getSingleLineItem: async (id) => {
    const res = await apiClient.get(`/payroll/line-items/${id}`);
    return res.data;
  },

  // PUT /payroll/line-items/:id/adjust
  adjustPayrollLineItem: async (id, data) => {
    const res = await apiClient.put(`/payroll/line-items/${id}/adjust`, data);
    return res.data;
  },

  // POST /payroll/runs/:id/submit-for-approval
  submitPayrollForApproval: async (id) => {
    const res = await apiClient.post(`/payroll/runs/${id}/submit-for-approval`);
    return res.data;
  },

  // --- Module 15: Payroll Approvals (CEO & Management) ---
  // POST /payroll-approvals/chain-config
  createApprovalChainConfig: async (data) => {
    const res = await apiClient.post('/payroll-approvals/chain-config', data);
    return res.data;
  },

  // GET /payroll-approvals/chain-config
  getApprovalChainConfigs: async (params) => {
    const res = await apiClient.get('/payroll-approvals/chain-config', { params });
    return res.data;
  },

  // PUT /payroll-approvals/chain-config/:id
  updateApprovalChainConfig: async (id, data) => {
    const res = await apiClient.put(`/payroll-approvals/chain-config/${id}`, data);
    return res.data;
  },

  // GET /payroll-approvals/pending
  getPendingApprovals: async (params) => {
    const res = await apiClient.get('/payroll-approvals/pending', { params });
    return res.data;
  },

  // GET /payroll-approvals/runs/:runId/line-items
  getReviewLineItems: async (runId, params) => {
    const res = await apiClient.get(`/payroll-approvals/runs/${runId}/line-items`, { params });
    return res.data;
  },

  // PUT /payroll-approvals/runs/:runId/decide
  decidePayrollRun: async (runId, decisionData) => {
    try {
      const res = await apiClient.put(`/payroll-approvals/runs/${runId}/decide`, decisionData);
      return res.data;
    } catch (err) {
      if (err.response?.status === 404 || err.response?.status === 405) {
        // Fallback to POST
        const fallback = await apiClient.post(`/payroll-approvals/runs/${runId}/decide`, decisionData);
        return fallback.data;
      }
      throw err;
    }
  },

  // GET /payroll-approvals/runs/:runId/decisions
  getDecisionAuditHistory: async (runId) => {
    const res = await apiClient.get(`/payroll-approvals/runs/${runId}/decisions`);
    return res.data;
  },

  // --- Module 16: Payslip Templates ---
  // POST /payslip-templates
  createPayslipTemplate: async (data) => {
    const res = await apiClient.post('/payslip-templates', data);
    return res.data;
  },

  // GET /payslip-templates
  getPayslipTemplates: async (params) => {
    const res = await apiClient.get('/payslip-templates', { params });
    return res.data;
  },

  // GET /payslip-templates/:id
  getPayslipTemplateById: async (id) => {
    const res = await apiClient.get(`/payslip-templates/${id}`);
    return res.data;
  },

  // PUT /payslip-templates/:id
  updatePayslipTemplate: async (id, data) => {
    const res = await apiClient.put(`/payslip-templates/${id}`, data);
    return res.data;
  },

  // DELETE /payslip-templates/:id
  deletePayslipTemplate: async (id) => {
    const res = await apiClient.delete(`/payslip-templates/${id}`);
    return res.data;
  },

  // --- Module 16: Payslip Generation & Download ---
  // POST /payslips/runs/:payrollRunId/generate
  generatePayslipsForRun: async (payrollRunId) => {
    const res = await apiClient.post(`/payslips/runs/${payrollRunId}/generate`);
    return res.data;
  },

  // POST /payslips/:id/regenerate
  regeneratePayslip: async (id) => {
    const res = await apiClient.post(`/payslips/${id}/regenerate`);
    return res.data;
  },

  // GET /payslips/me
  getMyPayslips: async (params) => {
    const res = await apiClient.get('/payslips/me', { params });
    return res.data;
  },

  // GET /payslips/employees/:employeeId
  getEmployeePayslips: async (employeeId, params) => {
    const res = await apiClient.get(`/payslips/employees/${employeeId}`, { params });
    return res.data;
  },

  // GET /payslips/runs/:payrollRunId
  getPayslipsForRun: async (payrollRunId, params) => {
    const res = await apiClient.get(`/payslips/runs/${payrollRunId}`, { params });
    return res.data;
  },

  // GET /payslips/:id/download
  downloadPayslip: async (id) => {
    const res = await apiClient.get(`/payslips/${id}/download`);
    return res.data;
  },

  // PUT /payslips/:id/delivery-status
  updateDeliveryStatus: async (id, status) => {
    const res = await apiClient.put(`/payslips/${id}/delivery-status`, { deliveryStatus: status });
    return res.data;
  },

  // --- Module 17: Salary Payment Processing ---
  // POST /salary-payments/runs/:payrollRunId/initiate
  initiateSalaryPayments: async (payrollRunId) => {
    const res = await apiClient.post(`/salary-payments/runs/${payrollRunId}/initiate`);
    return res.data;
  },

  // POST /salary-payments/:id/record-leg
  recordPaymentLeg: async (id, legData) => {
    const res = await apiClient.post(`/salary-payments/${id}/record-leg`, legData);
    return res.data;
  },

  // PUT /salary-payments/:id/legs/:legIndex/mark-failed
  markPaymentLegFailed: async (id, legIndex, failureData = {}) => {
    const res = await apiClient.put(`/salary-payments/${id}/legs/${legIndex}/mark-failed`, failureData);
    return res.data;
  },

  // GET /salary-payments/runs/:payrollRunId
  getSalaryPaymentsForRun: async (payrollRunId, params) => {
    const res = await apiClient.get(`/salary-payments/runs/${payrollRunId}`, { params });
    return res.data;
  },

  // GET /salary-payments/employees/:employeeId
  getEmployeeSalaryPayments: async (employeeId, params) => {
    const res = await apiClient.get(`/salary-payments/employees/${employeeId}`, { params });
    return res.data;
  },

  // GET /salary-payments/:id
  getSalaryPaymentById: async (id) => {
    const res = await apiClient.get(`/salary-payments/${id}`);
    return res.data;
  },

  // GET /salary-payments/reports/outstanding
  getOutstandingSalaryPayments: async (params) => {
    const res = await apiClient.get('/salary-payments/reports/outstanding', { params });
    return res.data;
  },
};

export default payrollApi;
