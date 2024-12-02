import { useCallback, useEffect, useMemo, useState } from 'react'
import { BookOpen, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FilterSelect } from '@/components/common/FilterSelect'
import { PageHeader } from '@/components/common/PageHeader'
import { SearchInput } from '@/components/common/SearchInput'
import { ProgramTypeBadge, StatusBadge } from '@/components/common/StatusBadge'
import { TableSkeleton } from '@/components/common/Loading'
import { EmptyState } from '@/components/common/EmptyState'
import { ErrorState } from '@/components/common/ErrorState'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useAuth } from '@/context/auth-context'
import { getProfileApi } from '@/api/auth'
import { useQuery } from '@/hooks/useStore'
import { useDebounce } from '@/hooks/useDebounce'
import { formatAcademicYear, formatSemesterTerm, getStudentCurrentYearOfStudy } from '@/lib/format'
import { onUserChange } from '@/lib/syncEvents'
import { setStoredSession } from '@/lib/storage'
import { useWebSocketEvent } from '@/lib/websocket'
import { store } from '@/store'

export function MyCoursesPage() {
  const { user, profile } = useAuth()
  const { data: me, refetch: refetchMe } = useQuery(getProfileApi, [], { live: false, enabled: Boolean(user) })

  // 1. Filter and Cursor Pagination States (4 real data rows per page)
  const [cursor, setCursor] = useState(null)
  const [cursorHistory, setCursorHistory] = useState([]) // Stack of previous cursors
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 300)
  const [academicYearChoice, setAcademicYearChoice] = useState('all')
  const [semesterChoice, setSemesterChoice] = useState('all')
  const [studentOverride, setStudentOverride] = useState(null)

  // 2. Server-side Cursor Paginated Query (4 items per page)
  const {
    data: coursesData,
    loading,
    error,
    refetch,
  } = useQuery(
    () =>
      store.student.listMyCoursesPaginated({
        cursor: cursor || undefined,
        limit: 4,
        search: debouncedSearch.trim() || undefined,
        academicYearId: academicYearChoice !== 'all' ? academicYearChoice : undefined,
        semesterId: semesterChoice !== 'all' ? semesterChoice : undefined,
      }),
    [cursor, debouncedSearch, academicYearChoice, semesterChoice]
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

  const isFiltered = academicYearChoice !== 'all' || semesterChoice !== 'all' || search.trim() !== ''

  // 3. Computed Cursor Pagination Values
  const courses = coursesData?.items ?? (Array.isArray(coursesData) ? coursesData : [])
  const total = coursesData?.total ?? courses.length
  const nextCursor = coursesData?.nextCursor ?? null
  const hasMore = Boolean(coursesData?.hasMore ?? nextCursor)
  const hasPrev = cursorHistory.length > 0

  const handlePrevPage = () => {
    if (cursorHistory.length === 0) return
    const prevHistory = [...cursorHistory]
    const prevCursor = prevHistory.pop()
    setCursorHistory(prevHistory)
    setCursor(prevCursor ?? null)
  }

  const handleNextPage = () => {
    if (!hasMore || !nextCursor) return
    setCursorHistory((prev) => [...prev, cursor])
    setCursor(nextCursor)
  }

  const handleSearchChange = (val) => {
    setSearch(val)
    setCursor(null)
    setCursorHistory([])
  }

  const handleAcademicYearChange = (val) => {
    setAcademicYearChoice(val)
    setCursor(null)
    setCursorHistory([])
  }

  const handleSemesterChange = (val) => {
    setSemesterChoice(val)
    setCursor(null)
    setCursorHistory([])
  }

  const handleResetFilters = () => {
    setSearch('')
    setAcademicYearChoice('all')
    setSemesterChoice('all')
    setCursor(null)
    setCursorHistory([])
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Courses"
        description="View your enrolled courses, schedules, teachers, and credit hours."
        centered
      />

      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        {/* Controls Toolbar */}
        <div className="p-4 border-b border-border bg-card/50 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="w-full sm:w-72">
            <SearchInput
              value={search}
              onChange={handleSearchChange}
              placeholder="Search course code, name, or teacher…"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="w-44 sm:w-48">
              <FilterSelect
                value={academicYearChoice}
                onChange={handleAcademicYearChange}
                options={academicYearOptions}
                placeholder="Academic Year"
                includeAll={false}
              />
            </div>

            <div className="w-40 sm:w-44">
              <FilterSelect
                value={semesterChoice}
                onChange={handleSemesterChange}
                options={semesterOptions}
                placeholder="Semester"
                includeAll={false}
              />
            </div>

            {isFiltered && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleResetFilters}
                className="text-xs text-muted-foreground hover:text-foreground h-9"
              >
                Reset filters
              </Button>
            )}
          </div>
        </div>

        {/* Content Section */}
        {loading && courses.length === 0 ? (
          <div className="p-6">
            <TableSkeleton rows={5} columns={9} />
          </div>
        ) : error ? (
          <div className="p-8">
            <ErrorState
              title="Failed to load courses"
              message={error?.message || 'An error occurred while loading your enrolled courses.'}
              onRetry={refetch}
            />
          </div>
        ) : courses.length === 0 ? (
          <div className="p-12">
            <EmptyState
              icon={BookOpen}
              title="No courses found"
              description={
                isFiltered
                  ? 'No courses match the current filters. Try clearing your search or filters.'
                  : 'You are not enrolled in any courses for this selection.'
              }
            />
          </div>
        ) : (
          <div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent border-b border-border bg-muted/40 text-xs">
                    <TableHead className="font-semibold text-foreground py-3">Course Code</TableHead>
                    <TableHead className="font-semibold text-foreground py-3">Course Name</TableHead>
                    <TableHead className="font-semibold text-foreground py-3 text-center">Credit Hours</TableHead>
                    <TableHead className="font-semibold text-foreground py-3">Teacher Name</TableHead>
                    <TableHead className="font-semibold text-foreground py-3">Current Year</TableHead>
                    <TableHead className="font-semibold text-foreground py-3">Program Type</TableHead>
                    <TableHead className="font-semibold text-foreground py-3">Academic Year</TableHead>
                    <TableHead className="font-semibold text-foreground py-3">Semester</TableHead>
                    <TableHead className="font-semibold text-foreground py-3 text-center">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {courses.map((r) => {
                    const studentData = resolveStudentForCourse(r)
                    return (
                      <TableRow key={r.enrollmentId} className="hover:bg-muted/30 transition-colors">
                        <TableCell className="py-3 font-semibold text-foreground">
                          {r.course?.code ?? '—'}
                        </TableCell>
                        <TableCell className="py-3 font-medium text-foreground">
                          {r.course?.title ?? '—'}
                        </TableCell>
                        <TableCell className="py-3 text-center tabular font-mono">
                          {r.course?.creditHours ?? '—'}
                        </TableCell>
                        <TableCell className="py-3">
                          {(r.teacher?.name ? r.teacher.name.replace(/^Dr\.?\s+/i, '').trim() : '') || 'Unassigned'}
                        </TableCell>
                        <TableCell className="py-3 text-foreground font-medium">
                          {getStudentCurrentYearOfStudy(studentData)}
                        </TableCell>
                        <TableCell className="py-3">
                          <ProgramTypeBadge programType={studentData.programType} />
                        </TableCell>
                        <TableCell className="py-3 text-muted-foreground">
                          {formatAcademicYear(r.semester || r.offering?.semester)}
                        </TableCell>
                        <TableCell className="py-3 text-muted-foreground">
                          {formatSemesterTerm(r.semester?.term) || r.semester?.name || '—'}
                        </TableCell>
                        <TableCell className="py-3 text-center">
                          <StatusBadge status={r.status} />
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Server-Side Cursor Pagination: Previous and Next arrow icons (4 rows per page) */}
            {total > 0 && (
              <div className="flex items-center justify-end gap-2 px-6 py-3.5 border-t border-border/80 bg-card/40">
                <button
                  type="button"
                  onClick={handlePrevPage}
                  disabled={!hasPrev || loading}
                  title="Previous"
                  aria-label="Previous"
                  className="size-9 min-w-9 rounded-xl border border-blue-200/80 dark:border-blue-900/60 bg-white dark:bg-card text-blue-600 dark:text-blue-400 flex items-center justify-center transition-all cursor-pointer hover:bg-blue-50/70 hover:border-blue-300 dark:hover:bg-blue-950/40 disabled:opacity-40 disabled:cursor-not-allowed shadow-xs"
                >
                  <ChevronLeft className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={handleNextPage}
                  disabled={!hasMore || loading}
                  title="Next"
                  aria-label="Next"
                  className="size-9 min-w-9 rounded-xl border border-blue-200/80 dark:border-blue-900/60 bg-white dark:bg-card text-blue-600 dark:text-blue-400 flex items-center justify-center transition-all cursor-pointer hover:bg-blue-50/70 hover:border-blue-300 dark:hover:bg-blue-950/40 disabled:opacity-40 disabled:cursor-not-allowed shadow-xs"
                >
                  <ChevronRight className="size-4" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default MyCoursesPage
