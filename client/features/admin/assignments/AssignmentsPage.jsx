import { useState } from 'react'
import { Plus, UserCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { DataTable } from '@/components/common/DataTable'
import { FormField } from '@/components/common/FormField'
import { PageHeader } from '@/components/common/PageHeader'
import { useLookups } from '@/context/lookups-context'
import { useQuery, useMutation } from '@/hooks/useStore'
import { formatSemesterTerm } from '@/lib/format'
import { store } from '@/store'
import { SelectField } from '../users/SelectField'

const LOCKED = ['submitted', 'approved', 'published']

const teacherLabel = (t) => `${t.name} — ${t.department?.code ?? '—'}`

function OfferingForm({ offering, defaultSemesterId, onClose }) {
  const lookups = useLookups()
  const isEdit = Boolean(offering)
  const [form, setForm] = useState({
    courseId: offering?.courseId ?? '',
    semesterId: offering?.semesterId ?? defaultSemesterId ?? '',
    teacherId: offering?.teacherId ?? '',
    section: offering?.section ?? 'A',
    capacity: String(offering?.capacity ?? 40),
    room: offering?.room ?? '',
    schedule: offering?.schedule ?? '',
  })
  const [save, { loading, fieldErrors }] = useMutation(
    (data) =>
      isEdit
        ? store.academics.updateOffering(offering.id, { teacherId: data.teacherId, section: data.section, capacity: data.capacity, room: data.room, schedule: data.schedule })
        : store.academics.createOffering(data),
    { success: isEdit ? 'Offering updated.' : 'Course offering created and teacher notified.', onSuccess: onClose },
  )
  const fe = fieldErrors ?? {}
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e?.target ? e.target.value : e }))

  const course = (lookups?.courses ?? []).find((c) => c.id === form.courseId)
  const courseOptions = (lookups?.courses ?? [])
    .filter((c) => c.status === 'active')
    .sort((a, b) => a.code.localeCompare(b.code))
    .map((c) => ({ value: c.id, label: `${c.code} — ${c.title}` }))
  const semesterOptions = (lookups?.semesters ?? [])
    .filter((s) => s.status !== 'closed')
    .map((s) => {
      const label = formatSemesterTerm(s.term)
      return { value: s.id, label: s.isCurrent ? `${label} (current)` : label }
    })
  // Teachers from the course's department first.
  const teachers = [...(lookups?.teachers ?? [])].sort(
    (a, b) => Number(b.departmentId === course?.departmentId) - Number(a.departmentId === course?.departmentId) || a.name.localeCompare(b.name),
  )
  const teacherOptions = teachers.map((t) => ({ value: t.id, label: teacherLabel(t) }))
  if (isEdit && offering.teacher && !teacherOptions.some((t) => t.value === offering.teacherId)) {
    teacherOptions.push({ value: offering.teacherId, label: `${teacherLabel(offering.teacher)} (inactive)`, disabled: true })
  }
  const teacherLocked = isEdit && LOCKED.includes(offering.gradeStatus)

  return (
    <form
      className="grid gap-4"
      noValidate
      onSubmit={(e) => {
        e.preventDefault()
        save(form)
      }}
    >
      {isEdit ? (
        <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
          <p className="font-medium">
            {offering.course.code} — {offering.course.title}
          </p>
          <p className="text-muted-foreground">{offering.semester.name}</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField label="Course" required value={form.courseId} onChange={set('courseId')} options={courseOptions} error={fe.courseId} placeholder="Choose a course" className="sm:col-span-2" />
          <SelectField label="Semester" required value={form.semesterId} onChange={set('semesterId')} options={semesterOptions} error={fe.semesterId} placeholder="Choose a semester" className="sm:col-span-2" />
        </div>
      )}
      <SelectField
        label="Teacher"
        required
        value={form.teacherId}
        onChange={set('teacherId')}
        options={teacherOptions}
        error={fe.teacherId}
        placeholder="Choose a teacher"
        disabled={teacherLocked}
        hint={teacherLocked ? 'The teacher cannot be changed after grades have been submitted.' : course ? `Teachers from ${course.department?.name ?? 'the course department'} are listed first.` : undefined}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Section" required error={fe.section}>
          <Input value={form.section} onChange={(e) => setForm({ ...form, section: e.target.value.toUpperCase() })} maxLength={4} />
        </FormField>
        <FormField label="Room" error={fe.room}>
          <Input value={form.room} onChange={set('room')} placeholder="e.g. CS-144" />
        </FormField>
        <FormField label="Schedule" error={fe.schedule} className="sm:col-span-2">
          <Input value={form.schedule} onChange={set('schedule')} placeholder="e.g. Tue/Thu 10:30–12:00" />
        </FormField>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button type="submit" loading={loading}>
          {isEdit ? 'Save changes' : 'Create offering'}
        </Button>
      </DialogFooter>
    </form>
  )
}

