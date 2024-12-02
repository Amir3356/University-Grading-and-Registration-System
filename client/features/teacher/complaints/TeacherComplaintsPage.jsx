import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Eye,
  FileQuestion,
  Loader2,
  MessageSquare,
  MessageSquareWarning,
  XCircle,
} from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { EmptyState } from '@/components/common/EmptyState'
import { ErrorState } from '@/components/common/ErrorState'
import { FilterSelect } from '@/components/common/FilterSelect'
import { PageHeader } from '@/components/common/PageHeader'
import { SearchInput } from '@/components/common/SearchInput'
import { StatusBadge } from '@/components/common/StatusBadge'
import { TableSkeleton } from '@/components/common/Loading'
import { useAuth } from '@/context/auth-context'
import { useQuery } from '@/hooks/useStore'
import { useDebounce } from '@/hooks/useDebounce'
import { formatDateTime } from '@/lib/format'
import { useWebSocketEvent } from '@/lib/websocket'
import { store } from '@/store'
import {
  listTeacherComplaints,
  acceptTeacherComplaint,
  respondTeacherComplaint,
} from '@/api/complaints'

const CATEGORY_OPTIONS = [
  { value: 'Grade Discrepancy', label: 'Grade Discrepancy' },
  { value: 'Missing Assessment Mark', label: 'Missing Assessment Mark' },
  { value: 'Assessment Review', label: 'Assessment Review' },
  { value: 'Exam Attendance', label: 'Exam Attendance Issue' },
  { value: 'Course Scheduling', label: 'Course Scheduling Conflict' },
  { value: 'Instructor Absence', label: 'Instructor Absence' },
  { value: 'Academic Policy', label: 'Academic Policy Inquiry' },
  { value: 'Other Academic', label: 'Other Academic Grievance' },
  { value: 'Other', label: 'Other Grievance' },
]


