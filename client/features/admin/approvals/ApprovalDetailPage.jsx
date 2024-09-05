import { useState } from 'react'
import { CheckCircle2, FileText, Globe, History, MessageSquare, Undo2 } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { EmptyState } from '@/components/common/EmptyState'
import { ErrorState } from '@/components/common/ErrorState'
import { ExportMenu } from '@/components/common/ExportMenu'
import { PageSkeleton, TableSkeleton } from '@/components/common/Loading'
import { PageHeader } from '@/components/common/PageHeader'
import { GradeStatusBadge, StatusBadge } from '@/components/common/StatusBadge'
import { useLookups } from '@/context/lookups-context'
import { useQuery, useMutation } from '@/hooks/useStore'
import { formatDateTime } from '@/lib/format'
import { store } from '@/store'
import { GradeSheetInsights, GradeSheetStats, GradeSheetTable } from '../reports/GradeSheetParts'
import { gradeSheetExportColumns, sheetTitle } from '../reports/grade-sheet-utils'

function Meta({ label, children }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium">{children || '—'}</dd>
    </div>
  )
}

export function ApprovalDetailPage() {
  const { requestId } = useParams()
  const lookups = useLookups()
  const { data, loading, error, refetch } = useQuery(() => store.grades.getApprovalRequest(requestId), [requestId])
  const [dialog, setDialog] = useState(null) // 'approve' | 'reject' | 'publish'
  const [publishNow, setPublishNow] = useState(false)

  const [approve] = useMutation((comment) => store.grades.approveGrades(requestId, { comment, publish: publishNow }), {
    success: () => (publishNow ? 'Grades approved and published.' : 'Grades approved.'),
  })
  const [reject] = useMutation((comment) => store.grades.rejectGrades(requestId, { comment }), { success: 'Grades returned to the teacher.' })
  const [publish] = useMutation((offeringId) => store.grades.publishGrades(offeringId), { success: 'Grades published to students.' })

  if (loading && !data) return <PageSkeleton />
  if (error)
    return (
      <>
        <PageHeader title="Grade approval" backTo="/admin/grade-approvals" backLabel="Grade approvals" />
        <ErrorState error={error} onRetry={refetch} />
      </>
    )

  const { request, offering } = data
  const pending = request.status === 'pending'
  const canPublish = request.status === 'approved' && offering.gradeStatus === 'approved'
  const university = lookups?.university

  const openApprove = () => {
    setPublishNow(false)
    setDialog('approve')
  }

  return (
    <>
      <PageHeader
        title={`${offering.course.code} · ${offering.course.title}`}
        description={`${offering.semester?.name ?? ''} · Section ${offering.section} · ${offering.course.creditHours} credit hours`}
        backTo="/admin/grade-approvals"
        backLabel="Grade approvals"
        actions={
          <>
            <ExportMenu
              filename={`grade_sheet_${offering.course.code}`}
              title={`Grade sheet — ${sheetTitle(data)}`}
              subtitle={`Teacher: ${offering.teacher?.name ?? '—'} · Status: ${request.status}`}
              columns={gradeSheetExportColumns(data.assessments)}
              rows={data.rows}
              university={university}
            />
            {pending && (
              <>
                <Button variant="outline" onClick={() => setDialog('reject')}>
                  <Undo2 /> Reject
                </Button>
                <Button onClick={openApprove}>
                  <CheckCircle2 /> Approve
                </Button>
              </>
            )}
            {canPublish && (
              <Button variant="teal" onClick={() => setDialog('publish')}>
                <Globe /> Publish
              </Button>
            )}
          </>
        }
      />

      <div className="grid gap-6">
        <Card>
          <CardContent className="grid gap-4">
            <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <Meta label="Request status">
                <StatusBadge status={request.status} />
              </Meta>
              <Meta label="Course grade status">
                <GradeStatusBadge status={offering.gradeStatus} />
              </Meta>
              <Meta label="Submitted by">{request.submitterName}</Meta>
              <Meta label="Submitted">{formatDateTime(request.submittedAt)}</Meta>
              <Meta label="Teacher of record">{offering.teacher?.name}</Meta>
            </dl>
            {request.note && (
              <Alert variant="info">
                <MessageSquare />
                <AlertTitle>Note from the teacher</AlertTitle>
                <AlertDescription>{request.note}</AlertDescription>
              </Alert>
            )}
            {!pending && request.comment && (
              <Alert variant={request.status === 'rejected' ? 'destructive' : 'success'}>
                {request.status === 'rejected' ? <Undo2 /> : <CheckCircle2 />}
                <AlertTitle>
                  {request.status === 'rejected' ? 'Returned' : 'Approved'} {request.reviewedAt ? `on ${formatDateTime(request.reviewedAt)}` : ''}
                </AlertTitle>
                <AlertDescription>{request.comment}</AlertDescription>
              </Alert>
            )}
            {pending && !data.weightsValid && (
              <Alert variant="warning">
                <AlertDescription>Assessment weights total {data.weightTotal}%, not 100%. Consider returning this submission.</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        <GradeSheetStats stats={data.stats} />
        <GradeSheetInsights sheet={data} />

        <section className="grid gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-semibold">Grade sheet</h2>
            <Button variant="ghost" size="sm" asChild>
              <Link to={`/admin/reports/grade-sheet/${offering.id}`}>
                <FileText /> Printable grade sheet
              </Link>
            </Button>
          </div>
          <GradeSheetTable sheet={data} />
        </section>

        <div className="grid gap-6 xl:grid-cols-2">
          <SubmissionHistory history={data.history} currentId={request.id} teachers={lookups?.teachers ?? []} />
          <GradeChangeHistory offeringId={offering.id} />
        </div>
      </div>

      <ConfirmDialog
        open={dialog === 'approve'}
        onOpenChange={(v) => !v && setDialog(null)}
        title="Approve these grades?"
        description={`Final grades for ${data.stats.studentCount} student(s) in ${offering.course.code} will be approved and locked.`}
        confirmLabel={publishNow ? 'Approve & publish' : 'Approve'}
        reasonLabel="Comment"
        reasonOptional
        reasonPlaceholder="Optional comment for the teacher"
        onConfirm={async (comment) => (await approve(comment)).ok}
      >
        <div className="flex items-start gap-2 rounded-md border p-3">
          <Checkbox id="publish-now" checked={publishNow} onCheckedChange={(v) => setPublishNow(v === true)} className="mt-0.5" />
          <div>
            <Label htmlFor="publish-now">Publish immediately</Label>
            <p className="mt-0.5 text-xs text-muted-foreground">Students are notified and grades count toward GPA right away.</p>
          </div>
        </div>
      </ConfirmDialog>
      <ConfirmDialog
        open={dialog === 'reject'}
        onOpenChange={(v) => !v && setDialog(null)}
        title="Return grades to the teacher?"
        description="The grades are unlocked so the teacher can correct and resubmit them. The teacher sees your reason."
        confirmLabel="Reject submission"
        variant="destructive"
        reasonLabel="Reason for rejection"
        reasonPlaceholder="e.g. Final exam marks for two students appear to be missing."
        onConfirm={async (comment) => (await reject(comment)).ok}
      />
      <ConfirmDialog
        open={dialog === 'publish'}
        onOpenChange={(v) => !v && setDialog(null)}
        title={`Publish grades for ${offering.course.code}?`}
        description="Final grades become visible to all enrolled students, who will be notified. Published grades count toward GPA and can no longer be modified."
        confirmLabel="Publish grades"
        onConfirm={async () => (await publish(offering.id)).ok}
      />
    </>
  )
}

function SubmissionHistory({ history, currentId, teachers }) {
  const nameOf = (userId) => teachers.find((t) => t.userId === userId)?.name ?? 'Administrator'
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Submission history</CardTitle>
          <CardDescription className="mt-1">All submissions of final grades for this course offering.</CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        {!history.length ? (
          <EmptyState compact title="No submissions" />
        ) : (
          <ol className="grid gap-3">
            {history.map((h) => (
              <li key={h.id} className="rounded-lg border p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">
                    {formatDateTime(h.submittedAt)} · {nameOf(h.submittedBy)}
                    {h.id === currentId && <span className="ml-2 text-xs font-normal text-muted-foreground">(this request)</span>}
                  </span>
                  {h.id === currentId ? (
                    <StatusBadge status={h.status} />
                  ) : (
                    <Link to={`/admin/grade-approvals/${h.id}`} className="rounded focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
                      <StatusBadge status={h.status} />
                    </Link>
                  )}
                </div>
                {h.note && <p className="mt-1 text-muted-foreground">Teacher note: {h.note}</p>}
                {h.comment && (
                  <p className="mt-1 text-muted-foreground">
                    Review{h.reviewedAt ? ` (${formatDateTime(h.reviewedAt)})` : ''}: {h.comment}
                  </p>
                )}
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  )
}

const changeText = (l) => {
  if (l.before?.marks === undefined && l.after?.marks === undefined) return null
  return `${l.before?.marks ?? '—'} → ${l.after?.marks ?? '—'}`
}

function GradeChangeHistory({ offeringId }) {
  const { data, loading, error, refetch } = useQuery(() => store.grades.getGradeHistory(offeringId), [offeringId])
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Grade change history</CardTitle>
          <CardDescription className="mt-1">Who changed what and why, most recent first.</CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        {loading && !data ? (
          <TableSkeleton rows={4} cols={3} />
        ) : error ? (
          <ErrorState error={error} onRetry={refetch} />
        ) : !data.length ? (
          <EmptyState compact icon={History} title="No changes recorded" />
        ) : (
          <div className="max-h-[28rem] overflow-y-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>When</TableHead>
                  <TableHead>Who</TableHead>
                  <TableHead>What</TableHead>
                  <TableHead>Reason</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="text-xs whitespace-nowrap">{formatDateTime(l.createdAt)}</TableCell>
                    <TableCell className="whitespace-nowrap">{l.userName}</TableCell>
                    <TableCell className="min-w-52 whitespace-normal">
                      {l.details}
                      {changeText(l) && <span className="tabular ml-1 text-xs text-muted-foreground">({changeText(l)})</span>}
                    </TableCell>
                    <TableCell className="min-w-40 whitespace-normal text-muted-foreground">{l.reason ?? '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
