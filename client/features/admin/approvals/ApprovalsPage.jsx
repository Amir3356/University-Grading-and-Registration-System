import { useState } from 'react'
import { BarChart3, ClipboardCheck, Globe } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { EmptyState } from '@/components/common/EmptyState'
import { ErrorState } from '@/components/common/ErrorState'
import { FilterSelect } from '@/components/common/FilterSelect'
import { TableSkeleton } from '@/components/common/Loading'
import { PageHeader } from '@/components/common/PageHeader'
import { SearchInput } from '@/components/common/SearchInput'
import { GradeStatusBadge, StatusBadge } from '@/components/common/StatusBadge'
import { useLookups } from '@/context/lookups-context'
import { useQuery, useMutation } from '@/hooks/useStore'
import { useDebounce } from '@/hooks/useDebounce'
import { formatDateTime } from '@/lib/format'
import { store } from '@/store'

export function ApprovalsPage() {
  const navigate = useNavigate()
  const lookups = useLookups()
  const [status, setStatus] = useState('pending')
  const [semesterId, setSemesterId] = useState('')
  const [search, setSearch] = useState('')
  const q = useDebounce(search, 300)

  const { data, loading, error, refetch } = useQuery(
    () => store.grades.listApprovalRequests({ status: status === 'all' ? undefined : status, semesterId: semesterId || undefined, search: q, pageSize: 1000 }),
    [status, semesterId, q],
  )

  const semesterOptions = (lookups?.semesters ?? []).map((s) => ({ value: s.id, label: s.name }))

  return (
    <>
      <PageHeader
        title="Grade approvals"
        description="Review final grades submitted by teachers, then approve, return or publish them."
        actions={
          <Button variant="outline" asChild>
            <Link to="/admin/reports?tab=missing">
              <BarChart3 /> Submitted grades overview
            </Link>
          </Button>
        }
      />

      <AwaitingPublication />

      <Tabs
        value={status}
        onValueChange={setStatus}
        className="mb-4"
      >
        <TabsList>
          <TabsTrigger value="pending">Pending{data?.pendingCount ? ` (${data.pendingCount})` : ''}</TabsTrigger>
          <TabsTrigger value="approved">Approved</TabsTrigger>
          <TabsTrigger value="rejected">Rejected</TabsTrigger>
          <TabsTrigger value="all">All</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search course or teacher…"
        />
        <FilterSelect
          value={semesterId}
          onChange={setSemesterId}
          options={semesterOptions}
          allLabel="All semesters"
          label="Semester"
          className="sm:w-56"
        />
      </div>

      {loading && !data ? (
        <TableSkeleton cols={6} />
      ) : error ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : !data.items.length ? (
        <Card>
          <EmptyState
            icon={ClipboardCheck}
            title={status === 'pending' ? 'No submissions awaiting approval' : 'No approval requests found'}
            description={q || semesterId ? 'Try clearing the search or semester filter.' : 'Grade submissions from teachers will appear here.'}
          />
        </Card>
      ) : (
        <>
          <div className="overflow-hidden rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Course</TableHead>
                  <TableHead>Semester</TableHead>
                  <TableHead>Teacher</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead className="text-right">Students</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Reviewer</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((r) => (
                  <TableRow
                    key={r.id}
                    tabIndex={0}
                    className="cursor-pointer focus-visible:bg-muted focus-visible:outline-none"
                    onClick={() => navigate(`/admin/grade-approvals/${r.id}`)}
                    onKeyDown={(e) => e.key === 'Enter' && navigate(`/admin/grade-approvals/${r.id}`)}
                  >
                    <TableCell>
                      <div className="font-medium">{r.offering.course.code}</div>
                      <div className="max-w-56 truncate text-xs text-muted-foreground">{r.offering.course.title}</div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{r.offering.semester?.name}</TableCell>
                    <TableCell className="whitespace-nowrap">{r.submitterName}</TableCell>
                    <TableCell className="whitespace-nowrap">{formatDateTime(r.submittedAt)}</TableCell>
                    <TableCell className="text-right tabular">{r.studentCount}</TableCell>
                    <TableCell>
                      <StatusBadge status={r.status} />
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {r.reviewerName ?? <span className="text-muted-foreground">—</span>}
                      {r.reviewedAt && <div className="text-xs text-muted-foreground">{formatDateTime(r.reviewedAt)}</div>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </>
  )
}

function AwaitingPublication() {
  const [target, setTarget] = useState(null)
  const { data, loading, error, refetch } = useQuery(() => store.academics.listOfferings({ gradeStatus: 'approved', pageSize: 100 }), [])
  const [publish] = useMutation((id) => store.grades.publishGrades(id), { success: 'Grades published to students.' })

  if (loading && !data) return <TableSkeleton rows={2} cols={4} />
  if (error) return <div className="mb-6"><ErrorState error={error} onRetry={refetch} title="Could not load approved offerings" /></div>
  if (!data.items.length) return null

  return (
    <Card className="mb-6">
      <CardHeader>
        <div>
          <CardTitle>Approved — awaiting publication</CardTitle>
          <CardDescription className="mt-1">These grades are approved but not yet visible to students.</CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <ul className="divide-y rounded-lg border">
          {data.items.map((o) => (
            <li key={o.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="font-medium">
                  {o.course.code} · {o.course.title}
                </p>
                <p className="text-sm text-muted-foreground">
                  {o.semester?.name} · {o.teacher?.name ?? 'Unassigned'} · {o.enrolledCount} students
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <GradeStatusBadge status={o.gradeStatus} />
                <Button variant="outline" size="sm" asChild>
                  <Link to={`/admin/reports/grade-sheet/${o.id}`}>Grade sheet</Link>
                </Button>
                <Button size="sm" variant="teal" onClick={() => setTarget(o)}>
                  <Globe /> Publish
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
      <ConfirmDialog
        open={Boolean(target)}
        onOpenChange={(v) => !v && setTarget(null)}
        title={`Publish grades for ${target?.course.code ?? ''}?`}
        description="Final grades become visible to all enrolled students, who will be notified. Published grades count toward GPA and can no longer be modified."
        confirmLabel="Publish grades"
        onConfirm={async () => (await publish(target.id)).ok}
      />
    </Card>
  )
}
