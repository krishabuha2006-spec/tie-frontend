import axios from 'axios';

// Live Backend URL configured from .env
export const LIVE_BACKEND_URL = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || 'https://tie-backend-ruddy.vercel.app/api';

// Relative '/api' ensures same-origin requests on both Localhost (via Vite proxy)
// and Vercel production (via vercel.json rewrite proxy), avoiding browser CORS restrictions.
const BASE_URL = typeof window !== 'undefined' ? '/api' : LIVE_BACKEND_URL;

const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    // Prevent browser from serving 304 Not Modified cached responses;
    // always fetch fresh data from the backend (200 OK).
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache',
  },
  timeout: 45000,
});

// Helper: Check if a JWT is expired or will expire within 60 seconds
export const isTokenExpired = (token) => {
  if (!token || typeof token !== 'string') return true;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return true;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    const parsed = JSON.parse(jsonPayload);
    if (!parsed.exp) return false;
    // Buffer of 30 seconds
    return parsed.exp * 1000 < Date.now() + 30000;
  } catch {
    return true;
  }
};

// Proactive token renewal singleton promise
let tokenRenewalPromise = null;

export const ensureValidToken = async (forceRefresh = false) => {
  let token = localStorage.getItem('tie_access_token');
  if (!forceRefresh && token && !isTokenExpired(token)) {
    return token;
  }

  if (tokenRenewalPromise) {
    return tokenRenewalPromise;
  }

  tokenRenewalPromise = (async () => {
    // 1. Try refresh-token if available
    const refreshToken = localStorage.getItem('tie_refresh_token');
    if (refreshToken) {
      try {
        const res = await axios.post(
          `${BASE_URL}/auth/refresh-token`,
          { refreshToken },
          { timeout: 8000 }
        );
        const newToken = res.data?.data?.accessToken || res.data?.accessToken;
        const newRefresh = res.data?.data?.refreshToken || res.data?.refreshToken;
        if (newToken) {
          localStorage.setItem('tie_access_token', newToken);
          if (newRefresh) localStorage.setItem('tie_refresh_token', newRefresh);
          return newToken;
        }
      } catch {
        // Fallback endpoint: /auth/refresh
        try {
          const resFallback = await axios.post(
            `${BASE_URL}/auth/refresh`,
            { refreshToken },
            { timeout: 8000 }
          );
          const newToken = resFallback.data?.data?.accessToken || resFallback.data?.accessToken;
          const newRefresh = resFallback.data?.data?.refreshToken || resFallback.data?.refreshToken;
          if (newToken) {
            localStorage.setItem('tie_access_token', newToken);
            if (newRefresh) localStorage.setItem('tie_refresh_token', newRefresh);
            return newToken;
          }
        } catch {}
      }
    }

    if (!forceRefresh) {
      return localStorage.getItem('tie_access_token');
    }
    return null;
  })().finally(() => {
    tokenRenewalPromise = null;
  });

  return tokenRenewalPromise;
};

// Request Interceptor: Proactively verify token and attach headers
apiClient.interceptors.request.use(
  async (config) => {
    const isAuthRoute =
      config.url?.includes('/auth/login') ||
      config.url?.includes('/auth/refresh') ||
      config.url?.includes('/auth/refresh-token');

    if (!isAuthRoute) {
      const validToken = await ensureValidToken();
      if (validToken) {
        config.headers.Authorization = `Bearer ${validToken}`;
      }
    }

    // Cache-bust all GET requests with a timestamp so browser/CDN always
    // returns a fresh 200 OK instead of a stale 304 Not Modified.
    if (!config.method || config.method.toLowerCase() === 'get') {
      config.params = { ...config.params, _t: Date.now() };
    }

    const activeCompanyId = localStorage.getItem('tie_active_company_id');
    if (activeCompanyId && !config.headers['x-company-id']) {
      config.headers['x-company-id'] = activeCompanyId;
    }
    const activeBranchId = localStorage.getItem('tie_active_branch_id');
    if (activeBranchId && !config.headers['x-branch-id']) {
      config.headers['x-branch-id'] = activeBranchId;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Handle Token Expiration, 502 Gateway Errors & Retries
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
    if (!originalRequest) return Promise.reject(error);

    const status = error.response?.status;

    // 1. Handle 401 Unauthorized
    if (status === 401 && !originalRequest._retry) {
      // Do not loop on auth endpoints
      if (
        originalRequest.url?.includes('/auth/login') ||
        originalRequest.url?.includes('/auth/refresh') ||
        originalRequest.url?.includes('/auth/refresh-token')
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

      try {
        const freshToken = await ensureValidToken(true);
        if (freshToken) {
          apiClient.defaults.headers.common.Authorization = `Bearer ${freshToken}`;
          originalRequest.headers.Authorization = `Bearer ${freshToken}`;
          processQueue(null, freshToken);
          return apiClient(originalRequest);
        } else {
          processQueue(error, null);
          return Promise.reject(error);
        }
      } catch (refreshErr) {
        processQueue(refreshErr, null);
        return Promise.reject(refreshErr);
      } finally {
        isRefreshing = false;
      }
    }

    // 2. Automatic retry for transient gateway errors (502 Bad Gateway, 503, 504) or network drops
    const isGatewayOrNetworkError =
      status === 502 ||
      status === 503 ||
      status === 504 ||
      error.code === 'ERR_NETWORK' ||
      error.code === 'ECONNABORTED' ||
      error.code === 'ETIMEDOUT' ||
      (typeof error.message === 'string' && error.message.toLowerCase().includes('network'));

    if (isGatewayOrNetworkError && (!originalRequest.method || originalRequest.method.toLowerCase() === 'get')) {
      originalRequest._retryCount = (originalRequest._retryCount || 0) + 1;
      if (originalRequest._retryCount <= 2) {
        await new Promise((resolve) => setTimeout(resolve, originalRequest._retryCount * 500));
        return apiClient(originalRequest);
      }
    }

    // 3. Transparent fallback to direct LIVE_BACKEND_URL if local dev proxy connection is refused
    if (
      !error.response &&
      !originalRequest._fallbackToDirect &&
      (error.code === 'ERR_NETWORK' ||
       error.code === 'ECONNREFUSED' ||
       String(error.message).toLowerCase().includes('network') ||
       String(error.message).toLowerCase().includes('refused'))
    ) {
      originalRequest._fallbackToDirect = true;
      originalRequest.baseURL = LIVE_BACKEND_URL;
      return apiClient(originalRequest);
    }

    return Promise.reject(error);
  }
);

export default apiClient;
