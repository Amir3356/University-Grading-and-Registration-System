import {
  getAdminDashboardApi,
  getDeptDashboardApi,
  getMissingGradesReportApi,
  getDepartmentReportApi,
  getCourseResultsReportApi,
  getGradeDistributionReportApi,
  getGpaReportApi,
  getStudentTranscriptApi,
  getStudentPerformanceReportApi,
  getCourseGradeSheetApi,
} from '@/api/reports';

import {
  getSettingsApi,
  updateUniversitySettingsApi,
  resetDemoDataApi,
} from '@/api/settings';
import { bumpVersion } from './db';

export async function getAdminDashboard() {
  return await getAdminDashboardApi();
}

export async function getDeptDashboard() {
  return await getDeptDashboardApi();
}

export async function getMissingGradesReport(params = {}) {
  return await getMissingGradesReportApi(params);
}

export async function getDepartmentReport(params = {}) {
  return await getDepartmentReportApi(params);
}

export async function getCourseResultsReport(params = {}) {
  return await getCourseResultsReportApi(params);
}

export async function getGradeDistributionReport(params = {}) {
  return await getGradeDistributionReportApi(params);
}

export async function getGpaReport(params = {}) {
  return await getGpaReportApi(params);
}

export async function buildTranscript(studentId) {
  return await getStudentTranscriptApi(studentId);
}

export async function getTranscript(studentId) {
  return await getStudentTranscriptApi(studentId);
}

export async function getStudentPerformanceReport(studentId) {
  return await getStudentPerformanceReportApi(studentId);
}

export async function getCourseGradeSheet(offeringId) {
  return await getCourseGradeSheetApi(offeringId);
}

export async function getSettings() {

  return await getSettingsApi();
}

export async function updateUniversitySettings(data) {
  const result = await updateUniversitySettingsApi(data);
  bumpVersion();
  return result;
}

export async function resetDemoData() {
  const result = await resetDemoDataApi();
  bumpVersion();
  return result;
}
