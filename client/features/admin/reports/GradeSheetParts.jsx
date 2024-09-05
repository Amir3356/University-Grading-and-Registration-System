import { Award, Percent, TrendingDown, Users } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { GradeDistributionChart } from '@/components/charts/GradeDistributionChart'
import { ChartCard } from '@/components/charts/ChartCard'
import { EmptyState } from '@/components/common/EmptyState'
import { StatCard } from '@/components/common/StatCard'
import { GradeBadge, PassFailBadge } from '@/components/common/StatusBadge'
import { ASSESSMENT_TYPES } from '@/lib/grading'
import { formatNumber, formatPercent } from '@/lib/format'
import { cn } from '@/lib/utils'
import { distributionColumns, isWithdrawn } from './grade-sheet-utils'

const typeLabel = (t) => ASSESSMENT_TYPES.find((x) => x.value === t)?.label ?? t

/** Stat cards: students, average, pass rate, highest / lowest. */
export function GradeSheetStats({ stats }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard label="Students" value={formatNumber(stats.studentCount)} icon={Users} hint={`${stats.completeCount} with complete marks`} />
      <StatCard label="Class average" value={formatNumber(stats.average, 1)} icon={Award} tone="teal" hint="Weighted total out of 100" />
      <StatCard label="Pass rate" value={formatPercent(stats.passRate)} icon={Percent} tone={stats.passRate != null && stats.passRate < 60 ? 'warning' : 'success'} hint={`${stats.passed} passed · ${stats.failed} failed`} />
      <StatCard label="Highest / lowest" value={stats.highest != null ? `${formatNumber(stats.highest, 1)} / ${formatNumber(stats.lowest, 1)}` : '—'} icon={TrendingDown} />
    </div>
  )
}

/** Distribution chart + assessment weights summary, side by side. */
export function GradeSheetInsights({ sheet }) {
  const { stats, assessments, weightTotal, weightsValid } = sheet
  const empty = !stats.distribution.some((d) => d.count > 0)
  return (
    <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
      <ChartCard title="Grade distribution" description="Students with complete marks, by letter grade." tableColumns={distributionColumns} tableRows={stats.distribution} empty={empty} emptyText="No complete grades yet.">
        <GradeDistributionChart data={stats.distribution} />
      </ChartCard>
      <Card>
        <CardHeader>
          <CardTitle>Assessment weights</CardTitle>
          <Badge variant={weightsValid ? 'success' : 'danger'}>{weightsValid ? `Total ${weightTotal}%` : `Total ${weightTotal}% — must be 100%`}</Badge>
        </CardHeader>
        <CardContent>
          {!assessments.length ? (
            <EmptyState compact title="No assessments defined" />
          ) : (
            <ul className="divide-y text-sm">
              {assessments.map((a) => {
                const avg = stats.assessmentAverages.find((x) => x.assessmentId === a.id)
                return (
                  <li key={a.id} className="flex items-center justify-between gap-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{a.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {typeLabel(a.type)} · out of {a.maxMarks} · avg {avg?.averagePercent != null ? formatPercent(avg.averagePercent) : '—'}
                      </p>
                    </div>
                    <span className="tabular shrink-0 font-semibold">{a.weight}%</span>
                  </li>
                )
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

/** Full grade sheet table: every assessment, total, letter, points and result. */
export function GradeSheetTable({ sheet }) {
  const { assessments, rows, stats } = sheet
  if (!rows.length) return <EmptyState title="No students enrolled" description="This course offering has no enrollments." />
  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>Student ID</TableHead>
            <TableHead>Name</TableHead>
            {assessments.map((a) => (
              <TableHead key={a.id} className="text-right whitespace-nowrap">
                {a.name}
                <span className="block text-[10px] font-normal normal-case">
                  /{a.maxMarks} · {a.weight}%
                </span>
              </TableHead>
            ))}
            <TableHead className="text-right">Total</TableHead>
            <TableHead className="text-center">Letter</TableHead>
            <TableHead className="text-right">Points</TableHead>
            <TableHead>Result</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => {
            const w = isWithdrawn(r)
            return (
              <TableRow key={r.enrollmentId} className={cn(w && 'text-muted-foreground')}>
                <TableCell className="tabular whitespace-nowrap">{r.student?.studentNumber}</TableCell>
                <TableCell className="whitespace-nowrap">
                  {r.student?.name}
                  {w && (
                    <Badge variant="muted" className="ml-2">
                      Withdrawn
                    </Badge>
                  )}
                </TableCell>
                {assessments.map((a) => (
                  <TableCell key={a.id} className="text-right tabular">
                    {r.marks[a.id] ?? <span className="text-muted-foreground">—</span>}
                  </TableCell>
                ))}
                <TableCell className="text-right font-medium tabular">{w ? '—' : formatNumber(r.total, 2)}</TableCell>
                <TableCell className="text-center">
                  <GradeBadge letter={r.letter} passed={r.passed} />
                </TableCell>
                <TableCell className="text-right tabular">{r.gradePoints != null ? r.gradePoints.toFixed(2) : '—'}</TableCell>
                <TableCell>{w ? <span className="text-xs">Withdrawn</span> : r.passed == null ? <span className="text-xs text-muted-foreground">Incomplete</span> : <PassFailBadge passed={r.passed} />}</TableCell>
              </TableRow>
            )
          })}
        </TableBody>
        <TableFooter>
          <TableRow className="hover:bg-transparent">
            <TableCell colSpan={2}>Class average</TableCell>
            {assessments.map((a) => {
              const avg = stats.assessmentAverages.find((x) => x.assessmentId === a.id)
              return (
                <TableCell key={a.id} className="text-right tabular">
                  {formatNumber(avg?.average, 1)}
                </TableCell>
              )
            })}
            <TableCell className="text-right tabular">{formatNumber(stats.average, 2)}</TableCell>
            <TableCell colSpan={3} />
          </TableRow>
        </TableFooter>
      </Table>
    </div>
  )
}
