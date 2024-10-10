/**
 * Storage utility for client-side authentication and session state.
 * Auth tokens are stored in browser cookies (instead of localStorage).
 * User profile objects are cached in localStorage.
 */

import { TOKEN_KEY, REFRESH_TOKEN_KEY, USER_KEY, PROFILE_KEY } from '@/config/constants';
import { getCookie, setCookie, removeCookie } from './cookies.js';

export { TOKEN_KEY, REFRESH_TOKEN_KEY, USER_KEY, PROFILE_KEY };

export function getStoredToken() {
  return getCookie(TOKEN_KEY) || null;
}

export function getStoredRefreshToken() {
  return getCookie(REFRESH_TOKEN_KEY) || null;
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
  // Store authentication tokens strictly in browser cookies
  if (token) {
    setCookie(TOKEN_KEY, token, { expires: 1 });
  }
  if (refreshToken) {
    setCookie(REFRESH_TOKEN_KEY, refreshToken, { expires: 7 });
  }
  // Clean up any legacy tokens in localStorage
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);

  if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
  if (profile) localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
}

export function clearStoredSession() {
  // Clear authentication cookies
  removeCookie(TOKEN_KEY);
  removeCookie(REFRESH_TOKEN_KEY);

  // Clear legacy tokens and cached user state
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(PROFILE_KEY);
}
