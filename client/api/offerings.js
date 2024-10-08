import { api } from './client';

/**
 * Course Offerings & Enrollments API calls
 */

export async function listOfferings(params = {}) {
  return await api.get('/offerings', params);
}

export async function getOffering(id) {
  return await api.get(`/offerings/${id}`);
}

export async function createOffering(data) {
  return await api.post('/offerings', data);
}

export async function updateOffering(id, data) {
  return await api.put(`/offerings/${id}`, data);
}

export async function deleteOffering(id) {
  return await api.delete(`/offerings/${id}`);
}

export async function listOfferingEnrollments(offeringId) {
  return await api.get(`/offerings/${offeringId}/enrollments`);
}

export async function listEligibleStudents(offeringId, params = {}) {
  return await api.get(`/offerings/${offeringId}/eligible-students`, params);
}

export async function enrollStudents(offeringId, studentIds) {
  const ids = Array.isArray(studentIds) ? studentIds : [studentIds];
  return await api.post(`/offerings/${offeringId}/enrollments`, { studentIds: ids });
}

export async function withdrawEnrollment(enrollmentId, { reason } = {}) {
  return await api.post(`/offerings/any/enrollments/${enrollmentId}/withdraw`, { reason });
}

export async function removeEnrollment(enrollmentId) {
  return await api.delete(`/offerings/any/enrollments/${enrollmentId}`);
}

// Backward-compatible named aliases
export const listOfferingsApi = listOfferings;
export const getOfferingApi = getOffering;
export const createOfferingApi = createOffering;
export const updateOfferingApi = updateOffering;
export const deleteOfferingApi = deleteOffering;
export const listOfferingEnrollmentsApi = listOfferingEnrollments;
export const listEligibleStudentsApi = listEligibleStudents;
export const enrollStudentsApi = enrollStudents;
export const withdrawEnrollmentApi = withdrawEnrollment;
export const removeEnrollmentApi = removeEnrollment;
