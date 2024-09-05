import { useState } from 'react'
import { BookOpen, CalendarClock, Mail, MapPin, User } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/common/EmptyState'
import { ErrorState } from '@/components/common/ErrorState'
import { FilterSelect } from '@/components/common/FilterSelect'
import { TableSkeleton } from '@/components/common/Loading'
import { PageHeader } from '@/components/common/PageHeader'
import { StatusBadge } from '@/components/common/StatusBadge'
import { useLookups } from '@/context/lookups-context'
import { useQuery } from '@/hooks/useStore'
import { store } from '@/store'
import { ResultStatus } from '../components/StudentWidgets'

export function MyCoursesPage() {
  const lookups = useLookups()
  // null = not chosen yet → default to the current semester; '' = all semesters.
  const [semesterChoice, setSemesterChoice] = useState(null)
  const semesterId = semesterChoice ?? lookups?.currentSemester?.id ?? ''
  const { data, loading, error, refetch } = useQuery(() => store.student.listMyCourses({ semesterId }), [semesterId], { enabled: Boolean(lookups) })

  const semesterOptions = (lookups?.semesters ?? []).map((s) => ({ value: s.id, label: `${s.name}${s.isCurrent ? ' (current)' : ''}` }))
  const semesterName = semesterId ? lookups?.semesters.find((s) => s.id === semesterId)?.name : null

  return (
    <>
      <PageHeader
        title="My courses"
        description="Courses you are enrolled in, with teacher, schedule and result status."
        actions={<FilterSelect value={semesterId} onChange={setSemesterChoice} options={semesterOptions} allLabel="All semesters" label="Semester" className="sm:w-56" />}
      />
      {error ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : loading || !data ? (
        <TableSkeleton rows={4} cols={3} />
      ) : data.length === 0 ? (
        <Card>
          <EmptyState
            icon={BookOpen}
            title={semesterName ? `No courses in ${semesterName}` : 'No courses yet'}
            description={semesterId ? 'Try another semester or choose "All semesters".' : 'You are not enrolled in any course yet.'}
          />
        </Card>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {data.map((c) => (
            <li key={c.enrollmentId}>
              <CourseCard course={c} />
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

function CourseCard({ course: c }) {
  return (
    <Link
      to={`/student/courses/${c.enrollmentId}`}
      className="block h-full rounded-lg focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
      aria-label={`${c.course.code} ${c.course.title} — open course details`}
    >
      <Card className="h-full gap-3 px-5 py-4 transition-colors hover:border-teal/50">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold tracking-wide text-teal uppercase">{c.course.code}</p>
            <h2 className="mt-0.5 leading-snug font-semibold">{c.course.title}</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {c.semester.name} · {c.course.creditHours} credit hours · Section {c.section}
            </p>
          </div>
          <StatusBadge status={c.status} />
        </div>
        <dl className="space-y-1.5 text-sm">
          <div className="flex items-start gap-2">
            <dt className="sr-only">Teacher</dt>
            <User className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <dd className="min-w-0">{c.teacher?.name ?? 'Not assigned'}</dd>
          </div>
          {c.teacher?.email && (
            <div className="flex items-start gap-2">
              <dt className="sr-only">Teacher email</dt>
              <Mail className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <dd className="min-w-0 truncate text-muted-foreground">{c.teacher.email}</dd>
            </div>
          )}
          <div className="flex items-start gap-2">
            <dt className="sr-only">Schedule</dt>
            <CalendarClock className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <dd>{c.schedule || '—'}</dd>
          </div>
          <div className="flex items-start gap-2">
            <dt className="sr-only">Room</dt>
            <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <dd>{c.room || '—'}</dd>
          </div>
        </dl>
        <div className="mt-auto flex items-center justify-between gap-2 border-t pt-3">
          <span className="text-xs text-muted-foreground">Result</span>
          <ResultStatus course={c} />
        </div>
      </Card>
    </Link>
  )
}
