// Shared helpers for the teacher pages (non-component exports).
import { ASSESSMENT_TYPES } from '@/lib/grading'

export const LOCKED_STATUSES = ['submitted', 'approved', 'published']
export const PENDING_STATUSES = ['not_started', 'draft', 'rejected']

export const isLockedStatus = (status) => LOCKED_STATUSES.includes(status)

export const typeLabel = (type) => ASSESSMENT_TYPES.find((t) => t.value === type)?.label ?? type

export const lockedExplanation = (status) => {
  if (status === 'published') {
    return 'Grades for this course are published to students and can no longer be modified.'
  }
  if (status === 'approved') {
    return 'Grades for this course have been approved by the Department Head. To adjust marks or assessments, the Department Head must allow editing.'
  }
  return 'Grades for this course were submitted and are locked while the Department Head reviews them.'
}

const ACTION_LABELS = {
  'score.created': 'Marks entered',
  'score.updated': 'Mark changed',
  'score.deleted': 'Mark cleared',
  'assessment.created': 'Assessment created',
  'assessment.updated': 'Assessment updated',
  'assessment.deleted': 'Assessment deleted',
  'assessment.released': 'Marks released',
  'assessment.unreleased': 'Marks hidden',
  'grades.submitted': 'Grades submitted',
  'grades.approved': 'Grades approved',
  'grades.rejected': 'Grades returned',
  'grades.published': 'Grades published',
}

export const actionLabel = (action) => ACTION_LABELS[action] ?? action

const fmtValue = (v) => {
  if (v == null || v === '') return '—'
  if (typeof v === 'object') return Array.isArray(v) ? `${v.length} item(s)` : JSON.stringify(v)
  return String(v)
}

/** "marks: 12 → 14" style description of an audit before/after pair. */
export function describeChange(before, after) {
  if (!before && !after) return null
  const keys = [...new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})])]
  return keys
    .filter((k) => fmtValue(before?.[k]) !== fmtValue(after?.[k]))
    .map((k) => `${k}: ${fmtValue(before?.[k])} → ${fmtValue(after?.[k])}`)
    .join('; ')
}

/** Columns for a full course grade sheet. */
export function gradeSheetColumns(assessments) {
  return [
    { header: 'Student ID', value: (r) => r.student.studentNumber },
    { header: 'Name', value: (r) => r.student.name },
    { header: 'Status', value: (r) => r.enrollment.status },
    ...assessments.map((a) => ({ header: `${a.name} (/${a.maxMarks}, ${a.weight}%)`, value: (r) => r.marks?.[a.id] ?? r.marks?.[a.id.replace(/_([a-z])/g, (_, l) => l.toUpperCase())] ?? '' })),
    { header: 'Total', value: (r) => (r.enrollment.status === 'withdrawn' ? '' : r.complete ? r.total : '') },
    { header: 'Letter', value: (r) => r.letter ?? '' },
    { header: 'Grade points', value: (r) => r.gradePoints ?? '' },
    { header: 'Result', value: (r) => (r.passed == null ? '' : r.passed ? 'Pass' : 'Fail') },
  ]
}
