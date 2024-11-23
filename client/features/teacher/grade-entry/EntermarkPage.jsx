import { useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  NotebookPen,
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
import { formatYearOfStudy, getCourseStudyYear } from '@/lib/format'
import { DEFAULT_GRADE_SCALE, computeWeightedTotal, gradeForScore, isPassing, validateMark } from '@/lib/grading'
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
  useWebSocketEvent('GRADING_POLICY_UPDATED', () => {
    refetchGradebook()
    toast.info('Grading policy updated by Admin — grades updated in real time.', {
      id: 'grading-policy-toast',
    })
  })
  useWebSocketEvent('GRADE_SCALE_UPDATED', () => {
    refetchGradebook()
  })
  useWebSocketEvent('ASSESSMENT_CREATED', () => {
    refetchGradebook()
  })
  useWebSocketEvent('ASSESSMENT_UPDATED', () => {
    refetchGradebook()
  })
  useWebSocketEvent('ASSESSMENT_DELETED', () => {
    refetchGradebook()
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

  // 4. Spreadsheet Grid states & TanStack Table
  const [gridEdits, setGridEdits] = useState({})
  const [globalFilter, setGlobalFilter] = useState('')
  const [sorting, setSorting] = useState([])
  const [savingGrid, setSavingGrid] = useState(false)
  const [editModalData, setEditModalData] = useState(null) // { row, isNew?: boolean }

  // Offering metadata
  const currentOffering = offerings?.find((o) => o.id === activeOfferingId)
  const assessments = useMemo(() => gradebook?.assessments ?? [], [gradebook?.assessments])
  const isLocked = Boolean(isLockedStatus(currentOffering?.gradeStatus))
  const gbRows = gradebook?.rows

  const targetDeptId =
    currentOffering?.teacher?.departmentId ||
    currentOffering?.teacher?.department?.id ||
    currentOffering?.course?.department?.id ||
    currentOffering?.departmentId

  const targetDeptName =
    currentOffering?.teacher?.department?.name ||
    currentOffering?.course?.department?.name ||
    (lookups?.departments ?? []).find((d) => d.id === targetDeptId)?.name ||
    'Department'

  const targetYearOfStudy =
    currentOffering?.yearOfStudy ??
    currentOffering?.year_of_study ??
    (currentOffering?.course ? getCourseStudyYear(currentOffering.course) : null)

  // Strictly filter rows to students whose department and current year of study match the assigned course offering
  const matchingGbRows = useMemo(() => {
    if (!gbRows) return []
    return gbRows.filter((r) => {
      const sDept = r.student?.departmentId || r.student?.department_id
      const sYear = r.student?.yearOfStudy ?? r.student?.year_of_study
      if (targetDeptId && sDept && sDept !== targetDeptId) return false
      if (targetYearOfStudy != null && sYear != null && Number(sYear) !== Number(targetYearOfStudy)) return false
      return true
    })
  }, [gbRows, targetDeptId, targetYearOfStudy])

  const scale = useMemo(
    () => (gradebook?.scale && gradebook.scale.length > 0 ? gradebook.scale : DEFAULT_GRADE_SCALE),
    [gradebook?.scale]
  )
  const passMark = gradebook?.passMark ?? 50

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
    if (!matchingGbRows || !assessments.length) return { gridChanges: [], gridErrors: {}, invalidCount: 0 }

    const changes = []
    const errors = {}
    let invalid = 0

    for (const r of matchingGbRows) {
      for (const a of assessments) {
        const k = `${r.enrollmentId}:${a.id}`
        if (!(k in gridEdits)) continue

        const maxAllowed = Number(a.weight ?? a.maxMarks ?? 100)
        const raw = String(gridEdits[k]).trim()
        const err = validateMark(raw, maxAllowed)
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
  }, [matchingGbRows, assessments, gridEdits, activeOfferingId])

  // Save batch changes from spreadsheet grid (all or for a specific assessment type)
  const handleSaveGrid = async (specificAssessmentId = null) => {
    const toSave = specificAssessmentId
      ? gridChanges.filter((c) => c.assessmentId === specificAssessmentId)
      : gridChanges

    const invalidInTarget = specificAssessmentId
      ? Object.keys(gridErrors).filter((k) => k.endsWith(`:${specificAssessmentId}`)).length
      : invalidCount

    if (invalidInTarget > 0) {
      toast.error(`Please fix ${invalidInTarget} invalid mark(s) before saving.`)
      return
    }
    if (toSave.length === 0) {
      toast.info('No changes to save.')
      return
    }

    setSavingGrid(true)
    try {
      const byOffering = {}
      for (const c of toSave) {
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

      toast.success(`Marks saved successfully (${toSave.length} score(s) updated).`)

      if (specificAssessmentId) {
        setGridEdits((prev) => {
          const next = { ...prev }
          for (const c of toSave) {
            delete next[`${c.enrollmentId}:${c.assessmentId}`]
          }
          return next
        })
      } else {
        setGridEdits({})
      }
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

  // 5. TanStack Table Data
  const tableData = useMemo(() => {
    if (!matchingGbRows) return []

    return matchingGbRows.map((r) => {
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
      const grade = calc.complete ? gradeForScore(calc.total, scale) : null
      const points = grade != null ? (grade.points ?? grade.gradePoints ?? 0) : null
      const passed = calc.complete && calc.total != null ? isPassing(calc.total, passMark) : null
      const isWithdrawn = r.enrollment?.status === 'withdrawn'

      return {
        enrollmentId: r.enrollmentId,
        studentId: r.student?.studentNumber || '',
        studentName: r.student?.name || '',
        section: r.section || currentOffering?.section || 'A',
        student: r.student,
        effectiveMarks,
        calc,
        grade,
        points: isWithdrawn ? null : points,
        passed,
        withdrawn: isWithdrawn,
        row: r,
      }
    })
  }, [matchingGbRows, assessments, gridEdits, currentOffering, scale, passMark])

  // 6. TanStack Table Column Definitions with generous spacing between headers
  const tableColumns = useMemo(() => {
    const cols = [
      {
        accessorKey: 'studentId',
        header: 'StudentID',
        cell: ({ row }) => (
          <span className="font-mono text-xs font-semibold whitespace-nowrap text-muted-foreground">
            {row.original.studentId}
          </span>
        ),
        meta: {
          colClass: 'tea-col-student-id',
        },
      },
      {
        accessorKey: 'studentName',
        header: 'Student Name',
        cell: ({ row }) => (
          <span className="font-semibold whitespace-nowrap text-foreground">
            {row.original.studentName}
          </span>
        ),
        meta: {
          colClass: 'tea-col-student-name',
        },
      },
      {
        accessorKey: 'section',
        header: 'Section',
        cell: ({ row }) => (
          <Badge variant="outline" className="text-xs px-2.5 py-0.5">
            Section {row.original.section}
          </Badge>
        ),
        meta: {
          colClass: 'tea-col-section',
        },
      },
      ...assessments.map((a, colIdx) => {
        const maxAllowed = Number(a.weight ?? a.maxMarks ?? 100)
        return {
          id: `assessment_${a.id}`,
          accessorFn: (row) => (row.effectiveMarks[a.id] != null ? row.effectiveMarks[a.id] : -1),
          enableSorting: true,
          header: () => (
            <div className="tea-assessment-header">
              <span className="tea-assessment-title">
                {a.name || typeLabel(a.type)}
              </span>
              <span className="tea-assessment-meta">
                Max: {maxAllowed} · {a.weight}%
              </span>
            </div>
          ),
          cell: ({ row, table }) => {
            const s = row.original
            const rowIdx = row.index
            const k = `${s.enrollmentId}:${a.id}`
            const isEdited = k in gridEdits
            const errorMsg = gridErrors[k]
            const currentVal = isEdited
              ? gridEdits[k]
              : s.effectiveMarks[a.id] != null
                ? String(s.effectiveMarks[a.id])
                : ''

            return (
              <Input
                data-cell={`${rowIdx}-${colIdx}`}
                type="number"
                step="any"
                min="0"
                max={maxAllowed}
                disabled={isLocked || s.withdrawn}
                value={currentVal}
                onChange={(e) => {
                  const val = e.target.value
                  if (val !== '' && val !== null) {
                    const num = Number(val)
                    if (!Number.isNaN(num) && num > maxAllowed) {
                      toast.error(`Cannot insert mark above ${maxAllowed} for ${a.name || typeLabel(a.type)}.`, {
                        id: `max-cap-${a.id}`,
                      })
                      return
                    }
                    if (!Number.isNaN(num) && num < 0) {
                      return
                    }
                  }
                  updateGridCell(s.enrollmentId, a.id, val)
                }}
                onKeyDown={(e) => handleGridKeyDown(e, rowIdx, colIdx, table.getRowModel().rows.length)}
                placeholder="—"
                className={cn(
                  "tea-grid-input",
                  isEdited && "tea-grid-input--dirty",
                  errorMsg && "tea-grid-input--error"
                )}
                title={errorMsg || (s.withdrawn ? 'Withdrawn' : undefined)}
              />
            )
          },
          meta: {
            colClass: 'tea-col-assessment',
          },
        }
      }),
      {
        id: 'totalScore',
        accessorFn: (row) => (row.calc.total != null ? row.calc.total : -1),
        header: 'Total (%)',
        cell: ({ row }) => (
          <span className="font-mono font-semibold text-sm">
            {row.original.calc.total != null ? `${row.original.calc.total}%` : '—'}
          </span>
        ),
        meta: {
          colClass: 'tea-col-total',
        },
      },
      {
        id: 'grade',
        accessorFn: (row) => row.grade?.letter ?? '',
        header: 'Grade',
        cell: ({ row }) => (
          row.original.grade?.letter ? (
            <GradeBadge letter={row.original.grade.letter} passed={row.original.passed} />
          ) : (
            <span className="text-muted-foreground font-mono">—</span>
          )
        ),
        meta: {
          colClass: 'tea-col-grade',
        },
      },
      {
        id: 'gradePoints',
        accessorFn: (row) => (row.points != null ? Number(row.points) : -1),
        header: 'Grade Points',
        cell: ({ row }) => (
          row.original.points != null ? (
            <span className="font-mono font-semibold text-sm tabular text-foreground">
              {Number(row.original.points).toFixed(2)}
            </span>
          ) : (
            <span className="text-muted-foreground font-mono">—</span>
          )
        ),
        meta: {
          colClass: 'tea-col-points',
        },
      },
      {
        id: 'status',
        accessorFn: (row) => (row.calc.complete ? 1 : 0),
        header: 'Status',
        cell: ({ row }) => (
          <Badge variant={row.original.calc.complete ? 'success' : 'warning'} className="px-2.5 py-0.5">
            {row.original.calc.complete
              ? 'Complete'
              : `${row.original.calc.enteredCount}/${row.original.calc.expectedCount} Entered`}
          </Badge>
        ),
        meta: {
          colClass: 'tea-col-status',
        },
      },
    ]
    return cols
  }, [assessments, gridEdits, gridErrors, isLocked])

  // 7. TanStack Table Instance
  const table = useReactTable({
    data: tableData,
    columns: tableColumns,
    state: {
      globalFilter,
      sorting,
    },
    onGlobalFilterChange: setGlobalFilter,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    globalFilterFn: (row, columnId, filterValue) => {
      const q = String(filterValue).toLowerCase().trim()
      if (!q) return true
      const orig = row.original
      const sNum = String(orig.studentId || '').toLowerCase()
      const sName = String(orig.studentName || '').toLowerCase()
      const sec = String(orig.section || '').toLowerCase()
      return (
        sNum.includes(q) ||
        sName.includes(q) ||
        sec.includes(q) ||
        `section ${sec}`.includes(q)
      )
    },
  })

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
            <Button
              size="sm"
              onClick={() => handleSaveGrid()}
              disabled={savingGrid || gridChanges.length === 0 || invalidCount > 0}
              title={
                gridChanges.length === 0
                  ? 'No unsaved marks to save'
                  : `Save ${gridChanges.length} unsaved mark(s)`
              }
            >
              <Save className="size-4 mr-1.5" />
              {savingGrid
                ? 'Saving…'
                : gridChanges.length > 0
                  ? `Save All Marks (${gridChanges.length})`
                  : 'Save All Marks'}
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
          {/* Grid Toolbar: Search on left, Target Info badge, Dropdown option on right edge */}
          <div className="tea-grid-toolbar">
            <div className="tea-grid-toolbar-left flex items-center gap-2.5">
              <SearchInput
                value={globalFilter ?? ''}
                onChange={setGlobalFilter}
                placeholder="Search student by name, ID, or section…"
                className="w-72"
              />
              {currentOffering && (
                <Badge variant="outline" className="text-xs px-2.5 py-1 font-medium text-muted-foreground border-border/80">
                  {targetDeptName} · {formatYearOfStudy(targetYearOfStudy)}
                </Badge>
              )}
            </div>

            <div className="tea-grid-toolbar-right">
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
                className="w-80"
                align="end"
              />
            </div>
          </div>

          {/* TanStack Spreadsheet Table */}
          {assessments.length === 0 ? (
            <EmptyState
              icon={NotebookPen}
              title="No assessment types configured"
              description="Please create assessments under Assessment Management before entering marks for this course."
            />
          ) : table.getRowModel().rows.length === 0 ? (
            <EmptyState
              icon={NotebookPen}
              title="No matching students found"
              description={
                globalFilter
                  ? 'No students match your search criteria.'
                  : `Only students whose department (${targetDeptName}) and current year of study (${formatYearOfStudy(targetYearOfStudy)}) match are eligible to be displayed.`
              }
            />
          ) : (
            <div className="tea-spreadsheet-wrap">
              <table className="tea-spreadsheet-table">
                <thead>
                  {table.getHeaderGroups().map((headerGroup) => (
                    <tr key={headerGroup.id}>
                      {headerGroup.headers.map((header) => {
                        const meta = header.column.columnDef.meta || {}
                        return (
                          <th
                            key={header.id}
                            className={meta.colClass}
                          >
                            {header.isPlaceholder
                              ? null
                              : flexRender(header.column.columnDef.header, header.getContext())}
                          </th>
                        )
                      })}
                    </tr>
                  ))}
                </thead>
                <tbody>
                  {table.getRowModel().rows.map((row) => (
                    <tr key={row.id}>
                      {row.getVisibleCells().map((cell) => {
                        const meta = cell.column.columnDef.meta || {}
                        return (
                          <td
                            key={cell.id}
                            className={meta.colClass}
                          >
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
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
          scale={scale}
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
  scale,
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
  const targetMax = targetAssessment ? Number(targetAssessment.weight ?? targetAssessment.maxMarks ?? 100) : 100
  const validationError = targetAssessment ? validateMark(mark, targetMax) : null

  const projectedCalc = useMemo(() => {
    if (!targetAssessment || mark === '' || validationError) return null
    const stuRow =
      initialRow?.row ||
      initialRow ||
      students.find(
        (r) =>
          r.enrollmentId === selectedStudentId ||
          r.student?.id === selectedStudentId,
      )
    const effectiveMarks = { ...(stuRow?.marks || stuRow?.effectiveMarks || {}) }
    effectiveMarks[targetAssessment.id] = Number(mark)
    const calc = computeWeightedTotal(courseAssessments, effectiveMarks)
    const grade = calc.complete ? gradeForScore(calc.total, scale) : null
    const points = grade != null ? (grade.points ?? grade.gradePoints ?? 0) : null
    return {
      calc,
      grade,
      points,
    }
  }, [targetAssessment, mark, validationError, initialRow, students, selectedStudentId, courseAssessments, scale])

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
                        const maxScore = Number(a.weight ?? a.maxMarks ?? 100)
                        const isDistinct = a.name && a.name.trim().toLowerCase() !== typeStr.toLowerCase()
                        const labelText = isDistinct
                          ? `${typeStr} (${a.name}) — ${maxScore} Marks (${a.weight}%)`
                          : `${typeStr} — ${maxScore} Marks (${a.weight}%)`
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
                  label={`Mark (Out of ${targetMax})`}
                  required
                  error={validationError}
                >
                  <Input
                    type="number"
                    step="any"
                    min="0"
                    max={targetMax}
                    value={mark}
                    onChange={(e) => {
                      const val = e.target.value
                      if (val !== '' && val !== null) {
                        const num = Number(val)
                        if (!Number.isNaN(num) && num > targetMax) {
                          toast.error(`Cannot insert mark above ${targetMax} for ${targetAssessment?.name || typeLabel(targetAssessment?.type)}.`, {
                            id: 'modal-max-cap',
                          })
                          return
                        }
                        if (!Number.isNaN(num) && num < 0) {
                          return
                        }
                      }
                      setMark(val)
                      setError(null)
                    }}
                    placeholder={`0 to ${targetMax}`}
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
                    <span className="tabular font-semibold">{targetMax}</span>
                  </p>
                  {projectedCalc?.points != null ? (
                    <p>
                      <span className="text-muted-foreground font-medium">Projected Grade Points: </span>
                      <span className="font-mono text-xs font-semibold tabular text-primary">
                        {Number(projectedCalc.points).toFixed(2)} pts ({projectedCalc.grade?.letter})
                      </span>
                    </p>
                  ) : (initialRow?.points != null || initialRow?.grade?.points != null) ? (
                    <p>
                      <span className="text-muted-foreground font-medium">Grade Points: </span>
                      <span className="font-mono text-xs font-semibold tabular">
                        {Number(initialRow?.points ?? initialRow?.grade?.points).toFixed(2)} pts
                      </span>
                    </p>
                  ) : null}
                </div>
              </div>

              <FormField
                label={`Mark (Out of ${targetMax})`}
                required
                error={validationError}
              >
                <Input
                  type="number"
                  step="any"
                  min="0"
                  max={targetMax}
                  value={mark}
                  onChange={(e) => {
                    const val = e.target.value
                    if (val !== '' && val !== null) {
                      const num = Number(val)
                      if (!Number.isNaN(num) && num > targetMax) {
                        toast.error(`Cannot insert mark above ${targetMax} for ${targetAssessment?.name || typeLabel(targetAssessment?.type)}.`, {
                          id: 'modal-max-cap',
                        })
                        return
                      }
                      if (!Number.isNaN(num) && num < 0) {
                        return
                      }
                    }
                    setMark(val)
                    setError(null)
                  }}
                  placeholder={`0 to ${targetMax}`}
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
