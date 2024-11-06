import { useState } from 'react'
import { GraduationCap, Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DataTable } from '@/components/common/DataTable'
import { PageHeader } from '@/components/common/PageHeader'
import { StatusBadge } from '@/components/common/StatusBadge'
import { useAuth } from '@/context/auth-context'
import { useLookups } from '@/context/lookups-context'
import { useQuery } from '@/hooks/useStore'
import { formatYearOfStudy } from '@/lib/format'
import { store } from '@/store'
import { UserActionDialogs } from '@/features/admin/users/UserActionDialogs'
import { UserFormDialog, DEPARTMENT_OPTIONS } from '@/features/admin/users/UserFormDialog'

const STUDENT_ROLE_OPTIONS = [{ value: 'student', label: 'Student' }]

export function DeptStudentsPage() {
  const { user, profile } = useAuth()
  const lookups = useLookups()
  const dept =
    (lookups?.departments ?? []).find(
      (d) =>
        (d.headTeacherId && d.headTeacherId === profile?.id) ||
        (d.head_teacher_id && d.head_teacher_id === profile?.id) ||
        d.id === headDeptId,
    ) ||
    (headDeptId ? (lookups?.departments ?? []).find((d) => d.id === headDeptId) : null) ||
    lookups?.departments?.find((d) => d.id === 'dep_cs') ||
    lookups?.departments?.[0]
  const deptId = dept?.id

  const { data, loading, error, refetch } = useQuery(
    () => store.users.listUsers({ departmentId: deptId, role: 'student', pageSize: 100 }),
    [deptId],
    { enabled: Boolean(deptId) },
  )

  const [formOpen, setFormOpen] = useState(false)
  const [editingUserId, setEditingUserId] = useState(null)
  const [action, setAction] = useState(null)

  const openEdit = (s) => {
    setEditingUserId(s.id)
    setFormOpen(true)
  }

  const columns = [
    { key: 'identifier', header: 'Student ID', cell: (s) => <span className="font-mono text-xs">{s.identifier}</span> },
    { key: 'name', header: 'Student Name', cell: (s) => <span className="font-semibold">{s.name}</span> },
    { key: 'yearOfStudy', header: 'Current Year', cell: (s) => formatYearOfStudy(s.yearOfStudy || s.batchYear || s.admissionYear) },
    { key: 'program', header: 'Program' },
    { key: 'status', header: 'Status', cell: (s) => <StatusBadge status={s.status} /> },
    {
      key: 'actions',
      header: 'Actions',
      sortable: false,
      searchable: false,
      export: false,
      align: 'right',
      cell: (s) => (
        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Edit ${s.name}`}
            title="Edit student"
            onClick={() => openEdit(s)}
          >
            <Pencil className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-destructive hover:text-destructive hover:bg-destructive/10"
            aria-label={`Delete ${s.name}`}
            title="Delete student"
            onClick={() => setAction({ type: 'delete', user: { id: s.id, name: s.name } })}
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
        title={`${dept?.name ?? 'Department'} — Students`}
        description="Students currently enrolled and studying in this department."
        centered
      />
      <DataTable
        columns={columns}
        rows={data?.items}
        loading={loading}
        error={error}
        onRetry={refetch}
        searchPlaceholder="Search student by name or ID…"
        initialSort={{ key: 'name', dir: 'asc' }}
        emptyIcon={GraduationCap}
        emptyTitle="No students found"
        emptyDescription="No students registered under this department."
      />

      <UserFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        userId={editingUserId}
        defaultRole="student"
        defaultDepartment={dept?.id || dept?.name}
        roleOptions={STUDENT_ROLE_OPTIONS}
        onCreated={() => refetch()}
      />
      <UserActionDialogs
        action={action}
        onClose={() => {
          setAction(null)
          refetch()
        }}
      />
    </>
  )
}
