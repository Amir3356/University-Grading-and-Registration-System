import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  FileQuestion,
  Loader2,
  MessageSquareWarning,
  Pencil,
  Plus,
  Send,
  Trash2,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { FilterSelect } from '@/components/common/FilterSelect'
import { PageHeader } from '@/components/common/PageHeader'
import { SearchInput } from '@/components/common/SearchInput'
import { ProgramTypeBadge, StatusBadge } from '@/components/common/StatusBadge'
import { useAuth } from '@/context/auth-context'
import { useQuery } from '@/hooks/useStore'
import { formatDateTime, getStudentCurrentYearOfStudy } from '@/lib/format'
import { useWebSocketEvent } from '@/lib/websocket'
import { store } from '@/store'
import {
  listStudentComplaints,
  submitStudentComplaint,
  updateStudentComplaint,
  cancelStudentComplaint,
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

const PRIORITY_OPTIONS = [
  { value: 'Normal', label: 'Normal' },
  { value: 'High', label: 'High' },
  { value: 'Urgent', label: 'Urgent' },
]

const STATUS_FILTER_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'in_review', label: 'Under Review' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'rejected', label: 'Dismissed' },
]

export function ComplaintsPage() {
  const { user, profile } = useAuth()

  // Enrolled courses for dropdown selection
  const { data: coursesData } = useQuery(() => store.student.listMyCourses(), [])
  const coursesList = useMemo(() => {
    const list = Array.isArray(coursesData) ? coursesData : coursesData?.courses || coursesData?.items || []
    return list.map((c) => ({
      id: c.course?.id || c.enrollmentId,
      code: c.course?.code || '—',
      title: c.course?.title || 'Course',
    }))
  }, [coursesData])

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')

  // Server-side Cursor Pagination State (3 real data rows per page)
  const [cursor, setCursor] = useState(null)
  const [cursorHistory, setCursorHistory] = useState([]) // Stack of previous cursors
  const [total, setTotal] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [nextCursor, setNextCursor] = useState(null)
  const [complaints, setComplaints] = useState([])
  const [loading, setLoading] = useState(false)

  // Modal Dialog states
  const [isSubmitOpen, setIsSubmitOpen] = useState(false)
  const [isViewOpen, setIsViewOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [activeComplaint, setActiveComplaint] = useState(null)
  const [complaintToDelete, setComplaintToDelete] = useState(null)

  // Submit Form state
  const [form, setForm] = useState({
    courseId: '',
    category: 'Grade Discrepancy',
    priority: 'Normal',
    reason: '',
  })
  const [formError, setFormError] = useState('')

  // Edit Form state
  const [editForm, setEditForm] = useState({
    category: '',
    priority: '',
    reason: '',
  })

  // Debounce search input to avoid hitting server on every keystroke
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery)
      setCursor(null)
      setCursorHistory([])
    }, 350)
    return () => clearTimeout(timer)
  }, [searchQuery])

  // Fetch paginated complaints from the backend using cursor pagination (3 items per page)
  const fetchComplaints = useCallback(async () => {
    setLoading(true)
    try {
      const res = await listStudentComplaints({
        cursor: cursor || undefined,
        limit: 3,
        category: categoryFilter || undefined,
        status: statusFilter || undefined,
        search: debouncedSearch.trim() || undefined,
      })

      if (res && Array.isArray(res.items)) {
        setComplaints(res.items)
        setTotal(res.total ?? res.items.length)
        setNextCursor(res.nextCursor || null)
        setHasMore(Boolean(res.hasMore ?? res.nextCursor))
      } else if (Array.isArray(res)) {
        setComplaints(res.slice(0, 3))
        setTotal(res.length)
        setNextCursor(null)
        setHasMore(false)
      }
    } catch (err) {
      console.warn('Failed to fetch complaints from server:', err)
      toast.error('Could not load complaints from server.')
    } finally {
      setLoading(false)
    }
  }, [cursor, categoryFilter, statusFilter, debouncedSearch])

  useEffect(() => {
    fetchComplaints()
  }, [fetchComplaints])

  // Real-time synchronization when instructor accepts, updates or resolves a complaint
  useWebSocketEvent('COMPLAINT_UPDATED', () => fetchComplaints())
  useWebSocketEvent('COMPLAINT_CREATED', () => fetchComplaints())

  const handleOpenSubmit = () => {
    setForm({
      courseId: coursesList[0]?.id || '',
      category: 'Grade Discrepancy',
      priority: 'Normal',
      reason: '',
    })
    setFormError('')
    setIsSubmitOpen(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.reason.trim()) {
      setFormError('Please enter the reason for your complaint.')
      return
    }

    try {
      await submitStudentComplaint({
        courseId: form.courseId || null,
        category: form.category,
        priority: form.priority,
        reason: form.reason.trim(),
      })
      toast.success('Your complaint has been submitted successfully to the department.')
      setIsSubmitOpen(false)
      setCursor(null)
      setCursorHistory([])
      fetchComplaints()
    } catch (err) {
      toast.error(err.message || 'Failed to submit complaint.')
    }
  }

  const handleOpenEdit = (comp) => {
    setActiveComplaint(comp)
    setEditForm({
      category: comp.category,
      priority: comp.priority,
      reason: comp.reason || comp.description || comp.title || '',
    })
    setIsEditOpen(true)
  }

  const handleSaveEdit = async (e) => {
    e.preventDefault()
    if (!editForm.reason.trim()) {
      toast.error('Reason cannot be empty.')
      return
    }

    try {
      await updateStudentComplaint(activeComplaint.id, {
        category: editForm.category,
        priority: editForm.priority,
        reason: editForm.reason.trim(),
      })
      toast.success('Complaint updated successfully.')
      setIsEditOpen(false)
      fetchComplaints()
    } catch (err) {
      toast.error(err.message || 'Failed to update complaint.')
    }
  }

  const handleConfirmDelete = async () => {
    if (!complaintToDelete) return
    try {
      await cancelStudentComplaint(complaintToDelete.id)
      toast.success(`Complaint ${complaintToDelete.referenceNo || complaintToDelete.id} cancelled.`)
      setComplaintToDelete(null)
      fetchComplaints()
    } catch (err) {
      toast.error(err.message || 'Failed to cancel complaint.')
    }
  }

  const studentCurrentYear = getStudentCurrentYearOfStudy(profile || user)
  const studentProgramType = profile?.program_type || profile?.programType || user?.programType || 'regular'

  // Cursor navigation handlers
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
        title="Complaints"
        description="Submit and track academic grievances, assessment mark inquiries, or grading reviews."
        centered
        actions={
          <Button onClick={handleOpenSubmit} className="gap-2 font-medium">
            <Plus className="size-4" />
            Submit Complaint
          </Button>
        }
      />

      {/* Toolbar / Filters */}
      <div className="toolbar--split mb-6">
        <div className="toolbar--split__left">
          <SearchInput
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search complaint ID, course, reason, or keyword…"
            className="w-full sm:w-80"
          />
        </div>

        <div className="toolbar--split__right flex flex-wrap items-center gap-2">
          <div className="w-44">
            <FilterSelect
              value={categoryFilter}
              onChange={(val) => {
                setCategoryFilter(val)
                setCursor(null)
                setCursorHistory([])
              }}
              allLabel="All Categories"
              placeholder="All Categories"
              options={CATEGORY_OPTIONS}
              className="w-44 h-10"
            />
          </div>

          <div className="w-40">
            <FilterSelect
              value={statusFilter}
              onChange={(val) => {
                setStatusFilter(val)
                setCursor(null)
                setCursorHistory([])
              }}
              allLabel="All Statuses"
              placeholder="All Statuses"
              options={STATUS_FILTER_OPTIONS}
              className="w-40 h-10"
            />
          </div>

          {(searchQuery || statusFilter || categoryFilter) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearchQuery('')
                setStatusFilter('')
                setCategoryFilter('')
                setCursor(null)
                setCursorHistory([])
              }}
              className="text-xs text-muted-foreground hover:text-foreground h-9 px-3"
            >
              Reset filters
            </Button>
          )}
        </div>
      </div>

      {/* Table Card */}
      <Card className="border shadow-sm">
        <CardContent className="p-0">
          <div className="table-wrap">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="font-semibold text-foreground">Course</TableHead>
                  <TableHead className="font-semibold text-foreground">Category</TableHead>
                  <TableHead className="font-semibold text-foreground">Reason</TableHead>
                  <TableHead className="font-semibold text-foreground text-center">Priority</TableHead>
                  <TableHead className="font-semibold text-foreground">Submitted</TableHead>
                  <TableHead className="font-semibold text-foreground">Status</TableHead>
                  <TableHead className="font-semibold text-foreground text-right pr-4">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-12 text-center text-muted-foreground">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Loader2 className="size-6 animate-spin text-primary" />
                        <span className="text-xs">Loading complaints from server…</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : complaints.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-12 text-center text-muted-foreground">
                      <div className="flex flex-col items-center justify-center gap-1.5">
                        <FileQuestion className="size-8 text-muted-foreground/50 mb-1" />
                        <span className="font-semibold text-foreground text-sm">No complaints found</span>
                        <span className="text-xs">
                          {searchQuery || statusFilter || categoryFilter
                            ? 'No complaints match your active filter criteria.'
                            : 'You have not submitted any complaints yet.'}
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  complaints.map((comp) => {
                    const isPending = comp.status === 'pending'
                    const priorityClass =
                      comp.priority === 'Urgent'
                        ? 'border-red-300 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400'
                        : comp.priority === 'High'
                        ? 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-400'
                        : 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900/30 dark:text-slate-300'

                    return (
                      <TableRow
                        key={comp.id}
                        className="hover:bg-muted/50 transition-colors cursor-pointer"
                        onClick={() => {
                          setActiveComplaint(comp)
                          setIsViewOpen(true)
                        }}
                      >
                        <TableCell>
                          <div className="font-semibold text-xs text-foreground">{comp.courseCode}</div>
                          <div className="text-[11px] text-muted-foreground truncate max-w-44">{comp.courseName}</div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[11px] font-normal">
                            {comp.category}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className="font-medium text-foreground text-sm line-clamp-2">
                            {comp.reason || comp.title}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className={`inline-block text-[11px] font-medium px-2 py-0.5 rounded-full border ${priorityClass}`}>
                            {comp.priority}
                          </span>
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                          {formatDateTime(comp.submittedAt)}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={comp.status} label={comp.statusLabel || comp.status} />
                        </TableCell>
                        <TableCell className="text-right pr-4" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1">
                            {isPending ? (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  className="size-8 text-muted-foreground hover:text-foreground"
                                  title="Edit Pending Complaint"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleOpenEdit(comp)
                                  }}
                                >
                                  <Pencil className="size-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  className="size-8 text-destructive hover:bg-destructive/10"
                                  title="Cancel Complaint"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setComplaintToDelete(comp)
                                  }}
                                >
                                  <Trash2 className="size-4" />
                                </Button>
                              </>
                            ) : (
                              <span className="text-xs text-muted-foreground pr-2">—</span>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {/* Server-Side Cursor Pagination: Previous and Next arrow icons (3 real data rows per page) */}
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
        </CardContent>
      </Card>

      {/* Submit Complaint Dialog */}
      <Dialog open={isSubmitOpen} onOpenChange={setIsSubmitOpen}>
        <DialogContent className="max-w-xl" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquareWarning className="size-5 text-primary" />
              Submit Academic Complaint
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-6 py-4">
            {formError && (
              <div className="p-3 text-xs bg-destructive/10 text-destructive border border-destructive/20 rounded-md">
                {formError}
              </div>
            )}

            {/* Course Field - Full Width with clear spacing */}
            <div className="flex flex-col gap-2.5">
              <Label htmlFor="comp-course" className="text-sm font-semibold text-foreground flex items-center justify-between">
                <span>Course</span>
                <span className="text-xs text-muted-foreground font-normal">Select affected course</span>
              </Label>
              <Select value={form.courseId} onValueChange={(v) => setForm((f) => ({ ...f, courseId: v }))}>
                <SelectTrigger id="comp-course" className="h-11 w-full px-3.5 text-sm rounded-lg bg-background border shadow-xs">
                  <SelectValue placeholder="Select course…" />
                </SelectTrigger>
                <SelectContent>
                  {coursesList.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.code} · {c.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Category & Priority Fields - Side by Side Grid with clear spacing */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-6">
              <div className="flex flex-col gap-2.5">
                <Label htmlFor="comp-category" className="text-sm font-semibold text-foreground">
                  Complaint Category
                </Label>
                <Select value={form.category} onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}>
                  <SelectTrigger id="comp-category" className="h-11 w-full px-3.5 text-sm rounded-lg bg-background border shadow-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORY_OPTIONS.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-2.5">
                <Label htmlFor="comp-priority" className="text-sm font-semibold text-foreground">
                  Priority Level
                </Label>
                <Select value={form.priority} onValueChange={(v) => setForm((f) => ({ ...f, priority: v }))}>
                  <SelectTrigger id="comp-priority" className="h-11 w-full px-3.5 text-sm rounded-lg bg-background border shadow-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITY_OPTIONS.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Reason Field */}
            <div className="flex flex-col gap-2.5">
              <Label htmlFor="comp-reason" className="text-sm font-semibold text-foreground flex items-center justify-between">
                <span>Reason</span>
                <span className="text-xs text-muted-foreground font-normal">Detailed explanation of the issue</span>
              </Label>
              <Textarea
                id="comp-reason"
                value={form.reason}
                onChange={(e) => {
                  setForm((f) => ({ ...f, reason: e.target.value }))
                  if (formError) setFormError('')
                }}
                placeholder="Enter the reason for your complaint in detail..."
                rows={4}
                className="min-h-[110px] resize-y p-3.5 text-sm leading-relaxed rounded-lg"
                required
              />
            </div>

            {/* Student Context Preview */}
            <div className="rounded-xl bg-muted/40 p-4 border text-xs text-muted-foreground flex flex-wrap gap-5 items-center mt-6">
              <div>
                <span className="font-semibold text-foreground">Current Year: </span>
                <span>{studentCurrentYear}</span>
              </div>
              <div>
                <span className="font-semibold text-foreground">Program: </span>
                <ProgramTypeBadge programType={studentProgramType} className="ml-1" />
              </div>
              <div>
                <span className="font-semibold text-foreground">Department: </span>
                <span>{profile?.department?.name || 'Computer Science'}</span>
              </div>
            </div>

            <DialogFooter className="pt-4 border-t mt-6 flex items-center justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setIsSubmitOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" className="gap-2">
                <Send className="size-4" />
                Submit
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Complaint Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="size-4" />
              Edit Complaint {activeComplaint?.id}
            </DialogTitle>
            <DialogDescription>
              Update your complaint before it is taken under department review.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveEdit} className="space-y-6 py-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-6">
              <div className="flex flex-col gap-2.5">
                <Label htmlFor="edit-comp-category" className="text-sm font-semibold text-foreground">Complaint Category</Label>
                <Select value={editForm.category} onValueChange={(v) => setEditForm((f) => ({ ...f, category: v }))}>
                  <SelectTrigger id="edit-comp-category" className="h-11 w-full px-3.5 text-sm rounded-lg bg-background border shadow-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORY_OPTIONS.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-2.5">
                <Label htmlFor="edit-comp-priority" className="text-sm font-semibold text-foreground">Priority Level</Label>
                <Select value={editForm.priority} onValueChange={(v) => setEditForm((f) => ({ ...f, priority: v }))}>
                  <SelectTrigger id="edit-comp-priority" className="h-11 w-full px-3.5 text-sm rounded-lg bg-background border shadow-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITY_OPTIONS.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex flex-col gap-2.5">
              <Label htmlFor="edit-comp-reason" className="text-sm font-semibold text-foreground">Reason</Label>
              <Textarea
                id="edit-comp-reason"
                value={editForm.reason}
                onChange={(e) => setEditForm((f) => ({ ...f, reason: e.target.value }))}
                placeholder="Enter the reason for your complaint..."
                rows={4}
                className="min-h-[110px] resize-y p-3.5 text-sm leading-relaxed rounded-lg"
                required
              />
            </div>

            <DialogFooter className="pt-4 border-t mt-6 flex items-center justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setIsEditOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Save Changes</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* View Detail Dialog */}
      <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <div className="flex items-center justify-between gap-3">
              <DialogTitle className="flex items-center gap-2">
                <MessageSquareWarning className="size-5 text-primary" />
                Complaint Details · {activeComplaint?.id}
              </DialogTitle>
              {activeComplaint && (
                <StatusBadge status={activeComplaint.status} label={activeComplaint.statusLabel || activeComplaint.status} />
              )}
            </div>
            <DialogDescription>
              Submitted on {activeComplaint ? formatDateTime(activeComplaint.submittedAt) : '—'}
            </DialogDescription>
          </DialogHeader>

          {activeComplaint && (
            <div className="space-y-4 py-2 text-sm">
              <div className="grid grid-cols-2 gap-3 p-3 bg-muted/40 rounded-lg border text-xs">
                <div className="col-span-2">
                  <span className="text-muted-foreground block mb-0.5">Course:</span>
                  <span className="font-semibold text-foreground text-sm">{activeComplaint.courseCode} · {activeComplaint.courseName}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block mb-0.5">Category:</span>
                  <span className="font-medium text-foreground">{activeComplaint.category}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block mb-0.5">Priority:</span>
                  <span className="font-medium text-foreground">{activeComplaint.priority}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-muted-foreground block mb-0.5">Student:</span>
                  <span className="font-medium text-foreground">{activeComplaint.studentName} ({activeComplaint.studentId})</span>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-semibold text-muted-foreground">Reason</Label>
                <div className="p-3.5 rounded-lg bg-card border text-foreground text-sm leading-relaxed whitespace-pre-wrap">
                  {activeComplaint.reason || activeComplaint.description || activeComplaint.title}
                </div>
              </div>

              {activeComplaint.response ? (
                <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded-lg">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-800 dark:text-emerald-400 mb-1">
                    <CheckCircle2 className="size-4" />
                    Department Response & Resolution
                  </div>
                  <p className="text-xs text-emerald-900 dark:text-emerald-300 leading-relaxed">
                    {activeComplaint.response}
                  </p>
                  {activeComplaint.respondedBy && (
                    <div className="mt-2 text-[11px] text-emerald-700/80 dark:text-emerald-400/80">
                      Responded by: {activeComplaint.respondedBy} · {formatDateTime(activeComplaint.respondedAt)}
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-3 bg-muted/30 border border-dashed rounded-lg text-xs text-muted-foreground flex items-center gap-2">
                  <Clock className="size-4" />
                  This complaint is pending review by the instructor or department head.
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsViewOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Delete Dialog */}
      <ConfirmDialog
        open={Boolean(complaintToDelete)}
        onOpenChange={(open) => !open && setComplaintToDelete(null)}
        title="Cancel Complaint?"
        description={`Are you sure you want to cancel complaint ${complaintToDelete?.id}? This action cannot be undone.`}
        confirmLabel="Yes, Cancel Complaint"
        variant="destructive"
        onConfirm={handleConfirmDelete}
      />
    </div>
  )
}

export default ComplaintsPage
