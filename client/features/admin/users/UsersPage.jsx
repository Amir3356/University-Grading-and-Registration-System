import { useState } from 'react'
import { ArrowDown, ArrowUp, ArrowUpDown, Eye, KeyRound, MoreHorizontal, Pencil, Plus, ShieldCheck, UserCheck, UserX, Users } from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { EmptyState } from '@/components/common/EmptyState'
import { ErrorState } from '@/components/common/ErrorState'
import { ExportMenu } from '@/components/common/ExportMenu'
import { FilterSelect } from '@/components/common/FilterSelect'
import { TableSkeleton } from '@/components/common/Loading'
import { PageHeader } from '@/components/common/PageHeader'
import { Pagination } from '@/components/common/Pagination'
import { SearchInput } from '@/components/common/SearchInput'
import { StatusBadge } from '@/components/common/StatusBadge'
import { useLookups } from '@/context/lookups-context'
import { useQuery } from '@/hooks/useStore'
import { useDebounce } from '@/hooks/useDebounce'
import { formatDateTime, ROLE_LABELS, timeAgo } from '@/lib/format'
import { cn } from '@/lib/utils'
import { store } from '@/store'
import { TempPasswordDialog, UserActionDialogs } from './UserActionDialogs'
import { UserFormDialog } from './UserFormDialog'

const ROLE_OPTIONS = ['admin', 'teacher', 'student'].map((r) => ({ value: r, label: ROLE_LABELS[r] }))
const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
]
const ROLE_BADGE = { admin: 'default', teacher: 'info', student: 'secondary' }

const COLUMNS = [
  { key: 'name', header: 'User', sortable: true },
  { key: 'identifier', header: 'ID', sortable: true },
  { key: 'roleId', header: 'Role', sortable: true },
  { key: 'departmentName', header: 'Department', sortable: true },
  { key: 'status', header: 'Status', sortable: true },
  { key: 'lastLoginAt', header: 'Last sign-in', sortable: true },
]

const EXPORT_COLUMNS = [
  { header: 'Name', value: (u) => u.name },
  { header: 'Username', value: (u) => u.username },
  { header: 'Email', value: (u) => u.email },
  { header: 'ID', value: (u) => u.identifier },
  { header: 'Role', value: (u) => ROLE_LABELS[u.roleId] },
  { header: 'Department', value: (u) => u.departmentName },
  { header: 'Status', value: (u) => u.status },
  { header: 'Last sign-in', value: (u) => (u.lastLoginAt ? formatDateTime(u.lastLoginAt) : 'Never') },
]

const humanize = (perm) => perm.replace(/[._]/g, ' ').replace(/^\w/, (c) => c.toUpperCase())

function SortHeader({ col, sort, onSort }) {
  const active = sort.key === col.key
  return (
    <TableHead aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}>
      <button
        type="button"
        onClick={() => onSort(col.key)}
        className={cn('-mx-1 inline-flex items-center gap-1 rounded px-1 py-0.5 uppercase hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none', active && 'text-foreground')}
      >
        {col.header}
        {active ? sort.dir === 'asc' ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" /> : <ArrowUpDown className="size-3 opacity-40" />}
      </button>
    </TableHead>
  )
}

