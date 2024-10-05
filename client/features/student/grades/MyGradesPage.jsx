import { useMemo, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { FilterSelect } from '@/components/common/FilterSelect'
import { PageHeader } from '@/components/common/PageHeader'
import { StatusBadge } from '@/components/common/StatusBadge'
import { useQuery } from '@/hooks/useStore'
import { store } from '@/store'

const FALLBACK_COURSES_DATA = [
  {
    courseCode: 'NET401',
    courseName: 'Computer Networks',
    totalScore: '85.5',
    grade: 'A',
    status: 'published',
    academicYear: '2026/2027',
    semester: 'First Semester',
  },
  {
    courseCode: 'SWE301',
    courseName: 'Software Engineering',
    totalScore: '78.0',
    grade: 'B',
    status: 'published',
    academicYear: '2026/2027',
    semester: 'First Semester',
  },
]

export function MyGradesPage() {
  const { data: realCourses } = useQuery(() => store.student.listMyCourses(), [])
  const [academicYear, setAcademicYear] = useState('all')
  const [semester, setSemester] = useState('all')
  const [courseChoice, setCourseChoice] = useState('all')

  const coursesList = useMemo(() => {
    if (Array.isArray(realCourses) && realCourses.length > 0) {
      return realCourses.map((c) => ({
        courseCode: c.course?.code || c.courseCode,
        courseName: c.course?.title || c.courseTitle,
        totalScore: c.finalGrade?.totalScore ?? (c.runningPercent != null ? c.runningPercent : '—'),
        grade: c.finalGrade?.letter || (c.resultStatus === 'published' ? c.letter : '—'),
        status: c.resultStatus || c.status,
        academicYear: c.semester?.academicYear?.name || '2026/2027',
        semester: c.semester?.name || 'First Semester',
      }))
    }
    return FALLBACK_COURSES_DATA
  }, [realCourses])


  const academicYearOptions = [
    { value: '2027', label: '2027' },
    { value: '2026', label: '2026' },
    { value: '2025', label: '2025' },
    { value: '2024', label: '2024' },
  ]

  const semesterOptions = [
    { value: 'Semester 1', label: 'Semester 1' },
    { value: 'Semester 2', label: 'Semester 2' },
  ]

  const courseOptions = useMemo(() => {
    const list = [{ value: 'all', label: 'All Courses' }]
    const seen = new Set()
    coursesList.forEach((c) => {
      if (!seen.has(c.courseCode)) {
        seen.add(c.courseCode)
        list.push({ value: c.courseCode, label: `${c.courseCode} — ${c.courseName}` })
      }
    })
    return list
  }, [coursesList])

  const filteredCourses = useMemo(() => {
    return coursesList.filter((c) => {
      if (academicYear && academicYear !== 'all' && c.academicYear !== academicYear && !c.academicYear.includes(academicYear)) return false
      if (semester && semester !== 'all' && c.semester !== semester) return false
      if (courseChoice !== 'all' && c.courseCode !== courseChoice) return false
      return true
    })
  }, [coursesList, academicYear, semester, courseChoice])


  return (
    <div className="space-y-6">
      <PageHeader
        title="My Grades"
        description="View current course grades and individual assessment results."
        centered
      />

      {/* Filter Grades Card */}
      <Card className="p-5">
        <CardHeader className="p-0 pb-4">
          <CardTitle className="text-base font-semibold">Filter Grades</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div
            className="stu-grades-filter-row"
            style={{
              display: 'flex',
              flexDirection: 'row',
              flexWrap: 'wrap',
              alignItems: 'flex-start',
              gap: '1rem',
              width: '100%',
            }}
          >
            <div className="form-field" style={{ flex: '1 1 200px', minWidth: '180px' }}>
              <label htmlFor="academic-year-select" className="text-sm font-medium text-foreground">
                Academic Year
              </label>
              <FilterSelect
                id="academic-year-select"
                value={academicYear}
                onChange={setAcademicYear}
                options={academicYearOptions}
                placeholder="2027"
                includeAll={false}
                className="w-full"
              />
            </div>

            <div className="form-field" style={{ flex: '1 1 200px', minWidth: '180px' }}>
              <label htmlFor="semester-select" className="text-sm font-medium text-foreground">
                Semester
              </label>
              <FilterSelect
                id="semester-select"
                value={semester}
                onChange={setSemester}
                options={semesterOptions}
                placeholder="Semester 1"
                includeAll={false}
                className="w-full"
              />
            </div>

            <div className="form-field" style={{ flex: '1 1 200px', minWidth: '180px' }}>
              <label htmlFor="course-select" className="text-sm font-medium text-foreground">
                Course
              </label>
              <FilterSelect
                id="course-select"
                value={courseChoice}
                onChange={setCourseChoice}
                options={courseOptions}
                placeholder="All Courses"
                includeAll={false}
                className="w-full"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Course Grade Summary Card */}
      <Card className="overflow-hidden">
        <CardHeader className="p-5 pb-3 border-b">
          <div className="flex flex-col gap-0.5">
            <CardTitle className="text-base font-semibold">Course Grade Summary</CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Illustrative data only
            </CardDescription>
          </div>
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
    </div>
  )
}

export default MyGradesPage
