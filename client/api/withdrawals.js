import { api } from './client';

/**
 * Withdrawal Requests & Clearance API calls
 */

async function listWithdrawalRequests(params = {}) {
  return await api.get('/withdrawal-requests', params);
}

export async function approveWithdrawal(id, { adminNotes } = {}) {
  return await api.post(`/withdrawal-requests/${id}/approve`, { adminNotes });
}

export async function rejectWithdrawal(id, { adminNotes } = {}) {
  return await api.post(`/withdrawal-requests/${id}/reject`, { adminNotes });
}

export async function updateClearance(id, office, { status, remarks } = {}) {
  return await api.patch(`/withdrawal-requests/${id}/clearances/${office}`, { status, remarks });
}

async function listStudentWithdrawalRequests() {
  return await api.get('/student/withdrawal-requests');
}

async function submitStudentWithdrawal(data) {
  return await api.post('/student/withdrawal-requests', data);
}

export async function cancelStudentWithdrawal(id) {
  return await api.post(`/student/withdrawal-requests/${id}/cancel`);
}

// Backward-compatible named aliases
export const listWithdrawalRequestsApi = listWithdrawalRequests;
export const approveWithdrawalApi = approveWithdrawal;
export const rejectWithdrawalApi = rejectWithdrawal;
export const updateClearanceApi = updateClearance;
export const listStudentWithdrawalRequestsApi = listStudentWithdrawalRequests;
export const submitStudentWithdrawalApi = submitStudentWithdrawal;
export const cancelStudentWithdrawalApi = cancelStudentWithdrawal;
