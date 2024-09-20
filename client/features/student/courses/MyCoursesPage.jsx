import { useMemo, useState } from 'react'
import { BookOpen } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { DataTable } from '@/components/common/DataTable'
import { FilterSelect } from '@/components/common/FilterSelect'
import { PageHeader } from '@/components/common/PageHeader'
import { StatusBadge } from '@/components/common/StatusBadge'
import { useLookups } from '@/context/lookups-context'
import { useQuery } from '@/hooks/useStore'
import { formatSemesterTerm } from '@/lib/format'
import { store } from '@/store'

export function MyCoursesPage() {
  const navigate = useNavigate()
  const lookups = useLookups()
  const [academicYearChoice, setAcademicYearChoice] = useState('all')
  const [semesterChoice, setSemesterChoice] = useState('all')

  const { data, loading, error, refetch } = useQuery(
    () => store.student.listMyCourses(),
    [],
  )

  const availableYears = useMemo(() => {
    const set = new Set()
    for (const ay of lookups?.academicYears ?? []) {
      const parts = String(ay.name || '').split('/')
      for (const p of parts) {
        const trimmed = p.trim()
        if (/^\d{4}$/.test(trimmed)) set.add(trimmed)
      }
    }
    if (set.size === 0) {
      ;['2027', '2026', '2025', '2024'].forEach((y) => set.add(y))
    }
    return Array.from(set).sort((a, b) => b.localeCompare(a))
  }, [lookups?.academicYears])

  const academicYearOptions = [
    { value: 'all', label: 'Academic Year' },
    ...availableYears.map((y) => ({ value: y, label: y })),
  ]

  const semesterOptions = [
    { value: 'all', label: 'Semester' },
    { value: 'first', label: 'First Semester' },
    { value: 'second', label: 'Second Semester' },
  ]

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
      <div style={{ width: '12.5rem', minWidth: '10rem' }}>
        <FilterSelect
          value={academicYearChoice}
          onChange={setAcademicYearChoice}
          options={academicYearOptions}
          placeholder="Academic Year"
          includeAll={false}
        />
      </div>
      <div style={{ width: '12.5rem', minWidth: '10rem' }}>
        <FilterSelect
          value={semesterChoice}
          onChange={setSemesterChoice}
          options={semesterOptions}
          placeholder="Semester"
          includeAll={false}
        />
      </div>
    </div>
  )

  const filteredData = useMemo(() => {
    return (data ?? []).filter((r) => {
      if (academicYearChoice !== 'all') {
        const ayName = String(r.semester?.academicYear?.name ?? '')
        const semName = String(r.semester?.name ?? '')
        const start = String(r.semester?.startDate ?? '')
        const end = String(r.semester?.endDate ?? '')
        const matchesYear =
          ayName.includes(academicYearChoice) ||
          semName.includes(academicYearChoice) ||
          start.startsWith(academicYearChoice) ||
          end.startsWith(academicYearChoice)
        if (!matchesYear) return false
      }

      if (semesterChoice !== 'all') {
        const term = String(r.semester?.term ?? '').toLowerCase()
        const semName = String(r.semester?.name ?? '').toLowerCase()
        const formatted = formatSemesterTerm(r.semester?.term).toLowerCase()
        if (semesterChoice === 'first') {
          const isFirst =
            term.includes('fall') ||
            term === '1' ||
            term.includes('first') ||
            semName.includes('fall') ||
            semName.includes('first') ||
            formatted.includes('first')
          if (!isFirst) return false
        } else if (semesterChoice === 'second') {
          const isSecond =
            term.includes('spring') ||
            term === '2' ||
            term.includes('second') ||
            semName.includes('spring') ||
            semName.includes('second') ||
            formatted.includes('second')
          if (!isSecond) return false
        }
      }

      return true
    })
  }, [data, academicYearChoice, semesterChoice])

  const columns = [
    {
      key: 'courseCode',
      header: 'Course Code',
      value: (r) => r.course?.code ?? '',
      cell: (r) => <span className="font-semibold text-foreground">{r.course?.code}</span>,
    },
    {
      key: 'courseName',
      header: 'Course Name',
      value: (r) => r.course?.title ?? '',
      cell: (r) => <span className="font-medium text-foreground">{r.course?.title}</span>,
    },
    {
      key: 'creditHours',
      header: 'Credit Hours',
      value: (r) => r.course?.creditHours ?? '',
      cell: (r) => <span>{r.course?.creditHours ?? '—'}</span>,
      align: 'center',
    },
    {
      key: 'teacherName',
      header: 'Teacher Name',
      value: (r) => r.teacher?.name ?? 'Unassigned',
      cell: (r) => <span>{r.teacher?.name ?? 'Unassigned'}</span>,
    },
    {
      key: 'academicYear',
      header: 'Academic Year',
      value: (r) => r.semester?.academicYear?.name ?? '—',
      cell: (r) => <span className="text-muted-foreground">{r.semester?.academicYear?.name ?? '—'}</span>,
    },
    {
      key: 'semester',
      header: 'Semester',
      value: (r) => formatSemesterTerm(r.semester?.term) || r.semester?.name || '—',
      cell: (r) => (
        <span className="text-muted-foreground">
          {formatSemesterTerm(r.semester?.term) || r.semester?.name || '—'}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      value: (r) => r.status ?? '',
      cell: (r) => <StatusBadge status={r.status} />,
    },
    {
      key: 'action',
      header: 'Action',
      sortable: false,
      searchable: false,
      align: 'right',
      cell: (r) => (
        <div onClick={(e) => e.stopPropagation()}>
          <Button variant="outline" size="sm" asChild>
            <Link to={`/student/courses/${r.enrollmentId}`}>View</Link>
          </Button>
        </div>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        title="My Courses"
        description="View your enrolled courses, schedules, teachers, and credit hours."
      />
      <DataTable
        columns={columns}
        rows={filteredData}
        loading={loading}
        error={error}
        onRetry={refetch}
        rowKey={(r) => r.enrollmentId}
        onRowClick={(r) => navigate(`/student/courses/${r.enrollmentId}`)}
        searchPlaceholder="Search course code, name, or teacher…"
        toolbar={toolbar}
        emptyIcon={BookOpen}
        emptyTitle="No courses found"
        emptyDescription="You are not enrolled in any courses for this selection."
      />
    </>
  )
}

export default MyCoursesPage
