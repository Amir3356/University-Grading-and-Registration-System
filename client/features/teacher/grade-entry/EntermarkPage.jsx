import { useMemo, useState } from 'react'
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
import { useLookups } from '@/context/lookups-context'
import { useQuery } from '@/hooks/useStore'
import { validateMark } from '@/lib/grading'
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

  // 5. Build table rows (flattened: each student x each assessment)
  const tableRows = useMemo(() => {
    if (!gbRows || !assessments.length) return []

    const list = []
    for (const r of gbRows) {
      const student = r.student
      const isWithdrawn = r.enrollment?.status === 'withdrawn'

      for (const a of assessments) {
        if (assessmentFilter && a.id !== assessmentFilter) continue

        const mark = r.marks[a.id] ?? null
        list.push({
          id: `${r.enrollmentId}-${a.id}`,
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
  }, [gbRows, assessments, assessmentFilter, isLocked])

  // 6. Delete handler
  const handleDeleteMark = async () => {
    if (!deleteConfirmData) return
    try {
      await store.grades.saveScores(activeOfferingId, {
        changes: [
          {
            enrollmentId: deleteConfirmData.enrollmentId,
            assessmentId: deleteConfirmData.assessment.id,
            marks: null,
          },
        ],
        reason: gradebook?.requiresReason ? 'Mark removed by teacher' : undefined,
      })
      toast.success(
        `Deleted mark for ${deleteConfirmData.student.name} (${deleteConfirmData.assessment.name})`,
      )
      setDeleteConfirmData(null)
      refetchGradebook()
    } catch (err) {
      toast.error(err.message || 'Failed to delete mark')
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
            disabled={r.locked || r.withdrawn || r.mark == null}
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
            onClick={() => setEditModalData({ isNew: true })}
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
              : 'Try adjusting your search or assessment filter.'
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
                  label: `${o.course.code} — ${o.course.title} (${o.semester.name})`,
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
            ? `Are you sure you want to delete the mark for ${deleteConfirmData.student.name} in ${deleteConfirmData.assessment.name}?`
            : ''
        }
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
  assessments,
  students,
  requiresReason,
  onSuccess,
}) {
  const [selectedEnrollmentId, setSelectedEnrollmentId] = useState(
    initialRow?.enrollmentId ?? students[0]?.enrollmentId ?? '',
  )
  const [selectedAssessmentId, setSelectedAssessmentId] = useState(
    initialRow?.assessment?.id ?? assessments[0]?.id ?? '',
  )
  const [mark, setMark] = useState(
    initialRow?.mark != null ? String(initialRow.mark) : '',
  )
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  const targetAssessment = assessments.find((a) => a.id === selectedAssessmentId)
  const targetStudent = students.find((s) => s.enrollmentId === selectedEnrollmentId)?.student

  const validationError = targetAssessment ? validateMark(mark, targetAssessment.maxMarks) : null

  const handleSubmit = async (e) => {
    e?.preventDefault()
    if (!targetAssessment || !selectedEnrollmentId) return

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
      await store.grades.saveScores(offeringId, {
        changes: [
          {
            enrollmentId: selectedEnrollmentId,
            assessmentId: selectedAssessmentId,
            marks: Number(mark),
          },
        ],
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
      <DialogContent size="sm">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{isNew ? 'Enter Mark' : 'Edit Mark'}</DialogTitle>
            <DialogDescription>
              {isNew
                ? 'Select a student and assessment to enter their score.'
                : 'Update assessment mark for the student.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {isNew ? (
              <>
                <FormField label="Student" required>
                  <Select value={selectedEnrollmentId} onValueChange={setSelectedEnrollmentId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select student" />
                    </SelectTrigger>
                    <SelectContent>
                      {students.map((r) => (
                        <SelectItem key={r.enrollmentId} value={r.enrollmentId}>
                          {r.student.name} ({r.student.studentNumber})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>

                <FormField label="Assessment" required>
                  <Select value={selectedAssessmentId} onValueChange={setSelectedAssessmentId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select assessment" />
                    </SelectTrigger>
                    <SelectContent>
                      {assessments.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.name} — {typeLabel(a.type)} (Max: {a.maxMarks})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>
              </>
            ) : (
              <div className="rounded-md bg-muted/50 p-3 text-sm space-y-1">
                <p>
                  <span className="text-muted-foreground font-medium">Student: </span>
                  <span className="font-semibold">{targetStudent?.name ?? initialRow?.student?.name}</span>{' '}
                  <span className="font-mono text-xs">({targetStudent?.studentNumber ?? initialRow?.student?.studentNumber})</span>
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
            )}

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

            {requiresReason && (
              <FormField label="Reason for change" required>
                <Input
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. Recalculated score after review"
                />
              </FormField>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              loading={submitting}
              disabled={submitting || Boolean(validationError) || mark === ''}
            >
              Save Mark
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
