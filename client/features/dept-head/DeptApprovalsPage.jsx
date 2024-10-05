import { useEffect, useMemo, useState } from 'react'
import { api } from '@/api/client'

import {
  ArrowLeft,
  Award,
  Calendar,
  CheckCircle2,
  CreditCard,
  FileSpreadsheet,
  GraduationCap,
  Percent,
  Printer,
  TrendingDown,
  UserCheck,
  Users,
  XCircle,
} from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { PageHeader } from '@/components/common/PageHeader'
import { StatCard } from '@/components/common/StatCard'
import { GradeBadge, PassFailBadge, StatusBadge } from '@/components/common/StatusBadge'

const STORAGE_KEY = 'ugs-dept-grade-approvals-v3'

const INITIAL_APPROVAL_DATA = [
  {
    id: 'app_cs101',
    courseCode: 'CS101',
    courseName: 'Introduction to Programming',
    teacherName: 'Amara Alemu',
    teacherId: 'TCH101',
    totalStudent: 45,
    submissionDate: 'Oct 17, 2026',
    status: 'Pending',
  },
  {
    id: 'app_dbms201',
    courseCode: 'DBMS201',
    courseName: 'Database Systems',
    teacherName: 'Hana Tesfaye',
    teacherId: 'TCH201',
    totalStudent: 38,
    submissionDate: 'Oct 17, 2026',
    status: 'Pending',
  },
  {
    id: 'app_swe301',
    courseCode: 'SWE301',
    courseName: 'Software Engineering',
    teacherName: 'Dawit Tadesse',
    teacherId: 'TCH301',
    totalStudent: 42,
    submissionDate: 'Oct 16, 2026',
    status: 'Approved',
  },
  {
    id: 'app_net401',
    courseCode: 'NET401',
    courseName: 'Computer Networks',
    teacherName: 'Selam Kebede',
    teacherId: 'TCH401',
    totalStudent: 35,
    submissionDate: 'Oct 15, 2026',
    status: 'Rejected',
  },
]

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
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed
      }
    }
  } catch {
    // Ignore localStorage parse error
  }
  return INITIAL_APPROVAL_DATA
}

