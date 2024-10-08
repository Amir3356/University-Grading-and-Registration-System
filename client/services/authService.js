import * as authApi from '@/api/auth';
import {
  getStoredUser,
  getStoredProfile,
  setStoredSession,
  clearStoredSession,
  getStoredRefreshToken,
} from '@/lib/storage';
import { validateForm, loginFormSchema, passwordChangeFormSchema } from '@/lib/validators';
import { bumpVersion } from '@/store/db';

/**
 * Frontend Authentication Service
 * Encapsulates authentication workflows, session storage, and role/permission checks.
 */

export async function login({ username, role, identifier, password }) {
  const validation = validateForm(loginFormSchema, { username, role, identifier, password });
  if (!validation.success) {
    const err = new Error('Please fill in required fields.');
    err.fieldErrors = validation.errors;
    throw err;
  }

  const res = await authApi.login(validation.data);
  setStoredSession(res.token, res.refreshToken, res.user, res.profile || res.user?.profile);
  bumpVersion();
  return { user: res.user, profile: res.profile || res.user?.profile };
}

export async function logout() {
  try {
    const refreshToken = getStoredRefreshToken();
    if (refreshToken) {
      await authApi.logout(refreshToken);
    }
  } catch (err) {
    console.warn('Backend logout warning (network offline):', err);
  } finally {
    clearStoredSession();
    bumpVersion();
  }
  return { ok: true };
}

export function getCurrentUser() {
  const user = getStoredUser();
  const profile = getStoredProfile();
  if (!user) throw new Error('Unauthenticated');
  return { user, profile };
}

export async function updateProfile(data) {
  const res = await authApi.updateProfile(data);
  setStoredSession(null, null, res.user, getStoredProfile());
  bumpVersion();
  return { user: res.user, profile: getStoredProfile() };
}

export async function changePassword({ currentPassword, newPassword, confirmPassword }) {
  const validation = validateForm(passwordChangeFormSchema, {
    currentPassword,
    newPassword,
    confirmPassword,
  });
  if (!validation.success) {
    const err = new Error('Password validation failed.');
    err.fieldErrors = validation.errors;
    throw err;
  }
  return await authApi.changePassword({ currentPassword, newPassword });
}

export function hasRole(requiredRoles = []) {
  const user = getStoredUser();
  if (!user) return false;
  const roles = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];
  return roles.includes(user.roleId);
}

export function canManageDepartment(departmentId) {
  const user = getStoredUser();
  if (!user) return false;
  if (user.roleId === 'admin') return true;
  if (user.roleId === 'dept_head') {
    const profile = getStoredProfile();
    return profile?.departmentId === departmentId;
  }
  return false;
}
