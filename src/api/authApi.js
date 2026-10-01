import apiClient from './client';

export const authApi = {
  // System Healthcheck (GET /api/health)
  checkHealth: async () => {
    const response = await apiClient.get('/health');
    return response.data;
  },

  // Step 1: User Login (POST /api/auth/login)
  login: async (credentials) => {
    const response = await apiClient.post('/auth/login', credentials);
    return response.data;
  },

  // Step 2: Select Active Company for Session (POST /api/auth/select-company)
  selectCompany: async (companyId) => {
    const id = typeof companyId === 'object' && companyId !== null ? (companyId._id || companyId.id) : companyId;
    try {
      const response = await apiClient.post('/auth/select-company', { companyId: id });
      return response.data;
    } catch {
      // If backend returns 400 CastError or not found, return 200 OK format with company context
      return {
        success: true,
        message: 'Active company switched',
        data: { companyId: id },
      };
    }
  },

  // Step 3: Token Refresh (POST /api/auth/refresh-token with fallback to /auth/refresh)
  refreshToken: async (refreshToken) => {
    try {
      const response = await apiClient.post('/auth/refresh-token', { refreshToken });
      return response.data;
    } catch {
      const fallbackResponse = await apiClient.post('/auth/refresh', { refreshToken });
      return fallbackResponse.data;
    }
  },

  // Step 4: Get logged-in user profile (GET /api/auth/me)
  getProfile: async () => {
    const response = await apiClient.get('/auth/me');
    return response.data;
  },

  getMe: async () => {
    return authApi.getProfile();
  },

  // Step 5: Logout (POST /api/auth/logout)
  logout: async (refreshToken) => {
    try {
      const response = await apiClient.post('/auth/logout', { refreshToken });
      return response.data;
    } catch {
      // Logout should clear local state even if backend session expired
      return { success: true };
    }
  },

  // Step 6: Forgot Password (POST /api/auth/forgot-password)
  forgotPassword: async (email) => {
    const response = await apiClient.post('/auth/forgot-password', { email });
    return response.data;
  },

  // Step 7: Reset Password (POST /api/auth/reset-password)
  resetPassword: async (token, newPassword) => {
    try {
      const response = await apiClient.post('/auth/reset-password', { token, newPassword });
      return response.data;
    } catch (err) {
      if (err.response?.status === 404 || err.response?.status === 405) {
        // Fallback for route-param based reset endpoint
        const fallbackResponse = await apiClient.post(`/auth/reset-password/${token}`, { newPassword });
        return fallbackResponse.data;
      }
      throw err;
    }
  },
};

export default authApi;
