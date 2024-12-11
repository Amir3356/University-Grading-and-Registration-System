import { useMemo, useState } from 'react'
import { format, subDays } from 'date-fns'
import {
  Award,
  CalendarRange,
  FileDown,
  GraduationCap,
  Percent,
  TrendingUp,
  UserMinus,
} from 'lucide-react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { toast } from 'sonner'
import { PageHeader } from '@/components/common/PageHeader'
import { FilterSelect } from '@/components/common/FilterSelect'
import { DateInput } from '@/components/common/DateInput'
import { EmptyState } from '@/components/common/EmptyState'
import { ErrorState } from '@/components/common/ErrorState'
import { PageSkeleton } from '@/components/common/Loading'
import { ChartCard } from '@/components/charts/ChartCard'
import {
  axisProps,
  barRadiusHorizontal,
  gridProps,
  legendProps,
  lineCursor,
  tooltipProps,
} from '@/components/charts/chart-theme'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useQuery } from '@/hooks/useStore'
import { downloadTranscriptPdf } from '@/lib/transcript-pdf'
import { store } from '@/store'
import { KpiCard } from '@/features/reports/KpiCard'
import { PERIOD_OPTIONS, resolvePeriod } from '@/features/reports/periods'

const GPA_COLOR = 'var(--chart-1)'
const CGPA_COLOR = 'var(--chart-2)'

const numberFmt = new Intl.NumberFormat('en-US')
const formatNumber = (n) => numberFmt.format(n)
const formatGpa = (n) => (n == null || Number.isNaN(n) ? '—' : Number(n).toFixed(2))

/**
 * Student Grade & Transcript Report.
 * Renders verified real-time student performance directly from official grade records.
 */
