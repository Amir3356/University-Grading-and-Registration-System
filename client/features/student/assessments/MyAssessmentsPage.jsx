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
  const { data: coursesData, refetch: refetchCourses } = useQuery(() => store.student.listMyCourses(), [])

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

  // 2. Server-side Keyset Cursor-Based Pagination State
  const [pageSize, setPageSize] = useState(4)
  const [cursor, setCursor] = useState(null)
  const [direction, setDirection] = useState('next')
  const [pageNumber, setPageNumber] = useState(1)
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 300)
  const [academicYearChoice, setAcademicYearChoice] = useState('all')
  const [semesterChoice, setSemesterChoice] = useState('all')
  const [courseFilter, setCourseFilter] = useState('all')
  const [sort, setSort] = useState({ key: 'dueDate', dir: 'asc' })

  const resetPagination = () => {
    setCursor(null)
    setDirection('next')
    setPageNumber(1)
  }

  const handleSort = (key) => {
    setSort((prev) => {
      if (!prev || prev.key !== key) return { key, dir: 'asc' }
      if (prev.dir === 'asc') return { key, dir: 'desc' }
      return { key: 'dueDate', dir: 'asc' }
    })
    resetPagination()
  }

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
    resetPagination()
  }

  const handleAcademicYearChange = (val) => {
    setAcademicYearChoice(val)
    resetPagination()
  }

  const handleSemesterChange = (val) => {
    setSemesterChoice(val)
    resetPagination()
  }

  const handleCourseChange = (val) => {
    setCourseFilter(val || 'all')
    resetPagination()
  }

  const isFiltered =
    academicYearChoice !== 'all' || semesterChoice !== 'all' || courseFilter !== 'all' || search.trim() !== ''

  const handleResetFilters = () => {
    setSearch('')
    setAcademicYearChoice('all')
    setSemesterChoice('all')
    setCourseFilter('all')
    resetPagination()
  }

  // 3. Server-side Cursor Paginated Query
  const {
    data: assessmentData,
    loading: assessmentsLoading,
    error: assessmentsError,
    refetch: refetchAssessments,
  } = useQuery(
    () =>
      store.student.listMyAssessmentsPaginated({
        cursor: cursor || undefined,
        direction,
        pageSize,
        search: debouncedSearch.trim() || undefined,
        academicYearId: academicYearChoice !== 'all' ? academicYearChoice : undefined,
        semesterId: semesterChoice !== 'all' ? semesterChoice : undefined,
        courseCode: courseFilter !== 'all' ? courseFilter : undefined,
        sortBy: sort?.key,
        sortDir: sort?.dir,
      }),
    [cursor, direction, pageSize, debouncedSearch, academicYearChoice, semesterChoice, courseFilter, sort?.key, sort?.dir]
  )

  // Real-time synchronization
  useWebSocketEvent('ASSESSMENT_UPDATED', () => refetchAssessments())
  useWebSocketEvent('ASSESSMENT_CREATED', () => refetchAssessments())
  useWebSocketEvent('ASSESSMENT_DELETED', () => refetchAssessments())
  useWebSocketEvent('SCORES_UPDATED', () => refetchAssessments())
  useWebSocketEvent('OFFERING_UPDATED', () => {
    refetchAssessments()
    refetchCourses()
  })
  useWebSocketEvent('OFFERING_CREATED', () => {
    refetchAssessments()
    refetchCourses()
  })
  useWebSocketEvent('COURSE_ENROLLED', () => {
    refetchAssessments()
    refetchCourses()
  })
  useWebSocketEvent('ENROLLMENT_UPDATED', () => {
    refetchAssessments()
    refetchCourses()
  })

  useEffect(() => {
    const unsub = onAssessmentChange(() => {
      refetchAssessments()
    })
    return () => unsub?.()
  }, [refetchAssessments])

  // 4. Computed Cursor Pagination Values
  const assessments = assessmentData?.items ?? (Array.isArray(assessmentData) ? assessmentData : [])
  const total = assessmentData?.total ?? assessments.length
  const pageInfo = assessmentData?.pageInfo || {}
  const hasNextPage = Boolean(pageInfo.hasNextPage ?? assessmentData?.hasMore)
  const hasPrevPage = Boolean(pageInfo.hasPrevPage)
  const nextCursor = pageInfo.nextCursor || assessmentData?.nextCursor || null
  const prevCursor = pageInfo.prevCursor || assessmentData?.prevCursor || null

  const handleNextPage = () => {
    if (hasNextPage && nextCursor) {
      setCursor(nextCursor)
      setDirection('next')
      setPageNumber((p) => p + 1)
    }
  }

  const handlePrevPage = () => {
    if (hasPrevPage && prevCursor) {
      setCursor(prevCursor)
      setDirection('prev')
      setPageNumber((p) => Math.max(1, p - 1))
    }
  }

  const handlePageSizeChange = (val) => {
    setPageSize(Number(val))
    resetPagination()
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
                    <TableHead
                      className="font-semibold text-foreground py-3 cursor-pointer select-none hover:text-primary transition-colors"
                      onClick={() => handleSort('courseCode')}
                      title="Sort by Course Code"
                    >
                      Course {sort?.key === 'courseCode' && (sort.dir === 'asc' ? '↑' : '↓')}
                    </TableHead>
                    <TableHead
                      className="font-semibold text-foreground py-3 cursor-pointer select-none hover:text-primary transition-colors"
                      onClick={() => handleSort('teacherName')}
                      title="Sort by Teacher Name"
                    >
                      Teacher Name {sort?.key === 'teacherName' && (sort.dir === 'asc' ? '↑' : '↓')}
                    </TableHead>
                    <TableHead
                      className="font-semibold text-foreground py-3 cursor-pointer select-none hover:text-primary transition-colors"
                      onClick={() => handleSort('name')}
                      title="Sort by Assessment Name"
                    >
                      Assessment {sort?.key === 'name' && (sort.dir === 'asc' ? '↑' : '↓')}
                    </TableHead>
                    <TableHead
                      className="font-semibold text-foreground py-3 text-center cursor-pointer select-none hover:text-primary transition-colors"
                      onClick={() => handleSort('maxMarks')}
                      title="Sort by Total Mark"
                    >
                      Total Mark {sort?.key === 'maxMarks' && (sort.dir === 'asc' ? '↑' : '↓')}
                    </TableHead>
                    <TableHead
                      className="font-semibold text-foreground py-3 text-center cursor-pointer select-none hover:text-primary transition-colors"
                      onClick={() => handleSort('weight')}
                      title="Sort by Weight"
                    >
                      Weight {sort?.key === 'weight' && (sort.dir === 'asc' ? '↑' : '↓')}
                    </TableHead>
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

            {/* Server-Side Keyset Cursor Pagination: Info & Controls */}
            {total > 0 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-6 py-3.5 border-t border-border/80 bg-card/40 text-xs text-muted-foreground">
                <div className="flex flex-wrap items-center gap-4">
                  <div>
                    Showing{' '}
                    <span className="font-medium text-foreground">
                      {assessments.length > 0 ? (pageNumber - 1) * pageSize + 1 : 0}
                    </span>
                    {' '}to{' '}
                    <span className="font-medium text-foreground">
                      {(pageNumber - 1) * pageSize + assessments.length}
                    </span>
                    {' '}of{' '}
                    <span className="font-medium text-foreground">{total}</span> assessments
                  </div>

                  <div className="flex items-center gap-1.5 pl-3 border-l border-border">
                    <span>Rows per page:</span>
                    <select
                      value={pageSize}
                      onChange={(e) => handlePageSizeChange(e.target.value)}
                      className="h-7 rounded-md border border-input bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer"
                    >
                      <option value={4}>4</option>
                      <option value={8}>8</option>
                      <option value={12}>12</option>
                      <option value={20}>20</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon-sm"
                    className="size-8"
                    onClick={handlePrevPage}
                    disabled={!hasPrevPage || assessmentsLoading}
                    title="Previous page"
                    aria-label="Previous page"
                  >
                    <ChevronLeft className="size-4" />
                  </Button>
                  <span className="text-xs px-2 font-medium text-foreground">
                    Page {pageNumber}
                  </span>
                  <Button
                    variant="outline"
                    size="icon-sm"
                    className="size-8"
                    onClick={handleNextPage}
                    disabled={!hasNextPage || assessmentsLoading}
                    title="Next page"
                    aria-label="Next page"
                  >
                    <ChevronRight className="size-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default MyAssessmentsPage
