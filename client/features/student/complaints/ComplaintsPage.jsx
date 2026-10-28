import { useMemo, useState } from 'react'
import {
  CheckCircle2,
  Clock,
  Eye,
  FileQuestion,
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
import { Input } from '@/components/ui/input'
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
import { useComplaints } from '@/store/complaintsStore'
import { store } from '@/store'

const CATEGORY_OPTIONS = [
  { value: 'Grade Discrepancy', label: 'Grade Discrepancy' },
  { value: 'Missing Assessment Mark', label: 'Missing Assessment Mark' },
  { value: 'Exam Attendance', label: 'Exam Attendance Issue' },
  { value: 'Course Scheduling', label: 'Course Scheduling Conflict' },
  { value: 'Academic Policy', label: 'Academic Policy Inquiry' },
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
  const { complaints, addComplaint, updateComplaint, deleteComplaint } = useComplaints()

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
  const [statusFilter, setStatusFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')

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
    title: '',
    description: '',
  })
  const [formError, setFormError] = useState('')

  // Edit Form state
  const [editForm, setEditForm] = useState({
    category: '',
    priority: '',
    title: '',
    description: '',
  })

  // Filtered complaints list
  const filteredComplaints = useMemo(() => {
    return complaints.filter((c) => {
      if (statusFilter && c.status !== statusFilter) return false
      if (categoryFilter && c.category !== categoryFilter) return false
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim()
        const matchId = String(c.id || '').toLowerCase().includes(q)
        const matchCode = String(c.courseCode || '').toLowerCase().includes(q)
        const matchTitle = String(c.title || '').toLowerCase().includes(q)
        const matchCat = String(c.category || '').toLowerCase().includes(q)
        const matchDesc = String(c.description || '').toLowerCase().includes(q)
        if (!matchId && !matchCode && !matchTitle && !matchCat && !matchDesc) return false
      }
      return true
    })
  }, [complaints, statusFilter, categoryFilter, searchQuery])


  const handleOpenSubmit = () => {
    setForm({
      courseId: coursesList[0]?.id || '',
      category: 'Grade Discrepancy',
      priority: 'Normal',
      title: '',
      description: '',
    })
    setFormError('')
    setIsSubmitOpen(true)
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!form.title.trim()) {
      setFormError('Please enter a brief complaint subject or title.')
      return
    }
    if (!form.description.trim()) {
      setFormError('Please enter a detailed description of your grievance.')
      return
    }

    const matchedCourse = coursesList.find((c) => c.id === form.courseId)

    addComplaint({
      courseId: form.courseId || '',
      courseCode: matchedCourse ? matchedCourse.code : 'General',
      courseName: matchedCourse ? matchedCourse.title : 'General Academic / Department',
      category: form.category,
      priority: form.priority,
      title: form.title,
      description: form.description,
    })

    toast.success('Your complaint has been submitted successfully to the department.')
    setIsSubmitOpen(false)
  }

  const handleOpenEdit = (comp) => {
    setActiveComplaint(comp)
    setEditForm({
      category: comp.category,
      priority: comp.priority,
      title: comp.title,
      description: comp.description,
    })
    setIsEditOpen(true)
  }

  const handleSaveEdit = (e) => {
    e.preventDefault()
    if (!editForm.title.trim() || !editForm.description.trim()) {
      toast.error('Title and description cannot be empty.')
      return
    }
    updateComplaint(activeComplaint.id, {
      category: editForm.category,
      priority: editForm.priority,
      title: editForm.title,
      description: editForm.description,
    })
    toast.success('Complaint updated successfully.')
    setIsEditOpen(false)
  }

  const handleConfirmDelete = () => {
    if (!complaintToDelete) return
    deleteComplaint(complaintToDelete.id)
    toast.success(`Complaint ${complaintToDelete.id} cancelled.`)
    setComplaintToDelete(null)
  }

  const studentCurrentYear = getStudentCurrentYearOfStudy(profile || user)
  const studentProgramType = profile?.program_type || profile?.programType || user?.programType || 'regular'

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
      <div className="toolbar--split mb-4">
        <div className="toolbar--split__left">
          <SearchInput
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search complaint ID, course, title, or keyword…"
            className="w-80"
          />
        </div>

        <div className="toolbar--split__right flex flex-wrap items-center gap-2.5">
          <FilterSelect
            label="Category"
            value={categoryFilter}
            onChange={setCategoryFilter}
            allLabel="All Categories"
            options={CATEGORY_OPTIONS}
            className="w-48"
          />

          <FilterSelect
            label="Status"
            value={statusFilter}
            onChange={setStatusFilter}
            allLabel="All Statuses"
            options={STATUS_FILTER_OPTIONS}
            className="w-40"
          />

          {(searchQuery || statusFilter || categoryFilter) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearchQuery('')
                setStatusFilter('')
                setCategoryFilter('')
              }}
              className="text-xs text-muted-foreground hover:text-foreground h-9"
            >
              Reset filters
            </Button>
          )}

          <div className="text-xs text-muted-foreground font-medium whitespace-nowrap pl-1">
            Showing <span className="font-semibold text-foreground">{filteredComplaints.length}</span> of {complaints.length}
          </div>
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
                  <TableHead className="font-semibold text-foreground">Subject / Summary</TableHead>
                  <TableHead className="font-semibold text-foreground text-center">Priority</TableHead>
                  <TableHead className="font-semibold text-foreground">Submitted</TableHead>
                  <TableHead className="font-semibold text-foreground">Status</TableHead>
                  <TableHead className="font-semibold text-foreground text-right pr-4">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredComplaints.length === 0 ? (
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
                  filteredComplaints.map((comp) => {
                    const isPending = comp.status === 'pending'
                    const priorityClass =
                      comp.priority === 'Urgent'
                        ? 'border-red-300 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400'
                        : comp.priority === 'High'
                        ? 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-400'
                        : 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900/30 dark:text-slate-300'

                    return (
                      <TableRow key={comp.id} className="hover:bg-muted/50 transition-colors">
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
                          <span className="font-medium text-foreground text-sm line-clamp-1">{comp.title}</span>
                          <span className="text-xs text-muted-foreground line-clamp-1">{comp.description}</span>
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
                        <TableCell className="text-right pr-4">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              className="size-8"
                              title="View Complaint Details"
                              onClick={() => {
                                setActiveComplaint(comp)
                                setIsViewOpen(true)
                              }}
                            >
                              <Eye className="size-4" />
                            </Button>
                            {isPending && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  className="size-8 text-muted-foreground hover:text-foreground"
                                  title="Edit Pending Complaint"
                                  onClick={() => handleOpenEdit(comp)}
                                >
                                  <Pencil className="size-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  className="size-8 text-destructive hover:bg-destructive/10"
                                  title="Cancel Complaint"
                                  onClick={() => setComplaintToDelete(comp)}
                                >
                                  <Trash2 className="size-4" />
                                </Button>
                              </>
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

          <form onSubmit={handleSubmit} className="space-y-4 py-2">
            {formError && (
              <div className="p-3 text-xs bg-destructive/10 text-destructive border border-destructive/20 rounded-md">
                {formError}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="comp-course">Course</Label>
                <Select value={form.courseId} onValueChange={(v) => setForm((f) => ({ ...f, courseId: v }))}>
                  <SelectTrigger id="comp-course">
                    <SelectValue placeholder="Select course…" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">General / Department Issue</SelectItem>
                    {coursesList.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.code} · {c.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="comp-category">Complaint Category</Label>
                <Select value={form.category} onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}>
                  <SelectTrigger id="comp-category">
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
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="comp-priority">Priority Level</Label>
              <Select value={form.priority} onValueChange={(v) => setForm((f) => ({ ...f, priority: v }))}>
                <SelectTrigger id="comp-priority" className="w-full sm:w-1/2">
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

            <div className="space-y-1.5">
              <Label htmlFor="comp-title">Subject / Title</Label>
              <Input
                id="comp-title"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="e.g. Midterm assessment mark calculation issue"
                maxLength={120}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="comp-desc">Detailed Grievance Description</Label>
              <Textarea
                id="comp-desc"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Please state clearly what occurred, include test dates, exam paper records, or assessment references..."
                rows={4}
              />
            </div>

            {/* Student Context Preview */}
            <div className="rounded-lg bg-muted/50 p-3 border text-xs text-muted-foreground flex flex-wrap gap-4 items-center">
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

            <DialogFooter className="pt-2">
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

          <form onSubmit={handleSaveEdit} className="space-y-4 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Select value={editForm.category} onValueChange={(v) => setEditForm((f) => ({ ...f, category: v }))}>
                  <SelectTrigger>
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

              <div className="space-y-1.5">
                <Label>Priority</Label>
                <Select value={editForm.priority} onValueChange={(v) => setEditForm((f) => ({ ...f, priority: v }))}>
                  <SelectTrigger>
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

            <div className="space-y-1.5">
              <Label>Subject</Label>
              <Input
                value={editForm.title}
                onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))}
                maxLength={120}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea
                value={editForm.description}
                onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
                rows={4}
              />
            </div>

            <DialogFooter className="pt-2">
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
                <div>
                  <span className="text-muted-foreground block">Course:</span>
                  <span className="font-semibold text-foreground">{activeComplaint.courseCode} · {activeComplaint.courseName}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Category:</span>
                  <span className="font-medium text-foreground">{activeComplaint.category}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Priority:</span>
                  <span className="font-medium text-foreground">{activeComplaint.priority}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Student:</span>
                  <span className="font-medium text-foreground">{activeComplaint.studentName} ({activeComplaint.studentId})</span>
                </div>
              </div>

              <div>
                <Label className="text-xs text-muted-foreground">Subject</Label>
                <div className="font-semibold text-base text-foreground mt-0.5">{activeComplaint.title}</div>
              </div>

              <div>
                <Label className="text-xs text-muted-foreground">Description</Label>
                <div className="mt-1 p-3 rounded-lg bg-card border text-foreground text-xs leading-relaxed whitespace-pre-wrap">
                  {activeComplaint.description}
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
