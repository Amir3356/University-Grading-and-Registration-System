import { api } from './client';

/**
 * User & People Management API calls
 */

export async function listUsers(params = {}) {
  return await api.get('/users', params);
}

export async function getUser(id) {
  return await api.get(`/users/${id}`);
}

export async function suggestEmail(name) {
  return await api.get('/users/suggest-email', { name });
}

export async function suggestIdentifier(roleId, departmentId) {
  return await api.get('/users/suggest-identifier', { roleId, departmentId });
}

export async function createUser(data) {
  return await api.post('/users', data);
}

export async function updateUser(id, data) {
  return await api.put(`/users/${id}`, data);
}

export async function setUserStatus(id, { status, reason } = {}) {
  return await api.post(`/users/${id}/toggle-status`, { status, reason });
}

export async function resetUserPassword(id) {
  return await api.post(`/users/${id}/reset-password`);
}

export async function deleteUser(id) {
  return await api.delete(`/users/${id}`);
}

export async function searchStudents(params = {}) {
  return await api.get('/students', params);
}

export async function listTeachers(params = {}) {
  return await api.get('/teachers', params);
}

// Backward-compatible named aliases
export const listUsersApi = listUsers;
export const getUserApi = getUser;
export const suggestEmailApi = suggestEmail;
export const suggestIdentifierApi = suggestIdentifier;
export const createUserApi = createUser;
export const updateUserApi = updateUser;
export const setUserStatusApi = setUserStatus;
export const resetUserPasswordApi = resetUserPassword;
export const deleteUserApi = deleteUser;
export const searchStudentsApi = searchStudents;
export const listTeachersApi = listTeachers;
