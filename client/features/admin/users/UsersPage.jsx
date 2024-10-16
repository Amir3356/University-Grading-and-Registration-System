import { useState, useMemo } from 'react'
import { Pencil, Plus, Trash2, UserCheck, UserX, Users } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { EmptyState } from '@/components/common/EmptyState'
import { ErrorState } from '@/components/common/ErrorState'
import { FilterSelect } from '@/components/common/FilterSelect'
import { SearchInput } from '@/components/common/SearchInput'
import { TableSkeleton } from '@/components/common/Loading'
import { PageHeader } from '@/components/common/PageHeader'
import { useQuery } from '@/hooks/useStore'
import { ROLE_LABELS } from '@/lib/format'
import { store } from '@/store'
import { UserActionDialogs } from './UserActionDialogs'
import { UserFormDialog, DEPARTMENT_OPTIONS } from './UserFormDialog'

const ROLE_BADGE = { admin: 'default', dept_head: 'primary', teacher: 'info', student: 'secondary' }

const COLUMNS = [
  { key: 'no', header: 'No' },
  { key: 'name', header: 'Full name' },
  { key: 'roleId', header: 'Role' },
  { key: 'identifier', header: 'Department head ID' },
  { key: 'departmentName', header: 'Department' },
  { key: 'password', header: 'Password' },
]

const ROLE_OPTIONS = [
  { value: 'dept_head', label: 'Department Head' },
  { value: 'teacher', label: 'Teacher' },
  { value: 'student', label: 'Student' },
  { value: 'admin', label: 'Administrator' },
]

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
]

function UserRowActions({ user, onEdit, onAction }) {
  const active = user.status === 'active'
  return (
    <div className="cluster cluster--xs cluster--nowrap">
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
  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [action, setAction] = useState(null)

  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [departmentFilter, setDepartmentFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const { data, loading, error, refetch } = useQuery(
    () => store.users.listUsers({ pageSize: null, excludeSeed: true }),
    [],
  )

  const items = (data?.items ?? []).filter((u) => !u.isSeed && !u.is_seed && !/^usr_\d{4}$/.test(u.id))

  const filteredItems = useMemo(() => {
    return items.filter((u) => {
      const name = u.name || `${u.firstName || u.first_name || ''} ${u.lastName || u.last_name || ''}`.trim()
      const roleId = u.roleId || u.role_id || ''
      const identifier = u.identifier || u.employee_number || u.student_number || ''
      const departmentName = u.departmentName || u.department_name || ''
      const username = u.username || ''
      const status = u.status || 'active'

      if (roleFilter && roleId !== roleFilter) return false
      if (statusFilter && status !== statusFilter) return false
      if (departmentFilter && u.departmentId !== departmentFilter && departmentName.toLowerCase() !== departmentFilter.toLowerCase()) return false

      if (search.trim()) {
        const q = search.trim().toLowerCase()
        const match =
          name.toLowerCase().includes(q) ||
          username.toLowerCase().includes(q) ||
          identifier.toLowerCase().includes(q) ||
          departmentName.toLowerCase().includes(q) ||
          (ROLE_LABELS[roleId] || '').toLowerCase().includes(q)
        if (!match) return false
      }
      return true
    })
  }, [items, search, roleFilter, departmentFilter, statusFilter])

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
        title="Account Provision"
        description="Provision and manage department head and user accounts."
        centered
        actions={
          <Button onClick={openCreate}>
            <Plus /> Create user
          </Button>
        }
      />

      {loading && !data ? (
        <TableSkeleton cols={7} />
      ) : error ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : (
        <div className="flex flex-col gap-3">
          {/* Search Box Filter on left, Dropdown Filters on right */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="w-full sm:w-72 md:w-80">
              <SearchInput
                value={search}
                onChange={setSearch}
                placeholder="Search by name, username, ID, department…"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:justify-end sm:ml-auto">
              <FilterSelect
                value={roleFilter}
                onChange={setRoleFilter}
                options={ROLE_OPTIONS}
                allLabel="All roles"
                label="Role"
                className="w-full sm:w-40"
              />
              <FilterSelect
                value={departmentFilter}
                onChange={setDepartmentFilter}
                options={DEPARTMENT_OPTIONS}
                allLabel="All departments"
                label="Department"
                className="w-full sm:w-44"
              />
              <FilterSelect
                value={statusFilter}
                onChange={setStatusFilter}
                options={STATUS_OPTIONS}
                allLabel="All statuses"
                label="Status"
                className="w-full sm:w-36"
              />
            </div>
          </div>

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
                {items.length === 0 ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={COLUMNS.length + 1} className="whitespace-normal">
                      <EmptyState compact icon={Users} title="No users yet" description="Create the first account to get started." />
                    </TableCell>
                  </TableRow>
                ) : filteredItems.length === 0 ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={COLUMNS.length + 1} className="whitespace-normal">
                      <EmptyState compact icon={Users} title="No matching users found" description="Try adjusting your search query or filter options." />
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredItems.map((u, i) => {
                    const name = u.name || `${u.firstName || u.first_name || ''} ${u.lastName || u.last_name || ''}`.trim()
                    const roleId = u.roleId || u.role_id
                    const identifier = u.identifier || u.employee_number || u.student_number || '—'
                    const departmentName = u.departmentName || u.department_name || '—'
                    const passwordHash = u.passwordHash || u.password_hash || '—'
                    return (
                      <TableRow key={u.id} className="hover:bg-muted/50">
                        <TableCell className="tabular text-muted">{i + 1}</TableCell>
                        <TableCell className="font-medium">{name}</TableCell>
                        <TableCell>
                          <Badge variant={ROLE_BADGE[roleId]}>{ROLE_LABELS[roleId] || roleId}</Badge>
                        </TableCell>
                        <TableCell className="tabular">{identifier}</TableCell>
                        <TableCell>{departmentName}</TableCell>
                        <TableCell className="tabular font-mono text-xs max-w-[150px]" title={passwordHash}>
                          <span className="rounded bg-muted px-1.5 py-0.5 select-all truncate block" title={passwordHash}>
                            {passwordHash}
                          </span>
                        </TableCell>
                        <TableCell>
                          <UserRowActions
                            user={{ ...u, name }}
                            onEdit={() => openEdit(u)}
                            onAction={(type) => setAction({ type, user: { ...u, name } })}
                          />
                        </TableCell>
                      </TableRow>
                    )
                  })
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
        onCreated={() => refetch()}
      />
      <UserActionDialogs action={action} onClose={() => setAction(null)} />
    </>
  )
}