function UserRowActions({ user, onEdit, onAction, onView }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${user.name}`} onClick={(e) => e.stopPropagation()}>
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
        <DropdownMenuItem onSelect={onView}>
          <Eye /> View details
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onEdit}>
          <Pencil /> Edit
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onAction('reset')}>
          <KeyRound /> Reset password
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {user.status === 'active' ? (
          <DropdownMenuItem variant="destructive" onSelect={() => onAction('deactivate')}>
            <UserX /> Deactivate
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem onSelect={() => onAction('activate')}>
            <UserCheck /> Activate
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function RolesPanel() {
  const lookups = useLookups()
  const roles = lookups?.roles
  const { data: counts, loading, error, refetch } = useQuery(
    () =>
      Object.fromEntries(
        roles.map((r) => [
          r.id,
          { total: store.users.listUsers({ role: r.id, pageSize: 1 }).total, active: store.users.listUsers({ role: r.id, status: 'active', pageSize: 1 }).total },
        ]),
      ),
    [roles],
    { enabled: Boolean(roles) },
  )

  if (!roles || (loading && !counts)) return <TableSkeleton rows={3} cols={3} />
  if (error) return <ErrorState error={error} onRetry={refetch} />
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {roles.map((r) => (
        <Card key={r.id}>
          <CardHeader>
            <div className="min-w-0">
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="size-4 text-muted-foreground" aria-hidden="true" />
                {r.name}
              </CardTitle>
              <CardDescription className="mt-1">{r.description}</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <dl className="grid grid-cols-2 gap-3">
              <div>
                <dt className="text-xs text-muted-foreground">Users</dt>
                <dd className="tabular text-lg font-semibold">{counts?.[r.id]?.total ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Active</dt>
                <dd className="tabular text-lg font-semibold">{counts?.[r.id]?.active ?? '—'}</dd>
              </div>
            </dl>
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground uppercase">Permissions</p>
              <ul className="flex flex-wrap gap-1.5">
                {r.permissions.map((p) => (
                  <li key={p}>
                    <Badge variant="outline" className="font-normal" title={p}>
                      {humanize(p)}
                    </Badge>
                  </li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

export function UsersPage() {
  const navigate = useNavigate()
  const lookups = useLookups()
  const [params] = useSearchParams()
  const [tab, setTab] = useState('users')
  const [search, setSearch] = useState(params.get('search') ?? '')
  const [role, setRole] = useState(ROLE_LABELS[params.get('role')] ? params.get('role') : '')
  const [status, setStatus] = useState('')
  const [departmentId, setDepartmentId] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [sort, setSort] = useState({ key: 'name', dir: 'asc' })
  const debounced = useDebounce(search, 300)

  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [action, setAction] = useState(null)
  const [created, setCreated] = useState(null)

  const query = { search: debounced, role, status, departmentId }
  const { data, loading, error, refetch } = useQuery(
    () => store.users.listUsers({ ...query, page, pageSize, sort }),
    [debounced, role, status, departmentId, page, pageSize, sort.key, sort.dir],
  )

  const filterChange = (setter) => (v) => {
    setter(v)
    setPage(1)
  }
  const onSort = (key) => {
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }))
    setPage(1)
  }

  const fetchAll = async () => {
    const first = await store.users.listUsers({ ...query, sort, page: 1, pageSize: 100 })
    let items = first.items
    for (let p = 2; p <= first.pageCount; p++) items = items.concat((await store.users.listUsers({ ...query, sort, page: p, pageSize: 100 })).items)
    return items
  }

  const openCreate = () => {
    setEditingId(null)
    setFormOpen(true)
  }
  const openEdit = (u) => {
    setEditingId(u.id)
    setFormOpen(true)
  }

  const hasFilters = Boolean(debounced || role || status || departmentId)

  return (
    <>
      <PageHeader
        title="Users"
        description="Manage student, teacher and administrator accounts."
        actions={
          <Button onClick={openCreate}>
            <Plus /> Create user
          </Button>
        }
      />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="users">
            <Users /> Accounts
          </TabsTrigger>
          <TabsTrigger value="roles">
            <ShieldCheck /> Roles &amp; permissions
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="flex flex-col gap-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <SearchInput value={search} onChange={filterChange(setSearch)} placeholder="Search name, email or ID…" />
            <FilterSelect value={role} onChange={filterChange(setRole)} options={ROLE_OPTIONS} allLabel="All roles" label="Filter by role" />
            <FilterSelect value={status} onChange={filterChange(setStatus)} options={STATUS_OPTIONS} allLabel="All statuses" label="Filter by status" />
            <FilterSelect
              value={departmentId}
              onChange={filterChange(setDepartmentId)}
              options={(lookups?.departments ?? []).map((d) => ({ value: d.id, label: d.name }))}
              allLabel="All departments"
              label="Filter by department"
            />
            <div className="sm:ml-auto">
              <ExportMenu filename="users" title="User accounts" columns={EXPORT_COLUMNS} rows={fetchAll} university={lookups?.university} disabled={!data?.total} />
            </div>
          </div>

          {loading && !data ? (
            <TableSkeleton cols={6} />
          ) : error ? (
            <ErrorState error={error} onRetry={refetch} />
          ) : (
            <>
              <div className="overflow-hidden rounded-lg border bg-card">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      {COLUMNS.map((c) => (
                        <SortHeader key={c.key} col={c} sort={sort} onSort={onSort} />
                      ))}
                      <TableHead>
                        <span className="sr-only">Actions</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.items.length === 0 ? (
                      <TableRow className="hover:bg-transparent">
                        <TableCell colSpan={COLUMNS.length + 1} className="whitespace-normal">
                          <EmptyState
                            compact
                            icon={Users}
                            title={hasFilters ? 'No users match these filters' : 'No users yet'}
                            description={hasFilters ? 'Try a different search term or clear the filters.' : 'Create the first account to get started.'}
                          />
                        </TableCell>
                      </TableRow>
                    ) : (
                      data.items.map((u) => (
                        <TableRow
                          key={u.id}
                          tabIndex={0}
                          className="cursor-pointer focus-visible:bg-muted focus-visible:outline-none"
                          onClick={() => navigate(`/admin/users/${u.id}`)}
                          onKeyDown={(e) => e.key === 'Enter' && e.target === e.currentTarget && navigate(`/admin/users/${u.id}`)}
                        >
                          <TableCell>
                            <p className="font-medium">{u.name}</p>
                            <p className="text-xs text-muted-foreground">
                              @{u.username} · {u.email}
                            </p>
                          </TableCell>
                          <TableCell className="tabular">{u.identifier ?? '—'}</TableCell>
                          <TableCell>
                            <Badge variant={ROLE_BADGE[u.roleId]}>{ROLE_LABELS[u.roleId]}</Badge>
                          </TableCell>
                          <TableCell>{u.departmentName}</TableCell>
                          <TableCell>
                            <StatusBadge status={u.status} />
                            {u.mustChangePassword && (
                              <Badge variant="outline" className="ml-1.5 font-normal" title="Must change password at next sign-in">
                                <KeyRound aria-hidden="true" /> Temp password
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-muted-foreground" title={u.lastLoginAt ? formatDateTime(u.lastLoginAt) : undefined}>
                            {u.lastLoginAt ? timeAgo(u.lastLoginAt) : 'Never'}
                          </TableCell>
                          <TableCell className="w-10 text-right">
                            <UserRowActions
                              user={u}
                              onView={() => navigate(`/admin/users/${u.id}`)}
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
              {data.total > 0 && (
                <Pagination
                  page={data.page}
                  pageSize={data.pageSize}
                  total={data.total}
                  onPageChange={setPage}
                  onPageSizeChange={(s) => {
                    setPageSize(s)
                    setPage(1)
                  }}
                />
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="roles">
          <RolesPanel />
        </TabsContent>
      </Tabs>

      <UserFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        userId={editingId}
        defaultRole={role || undefined}
        onCreated={(res) => setCreated({ name: res.user.name, username: res.username, password: res.temporaryPassword })}
      />
      <UserActionDialogs action={action} onClose={() => setAction(null)} />
      <TempPasswordDialog result={created} onClose={() => setCreated(null)} />
    </>
  )
}