export function GradeReportPage() {
  const today = format(new Date(), 'yyyy-MM-dd')
  const [period, setPeriod] = useState('weekly')
  const [range, setRange] = useState(() => ({
    from: format(subDays(new Date(), 29), 'yyyy-MM-dd'),
    to: today,
  }))

  const resolved = useMemo(() => resolvePeriod(period, range), [period, range])
  const rangeInvalid = period === 'custom' && range.from && range.to && range.from > range.to

  const { data: transcript, loading, error, refetch } = useQuery(
    () => store.student.getMyTranscript(),
    [],
  )

  const report = useMemo(() => {
    if (!transcript || !Array.isArray(transcript.semesters) || transcript.semesters.length === 0) {
      return null
    }

    const allCourses = transcript.semesters.flatMap((s) =>
      (s.courses || []).map((c) => ({
        ...c,
        semesterName: s.name,
      })),
    )

    const passedCourses = allCourses.filter((c) => Number(c.gradePoints || 0) > 0)
    const passRate = allCourses.length ? (passedCourses.length / allCourses.length) * 100 : 0
    const latestSem = transcript.semesters[transcript.semesters.length - 1]

    const kpis = {
      cgpa: { value: Number(transcript.cgpa ?? 0), change: null },
      sgpa: { value: Number(latestSem?.gpa ?? 0), change: null },
      credits: { value: Number(transcript.earnedCredits ?? 0), change: null },
      passRate: { value: passRate, change: null },
    }

    const trend = transcript.semesters.map((s) => ({
      label: s.name,
      sgpa: Number(s.gpa ?? 0),
      cgpa: Number(s.cgpa ?? transcript.cgpa ?? 0),
    }))

    // Letter grade distribution
    const letterCounts = new Map()
    for (const c of allCourses) {
      const letKey = c.letter || 'Other'
      letterCounts.set(letKey, (letterCounts.get(letKey) || 0) + 1)
    }
    const breakdownRows = Array.from(letterCounts.entries())
      .map(([name, count]) => ({
        name: `Grade ${name}`,
        passed: count,
        failed: 0,
      }))
      .sort((a, b) => a.name.localeCompare(b.name))

    // Credits by subject/department
    const deptCredits = new Map()
    for (const c of allCourses) {
      const subj = c.department || c.subject || 'Core Courses'
      deptCredits.set(subj, (deptCredits.get(subj) || 0) + Number(c.creditHours || 0))
    }
    const subjectCredits = Array.from(deptCredits.entries()).map(([subject, credits]) => ({
      subject,
      credits,
    }))

    const recentActivity = allCourses.map((c, i) => ({
      id: `${c.courseCode || i}-${i}`,
      courseCode: c.courseCode || '—',
      courseTitle: c.courseTitle || 'Untitled Course',
      creditHours: c.creditHours || 0,
      letter: c.letter || '—',
      score: c.totalScore ?? c.score ?? '—',
      points: c.gradePoints ?? 0,
      type: c.letter === 'F' ? 'failed' : 'passed',
      when: c.semesterName || 'Completed',
    }))

    return {
      kpis,
      trend,
      breakdown: { title: 'Grade distribution', dimension: 'Grade', rows: breakdownRows },
      subjectCredits,
      recentActivity,
    }
  }, [transcript])

  const compareHint = period === 'today' ? 'vs yesterday' : 'vs previous period'

  const handleDownload = () => {
    if (!transcript) return
    try {
      downloadTranscriptPdf(transcript)
      toast.success('Official grade report downloaded as PDF.')
    } catch (err) {
      toast.error(err.message || 'Could not generate the PDF.')
    }
  }

  const periodControls = (
    <div className="rpt-filters">
      <div className="rpt-filters__field">
        <span className="rpt-filters__label">Period</span>
        <FilterSelect
          value={period}
          onChange={setPeriod}
          options={PERIOD_OPTIONS}
          includeAll={false}
          label="Report period"
          className="rpt-filters__select"
          align="end"
        />
      </div>
      {period === 'custom' && (
        <div className="rpt-filters__range">
          <div className="rpt-filters__field">
            <span className="rpt-filters__label">From</span>
            <DateInput value={range.from} onChange={(from) => setRange((r) => ({ ...r, from }))} className="rpt-filters__date" />
          </div>
          <div className="rpt-filters__field">
            <span className="rpt-filters__label">To</span>
            <DateInput
              value={range.to}
              min={range.from || undefined}
              onChange={(to) => setRange((r) => ({ ...r, to }))}
              className="rpt-filters__date"
            />
          </div>
        </div>
      )}
      <Button className="rpt-filters__download" onClick={handleDownload} disabled={!report || !transcript}>
        <FileDown /> Download PDF
      </Button>
    </div>
  )

  if (loading && !transcript) return <PageSkeleton />
  if (error) return <ErrorState error={error} onRetry={refetch} title="Could not load grade report" />

  return (
    <div className="rpt">
      <PageHeader
        title="Reports"
        description="Student course grades, GPA progression, and official academic transcript."
        centered
        actions={periodControls}
      />

      {resolved && (
        <div className="rpt-context">
          <CalendarRange aria-hidden="true" />
          <span className="rpt-context__range">{resolved.rangeLabel}</span>
          <span className="rpt-context__dot" aria-hidden="true" />
          <span>{resolved.granularity} breakdown</span>
        </div>
      )}

      {!report ? (
        <Card>
          <CardContent>
            <EmptyState
              icon={GraduationCap}
              title={rangeInvalid ? 'The start date is after the end date' : 'No grade reports available'}
              description={rangeInvalid ? 'Adjust the From or To date to see the report.' : 'You do not have any published course grades or GPA records yet.'}
            />
          </CardContent>
        </Card>
      ) : (
        <>
          <section className="rpt-kpis" aria-label="Key figures">
            <KpiCard
              label="Cumulative GPA"
              value={formatGpa(report.kpis.cgpa.value)}
              icon={Award}
              tone="reg"
              change={report.kpis.cgpa.change}
              hint={compareHint}
            />
            <KpiCard
              label="Semester GPA"
              value={formatGpa(report.kpis.sgpa.value)}
              icon={TrendingUp}
              tone="wd"
              change={report.kpis.sgpa.change}
              hint={compareHint}
            />
            <KpiCard
              label="Course pass rate"
              value={`${report.kpis.passRate.value.toFixed(1)}%`}
              icon={Percent}
              tone="rate"
              change={report.kpis.passRate.change}
              changeSuffix=" pts"
              hint={compareHint}
            />
          </section>

          <ChartCard
            title="GPA progression vs. cumulative average"
            description={`${resolved?.granularity ?? 'Semester'} grade point averages for the selected period`}
            height={320}
            empty={!report.trend.length}
            emptyText="No GPA trend records in this period."
            tableColumns={[
              { key: 'label', header: 'Period' },
              { key: 'sgpa', header: 'Semester GPA', format: formatGpa },
              { key: 'cgpa', header: 'Cumulative GPA', format: formatGpa },
            ]}
            tableRows={report.trend}
          >
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={report.trend} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                <defs>
                  <linearGradient id="rpt-sgpa-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={GPA_COLOR} stopOpacity={0.22} />
                    <stop offset="100%" stopColor={GPA_COLOR} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="rpt-cgpa-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={CGPA_COLOR} stopOpacity={0.22} />
                    <stop offset="100%" stopColor={CGPA_COLOR} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="label" {...axisProps} minTickGap={16} />
                <YAxis domain={[0, 4]} ticks={[0, 1, 2, 3, 4]} {...axisProps} allowDecimals width={48} />
                <Tooltip {...tooltipProps} cursor={lineCursor} formatter={(v) => formatGpa(v)} />
                <Legend {...legendProps} />
                <Area
                  type="monotone"
                  dataKey="sgpa"
                  name="Semester GPA"
                  stroke={GPA_COLOR}
                  strokeWidth={2}
                  fill="url(#rpt-sgpa-fill)"
                  activeDot={{ r: 5, strokeWidth: 2, stroke: 'var(--card)' }}
                />
                <Area
                  type="monotone"
                  dataKey="cgpa"
                  name="Cumulative GPA"
                  stroke={CGPA_COLOR}
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  fill="url(#rpt-cgpa-fill)"
                  activeDot={{ r: 5, strokeWidth: 2, stroke: 'var(--card)' }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>

          <div className="rpt-grid">
            <ChartCard
              title={report.breakdown.title}
              description={`Passed and failed course counts per ${report.breakdown.dimension.toLowerCase()}`}
              height={300}
              empty={!report.breakdown.rows.length}
              emptyText="No grade breakdown available."
              tableColumns={[
                { key: 'name', header: report.breakdown.dimension },
                { key: 'passed', header: 'Passed', format: formatNumber },
                { key: 'failed', header: 'Failed', format: formatNumber },
              ]}
              tableRows={report.breakdown.rows}
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={report.breakdown.rows} layout="vertical" margin={{ top: 0, right: 12, left: 0, bottom: 0 }} barGap={2} barCategoryGap="22%">
                  <CartesianGrid {...gridProps} vertical horizontal={false} />
                  <XAxis type="number" {...axisProps} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" {...axisProps} width={80} />
                  <Tooltip {...tooltipProps} formatter={(v) => formatNumber(v)} />
                  <Legend {...legendProps} />
                  <Bar dataKey="passed" name="Passed" fill={GPA_COLOR} radius={barRadiusHorizontal} maxBarSize={14} />
                  <Bar dataKey="failed" name="Failed" fill={CGPA_COLOR} radius={barRadiusHorizontal} maxBarSize={14} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard
              title="Credits by department"
              description="Earned credit hours per academic discipline"
              height={300}
              empty={!report.subjectCredits.length}
              emptyText="No credits recorded in this period."
              tableColumns={[
                { key: 'subject', header: 'Subject' },
                { key: 'credits', header: 'Credits', format: formatNumber },
              ]}
              tableRows={report.subjectCredits}
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={report.subjectCredits} layout="vertical" margin={{ top: 0, right: 36, left: 0, bottom: 0 }} barCategoryGap="28%">
                  <CartesianGrid {...gridProps} vertical horizontal={false} />
                  <XAxis type="number" {...axisProps} allowDecimals={false} />
                  <YAxis type="category" dataKey="subject" {...axisProps} width={128} />
                  <Tooltip {...tooltipProps} formatter={(v) => [formatNumber(v), 'Credits']} />
                  <Bar
                    dataKey="credits"
                    name="Credits"
                    fill={CGPA_COLOR}
                    radius={barRadiusHorizontal}
                    maxBarSize={18}
                    label={{ position: 'right', fill: 'var(--muted-foreground)', fontSize: 12 }}
                  />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          <Card className="card--table">
            <CardHeader className="justify-center text-center" style={{ justifyContent: 'center', textAlign: 'center' }}>
              <div className="grow text-center w-full" style={{ width: '100%', textAlign: 'center' }}>
                <CardTitle style={{ textAlign: 'center' }}>Recent activity</CardTitle>
                <CardDescription style={{ textAlign: 'center' }}>Latest course evaluations and grades in the selected period</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <div className="rpt-table">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Course</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="rpt-table__when">When</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {report.recentActivity.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell>
                          <div className="rpt-student">
                            <span className="rpt-student__name">{row.courseCode}</span>
                            <span className="rpt-student__id">{row.creditHours} Credits</span>
                          </div>
                        </TableCell>
                        <TableCell>{row.courseTitle}</TableCell>
                        <TableCell>
                          {row.type === 'passed' ? (
                            <Badge variant="info" className="rpt-type">
                              <Award aria-hidden="true" /> Grade {row.letter} ({row.score}%)
                            </Badge>
                          ) : (
                            <Badge variant="warning" className="rpt-type">
                              <UserMinus aria-hidden="true" /> Withdrawn
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="rpt-table__when tabular">{row.when}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}

export default GradeReportPage
