import { useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  FileCheck,
  Info,
  NotebookPen,
  Save,
  Send,
  Undo2,
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
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
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
import { formatNumber, formatYearOfStudy, getCourseStudyYear } from '@/lib/format'
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

  // 2. Offering and Year selection state
  const [selectedYearOfStudy, setSelectedYearOfStudy] = useState('')
  const [selectedOfferingId, setSelectedOfferingId] = useState('all')

  const getOfferingStudyYear = (o) => {
    if (!o) return null
    const y =
      o.yearOfStudy ??
      o.year_of_study ??
      o.course?.yearOfStudy ??
      (o.course?.level ? Math.floor(o.course.level / 100) : null) ??
      (o.course ? getCourseStudyYear(o.course) : null)
    return y != null && y !== '' ? String(y) : null
  }

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

  // Distinct years of study that this teacher teaches across their course offerings
  const teacherYearOptions = useMemo(() => {
    if (!offerings || offerings.length === 0) return []
    const yearSet = new Set()
    for (const o of offerings) {
      const y = getOfferingStudyYear(o)
      if (y != null) {
        yearSet.add(String(y))
      }
    }
    const sorted = Array.from(yearSet).sort((a, b) => Number(a) - Number(b))
    return sorted.map((y) => ({
      value: String(y),
      label: `Year ${y}`,
    }))
  }, [offerings])

  // Filter course offerings by the selected Year of Study
  const filteredCourseOfferings = useMemo(() => {
    if (!uniqueCourseOfferings) return []
    if (!selectedYearOfStudy || selectedYearOfStudy === 'all') return uniqueCourseOfferings
    const filtered = uniqueCourseOfferings.filter((o) => getOfferingStudyYear(o) === String(selectedYearOfStudy))
    return filtered.length > 0 ? filtered : uniqueCourseOfferings
  }, [uniqueCourseOfferings, selectedYearOfStudy])

  // Determine target offerings to query/display based on filters
  const targetOfferings = useMemo(() => {
    if (!offerings || offerings.length === 0) return []
    if (selectedOfferingId && selectedOfferingId !== 'all') {
      const specific = offerings.filter((o) => o.id === selectedOfferingId)
      if (specific.length > 0) return specific
    }
    if (selectedYearOfStudy && selectedYearOfStudy !== 'all') {
      const byYear = offerings.filter((o) => getOfferingStudyYear(o) === String(selectedYearOfStudy))
      if (byYear.length > 0) return byYear
    }
    return offerings
  }, [offerings, selectedOfferingId, selectedYearOfStudy])

  const activeOfferingId =
    selectedOfferingId && selectedOfferingId !== 'all'
      ? selectedOfferingId
      : targetOfferings.length === 1
        ? targetOfferings[0].id
        : null

  const currentOffering = offerings?.find((o) => o.id === activeOfferingId) || null

  // 3. Fetch gradebook data for target offerings
  const targetOfferingsKey = targetOfferings.map((o) => o.id).sort().join(',')
  const {
    data: gradebook,
    refetch: refetchGradebook,
  } = useQuery(
    async () => {
      if (!targetOfferings || targetOfferings.length === 0) return null
      const results = await Promise.allSettled(
        targetOfferings.map((o) => store.grades.getGradebook(o.id))
      )
      const successful = []
      for (let i = 0; i < results.length; i++) {
        if (results[i].status === 'fulfilled' && results[i].value) {
          successful.push({
            offering: targetOfferings[i],
            gradebook: results[i].value,
          })
        }
      }
      if (successful.length === 0) return null

      const offeringAssessmentsMap = {}
      const combinedRows = []
      const seenEnrollment = new Set()

      for (const { offering, gradebook: gb } of successful) {
        offeringAssessmentsMap[offering.id] = gb.assessments || []
        const rows = gb.rows || []
        for (const r of rows) {
          if (seenEnrollment.has(r.enrollmentId)) continue
          seenEnrollment.add(r.enrollmentId)
          combinedRows.push({
            ...r,
            offeringId: offering.id,
            offering,
            courseCode: offering.course?.code,
            courseTitle: offering.course?.title,
            offeringYearOfStudy: getOfferingStudyYear(offering),
            section: offering.section || r.enrollment?.section || '',
          })
        }
      }

      const primary = successful[0].gradebook
      return {
        ...primary,
        successfulOfferings: successful,
        offeringAssessmentsMap,
        rows: combinedRows,
        scale: primary.scale,
        passMark: primary.passMark,
        isMultiOffering: targetOfferings.length > 1,
      }
    },
    [targetOfferingsKey],
    { enabled: targetOfferings.length > 0 },
  )

  // 4. Spreadsheet Grid states & TanStack Table
  const [gridEdits, setGridEdits] = useState({})
  const [globalFilter, setGlobalFilter] = useState('')
  const [sorting, setSorting] = useState([])
  const [savingGrid, setSavingGrid] = useState(false)
  const [editModalData, setEditModalData] = useState(null) // { row, isNew?: boolean }
  const [submitDialogOpen, setSubmitDialogOpen] = useState(false)
  const [submittingGrades, setSubmittingGrades] = useState(false)
  const [showIncompleteList, setShowIncompleteList] = useState(false)

  // Assessment columns to display in spreadsheet
  const assessments = useMemo(() => {
    if (!gradebook?.offeringAssessmentsMap) return gradebook?.assessments ?? []
    if (targetOfferings.length === 1) {
      return gradebook.offeringAssessmentsMap[targetOfferings[0].id] || gradebook.assessments || []
    }

    const typeOrder = ['quiz', 'assignment', 'midterm', 'final', 'project', 'lab']
    const typeMap = new Map()

    for (const { offering } of (gradebook.successfulOfferings || [])) {
      const asms = gradebook.offeringAssessmentsMap[offering.id] || []
      for (const a of asms) {
        const key = (a.type || a.name || a.id).toLowerCase().trim()
        if (!typeMap.has(key)) {
          typeMap.set(key, {
            id: a.id,
            key,
            name: a.name || typeLabel(a.type),
            type: a.type,
            maxMarks: a.maxMarks,
            weight: a.weight,
            offeringMap: { [offering.id]: a },
          })
        } else {
          const existing = typeMap.get(key)
          existing.offeringMap[offering.id] = a
          if (!existing.weight && a.weight) existing.weight = a.weight
          if (!existing.maxMarks && a.maxMarks) existing.maxMarks = a.maxMarks
        }
      }
    }

    const items = Array.from(typeMap.values())
    items.sort((a, b) => {
      const idxA = typeOrder.indexOf(a.type?.toLowerCase())
      const idxB = typeOrder.indexOf(b.type?.toLowerCase())
      if (idxA !== -1 && idxB !== -1) return idxA - idxB
      if (idxA !== -1) return -1
      if (idxB !== -1) return 1
      return Number(a.weight || 0) - Number(b.weight || 0)
    })
    return items
  }, [gradebook, targetOfferings])
  
  // Real-time active grade status taking the freshest status from gradebook or offering
  const activeGradeStatus =
    currentOffering?.gradeStatus ||
    currentOffering?.grade_status ||
    gradebook?.offering?.grade_status ||
    gradebook?.offering?.gradeStatus ||
    'not_started'

  const isLocked = Boolean(
    currentOffering
      ? isLockedStatus(activeGradeStatus)
      : false
  )
  const offeringGradeStatus = activeGradeStatus
  const gbRows = gradebook?.rows

  const validDeptSet = useMemo(() => {
    const set = new Set()
    for (const o of (offerings || [])) {
      const cDeptId = o.course?.department?.id || o.course?.departmentId || o.departmentId
      const tDeptId = o.teacher?.departmentId || o.teacher?.department?.id
      if (cDeptId) set.add(cDeptId)
      if (tDeptId) set.add(tDeptId)
      if (o.course?.department?.code) set.add(o.course.department.code)
      if (o.teacher?.department?.code) set.add(o.teacher.department.code)
    }
    return set
  }, [offerings])

  // Filter rows based on department, selected Year of Study, and Course
  const matchingGbRows = useMemo(() => {
    if (!gbRows) return []
    return gbRows.filter((r) => {
      const sDept = r.student?.departmentId || r.student?.department_id
      const sYear = r.student?.yearOfStudy ?? r.student?.year_of_study ?? r.offeringYearOfStudy
      if (validDeptSet.size > 0 && sDept && !validDeptSet.has(sDept)) {
        const deptObj = (lookups?.departments ?? []).find((d) => d.id === sDept || d.code === sDept)
        if (deptObj && !validDeptSet.has(deptObj.id) && !validDeptSet.has(deptObj.code)) {
          return false
        }
      }
      if (selectedYearOfStudy && selectedYearOfStudy !== 'all' && sYear != null) {
        if (String(sYear) !== String(selectedYearOfStudy)) return false
      }
      if (selectedOfferingId && selectedOfferingId !== 'all') {
        if (r.offeringId && r.offeringId !== selectedOfferingId) return false
      }
      return true
    })
  }, [gbRows, validDeptSet, selectedYearOfStudy, selectedOfferingId, lookups?.departments])

  const scale = useMemo(
    () => (gradebook?.scale && gradebook.scale.length > 0 ? gradebook.scale : DEFAULT_GRADE_SCALE),
    [gradebook?.scale]
  )
  const passMark = gradebook?.passMark ?? 50

  // Change handler for Year of Study filter
  const handleYearOfStudyChange = (year) => {
    const val = year || ''
    setSelectedYearOfStudy(val)
    setGridEdits({})

    if (val && val !== 'all') {
      const matching = uniqueCourseOfferings.filter((o) => getOfferingStudyYear(o) === String(val))
      if (matching.length > 0) {
        const currentMatches = matching.some((o) => o.id === selectedOfferingId)
        if (!currentMatches) {
          setSelectedOfferingId(matching[0].id)
        }
      }
    } else {
      setSelectedOfferingId('all')
    }
  }

  // Change handler for Course filter (auto-syncs Year of Study)
  const handleCourseChange = (id) => {
    const val = id || 'all'
    setSelectedOfferingId(val)
    setGridEdits({})
    if (val && val !== 'all') {
      const targetOff = offerings?.find((o) => o.id === val)
      const offYear = getOfferingStudyYear(targetOff)
      if (offYear) {
        setSelectedYearOfStudy(offYear)
      }
    }
  }

  // Ensure active offering belongs to the selected year of study if one is selected
  useEffect(() => {
    if (selectedYearOfStudy && selectedYearOfStudy !== 'all' && filteredCourseOfferings.length > 0) {
      const currentMatches = filteredCourseOfferings.some((o) => o.id === selectedOfferingId)
      if (!currentMatches) {
        setSelectedOfferingId(filteredCourseOfferings[0].id)
      }
    }
  }, [selectedYearOfStudy, filteredCourseOfferings, selectedOfferingId])

  // Reset grid edits when target offerings change
  useEffect(() => {
    setGridEdits({})
  }, [targetOfferingsKey, gbRows])

  // Grid changes, validation, and dirty tracking
  const { gridChanges, gridErrors, invalidCount } = useMemo(() => {
    if (!matchingGbRows || !assessments.length) return { gridChanges: [], gridErrors: {}, invalidCount: 0 }

    const changes = []
    const errors = {}
    let invalid = 0

    for (const r of matchingGbRows) {
      const rowAsms = gradebook?.offeringAssessmentsMap?.[r.offeringId] || assessments
      for (const a of rowAsms) {
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
            offeringId: r.offeringId || (targetOfferings.length === 1 ? targetOfferings[0].id : null),
            enrollmentId: r.enrollmentId,
            assessmentId: a.id,
            marks: nextMark,
          })
        }
      }
    }
    return { gridChanges: changes, gridErrors: errors, invalidCount: invalid }
  }, [matchingGbRows, assessments, gridEdits, targetOfferings, gradebook?.offeringAssessmentsMap])

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
        await store.grades.saveScores(offId, { changes, reason: 'Grade adjustment / revision' })
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
      const rowAssessments = gradebook?.offeringAssessmentsMap?.[r.offeringId] || assessments
      const effectiveMarks = {}
      for (const a of rowAssessments) {
        const k = `${r.enrollmentId}:${a.id}`
        if (k in gridEdits) {
          const raw = String(gridEdits[k]).trim()
          effectiveMarks[a.id] = raw === '' ? null : Number(raw)
        } else {
          const saved = r.marks?.[a.id] ?? r.marks?.[a.id.replace(/_([a-z])/g, (_, l) => l.toUpperCase())] ?? null
          effectiveMarks[a.id] = saved
        }
      }
      const isWithdrawn = r.enrollment?.status === 'withdrawn'
      const calc = computeWeightedTotal(rowAssessments, effectiveMarks)
      const grade = calc.complete ? gradeForScore(calc.total, scale) : null
      const points = grade != null ? (grade.points ?? grade.gradePoints ?? 0) : null
      const isF = (grade?.letter || '').toUpperCase() === 'F'
      const passed = isWithdrawn
        ? null
        : isF
          ? false
          : calc.complete && calc.total != null
            ? isPassing(calc.total, passMark)
            : null

      const studentYear =
        r.student?.yearOfStudy ??
        r.student?.year_of_study ??
        r.offeringYearOfStudy ??
        currentOffering?.yearOfStudy ??
        currentOffering?.year_of_study ??
        (currentOffering?.course ? getCourseStudyYear(currentOffering.course) : null)

      return {
        enrollmentId: r.enrollmentId,
        offeringId: r.offeringId || currentOffering?.id,
        studentId: r.student?.studentNumber || r.student?.student_number || r.student?.id || '',
        studentName: r.student?.name || (r.student?.firstName ? `${r.student.firstName} ${r.student.lastName || ''}`.trim() : '') || 'Student',
        yearOfStudy: studentYear,
        courseCode: r.courseCode || r.offering?.course?.code || currentOffering?.course?.code || '',
        courseTitle: r.courseTitle || r.offering?.course?.title || currentOffering?.course?.title || '',
        section: r.section || currentOffering?.section || 'A',
        student: r.student,
        effectiveMarks,
        calc,
        grade,
        totalScore: calc.total,
        letter: grade?.letter || null,
        points: isWithdrawn ? null : points,
        passed,
        withdrawn: isWithdrawn,
        row: r,
      }
    })
  }, [matchingGbRows, assessments, gridEdits, currentOffering, scale, passMark, gradebook?.offeringAssessmentsMap])

  // Grade submission metrics & handler
  const weightTotal = useMemo(() => {
    return assessments.reduce((acc, a) => acc + Number(a.weight ?? a.maxMarks ?? 0), 0)
  }, [assessments])
  const weightsValid = assessments.length === 0 || Math.round(weightTotal) === 100

  const summaryStats = useMemo(() => {
    const total = tableData.length
    const active = tableData.filter((t) => !t.withdrawn)
    const complete = active.filter((t) => t.calc?.complete).length
    const incomplete = active.filter((t) => !t.calc?.complete).length
    const passed = active.filter((t) => t.passed === true && (t.grade?.letter || '').toUpperCase() !== 'F').length
    const failed = active.filter((t) => t.passed === false || (t.grade?.letter || '').toUpperCase() === 'F').length
    const withdrawn = tableData.filter((t) => t.withdrawn).length

    // Average score across active students with computed totals
    const validScores = active
      .map((t) => t.calc?.total ?? t.calc?.totalScore)
      .filter((s) => typeof s === 'number' && !isNaN(s))
    const averageScore =
      validScores.length > 0
        ? (validScores.reduce((a, b) => a + b, 0) / validScores.length).toFixed(1)
        : null

    // Grade distribution counts (A, B, C, D, F)
    const distribution = { A: 0, B: 0, C: 0, D: 0, F: 0 }
    active.forEach((t) => {
      const letter = String(t.grade?.letter || t.letter || (t.calc?.total != null ? gradeForScore(t.calc.total, scale)?.letter : '')).toUpperCase()
      if (letter.startsWith('A')) distribution.A++
      else if (letter.startsWith('B')) distribution.B++
      else if (letter.startsWith('C')) distribution.C++
      else if (letter.startsWith('D')) distribution.D++
      else if (letter.startsWith('F')) distribution.F++
    })

    return {
      total,
      activeCount: active.length,
      complete,
      incomplete,
      passed,
      failed,
      withdrawn,
      averageScore,
      distribution,
    }
  }, [tableData, scale])

  const incompleteStudents = useMemo(() => {
    return tableData
      .filter((t) => !t.calc?.complete && !t.withdrawn)
      .map((t) => {
        const rowAsms = gradebook?.offeringAssessmentsMap?.[t.offeringId] || assessments
        const missing = rowAsms
          .filter((a) => t.effectiveMarks?.[a.id] == null || t.effectiveMarks?.[a.id] === '')
          .map((a) => a.name)
        const currentTotal = t.calc?.total ?? t.calc?.totalScore
        return {
          id: t.studentId,
          name: t.studentName,
          missing,
          currentTotal: currentTotal != null ? Number(currentTotal).toFixed(1) : '0.0',
        }
      })
  }, [tableData, assessments, gradebook?.offeringAssessmentsMap])

  const handleSubmitGrades = async () => {
    if (!activeOfferingId) return
    setSubmittingGrades(true)
    try {
      if (gridChanges.length > 0) {
        if (invalidCount > 0) {
          toast.error(`Please fix ${invalidCount} invalid mark(s) before submitting.`)
          setSubmittingGrades(false)
          return
        }
        await handleSaveGrid()
      }

      await store.grades.submitGrades(activeOfferingId)
      toast.success('Grades submitted successfully to Department Head for review.')
      setSubmitDialogOpen(false)
      setShowIncompleteList(false)
      await refetchOfferings()
      await refetchGradebook()
    } catch (err) {
      toast.error(err.message || 'Failed to submit grades.')
    } finally {
      setSubmittingGrades(false)
    }
  }

  const submissionStudents = tableData

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
        accessorKey: 'yearOfStudy',
        header: 'Year of Study',
        cell: ({ row }) => (
          <span className="tabular text-xs font-medium whitespace-nowrap text-muted-foreground">
            {formatYearOfStudy(row.original.yearOfStudy)}
          </span>
        ),
        meta: {
          colClass: 'tea-col-year',
        },
      },
      {
        accessorKey: 'courseCode',
        header: 'Course',
        cell: ({ row }) => (
          <Badge variant="outline" className="font-mono text-xs font-semibold px-2 py-0.5">
            {row.original.courseCode || '—'}
          </Badge>
        ),
        meta: {
          colClass: 'tea-col-course',
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
          accessorFn: (row) => {
            const concreteAsm = a.offeringMap
              ? a.offeringMap[row.offeringId]
              : (a.offeringId && a.offeringId !== row.offeringId ? null : a)
            if (!concreteAsm) return -1
            return row.effectiveMarks[concreteAsm.id] != null ? row.effectiveMarks[concreteAsm.id] : -1
          },
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
            const concreteAsm = a.offeringMap
              ? a.offeringMap[s.offeringId]
              : (a.offeringId && a.offeringId !== s.offeringId ? null : a)

            if (!concreteAsm) {
              return (
                <div className="flex items-center justify-center text-muted-foreground/30 font-mono text-xs py-1 select-none">
                  —
                </div>
              )
            }

            const concreteId = concreteAsm.id
            const concreteMax = Number(concreteAsm.weight ?? concreteAsm.maxMarks ?? maxAllowed)
            const k = `${s.enrollmentId}:${concreteId}`
            const isEdited = k in gridEdits
            const errorMsg = gridErrors[k]
            const currentVal = isEdited
              ? gridEdits[k]
              : s.effectiveMarks[concreteId] != null
                ? String(s.effectiveMarks[concreteId])
                : ''

            const rowOffering = offerings?.find((o) => o.id === s.offeringId) || currentOffering
            const rowStatus = rowOffering?.gradeStatus || rowOffering?.grade_status || offeringGradeStatus
            const rowLocked = isLockedStatus(rowStatus)

            return (
              <Input
                data-cell={`${rowIdx}-${colIdx}`}
                type="number"
                step="any"
                min="0"
                max={concreteMax}
                disabled={rowLocked || s.withdrawn}
                value={currentVal}
                onChange={(e) => {
                  const val = e.target.value
                  if (val !== '' && val !== null) {
                    const num = Number(val)
                    if (!Number.isNaN(num) && num > concreteMax) {
                      toast.error(`Cannot insert mark above ${concreteMax} for ${concreteAsm.name || typeLabel(concreteAsm.type)}.`, {
                        id: `max-cap-${concreteId}`,
                      })
                      return
                    }
                    if (!Number.isNaN(num) && num < 0) {
                      return
                    }
                  }
                  updateGridCell(s.enrollmentId, concreteId, val)
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
        accessorFn: (row) => {
          if (row.withdrawn) return 'withdrawn'
          const rowOffering = offerings?.find((o) => o.id === row.offeringId) || currentOffering
          const status = rowOffering?.gradeStatus || offeringGradeStatus
          if (status === 'submitted') return 'pending'
          if (status === 'rejected') return 'rejected'
          if (status === 'approved') return 'approved'
          if (status === 'published') return 'published'
          return row.calc.complete ? 'draft' : 'incomplete'
        },
        header: 'Status',
        cell: ({ row }) => {
          if (row.original.withdrawn) {
            return (
              <Badge variant="muted" className="px-2.5 py-0.5">
                Withdrawn
              </Badge>
            )
          }

          const rowOffering = offerings?.find((o) => o.id === row.original.offeringId) || currentOffering
          const status = rowOffering?.gradeStatus || offeringGradeStatus

          if (status === 'submitted') {
            return (
              <Badge variant="warning" className="px-2.5 py-0.5 inline-flex items-center gap-1.5 font-medium">
                <Clock className="size-3" />
                Pending
              </Badge>
            )
          }

          if (status === 'rejected') {
            return (
              <Badge variant="danger" className="px-2.5 py-0.5 inline-flex items-center gap-1.5 font-medium">
                <Undo2 className="size-3" />
                Rejected
              </Badge>
            )
          }

          if (status === 'approved') {
            return (
              <Badge variant="success" className="px-2.5 py-0.5 inline-flex items-center gap-1.5 font-medium">
                <CheckCircle2 className="size-3" />
                Approved
              </Badge>
            )
          }

          if (status === 'published') {
            return (
              <Badge variant="success" className="px-2.5 py-0.5 inline-flex items-center gap-1.5 font-medium">
                <CheckCircle2 className="size-3" />
                Published
              </Badge>
            )
          }

          return (
            <Badge
              variant={row.original.calc.complete ? 'secondary' : 'warning'}
              className="px-2.5 py-0.5 font-medium"
            >
              {row.original.calc.complete
                ? 'Draft'
                : row.original.calc.expectedCount === 0
                  ? 'No assessments'
                  : `${row.original.calc.enteredCount}/${row.original.calc.expectedCount} Entered`}
            </Badge>
          )
        },
        meta: {
          colClass: 'tea-col-status',
        },
      },
    ]
    return cols
  }, [assessments, gridEdits, gridErrors, isLocked, offeringGradeStatus, offerings, currentOffering])

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
      const yr = formatYearOfStudy(orig.yearOfStudy).toLowerCase()
      const cCode = String(orig.courseCode || '').toLowerCase()
      const cTitle = String(orig.courseTitle || '').toLowerCase()
      return (
        sNum.includes(q) ||
        sName.includes(q) ||
        sec.includes(q) ||
        `section ${sec}`.includes(q) ||
        yr.includes(q) ||
        cCode.includes(q) ||
        cTitle.includes(q)
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
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleSaveGrid()}
              disabled={savingGrid || isLocked || gridChanges.length === 0 || invalidCount > 0}
              title={
                isLocked
                  ? 'Marks are locked'
                  : gridChanges.length === 0
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

            {currentOffering && (
              <>
                {activeGradeStatus === 'submitted' && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled
                    className="gap-1.5 opacity-90 border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400 cursor-default"
                  >
                    <Clock className="size-4" />
                    Submitted for Review
                  </Button>
                )}
                {activeGradeStatus === 'approved' && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled
                    className="gap-1.5 opacity-90 border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-400 cursor-default"
                  >
                    <CheckCircle2 className="size-4" />
                    Grades Approved
                  </Button>
                )}
                {activeGradeStatus === 'published' && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled
                    className="gap-1.5 opacity-90 border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 cursor-default"
                  >
                    <CheckCircle2 className="size-4" />
                    Grades Published
                  </Button>
                )}
                {!['submitted', 'approved', 'published'].includes(activeGradeStatus) && (
                  <Button
                    size="sm"
                    variant={activeGradeStatus === 'rejected' ? 'destructive' : 'default'}
                    onClick={() => setSubmitDialogOpen(true)}
                    disabled={savingGrid || assessments.length === 0 || tableData.length === 0}
                    title={
                      assessments.length === 0
                        ? 'Configure assessments before submitting grades'
                        : tableData.length === 0
                          ? 'No eligible students enrolled'
                          : activeGradeStatus === 'rejected'
                            ? 'Resubmit revised grades to Department Head'
                            : 'Submit final grades to Department Head for review'
                    }
                  >
                    <Send className="size-4 mr-1.5" />
                    {activeGradeStatus === 'rejected' ? 'Resubmit Grades' : 'Submit Grades'}
                  </Button>
                )}
              </>
            )}
          </div>
        }
      />

      {(!offerings || offerings.length === 0) ? (
        <EmptyState
          icon={NotebookPen}
          title="No courses assigned"
          description="You do not have any active course offerings to enter marks for."
        />
      ) : (
        <div className="space-y-4">
          {/* Grid Toolbar: Search on left, Dropdown options on right */}
          <div className="tea-grid-toolbar">
            <div className="tea-grid-toolbar-left flex items-center gap-2.5">
              <SearchInput
                value={globalFilter ?? ''}
                onChange={setGlobalFilter}
                placeholder="Search student by name, ID, or section…"
                className="w-72"
              />
            </div>

            <div className="tea-grid-toolbar-right flex flex-wrap items-center gap-2.5">
              <FilterSelect
                label="Year of Study"
                value={selectedYearOfStudy}
                onChange={handleYearOfStudyChange}
                options={teacherYearOptions}
                includeAll={false}
                placeholder="Year of Study"
                className="w-48"
                align="end"
              />
              <FilterSelect
                label="Course"
                value={selectedOfferingId || 'all'}
                onChange={handleCourseChange}
                includeAll={true}
                allLabel="All Courses"
                options={filteredCourseOfferings.map((o) => ({
                  value: o.id,
                  label: `${o.course.code} — ${o.course.title} (${o.semester.name})`,
                }))}
                className="w-80"
                align="end"
              />
            </div>
          </div>

          {/* TanStack Spreadsheet Table */}
          {assessments.length === 0 && (
            <Alert className="mb-4">
              <Info className="size-4" />
              <AlertDescription>
                No assessments configured yet for this course offering. You can configure assessments under Assessment Management before entering marks.
              </AlertDescription>
            </Alert>
          )}

          {table.getRowModel().rows.length === 0 ? (
            <EmptyState
              icon={NotebookPen}
              title="No matching students found"
              description={
                globalFilter
                  ? 'No students match your search criteria.'
                  : selectedYearOfStudy && selectedYearOfStudy !== 'all'
                    ? `No students found for Year ${selectedYearOfStudy}.`
                    : 'No eligible students found for the assigned courses.'
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

      {/* Grade Submission Dialog */}
      <Dialog
        open={submitDialogOpen}
        onOpenChange={(open) => {
          setSubmitDialogOpen(open)
          if (!open) {
            setShowIncompleteList(false)
          }
        }}
      >
        <DialogContent size="xl" className="max-w-4xl max-h-[92vh] flex flex-col p-6">
          <DialogHeader className="tea-submit-dialog-header" style={{ textAlign: 'center', alignItems: 'center', paddingRight: 0 }}>
            <DialogTitle
              className="tea-submit-dialog-title"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
                width: '100%',
                gap: '0.5rem',
              }}
            >
              <FileCheck className="size-5 text-primary" />
              {activeGradeStatus === 'rejected'
                ? 'Resubmit Grades for Department Approval'
                : 'Submit Grades for Department Approval'}
            </DialogTitle>
            <DialogDescription className="tea-submit-dialog-desc" style={{ textAlign: 'center' }}>
              Review all student marks and submit final grades for <span className="font-semibold text-foreground">{currentOffering?.course?.code} — {currentOffering?.course?.title}</span> ({currentOffering?.semester?.name || 'Current Term'}, Section {currentOffering?.section || 'A'}).
            </DialogDescription>
          </DialogHeader>

          <div className="tea-submit-modal flex-1 overflow-y-auto pr-1 space-y-4">
            {/* Quick Metrics Cards */}
            <div className="tea-submit-grid">
              <div className="tea-submit-card tea-submit-card--complete">
                <span className="tea-submit-card__label">Complete Marks</span>
                <span className="tea-submit-card__value">{summaryStats.complete}</span>
              </div>

              <div className={cn(
                "tea-submit-card",
                summaryStats.incomplete > 0 && "tea-submit-card--incomplete"
              )}>
                <span className="tea-submit-card__label">Incomplete Marks</span>
                <span className="tea-submit-card__value">{summaryStats.incomplete}</span>
              </div>

              <div className="tea-submit-card">
                <span className="tea-submit-card__label">Passed / Failed</span>
                <span className="tea-submit-card__value">
                  <span style={{ color: 'var(--success, #059669)', fontWeight: 700 }}>{summaryStats.passed}</span>
                  <span className="text-muted-foreground font-normal"> / </span>
                  <span style={{ color: summaryStats.failed > 0 ? 'var(--destructive, #dc2626)' : 'inherit', fontWeight: 700 }}>
                    {summaryStats.failed}
                  </span>
                </span>
              </div>
            </div>

            {/* Student Marks Table Review Section */}
            <div className="space-y-2 border rounded-lg p-3 bg-muted/20">
              {/* Table displaying each student's ID, Name, and each assessment type mark */}
              <div className="border rounded-md overflow-hidden bg-background max-h-64 overflow-y-auto">
                <Table className="text-xs">
                  <TableHeader className="sticky top-0 bg-muted/95 backdrop-blur z-10 border-b">
                    <TableRow className="hover:bg-muted/95">
                      <TableHead className="font-semibold text-foreground whitespace-nowrap">Student ID</TableHead>
                      <TableHead className="font-semibold text-foreground whitespace-nowrap">Student Name</TableHead>
                      <TableHead className="font-semibold text-foreground text-center whitespace-nowrap">Year of Study</TableHead>
                      {assessments.map((a) => (
                        <TableHead key={a.id} className="font-semibold text-foreground text-center whitespace-nowrap">
                          {a.name} <span className="font-normal text-muted-foreground text-[10px]">({a.weight ?? a.maxMarks}%)</span>
                        </TableHead>
                      ))}
                      <TableHead className="font-semibold text-foreground text-center whitespace-nowrap">Total</TableHead>
                      <TableHead className="font-semibold text-foreground text-center whitespace-nowrap">Grade</TableHead>
                      <TableHead className="font-semibold text-foreground text-center whitespace-nowrap">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {submissionStudents.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={assessments.length + 6} className="py-8 text-center text-muted-foreground">
                          No students enrolled.
                        </TableCell>
                      </TableRow>
                    ) : (
                      submissionStudents.map((st) => {
                        const isComplete = Boolean(st.calc?.complete)
                        return (
                          <TableRow
                            key={st.enrollmentId || st.studentId}
                            className={cn(
                              !isComplete && !st.withdrawn && "bg-amber-500/5 hover:bg-amber-500/10"
                            )}
                          >
                            <TableCell className="font-mono font-medium text-foreground whitespace-nowrap">
                              {st.studentId}
                            </TableCell>
                            <TableCell className="font-medium text-foreground whitespace-nowrap">
                              {st.studentName}
                            </TableCell>
                            <TableCell className="text-center tabular text-xs text-muted-foreground whitespace-nowrap">
                              {formatYearOfStudy(st.yearOfStudy)}
                            </TableCell>
                            {assessments.map((a) => {
                              const val = st.effectiveMarks?.[a.id]
                              const hasMark = val != null && val !== ''
                              return (
                                <TableCell key={a.id} className="text-center tabular whitespace-nowrap">
                                  {hasMark ? (
                                    <span className="font-semibold text-foreground">{formatNumber(val, 1)}</span>
                                  ) : (
                                    <Badge variant="warning" className="text-[10px] py-0 px-1.5 font-semibold">
                                      Missing
                                    </Badge>
                                  )}
                                </TableCell>
                              )
                            })}
                            {(() => {
                              const totalVal = st.calc?.total ?? st.calc?.totalScore ?? st.totalScore
                              const letterVal = st.grade?.letter ?? st.letter ?? (totalVal != null ? gradeForScore(totalVal, scale)?.letter : null)
                              return (
                                <>
                                  <TableCell className="text-center font-bold tabular text-foreground whitespace-nowrap">
                                    {totalVal != null ? `${formatNumber(totalVal, 1)}%` : '—'}
                                  </TableCell>
                                  <TableCell className="text-center font-bold whitespace-nowrap">
                                    {letterVal ? (
                                      <GradeBadge letter={letterVal} passed={st.passed} />
                                    ) : (
                                      <span className="text-muted-foreground font-mono">—</span>
                                    )}
                                  </TableCell>
                                </>
                              )
                            })()}
                            <TableCell className="text-center whitespace-nowrap">
                              {st.withdrawn ? (
                                <Badge variant="muted" className="text-[10px] py-0 px-1.5 font-medium">
                                  Withdrawn
                                </Badge>
                              ) : isComplete ? (
                                <Badge variant="success" className="text-[10px] py-0 px-1.5 font-medium inline-flex items-center gap-1">
                                  <CheckCircle2 className="size-2.5" /> Complete
                                </Badge>
                              ) : (
                                <Badge variant="warning" className="text-[10px] py-0 px-1.5 font-medium inline-flex items-center gap-1">
                                  <AlertCircle className="size-2.5" /> Incomplete
                                </Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        )
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* Incomplete warning if any */}
            {summaryStats.incomplete > 0 && (
              <Alert variant="warning" className="py-2.5">
                <AlertCircle className="size-4" />
                <div className="w-full">
                  <AlertTitle className="text-xs font-semibold">Missing Assessment Marks</AlertTitle>
                  <AlertDescription className="text-xs mt-0.5">
                    {summaryStats.incomplete} active student(s) have not had all assessment marks entered. They will be submitted with partial marks or failing status unless entered.
                  </AlertDescription>
                </div>
              </Alert>
            )}

          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setSubmitDialogOpen(false)
                setShowIncompleteList(false)
              }}
              disabled={submittingGrades}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="default"
              onClick={handleSubmitGrades}
              loading={submittingGrades}
              disabled={submittingGrades || assessments.length === 0}
            >
              <Send className="size-4 mr-1.5" />
              {activeGradeStatus === 'rejected' ? 'Resubmit to Dept Head' : 'Submit to Dept Head'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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

  useEffect(() => {
    if (initialRow && selectedAssessmentId) {
      const currentVal =
        initialRow.effectiveMarks?.[selectedAssessmentId] ??
        initialRow.row?.marks?.[selectedAssessmentId] ??
        (initialRow.assessment?.id === selectedAssessmentId ? initialRow.mark : null)
      if (currentVal != null && currentVal !== '') {
        setMark(String(currentVal))
      } else {
        setMark('')
      }
    }
  }, [initialRow, selectedAssessmentId])
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
                    <span className="font-mono text-xs font-semibold">{targetStudent?.studentNumber ?? initialRow?.student?.studentNumber ?? initialRow?.studentId}</span>
                  </p>
                  <p>
                    <span className="text-muted-foreground font-medium">Student Name: </span>
                    <span className="font-semibold">{targetStudent?.name ?? initialRow?.student?.name ?? initialRow?.studentName}</span>
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

              {courseAssessments.length > 1 && (
                <FormField label="Assessment Component" required className="mb-3">
                  <Select value={selectedAssessmentId} onValueChange={setSelectedAssessmentId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select assessment to edit" />
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
              )}

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
