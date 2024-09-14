import { useState, useMemo } from 'react'
import { BookOpen, MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { FormField } from '@/components/common/FormField'
import { PageHeader } from '@/components/common/PageHeader'
import { StatusBadge } from '@/components/common/StatusBadge'
import { TanStackTable } from '@/components/common/TanStackTable'
import { useAuth } from '@/context/auth-context'
import { useLookups } from '@/context/lookups-context'
import { useQuery, useMutation } from '@/hooks/useStore'
import { store } from '@/store'
import { SelectField } from '../admin/users/SelectField'

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'archived', label: 'Archived' },
]

function CourseForm({ course, deptId, onClose }) {
  const isEdit = Boolean(course)

  const [form, setForm] = useState({
    code: course?.code ?? '',
    title: course?.title ?? '',
    creditHours: String(course?.creditHours ?? 3),
    status: course?.status ?? 'active',
  })
  const [save, { loading, fieldErrors }] = useMutation(
    (data) =>
      isEdit ? store.academics.updateCourse(course.id, data) : store.academics.createCourse({ ...data, departmentId: deptId }),
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
        const autoLevel = Number.isFinite(codeNum) && codeNum >= 100 && codeNum <= 999 ? Math.floor(codeNum / 100) * 100 : (course?.level ?? 100)

        const data = {
          code: form.code,
          title: form.title,
          creditHours: form.creditHours,
          level: autoLevel,
          description: course?.description ?? '',
          departmentId: deptId,
        }
        if (isEdit) data.status = form.status
        save(data)
      }}
    >
      <div className="grid gap-4 sm:grid-cols-[9rem_1fr]">
        <FormField label="Code" required error={fe.code} hint="e.g. CS101">
          <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} maxLength={10} />
        </FormField>
        <FormField label="Course Name" required error={fe.title || fe.courseName}>
          <Input value={form.title} onChange={set('title')} placeholder="e.g. Introduction to Programming" />
        </FormField>
      </div>

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

export function DeptCoursesPage() {
  const { profile } = useAuth()
  const lookups = useLookups()
  const dept =
    (lookups?.departments ?? []).find((d) => d.headTeacherId === profile?.id || d.id === profile?.departmentId) ||
    lookups?.departments?.[0]
  const deptId = dept?.id

  const { data, loading, error, refetch } = useQuery(
    () => store.academics.listCourses({ departmentId: deptId, pageSize: 100 }),
    [deptId],
    { enabled: Boolean(deptId) },
  )
  const [dialog, setDialog] = useState({ open: false, course: null })
  const [deleting, setDeleting] = useState(null)
  const [remove] = useMutation((id) => store.academics.deleteCourse(id), { success: 'Course deleted.' })

  const columns = useMemo(
    () => [
      {
        accessorKey: 'code',
        header: 'Course Code',
        cell: (info) => <span className="font-medium text-foreground">{info.getValue()}</span>,
      },
      {
        accessorKey: 'title',
        header: 'Course Title',
        cell: (info) => <span className="font-semibold text-foreground">{info.getValue()}</span>,
      },
      {
        accessorKey: 'creditHours',
        header: 'Credits',
        cell: (info) => info.getValue(),
        meta: { align: 'right' },
      },
      {
        accessorKey: 'level',
        header: 'Level',
        cell: (info) => info.getValue(),
        meta: { align: 'right' },
      },
      {
        accessorKey: 'offeringCount',
        header: 'Offerings',
        cell: (info) => info.getValue() ?? 0,
        meta: { align: 'right' },
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: (info) => <StatusBadge status={info.getValue()} />,
      },
      {
        id: 'actions',
        header: '',
        enableSorting: false,
        meta: { align: 'right' },
        cell: ({ row }) => {
          const c = row.original
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${c.code}`}>
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => setDialog({ open: true, course: c })}>
                  <Pencil className="size-4 mr-2" /> Edit
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onSelect={() => setDeleting(c)}>
                  <Trash2 className="size-4 mr-2" /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )
        },
      },
    ],
    [],
  )

  return (
    <>
      <PageHeader
        title={`${dept?.name ?? 'Department'} — Courses`}
        description="Courses offered and curriculum catalogue for this department."
        centered
        actions={
          <Button onClick={() => setDialog({ open: true, course: null })}>
            <Plus /> Add course
          </Button>
        }
      />
      <TanStackTable
        columns={columns}
        data={data?.items}
        loading={loading}
        error={error}
        onRetry={refetch}
        searchPlaceholder="Search course code or title…"
        initialSort={[{ id: 'code', desc: false }]}
        emptyIcon={BookOpen}
        emptyTitle="No courses found"
        emptyDescription="Add the first course to this department."
      />

      <Dialog open={dialog.open} onOpenChange={(open) => setDialog((d) => ({ ...d, open }))}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{dialog.course ? `Edit ${dialog.course.code}` : 'Add course'}</DialogTitle>
            <DialogDescription>
              {dialog.course ? 'Credit hours cannot change after grades have been published for this course.' : 'Add a course to the department catalogue.'}
            </DialogDescription>
          </DialogHeader>
          <CourseForm key={dialog.course?.id ?? 'new'} course={dialog.course} deptId={deptId} onClose={() => setDialog((d) => ({ ...d, open: false }))} />
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
