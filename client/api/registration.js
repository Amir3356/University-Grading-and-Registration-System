import { api } from './client';
import { notifyPeriodChange } from '@/lib/syncEvents';

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
  return await api.post(`/semester-registrations/${id}/status`, data);
}

export async function updateSemesterRegistrationType(id, registrationTypeId) {
  return await api.patch(`/semester-registrations/${id}/type`, { registrationTypeId });
}

export async function deleteSemesterRegistration(id) {
  return await api.delete(`/semester-registrations/${id}`);
}

export async function getStudentRegistrations(params = {}) {
  return await api.get('/student/registrations', params);
}

export async function submitStudentRegistration(data) {
  return await api.post('/student/registrations', data);
}

export async function cancelStudentRegistration(id) {
  return await api.post(`/student/registrations/${id}/cancel`);
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
export const cancelStudentRegistrationApi = cancelStudentRegistration;
