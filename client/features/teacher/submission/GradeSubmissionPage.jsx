import { useState } from 'react'
import { CheckCircle2, CircleAlert, FileCheck2, Lock, Send, XCircle } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { ChartCard } from '@/components/charts/ChartCard'
import { GradeDistributionChart } from '@/components/charts/GradeDistributionChart'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { DataTable } from '@/components/common/DataTable'
import { EmptyState } from '@/components/common/EmptyState'
import { ErrorState } from '@/components/common/ErrorState'
import { FormField } from '@/components/common/FormField'
import { PageSkeleton, TableSkeleton } from '@/components/common/Loading'
import { PageHeader } from '@/components/common/PageHeader'
import { StatCard } from '@/components/common/StatCard'
import { GradeBadge, GradeStatusBadge, PassFailBadge, StatusBadge } from '@/components/common/StatusBadge'
import { useLookups } from '@/context/lookups-context'
import { useQuery, useMutation } from '@/hooks/useStore'
import { formatDateTime, formatGpa, formatNumber, formatPercent } from '@/lib/format'
import { cn } from '@/lib/utils'
import { store } from '@/store'
import { lockedExplanation, offeringLabel, PENDING_STATUSES } from '../lib'

function CheckItem({ ok, title, detail, action }) {
  const Icon = ok ? CheckCircle2 : XCircle
  return (
    <li className="flex items-start gap-3 py-2.5">
      <Icon className={cn('mt-0.5 size-5 shrink-0', ok ? 'text-success' : 'text-destructive')} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">
          <span className="sr-only">{ok ? 'Passed: ' : 'Not met: '}</span>
          {title}
        </p>
        {detail && <p className="text-sm text-muted-foreground">{detail}</p>}
      </div>
      {!ok && action}
    </li>
  )
}

const previewColumns = [
  { key: 'studentNumber', header: 'Student ID', value: (r) => r.student.studentNumber, cell: (r) => <span className="tabular">{r.student.studentNumber}</span> },
  { key: 'name', header: 'Student', value: (r) => r.student.name, cell: (r) => <span className="font-medium">{r.student.name}</span> },
  { key: 'total', header: 'Total', align: 'right', value: (r) => (r.enrollment.status === 'withdrawn' ? null : r.total), cell: (r) => (r.enrollment.status === 'withdrawn' ? '—' : formatNumber(r.total, 2)) },
  { key: 'letter', header: 'Letter', align: 'center', value: (r) => r.letter, cell: (r) => <GradeBadge letter={r.complete || r.letter === 'W' ? r.letter : null} passed={r.passed} /> },
  { key: 'gradePoints', header: 'Points', align: 'right', value: (r) => r.gradePoints, cell: (r) => formatGpa(r.gradePoints) },
  {
    key: 'passed',
    header: 'Result',
    value: (r) => (r.enrollment.status === 'withdrawn' ? 'Withdrawn' : r.passed == null ? '' : r.passed ? 'Pass' : 'Fail'),
    cell: (r) => (r.enrollment.status === 'withdrawn' ? <StatusBadge status="withdrawn" /> : <PassFailBadge passed={r.passed} />),
  },
]

