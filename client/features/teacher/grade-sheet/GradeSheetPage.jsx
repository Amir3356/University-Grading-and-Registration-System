import { useState } from 'react'
import { FileSpreadsheet } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { DataTable } from '@/components/common/DataTable'
import { EmptyState } from '@/components/common/EmptyState'
import { ErrorState } from '@/components/common/ErrorState'
import { FilterSelect } from '@/components/common/FilterSelect'
import { PageHeader } from '@/components/common/PageHeader'
import { PageSkeleton } from '@/components/common/Loading'
import { GradeBadge } from '@/components/common/StatusBadge'
import { useLookups } from '@/context/lookups-context'
import { useQuery } from '@/hooks/useStore'
import { formatNumber, formatSemesterTerm } from '@/lib/format'
import { store } from '@/store'
import { defaultOfferingId } from '../lib'

const academicYearEnd = (y) => {
  const endYear = new Date(y.endDate).getFullYear()
  return Number.isFinite(endYear) ? String(endYear) : y.name
}

/** "First Semester" or "Second Semester". */


const TOTAL_MAX = 100

/** Ready once every assessment is marked, Withdrawn for dropped students. */
function statusOf(row) {
  if (row.enrollment.status === 'withdrawn') return { label: 'Withdrawn', variant: 'muted' }
  if (row.complete) return { label: 'Ready', variant: 'success' }
  return { label: 'Incomplete', variant: 'warning' }
}

export function GradeSheetPage() {
  const lookups = useLookups()
  const currentSemesterId = lookups?.currentSemester?.id
  const currentYearId = lookups?.currentSemester?.academicYearId ?? ''

  // Filters cascade: academic year → semester → course.
  const [yearChoice, setYearChoice] = useState(null)
  const [semesterChoice, setSemesterChoice] = useState(null)
  const [offeringChoice, setOfferingChoice] = useState(null)

  const offerings = useQuery(() => store.teacher.listMyOfferings({}), [])
  const all = offerings.data ?? []

  const yearId = yearChoice ?? currentYearId
  const semestersForYear = (lookups?.semesters ?? []).filter((s) => !yearId || s.academicYearId === yearId)
  const semesterId = semesterChoice ?? (semestersForYear.some((s) => s.id === currentSemesterId) ? currentSemesterId : '')

  const inYear = (o) => !yearId || o.semester?.academicYearId === yearId
  const inSemester = (o) => !semesterId || o.semesterId === semesterId
  const filtered = all.filter((o) => inYear(o) && inSemester(o))

  // Keep the selection valid when a filter change removes the chosen course.
  const activeOfferingId = (offeringChoice && filtered.some((o) => o.id === offeringChoice) ? offeringChoice : null)
    ?? defaultOfferingId(filtered, null, currentSemesterId)
    ?? ''
  const activeOffering = filtered.find((o) => o.id === activeOfferingId) ?? null

  const gb = useQuery(
    () => (activeOfferingId ? store.grades.getGradebook(activeOfferingId) : null),
    [activeOfferingId],
    { enabled: Boolean(activeOfferingId) },
  )

  if (offerings.loading && !offerings.data) return <PageSkeleton />
  if (offerings.error) return <ErrorState error={offerings.error} onRetry={offerings.refetch} />

  if (!all.length) {
    return (
      <>
        <PageHeader title="Grade sheet" centered />
        <EmptyState
          icon={FileSpreadsheet}
          title="No courses assigned"
          description="You need an assigned course offering before a grade sheet is available."
        />
      </>
    )
  }

  const rows = (gb.data?.rows ?? []).map((r) => {
    const withdrawn = r.enrollment.status === 'withdrawn'
    const status = statusOf(r)
    return {
      id: r.enrollmentId,
      studentId: r.student.studentNumber,
      studentName: r.student.name,
      total: withdrawn ? null : r.total,
      totalLabel: withdrawn ? '—' : `${formatNumber(r.total, 2)}/${TOTAL_MAX}`,
      letter: r.letter,
      passed: r.passed,
      statusLabel: status.label,
      statusVariant: status.variant,
      withdrawn,
    }
  })

  const columns = [
    {
      key: 'studentId',
      header: 'Student ID',
      cell: (r) => <span className="tabular font-mono text-sm">{r.studentId}</span>,
    },
    {
      key: 'studentName',
      header: 'Student Name',
      cell: (r) => <span className={r.withdrawn ? undefined : 'font-medium'}>{r.studentName}</span>,
    },
    {
      key: 'total',
      header: 'Total Marks',
      align: 'right',
      value: (r) => r.total ?? -1,
      cell: (r) => <span className="tabular font-medium">{r.totalLabel}</span>,
    },
    {
      key: 'grade',
      header: 'Final Grade',
      align: 'center',
      value: (r) => r.letter ?? '',
      cell: (r) => <GradeBadge letter={r.letter} passed={r.passed} />,
    },
    {
      key: 'status',
      header: 'Status',
      value: (r) => r.statusLabel,
      cell: (r) => <Badge variant={r.statusVariant}>{r.statusLabel}</Badge>,
    },
  ]

  return (
    <>
      <PageHeader title="Grade sheet" centered />
      <DataTable
        columns={columns}
        rows={activeOfferingId && !gb.loading ? rows : undefined}
        loading={gb.loading}
        error={gb.error}
        onRetry={gb.refetch}
        searchable={Boolean(activeOfferingId)}
        searchPlaceholder="Search student ID or name…"
        exportName={activeOffering ? `${activeOffering.course.code}_grade_sheet` : 'grade_sheet'}
        exportTitle={activeOffering ? `Grade sheet — ${activeOffering.course.code} ${activeOffering.course.title}` : 'Grade sheet'}
        exportSubtitle={activeOffering ? `${formatSemesterTerm(activeOffering.semester.term)} · Section ${activeOffering.section}` : undefined}
        university={lookups?.university}
        emptyIcon={FileSpreadsheet}
        emptyTitle={activeOfferingId ? 'No students enrolled' : 'No courses match these filters'}
        emptyDescription={
          activeOfferingId
            ? 'Students enrolled in this course will appear here.'
            : 'Try another academic year, semester or course.'
        }
        toolbar={
          <>
            <FilterSelect
              label="Academic Year"
              allLabel="All academic years"
              value={yearId}
              onChange={(v) => {
                setYearChoice(v || null)
                setSemesterChoice('')
                setOfferingChoice(null)
              }}
              options={(lookups?.academicYears ?? []).sort((a, b) => new Date(a.startDate) - new Date(b.startDate)).map((y) => ({ value: y.id, label: String(academicYearEnd(y)) }))}
              className="sm:w-48"
            />
            <FilterSelect
              label="Semester"
              allLabel="All semesters"
              value={semesterId}
              onChange={(v) => {
                setSemesterChoice(v || null)
                setOfferingChoice(null)
              }}
              options={semestersForYear
                .slice()
                .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
                .map((s) => ({ value: s.id, label: formatSemesterTerm(s.term) }))}
              className="sm:w-56"
            />
            <FilterSelect
              label="Course"
              allLabel="All courses"
              includeAll={false}
              placeholder="Select a course"
              value={activeOfferingId}
              onChange={(v) => setOfferingChoice(v || null)}
              options={filtered.map((o) => ({
                value: o.id,
                label: `${o.course.code} — ${o.course.title} (${formatSemesterTerm(o.semester.term)})`,
              }))}
              className="sm:w-80"
            />
          </>
        }
      />
    </>
  )
}
