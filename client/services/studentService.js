import * as studentApi from '@/api/student';

/**
 * Frontend Student Logic Service
 * Computes degree progress, credit metrics, and course rosters for the student workspace.
 */

export async function getStudentDashboard() {
  return await studentApi.getStudentDashboard();
}

export async function listMyCourses(params = {}) {
  return await studentApi.listMyCourses(params);
}

export async function getMyCourseDetail(enrollmentId) {
  return await studentApi.getMyCourse(enrollmentId);
}

export async function getMyGrades(params = {}) {
  return await studentApi.getMyGrades(params);
}

export async function getMyProgress() {
  const progress = await studentApi.getMyProgress();
  const requiredCredits = progress?.requiredCredits || 140;
  const earnedCredits = progress?.earnedCredits || 0;
  const percentComplete = Math.min(100, Math.round((earnedCredits / requiredCredits) * 100));

  return {
    ...progress,
    requiredCredits,
    earnedCredits,
    remainingCredits: Math.max(0, requiredCredits - earnedCredits),
    percentComplete,
  };
}

export async function getMyTranscript() {
  return await studentApi.getMyTranscript();
}

export async function getGradeReport(semesterId) {
  return await studentApi.getGradeReport(semesterId);
}
