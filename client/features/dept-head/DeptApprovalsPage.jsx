import { useState } from 'react'
import { ClipboardCheck, Globe } from 'lucide-react'
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
import { Pagination } from '@/components/common/Pagination'
import { SearchInput } from '@/components/common/SearchInput'
import { GradeStatusBadge, StatusBadge } from '@/components/common/StatusBadge'
import { useLookups } from '@/context/lookups-context'
import { useQuery, useMutation } from '@/hooks/useStore'
import { useDebounce } from '@/hooks/useDebounce'
import { formatDateTime } from '@/lib/format'
import { store } from '@/store'

export function DeptApprovalsPage() {
  const navigate = useNavigate()
  const lookups = useLookups()
  const [status, setStatus] = useState('pending')
  const [semesterId, setSemesterId] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const q = useDebounce(search, 300)

  const { data, loading, error, refetch } = useQuery(
    () => store.grades.listApprovalRequests({ status: status === 'all' ? undefined : status, semesterId: semesterId || undefined, search: q, page, pageSize }),
    [status, semesterId, q, page, pageSize],
  )

  const semesterOptions = (lookups?.semesters ?? []).map((s) => ({ value: s.id, label: s.name }))

  return (
    <>
      <PageHeader
        title="Department Grade Approvals"
        description="Review and verify final grades submitted by faculty members in your department."
      />

      <AwaitingPublication />

      <Tabs
        value={status}
        onValueChange={(v) => {
          setStatus(v)
          setPage(1)
        }}
        className="mb-4"
      >
        <TabsList>
          <TabsTrigger value="pending">Pending{data?.pendingCount ? ` (${data.pendingCount})` : ''}</TabsTrigger>
          <TabsTrigger value="approved">Approved</TabsTrigger>
          <TabsTrigger value="rejected">Returned</TabsTrigger>
          <TabsTrigger value="all">All</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <SearchInput
          value={search}
          onChange={(v) => {
            setSearch(v)
            setPage(1)
          }}
          placeholder="Search course or instructor…"
        />
        <FilterSelect
          value={semesterId}
          onChange={(v) => {
            setSemesterId(v)
            setPage(1)
          }}
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
            title={status === 'pending' ? 'No department submissions awaiting approval' : 'No approval requests found'}
            description={q || semesterId ? 'Try adjusting search query or semester filter.' : 'Final grades submitted by department faculty will appear here.'}
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
                  <TableHead>Instructor</TableHead>
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
                    onClick={() => navigate(`/dept-head/approvals/${r.id}`)}
                    onKeyDown={(e) => e.key === 'Enter' && navigate(`/dept-head/approvals/${r.id}`)}
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
  if (!data?.items?.length) return null

  return (
    <Card className="mb-6">
      <CardHeader>
        <div>
          <CardTitle>Approved — Ready for Publication</CardTitle>
          <CardDescription className="mt-1">Department courses with approved grades ready to be released to students.</CardDescription>
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
                  <Link to={`/admin/reports/grade-sheet/${o.id}`}>Grade Sheet</Link>
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
        description="Final grades become visible to all enrolled students and will be included in student GPA calculations."
        confirmLabel="Publish grades"
        onConfirm={async () => (await publish(target.id)).ok}
      />
    </Card>
  )
}
