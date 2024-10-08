/**
 * Grading configuration, assessment categories, and GPA scale defaults.
 */

export const DEFAULT_GRADE_SCALE = [
  { letter: 'A', min: 90, max: 100, points: 4.0 },
  { letter: 'A-', min: 85, max: 89.99, points: 3.75 },
  { letter: 'B+', min: 80, max: 84.99, points: 3.5 },
  { letter: 'B', min: 75, max: 79.99, points: 3.0 },
  { letter: 'B-', min: 70, max: 74.99, points: 2.75 },
  { letter: 'C+', min: 65, max: 69.99, points: 2.5 },
  { letter: 'C', min: 60, max: 64.99, points: 2.0 },
  { letter: 'D', min: 50, max: 59.99, points: 1.0 },
  { letter: 'F', min: 0, max: 49.99, points: 0.0 },
];

export const SPECIAL_GRADES = {
  W: { letter: 'W', label: 'Withdrawn' },
  I: { letter: 'I', label: 'Incomplete' },
};

export const ASSESSMENT_TYPES = [
  { value: 'assignment', label: 'Assignment' },
  { value: 'quiz', label: 'Quiz' },
  { value: 'midterm', label: 'Midterm Exam' },
  { value: 'final', label: 'Final Exam' },
  { value: 'practical', label: 'Practical Exam' },
  { value: 'project', label: 'Project' },
];

export const ACADEMIC_LIMITS = {
  MIN_CREDITS_PER_SEMESTER: 12,
  MAX_CREDITS_PER_SEMESTER: 21,
  PASSING_GRADE_POINTS: 2.0,
  MAX_GPA: 4.0,
};
