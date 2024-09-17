import { useState } from 'react'
import { FileSpreadsheet } from 'lucide-react'
import { DataTable } from '@/components/common/DataTable'
import { EmptyState } from '@/components/common/EmptyState'
import { ErrorState } from '@/components/common/ErrorState'
import { FilterSelect } from '@/components/common/FilterSelect'
import { PageHeader } from '@/components/common/PageHeader'
import { PageSkeleton } from '@/components/common/Loading'
import { GradeBadge } from '@/components/common/StatusBadge'
import { useLookups } from '@/context/lookups-context'
import { useQuery } from '@/hooks/useStore'
import { formatNumber, formatPercent } from '@/lib/format'
import { store } from '@/store'
import { defaultOfferingId } from '../lib'

/**
 * The grade sheet rolls assessments up into one column per assessment type, so a
 * course with two assignments and one quiz still shows a single "Assignments" and
 * "Quizzes" column. Column headers and the type they cover live here.
 */
const CATEGORY_COLUMNS = [
  { key: 'assignments', header: 'Assignments', type: 'assignment' },
  { key: 'quizzes', header: 'Quizzes', type: 'quiz' },
  { key: 'mid', header: 'Mid', type: 'midterm' },
  { key: 'final', header: 'Final Exam', type: 'final' },
]

/** Marks obtained / available for every assessment of one type, plus the percentage. */
function categoryScore(row, assessments, type) {
  const list = assessments.filter((a) => a.type === type)
  if (!list.length) return null
  let obtained = 0
  let max = 0
  let entered = 0
  for (const a of list) {
    max += a.maxMarks
    const mark = row.marks[a.id]
    if (mark != null) {
      obtained += mark
      entered += 1
    }
  }
  if (!entered) return null
  return { obtained, max, percent: (obtained / max) * 100 }
}

export function GradeSheetPage() {
  const lookups = useLookups()
  const currentSemesterId = lookups?.currentSemester?.id
  const [selectedOfferingId, setSelectedOfferingId] = useState(null)

  const offerings = useQuery(() => store.teacher.listMyOfferings({}), [])
  const activeOfferingId = selectedOfferingId ?? defaultOfferingId(offerings.data, null, currentSemesterId) ?? ''
  const activeOffering = offerings.data?.find((o) => o.id === activeOfferingId) ?? null

  const gb = useQuery(
    () => (activeOfferingId ? store.grades.getGradebook(activeOfferingId) : null),
    [activeOfferingId],
    { enabled: Boolean(activeOfferingId) },
  )

  if (offerings.loading && !offerings.data) return <PageSkeleton />
  if (offerings.error) return <ErrorState error={offerings.error} onRetry={offerings.refetch} />

  if (!offerings.data?.length) {
    return (
      <>
        <PageHeader title="Grade sheet" description="Assessment category scores and final grades for your courses." />
        <EmptyState
          icon={FileSpreadsheet}
          title="No courses assigned"
          description="You need an assigned course offering before a grade sheet is available."
        />
      </>
    )
  }

  const assessments = gb.data?.assessments ?? []
  // Hide a category column when the course has no assessment of that type.
  const visibleCategories = CATEGORY_COLUMNS.filter((c) => assessments.some((a) => a.type === c.type))

  const rows = (gb.data?.rows ?? []).map((r) => ({
    id: r.enrollmentId,
    studentId: r.student.studentNumber,
    letter: r.letter,
    passed: r.passed,
    categories: Object.fromEntries(CATEGORY_COLUMNS.map((c) => [c.key, categoryScore(r, assessments, c.type)])),
  }))

  const columns = [
    {
      key: 'studentId',
      header: 'Student ID',
      cell: (r) => <span className="tabular font-mono text-sm">{r.studentId}</span>,
    },
    ...visibleCategories.map((c) => ({
      key: c.key,
      header: c.header,
      align: 'right',
      value: (r) => r.categories[c.key]?.percent ?? -1,
      cell: (r) => {
        const s = r.categories[c.key]
        if (!s) return <span className="text-muted-foreground">—</span>
        return (
          <span className="tabular" title={`${formatNumber(s.obtained)} / ${formatNumber(s.max)} marks`}>
            {formatPercent(s.percent)}
          </span>
        )
      },
    })),
    {
      key: 'grade',
      header: 'Grade',
      align: 'center',
      value: (r) => r.letter ?? '',
      cell: (r) => <GradeBadge letter={r.letter} passed={r.passed} />,
    },
  ]

  return (
    <>
      <PageHeader
        title="Grade sheet"
        description={
          activeOffering
            ? `${activeOffering.course.code} — ${activeOffering.course.title} · ${activeOffering.semester.name} · Section ${activeOffering.section}`
            : 'Assessment category scores and final grades for your courses.'
        }
      />
      <DataTable
        columns={columns}
        rows={activeOfferingId && !gb.loading ? rows : undefined}
        loading={gb.loading}
        error={gb.error}
        onRetry={gb.refetch}
        searchPlaceholder="Search student ID…"
        exportName={activeOffering ? `${activeOffering.course.code}_grade_sheet` : 'grade_sheet'}
        exportTitle={activeOffering ? `Grade sheet — ${activeOffering.course.code} ${activeOffering.course.title}` : 'Grade sheet'}
        exportSubtitle={activeOffering?.semester.name}
        university={lookups?.university}
        emptyIcon={FileSpreadsheet}
        emptyTitle="No students enrolled"
        emptyDescription="Students enrolled in this course will appear here."
        toolbar={
          <FilterSelect
            label="Course"
            value={activeOfferingId}
            onChange={setSelectedOfferingId}
            includeAll={false}
            options={offerings.data.map((o) => ({
              value: o.id,
              label: `${o.course.code} — ${o.course.title} (${o.semester.name})`,
            }))}
            className="sm:w-80"
          />
        }
      />
    </>
  )
}
