import { useMemo, useState } from 'react'
import { ClipboardList } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { DataTable } from '@/components/common/DataTable'
import { FilterSelect } from '@/components/common/FilterSelect'
import { PageHeader } from '@/components/common/PageHeader'
import { useQuery } from '@/hooks/useStore'
import { store } from '@/store'
import { todayIso, typeLabel } from '../components/policy'

function getAssessmentStatus(a, today) {
  if (a.marks != null) {
    return 'graded'
  }
  if (a.dueDate && a.dueDate >= today) {
    return 'upcoming'
  }
  return 'pending'
}

export function MyAssessmentsPage() {
  const navigate = useNavigate()
  const [statusFilter, setStatusFilter] = useState('all')
  const [courseFilter, setCourseFilter] = useState('all')

  const { data, loading, error, refetch } = useQuery(
    () => store.student.listMyAssessments(),
    [],
  )

  const today = todayIso()

  const rows = useMemo(() => {
    return (data ?? []).map((a) => ({
      ...a,
      status: getAssessmentStatus(a, today),
    }))
  }, [data, today])

  const courseOptions = useMemo(() => {
    const map = new Map()
    for (const r of rows) {
      if (r.courseCode) {
        map.set(r.courseCode, `${r.courseCode} — ${r.courseTitle || ''}`)
      }
    }
    return [
      { value: 'all', label: 'All courses' },
      ...Array.from(map.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([value, label]) => ({ value, label })),
    ]
  }, [rows])

  const statusOptions = [
    { value: 'all', label: 'All statuses' },
    { value: 'upcoming', label: 'upcoming' },
    { value: 'pending', label: 'pending' },
    { value: 'graded', label: 'graded' },
  ]

  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      if (statusFilter !== 'all' && r.status !== statusFilter) {
        return false
      }
      if (courseFilter !== 'all' && r.courseCode !== courseFilter) {
        return false
      }
      return true
    })
  }, [rows, statusFilter, courseFilter])

  const toolbar = (
    <div
      className="cluster"
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: '0.75rem',
      }}
    >
      <div style={{ width: '12rem', minWidth: '9.5rem' }}>
        <FilterSelect
          value={statusFilter}
          onChange={setStatusFilter}
          options={statusOptions}
          placeholder="All statuses"
        />
      </div>
      {courseOptions.length > 1 && (
        <div style={{ width: '13rem', minWidth: '10rem' }}>
          <FilterSelect
            value={courseFilter}
            onChange={setCourseFilter}
            options={courseOptions}
            placeholder="All courses"
          />
        </div>
      )}
    </div>
  )

  const columns = [
    {
      key: 'courseCode',
      header: 'Course Code',
      value: (r) => r.courseCode ?? '',
      cell: (r) => (
        <div>
          <span className="font-semibold text-foreground">{r.courseCode}</span>
          {r.courseTitle && (
            <p className="truncate text-xs text-muted-foreground">{r.courseTitle}</p>
          )}
        </div>
      ),
    },
    {
      key: 'assessmentType',
      header: 'Assessment Type',
      value: (r) => typeLabel(r.type) || r.name || '—',
      cell: (r) => (
        <div>
          <p className="font-medium text-foreground">{r.name}</p>
          <p className="text-xs text-muted-foreground">{typeLabel(r.type)}</p>
        </div>
      ),
    },
    {
      key: 'totalMark',
      header: 'Total mark',
      value: (r) => r.maxMarks ?? 0,
      cell: (r) => <span>{r.maxMarks ?? '—'}</span>,
      align: 'center',
    },
    {
      key: 'markObtained',
      header: 'Mark Obtained',
      value: (r) => (r.marks != null ? r.marks : -1),
      cell: (r) => (
        <span className={r.marks != null ? 'font-semibold text-foreground' : 'text-muted-foreground'}>
          {r.marks != null ? r.marks : '—'}
        </span>
      ),
      align: 'center',
    },
    {
      key: 'status',
      header: 'Status',
      value: (r) => r.status,
      cell: (r) => {
        const config = {
          graded: 'success',
          pending: 'warning',
          upcoming: 'secondary',
        }[r.status] ?? 'outline'

        return <Badge variant={config}>{r.status}</Badge>
      },
    },
  ]

  return (
    <>
      <PageHeader
        title="My Assessments"
        description="View assignments, quizzes, midterms, and exams"
        centered
      />
      <DataTable
        columns={columns}
        rows={filteredRows}
        loading={loading}
        error={error}
        onRetry={refetch}
        rowKey={(r) => r.id}
        onRowClick={(r) => navigate(`/student/courses/${r.enrollmentId}`)}
        searchPlaceholder="Search course code, assessment type, or name…"
        toolbar={toolbar}
        emptyIcon={ClipboardList}
        emptyTitle="No assessments found"
        emptyDescription="Assessments appear here once your teachers publish and schedule them."
      />
    </>
  )
}

export default MyAssessmentsPage
