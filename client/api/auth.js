import { api } from './client';

/**
 * Authentication API calls
 */

export async function login({ username, role, identifier, password }) {
  const payload = {
    username: (username || '').trim(),
    identifier: (identifier || username || '').trim(),
    password: password || undefined,
  };
  if (role) payload.role = role;
  return await api.post('/auth/login', payload);
}

export async function logout(refreshToken) {
  if (!refreshToken) return { ok: true };
  return await api.post('/auth/logout', { refreshToken });
}

export async function getProfile() {
  return await api.get('/auth/profile');
}

export async function updateProfile(data) {
  return await api.put('/auth/profile', data);
}

export async function changePassword({ currentPassword, newPassword }) {
  return await api.put('/auth/password', { currentPassword, newPassword });
}

export async function refreshAccessToken(refreshToken) {
  return await api.post('/auth/refresh', { refreshToken });
}

// Backward-compatible named aliases
export const loginApi = login;
export const logoutApi = logout;
export const getProfileApi = getProfile;
export const updateProfileApi = updateProfile;
export const changePasswordApi = changePassword;
export const refreshAccessTokenApi = refreshAccessToken;
