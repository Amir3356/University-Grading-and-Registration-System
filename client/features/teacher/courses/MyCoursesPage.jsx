import { useState } from 'react'
import { AlertTriangle, BookOpen, CalendarDays, MapPin, Users } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/common/EmptyState'
import { ErrorState } from '@/components/common/ErrorState'
import { FilterSelect } from '@/components/common/FilterSelect'
import { TableSkeleton } from '@/components/common/Loading'
import { PageHeader } from '@/components/common/PageHeader'
import { SearchInput } from '@/components/common/SearchInput'
import { GradeStatusBadge } from '@/components/common/StatusBadge'
import { useLookups } from '@/context/lookups-context'
import { useQuery } from '@/hooks/useStore'
import { useDebounce } from '@/hooks/useDebounce'
import { groupBy } from '@/lib/utils'
import { store } from '@/store'

function OfferingCard({ o }) {
  return (
    <Link to={`/teacher/courses/${o.id}`} className="rounded-lg focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none">
      <Card className="h-full gap-3 px-5 py-4 transition-colors hover:border-teal/50">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground">
              {o.course.code} · Section {o.section} · {o.course.creditHours} credits
            </p>
            <p className="mt-0.5 font-semibold leading-snug">{o.course.title}</p>
          </div>
          <GradeStatusBadge status={o.gradeStatus} />
        </div>
        <dl className="grid gap-1.5 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <CalendarDays className="size-4 shrink-0" aria-hidden="true" />
            <dt className="sr-only">Schedule</dt>
            <dd>{o.schedule || '—'}</dd>
          </div>
          <div className="flex items-center gap-2">
            <MapPin className="size-4 shrink-0" aria-hidden="true" />
            <dt className="sr-only">Room</dt>
            <dd>{o.room || '—'}</dd>
          </div>
          <div className="flex items-center gap-2">
            <Users className="size-4 shrink-0" aria-hidden="true" />
            <dt className="sr-only">Enrolled</dt>
            <dd className="tabular">
              {o.enrolledCount} enrolled{o.capacity ? ` / ${o.capacity}` : ''}
              {o.withdrawnCount ? ` · ${o.withdrawnCount} withdrawn` : ''}
            </dd>
          </div>
        </dl>
        <div className="mt-auto flex flex-wrap items-center gap-2 border-t pt-3 text-xs">
          <span className="text-muted-foreground">
            {o.assessmentCount} assessment{o.assessmentCount === 1 ? '' : 's'}
          </span>
          {o.weightsValid ? (
            <Badge variant="success">Weights 100%</Badge>
          ) : (
            <Badge variant="warning">
              <AlertTriangle aria-hidden="true" /> Weights {o.weightTotal}%
            </Badge>
          )}
        </div>
      </Card>
    </Link>
  )
}

export function MyCoursesPage() {
  const lookups = useLookups()
  const [academicYearId, setAcademicYearId] = useState('')
  const [semesterId, setSemesterId] = useState('')
  const [search, setSearch] = useState('')
  const q = useDebounce(search)
  const { data, loading, error, refetch } = useQuery(() => store.teacher.listMyOfferings({ academicYearId, semesterId, search: q }), [academicYearId, semesterId, q])

  const semesterOptions = (lookups?.semesters ?? []).filter((s) => !academicYearId || s.academicYearId === academicYearId).map((s) => ({ value: s.id, label: s.name }))
  const groups = [...groupBy(data ?? [], (o) => o.semesterId).values()]

  return (
    <>
      <PageHeader title="My courses" description="Course offerings assigned to you, by semester." />
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <SearchInput value={search} onChange={setSearch} placeholder="Search code or title…" />
        <FilterSelect
          label="Academic year"
          allLabel="All academic years"
          value={academicYearId}
          onChange={(v) => {
            setAcademicYearId(v)
            setSemesterId('')
          }}
          options={(lookups?.academicYears ?? []).map((y) => ({ value: y.id, label: y.name }))}
        />
        <FilterSelect label="Semester" allLabel="All semesters" value={semesterId} onChange={setSemesterId} options={semesterOptions} className="sm:w-52" />
      </div>

      {loading && !data ? (
        <TableSkeleton rows={4} cols={3} />
      ) : error ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : groups.length === 0 ? (
        <Card>
          <EmptyState
            icon={BookOpen}
            title={search || semesterId || academicYearId ? 'No courses match these filters' : 'No courses assigned yet'}
            description="Course offerings assigned to you by the registrar appear here."
          />
        </Card>
      ) : (
        <div className="space-y-8">
          {groups.map((list) => {
            const sem = list[0].semester
            return (
              <section key={sem.id} aria-labelledby={`sem-${sem.id}`}>
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <h2 id={`sem-${sem.id}`} className="text-base font-semibold">
                    {sem.name}
                  </h2>
                  {sem.isCurrent && <Badge variant="info">Current</Badge>}
                  <span className="text-sm text-muted-foreground">
                    {list.length} course{list.length === 1 ? '' : 's'}
                  </span>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {list.map((o) => (
                    <OfferingCard key={o.id} o={o} />
                  ))}
                </div>
              </section>
            )
          })}
        </div>
      )}
    </>
  )
}
