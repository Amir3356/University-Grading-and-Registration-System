import { useState } from 'react'
import { Pencil, Plus, Trash2, UserCheck, UserX, Users } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { EmptyState } from '@/components/common/EmptyState'
import { ErrorState } from '@/components/common/ErrorState'
import { TableSkeleton } from '@/components/common/Loading'
import { PageHeader } from '@/components/common/PageHeader'
import { useAuth } from '@/context/auth-context'
import { useLookups } from '@/context/lookups-context'
import { useQuery } from '@/hooks/useStore'
import { store } from '@/store'
import { TempPasswordDialog, UserActionDialogs } from '@/features/admin/users/UserActionDialogs'
import { UserFormDialog } from '@/features/admin/users/UserFormDialog'

const COLUMNS = [
  { key: 'no', header: 'No' },
  { key: 'name', header: 'Fullanme' },
  { key: 'identifier', header: 'student_ID' },
  { key: 'role', header: 'Role(Student only)' },
  { key: 'department', header: 'DEpartment' },
  { key: 'actions', header: 'Actions' },
]

const STUDENT_ROLE_OPTIONS = [{ value: 'student', label: 'Student' }]

function UserRowActions({ user, onEdit, onAction }) {
  const active = user.status === 'active'
  return (
    <div className="cluster cluster--xs cluster--nowrap justify-end" onClick={(e) => e.stopPropagation()}>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={`Edit ${user.name}`}
        title="Edit"
        onClick={onEdit}
      >
        <Pencil className="size-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={`${active ? 'Deactivate' : 'Activate'} ${user.name}`}
        title={active ? 'Deactivate' : 'Activate'}
        onClick={() => onAction(active ? 'deactivate' : 'activate')}
      >
        {active ? <UserX className="size-4" /> : <UserCheck className="size-4" />}
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        className="text-destructive hover:text-destructive"
        aria-label={`Delete ${user.name}`}
        title="Delete"
        onClick={() => onAction('delete')}
      >
        <Trash2 className="size-4" />
      </Button>
    </div>
  )
}

export function DeptAccountProvisionPage() {
  const { profile } = useAuth()
  const lookups = useLookups()
  const departments = lookups?.departments ?? []

  // Resolve department head's department
  const headDept =
    departments.find((d) => d.headTeacherId === profile?.id || d.id === profile?.departmentId) ||
    departments[0]

  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [action, setAction] = useState(null)
  const [created, setCreated] = useState(null)

  // Query student accounts for this department
  const { data, loading, error, refetch } = useQuery(
    () => store.users.listUsers({ role: 'student', departmentId: headDept?.id, pageSize: null }),
    [headDept?.id],
  )

  const items = data?.items ?? []

  const openCreate = () => {
    setEditingId(null)
    setFormOpen(true)
  }

  const openEdit = (u) => {
    setEditingId(u.id)
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

  return (
    <>
      <PageHeader
        title="Account Provision"
        description="Provision and manage student accounts for your department."
        actions={
          <Button onClick={openCreate}>
            <Plus /> Create user
          </Button>
        }
      />

      <div className="flex flex-col gap-4">
        {/* Content Table */}
        {loading && !data ? (
          <TableSkeleton cols={6} />
        ) : error ? (
          <ErrorState error={error} onRetry={refetch} />
        ) : (
          <div className="overflow-hidden rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  {COLUMNS.map((c) => (
                    <TableHead
                      key={c.key}
                      className={c.key === 'no' ? 'w-16' : c.key === 'actions' ? 'text-right' : undefined}
                    >
                      {c.header}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.length === 0 ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={COLUMNS.length} className="whitespace-normal">
                      <EmptyState
                        compact
                        icon={Users}
                        title="No student accounts found"
                        description="No student accounts provisioned in this department yet."
                        action={
                          <Button size="sm" onClick={openCreate}>
                            <Plus /> Provision student
                          </Button>
                        }
                      />
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((u, i) => (
                    <TableRow key={u.id} className="hover:bg-muted/50">
                      <TableCell className="tabular text-muted">{i + 1}</TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium text-foreground">{u.name}</span>
                          <span className="text-xs text-muted-foreground">{u.username}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="font-mono text-xs font-semibold text-foreground bg-muted px-2 py-0.5 rounded">
                          {u.identifier !== '—' ? u.identifier : '—'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">Student</Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-foreground">{u.departmentName || headDept?.name || '—'}</span>
                      </TableCell>
                      <TableCell className="text-right">
                        <UserRowActions
                          user={u}
                          onEdit={() => openEdit(u)}
                          onAction={(type) => setAction({ type, user: u })}
                        />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <UserFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        userId={editingId}
        defaultRole="student"
        defaultDepartment={headDept?.name}
        roleOptions={STUDENT_ROLE_OPTIONS}
        onCreated={handleCreated}
      />
      <UserActionDialogs action={action} onClose={() => { setAction(null); refetch() }} />
      <TempPasswordDialog result={created} onClose={() => setCreated(null)} />
    </>
  )
}
export default DeptAccountProvisionPage
