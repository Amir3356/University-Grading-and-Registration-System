import { useState } from 'react'
import { AlertTriangle, BarChart3, ClipboardList, PenLine } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DataTable } from '@/components/common/DataTable'
import { EmptyState } from '@/components/common/EmptyState'
import { ErrorState } from '@/components/common/ErrorState'
import { PageSkeleton } from '@/components/common/Loading'
import { PageHeader } from '@/components/common/PageHeader'
import { GradeBadge, GradeStatusBadge, StatusBadge } from '@/components/common/StatusBadge'
import { useLookups } from '@/context/lookups-context'
import { useQuery } from '@/hooks/useStore'
import { formatDate, formatDateTime, formatPercent } from '@/lib/format'
import { sumWeights } from '@/lib/grading'
import { store } from '@/store'
import { actionLabel, describeChange, typeLabel } from '../lib'

function Detail({ label, children }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium">{children ?? '—'}</dd>
    </div>
  )
}

function GradeHistory({ offeringId, university }) {
  const { data, loading, error, refetch } = useQuery(() => store.grades.getGradeHistory(offeringId), [offeringId])
  const columns = [
    { key: 'createdAt', header: 'When', cell: (r) => <span className="whitespace-nowrap">{formatDateTime(r.createdAt)}</span>, value: (r) => r.createdAt },
    { key: 'userName', header: 'Who' },
    { key: 'action', header: 'Action', cell: (r) => <Badge variant="outline">{actionLabel(r.action)}</Badge>, value: (r) => actionLabel(r.action) },
    { key: 'details', header: 'Details', className: 'min-w-56 whitespace-normal' },
    { key: 'reason', header: 'Reason', className: 'min-w-40 whitespace-normal', value: (r) => r.reason ?? '', cell: (r) => r.reason || <span className="text-muted-foreground">—</span> },
    {
      key: 'change',
      header: 'Before → after',
      sortable: false,
      className: 'whitespace-normal tabular',
      value: (r) => describeChange(r.before, r.after) ?? '',
      cell: (r) => describeChange(r.before, r.after) || <span className="text-muted-foreground">—</span>,
    },
  ]
  return (
    <DataTable
      columns={columns}
      rows={data}
      loading={loading}
      error={error}
      onRetry={refetch}
      exportName="grade_history"
      exportTitle="Grade change history"
      university={university}
      emptyTitle="No grade changes recorded yet"
      initialSort={{ key: 'createdAt', dir: 'desc' }}
      searchPlaceholder="Search history…"
    />
  )
}

