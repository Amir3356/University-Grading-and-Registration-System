import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Badge } from '@/components/ui/badge'
import { ChartCard } from '@/components/charts/ChartCard'
import { SERIES, axisProps, gridProps, legendProps, lineCursor, tooltipProps } from '@/components/charts/chart-theme'
import { GradeBadge, StatusBadge } from '@/components/common/StatusBadge'
import { formatGpa } from '@/lib/format'
import { RESULT_STATUS_LABELS, standingVariant } from './policy'

export function StandingBadge({ standing }) {
  if (!standing) return null
  return <Badge variant={standingVariant(standing.tone)}>{standing.label}</Badge>
}

/**
 * Semester GPA and running CGPA on the 0–4 scale.
 * data: [{ label, name, gpa, cgpa }] in chronological order (`name` = full semester name for tooltips/table).
 */
export function GpaTrendChart({ data, title = 'GPA trend', description = 'Semester GPA and cumulative GPA (CGPA) after each semester, on the 0–4 scale.', height = 260, className }) {
  const fewPoints = data.length <= 10
  return (
    <ChartCard
      title={title}
      description={description}
      height={height}
      className={className}
      empty={!data.length}
      emptyText="No published results yet — your GPA trend appears after your first results are published."
      tableColumns={[
        { key: 'name', header: 'Semester' },
        { key: 'gpa', header: 'Semester GPA', format: formatGpa },
        { key: 'cgpa', header: 'CGPA', format: formatGpa },
      ]}
      tableRows={data}
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -16 }}>
          <CartesianGrid {...gridProps} />
          <XAxis dataKey="label" {...axisProps} interval="preserveStartEnd" />
          <YAxis domain={[0, 4]} ticks={[0, 1, 2, 3, 4]} {...axisProps} />
          <Tooltip
            {...tooltipProps}
            cursor={lineCursor}
            formatter={(v) => formatGpa(v)}
            labelFormatter={(label, payload) => payload?.[0]?.payload?.name ?? label}
          />
          <Legend {...legendProps} />
          <Line type="monotone" dataKey="gpa" name="Semester GPA" stroke={SERIES[0]} strokeWidth={2} dot={fewPoints ? { r: 4 } : false} activeDot={{ r: 5 }} connectNulls />
          <Line type="monotone" dataKey="cgpa" name="CGPA" stroke={SERIES[1]} strokeWidth={2} dot={fewPoints ? { r: 4 } : false} activeDot={{ r: 5 }} connectNulls />
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}

/** Result status of a course row from store.student (published → letter, otherwise a status label). */
export function ResultStatus({ course }) {
  if (course.finalGrade) {
    return (
      <span className="inline-flex items-center gap-1.5">
        <GradeBadge letter={course.finalGrade.letter} passed={course.finalGrade.passed} />
        <span className="text-xs text-muted-foreground">Published</span>
      </span>
    )
  }
  return <StatusBadge status={course.resultStatus} label={RESULT_STATUS_LABELS[course.resultStatus]} />
}