export function TeacherComplaintsPage() {
  const { user } = useAuth()

  // 1. Fetch teacher courses for filter dropdown
  const { data: offerings } = useQuery(() => store.teacher.listMyOfferings({}), [])

  const courseOptions = useMemo(() => {
    const list = offerings ?? []
    const map = new Map()
    for (const o of list) {
      const code = o.course?.code
      if (code) {
        map.set(code, `${code} — ${o.course?.title || o.course?.name || ''}`)
      }
    }
    return [
      { value: 'all', label: 'All Courses' },
      ...Array.from(map.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([value, label]) => ({ value, label })),
    ]
  }, [offerings])

  // 2. Filters & Cursor-Based Pagination State (4 real data rows per page)
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 300)
  const [courseFilter, setCourseFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')

  const [cursor, setCursor] = useState(null)
  const [cursorHistory, setCursorHistory] = useState([])
  const [complaints, setComplaints] = useState([])
  const [total, setTotal] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [nextCursor, setNextCursor] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // 3. Dialog states
  const [selectedComplaint, setSelectedComplaint] = useState(null)
  const [isViewOpen, setIsViewOpen] = useState(false)
  const [isActionOpen, setIsActionOpen] = useState(false)
  const [actionType, setActionType] = useState('accept') // 'accept' | 'resolve'
  const [responseText, setResponseText] = useState('')
  const [submittingAction, setSubmittingAction] = useState(false)

  // Fetch complaints
  const fetchComplaints = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await listTeacherComplaints({
        cursor: cursor || undefined,
        limit: 4,
        search: debouncedSearch.trim() || undefined,
        courseId: courseFilter !== 'all' ? courseFilter : undefined,
        category: categoryFilter !== 'all' ? categoryFilter : undefined,
      })

      if (res && Array.isArray(res.items)) {
        setComplaints(res.items)
        setTotal(res.total ?? res.items.length)
        setNextCursor(res.nextCursor || null)
        setHasMore(Boolean(res.hasMore ?? res.nextCursor))
      } else if (Array.isArray(res)) {
        setComplaints(res.slice(0, 4))
        setTotal(res.length)
        setNextCursor(null)
        setHasMore(false)
      }
    } catch (err) {
      console.warn('Failed to load teacher complaints:', err)
      setError(err)
      toast.error('Could not load student complaints.')
    } finally {
      setLoading(false)
    }
  }, [cursor, debouncedSearch, courseFilter, categoryFilter])

  useEffect(() => {
    fetchComplaints()
  }, [fetchComplaints])

  // Real-time synchronization
  useWebSocketEvent('COMPLAINT_CREATED', () => fetchComplaints())
  useWebSocketEvent('COMPLAINT_UPDATED', () => fetchComplaints())

  // Navigation handlers
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

  const handleCourseChange = (val) => {
    setCourseFilter(val || 'all')
    setCursor(null)
    setCursorHistory([])
  }

  const handleCategoryChange = (val) => {
    setCategoryFilter(val || 'all')
    setCursor(null)
    setCursorHistory([])
  }

  const handleResetFilters = () => {
    setSearch('')
    setCourseFilter('all')
    setCategoryFilter('all')
    setCursor(null)
    setCursorHistory([])
  }

  const isFiltered =
    search.trim() !== '' ||
    courseFilter !== 'all' ||
    categoryFilter !== 'all'

  // Actions
  const handleOpenAccept = (comp) => {
    setSelectedComplaint(comp)
    setActionType('accept')
    setResponseText('Complaint accepted and under review by instructor.')
    setIsActionOpen(true)
  }

  const handleOpenResolve = (comp) => {
    setSelectedComplaint(comp)
    setActionType('resolve')
    setResponseText(comp.response || '')
    setIsActionOpen(true)
  }

  const handleOpenView = (comp) => {
    setSelectedComplaint(comp)
    setIsViewOpen(true)
  }

  const handleSubmitAction = async (targetStatus) => {
    if (!selectedComplaint) return
    setSubmittingAction(true)
    try {
      if (targetStatus === 'in_review') {
        await acceptTeacherComplaint(selectedComplaint.id, {
          status: 'in_review',
          response: responseText.trim() || 'Complaint accepted and currently under review by instructor.',
        })
        toast.success(`Complaint ${selectedComplaint.referenceNo || selectedComplaint.id} marked as Under Review.`)
      } else if (targetStatus === 'resolved') {
        if (!responseText.trim()) {
          toast.error('Please enter a response note to resolve the complaint.')
          setSubmittingAction(false)
          return
        }
        await respondTeacherComplaint(selectedComplaint.id, {
          status: 'resolved',
          response: responseText.trim(),
        })
        toast.success(`Complaint ${selectedComplaint.referenceNo || selectedComplaint.id} resolved successfully.`)
      } else if (targetStatus === 'rejected') {
        if (!responseText.trim()) {
          toast.error('Please provide a reason for dismissing the complaint.')
          setSubmittingAction(false)
          return
        }
        await respondTeacherComplaint(selectedComplaint.id, {
          status: 'rejected',
          response: responseText.trim(),
        })
        toast.info(`Complaint ${selectedComplaint.referenceNo || selectedComplaint.id} dismissed.`)
      }

      setIsActionOpen(false)
      fetchComplaints()
    } catch (err) {
      toast.error(err.message || 'Failed to update complaint.')
    } finally {
      setSubmittingAction(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Student Complaints"
        description="Review, accept, and resolve academic complaints and grading inquiries submitted by students."
        centered
      />

      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        {/* Controls Toolbar */}
        <div className="p-4 border-b border-border bg-card/50 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          <div className="w-full md:w-80">
            <SearchInput
              value={search}
              onChange={handleSearchChange}
              placeholder="Search student, ID, reason, or course…"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {courseOptions.length > 1 && (
              <div className="w-44">
                <FilterSelect
                  value={courseFilter}
                  onChange={handleCourseChange}
                  options={courseOptions}
                  placeholder="All Courses"
                  includeAll={false}
                />
              </div>
            )}

            <div className="w-44">
              <FilterSelect
                value={categoryFilter}
                onChange={handleCategoryChange}
                options={[{ value: 'all', label: 'All Categories' }, ...CATEGORY_OPTIONS]}
                placeholder="All Categories"
                includeAll={false}
              />
            </div>


            {isFiltered && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleResetFilters}
                className="text-xs text-muted-foreground hover:text-foreground h-9 px-3"
              >
                Reset filters
              </Button>
            )}
          </div>
        </div>

        {/* Content Section */}
        {loading && complaints.length === 0 ? (
          <div className="p-6">
            <TableSkeleton rows={5} columns={8} />
          </div>
        ) : error ? (
          <div className="p-8">
            <ErrorState
              title="Failed to load complaints"
              message={error?.message || 'An error occurred while loading complaints.'}
              onRetry={fetchComplaints}
            />
          </div>
        ) : complaints.length === 0 ? (
          <div className="p-12">
            <EmptyState
              icon={MessageSquareWarning}
              title="No student complaints found"
              description={
                isFiltered
                  ? 'No complaints match the selected filters. Try clearing search or filters.'
                  : 'Complaints submitted by students in your courses will appear here.'
              }
            />
          </div>
        ) : (
          <div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent border-b border-border bg-muted/40 text-xs">
                    <TableHead className="font-semibold text-foreground py-3">Student Name</TableHead>
                    <TableHead className="font-semibold text-foreground py-3">Course</TableHead>
                    <TableHead className="font-semibold text-foreground py-3">Category</TableHead>
                    <TableHead className="font-semibold text-foreground py-3">Reason</TableHead>
                    <TableHead className="font-semibold text-foreground py-3 text-center">Priority</TableHead>
                    <TableHead className="font-semibold text-foreground py-3">Submitted</TableHead>
                    <TableHead className="font-semibold text-foreground py-3 text-center">Status</TableHead>
                    <TableHead className="font-semibold text-foreground py-3 text-right pr-4">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {complaints.map((comp) => {
                    const isPending = comp.status === 'pending'
                    const isInReview = comp.status === 'in_review'
                    const isResolved = comp.status === 'resolved' || comp.status === 'rejected'

                    const priorityClass =
                      comp.priority === 'Urgent'
                        ? 'border-red-300 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400'
                        : comp.priority === 'High'
                        ? 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-400'
                        : 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900/30 dark:text-slate-300'

                    return (
                      <TableRow
                        key={comp.id}
                        className="hover:bg-muted/30 transition-colors cursor-pointer"
                        onClick={() => handleOpenView(comp)}
                      >
                        <TableCell className="py-3">
                          <div className="font-medium text-foreground text-sm">{comp.studentName || 'Student'}</div>
                          <div className="text-xs text-muted-foreground">{comp.studentNumber}</div>
                        </TableCell>
                        <TableCell className="py-3">
                          <span className="font-semibold text-foreground text-xs">{comp.courseCode}</span>
                          {comp.courseName && (
                            <p className="text-[11px] text-muted-foreground truncate max-w-44">{comp.courseName}</p>
                          )}
                        </TableCell>
                        <TableCell className="py-3">
                          <Badge variant="outline" className="text-[11px] font-normal">
                            {comp.category}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-3 max-w-xs">
                          <p className="text-sm font-medium text-foreground line-clamp-2">{comp.reason}</p>
                        </TableCell>
                        <TableCell className="py-3 text-center">
                          <span className={`inline-block text-[11px] font-medium px-2 py-0.5 rounded-full border ${priorityClass}`}>
                            {comp.priority}
                          </span>
                        </TableCell>
                        <TableCell className="py-3 text-xs text-muted-foreground whitespace-nowrap">
                          {formatDateTime(comp.submittedAt)}
                        </TableCell>
                        <TableCell className="py-3 text-center">
                          <StatusBadge status={comp.status} label={comp.statusLabel || comp.status} />
                        </TableCell>
                        <TableCell className="py-3 text-right pr-4" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1.5">
                            {isPending && (
                              <Button
                                size="sm"
                                variant="default"
                                className="h-8 px-2.5 text-xs gap-1.5 font-medium bg-blue-600 hover:bg-blue-700 text-white"
                                onClick={() => handleOpenAccept(comp)}
                                title="Accept Student Complaint"
                              >
                                <CheckCircle2 className="size-3.5" />
                                Accept
                              </Button>
                            )}

                            {isInReview && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 px-2.5 text-xs gap-1.5 font-medium border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-400 dark:hover:bg-emerald-950/40"
                                onClick={() => handleOpenResolve(comp)}
                                title="Resolve Complaint"
                              >
                                <Check className="size-3.5" />
                                Resolve
                              </Button>
                            )}

                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
                              onClick={() => handleOpenView(comp)}
                              title="View Details"
                            >
                              <Eye className="size-3.5" />
                            </Button>
                          </div>
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

      {/* Accept / Resolve Action Dialog */}
      <Dialog open={isActionOpen} onOpenChange={setIsActionOpen}>
        <DialogContent className="max-w-lg" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="size-5 text-primary" />
              {actionType === 'accept' ? 'Accept Student Complaint' : 'Resolve Student Complaint'}
            </DialogTitle>
            <DialogDescription>
              {actionType === 'accept'
                ? 'Accept this student complaint and transition its status to Under Review.'
                : 'Provide the official instructor response to resolve or close this complaint.'}
            </DialogDescription>
          </DialogHeader>

          {selectedComplaint && (
            <div className="space-y-4 py-2 text-sm">
              <div className="p-3 rounded-lg bg-muted/40 border border-border/70 space-y-1.5 text-xs">
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-foreground">{selectedComplaint.studentName} ({selectedComplaint.studentNumber})</span>
                  <Badge variant="outline">{selectedComplaint.courseCode}</Badge>
                </div>
                <div className="text-muted-foreground">{selectedComplaint.category} — {selectedComplaint.priority} Priority</div>
                <div className="pt-1 text-foreground font-medium">{selectedComplaint.reason}</div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="teacher-response">
                  {actionType === 'accept' ? 'Review Note / Acceptance Remark (Optional)' : 'Resolution & Feedback (Required)'}
                </Label>
                <Textarea
                  id="teacher-response"
                  rows={4}
                  value={responseText}
                  onChange={(e) => setResponseText(e.target.value)}
                  placeholder="Enter detailed feedback, grade corrections, or review findings for the student…"
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setIsActionOpen(false)} disabled={submittingAction}>
              Cancel
            </Button>
            {actionType === 'accept' ? (
              <Button
                onClick={() => handleSubmitAction('in_review')}
                disabled={submittingAction}
                className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5"
              >
                {submittingAction && <Loader2 className="size-4 animate-spin" />}
                Confirm & Accept
              </Button>
            ) : (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  className="text-destructive hover:bg-destructive/10 border-destructive/30"
                  onClick={() => handleSubmitAction('rejected')}
                  disabled={submittingAction}
                >
                  Dismiss
                </Button>
                <Button
                  onClick={() => handleSubmitAction('resolved')}
                  disabled={submittingAction}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
                >
                  {submittingAction && <Loader2 className="size-4 animate-spin" />}
                  Resolve Complaint
                </Button>
              </div>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Complaint Detail Dialog */}
      <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
        <DialogContent className="max-w-xl" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquareWarning className="size-5 text-primary" />
              Complaint Details — {selectedComplaint?.referenceNo || selectedComplaint?.id}
            </DialogTitle>
          </DialogHeader>

          {selectedComplaint && (
            <div className="space-y-4 py-2 text-sm">
              <div className="grid grid-cols-2 gap-3 text-xs bg-muted/30 p-3 rounded-lg border">
                <div>
                  <span className="text-muted-foreground block">Student:</span>
                  <span className="font-semibold text-foreground">{selectedComplaint.studentName}</span>
                  <span className="text-muted-foreground block">{selectedComplaint.studentNumber}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Course:</span>
                  <span className="font-semibold text-foreground">{selectedComplaint.courseCode}</span>
                  <span className="text-muted-foreground block truncate">{selectedComplaint.courseName}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Category:</span>
                  <Badge variant="outline" className="mt-0.5">{selectedComplaint.category}</Badge>
                </div>
                <div>
                  <span className="text-muted-foreground block">Status:</span>
                  <div className="mt-0.5">
                    <StatusBadge status={selectedComplaint.status} label={selectedComplaint.statusLabel || selectedComplaint.status} />
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground block">Submitted:</span>
                  <span className="text-foreground">{formatDateTime(selectedComplaint.submittedAt)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Priority:</span>
                  <span className="font-medium text-foreground capitalize">{selectedComplaint.priority}</span>
                </div>
              </div>

              <div>
                <Label className="text-xs text-muted-foreground">Reason / Grievance:</Label>
                <div className="mt-1 p-3 rounded-md bg-muted/40 border text-sm text-foreground whitespace-pre-wrap">
                  {selectedComplaint.reason}
                </div>
              </div>

              {selectedComplaint.response && (
                <div>
                  <Label className="text-xs text-muted-foreground">Instructor Response:</Label>
                  <div className="mt-1 p-3 rounded-md bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900 text-sm text-foreground whitespace-pre-wrap">
                    <div className="text-xs text-muted-foreground mb-1">
                      By {selectedComplaint.respondedBy || 'Instructor'} on {formatDateTime(selectedComplaint.respondedAt)}
                    </div>
                    {selectedComplaint.response}
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            {selectedComplaint?.status === 'pending' && (
              <Button
                onClick={() => {
                  setIsViewOpen(false)
                  handleOpenAccept(selectedComplaint)
                }}
                className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5"
              >
                <CheckCircle2 className="size-4" />
                Accept Complaint
              </Button>
            )}
            {selectedComplaint?.status === 'in_review' && (
              <Button
                onClick={() => {
                  setIsViewOpen(false)
                  handleOpenResolve(selectedComplaint)
                }}
                className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
              >
                <Check className="size-4" />
                Resolve Complaint
              </Button>
            )}
            <Button variant="outline" onClick={() => setIsViewOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default TeacherComplaintsPage
