import { useMemo, useState } from 'react'
import { ClipboardList } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { DataTable } from '@/components/common/DataTable'
import { FilterSelect } from '@/components/common/FilterSelect'
import { PageHeader } from '@/components/common/PageHeader'
import { useLookups } from '@/context/lookups-context'
import { useQuery } from '@/hooks/useStore'
import { formatDate, formatPercent } from '@/lib/format'
import { store } from '@/store'
import { todayIso, typeLabel } from '../components/policy'

const STATUS_OPTIONS = [
  { value: 'released', label: 'Released' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'pending', label: 'Awaiting marks' },
]

const STATUS_BADGE = {
  released: ['success', 'Released'],
  upcoming: ['info', 'Upcoming'],
  pending: ['warning', 'Awaiting marks'],
}

function statusOf(a, today) {
  if (a.isReleased) return 'released'
  return a.dueDate >= today ? 'upcoming' : 'pending'
}

export function MyAssessmentsPage() {
  const navigate = useNavigate()
  const lookups = useLookups()
  const [semesterChoice, setSemesterChoice] = useState(null)
  const [course, setCourse] = useState('')
  const [status, setStatus] = useState('')
  const semesterId = semesterChoice ?? lookups?.currentSemester?.id ?? ''
  const { data, loading, error, refetch } = useQuery(() => store.student.listMyAssessments({ semesterId }), [semesterId], { enabled: Boolean(semesterId) })

  const today = todayIso()
  const rows = useMemo(() => (data ?? []).map((a) => ({ ...a, status: statusOf(a, today) })), [data, today])
  const courseOptions = useMemo(() => {
    const map = new Map(rows.map((r) => [r.courseCode, r.courseTitle]))
    return [...map].sort((a, b) => a[0].localeCompare(b[0])).map(([code, title]) => ({ value: code, label: `${code} · ${title}` }))
  }, [rows])
  const filtered = rows.filter((r) => (!course || r.courseCode === course) && (!status || r.status === status))

  const semesterOptions = (lookups?.semesters ?? []).map((s) => ({ value: s.id, label: `${s.name}${s.isCurrent ? ' (current)' : ''}` }))
  const semesterName = lookups?.semesters.find((s) => s.id === semesterId)?.name ?? ''

  const columns = [
    {
      key: 'courseCode',
      header: 'Course',
      cell: (r) => (
        <div>
          <p className="font-medium">{r.courseCode}</p>
          <p className="max-w-48 truncate text-xs text-muted-foreground">{r.courseTitle}</p>
        </div>
      ),
    },
    { key: 'name', header: 'Assessment', className: 'font-medium' },
    { key: 'type', header: 'Type', value: (r) => typeLabel(r.type) },
    {
      key: 'dueDate',
      header: 'Due date',
      value: (r) => r.dueDate,
      cell: (r) => (
        <span className="inline-flex items-center gap-2">
          {formatDate(r.dueDate)}
          {r.status === 'upcoming' && <Badge variant="info">Upcoming</Badge>}
        </span>
      ),
    },
    { key: 'weight', header: 'Weight', align: 'right', value: (r) => r.weight, cell: (r) => `${r.weight}%` },
    {
      key: 'marks',
      header: 'Marks',
      align: 'right',
      value: (r) => (r.marks != null ? `${r.marks}/${r.maxMarks}` : r.isReleased ? 'No mark' : 'Not released'),
      cell: (r) =>
        r.marks != null ? (
          <span className="font-medium">
            {r.marks}/{r.maxMarks}
          </span>
        ) : (
          <span className="text-muted-foreground">{r.isReleased ? 'No mark' : `— / ${r.maxMarks}`}</span>
        ),
    },
    { key: 'percent', header: 'Percent', align: 'right', value: (r) => r.percent, cell: (r) => formatPercent(r.percent) },
    {
      key: 'status',
      header: 'Status',
      value: (r) => STATUS_BADGE[r.status][1],
      cell: (r) => <Badge variant={STATUS_BADGE[r.status][0]}>{STATUS_BADGE[r.status][1]}</Badge>,
    },
  ]

  return (
    <>
      <PageHeader title="My assessments" description="Assignments, quizzes and exams across your courses, with released marks." />
      <DataTable
        columns={columns}
        rows={data ? filtered : undefined}
        loading={loading || !data}
        error={error}
        onRetry={refetch}
        initialSort={{ key: 'dueDate', dir: 'asc' }}
        onRowClick={(r) => navigate(`/student/courses/${r.enrollmentId}`)}
        exportName={`assessments_${semesterName}`}
        exportTitle={`My assessments — ${semesterName}`}
        university={lookups?.university}
        searchPlaceholder="Search assessments…"
        emptyIcon={ClipboardList}
        emptyTitle={course || status ? 'No assessments match these filters' : 'No assessments this semester'}
        emptyDescription={course || status ? 'Clear the course or status filter to see more.' : 'Assessments appear here once your teachers set them up.'}
        toolbar={
          <>
            <FilterSelect
              value={semesterId}
              onChange={(v) => {
                setSemesterChoice(v)
                setCourse('')
              }}
              options={semesterOptions}
              includeAll={false}
              label="Semester"
              placeholder="Semester"
              className="sm:w-56"
            />
            <FilterSelect value={course} onChange={setCourse} options={courseOptions} allLabel="All courses" label="Course" className="sm:w-56" />
            <FilterSelect value={status} onChange={setStatus} options={STATUS_OPTIONS} allLabel="All statuses" label="Status" />
          </>
        }
      />
    </>
  )
}
