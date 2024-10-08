import {
  listUsersApi,
  getUserApi,
  suggestEmailApi,
  suggestIdentifierApi,
  createUserApi,
  updateUserApi,
  setUserStatusApi,
  resetUserPasswordApi,
  deleteUserApi,
  searchStudentsApi,
} from '@/api/users';
import { bumpVersion } from './db';

export async function listUsers(params = {}) {
  return await listUsersApi(params);
}

export async function getUser(id) {
  return await getUserApi(id);
}

export async function suggestEmail(name) {
  return await suggestEmailApi(name);
}

export async function suggestIdentifier(roleId, departmentId) {
  return await suggestIdentifierApi(roleId, departmentId);
}

export async function createUser(data) {
  const result = await createUserApi(data);
  bumpVersion();
  return result;
}

export async function updateUser(id, data) {
  const result = await updateUserApi(id, data);
  bumpVersion();
  return result;
}

export async function setUserStatus(id, { status, reason } = {}) {
  const result = await setUserStatusApi(id, { status, reason });
  bumpVersion();
  return result;
}

export async function resetUserPassword(id) {
  const result = await resetUserPasswordApi(id);
  bumpVersion();
  return result;
}

export async function deleteUser(id) {
  const result = await deleteUserApi(id);
  bumpVersion();
  return result;
}

export async function searchStudents(params = {}) {
  return await searchStudentsApi(params);
}
