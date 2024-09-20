import { useState } from 'react'
import { Pencil, Plus, Trash2, UserCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { DataTable } from '@/components/common/DataTable'
import { FormField } from '@/components/common/FormField'
import { PageHeader } from '@/components/common/PageHeader'
import { useAuth } from '@/context/auth-context'
import { useLookups } from '@/context/lookups-context'
import { useQuery, useMutation } from '@/hooks/useStore'
import { formatSemesterTerm } from '@/lib/format'
import { store } from '@/store'
import { SelectField } from '../users/SelectField'

const LOCKED = ['submitted', 'approved', 'published']

const teacherLabel = (t) => `${t.name} — ${t.department?.code ?? '—'}`

function OfferingForm({ offering, defaultSemesterId, onClose }) {
  const lookups = useLookups()
  const { profile } = useAuth()
  const isEdit = Boolean(offering)

  const initialDeptId =
    offering?.course?.departmentId ??
    profile?.departmentId ??
    (lookups?.departments ?? []).find((d) => d.headTeacherId === profile?.id)?.id ??
    ''

  const [form, setForm] = useState({
    departmentId: initialDeptId,
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
        ? store.academics.updateOffering(offering.id, {
            teacherId: data.teacherId,
            section: data.section,
            capacity: data.capacity,
            room: data.room,
            schedule: data.schedule,
          })
        : store.academics.createOffering(data),
    { success: isEdit ? 'Offering updated.' : 'Course offering created and teacher notified.', onSuccess: onClose },
  )
  const fe = fieldErrors ?? {}
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e?.target ? e.target.value : e }))

  const departmentOptions = (lookups?.departments ?? []).map((d) => ({
    value: d.id,
    label: d.name,
  }))

  const handleDepartmentChange = (deptId) => {
    setForm((f) => {
      const courseStillValid = (lookups?.courses ?? []).some(
        (c) => c.id === f.courseId && (!deptId || c.departmentId === deptId),
      )
      return {
        ...f,
        departmentId: deptId,
        courseId: courseStillValid ? f.courseId : '',
      }
    })
  }

  const handleCourseChange = (courseId) => {
    const selectedCourse = (lookups?.courses ?? []).find((c) => c.id === courseId)
    setForm((f) => ({
      ...f,
      courseId,
      departmentId: selectedCourse?.departmentId || f.departmentId,
    }))
  }

  const course = (lookups?.courses ?? []).find((c) => c.id === form.courseId)
  const courseOptions = (lookups?.courses ?? [])
    .filter((c) => c.status === 'active')
    .filter((c) => !form.departmentId || c.departmentId === form.departmentId)
    .sort((a, b) => a.title.localeCompare(b.title))
    .map((c) => ({ value: c.id, label: `${c.title} (${c.code})` }))

  const semesterOptions = (lookups?.semesters ?? [])
    .filter((s) => s.status !== 'closed')
    .map((s) => {
      const label = formatSemesterTerm(s.term)
      return { value: s.id, label: s.isCurrent ? `${label} (current)` : label }
    })
  // Teachers from the course's or selected department first.
  const targetDeptId = course?.departmentId || form.departmentId
  const teachers = [...(lookups?.teachers ?? [])].sort(
    (a, b) =>
      Number(b.departmentId === targetDeptId) - Number(a.departmentId === targetDeptId) ||
      a.name.localeCompare(b.name),
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
        save({
          courseId: form.courseId,
          semesterId: form.semesterId,
          teacherId: form.teacherId,
          section: form.section,
          capacity: form.capacity,
          room: form.room,
          schedule: form.schedule,
        })
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
          <SelectField
            label="Department"
            value={form.departmentId}
            onChange={handleDepartmentChange}
            options={departmentOptions}
            placeholder="Choose a department"
            className="sm:col-span-2"
          />
          <SelectField
            label="coursename"
            required
            value={form.courseId}
            onChange={handleCourseChange}
            options={courseOptions}
            error={fe.courseId}
            placeholder="Choose a coursename"
            className="sm:col-span-2"
          />
          <SelectField
            label="Semester"
            required
            value={form.semesterId}
            onChange={set('semesterId')}
            options={semesterOptions}
            error={fe.semesterId}
            placeholder="Choose a semester"
            className="sm:col-span-2"
          />
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
      value: (o) => o.course?.code ?? '',
      cell: (o) => <span className="font-medium text-foreground">{o.course?.code}</span>,
    },
    {
      key: 'courseName',
      header: 'course name',
      value: (o) => o.course?.title ?? '',
      cell: (o) => <span className="font-semibold text-foreground">{o.course?.title ?? '—'}</span>,
    },
    {
      key: 'department',
      header: 'Department',
      value: (o) =>
        o.course?.department?.name ??
        (lookups?.departments ?? []).find((d) => d.id === o.course?.departmentId)?.name ??
        o.teacher?.department?.name ??
        '—',
      cell: (o) => (
        <span className="text-muted-foreground">
          {o.course?.department?.name ??
            (lookups?.departments ?? []).find((d) => d.id === o.course?.departmentId)?.name ??
            o.teacher?.department?.name ??
            '—'}
        </span>
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
    {
      key: 'actions',
      header: 'Actions',
      sortable: false,
      searchable: false,
      export: false,
      align: 'right',
      cell: (o) => (
        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Edit ${o.course?.code ?? 'offering'}`}
            title="Edit offering"
            onClick={() => setDialog({ open: true, offering: o })}
          >
            <Pencil className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-destructive hover:text-destructive hover:bg-destructive/10"
            aria-label={`Delete ${o.course?.code ?? 'offering'}`}
            title="Delete offering"
            onClick={() => setDeleting(o)}
          >
            <Trash2 className="size-4" />
          </Button>
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
