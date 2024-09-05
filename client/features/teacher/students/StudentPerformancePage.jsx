import { AlertTriangle, CheckCircle2, PenLine } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ChartCard } from '@/components/charts/ChartCard'
import { axisProps, barRadius, gridProps, legendProps, SERIES, tooltipProps } from '@/components/charts/chart-theme'
import { ErrorState } from '@/components/common/ErrorState'
import { PageSkeleton } from '@/components/common/Loading'
import { PageHeader } from '@/components/common/PageHeader'
import { StatCard } from '@/components/common/StatCard'
import { GradeBadge, StatusBadge } from '@/components/common/StatusBadge'
import { useQuery } from '@/hooks/useStore'
import { formatDate, formatNumber, formatPercent } from '@/lib/format'
import { initials } from '@/lib/utils'
import { store } from '@/store'
import { typeLabel } from '../lib'

const round1 = (v) => (v == null ? null : Math.round(v * 10) / 10)

function Detail({ label, children }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium">{children || '—'}</dd>
    </div>
  )
}

export function StudentPerformancePage() {
  const { offeringId, enrollmentId } = useParams()
  const { data, loading, error, refetch } = useQuery(() => store.teacher.getStudentPerformance(offeringId, enrollmentId), [offeringId, enrollmentId])
  const backTo = `/teacher/courses/${offeringId}`

  if (loading && !data) return <PageSkeleton />
  if (error) {
    return (
      <>
        <PageHeader title="Student performance" backTo={backTo} backLabel="Back to course" />
        <ErrorState error={error} onRetry={refetch} />
      </>
    )
  }

  const { offering: o, student: s, enrollment, assessments } = data
  const withdrawn = enrollment.status === 'withdrawn'
  const chartData = assessments.map((a) => ({ name: a.name, student: round1(a.percent), classAvg: round1(a.classAveragePercent) }))
  const entered = assessments.filter((a) => a.marks != null).length

  return (
    <>
      <PageHeader
        title={s.name}
        description={`${s.studentNumber} · ${o.course.code} ${o.course.title} · ${o.semester.name}`}
        backTo={backTo}
        backLabel={`Back to ${o.course.code}`}
        actions={
          <Button variant="outline" asChild>
            <Link to={`/teacher/grade-entry/${o.id}`}>
              <PenLine /> Enter grades
            </Link>
          </Button>
        }
      />

      {data.atRisk && !withdrawn && (
        <Alert variant="destructive" className="mb-6">
          <AlertTriangle />
          <AlertTitle>At risk</AlertTitle>
          <AlertDescription>
            This student's current standing ({formatPercent(data.runningPercent)}) is close to or below the pass mark. Consider reaching out with support.
          </AlertDescription>
        </Alert>
      )}
      {withdrawn && (
        <Alert className="mb-6">
          <AlertDescription>This student has withdrawn from the course (grade W).</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_2fr]">
        <Card>
          <CardContent className="flex flex-col gap-5">
            <div className="flex items-center gap-3">
              <Avatar className="size-12">
                <AvatarFallback>{initials(s.user)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="truncate font-semibold">{s.name}</p>
                <p className="truncate text-sm text-muted-foreground">{s.email}</p>
              </div>
            </div>
            <dl className="grid grid-cols-2 gap-4">
              <Detail label="Student ID">{s.studentNumber}</Detail>
              <Detail label="Department">{s.department?.name}</Detail>
              <Detail label="Programme">{s.program}</Detail>
              <Detail label="Admission year">{s.admissionYear}</Detail>
              <Detail label="Enrollment">
                <span className="flex flex-wrap gap-1">
                  <StatusBadge status={enrollment.status} />
                  {enrollment.isRepeat && <Badge variant="warning">Repeat</Badge>}
                </span>
              </Detail>
              <Detail label="Enrolled on">{formatDate(enrollment.enrolledAt)}</Detail>
            </dl>
          </CardContent>
        </Card>

        <div className="grid content-start gap-4 sm:grid-cols-2">
          <StatCard
            label="Current standing"
            value={formatPercent(data.runningPercent)}
            hint="Percentage of the weight assessed so far"
            icon={data.atRisk ? AlertTriangle : CheckCircle2}
            tone={data.atRisk ? 'danger' : 'success'}
          />
          <StatCard label="Class average (running)" value={formatPercent(data.classAverage)} hint="Active students in this course" />
          <StatCard label="Weighted total so far" value={`${formatNumber(data.total, 2)} / 100`} hint={`${entered} of ${assessments.length} assessments marked`} />
          <Card className="gap-0 px-5 py-4">
            <p className="text-sm text-muted-foreground">Letter grade</p>
            <div className="mt-2">
              <GradeBadge letter={data.complete || withdrawn ? data.letter : null} className="text-base" />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">{data.complete ? 'All assessments marked' : withdrawn ? 'Withdrawn' : 'Shown once all marks are entered'}</p>
          </Card>
        </div>
      </div>

      <ChartCard
        className="mt-6"
        title="Marks vs class average"
        description="Score on each assessment as a percentage of its maximum."
        empty={!assessments.length}
        emptyText="This course has no assessments yet."
        height={300}
        tableColumns={[
          { key: 'name', header: 'Assessment' },
          { key: 'student', header: 'Student %', format: (v) => formatPercent(v) },
          { key: 'classAvg', header: 'Class average %', format: (v) => formatPercent(v) },
        ]}
        tableRows={chartData}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }} barGap={2}>
            <CartesianGrid {...gridProps} />
            <XAxis dataKey="name" {...axisProps} interval={0} tick={{ ...axisProps.tick, fontSize: 11 }} />
            <YAxis domain={[0, 100]} {...axisProps} tickFormatter={(v) => `${v}%`} />
            <Tooltip {...tooltipProps} formatter={(v, n) => [v == null ? '—' : `${v}%`, n]} />
            <Legend {...legendProps} />
            <Bar dataKey="student" name={s.name} fill={SERIES[0]} radius={barRadius} maxBarSize={40} />
            <Bar dataKey="classAvg" name="Class average" fill={SERIES[1]} radius={barRadius} maxBarSize={40} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Assessment breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Assessment</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Weight</TableHead>
                  <TableHead className="text-right">Marks</TableHead>
                  <TableHead className="text-right">Score %</TableHead>
                  <TableHead className="text-right">Class avg %</TableHead>
                  <TableHead className="text-right">Weighted</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assessments.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell>
                      <p className="font-medium">{a.name}</p>
                      <p className="text-xs text-muted-foreground">Due {formatDate(a.dueDate)}</p>
                    </TableCell>
                    <TableCell>{typeLabel(a.type)}</TableCell>
                    <TableCell className="text-right tabular">{a.weight}%</TableCell>
                    <TableCell className="text-right tabular">{a.marks == null ? <span className="text-muted-foreground">Not entered</span> : `${a.marks} / ${a.maxMarks}`}</TableCell>
                    <TableCell className="text-right tabular">{formatPercent(a.percent)}</TableCell>
                    <TableCell className="text-right tabular">{formatPercent(a.classAveragePercent)}</TableCell>
                    <TableCell className="text-right tabular">{a.percent == null ? '—' : formatNumber((a.percent * a.weight) / 100, 2)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </>
  )
}

