import { useState } from 'react'
import { FileSpreadsheet, MoreHorizontal, Pencil, Plus, Trash2, UserCheck, UserPlus } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { DataTable } from '@/components/common/DataTable'
import { EmptyState } from '@/components/common/EmptyState'
import { ErrorState } from '@/components/common/ErrorState'
import { FilterSelect } from '@/components/common/FilterSelect'
import { FormField } from '@/components/common/FormField'
import { TableSkeleton } from '@/components/common/Loading'
import { PageHeader } from '@/components/common/PageHeader'
import { GradeStatusBadge } from '@/components/common/StatusBadge'
import { useLookups } from '@/context/lookups-context'
import { useQuery, useMutation } from '@/hooks/useStore'
import { GRADE_STATUS_LABELS } from '@/lib/format'
import { store } from '@/store'
import { SelectField } from '../users/SelectField'

const GRADE_STATUS_OPTIONS = Object.entries(GRADE_STATUS_LABELS).map(([value, label]) => ({ value, label }))
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
  const semesterOptions = (lookups?.semesters ?? []).filter((s) => s.status !== 'closed').map((s) => ({ value: s.id, label: s.isCurrent ? `${s.name} (current)` : s.name }))
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
        <FormField label="Capacity" required error={fe.capacity}>
          <Input type="number" min={1} max={500} value={form.capacity} onChange={set('capacity')} />
        </FormField>
        <FormField label="Room" error={fe.room}>
          <Input value={form.room} onChange={set('room')} placeholder="e.g. CS-144" />
        </FormField>
        <FormField label="Schedule" error={fe.schedule}>
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

function TeacherWorkload() {
  const { data, loading, error, refetch } = useQuery(() => store.academics.listTeachers(), [])
  const rows = data ? [...data].sort((a, b) => b.offeringCount - a.offeringCount || a.name.localeCompare(b.name)) : []
  const max = Math.max(1, ...rows.map((t) => t.offeringCount))
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Teacher workload</CardTitle>
          <CardDescription className="mt-1">Offerings per teacher in the current semester.</CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        {loading && !data ? (
          <TableSkeleton rows={5} cols={1} />
        ) : error ? (
          <ErrorState error={error} onRetry={refetch} />
        ) : !rows.length ? (
          <EmptyState compact icon={UserCheck} title="No teachers yet" />
        ) : (
          <ul className="flex max-h-[32rem] flex-col gap-3 overflow-y-auto pr-1">
            {rows.map((t) => (
              <li key={t.id}>
                <div className="flex items-baseline justify-between gap-2 text-sm">
                  <span className="min-w-0 truncate">
                    {t.name}
                    <span className="ml-1 text-xs text-muted-foreground">{t.department?.code}</span>
                  </span>
                  <span className="tabular shrink-0 font-medium">{t.offeringCount}</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                  <div className="h-full rounded-full bg-chart-1" style={{ width: `${(t.offeringCount / max) * 100}%` }} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

export function AssignmentsPage() {
  const navigate = useNavigate()
  const lookups = useLookups()
  const [semesterChoice, setSemesterChoice] = useState(null)
  const [departmentId, setDepartmentId] = useState('')
  const [teacherId, setTeacherId] = useState('')
  const [gradeStatus, setGradeStatus] = useState('')
  const semesterId = semesterChoice ?? lookups?.currentSemester?.id ?? ''
  const { data, loading, error, refetch } = useQuery(
    () => store.academics.listOfferings({ semesterId, departmentId, teacherId, gradeStatus, pageSize: 100 }),
    [semesterId, departmentId, teacherId, gradeStatus],
    { enabled: Boolean(semesterId) },
  )
  const [dialog, setDialog] = useState({ open: false, offering: null })
  const [deleting, setDeleting] = useState(null)
  const [remove] = useMutation((id) => store.academics.deleteOffering(id), { success: 'Offering deleted.' })
  const semester = (lookups?.semesters ?? []).find((s) => s.id === semesterId)

  const columns = [
    {
      key: 'courseCode',
      header: 'Course',
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
    { key: 'enrolledCount', header: 'Enrolled', align: 'right', value: (o) => o.enrolledCount, cell: (o) => `${o.enrolledCount}/${o.capacity}` },
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
    { key: 'gradeStatus', header: 'Grades', value: (o) => GRADE_STATUS_LABELS[o.gradeStatus], cell: (o) => <GradeStatusBadge status={o.gradeStatus} /> },
    {
      key: 'actions',
      header: '',
      sortable: false,
      searchable: false,
      export: false,
      align: 'right',
      cell: (o) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${o.course.code} ${o.section}`}>
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => setDialog({ open: true, offering: o })}>
              <Pencil /> Edit / reassign teacher
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => navigate(`/admin/enrollment?offering=${o.id}`)}>
              <UserPlus /> Manage enrollment
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => navigate(`/admin/reports/grade-sheet/${o.id}`)}>
              <FileSpreadsheet /> Grade sheet
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={() => setDeleting(o)}>
              <Trash2 /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ]

  const filtered = departmentId || teacherId || gradeStatus

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
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_18rem]">
        <DataTable
          columns={columns}
          rows={semesterId ? data?.items : []}
          loading={loading}
          error={error}
          onRetry={refetch}
          searchPlaceholder="Search course or teacher…"
          toolbar={
            <>
              <FilterSelect
                value={semesterId}
                onChange={(v) => setSemesterChoice(v)}
                options={(lookups?.semesters ?? []).map((s) => ({ value: s.id, label: s.isCurrent ? `${s.name} (current)` : s.name }))}
                includeAll={false}
                placeholder="Semester"
                label="Semester"
                className="sm:w-52"
              />
              <FilterSelect
                value={departmentId}
                onChange={setDepartmentId}
                options={(lookups?.departments ?? []).map((d) => ({ value: d.id, label: d.name }))}
                allLabel="All departments"
                label="Filter by department"
              />
              <FilterSelect
                value={teacherId}
                onChange={setTeacherId}
                options={(lookups?.teachers ?? []).map((t) => ({ value: t.id, label: t.name })).sort((a, b) => a.label.localeCompare(b.label))}
                allLabel="All teachers"
                label="Filter by teacher"
              />
              <FilterSelect value={gradeStatus} onChange={setGradeStatus} options={GRADE_STATUS_OPTIONS} allLabel="All grade statuses" label="Filter by grade status" />
            </>
          }
          exportName={`offerings_${semester?.name ?? ''}`}
          exportTitle={`Course offerings — ${semester?.name ?? ''}`}
          university={lookups?.university}
          initialSort={{ key: 'courseCode', dir: 'asc' }}
          emptyIcon={UserCheck}
          emptyTitle={filtered ? 'No offerings match these filters' : 'No courses offered in this semester'}
          emptyDescription={filtered ? 'Try clearing the filters.' : 'Create an offering to assign a teacher to a course.'}
        />
        <TeacherWorkload />
      </div>

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
