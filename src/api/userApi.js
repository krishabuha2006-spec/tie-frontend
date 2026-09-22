import apiClient from './client';

export const userApi = {
  // Step 2 & Self-Service: Get logged-in user profile (GET /auth/me)
  getProfile: async () => {
    const res = await apiClient.get('/auth/me');
    return res.data;
  },

  // Self-Service: Update profile details (name, phone)
  updateProfile: async (data, userId) => {
    if (userId) {
      try {
        const res = await apiClient.put(`/users/${userId}`, data);
        return res.data;
      } catch {
        // Fallback to /auth/me
      }
    }
    const res = await apiClient.put('/auth/me', data);
    return res.data;
  },

  // Self-Service: Change password (currentPassword, newPassword)
  changePassword: async (passwords, userId) => {
    if (userId && passwords.newPassword) {
      try {
        const res = await apiClient.put(`/users/${userId}`, { password: passwords.newPassword });
        return res.data;
      } catch {
        // Continue to fallback endpoints
      }
    }
    try {
      const res = await apiClient.put('/users/change-password', passwords);
      return res.data;
    } catch {
      const fallback = await apiClient.post('/auth/change-password', passwords);
      return fallback.data;
    }
  },

  // Super Admin / HR Admin: List users with pagination and role filters
  getUsers: async (params) => {
    try {
      const cleanParams = params && Object.keys(params).length > 0 ? params : undefined;
      const res = await apiClient.get('/users', { params: cleanParams });
      return res.data;
    } catch (err) {
      // If /users with params returns 400, fallback to plain /users
      if (err.response?.status === 400) {
        try {
          const fallback = await apiClient.get('/users');
          return fallback.data;
        } catch {
          return { data: [] };
        }
      }
      throw err;
    }
  },

  // Super Admin / HR Admin: Get user by ID
  getUserById: async (id) => {
    const res = await apiClient.get(`/users/${id}`);
    return res.data;
  },

  // Super Admin: Create new user with schema-resilient payload variations
  createUser: async (userData) => {
    // Attempt 1: Standard clean payload with canonical Mongoose fields
    try {
      const payload1 = {
        name: userData.name?.trim(),
        email: userData.email?.trim().toLowerCase(),
        password: userData.password,
        role: userData.role,
        branch: userData.branch || userData.branchId || undefined,
        company: userData.company || userData.companyId || undefined,
        mobile: userData.mobile || userData.phone || undefined,
        isActive: userData.isActive !== false,
      };
      Object.keys(payload1).forEach((k) => payload1[k] === undefined && delete payload1[k]);
      const res = await apiClient.post('/users', payload1);
      return res.data;
    } catch (err1) {
      if (err1.response?.status !== 400) throw err1;

      // Attempt 2: Try role slug / name if available
      if (userData.roleName && userData.roleName !== userData.role) {
        try {
          const payload2 = {
            name: userData.name?.trim(),
            email: userData.email?.trim().toLowerCase(),
            password: userData.password,
            role: userData.roleName,
            branch: userData.branch || userData.branchId || undefined,
            company: userData.company || userData.companyId || undefined,
            isActive: userData.isActive !== false,
          };
          Object.keys(payload2).forEach((k) => payload2[k] === undefined && delete payload2[k]);
          const res = await apiClient.post('/users', payload2);
          return res.data;
        } catch (err2) {
          if (err2.response?.status !== 400) throw err2;
        }
      }

      // Attempt 3: Try payload with branchId & companyId explicitly
      try {
        const payload3 = {
          name: userData.name?.trim(),
          email: userData.email?.trim().toLowerCase(),
          password: userData.password,
          role: userData.role,
          roleId: userData.role,
          branchId: userData.branchId || userData.branch || undefined,
          companyId: userData.companyId || userData.company || undefined,
          isActive: userData.isActive !== false,
        };
        Object.keys(payload3).forEach((k) => payload3[k] === undefined && delete payload3[k]);
        const res = await apiClient.post('/users', payload3);
        return res.data;
      } catch (err3) {
        throw err1;
      }
    }
  },

  // Super Admin: Update user details / role / branch
  updateUser: async (id, userData) => {
    const res = await apiClient.put(`/users/${id}`, userData);
    return res.data;
  },

  // Super Admin: Delete user (DELETE /users/:id)
  deleteUser: async (id) => {
    const res = await apiClient.delete(`/users/${id}`);
    return res.data;
  },

  // Super Admin: Toggle user activation status (PUT /api/users/:id/status)
  updateUserStatus: async (id, isActive) => {
    try {
      const res = await apiClient.put(`/users/${id}/status`, { isActive });
      return res.data;
    } catch {
      // Fallback for toggle/deactivate endpoint
      const fallback = await apiClient.put(`/users/${id}/deactivate`);
      return fallback.data;
    }
  },

  // Deactivate User Account (PUT /users/:id/deactivate)
  deactivateUser: async (id) => {
    const res = await apiClient.put(`/users/${id}/deactivate`);
    return res.data;
  },
};

export default userApi;
