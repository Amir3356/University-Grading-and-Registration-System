import { useState, useMemo, useEffect } from 'react'
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
import { useAuth } from '@/context/auth-context'
import { useLookups } from '@/context/lookups-context'
import { useQuery } from '@/hooks/useStore'
import { store } from '@/store'
import { formatYearOfStudy, getStudentCurrentYearOfStudy } from '@/lib/format'
import { onUserChange } from '@/lib/syncEvents'
import { useWebSocketEvent } from '@/lib/websocket'
import { ProgramTypeBadge } from '@/components/common/StatusBadge'
import { UserActionDialogs } from '@/features/admin/users/UserActionDialogs'
import { UserFormDialog, PROGRAM_TYPE_OPTIONS, YEAR_OF_STUDY_OPTIONS } from '@/features/admin/users/UserFormDialog'

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

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
]

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
  const cachedDeptId =
    profile?.department_id ??
    profile?.departmentId ??
    profile?.department?.id ??
    user?.departmentId ??
    user?.department_id

  const { data: self } = useQuery(
    () => (user?.id ? store.users.getUser(user.id).catch(() => null) : Promise.resolve(null)),
    [user?.id],
    {
      enabled: Boolean(user?.id && !cachedDeptId),
      live: false,
    },
  )
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
  const [roleFilter, setRoleFilter] = useState('')
  const [programFilter, setProgramFilter] = useState('')
  const [yearFilter, setYearFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

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
  useWebSocketEvent('USER_DELETED', () => refetch())
  useWebSocketEvent('STUDENT_UPDATED', () => refetch())

  const items = (data?.items ?? []).filter(
    (u) => MANAGED_ROLES.includes(u.roleId) && !u.isSeed && !u.is_seed && !/^usr_\d{4}$/.test(u.id),
  )

  const filteredItems = useMemo(() => {
    return items.filter((u) => {
      const name = (u.name || `${u.firstName || ''} ${u.lastName || ''}`).trim()
      const username = u.username || ''
      const identifier = u.identifier || u.student_number || ''
      const roleId = u.roleId || u.role_id || ''
      const programType = (u.program_type || u.programType || (roleId === 'student' ? 'regular' : '')).toLowerCase()
      const currentYear = roleId === 'student' ? formatYearOfStudy(u.yearOfStudy || u.year_of_study || 1).toLowerCase() : ''
      const status = u.status || 'active'

      if (roleFilter && roleId !== roleFilter) return false
      if (statusFilter && status !== statusFilter) return false
      if (programFilter && programType !== programFilter.toLowerCase()) return false
      if (yearFilter) {
        if (roleId !== 'student') return false
        const currentYearStr = getStudentCurrentYearOfStudy(u)
        const rawYear = String(u.yearOfStudy ?? u.year_of_study ?? '')
        if (currentYearStr !== `Year ${yearFilter}` && rawYear !== String(yearFilter)) {
          return false
        }
      }

      if (search.trim()) {
        const q = search.trim().toLowerCase()
        const match =
          name.toLowerCase().includes(q) ||
          username.toLowerCase().includes(q) ||
          identifier.toLowerCase().includes(q) ||
          programType.includes(q) ||
          currentYear.includes(q) ||
          (ROLE_BADGE_LABELS[roleId] || '').toLowerCase().includes(q)
        if (!match) return false
      }
      return true
    })
  }, [items, search, roleFilter, programFilter, yearFilter, statusFilter])

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
        {/* Search Box Filter on left, Dropdown Filters flush at the far right edge */}
        <div className="toolbar--split">
          <div className="toolbar--split__left">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search by name, username, or ID…"
            />
          </div>
          <div className="toolbar--split__right">
            <FilterSelect
              value={roleFilter}
              onChange={(val) => {
                setRoleFilter(val)
                if (val === 'teacher') {
                  setProgramFilter('')
                  setYearFilter('')
                }
              }}
              options={DEPT_ROLE_OPTIONS}
              allLabel="All roles"
              label="Role"
              className="filter-select--role"
            />
            {roleFilter !== 'teacher' && (
              <>
                <FilterSelect
                  value={programFilter}
                  onChange={setProgramFilter}
                  options={PROGRAM_TYPE_OPTIONS}
                  allLabel="All program types"
                  label="Program Type"
                  className="filter-select--program"
                />
                <FilterSelect
                  value={yearFilter}
                  onChange={setYearFilter}
                  options={YEAR_OF_STUDY_OPTIONS}
                  allLabel="All years"
                  label="Year of Study"
                  className="filter-select--year"
                />
              </>
            )}
            <FilterSelect
              value={statusFilter}
              onChange={setStatusFilter}
              options={STATUS_OPTIONS}
              allLabel="All statuses"
              label="Status"
              className="filter-select--status"
            />
            {(search || roleFilter || programFilter || yearFilter || statusFilter) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearch('')
                  setRoleFilter('')
                  setProgramFilter('')
                  setYearFilter('')
                  setStatusFilter('')
                }}
                className="text-xs text-muted-foreground hover:text-foreground h-9"
              >
                Reset filters
              </Button>
            )}
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
                            {getStudentCurrentYearOfStudy(u)}
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
        lockDepartment={true}
        onCreated={handleCreated}
        onUpdated={() => refetch()}
      />
      <UserActionDialogs action={action} onClose={() => { setAction(null); refetch() }} />
    </>
  )
}
export default DeptAccountProvisionPage