function SubmissionPanel({ offeringId, university }) {
  const { data: gb, loading, error, refetch } = useQuery(() => store.grades.getGradebook(offeringId), [offeringId])
  const [note, setNote] = useState('')
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [submit] = useMutation((id, payload) => store.grades.submitGrades(id, payload), {
    success: (r) => (r.status === 'published' ? 'Grades published to students.' : 'Grades submitted for approval.'),
    onSuccess: () => setNote(''),
  })

  if (loading && !gb) return <TableSkeleton rows={6} cols={5} />
  if (error) return <ErrorState error={error} onRetry={refetch} />

  const o = gb.offering
  const s = gb.stats
  const activeRows = gb.rows.filter((r) => r.enrollment.status !== 'withdrawn')
  const incompleteStudents = activeRows.filter((r) => !r.complete).length
  const checks = {
    weights: gb.weightsValid,
    students: s.studentCount > 0,
    marks: s.studentCount > 0 && gb.assessments.length > 0 && s.missingMarks === 0,
    unlocked: !gb.locked,
  }
  const ready = Object.values(checks).every(Boolean)
  const direct = !gb.approvalWorkflowEnabled

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h2 className="text-base font-semibold">{offeringLabel(o)}</h2>
        <span className="text-sm text-muted-foreground">
          {o.semester.name} · Section {o.section}
        </span>
        <GradeStatusBadge status={o.gradeStatus} />
      </div>

      {gb.locked && (
        <Alert variant="info">
          <Lock />
          <AlertTitle>{o.gradeStatus === 'submitted' ? 'Awaiting approval' : 'Already finalised'}</AlertTitle>
          <AlertDescription>
            {lockedExplanation(o.gradeStatus)}
            {gb.latestRequest && ` Submitted ${formatDateTime(gb.latestRequest.submittedAt)}.`}
          </AlertDescription>
        </Alert>
      )}
      {o.gradeStatus === 'rejected' && gb.latestRequest?.status === 'rejected' && (
        <Alert variant="destructive">
          <CircleAlert />
          <AlertTitle>Returned by the registrar</AlertTitle>
          <AlertDescription>
            <p>“{gb.latestRequest.comment}”</p>
            <p className="text-xs">Reviewed {formatDateTime(gb.latestRequest.reviewedAt)}</p>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Pre-submission checklist</CardTitle>
              <CardDescription className="mt-1">Every item must pass before grades can be submitted.</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              <CheckItem
                ok={checks.weights}
                title="Assessment weights total 100%"
                detail={`Current total: ${gb.weightTotal}% across ${gb.assessments.length} assessment(s).`}
                action={
                  <Button variant="outline" size="sm" asChild>
                    <Link to={`/teacher/assessments/${o.id}`}>Fix</Link>
                  </Button>
                }
              />
              <CheckItem ok={checks.students} title="Students are enrolled" detail={`${s.studentCount} active student(s)${gb.rows.length > s.studentCount ? `, ${gb.rows.length - s.studentCount} withdrawn (graded W)` : ''}.`} />
              <CheckItem
                ok={checks.marks}
                title="All marks entered"
                detail={checks.marks ? 'Every active student has a mark for every assessment.' : `${s.missingMarks} mark(s) missing for ${incompleteStudents} student(s).`}
                action={
                  <Button variant="outline" size="sm" asChild>
                    <Link to={`/teacher/grade-entry/${o.id}`}>Enter marks</Link>
                  </Button>
                }
              />
              <CheckItem ok={checks.unlocked} title="Grades are editable (not yet submitted)" detail={checks.unlocked ? 'Grade status allows submission.' : 'This course has already been submitted.'} />
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Submit</CardTitle>
              <CardDescription className="mt-1">
                {direct ? 'The approval workflow is off: submitting publishes final grades to students immediately.' : 'Grades are sent to the registrar for approval before students can see them.'}
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField label={direct ? 'Note (optional)' : 'Note to the approver (optional)'} hint="Recorded with the submission.">
              <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} disabled={!ready} placeholder="e.g. Two students sat the deferred final exam." />
            </FormField>
            <Button onClick={() => setConfirmOpen(true)} disabled={!ready} className="w-full sm:w-auto">
              <Send /> {direct ? 'Publish grades' : 'Submit for approval'}
            </Button>
            {!ready && !gb.locked && <p className="text-xs text-muted-foreground">Complete the checklist to enable submission.</p>}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Class average" value={formatNumber(s.average, 1)} hint={`${s.completeCount} complete of ${s.studentCount}`} />
        <StatCard label="Pass rate" value={formatPercent(s.passRate)} hint={`${s.passed} passed · ${s.failed} failed`} tone="teal" />
        <StatCard label="Highest" value={formatNumber(s.highest, 2)} tone="success" />
        <StatCard label="Lowest" value={formatNumber(s.lowest, 2)} tone={s.lowest != null && s.lowest < gb.passMark ? 'danger' : 'default'} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Final grade preview</CardTitle>
              <CardDescription className="mt-1">Computed from the saved marks with the active grading scale.</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <DataTable
              columns={previewColumns}
              rows={gb.rows}
              rowKey={(r) => r.enrollmentId}
              exportName={`${o.course.code}_final_grades_preview`}
              exportTitle={`Final grades — ${o.course.code} ${o.course.title}`}
              exportSubtitle={o.semester.name}
              university={university}
              pageSize={10}
              dense
            />
          </CardContent>
        </Card>
        <ChartCard
          title="Grade distribution"
          description="Students with complete marks."
          empty={!s.completeCount}
          emptyText="No complete results yet."
          tableColumns={[
            { key: 'letter', header: 'Grade' },
            { key: 'count', header: 'Students' },
          ]}
          tableRows={s.distribution}
        >
          <GradeDistributionChart data={s.distribution} />
        </ChartCard>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={direct ? `Publish ${o.course.code} grades to students?` : `Send ${o.course.code} grades for approval?`}
        description={
          direct
            ? `Final grades for ${s.studentCount} student(s) will be published immediately and students will be notified. Marks will be locked.`
            : `Final grades for ${s.studentCount} student(s) will be sent to the registrar. Marks are locked while under review; if they are returned you can edit them again.`
        }
        confirmLabel={direct ? 'Publish grades' : 'Submit for approval'}
        onConfirm={async () => (await submit(o.id, { note })).ok}
      />
    </div>
  )
}

