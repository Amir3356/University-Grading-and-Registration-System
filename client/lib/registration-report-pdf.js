import { createPdf, finishPdf, pdfTable } from '@/lib/export'

const fmt = (n) => new Intl.NumberFormat('en-US').format(n)
const signed = (n, digits = 1, suffix = '%') => (n == null || !Number.isFinite(n) ? '—' : `${n >= 0 ? '+' : ''}${n.toFixed(digits)}${suffix}`)
// Right-aligned cell for numeric headers and footers (columnStyles only reach body cells).
const right = (content) => ({ content, styles: { halign: 'right' } })
const share = (part, total) => (total ? `${((part / total) * 100).toFixed(1)}%` : '—')

/**
 * Render a registration & withdrawal report (from reports/reportsMockData buildReport) to PDF.
 * meta: { periodLabel, rangeLabel, granularity, compareHint, university? }
 */
export function downloadRegistrationReportPdf(report, meta) {
  const { doc, y: startY } = createPdf({
    title: 'Student Registration & Withdrawal Report',
    university: meta.university,
    subtitle: ['Scope: All departments', `Period: ${meta.periodLabel} (${meta.rangeLabel})    Breakdown: ${meta.granularity}`],
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
    head: ['Metric', right('Value'), right(`Change (${meta.compareHint})`)],
    body: [
      ['Registrations', fmt(kpis.registrations.value), signed(kpis.registrations.change)],
      ['Withdrawals', fmt(kpis.withdrawals.value), signed(kpis.withdrawals.change)],
      ['Net enrollment', `${kpis.net.value >= 0 ? '+' : ''}${fmt(kpis.net.value)}`, signed(kpis.net.change)],
      ['Withdrawal rate', `${kpis.rate.value.toFixed(1)}%`, signed(kpis.rate.change, 1, ' pts')],
    ],
    columnStyles: { 1: num, 2: num },
  }) + 18

  const trendTotals = trend.reduce((a, t) => ({ r: a.r + t.registrations, w: a.w + t.withdrawals }), { r: 0, w: 0 })
  y = pdfTable(doc, {
    startY: section(`Registrations vs. withdrawals (${meta.granularity.toLowerCase()})`),
    head: ['Period', right('Registrations'), right('Withdrawals'), right('Net')],
    body: trend.map((t) => [t.label, fmt(t.registrations), fmt(t.withdrawals), fmt(t.registrations - t.withdrawals)]),
    foot: ['Total', right(fmt(trendTotals.r)), right(fmt(trendTotals.w)), right(fmt(trendTotals.r - trendTotals.w))],
    columnStyles: { 1: num, 2: num, 3: num },
  }) + 18

  y = pdfTable(doc, {
    startY: section(breakdown.title),
    head: [breakdown.dimension, right('Registrations'), right('Withdrawals'), right('Withdrawal rate')],
    body: breakdown.rows.map((r) => [r.name, fmt(r.registrations), fmt(r.withdrawals), share(r.withdrawals, r.registrations)]),
    columnStyles: { 1: num, 2: num, 3: num },
  }) + 18

  y = pdfTable(doc, {
    startY: section('Withdrawal reasons'),
    head: ['Reason', right('Withdrawals'), right('Share')],
    body: withdrawalReasons.length && kpis.withdrawals.value
      ? withdrawalReasons.map((r) => [r.reason, fmt(r.count), share(r.count, kpis.withdrawals.value)])
      : [['No withdrawals in this period.', '', '']],
    columnStyles: { 1: num, 2: num },
  }) + 18

  pdfTable(doc, {
    startY: section('Recent activity'),
    head: ['Student', 'Student ID', 'Course', 'Type', 'When'],
    body: recentActivity.map((a) => [a.student, a.studentId, a.course, a.type === 'withdrawal' ? 'Withdrawal' : 'Registration', a.when]),
  })

  finishPdf(doc, `registration_report_${meta.periodLabel.toLowerCase().replace(/\s+/g, '_')}`)
}
