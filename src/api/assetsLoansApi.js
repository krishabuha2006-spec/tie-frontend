import apiClient from './client';

export const assetsLoansApi = {
  // =========================================================================
  // Module 20: Asset Management & Custody Tracking
  // =========================================================================

  // GET /assets
  getAssets: async (params) => {
    const res = await apiClient.get('/assets', { params });
    return res.data;
  },

  // POST /assets
  createAsset: async (data) => {
    const res = await apiClient.post('/assets', data);
    return res.data;
  },

  // GET /assets/:id
  getAssetById: async (id) => {
    const res = await apiClient.get(`/assets/${id}`);
    return res.data;
  },

  // PUT /assets/:id
  updateAsset: async (id, data) => {
    const res = await apiClient.put(`/assets/${id}`, data);
    return res.data;
  },

  // PUT /assets/:id/retire
  retireAsset: async (id, data = {}) => {
    const res = await apiClient.put(`/assets/${id}/retire`, data);
    return res.data;
  },

  // PUT /assets/:id (Reactivate retired asset)
  reactivateAsset: async (id, data = {}) => {
    const res = await apiClient.put(`/assets/${id}`, {
      currentStatus: 'UNASSIGNED',
      condition: data.condition || 'GOOD',
      ...data,
    });
    return res.data;
  },

  // POST /assets/:assetId/assign
  assignAsset: async (assetId, data) => {
    const payload = {
      employeeId: data.employeeId,
      conditionAtIssue: data.conditionAtIssue || data.condition || data.notes || 'Good working condition',
      ...(data.expectedReturnDate ? { expectedReturnDate: data.expectedReturnDate } : {}),
      ...(data.notes ? { notes: data.notes } : {}),
    };
    const res = await apiClient.post(`/assets/${assetId}/assign`, payload);
    return res.data;
  },

  // GET /assets/:assetId/history
  getAssetHistory: async (assetId) => {
    const res = await apiClient.get(`/assets/${assetId}/history`);
    return res.data;
  },

  // PUT /assets/assignments/:id/return
  returnAssetAssignment: async (assignmentId, data) => {
    const res = await apiClient.put(`/assets/assignments/${assignmentId}/return`, data);
    return res.data;
  },

  // PUT /assets/assignments/:id/report-damage-loss
  reportDamageLoss: async (assignmentId, data) => {
    const res = await apiClient.put(`/assets/assignments/${assignmentId}/report-damage-loss`, data);
    return res.data;
  },

  // PUT /assets/assignments/:id/recovery-decision
  recordRecoveryDecision: async (assignmentId, data) => {
    const res = await apiClient.put(`/assets/assignments/${assignmentId}/recovery-decision`, data);
    return res.data;
  },

  // PUT /assets/assignments/:id/mark-recovered-outside-payroll
  markRecoveredOutsidePayroll: async (assignmentId, data = {}) => {
    const res = await apiClient.put(`/assets/assignments/${assignmentId}/mark-recovered-outside-payroll`, data);
    return res.data;
  },

  // GET /assets/employees/:employeeId/assignments
  getEmployeeAssetAssignments: async (employeeId, params) => {
    const res = await apiClient.get(`/assets/employees/${employeeId}/assignments`, { params });
    return res.data;
  },

  // GET /assets/employees/:employeeId/pending-recovery
  getPendingRecovery: async (employeeId) => {
    const res = await apiClient.get(`/assets/employees/${employeeId}/pending-recovery`);
    return res.data;
  },

  // =========================================================================
  // Module 18: Reimbursements & Expense Claims
  // =========================================================================

  // GET /reimbursement-categories
  getReimbursementCategories: async (params) => {
    const res = await apiClient.get('/reimbursement-categories', { params });
    return res.data;
  },

  // POST /reimbursement-categories
  createReimbursementCategory: async (data) => {
    const res = await apiClient.post('/reimbursement-categories', data);
    return res.data;
  },

  // GET /reimbursement-categories/:id
  getReimbursementCategoryById: async (id) => {
    const res = await apiClient.get(`/reimbursement-categories/${id}`);
    return res.data;
  },

  // PUT /reimbursement-categories/:id
  updateReimbursementCategory: async (id, data) => {
    const res = await apiClient.put(`/reimbursement-categories/${id}`, data);
    return res.data;
  },

  // POST /reimbursements/claims
  createClaim: async (data) => {
    const res = await apiClient.post('/reimbursements/claims', data);
    return res.data;
  },

  // GET /reimbursements/claims/me
  getMyClaims: async (params) => {
    const res = await apiClient.get('/reimbursements/claims/me', { params });
    return res.data;
  },

  // GET /reimbursements/claims/pending-approval
  getPendingApprovalClaims: async (params) => {
    const res = await apiClient.get('/reimbursements/claims/pending-approval', { params });
    return res.data;
  },

  // GET /reimbursements/claims/employees/:employeeId
  getEmployeeClaims: async (employeeId, params) => {
    const res = await apiClient.get(`/reimbursements/claims/employees/${employeeId}`, { params });
    return res.data;
  },

  // GET /reimbursements/claims (All Claims admin)
  getAllClaims: async (params) => {
    try {
      const res = await apiClient.get('/reimbursements/claims', { params });
      return res.data;
    } catch (err) {
      if (err.response?.status === 404 || err.response?.status === 400) {
        try {
          const fbRes = await apiClient.get('/reimbursements/claims/pending-approval', { params });
          return fbRes.data;
        } catch {
          const meRes = await apiClient.get('/reimbursements/claims/me', { params });
          return meRes.data;
        }
      }
      throw err;
    }
  },

  // GET /reimbursements/claims/:id
  getClaimById: async (id) => {
    const res = await apiClient.get(`/reimbursements/claims/${id}`);
    return res.data;
  },

  // PUT /reimbursements/claims/:id/decide
  decideClaim: async (id, decisionData) => {
    const res = await apiClient.put(`/reimbursements/claims/${id}/decide`, decisionData);
    return res.data;
  },

  // PUT /reimbursements/claims/:id/cancel
  cancelClaim: async (id) => {
    const res = await apiClient.put(`/reimbursements/claims/${id}/cancel`);
    return res.data;
  },

  // GET /reimbursements/employees/:employeeId/pending-payroll-inclusion
  getPendingPayrollInclusion: async (employeeId) => {
    const res = await apiClient.get(`/reimbursements/employees/${employeeId}/pending-payroll-inclusion`);
    return res.data;
  },

  // PUT /reimbursements/claims/:id/record-direct-payment
  recordDirectPayment: async (id, data = {}) => {
    const res = await apiClient.put(`/reimbursements/claims/${id}/record-direct-payment`, data);
    return res.data;
  },

  // =========================================================================
  // Module 20: Employee Loans & Advances
  // =========================================================================

  // GET /loan-types
  getLoanTypes: async (params) => {
    const res = await apiClient.get('/loan-types', { params });
    return res.data;
  },

  // POST /loan-types
  createLoanType: async (data) => {
    const res = await apiClient.post('/loan-types', data);
    return res.data;
  },

  // GET /loan-types/:id
  getLoanTypeById: async (id) => {
    const res = await apiClient.get(`/loan-types/${id}`);
    return res.data;
  },

  // PUT /loan-types/:id
  updateLoanType: async (id, data) => {
    const res = await apiClient.put(`/loan-types/${id}`, data);
    return res.data;
  },

  // DELETE /loan-types/:id
  deleteLoanType: async (id) => {
    const res = await apiClient.delete(`/loan-types/${id}`);
    return res.data;
  },

  // GET /loans/requests/me
  getMyLoans: async (params) => {
    try {
      const res = await apiClient.get('/loans/requests/me', { params });
      return res.data;
    } catch (err) {
      if (err.response?.status === 400 || err.response?.status === 404) {
        return { data: [], requests: [] };
      }
      throw err;
    }
  },

  // GET /loans/requests
  getAllLoans: async (params) => {
    try {
      const res = await apiClient.get('/loans/requests', { params });
      return res.data;
    } catch (err) {
      if (err.response?.status === 404 || err.response?.status === 400) {
        try {
          const fbRes = await apiClient.get('/loans/requests/pending-approval', { params });
          return fbRes.data;
        } catch {
          const meRes = await apiClient.get('/loans/requests/me', { params });
          return meRes.data;
        }
      }
      throw err;
    }
  },

  // GET /loans/requests/pending-approval
  getPendingApprovalLoans: async (params) => {
    const res = await apiClient.get('/loans/requests/pending-approval', { params });
    return res.data;
  },

  // GET /loans/requests/employees/:employeeId
  getEmployeeLoans: async (employeeId, params) => {
    const res = await apiClient.get(`/loans/requests/employees/${employeeId}`, { params });
    return res.data;
  },

  // POST /loans/requests
  createLoanRequest: async (data) => {
    const res = await apiClient.post('/loans/requests', data);
    return res.data;
  },

  // GET /loans/requests/:id
  getLoanRequestById: async (id) => {
    const res = await apiClient.get(`/loans/requests/${id}`);
    return res.data;
  },

  // PUT /loans/requests/:id/decide
  decideLoanRequest: async (id, decisionData) => {
    const res = await apiClient.put(`/loans/requests/${id}/decide`, decisionData);
    return res.data;
  },

  // PUT /loans/requests/:id/cancel
  cancelLoanRequest: async (id) => {
    const res = await apiClient.put(`/loans/requests/${id}/cancel`);
    return res.data;
  },

  // POST /loans/requests/:id/disburse (with fallback to PUT)
  disburseLoan: async (id, data = {}) => {
    try {
      const res = await apiClient.post(`/loans/requests/${id}/disburse`, data);
      return res.data;
    } catch (err) {
      if (err.response?.status === 404 || err.response?.status === 405) {
        const fallback = await apiClient.put(`/loans/requests/${id}/disburse`, data);
        return fallback.data;
      }
      throw err;
    }
  },

  // GET /loans/employees/:employeeId/due-emis
  getEmployeeDueEmis: async (employeeId, params) => {
    const res = await apiClient.get(`/loans/employees/${employeeId}/due-emis`, { params });
    return res.data;
  },

  // GET /loans/employees/:employeeId
  getEmployeeAllLoans: async (employeeId, params) => {
    const res = await apiClient.get(`/loans/employees/${employeeId}`, { params });
    return res.data;
  },

  // GET /loans/:id
  getLoanById: async (id) => {
    const res = await apiClient.get(`/loans/${id}`);
    return res.data;
  },

  // GET /loans/:id/emi-schedule
  getLoanEmiSchedule: async (id) => {
    const res = await apiClient.get(`/loans/${id}/emi-schedule`);
    return res.data;
  },

  // PUT /loans/:loanId/emi-schedule/:periodKey/mark-paid
  markEmiPaid: async (loanId, periodKey, data = {}) => {
    const res = await apiClient.put(`/loans/${loanId}/emi-schedule/${periodKey}/mark-paid`, data);
    return res.data;
  },
};

export default assetsLoansApi;
