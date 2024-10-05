import { StoreError } from '@/store/helpers';

const API_BASE = '/api/v1';

export const TOKEN_KEY = 'ugs_token';
export const REFRESH_TOKEN_KEY = 'ugs_refresh_token';
export const USER_KEY = 'ugs_user';
export const PROFILE_KEY = 'ugs_profile';

export function getStoredToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function getStoredRefreshToken() {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function getStoredUser() {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function getStoredProfile() {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setStoredSession(token, refreshToken, user, profile) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  if (refreshToken) localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
  if (profile) localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
}

export function clearStoredSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(PROFILE_KEY);
}

let isRefreshing = false;
let refreshSubscribers = [];

function onRefreshed(token) {
  refreshSubscribers.forEach((cb) => cb(token));
  refreshSubscribers = [];
}

function addRefreshSubscriber(cb) {
  refreshSubscribers.push(cb);
}

async function doRefreshToken() {
  const refreshToken = getStoredRefreshToken();
  if (!refreshToken) throw new Error('No refresh token available');

  const res = await fetch(`${API_BASE}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });

  if (!res.ok) {
    clearStoredSession();
    throw new Error('Session expired');
  }

  const data = await res.json();
  localStorage.setItem(TOKEN_KEY, data.token);
  return data.token;
}

export async function apiRequest(endpoint, options = {}) {
  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint}`;
  const token = getStoredToken();

  const headers = {
    Accept: 'application/json',
    ...options.headers,
  };

  if (!(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let res = await fetch(url, { ...options, headers });

  // Handle 401 Unauthorized with automatic token refresh
  if (res.status === 401 && getStoredRefreshToken() && !endpoint.includes('/auth/login') && !endpoint.includes('/auth/refresh')) {
    if (!isRefreshing) {
      isRefreshing = true;
      try {
        const newToken = await doRefreshToken();
        isRefreshing = false;
        onRefreshed(newToken);
      } catch (err) {
        isRefreshing = false;
        window.location.href = '/login';
        throw new StoreError('unauthenticated', 'Session expired. Please log in again.');
      }
    }

    const retryPromise = new Promise((resolve) => {
      addRefreshSubscriber((newToken) => {
        headers.Authorization = `Bearer ${newToken}`;
        resolve(fetch(url, { ...options, headers }));
      });
    });

    res = await retryPromise;
  }

  if (res.status === 204) {
    return null;
  }

  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('text/csv')) {
    return await res.text();
  }

  let data;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (!res.ok) {
    const err = data?.error;
    const kind = err?.kind || (res.status === 404 ? 'not_found' : res.status === 403 ? 'forbidden' : res.status === 401 ? 'unauthenticated' : 'error');
    const message = err?.message || res.statusText || 'Request failed';
    const fieldErrors = err?.fieldErrors || null;
    throw new StoreError(kind, message, fieldErrors);
  }

  return data;
}

export const api = {
  get: (path, params) => {
    let url = path;
    if (params) {
      const cleanParams = Object.entries(params)
        .filter(([_, v]) => v !== undefined && v !== null && v !== '')
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
        .join('&');
      if (cleanParams) url += (url.includes('?') ? '&' : '?') + cleanParams;
    }
    return apiRequest(url, { method: 'GET' });
  },
  post: (path, body) => apiRequest(path, { method: 'POST', body: JSON.stringify(body) }),
  put: (path, body) => apiRequest(path, { method: 'PUT', body: JSON.stringify(body) }),
  patch: (path, body) => apiRequest(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: (path) => apiRequest(path, { method: 'DELETE' }),
};
