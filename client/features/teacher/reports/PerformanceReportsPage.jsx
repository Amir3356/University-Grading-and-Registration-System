import { AlertTriangle, Award, BarChart3, CheckCircle2, TrendingDown, TrendingUp, Users } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ChartCard } from '@/components/charts/ChartCard'
import { GradeDistributionChart } from '@/components/charts/GradeDistributionChart'
import { axisProps, barRadius, gridProps, SERIES, tooltipProps } from '@/components/charts/chart-theme'
import { DataTable } from '@/components/common/DataTable'
import { EmptyState } from '@/components/common/EmptyState'
import { ErrorState } from '@/components/common/ErrorState'
import { PageSkeleton } from '@/components/common/Loading'
import { PageHeader } from '@/components/common/PageHeader'
import { StatCard } from '@/components/common/StatCard'
import { GradeBadge, GradeStatusBadge, PassFailBadge, StatusBadge } from '@/components/common/StatusBadge'
import { useLookups } from '@/context/lookups-context'
import { useQuery } from '@/hooks/useStore'
import { formatNumber, formatPercent } from '@/lib/format'
import { store } from '@/store'
import { GradeSheetExportMenu } from '../components/GradeSheetExportMenu'
import { OfferingPicker } from '../components/OfferingPicker'
import { defaultOfferingId } from '../lib'

