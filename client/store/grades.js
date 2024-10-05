import { api } from '@/api/client'
import { bumpVersion } from './db'

export async function getGradingConfig() {
  return await api.get('/grading/config')
}

export async function updateGradeScale(entries) {
  const result = await api.put('/grading/scale', { entries })
  bumpVersion()
  return result
}

export async function updatePolicy(patch) {
  const result = await api.put('/grading/policy', patch)
  bumpVersion()
  return result
}

export async function listAssessments(offeringId) {
  return await api.get(`/offerings/${offeringId}/assessments`)
}

export async function createAssessment(offeringId, data) {
  const result = await api.post(`/offerings/${offeringId}/assessments`, data)
  bumpVersion()
  return result
}

export async function updateAssessment(id, data) {
  const result = await api.put(`/assessments/${id}`, data)
  bumpVersion()
  return result
}

export async function deleteAssessment(id) {
  const result = await api.delete(`/assessments/${id}`)
  bumpVersion()
  return result
}

export async function setAssessmentReleased(id, isReleased = true) {
  const result = await api.post(`/assessments/${id}/release`, { isReleased })
  bumpVersion()
  return result
}

export async function getGradebook(offeringId) {
  return await api.get(`/offerings/${offeringId}/gradebook`)
}

export async function saveScores(offeringId, { changes, reason } = {}) {
  const result = await api.patch(`/offerings/${offeringId}/scores`, { changes, reason })
  bumpVersion()
  return result
}

export async function importScores(offeringId, { records, dryRun = true, reason } = {}) {
  const result = await api.post(`/offerings/${offeringId}/gradebook/import`, { records, dryRun, reason })
  if (!dryRun) bumpVersion()
  return result
}

export async function submitGrades(offeringId, { note } = {}) {
  const result = await api.post(`/offerings/${offeringId}/grade-submissions`, { note })
  bumpVersion()
  return result
}

export async function listApprovalRequests(params = {}) {
  return await api.get('/grade-submissions', params)
}

export async function getApprovalRequest(id) {
  return await api.get(`/grade-submissions/${id}`)
}

export async function approveGrades(requestId, { comment, publish = false } = {}) {
  let result
  if (publish) {
    result = await api.post(`/grade-submissions/${requestId}/publish`)
  } else {
    result = await api.post(`/grade-submissions/${requestId}/approve`, { comment })
  }
  bumpVersion()
  return result
}

export async function rejectGrades(requestId, { comment } = {}) {
  const result = await api.post(`/grade-submissions/${requestId}/reject`, { comment })
  bumpVersion()
  return result
}

export async function publishGrades(requestId) {
  const result = await api.post(`/grade-submissions/${requestId}/publish`)
  bumpVersion()
  return result
}

export async function getOfferingPerformance(offeringId) {
  return await api.get(`/offerings/${offeringId}/performance`)
}

export async function getGradeHistory(offeringId) {
  return await api.get(`/offerings/${offeringId}/grade-history`)
}
