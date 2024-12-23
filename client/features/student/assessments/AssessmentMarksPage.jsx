import { useEffect, useMemo, useState } from 'react'
import {
  ClipboardList,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
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
import { onAssessmentChange, onGradeChange } from '@/lib/syncEvents'
import { useWebSocketEvent } from '@/lib/websocket'
import { store } from '@/store'
import { typeLabel } from '../components/policy'

export function AssessmentMarksPage() {
  // 1. Enrolled courses for filter dropdown
  const { data: coursesData, refetch: refetchCourses } = useQuery(() => store.student.listMyCourses(), [])

  // Dynamic Academic Year options - auto-increments as each year arrives starting from 2026 without showing prior 2024/2025
  const availableYears = useMemo(() => {
    const currentYear = new Date().getFullYear()
    const startYear = 2026
    const yearsSet = new Set()
    for (let y = currentYear; y >= startYear; y--) {
      yearsSet.add(String(y))
    }
    const list = Array.isArray(coursesData) ? coursesData : (coursesData?.items || coursesData?.courses || [])
    list.forEach((c) => {
      const acadYear = formatAcademicYear(c.semester)
      if (acadYear && acadYear !== '—' && Number(acadYear) >= 2026) {
        yearsSet.add(String(acadYear))
      }
    })
    return Array.from(yearsSet).sort((a, b) => Number(b) - Number(a))
  }, [coursesData])

  const academicYearOptions = [
    { value: 'all', label: 'Academic Year' },
    ...availableYears.map((y) => ({ value: y, label: y })),
  ]

  const semesterOptions = [
    { value: 'all', label: 'Semester' },
    { value: 'first', label: 'First Semester' },
    { value: 'second', label: 'Second Semester' },
  ]

  const statusOptions = [
    { value: 'all', label: 'All Status' },
    { value: 'graded', label: 'Graded' },
    { value: 'pending', label: 'Pending' },
  ]

  // 2. Pagination & Filter State
  const [pageSize, setPageSize] = useState(5)
  const [cursor, setCursor] = useState(null)
  const [direction, setDirection] = useState('next')
  const [pageNumber, setPageNumber] = useState(1)
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 300)
  const [academicYearChoice, setAcademicYearChoice] = useState('all')
  const [semesterChoice, setSemesterChoice] = useState('all')
  const [courseFilter, setCourseFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
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

  const handleStatusChange = (val) => {
    setStatusFilter(val || 'all')
    resetPagination()
  }

  const isFiltered =
    academicYearChoice !== 'all' ||
    semesterChoice !== 'all' ||
    courseFilter !== 'all' ||
    statusFilter !== 'all' ||
    search.trim() !== ''

  const handleResetFilters = () => {
    setSearch('')
    setAcademicYearChoice('all')
    setSemesterChoice('all')
    setCourseFilter('all')
    setStatusFilter('all')
    resetPagination()
  }

  // 3. Paginated Server-Side Query
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
        status: statusFilter !== 'all' ? statusFilter : undefined,
        sortBy: sort?.key,
        sortDir: sort?.dir,
      }),
    [cursor, direction, pageSize, debouncedSearch, academicYearChoice, semesterChoice, courseFilter, statusFilter, sort?.key, sort?.dir]
  )

  const reloadData = () => {
    refetchAssessments?.()
    refetchCourses?.()
  }

  // Real-time synchronization
  useWebSocketEvent('ASSESSMENT_UPDATED', reloadData)
  useWebSocketEvent('ASSESSMENT_CREATED', reloadData)
  useWebSocketEvent('ASSESSMENT_DELETED', reloadData)
  useWebSocketEvent('SCORES_UPDATED', reloadData)
  useWebSocketEvent('OFFERING_UPDATED', reloadData)
  useWebSocketEvent('COURSE_ENROLLED', reloadData)
  useWebSocketEvent('ENROLLMENT_UPDATED', reloadData)
  useWebSocketEvent('GRADE_SUBMISSION_UPDATED', reloadData)

  useEffect(() => {
    const unsubAsm = onAssessmentChange(() => reloadData())
    const unsubGrade = onGradeChange(() => reloadData())
    return () => {
      unsubAsm?.()
      unsubGrade?.()
    }
  }, [])

  // 5. Computed Values
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
    setPageSize(val === 'all' ? 'all' : Number(val))
    resetPagination()
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Assessment Marks"
        description="Detailed breakdown of all assessment marks and scores across your enrolled courses."
        centered
      />

      {/* Filter and Control Toolbar */}
      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        <div className="p-4 border-b border-border bg-card/50 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          <div className="w-full md:w-64">
            <SearchInput
              value={search}
              onChange={handleSearchChange}
              placeholder="Search assessment, course..."
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="w-36 sm:w-40">
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

            <div className="w-44 sm:w-52">
              <FilterSelect
                value={courseFilter}
                onChange={handleCourseChange}
                options={courseOptions}
                placeholder="All Courses"
                includeAll={false}
              />
            </div>

            <div className="w-32 sm:w-36">
              <FilterSelect
                value={statusFilter}
                onChange={handleStatusChange}
                options={statusOptions}
                placeholder="All Status"
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

        {/* Assessment Marks Breakdown Table */}
        {assessmentsLoading && assessments.length === 0 ? (
          <div className="p-6">
            <TableSkeleton rows={5} columns={7} />
          </div>
        ) : assessmentsError ? (
          <div className="p-8">
            <ErrorState
              title="Failed to load assessment marks"
              message={assessmentsError?.message || 'An error occurred while loading your marks.'}
              onRetry={reloadData}
            />
          </div>
        ) : assessments.length === 0 ? (
          <div className="p-12">
            <EmptyState
              icon={ClipboardList}
              title="No assessment marks found"
              description={
                isFiltered
                  ? 'No assessment marks match the selected filters. Try clearing your search or filters.'
                  : 'Individual assessment marks will appear here once your instructors publish them.'
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
                      className="font-semibold text-foreground py-3 cursor-pointer select-none hover:text-primary transition-colors w-[150px]"
                      onClick={() => handleSort('courseCode')}
                      title="Sort by Course Code"
                    >
                      Course Code {sort?.key === 'courseCode' && (sort.dir === 'asc' ? '↑' : '↓')}
                    </TableHead>
                    <TableHead
                      className="font-semibold text-foreground py-3 cursor-pointer select-none hover:text-primary transition-colors min-w-[180px]"
                      onClick={() => handleSort('name')}
                      title="Sort by Assessment Name"
                    >
                      Assessment {sort?.key === 'name' && (sort.dir === 'asc' ? '↑' : '↓')}
                    </TableHead>
                    <TableHead
                      className="font-semibold text-foreground py-3 cursor-pointer select-none hover:text-primary transition-colors w-[130px]"
                      onClick={() => handleSort('type')}
                      title="Sort by Type"
                    >
                      Type {sort?.key === 'type' && (sort.dir === 'asc' ? '↑' : '↓')}
                    </TableHead>
                    <TableHead
                      className="font-semibold text-foreground py-3 text-center cursor-pointer select-none hover:text-primary transition-colors w-[110px]"
                      onClick={() => handleSort('maxMarks')}
                      title="Sort by Max Mark"
                    >
                      Max Mark {sort?.key === 'maxMarks' && (sort.dir === 'asc' ? '↑' : '↓')}
                    </TableHead>
                    <TableHead
                      className="font-semibold text-foreground py-3 text-center cursor-pointer select-none hover:text-primary transition-colors w-[100px]"
                      onClick={() => handleSort('weight')}
                      title="Sort by Weight"
                    >
                      Weight {sort?.key === 'weight' && (sort.dir === 'asc' ? '↑' : '↓')}
                    </TableHead>
                    <TableHead
                      className="font-semibold text-foreground py-3 text-center cursor-pointer select-none hover:text-primary transition-colors w-[140px]"
                      onClick={() => handleSort('marks')}
                      title="Sort by Mark Obtained"
                    >
                      Mark Obtained {sort?.key === 'marks' && (sort.dir === 'asc' ? '↑' : '↓')}
                    </TableHead>
                    <TableHead className="font-semibold text-foreground py-3 text-center w-[130px]">
                      Status
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assessments.map((a) => (
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
                        <p className="font-medium text-foreground">{a.name}</p>
                        {a.dueDateText && (
                          <p className="text-xs text-muted-foreground">Due: {a.dueDateText}</p>
                        )}
                      </TableCell>
                      <TableCell className="py-3 text-sm text-muted-foreground">
                        {typeLabel(a.type)}
                      </TableCell>
                      <TableCell className="py-3 text-center tabular-nums">
                        {a.maxMarks ?? '—'}
                      </TableCell>
                      <TableCell className="py-3 text-center tabular-nums">
                        {a.weight != null ? `${a.weight}%` : '—'}
                      </TableCell>
                      <TableCell className="py-3 text-center tabular-nums">
                        {a.marks != null ? (
                          <span className="inline-flex items-center gap-1.5 font-bold text-primary">
                            <span>{a.marks}</span>
                            {a.maxMarks > 0 && (
                              <span className="text-xs font-normal text-muted-foreground">
                                ({Math.round((a.marks / a.maxMarks) * 100)}%)
                              </span>
                            )}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="py-3 text-center">
                        <div className="flex items-center justify-center">
                          <Badge
                            variant={
                              a.status === 'graded'
                                ? 'success'
                                : a.status === 'pending'
                                  ? 'warning'
                                  : 'secondary'
                            }
                          >
                            {a.status === 'graded'
                              ? 'Graded'
                              : a.status === 'pending'
                                ? 'Pending'
                                : a.status === 'upcoming'
                                  ? 'Upcoming'
                                  : a.status}
                          </Badge>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Pagination Controls Footer */}
            <div className="px-4 py-3 border-t border-border bg-card/50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <span>Rows per page:</span>
                <select
                  value={pageSize}
                  onChange={(e) => handlePageSizeChange(e.target.value)}
                  className="h-8 px-2 rounded-md border border-input bg-background text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value={5}>5</option>
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value="all">All</option>
                </select>
                <span className="ml-2">
                  Total: <strong>{total}</strong> assessment{total === 1 ? '' : 's'}
                </span>
              </div>

              {pageSize !== 'all' && (
                <div className="flex items-center gap-2">
                  <span>Page {pageNumber}</span>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="icon-sm"
                      onClick={handlePrevPage}
                      disabled={!hasPrevPage}
                      title="Previous Page"
                      className="size-8"
                    >
                      <ChevronLeft className="size-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon-sm"
                      onClick={handleNextPage}
                      disabled={!hasNextPage}
                      title="Next Page"
                      className="size-8"
                    >
                      <ChevronRight className="size-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default AssessmentMarksPage

