import { useMemo, useState, useCallback, useEffect } from 'react'
import {
  Award,
  BookCheck,
  CheckCircle2,
  FileDown,
  GraduationCap,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { toast } from 'sonner'
import { ChartCard } from '@/components/charts/ChartCard'
import {
  axisProps,
  barRadius,
  gridProps,
  legendProps,
  tooltipProps,
} from '@/components/charts/chart-theme'
import { EmptyState } from '@/components/common/EmptyState'
import { ErrorState } from '@/components/common/ErrorState'
import { FilterSelect } from '@/components/common/FilterSelect'
import { PageSkeleton } from '@/components/common/Loading'
import { PageHeader } from '@/components/common/PageHeader'
import { GradeBadge } from '@/components/common/StatusBadge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { KpiCard } from '@/features/reports/KpiCard'
import { useQuery } from '@/hooks/useStore'
import { formatGpa, formatNumber, formatSemesterName } from '@/lib/format'
import { onGradeChange, onAssessmentChange } from '@/lib/syncEvents'
import { downloadTranscriptPdf } from '@/lib/transcript-pdf'
import { useWebSocketEvent } from '@/lib/websocket'
import { store } from '@/store'

const PASS_COLOR = 'var(--chart-1)'
const FAIL_COLOR = 'var(--chart-4)'
const OTHER_COLOR = 'var(--chart-axis)'
const ALL = ''

const pct = (n) => `${Number(n).toFixed(1)}%`

// Legend labels rendered in standard text
const legendText = (value) => <span className="rpt-legend-text">{value}</span>

export function StudentReportPage() {
  const { data, loading, error, refetch } = useQuery(() => store.student.getMyTranscript(), [])

  const handleRealtimeUpdate = useCallback(() => {
    refetch()
  }, [refetch])

  // Real-time WebSocket triggers
  useWebSocketEvent('SCORES_UPDATED', handleRealtimeUpdate)
  useWebSocketEvent('OFFERING_UPDATED', handleRealtimeUpdate)
  useWebSocketEvent('GRADE_UPDATED', handleRealtimeUpdate)
  useWebSocketEvent('TRANSCRIPT_UPDATED', handleRealtimeUpdate)
  useWebSocketEvent('GRADE_SUBMISSION_UPDATED', handleRealtimeUpdate)
  useWebSocketEvent('GRADE_SCALE_UPDATED', handleRealtimeUpdate)
  useWebSocketEvent('GRADING_POLICY_UPDATED', handleRealtimeUpdate)
  useWebSocketEvent('ASSESSMENT_UPDATED', handleRealtimeUpdate)
  useWebSocketEvent('WITHDRAWAL_APPROVED', handleRealtimeUpdate)
  useWebSocketEvent('WITHDRAWAL_UPDATED', handleRealtimeUpdate)
  useWebSocketEvent('REGISTRATION_CHANGED', handleRealtimeUpdate)

  // Local window and cross-tab sync fallback
  useEffect(() => {
    const unGrade = onGradeChange(handleRealtimeUpdate)
    const unAsm = onAssessmentChange(handleRealtimeUpdate)
    return () => {
      unGrade()
      unAsm()
    }
  }, [handleRealtimeUpdate])

  // Semester dropdown options
  const semestersList = useMemo(() => {
    const list = Array.isArray(data?.semesters) ? data.semesters : []
    return list.map((s) => ({
      value: s.semesterId,
      label: formatSemesterName(s.name),
      name: s.name,
      sem: s,
    }))
  }, [data])

  const [semesterId, setSemesterId] = useState(null)
  const activeSemester = semesterId ?? ALL
  const activeSemesterLabel =
    activeSemester === ALL
      ? 'All semesters'
      : semestersList.find((s) => s.value === activeSemester)?.label ?? '—'
  const showSemesterCol = activeSemester === ALL

  // Filtered semesters
  const activeSemesters = useMemo(() => {
    const list = Array.isArray(data?.semesters) ? data.semesters : []
    if (activeSemester === ALL) return list
    return list.filter((s) => s.semesterId === activeSemester)
  }, [data, activeSemester])

  // Filtered course rows
  const courseRows = useMemo(() => {
    return activeSemesters.flatMap((sem) =>
      (sem.courses || []).map((c) => ({
        ...c,
        semesterId: sem.semesterId,
        semesterName: sem.name,
      }))
    )
  }, [activeSemesters])

  // Summary KPI values
  const summary = useMemo(() => {
    let passed = 0
    let failed = 0
    let excluded = 0

    for (const c of courseRows) {
      if (c.letter === 'W' || c.specialGrade === 'W' || c.specialGrade === 'I') {
        excluded++
      } else if (c.letter === 'F') {
        failed++
      } else if (c.gradePoints !== null && c.gradePoints > 0) {
        passed++
      }
    }

    const latestSem = (data?.semesters || [])[data?.semesters?.length - 1]
    const currentSem =
      activeSemester === ALL
        ? latestSem
        : (data?.semesters || []).find((s) => s.semesterId === activeSemester)

    const totalGraded = passed + failed
    const passRate = totalGraded > 0 ? (passed / totalGraded) * 100 : 100

    return {
      cgpa: data?.cgpa ?? 0,
      semesterGpa: currentSem?.gpa ?? 0,
      earnedCredits:
        activeSemester === ALL ? data?.earnedCredits ?? 0 : currentSem?.credits ?? 0,
      attemptedCredits: data?.attemptedCredits ?? 0,
      standing: data?.standing?.label || 'Good Standing',
      passed,
      failed,
      excluded,
      passRate,
    }
  }, [courseRows, data, activeSemester])

  // Pie chart data: Passed vs Failed vs Excluded
  const pieData = useMemo(() => {
    return [
      { name: 'Passed', value: summary.passed, color: PASS_COLOR },
      { name: 'Failed', value: summary.failed, color: FAIL_COLOR },
      { name: 'W / I', value: summary.excluded, color: OTHER_COLOR },
    ].filter((d) => d.value > 0)
  }, [summary])

  const pieTotal = useMemo(() => pieData.reduce((s, d) => s + d.value, 0), [pieData])

  // GPA and Cumulative GPA Bar chart rows
  const gpaBarData = useMemo(() => {
    const list = Array.isArray(data?.semesters) ? data.semesters : []
    return list.map((sem) => ({
      label: sem.name.replace(/ (\d{2})(\d{2})\/\d{2}(\d{2})$/, ' $2/$3'),
      name: sem.name,
      gpa: sem.gpa,
      cgpa: sem.cgpa,
      credits: sem.credits ?? 0,
    }))
  }, [data])

  const handleDownload = (e) => {
    if (e) {
      e.preventDefault()
      e.stopPropagation()
    }
    try {
      if (!data) return
      const exportData = {
        ...data,
        semesters: activeSemester === ALL ? data.semesters : activeSemesters,
      }
      downloadTranscriptPdf(exportData, {
        semesterLabel: activeSemesterLabel,
      })
      toast.success('Academic report downloaded as PDF.')
    } catch (err) {
      toast.error(err.message || 'Could not generate the PDF.')
    }
  }

  const getCourseStatus = (c) => {
    if (c.letter === 'W' || c.specialGrade === 'W') return 'Withdrawn'
    if (c.specialGrade === 'I') return 'Incomplete'
    if (c.letter === 'F') return 'Failed'
    if (c.isRepeat) return 'Repeated'
    if (c.gradePoints !== null && c.gradePoints > 0) return 'Passed'
    return c.note || 'Normal'
  }

  if (loading && !data) return <PageSkeleton />
  if (error) {
    return (
      <ErrorState
        error={error}
        onRetry={refetch}
        title="Could not load student report"
      />
    )
  }

  const s = data?.student || {}

  return (
    <div className="rpt">
      <PageHeader
        centered
        title="Report"
        description={`${s.program || 'Undergraduate Programme'} · ${s.department?.name || 'Department'} · ID: ${s.studentNumber || '—'}`}
      />

      <div className="rpt-toolbar" style={{ justifyContent: 'flex-end' }}>
        <div
          className="rpt-filters"
          style={{ width: 'auto', marginLeft: 'auto', justifyContent: 'flex-end' }}
        >
          <div className="rpt-filters__field">
            <FilterSelect
              value={activeSemester}
              onChange={(v) => setSemesterId(v)}
              options={semestersList}
              allLabel="All semesters"
              label="Semester"
              className="rpt-filters__select"
              align="end"
            />
          </div>
          <Button
            type="button"
            className="rpt-filters__download"
            onClick={(e) => handleDownload(e)}
            disabled={!courseRows.length}
          >
            <FileDown /> Download PDF
          </Button>
        </div>
      </div>

      {!courseRows.length ? (
        <Card>
          <CardContent>
            <EmptyState
              icon={BookCheck}
              title="No course records found"
              description="There are no published results on record for this student."
            />
          </CardContent>
        </Card>
      ) : (
        <>
          {/* KPI figures - identical pattern to Dept Head Report */}
          <section className="rpt-kpis" aria-label="Academic result totals">
            <KpiCard
              label="Cumulative GPA"
              value={formatGpa(summary.cgpa)}
              icon={Award}
              tone="pass"
              hint={summary.standing}
            />
            <KpiCard
              label="Semester GPA"
              value={formatGpa(summary.semesterGpa)}
              icon={CheckCircle2}
              tone="reg"
              hint={activeSemester === ALL ? 'Latest semester' : activeSemesterLabel}
            />
            <KpiCard
              label="Credits Earned"
              value={`${summary.earnedCredits} hrs`}
              icon={GraduationCap}
              tone="net"
              hint={activeSemester === ALL ? `${summary.attemptedCredits} attempted` : 'Term credits'}
            />
            <KpiCard
              label="Passed Courses"
              value={summary.passed}
              icon={CheckCircle2}
              tone="rate"
              hint={
                summary.passed + summary.failed
                  ? `${pct(summary.passRate)} pass rate`
                  : 'No graded courses'
              }
            />
          </section>

          {/* Recharts Split Grid - identical pattern to Dept Head Report */}
          <div className="rpt-grid rpt-grid--split">
            {/* Chart 1: Donut PieChart */}
            <ChartCard
              title="Overall results"
              description="Share of passed vs. failed courses"
              height={300}
              empty={!pieTotal}
              emptyText="No grades recorded yet."
              tableColumns={[
                { key: 'name', header: 'Result' },
                { key: 'value', header: 'Courses' },
                { key: 'share', header: 'Share', format: (_, r) => pct((r.value / pieTotal) * 100) },
              ]}
              tableRows={pieData}
            >
              <div className="rpt-donut">
                <div className="rpt-donut__chart">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Tooltip
                        {...tooltipProps}
                        formatter={(v, name) => [
                          `${v} (${pct((v / pieTotal) * 100)})`,
                          name,
                        ]}
                      />
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
                    <span className="rpt-donut__value tabular">
                      {summary.passed + summary.failed ? pct(summary.passRate) : '—'}
                    </span>
                    <span className="rpt-donut__label">pass rate</span>
                  </div>
                </div>
                <ul className="rpt-donut__legend">
                  {pieData.map((d) => (
                    <li key={d.name}>
                      <span
                        className="rpt-donut__swatch"
                        style={{ background: d.color }}
                        aria-hidden="true"
                      />
                      <span className="rpt-donut__name">{d.name}</span>
                      <span className="rpt-donut__count tabular">{d.value}</span>
                      <span className="rpt-donut__share tabular">
                        {pct((d.value / pieTotal) * 100)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </ChartCard>

            {/* Chart 2: GPA & Cumulative GPA Progression BarChart */}
            <ChartCard
              title="GPA & Cumulative GPA (CGPA) by semester"
              description="Semester GPA and running Cumulative GPA across semesters (0–4.00 scale)"
              height={300}
              empty={!gpaBarData.length}
              emptyText="No GPA records available."
              tableColumns={[
                { key: 'name', header: 'Semester' },
                { key: 'gpa', header: 'Semester GPA', format: formatGpa },
                { key: 'cgpa', header: 'Cumulative GPA', format: formatGpa },
                { key: 'credits', header: 'Credits' },
              ]}
              tableRows={gpaBarData}
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={gpaBarData}
                  margin={{ top: 8, right: 16, bottom: 0, left: -16 }}
                  barGap={4}
                  barCategoryGap="20%"
                >
                  <CartesianGrid {...gridProps} />
                  <XAxis dataKey="label" {...axisProps} interval="preserveStartEnd" />
                  <YAxis domain={[0, 4]} ticks={[0, 1, 2, 3, 4]} {...axisProps} width={40} />
                  <Tooltip
                    {...tooltipProps}
                    formatter={(val, name) => [formatGpa(val), name]}
                    labelFormatter={(label, payload) => payload?.[0]?.payload?.name ?? label}
                  />
                  <Legend {...legendProps} formatter={legendText} />
                  <Bar
                    dataKey="gpa"
                    name="Semester GPA"
                    fill={PASS_COLOR}
                    radius={barRadius}
                    maxBarSize={36}
                  />
                  <Bar
                    dataKey="cgpa"
                    name="Cumulative GPA (CGPA)"
                    fill={FAIL_COLOR}
                    radius={barRadius}
                    maxBarSize={36}
                  />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          {/* Each Course Grade Table */}
          <Card className="mt-6">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <div>
                <CardTitle className="text-base font-semibold">Course Grades</CardTitle>
                <CardDescription className="mt-1">
                  Individual course grades, scores, credit hours, and points earned.
                </CardDescription>
              </div>
              <Badge variant="outline" className="tabular">
                {courseRows.length} {courseRows.length === 1 ? 'Course' : 'Courses'}
              </Badge>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[120px]">Course Code</TableHead>
                      <TableHead>Course Title</TableHead>
                      {showSemesterCol && <TableHead className="w-[160px]">Semester</TableHead>}
                      <TableHead className="text-center w-[90px]">Credits</TableHead>
                      <TableHead className="text-center w-[110px]">Total Score</TableHead>
                      <TableHead className="text-center w-[90px]">Grade</TableHead>
                      <TableHead className="text-center w-[110px]">Grade Points</TableHead>
                      <TableHead className="text-right w-[120px]">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {courseRows.map((c) => (
                      <TableRow key={c.enrollmentId || c.courseCode + c.semesterId}>
                        <TableCell className="font-semibold text-foreground">
                          {c.courseCode}
                        </TableCell>
                        <TableCell className="font-medium text-foreground">
                          {c.courseTitle}
                        </TableCell>
                        {showSemesterCol && (
                          <TableCell className="text-xs text-muted-foreground">
                            {formatSemesterName(c.semesterName)}
                          </TableCell>
                        )}
                        <TableCell className="text-center font-medium tabular">
                          {c.creditHours}
                        </TableCell>
                        <TableCell className="text-center tabular font-semibold">
                          {c.totalScore != null ? formatNumber(c.totalScore, 2) : '—'}
                        </TableCell>
                        <TableCell className="text-center">
                          <GradeBadge letter={c.letter} />
                        </TableCell>
                        <TableCell className="text-center font-semibold tabular">
                          {c.gradePoints != null ? formatGpa(c.gradePoints) : '—'}
                        </TableCell>
                        <TableCell className="text-right">
                          <span
                            className={`text-xs font-medium ${
                              c.letter === 'F' ? 'text-destructive' : 'text-muted-foreground'
                            }`}
                          >
                            {getCourseStatus(c)}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  <TableFooter className="bg-muted/40 font-medium">
                    <TableRow>
                      <TableCell colSpan={showSemesterCol ? 3 : 2} className="text-muted-foreground">
                        Total ({courseRows.length} {courseRows.length === 1 ? 'course' : 'courses'})
                      </TableCell>
                      <TableCell className="text-center tabular font-bold text-foreground">
                        {courseRows.reduce((s, c) => s + (Number(c.creditHours) || 0), 0)} hrs
                      </TableCell>
                      <TableCell />
                      <TableCell />
                      <TableCell className="text-center tabular font-bold text-primary">
                        {activeSemester === ALL
                          ? `CGPA: ${formatGpa(summary.cgpa)}`
                          : `GPA: ${formatGpa(summary.semesterGpa)}`}
                      </TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground">
                        {summary.passed} passed · {summary.failed} failed
                      </TableCell>
                    </TableRow>
                  </TableFooter>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}

export default StudentReportPage
