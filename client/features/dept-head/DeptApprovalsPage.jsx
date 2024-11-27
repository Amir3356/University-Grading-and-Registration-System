import { useEffect, useMemo, useState } from 'react'
import { listApprovalRequestsApi, getApprovalRequestApi, approveGradesApi, rejectGradesApi } from '@/api/grades'
import { useWebSocketEvent } from '@/lib/websocket'
import { formatNumber, formatYearOfStudy } from '@/lib/format'

import {
  ArrowLeft,
  Award,
  CheckCircle2,
  Clock,
  Percent,
  Printer,
  TrendingDown,
  Undo2,
  UserCheck,
  Users,
  XCircle,
} from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { PageHeader } from '@/components/common/PageHeader'
import { StatCard } from '@/components/common/StatCard'
import { GradeBadge, PassFailBadge, StatusBadge } from '@/components/common/StatusBadge'
import { FilterSelect } from '@/components/common/FilterSelect'
import { SearchInput } from '@/components/common/SearchInput'

const STORAGE_KEY = 'ugs-dept-grade-approvals-v4'

const INITIAL_APPROVAL_DATA = []

const STUDENT_NAMES = [
  'Abebe Bikila',
  'Almaz Ayana',
  'Derartu Tulu',
  'Haile Gebrselassie',
  'Kenenisa Bekele',
  'Tirunesh Dibaba',
  'Meseret Defar',
  'Eleni Gabre-Madhin',
  'Liya Kebede',
  'Marcus Samuelsson',
  'Solomon Tekalign',
  'Aster Aweke',
  'Tilahun Gessesse',
  'Mahmoud Ahmed',
  'Mulatu Astatke',
  'Girma Bèyènè',
  'Teddy Afro',
  'Rophnan Nuri',
  'Betty G',
  'Gossaye Tesfaye',
  'Yared Negu',
  'Tewodros Kassahun',
  'Eyob Mekonnen',
  'Kuku Sebsebe',
  'Hamrawit Kebede',
  'Dawit Tsige',
  'Zeritu Kebede',
  'Jano Band',
  'Asnakech Worku',
  'Ali Birra',
  'Bizunesh Bekele',
  'Neway Debebe',
  'Tamrat Desta',
  'Madingo Afework',
  'Befeqadu Hailu',
  'Hiwot Teffera',
  'Abel Tesfaye',
  'Senait Fisseha',
  'Segenet Kelemu',
  'Berhanu Nega',
  'Mulugeta Sergew',
  'Yidnekachew Tessema',
  'Girma Wolde-Giorgis',
  'Kassu Ilala',
  'Zewde Gebre-Sellassie',
  'Fasil Nahum',
  'Aklilu Lemma',
  'Legesse Wolde-Yohannes',
  'Gebisa Ejeta',
  'Seyoum Mesfin',
]

function computeGrade(total) {
  if (total >= 90) return { letter: 'A', points: 4.0, passed: true }
  if (total >= 85) return { letter: 'A-', points: 3.75, passed: true }
  if (total >= 80) return { letter: 'B+', points: 3.5, passed: true }
  if (total >= 75) return { letter: 'B', points: 3.0, passed: true }
  if (total >= 70) return { letter: 'B-', points: 2.75, passed: true }
  if (total >= 65) return { letter: 'C+', points: 2.5, passed: true }
  if (total >= 60) return { letter: 'C', points: 2.0, passed: true }
  if (total >= 50) return { letter: 'D', points: 1.0, passed: true }
  return { letter: 'F', points: 0.0, passed: false }
}

function getCourseStudents(courseCode, count) {
  const codeNum = courseCode.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
  const students = []

  for (let i = 0; i < count; i++) {
    const name = STUDENT_NAMES[i % STUDENT_NAMES.length]
    const studentNumber = `ETS${String(1001 + i).slice(1)}/16`

    const seed = (codeNum * (i + 7) * 9301 + 49297) % 233280
    const rand = seed / 233280

    const isStruggling = i === count - 3 || (i === 11 && count > 30)

    let quiz, assignment, midterm, finalExam
    if (isStruggling) {
      quiz = Number((3.5 + rand * 2.5).toFixed(1))
      assignment = Number((8.0 + rand * 3.5).toFixed(1))
      midterm = Number((11.0 + rand * 4.0).toFixed(1))
      finalExam = Number((16.0 + rand * 6.0).toFixed(1))
    } else {
      quiz = Number(Math.min(10, 7.0 + rand * 3.0).toFixed(1))
      assignment = Number(Math.min(20, 14.0 + rand * 6.0).toFixed(1))
      midterm = Number(Math.min(30, 22.0 + rand * 8.0).toFixed(1))
      finalExam = Number(Math.min(40, 29.0 + rand * 11.0).toFixed(1))
    }

    const total = Number((quiz + assignment + midterm + finalExam).toFixed(1))
    const { letter, points, passed } = computeGrade(total)

    students.push({
      id: `st_${courseCode.toLowerCase()}_${i + 1}`,
      studentNumber,
      name,
      yearOfStudy: (i % 4) + 1,
      section: 'A',
      quiz,
      assignment,
      midterm,
      finalExam,
      total,
      letter,
      points,
      passed,
    })
  }

  return students
}

