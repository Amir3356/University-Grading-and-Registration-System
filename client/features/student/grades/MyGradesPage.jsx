import { useCallback, useEffect, useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { FilterSelect } from '@/components/common/FilterSelect'
import { PageHeader } from '@/components/common/PageHeader'
import { StatusBadge } from '@/components/common/StatusBadge'
import { useAuth } from '@/context/auth-context'
import { getProfileApi } from '@/api/auth'
import { useQuery } from '@/hooks/useStore'
import { formatAcademicYear, getCourseStudyYear, getStudentStudyYear } from '@/lib/format'
import { onUserChange } from '@/lib/syncEvents'
import { setStoredSession } from '@/lib/storage'
import { useWebSocketEvent } from '@/lib/websocket'
import { store } from '@/store'
import { typeLabel } from '../components/policy'

export function MyGradesPage() {
  const { user, profile } = useAuth()
  const { data: me, refetch: refetchMe } = useQuery(getProfileApi, [], { live: false, enabled: Boolean(user) })
  const [studentOverride, setStudentOverride] = useState(null)

  const { data: realCourses, refetch: refetchCourses } = useQuery(() => store.student.listMyCourses(), [])
  const { data: realAssessments, refetch: refetchAssessments } = useQuery(() => store.student.listMyAssessments(), [])
  const [academicYear, setAcademicYear] = useState('all')
  const [semester, setSemester] = useState('all')
  const [courseChoice, setCourseChoice] = useState('all')

  const reloadGrades = useCallback(() => {
    refetchCourses?.()
    refetchAssessments?.()
    refetchMe?.()
  }, [refetchCourses, refetchAssessments, refetchMe])

  const handleStudentUpdated = useCallback(
    (payload) => {
      if (!payload) return
      const isTarget =
        !payload.userId ||
        payload.userId === user?.id ||
        (profile?.id && payload.studentId === profile.id)

      if (!isTarget) return

      const newYear =
        payload.yearOfStudy ??
        payload.profile?.year_of_study ??
        payload.profile?.yearOfStudy ??
        payload.user?.yearOfStudy

      if (newYear != null) {
        setStudentOverride((prev) => ({
          ...prev,
          yearOfStudy: newYear,
        }))
      }

      if (payload.profile || payload.user) {
        const nextProfile = {
          ...(profile || {}),
          ...(payload.profile || {}),
          ...(newYear != null ? { year_of_study: newYear, yearOfStudy: newYear } : {}),
        }
        setStoredSession(null, null, payload.user || user, nextProfile)
      }

      refetchCourses?.()
      refetchAssessments?.()
      refetchMe?.()
    },
    [user, profile, refetchCourses, refetchAssessments, refetchMe],
  )

  useWebSocketEvent('STUDENT_UPDATED', handleStudentUpdated)
  useWebSocketEvent('USER_UPDATED', handleStudentUpdated)
  useWebSocketEvent('SCORES_UPDATED', reloadGrades)
  useWebSocketEvent('OFFERING_UPDATED', reloadGrades)
  useWebSocketEvent('OFFERING_CREATED', reloadGrades)
  useWebSocketEvent('OFFERING_DELETED', reloadGrades)
  useWebSocketEvent('ASSESSMENT_UPDATED', reloadGrades)
  useWebSocketEvent('GRADE_SUBMISSION_UPDATED', reloadGrades)

  useEffect(() => {
    const unsub = onUserChange(handleStudentUpdated)
    return () => unsub?.()
  }, [handleStudentUpdated])

  // Resolve student current year of study (e.g. '1' to '5')
  const studentCurrentYear = useMemo(() => {
    const raw =
      studentOverride?.yearOfStudy ??
      me?.profile?.year_of_study ??
      me?.profile?.yearOfStudy ??
      profile?.yearOfStudy ??
      profile?.year_of_study ??
      user?.yearOfStudy ??
      (Array.isArray(realCourses) && (realCourses[0]?.studentYearOfStudy || realCourses[0]?.student?.yearOfStudy))
    return getStudentStudyYear({ yearOfStudy: raw })
  }, [studentOverride, me?.profile, profile, user, realCourses])

  const allCourses = useMemo(() => {
    if (Array.isArray(realCourses) && realCourses.length > 0) {
      return realCourses.map((c) => {
        const rawScore =
          c.finalGrade?.totalScore ??
          c.totalScore ??
          c.runningPercent

        const totalScore =
          rawScore != null && rawScore !== '' && rawScore !== '—'
            ? typeof rawScore === 'number'
              ? rawScore.toFixed(1)
              : String(rawScore)
            : '—'

        const grade =
          c.finalGrade?.letter ||
          c.letter ||
          c.grade ||
          (c.resultStatus === 'published' ? c.letter : '') ||
          '—'

        const courseObj = c.course || c
        const courseYear = String(
          c.courseYearOfStudy ??
          c.yearOfStudy ??
          courseObj?.yearOfStudy ??
          courseObj?.year_of_study ??
          getCourseStudyYear(courseObj)
        )

        return {
          courseCode: c.course?.code || c.courseCode,
          courseName: c.course?.title || c.courseTitle,
          yearOfStudy: courseYear,
          totalScore,
          grade,
          status: c.resultStatus || c.status,
          academicYear: formatAcademicYear(c.semester),
          semester: c.semester?.name || 'First Semester',
        }
      })
    }
    return []
  }, [realCourses])

  // Only display courses where course year of study equals student's current year of study
  const coursesList = useMemo(() => {
    if (!studentCurrentYear) return allCourses
    return allCourses.filter((c) => String(c.yearOfStudy) === String(studentCurrentYear))
  }, [allCourses, studentCurrentYear])

  const currentYear = new Date().getFullYear()

  const academicYearOptions = [
    { value: 'all', label: 'Academic Year' },
    { value: String(currentYear), label: String(currentYear) },
  ]

  const semesterOptions = [
    { value: 'all', label: 'Semester' },
    { value: 'first', label: 'First Semester' },
    { value: 'second', label: 'Second Semester' },
  ]

  // Dropdown options populate only courses matching the student's current year of study
  const courseOptions = useMemo(() => {
    const list = [{ value: 'all', label: 'All course' }]
    const seen = new Set()
    coursesList.forEach((c) => {
      if (c.courseCode && !seen.has(c.courseCode)) {
        seen.add(c.courseCode)
        list.push({ value: c.courseCode, label: `${c.courseCode} — ${c.courseName}` })
      }
    })
    return list
  }, [coursesList])

  // Reset course selection if it does not belong to the student's current year options
  useEffect(() => {
    if (courseChoice !== 'all' && !courseOptions.some((o) => o.value === courseChoice)) {
      setCourseChoice('all')
    }
  }, [courseOptions, courseChoice])

  const isFiltered = academicYear !== 'all' || semester !== 'all' || courseChoice !== 'all'

  const filteredCourses = useMemo(() => {
    return coursesList.filter((c) => {
      if (academicYear && academicYear !== 'all' && c.academicYear !== academicYear && !c.academicYear.includes(academicYear)) return false
      if (semester && semester !== 'all') {
        const term = String(c.semester ?? '').toLowerCase()
        if (semester === 'first') {
          const isFirst = term.includes('fall') || term === '1' || term.includes('first')
          if (!isFirst) return false
        } else if (semester === 'second') {
          const isSecond = term.includes('spring') || term === '2' || term.includes('second')
          if (!isSecond) return false
        }
      }
      if (courseChoice !== 'all' && c.courseCode !== courseChoice) return false
      return true
    })
  }, [coursesList, academicYear, semester, courseChoice])

  const filteredAssessments = useMemo(() => {
    if (!Array.isArray(realAssessments)) return []
    const matchingCodes = new Set(coursesList.map((c) => c.courseCode))
    return realAssessments.filter((a) => {
      if (!matchingCodes.has(a.courseCode)) return false
      if (courseChoice !== 'all' && a.courseCode !== courseChoice) return false
      if (isFiltered) {
        const matchingFilteredCodes = new Set(filteredCourses.map((c) => c.courseCode))
        if (!matchingFilteredCodes.has(a.courseCode)) return false
      }
      return true
    })
  }, [realAssessments, coursesList, courseChoice, isFiltered, filteredCourses])

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Grades"
        description="View current course grades and individual assessment results."
        centered
      />

      {/* Dropdown Filters (standalone inline cluster, no card/table wrapper) */}
      <div
        className="cluster"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: '0.75rem',
        }}
      >
        <div style={{ width: '12.5rem', minWidth: '10rem' }}>
          <FilterSelect
            id="academic-year-select"
            value={academicYear}
            onChange={setAcademicYear}
            options={academicYearOptions}
            placeholder="Academic Year"
            includeAll={false}
          />
        </div>

        <div style={{ width: '12.5rem', minWidth: '10rem' }}>
          <FilterSelect
            id="semester-select"
            value={semester}
            onChange={setSemester}
            options={semesterOptions}
            placeholder="Semester"
            includeAll={false}
          />
        </div>

        <div style={{ width: '15rem', minWidth: '12rem' }}>
          <FilterSelect
            id="course-select"
            value={courseChoice}
            onChange={setCourseChoice}
            options={courseOptions}
            placeholder="All course"
            includeAll={false}
          />
        </div>

        {isFiltered && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setAcademicYear('all')
              setSemester('all')
              setCourseChoice('all')
            }}
            className="text-xs text-muted-foreground hover:text-foreground h-9"
          >
            Reset filters
          </Button>
        )}
      </div>

      {/* Course Grade Summary Card */}
      <Card className="overflow-hidden">
        <CardHeader className="p-5 pb-3 border-b">
          <CardTitle className="text-base font-semibold">Course Grade Summary</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[160px]">Course Code</TableHead>
                <TableHead>Course Name</TableHead>
                <TableHead className="text-center w-[120px]">Total /100</TableHead>
                <TableHead className="text-center w-[100px]">Grade</TableHead>
                <TableHead className="text-right w-[130px]">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCourses.map((c) => (
                <TableRow key={c.courseCode}>
                  <TableCell className="font-semibold text-foreground">
                    {c.courseCode}
                  </TableCell>
                  <TableCell className="font-medium text-foreground">
                    {c.courseName}
                  </TableCell>
                  <TableCell className="text-center font-semibold tabular-nums">
                    {c.totalScore}
                  </TableCell>
                  <TableCell className="text-center">
                    {c.grade === '—' ? (
                      <span className="text-muted-foreground">—</span>
                    ) : c.grade === 'Dropped' ? (
                      <span className="inline-flex items-center justify-center min-w-[2rem] h-7 px-2 font-bold text-xs rounded-md bg-destructive/10 text-destructive border border-destructive/20">
                        Dropped
                      </span>
                    ) : c.grade === 'W' ? (
                      <span className="inline-flex items-center justify-center min-w-[2rem] h-7 px-2 font-bold text-xs rounded-md bg-muted text-muted-foreground">
                        W
                      </span>
                    ) : (
                      <span className="inline-flex items-center justify-center min-w-[2rem] h-7 px-2 font-bold text-xs rounded-md bg-primary/10 text-primary">
                        {c.grade}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <StatusBadge status={c.status} />
                  </TableCell>
                </TableRow>
              ))}
              {filteredCourses.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    No course grades found for the selected filter.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Assessment Marks Breakdown Card */}
      <Card className="overflow-hidden">
        <CardHeader className="p-5 pb-3 border-b flex flex-row items-center justify-between">
          <CardTitle className="text-base font-semibold">Assessment Marks Breakdown</CardTitle>
          <span className="text-xs text-muted-foreground">Individual assessment marks</span>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[140px]">Course Code</TableHead>
                <TableHead>Assessment</TableHead>
                <TableHead className="w-[140px]">Type</TableHead>
                <TableHead className="text-center w-[110px]">Max Mark</TableHead>
                <TableHead className="text-center w-[90px]">Weight</TableHead>
                <TableHead className="text-center w-[130px]">Mark Obtained</TableHead>
                <TableHead className="text-right w-[110px]">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAssessments.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="font-semibold text-foreground">
                    {a.courseCode}
                  </TableCell>
                  <TableCell className="font-medium text-foreground">
                    {a.name}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {typeLabel(a.type)}
                  </TableCell>
                  <TableCell className="text-center tabular-nums">
                    {a.maxMarks ?? '—'}
                  </TableCell>
                  <TableCell className="text-center tabular-nums">
                    {a.weight != null ? `${a.weight}%` : '—'}
                  </TableCell>
                  <TableCell className="text-center font-semibold tabular-nums">
                    {a.marks != null ? (
                      <span className="text-primary font-bold">{a.marks}</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge variant={a.status === 'graded' ? 'success' : a.status === 'pending' ? 'warning' : 'secondary'}>
                      {a.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
              {filteredAssessments.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-6 text-muted-foreground">
                    No assessment marks recorded yet for the selected filter.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

export default MyGradesPage
