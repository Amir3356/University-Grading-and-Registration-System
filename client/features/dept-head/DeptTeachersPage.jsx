import { useState } from 'react'
import { Pencil, Plus, Trash2, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DataTable } from '@/components/common/DataTable'
import { PageHeader } from '@/components/common/PageHeader'
import { useAuth } from '@/context/auth-context'
import { useLookups } from '@/context/lookups-context'
import { useQuery } from '@/hooks/useStore'
import { store } from '@/store'
import { TempPasswordDialog, UserActionDialogs } from '@/features/admin/users/UserActionDialogs'
import { UserFormDialog } from '@/features/admin/users/UserFormDialog'

const TEACHER_ROLE_OPTIONS = [{ value: 'teacher', label: 'Teacher' }]

export function DeptTeachersPage() {
  const { profile } = useAuth()
  const lookups = useLookups()
  const dept =
    (lookups?.departments ?? []).find((d) => d.headTeacherId === profile?.id || d.id === profile?.departmentId) ||
    lookups?.departments?.[0]
  const deptId = dept?.id

  const { data, loading, error, refetch } = useQuery(
    () => store.academics.listTeachers({ departmentId: deptId }),
    [deptId],
    { enabled: Boolean(deptId) },
  )

  const [formOpen, setFormOpen] = useState(false)
  const [editingUserId, setEditingUserId] = useState(null)
  const [action, setAction] = useState(null)
  const [created, setCreated] = useState(null)

  const openCreate = () => {
    setEditingUserId(null)
    setFormOpen(true)
  }

  const openEdit = (t) => {
    setEditingUserId(t.userId)
    setFormOpen(true)
  }

  const handleCreated = (res) => {
    refetch()
    setCreated({
      name: res.user.name,
      username: res.username,
      password: res.temporaryPassword,
      identifier: res.user.identifier,
      roleId: res.user.roleId,
    })
  }

  const columns = [
    { key: 'employeeNumber', header: 'Teacher ID', cell: (t) => <span className="font-mono text-xs">{t.employeeNumber}</span> },
    { key: 'name', header: 'Teacher Name', cell: (t) => <span className="font-semibold">{t.name}</span> },
    { key: 'specialization', header: 'Specialization' },
    { key: 'officeRoom', header: 'Office' },
    {
      key: 'actions',
      header: 'Actions',
      sortable: false,
      searchable: false,
      export: false,
      align: 'right',
      cell: (t) => (
        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Edit ${t.name}`}
            title="Edit teacher"
            onClick={() => openEdit(t)}
          >
            <Pencil className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-destructive hover:text-destructive hover:bg-destructive/10"
            aria-label={`Delete ${t.name}`}
            title="Delete teacher"
            onClick={() => setAction({ type: 'delete', user: { id: t.userId, name: t.name } })}
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
        title={`${dept?.name ?? 'Department'} — Teachers`}
        description="Faculty members, specializations, and office details for this department."
        actions={
          <Button onClick={openCreate}>
            <Plus /> Add Teacher
          </Button>
        }
      />
      <DataTable
        columns={columns}
        rows={data}
        loading={loading}
        error={error}
        onRetry={refetch}
        searchPlaceholder="Search teacher name or ID…"
        initialSort={{ key: 'name', dir: 'asc' }}
        emptyIcon={Users}
        emptyTitle="No teachers found"
        emptyDescription="No teachers assigned to this department."
        emptyAction={
          <Button size="sm" onClick={openCreate}>
            <Plus /> Add teacher
          </Button>
        }
      />

      <UserFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        userId={editingUserId}
        defaultRole="teacher"
        defaultDepartment={dept?.name}
        roleOptions={TEACHER_ROLE_OPTIONS}
        onCreated={handleCreated}
      />
      <UserActionDialogs
        action={action}
        onClose={() => {
          setAction(null)
          refetch()
        }}
      />
      <TempPasswordDialog result={created} onClose={() => setCreated(null)} />
    </>
  )
}
