import * as gradesApi from '@/api/grades';
import {
  DEFAULT_GRADE_SCALE,
  DEFAULT_POLICY,
  round,
  sumWeights,
  weightsAreValid,
  validateMark,
  computeWeightedTotal,
  gradeForScore,
  isPassing,
  validateGradeScale,
  computeAcademicRecord,
} from '@/lib/grading';
import { bumpVersion } from '@/store/db';

/**
 * Frontend Grade Service
 * Handles gradebook calculations, weighted assessment totals, GPA records, and submission flows.
 */

export {
  DEFAULT_GRADE_SCALE,
  DEFAULT_POLICY,
  round,
  sumWeights,
  weightsAreValid,
  validateMark,
  computeWeightedTotal,
  gradeForScore,
  isPassing,
  validateGradeScale,
  computeAcademicRecord,
};

export async function getGradebook(offeringId) {
  return await gradesApi.getGradebook(offeringId);
}

export async function saveGradebookScores(offeringId, { changes, reason = 'Score entry update' }) {
  if (!changes || changes.length === 0) return { ok: true, count: 0 };
  const res = await gradesApi.saveScores(offeringId, { changes, reason });
  bumpVersion();
  return res;
}

export async function submitGrades(offeringId, { note } = {}) {
  const res = await gradesApi.submitGrades(offeringId, { note });
  bumpVersion();
  return res;
}

export async function approveGrades(requestId, { comment, publish = false } = {}) {
  const res = await gradesApi.approveGrades(requestId, { comment, publish });
  bumpVersion();
  return res;
}

export async function rejectGrades(requestId, { comment } = {}) {
  const res = await gradesApi.rejectGrades(requestId, { comment });
  bumpVersion();
  return res;
}

export async function publishGrades(requestId) {
  const res = await gradesApi.publishGrades(requestId);
  bumpVersion();
  return res;
}

export async function createAssessment(offeringId, data) {
  const res = await gradesApi.createAssessment(offeringId, data);
  bumpVersion();
  return res;
}

export async function updateAssessment(id, data) {
  const res = await gradesApi.updateAssessment(id, data);
  bumpVersion();
  return res;
}

export async function deleteAssessment(id) {
  const res = await gradesApi.deleteAssessment(id);
  bumpVersion();
  return res;
}

export async function setAssessmentReleased(id, isReleased = true) {
  const res = await gradesApi.setAssessmentReleased(id, isReleased);
  bumpVersion();
  return res;
}

/**
 * Calculate grade distribution counts from an array of student grade objects.
 */
export function calculateGradeDistribution(grades = []) {
  const counts = {};
  for (const g of grades) {
    const letter = g.letter || g.grade || 'Ungraded';
    counts[letter] = (counts[letter] || 0) + 1;
  }
  return counts;
}

/**
 * Detect students whose running total is at risk of failing the course.
 */
export function findAtRiskStudents(students = [], passMark = 50, warningMargin = 10) {
  return students.filter((s) => {
    const total = s.totalScore ?? s.total ?? s.runningScore;
    if (total == null) return false;
    return total < passMark + warningMargin;
  });
}
