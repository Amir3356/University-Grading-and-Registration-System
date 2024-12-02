import { api } from './client';

/**
 * Student Workspace API calls
 */

export async function getStudentDashboard() {
  return await api.get('/student/dashboard');
}

export async function listMyCourses(params = {}) {
  const res = await api.get('/student/courses', params);
  const items = Array.isArray(res) ? res : (res?.items || res?.courses || []);
  if (res && typeof res === 'object' && 'total' in res) {
    items.total = res.total;
  }
  return items;
}

export async function listMyCoursesPaginated(params = {}) {
  return await api.get('/student/courses', params);
}

export async function getMyCourse(enrollmentId) {
  return await api.get(`/student/courses/${enrollmentId}`);
}

export async function listMyAssessments(params = {}) {
  const res = await api.get('/student/assessments', params);
  const items = Array.isArray(res) ? res : (res?.items || res?.assessments || []);
  if (res && typeof res === 'object') {
    items.total = res.total;
    items.page = res.page;
    items.pageSize = res.pageSize;
    items.pageCount = res.pageCount;
  }
  return items;
}

export async function listMyAssessmentsPaginated(params = {}) {
  return await api.get('/student/assessments', params);
}

export async function getMyGrades(params = {}) {
  return await api.get('/student/grades', params);
}

export async function getMyProgress() {
  return await api.get('/student/progress');
}

export async function getMyTranscript() {
  return await api.get('/student/transcript');
}

export async function getGradeReport(semesterId) {
  return await api.get('/student/grade-report', { semesterId });
}

// Backward-compatible named aliases
export const getStudentDashboardApi = getStudentDashboard;
export const listMyCoursesApi = listMyCourses;
export const listMyCoursesPaginatedApi = listMyCoursesPaginated;
export const getMyCourseApi = getMyCourse;
export const listMyAssessmentsApi = listMyAssessments;
export const listMyAssessmentsPaginatedApi = listMyAssessmentsPaginated;
export const getMyGradesApi = getMyGrades;
export const getMyProgressApi = getMyProgress;
export const getMyTranscriptApi = getMyTranscript;
export const getGradeReportApi = getGradeReport;