function SubmissionHistory({ offerings }) {
  const reviewed = offerings.filter((o) => !PENDING_STATUSES.includes(o.gradeStatus) || o.gradeStatus === 'rejected')
  const ids = reviewed.map((o) => o.id).join(',')
  const { data, loading, error, refetch } = useQuery(
    () => reviewed.map((o) => ({ offering: o, request: store.grades.getGradebook(o.id).latestRequest })),
    [ids],
  )
  const rows = (data ?? []).filter((r) => r.request).sort((a, b) => b.request.submittedAt.localeCompare(a.request.submittedAt))
  const columns = [
    {
      key: 'course',
      header: 'Course',
      value: (r) => `${r.offering.course.code} ${r.offering.course.title}`,
      cell: (r) => (
        <Link to={`/teacher/courses/${r.offering.id}`} className="font-medium hover:underline" onClick={(e) => e.stopPropagation()}>
          {r.offering.course.code}
        </Link>
      ),
    },
    { key: 'semester', header: 'Semester', value: (r) => r.offering.semester.name },
    { key: 'submittedAt', header: 'Submitted', value: (r) => r.request.submittedAt, cell: (r) => formatDateTime(r.request.submittedAt) },
    { key: 'status', header: 'Request', value: (r) => r.request.status, cell: (r) => <StatusBadge status={r.request.status} /> },
    { key: 'gradeStatus', header: 'Course status', value: (r) => r.offering.gradeStatus, cell: (r) => <GradeStatusBadge status={r.offering.gradeStatus} /> },
    { key: 'reviewedAt', header: 'Reviewed', value: (r) => r.request.reviewedAt, cell: (r) => formatDateTime(r.request.reviewedAt) },
    { key: 'comment', header: 'Admin comment', className: 'min-w-48 whitespace-normal', value: (r) => r.request.comment ?? '', cell: (r) => r.request.comment || <span className="text-muted-foreground">—</span> },
    { key: 'note', header: 'Your note', className: 'min-w-40 whitespace-normal', value: (r) => r.request.note ?? '', cell: (r) => r.request.note || <span className="text-muted-foreground">—</span> },
  ]
  return (
    <DataTable
      columns={columns}
      rows={data ? rows : undefined}
      loading={loading}
      error={error}
      onRetry={refetch}
      rowKey={(r) => r.request.id}
      emptyTitle="No submissions yet"
      emptyDescription="Submitted grade sheets and the registrar's decisions appear here."
      searchPlaceholder="Search submissions…"
    />
  )
}

export function GradeSubmissionPage() {
  const lookups = useLookups()
  const [params, setParams] = useSearchParams()
  const selectedId = params.get('offering')
  const { data: offerings, loading, error, refetch } = useQuery(() => store.teacher.listMyOfferings({}), [])

  if (loading && !offerings) return <PageSkeleton />
  if (error) {
    return (
      <>
        <PageHeader title="Grade submission" />
        <ErrorState error={error} onRetry={refetch} />
      </>
    )
  }

  const pending = offerings.filter((o) => PENDING_STATUSES.includes(o.gradeStatus))
  const selected = offerings.find((o) => o.id === selectedId)
  const selectable = selected && !pending.includes(selected) ? [selected, ...pending] : pending

  return (
    <>
      <PageHeader title="Grade submission" description="Check final grades and submit them for approval." />

      <section aria-labelledby="needs-submission" className="mb-8">
        <h2 id="needs-submission" className="mb-3 text-sm font-semibold text-muted-foreground uppercase">
          Courses needing submission
        </h2>
        {selectable.length === 0 ? (
          <Card>
            <EmptyState icon={FileCheck2} title="Nothing to submit" description="All of your courses' grades have been submitted." />
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {selectable.map((o) => {
              const active = o.id === selectedId
              return (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => setParams({ offering: o.id })}
                  aria-pressed={active}
                  className={cn(
                    'flex flex-col items-start gap-2 rounded-lg border bg-card p-4 text-left transition-colors hover:border-teal/50 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none',
                    active && 'border-primary ring-1 ring-primary',
                  )}
                >
                  <div className="flex w-full items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium">{o.course.code}</p>
                      <p className="truncate text-sm text-muted-foreground">{o.course.title}</p>
                    </div>
                    <GradeStatusBadge status={o.gradeStatus} />
                  </div>
                  <div className="flex flex-wrap gap-1.5 text-xs text-muted-foreground">
                    <span>{o.semester.name}</span>
                    <span>· {o.enrolledCount} students</span>
                    {o.semester.order < (lookups?.currentSemester?.order ?? 0) && PENDING_STATUSES.includes(o.gradeStatus) && <Badge variant="warning">Overdue</Badge>}
                    {!o.weightsValid && <Badge variant="warning">Weights {o.weightTotal}%</Badge>}
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </section>

      {selectedId && (
        <section className="mb-8" aria-label="Selected course">
          {selected ? (
            <SubmissionPanel key={selectedId} offeringId={selectedId} university={lookups?.university} />
          ) : (
            <ErrorState error={{ status: 403, message: 'This course offering is not assigned to you.' }} />
          )}
        </section>
      )}
      {!selectedId && selectable.length > 0 && <p className="mb-8 text-sm text-muted-foreground">Select a course above to review its checklist and submit grades.</p>}

      <section aria-labelledby="history">
        <h2 id="history" className="mb-3 text-sm font-semibold text-muted-foreground uppercase">
          Submission history
        </h2>
        <SubmissionHistory offerings={offerings} />
      </section>
    </>
  )
}
