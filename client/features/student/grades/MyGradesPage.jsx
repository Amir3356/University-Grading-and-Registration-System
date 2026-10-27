import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { FilterSelect } from '@/components/common/FilterSelect'
import { PageHeader } from '@/components/common/PageHeader'
import { StatusBadge } from '@/components/common/StatusBadge'
import { useQuery } from '@/hooks/useStore'
import { formatAcademicYear } from '@/lib/format'
import { store } from '@/store'

const FALLBACK_COURSES_DATA = [
  {
    courseCode: 'NET401',
    courseName: 'Computer Networks',
    totalScore: '85.5',
    grade: 'A',
    status: 'published',
    academicYear: '2026',
    semester: 'First Semester',
  },
  {
    courseCode: 'SWE301',
    courseName: 'Software Engineering',
    totalScore: '78.0',
    grade: 'B',
    status: 'published',
    academicYear: '2026',
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
        academicYear: formatAcademicYear(c.semester),
        semester: c.semester?.name || 'First Semester',
      }))
    }
    return FALLBACK_COURSES_DATA
  }, [realCourses])


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
            placeholder="All Courses"
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
    </div>
  )
}

export default MyGradesPage
