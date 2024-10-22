import {
  getStoredToken,
  getStoredUser,
  getStoredProfile,
  setStoredSession,
  clearStoredSession,
  getStoredRefreshToken,
} from '@/lib/storage';
import {
  loginApi,
  logoutApi,
  updateProfileApi,
  changePasswordApi,
} from '@/api/auth';
import { bumpVersion } from './db';

export const ROLE_OPTIONS = ['admin', 'dept_head', 'teacher', 'student'];

export async function login({ username, role, identifier, password }) {
  const res = await loginApi({ username, role, identifier, password });
  setStoredSession(res.token, res.refreshToken, res.user, res.profile || res.user?.profile);
  bumpVersion();
  return { user: res.user, profile: res.profile || res.user?.profile };
}

export async function logout() {
  try {
    const refreshToken = getStoredRefreshToken();
    if (refreshToken) {
      await logoutApi(refreshToken);
    }
  } catch (e) {
    // Ignore network failure on logout
  }
  clearStoredSession();
  bumpVersion();
  return { ok: true };
}

export function me() {
  const token = getStoredToken();
  const refreshToken = getStoredRefreshToken();
  const user = getStoredUser();
  const profile = getStoredProfile();
  if (!user || (!token && !refreshToken)) {
    if (!token && !refreshToken && user) {
      clearStoredSession();
    }
    throw new Error('Unauthenticated');
  }
  return { user, profile };
}

export async function updateProfile(data) {
  const res = await updateProfileApi(data);
  setStoredSession(null, null, res.user, getStoredProfile());
  bumpVersion();
  return { user: res.user, profile: getStoredProfile() };
}

export async function changePassword({ currentPassword, newPassword, confirmPassword }) {
  if (confirmPassword && newPassword !== confirmPassword) {
    const err = new Error('Passwords do not match.');
    err.fieldErrors = { confirmPassword: 'Passwords do not match.' };
    throw err;
  }
  return await changePasswordApi({ currentPassword, newPassword });
}
