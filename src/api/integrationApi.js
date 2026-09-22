import apiClient from './client';

export const integrationApi = {
  // =========================================================================
  // Module 24: HRMS Cross-Module Integration Layer
  // =========================================================================

  // POST /integration/contracts/seed
  seedContracts: async () => {
    const res = await apiClient.post('/integration/contracts/seed');
    return res.data;
  },

  // GET /integration/contracts
  getContracts: async (params) => {
    const res = await apiClient.get('/integration/contracts', { params });
    return res.data;
  },

  // POST /integration/contracts
  registerContract: async (data) => {
    const res = await apiClient.post('/integration/contracts', data);
    return res.data;
  },

  // POST /integration/health-checks/run
  runHealthChecks: async () => {
    const res = await apiClient.post('/integration/health-checks/run');
    return res.data;
  },

  // GET /integration/health-checks/latest
  getLatestHealthCheck: async () => {
    const res = await apiClient.get('/integration/health-checks/latest');
    return res.data;
  },

  // GET /integration/health-checks
  getHealthCheckHistory: async (params) => {
    const res = await apiClient.get('/integration/health-checks', { params });
    return res.data;
  },
};

export default integrationApi;