function Report({ offeringId, university }) {
  const navigate = useNavigate()
  const { data, loading, error, refetch } = useQuery(() => store.grades.getOfferingPerformance(offeringId), [offeringId])

  if (loading && !data) return <PageSkeleton />
  if (error) return <ErrorState error={error} onRetry={refetch} />

  const { offering: o, stats: s, struggling, rows, passMark } = data
  const hasFinal = s.completeCount > 0
  const assessmentData = s.assessmentAverages.map((a) => ({ ...a, pct: a.averagePercent == null ? null : Math.round(a.averagePercent * 10) / 10 }))
  const studentLink = (enrollmentId) => `/teacher/courses/${o.id}/students/${enrollmentId}`

  const resultColumns = [
    { key: 'studentNumber', header: 'Student ID', value: (r) => r.student.studentNumber, cell: (r) => <span className="tabular">{r.student.studentNumber}</span> },
    { key: 'name', header: 'Name', value: (r) => r.student.name, cell: (r) => <span className="font-medium">{r.student.name}</span> },
    { key: 'status', header: 'Status', value: (r) => r.enrollment.status, cell: (r) => <StatusBadge status={r.enrollment.status} /> },
    { key: 'entered', header: 'Marked', align: 'right', value: (r) => r.enteredCount, cell: (r) => `${r.enteredCount} / ${data.assessments.length}` },
    { key: 'runningPercent', header: 'Current %', align: 'right', cell: (r) => formatPercent(r.runningPercent) },
    { key: 'total', header: 'Total', align: 'right', value: (r) => (r.complete ? r.total : null), cell: (r) => (r.complete ? formatNumber(r.total, 2) : '—') },
    { key: 'letter', header: 'Letter', align: 'center', value: (r) => (r.complete || r.letter === 'W' ? r.letter : null), cell: (r) => <GradeBadge letter={r.complete || r.letter === 'W' ? r.letter : null} passed={r.passed} /> },
    { key: 'passed', header: 'Result', value: (r) => (r.passed == null ? '' : r.passed ? 'Pass' : 'Fail'), cell: (r) => <PassFailBadge passed={r.passed} /> },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <Link to={`/teacher/courses/${o.id}`} className="font-semibold hover:underline">
            {o.course.code} — {o.course.title}
          </Link>
          <span className="text-sm text-muted-foreground">
            {o.semester.name} · Section {o.section}
          </span>
          <GradeStatusBadge status={o.gradeStatus} />
        </div>
        <GradeSheetExportMenu offeringId={o.id} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard
          label={hasFinal ? 'Class average' : 'Running average'}
          value={hasFinal ? formatNumber(s.average, 1) : formatPercent(s.runningAverage)}
          hint={hasFinal ? `Running ${formatPercent(s.runningAverage)}` : 'Based on marks entered so far'}
          icon={BarChart3}
        />
        <StatCard label="Pass rate" value={formatPercent(s.passRate)} hint={hasFinal ? `${s.passed} passed · ${s.failed} failed` : 'Needs complete results'} icon={CheckCircle2} tone="teal" />
        <StatCard label="Highest" value={formatNumber(s.highest, 2)} icon={TrendingUp} tone="success" hint="Complete results only" />
        <StatCard label="Lowest" value={formatNumber(s.lowest, 2)} icon={TrendingDown} tone={s.lowest != null && s.lowest < passMark ? 'danger' : 'default'} hint={`Pass mark ${passMark}`} />
        <StatCard label="Students" value={s.studentCount} icon={Users} hint={`${s.completeCount} with complete marks`} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard
          title="Grade distribution"
          description="Letter grades of students with complete marks."
          empty={!hasFinal}
          emptyText="No student has a complete set of marks yet."
          tableColumns={[
            { key: 'letter', header: 'Grade' },
            { key: 'count', header: 'Students' },
          ]}
          tableRows={s.distribution}
        >
          <GradeDistributionChart data={s.distribution} />
        </ChartCard>
        <ChartCard
          title="Assessment averages"
          description="Class average on each assessment, as a percentage of its maximum marks."
          empty={!assessmentData.some((a) => a.pct != null)}
          emptyText="No marks entered yet."
          tableColumns={[
            { key: 'name', header: 'Assessment' },
            { key: 'average', header: 'Average marks', format: (v, r) => (v == null ? '—' : `${formatNumber(v, 1)} / ${r.maxMarks}`) },
            { key: 'pct', header: 'Average %', format: (v) => formatPercent(v) },
            { key: 'entered', header: 'Marked', format: (v, r) => `${v} / ${r.expected}` },
          ]}
          tableRows={assessmentData}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={assessmentData} margin={{ top: 16, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid {...gridProps} />
              <XAxis dataKey="name" {...axisProps} interval={0} tick={{ ...axisProps.tick, fontSize: 11 }} />
              <YAxis domain={[0, 100]} {...axisProps} tickFormatter={(v) => `${v}%`} />
              <Tooltip {...tooltipProps} formatter={(v) => [v == null ? '—' : `${v}%`, 'Class average']} />
              <Bar dataKey="pct" name="Class average" fill={SERIES[0]} radius={barRadius} maxBarSize={40} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <Card>
        <CardHeader>
          <div>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="size-4 text-muted-foreground" aria-hidden="true" /> Students needing support
            </CardTitle>
            <CardDescription className="mt-1">
              Current standing below {passMark + 10}% (high risk: below the pass mark of {passMark}%).
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {struggling.length === 0 ? (
            <EmptyState compact icon={Award} title="No students at risk" description="Every active student is comfortably above the pass mark." />
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Risk</TableHead>
                    <TableHead className="text-right">Current %</TableHead>
                    <TableHead className="text-right">Weighted total</TableHead>
                    <TableHead>
                      <span className="sr-only">Details</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {struggling.map((st) => (
                    <TableRow key={st.enrollmentId}>
                      <TableCell>
                        <p className="font-medium">{st.student.name}</p>
                        <p className="text-xs text-muted-foreground tabular">{st.student.studentNumber}</p>
                      </TableCell>
                      <TableCell>
                        {st.risk === 'high' ? (
                          <Badge variant="danger">
                            <AlertTriangle aria-hidden="true" /> High risk
                          </Badge>
                        ) : (
                          <Badge variant="warning">Moderate risk</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular">{formatPercent(st.runningPercent)}</TableCell>
                      <TableCell className="text-right tabular">
                        {formatNumber(st.total, 2)}
                        {!st.complete && <span className="text-xs text-muted-foreground"> (partial)</span>}
                      </TableCell>
                      <TableCell className="text-right">
                        <Link to={studentLink(st.enrollmentId)} className="text-sm font-medium text-primary hover:underline">
                          View performance
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>All results</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={resultColumns}
            rows={rows}
            rowKey={(r) => r.enrollmentId}
            onRowClick={(r) => navigate(studentLink(r.enrollmentId))}
            exportName={`${o.course.code}_results`}
            exportTitle={`Results — ${o.course.code} ${o.course.title}`}
            exportSubtitle={o.semester.name}
            university={university}
            searchPlaceholder="Search students…"
            emptyTitle="No students enrolled"
            pageSize={20}
          />
        </CardContent>
      </Card>
    </div>
  )
}

export function PerformanceReportsPage() {
  const { offeringId: paramId } = useParams()
  const navigate = useNavigate()
  const lookups = useLookups()
  const { data: offerings, loading, error, refetch } = useQuery(() => store.teacher.listMyOfferings({}), [])

  if (loading && !offerings) return <PageSkeleton />
  if (error) {
    return (
      <>
        <PageHeader title="Performance reports" />
        <ErrorState error={error} onRetry={refetch} />
      </>
    )
  }

  const selectedId = defaultOfferingId(offerings, paramId, lookups?.currentSemester?.id)

  return (
    <>
      <PageHeader
        title="Performance reports"
        description="Class results, assessment averages and students who may need support."
        actions={offerings.length > 0 && <OfferingPicker offerings={offerings} value={selectedId} onChange={(id) => navigate(`/teacher/reports/${id}`)} />}
      />
      {offerings.length === 0 ? (
        <Card>
          <EmptyState icon={BarChart3} title="No courses assigned" description="Reports become available once you have course offerings." />
        </Card>
      ) : (
        <Report key={selectedId} offeringId={selectedId} university={lookups?.university} />
      )}
    </>
  )
}
