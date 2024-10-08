import { api } from './client';

/**
 * Registration Periods & Requests API calls
 */

export async function listRegistrationPeriods(params = {}) {
  return await api.get('/registration-periods', params);
}

export async function createRegistrationPeriod(data) {
  return await api.post('/registration-periods', data);
}

export async function updateRegistrationPeriod(id, data) {
  return await api.put(`/registration-periods/${id}`, data);
}

export async function deleteRegistrationPeriod(id) {
  return await api.delete(`/registration-periods/${id}`);
}

export async function listSemesterRegistrations(params = {}) {
  return await api.get('/semester-registrations', params);
}

export async function reviewSemesterRegistration(id, data) {
  return await api.post(`/semester-registrations/${id}/review`, data);
}

export async function getStudentRegistrations(params = {}) {
  return await api.get('/student/registrations', params);
}

export async function submitStudentRegistration(data) {
  return await api.post('/student/registrations', data);
}

// Backward-compatible named aliases
export const listRegistrationPeriodsApi = listRegistrationPeriods;
export const createRegistrationPeriodApi = createRegistrationPeriod;
export const updateRegistrationPeriodApi = updateRegistrationPeriod;
export const deleteRegistrationPeriodApi = deleteRegistrationPeriod;
export const listSemesterRegistrationsApi = listSemesterRegistrations;
export const reviewSemesterRegistrationApi = reviewSemesterRegistration;
export const getStudentRegistrationsApi = getStudentRegistrations;
export const submitStudentRegistrationApi = submitStudentRegistration;
