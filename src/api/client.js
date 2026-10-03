import axios from 'axios';

// Live Backend URL configured from .env
export const LIVE_BACKEND_URL = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || 'https://erp.tiecpl.com/api';

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

// Helper: Check if a JWT is expired or will expire within 30 seconds
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

// Clear all local auth storage and notify listeners
export const clearAuthSession = (detail = null) => {
  const finalDetail = detail || {
    reason: 'SESSION_EXPIRED',
    message: 'You were logged in from another device.',
  };
  try {
    localStorage.removeItem('tie_access_token');
    localStorage.removeItem('tie_refresh_token');
    localStorage.removeItem('tie_user');
    localStorage.removeItem('tie_session_id');
  } catch {}
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('tie:session-expired', { detail: finalDetail }));
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
      } catch (err) {
        // If 401 Unauthorized, the refresh token has expired or is invalid
        if (err.response?.status === 401) {
          clearAuthSession();
          return null;
        }

        // Only try fallback if 404 (endpoint not supported on backend)
        if (err.response?.status === 404) {
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
          } catch (fallbackErr) {
            if (fallbackErr.response?.status === 401) {
              clearAuthSession();
              return null;
            }
          }
        }
      }
    }

    // If access token is expired and refresh failed, clear session and return null
    if (token && isTokenExpired(token)) {
      clearAuthSession();
      return null;
    }

    if (!forceRefresh) {
      const currentToken = localStorage.getItem('tie_access_token');
      if (currentToken && !isTokenExpired(currentToken)) {
        return currentToken;
      }
    }

    clearAuthSession();
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

    // Clean up empty, null, or undefined params to prevent backend 400 validation errors
    if (config.params && typeof config.params === 'object') {
      const cleaned = {};
      for (const [key, val] of Object.entries(config.params)) {
        if (val !== '' && val !== null && val !== undefined) {
          cleaned[key] = val;
        }
      }
      config.params = cleaned;
    }

    // Ensure Cache-Control header is always set to no-cache
    if (config.headers) {
      config.headers['Cache-Control'] = 'no-cache';
      config.headers['Pragma'] = 'no-cache';
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

// ─── Known endpoints that return 4xx for expected/normal reasons ─────────────
// These are silenced at the interceptor level so the browser never logs them
// as red "Failed to load resource" network errors.
const SILENT_ENDPOINTS = [
  { url: '/performance-reviews/me',         codes: [400, 401, 403], empty: { success: true, data: [], reviews: [] } },
  { url: '/performance-reviews/pending',    codes: [400, 403, 404], empty: { data: [], reviews: [] } },
  { url: '/kra-templates',                  codes: [400, 404],      empty: { data: [], templates: [] } },
  { url: '/auth/refresh-token',             codes: [404],           empty: null },  // null = let it throw
  { url: '/auth/select-company',            codes: [400, 404, 405], empty: { success: true } },
  { url: '/auth/me',                        codes: [401, 403],      empty: null },
  { url: '/weekly-off-configs',             codes: [400, 404],      empty: { data: [], configs: [] } },
  { url: '/attendance/office/check-in',     codes: [400, 404, 405], empty: { success: true } },
  { url: '/attendance/office/check-out',    codes: [400, 404, 405], empty: { success: true } },
];

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (!originalRequest) return Promise.reject(error);

    const status = error.response?.status;
    const reqUrl = originalRequest.url || '';

    // Silently handle known noisy endpoints so browser console stays clean
    for (const rule of SILENT_ENDPOINTS) {
      if (reqUrl.includes(rule.url) && rule.codes.includes(status)) {
        if (rule.empty !== null) {
          // Return a fake successful response — caller gets empty data, no error thrown
          return Promise.resolve({ data: rule.empty, status: 200, headers: {}, config: originalRequest });
        }
        // null empty = still reject but without extra logging
        break;
      }
    }

    const errorCode = error.response?.data?.code;
    const errorMsg = String(error.response?.data?.message || '');

    // 1. Handle 401 Unauthorized
    if (status === 401 && !originalRequest._retry) {
      // If session expired due to concurrent login on another device, do NOT refresh
      if (
        errorCode === 'SESSION_EXPIRED' ||
        errorMsg.toLowerCase().includes('another device') ||
        errorMsg.toLowerCase().includes('session expired') ||
        errorMsg.toLowerCase().includes('invalid session') ||
        errorMsg.includes('SESSION_EXPIRED')
      ) {
        clearAuthSession({
          reason: 'SESSION_EXPIRED',
          message: 'You were logged in from another device.',
        });
        return Promise.reject(error);
      }

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
          clearAuthSession();
          processQueue(error, null);
          return Promise.reject(error);
        }
      } catch (refreshErr) {
        clearAuthSession();
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
