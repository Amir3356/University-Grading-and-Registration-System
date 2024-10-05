import { api } from '@/api/client'
import { bumpVersion } from './db'

export async function getAdminDashboard() {
  return await api.get('/reports/admin-dashboard')
}

export async function getDeptDashboard() {
  return await api.get('/reports/dept-dashboard')
}

export async function getMissingGradesReport(params = {}) {
  return await api.get('/reports/missing-grades', params)
}

export async function getDepartmentReport(params = {}) {
  return await api.get('/reports/departments', params)
}

export async function getCourseResultsReport(params = {}) {
  return await api.get('/reports/course-results', params)
}

export async function getGradeDistributionReport(params = {}) {
  return await api.get('/reports/grade-distribution', params)
}

export async function getGpaReport(params = {}) {
  return await api.get('/reports/gpa', params)
}

export async function buildTranscript(studentId) {
  return await api.get(`/students/${studentId}/transcript`)
}

export async function getTranscript(studentId) {
  return await api.get(`/students/${studentId}/transcript`)
}

export async function getStudentPerformanceReport(studentId) {
  return await api.get(`/students/${studentId}/performance`)
}

export async function getCourseGradeSheet(offeringId) {
  return await api.get(`/offerings/${offeringId}/performance`)
}

export async function listAuditLogs(params = {}) {
  return await api.get('/audit-logs', params)
}

export async function listAuditActions() {
  return await api.get('/audit-logs/actions')
}

export async function getSettings() {
  return await api.get('/settings')
}

export async function updateUniversitySettings(data) {
  const result = await api.put('/settings/university', data)
  bumpVersion()
  return result
}

export async function resetDemoData() {
  const result = await api.post('/system/reset-demo-data')
  bumpVersion()
  return result
}
