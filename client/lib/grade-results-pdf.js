import { createPdf, finishPdf, pdfTable } from '@/lib/export'
import { GRADE_STATUS_LABELS } from '@/lib/format'

const right = (content) => ({ content, styles: { halign: 'right' } })
const pct = (n) => `${Number(n).toFixed(1)}%`

/**
 * Render the department grade results (pass / fail per course) to PDF.
 * rows: /reports/course-results rows (camelCase); summary: { courses, approvedCourses, graded, passed, failed, passRate }
 * meta: { department, semesterLabel, periodLabel, university? }
 */
export function downloadGradeResultsPdf(rows, summary, meta) {
  const { doc, y: startY } = createPdf({
    title: 'Course Grade Results — Pass / Fail',
    university: meta.university,
    orientation: 'landscape',
    subtitle: [
      `Department: ${meta.department}    Semester: ${meta.semesterLabel}    Grades approved: ${meta.periodLabel}`,
      'Counts include grades approved by the department head in this period, including those since published by the registrar. W / I grades are excluded from the pass rate.',
    ],
  })
  const num = { halign: 'right' }

  const y = pdfTable(doc, {
    startY,
    head: ['Courses with grades in period', right('Students graded'), right('Passed'), right('Failed'), right('Pass rate')],
    body: [[
      `${summary.approvedCourses} of ${summary.courses}`,
      summary.graded,
      summary.passed,
      summary.failed,
      summary.passed + summary.failed ? pct(summary.passRate) : '—',
    ]],
    columnStyles: { 1: num, 2: num, 3: num, 4: num },
  }) + 18

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text('Results by course', 40, y + 4)
  doc.setFont('helvetica', 'normal')

  pdfTable(doc, {
    startY: y + 10,
    head: [
      'Course', 'Semester', 'Instructor', 'Grade status',
      right('Graded / Enrolled'), right('Passed'), right('Failed'), right('W / I'), right('Pass rate'), right('Average'),
    ],
    body: rows.map((r) => {
      const decided = r.passed + r.failed
      return [
        `${r.courseCode} (${r.section}) — ${r.courseTitle}`,
        r.semesterName,
        r.teacherName,
        GRADE_STATUS_LABELS[r.gradeStatus] ?? r.gradeStatus,
        `${r.students} / ${r.enrolled}`,
        r.students ? r.passed : '—',
        r.students ? r.failed : '—',
        r.students ? `${r.withdrawn} / ${r.incomplete}` : '—',
        decided ? pct(r.passRate) : '—',
        decided ? Number(r.average).toFixed(1) : '—',
      ]
    }),
    columnStyles: { 4: num, 5: num, 6: num, 7: num, 8: num, 9: num },
  })

  const slug = `${meta.department}_${meta.semesterLabel}`.toLowerCase().replace(/\s+/g, '_')
  finishPdf(doc, `grade_results_${slug}`)
}
