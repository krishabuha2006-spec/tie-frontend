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
    const empId = data.employeeId || data.employee || (typeof data === 'string' ? data : undefined);
    const payload = {
      employee: empId,
      employeeId: empId,
      assignedTo: empId,
      conditionAtIssue: data.conditionAtIssue || data.condition || data.notes || 'Good working condition',
      condition: data.condition || data.conditionAtIssue || 'GOOD',
      issueDate: new Date().toISOString(),
      ...(data.expectedReturnDate ? { expectedReturnDate: data.expectedReturnDate } : {}),
      ...(data.notes ? { notes: data.notes } : {}),
    };
    try {
      const res = await apiClient.post(`/assets/${assetId}/assign`, payload);
      return res.data;
    } catch (err) {
      if (err.response?.status === 400) {
        // Fallback: minimal clean payload
        try {
          const res2 = await apiClient.post(`/assets/${assetId}/assign`, {
            employee: empId,
            employeeId: empId,
            conditionAtIssue: payload.conditionAtIssue,
          });
          return res2.data;
        } catch {
          const res3 = await apiClient.post(`/assets/${assetId}/assign`, {
            employee: empId,
            condition: 'GOOD',
          });
          return res3.data;
        }
      }
      throw err;
    }
  },

  // GET /assets/:assetId/history
  getAssetHistory: async (assetId) => {
    const res = await apiClient.get(`/assets/${assetId}/history`);
    return res.data;
  },

  // PUT /assets/assignments/:id/return
  returnAssetAssignment: async (assignmentId, data) => {
    const payload = {
      conditionAtReturn: data.conditionAtReturn || data.condition || 'GOOD',
      remarks: data.remarks || data.returnRemarks || '',
      ...data,
    };
    const res = await apiClient.put(`/assets/assignments/${assignmentId}/return`, payload);
    return res.data;
  },

  // PUT /assets/assignments/:id/report-damage-loss
  reportDamageLoss: async (assignmentId, data) => {
    const payload = {
      type: data.type || data.incidentType || 'DAMAGED',
      description: data.description || data.incidentDescription || 'Asset damage reported',
      estimatedCost: Number(data.estimatedCost) || 0,
      ...data,
    };
    const res = await apiClient.put(`/assets/assignments/${assignmentId}/report-damage-loss`, payload);
    return res.data;
  },

  // PUT /assets/assignments/:id/recovery-decision
  recordRecoveryDecision: async (assignmentId, data) => {
    const payload = {
      recoveryApproved: data.recoveryApproved !== undefined ? Boolean(data.recoveryApproved) : true,
      recoveryAmount: Number(data.recoveryAmount) || 0,
      recoveryMode: data.recoveryMode || 'PAYROLL_DEDUCTION',
      decisionRemark: data.decisionRemark || data.remarks || '',
      ...data,
    };
    const res = await apiClient.put(`/assets/assignments/${assignmentId}/recovery-decision`, payload);
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

  // GET /assets/employees/:employeeId/no-due-clearance
  getEmployeeNoDueClearance: async (employeeId) => {
    const res = await apiClient.get(`/assets/employees/${employeeId}/no-due-clearance`);
    return res.data;
  },

  // =========================================================================
  // Module 19: Reimbursements & Expense Claims
  // =========================================================================

  // GET /reimbursement-categories
  getReimbursementCategories: async (params) => {
    const res = await apiClient.get('/reimbursement-categories', { params });
    return res.data;
  },

  // POST /reimbursement-categories
  createReimbursementCategory: async (data) => {
    const payload = {
      name: data.name,
      code: (data.code || data.name || '').toUpperCase().replace(/\s+/g, '_'),
      monthlyCap: Number(data.monthlyCap || data.maxLimit) || 10000,
      isCapHardEnforced: Boolean(data.isCapHardEnforced),
      ...(data.company ? { company: data.company } : {}),
      ...data,
    };
    const res = await apiClient.post('/reimbursement-categories', payload);
    return res.data;
  },

  // GET /reimbursement-categories/:id
  getReimbursementCategoryById: async (id) => {
    const res = await apiClient.get(`/reimbursement-categories/${id}`);
    return res.data;
  },

  // PUT /reimbursement-categories/:id
  updateReimbursementCategory: async (id, data) => {
    const payload = {
      name: data.name,
      code: (data.code || data.name || '').toUpperCase().replace(/\s+/g, '_'),
      monthlyCap: Number(data.monthlyCap || data.maxLimit) || 10000,
      isCapHardEnforced: Boolean(data.isCapHardEnforced),
      isActive: data.isActive !== undefined ? Boolean(data.isActive) : true,
      ...data,
    };
    const res = await apiClient.put(`/reimbursement-categories/${id}`, payload);
    return res.data;
  },

  // POST /reimbursements/claims
  createClaim: async (data) => {
    let payload = data;
    // Map single-line form to multi-line receipt schema if needed
    if (!data.lineItems || data.lineItems.length === 0) {
      payload = {
        disbursementMethod: data.disbursementMethod || data.settlementType || 'PAYROLL',
        ...(data.project ? { project: data.project } : {}),
        lineItems: [
          {
            category: data.category?._id || data.category,
            description: data.description || data.title || 'Out-of-pocket expense claim',
            amount: Number(data.amount) || 0,
            expenseDate: data.expenseDate || new Date().toISOString().split('T')[0],
            receiptUrl: data.receiptUrl || 'https://res.cloudinary.com/demo/image/upload/v1234/receipt1.jpg',
          },
        ],
      };
    } else {
      payload = {
        disbursementMethod: data.disbursementMethod || data.settlementType || 'PAYROLL',
        ...(data.project ? { project: data.project } : {}),
        lineItems: data.lineItems.map((item) => ({
          category: item.category?._id || item.category,
          description: item.description || 'Expense item',
          amount: Number(item.amount) || 0,
          expenseDate: item.expenseDate || new Date().toISOString().split('T')[0],
          receiptUrl: item.receiptUrl || 'https://res.cloudinary.com/demo/image/upload/v1234/receipt1.jpg',
        })),
      };
    }
    const res = await apiClient.post('/reimbursements/claims', payload);
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
    const payload = {
      decision: decisionData.decision || 'APPROVED',
      remark: decisionData.remark || decisionData.remarks || decisionData.decisionRemark || '',
      approvedLineItems: decisionData.approvedLineItems || (decisionData.approvedAmount !== undefined ? [
        {
          lineItemIndex: 0,
          approvedAmount: Number(decisionData.approvedAmount) || 0,
        },
      ] : undefined),
      ...decisionData,
    };
    const res = await apiClient.put(`/reimbursements/claims/${id}/decide`, payload);
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
    const payload = {
      paymentReference: data.paymentReference || data.referenceNumber || `IMPS-${Date.now().toString().slice(-8)}`,
      paidAt: data.paidAt ? new Date(data.paidAt).toISOString() : (data.paymentDate ? new Date(data.paymentDate).toISOString() : new Date().toISOString()),
      ...data,
    };
    const res = await apiClient.put(`/reimbursements/claims/${id}/record-direct-payment`, payload);
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
    const payload = {
      name: data.name,
      category: data.category || 'ADVANCE', // 'ADVANCE' | 'LOAN'
      company: data.company,
      maxAmount: Number(data.maxAmount) || 50000,
      maxTenureMonths: Number(data.maxTenureMonths) || 6,
      interestRatePercent: Number(data.interestRatePercent) || 0,
      minimumServiceMonthsRequired: Number(data.minimumServiceMonthsRequired) || 0,
      isActive: data.isActive !== undefined ? Boolean(data.isActive) : true,
      ...data,
    };
    const res = await apiClient.post('/loan-types', payload);
    return res.data;
  },

  // GET /loan-types/:id
  getLoanTypeById: async (id) => {
    const res = await apiClient.get(`/loan-types/${id}`);
    return res.data;
  },

  // PUT /loan-types/:id
  updateLoanType: async (id, data) => {
    const payload = {
      name: data.name,
      category: data.category || 'ADVANCE',
      company: data.company,
      maxAmount: Number(data.maxAmount) || 50000,
      maxTenureMonths: Number(data.maxTenureMonths) || 6,
      interestRatePercent: Number(data.interestRatePercent) || 0,
      minimumServiceMonthsRequired: Number(data.minimumServiceMonthsRequired) || 0,
      isActive: data.isActive !== undefined ? Boolean(data.isActive) : true,
      ...data,
    };
    const res = await apiClient.put(`/loan-types/${id}`, payload);
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
    const payload = {
      employee: data.employee || data.employeeId,
      loanType: data.loanType || data.loanTypeId,
      requestedAmount: Number(data.requestedAmount !== undefined ? data.requestedAmount : data.amount) || 0,
      requestedTenureMonths: Number(data.requestedTenureMonths !== undefined ? data.requestedTenureMonths : data.tenureMonths) || 12,
      reason: data.reason || data.purpose || 'Salary Advance / Loan Request',
      ...data,
    };
    const res = await apiClient.post('/loans/requests', payload);
    return res.data;
  },

  // GET /loans/requests/:id
  getLoanRequestById: async (id) => {
    const res = await apiClient.get(`/loans/requests/${id}`);
    return res.data;
  },

  // PUT /loans/requests/:id/decide
  decideLoanRequest: async (id, decisionData) => {
    const payload = {
      decision: decisionData.decision || 'APPROVED',
      approvedAmount: Number(decisionData.approvedAmount),
      approvedTenureMonths: Number(decisionData.approvedTenureMonths),
      remark: decisionData.remark || decisionData.remarks || '',
      ...decisionData,
    };
    const res = await apiClient.put(`/loans/requests/${id}/decide`, payload);
    return res.data;
  },

  // PUT /loans/requests/:id/cancel
  cancelLoanRequest: async (id) => {
    const res = await apiClient.put(`/loans/requests/${id}/cancel`);
    return res.data;
  },

  // POST /loans/requests/:id/disburse (with fallback to PUT)
  disburseLoan: async (id, data = {}) => {
    const payload = {
      disbursementReference: data.disbursementReference || data.reference || `BANK-TRF-${Date.now().toString().slice(-8)}`,
      disbursedAt: data.disbursedAt ? new Date(data.disbursedAt).toISOString() : new Date().toISOString(),
      ...data,
    };
    try {
      const res = await apiClient.post(`/loans/requests/${id}/disburse`, payload);
      return res.data;
    } catch (err) {
      if (err.response?.status === 404 || err.response?.status === 405) {
        const fallback = await apiClient.put(`/loans/requests/${id}/disburse`, payload);
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
    const payload = {
      paidInPayrollRun: data.paidInPayrollRun || undefined,
      paidAt: data.paidAt ? new Date(data.paidAt).toISOString() : new Date().toISOString(),
      ...data,
    };
    const res = await apiClient.put(`/loans/${loanId}/emi-schedule/${periodKey}/mark-paid`, payload);
    return res.data;
  },
};

export default assetsLoansApi;
