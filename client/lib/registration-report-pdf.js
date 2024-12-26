import { createPdf, finishPdf, pdfTable } from '@/lib/export'

const fmt = (n) => new Intl.NumberFormat('en-US').format(n)
const signed = (n, digits = 1, suffix = '%') => (n == null || !Number.isFinite(n) ? '—' : `${n >= 0 ? '+' : ''}${n.toFixed(digits)}${suffix}`)
// Right-aligned cell for numeric headers and footers (columnStyles only reach body cells).
const right = (content) => ({ content, styles: { halign: 'right' } })
const share = (part, total) => (total ? `${((part / total) * 100).toFixed(1)}%` : '—')

/**
 * Render a registration & withdrawal report to PDF.
 * meta: { periodLabel, rangeLabel, granularity, compareHint, university? }
 */
export function downloadRegistrationReportPdf(report, meta = {}) {
  const subtitle = ['Scope: All departments', `Semester: ${meta.semesterLabel || 'All semesters'}`]
  if (meta.periodLabel) {
    subtitle[1] += `    Period: ${meta.periodLabel}`
  }
  const { doc, y: startY } = createPdf({
    title: 'Student Registration & Withdrawal Report',
    university: meta.university,
    subtitle,
  })
  const pageH = doc.internal.pageSize.getHeight()
  let y = startY

  const section = (title) => {
    if (y > pageH - 140) {
      doc.addPage()
      y = 50
    }
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.text(title, 40, y + 4)
    doc.setFont('helvetica', 'normal')
    return y + 10
  }

  const { kpis, trend, breakdown, withdrawalReasons, recentActivity } = report
  const num = { halign: 'right' }

  y = pdfTable(doc, {
    startY: section('Summary'),
    head: ['Metric', right('Value'), right('Type / Status')],
    body: [
      ['Registrations', fmt(kpis.registrations.value), 'Semester Registrations'],
      ['Withdrawals', fmt(kpis.withdrawals.value), 'Withdrawal Requests'],
      ['Net enrollment', `${kpis.net.value >= 0 ? '+' : ''}${fmt(kpis.net.value)}`, 'Net Total'],
      ['Withdrawal rate', `${kpis.rate.value.toFixed(1)}%`, 'Attrition Rate'],
    ],
    columnStyles: { 1: num, 2: num },
  }) + 18

  const trendTotals = (trend || []).reduce((a, t) => ({ r: a.r + (t.registrations || 0), w: a.w + (t.withdrawals || 0) }), { r: 0, w: 0 })
  y = pdfTable(doc, {
    startY: section('Registrations vs. withdrawals (daily)'),
    head: ['Date', right('Registrations'), right('Withdrawals'), right('Net')],
    body: (trend && trend.length)
      ? trend.map((t) => [t.label, fmt(t.registrations), fmt(t.withdrawals), fmt(t.registrations - t.withdrawals)])
      : [['No trend data recorded for this semester.', '', '', '']],
    foot: ['Total', right(fmt(trendTotals.r)), right(fmt(trendTotals.w)), right(fmt(trendTotals.r - trendTotals.w))],
    columnStyles: { 1: num, 2: num, 3: num },
  }) + 18

  y = pdfTable(doc, {
    startY: section(breakdown?.title || 'By department'),
    head: [breakdown?.dimension || 'Department', right('Registrations'), right('Withdrawals'), right('Withdrawal rate')],
    body: (breakdown?.rows && breakdown.rows.length)
      ? breakdown.rows.map((r) => [r.name, fmt(r.registrations), fmt(r.withdrawals), share(r.withdrawals, r.registrations)])
      : [['No departmental activity recorded in this period.', '', '', '']],
    columnStyles: { 1: num, 2: num, 3: num },
  }) + 18

  y = pdfTable(doc, {
    startY: section('Withdrawal reasons'),
    head: ['Reason', right('Withdrawals'), right('Share')],
    body: (withdrawalReasons && withdrawalReasons.length && kpis?.withdrawals?.value)
      ? withdrawalReasons.map((r) => [r.reason, fmt(r.count), share(r.count, kpis.withdrawals.value)])
      : [['No withdrawals in this period.', '', '']],
    columnStyles: { 1: num, 2: num },
  }) + 18

  pdfTable(doc, {
    startY: section('Recent activity'),
    head: ['Student', 'Student ID', 'Course / Type', 'Type', 'When'],
    body: (recentActivity && recentActivity.length)
      ? recentActivity.map((a) => [a.student, a.studentId, a.course, a.type === 'withdrawal' ? 'Withdrawal' : 'Registration', a.when])
      : [['No recent activity recorded in this period.', '', '', '', '']],
  })

  const slug = (meta.semesterLabel || 'all_semesters').toLowerCase().replace(/\s+/g, '_')
  finishPdf(doc, `registration_report_${slug}`)
}
