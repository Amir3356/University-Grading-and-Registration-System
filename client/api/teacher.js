import { api } from './client';

/**
 * Teacher Workspace API calls
 */

export async function getTeacherDashboard() {
  return await api.get('/teacher/dashboard');
}

export async function listMyOfferings(params = {}) {
  const res = await api.get('/teacher/offerings', params);
  const items = Array.isArray(res) ? res : (res?.items || res?.offerings || []);
  if (res && typeof res === 'object' && 'total' in res) {
    items.total = res.total;
  }
  return items;
}

export async function getMyOffering(offeringId) {
  return await api.get(`/teacher/offerings/${offeringId}`);
}

export async function listMyStudents(params = {}) {
  const res = await api.get('/teacher/students', params);
  const items = Array.isArray(res) ? res : (res?.items || res?.students || []);
  if (res && typeof res === 'object' && 'total' in res) {
    items.total = res.total;
  }
  return items;
}

export async function getStudentPerformance(offeringId, enrollmentId) {
  const target = enrollmentId || offeringId;
  return await api.get(`/students/${target}/performance`);
}

// Backward-compatible named aliases
export const getTeacherDashboardApi = getTeacherDashboard;
export const listMyOfferingsApi = listMyOfferings;
export const getMyOfferingApi = getMyOffering;
export const listMyStudentsApi = listMyStudents;
export const getStudentPerformanceApi = getStudentPerformance;
