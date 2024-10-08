/**
 * Storage utility for client-side authentication and session state.
 * Manages localStorage tokens, cached user objects, and profile records.
 */

import { TOKEN_KEY, REFRESH_TOKEN_KEY, USER_KEY, PROFILE_KEY } from '@/config/constants';

export { TOKEN_KEY, REFRESH_TOKEN_KEY, USER_KEY, PROFILE_KEY };

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
