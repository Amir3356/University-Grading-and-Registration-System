import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { axisProps, barRadius, gridProps, tooltipProps } from './chart-theme'

/** Letter-grade distribution. Single series => one color, no legend. data: [{letter, count}] */
export function GradeDistributionChart({ data, color = 'var(--chart-1)', showLabels = true }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 16, right: 8, left: -16, bottom: 0 }} barCategoryGap="22%">
        <CartesianGrid {...gridProps} />
        <XAxis dataKey="letter" {...axisProps} />
        <YAxis allowDecimals={false} {...axisProps} />
        <Tooltip {...tooltipProps} formatter={(v) => [v, 'Students']} />
        <Bar dataKey="count" name="Students" fill={color} radius={barRadius} maxBarSize={44}>
          {showLabels && <LabelList dataKey="count" position="top" fontSize={11} fill="var(--muted-foreground)" formatter={(v) => (v ? v : '')} />}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
