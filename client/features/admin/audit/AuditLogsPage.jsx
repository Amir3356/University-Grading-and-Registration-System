import { useState } from 'react'
import { Eye, ScrollText, X } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { EmptyState } from '@/components/common/EmptyState'
import { ErrorState } from '@/components/common/ErrorState'
import { ExportMenu } from '@/components/common/ExportMenu'
import { FilterSelect } from '@/components/common/FilterSelect'
import { FormField } from '@/components/common/FormField'
import { TableSkeleton } from '@/components/common/Loading'
import { PageHeader } from '@/components/common/PageHeader'
import { Pagination } from '@/components/common/Pagination'
import { SearchInput } from '@/components/common/SearchInput'
import { useLookups } from '@/context/lookups-context'
import { useQuery } from '@/hooks/useStore'
import { useDebounce } from '@/hooks/useDebounce'
import { formatDateTime, ROLE_LABELS } from '@/lib/format'
import { cn } from '@/lib/utils'
import { store } from '@/store'

const CATEGORY_LABELS = {
  academic_year: 'Academic years',
  announcement: 'Announcements',
  approval: 'Approvals',
  assessment: 'Assessments',
  auth: 'Sign-in',
  course: 'Courses',
  department: 'Departments',
  enrollment: 'Enrollment',
  grade: 'Grades',
  grades: 'Grades',
  offering: 'Offerings',
  policy: 'Grading policy',
  semester: 'Semesters',
  settings: 'Settings',
  transcript: 'Transcripts',
  user: 'Users',
}
const categoryLabel = (c) => CATEGORY_LABELS[c] ?? c.replace(/_/g, ' ').replace(/^\w/, (x) => x.toUpperCase())

const EXPORT_COLUMNS = [
  { header: 'Time', value: (l) => formatDateTime(l.createdAt) },
  { header: 'User', value: (l) => l.userName },
  { header: 'Role', value: (l) => ROLE_LABELS[l.userRole] ?? '' },
  { header: 'Action', value: (l) => l.action },
  { header: 'Details', value: (l) => l.details },
  { header: 'Reason', value: (l) => l.reason ?? '' },
  { header: 'Entity', value: (l) => `${l.entityType}:${l.entityId}` },
  { header: 'IP address', value: (l) => l.ipAddress },
]

const fmt = (v) => (v === undefined ? '—' : typeof v === 'object' && v !== null ? JSON.stringify(v) : String(v))

