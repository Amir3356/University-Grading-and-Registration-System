import * as reportsApi from '@/api/reports';
import * as settingsApi from '@/api/settings';
import { bumpVersion } from '@/store/db';

/**
 * Frontend Report & Analytics Service
 */

export async function getAdminDashboard() {
  return await reportsApi.getAdminDashboard();
}

export async function getDeptDashboard() {
  return await reportsApi.getDeptDashboard();
}

export async function getMissingGradesReport(params = {}) {
  return await reportsApi.getMissingGradesReport(params);
}

export async function getDepartmentReport(params = {}) {
  return await reportsApi.getDepartmentReport(params);
}

export async function getCourseResultsReport(params = {}) {
  return await reportsApi.getCourseResultsReport(params);
}

export async function getGradeDistributionReport(params = {}) {
  return await reportsApi.getGradeDistributionReport(params);
}

export async function getGpaReport(params = {}) {
  return await reportsApi.getGpaReport(params);
}

export async function getStudentTranscript(studentId) {
  return await reportsApi.getStudentTranscript(studentId);
}

export async function getStudentPerformanceReport(studentId) {
  return await reportsApi.getStudentPerformanceReport(studentId);
}

export async function getCourseGradeSheet(offeringId) {
  return await reportsApi.getCourseGradeSheet(offeringId);
}

export async function getUniversitySettings() {

  return await settingsApi.getUniversitySettings();
}

export async function updateUniversitySettings(data) {
  const result = await settingsApi.updateUniversitySettings(data);
  bumpVersion();
  return result;
}

export async function resetDemoData() {
  const result = await settingsApi.resetDemoData();
  bumpVersion();
  return result;
}