export function CourseDetailPage() {
  const { offeringId } = useParams()
  const navigate = useNavigate()
  const lookups = useLookups()
  const [tab, setTab] = useState('students')
  const { data, loading, error, refetch } = useQuery(() => store.teacher.getMyOffering(offeringId), [offeringId])

  if (loading && !data) return <PageSkeleton />
  if (error) {
    return (
      <>
        <PageHeader title="Course" backTo="/teacher/courses" backLabel="My courses" />
        <ErrorState error={error} onRetry={refetch} />
      </>
    )
  }

  const { offering: o, assessments, students } = data
  const weightTotal = sumWeights(assessments)
  const activeCount = students.filter((s) => s.enrollment.status !== 'withdrawn').length

  const classColumns = [
    { key: 'studentNumber', header: 'Student ID', value: (r) => r.student.studentNumber, cell: (r) => <span className="tabular">{r.student.studentNumber}</span> },
    { key: 'name', header: 'Name', value: (r) => r.student.name, cell: (r) => <span className="font-medium">{r.student.name}</span> },
    { key: 'email', header: 'Email', value: (r) => r.student.email },
    { key: 'department', header: 'Department', value: (r) => r.student.department?.name },
    { key: 'status', header: 'Status', value: (r) => r.enrollment.status, cell: (r) => <StatusBadge status={r.enrollment.status} /> },
    { key: 'repeat', header: 'Repeat', value: (r) => (r.enrollment.isRepeat ? 'Yes' : 'No'), cell: (r) => (r.enrollment.isRepeat ? <Badge variant="warning">Repeat</Badge> : <span className="text-muted-foreground">—</span>) },
    { key: 'current', header: 'Current %', align: 'right', value: (r) => r.runningPercent, cell: (r) => formatPercent(r.runningPercent) },
    {
      key: 'letter',
      header: 'Letter',
      align: 'center',
      value: (r) => (r.complete || r.letter === 'W' ? r.letter : ''),
      cell: (r) => <GradeBadge letter={r.complete || r.letter === 'W' ? r.letter : null} />,
    },
  ]

  return (
    <>
      <PageHeader
        title={`${o.course.code} — ${o.course.title}`}
        description={`${o.semester.name} · Section ${o.section} · ${o.course.creditHours} credits`}
        backTo="/teacher/courses"
        backLabel="My courses"
        actions={
          <>
            <Button variant="outline" asChild>
              <Link to={`/teacher/assessments/${o.id}`}>
                <ClipboardList /> Manage assessments
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to={`/teacher/reports/${o.id}`}>
                <BarChart3 /> Performance report
              </Link>
            </Button>
            <Button asChild>
              <Link to={`/teacher/grade-entry/${o.id}`}>
                <PenLine /> Enter grades
              </Link>
            </Button>
          </>
        }
      />

      <Card className="mb-6">
        <CardContent>
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            <Detail label="Grade status">
              <GradeStatusBadge status={o.gradeStatus} />
            </Detail>
            <Detail label="Schedule">{o.schedule}</Detail>
            <Detail label="Room">{o.room}</Detail>
            <Detail label="Enrolled">
              <span className="tabular">
                {o.enrolledCount}
                {o.capacity ? ` / ${o.capacity}` : ''}
                {o.withdrawnCount ? ` (${o.withdrawnCount} withdrawn)` : ''}
              </span>
            </Detail>
            <Detail label="Assessments">
              <span className="tabular">
                {assessments.length} · {weightTotal}% weight
              </span>
            </Detail>
            <Detail label="Department">{o.course.department?.name}</Detail>
          </dl>
        </CardContent>
      </Card>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="students">Class list ({students.length})</TabsTrigger>
          <TabsTrigger value="assessments">Assessments ({assessments.length})</TabsTrigger>
          <TabsTrigger value="history">Grade history</TabsTrigger>
        </TabsList>

        <TabsContent value="students">
          <DataTable
            columns={classColumns}
            rows={students}
            rowKey={(r) => r.enrollment.id}
            onRowClick={(r) => navigate(`/teacher/courses/${o.id}/students/${r.enrollment.id}`)}
            exportName={`${o.course.code}_class_list`}
            exportTitle={`Class list — ${o.course.code} ${o.course.title}`}
            exportSubtitle={`${o.semester.name} · Section ${o.section} · ${activeCount} active students`}
            university={lookups?.university}
            emptyTitle="No students enrolled"
            searchPlaceholder="Search students…"
            pageSize={20}
          />
        </TabsContent>

        <TabsContent value="assessments">
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Assessment plan</CardTitle>
                <CardDescription className="mt-1">How the final grade is calculated for this course.</CardDescription>
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link to={`/teacher/assessments/${o.id}`}>Manage assessments</Link>
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {weightTotal !== 100 && assessments.length > 0 && (
                <Alert variant="warning">
                  <AlertTriangle />
                  <AlertDescription>Weights total {weightTotal}%. They must add up to exactly 100% before grades can be submitted.</AlertDescription>
                </Alert>
              )}
              {assessments.length === 0 ? (
                <EmptyState
                  compact
                  icon={ClipboardList}
                  title="No assessments yet"
                  description="Create assessments to start entering marks."
                  action={
                    <Button size="sm" asChild>
                      <Link to={`/teacher/assessments/${o.id}`}>Create assessments</Link>
                    </Button>
                  }
                />
              ) : (
                <div className="overflow-x-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead className="text-right">Max marks</TableHead>
                        <TableHead className="text-right">Weight</TableHead>
                        <TableHead>Due</TableHead>
                        <TableHead>Released</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {assessments.map((a) => (
                        <TableRow key={a.id}>
                          <TableCell className="font-medium">{a.name}</TableCell>
                          <TableCell>{typeLabel(a.type)}</TableCell>
                          <TableCell className="text-right tabular">{a.maxMarks}</TableCell>
                          <TableCell className="text-right tabular">{a.weight}%</TableCell>
                          <TableCell>{formatDate(a.dueDate)}</TableCell>
                          <TableCell>{a.isReleased ? <Badge variant="success">Released</Badge> : <Badge variant="muted">Hidden</Badge>}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                    <TableFooter>
                      <TableRow>
                        <TableCell colSpan={3} className="font-medium">
                          Total
                        </TableCell>
                        <TableCell className="text-right font-medium tabular">{weightTotal}%</TableCell>
                        <TableCell colSpan={2} />
                      </TableRow>
                    </TableFooter>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">{tab === 'history' && <GradeHistory offeringId={o.id} university={lookups?.university} />}</TabsContent>
      </Tabs>
    </>
  )
}
