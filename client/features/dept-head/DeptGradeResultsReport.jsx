import { useMemo, useState } from 'react'
import { format, parseISO, subDays } from 'date-fns'
import { BookCheck, CalendarRange, CheckCircle2, FileDown, GraduationCap, XCircle } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { toast } from 'sonner'
import { ChartCard } from '@/components/charts/ChartCard'
import { DateInput } from '@/components/common/DateInput'
import { axisProps, barRadius, gridProps, legendProps, tooltipProps } from '@/components/charts/chart-theme'
import { DataTable } from '@/components/common/DataTable'
import { EmptyState } from '@/components/common/EmptyState'
import { ErrorState } from '@/components/common/ErrorState'
import { FilterSelect } from '@/components/common/FilterSelect'
import { PageSkeleton } from '@/components/common/Loading'
import { GradeStatusBadge } from '@/components/common/StatusBadge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { KpiCard } from '@/features/reports/KpiCard'
import { PERIOD_OPTIONS } from '@/features/reports/periods'
import { useQuery } from '@/hooks/useStore'
import { GRADE_STATUS_LABELS, formatSemesterName } from '@/lib/format'
import { downloadGradeResultsPdf } from '@/lib/grade-results-pdf'
import { useWebSocketEvent } from '@/lib/websocket'
import { store } from '@/store'

const PASS_COLOR = 'var(--chart-1)'
const FAIL_COLOR = 'var(--chart-4)'
// W / I are neither pass nor fail, so they get a neutral gray rather than a series hue.
const OTHER_COLOR = 'var(--chart-axis)'
const ALL = ''

const pct = (n) => `${Number(n).toFixed(1)}%`
/** "2025 First Semester" → "2025 S1", to keep bar-chart ticks short. */
const shortSemester = (name) => {
  const year = String(name).match(/\b20\d\d\b/)?.[0] ?? ''
  return `${year} ${/second|spring/i.test(name) ? 'S2' : 'S1'}`.trim()
}
// Series names render in ink, not in the series color.
const legendText = (value) => <span className="rpt-legend-text">{value}</span>