export function AssignmentsPage() {
  const lookups = useLookups()
  const semesterId = lookups?.currentSemester?.id ?? ''
  const { data, loading, error, refetch } = useQuery(
    () => store.academics.listOfferings({ semesterId, pageSize: 100 }),
    [semesterId],
    { enabled: Boolean(semesterId) },
  )
  const [dialog, setDialog] = useState({ open: false, offering: null })
  const [deleting, setDeleting] = useState(null)
  const [remove] = useMutation((id) => store.academics.deleteOffering(id), { success: 'Offering deleted.' })
  const semester = (lookups?.semesters ?? []).find((s) => s.id === semesterId)

  const columns = [
    {
      key: 'courseCode',
      header: 'Course Code',
      cell: (o) => (
        <div className="max-w-xs">
          <p className="font-medium">{o.course.code}</p>
          <p className="truncate text-xs text-muted-foreground">{o.course.title}</p>
        </div>
      ),
    },
    { key: 'section', header: 'Section' },
    {
      key: 'teacherName',
      header: 'Teacher',
      value: (o) => o.teacher?.name ?? '',
      cell: (o) => (
        <div>
          <p>{o.teacher?.name ?? 'Unassigned'}</p>
          <p className="text-xs text-muted-foreground">{o.teacher?.department?.code}</p>
        </div>
      ),
    },
    {
      key: 'room',
      header: 'Room / schedule',
      value: (o) => [o.room, o.schedule].filter(Boolean).join(' · '),
      cell: (o) => (
        <div>
          <p>{o.room || '—'}</p>
          <p className="text-xs text-muted-foreground">{o.schedule}</p>
        </div>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        title="Teacher Assignments"
        description="Offer courses each semester and assign the teachers responsible for them."
        actions={
          <Button onClick={() => setDialog({ open: true, offering: null })}>
            <Plus /> New offering
          </Button>
        }
      />
      <DataTable
        columns={columns}
        rows={semesterId ? data?.items : []}
        loading={loading}
        error={error}
        onRetry={refetch}
        searchable={false}
        sortable={false}
        emptyIcon={UserCheck}
        emptyTitle="No courses offered in this semester"
        emptyDescription="Create an offering to assign a teacher to a course."
      />

      <Dialog open={dialog.open} onOpenChange={(open) => setDialog((d) => ({ ...d, open }))}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{dialog.offering ? `Edit ${dialog.offering.course.code} · Section ${dialog.offering.section}` : 'New course offering'}</DialogTitle>
            <DialogDescription>{dialog.offering ? 'Reassign the teacher or update section details. Affected teachers are notified.' : 'The assigned teacher is notified of the new course.'}</DialogDescription>
          </DialogHeader>
          <OfferingForm key={dialog.offering?.id ?? 'new'} offering={dialog.offering} defaultSemesterId={semester?.status !== 'closed' ? semesterId : lookups?.currentSemester?.id} onClose={() => setDialog((d) => ({ ...d, open: false }))} />
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(v) => !v && setDeleting(null)}
        title={`Delete ${deleting ? `${deleting.course.code} · Section ${deleting.section}` : 'offering'}?`}
        description="Offerings with enrolled students cannot be deleted. Its assessments are removed as well. This cannot be undone."
        confirmLabel="Delete offering"
        variant="destructive"
        onConfirm={async () => {
          const res = await remove(deleting.id)
          return res.ok ? undefined : false
        }}
      />
    </>
  )
}