function ChangeDiff({ before, after }) {
  const keys = [...new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})])]
  if (!keys.length) return <p className="text-sm text-muted-foreground">No before/after values were recorded for this action.</p>
  return (
    <div className="overflow-hidden rounded-md border">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>Field</TableHead>
            <TableHead>Before</TableHead>
            <TableHead>After</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {keys.map((k) => {
            const b = before?.[k]
            const a = after?.[k]
            const changed = JSON.stringify(b) !== JSON.stringify(a)
            return (
              <TableRow key={k} className={cn(changed && 'bg-warning/10 hover:bg-warning/15')}>
                <TableCell className="font-mono text-xs">
                  {k}
                  {changed && <span className="sr-only"> (changed)</span>}
                </TableCell>
                <TableCell className="max-w-56 font-mono text-xs break-all whitespace-normal text-muted-foreground">{fmt(b)}</TableCell>
                <TableCell className={cn('max-w-56 font-mono text-xs break-all whitespace-normal', changed && 'font-semibold')}>{fmt(a)}</TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}

function LogDetailDialog({ log, onClose }) {
  return (
    <Dialog open={Boolean(log)} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Audit entry</DialogTitle>
          <DialogDescription>{log?.details}</DialogDescription>
        </DialogHeader>
        {log && (
          <div className="flex flex-col gap-4">
            <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-xs text-muted-foreground">Time</dt>
                <dd className="font-medium">{formatDateTime(log.createdAt)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">User</dt>
                <dd className="font-medium">
                  {log.userName}
                  {log.userRole && <span className="ml-1 text-xs font-normal text-muted-foreground">({ROLE_LABELS[log.userRole]})</span>}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Action</dt>
                <dd className="font-mono text-xs font-medium">{log.action}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Entity</dt>
                <dd className="font-mono text-xs break-all">
                  {log.entityType} · {log.entityId}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">IP address</dt>
                <dd className="font-mono text-xs">{log.ipAddress ?? '—'}</dd>
              </div>
              <div className="col-span-2 sm:col-span-3">
                <dt className="text-xs text-muted-foreground">Reason</dt>
                <dd>{log.reason || '—'}</dd>
              </div>
            </dl>
            <div>
              <p className="mb-2 text-sm font-medium">Changes</p>
              <ChangeDiff before={log.before} after={log.after} />
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

export function AuditLogsPage() {
  const lookups = useLookups()
  const [params] = useSearchParams()
  const [search, setSearch] = useState(params.get('search') ?? '')
  const [action, setAction] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [viewing, setViewing] = useState(null)
  const debounced = useDebounce(search, 300)

  const query = { search: debounced, action, from, to }
  const { data, loading, error, refetch } = useQuery(() => store.reports.listAuditLogs({ ...query, page, pageSize }), [debounced, action, from, to, page, pageSize])
  const { data: actions } = useQuery(() => store.reports.listAuditActions(), [])

  const change = (setter) => (v) => {
    setter(v)
    setPage(1)
  }
  const fetchAll = async () => {
    const first = await store.reports.listAuditLogs({ ...query, page: 1, pageSize: 100 })
    let items = first.items
    for (let p = 2; p <= first.pageCount; p++) items = items.concat((await store.reports.listAuditLogs({ ...query, page: p, pageSize: 100 })).items)
    return items
  }
  const hasFilters = Boolean(debounced || action || from || to)
  const rangeInvalid = from && to && from > to

  return (
    <>
      <PageHeader title="Audit Logs" description="A tamper-evident trail of sign-ins, account changes, grade decisions and configuration updates." />

      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
        <SearchInput value={search} onChange={change(setSearch)} placeholder="Search user, details or reason…" />
        <FilterSelect
          value={action}
          onChange={change(setAction)}
          options={(actions ?? []).map((a) => ({ value: a, label: categoryLabel(a) }))}
          allLabel="All actions"
          label="Filter by action category"
        />
        <FormField label="From" className="gap-1 sm:w-40" error={rangeInvalid ? 'Must be before “To”.' : undefined}>
          <Input type="date" value={from} max={to || undefined} onChange={(e) => change(setFrom)(e.target.value)} />
        </FormField>
        <FormField label="To" className="gap-1 sm:w-40">
          <Input type="date" value={to} min={from || undefined} onChange={(e) => change(setTo)(e.target.value)} />
        </FormField>
        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearch('')
              setAction('')
              setFrom('')
              setTo('')
              setPage(1)
            }}
          >
            <X /> Clear
          </Button>
        )}
        <div className="sm:ml-auto">
          <ExportMenu filename="audit_logs" title="Audit logs" subtitle={from || to ? `Period: ${from || '…'} to ${to || '…'}` : undefined} columns={EXPORT_COLUMNS} rows={fetchAll} university={lookups?.university} disabled={!data?.total} />
        </div>
      </div>

      {loading && !data ? (
        <TableSkeleton cols={5} />
      ) : error ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : (
        <>
          <div className="overflow-hidden rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Time</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Details</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>
                    <span className="sr-only">View</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!data.items.length ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={6} className="whitespace-normal">
                      <EmptyState compact icon={ScrollText} title={hasFilters ? 'No entries match these filters' : 'No audit entries yet'} description={hasFilters ? 'Try widening the date range or clearing the filters.' : undefined} />
                    </TableCell>
                  </TableRow>
                ) : (
                  data.items.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell className="tabular text-muted-foreground">{formatDateTime(l.createdAt)}</TableCell>
                      <TableCell>
                        <p className="font-medium">{l.userName}</p>
                        {l.userRole && <p className="text-xs text-muted-foreground">{ROLE_LABELS[l.userRole]}</p>}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-mono font-normal">
                          {l.action}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-sm min-w-56 whitespace-normal">{l.details}</TableCell>
                      <TableCell className="max-w-56 min-w-32 whitespace-normal text-muted-foreground">{l.reason || '—'}</TableCell>
                      <TableCell className="w-10 text-right">
                        <Button variant="ghost" size="icon-sm" onClick={() => setViewing(l)} aria-label="View entry details" title={l.before || l.after ? 'View changes' : 'View details'}>
                          <Eye />
                        </Button>
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
              pageSizes={[20, 50, 100]}
              onPageSizeChange={(s) => {
                setPageSize(s)
                setPage(1)
              }}
            />
          )}
        </>
      )}

      <LogDetailDialog log={viewing} onClose={() => setViewing(null)} />
    </>
  )
}