/** Pass / fail results per course for the department head, from approved and published grades. */
export function DeptGradeResultsReport({ department, university }) {
  // Period filters grades by the date the department approved them. Seeded demo approvals are months old,
  // so the default is a custom range covering roughly the last six months.
  const [period, setPeriod] = useState('custom')
  const [range, setRange] = useState(() => ({
    from: format(subDays(new Date(), 182), 'yyyy-MM-dd'),
    to: format(new Date(), 'yyyy-MM-dd'),
  }))
  const rangeInvalid = period === 'custom' && (!range.from || !range.to || range.from > range.to)
  const periodLabel = useMemo(() => {
    const now = new Date()
    if (period === 'today') return `Today (${format(now, 'd MMM yyyy')})`
    if (period === 'weekly') return `${format(subDays(now, 6), 'd MMM')} – ${format(now, 'd MMM yyyy')}`
    return rangeInvalid ? '' : `${format(parseISO(range.from), 'd MMM yyyy')} – ${format(parseISO(range.to), 'd MMM yyyy')}`
  }, [period, range, rangeInvalid])

  const { data, loading, error, refetch } = useQuery(
    () =>
      store.reports.getCourseResultsReport(
        period === 'custom' ? { period, startDate: range.from, endDate: range.to } : { period },
      ),
    [period, range.from, range.to],
    { enabled: !rangeInvalid },
  )
  useWebSocketEvent('GRADE_SUBMISSION_UPDATED', () => refetch())

  const allRows = useMemo(() => (Array.isArray(data) ? data : []), [data])

  // Semesters that have offerings, newest first (rows arrive sorted by semester start).
  const semesters = useMemo(() => {
    const seen = new Map()
    for (const r of allRows) if (!seen.has(r.semesterId)) seen.set(r.semesterId, r)
    return [...seen.values()].map((r) => ({
      value: r.semesterId,
      label: formatSemesterName(r.semesterName),
    }))
  }, [allRows])

  // Default to the newest semester that already has approved results.
  const [semesterId, setSemesterId] = useState(null)
  const activeSemester = semesterId ?? ALL
  const semesterLabel = activeSemester === ALL ? 'All semesters' : semesters.find((s) => s.value === activeSemester)?.label ?? '—'
  const showSemesterCol = activeSemester === ALL

  const rows = useMemo(
    () => (activeSemester === ALL ? allRows : allRows.filter((r) => r.semesterId === activeSemester)),
    [allRows, activeSemester],
  )

  const summary = useMemo(() => {
    const passed = rows.reduce((s, r) => s + r.passed, 0)
    const failed = rows.reduce((s, r) => s + r.failed, 0)
    return {
      excluded: rows.reduce((s, r) => s + r.withdrawn + r.incomplete, 0),
      courses: rows.length,
      // Courses with at least one grade approved in the selected period.
      approvedCourses: rows.filter((r) => r.students > 0).length,
      graded: rows.reduce((s, r) => s + r.students, 0),
      passed,
      failed,
      passRate: passed + failed ? (passed / (passed + failed)) * 100 : 0,
    }
  }, [rows])

  const chartRows = useMemo(
    () =>
      rows
        .filter((r) => r.passed + r.failed > 0)
        .map((r) => ({
          course: showSemesterCol ? `${r.courseCode} ${shortSemester(r.semesterName)}` : r.courseCode,
          title: `${r.courseTitle} · Sec ${r.section} · ${formatSemesterName(r.semesterName)}`,
          passed: r.passed,
          failed: r.failed,
          passRate: r.passRate,
        })),
    [rows, showSemesterCol],
  )

  const pieData = [
    { name: 'Passed', value: summary.passed, color: PASS_COLOR },
    { name: 'Failed', value: summary.failed, color: FAIL_COLOR },
    { name: 'W / I', value: summary.excluded, color: OTHER_COLOR },
  ].filter((d) => d.value > 0)
  const pieTotal = pieData.reduce((s, d) => s + d.value, 0)

  const handleDownload = () => {
    try {
      downloadGradeResultsPdf(rows, summary, { department, semesterLabel, periodLabel, university })
      toast.success('Grade results downloaded as PDF.')
    } catch (err) {
      toast.error(err.message || 'Could not generate the PDF.')
    }
  }

  if (loading && !data && !rangeInvalid) return <PageSkeleton />
  if (error) return <ErrorState error={error} onRetry={refetch} title="Could not load grade results" />

  const columns = [
    {
      key: 'course',
      header: 'Course',
      value: (r) => `${r.courseCode} ${r.courseTitle}`,
      cell: (r) => (
        <div className="rpt-student">
          <span className="rpt-student__name">
            {r.courseCode} <span className="rpt-muted">· Sec {r.section}</span>
          </span>
          <span className="rpt-course-title">{r.courseTitle}</span>
        </div>
      ),
    },
    ...(showSemesterCol ? [{ key: 'semesterName', header: 'Semester', value: (r) => formatSemesterName(r.semesterName) }] : []),
    { key: 'teacherName', header: 'Instructor' },
    {
      key: 'gradeStatus',
      header: 'Grade status',
      value: (r) => GRADE_STATUS_LABELS[r.gradeStatus] ?? r.gradeStatus,
      cell: (r) => <GradeStatusBadge status={r.gradeStatus} />,
    },
    {
      key: 'students',
      header: 'Graded',
      align: 'right',
      cell: (r) => (
        <span className="tabular">
          {r.students}
          <span className="rpt-muted"> / {r.enrolled}</span>
        </span>
      ),
    },
    { key: 'passed', header: 'Passed', align: 'right', cell: (r) => (r.students ? <span className="tabular rpt-pass">{r.passed}</span> : '—') },
    { key: 'failed', header: 'Failed', align: 'right', cell: (r) => (r.students ? <span className="tabular rpt-fail">{r.failed}</span> : '—') },
    {
      key: 'wi',
      header: 'W / I',
      align: 'right',
      value: (r) => r.withdrawn + r.incomplete,
      cell: (r) => (r.students ? <span className="tabular rpt-muted">{r.withdrawn} / {r.incomplete}</span> : '—'),
    },
    {
      key: 'passRate',
      header: 'Pass rate',
      value: (r) => (r.passed + r.failed ? r.passRate : -1),
      cell: (r) =>
        r.passed + r.failed ? (
          <div className="rpt-rate">
            <div className="rpt-rate__track" aria-hidden="true">
              <div className="rpt-rate__fill" style={{ width: `${r.passRate}%` }} />
            </div>
            <span className="tabular">{pct(r.passRate)}</span>
          </div>
        ) : (
          <span className="rpt-muted">Awaiting approval</span>
        ),
    },
    {
      key: 'average',
      header: 'Avg. score',
      align: 'right',
      value: (r) => (r.passed + r.failed ? r.average : -1),
      cell: (r) => (r.passed + r.failed ? <span className="tabular">{Number(r.average).toFixed(1)}</span> : '—'),
    },
  ]

  return (
    <div className="rpt">
      <div className="rpt-toolbar" style={{ justifyContent: 'flex-end' }}>
        <div className="rpt-filters" style={{ width: 'auto', marginLeft: 'auto', justifyContent: 'flex-end' }}>
          <div className="rpt-filters__field">
            <FilterSelect
              value={period}
              onChange={setPeriod}
              options={PERIOD_OPTIONS}
              includeAll={false}
              label="Period"
              className="rpt-filters__select"
              align="end"
            />
          </div>
          {period === 'custom' && (
            <div className="rpt-filters__range">
              <DateInput value={range.from} onChange={(from) => setRange((r) => ({ ...r, from }))} className="rpt-filters__date" />
              <span className="rpt-filters__sep">to</span>
              <DateInput
                value={range.to}
                min={range.from || undefined}
                onChange={(to) => setRange((r) => ({ ...r, to }))}
                className="rpt-filters__date"
              />
            </div>
          )}
          <div className="rpt-filters__field">
            <FilterSelect
              value={activeSemester}
              onChange={(v) => setSemesterId(v)}
              options={semesters}
              allLabel="All semesters"
              label="Semester"
              className="rpt-filters__select"
              align="end"
            />
          </div>
          <Button className="rpt-filters__download" onClick={handleDownload} disabled={!rows.length || rangeInvalid}>
            <FileDown /> Download PDF
          </Button>
        </div>
      </div>

      {rangeInvalid ? (
        <Card>
          <CardContent>
            <EmptyState
              icon={CalendarRange}
              title={range.from && range.to ? 'The start date is after the end date' : 'Choose a date range'}
              description="Pick a valid From and To date to see grade results."
            />
          </CardContent>
        </Card>
      ) : !rows.length ? (
        <Card>
          <CardContent>
            <EmptyState icon={BookCheck} title="No course offerings found" description="There are no course offerings for your department in this semester." />
          </CardContent>
        </Card>
      ) : (
        <>
          <section className="rpt-kpis" aria-label="Grade result totals">
            <KpiCard
              label="Courses approved"
              value={`${summary.approvedCourses} / ${summary.courses}`}
              icon={BookCheck}
              tone="net"
              hint="with grades in this period"
            />
            <KpiCard label="Students graded" value={summary.graded} icon={GraduationCap} tone="rate" hint="approved in this period" />
            <KpiCard label="Passed" value={summary.passed} icon={CheckCircle2} tone="pass" hint="grade points above 0" />
            <KpiCard label="Failed" value={summary.failed} icon={XCircle} tone="fail" hint="grade F" />
          </section>

          <div className="rpt-grid rpt-grid--split">
            <ChartCard
              title="Overall results"
              description="Share of approved and published grades"
              height={300}
              empty={!pieTotal}
              emptyText="No grades were approved in this period."
              tableColumns={[
                { key: 'name', header: 'Result' },
                { key: 'value', header: 'Students' },
                { key: 'share', header: 'Share', format: (_, r) => pct((r.value / pieTotal) * 100) },
              ]}
              tableRows={pieData}
            >
              <div className="rpt-donut">
                <div className="rpt-donut__chart">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Tooltip {...tooltipProps} formatter={(v, name) => [`${v} (${pct((v / pieTotal) * 100)})`, name]} />
                      <Pie
                        data={pieData}
                        dataKey="value"
                        nameKey="name"
                        innerRadius="64%"
                        outerRadius="92%"
                        paddingAngle={pieData.length > 1 ? 2 : 0}
                        stroke="var(--card)"
                        strokeWidth={2}
                        startAngle={90}
                        endAngle={-270}
                      >
                        {pieData.map((d) => (
                          <Cell key={d.name} fill={d.color} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="rpt-donut__center" aria-hidden="true">
                    <span className="rpt-donut__value tabular">{summary.passed + summary.failed ? pct(summary.passRate) : '—'}</span>
                    <span className="rpt-donut__label">pass rate</span>
                  </div>
                </div>
                <ul className="rpt-donut__legend">
                  {pieData.map((d) => (
                    <li key={d.name}>
                      <span className="rpt-donut__swatch" style={{ background: d.color }} aria-hidden="true" />
                      <span className="rpt-donut__name">{d.name}</span>
                      <span className="rpt-donut__count tabular">{d.value}</span>
                      <span className="rpt-donut__share tabular">{pct((d.value / pieTotal) * 100)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </ChartCard>

            <ChartCard
              title="Pass vs. fail by course"
              description="Students per course with an approved or published grade"
              height={300}
              empty={!chartRows.length}
              emptyText="No grades were approved in this period."
              tableColumns={[
                { key: 'course', header: 'Course' },
                { key: 'passed', header: 'Passed' },
                { key: 'failed', header: 'Failed' },
                { key: 'passRate', header: 'Pass rate', format: (v) => pct(v) },
              ]}
              tableRows={chartRows}
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartRows} margin={{ top: 8, right: 8, left: -16, bottom: 0 }} barGap={2} barCategoryGap="24%">
                  <CartesianGrid {...gridProps} />
                  <XAxis
                    dataKey="course"
                    {...axisProps}
                    interval={0}
                    angle={showSemesterCol ? -30 : 0}
                    textAnchor={showSemesterCol ? 'end' : 'middle'}
                    height={showSemesterCol ? 64 : 30}
                  />
                  <YAxis {...axisProps} allowDecimals={false} width={44} />
                  <Tooltip {...tooltipProps} labelFormatter={(label, payload) => (payload?.[0] ? `${label} — ${payload[0].payload.title}` : label)} />
                  <Legend {...legendProps} formatter={legendText} />
                  <Bar dataKey="passed" name="Passed" fill={PASS_COLOR} radius={barRadius} maxBarSize={32} />
                  <Bar dataKey="failed" name="Failed" fill={FAIL_COLOR} radius={barRadius} maxBarSize={32} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          <Card className="card--table">
            <CardHeader>
              <div className="grow">
                <CardTitle>Results by course</CardTitle>
                <CardDescription>{semesterLabel}</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <DataTable
                columns={columns}
                rows={rows}
                rowKey={(r) => r.offeringId}
                searchPlaceholder="Search course or instructor…"
                emptyTitle="No courses match your search"
              />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
