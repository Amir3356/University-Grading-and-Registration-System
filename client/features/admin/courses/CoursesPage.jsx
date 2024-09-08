import { useState } from 'react'
import { Archive, ArchiveRestore, BookOpen, MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { DataTable } from '@/components/common/DataTable'
import { FormField } from '@/components/common/FormField'
import { PageHeader } from '@/components/common/PageHeader'
import { StatusBadge } from '@/components/common/StatusBadge'
import { useLookups } from '@/context/lookups-context'
import { useQuery, useMutation } from '@/hooks/useStore'
import { store } from '@/store'
import { SelectField } from '../users/SelectField'

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'archived', label: 'Archived' },
]

function CourseForm({ course, onClose }) {
  const lookups = useLookups()
  const isEdit = Boolean(course)
  const initialDept =
    course?.departmentName ||
    lookups?.departments?.find((d) => d.id === course?.departmentId)?.name ||
    course?.departmentId ||
    ''

  const [form, setForm] = useState({
    code: course?.code ?? '',
    title: course?.title ?? '',
    department: initialDept,
    creditHours: String(course?.creditHours ?? 3),
    status: course?.status ?? 'active',
  })
  const [save, { loading, fieldErrors }] = useMutation(
    (data) => (isEdit ? store.academics.updateCourse(course.id, data) : store.academics.createCourse(data)),
    { success: isEdit ? 'Course updated.' : 'Course created.', onSuccess: onClose },
  )
  const fe = fieldErrors ?? {}
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e?.target ? e.target.value : e }))

  return (
    <form
      className="grid gap-4"
      noValidate
      onSubmit={(e) => {
        e.preventDefault()
        const codeNum = parseInt(form.code.replace(/\D/g, ''), 10)
        const autoLevel = Number.isFinite(codeNum) && codeNum >= 100 && codeNum <= 999
          ? Math.floor(codeNum / 100) * 100
          : (course?.level ?? 100)

        const data = {
          code: form.code,
          title: form.title,
          department: form.department,
          creditHours: form.creditHours,
          level: autoLevel,
          description: course?.description ?? '',
        }
        if (isEdit) data.status = form.status
        save(data)
      }}
    >
      <div className="grid gap-4 sm:grid-cols-[9rem_1fr]">
        <FormField label="Code" required error={fe.code} hint="e.g. CS101">
          <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} maxLength={10} />
        </FormField>
        <FormField label="Title" required error={fe.title}>
          <Input value={form.title} onChange={set('title')} />
        </FormField>
      </div>

      <FormField label="Department" required error={fe.departmentId || fe.department}>
        <Input
          value={form.department}
          onChange={set('department')}
          placeholder="e.g. Computer Science"
          list="course-department-list"
        />
        <datalist id="course-department-list">
          {(lookups?.departments ?? []).map((d) => (
            <option key={d.id} value={d.name} />
          ))}
        </datalist>
      </FormField>

      <div className={isEdit ? 'grid gap-4 sm:grid-cols-2' : undefined}>
        <FormField label="Credit hours" required error={fe.creditHours} hint="Between 1 and 6">
          <Input type="number" min={1} max={6} step={1} value={form.creditHours} onChange={set('creditHours')} />
        </FormField>
        {isEdit && (
          <SelectField
            label="Status"
            value={form.status}
            onChange={set('status')}
            options={STATUS_OPTIONS}
            error={fe.status}
            hint="Archived courses cannot be offered in new semesters."
          />
        )}
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button type="submit" loading={loading}>
          {isEdit ? 'Save changes' : 'Create course'}
        </Button>
      </DialogFooter>
    </form>
  )
}

export function CoursesPage() {
  const { data, loading, error, refetch } = useQuery(
    () => store.academics.listCourses({ pageSize: 100 }),
    [],
  )
  const [dialog, setDialog] = useState({ open: false, course: null })
  const [deleting, setDeleting] = useState(null)
  const [remove] = useMutation((id) => store.academics.deleteCourse(id), { success: 'Course deleted.' })
  const [setCourseStatus] = useMutation((c, next) => store.academics.updateCourse(c.id, { ...c, status: next }), {
    success: (_r, c, next) => (next === 'archived' ? `${c.code} archived.` : `${c.code} restored.`),
  })

  const columns = [
    { key: 'code', header: 'Code', cell: (c) => <span className="font-medium">{c.code}</span> },
    { key: 'title', header: 'Title', cell: (c) => <span className="block max-w-xs truncate whitespace-normal">{c.title}</span> },
    { key: 'departmentName', header: 'Department' },
    { key: 'creditHours', header: 'Credits', align: 'right' },
    { key: 'level', header: 'Level', align: 'right' },
    { key: 'offeringCount', header: 'Offerings', align: 'right' },
    { key: 'status', header: 'Status', cell: (c) => <StatusBadge status={c.status} label={c.status === 'archived' ? 'Archived' : undefined} /> },
    {
      key: 'actions',
      header: '',
      sortable: false,
      searchable: false,
      export: false,
      align: 'right',
      cell: (c) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${c.code}`}>
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => setDialog({ open: true, course: c })}>
              <Pencil /> Edit
            </DropdownMenuItem>
            {c.status === 'active' ? (
              <DropdownMenuItem onSelect={() => setCourseStatus(c, 'archived')}>
                <Archive /> Archive
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onSelect={() => setCourseStatus(c, 'active')}>
                <ArchiveRestore /> Restore
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={() => setDeleting(c)}>
              <Trash2 /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        title="Courses"
        description="The course catalogue. Courses are offered each semester through teacher assignments."
        actions={
          <Button onClick={() => setDialog({ open: true, course: null })}>
            <Plus /> Add course
          </Button>
        }
      />
      <DataTable
        columns={columns}
        rows={data?.items}
        loading={loading}
        error={error}
        onRetry={refetch}
        searchable={false}
        initialSort={{ key: 'code', dir: 'asc' }}
        emptyIcon={BookOpen}
        emptyTitle="No courses yet"
        emptyDescription="Add the first course to the catalogue."
      />

      <Dialog open={dialog.open} onOpenChange={(open) => setDialog((d) => ({ ...d, open }))}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{dialog.course ? `Edit ${dialog.course.code}` : 'Add course'}</DialogTitle>
            <DialogDescription>
              {dialog.course ? 'Credit hours cannot change after grades have been published for this course.' : 'Add a course to the catalogue.'}
            </DialogDescription>
          </DialogHeader>
          <CourseForm key={dialog.course?.id ?? 'new'} course={dialog.course} onClose={() => setDialog((d) => ({ ...d, open: false }))} />
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(v) => !v && setDeleting(null)}
        title={`Delete ${deleting?.code ?? 'course'}?`}
        description="Only courses that have never been offered can be deleted. Archive the course instead to keep its history."
        confirmLabel="Delete course"
        variant="destructive"
        onConfirm={async () => {
          const res = await remove(deleting.id)
          return res.ok ? undefined : false
        }}
      />
    </>
  )
}
