import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  NotebookPen,
  Plus,
  RotateCcw,
  Save,
} from 'lucide-react'
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { toast } from 'sonner'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
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
import { EmptyState } from '@/components/common/EmptyState'
import { ErrorState } from '@/components/common/ErrorState'
import { FilterSelect } from '@/components/common/FilterSelect'
import { FormField } from '@/components/common/FormField'
import { PageSkeleton } from '@/components/common/Loading'
import { PageHeader } from '@/components/common/PageHeader'
import { SearchInput } from '@/components/common/SearchInput'
import { GradeBadge } from '@/components/common/StatusBadge'
import { useAuth } from '@/context/auth-context'
import { useLookups } from '@/context/lookups-context'
import { useQuery } from '@/hooks/useStore'
import { getCourseStudyYear } from '@/lib/format'
import { computeWeightedTotal, gradeForScore, validateMark } from '@/lib/grading'
import { cn } from '@/lib/utils'
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

  const selectedOffering = offerings?.find((o) => o.id === activeOfferingId)
  const selectedCourseId = selectedOffering?.courseId || selectedOffering?.course?.id
  const selectedSemesterId = selectedOffering?.semesterId || selectedOffering?.semester?.id

  // All sibling section offerings for the same course & semester
  const siblingOfferings = useMemo(() => {
    if (!offerings || !selectedCourseId) return selectedOffering ? [selectedOffering] : []
    return offerings.filter(
      (o) =>
        (o.courseId || o.course?.id) === selectedCourseId &&
        (!selectedSemesterId || (o.semesterId || o.semester?.id) === selectedSemesterId)
    )
  }, [offerings, selectedCourseId, selectedSemesterId, selectedOffering])

  // 3. Fetch gradebook for the active offering (combining sibling sections if multiple exist)
  const {
    data: gradebook,
    loading: gbLoading,
    error: gbError,
    refetch: refetchGradebook,
  } = useQuery(
    async () => {
      if (!activeOfferingId) return null
      if (siblingOfferings.length <= 1) {
        return await store.grades.getGradebook(activeOfferingId)
      }
      const results = await Promise.allSettled(
        siblingOfferings.map((o) => store.grades.getGradebook(o.id))
      )
      const primary = results.find((r) => r.status === 'fulfilled' && r.value)?.value
      if (!primary) return null

      const assessments = primary.assessments || []
      const combinedRows = []
      const seenEnrollment = new Set()

      for (let i = 0; i < results.length; i++) {
        const res = results[i]
        if (res.status !== 'fulfilled' || !res.value) continue
        const off = siblingOfferings[i]
        const rows = res.value.rows || []
        for (const r of rows) {
          if (seenEnrollment.has(r.enrollmentId)) continue
          seenEnrollment.add(r.enrollmentId)
          combinedRows.push({
            ...r,
            offeringId: off.id,
            section: off.section || r.enrollment?.section || '',
          })
        }
      }

      return {
        ...primary,
        assessments,
        rows: combinedRows,
      }
    },
    [activeOfferingId, siblingOfferings.map((o) => o.id).join(',')],
    { enabled: Boolean(activeOfferingId) },
  )

  // 4. Spreadsheet Grid states
  const [gridEdits, setGridEdits] = useState({})
  const [gridSearch, setGridSearch] = useState('')
  const [savingGrid, setSavingGrid] = useState(false)
  const [editModalData, setEditModalData] = useState(null) // { row, isNew?: boolean }

  // Offering metadata
  const currentOffering = offerings?.find((o) => o.id === activeOfferingId)
  const assessments = useMemo(() => gradebook?.assessments ?? [], [gradebook?.assessments])
  const isLocked = Boolean(isLockedStatus(currentOffering?.gradeStatus))
  const gbRows = gradebook?.rows

  // Deduplicated offerings for course filter dropdown
  const uniqueCourseOfferings = useMemo(() => {
    if (!offerings) return []
    const map = new Map()
    for (const o of offerings) {
      const cId = o.course?.id || o.courseId || o.course_id || o.id
      if (!map.has(cId)) {
        map.set(cId, o)
      }
    }
    return Array.from(map.values())
  }, [offerings])

  // Reset grid edits when active offering changes
  useEffect(() => {
    setGridEdits({})
  }, [activeOfferingId, gbRows])

  // Grid changes, validation, and dirty tracking
  const { gridChanges, gridErrors, invalidCount } = useMemo(() => {
    if (!gbRows || !assessments.length) return { gridChanges: [], gridErrors: {}, invalidCount: 0 }

    const changes = []
    const errors = {}
    let invalid = 0

    for (const r of gbRows) {
      for (const a of assessments) {
        const k = `${r.enrollmentId}:${a.id}`
        if (!(k in gridEdits)) continue

        const raw = String(gridEdits[k]).trim()
        const err = validateMark(raw, a.maxMarks)
        if (err) {
          errors[k] = err
          invalid++
          continue
        }

        const nextMark = raw === '' ? null : Number(raw)
        const savedMark = r.marks?.[a.id] ?? r.marks?.[a.id.replace(/_([a-z])/g, (_, l) => l.toUpperCase())] ?? null

        if (nextMark !== savedMark) {
          changes.push({
            offeringId: r.offeringId || activeOfferingId,
            enrollmentId: r.enrollmentId,
            assessmentId: a.id,
            marks: nextMark,
          })
        }
      }
    }
    return { gridChanges: changes, gridErrors: errors, invalidCount: invalid }
  }, [gbRows, assessments, gridEdits, activeOfferingId])

  // Save batch changes from spreadsheet grid
  const handleSaveGrid = async () => {
    if (invalidCount > 0) {
      toast.error(`Please fix ${invalidCount} invalid mark(s) before saving.`)
      return
    }
    if (gridChanges.length === 0) {
      toast.info('No changes to save.')
      return
    }

    setSavingGrid(true)
    try {
      const byOffering = {}
      for (const c of gridChanges) {
        const offId = c.offeringId || activeOfferingId
        if (!byOffering[offId]) byOffering[offId] = []
        byOffering[offId].push({
          enrollmentId: c.enrollmentId,
          assessmentId: c.assessmentId,
          marks: c.marks,
        })
      }

      for (const [offId, changes] of Object.entries(byOffering)) {
        await store.grades.saveScores(offId, { changes })
      }

      toast.success(`Marks saved successfully (${gridChanges.length} score(s) updated).`)
      setGridEdits({})
      refetchGradebook()
    } catch (err) {
      toast.error(err.message || 'Failed to save marks.')
    } finally {
      setSavingGrid(false)
    }
  }

  const updateGridCell = (enrollmentId, assessmentId, val) => {
    setGridEdits((prev) => ({
      ...prev,
      [`${enrollmentId}:${assessmentId}`]: val,
    }))
  }

  const handleGridKeyDown = (e, rowIdx, colIdx, maxRows) => {
    if (e.key === 'Enter' || e.key === 'ArrowDown') {
      e.preventDefault()
      if (rowIdx + 1 < maxRows) {
        const nextInput = document.querySelector(`[data-cell="${rowIdx + 1}-${colIdx}"]`)
        if (nextInput) {
          nextInput.focus()
          nextInput.select()
        }
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (rowIdx - 1 >= 0) {
        const prevInput = document.querySelector(`[data-cell="${rowIdx - 1}-${colIdx}"]`)
        if (prevInput) {
          prevInput.focus()
          prevInput.select()
        }
      }
    }
  }

  // Live grid rows computed with effective marks, weighted totals, and grades
  const gridStudents = useMemo(() => {
    if (!gbRows) return []
    const q = gridSearch.trim().toLowerCase()

    return gbRows
      .map((r) => {
        const effectiveMarks = {}
        for (const a of assessments) {
          const k = `${r.enrollmentId}:${a.id}`
          if (k in gridEdits) {
            const raw = String(gridEdits[k]).trim()
            effectiveMarks[a.id] = raw === '' ? null : Number(raw)
          } else {
            const saved = r.marks?.[a.id] ?? r.marks?.[a.id.replace(/_([a-z])/g, (_, l) => l.toUpperCase())] ?? null
            effectiveMarks[a.id] = saved
          }
        }
        const calc = computeWeightedTotal(assessments, effectiveMarks)
        const grade = calc.complete ? gradeForScore(calc.total) : null
        const isWithdrawn = r.enrollment?.status === 'withdrawn'

        return {
          row: r,
          student: r.student,
          section: r.section || currentOffering?.section || 'A',
          effectiveMarks,
          calc,
          grade,
          withdrawn: isWithdrawn,
        }
      })
      .filter(({ student, section }) => {
        if (!q) return true
        const name = String(student?.name || '').toLowerCase()
        const sNum = String(student?.studentNumber || '').toLowerCase()
        const sec = String(section || '').toLowerCase()
        return (
          name.includes(q) ||
          sNum.includes(q) ||
          sec.includes(q) ||
          `section ${sec}`.includes(q)
        )
      })
  }, [gbRows, assessments, gridEdits, currentOffering, gridSearch])

  if (offeringsLoading && !offerings) return <PageSkeleton />
  if (offeringsError) return <ErrorState error={offeringsError} onRetry={refetchOfferings} />

  return (
    <>
      <PageHeader
        title="Entermark"
        description="Enter and manage student assessment marks across courses."
        centered
        actions={
          <div className="flex items-center gap-2">
            {gridChanges.length > 0 && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setGridEdits({})}
                  disabled={savingGrid}
                >
                  <RotateCcw className="size-4 mr-1.5" /> Discard
                </Button>
                <Button
                  size="sm"
                  onClick={handleSaveGrid}
                  disabled={savingGrid || invalidCount > 0}
                >
                  <Save className="size-4 mr-1.5" /> Save Changes ({gridChanges.length})
                </Button>
              </>
            )}
            <Button
              variant={gridChanges.length > 0 ? 'outline' : 'default'}
              size="sm"
              disabled={!activeOfferingId || isLocked || assessments.length === 0}
              onClick={() => {
                refetchOfferings()
                refetchGradebook()
                setEditModalData({ isNew: true })
              }}
            >
              <Plus className="size-4 mr-1.5" /> Enter Mark
            </Button>
          </div>
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
        <div className="space-y-4">
          {/* Grid Toolbar & Status */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <FilterSelect
                label="Course"
                value={activeOfferingId}
                onChange={(id) => {
                  setSelectedOfferingId(id)
                  setGridEdits({})
                }}
                includeAll={false}
                options={uniqueCourseOfferings.map((o) => ({
                  value: o.id,
                  label: `${o.course.code} — ${o.course.title} (${o.semester.name})`,
                }))}
                className="sm:w-80"
              />
              <SearchInput
                value={gridSearch}
                onChange={setGridSearch}
                placeholder="Search student by name, ID, or section…"
                className="sm:w-72"
              />
            </div>

            <div className="flex items-center gap-3">
              <div className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground">
                <kbd className="px-1.5 py-0.5 rounded border bg-muted font-mono text-[11px]">Enter</kbd> / <kbd className="px-1.5 py-0.5 rounded border bg-muted font-mono text-[11px]">↓</kbd> next student · <kbd className="px-1.5 py-0.5 rounded border bg-muted font-mono text-[11px]">Tab</kbd> next assessment
              </div>
              {gridChanges.length > 0 && (
                <Badge variant="warning" className="h-7 px-2.5">
                  {gridChanges.length} unsaved mark{gridChanges.length === 1 ? '' : 's'}
                </Badge>
              )}
            </div>
          </div>

          {/* Spreadsheet Table */}
          {assessments.length === 0 ? (
            <EmptyState
              icon={NotebookPen}
              title="No assessment types configured"
              description="Please create assessments under Assessment Management before entering marks for this course."
            />
          ) : gridStudents.length === 0 ? (
            <EmptyState
              icon={NotebookPen}
              title="No students found"
              description={
                gridSearch
                  ? 'No students match your search criteria.'
                  : 'No enrolled students found for this course.'
              }
            />
          ) : (
            <div className="overflow-x-auto rounded-lg border bg-card shadow-sm">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b bg-muted/60 text-xs text-muted-foreground">
                    <th className="sticky left-0 z-20 bg-muted/95 px-4 py-3 text-left font-semibold uppercase">
                      StudentID
                    </th>
                    <th className="sticky left-[120px] z-20 bg-muted/95 px-4 py-3 text-left font-semibold uppercase">
                      Student Name
                    </th>
                    <th className="px-3 py-3 text-center font-semibold uppercase">
                      Section
                    </th>
                    {assessments.map((a, colIdx) => (
                      <th key={a.id} className="min-w-32 px-3 py-3 text-center font-semibold">
                        <span className="block text-foreground">{typeLabel(a.type)}</span>
                        <span className="block text-[11px] font-normal text-muted-foreground">
                          Max: {a.maxMarks} ({a.weight}%)
                        </span>
                      </th>
                    ))}
                    <th className="px-3 py-3 text-center font-semibold uppercase">Total (%)</th>
                    <th className="px-3 py-3 text-center font-semibold uppercase">Grade</th>
                    <th className="px-3 py-3 text-center font-semibold uppercase">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {gridStudents.map((s, rowIdx) => {
                    return (
                      <tr key={s.row.enrollmentId} className="hover:bg-muted/30 transition-colors">
                        <td className="sticky left-0 z-10 bg-card px-4 py-2.5 font-mono text-xs font-semibold whitespace-nowrap">
                          {s.student?.studentNumber}
                        </td>
                        <td className="sticky left-[120px] z-10 bg-card px-4 py-2.5 font-medium whitespace-nowrap">
                          {s.student?.name}
                        </td>
                        <td className="px-3 py-2.5 text-center text-xs whitespace-nowrap">
                          <Badge variant="outline">Section {s.section}</Badge>
                        </td>
                        {assessments.map((a, colIdx) => {
                          const k = `${s.row.enrollmentId}:${a.id}`
                          const isEdited = k in gridEdits
                          const errorMsg = gridErrors[k]
                          const currentVal = isEdited
                            ? gridEdits[k]
                            : s.effectiveMarks[a.id] != null
                              ? String(s.effectiveMarks[a.id])
                              : ''

                          return (
                            <td key={a.id} className="px-2 py-1.5 text-center">
                              <Input
                                data-cell={`${rowIdx}-${colIdx}`}
                                type="number"
                                step="any"
                                min="0"
                                max={a.maxMarks}
                                disabled={isLocked || s.withdrawn}
                                value={currentVal}
                                onChange={(e) => updateGridCell(s.row.enrollmentId, a.id, e.target.value)}
                                onKeyDown={(e) => handleGridKeyDown(e, rowIdx, colIdx, gridStudents.length)}
                                placeholder="—"
                                className={cn(
                                  "h-9 w-24 text-center font-mono text-sm transition-all mx-auto",
                                  isEdited && "border-amber-500 bg-amber-500/10 ring-1 ring-amber-500 font-semibold",
                                  errorMsg && "border-destructive bg-destructive/10 ring-1 ring-destructive"
                                )}
                                title={errorMsg || (s.withdrawn ? 'Withdrawn' : undefined)}
                              />
                            </td>
                          )
                        })}
                        <td className="px-3 py-2.5 text-center font-mono font-semibold">
                          {s.calc.total != null ? `${s.calc.total}%` : '—'}
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          {s.grade?.letter ? (
                            <GradeBadge letter={s.grade.letter} />
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-center whitespace-nowrap">
                          <Badge variant={s.calc.complete ? 'success' : 'warning'}>
                            {s.calc.complete
                              ? 'Complete'
                              : `${s.calc.enteredCount}/${s.calc.expectedCount} Entered`}
                          </Badge>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
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

    async function loadAsm() {
      const targetId = dialogOfferingId || offeringId
      if (!targetId) return

      try {
        // 1. First attempt: list assessments endpoint
        const list = await store.grades.listAssessments(targetId)
        const items = Array.isArray(list) ? list : (list?.items || [])
        if (active && items.length > 0) {
          setCourseAssessments(items)
          return
        }

        // 2. Second attempt: getGradebook
        const res = await store.grades.getGradebook(targetId)
        if (active && res?.assessments?.length) {
          setCourseAssessments(res.assessments)
          return
        }

        // 3. Third attempt: check sibling section offerings for this same course
        const targetOff = allOfferings.find((o) => o.id === targetId)
        const targetCourseId = targetOff?.courseId || targetOff?.course?.id || targetOff?.course_id
        if (targetCourseId) {
          const siblings = allOfferings.filter(
            (o) =>
              ((o.courseId || o.course?.id || o.course_id) === targetCourseId) &&
              o.id !== targetId
          )
          for (const sib of siblings) {
            try {
              const sibList = await store.grades.listAssessments(sib.id)
              const sibItems = Array.isArray(sibList) ? sibList : (sibList?.items || [])
              if (active && sibItems.length > 0) {
                setCourseAssessments(sibItems)
                return
              }
            } catch {}
          }
        }

        // 4. Fallback to passed prop if available
        if (active && targetId === offeringId && assessments?.length) {
          setCourseAssessments(assessments)
          return
        }

        if (active) {
          setCourseAssessments([])
        }
      } catch (e) {
        console.error('Failed to load assessments for offering', e)
        if (active) {
          if (targetId === offeringId && assessments?.length) {
            setCourseAssessments(assessments)
          } else {
            setCourseAssessments([])
          }
        }
      }
    }

    loadAsm()
    return () => {
      active = false
    }
  }, [dialogOfferingId, offeringId, assessments, allOfferings])

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
      // If student is already enrolled in this offering's gradebook, always include
      if (s.enrollmentId) return true
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
                <FormField
                  label="Assessment Type"
                  required
                  hint={
                    courseAssessments.length === 0
                      ? 'No assessments found for this course. Please configure assessments in Assessment Management.'
                      : undefined
                  }
                >
                  <Select
                    value={selectedAssessmentId}
                    onValueChange={setSelectedAssessmentId}
                    disabled={courseAssessments.length === 0}
                  >
                    <SelectTrigger>
                      <SelectValue
                        placeholder={
                          courseAssessments.length === 0
                            ? 'No assessments found'
                            : 'Select assessment type'
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {courseAssessments.map((a) => {
                        const typeStr = typeLabel(a.type)
                        const isDistinct = a.name && a.name.trim().toLowerCase() !== typeStr.toLowerCase()
                        const labelText = isDistinct
                          ? `${typeStr} (${a.name}) — ${a.maxMarks} Marks (${a.weight}%)`
                          : `${typeStr} — ${a.maxMarks} Marks (${a.weight}%)`
                        return (
                          <SelectItem key={a.id} value={a.id}>
                            {labelText}
                          </SelectItem>
                        )
                      })}
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
                    <span className="text-muted-foreground font-medium">Assessment Type: </span>
                    <span className="font-semibold">{typeLabel(targetAssessment?.type)}</span>
                    {targetAssessment?.name &&
                      targetAssessment.name.trim().toLowerCase() !== typeLabel(targetAssessment?.type).toLowerCase() && (
                        <span className="text-muted-foreground ml-1">({targetAssessment.name})</span>
                      )}
                    {targetAssessment?.weight != null && (
                      <span className="text-muted-foreground ml-1">({targetAssessment.weight}%)</span>
                    )}
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
