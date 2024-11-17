import { useMemo, useState } from 'react'
import {
  AlertCircle,
  ClipboardList,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react'
import { useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { DataTable } from '@/components/common/DataTable'
import { EmptyState } from '@/components/common/EmptyState'
import { ErrorState } from '@/components/common/ErrorState'
import { FilterSelect } from '@/components/common/FilterSelect'
import { PageSkeleton } from '@/components/common/Loading'
import { PageHeader } from '@/components/common/PageHeader'
import { useLookups } from '@/context/lookups-context'
import { useQuery } from '@/hooks/useStore'
import { useWebSocketEvent } from '@/lib/websocket'
import { store } from '@/store'
import { defaultOfferingId, isLockedStatus, lockedExplanation, typeLabel } from '../lib'
import { AssessmentFormDialog } from './AssessmentFormDialog'

export function AssessmentsPage() {
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

  // 2. Offering selection state
  const [selectedOfferingId, setSelectedOfferingId] = useState(null)
  const activeOfferingId =
    selectedOfferingId ??
    defaultOfferingId(offerings, paramOfferingId, currentSemesterId) ??
    uniqueCourses[0]?.id ??
    ''
  const offering =
    offerings?.find((o) => o.id === activeOfferingId) ??
    uniqueCourses[0] ??
    null

  const activeCourseId = useMemo(() => {
    return (
      offering?.course?.id ||
      offering?.courseId ||
      offering?.course_id ||
      offering?.course?.code ||
      ''
    )
  }, [offering])

  const handleCourseChange = (cId) => {
    const matching = (offerings ?? []).filter((o) => {
      const key = o.course?.id || o.courseId || o.course_id || o.course?.code || o.id
      return key === cId
    })
    if (!matching.length) return
    const target =
      matching.find((o) => o.id === paramOfferingId) ||
      matching.find((o) => o.semester?.isCurrent || o.semester?.is_current || o.semesterId === currentSemesterId) ||
      matching[0]
    if (target) {
      setSelectedOfferingId(target.id)
    }
  }

  // 3. Fetch assessments for active offering
  const {
    data: assessments,
    loading: assessmentsLoading,
    error: assessmentsError,
    refetch: refetchAssessments,
  } = useQuery(
    () => (activeOfferingId ? store.grades.listAssessments(activeOfferingId) : []),
    [activeOfferingId],
    { enabled: Boolean(activeOfferingId) }
  )

  // 4. Modal and action states
  const [dialog, setDialog] = useState({ open: false, assessment: null })
  const [deleting, setDeleting] = useState(null)

  // 5. Computed states
  const isLocked = Boolean(isLockedStatus(offering?.gradeStatus))
  const safeAssessments = useMemo(() => assessments ?? [], [assessments])

  // Handle assessment deletion
  const handleDelete = async () => {
    if (!deleting) return
    try {
      await store.grades.deleteAssessment(deleting.id)
      toast.success(`Assessment "${deleting.name}" deleted.`)
      refetchAssessments()
      return true
    } catch (err) {
      toast.error(err.message || 'Failed to delete assessment.')
      return false
    }
  }

  const columns = [
    {
      key: 'type',
      header: 'Assessment Type',
      value: (a) => `${typeLabel(a.type)} ${a.name || ''}`,
      cell: (a) => {
        const label = typeLabel(a.type)
        const showSpecific = a.name && a.name.toLowerCase() !== label.toLowerCase()
        return (
          <div>
            <div className="font-medium text-foreground capitalize">
              {showSpecific ? a.name : label}
            </div>
            {showSpecific && (
              <p className="text-xs text-muted-foreground capitalize">{label}</p>
            )}
          </div>
        )
      },
    },
    {
      key: 'weight',
      header: 'Weight',
      align: 'right',
      cell: (a) => <span className="tabular font-medium">{a.weight}%</span>,
    },
    {
      key: 'actions',
      header: 'Action',
      sortable: false,
      searchable: false,
      export: false,
      align: 'right',
      cell: (a) => (
        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          <Button
            variant="ghost"
            size="icon-sm"
            title="Edit Assessment"
            disabled={isLocked}
            onClick={() => setDialog({ open: true, assessment: a })}
          >
            <Pencil className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-destructive hover:text-destructive hover:bg-destructive/10"
            title="Delete Assessment"
            disabled={isLocked}
            onClick={() => setDeleting(a)}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      ),
    },
  ]

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

      {isLocked && (
        <Alert variant="warning" className="mb-4">
          <AlertCircle className="size-4" />
          <AlertTitle>Assessments locked</AlertTitle>
          <AlertDescription>{lockedExplanation(offering?.gradeStatus)}</AlertDescription>
        </Alert>
      )}

      {uniqueCourses.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No courses assigned"
          description="You need an assigned course offering before you can create assessments."
        />
      ) : !offering ? (
        <EmptyState
          icon={ClipboardList}
          title="No course selected"
          description="Please select an active course offering to view its assessments."
        />
      ) : (
        <DataTable
          columns={columns}
          rows={safeAssessments}
          loading={assessmentsLoading}
          error={assessmentsError}
          onRetry={refetchAssessments}
          searchPlaceholder="Search assessments by type…"
          emptyIcon={ClipboardList}
          emptyTitle="No assessments created"
          emptyDescription="Use the Create Assessment button above to define assignments, quizzes, and exams for this course."
          toolbar={
            <div className="sm:ml-auto">
              <FilterSelect
                label="Course"
                value={activeCourseId}
                onChange={handleCourseChange}
                includeAll={false}
                options={uniqueCourses.map((o) => {
                  const cId = o.course?.id || o.courseId || o.course_id || o.course?.code || o.id
                  return {
                    value: cId,
                    label: `${o.course?.code} — ${o.course?.title || o.course?.name || o.course?.code}`,
                  }
                })}
                className="w-full sm:w-80"
              />
            </div>
          }
        />
      )}

      {/* Create / Edit Assessment Dialog */}
      <AssessmentFormDialog
        open={dialog.open}
        onOpenChange={(open) => setDialog((d) => ({ ...d, open }))}
        assessment={dialog.assessment}
        offering={offering}
        existingAssessments={safeAssessments}
        onSaved={refetchAssessments}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(v) => !v && setDeleting(null)}
        title={`Delete "${deleting?.name}"?`}
        description={
          deleting?.scoreCount > 0
            ? `This assessment has ${deleting.scoreCount} student score(s) entered. Deleting it cannot proceed until student scores are cleared.`
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
