import { api } from './client';

/**
 * Grading, Assessments, Gradebook, Submissions, and Reviews API calls
 */

export async function getGradingConfig() {
  return await api.get('/grading/config');
}

export async function updateGradeScale(entries) {
  return await api.put('/grading/scale', { entries });
}

export async function updatePolicy(patch) {
  return await api.put('/grading/policy', patch);
}

export async function listAssessments(offeringId) {
  return await api.get(`/offerings/${offeringId}/assessments`);
}

export async function createAssessment(offeringId, data) {
  return await api.post(`/offerings/${offeringId}/assessments`, data);
}

export async function updateAssessment(id, data) {
  return await api.put(`/assessments/${id}`, data);
}

export async function deleteAssessment(id) {
  return await api.delete(`/assessments/${id}`);
}

export async function setAssessmentReleased(id, isReleased = true) {
  return await api.post(`/assessments/${id}/release`, { isReleased });
}

export async function getGradebook(offeringId) {
  return await api.get(`/offerings/${offeringId}/gradebook`);
}

export async function saveScores(offeringId, { changes, reason } = {}) {
  return await api.patch(`/offerings/${offeringId}/scores`, { changes, reason });
}

export async function importScores(offeringId, { records, dryRun = true, reason } = {}) {
  return await api.post(`/offerings/${offeringId}/gradebook/import`, { records, dryRun, reason });
}

export async function submitGrades(offeringId, { note } = {}) {
  return await api.post(`/offerings/${offeringId}/grade-submissions`, { note });
}

export async function listApprovalRequests(params = {}) {
  return await api.get('/grade-submissions', params);
}

export async function getApprovalRequest(id) {
  return await api.get(`/grade-submissions/${id}`);
}

export async function approveGrades(requestId, { comment, publish = false } = {}) {
  if (publish) {
    return await api.post(`/grade-submissions/${requestId}/publish`);
  }
  return await api.post(`/grade-submissions/${requestId}/approve`, { comment });
}

export async function rejectGrades(requestId, { comment } = {}) {
  return await api.post(`/grade-submissions/${requestId}/reject`, { comment });
}

export async function publishGrades(requestId) {
  return await api.post(`/grade-submissions/${requestId}/publish`);
}

export async function getOfferingPerformance(offeringId) {
  return await api.get(`/offerings/${offeringId}/performance`);
}

export async function getGradeHistory(offeringId) {
  return await api.get(`/offerings/${offeringId}/grade-history`);
}

// Backward-compatible named aliases
export const getGradingConfigApi = getGradingConfig;
export const updateGradeScaleApi = updateGradeScale;
export const updatePolicyApi = updatePolicy;
export const listAssessmentsApi = listAssessments;
export const createAssessmentApi = createAssessment;
export const updateAssessmentApi = updateAssessment;
export const deleteAssessmentApi = deleteAssessment;
export const setAssessmentReleasedApi = setAssessmentReleased;
export const getGradebookApi = getGradebook;
export const saveScoresApi = saveScores;
export const importScoresApi = importScores;
export const submitGradesApi = submitGrades;
export const listApprovalRequestsApi = listApprovalRequests;
export const getApprovalRequestApi = getApprovalRequest;
export const approveGradesApi = approveGrades;
export const rejectGradesApi = rejectGrades;
export const publishGradesApi = publishGrades;
export const getOfferingPerformanceApi = getOfferingPerformance;
export const getGradeHistoryApi = getGradeHistory;
