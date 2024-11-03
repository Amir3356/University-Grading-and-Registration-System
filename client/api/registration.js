import { api } from './client';
import { notifyPeriodChange, notifyRegistrationChange } from '@/lib/syncEvents';

/**
 * Registration Periods & Requests API calls
 */

export async function listRegistrationPeriods(params = {}) {
  return await api.get('/registration-periods', params);
}

export async function createRegistrationPeriod(data) {
  const result = await api.post('/registration-periods', data);
  notifyPeriodChange();
  return result;
}

export async function updateRegistrationPeriod(id, data) {
  const result = await api.put(`/registration-periods/${id}`, data);
  notifyPeriodChange();
  return result;
}

export async function deleteRegistrationPeriod(id) {
  const result = await api.delete(`/registration-periods/${id}`);
  notifyPeriodChange();
  return result;
}

export async function toggleRegistrationPeriod(id) {
  const result = await api.post(`/registration-periods/${id}/toggle`);
  notifyPeriodChange();
  return result;
}

export async function getRegistrationSummary(params = {}) {
  return await api.get('/semester-registrations/summary', params);
}

export async function listSemesterRegistrations(params = {}) {
  return await api.get('/semester-registrations', params);
}

/** data: { status: 'approved' | 'rejected', remarks? } */
export async function reviewSemesterRegistration(id, data) {
  const result = await api.post(`/semester-registrations/${id}/status`, data);
  notifyRegistrationChange();
  return result;
}

export async function updateSemesterRegistrationType(id, registrationTypeId) {
  const result = await api.patch(`/semester-registrations/${id}/type`, { registrationTypeId });
  notifyRegistrationChange();
  return result;
}

export async function deleteSemesterRegistration(id) {
  const result = await api.delete(`/semester-registrations/${id}`);
  notifyRegistrationChange();
  return result;
}

export async function getStudentRegistrations(params = {}) {
  return await api.get('/student/registrations', params);
}

export async function submitStudentRegistration(data) {
  const result = await api.post('/student/registrations', data);
  notifyRegistrationChange();
  return result;
}

export async function cancelStudentRegistration(id) {
  const result = await api.post(`/student/registrations/${id}/cancel`);
  notifyRegistrationChange();
  return result;
}

export async function updateStudentRegistration(id, data) {
  const result = await api.patch(`/student/registrations/${id}`, data);
  notifyRegistrationChange();
  return result;
}

export async function deleteStudentRegistration(id) {
  const result = await api.delete(`/student/registrations/${id}`);
  notifyRegistrationChange();
  return result;
}

// Backward-compatible named aliases
export const listRegistrationPeriodsApi = listRegistrationPeriods;
export const createRegistrationPeriodApi = createRegistrationPeriod;
export const updateRegistrationPeriodApi = updateRegistrationPeriod;
export const deleteRegistrationPeriodApi = deleteRegistrationPeriod;
export const toggleRegistrationPeriodApi = toggleRegistrationPeriod;
export const getRegistrationSummaryApi = getRegistrationSummary;
export const listSemesterRegistrationsApi = listSemesterRegistrations;
export const reviewSemesterRegistrationApi = reviewSemesterRegistration;
export const updateSemesterRegistrationTypeApi = updateSemesterRegistrationType;
export const deleteSemesterRegistrationApi = deleteSemesterRegistration;
export const getStudentRegistrationsApi = getStudentRegistrations;
export const submitStudentRegistrationApi = submitStudentRegistration;
export const updateStudentRegistrationApi = updateStudentRegistration;
export const deleteStudentRegistrationApi = deleteStudentRegistration;
export const cancelStudentRegistrationApi = cancelStudentRegistration;

