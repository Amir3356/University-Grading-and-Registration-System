import { useState } from 'react'
import { Building2, MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
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
  const [form, setForm] = useState({
    code: department?.code ?? '',
    name: department?.name ?? '',
    description: department?.description ?? '',
    headTeacherId: department?.headTeacherId ?? NONE,
  })
  const [save, { loading, fieldErrors }] = useMutation(
    (data) => (isEdit ? store.academics.updateDepartment(department.id, data) : store.academics.createDepartment(data)),
    { success: isEdit ? 'Department updated.' : 'Department created.', onSuccess: onClose },
  )
  const fe = fieldErrors ?? {}
  const teachers = (lookups?.teachers ?? []).filter((t) => t.departmentId === department?.id)
  const headOptions = [{ value: NONE, label: 'No head assigned' }, ...teachers.map((t) => ({ value: t.id, label: t.name }))]
  // Keep the current head selectable even if their account is no longer active.
  if (department?.head && !teachers.some((t) => t.id === department.headTeacherId)) headOptions.push({ value: department.headTeacherId, label: department.head.name })

  return (
    <form
      className="grid gap-4"
      noValidate
      onSubmit={(e) => {
        e.preventDefault()
        save({ ...form, headTeacherId: form.headTeacherId === NONE ? null : form.headTeacherId })
      }}
    >
      <div className="grid gap-4 sm:grid-cols-[8rem_1fr]">
        <FormField label="Code" required error={fe.code} hint="2–6 letters">
          <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} maxLength={6} />
        </FormField>
        <FormField label="Name" required error={fe.name}>
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </FormField>
      </div>
      <FormField label="Description" error={fe.description}>
        <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} />
      </FormField>
      {isEdit && (
        <SelectField
          label="Head of department"
          value={form.headTeacherId}
          onChange={(v) => setForm({ ...form, headTeacherId: v })}
          options={headOptions}
          error={fe.headTeacherId}
          hint={teachers.length ? 'Only active teachers in this department can be selected.' : 'This department has no active teachers yet.'}
        />
      )}
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
  const lookups = useLookups()
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
        title="Departments"
        description="Academic departments, their heads and size."
        actions={
          <Button onClick={() => setDialog({ open: true, department: null })}>
            <Plus /> Add department
          </Button>
        }
      />
      <DataTable
        columns={columns}
        rows={data}
        loading={loading}
        error={error}
        onRetry={refetch}
        searchPlaceholder="Search departments…"
        exportName="departments"
        exportTitle="Departments"
        university={lookups?.university}
        initialSort={{ key: 'name', dir: 'asc' }}
        emptyIcon={Building2}
        emptyTitle="No departments yet"
        emptyDescription="Create a department to start adding courses, teachers and students."
      />

      <Dialog open={dialog.open} onOpenChange={(open) => setDialog((d) => ({ ...d, open }))}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{dialog.department ? 'Edit department' : 'Add department'}</DialogTitle>
            <DialogDescription>{dialog.department ? 'Update details and assign a head of department.' : 'You can assign a head of department once teachers have joined it.'}</DialogDescription>
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
