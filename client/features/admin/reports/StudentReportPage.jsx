import { Award, BookOpen, FileText, GraduationCap } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ChartCard } from '@/components/charts/ChartCard'
import { SERIES, axisProps, gridProps, legendProps, lineCursor, tooltipProps } from '@/components/charts/chart-theme'
import { DataTable } from '@/components/common/DataTable'
import { ErrorState } from '@/components/common/ErrorState'
import { PageSkeleton } from '@/components/common/Loading'
import { PageHeader } from '@/components/common/PageHeader'
import { StatCard } from '@/components/common/StatCard'
import { GradeBadge, GradeStatusBadge, StatusBadge } from '@/components/common/StatusBadge'
import { useLookups } from '@/context/lookups-context'
import { useQuery } from '@/hooks/useStore'
import { formatGpa, formatNumber, formatPercent, GRADE_STATUS_LABELS } from '@/lib/format'
import { store } from '@/store'

const standingVariant = (tone) => (tone === 'danger' ? 'danger' : tone === 'success' ? 'success' : tone === 'muted' ? 'muted' : 'secondary')

const trendColumns = [
  { key: 'semester', header: 'Semester' },
  { key: 'gpa', header: 'Semester GPA', format: (v) => formatGpa(v) },
  { key: 'cgpa', header: 'CGPA', format: (v) => formatGpa(v) },
]

export function StudentReportPage() {
  const { studentId } = useParams()
  const lookups = useLookups()
  const { data, loading, error, refetch } = useQuery(() => store.reports.getStudentPerformanceReport(studentId), [studentId])

  if (loading && !data) return <PageSkeleton />
  if (error)
    return (
      <>
        <PageHeader title="Student performance" backTo="/admin/reports?tab=transcripts" backLabel="Reports" />
        <ErrorState error={error} onRetry={refetch} />
      </>
    )

  const s = data.student
  const inProgress = data.courses.filter((c) => !c.published && c.status !== 'withdrawn').length

  const columns = [
    { key: 'semesterName', header: 'Semester', value: (r) => r.semesterName, cell: (r) => <span className="whitespace-nowrap">{r.semesterName}</span> },
    {
      key: 'courseCode',
      header: 'Course',
      value: (r) => `${r.courseCode} — ${r.courseTitle}`,
      cell: (r) => (
        <div>
          <div className="font-medium">{r.courseCode}</div>
          <div className="max-w-56 truncate text-xs text-muted-foreground">{r.courseTitle}</div>
        </div>
      ),
    },
    { key: 'creditHours', header: 'Credits', align: 'right' },
    { key: 'status', header: 'Enrollment', cell: (r) => <StatusBadge status={r.status} /> },
    { key: 'runningPercent', header: 'Running %', align: 'right', value: (r) => r.runningPercent, cell: (r) => formatPercent(r.runningPercent) },
    { key: 'total', header: 'Total', align: 'right', cell: (r) => formatNumber(r.total, 2) },
    { key: 'letter', header: 'Letter', align: 'center', cell: (r) => <GradeBadge letter={r.letter} /> },
    { key: 'published', header: 'Published', value: (r) => (r.published ? 'Yes' : 'No'), cell: (r) => (r.published ? <Badge variant="success">Published</Badge> : <Badge variant="muted">Not yet</Badge>) },
    { key: 'gradeStatus', header: 'Grade status', value: (r) => GRADE_STATUS_LABELS[r.gradeStatus] ?? r.gradeStatus, cell: (r) => <GradeStatusBadge status={r.gradeStatus} /> },
  ]

  return (
    <>
      <PageHeader
        title={s.name}
        description={`${s.studentNumber} · ${s.program} · ${s.department?.name ?? ''} · Admitted ${s.admissionYear}`}
        backTo="/admin/reports?tab=transcripts"
        backLabel="Reports"
        actions={
          <Button variant="outline" asChild>
            <Link to={`/admin/reports/transcripts/${studentId}`}>
              <FileText /> View transcript
            </Link>
          </Button>
        }
      />
      <div className="grid gap-6">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Cumulative GPA" value={formatGpa(data.cgpa)} icon={GraduationCap} />
          <StatCard label="Credits earned" value={formatNumber(data.earnedCredits)} icon={BookOpen} tone="teal" />
          <Card className="gap-0 px-5 py-4">
            <p className="text-sm text-muted-foreground">Academic standing</p>
            <div className="mt-2">
              <Badge variant={standingVariant(data.standing.tone)} className="text-sm">
                {data.standing.label}
              </Badge>
            </div>
          </Card>
          <StatCard label="In progress / unpublished" value={formatNumber(inProgress)} icon={Award} hint={`${data.courses.length} enrollments in total`} />
        </div>

        <ChartCard
          title="GPA trend"
          description="Semester GPA and cumulative GPA after each semester (published results)."
          tableColumns={trendColumns}
          tableRows={data.trend}
          empty={!data.trend.length}
          emptyText="No published results yet."
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data.trend} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
              <CartesianGrid {...gridProps} />
              <XAxis dataKey="semester" {...axisProps} interval="preserveStartEnd" />
              <YAxis domain={[0, 4]} ticks={[0, 1, 2, 3, 4]} {...axisProps} />
              <Tooltip {...tooltipProps} cursor={lineCursor} formatter={(v) => formatGpa(v)} />
              <Legend {...legendProps} />
              <Line type="monotone" dataKey="gpa" name="Semester GPA" stroke={SERIES[0]} strokeWidth={2} dot={data.trend.length <= 12 ? { r: 4 } : false} connectNulls />
              <Line type="monotone" dataKey="cgpa" name="CGPA" stroke={SERIES[1]} strokeWidth={2} dot={data.trend.length <= 12 ? { r: 4 } : false} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <Card className="py-4">
          <CardContent>
            <h2 className="mb-3 text-base font-semibold">All enrollments</h2>
            <DataTable
              columns={columns}
              rows={data.courses}
              rowKey={(r) => r.enrollmentId}
              exportName={`student_report_${s.studentNumber}`}
              exportTitle={`Student performance — ${s.name} (${s.studentNumber})`}
              exportSubtitle={`CGPA ${formatGpa(data.cgpa)} · Credits earned ${data.earnedCredits} · ${data.standing.label}`}
              university={lookups?.university}
              searchPlaceholder="Search courses…"
              emptyTitle="No enrollments"
            />
          </CardContent>
        </Card>
      </div>
    </>
  )
}