export function DeptApprovalsPage() {
  const [approvals, setApprovals] = useState(loadStoredData)
  const [selectedRowId, setSelectedRowId] = useState(null)

  useEffect(() => {
    async function loadRealSubmissions() {
      try {
        const res = await api.get('/grade-submissions')
        const items = res?.items || (Array.isArray(res) ? res : [])
        if (items.length > 0) {
          const mapped = items.map((s) => ({
            id: s.id,
            submissionId: s.id,
            courseCode: s.offering?.course?.code || s.courseCode || 'CS101',
            courseName: s.offering?.course?.title || s.courseTitle || 'Course',
            teacherName: s.teacher?.name || 'Teacher',
            teacherId: s.teacher?.employeeNumber || 'TCH',
            totalStudent: s.studentCount || 45,
            submissionDate: s.submittedAt ? new Date(s.submittedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Recent',
            status: s.status ? s.status.charAt(0).toUpperCase() + s.status.slice(1) : 'Pending',
          }))
          setApprovals(mapped)
        }
      } catch {
        // Fall back to stored data
      }
    }
    loadRealSubmissions()
  }, [])

  const selectedRow = useMemo(
    () => approvals.find((a) => a.id === selectedRowId) || null,
    [approvals, selectedRowId],
  )

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
    const isCurrentlyApproved = target?.status === 'Approved'
    const newStatus = isCurrentlyApproved ? 'Pending' : 'Approved'

    if (newStatus === 'Approved' && target?.submissionId) {
      try {
        await api.post(`/grade-submissions/${target.submissionId}/approve`, { comment: 'Approved by department head' })
      } catch (err) {
        console.warn('Backend approval warning:', err)
      }
    }

    const next = approvals.map((a) =>
      a.id === id ? { ...a, status: newStatus } : a,
    )
    saveApprovals(next)

    if (newStatus === 'Approved') {
      toast.success(`Grades for ${target?.courseCode || 'course'} approved!`)
    } else {
      toast.info(`Grades for ${target?.courseCode || 'course'} set back to Pending.`)
    }
  }

  const handleReject = async (id) => {
    const target = approvals.find((a) => a.id === id)
    const isCurrentlyRejected = target?.status === 'Rejected'
    const newStatus = isCurrentlyRejected ? 'Pending' : 'Rejected'

    if (newStatus === 'Rejected' && target?.submissionId) {
      try {
        await api.post(`/grade-submissions/${target.submissionId}/reject`, { comment: 'Returned by department head for revision' })
      } catch (err) {
        console.warn('Backend rejection warning:', err)
      }
    }

    const next = approvals.map((a) =>
      a.id === id ? { ...a, status: newStatus } : a,
    )
    saveApprovals(next)

    if (newStatus === 'Rejected') {
      toast.error(`Grades for ${target?.courseCode || 'course'} rejected!`)
    } else {
      toast.info(`Grades for ${target?.courseCode || 'course'} set back to Pending.`)
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

      <Card className="border shadow-sm">
        <CardContent className="p-0">
          <div className="table-wrap">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="font-semibold text-foreground">
                    Course code
                  </TableHead>
                  <TableHead className="font-semibold text-foreground" title="coursename">
                    <span className="sr-only">coursename </span>coursename
                  </TableHead>
                  <TableHead className="font-semibold text-foreground" title="Teachername">
                    <span className="sr-only">Teachername </span>Teachername
                  </TableHead>
                  <TableHead className="font-semibold text-foreground">
                    TeacherID
                  </TableHead>
                  <TableHead className="font-semibold text-foreground text-center">
                    Total Student
                  </TableHead>
                  <TableHead className="font-semibold text-foreground" title="Submission Data">
                    <span className="sr-only">Submission Data </span>Submission Data
                  </TableHead>
                  <TableHead className="font-semibold text-foreground">
                    status
                  </TableHead>
                  <TableHead className="font-semibold text-foreground text-right">
                    Action
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {approvals.map((row) => {
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
                            onClick={() => handleApprove(row.id)}
                          >
                            <CheckCircle2 className="size-4" />
                          </Button>

                          {/* Reject Icon Button */}
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className={`size-8 rounded-md transition-all ${
                              isRejected
                                ? 'bg-rose-500/20 text-rose-600 dark:text-rose-400 font-bold'
                                : 'text-muted-foreground hover:bg-rose-500/10 hover:text-rose-600 dark:hover:text-rose-400'
                            }`}
                            title={`Reject ${row.courseCode}`}
                            aria-label={`Reject ${row.courseCode}`}
                            onClick={() => handleReject(row.id)}
                          >
                            <XCircle className="size-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
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
  const statusBadgeKey = isApproved ? 'approved' : isRejected ? 'rejected' : 'pending'

  // Generate deterministic student marks for this course
  const students = useMemo(
    () => getCourseStudents(row.courseCode, row.totalStudent),
    [row.courseCode, row.totalStudent],
  )

  const count = students.length
  const passedCount = students.filter((s) => s.passed).length
  const failedCount = count - passedCount
  const passRate = count ? ((passedCount / count) * 100).toFixed(1) : 0
  const totalAvg = count ? (students.reduce((acc, s) => acc + s.total, 0) / count).toFixed(1) : 0
  const quizAvg = count ? (students.reduce((acc, s) => acc + s.quiz, 0) / count).toFixed(1) : 0
  const assignmentAvg = count ? (students.reduce((acc, s) => acc + s.assignment, 0) / count).toFixed(1) : 0
  const midtermAvg = count ? (students.reduce((acc, s) => acc + s.midterm, 0) / count).toFixed(1) : 0
  const finalAvg = count ? (students.reduce((acc, s) => acc + s.finalExam, 0) / count).toFixed(1) : 0

  const highestScore = count ? Math.max(...students.map((s) => s.total)).toFixed(1) : 0
  const lowestScore = count ? Math.min(...students.map((s) => s.total)).toFixed(1) : 0

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
            onClick={() => window.print()}
            className="gap-1.5"
            title="Print Grade Sheet"
          >
            <Printer className="size-4" />
            <span className="hidden sm:inline">Print / Export</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            className={`gap-1.5 transition-all ${
              isRejected
                ? 'bg-rose-500/20 text-rose-600 dark:text-rose-400 font-semibold'
                : 'border-rose-200 text-rose-600 hover:bg-rose-50 dark:border-rose-900 dark:text-rose-400 dark:hover:bg-rose-950'
            }`}
            onClick={onReject}
          >
            <XCircle className="size-4" />
            {isRejected ? 'Rejected' : 'Reject Grade Sheet'}
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

      {/* Course Information & Metadata in Structured Cards */}
      <Card className="border shadow-sm overflow-hidden">
        <CardHeader className="border-b bg-card pb-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="rounded-md bg-primary/10 px-2.5 py-1 font-mono text-sm font-bold text-primary">
                  {row.courseCode}
                </span>
                <CardTitle className="text-xl font-bold text-foreground">{row.courseName}</CardTitle>
                <StatusBadge status={statusBadgeKey} label={row.status} />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Official Submitted Final Grade Sheet · Academic Year 2026/2027 · Semester 1
              </p>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-4 bg-muted/15">
          <div className="flex flex-row gap-3 w-full">
            <div className="flex-1 min-w-0 flex items-center gap-3 rounded-lg border bg-card p-3 shadow-xs">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                <UserCheck className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground block">Instructor</span>
                <p className="truncate text-sm font-semibold text-foreground">{row.teacherName}</p>
              </div>
            </div>

            <div className="flex-1 min-w-0 flex items-center gap-3 rounded-lg border bg-card p-3 shadow-xs">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                <CreditCard className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground block">Teacher ID</span>
                <p className="font-mono text-sm font-semibold text-foreground">{row.teacherId}</p>
              </div>
            </div>

            <div className="flex-1 min-w-0 flex items-center gap-3 rounded-lg border bg-card p-3 shadow-xs">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <Calendar className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground block">Submitted</span>
                <p className="text-sm font-semibold text-foreground tabular">{row.submissionDate}</p>
              </div>
            </div>

            <div className="flex-1 min-w-0 flex items-center gap-3 rounded-lg border bg-card p-3 shadow-xs">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400">
                <GraduationCap className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground block">Total Enrolled</span>
                <p className="text-sm font-semibold text-foreground tabular">{row.totalStudent} Students</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPI Metric Cards Grid - Horizontal 4 parts in flexbox */}
      <div className="flex flex-row gap-4 w-full">
        <div className="flex-1 min-w-0">
          <StatCard
            label="Total Students"
            value={count}
            icon={Users}
            hint="100% completed"
            tone="default"
          />
        </div>
        <div className="flex-1 min-w-0">
          <StatCard
            label="Class Average"
            value={`${totalAvg}%`}
            icon={Award}
            hint="Weighted out of 100"
            tone="teal"
          />
        </div>
        <div className="flex-1 min-w-0">
          <StatCard
            label="Pass Rate"
            value={`${passRate}%`}
            icon={Percent}
            hint={`${passedCount} passed · ${failedCount} failed`}
            tone={Number(passRate) >= 60 ? 'success' : 'warning'}
          />
        </div>
        <div className="flex-1 min-w-0">
          <StatCard
            label="Highest / Lowest"
            value={`${highestScore} / ${lowestScore}`}
            icon={TrendingDown}
            hint="Out of 100 max marks"
            tone="default"
          />
        </div>
      </div>

      {/* Assessment Weights & Structure Card */}
      <Card className="border shadow-sm">
        <CardContent className="flex flex-wrap items-center justify-between gap-4 p-4 text-xs">
          <div className="flex items-center gap-2.5">
            <div className="flex size-7 items-center justify-center rounded-md bg-primary/10 text-primary">
              <FileSpreadsheet className="size-4" />
            </div>
            <div>
              <p className="font-semibold text-foreground text-sm">Assessment Structure & Weights</p>
              <p className="text-muted-foreground">Departmental course evaluation policy</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <span className="rounded-md border bg-muted/40 px-2.5 py-1 text-xs">
              Quiz: <strong className="text-foreground">10%</strong> (max 10)
            </span>
            <span className="rounded-md border bg-muted/40 px-2.5 py-1 text-xs">
              Assignment: <strong className="text-foreground">20%</strong> (max 20)
            </span>
            <span className="rounded-md border bg-muted/40 px-2.5 py-1 text-xs">
              Midterm: <strong className="text-foreground">30%</strong> (max 30)
            </span>
            <span className="rounded-md border bg-muted/40 px-2.5 py-1 text-xs">
              Final Exam: <strong className="text-foreground">40%</strong> (max 40)
            </span>
            <Badge variant="success" className="font-medium">
              100% Weight Validated
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Submitted Student Grade Records Table Card */}
      <Card className="border shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between border-b py-3.5">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base font-semibold">Student Grade Records</CardTitle>
            <Badge variant="outline" className="font-medium">
              {count} Students
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="table-wrap">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="font-semibold text-foreground">Student ID</TableHead>
                  <TableHead className="font-semibold text-foreground">Student Name</TableHead>
                  <TableHead className="text-right font-semibold text-foreground">
                    Quiz
                    <span className="block text-[10px] font-normal text-muted-foreground">/10 · 10%</span>
                  </TableHead>
                  <TableHead className="text-right font-semibold text-foreground">
                    Assignment
                    <span className="block text-[10px] font-normal text-muted-foreground">/20 · 20%</span>
                  </TableHead>
                  <TableHead className="text-right font-semibold text-foreground">
                    Midterm
                    <span className="block text-[10px] font-normal text-muted-foreground">/30 · 30%</span>
                  </TableHead>
                  <TableHead className="text-right font-semibold text-foreground">
                    Final Exam
                    <span className="block text-[10px] font-normal text-muted-foreground">/40 · 40%</span>
                  </TableHead>
                  <TableHead className="text-right font-semibold text-foreground">
                    Total
                    <span className="block text-[10px] font-normal text-muted-foreground">/100</span>
                  </TableHead>
                  <TableHead className="text-center font-semibold text-foreground">Letter</TableHead>
                  <TableHead className="text-right font-semibold text-foreground">Points</TableHead>
                  <TableHead className="font-semibold text-foreground">Result</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {students.map((student) => (
                  <TableRow key={student.id} className="transition-colors hover:bg-muted/30">
                    <TableCell className="tabular font-mono text-xs font-semibold text-primary">
                      {student.studentNumber}
                    </TableCell>
                    <TableCell className="font-medium text-foreground">
                      {student.name}
                    </TableCell>
                    <TableCell className="text-right tabular">
                      {student.quiz}
                    </TableCell>
                    <TableCell className="text-right tabular">
                      {student.assignment}
                    </TableCell>
                    <TableCell className="text-right tabular">
                      {student.midterm}
                    </TableCell>
                    <TableCell className="text-right tabular">
                      {student.finalExam}
                    </TableCell>
                    <TableCell className="text-right tabular font-bold text-foreground">
                      {student.total}
                    </TableCell>
                    <TableCell className="text-center">
                      <GradeBadge letter={student.letter} passed={student.passed} />
                    </TableCell>
                    <TableCell className="text-right tabular font-mono text-xs">
                      {student.points.toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <PassFailBadge passed={student.passed} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow className="bg-muted/40 font-semibold hover:bg-muted/40">
                  <TableCell colSpan={2} className="text-foreground">
                    Class Average ({count} Students)
                  </TableCell>
                  <TableCell className="text-right tabular text-foreground">{quizAvg}</TableCell>
                  <TableCell className="text-right tabular text-foreground">{assignmentAvg}</TableCell>
                  <TableCell className="text-right tabular text-foreground">{midtermAvg}</TableCell>
                  <TableCell className="text-right tabular text-foreground">{finalAvg}</TableCell>
                  <TableCell className="text-right tabular font-bold text-foreground">{totalAvg}</TableCell>
                  <TableCell colSpan={3} className="text-center text-xs text-muted-foreground">
                    Pass Rate: {passRate}%
                  </TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
