import apiClient from './client';

export const lifecycleApi = {
  // =========================================================================
  // Module 22: Employee Lifecycle Management (All 12 Swagger Endpoints)
  // =========================================================================

  // 1. POST /lifecycle-events/confirmation - Initiate employee confirmation workflow at end of probation
  initiateConfirmation: async (data) => {
    const payload = {
      employeeId: data.employeeId,
      effectiveDate: data.effectiveDate,
      supportingDocuments: data.supportingDocuments || [],
    };
    const res = await apiClient.post('/lifecycle-events/confirmation', payload);
    return res.data;
  },

  // 2. POST /lifecycle-events/promotion - Initiate employee promotion (designation & salary structure change)
  initiatePromotion: async (data) => {
    const payload = {
      employeeId: data.employeeId,
      newDesignation: data.newDesignation,
      newSalaryStructure: data.newSalaryStructure || undefined,
      effectiveFromPayrollPeriod: data.effectiveFromPayrollPeriod || undefined,
      effectiveDate: data.effectiveDate,
      supportingDocuments: data.supportingDocuments || [],
    };
    const res = await apiClient.post('/lifecycle-events/promotion', payload);
    return res.data;
  },

  // 3. POST /lifecycle-events/transfer - Initiate employee transfer (branch / department relocation)
  initiateTransfer: async (data) => {
    const payload = {
      employeeId: data.employeeId,
      newBranch: data.newBranch,
      newDepartment: data.newDepartment || undefined,
      transferReason: data.transferReason || data.reason || 'Operational relocation',
      effectiveDate: data.effectiveDate,
      supportingDocuments: data.supportingDocuments || [],
    };
    const res = await apiClient.post('/lifecycle-events/transfer', payload);
    return res.data;
  },

  // 4. POST /lifecycle-events/exit - Initiate employee exit (resignation / termination) and generate live clearance checklist
  initiateExit: async (data) => {
    const payload = {
      employeeId: data.employeeId,
      exitReason: data.exitReason || data.exitType || 'RESIGNATION',
      resignationDate: data.resignationDate || new Date().toISOString().split('T')[0],
      lastWorkingDay: data.lastWorkingDay || new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
      supportingDocuments: data.supportingDocuments || [],
    };
    const res = await apiClient.post('/lifecycle-events/exit', payload);
    return res.data;
  },

  // 5. PUT /lifecycle-events/:id/decide - Record approval decision for Confirmation, Promotion, or Transfer
  decideLifecycleEvent: async (id, decisionData) => {
    const payload = {
      decision: decisionData.decision,
      extendedByMonths: decisionData.extendedByMonths ? Number(decisionData.extendedByMonths) : undefined,
      remark: decisionData.remark || decisionData.remarks || '',
    };
    const res = await apiClient.put(`/lifecycle-events/${id}/decide`, payload);
    return res.data;
  },

  // 6. GET /lifecycle-events/:id/checklist - Get live re-evaluated exit checklist across Modules 18, 20, 17, 12, 2
  getExitChecklist: async (id) => {
    const res = await apiClient.get(`/lifecycle-events/${id}/checklist`);
    return res.data;
  },

  // 7. PUT /lifecycle-events/:id/checklist/:itemKey/confirm - Confirm a manual non-auto-verifiable checklist item
  confirmChecklistItem: async (id, itemKey, data = {}) => {
    const res = await apiClient.put(`/lifecycle-events/${id}/checklist/${itemKey}/confirm`, data);
    return res.data;
  },

  // 8. PUT /lifecycle-events/:id/finalize-exit - Finalize employee exit, write employeeStatus=EXITED, revoke login, calculate FNF
  finalizeExit: async (id, data = {}) => {
    const res = await apiClient.put(`/lifecycle-events/${id}/finalize-exit`, data);
    return res.data;
  },

  // 9. GET /lifecycle-events/me - Get own lifecycle events history (Self-Service)
  getMyLifecycleEvents: async (params) => {
    try {
      const res = await apiClient.get('/lifecycle-events/me', { params });
      return res.data;
    } catch (err) {
      if (err.response?.status === 400 || err.response?.status === 404) {
        // User account (e.g. Super Admin) is not bound to a personal employee profile
        return { data: [] };
      }
      throw err;
    }
  },

  // 10. GET /lifecycle-events/employees/:employeeId - Get lifecycle events for a specific employee (Admin / Manager / Self)
  getEmployeeLifecycleEvents: async (employeeId, params) => {
    const res = await apiClient.get(`/lifecycle-events/employees/${employeeId}`, { params });
    return res.data;
  },

  // 11. GET /lifecycle-events - List all lifecycle events with filters
  getAllLifecycleEvents: async (params) => {
    const res = await apiClient.get('/lifecycle-events', { params });
    return res.data;
  },

  // 12. GET /lifecycle-events/:id - Get single lifecycle event details by ID
  getLifecycleEventById: async (id) => {
    const res = await apiClient.get(`/lifecycle-events/${id}`);
    return res.data;
  },
};

export default lifecycleApi;
