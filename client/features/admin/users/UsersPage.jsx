import { useState } from 'react'
import { Pencil, Plus, Trash2, UserCheck, UserX, Users } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { EmptyState } from '@/components/common/EmptyState'
import { ErrorState } from '@/components/common/ErrorState'
import { TableSkeleton } from '@/components/common/Loading'
import { PageHeader } from '@/components/common/PageHeader'
import { useQuery } from '@/hooks/useStore'
import { ROLE_LABELS } from '@/lib/format'
import { store } from '@/store'
import { TempPasswordDialog, UserActionDialogs } from './UserActionDialogs'
import { UserFormDialog } from './UserFormDialog'

const ROLE_BADGE = { admin: 'default', dept_head: 'primary', teacher: 'info', student: 'secondary' }

const COLUMNS = [
  { key: 'no', header: 'No' },
  { key: 'name', header: 'Fullanme' },
  { key: 'roleId', header: 'Role' },
  { key: 'identifier', header: 'Department head ID' },
  { key: 'departmentName', header: 'Department' },
]

function UserRowActions({ user, onEdit, onAction }) {
  const active = user.status === 'active'
  return (
    <div className="cluster cluster--xs cluster--nowrap" onClick={(e) => e.stopPropagation()}>
      <Button variant="ghost" size="icon-sm" aria-label={`Edit ${user.name}`} title="Edit" onClick={onEdit}>
        <Pencil />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={`${active ? 'Deactivate' : 'Activate'} ${user.name}`}
        title={active ? 'Deactivate' : 'Activate'}
        onClick={() => onAction(active ? 'deactivate' : 'activate')}
      >
        {active ? <UserX /> : <UserCheck />}
      </Button>
      <Button variant="ghost" size="icon-sm" className="text-destructive" aria-label={`Delete ${user.name}`} title="Delete" onClick={() => onAction('delete')}>
        <Trash2 />
      </Button>
    </div>
  )
}

export function UsersPage() {
  const navigate = useNavigate()
  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [action, setAction] = useState(null)
  const [created, setCreated] = useState(null)

  const { data, loading, error, refetch } = useQuery(
    () => store.users.listUsers({ pageSize: null }),
    [],
  )

  const openCreate = () => {
    setEditingId(null)
    setFormOpen(true)
  }
  const openEdit = (u) => {
    setEditingId(u.id)
    setFormOpen(true)
  }

  return (
    <>
      <PageHeader
        title="Users"
        description="Manage student, teacher and administrator accounts."
        centered
        actions={
          <Button onClick={openCreate}>
            <Plus /> Create user
          </Button>
        }
      />

      {loading && !data ? (
        <TableSkeleton cols={6} />
      ) : error ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : (
        <div className="flex flex-col gap-3">
          <div className="overflow-hidden rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  {COLUMNS.map((c) => (
                    <TableHead key={c.key}>{c.header}</TableHead>
                  ))}
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.length === 0 ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={COLUMNS.length + 1} className="whitespace-normal">
                      <EmptyState compact icon={Users} title="No users yet" description="Create the first account to get started." />
                    </TableCell>
                  </TableRow>
                ) : (
                  data.items.map((u, i) => (
                    <TableRow
                      key={u.id}
                      tabIndex={0}
                      className="cursor-pointer focus-visible:bg-muted focus-visible:outline-none"
                      onClick={() => navigate(`/admin/users/${u.id}`)}
                      onKeyDown={(e) => e.key === 'Enter' && e.target === e.currentTarget && navigate(`/admin/users/${u.id}`)}
                    >
                      <TableCell className="tabular text-muted">{i + 1}</TableCell>
                      <TableCell className="font-medium">{u.name}</TableCell>
                      <TableCell>
                        <Badge variant={ROLE_BADGE[u.roleId]}>{ROLE_LABELS[u.roleId]}</Badge>
                      </TableCell>
                      <TableCell className="tabular">{u.identifier}</TableCell>
                      <TableCell>{u.departmentName}</TableCell>
                      <TableCell>
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
        </div>
      )}

      <UserFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        userId={editingId}
        onCreated={(res) =>
          setCreated({
            name: res.user.name,
            username: res.username,
            password: res.temporaryPassword,
            identifier: res.user.identifier,
            roleId: res.user.roleId,
          })
        }
      />
      <UserActionDialogs action={action} onClose={() => setAction(null)} />
      <TempPasswordDialog result={created} onClose={() => setCreated(null)} />
    </>
  )
}
