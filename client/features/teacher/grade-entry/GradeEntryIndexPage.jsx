import { useState } from 'react'
import { AlertTriangle, PenLine } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { DataTable } from '@/components/common/DataTable'
import { ErrorState } from '@/components/common/ErrorState'
import { FilterSelect } from '@/components/common/FilterSelect'
import { PageHeader } from '@/components/common/PageHeader'
import { GradeStatusBadge } from '@/components/common/StatusBadge'
import { useLookups } from '@/context/lookups-context'
import { useQuery } from '@/hooks/useStore'
import { store } from '@/store'
import { isLockedStatus, PENDING_STATUSES } from '../lib'

export function GradeEntryIndexPage() {
  const navigate = useNavigate()
  const lookups = useLookups()
  const [semesterChoice, setSemesterChoice] = useState(null)
  const current = lookups?.currentSemester
  const semesterId = semesterChoice ?? current?.id ?? ''

  const offerings = useQuery(() => store.teacher.listMyOfferings({}), [])
  const all = offerings.data ?? []
  const inSemester = all.filter((o) => !semesterId || o.semesterId === semesterId)
  // When viewing the current semester, also surface older courses whose grades are still outstanding.
  const outstanding = semesterId && semesterId === current?.id ? all.filter((o) => o.semesterId !== semesterId && o.semester.order < current.order && PENDING_STATUSES.includes(o.gradeStatus)) : []
  const rows = [...outstanding.map((o) => ({ ...o, overdue: true })), ...inSemester]
  const idsKey = rows.map((r) => r.id).join(',')

  const completion = useQuery(
    () => Object.fromEntries(rows.map((r) => [r.id, store.grades.getGradebook(r.id).stats])),
    [idsKey],
    { enabled: Boolean(offerings.data) },
  )

  const columns = [
    {
      key: 'course',
      header: 'Course',
      value: (o) => `${o.course.code} ${o.course.title}`,
      cell: (o) => (
        <div>
          <p className="font-medium">{o.course.code}</p>
          <p className="text-xs text-muted-foreground">{o.course.title}</p>
        </div>
      ),
    },
    {
      key: 'semester',
      header: 'Semester',
      value: (o) => o.semester.name,
      cell: (o) => (
        <div className="flex flex-col items-start gap-1">
          <span>{o.semester.name}</span>
          {o.overdue && (
            <Badge variant="warning">
              <AlertTriangle aria-hidden="true" /> Overdue
            </Badge>
          )}
        </div>
      ),
    },
    { key: 'enrolledCount', header: 'Students', align: 'right' },
    {
      key: 'weights',
      header: 'Assessments',
      value: (o) => o.assessmentCount,
      cell: (o) => (
        <div className="flex flex-col items-start gap-1">
          <span className="tabular">{o.assessmentCount}</span>
          {!o.weightsValid && <Badge variant="warning">Weights {o.weightTotal}%</Badge>}
        </div>
      ),
    },
    {
      key: 'completion',
      header: 'Marks entered',
      value: (o) => {
        const s = completion.data?.[o.id]
        return s ? s.missingMarks : null
      },
      cell: (o) => {
        const s = completion.data?.[o.id]
        if (!s) return <span className="text-muted-foreground">{completion.loading ? 'Loading…' : '—'}</span>
        const expected = s.studentCount * o.assessmentCount
        const pct = expected ? ((expected - s.missingMarks) / expected) * 100 : 0
        return (
          <div className="w-36">
            <Progress value={pct} aria-label={`${Math.round(pct)}% of marks entered`} />
            <p className="mt-1 text-xs text-muted-foreground tabular">{expected === 0 ? 'No assessments' : s.missingMarks ? `${s.missingMarks} missing` : 'All marks entered'}</p>
          </div>
        )
      },
    },
    { key: 'gradeStatus', header: 'Status', cell: (o) => <GradeStatusBadge status={o.gradeStatus} /> },
    {
      key: 'action',
      header: '',
      sortable: false,
      export: false,
      align: 'right',
      cell: (o) => (
        <Button size="sm" variant={isLockedStatus(o.gradeStatus) ? 'outline' : 'default'} asChild onClick={(e) => e.stopPropagation()}>
          <Link to={`/teacher/grade-entry/${o.id}`}>
            <PenLine /> {isLockedStatus(o.gradeStatus) ? 'View' : 'Enter grades'}
          </Link>
        </Button>
      ),
    },
  ]

  return (
    <>
      <PageHeader title="Grade entry" description="Choose a course to enter or review assessment marks." />
      {offerings.error ? (
        <ErrorState error={offerings.error} onRetry={offerings.refetch} />
      ) : (
        <DataTable
          columns={columns}
          rows={offerings.data ? rows : undefined}
          loading={offerings.loading}
          onRowClick={(o) => navigate(`/teacher/grade-entry/${o.id}`)}
          searchPlaceholder="Search courses…"
          emptyTitle="No courses for this semester"
          emptyDescription="Choose another semester to see older courses."
          toolbar={
            <FilterSelect
              label="Semester"
              allLabel="All semesters"
              value={semesterId}
              onChange={setSemesterChoice}
              options={(lookups?.semesters ?? []).map((s) => ({ value: s.id, label: s.name }))}
              className="sm:w-52"
            />
          }
        />
      )}
    </>
  )
}
