import { api } from './client';

/**
 * Academic Complaints API endpoints with server-side pagination
 */

export async function listStudentComplaints(params = {}) {
  return await api.get('/student/complaints', params);
}

export async function submitStudentComplaint(data) {
  return await api.post('/student/complaints', data);
}

export async function updateStudentComplaint(id, data) {
  return await api.patch(`/student/complaints/${id}`, data);
}

export async function cancelStudentComplaint(id) {
  return await api.delete(`/student/complaints/${id}`);
}

export async function listTeacherComplaints(params = {}) {
  return await api.get('/teacher/complaints', params);
}

export async function acceptTeacherComplaint(id, data = {}) {
  return await api.post(`/teacher/complaints/${id}/accept`, data);
}

export async function respondTeacherComplaint(id, data = {}) {
  return await api.post(`/teacher/complaints/${id}/respond`, data);
}