function loadStoredData() {
  try {
    localStorage.removeItem('ugs-dept-grade-approvals-v3')
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) {
        return parsed
      }
    }
  } catch {
    // Ignore localStorage parse error
  }
  return INITIAL_APPROVAL_DATA
}

export function DeptApprovalsPage() {
  const [approvals, setApprovals] = useState([])
  const [selectedRowId, setSelectedRowId] = useState(null)

  const loadRealSubmissions = async () => {
    try {
      const res = await listApprovalRequestsApi()
      const items = res?.items || (Array.isArray(res) ? res : [])
      const mapped = items.map((s) => ({
        id: s.id,
        submissionId: s.id,
        offeringId: s.offering?.id,
        courseCode: s.offering?.course?.code || s.courseCode || 'CS101',
        courseName: s.offering?.course?.title || s.courseTitle || 'Course',
        teacherName: s.teacher?.name || 'Teacher',
        teacherId: s.teacher?.employeeNumber || 'TCH',
        totalStudent: s.studentCount || 0,
        submissionDate: s.submittedAt ? new Date(s.submittedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Recent',
        status: s.status ? s.status.charAt(0).toUpperCase() + s.status.slice(1) : 'Pending',
      }))
      setApprovals(mapped)
    } catch (err) {
      console.warn('Failed to load grade approval submissions:', err)
    }
  }

  useEffect(() => {
    loadRealSubmissions()
  }, [])

  useWebSocketEvent('OFFERING_UPDATED', () => {
    loadRealSubmissions()
  })

  useWebSocketEvent('GRADE_SUBMISSION_UPDATED', () => {
    loadRealSubmissions()
  })

  const selectedRow = useMemo(
    () => approvals.find((a) => a.id === selectedRowId) || null,
    [approvals, selectedRowId],
  )

  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [teacherFilter, setTeacherFilter] = useState('')

  const teacherOptions = useMemo(() => {
    const map = new Map()
    for (const a of approvals) {
      if (a.teacherName && !map.has(a.teacherName)) {
        map.set(a.teacherName, { value: a.teacherName, label: a.teacherName })
      }
    }
    return Array.from(map.values())
  }, [approvals])

  const filteredApprovals = useMemo(() => {
    return approvals.filter((a) => {
      // Status filter
      if (statusFilter && a.status.toLowerCase() !== statusFilter.toLowerCase()) {
        return false
      }
      // Teacher filter
      if (teacherFilter && a.teacherName !== teacherFilter) {
        return false
      }
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim()
        const cCode = String(a.courseCode || '').toLowerCase()
        const cName = String(a.courseName || '').toLowerCase()
        const tName = String(a.teacherName || '').toLowerCase()
        const tId = String(a.teacherId || '').toLowerCase()
        if (
          !cCode.includes(q) &&
          !cName.includes(q) &&
          !tName.includes(q) &&
          !tId.includes(q)
        ) {
          return false
        }
      }
      return true
    })
  }, [approvals, statusFilter, teacherFilter, searchQuery])

  const saveApprovals = (nextList) => {
    setApprovals(nextList)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextList))
    } catch {
      // Ignore quota error
    }
  }

  const handleApprove = async (id) => {
    const target = approvals.find((a) => a.id === id)
    if (!target) return
    const isCurrentlyApproved = target?.status === 'Approved'
    const newStatus = isCurrentlyApproved ? 'Pending' : 'Approved'

    try {
      if (newStatus === 'Approved' && target?.submissionId) {
        await approveGradesApi(target.submissionId, { comment: 'Approved by department head' })
      }
      await loadRealSubmissions()

      if (newStatus === 'Approved') {
        toast.success(`Grades for ${target?.courseCode || 'course'} approved!`)
      } else {
        toast.info(`Grades for ${target?.courseCode || 'course'} set back to Pending.`)
      }
    } catch (err) {
      console.error('Backend approval error:', err)
      toast.error(err.message || 'Failed to approve grades. Please try again.')
    }
  }

  const handleReject = async (id) => {
    const target = approvals.find((a) => a.id === id)
    if (!target) return
    const isCurrentlyRejected = target?.status === 'Rejected'
    const newStatus = isCurrentlyRejected ? 'Pending' : 'Rejected'

    try {
      if (newStatus === 'Rejected' && target?.submissionId) {
        await rejectGradesApi(target.submissionId, { comment: 'Returned by department head for revision' })
      }
      await loadRealSubmissions()

      if (newStatus === 'Rejected') {
        toast.info(`Teacher allowed to edit grades for ${target?.courseCode || 'course'}.`)
      } else {
        toast.info(`Grades for ${target?.courseCode || 'course'} set back to Pending.`)
      }
    } catch (err) {
      console.error('Backend rejection error:', err)
      toast.error(err.message || 'Failed to allow teacher to edit grades. Please try again.')
    }
  }

  // If a specific row was clicked, display its full submitted Grade Sheet
  if (selectedRow) {
    return (
      <FullSubmittedGradeSheet
        row={selectedRow}
        onBack={() => setSelectedRowId(null)}
        onApprove={() => handleApprove(selectedRow.id)}
        onReject={() => handleReject(selectedRow.id)}
      />
    )
  }

  return (
    <>
      <PageHeader
        title="Grade Approval"
        description="Review, approve, or return grade sheets submitted by teachers."
        centered
      />

      {/* Search Box Filter on left, Dropdown Filters flush at the far right edge */}
      <div className="toolbar--split mb-4">
        <div className="toolbar--split__left">
          <SearchInput
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search by course code, name, teacher, or ID…"
          />
        </div>

        <div className="toolbar--split__right">
          <FilterSelect
            label="Status"
            value={statusFilter}
            onChange={setStatusFilter}
            allLabel="All Statuses"
            options={[
              { value: 'Pending', label: 'Pending Approval' },
              { value: 'Approved', label: 'Approved' },
              { value: 'Rejected', label: 'Returned for Edit / Edit Allowed' },
            ]}
            className="w-40"
          />

          {teacherOptions.length > 1 && (
            <FilterSelect
              label="Instructor"
              value={teacherFilter}
              onChange={setTeacherFilter}
              allLabel="All Instructors"
              options={teacherOptions}
              className="w-48"
            />
          )}

          {(searchQuery || statusFilter || teacherFilter) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearchQuery('')
                setStatusFilter('')
                setTeacherFilter('')
              }}
              className="text-xs text-muted-foreground hover:text-foreground h-9"
            >
              Reset filters
            </Button>
          )}

          <div className="text-xs text-muted-foreground font-medium whitespace-nowrap pl-1">
            Showing <span className="font-semibold text-foreground">{filteredApprovals.length}</span> of {approvals.length}
          </div>
        </div>
      </div>

      <Card className="border shadow-sm">
        <CardContent className="p-0">
          <div className="table-wrap">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="font-semibold text-foreground">
                    Course code
                  </TableHead>
                  <TableHead className="font-semibold text-foreground">
                    Course Name
                  </TableHead>
                  <TableHead className="font-semibold text-foreground">
                    Teacher Name
                  </TableHead>
                  <TableHead className="font-semibold text-foreground">
                    Teacher ID
                  </TableHead>
                  <TableHead className="font-semibold text-foreground text-center">
                    Total Students
                  </TableHead>
                  <TableHead className="font-semibold text-foreground">
                    Submission Date
                  </TableHead>
                  <TableHead className="font-semibold text-foreground">
                    Status
                  </TableHead>
                  <TableHead className="font-semibold text-foreground text-right">
                    Action
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredApprovals.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-12 text-center text-muted-foreground">
                      <div className="flex flex-col items-center justify-center gap-1.5">
                        <span className="font-semibold text-foreground text-sm">No grade submissions found</span>
                        <span className="text-xs">
                          {searchQuery || statusFilter || teacherFilter
                            ? 'No submissions match your active search or filter criteria.'
                            : 'No grade submissions have been submitted yet.'}
                        </span>
                        {(searchQuery || statusFilter || teacherFilter) && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="mt-2 text-xs"
                            onClick={() => {
                              setSearchQuery('')
                              setStatusFilter('')
                              setTeacherFilter('')
                            }}
                          >
                            Clear filters
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredApprovals.map((row) => {
                  const isApproved = row.status === 'Approved'
                  const isRejected = row.status === 'Rejected'
                  const statusBadgeKey = isApproved ? 'approved' : isRejected ? 'rejected' : 'pending'

                  return (
                    <TableRow
                      key={row.id}
                      tabIndex={0}
                      role="button"
                      className="cursor-pointer transition-colors hover:bg-muted/50 focus-visible:bg-muted focus-visible:outline-none"
                      onClick={() => setSelectedRowId(row.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          setSelectedRowId(row.id)
                        }
                      }}
                      title="Click to view full submitted grade sheet"
                    >
                      <TableCell>
                        <span className="font-mono text-xs font-semibold text-primary">{row.courseCode}</span>
                      </TableCell>
                      <TableCell>
                        <span className="font-medium text-foreground">{row.courseName}</span>
                      </TableCell>
                      <TableCell className="text-foreground">
                        <span>{row.teacherName}</span>
                      </TableCell>
                      <TableCell>
                        <span className="font-mono text-xs text-muted-foreground">{row.teacherId}</span>
                      </TableCell>
                      <TableCell className="text-center tabular font-semibold text-foreground">
                        {row.totalStudent}
                      </TableCell>
                      <TableCell className="whitespace-nowrap tabular text-muted-foreground">
                        {row.submissionDate}
                      </TableCell>
                      <TableCell>
                        <StatusBadge
                          status={statusBadgeKey}
                          label={row.status}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                          {/* Approve Icon Button */}
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className={`size-8 rounded-md transition-all ${
                              isApproved
                                ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold'
                                : 'text-muted-foreground hover:bg-emerald-500/10 hover:text-emerald-600 dark:hover:text-emerald-400'
                            }`}
                            title={`Approve ${row.courseCode}`}
                            aria-label={`Approve ${row.courseCode}`}
                            onClick={(e) => {
                              e.stopPropagation()
                              handleApprove(row.id)
                            }}
                          >
                            <CheckCircle2 className="size-4" />
                          </Button>

                          {/* Allow Edit / Return Button */}
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className={`size-8 rounded-md transition-all ${
                              isRejected
                                ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400 font-bold'
                                : 'text-muted-foreground hover:bg-amber-500/10 hover:text-amber-600 dark:hover:text-amber-400'
                            }`}
                            title={isRejected ? `Editing currently allowed for ${row.courseCode}` : `Allow Teacher to Edit ${row.courseCode}`}
                            aria-label={`Allow Teacher to Edit ${row.courseCode}`}
                            onClick={(e) => {
                              e.stopPropagation()
                              handleReject(row.id)
                            }}
                          >
                            <Undo2 className="size-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                }))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </>
  )
}

/** Component that displays the full submitted Grade Sheet for the selected row. */
function FullSubmittedGradeSheet({ row, onBack, onApprove, onReject }) {
  const isApproved = row.status === 'Approved'
  const isRejected = row.status === 'Rejected'

  const [realData, setRealData] = useState(null)
  const [loadingDetails, setLoadingDetails] = useState(false)

  const fetchDetails = () => {
    const subId = row.submissionId || row.id
    if (!subId) return
    setLoadingDetails(true)
    getApprovalRequestApi(subId)
      .then((data) => {
        if (data) {
          setRealData(data)
        }
      })
      .catch((err) => {
        console.warn('Could not load real submission details:', err)
      })
      .finally(() => {
        setLoadingDetails(false)
      })
  }

  useEffect(() => {
    fetchDetails()
  }, [row.submissionId, row.id])

  useWebSocketEvent('OFFERING_UPDATED', () => {
    fetchDetails()
  })

  useWebSocketEvent('GRADE_SUBMISSION_UPDATED', () => {
    fetchDetails()
  })

  const assessments = useMemo(() => {
    if (realData?.assessments && realData.assessments.length > 0) {
      return realData.assessments
    }
    return null
  }, [realData])

  // Extract student marks: either real submitted records or deterministic fallback
  const students = useMemo(() => {
    if (realData?.rows && realData.rows.length > 0) {
      return realData.rows.map((r, idx) => {
        const studentNum =
          r.student?.studentNumber ||
          r.student?.student_number ||
          r.student?.id ||
          `STU${String(1001 + idx).slice(1)}`
        const studentName =
          r.student?.name ||
          (r.student?.firstName ? `${r.student.firstName} ${r.student.lastName || ''}`.trim() : '') ||
          'Student'
        const totalVal = r.total != null ? Number(r.total) : (r.runningPercent != null ? Number(r.runningPercent) : 0)
        const yearOfStudy = r.student?.yearOfStudy ?? r.student?.year_of_study ?? realData?.offering?.yearOfStudy ?? row.yearOfStudy ?? 1
        const section = r.section || realData?.offering?.section || row.section || 'A'
        const isWithdrawn = r.enrollment?.status === 'withdrawn'

        return {
          id: r.enrollmentId || `st_${idx}`,
          studentNumber: studentNum,
          name: studentName,
          yearOfStudy,
          section,
          withdrawn: isWithdrawn,
          marks: r.marks || {},
          total: Number(totalVal.toFixed(1)),
          letter: r.letter || 'F',
          points: typeof r.points === 'number' ? r.points : (typeof r.gradePoints === 'number' ? r.gradePoints : 0),
          passed: r.passed ?? ((r.letter || '').toUpperCase() !== 'F'),
        }
      })
    }
    return getCourseStudents(row.courseCode, row.totalStudent)
  }, [realData, row.courseCode, row.totalStudent, row.yearOfStudy, row.section])

  const count = students.length
  const passedCount = students.filter((s) => s.passed).length
  const failedCount = count - passedCount
  const passRate = count ? ((passedCount / count) * 100).toFixed(1) : 0

  const highestScore = count ? Math.max(...students.map((s) => s.total)).toFixed(1) : 0
  const lowestScore = count ? Math.min(...students.map((s) => s.total)).toFixed(1) : 0

  const [searchQuery, setSearchQuery] = useState('')
  const [resultFilter, setResultFilter] = useState('')
  const [gradeFilter, setGradeFilter] = useState('')

  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      if (resultFilter === 'passed' && !s.passed) return false
      if (resultFilter === 'failed' && (s.passed || s.withdrawn)) return false
      if (resultFilter === 'withdrawn' && !s.withdrawn) return false

      if (gradeFilter) {
        const studentLetter = String(s.letter || '').toUpperCase()
        if (!studentLetter.startsWith(gradeFilter.toUpperCase())) {
          return false
        }
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim()
        const idMatch = String(s.studentNumber || '').toLowerCase().includes(q)
        const nameMatch = String(s.name || '').toLowerCase().includes(q)
        const secMatch = String(s.section || '').toLowerCase().includes(q)
        if (!idMatch && !nameMatch && !secMatch) return false
      }

      return true
    })
  }, [students, resultFilter, gradeFilter, searchQuery])

  const assessmentAverages = useMemo(() => {
    if (!assessments) return null
    const avgs = {}
    for (const a of assessments) {
      const vals = students
        .map((s) => s.marks?.[a.id])
        .filter((v) => typeof v === 'number' && !isNaN(v))
      avgs[a.id] = vals.length ? (vals.reduce((x, y) => x + y, 0) / vals.length).toFixed(1) : '—'
    }
    return avgs
  }, [assessments, students])

  return (
    <div className="space-y-6">
      {/* Top Navigation Bar with Back button and Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button
          variant="outline"
          size="sm"
          onClick={onBack}
          className="gap-2 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Back to Grade Approval
        </Button>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className={`gap-1.5 transition-all ${
              isRejected
                ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400 font-semibold border-amber-500/40'
                : 'border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-800 dark:text-amber-400 dark:hover:bg-amber-950'
            }`}
            onClick={onReject}
            title="Unlock grades and allow the teacher to edit marks or assessments"
          >
            <Undo2 className="size-4" />
            {isRejected ? 'Editing Allowed' : 'Allow Teacher to Edit'}
          </Button>

          <Button
            variant="default"
            size="sm"
            className={`gap-1.5 transition-all ${
              isApproved
                ? 'bg-emerald-700 text-white font-semibold'
                : 'bg-emerald-600 hover:bg-emerald-700 text-white'
            }`}
            onClick={onApprove}
          >
            <CheckCircle2 className="size-4" />
            {isApproved ? 'Approved' : 'Approve Grade Sheet'}
          </Button>
        </div>
      </div>

      {/* KPI Metric Cards Grid - Horizontal 3 cards */}
      <div className="stat-cards-horizontal">
        <StatCard
          label="Total Students"
          value={count}
          icon={Users}
          hint="100% completed"
          tone="default"
        />
        <StatCard
          label="Pass Rate"
          value={`${passRate}%`}
          icon={Percent}
          hint={`${passedCount} passed · ${failedCount} failed`}
          tone={Number(passRate) >= 60 ? 'success' : 'warning'}
        />
        <StatCard
          label="Highest / Lowest"
          value={`${highestScore} / ${lowestScore}`}
          icon={TrendingDown}
          hint="Out of 100 max marks"
          tone="default"
        />
      </div>

      {/* Search Box filter on left and Dropdown filters flush on right */}
      <div className="tea-grid-toolbar">
        <div className="tea-grid-toolbar-left flex items-center gap-2.5">
          <SearchInput
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search student by ID, name, or section…"
            className="w-72"
          />
        </div>

        <div className="tea-grid-toolbar-right flex flex-wrap items-center gap-2.5">
          <FilterSelect
            label="Result"
            value={resultFilter}
            onChange={setResultFilter}
            allLabel="All Results"
            options={[
              { value: 'passed', label: 'Passed Students' },
              { value: 'failed', label: 'Failed Students' },
              { value: 'withdrawn', label: 'Withdrawn' },
            ]}
            className="w-40"
            align="end"
          />

          <FilterSelect
            label="Grade"
            value={gradeFilter}
            onChange={setGradeFilter}
            allLabel="All Grades"
            options={[
              { value: 'A', label: 'Grade A' },
              { value: 'B', label: 'Grade B' },
              { value: 'C', label: 'Grade C' },
              { value: 'D', label: 'Grade D' },
              { value: 'F', label: 'Grade F' },
            ]}
            className="w-36"
            align="end"
          />

          {(searchQuery || resultFilter || gradeFilter) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearchQuery('')
                setResultFilter('')
                setGradeFilter('')
              }}
              className="text-xs text-muted-foreground hover:text-foreground h-9"
            >
              Reset filters
            </Button>
          )}

          <div className="text-xs text-muted-foreground font-medium whitespace-nowrap pl-1">
            Showing <span className="font-semibold text-foreground">{filteredStudents.length}</span> of {count}
          </div>
        </div>
      </div>

      {/* Submitted Student Grade Records Table Card */}
      <Card className="border shadow-sm">
        <CardHeader className="flex flex-row items-center justify-center border-b py-3.5 text-center">
          <div className="flex items-center justify-center gap-2 w-full text-center">
            <CardTitle className="text-base font-semibold text-center">Student Grade Records</CardTitle>
            <Badge variant="outline" className="font-medium">
              {filteredStudents.length === count ? `${count} Students` : `${filteredStudents.length} of ${count} Students`}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="tea-spreadsheet-wrap">
            <table className="tea-spreadsheet-table">
              <thead>
                <tr>
                  <th className="tea-col-student-id">StudentID</th>
                  <th className="tea-col-student-name">Student Name</th>
                  <th className="tea-col-year">Year of Study</th>
                  <th className="tea-col-section">Section</th>
                  {assessments ? (
                    assessments.map((a) => {
                      const maxAllowed = Number(a.weight ?? a.maxMarks ?? 100)
                      return (
                        <th key={a.id} className="tea-col-assessment">
                          <div className="tea-assessment-header">
                            <span className="tea-assessment-title">
                              {a.name || a.type}
                            </span>
                            <span className="tea-assessment-meta">
                              Max: {maxAllowed} · {a.weight}%
                            </span>
                          </div>
                        </th>
                      )
                    })
                  ) : (
                    <>
                      <th className="tea-col-assessment">
                        <div className="tea-assessment-header">
                          <span className="tea-assessment-title">Quiz</span>
                          <span className="tea-assessment-meta">Max: 10 · 10%</span>
                        </div>
                      </th>
                      <th className="tea-col-assessment">
                        <div className="tea-assessment-header">
                          <span className="tea-assessment-title">Assignment</span>
                          <span className="tea-assessment-meta">Max: 20 · 20%</span>
                        </div>
                      </th>
                      <th className="tea-col-assessment">
                        <div className="tea-assessment-header">
                          <span className="tea-assessment-title">Midterm</span>
                          <span className="tea-assessment-meta">Max: 30 · 30%</span>
                        </div>
                      </th>
                      <th className="tea-col-assessment">
                        <div className="tea-assessment-header">
                          <span className="tea-assessment-title">Final Exam</span>
                          <span className="tea-assessment-meta">Max: 40 · 40%</span>
                        </div>
                      </th>
                    </>
                  )}
                  <th className="tea-col-total">Total (%)</th>
                  <th className="tea-col-grade">Grade</th>
                  <th className="tea-col-points">Grade Points</th>
                  <th className="tea-col-status">Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.length === 0 ? (
                  <tr>
                    <td
                      colSpan={(assessments ? assessments.length : 4) + 6}
                      className="py-12 text-center text-muted-foreground"
                    >
                      <div className="flex flex-col items-center justify-center gap-1.5">
                        <span className="font-semibold text-foreground text-sm">No student records found</span>
                        <span className="text-xs">
                          {searchQuery || resultFilter || gradeFilter
                            ? 'No students match your active search or filter criteria.'
                            : 'No student records available for this course offering.'}
                        </span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredStudents.map((student) => (
                  <tr key={student.id}>
                    <td className="tea-col-student-id">
                      <span className="font-mono text-xs font-semibold whitespace-nowrap text-muted-foreground">
                        {student.studentNumber}
                      </span>
                    </td>
                    <td className="tea-col-student-name">
                      <span className="font-semibold whitespace-nowrap text-foreground">
                        {student.name}
                      </span>
                    </td>
                    <td className="tea-col-year">
                      <span className="tabular text-xs font-medium whitespace-nowrap text-muted-foreground">
                        {formatYearOfStudy(student.yearOfStudy)}
                      </span>
                    </td>
                    <td className="tea-col-section">
                      <Badge variant="outline" className="text-xs px-2.5 py-0.5">
                        Section {student.section}
                      </Badge>
                    </td>
                    {assessments ? (
                      assessments.map((a) => (
                        <td key={a.id} className="tea-col-assessment">
                          <span className="font-semibold font-mono text-xs tabular text-foreground">
                            {student.marks?.[a.id] != null ? formatNumber(student.marks[a.id], 1) : '—'}
                          </span>
                        </td>
                      ))
                    ) : (
                      <>
                        <td className="tea-col-assessment">
                          <span className="font-semibold font-mono text-xs tabular text-foreground">{student.quiz}</span>
                        </td>
                        <td className="tea-col-assessment">
                          <span className="font-semibold font-mono text-xs tabular text-foreground">{student.assignment}</span>
                        </td>
                        <td className="tea-col-assessment">
                          <span className="font-semibold font-mono text-xs tabular text-foreground">{student.midterm}</span>
                        </td>
                        <td className="tea-col-assessment">
                          <span className="font-semibold font-mono text-xs tabular text-foreground">{student.finalExam}</span>
                        </td>
                      </>
                    )}
                    <td className="tea-col-total">
                      <span className="font-mono font-semibold text-sm">
                        {student.total != null ? `${formatNumber(student.total, 1)}%` : '—'}
                      </span>
                    </td>
                    <td className="tea-col-grade">
                      {student.letter ? (
                        <GradeBadge letter={student.letter} passed={student.passed} />
                      ) : (
                        <span className="text-muted-foreground font-mono">—</span>
                      )}
                    </td>
                    <td className="tea-col-points">
                      {student.points != null ? (
                        <span className="font-mono font-semibold text-sm tabular text-foreground">
                          {Number(student.points).toFixed(2)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground font-mono">—</span>
                      )}
                    </td>
                    <td className="tea-col-status">
                      {student.withdrawn ? (
                        <Badge variant="muted" className="px-2.5 py-0.5">
                          Withdrawn
                        </Badge>
                      ) : isApproved ? (
                        <Badge variant="success" className="px-2.5 py-0.5 inline-flex items-center gap-1.5 font-medium">
                          <CheckCircle2 className="size-3" />
                          Approved
                        </Badge>
                      ) : isRejected ? (
                        <Badge variant="danger" className="px-2.5 py-0.5 inline-flex items-center gap-1.5 font-medium">
                          <Undo2 className="size-3" />
                          Rejected
                        </Badge>
                      ) : (
                        <Badge variant="warning" className="px-2.5 py-0.5 inline-flex items-center gap-1.5 font-medium">
                          <Clock className="size-3" />
                          Pending
                        </Badge>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
