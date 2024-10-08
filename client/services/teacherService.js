import * as teacherApi from '@/api/teacher';

/**
 * Frontend Teacher Logic Service
 * Computes teacher workload, section grading progress, and student performance rosters.
 */

export async function getTeacherDashboard() {
  return await teacherApi.getTeacherDashboard();
}

export async function listMyOfferings(params = {}) {
  return await teacherApi.listMyOfferings(params);
}

export async function getMyOffering(offeringId) {
  return await teacherApi.getMyOffering(offeringId);
}

export async function listMyStudents(params = {}) {
  return await teacherApi.listMyStudents(params);
}

export async function getStudentPerformance(offeringId, enrollmentId) {
  return await teacherApi.getStudentPerformance(offeringId, enrollmentId);
}
