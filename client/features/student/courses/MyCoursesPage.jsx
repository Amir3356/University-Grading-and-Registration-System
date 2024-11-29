import { useCallback, useEffect, useMemo, useState } from 'react'
import { BookOpen } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DataTable } from '@/components/common/DataTable'
import { FilterSelect } from '@/components/common/FilterSelect'
import { PageHeader } from '@/components/common/PageHeader'
import { ProgramTypeBadge, StatusBadge } from '@/components/common/StatusBadge'
import { useAuth } from '@/context/auth-context'
import { getProfileApi } from '@/api/auth'
import { useQuery } from '@/hooks/useStore'
import { formatAcademicYear, formatSemesterTerm, getStudentCurrentYearOfStudy } from '@/lib/format'
import { onUserChange } from '@/lib/syncEvents'
import { setStoredSession } from '@/lib/storage'
import { useWebSocketEvent } from '@/lib/websocket'
import { store } from '@/store'

export function MyCoursesPage() {
  const { user, profile } = useAuth()
  const { data: me, refetch: refetchMe } = useQuery(getProfileApi, [], { live: false, enabled: Boolean(user) })

  const [academicYearChoice, setAcademicYearChoice] = useState('all')
  const [semesterChoice, setSemesterChoice] = useState('all')
  const [studentOverride, setStudentOverride] = useState(null)

  const { data, loading, error, refetch } = useQuery(
    () => store.student.listMyCourses(),
    [],
  )

  const handleStudentUpdated = useCallback(
    (payload) => {
      if (!payload) return
      // Check if this update affects the currently signed-in student
      const isTarget =
        !payload.userId ||
        payload.userId === user?.id ||
        (profile?.id && payload.studentId === profile.id)

      if (!isTarget) return

      const newProg =
        payload.programType ||
        payload.profile?.program_type ||
        payload.profile?.programType ||
        payload.user?.programType
      const newYear =
        payload.yearOfStudy ??
        payload.profile?.year_of_study ??
        payload.profile?.yearOfStudy ??
        payload.user?.yearOfStudy

      if (newProg || newYear != null) {
        setStudentOverride((prev) => ({
          programType: newProg ? String(newProg).toLowerCase() : prev?.programType,
          yearOfStudy: newYear != null ? newYear : prev?.yearOfStudy,
        }))
      }

      if (payload.profile || payload.user) {
        const nextProfile = {
          ...(profile || {}),
          ...(payload.profile || {}),
          ...(newProg ? { program_type: newProg, programType: newProg } : {}),
          ...(newYear != null ? { year_of_study: newYear, yearOfStudy: newYear } : {}),
        }
        setStoredSession(null, null, payload.user || user, nextProfile)
      }

      refetch()
      refetchMe?.()
    },
    [user, profile, refetch, refetchMe],
  )

  // Real-time server push via WebSocket: instantly update when Department Head modifies student
  useWebSocketEvent('STUDENT_UPDATED', handleStudentUpdated)
  useWebSocketEvent('USER_UPDATED', handleStudentUpdated)

  // Cross-tab and local event bus (HTML5 BroadcastChannel / Storage events)
  useEffect(() => {
    const unsub = onUserChange(handleStudentUpdated)
    return () => unsub?.()
  }, [handleStudentUpdated])

  const resolveStudentForCourse = useCallback(
    (r) => {
      const year =
        studentOverride?.yearOfStudy ??
        r?.yearOfStudy ??
        r?.student?.yearOfStudy ??
        me?.profile?.year_of_study ??
        me?.profile?.yearOfStudy ??
        profile?.yearOfStudy ??
        profile?.year_of_study ??
        user?.yearOfStudy

      const prog =
        studentOverride?.programType ??
        r?.programType ??
        r?.student?.programType ??
        me?.profile?.program_type ??
        me?.profile?.programType ??
        profile?.programType ??
        profile?.program_type ??
        user?.programType ??
        'regular'

      return {
        ...user,
        ...profile,
        ...me?.profile,
        yearOfStudy: year,
        year_of_study: year,
        programType: prog,
        program_type: prog,
        status:
          r?.student?.academicStatus ??
          r?.student?.status ??
          me?.profile?.academic_status ??
          profile?.academic_status ??
          user?.status,
        academicStatus:
          r?.student?.academicStatus ??
          me?.profile?.academic_status ??
          profile?.academic_status ??
          user?.academicStatus,
      }
    },
    [user, profile, me?.profile, studentOverride],
  )

  // Autoincrements dynamically when the new calendar year arrives (e.g. 2026, 2027 when reached)
  const availableYears = useMemo(() => {
    const currentYear = new Date().getFullYear()
    return [String(currentYear)]
  }, [])

  const academicYearOptions = [
    { value: 'all', label: 'Academic Year' },
    ...availableYears.map((y) => ({ value: y, label: y })),
  ]

  const semesterOptions = [
    { value: 'all', label: 'Semester' },
    { value: 'first', label: 'First Semester' },
    { value: 'second', label: 'Second Semester' },
  ]

  const isFiltered = academicYearChoice !== 'all' || semesterChoice !== 'all'

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
      {isFiltered && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setAcademicYearChoice('all')
            setSemesterChoice('all')
          }}
          className="text-xs text-muted-foreground hover:text-foreground h-9"
        >
          Reset filters
        </Button>
      )}
    </div>
  )

  const filteredData = useMemo(() => {
    const list = Array.isArray(data) ? data : (data?.courses || data?.items || [])
    return list.filter((r) => {
      if (academicYearChoice !== 'all') {
        const ayYear = formatAcademicYear(r.semester || r.offering?.semester)
        const ayName = String(r.semester?.academicYear?.name ?? '')
        const semName = String(r.semester?.name ?? '')
        const start = String(r.semester?.startDate ?? '')
        const end = String(r.semester?.endDate ?? '')
        const matchesYear =
          ayYear === academicYearChoice ||
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

  const columns = useMemo(
    () => [
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
        value: (r) => (r.teacher?.name ? r.teacher.name.replace(/^Dr\.?\s+/i, '').trim() : '') || 'Unassigned',
        cell: (r) => <span>{(r.teacher?.name ? r.teacher.name.replace(/^Dr\.?\s+/i, '').trim() : '') || 'Unassigned'}</span>,
      },
      {
        key: 'currentYear',
        header: 'Current Year',
        value: (r) => getStudentCurrentYearOfStudy(resolveStudentForCourse(r)),
        cell: (r) => (
          <span className="text-foreground font-medium">
            {getStudentCurrentYearOfStudy(resolveStudentForCourse(r))}
          </span>
        ),
      },
      {
        key: 'programType',
        header: 'Program Type',
        value: (r) => resolveStudentForCourse(r).programType,
        cell: (r) => (
          <ProgramTypeBadge programType={resolveStudentForCourse(r).programType} />
        ),
      },
      {
        key: 'academicYear',
        header: 'Academic Year',
        value: (r) => formatAcademicYear(r.semester || r.offering?.semester),
        cell: (r) => (
          <span className="text-muted-foreground">
            {formatAcademicYear(r.semester || r.offering?.semester)}
          </span>
        ),
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
    ],
    [resolveStudentForCourse],
  )

  return (
    <>
      <PageHeader
        title="My Courses"
        description="View your enrolled courses, schedules, teachers, and credit hours."
        centered
      />
      <DataTable
        columns={columns}
        rows={filteredData}
        loading={loading}
        error={error}
        onRetry={refetch}
        rowKey={(r) => r.enrollmentId}
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
