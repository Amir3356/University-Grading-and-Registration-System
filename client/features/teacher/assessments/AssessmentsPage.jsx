import { useMemo, useState } from 'react'
import {
  ClipboardList,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react'
import { useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
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
import { formatYearOfStudy, getCourseStudyYear } from '@/lib/format'
import { useWebSocketEvent } from '@/lib/websocket'
import { store } from '@/store'
import { isLockedStatus, typeLabel } from '../lib'
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

  // 2. Year and Offering selection state
  const [selectedYearOfStudy, setSelectedYearOfStudy] = useState('')
  const [selectedCourseId, setSelectedCourseId] = useState('all')

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

  // Determine target offerings based on user filter selections
  const targetOfferings = useMemo(() => {
    if (!offerings || offerings.length === 0) return []

    // 1. If a specific course is selected in the Course dropdown
    if (effectiveCourseId && effectiveCourseId !== 'all') {
      const matching = offerings.filter((o) => {
        const cId = o.course?.id || o.courseId || o.course_id || o.course?.code || o.id
        return cId === effectiveCourseId || o.id === effectiveCourseId
      })
      if (matching.length > 0) return matching
    }

    // 2. If a specific year of study is selected
    if (selectedYearOfStudy && selectedYearOfStudy !== 'all') {
      const byYear = offerings.filter((o) => {
        const y = o?.yearOfStudy ?? o?.year_of_study ?? (o?.course ? getCourseStudyYear(o.course) : null)
        return String(y) === String(selectedYearOfStudy)
      })
      if (byYear.length > 0) return byYear
    }

    // 3. "All Years of Study" -> return all offerings assigned to the teacher by Department Head
    return offerings
  }, [offerings, effectiveCourseId, selectedYearOfStudy])

  const offering = useMemo(() => {
    if (effectiveCourseId && effectiveCourseId !== 'all') {
      const found = (offerings ?? []).find((o) => {
        const cId = o.course?.id || o.courseId || o.course_id || o.course?.code || o.id
        return cId === effectiveCourseId || o.id === effectiveCourseId
      })
      if (found) return found
    }
    return targetOfferings[0] || offerings?.[0] || null
  }, [effectiveCourseId, targetOfferings, offerings])

  const handleYearOfStudyChange = (year) => {
    const val = year || ''
    setSelectedYearOfStudy(val)
    if (!val || val === 'all') {
      setSelectedCourseId('all')
    }
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
  }

  // 3. Fetch assessments across target offerings
  const targetOfferingIdsKey = targetOfferings.map((o) => o.id).sort().join(',')
  const {
    data: assessments,
    loading: assessmentsLoading,
    error: assessmentsError,
    refetch: refetchAssessments,
  } = useQuery(
    async () => {
      if (!targetOfferings || targetOfferings.length === 0) return []
      if (targetOfferings.length === 1) {
        const list = await store.grades.listAssessments(targetOfferings[0].id)
        return (list || []).map((a) => ({
          ...a,
          offeringId: targetOfferings[0].id,
          offering: targetOfferings[0],
        }))
      }

      const results = await Promise.allSettled(
        targetOfferings.map((o) => store.grades.listAssessments(o.id))
      )
      const combined = []
      for (let i = 0; i < results.length; i++) {
        if (results[i].status === 'fulfilled' && Array.isArray(results[i].value)) {
          const off = targetOfferings[i]
          for (const a of results[i].value) {
            combined.push({
              ...a,
              offeringId: off.id,
              offering: off,
            })
          }
        }
      }
      return combined
    },
    [targetOfferingIdsKey],
    { enabled: targetOfferings.length > 0 }
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
  const safeAssessments = useMemo(() => {
    if (!assessments) return []
    return assessments.filter((a) => {
      const targetOff = a.offering || (offerings ?? []).find((o) => o.id === a.offeringId)
      const y = targetOff?.yearOfStudy ?? targetOff?.year_of_study ?? (targetOff?.course ? getCourseStudyYear(targetOff.course) : null)

      if (selectedYearOfStudy && selectedYearOfStudy !== 'all') {
        if (y != null && String(y) !== String(selectedYearOfStudy)) return false
      }

      if (effectiveCourseId && effectiveCourseId !== 'all') {
        const cId = targetOff?.course?.id || targetOff?.courseId || targetOff?.course_id || targetOff?.course?.code || targetOff?.id
        if (cId !== effectiveCourseId && targetOff?.id !== effectiveCourseId) return false
      }

      return true
    })
  }, [assessments, selectedYearOfStudy, effectiveCourseId, offerings])

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
      key: 'course',
      header: 'Course',
      align: 'center',
      value: (a) => {
        const targetOff = a.offering || (offerings ?? []).find((o) => o.id === a.offeringId)
        return targetOff?.course?.code || ''
      },
      cell: (a) => {
        const targetOff = a.offering || (offerings ?? []).find((o) => o.id === a.offeringId)
        return (
          <Badge variant="outline" className="font-mono text-xs font-semibold px-2 py-0.5">
            {targetOff?.course?.code || '—'}
          </Badge>
        )
      },
    },
    {
      key: 'yearOfStudy',
      header: 'Year of Study',
      align: 'center',
      value: (a) => {
        const targetOff = a.offering || (offerings ?? []).find((o) => o.id === a.offeringId) || offering
        const y = targetOff?.yearOfStudy ?? targetOff?.year_of_study ?? (targetOff?.course ? getCourseStudyYear(targetOff.course) : null)
        return formatYearOfStudy(y)
      },
      cell: (a) => {
        const targetOff = a.offering || (offerings ?? []).find((o) => o.id === a.offeringId) || offering
        const y = targetOff?.yearOfStudy ?? targetOff?.year_of_study ?? (targetOff?.course ? getCourseStudyYear(targetOff.course) : null)
        return (
          <span className="tabular font-medium">
            {formatYearOfStudy(y)}
          </span>
        )
      },
    },
    {
      key: 'weight',
      header: 'Weight',
      align: 'center',
      cell: (a) => (
        <div className="inline-flex items-center gap-1.5 font-semibold font-mono text-sm">
          <span className="tabular">{a.weight}%</span>
          <span className="text-xs font-normal text-muted-foreground">of course</span>
        </div>
      ),
    },
    {
      key: 'maxMarks',
      header: 'Max Marks',
      align: 'center',
      cell: (a) => (
        <span className="font-mono text-sm tabular font-medium">
          {a.maxMarks ?? a.weight ?? 100} marks
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Action',
      sortable: false,
      searchable: false,
      export: false,
      align: 'right',
      cell: (a) => {
        const targetOff = a.offering || (offerings ?? []).find((o) => o.id === a.offeringId) || offering
        const itemLocked = Boolean(isLockedStatus(targetOff?.gradeStatus))
        return (
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
        )
      },
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
            <div className="cluster cluster--end push-end">
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
          }
        />
      )}

      {/* Create / Edit Assessment Dialog */}
      <AssessmentFormDialog
        open={dialog.open}
        onOpenChange={(open) => setDialog((d) => ({ ...d, open }))}
        assessment={dialog.assessment}
        offering={offering}
        offerings={offerings ?? []}
        existingAssessments={safeAssessments}
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
