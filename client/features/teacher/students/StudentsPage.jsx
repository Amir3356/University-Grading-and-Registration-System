import { useState } from 'react'
import { Users } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { DataTable } from '@/components/common/DataTable'
import { ExportMenu } from '@/components/common/ExportMenu'
import { FilterSelect } from '@/components/common/FilterSelect'
import { PageHeader } from '@/components/common/PageHeader'
import { Pagination } from '@/components/common/Pagination'
import { SearchInput } from '@/components/common/SearchInput'
import { GradeBadge, StatusBadge } from '@/components/common/StatusBadge'
import { useLookups } from '@/context/lookups-context'
import { useQuery } from '@/hooks/useStore'
import { useDebounce } from '@/hooks/useDebounce'
import { formatPercent } from '@/lib/format'
import { store } from '@/store'

const columns = [
  { key: 'studentNumber', header: 'Student ID', sortable: false, cell: (r) => <span className="tabular">{r.studentNumber}</span> },
  {
    key: 'name',
    header: 'Name',
    sortable: false,
    cell: (r) => (
      <div>
        <p className="font-medium">{r.name}</p>
        <p className="text-xs text-muted-foreground">{r.email}</p>
      </div>
    ),
  },
  { key: 'course', header: 'Course', sortable: false, value: (r) => `${r.courseCode} ${r.courseTitle}`, cell: (r) => <span title={r.courseTitle}>{r.courseCode}</span> },
  { key: 'semesterName', header: 'Semester', sortable: false },
  {
    key: 'status',
    header: 'Status',
    sortable: false,
    cell: (r) => (
      <div className="flex flex-wrap gap-1">
        <StatusBadge status={r.status} />
        {r.isRepeat && <Badge variant="warning">Repeat</Badge>}
      </div>
    ),
  },
  { key: 'runningPercent', header: 'Current %', align: 'right', sortable: false, cell: (r) => formatPercent(r.runningPercent) },
  { key: 'letter', header: 'Letter', align: 'center', sortable: false, cell: (r) => <GradeBadge letter={r.status === 'withdrawn' ? 'W' : r.letter} /> },
]

const exportColumns = [
  { header: 'Student ID', value: (r) => r.studentNumber },
  { header: 'Name', value: (r) => r.name },
  { header: 'Email', value: (r) => r.email },
  { header: 'Department', value: (r) => r.department },
  { header: 'Course', value: (r) => r.courseCode },
  { header: 'Semester', value: (r) => r.semesterName },
  { header: 'Status', value: (r) => r.status },
  { header: 'Repeat', value: (r) => (r.isRepeat ? 'Yes' : 'No') },
  { header: 'Current %', value: (r) => r.runningPercent },
  { header: 'Letter', value: (r) => (r.status === 'withdrawn' ? 'W' : r.letter) },
]

export function StudentsPage() {
  const navigate = useNavigate()
  const lookups = useLookups()
  // null = "not chosen yet" → default to the current semester once lookups load; '' = all semesters.
  const [semesterChoice, setSemesterChoice] = useState(null)
  const [offeringId, setOfferingId] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const q = useDebounce(search)
  const semesterId = semesterChoice ?? lookups?.currentSemester?.id ?? ''
  const ready = Boolean(lookups)

  const offerings = useQuery(() => store.teacher.listMyOfferings({ semesterId }), [semesterId], { enabled: ready })
  const { data, loading, error, refetch } = useQuery(() => store.teacher.listMyStudents({ semesterId, offeringId, search: q, page, pageSize }), [semesterId, offeringId, q, page, pageSize], {
    enabled: ready,
  })

  const fetchAll = async () => {
    const all = []
    let p = 1
    let pageCount
    do {
      const res = await store.teacher.listMyStudents({ semesterId, offeringId, search: q, page: p, pageSize: 100 })
      all.push(...res.items)
      pageCount = res.pageCount
      p += 1
    } while (p <= pageCount)
    return all
  }

  const semesterName = lookups?.semesters.find((s) => s.id === semesterId)?.name

  return (
    <>
      <PageHeader title="My students" description="Students enrolled in your courses, with their current standing." />
      <DataTable
        columns={columns}
        rows={ready ? data?.items : undefined}
        loading={loading || !ready}
        error={error}
        onRetry={refetch}
        rowKey={(r) => r.enrollmentId}
        onRowClick={(r) => navigate(`/teacher/courses/${r.offeringId}/students/${r.enrollmentId}`)}
        searchable={false}
        paginate={false}
        emptyIcon={Users}
        emptyTitle={search || offeringId ? 'No students match these filters' : 'No students found'}
        emptyDescription="Try another semester or course."
        toolbar={
          <>
            <SearchInput
              value={search}
              onChange={(v) => {
                setSearch(v)
                setPage(1)
              }}
              placeholder="Search name, ID or course…"
            />
            <FilterSelect
              label="Semester"
              allLabel="All semesters"
              value={semesterId}
              onChange={(v) => {
                setSemesterChoice(v)
                setOfferingId('')
                setPage(1)
              }}
              options={(lookups?.semesters ?? []).map((s) => ({ value: s.id, label: s.name }))}
              className="sm:w-52"
            />
            <FilterSelect
              label="Course"
              allLabel="All courses"
              value={offeringId}
              onChange={(v) => {
                setOfferingId(v)
                setPage(1)
              }}
              options={(offerings.data ?? []).map((o) => ({ value: o.id, label: `${o.course.code} (${o.section})${semesterId ? '' : ` · ${o.semester.name}`}` }))}
              className="sm:w-56"
            />
            <div className="sm:ml-auto">
              <ExportMenu
                filename="my_students"
                title="My students"
                subtitle={semesterName ?? 'All semesters'}
                columns={exportColumns}
                rows={fetchAll}
                university={lookups?.university}
                disabled={!data?.total}
              />
            </div>
          </>
        }
      />
      {data && data.total > 0 && (
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
  )
}
