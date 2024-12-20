/**
 * Storage utility for client-side authentication and session state.
 * Auth tokens are stored in browser cookies and localStorage.
 * User profile objects are cached in localStorage.
 */

import { TOKEN_KEY, REFRESH_TOKEN_KEY, USER_KEY, PROFILE_KEY } from '@/config/constants';
import { getCookie, setCookie, removeCookie } from './cookies.js';

export { TOKEN_KEY, REFRESH_TOKEN_KEY, USER_KEY, PROFILE_KEY };

export function parseJwtPayload(token) {
  if (!token || typeof token !== 'string') return null;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

export function isJwtExpired(token) {
  const payload = parseJwtPayload(token);
  if (!payload || !payload.exp) return true;
  // Buffer by 5 seconds
  return Date.now() >= payload.exp * 1000 - 5000;
}

function readStoredUserRaw() {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function getStoredToken() {
  const activeUser = readStoredUserRaw();
  const candidates = [
    localStorage.getItem(TOKEN_KEY),
    localStorage.getItem('token'),
    getCookie(TOKEN_KEY),
    getCookie('token'),
  ];

  for (const token of candidates) {
    if (token && typeof token === 'string' && !isJwtExpired(token)) {
      if (activeUser?.id) {
        const payload = parseJwtPayload(token);
        if (payload?.userId === activeUser.id) {
          return token;
        }
      } else {
        return token;
      }
    }
  }

  return null;
}

export function getStoredRefreshToken() {
  const activeUser = readStoredUserRaw();
  const candidates = [
    localStorage.getItem(REFRESH_TOKEN_KEY),
    localStorage.getItem('refreshToken'),
    getCookie(REFRESH_TOKEN_KEY),
    getCookie('refreshToken'),
  ];

  for (const token of candidates) {
    if (token && typeof token === 'string' && !isJwtExpired(token)) {
      if (activeUser?.id) {
        const payload = parseJwtPayload(token);
        if (payload?.userId === activeUser.id) {
          return token;
        }
      } else {
        return token;
      }
    }
  }

  return null;
}

let isClearingSession = false;
let isSettingSession = false;

export function getStoredUser() {
  try {
    const user = readStoredUserRaw();
    if (!user || !user.id) return null;

    const token = getStoredToken();
    const refreshToken = getStoredRefreshToken();

    // If both access token and refresh token are missing/expired for this user, clear session
    if (!token && !refreshToken) {
      clearStoredSession();
      return null;
    }

    if (token) {
      const payload = parseJwtPayload(token);
      if (payload?.userId && payload.userId !== user.id) {
        clearStoredSession();
        return null;
      }
      if (payload?.roleId && user.roleId && payload.roleId !== user.roleId) {
        clearStoredSession();
        return null;
      }
    }

    return user;
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
  if (isSettingSession) return;
  isSettingSession = true;
  try {
    // Store authentication tokens in cookies and sync with localStorage
    if (token) {
      setCookie(TOKEN_KEY, token, { expires: 1 });
      setCookie('token', token, { expires: 1 });
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem('token', token);
    }
    if (refreshToken) {
      setCookie(REFRESH_TOKEN_KEY, refreshToken, { expires: 7 });
      setCookie('refreshToken', refreshToken, { expires: 7 });
      localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
      localStorage.setItem('refreshToken', refreshToken);
    }

    if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
    if (profile) localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('ugs:session-changed', { detail: { user, profile } }));
    }
  } finally {
    isSettingSession = false;
  }
}

export function clearStoredSession() {
  if (isClearingSession) return;
  isClearingSession = true;
  try {
    // Clear authentication cookies across all common variants
    removeCookie(TOKEN_KEY);
    removeCookie('token');
    removeCookie('accessToken');
    removeCookie(REFRESH_TOKEN_KEY);
    removeCookie('refreshToken');

    // Clear tokens and cached user state
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem('token');
    localStorage.removeItem('accessToken');
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem('refreshToken');
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(PROFILE_KEY);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('ugs:session-changed', { detail: { user: null, profile: null } }));
    }
  } finally {
    isClearingSession = false;
  }
}
