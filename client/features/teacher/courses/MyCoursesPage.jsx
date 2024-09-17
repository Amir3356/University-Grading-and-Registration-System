import { BookOpen } from 'lucide-react'
import { DataTable } from '@/components/common/DataTable'
import { PageHeader } from '@/components/common/PageHeader'
import { useQuery } from '@/hooks/useStore'
import { formatSemesterTerm, formatYearOfStudy } from '@/lib/format'
import { store } from '@/store'

export function MyCoursesPage() {
  const { data, loading, error, refetch } = useQuery(() => store.teacher.listMyOfferings())

  const columns = [
    {
      key: 'courseCode',
      header: 'Course Code',
      value: (o) => o.course.code,
      cell: (o) => <span className="font-medium text-foreground">{o.course.code}</span>,
    },
    {
      key: 'courseName',
      header: 'Course Name',
      value: (o) => o.course.title,
      cell: (o) => o.course.title,
    },
    {
      key: 'yearOfStudy',
      header: 'Year of Study',
      value: (o) => formatYearOfStudy(o.course?.level ?? o.course?.code),
      cell: (o) => formatYearOfStudy(o.course?.level ?? o.course?.code),
    },
    {
      key: 'semester',
      header: 'Semester',
      value: (o) => o.semester.name,
      cell: (o) => formatSemesterTerm(o.semester.term),
    },
    {
      key: 'students',
      header: 'Students',
      value: (o) => o.enrolledCount,
      cell: (o) => o.enrolledCount,
      align: 'right',
    },
  ]

  return (
    <>
      <PageHeader title="My courses" description="Course offerings assigned to you, by semester." centered />
      <DataTable
        columns={columns}
        rows={data}
        loading={loading}
        error={error}
        onRetry={refetch}
        searchable={false}
        searchPlaceholder="Search course code or name…"
        emptyIcon={BookOpen}
        emptyTitle="No courses assigned yet"
        emptyDescription="Course offerings assigned to you appear here."
      />
    </>
  )
}
