import { useState } from 'react'
import { AlertTriangle, ClipboardList, Lock, Pencil, Plus, Trash2, Wand2 } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { EmptyState } from '@/components/common/EmptyState'
import { ErrorState } from '@/components/common/ErrorState'
import { FormField } from '@/components/common/FormField'
import { PageSkeleton, TableSkeleton } from '@/components/common/Loading'
import { PageHeader } from '@/components/common/PageHeader'
import { GradeStatusBadge } from '@/components/common/StatusBadge'
import { useLookups } from '@/context/lookups-context'
import { useQuery, useMutation } from '@/hooks/useStore'
import { formatDate } from '@/lib/format'
import { ASSESSMENT_TYPES, round, sumWeights } from '@/lib/grading'
import { cn } from '@/lib/utils'
import { store } from '@/store'
import { OfferingPicker } from '../components/OfferingPicker'
import { defaultOfferingId, isLockedStatus, lockedExplanation, typeLabel } from '../lib'

const TEMPLATE = [
  { name: 'Assignment 1', type: 'assignment', maxMarks: 20, weight: 10, at: 0.2 },
  { name: 'Quiz 1', type: 'quiz', maxMarks: 10, weight: 10, at: 0.35 },
  { name: 'Midterm Exam', type: 'midterm', maxMarks: 50, weight: 30, at: 0.5 },
  { name: 'Assignment 2', type: 'assignment', maxMarks: 20, weight: 10, at: 0.75 },
  { name: 'Final Exam', type: 'final', maxMarks: 100, weight: 40, at: 0.97 },
]

function dateAt(start, end, fraction) {
  const a = new Date(`${start}T00:00:00Z`).getTime()
  const b = new Date(`${end}T00:00:00Z`).getTime()
  return new Date(a + (b - a) * fraction).toISOString().slice(0, 10)
}

