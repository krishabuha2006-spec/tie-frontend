import axios from 'axios';

const envUrl = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL;
const isLocal = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
const BASE_URL = isLocal ? '/api' : (envUrl || '/api');

const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

// Request Interceptor: Attach Access Token
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('tie_access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Handle Token Expiration & Refresh
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Check if error is 401 Unauthorized and not already retrying
    if (error.response?.status === 401 && !originalRequest._retry) {
      const refreshToken = localStorage.getItem('tie_refresh_token');

      // Do not loop on auth endpoints
      if (
        originalRequest.url.includes('/auth/login') ||
        originalRequest.url.includes('/auth/refresh') ||
        originalRequest.url.includes('/auth/refresh-token')
      ) {
        return Promise.reject(error);
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return apiClient(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      if (!refreshToken) {
        localStorage.removeItem('tie_access_token');
        localStorage.removeItem('tie_refresh_token');
        localStorage.removeItem('tie_user');
        window.location.href = '/login';
        return Promise.reject(error);
      }

      try {
        let res;
        try {
          // Standard endpoint: /auth/refresh-token
          res = await axios.post(`${BASE_URL}/auth/refresh-token`, { refreshToken });
        } catch (refreshErr1) {
          // Fallback to /auth/refresh
          res = await axios.post(`${BASE_URL}/auth/refresh`, { refreshToken });
        }

        const newAccessToken =
          res.data?.data?.accessToken || res.data?.accessToken || res.data?.data?.token;

        if (newAccessToken) {
          localStorage.setItem('tie_access_token', newAccessToken);
          apiClient.defaults.headers.common.Authorization = `Bearer ${newAccessToken}`;
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
          processQueue(null, newAccessToken);
          return apiClient(originalRequest);
        } else {
          throw new Error('No access token received from refresh endpoint');
        }
      } catch (refreshErr) {
        processQueue(refreshErr, null);
        localStorage.removeItem('tie_access_token');
        localStorage.removeItem('tie_refresh_token');
        localStorage.removeItem('tie_user');
        window.location.href = '/login';
        return Promise.reject(refreshErr);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default apiClient;
