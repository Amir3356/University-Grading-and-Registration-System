import { useEffect, useMemo, useState } from 'react'
import { AlertCircle, NotebookPen, Pencil, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { useParams } from 'react-router-dom'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { DataTable } from '@/components/common/DataTable'
import { EmptyState } from '@/components/common/EmptyState'
import { ErrorState } from '@/components/common/ErrorState'
import { FilterSelect } from '@/components/common/FilterSelect'
import { FormField } from '@/components/common/FormField'
import { PageSkeleton } from '@/components/common/Loading'
import { PageHeader } from '@/components/common/PageHeader'
import { useAuth } from '@/context/auth-context'
import { useLookups } from '@/context/lookups-context'
import { useQuery } from '@/hooks/useStore'
import { getCourseStudyYear } from '@/lib/format'
import { validateMark } from '@/lib/grading'
import { useWebSocketEvent } from '@/lib/websocket'
import { store } from '@/store'
import { defaultOfferingId, isLockedStatus, lockedExplanation, typeLabel } from '../lib'

export function EntermarkPage() {
  const { offeringId: paramOfferingId } = useParams()
  const lookups = useLookups()
  const currentSemesterId = lookups?.currentSemester?.id

  // 1. Fetch teacher offerings
  const {
    data: offerings,
    loading: offeringsLoading,
    error: offeringsError,
    refetch: refetchOfferings,
  } = useQuery(() => store.teacher.listMyOfferings({}), [])

  useWebSocketEvent('OFFERING_UPDATED', () => {
    refetchOfferings()
    refetchGradebook()
  })
  useWebSocketEvent('OFFERING_CREATED', () => {
    refetchOfferings()
  })
  useWebSocketEvent('OFFERING_DELETED', () => {
    refetchOfferings()
  })

  // 2. Offering selection state
  const [selectedOfferingId, setSelectedOfferingId] = useState(null)
  const activeOfferingId = selectedOfferingId ?? defaultOfferingId(offerings, paramOfferingId, currentSemesterId) ?? ''

  // 3. Fetch gradebook for the active offering
  const {
    data: gradebook,
    loading: gbLoading,
    error: gbError,
    refetch: refetchGradebook,
  } = useQuery(
    () => (activeOfferingId ? store.grades.getGradebook(activeOfferingId) : null),
    [activeOfferingId],
    { enabled: Boolean(activeOfferingId) },
  )

  // 4. Filters & Dialog states
  const [assessmentFilter, setAssessmentFilter] = useState('')
  const [editModalData, setEditModalData] = useState(null) // { row, isNew?: boolean }
  const [deleteConfirmData, setDeleteConfirmData] = useState(null) // row to delete

  // Offering metadata
  const currentOffering = offerings?.find((o) => o.id === activeOfferingId)
  const assessments = useMemo(() => gradebook?.assessments ?? [], [gradebook?.assessments])
  const isLocked = Boolean(isLockedStatus(currentOffering?.gradeStatus))
  const gbRows = gradebook?.rows

  const [deletedRowIds, setDeletedRowIds] = useState(() => new Set())

  // Reset optimistic deleted row cache when offering or gradebook changes
  useEffect(() => {
    setDeletedRowIds(new Set())
  }, [activeOfferingId, gbRows])

  // 5. Build table rows (flattened: each student x each assessment with an entered mark)
  const tableRows = useMemo(() => {
    if (!gbRows || !assessments.length) return []

    const list = []
    for (const r of gbRows) {
      const student = r.student
      const isWithdrawn = r.enrollment?.status === 'withdrawn'

      for (const a of assessments) {
        if (assessmentFilter && a.id !== assessmentFilter) continue

        const rowId = `${r.enrollmentId}-${a.id}`
        if (deletedRowIds.has(rowId)) continue

        const rawMark = r.marks?.[a.id] ?? r.marks?.[a.id.replace(/_([a-z])/g, (_, l) => l.toUpperCase())]
        const mark = rawMark !== undefined ? rawMark : null

        // Only rows with entered marks are displayed in the marks table
        if (mark == null) continue

        list.push({
          id: rowId,
          offeringId: activeOfferingId,
          enrollmentId: r.enrollmentId,
          student,
          assessment: a,
          mark,
          withdrawn: isWithdrawn,
          locked: isLocked,
        })
      }
    }
    return list
  }, [gbRows, assessments, assessmentFilter, isLocked, activeOfferingId, deletedRowIds])

  // 6. Delete handler
  const handleDeleteMark = async (providedReason) => {
    if (!deleteConfirmData) return false
    const rowIdToDelete = deleteConfirmData.id
    // Optimistically remove row from UI immediately
    setDeletedRowIds((prev) => new Set([...prev, rowIdToDelete]))
    try {
      const targetOfferingId = deleteConfirmData.offeringId || activeOfferingId
      await store.grades.saveScores(targetOfferingId, {
        changes: [
          {
            enrollmentId: deleteConfirmData.enrollmentId,
            assessmentId: deleteConfirmData.assessment.id,
            marks: null,
          },
        ],
        reason: providedReason || (gradebook?.requiresReason ? 'Mark removed by teacher' : undefined),
      })
      toast.success(
        `Deleted mark for ${deleteConfirmData.student?.name} (${deleteConfirmData.assessment?.name})`,
      )
      setDeleteConfirmData(null)
      refetchGradebook()
      return true
    } catch (err) {
      // Revert optimistic removal on error
      setDeletedRowIds((prev) => {
        const next = new Set(prev)
        next.delete(rowIdToDelete)
        return next
      })
      toast.error(err.message || 'Failed to delete mark')
      return false
    }
  }

  // 7. Column Definitions
  const columns = [
    {
      key: 'studentId',
      header: 'StudentID',
      sortable: true,
      value: (r) => r.student.studentNumber,
      cell: (r) => <span className="tabular font-mono text-sm">{r.student.studentNumber}</span>,
    },
    {
      key: 'studentName',
      header: 'Student Name',
      sortable: true,
      value: (r) => r.student.name,
      cell: (r) => <p className="font-semibold">{r.student.name}</p>,
    },
    {
      key: 'assessmentType',
      header: 'Assessment Type',
      sortable: true,
      value: (r) => typeLabel(r.assessment.type),
      cell: (r) => <p className="font-semibold">{typeLabel(r.assessment.type)}</p>,
    },
    {
      key: 'totalMarks',
      header: 'Total Marks',
      sortable: true,
      value: (r) => r.assessment.maxMarks,
      cell: (r) => <span className="tabular font-medium">{r.assessment.maxMarks}</span>,
    },
    {
      key: 'marksObtained',
      header: 'Marks Obtained',
      sortable: true,
      value: (r) => (r.mark != null ? r.mark : -1),
      cell: (r) => (
        <span className="tabular font-semibold">
          {r.mark != null ? (
            r.mark
          ) : (
            <span className="text-muted-foreground font-normal">—</span>
          )}
        </span>
      ),
    },
    {
      key: 'action',
      header: 'Action',
      sortable: false,
      searchable: false,
      export: false,
      align: 'right',
      cell: (r) => (
        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          <Button
            variant="ghost"
            size="icon-sm"
            title="Edit Mark"
            aria-label={`Edit mark for ${r.student.name}`}
            disabled={r.locked || r.withdrawn}
            onClick={() => setEditModalData({ row: r, isNew: false })}
          >
            <Pencil className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-destructive hover:text-destructive hover:bg-destructive/10"
            title="Delete Mark"
            aria-label={`Delete mark for ${r.student.name}`}
            disabled={r.locked || r.withdrawn}
            onClick={() => setDeleteConfirmData(r)}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      ),
    },
  ]

  if (offeringsLoading && !offerings) return <PageSkeleton />
  if (offeringsError) return <ErrorState error={offeringsError} onRetry={refetchOfferings} />

  return (
    <>
      <PageHeader
        title="Entermark"
        description="Enter and manage student assessment marks."
        centered
        actions={
          <Button
            disabled={!activeOfferingId || isLocked || assessments.length === 0}
            onClick={() => {
              refetchOfferings()
              refetchGradebook()
              setEditModalData({ isNew: true })
            }}
          >
            <Plus className="size-4" /> Enter Mark
          </Button>
        }
      />

      {isLocked && (
        <Alert variant="warning" className="mb-4">
          <AlertCircle className="size-4" />
          <AlertTitle>Marks locked</AlertTitle>
          <AlertDescription>{lockedExplanation(currentOffering?.gradeStatus)}</AlertDescription>
        </Alert>
      )}

      {(!offerings || offerings.length === 0) ? (
        <EmptyState
          icon={NotebookPen}
          title="No courses assigned"
          description="You do not have any active course offerings to enter marks for."
        />
      ) : (
        <DataTable
          columns={columns}
          rows={activeOfferingId && !gbLoading ? tableRows : undefined}
          loading={gbLoading}
          error={gbError}
          onRetry={refetchGradebook}
          searchPlaceholder="Search student by name or ID…"
          emptyIcon={NotebookPen}
          emptyTitle={
            assessments.length === 0
              ? 'No assessments found'
              : 'No student marks found'
          }
          emptyDescription={
            assessments.length === 0
              ? 'Please create assessments under Assessment Management before entering marks.'
              : 'No marks entered yet. Click "+ Enter Mark" above to record student assessment marks.'
          }
          toolbar={
            <>
              <FilterSelect
                label="Course"
                value={activeOfferingId}
                onChange={(id) => {
                  setSelectedOfferingId(id)
                  setAssessmentFilter('')
                }}
                includeAll={false}
                options={offerings.map((o) => ({
                  value: o.id,
                  label: `${o.course.code} — ${o.course.title}${o.section ? ` (${o.section})` : ''} (${o.semester.name})`,
                }))}
                className="sm:w-72"
              />
              <FilterSelect
                label="Assessment"
                allLabel="All assessments"
                value={assessmentFilter}
                onChange={setAssessmentFilter}
                options={assessments.map((a) => ({
                  value: a.id,
                  label: `${a.name} (${typeLabel(a.type)})`,
                }))}
                className="sm:w-56"
              />
            </>
          }
        />
      )}

      {/* Enter / Edit Mark Dialog */}
      {editModalData && (
        <EnterMarkDialog
          open={Boolean(editModalData)}
          onOpenChange={(open) => !open && setEditModalData(null)}
          isNew={editModalData.isNew}
          initialRow={editModalData.row}
          offeringId={activeOfferingId}
          offerings={offerings ?? []}
          onOfferingChange={(id) => {
            setSelectedOfferingId(id)
            setAssessmentFilter('')
          }}
          offering={currentOffering}
          assessments={assessments}
          students={gradebook?.rows ?? []}
          requiresReason={Boolean(gradebook?.requiresReason)}
          onSuccess={() => {
            setEditModalData(null)
            refetchGradebook()
          }}
        />
      )}

      {/* Delete Mark Confirmation Dialog */}
      <ConfirmDialog
        open={Boolean(deleteConfirmData)}
        onOpenChange={(open) => !open && setDeleteConfirmData(null)}
        title="Delete Mark"
        description={
          deleteConfirmData
            ? `Are you sure you want to delete the mark for ${deleteConfirmData.student?.name} in ${deleteConfirmData.assessment?.name}?`
            : ''
        }
        reasonLabel={gradebook?.requiresReason ? 'Reason for deletion' : undefined}
        confirmLabel="Delete Mark"
        variant="destructive"
        onConfirm={handleDeleteMark}
      />
    </>
  )
}

function EnterMarkDialog({
  open,
  onOpenChange,
  isNew,
  initialRow,
  offeringId,
  offerings = [],
  onOfferingChange,
  offering,
  assessments,
  students,
  requiresReason,
  onSuccess,
}) {
  const { user, profile } = useAuth()
  const lookups = useLookups()

  const [dialogOfferingId, setDialogOfferingId] = useState(
    offeringId || offerings[0]?.id || '',
  )

  useEffect(() => {
    if (offeringId) {
      setDialogOfferingId(offeringId)
    }
  }, [offeringId])

  // Fresh live offering data from the server whenever dialog is opened or selection changes
  const [liveOffering, setLiveOffering] = useState(null)
  const [liveOfferingsList, setLiveOfferingsList] = useState(offerings || [])

  useEffect(() => {
    let active = true
    if (!open) return

    async function loadFreshData() {
      // 1. Refresh offering list in dialog
      try {
        const freshList = await store.teacher.listMyOfferings({})
        const items = Array.isArray(freshList) ? freshList : (freshList?.items || [])
        if (active && items.length > 0) {
          setLiveOfferingsList(items)
        }
      } catch {}

      // 2. Refresh active offering detail
      const targetId = dialogOfferingId || offeringId || offerings[0]?.id
      if (targetId) {
        try {
          const off = await store.academics.getOfferingAdmin(targetId)
          if (active && off) {
            setLiveOffering(off)
            return
          }
        } catch {}
        try {
          const off = await store.teacher.getMyOffering(targetId)
          if (active && off?.offering) {
            setLiveOffering(off.offering)
          }
        } catch {}
      }
    }

    loadFreshData()
    return () => {
      active = false
    }
  }, [open, dialogOfferingId, offeringId])

  useEffect(() => {
    if (offerings && offerings.length > 0) {
      setLiveOfferingsList((prev) => (prev.length === 0 ? offerings : prev))
    }
  }, [offerings])

  const allOfferings = useMemo(() => {
    const list = liveOfferingsList?.length > 0 ? liveOfferingsList : offerings
    if (!liveOffering) return list
    return list.map((o) => (o.id === liveOffering.id ? { ...o, ...liveOffering } : o))
  }, [liveOfferingsList, offerings, liveOffering])

  const activeOffering = useMemo(() => {
    return liveOffering || allOfferings.find((o) => o.id === dialogOfferingId) || offering
  }, [liveOffering, allOfferings, dialogOfferingId, offering])

  const handleOfferingChange = (newOffId) => {
    setDialogOfferingId(newOffId)
    setLiveOffering(null)
    onOfferingChange?.(newOffId)
  }

  // Deduplicate courses so each course appears only once in the dropdown
  const uniqueCourses = useMemo(() => {
    const map = new Map()
    for (const o of allOfferings) {
      const cId = o.course?.id || o.courseId || o.course_id || o.course?.code || o.id
      if (!cId) continue
      if (!map.has(cId)) {
        map.set(cId, o)
      } else {
        const existing = map.get(cId)
        if (o.id === dialogOfferingId || o.id === offeringId) {
          map.set(cId, o)
        } else if (
          (o.semester?.isCurrent || o.semester?.is_current) &&
          existing.id !== dialogOfferingId &&
          existing.id !== offeringId
        ) {
          map.set(cId, o)
        }
      }
    }
    return Array.from(map.values())
  }, [allOfferings, dialogOfferingId, offeringId])

  const selectedCourseId = useMemo(() => {
    return (
      activeOffering?.course?.id ||
      activeOffering?.courseId ||
      activeOffering?.course_id ||
      activeOffering?.course?.code ||
      ''
    )
  }, [activeOffering])

  const handleCourseSelect = (courseKey) => {
    const matchingOfferings = allOfferings.filter((o) => {
      const cId = o.course?.id || o.courseId || o.course_id || o.course?.code || o.id
      return cId === courseKey
    })

    if (!matchingOfferings.length) return

    const targetOffering =
      matchingOfferings.find((o) => o.id === dialogOfferingId) ||
      matchingOfferings.find((o) => o.id === offeringId) ||
      matchingOfferings.find((o) => o.semester?.isCurrent || o.semester?.is_current) ||
      matchingOfferings[0]

    if (targetOffering && targetOffering.id !== dialogOfferingId) {
      handleOfferingChange(targetOffering.id)
    }
  }

  const teacherDeptId = useMemo(() => {
    return (
      activeOffering?.departmentId ||
      activeOffering?.course?.departmentId ||
      activeOffering?.course?.department_id ||
      activeOffering?.teacher?.departmentId ||
      activeOffering?.teacher?.department?.id ||
      profile?.departmentId ||
      profile?.department_id ||
      user?.departmentId ||
      user?.department_id ||
      ''
    )
  }, [activeOffering, profile, user])

  const assignedYear = useMemo(() => {
    const yos =
      activeOffering?.yearOfStudy ??
      activeOffering?.year_of_study ??
      activeOffering?.course?.yearOfStudy ??
      (activeOffering?.course?.level ? Math.floor(activeOffering.course.level / 100) : null) ??
      initialRow?.student?.yearOfStudy
    if (yos) return String(yos)
    const course = activeOffering?.course || initialRow?.course || initialRow?.assessment?.offering?.course
    return getCourseStudyYear(course) || '1'
  }, [activeOffering, initialRow])

  // Only the assigned year is seen in the options
  const yearOptions = useMemo(
    () => [{ value: assignedYear, label: assignedYear }],
    [assignedYear],
  )

  const [courseAssessments, setCourseAssessments] = useState(assessments || [])

  useEffect(() => {
    let active = true
    if (dialogOfferingId === offeringId && assessments?.length) {
      setCourseAssessments(assessments)
      return
    }
    async function loadAsm() {
      try {
        const res = await store.grades.getGradebook(dialogOfferingId)
        if (active && res?.assessments) {
          setCourseAssessments(res.assessments)
        }
      } catch (e) {
        console.error('Failed to load assessments for offering', e)
      }
    }
    if (dialogOfferingId) {
      loadAsm()
    }
    return () => {
      active = false
    }
  }, [dialogOfferingId, offeringId, assessments])

  const [deptStudents, setDeptStudents] = useState([])
  const [loadingDeptStudents, setLoadingDeptStudents] = useState(false)

  useEffect(() => {
    let active = true
    if (!open || !isNew) return
    async function fetchDeptStudents() {
      setLoadingDeptStudents(true)
      try {
        const res = await store.users.searchStudents({
          departmentId: teacherDeptId || undefined,
          status: 'active',
          pageSize: 'all',
        })
        const items = Array.isArray(res) ? res : (res?.items || [])
        if (active) {
          setDeptStudents(items)
        }
      } catch (e) {
        console.error('Failed to load department students:', e)
      } finally {
        if (active) setLoadingDeptStudents(false)
      }
    }
    fetchDeptStudents()
    return () => {
      active = false
    }
  }, [open, isNew, teacherDeptId])

  const candidateStudents = useMemo(() => {
    const map = new Map()

    // 1. Enrolled students from gradebook rows
    for (const r of students) {
      const s = r.student || {}
      const sId = s.id || r.enrollmentId
      if (!sId) continue
      map.set(sId, {
        id: s.id || r.enrollmentId,
        enrollmentId: r.enrollmentId,
        studentNumber: s.studentNumber || s.student_number || s.id,
        name: s.name,
        departmentId: s.departmentId || s.department_id || teacherDeptId,
        yearOfStudy: String(s.yearOfStudy ?? s.year_of_study ?? assignedYear),
      })
    }

    // 2. Lookups students
    const lookupList = lookups?.students || []
    for (const s of lookupList) {
      if (s?.id && !map.has(s.id)) {
        map.set(s.id, {
          id: s.id,
          enrollmentId: null,
          studentNumber: s.studentNumber || s.student_number || s.id,
          name: s.name || `${s.first_name || ''} ${s.last_name || ''}`.trim(),
          departmentId: s.departmentId || s.department_id,
          yearOfStudy: String(s.yearOfStudy ?? s.year_of_study ?? ''),
        })
      }
    }

    // 3. Fetched department students
    for (const s of deptStudents) {
      if (s?.id && !map.has(s.id)) {
        map.set(s.id, {
          id: s.id,
          enrollmentId: null,
          studentNumber: s.studentNumber || s.student_number || s.id,
          name: s.name || `${s.first_name || ''} ${s.last_name || ''}`.trim(),
          departmentId: s.departmentId || s.department_id,
          yearOfStudy: String(s.yearOfStudy ?? s.year_of_study ?? ''),
        })
      }
    }

    return Array.from(map.values())
  }, [students, lookups?.students, deptStudents, teacherDeptId, assignedYear])

  const filteredStudents = useMemo(() => {
    return candidateStudents.filter((s) => {
      // Must match teacher department
      const matchesDept = !teacherDeptId || !s.departmentId || s.departmentId === teacherDeptId
      // Must match assigned year of study
      const matchesYear = !assignedYear || String(s.yearOfStudy) === String(assignedYear)
      return matchesDept && matchesYear
    })
  }, [candidateStudents, teacherDeptId, assignedYear])

  const [selectedStudentId, setSelectedStudentId] = useState('')

  useEffect(() => {
    if (initialRow) {
      const rowStuId = initialRow.student?.id || initialRow.enrollmentId
      setSelectedStudentId(rowStuId)
    } else if (filteredStudents.length > 0) {
      if (!filteredStudents.some((s) => s.id === selectedStudentId)) {
        setSelectedStudentId(filteredStudents[0].id)
      }
    } else {
      setSelectedStudentId('')
    }
  }, [filteredStudents, initialRow])

  const [selectedAssessmentId, setSelectedAssessmentId] = useState(
    initialRow?.assessment?.id ?? courseAssessments[0]?.id ?? '',
  )

  useEffect(() => {
    if (courseAssessments.length > 0) {
      if (!courseAssessments.some((a) => a.id === selectedAssessmentId)) {
        setSelectedAssessmentId(courseAssessments[0].id)
      }
    } else {
      setSelectedAssessmentId('')
    }
  }, [courseAssessments])

  const [mark, setMark] = useState(
    initialRow?.mark != null ? String(initialRow.mark) : '',
  )
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  const targetAssessment = courseAssessments.find((a) => a.id === selectedAssessmentId)
  const targetStudent = candidateStudents.find((s) => s.id === selectedStudentId) || (initialRow ? { ...initialRow.student, enrollmentId: initialRow.enrollmentId } : null)

  const validationError = targetAssessment ? validateMark(mark, targetAssessment.maxMarks) : null

  const handleSubmit = async (e) => {
    e?.preventDefault()
    if (!targetAssessment) return

    if (!targetStudent && !initialRow?.enrollmentId) {
      setError('Please select a student.')
      return
    }

    if (mark === '') {
      setError('Please enter a mark.')
      return
    }

    if (validationError) {
      setError(validationError)
      return
    }

    if (requiresReason && !reason.trim()) {
      setError('Please provide a reason for modifying marks after submission.')
      return
    }

    setSubmitting(true)
    setError(null)
    try {
      const payload = {
        assessmentId: selectedAssessmentId,
        marks: Number(mark),
      }

      if (targetStudent?.enrollmentId) {
        payload.enrollmentId = targetStudent.enrollmentId
      } else if (targetStudent?.id) {
        payload.studentId = targetStudent.id
      } else if (initialRow?.enrollmentId) {
        payload.enrollmentId = initialRow.enrollmentId
      }

      await store.grades.saveScores(dialogOfferingId || offeringId, {
        changes: [payload],
        reason: requiresReason ? reason.trim() : undefined,
      })
      toast.success('Mark saved successfully')
      onSuccess()
    } catch (err) {
      setError(err.message || 'Failed to save mark.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md" className="sm:max-w-xl">
        <form onSubmit={handleSubmit} className="tea-dialog-form">
          <DialogHeader>
            <DialogTitle>{isNew ? 'Enter Mark' : 'Edit Mark'}</DialogTitle>
            <DialogDescription>
              {isNew
                ? 'Select course, student, and assessment to enter score.'
                : 'Update assessment mark for the student.'}
            </DialogDescription>
          </DialogHeader>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {isNew ? (
            <>
              <div className="tea-dialog-grid tea-dialog-grid--2">
                <FormField label="Course Name" required>
                  <Select value={selectedCourseId} onValueChange={handleCourseSelect}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select course name" />
                    </SelectTrigger>
                    <SelectContent>
                      {uniqueCourses.map((o) => {
                        const cId = o.course?.id || o.courseId || o.course_id || o.course?.code || o.id
                        return (
                          <SelectItem key={cId} value={cId}>
                            {o.course?.title || o.course?.name || o.course?.code} ({o.course?.code})
                          </SelectItem>
                        )
                      })}
                    </SelectContent>
                  </Select>
                </FormField>

                <FormField label="Year of Study" required>
                  <Select value={assignedYear} disabled={yearOptions.length <= 1}>
                    <SelectTrigger>
                      <SelectValue placeholder="Year of Study" />
                    </SelectTrigger>
                    <SelectContent>
                      {yearOptions.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>
              </div>

              <div className="tea-dialog-grid tea-dialog-grid--2">
                <FormField
                  label="StudentID"
                  required
                  hint={
                    loadingDeptStudents
                      ? 'Loading students…'
                      : filteredStudents.length === 0
                        ? `No students found for Year ${assignedYear} in this department.`
                        : undefined
                  }
                >
                  <Select
                    value={selectedStudentId}
                    onValueChange={setSelectedStudentId}
                    disabled={filteredStudents.length === 0}
                  >
                    <SelectTrigger>
                      <SelectValue
                        placeholder={
                          loadingDeptStudents
                            ? 'Loading…'
                            : filteredStudents.length === 0
                              ? `No Year ${assignedYear} students`
                              : 'Select student ID'
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredStudents.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.studentNumber}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>

                <FormField label="Student Name" required>
                  <Select
                    value={selectedStudentId}
                    onValueChange={setSelectedStudentId}
                    disabled={filteredStudents.length === 0}
                  >
                    <SelectTrigger>
                      <SelectValue
                        placeholder={
                          loadingDeptStudents
                            ? 'Loading…'
                            : filteredStudents.length === 0
                              ? `No Year ${assignedYear} students`
                              : 'Select student'
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredStudents.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>
              </div>

              <div className="tea-dialog-grid tea-dialog-grid--2">
                <FormField label="Assessment" required>
                  <Select value={selectedAssessmentId} onValueChange={setSelectedAssessmentId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select assessment" />
                    </SelectTrigger>
                    <SelectContent>
                      {courseAssessments.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.name} — {typeLabel(a.type)} (Max: {a.maxMarks})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>

                <FormField
                  label={`Mark (Out of ${targetAssessment?.maxMarks ?? 100})`}
                  required
                  error={validationError}
                >
                  <Input
                    type="number"
                    step="any"
                    min="0"
                    max={targetAssessment?.maxMarks}
                    value={mark}
                    onChange={(e) => {
                      setMark(e.target.value)
                      setError(null)
                    }}
                    placeholder={`0 to ${targetAssessment?.maxMarks ?? 100}`}
                  />
                </FormField>
              </div>
            </>
          ) : (
            <>
              <div className="tea-details-box">
                <div className="tea-dialog-grid tea-dialog-grid--2">
                  <p>
                    <span className="text-muted-foreground font-medium">Course Name: </span>
                    <span className="font-semibold">{activeOffering?.course?.title || activeOffering?.course?.name} ({activeOffering?.course?.code})</span>
                  </p>
                  <p>
                    <span className="text-muted-foreground font-medium">Year of Study: </span>
                    <span className="font-semibold">{assignedYear}</span>
                  </p>
                  <p>
                    <span className="text-muted-foreground font-medium">StudentID: </span>
                    <span className="font-mono text-xs font-semibold">{targetStudent?.studentNumber ?? initialRow?.student?.studentNumber}</span>
                  </p>
                  <p>
                    <span className="text-muted-foreground font-medium">Student Name: </span>
                    <span className="font-semibold">{targetStudent?.name ?? initialRow?.student?.name}</span>
                  </p>
                  <p>
                    <span className="text-muted-foreground font-medium">Assessment: </span>
                    <span className="font-semibold">{targetAssessment?.name}</span> ({typeLabel(targetAssessment?.type)})
                  </p>
                  <p>
                    <span className="text-muted-foreground font-medium">Max Marks: </span>
                    <span className="tabular font-semibold">{targetAssessment?.maxMarks}</span>
                  </p>
                </div>
              </div>

              <FormField
                label={`Mark (Out of ${targetAssessment?.maxMarks ?? 100})`}
                required
                error={validationError}
              >
                <Input
                  type="number"
                  step="any"
                  min="0"
                  max={targetAssessment?.maxMarks}
                  value={mark}
                  onChange={(e) => {
                    setMark(e.target.value)
                    setError(null)
                  }}
                  placeholder={`0 to ${targetAssessment?.maxMarks ?? 100}`}
                  autoFocus
                />
              </FormField>
            </>
          )}

          {requiresReason && (
            <FormField label="Reason for change" required>
              <Input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Recalculated score after review"
              />
            </FormField>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              loading={submitting}
              disabled={submitting || Boolean(validationError) || mark === '' || (isNew && filteredStudents.length === 0)}
            >
              Save Mark
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
