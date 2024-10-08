import * as usersApi from '@/api/users';
import { validateForm, createUserFormSchema, editUserFormSchema } from '@/lib/validators';
import { bumpVersion } from '@/store/db';

/**
 * Frontend User Service
 * Handles user provisioning, profile updates, status toggling, and username/email generation.
 */

export async function listUsers(params = {}) {
  return await usersApi.listUsers(params);
}

export async function getUser(id) {
  return await usersApi.getUser(id);
}

export async function createUser(data) {
  const validation = validateForm(createUserFormSchema, data);
  if (!validation.success) {
    const err = new Error('Please correct the highlighted fields.');
    err.fieldErrors = validation.errors;
    throw err;
  }

  const result = await usersApi.createUser(validation.data);
  bumpVersion();
  return result;
}

export async function updateUser(id, data) {
  const validation = validateForm(editUserFormSchema, data);
  if (!validation.success) {
    const err = new Error('Please correct the highlighted fields.');
    err.fieldErrors = validation.errors;
    throw err;
  }

  const result = await usersApi.updateUser(id, validation.data);
  bumpVersion();
  return result;
}

export async function setUserStatus(id, { status, reason } = {}) {
  const result = await usersApi.setUserStatus(id, { status, reason });
  bumpVersion();
  return result;
}

export async function resetUserPassword(id) {
  const result = await usersApi.resetUserPassword(id);
  bumpVersion();
  return result;
}

export async function deleteUser(id) {
  const result = await usersApi.deleteUser(id);
  bumpVersion();
  return result;
}

export async function suggestEmail(name) {
  if (!name || !name.trim()) return '';
  return await usersApi.suggestEmail(name.trim());
}

export async function suggestIdentifier(roleId, departmentId) {
  return await usersApi.suggestIdentifier(roleId, departmentId);
}

export async function searchStudents(params = {}) {
  return await usersApi.searchStudents(params);
}

export async function listTeachers(params = {}) {
  return await usersApi.listTeachers(params);
}
