import { useState } from 'react'
import { Users } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { DataTable } from '@/components/common/DataTable'
import { ExportMenu } from '@/components/common/ExportMenu'
import { FilterSelect } from '@/components/common/FilterSelect'
import { PageHeader } from '@/components/common/PageHeader'
import { SearchInput } from '@/components/common/SearchInput'
import { StatusBadge } from '@/components/common/StatusBadge'
import { useLookups } from '@/context/lookups-context'
import { useQuery } from '@/hooks/useStore'
import { useDebounce } from '@/hooks/useDebounce'
import { formatYearOfStudy } from '@/lib/format'
import { store } from '@/store'

function getEnrollmentStatus(status) {
  const s = String(status || '').toLowerCase()
  if (s === 'withdrawn' || s === 'dropped') {
    return { status: 'dropped', label: 'Dropped' }
  }
  if (s === 'pending') {
    return { status: 'pending', label: 'Pending' }
  }
  return { status: 'enrolled', label: 'Enrolled' }
}

const columns = [
  { key: 'studentNumber', header: 'StudentID', sortable: false, cell: (r) => <span className="tabular">{r.studentNumber}</span> },
  {
    key: 'name',
    header: 'Student Name',
    sortable: false,
    cell: (r) => (
      <div>
        <p className="font-semibold">{r.name}</p>
        <p className="text-xs text-muted-foreground">{r.email}</p>
      </div>
    ),
  },
  { key: 'course', header: 'Course', sortable: false, value: (r) => `${r.courseCode} ${r.courseTitle}`, cell: (r) => <span title={r.courseTitle}>{r.courseCode} — {r.courseTitle}</span> },
  {
    key: 'yearOfStudy',
    header: 'Year of Study',
    sortable: false,
    value: (r) => formatYearOfStudy(r.yearOfStudy || r.admissionYear || r.courseLevel),
    cell: (r) => formatYearOfStudy(r.yearOfStudy || r.admissionYear || r.courseLevel),
  },
  {
    key: 'status',
    header: 'Status',
    sortable: false,
    value: (r) => getEnrollmentStatus(r.status).label,
    cell: (r) => {
      const { status, label } = getEnrollmentStatus(r.status)
      return (
        <div className="flex flex-wrap gap-1">
          <StatusBadge status={status} label={label} />
          {r.isRepeat && <Badge variant="warning">Repeat</Badge>}
        </div>
      )
    },
  },
]

const exportColumns = [
  { header: 'StudentID', value: (r) => r.studentNumber },
  { header: 'Student Name', value: (r) => r.name },
  { header: 'Email', value: (r) => r.email },
  { header: 'Department', value: (r) => r.department },
  { header: 'Course', value: (r) => `${r.courseCode} — ${r.courseTitle}` },
  { header: 'Year of Study', value: (r) => formatYearOfStudy(r.yearOfStudy || r.admissionYear || r.courseLevel) },
  { header: 'Semester', value: (r) => r.semesterName },
  { header: 'Status', value: (r) => getEnrollmentStatus(r.status).label },
]

export function StudentsPage() {
  const navigate = useNavigate()
  const lookups = useLookups()
  // null = "not chosen yet" → default to the current semester once lookups load; '' = all semesters.
  const [semesterChoice, setSemesterChoice] = useState(null)
  const [offeringId, setOfferingId] = useState('')
  const [search, setSearch] = useState('')
  const q = useDebounce(search)
  const semesterId = semesterChoice ?? lookups?.currentSemester?.id ?? ''
  const ready = Boolean(lookups)

  const offerings = useQuery(() => store.teacher.listMyOfferings({ semesterId }), [semesterId], { enabled: ready })
  const { data, loading, error, refetch } = useQuery(() => store.teacher.listMyStudents({ semesterId, offeringId, search: q, pageSize: 1000 }), [semesterId, offeringId, q], {
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
      <PageHeader title="Course Students" description="Students enrolled in your courses, with their current standing." />
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
              onChange={setSearch}
              placeholder="Search name, ID or course…"
            />
            <FilterSelect
              label="Semester"
              allLabel="All semesters"
              value={semesterId}
              onChange={(v) => {
                setSemesterChoice(v)
                setOfferingId('')
              }}
              options={(lookups?.semesters ?? []).map((s) => ({ value: s.id, label: s.name }))}
              className="sm:w-52"
            />
            <FilterSelect
              label="Course"
              allLabel="All courses"
              value={offeringId}
              onChange={setOfferingId}
              options={(offerings.data ?? []).map((o) => ({ value: o.id, label: `${o.course.code} (${o.section})${semesterId ? '' : ` · ${o.semester.name}`}` }))}
              className="sm:w-56"
            />
            <div className="sm:ml-auto">
              <ExportMenu
                filename="course_students"
                title="Course Students"
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
    </>
  )
}
