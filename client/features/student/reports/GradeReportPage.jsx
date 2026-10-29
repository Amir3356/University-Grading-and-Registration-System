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
import { GradeBadge } from '@/components/common/StatusBadge'
import { useLookups } from '@/context/lookups-context'
import { downloadTranscriptPdf } from '@/lib/transcript-pdf'
import { KpiCard } from '@/features/reports/KpiCard'
import { PERIOD_OPTIONS } from '@/features/reports/periods'
import { resolvePeriod } from '@/features/reports/reportsMockData'

const GPA_COLOR = 'var(--chart-1)'
const CGPA_COLOR = 'var(--chart-2)'

const numberFmt = new Intl.NumberFormat('en-US')
const formatNumber = (n) => numberFmt.format(n)
const formatGpa = (n) => (n == null || Number.isNaN(n) ? '—' : Number(n).toFixed(2))

const SAMPLE_COURSES = [
  { code: 'CS202', title: 'Database Management Systems', credits: 4, letter: 'A', score: 88.5, points: 4.0, type: 'passed' },
  { code: 'MATH201', title: 'Discrete Mathematics', credits: 4, letter: 'B+', score: 81.0, points: 3.5, type: 'passed' },
  { code: 'CS204', title: 'Operating Systems & System Programming', credits: 4, letter: 'B+', score: 82.5, points: 3.5, type: 'passed' },
  { code: 'CS206', title: 'Web Application Technologies', credits: 4, letter: 'A', score: 89.0, points: 4.0, type: 'passed' },
  { code: 'SE201', title: 'Software Engineering Fundamentals', credits: 3, letter: 'B-', score: 74.5, points: 2.75, type: 'passed' },
  { code: 'EE102', title: 'Digital Logic Design', credits: 4, letter: 'A', score: 86.0, points: 4.0, type: 'passed' },
  { code: 'CS102', title: 'Object-Oriented Programming (Java)', credits: 4, letter: 'A', score: 91.0, points: 4.0, type: 'passed' },
  { code: 'MATH101', title: 'Calculus I for Engineers', credits: 4, letter: 'B+', score: 82.0, points: 3.5, type: 'passed' },
]

