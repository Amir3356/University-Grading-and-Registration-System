import { useState } from 'react'
import { Building2, MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { DataTable } from '@/components/common/DataTable'
import { FormField } from '@/components/common/FormField'
import { PageHeader } from '@/components/common/PageHeader'
import { useLookups } from '@/context/lookups-context'
import { useQuery, useMutation } from '@/hooks/useStore'
import { store } from '@/store'
import { SelectField } from '../users/SelectField'

const NONE = '__none__'

function DepartmentForm({ department, onClose }) {
  const lookups = useLookups()
  const isEdit = Boolean(department)

  const currentCourse = isEdit ? (lookups?.courses ?? []).find((c) => c.departmentId === department.id) : null
  const currentTeacher = isEdit ? (lookups?.teachers ?? []).find((t) => t.departmentId === department.id && t.id !== department.headTeacherId) : null
  const currentStudent = isEdit ? (lookups?.students ?? []).find((s) => s.departmentId === department.id) : null

  const [form, setForm] = useState({
    name: department?.name ?? '',
    headOfDepartment: department?.head?.name || department?.headName || '',
    courseId: currentCourse?.id ?? NONE,
    teacherId: currentTeacher?.id ?? NONE,
    studentId: currentStudent?.id ?? NONE,
  })

  const [save, { loading, fieldErrors }] = useMutation(
    (data) => (isEdit ? store.academics.updateDepartment(department.id, data) : store.academics.createDepartment(data)),
    { success: isEdit ? 'Department updated.' : 'Department created.', onSuccess: onClose },
  )
  const fe = fieldErrors ?? {}

  const allTeachers = lookups?.teachers ?? []
  const allCourses = lookups?.courses ?? []
  const allStudents = lookups?.students ?? []

  const courseOptions = [
    { value: NONE, label: 'No course assigned' },
    ...allCourses.map((c) => ({ value: c.id, label: `${c.code} — ${c.title}` })),
  ]

  const teacherOptions = [
    { value: NONE, label: 'No teacher assigned' },
    ...allTeachers.map((t) => ({ value: t.id, label: t.name })),
  ]

  const studentOptions = [
    { value: NONE, label: 'No student assigned' },
    ...allStudents.map((s) => ({
      value: s.id,
      label: s.name ? `${s.name}${s.studentNumber ? ` (${s.studentNumber})` : ''}` : (s.studentNumber || s.id),
    })),
  ]

  return (
    <form
      className="grid gap-4"
      noValidate
      onSubmit={(e) => {
        e.preventDefault()
        save({
          name: form.name,
          headOfDepartment: form.headOfDepartment,
          headName: form.headOfDepartment,
          courseId: form.courseId === NONE ? null : form.courseId,
          teacherId: form.teacherId === NONE ? null : form.teacherId,
          studentId: form.studentId === NONE ? null : form.studentId,
        })
      }}
    >
      <FormField label="Department Name" required error={fe.name}>
        <Input
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="e.g. Computer Science"
          autoFocus
        />
      </FormField>

      <FormField label="Head of Department" error={fe.headOfDepartment || fe.headTeacherId}>
        <Input
          value={form.headOfDepartment}
          onChange={(e) => setForm({ ...form, headOfDepartment: e.target.value })}
          placeholder="e.g. Dr. Jane Smith"
        />
      </FormField>

      <SelectField
        label="Course"
        value={form.courseId}
        onChange={(v) => setForm({ ...form, courseId: v })}
        options={courseOptions}
        error={fe.courseId}
        placeholder="Choose a course"
      />

      <SelectField
        label="Teacher"
        value={form.teacherId}
        onChange={(v) => setForm({ ...form, teacherId: v })}
        options={teacherOptions}
        error={fe.teacherId}
        placeholder="Choose a teacher"
      />

      <SelectField
        label="Student"
        value={form.studentId}
        onChange={(v) => setForm({ ...form, studentId: v })}
        options={studentOptions}
        error={fe.studentId}
        placeholder="Choose a student"
      />

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button type="submit" loading={loading}>
          {isEdit ? 'Save changes' : 'Create department'}
        </Button>
      </DialogFooter>
    </form>
  )
}

export function DepartmentsPage() {
  const { data, loading, error, refetch } = useQuery(() => store.academics.listDepartments(), [])
  const [dialog, setDialog] = useState({ open: false, department: null })
  const [deleting, setDeleting] = useState(null)
  const [remove] = useMutation((id) => store.academics.deleteDepartment(id), { success: 'Department deleted.' })

  const columns = [
    { key: 'code', header: 'Code', cell: (d) => <span className="font-medium">{d.code}</span> },
    {
      key: 'name',
      header: 'Department',
      cell: (d) => (
        <div className="max-w-xs whitespace-normal">
          <p className="font-medium">{d.name}</p>
          {d.description && <p className="line-clamp-1 text-xs text-muted-foreground">{d.description}</p>}
        </div>
      ),
    },
    { key: 'head', header: 'Head of department', value: (d) => d.head?.name ?? '', cell: (d) => d.head?.name ?? <span className="text-muted-foreground">Not assigned</span> },
    { key: 'courseCount', header: 'Courses', align: 'right' },
    { key: 'teacherCount', header: 'Teachers', align: 'right' },
    { key: 'studentCount', header: 'Students', align: 'right' },
    {
      key: 'actions',
      header: '',
      sortable: false,
      searchable: false,
      export: false,
      align: 'right',
      cell: (d) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${d.name}`}>
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => setDialog({ open: true, department: d })}>
              <Pencil /> Edit
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={() => setDeleting(d)}>
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
        title="Department Management"
        description="Academic departments, their heads, courses, teachers, and students."
        actions={
          <Button onClick={() => setDialog({ open: true, department: null })}>
            <Plus /> Add Department
          </Button>
        }
      />
      <DataTable
        columns={columns}
        rows={data}
        loading={loading}
        error={error}
        onRetry={refetch}
        searchable={false}
        initialSort={{ key: 'name', dir: 'asc' }}
        emptyIcon={Building2}
        emptyTitle="No departments yet"
        emptyDescription="Create a department to start adding courses, teachers and students."
      />

      <Dialog open={dialog.open} onOpenChange={(open) => setDialog((d) => ({ ...d, open }))}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{dialog.department ? 'Edit Department' : 'Add Department'}</DialogTitle>
            <DialogDescription>
              {dialog.department
                ? 'Update department details and assignments.'
                : 'Enter department details and assign head of department, course, teacher, or student.'}
            </DialogDescription>
          </DialogHeader>
          <DepartmentForm key={dialog.department?.id ?? 'new'} department={dialog.department} onClose={() => setDialog((d) => ({ ...d, open: false }))} />
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(v) => !v && setDeleting(null)}
        title={`Delete ${deleting?.name ?? 'department'}?`}
        description="Departments that still have courses, teachers or students cannot be deleted. This cannot be undone."
        confirmLabel="Delete department"
        variant="destructive"
        onConfirm={async () => {
          const res = await remove(deleting.id)
          return res.ok ? undefined : false
        }}
      />
    </>
  )
}