function AssessmentFormDialog({ offeringId, assessment, otherWeight, onClose }) {
  const editing = Boolean(assessment)
  const [form, setForm] = useState(() => ({
    name: assessment?.name ?? '',
    type: assessment?.type ?? 'assignment',
    maxMarks: assessment?.maxMarks ?? '',
    weight: assessment?.weight ?? '',
    dueDate: assessment?.dueDate ?? '',
    description: assessment?.description ?? '',
  }))
  const [submit, state] = useMutation(
    (data) => (editing ? store.grades.updateAssessment(assessment.id, data) : store.grades.createAssessment(offeringId, data)),
    { success: editing ? 'Assessment updated.' : 'Assessment created.', onSuccess: onClose },
  )
  const remaining = round(Math.max(0, 100 - otherWeight), 2)
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })
  const fe = state.fieldErrors ?? {}

  return (
    <Dialog open onOpenChange={(v) => !v && !state.loading && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? `Edit ${assessment.name}` : 'New assessment'}</DialogTitle>
          <DialogDescription>Weights across all assessments must total exactly 100%.</DialogDescription>
        </DialogHeader>
        <form
          id="assessment-form"
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault()
            submit(form)
          }}
        >
          <FormField label="Name" required error={fe.name} className="sm:col-span-2">
            <Input value={form.name} onChange={set('name')} placeholder="e.g. Midterm Exam" autoFocus />
          </FormField>
          <FormField label="Type" required error={fe.type}>
            <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ASSESSMENT_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField label="Due date" required error={fe.dueDate}>
            <Input type="date" value={form.dueDate} onChange={set('dueDate')} />
          </FormField>
          <FormField label="Maximum marks" required error={fe.maxMarks}>
            <Input type="number" inputMode="decimal" min={1} max={1000} step="any" value={form.maxMarks} onChange={set('maxMarks')} />
          </FormField>
          <FormField label="Weight (%)" required error={fe.weight} hint={`Remaining weight: ${remaining}%`}>
            <Input type="number" inputMode="decimal" min={0.5} max={100} step="any" value={form.weight} onChange={set('weight')} />
          </FormField>
          <FormField label="Description" error={fe.description} className="sm:col-span-2">
            <Textarea rows={3} value={form.description} onChange={set('description')} placeholder="Optional instructions or coverage" />
          </FormField>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={state.loading}>
            Cancel
          </Button>
          <Button type="submit" form="assessment-form" loading={state.loading}>
            {editing ? 'Save changes' : 'Create assessment'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function OfferingAssessments({ offering }) {
  const { data, loading, error, refetch } = useQuery(() => store.grades.listAssessments(offering.id), [offering.id])
  const [dialog, setDialog] = useState(null) // { assessment|null }
  const [toDelete, setToDelete] = useState(null)
  const [toRelease, setToRelease] = useState(null)
  const [confirmTemplate, setConfirmTemplate] = useState(false)

  const [remove] = useMutation((id) => store.grades.deleteAssessment(id), { success: 'Assessment deleted.' })
  const [setReleased] = useMutation((id, value) => store.grades.setAssessmentReleased(id, value), {
    success: (_r, _id, value) => (value ? 'Marks released. Students have been notified.' : 'Marks hidden from students.'),
  })
  const [applyTemplate, templateState] = useMutation(
    async () => {
      for (const t of TEMPLATE) {
        await store.grades.createAssessment(offering.id, {
          name: t.name,
          type: t.type,
          maxMarks: t.maxMarks,
          weight: t.weight,
          dueDate: dateAt(offering.semester.startDate, offering.semester.endDate, t.at),
          description: '',
        })
      }
    },
    { success: 'Standard assessment template applied.' },
  )

  if (loading && !data) return <TableSkeleton rows={5} cols={6} />
  if (error) return <ErrorState error={error} onRetry={refetch} />

  const locked = isLockedStatus(offering.gradeStatus)
  const total = sumWeights(data)
  const valid = data.length > 0 && Math.abs(total - 100) < 0.001

  return (
    <div className="space-y-4">
      {locked && (
        <Alert variant="info">
          <Lock />
          <AlertTitle>Read-only</AlertTitle>
          <AlertDescription>{lockedExplanation(offering.gradeStatus)} Assessments can no longer be added, edited or deleted. You can still release or hide marks.</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-sm font-medium">Total weight</p>
              <p className={cn('text-lg font-semibold tabular', !valid && 'text-destructive')}>{total}% / 100%</p>
            </div>
            <Progress value={total} className="mt-2" indicatorClassName={valid ? undefined : total > 100 ? 'bg-destructive' : 'bg-warning'} aria-label="Total assessment weight" />
          </div>
          {!locked && (
            <div className="flex shrink-0 flex-wrap gap-2 sm:pl-4">
              {data.length === 0 && (
                <Button variant="outline" onClick={() => setConfirmTemplate(true)} loading={templateState.loading}>
                  <Wand2 /> Apply standard template
                </Button>
              )}
              <Button onClick={() => setDialog({ assessment: null })}>
                <Plus /> Add assessment
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {!valid && data.length > 0 && (
        <Alert variant="warning">
          <AlertTriangle />
          <AlertTitle>Weights total {total}%</AlertTitle>
          <AlertDescription>
            Assessment weights must add up to exactly 100% before grades can be submitted.{' '}
            {total < 100 ? `Add ${round(100 - total, 2)}% more weight.` : `Remove ${round(total - 100, 2)}% of weight.`}
          </AlertDescription>
        </Alert>
      )}

      {data.length === 0 ? (
        <Card>
          <EmptyState
            icon={ClipboardList}
            title="No assessments yet"
            description={locked ? 'This course has no assessments.' : 'Add assessments individually or apply the standard template (assignments, quiz, midterm and final).'}
          />
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Max marks</TableHead>
                <TableHead className="text-right">Weight</TableHead>
                <TableHead>Due date</TableHead>
                <TableHead className="text-right">Marks entered</TableHead>
                <TableHead>Released</TableHead>
                <TableHead className="text-right">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((a) => (
                <TableRow key={a.id}>
                  <TableCell>
                    <p className="font-medium">{a.name}</p>
                    {a.description && <p className="max-w-64 truncate text-xs text-muted-foreground">{a.description}</p>}
                  </TableCell>
                  <TableCell>{typeLabel(a.type)}</TableCell>
                  <TableCell className="text-right tabular">{a.maxMarks}</TableCell>
                  <TableCell className="text-right tabular">{a.weight}%</TableCell>
                  <TableCell>{formatDate(a.dueDate)}</TableCell>
                  <TableCell className="text-right tabular">
                    {a.scoreCount} / {offering.enrolledCount}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={a.isReleased}
                        onCheckedChange={(v) => (v ? setToRelease(a) : setReleased(a.id, false))}
                        aria-label={`Release ${a.name} marks to students`}
                      />
                      <span className="text-xs text-muted-foreground">{a.isReleased ? 'Visible' : 'Hidden'}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon-sm" onClick={() => setDialog({ assessment: a })} disabled={locked} aria-label={`Edit ${a.name}`} title="Edit">
                        <Pencil />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setToDelete(a)}
                        disabled={locked || a.scoreCount > 0}
                        aria-label={`Delete ${a.name}`}
                        title={a.scoreCount > 0 ? 'Marks have been entered — clear them before deleting' : 'Delete'}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={3} className="font-medium">
                  Total
                </TableCell>
                <TableCell className={cn('text-right font-medium tabular', !valid && 'text-destructive')}>{total}%</TableCell>
                <TableCell colSpan={4} />
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      )}

      {dialog && (
        <AssessmentFormDialog
          offeringId={offering.id}
          assessment={dialog.assessment}
          otherWeight={sumWeights(data.filter((a) => a.id !== dialog.assessment?.id))}
          onClose={() => setDialog(null)}
        />
      )}

      <ConfirmDialog
        open={Boolean(toDelete)}
        onOpenChange={(v) => !v && setToDelete(null)}
        title={`Delete ${toDelete?.name ?? 'assessment'}?`}
        description="This assessment will be removed from the course. This cannot be undone."
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={async () => (await remove(toDelete.id)).ok}
      />
      <ConfirmDialog
        open={Boolean(toRelease)}
        onOpenChange={(v) => !v && setToRelease(null)}
        title={`Release ${toRelease?.name ?? ''} marks?`}
        description={`Students will be able to see their ${toRelease?.name ?? ''} marks and ${offering.enrolledCount} enrolled student(s) will be notified.`}
        confirmLabel="Release marks"
        onConfirm={async () => (await setReleased(toRelease.id, true)).ok}
      />
      <ConfirmDialog
        open={confirmTemplate}
        onOpenChange={setConfirmTemplate}
        title="Apply the standard template?"
        description="This creates five assessments: Assignment 1 (10%), Quiz 1 (10%), Midterm Exam (30%), Assignment 2 (10%) and Final Exam (40%), with due dates spread across the semester. You can edit them afterwards."
        confirmLabel="Create assessments"
        onConfirm={async () => (await applyTemplate()).ok}
      />
    </div>
  )
}

export function AssessmentsPage() {
  const { offeringId: paramId } = useParams()
  const navigate = useNavigate()
  const lookups = useLookups()
  const { data: offerings, loading, error, refetch } = useQuery(() => store.teacher.listMyOfferings({}), [])

  if (loading && !offerings) return <PageSkeleton />
  if (error) {
    return (
      <>
        <PageHeader title="Assessments" />
        <ErrorState error={error} onRetry={refetch} />
      </>
    )
  }

  const selectedId = defaultOfferingId(offerings, paramId, lookups?.currentSemester?.id)
  const offering = offerings.find((o) => o.id === selectedId)

  return (
    <>
      <PageHeader
        title="Assessments"
        description="Define how each course is assessed: assignments, quizzes and exams with their weights."
        actions={
          offerings.length > 0 && (
            <OfferingPicker offerings={offerings} value={selectedId} onChange={(id) => navigate(`/teacher/assessments/${id}`)} />
          )
        }
      />
      {offerings.length === 0 ? (
        <Card>
          <EmptyState icon={ClipboardList} title="No courses assigned" description="You need an assigned course before you can create assessments." />
        </Card>
      ) : !offering ? (
        <ErrorState error={{ status: 403, message: 'This course offering is not assigned to you.' }} />
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
            <Link to={`/teacher/courses/${offering.id}`} className="font-semibold hover:underline">
              {offering.course.code} — {offering.course.title}
            </Link>
            <span className="text-muted-foreground">
              {offering.semester.name} · Section {offering.section} · {offering.enrolledCount} students
            </span>
            <GradeStatusBadge status={offering.gradeStatus} />
            <Button variant="link" size="sm" className="h-auto px-0" asChild>
              <Link to={`/teacher/grade-entry/${offering.id}`}>Enter grades →</Link>
            </Button>
          </div>
          <OfferingAssessments key={offering.id} offering={offering} />
        </>
      )}
    </>
  )
}
