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
import { formatAcademicYear, formatSemesterName, getCourseStudyYear, getStudentStudyYear } from '@/lib/format'
import { DEFAULT_GRADE_SCALE, formatGradePoints, gradeForScore } from '@/lib/grading'
import { onAssessmentChange, onGradeChange, onUserChange } from '@/lib/syncEvents'
import { setStoredSession } from '@/lib/storage'
import { useWebSocketEvent } from '@/lib/websocket'
import { store } from '@/store'

export function MyGradesPage() {
  const { user, profile } = useAuth()
  const { data: me, refetch: refetchMe } = useQuery(getProfileApi, [], { live: false, enabled: Boolean(user) })
  const [studentOverride, setStudentOverride] = useState(null)

  const { data: realCourses, refetch: refetchCourses } = useQuery(() => store.student.listMyCourses(), [])
  const { data: gradingConfig, refetch: refetchGradingConfig } = useQuery(
    () => store.grades.getGradingConfig(),
    [],
    { live: false }
  )
  const [academicYear, setAcademicYear] = useState('all')
  const [semester, setSemester] = useState('all')
  const [courseChoice, setCourseChoice] = useState('all')

  const reloadGrades = useCallback(() => {
    refetchCourses?.()
    refetchMe?.()
    refetchGradingConfig?.()
  }, [refetchCourses, refetchMe, refetchGradingConfig])

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
      refetchMe?.()
    },
    [user, profile, refetchCourses, refetchMe],
  )

  useWebSocketEvent('STUDENT_UPDATED', handleStudentUpdated)
  useWebSocketEvent('USER_UPDATED', handleStudentUpdated)
  useWebSocketEvent('SCORES_UPDATED', reloadGrades)
  useWebSocketEvent('OFFERING_UPDATED', reloadGrades)
  useWebSocketEvent('OFFERING_CREATED', reloadGrades)
  useWebSocketEvent('OFFERING_DELETED', reloadGrades)
  useWebSocketEvent('ASSESSMENT_UPDATED', reloadGrades)
  useWebSocketEvent('ASSESSMENT_CREATED', reloadGrades)
  useWebSocketEvent('ASSESSMENT_DELETED', reloadGrades)
  useWebSocketEvent('GRADE_SUBMISSION_UPDATED', reloadGrades)
  useWebSocketEvent('GRADE_SCALE_UPDATED', reloadGrades)
  useWebSocketEvent('GRADING_POLICY_UPDATED', reloadGrades)

  useEffect(() => {
    const unsubUser = onUserChange(handleStudentUpdated)
    const unsubAsm = onAssessmentChange(() => reloadGrades())
    const unsubGrade = onGradeChange(() => reloadGrades())
    return () => {
      unsubUser?.()
      unsubAsm?.()
      unsubGrade?.()
    }
  }, [handleStudentUpdated, reloadGrades])

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

  // Active grade scale configured by Admin RBAC in Grade Policy
  const activeScale = useMemo(() => {
    const list = gradingConfig?.scale?.entries
    return Array.isArray(list) && list.length > 0 ? list : DEFAULT_GRADE_SCALE
  }, [gradingConfig?.scale?.entries])

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

        let grade =
          c.finalGrade?.letter ||
          c.letter ||
          c.grade ||
          (c.resultStatus === 'published' ? c.letter : '') ||
          ''

        // Fallback: calculate letter grade from activeScale if score exists
        if (!grade || grade === '—') {
          if (rawScore != null && !Number.isNaN(Number(rawScore))) {
            const entryFromScore = gradeForScore(Number(rawScore), activeScale)
            if (entryFromScore?.letter) {
              grade = entryFromScore.letter
            }
          }
        }
        if (!grade) grade = '—'

        const courseObj = c.course || c
        const courseYear = String(
          c.courseYearOfStudy ??
          c.yearOfStudy ??
          courseObj?.yearOfStudy ??
          courseObj?.year_of_study ??
          getCourseStudyYear(courseObj)
        )

        const courseStatus =
          c.gradeStatus === 'submitted' || c.resultStatus === 'submitted' || c.finalGrade?.status === 'submitted' || c.offeringGradeStatus === 'submitted'
            ? 'submitted'
            : c.gradeStatus === 'approved' || c.resultStatus === 'approved' || c.finalGrade?.status === 'approved' || c.offeringGradeStatus === 'approved'
              ? 'approved'
              : c.gradeStatus === 'published' || c.resultStatus === 'published' || c.finalGrade?.status === 'published' || c.offeringGradeStatus === 'published'
                ? 'published'
                : c.resultStatus || c.status || 'in_progress'

        // Match Grade Points configured by Admin RBAC in Grade Policy
        let gradePoints = null
        if (grade && grade !== '—' && grade !== 'Dropped' && grade !== 'W') {
          const matchedEntry = activeScale.find(
            (entry) => String(entry.letter || '').trim().toUpperCase() === String(grade).trim().toUpperCase()
          )
          if (matchedEntry) {
            gradePoints = Number(matchedEntry.points ?? matchedEntry.gradePoints ?? matchedEntry.grade_points ?? 0)
          } else if (c.finalGrade?.gradePoints != null) {
            gradePoints = Number(c.finalGrade.gradePoints)
          } else if (rawScore != null && !Number.isNaN(Number(rawScore))) {
            const entryFromScore = gradeForScore(Number(rawScore), activeScale)
            if (entryFromScore) {
              gradePoints = Number(entryFromScore.points ?? entryFromScore.gradePoints ?? entryFromScore.grade_points ?? 0)
            }
          }
        } else if (c.finalGrade?.gradePoints != null && grade !== 'Dropped' && grade !== 'W') {
          gradePoints = Number(c.finalGrade.gradePoints)
        }

        const semObj = c.semester || {}
        const semName = semObj.name || c.semesterName || 'First Semester'
        const semTerm = semObj.term || c.term || (semName.toLowerCase().includes('second') ? 'second' : 'first')
        const semId = semObj.id || c.semesterId || semName
        const acadYear = formatAcademicYear(c.semester)

        return {
          id: c.enrollmentId || c.id || c.courseCode,
          courseCode: c.course?.code || c.courseCode,
          courseName: c.course?.title || c.courseTitle,
          yearOfStudy: courseYear,
          totalScore,
          grade,
          gradePoints,
          status: courseStatus,
          gradeStatus: c.gradeStatus || c.offeringGradeStatus,
          academicYear: acadYear,
          semester: semName,
          semesterName: semName,
          semesterId: semId,
          semesterTerm: semTerm,
        }
      })
    }
    return []
  }, [realCourses, activeScale])

  // Display courses matching student current year, or all enrolled courses
  const coursesList = useMemo(() => {
    if (!studentCurrentYear) return allCourses
    const match = allCourses.filter((c) => String(c.yearOfStudy) === String(studentCurrentYear))
    return match.length > 0 ? match : allCourses
  }, [allCourses, studentCurrentYear])

  const academicYearOptions = useMemo(() => {
    const currentYear = new Date().getFullYear()
    const startYear = 2026
    const yearsSet = new Set()
    for (let y = currentYear; y >= startYear; y--) {
      yearsSet.add(String(y))
    }
    if (Array.isArray(realCourses)) {
      realCourses.forEach((c) => {
        const acadYear = formatAcademicYear(c.semester)
        if (acadYear && acadYear !== '—' && Number(acadYear) >= 2026) {
          yearsSet.add(String(acadYear))
        }
      })
    }
    const sorted = Array.from(yearsSet).sort((a, b) => Number(b) - Number(a))
    return [
      { value: 'all', label: 'Academic Year' },
      ...sorted.map((y) => ({ value: y, label: y })),
    ]
  }, [realCourses])

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
      if (academicYear && academicYear !== 'all') {
        const ay = String(c.academicYear || '').toLowerCase()
        if (!ay.includes(String(academicYear).toLowerCase())) return false
      }
      if (semester && semester !== 'all') {
        const term = String(c.semesterTerm || c.term || c.semester || '').toLowerCase()
        const name = String(c.semesterName || c.semester || '').toLowerCase()
        if (semester === 'first') {
          const isFirst =
            term.includes('first') ||
            term.includes('fall') ||
            term === '1' ||
            name.includes('first') ||
            name.includes('fall')
          if (!isFirst) return false
        } else if (semester === 'second') {
          const isSecond =
            term.includes('second') ||
            term.includes('spring') ||
            term === '2' ||
            name.includes('second') ||
            name.includes('spring')
          if (!isSecond) return false
        }
      }
      if (courseChoice !== 'all' && c.courseCode !== courseChoice) return false
      return true
    })
  }, [coursesList, academicYear, semester, courseChoice])

  // Group filtered courses by semester so each semester clearly presents its courses and grades
  const coursesBySemester = useMemo(() => {
    const map = new Map()
    for (const c of filteredCourses) {
      const semKey = c.semesterId || c.semesterName || 'Current Semester'
      const semName = c.semesterName || c.semester || 'Current Semester'
      if (!map.has(semKey)) {
        map.set(semKey, {
          semesterId: semKey,
          semesterName: semName,
          semesterTerm: c.semesterTerm,
          courses: [],
        })
      }
      map.get(semKey).courses.push(c)
    }
    return Array.from(map.values())
  }, [filteredCourses])

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Grades"
        description="View current course grades and semester performance results."
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

      {/* Each semester explicitly displays its own card and course grades */}
      {coursesBySemester.map((semGroup) => (
        <Card key={semGroup.semesterId} className="overflow-hidden">
          <CardHeader className="p-5 pb-3 border-b flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
            <div>
              <CardTitle className="text-base font-semibold">{formatSemesterName(semGroup.semesterName)}</CardTitle>
              <span className="text-xs text-muted-foreground mt-0.5 block">
                Official course grades and performance for {formatSemesterName(semGroup.semesterName)}
              </span>
            </div>
            <Badge variant="secondary" className="w-fit text-xs font-normal">
              {semGroup.courses.length} course{semGroup.courses.length === 1 ? '' : 's'}
            </Badge>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[140px]">Course Code</TableHead>
                  <TableHead>Course Name</TableHead>
                  <TableHead className="w-[140px]">Semester</TableHead>
                  <TableHead className="text-center w-[110px]">Total /100</TableHead>
                  <TableHead className="text-center w-[90px]">Grade</TableHead>
                  <TableHead className="text-center w-[120px]">Grade points</TableHead>
                  <TableHead className="text-center w-[180px]">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {semGroup.courses.map((c) => (
                  <TableRow key={c.courseCode + c.semesterId}>
                    <TableCell className="font-semibold text-foreground">
                      {c.courseCode}
                    </TableCell>
                    <TableCell className="font-medium text-foreground">
                      {c.courseName}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatSemesterName(c.semesterName)}
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
                    <TableCell className="text-center font-semibold tabular-nums">
                      {c.gradePoints != null ? (
                        formatGradePoints(c.gradePoints)
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center">
                        <StatusBadge
                          status={c.status}
                          label={
                            c.status === 'submitted'
                              ? 'Submitted to Dept Head'
                              : c.status === 'approved'
                                ? 'Approved'
                                : c.status === 'published'
                                  ? 'Published'
                                  : c.status === 'in_progress'
                                    ? 'In progress'
                                    : undefined
                          }
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ))}

      {coursesBySemester.length === 0 && (
        <Card className="overflow-hidden">
          <CardHeader className="p-5 pb-3 border-b text-center">
            <CardTitle className="text-base font-semibold text-center w-full">Course Grade Summary</CardTitle>
          </CardHeader>
          <CardContent className="p-8 text-center text-muted-foreground">
            No course grades found for the selected {semester !== 'all' ? (semester === 'first' ? 'First Semester' : 'Second Semester') : 'filter'}.
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export default MyGradesPage
