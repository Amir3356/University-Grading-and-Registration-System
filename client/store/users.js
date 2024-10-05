import { api } from '@/api/client'
import { bumpVersion } from './db'

export async function listUsers(params = {}) {
  return await api.get('/users', params)
}

export async function getUser(id) {
  return await api.get(`/users/${id}`)
}

export async function suggestEmail(name) {
  return await api.get('/users/suggest-email', { name })
}

export async function suggestIdentifier(roleId, departmentId) {
  return await api.get('/users/suggest-identifier', { roleId, departmentId })
}

export async function createUser(data) {
  const result = await api.post('/users', data)
  bumpVersion()
  return result
}

export async function updateUser(id, data) {
  const result = await api.put(`/users/${id}`, data)
  bumpVersion()
  return result
}

export async function setUserStatus(id, { status, reason } = {}) {
  const result = await api.post(`/users/${id}/toggle-status`, { status, reason })
  bumpVersion()
  return result
}

export async function resetUserPassword(id) {
  const result = await api.post(`/users/${id}/reset-password`)
  bumpVersion()
  return result
}

export async function deleteUser(id) {
  const result = await api.delete(`/users/${id}`)
  bumpVersion()
  return result
}

export async function searchStudents(params = {}) {
  return await api.get('/students', params)
}
