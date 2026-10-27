import { useState, useMemo, useEffect } from 'react'
import { Pencil, Plus, Trash2, UserCheck, UserX, Users } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { EmptyState } from '@/components/common/EmptyState'
import { ErrorState } from '@/components/common/ErrorState'
import { SearchInput } from '@/components/common/SearchInput'
import { TableSkeleton } from '@/components/common/Loading'
import { PageHeader } from '@/components/common/PageHeader'
import { useAuth } from '@/context/auth-context'
import { useLookups } from '@/context/lookups-context'
import { useQuery } from '@/hooks/useStore'
import { store } from '@/store'
import { formatYearOfStudy } from '@/lib/format'
import { onUserChange } from '@/lib/syncEvents'
import { useWebSocketEvent } from '@/lib/websocket'
import { ProgramTypeBadge } from '@/components/common/StatusBadge'
import { UserActionDialogs } from '@/features/admin/users/UserActionDialogs'
import { UserFormDialog } from '@/features/admin/users/UserFormDialog'

const COLUMNS = [
  { key: 'name', header: 'Fullname' },
  { key: 'username', header: 'Username' },
  { key: 'role', header: 'Role' },
  { key: 'identifier', header: 'ID' },
  { key: 'currentYear', header: 'Current Year' },
  { key: 'programType', header: 'Program Type' },
  { key: 'actions', header: 'Action' },
]

// Department heads may provision and manage student and teacher accounts.
const DEPT_ROLE_OPTIONS = [
  { value: 'student', label: 'Student' },
  { value: 'teacher', label: 'Teacher' },
]
const MANAGED_ROLES = DEPT_ROLE_OPTIONS.map((r) => r.value)
const ROLE_BADGE_LABELS = Object.fromEntries(DEPT_ROLE_OPTIONS.map((r) => [r.value, r.label]))

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
  const { user, profile } = useAuth()
  const lookups = useLookups()
  const departments = lookups?.departments ?? []

  // Resolve department head's department
  // The cached login profile can be missing or stale, so fall back to the head's own record from the API.
  const { data: self } = useQuery(() => store.users.getUser(user.id), [user?.id], {
    enabled: Boolean(user?.id),
    live: false,
  })
  const headDeptId =
    profile?.department_id ??
    profile?.departmentId ??
    profile?.department?.id ??
    self?.departmentId ??
    self?.department_id ??
    self?.profile?.departmentId ??
    self?.profile?.department_id ??
    user?.departmentId ??
    user?.department_id
  const headDept =
    departments.find(
      (d) =>
        d.id === headDeptId ||
        (profile?.id && (d.head_teacher_id ?? d.headTeacherId) === profile.id) ||
        (user?.id && (d.head_teacher_id ?? d.headTeacherId) === user.id) ||
        (self?.profile?.id && (d.head_teacher_id ?? d.headTeacherId) === self.profile.id) ||
        (self?.user?.id && (d.head_teacher_id ?? d.headTeacherId) === self.user.id),
    ) || (headDeptId ? departments.find((d) => d.id === headDeptId) : null) || null



  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [action, setAction] = useState(null)

  const [search, setSearch] = useState('')

  const activeDeptId = headDept?.id || headDeptId
  // Query student and teacher accounts for this department (excluding seed/mock data).
  // Both roles are loaded so an account stays visible after its role is changed.
  const { data, loading, error, refetch } = useQuery(
    () =>
      store.users.listUsers({
        departmentId: activeDeptId,
        pageSize: null,
        excludeSeed: true,
      }),
    [activeDeptId],
  )

  useEffect(() => {
    return onUserChange(() => {
      refetch()
    })
  }, [refetch])

  useWebSocketEvent('USER_UPDATED', () => refetch())
  useWebSocketEvent('STUDENT_UPDATED', () => refetch())

  const items = (data?.items ?? []).filter(
    (u) => MANAGED_ROLES.includes(u.roleId) && !u.isSeed && !u.is_seed && !/^usr_\d{4}$/.test(u.id),
  )

  const filteredItems = useMemo(() => {
    return items.filter((u) => {
      const name = (u.name || `${u.firstName || ''} ${u.lastName || ''}`).trim()
      const username = u.username || ''
      const identifier = u.identifier || u.student_number || ''
      const programType = u.roleId === 'student' ? (u.program_type || u.programType || 'regular').toLowerCase() : ''
      const currentYear = u.roleId === 'student' ? formatYearOfStudy(u.yearOfStudy || u.year_of_study || 1).toLowerCase() : ''

      if (search.trim()) {
        const q = search.trim().toLowerCase()
        const match =
          name.toLowerCase().includes(q) ||
          username.toLowerCase().includes(q) ||
          identifier.toLowerCase().includes(q) ||
          programType.includes(q) ||
          currentYear.includes(q)
        if (!match) return false
      }
      return true
    })
  }, [items, search])

  const openCreate = () => {
    setEditingId(null)
    setFormOpen(true)
  }

  const openEdit = (u) => {
    setEditingId(u.id)
    setFormOpen(true)
  }

  const handleCreated = () => {
    refetch()
  }

  return (
    <>
      <PageHeader
        title="Account Provision"
        description="Provision and manage student and teacher accounts for your department."
        centered
        actions={
          <Button onClick={openCreate}>
            <Plus /> Create user
          </Button>
        }
      />

      <div className="stack stack--md">
        {/* Search Box Filter */}
        <div className="toolbar--split">
          <div className="toolbar--split__left">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search by name, username, or ID…"
            />
          </div>
        </div>

        {/* Content Table */}
        {loading && !data ? (
          <TableSkeleton cols={COLUMNS.length} />
        ) : error ? (
          <ErrorState error={error} onRetry={refetch} />
        ) : (
          <div className="table-box">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  {COLUMNS.map((c) => (
                    <TableHead
                      key={c.key}
                      className={c.key === 'actions' ? 'text-right' : undefined}
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
                        title="No accounts found"
                        description="No student or teacher accounts provisioned in this department yet."
                      />
                    </TableCell>
                  </TableRow>
                ) : filteredItems.length === 0 ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={COLUMNS.length} className="whitespace-normal">
                      <EmptyState
                        compact
                        icon={Users}
                        title="No matching accounts found"
                        description="Try adjusting your search query or filter options."
                      />
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredItems.map((u) => (
                    <TableRow key={u.id} className="hover:bg-muted/50">
                      <TableCell>
                        <span className="font-medium text-foreground">{u.name}</span>
                      </TableCell>
                      <TableCell>
                        <span className="font-mono text-xs text-muted-foreground">{u.username || '—'}</span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{ROLE_BADGE_LABELS[u.roleId] ?? u.roleId}</Badge>
                      </TableCell>
                      <TableCell>
                        <span className="font-mono text-xs font-semibold text-foreground bg-muted px-2 py-0.5 rounded">
                          {u.identifier && u.identifier !== '—' ? u.identifier : '—'}
                        </span>
                      </TableCell>
                      <TableCell>
                        {u.roleId === 'student' ? (
                          <span className="text-foreground font-medium">
                            {formatYearOfStudy(u.yearOfStudy || u.year_of_study || 1)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {u.roleId === 'student' ? (
                          <ProgramTypeBadge programType={u.program_type || u.programType || 'regular'} />
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
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
        defaultDepartment={headDept?.id || headDeptId || ''}
        roleOptions={DEPT_ROLE_OPTIONS}
        hideDepartment={true}
        onCreated={handleCreated}
        onUpdated={() => refetch()}
      />
      <UserActionDialogs action={action} onClose={() => { setAction(null); refetch() }} />
    </>
  )
}
export default DeptAccountProvisionPage
