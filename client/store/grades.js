import {
  getGradingConfigApi,
  updateGradeScaleApi,
  updatePolicyApi,
  listAssessmentsApi,
  createAssessmentApi,
  updateAssessmentApi,
  deleteAssessmentApi,
  setAssessmentReleasedApi,
  getGradebookApi,
  saveScoresApi,
  importScoresApi,
  submitGradesApi,
  listApprovalRequestsApi,
  getApprovalRequestApi,
  approveGradesApi,
  rejectGradesApi,
  publishGradesApi,
  getOfferingPerformanceApi,
  getGradeHistoryApi,
} from '@/api/grades';
import { bumpVersion } from './db';

export async function getGradingConfig() {
  return await getGradingConfigApi();
}

export async function updateGradeScale(entries) {
  const result = await updateGradeScaleApi(entries);
  bumpVersion();
  return result;
}

export async function updatePolicy(patch) {
  const result = await updatePolicyApi(patch);
  bumpVersion();
  return result;
}

export async function listAssessments(offeringId) {
  return await listAssessmentsApi(offeringId);
}

export async function createAssessment(offeringId, data) {
  const result = await createAssessmentApi(offeringId, data);
  bumpVersion();
  return result;
}

export async function updateAssessment(id, data) {
  const result = await updateAssessmentApi(id, data);
  bumpVersion();
  return result;
}

export async function deleteAssessment(id) {
  const result = await deleteAssessmentApi(id);
  bumpVersion();
  return result;
}

export async function setAssessmentReleased(id, isReleased = true) {
  const result = await setAssessmentReleasedApi(id, isReleased);
  bumpVersion();
  return result;
}

export async function getGradebook(offeringId) {
  return await getGradebookApi(offeringId);
}

export async function saveScores(offeringId, { changes, reason } = {}) {
  const result = await saveScoresApi(offeringId, { changes, reason });
  bumpVersion();
  return result;
}

export async function importScores(offeringId, { records, dryRun = true, reason } = {}) {
  const result = await importScoresApi(offeringId, { records, dryRun, reason });
  if (!dryRun) bumpVersion();
  return result;
}

export async function submitGrades(offeringId, { note } = {}) {
  const result = await submitGradesApi(offeringId, { note });
  bumpVersion();
  return result;
}

export async function listApprovalRequests(params = {}) {
  return await listApprovalRequestsApi(params);
}

export async function getApprovalRequest(id) {
  return await getApprovalRequestApi(id);
}

export async function approveGrades(requestId, { comment, publish = false } = {}) {
  const result = await approveGradesApi(requestId, { comment, publish });
  bumpVersion();
  return result;
}

export async function rejectGrades(requestId, { comment } = {}) {
  const result = await rejectGradesApi(requestId, { comment });
  bumpVersion();
  return result;
}

export async function publishGrades(requestId) {
  const result = await publishGradesApi(requestId);
  bumpVersion();
  return result;
}

export async function getOfferingPerformance(offeringId) {
  return await getOfferingPerformanceApi(offeringId);
}

export async function getGradeHistory(offeringId) {
  return await getGradeHistoryApi(offeringId);
}
