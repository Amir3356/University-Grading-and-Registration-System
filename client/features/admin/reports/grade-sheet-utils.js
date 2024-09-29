// Shared helpers for course grade sheets (approval detail + grade sheet report).
import { createPdf, finishPdf, pdfTable } from '@/lib/export'
import { formatNumber, formatPercent, GRADE_STATUS_LABELS } from '@/lib/format'

export const isWithdrawn = (r) => r.enrollment?.status === 'withdrawn'

export const resultLabel = (r) => (isWithdrawn(r) ? 'Withdrawn' : r.passed == null ? 'Incomplete' : r.passed ? 'Pass' : 'Dropped')

/** Export columns ({header, value}) for a grade sheet. */
export function gradeSheetExportColumns(assessments) {
  return [
    { header: 'Student ID', value: (r) => r.student?.studentNumber },
    { header: 'Name', value: (r) => r.student?.name },
    ...assessments.map((a) => ({ header: `${a.name} (/${a.maxMarks}, ${a.weight}%)`, value: (r) => r.marks[a.id] ?? '' })),
    { header: 'Total', value: (r) => (isWithdrawn(r) ? '' : r.total) },
    { header: 'Letter', value: (r) => r.letter ?? '' },
    { header: 'Points', value: (r) => (r.gradePoints != null ? r.gradePoints.toFixed(2) : '') },
    { header: 'Result', value: (r) => resultLabel(r) },
  ]
}

export function sheetTitle(sheet) {
  const o = sheet.offering
  return `${o.course.code} ${o.course.title} — ${o.semester?.name ?? ''}`
}

/** Landscape, branded PDF of a full grade sheet with header info, summary and weights. */
export function downloadGradeSheetPdf(sheet, university) {
  const o = sheet.offering
  const s = sheet.stats
  const { doc, y } = createPdf({
    title: `Course Grade Sheet — ${o.course.code} ${o.course.title}`,
    university: university ?? sheet.university,
    orientation: 'landscape',
    subtitle: [
      `Semester: ${o.semester?.name ?? '—'}    Section: ${o.section ?? '—'}    Teacher: ${o.teacher?.name ?? 'Unassigned'}    Credit hours: ${o.course.creditHours}`,
      `Grade status: ${GRADE_STATUS_LABELS[o.gradeStatus] ?? o.gradeStatus}    Pass mark: ${sheet.passMark}%    Assessment weights: ${sheet.weightTotal}%`,
      `Students: ${s.studentCount}    Average: ${formatNumber(s.average, 1)}    Pass rate: ${formatPercent(s.passRate)}    Highest: ${formatNumber(s.highest, 1)}    Lowest: ${formatNumber(s.lowest, 1)}`,
    ],
  })
  const cols = gradeSheetExportColumns(sheet.assessments)
  let end = pdfTable(doc, {
    startY: y,
    head: cols.map((c) => c.header),
    body: sheet.rows.map((r) => cols.map((c) => c.value(r) ?? '')),
    columnStyles: { 0: { cellWidth: 70 } },
  })
  const pageH = doc.internal.pageSize.getHeight()
  if (end > pageH - 120) {
    doc.addPage()
    end = 30
  }
  pdfTable(doc, {
    startY: end + 16,
    head: ['Assessment', 'Type', 'Max marks', 'Weight', 'Class average'],
    body: sheet.assessments.map((a) => {
      const avg = s.assessmentAverages.find((x) => x.assessmentId === a.id)
      return [a.name, a.type, a.maxMarks, `${a.weight}%`, avg?.averagePercent != null ? formatPercent(avg.averagePercent) : '—']
    }),
    foot: ['Total', '', '', `${sheet.weightTotal}%`, ''],
  })
  finishPdf(doc, `grade_sheet_${o.course.code}`)
}

export const distributionColumns = [
  { key: 'letter', header: 'Grade' },
  { key: 'count', header: 'Students' },
]

