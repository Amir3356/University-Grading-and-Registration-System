import { api } from './client';

/**
 * Reports, Dashboards, Transcripts, and Audit Log API calls
 */

export async function getAdminDashboard() {
  return await api.get('/reports/admin-dashboard');
}

export async function getDeptDashboard() {
  return await api.get('/reports/dept-dashboard');
}

export async function getMissingGradesReport(params = {}) {
  return await api.get('/reports/missing-grades', params);
}

export async function getDepartmentReport(params = {}) {
  return await api.get('/reports/departments', params);
}

export async function getCourseResultsReport(params = {}) {
  return await api.get('/reports/course-results', params);
}

export async function getGradeDistributionReport(params = {}) {
  return await api.get('/reports/grade-distribution', params);
}

export async function getGpaReport(params = {}) {
  return await api.get('/reports/gpa', params);
}

export async function getStudentTranscript(studentId) {
  return await api.get(`/students/${studentId}/transcript`);
}

export async function getStudentPerformanceReport(studentId) {
  return await api.get(`/students/${studentId}/performance`);
}

export async function getCourseGradeSheet(offeringId) {
  return await api.get(`/offerings/${offeringId}/performance`);
}

export async function exportReport(type, params = {}) {
  return await api.get(`/reports/export/${type}`, params);
}

// Backward-compatible named aliases
export const getAdminDashboardApi = getAdminDashboard;
export const getDeptDashboardApi = getDeptDashboard;
export const getMissingGradesReportApi = getMissingGradesReport;
export const getDepartmentReportApi = getDepartmentReport;
export const getCourseResultsReportApi = getCourseResultsReport;
export const getGradeDistributionReportApi = getGradeDistributionReport;
export const getGpaReportApi = getGpaReport;
export const getStudentTranscriptApi = getStudentTranscript;
export const getStudentPerformanceReportApi = getStudentPerformanceReport;
export const getCourseGradeSheetApi = getCourseGradeSheet;
export const exportReportApi = exportReport;