function hashString(str) {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function seeded(seedKey) {
  let a = hashString(seedKey)
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const between = (rand, min, max) => min + rand() * (max - min)

function buildStudentReport(resolved) {
  const { buckets } = resolved
  const periodKey = buckets[0]?.key ?? 'none'
  const rand = seeded(`stu-grade:${periodKey}:${buckets.length}`)

  const trend = buckets.map((b, i) => {
    const bRand = seeded(`trend:${b.key}`)
    const baseGpa = 3.3 + (i / (buckets.length || 1)) * 0.35 + between(bRand, -0.15, 0.2)
    const sgpa = Math.min(4.0, Math.max(2.5, baseGpa))
    const cgpa = Math.min(4.0, Math.max(2.7, 3.42 + (i / (buckets.length || 1)) * 0.12))
    return {
      label: b.label,
      sgpa: Number(sgpa.toFixed(2)),
      cgpa: Number(cgpa.toFixed(2)),
    }
  })

  const latestSgpa = trend[trend.length - 1]?.sgpa ?? 3.65
  const latestCgpa = trend[trend.length - 1]?.cgpa ?? 3.48

  const kpis = {
    cgpa: { value: latestCgpa, change: 0.12 },
    sgpa: { value: latestSgpa, change: 0.15 },
    credits: { value: 62, change: 15 },
    passRate: { value: 96.8, change: 3.2 },
  }

  const breakdownRows = [
    { name: 'Grade A', passed: 6, failed: 0 },
    { name: 'Grade A-', passed: 4, failed: 0 },
    { name: 'Grade B+', passed: 5, failed: 0 },
    { name: 'Grade B', passed: 4, failed: 0 },
    { name: 'Grade B-', passed: 2, failed: 0 },
    { name: 'Grade C+', passed: 1, failed: 0 },
    { name: 'Grade F', passed: 0, failed: 1 },
  ]

  const subjectCredits = [
    { subject: 'Computer Science', credits: 28 },
    { subject: 'Mathematics', credits: 16 },
    { subject: 'Electrical Eng.', credits: 8 },
    { subject: 'Physics & General', credits: 10 },
  ]

  const recentActivity = SAMPLE_COURSES.map((c, i) => {
    const bucket = buckets[Math.max(0, buckets.length - 1 - Math.floor(i / 2))]
    return {
      id: `${periodKey}-${i}`,
      courseCode: c.code,
      courseTitle: c.title,
      creditHours: c.credits,
      letter: c.letter,
      score: c.score,
      points: c.points,
      type: c.type,
      when: bucket.label,
    }
  })

  return {
    kpis,
    trend,
    breakdown: { title: 'Grade distribution', dimension: 'Grade', rows: breakdownRows },
    subjectCredits,
    recentActivity,
  }
}

/**
 * Student Grade & Transcript Report matching the Admin RBAC Reports view layout and structure.
 */
export function GradeReportPage() {
  const lookups = useLookups()
  const today = format(new Date(), 'yyyy-MM-dd')
  const [period, setPeriod] = useState('weekly')
  const [range, setRange] = useState(() => ({
    from: format(subDays(new Date(), 29), 'yyyy-MM-dd'),
    to: today,
  }))

  const resolved = useMemo(() => resolvePeriod(period, range), [period, range])
  const report = useMemo(() => (resolved ? buildStudentReport(resolved) : null), [resolved])

  const rangeInvalid = period === 'custom' && range.from && range.to && range.from > range.to
  const compareHint = period === 'today' ? 'vs yesterday' : 'vs previous period'

  const handleDownload = () => {
    try {
      const sampleTranscript = {
        student: {
          name: 'Iris Williams',
          studentNumber: 'NBU/2024/0019',
          program: 'BSc. Computer Science',
          department: { name: 'Computer Science and Engineering', code: 'CSE' },
          admissionYear: 2024,
        },
        cgpa: report?.kpis?.cgpa?.value ?? 3.48,
        earnedCredits: report?.kpis?.credits?.value ?? 62,
        attemptedCredits: 62,
        standing: { label: "Dean's List", tone: 'success' },
        generatedAt: new Date().toISOString(),
        university: lookups?.university || {
          name: 'Northbridge University',
          shortName: 'NBU',
          registrarName: 'Marcus Bell',
        },
        scale: [
          { letter: 'A+', min: 90, max: 100, points: 4.0 },
          { letter: 'A', min: 85, max: 89, points: 4.0 },
          { letter: 'A-', min: 80, max: 84, points: 3.75 },
          { letter: 'B+', min: 75, max: 79, points: 3.5 },
          { letter: 'B', min: 70, max: 74, points: 3.0 },
          { letter: 'B-', min: 65, max: 69, points: 2.75 },
          { letter: 'C+', min: 60, max: 64, points: 2.5 },
          { letter: 'C', min: 50, max: 59, points: 2.0 },
          { letter: 'F', min: 0, max: 49, points: 0.0 },
        ],
        policy: {
          repeatPolicy: 'latest',
          passMark: 50,
          probationGpa: 2.0,
          honorsGpa: 3.5,
        },
        semesters: [
          {
            semesterId: 'sem_1',
            name: '2024 First Semester',
            gpa: 3.55,
            cgpa: 3.55,
            credits: 16,
            courses: SAMPLE_COURSES.slice(0, 4).map((c) => ({
              courseCode: c.code,
              courseTitle: c.title,
              creditHours: c.credits,
              totalScore: c.score,
              letter: c.letter,
              gradePoints: c.points,
            })),
          },
          {
            semesterId: 'sem_2',
            name: '2024 Second Semester',
            gpa: 3.65,
            cgpa: 3.60,
            credits: 15,
            courses: SAMPLE_COURSES.slice(4, 8).map((c) => ({
              courseCode: c.code,
              courseTitle: c.title,
              creditHours: c.credits,
              totalScore: c.score,
              letter: c.letter,
              gradePoints: c.points,
            })),
          },
        ],
      }
      downloadTranscriptPdf(sampleTranscript)
      toast.success('Report downloaded as PDF.')
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
      <Button className="rpt-filters__download" onClick={handleDownload} disabled={!report}>
        <FileDown /> Download PDF
      </Button>
    </div>
  )

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
              title={rangeInvalid ? 'The start date is after the end date' : 'Choose a date range'}
              description={
                rangeInvalid
                  ? 'Adjust the From or To date to see the report.'
                  : 'Pick both a From and a To date to generate the report.'
              }
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
            description={`${resolved.granularity} grade point averages for the selected period`}
            height={320}
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
