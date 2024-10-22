import axios from 'axios';
import { StoreError } from '@/store/helpers';
import {
  TOKEN_KEY,
  REFRESH_TOKEN_KEY,
  USER_KEY,
  PROFILE_KEY,
  getStoredToken,
  getStoredRefreshToken,
  getStoredUser,
  getStoredProfile,
  setStoredSession,
  clearStoredSession,
} from '@/lib/storage';

// Re-export storage helpers for backward compatibility
export {
  TOKEN_KEY,
  REFRESH_TOKEN_KEY,
  USER_KEY,
  PROFILE_KEY,
  getStoredToken,
  getStoredRefreshToken,
  getStoredUser,
  getStoredProfile,
  setStoredSession,
  clearStoredSession,
};

import { API_BASE_URL, API_TIMEOUT, DEFAULT_HEADERS, ENDPOINTS } from '@/config/api.config';
import { setCookie } from '@/lib/cookies.js';

export const API_BASE = API_BASE_URL;

export const apiClient = axios.create({
  baseURL: API_BASE,
  timeout: API_TIMEOUT,
  withCredentials: true,
  headers: {
    Accept: DEFAULT_HEADERS.Accept || 'application/json',
  },
});

let isRefreshing = false;
let failedQueue = [];

function processQueue(error, token = null) {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
}

async function doRefreshToken() {
  const refreshToken = getStoredRefreshToken();
  if (!refreshToken) throw new Error('No refresh token available');

  const res = await axios.post(
    `${API_BASE}${ENDPOINTS.AUTH.REFRESH}`,
    { refreshToken },
    {
      withCredentials: true,
      headers: { 'Content-Type': 'application/json' },
    }
  );

  const data = res.data;
  const token = data.token || data.accessToken;
  if (!token) throw new Error('No token returned from refresh');
  setStoredSession(token, refreshToken, getStoredUser(), getStoredProfile());
  return token;
}

// Request Interceptor: Attach bearer token and ensure proper Content-Type
apiClient.interceptors.request.use(
  (config) => {
    const token = getStoredToken();
    if (token && !config.headers.Authorization) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    if (!(config.data instanceof FormData) && !config.headers['Content-Type']) {
      config.headers['Content-Type'] = 'application/json';
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: 401 token refresh queue & standard StoreError mapping
apiClient.interceptors.response.use(
  (response) => {
    if (response.status === 204) {
      response.data = null;
    }
    return response;
  },
  async (error) => {
    const originalRequest = error.config;
    if (!originalRequest) return Promise.reject(error);

    // Automatic token refresh on 401 Unauthorized
    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      getStoredRefreshToken() &&
      !originalRequest.url?.includes(ENDPOINTS.AUTH.LOGIN) &&
      !originalRequest.url?.includes(ENDPOINTS.AUTH.REFRESH)
    ) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest._retry = true;
            if (originalRequest.headers?.set) {
              originalRequest.headers.set('Authorization', `Bearer ${token}`);
            } else {
              originalRequest.headers = originalRequest.headers || {};
              originalRequest.headers.Authorization = `Bearer ${token}`;
            }
            return apiClient(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const newToken = await doRefreshToken();
        isRefreshing = false;
        processQueue(null, newToken);
        if (originalRequest.headers?.set) {
          originalRequest.headers.set('Authorization', `Bearer ${newToken}`);
        } else {
          originalRequest.headers = originalRequest.headers || {};
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
        }
        return apiClient(originalRequest);
      } catch (refreshErr) {
        isRefreshing = false;
        processQueue(refreshErr, null);
        clearStoredSession();
        if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
          window.location.href = '/login';
        }
        throw new StoreError('unauthenticated', 'Session expired. Please log in again.');
      }
    } else if (
      error.response?.status === 401 &&
      !originalRequest.url?.includes(ENDPOINTS.AUTH.LOGIN) &&
      !originalRequest.url?.includes(ENDPOINTS.AUTH.REFRESH) &&
      !originalRequest.url?.includes('/lookups')
    ) {
      clearStoredSession();
      if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
    }

    // Normalize error response to StoreError
    const res = error.response;
    if (res) {
      const errData = res.data;
      const err = errData?.error;
      const kind =
        err?.kind ||
        (res.status === 404
          ? 'not_found'
          : res.status === 403
          ? 'forbidden'
          : res.status === 401
          ? 'unauthenticated'
          : res.status === 422
          ? 'validation'
          : 'error');
      const message = err?.message || errData?.message || res.statusText || 'Request failed';
      const fieldErrors = err?.fieldErrors || errData?.fieldErrors || err?.details || null;
      throw new StoreError(kind, message, fieldErrors);
    }

    throw new StoreError('error', error.message || 'Network connection failed');
  }
);

function cleanParams(params) {
  if (!params || typeof params !== 'object') return {};
  const clean = {};
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      clean[key] = value;
    }
  }
  return clean;
}

/**
 * Backward-compatible apiRequest wrapper backed by Axios
 */
export async function apiRequest(endpoint, options = {}) {
  const config = {
    url: endpoint,
    method: (options.method || 'GET').toUpperCase(),
    headers: options.headers ? { ...options.headers } : {},
    ...options,
  };

  if (options.body) {
    if (typeof options.body === 'string') {
      try {
        config.data = JSON.parse(options.body);
      } catch {
        config.data = options.body;
      }
    } else {
      config.data = options.body;
    }
  }

  const response = await apiClient(config);
  return response.data;
}

/**
 * Standard HTTP methods backed by Axios
 */
export const api = {
  get: async (path, params, config = {}) => {
    const response = await apiClient.get(path, {
      ...config,
      params: params ? cleanParams(params) : undefined,
    });
    return response.data;
  },
  post: async (path, body, config = {}) => {
    const response = await apiClient.post(path, body, config);
    return response.data;
  },
  put: async (path, body, config = {}) => {
    const response = await apiClient.put(path, body, config);
    return response.data;
  },
  patch: async (path, body, config = {}) => {
    const response = await apiClient.patch(path, body, config);
    return response.data;
  },
  delete: async (path, config = {}) => {
    const response = await apiClient.delete(path, config);
    return response.data;
  },
};

export default apiClient;
