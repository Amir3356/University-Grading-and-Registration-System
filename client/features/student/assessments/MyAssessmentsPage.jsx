import { useEffect, useMemo, useState } from 'react'
import {
  ClipboardList,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/common/EmptyState'
import { ErrorState } from '@/components/common/ErrorState'
import { FilterSelect } from '@/components/common/FilterSelect'
import { PageHeader } from '@/components/common/PageHeader'
import { SearchInput } from '@/components/common/SearchInput'
import { TableSkeleton } from '@/components/common/Loading'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useQuery } from '@/hooks/useStore'
import { useDebounce } from '@/hooks/useDebounce'
import { formatAcademicYear } from '@/lib/format'
import { onAssessmentChange } from '@/lib/syncEvents'
import { useWebSocketEvent } from '@/lib/websocket'
import { store } from '@/store'
import { typeLabel } from '../components/policy'

export function MyAssessmentsPage() {
  // 1. Enrolled courses for filter dropdown
  const { data: coursesData } = useQuery(() => store.student.listMyCourses(), [])

  // Dynamic Academic Year options autoincrementing when the calendar year arrives
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

  // 2. Server-side Cursor Pagination Query State (4 real data rows per page)
  const [cursor, setCursor] = useState(null)
  const [cursorHistory, setCursorHistory] = useState([]) // Stack of previous cursors
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 300)
  const [academicYearChoice, setAcademicYearChoice] = useState('all')
  const [semesterChoice, setSemesterChoice] = useState('all')
  const [courseFilter, setCourseFilter] = useState('all')
  const [sort] = useState({ key: 'dueDate', dir: 'asc' })

  const courseOptions = useMemo(() => {
    const list = Array.isArray(coursesData) ? coursesData : (coursesData?.items || coursesData?.courses || [])
    const map = new Map()
    for (const c of list) {
      const code = c.courseCode || c.course?.code
      const title = c.courseTitle || c.course?.title || ''
      if (!code) continue

      const semTerm = String(c.semester?.term || c.semester?.name || '').toLowerCase()
      const acadYear = String(c.academicYear?.name || formatAcademicYear(c.semester) || '')

      if (academicYearChoice !== 'all' && acadYear && !acadYear.includes(academicYearChoice)) {
        continue
      }
      if (semesterChoice !== 'all') {
        if (semesterChoice === 'first') {
          const isFirst = semTerm.includes('fall') || semTerm === '1' || semTerm.includes('first')
          if (!isFirst) continue
        } else if (semesterChoice === 'second') {
          const isSecond = semTerm.includes('spring') || semTerm === '2' || semTerm.includes('second')
          if (!isSecond) continue
        }
      }

      map.set(code, `${code} — ${title}`)
    }
    return [
      { value: 'all', label: 'All Courses' },
      ...Array.from(map.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([value, label]) => ({ value, label })),
    ]
  }, [coursesData, academicYearChoice, semesterChoice])

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

  const handleCourseChange = (val) => {
    setCourseFilter(val || 'all')
    setCursor(null)
    setCursorHistory([])
  }

  const isFiltered =
    academicYearChoice !== 'all' || semesterChoice !== 'all' || courseFilter !== 'all' || search.trim() !== ''

  const handleResetFilters = () => {
    setSearch('')
    setAcademicYearChoice('all')
    setSemesterChoice('all')
    setCourseFilter('all')
    setCursor(null)
    setCursorHistory([])
  }

  // 3. Server-side Cursor Paginated Query (4 items per page)
  const {
    data: assessmentData,
    loading: assessmentsLoading,
    error: assessmentsError,
    refetch: refetchAssessments,
  } = useQuery(
    () =>
      store.student.listMyAssessmentsPaginated({
        cursor: cursor || undefined,
        limit: 4,
        search: debouncedSearch.trim() || undefined,
        academicYearId: academicYearChoice !== 'all' ? academicYearChoice : undefined,
        semesterId: semesterChoice !== 'all' ? semesterChoice : undefined,
        courseCode: courseFilter !== 'all' ? courseFilter : undefined,
        sortBy: sort?.key,
        sortDir: sort?.dir,
      }),
    [cursor, debouncedSearch, academicYearChoice, semesterChoice, courseFilter, sort?.key, sort?.dir]
  )

  // Real-time synchronization
  useWebSocketEvent('ASSESSMENT_UPDATED', () => refetchAssessments())
  useWebSocketEvent('ASSESSMENT_CREATED', () => refetchAssessments())
  useWebSocketEvent('ASSESSMENT_DELETED', () => refetchAssessments())
  useWebSocketEvent('SCORES_UPDATED', () => refetchAssessments())
  useWebSocketEvent('OFFERING_UPDATED', () => refetchAssessments())

  useEffect(() => {
    const unsub = onAssessmentChange(() => {
      refetchAssessments()
    })
    return () => unsub?.()
  }, [refetchAssessments])

  // 4. Computed Cursor Pagination Values
  const assessments = assessmentData?.items ?? (Array.isArray(assessmentData) ? assessmentData : [])
  const total = assessmentData?.total ?? assessments.length
  const nextCursor = assessmentData?.nextCursor ?? null
  const hasMore = Boolean(assessmentData?.hasMore ?? nextCursor)
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Teacher Assessment"
        description="View assignments, quizzes, midterms, exams, and grades"
        centered
      />

      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        {/* Controls Toolbar */}
        <div className="p-4 border-b border-border bg-card/50 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="w-full sm:w-72">
            <SearchInput
              value={search}
              onChange={handleSearchChange}
              placeholder="Search course, assessment..."
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="w-40 sm:w-44">
              <FilterSelect
                value={academicYearChoice}
                onChange={handleAcademicYearChange}
                options={academicYearOptions}
                placeholder="Academic Year"
                includeAll={false}
              />
            </div>

            <div className="w-36 sm:w-40">
              <FilterSelect
                value={semesterChoice}
                onChange={handleSemesterChange}
                options={semesterOptions}
                placeholder="Semester"
                includeAll={false}
              />
            </div>

            <div className="w-48 sm:w-56">
              <FilterSelect
                value={courseFilter}
                onChange={handleCourseChange}
                options={courseOptions}
                placeholder="All Courses"
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
        {assessmentsLoading && assessments.length === 0 ? (
          <div className="p-6">
            <TableSkeleton rows={5} columns={5} />
          </div>
        ) : assessmentsError ? (
          <div className="p-8">
            <ErrorState
              title="Failed to load assessments"
              message={assessmentsError?.message || 'An error occurred while loading your assessments.'}
              onRetry={refetchAssessments}
            />
          </div>
        ) : assessments.length === 0 ? (
          <div className="p-12">
            <EmptyState
              icon={ClipboardList}
              title="No assessments found"
              description={
                isFiltered
                  ? 'No assessments match the current filters. Try clearing your search or filters.'
                  : 'Assessments appear here once your instructors publish and schedule them.'
              }
            />
          </div>
        ) : (
          <div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent border-b border-border bg-muted/40 text-xs">
                    <TableHead className="font-semibold text-foreground py-3">Course</TableHead>
                    <TableHead className="font-semibold text-foreground py-3">Teacher Name</TableHead>
                    <TableHead className="font-semibold text-foreground py-3">Assessment</TableHead>
                    <TableHead className="font-semibold text-foreground py-3 text-center">Total Mark</TableHead>
                    <TableHead className="font-semibold text-foreground py-3 text-center">Weight</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assessments.map((a) => {
                    const fallbackTeacher =
                      (Array.isArray(coursesData) ? coursesData : coursesData?.items || []).find(
                        (c) => (c.courseCode || c.course?.code) === a.courseCode
                      )?.teacher?.name
                    const teacherDisplayName =
                      a.teacherName ||
                      (fallbackTeacher ? fallbackTeacher.replace(/^Dr\.?\s+/i, '').trim() : '') ||
                      'Unassigned'

                    return (
                      <TableRow key={a.id} className="hover:bg-muted/30 transition-colors">
                        <TableCell className="py-3">
                          <div>
                            <span className="font-semibold text-foreground">{a.courseCode}</span>
                            {a.courseTitle && (
                              <p className="truncate text-xs text-muted-foreground">{a.courseTitle}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="py-3">
                          <span className="text-foreground font-medium">
                            {teacherDisplayName}
                          </span>
                        </TableCell>
                        <TableCell className="py-3">
                          <div>
                            <p className="font-medium text-foreground">{a.name}</p>
                            <p className="text-xs text-muted-foreground">{typeLabel(a.type)}</p>
                          </div>
                        </TableCell>
                        <TableCell className="py-3 text-center">
                          <span className="font-mono text-sm tabular font-medium">
                            {a.maxMarks ?? '—'}
                          </span>
                        </TableCell>
                        <TableCell className="py-3 text-center">
                          <span className="font-mono text-sm tabular font-medium">
                            {a.weight != null ? `${a.weight}%` : '—'}
                          </span>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Server-Side Cursor Pagination: Previous and Next arrow icons */}
            {total > 0 && (
              <div className="flex items-center justify-end gap-2 px-6 py-3.5 border-t border-border/80 bg-card/40">
                <button
                  type="button"
                  onClick={handlePrevPage}
                  disabled={!hasPrev || assessmentsLoading}
                  title="Previous"
                  aria-label="Previous"
                  className="size-9 min-w-9 rounded-xl border border-blue-200/80 dark:border-blue-900/60 bg-white dark:bg-card text-blue-600 dark:text-blue-400 flex items-center justify-center transition-all cursor-pointer hover:bg-blue-50/70 hover:border-blue-300 dark:hover:bg-blue-950/40 disabled:opacity-40 disabled:cursor-not-allowed shadow-xs"
                >
                  <ChevronLeft className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={handleNextPage}
                  disabled={!hasMore || assessmentsLoading}
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

export default MyAssessmentsPage
