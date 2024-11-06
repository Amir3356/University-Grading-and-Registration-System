/**
 * Storage utility for client-side authentication and session state.
 * Auth tokens are stored in browser cookies (instead of localStorage).
 * User profile objects are cached in localStorage.
 */

import { TOKEN_KEY, REFRESH_TOKEN_KEY, USER_KEY, PROFILE_KEY } from '@/config/constants';
import { getCookie, setCookie, removeCookie } from './cookies.js';

export { TOKEN_KEY, REFRESH_TOKEN_KEY, USER_KEY, PROFILE_KEY };

export function isJwtExpired(token) {
  if (!token || typeof token !== 'string') return true;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return true;
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    const payload = JSON.parse(jsonPayload);
    if (!payload.exp) return false;
    // Buffer by 5 seconds
    return Date.now() >= payload.exp * 1000 - 5000;
  } catch {
    return true;
  }
}

export function getStoredToken() {
  return getCookie(TOKEN_KEY) || localStorage.getItem(TOKEN_KEY) || null;
}

export function getStoredRefreshToken() {
  const token = getCookie(REFRESH_TOKEN_KEY) || localStorage.getItem(REFRESH_TOKEN_KEY) || null;
  if (!token || isJwtExpired(token)) {
    return null;
  }
  return token;
}

let isClearingSession = false;
let isSettingSession = false;

export function getStoredUser() {
  try {
    const token = getStoredToken();
    const refreshToken = getStoredRefreshToken();
    // If access token is expired and no valid refresh token exists, clear session
    if (token && isJwtExpired(token) && !refreshToken) {
      clearStoredSession();
      return null;
    }
    if (!token && !refreshToken) {
      return null;
    }
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
  if (isSettingSession) return;
  isSettingSession = true;
  try {
    // Store authentication tokens in cookies and sync with localStorage
    if (token) {
      setCookie(TOKEN_KEY, token, { expires: 1 });
      localStorage.setItem(TOKEN_KEY, token);
    }
    if (refreshToken) {
      setCookie(REFRESH_TOKEN_KEY, refreshToken, { expires: 7 });
      localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
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
    // Clear authentication cookies
    removeCookie(TOKEN_KEY);
    removeCookie(REFRESH_TOKEN_KEY);

    // Clear tokens and cached user state
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(PROFILE_KEY);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('ugs:session-changed', { detail: { user: null, profile: null } }));
    }
  } finally {
    isClearingSession = false;
  }
}
