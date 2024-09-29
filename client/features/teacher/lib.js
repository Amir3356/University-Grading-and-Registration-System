// Shared helpers for the teacher pages (non-component exports).
import { createPdf, exportCsv, exportExcel, finishPdf, pdfTable } from '@/lib/export'
import { formatNumber, formatPercent } from '@/lib/format'
import { ASSESSMENT_TYPES } from '@/lib/grading'

export const LOCKED_STATUSES = ['submitted', 'approved', 'published']
export const PENDING_STATUSES = ['not_started', 'draft', 'rejected']

export const isLockedStatus = (status) => LOCKED_STATUSES.includes(status)

export const typeLabel = (type) => ASSESSMENT_TYPES.find((t) => t.value === type)?.label ?? type

export const offeringLabel = (o) => (o ? `${o.course.code} — ${o.course.title}` : '')

export const lockedExplanation = (status) =>
  status === 'published'
    ? 'Grades for this course are published to students and can no longer be modified.'
    : status === 'approved'
      ? 'Grades for this course were approved and are awaiting publication. They can no longer be modified.'
      : 'Grades for this course were submitted and are locked while the registrar reviews them.'

/** Pick the default offering: the URL param, else the first current-semester offering, else the first one. */
export function defaultOfferingId(offerings, paramId, currentSemesterId) {
  if (paramId) return paramId
  if (!offerings?.length) return null
  return (offerings.find((o) => o.semesterId === currentSemesterId) ?? offerings[0]).id
}

export const ACTION_LABELS = {
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
    ...assessments.map((a) => ({ header: `${a.name} (/${a.maxMarks}, ${a.weight}%)`, value: (r) => r.marks[a.id] ?? '' })),
    { header: 'Total', value: (r) => (r.enrollment.status === 'withdrawn' ? '' : r.complete ? r.total : '') },
    { header: 'Letter', value: (r) => r.letter ?? '' },
    { header: 'Grade points', value: (r) => r.gradePoints ?? '' },
    { header: 'Result', value: (r) => (r.passed == null ? '' : r.passed ? 'Pass' : 'Dropped') },
  ]
}

/** Export the response of store.reports.getCourseGradeSheet as pdf | xlsx | csv. */
export function exportCourseGradeSheet(sheet, kind) {
  const o = sheet.offering
  const filename = `${o.course.code}_${o.semester.name}_grade_sheet`
  const columns = gradeSheetColumns(sheet.assessments)
  const s = sheet.stats
  const summary = [
    ['Students', s.studentCount],
    ['Complete', s.completeCount],
    ['Class average', formatNumber(s.average, 2)],
    ['Highest', formatNumber(s.highest, 2)],
    ['Lowest', formatNumber(s.lowest, 2)],
    ['Pass rate', formatPercent(s.passRate)],
    ['Passed / failed', `${s.passed} / ${s.failed}`],
  ]
  if (kind === 'csv') return exportCsv(filename, columns, sheet.rows)
  if (kind === 'xlsx') {
    return exportExcel(filename, [
      { name: 'Grade sheet', columns, rows: sheet.rows },
      { name: 'Summary', columns: [{ header: 'Metric', value: (r) => r[0] }, { header: 'Value', value: (r) => r[1] }], rows: summary },
      { name: 'Distribution', columns: [{ header: 'Grade', value: (r) => r.letter }, { header: 'Students', value: (r) => r.count }], rows: s.distribution },
    ])
  }
  const { doc, y } = createPdf({
    title: `Course grade sheet — ${o.course.code} ${o.course.title}`,
    subtitle: [`${o.semester.name} · Section ${o.section} · ${o.teacher?.name ?? ''}`, `Pass mark ${sheet.passMark}% · Weights total ${sheet.weightTotal}%`],
    university: sheet.university,
    orientation: 'landscape',
  })
  const endY = pdfTable(doc, {
    startY: y,
    head: columns.map((c) => c.header),
    body: sheet.rows.map((r) => columns.map((c) => {
      const v = c.value(r)
      return v == null ? '' : String(v)
    })),
  })
  pdfTable(doc, { startY: endY + 16, head: ['Metric', 'Value'], body: summary.map(([k, v]) => [k, String(v ?? '—')]) })
  finishPdf(doc, filename)
}
