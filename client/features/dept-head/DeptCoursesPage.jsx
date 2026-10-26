import { useState, useMemo, useEffect } from 'react'
import { BookOpen, Pencil, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { FilterSelect } from '@/components/common/FilterSelect'
import { FormField } from '@/components/common/FormField'
import { PageHeader } from '@/components/common/PageHeader'
import { StatusBadge } from '@/components/common/StatusBadge'
import { TanStackTable } from '@/components/common/TanStackTable'
import { useAuth } from '@/context/auth-context'
import { useLookups } from '@/context/lookups-context'
import { useQuery, useMutation } from '@/hooks/useStore'
import { store } from '@/store'
import { SelectField } from '../admin/users/SelectField'
import { DEPARTMENT_OPTIONS, getDepartmentName } from '../admin/users/UserFormDialog'

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'archived', label: 'Archived' },
]

function CourseForm({ course, dept, deptId, onClose, onCreated }) {
  const { user, profile } = useAuth()
  const lookups = useLookups()
  const isEdit = Boolean(course)

  const headDeptId =
    dept?.id ||
    deptId ||
    profile?.departmentId ||
    profile?.department_id ||
    profile?.department?.id ||
    user?.departmentId ||
    user?.department_id ||
    'dep_cs'

  const defaultDeptId =
    course?.departmentId ??
    course?.department_id ??
    lookups?.departments?.find((d) => d.id === course?.department || d.name === course?.department || d.name === course?.departmentName)?.id ??
    headDeptId

  const deptOptions = useMemo(() => {
    if (lookups?.departments?.length) {
      return lookups.departments
        .filter((d) => !d.status || d.status === 'active')
        .map((d) => ({ value: d.id, label: d.name }))
    }
    return DEPARTMENT_OPTIONS
  }, [lookups?.departments])

  const [form, setForm] = useState({
    code: course?.code ?? '',
    title: course?.title ?? '',
    departmentId: defaultDeptId,
    creditHours: String(course?.creditHours ?? course?.credit_hours ?? 3),
    status: course?.status ?? 'active',
  })

  const [save, { loading, fieldErrors }] = useMutation(
    (data) =>
      isEdit ? store.academics.updateCourse(course.id, data) : store.academics.createCourse(data),
    {
      success: isEdit ? 'Course updated.' : 'Course created.',
      onSuccess: (result, data) => {
        onCreated?.(data?.departmentId || form.departmentId || defaultDeptId)
        onClose()
      },
    },
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

        const resolvedDeptId = form.departmentId || defaultDeptId
        const selectedDept = (lookups?.departments ?? []).find((d) => d.id === resolvedDeptId)
        const deptName = selectedDept?.name || getDepartmentName(resolvedDeptId) || dept?.name || 'Department'

        const data = {
          code: form.code.trim().toUpperCase(),
          title: form.title.trim(),
          department: deptName,
          departmentId: resolvedDeptId,
          creditHours: form.creditHours,
          level: autoLevel,
          description: course?.description ?? '',
        }
        if (isEdit) data.status = form.status
        save(data)
      }}
    >
      <div className="grid gap-4 sm:grid-cols-[9rem_1fr]">
        <FormField label="Code" required error={fe.code} hint="Letters and numbers (e.g. CS101, BIO1, 101)">
          <Input
            value={form.code}
            onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
            maxLength={10}
            placeholder="e.g. CS101"
          />
        </FormField>
        <FormField label="Course Name" required error={fe.title || fe.courseName}>
          <Input value={form.title} onChange={set('title')} placeholder="e.g. Introduction to Programming" />
        </FormField>
      </div>

      <SelectField
        label="Department"
        required
        value={form.departmentId}
        onChange={(val) => setForm((f) => ({ ...f, departmentId: val }))}
        options={deptOptions}
        placeholder="Select department…"
        error={fe.department || fe.departmentId}
        hint="Department offering this course"
      />

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
  const { user, profile } = useAuth()
  const lookups = useLookups()

  const headDeptId =
    profile?.departmentId ??
    profile?.department_id ??
    profile?.department?.id ??
    user?.departmentId ??
    user?.department_id ??
    (lookups?.departments ?? []).find(
      (d) =>
        (d.headTeacherId && (d.headTeacherId === profile?.id || d.headTeacherId === user?.id)) ||
        (d.head_teacher_id && (d.head_teacher_id === profile?.id || d.head_teacher_id === user?.id))
    )?.id ??
    (lookups?.teachers ?? []).find(
      (t) => (t.userId && t.userId === user?.id) || (t.user_id && t.user_id === user?.id) || t.id === profile?.id
    )?.departmentId ??
    'dep_cs'

  const dept =
    (lookups?.departments ?? []).find(
      (d) =>
        (d.headTeacherId && (d.headTeacherId === profile?.id || d.headTeacherId === user?.id)) ||
        (d.head_teacher_id && (d.head_teacher_id === profile?.id || d.head_teacher_id === user?.id)) ||
        d.id === headDeptId,
    ) ||
    (headDeptId ? (lookups?.departments ?? []).find((d) => d.id === headDeptId) : null) ||
    lookups?.departments?.find((d) => d.id === 'dep_cs') ||
    lookups?.departments?.[0]
  const deptId = dept?.id || headDeptId

  const [selectedDeptId, setSelectedDeptId] = useState(headDeptId || deptId || 'dep_cs')

  useEffect(() => {
    if (headDeptId && (!selectedDeptId || selectedDeptId === 'all')) {
      setSelectedDeptId(headDeptId)
    }
  }, [headDeptId])

  const deptOptions = useMemo(() => {
    if (lookups?.departments?.length) {
      return lookups.departments
        .filter((d) => !d.status || d.status === 'active')
        .map((d) => ({ value: d.id, label: d.name }))
    }
    return DEPARTMENT_OPTIONS
  }, [lookups?.departments])

  const { data, loading, error, refetch } = useQuery(
    () =>
      store.academics.listCourses(
        selectedDeptId && selectedDeptId !== 'all'
          ? { departmentId: selectedDeptId, pageSize: 100 }
          : { departmentId: 'all', pageSize: 100 },
      ),
    [selectedDeptId],
  )

  const [dialog, setDialog] = useState({ open: false, course: null })
  const [deleting, setDeleting] = useState(null)
  const [remove] = useMutation((id) => store.academics.deleteCourse(id), { success: 'Course deleted.' })

  const coursesList = useMemo(() => {
    if (Array.isArray(data)) return data
    if (Array.isArray(data?.items)) return data.items
    return []
  }, [data])

  const currentDept =
    (lookups?.departments ?? []).find((d) => d.id === (selectedDeptId || deptId)) || dept

  const columns = useMemo(
    () => [
      {
        accessorKey: 'code',
        header: 'Course Code',
        cell: (info) => (
          <span className="font-medium text-foreground">
            {info.getValue() || info.row.original.code}
          </span>
        ),
      },
      {
        accessorKey: 'title',
        header: 'Course Name',
        cell: (info) => (
          <span className="font-semibold text-foreground">
            {info.getValue() || info.row.original.title}
          </span>
        ),
      },
      {
        id: 'department',
        header: 'Department',
        accessorFn: (row) => {
          const dId = row.departmentId || row.department_id || (selectedDeptId || deptId)
          const matchedDept = (lookups?.departments ?? []).find((d) => d.id === dId)
          return (
            row.departmentName ||
            row.department_name ||
            matchedDept?.name ||
            row.department?.name ||
            (typeof row.department === 'string' ? row.department : null) ||
            dept?.name ||
            '—'
          )
        },
        cell: (info) => <span className="text-muted-foreground">{info.getValue()}</span>,
      },
      {
        id: 'creditHours',
        header: 'Credits',
        accessorFn: (row) => row.creditHours ?? row.credit_hours ?? '',
        cell: (info) => info.getValue(),
        meta: { align: 'right' },
      },
      {
        id: 'status',
        header: 'Status',
        accessorFn: (row) => row.status ?? 'active',
        cell: (info) => <StatusBadge status={info.getValue() || 'active'} />,
      },
      {
        id: 'actions',
        header: 'Actions',
        enableSorting: false,
        meta: { align: 'right' },
        cell: ({ row }) => {
          const c = row.original
          return (
            <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Edit ${c.code}`}
                title="Edit course"
                onClick={() => setDialog({ open: true, course: c })}
              >
                <Pencil className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                aria-label={`Delete ${c.code}`}
                title="Delete course"
                onClick={() => setDeleting(c)}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          )
        },
      },
    ],
    [dept, deptId, selectedDeptId, lookups?.departments],
  )

  return (
    <>
      <PageHeader
        title={`${selectedDeptId && selectedDeptId !== 'all' ? (currentDept?.name ?? 'Department') : 'All Departments'} — Courses`}
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
        data={coursesList}
        loading={loading}
        error={error}
        onRetry={refetch}
        searchPlaceholder="Search course code, course name, or department…"
        initialSort={[{ id: 'code', desc: false }]}
        emptyIcon={BookOpen}
        emptyTitle="No courses found"
        emptyDescription="Add the first course to this department."
        toolbar={
          <FilterSelect
            value={selectedDeptId}
            onChange={(val) => setSelectedDeptId(val)}
            options={deptOptions}
            allLabel="All Departments"
            placeholder="Department"
            className="filter-select--dept"
          />
        }
      />

      <Dialog open={dialog.open} onOpenChange={(open) => setDialog((d) => ({ ...d, open }))}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{dialog.course ? `Edit ${dialog.course.code}` : 'Add course'}</DialogTitle>
            <DialogDescription>
              {dialog.course
                ? 'Credit hours cannot change after grades have been published for this course.'
                : 'Add a course to the department catalogue.'}
            </DialogDescription>
          </DialogHeader>
          <CourseForm
            key={dialog.course?.id ?? 'new'}
            course={dialog.course}
            dept={dept}
            deptId={deptId}
            onClose={() => setDialog((d) => ({ ...d, open: false }))}
            onCreated={(newDeptId) => {
              if (selectedDeptId && selectedDeptId !== 'all' && newDeptId && newDeptId !== selectedDeptId) {
                setSelectedDeptId(newDeptId)
              }
              refetch()
            }}
          />
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
