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
import { onUserChange } from '@/lib/syncEvents'
import { useWebSocketEvent } from '@/lib/websocket'
import { SelectField } from '../admin/users/SelectField'
import { getDepartmentName, DEPARTMENT_OPTIONS } from '../admin/users/UserFormDialog'

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'archived', label: 'Archived' },
]

function CourseForm({ course, dept, deptId, deptName, onClose, onCreated }) {
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

  const resolvedDeptId = form.departmentId || defaultDeptId
  const selectedDept = (lookups?.departments ?? []).find((d) => d.id === resolvedDeptId)
  const resolvedDeptName = selectedDept?.name || getDepartmentName(resolvedDeptId) || deptName || dept?.name || 'Department'

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
          code: form.code.trim().toUpperCase(),
          title: form.title.trim(),
          department: resolvedDeptName,
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

      <FormField label="Department" required hint="Assigned department from Account Provision">
        <Input
          value={resolvedDeptName}
          disabled
          readOnly
          className="bg-muted text-muted-foreground cursor-not-allowed"
        />
      </FormField>

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

  // Resolve department head's department
  // The cached login profile can be missing or stale, so fall back to the head's own record from the API.
  const { data: self, refetch: refetchSelf } = useQuery(
    () => store.users.getUser(user?.id),
    [user?.id],
    {
      enabled: Boolean(user?.id),
      live: false,
    },
  )

  const headDeptId =
    self?.departmentId ??
    self?.department_id ??
    self?.profile?.departmentId ??
    self?.profile?.department_id ??
    profile?.departmentId ??
    profile?.department_id ??
    profile?.department?.id ??
    user?.departmentId ??
    user?.department_id ??
    (lookups?.departments ?? []).find(
      (d) =>
        (d.headTeacherId && (d.headTeacherId === profile?.id || d.headTeacherId === user?.id || d.headTeacherId === self?.id)) ||
        (d.head_teacher_id && (d.head_teacher_id === profile?.id || d.head_teacher_id === user?.id || d.head_teacher_id === self?.id))
    )?.id ??
    (lookups?.teachers ?? []).find(
      (t) => (t.userId && t.userId === user?.id) || (t.user_id && t.user_id === user?.id) || t.id === profile?.id
    )?.departmentId ??
    'dep_cs'

  const dept =
    (lookups?.departments ?? []).find(
      (d) =>
        d.id === headDeptId ||
        (d.headTeacherId && (d.headTeacherId === profile?.id || d.headTeacherId === user?.id || d.headTeacherId === self?.id)) ||
        (d.head_teacher_id && (d.head_teacher_id === profile?.id || d.head_teacher_id === user?.id || d.head_teacher_id === self?.id)),
    ) ||
    (headDeptId ? (lookups?.departments ?? []).find((d) => d.id === headDeptId) : null) ||
    (self?.departmentName ? { id: headDeptId, name: self.departmentName } : null) ||
    lookups?.departments?.find((d) => d.id === 'dep_cs') ||
    lookups?.departments?.[0]
  const deptId = dept?.id || headDeptId
  const deptName =
    self?.departmentName ||
    self?.department_name ||
    dept?.name ||
    getDepartmentName(deptId) ||
    'Department'

  const { data, loading, error, refetch } = useQuery(
    () =>
      store.academics.listCourses(
        deptId ? { departmentId: deptId, pageSize: 100 } : { pageSize: 100 },
      ),
    [deptId],
  )

  useEffect(() => {
    return onUserChange(() => {
      refetchSelf()
      refetch()
    })
  }, [refetchSelf, refetch])

  useWebSocketEvent('USER_UPDATED', () => {
    refetchSelf()
    refetch()
  })
  useWebSocketEvent('TEACHER_UPDATED', () => {
    refetchSelf()
    refetch()
  })

  const [dialog, setDialog] = useState({ open: false, course: null })
  const [deleting, setDeleting] = useState(null)
  const [remove] = useMutation((id) => store.academics.deleteCourse(id), { success: 'Course deleted.' })

  const [departmentFilter, setDepartmentFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const coursesList = useMemo(() => {
    if (Array.isArray(data)) return data
    if (Array.isArray(data?.items)) return data.items
    return []
  }, [data])

  const filteredCourses = useMemo(() => {
    return coursesList.filter((c) => {
      const cDeptId = c.departmentId || c.department_id || deptId
      const cDeptName = c.departmentName || c.department_name || c.department || deptName
      const cStatus = c.status || 'active'

      if (statusFilter && cStatus !== statusFilter) return false
      if (departmentFilter) {
        const matchesId = cDeptId === departmentFilter
        const matchesName = cDeptName?.toLowerCase() === departmentFilter.toLowerCase()
        const targetDeptName = getDepartmentName(departmentFilter)?.toLowerCase()
        const matchesResolvedName = targetDeptName && cDeptName?.toLowerCase() === targetDeptName
        if (!matchesId && !matchesName && !matchesResolvedName) return false
      }
      return true
    })
  }, [coursesList, departmentFilter, statusFilter, deptId, deptName])

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
        accessorKey: 'departmentName',
        header: 'Department',
        accessorFn: (row) =>
          row.departmentName ||
          row.department_name ||
          row.department ||
          (row.departmentId ? getDepartmentName(row.departmentId) : '') ||
          deptName ||
          '—',
        cell: (info) => (
          <span className="text-foreground">
            {info.getValue() || deptName || '—'}
          </span>
        ),
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
    [deptName, deptId],
  )

  const toolbar = (
    <div className="flex items-center gap-2">
      <FilterSelect
        value={departmentFilter}
        onChange={setDepartmentFilter}
        options={DEPARTMENT_OPTIONS}
        allLabel="All departments"
        label="Department"
        className="filter-select--dept"
      />
      <FilterSelect
        value={statusFilter}
        onChange={setStatusFilter}
        options={STATUS_OPTIONS}
        allLabel="All statuses"
        label="Status"
        className="filter-select--status"
      />
      {(departmentFilter || statusFilter) && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setDepartmentFilter('')
            setStatusFilter('')
          }}
          className="text-xs text-muted-foreground hover:text-foreground h-9"
        >
          Reset filters
        </Button>
      )}
    </div>
  )

  return (
    <>
      <PageHeader
        title={`${deptName} — Courses`}
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
        data={filteredCourses}
        loading={loading}
        error={error}
        onRetry={refetch}
        toolbar={toolbar}
        searchPlaceholder="Search course code, name, or department…"
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
            deptName={deptName}
            onClose={() => setDialog((d) => ({ ...d, open: false }))}
            onCreated={() => {
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
