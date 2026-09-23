import apiClient from './client';

export const authApi = {
  // Step 1: User Login (POST /api/auth/login)
  login: async (credentials) => {
    const response = await apiClient.post('/auth/login', credentials);
    return response.data;
  },

  // Step 4: Token Refresh (POST /api/auth/refresh with fallback to /auth/refresh-token)
  refreshToken: async (refreshToken) => {
    try {
      const response = await apiClient.post('/auth/refresh', { refreshToken });
      return response.data;
    } catch {
      const fallbackResponse = await apiClient.post('/auth/refresh-token', { refreshToken });
      return fallbackResponse.data;
    }
  },

  // Step 2: Get logged-in user profile (GET /api/auth/me)
  getProfile: async () => {
    const response = await apiClient.get('/auth/me');
    return response.data;
  },

  getMe: async () => {
    return authApi.getProfile();
  },

  // Step 7: Logout (POST /api/auth/logout)
  logout: async (refreshToken) => {
    try {
      const response = await apiClient.post('/auth/logout', { refreshToken });
      return response.data;
    } catch {
      // Logout should clear local state even if backend has session expiry
      return { success: true };
    }
  },

  // Step 5: Forgot Password (POST /api/auth/forgot-password)
  forgotPassword: async (email) => {
    const response = await apiClient.post('/auth/forgot-password', { email });
    return response.data;
  },

  // Step 6: Reset Password (POST /api/auth/reset-password)
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
