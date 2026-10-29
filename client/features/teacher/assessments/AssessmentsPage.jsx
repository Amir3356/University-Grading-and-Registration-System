import { useMemo, useState } from 'react'
import {
  ClipboardList,
  Pencil,
  Plus,
  Trash2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { EmptyState } from '@/components/common/EmptyState'
import { ErrorState } from '@/components/common/ErrorState'
import { FilterSelect } from '@/components/common/FilterSelect'
import { PageSkeleton, TableSkeleton } from '@/components/common/Loading'
import { PageHeader } from '@/components/common/PageHeader'
import { SearchInput } from '@/components/common/SearchInput'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useLookups } from '@/context/lookups-context'
import { useQuery } from '@/hooks/useStore'
import { useDebounce } from '@/hooks/useDebounce'
import { formatYearOfStudy, getCourseStudyYear } from '@/lib/format'
import { useWebSocketEvent } from '@/lib/websocket'
import { store } from '@/store'
import { isLockedStatus, typeLabel } from '../lib'
import { AssessmentFormDialog } from './AssessmentFormDialog'

export function AssessmentsPage() {
  const { offeringId: paramOfferingId } = useParams()
  const lookups = useLookups()
  const currentSemesterId = lookups?.currentSemester?.id

  // 1. Fetch teacher offerings for filter dropdowns & assignment context
  const {
    data: offerings,
    loading: offeringsLoading,
    error: offeringsError,
    refetch: refetchOfferings,
  } = useQuery(() => store.teacher.listMyOfferings({}), [])

  useWebSocketEvent('OFFERING_UPDATED', () => refetchOfferings())
  useWebSocketEvent('OFFERING_CREATED', () => refetchOfferings())
  useWebSocketEvent('OFFERING_DELETED', () => refetchOfferings())

  // Deduplicate courses so each assigned course appears only once in the dropdown
  const uniqueCourses = useMemo(() => {
    const list = offerings ?? []
    const map = new Map()

    for (const o of list) {
      const cId = o.course?.id || o.courseId || o.course_id || o.course?.code || o.id
      if (!cId) continue

      if (!map.has(cId)) {
        map.set(cId, o)
      } else {
        const existing = map.get(cId)
        if (paramOfferingId && o.id === paramOfferingId) {
          map.set(cId, o)
        } else if (
          (o.semester?.isCurrent || o.semester?.is_current || o.semesterId === currentSemesterId) &&
          (!existing.semester?.isCurrent && !existing.semester?.is_current && existing.semesterId !== currentSemesterId)
        ) {
          map.set(cId, o)
        }
      }
    }

    return Array.from(map.values())
  }, [offerings, paramOfferingId, currentSemesterId])

  // Distinct years of study that the teacher teaches across assigned course offerings
  const teacherYearOptions = useMemo(() => {
    const list = offerings ?? []
    const yearSet = new Set()
    for (const o of list) {
      const y =
        o?.yearOfStudy ??
        o?.year_of_study ??
        o?.course?.yearOfStudy ??
        (o?.course?.level ? Math.floor(o.course.level / 100) : null) ??
        (o?.course ? getCourseStudyYear(o.course) : null)
      if (y != null && y !== '') {
        yearSet.add(String(y))
      }
    }
    const sorted = Array.from(yearSet).sort((a, b) => Number(a) - Number(b))
    return sorted.map((y) => ({
      value: String(y),
      label: `Year ${y}`,
    }))
  }, [offerings])

  // 2. Pure server-side cursor pagination query state: Search, Filters, Sorting, Keyset Cursor
  const [pageSize] = useState(4)
  const [cursor, setCursor] = useState(null)
  const [direction, setDirection] = useState('next')
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 300)
  const [selectedYearOfStudy, setSelectedYearOfStudy] = useState('')
  const [selectedCourseId, setSelectedCourseId] = useState('all')
  const [sort, setSort] = useState({ key: 'dueDate', dir: 'asc' })

  const resetPagination = () => {
    setCursor(null)
    setDirection('next')
  }

  // Filter courses by selected Year of Study
  const filteredCourses = useMemo(() => {
    if (!uniqueCourses) return []
    if (!selectedYearOfStudy || selectedYearOfStudy === 'all') return uniqueCourses
    return uniqueCourses.filter((o) => {
      const y = o?.yearOfStudy ?? o?.year_of_study ?? (o?.course ? getCourseStudyYear(o.course) : null)
      return String(y) === String(selectedYearOfStudy)
    })
  }, [uniqueCourses, selectedYearOfStudy])

  // If a specific course was selected but does not belong to the selected year, treat as 'all'
  const effectiveCourseId = useMemo(() => {
    if (!selectedCourseId || selectedCourseId === 'all') return 'all'
    const matches = filteredCourses.some((o) => {
      const cId = o.course?.id || o.courseId || o.course_id || o.course?.code || o.id
      return cId === selectedCourseId || o.id === selectedCourseId
    })
    return matches ? selectedCourseId : 'all'
  }, [filteredCourses, selectedCourseId])

  const activeCourseId = effectiveCourseId && effectiveCourseId !== 'all' ? effectiveCourseId : ''

  const offering = useMemo(() => {
    if (effectiveCourseId && effectiveCourseId !== 'all') {
      const found = (offerings ?? []).find((o) => {
        const cId = o.course?.id || o.courseId || o.course_id || o.course?.code || o.id
        return cId === effectiveCourseId || o.id === effectiveCourseId
      })
      if (found) return found
    }
    return offerings?.[0] || null
  }, [effectiveCourseId, offerings])

  const handleYearOfStudyChange = (year) => {
    const val = year || ''
    setSelectedYearOfStudy(val)
    if (!val || val === 'all') {
      setSelectedCourseId('all')
    }
    resetPagination()
  }

  const handleCourseChange = (cId) => {
    const val = cId || 'all'
    setSelectedCourseId(val)
    if (val && val !== 'all') {
      const target = (offerings ?? []).find((o) => {
        const key = o.course?.id || o.courseId || o.course_id || o.course?.code || o.id
        return key === val
      })
      if (target) {
        const offYear =
          target?.yearOfStudy ??
          target?.year_of_study ??
          target?.course?.yearOfStudy ??
          (target?.course?.level ? Math.floor(target.course.level / 100) : null) ??
          (target?.course ? getCourseStudyYear(target.course) : null)
        if (offYear != null && offYear !== '') {
          setSelectedYearOfStudy(String(offYear))
        }
      }
    }
    resetPagination()
  }

  const handleSearchChange = (val) => {
    setSearch(val)
    resetPagination()
  }

  const handleSort = (key) => {
    setSort((prev) => {
      if (!prev || prev.key !== key) return { key, dir: 'asc' }
      if (prev.dir === 'asc') return { key, dir: 'desc' }
      return { key: 'dueDate', dir: 'asc' }
    })
    resetPagination()
  }

  // 3. Server-side Cursor-Paginated Query
  const {
    data: assessmentData,
    loading: assessmentsLoading,
    error: assessmentsError,
    refetch: refetchAssessments,
  } = useQuery(
    () =>
      store.grades.listAssessmentsPaginated({
        cursor,
        direction,
        pageSize,
        search: debouncedSearch,
        yearOfStudy: selectedYearOfStudy,
        courseId: activeCourseId,
        sortBy: sort?.key,
        sortDir: sort?.dir,
      }),
    [cursor, direction, pageSize, debouncedSearch, selectedYearOfStudy, activeCourseId, sort?.key, sort?.dir]
  )

  useWebSocketEvent('ASSESSMENT_CREATED', () => {
    refetchAssessments()
    refetchOfferings()
  })
  useWebSocketEvent('ASSESSMENT_UPDATED', () => {
    refetchAssessments()
    refetchOfferings()
  })
  useWebSocketEvent('ASSESSMENT_DELETED', () => {
    refetchAssessments()
    refetchOfferings()
  })

  // 4. Modal and action states
  const [dialog, setDialog] = useState({ open: false, assessment: null })
  const [deleting, setDeleting] = useState(null)

  // 5. Computed states
  const isLocked = Boolean(isLockedStatus(offering?.gradeStatus))
  const assessments = assessmentData?.items ?? []
  const total = assessmentData?.total ?? 0
  const pageInfo = assessmentData?.pageInfo || {}
  const hasNextPage = Boolean(pageInfo.hasNextPage)
  const hasPrevPage = Boolean(pageInfo.hasPrevPage)
  const nextCursor = pageInfo.nextCursor
  const prevCursor = pageInfo.prevCursor

  const handleNextPage = () => {
    if (hasNextPage && nextCursor) {
      setCursor(nextCursor)
      setDirection('next')
    }
  }

  const handlePrevPage = () => {
    if (hasPrevPage && prevCursor) {
      setCursor(prevCursor)
      setDirection('prev')
    }
  }

  // Handle assessment deletion
  const handleDelete = async () => {
    if (!deleting) return
    try {
      await store.grades.deleteAssessment(deleting.id)
      toast.success(`Assessment "${deleting.name}" deleted successfully.`)
      refetchAssessments()
      refetchOfferings()
      setDeleting(null)
      return true
    } catch (err) {
      toast.error(err.message || 'Failed to delete assessment.')
      return false
    }
  }



  if (offeringsLoading && !offerings) return <PageSkeleton />
  if (offeringsError) {
    return (
      <>
        <PageHeader title="Assessments" />
        <ErrorState error={offeringsError} onRetry={refetchOfferings} />
      </>
    )
  }

  return (
    <>
      <PageHeader
        title="Assessment Management"
        centered
        actions={
          <Button
            disabled={!offering || isLocked}
            onClick={() => setDialog({ open: true, assessment: null })}
            title={isLocked ? 'Assessments locked because final grades have been submitted' : undefined}
          >
            <Plus className="size-4" /> Create Assessment
          </Button>
        }
      />

      {uniqueCourses.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No courses assigned"
          description="You need an assigned course offering before you can create assessments."
        />
      ) : (
        <div className="stack stack--md">
          {/* Top Toolbar: Search + Year Filter + Course Filter */}
          <div className="toolbar--split flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div className="toolbar--split__left w-full md:max-w-sm">
              <SearchInput
                value={search}
                onChange={handleSearchChange}
                placeholder="Search assessments by name, type, or course…"
              />
            </div>
            <div className="toolbar--split__right flex flex-wrap items-center gap-2">
              <FilterSelect
                label="Year of Study"
                value={selectedYearOfStudy}
                onChange={handleYearOfStudyChange}
                options={teacherYearOptions}
                allLabel="All Years of Study"
                placeholder="Filter by Year of Study"
                className="filter-select--year w-48"
                align="end"
              />
              <FilterSelect
                label="Course"
                value={activeCourseId}
                onChange={handleCourseChange}
                includeAll={true}
                allLabel="All Courses"
                placeholder="Filter by Course"
                options={filteredCourses.map((o) => {
                  const cId = o.course?.id || o.courseId || o.course_id || o.course?.code || o.id
                  return {
                    value: cId,
                    label: `${o.course?.code} — ${o.course?.title || o.course?.name || o.course?.code}`,
                  }
                })}
                className="filter-select--course w-80"
                align="end"
              />
            </div>
          </div>

          {/* Table Container */}
          <div className="table-box rounded-lg border bg-card shadow-sm overflow-hidden">
            {assessmentsError ? (
              <div className="p-6">
                <ErrorState error={assessmentsError} onRetry={refetchAssessments} />
              </div>
            ) : assessmentsLoading && !assessmentData ? (
              <div className="p-4">
                <TableSkeleton cols={6} rows={pageSize === 'all' ? 8 : Number(pageSize)} />
              </div>
            ) : assessments.length === 0 ? (
              <div className="p-8">
                <EmptyState
                  icon={ClipboardList}
                  title={search ? 'No assessments match your search' : 'No assessments found'}
                  description={
                    search
                      ? 'Try adjusting your search query or clear active filters.'
                      : 'Use the Create Assessment button above to define assignments, quizzes, and exams for this course.'
                  }
                />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent border-b border-border bg-muted/40 text-xs">
                    <TableHead className="font-semibold text-foreground py-3">
                      Assessment Type & Name
                    </TableHead>
                    <TableHead className="font-semibold text-foreground py-3 text-center">
                      Course
                    </TableHead>
                    <TableHead className="font-semibold text-foreground py-3 text-center">
                      Year of Study
                    </TableHead>
                    <TableHead className="font-semibold text-foreground py-3 text-center">
                      Weight
                    </TableHead>
                    <TableHead className="font-semibold text-foreground py-3 text-center">
                      Max Marks
                    </TableHead>
                    <TableHead className="font-semibold text-foreground py-3 text-center">
                      Due Date
                    </TableHead>
                    <TableHead className="font-semibold text-foreground py-3 text-right pr-4">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assessments.map((a) => {
                    const targetOff = a.offering || (offerings ?? []).find((o) => o.id === a.offeringId) || offering
                    const y = targetOff?.yearOfStudy ?? targetOff?.year_of_study ?? (targetOff?.course ? getCourseStudyYear(targetOff.course) : null)
                    const label = typeLabel(a.type)
                    const showSpecific = a.name && a.name.toLowerCase() !== label.toLowerCase()
                    const itemLocked = Boolean(isLockedStatus(targetOff?.gradeStatus))

                    return (
                      <TableRow key={a.id} className="hover:bg-muted/40 transition-colors">
                        <TableCell>
                          <div>
                            <div className="font-medium text-foreground capitalize">
                              {showSpecific ? a.name : label}
                            </div>
                            {showSpecific && (
                              <p className="text-xs text-muted-foreground capitalize">{label}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className="font-mono text-xs font-semibold px-2 py-0.5">
                            {targetOff?.course?.code || a.course?.code || '—'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="tabular font-medium text-sm">
                            {formatYearOfStudy(y)}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="inline-flex items-center gap-1.5 font-semibold font-mono text-sm">
                            <span className="tabular">{a.weight}%</span>
                            <span className="text-xs font-normal text-muted-foreground">of course</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="font-mono text-sm tabular font-medium">
                            {a.maxMarks ?? a.weight ?? 100} marks
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="text-xs font-medium tabular text-muted-foreground">
                            {a.dueDate ? new Date(a.dueDate).toLocaleDateString() : '—'}
                          </span>
                        </TableCell>
                        <TableCell className="text-right pr-4">
                          <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              title="Edit Assessment"
                              aria-label="Edit Assessment"
                              disabled={itemLocked}
                              onClick={() => setDialog({ open: true, assessment: a })}
                            >
                              <Pencil className="size-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                              title="Delete Assessment"
                              aria-label="Delete Assessment"
                              disabled={itemLocked}
                              onClick={() => setDeleting(a)}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            )}

            {/* Pure Cursor-Based Server-Side Pagination Footer */}
            {total > 0 && (
              <div className="flex items-center justify-end gap-1.5 px-4 py-2.5 border-t border-border bg-card/60">
                <Button
                  variant="outline"
                  size="icon-sm"
                  className="size-7"
                  onClick={handlePrevPage}
                  disabled={!hasPrevPage || assessmentsLoading}
                  title="Previous page"
                  aria-label="Previous page"
                >
                  <ChevronLeft className="size-4" />
                </Button>

                <Button
                  variant="outline"
                  size="icon-sm"
                  className="size-7"
                  onClick={handleNextPage}
                  disabled={!hasNextPage || assessmentsLoading}
                  title="Next page"
                  aria-label="Next page"
                >
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Create / Edit Assessment Dialog */}
      <AssessmentFormDialog
        open={dialog.open}
        onOpenChange={(open) => setDialog((d) => ({ ...d, open }))}
        assessment={dialog.assessment}
        offering={dialog.assessment?.offering || offering}
        offerings={offerings ?? []}
        existingAssessments={assessments}
        onSaved={(savedOfferingId) => {
          if (savedOfferingId) {
            const savedOff = (offerings ?? []).find((o) => o.id === savedOfferingId)
            const savedCId = savedOff?.course?.id || savedOff?.courseId || savedOff?.course_id || savedOff?.course?.code || savedOff?.id
            if (savedCId && selectedCourseId && selectedCourseId !== 'all' && selectedCourseId !== savedCId) {
              setSelectedCourseId(savedCId)
            }
            const y = savedOff?.yearOfStudy ?? savedOff?.year_of_study ?? (savedOff?.course ? getCourseStudyYear(savedOff.course) : null)
            if (y && selectedYearOfStudy && selectedYearOfStudy !== 'all' && selectedYearOfStudy !== String(y)) {
              setSelectedYearOfStudy(String(y))
            }
          }
          refetchAssessments()
          refetchOfferings()
        }}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(v) => !v && setDeleting(null)}
        title={`Delete "${deleting?.name}"?`}
        description={
          deleting?.scoreCount > 0
            ? `This assessment has ${deleting.scoreCount} student score(s) entered. Deleting it will permanently remove the assessment and its student marks from the course gradebook. Are you sure you want to proceed?`
            : `Are you sure you want to delete this assessment? This will remove it from the course syllabus and gradebook.`
        }
        confirmLabel="Delete Assessment"
        variant="destructive"
        onConfirm={handleDelete}
      />
    </>
  )
}

export default AssessmentsPage
