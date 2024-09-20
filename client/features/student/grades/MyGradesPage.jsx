import { useMemo, useState } from 'react'
import { Award, BookOpen, Calendar, ClipboardCheck } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { FilterSelect } from '@/components/common/FilterSelect'
import { PageHeader } from '@/components/common/PageHeader'
import { StatCard } from '@/components/common/StatCard'
import { StatusBadge } from '@/components/common/StatusBadge'

const COURSES_DATA = [
  {
    courseCode: 'NET401',
    courseName: 'Computer Networks',
    totalScore: '85.5',
    grade: 'A',
    status: 'published',
    academicYear: '2027',
    semester: 'Semester 1',
  },
  {
    courseCode: 'SWE301',
    courseName: 'Software Engineering',
    totalScore: '78.0',
    grade: 'B',
    status: 'published',
    academicYear: '2027',
    semester: 'Semester 1',
  },
]

export function MyGradesPage() {
  const [academicYear, setAcademicYear] = useState('2027')
  const [semester, setSemester] = useState('Semester 1')
  const [courseChoice, setCourseChoice] = useState('all')

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

  const courseOptions = [
    { value: 'all', label: 'All Courses' },
    { value: 'NET401', label: 'NET401 — Computer Networks' },
    { value: 'SWE301', label: 'SWE301 — Software Engineering' },
  ]

  const filteredCourses = useMemo(() => {
    return COURSES_DATA.filter((c) => {
      if (academicYear && c.academicYear !== academicYear && !c.academicYear.includes(academicYear)) return false
      if (semester && c.semester !== semester) return false
      if (courseChoice !== 'all' && c.courseCode !== courseChoice) return false
      return true
    })
  }, [academicYear, semester, courseChoice])

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Grades"
        description="View current course grades and individual assessment results."
      />

      {/* Metric Cards Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Registered Courses"
          value="6"
          icon={BookOpen}
          tone="default"
        />
        <StatCard
          label="Published Grades"
          value="4 / 6"
          icon={ClipboardCheck}
          tone="teal"
        />
        <StatCard
          label="Semester GPA"
          value="3.45"
          icon={Award}
          tone="warning"
        />
        <StatCard
          label="Academic Year"
          value={academicYear}
          icon={Calendar}
          tone="default"
        />
      </div>

      {/* Filter Grades Card */}
      <Card className="p-5">
        <CardHeader className="p-0 pb-4">
          <CardTitle className="text-base font-semibold">Filter Grades</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="form-field">
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

            <div className="form-field">
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

            <div className="form-field">
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
                    <span className="inline-flex items-center justify-center min-w-[2rem] h-7 px-2 font-bold text-xs rounded-md bg-primary/10 text-primary">
                      {c.grade}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <StatusBadge status={c.status} label="Published" />
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
