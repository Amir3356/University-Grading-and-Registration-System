// Shared Recharts styling: thin marks, recessive grid/axes, themed tooltip.
// Series colors come from CSS variables (validated palette, fixed order).
export const SERIES = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)']

export const axisProps = {
  stroke: 'var(--chart-axis)',
  tick: { fill: 'var(--chart-axis)', fontSize: 12 },
  tickLine: false,
  axisLine: { stroke: 'var(--chart-grid)' },
}

export const gridProps = { stroke: 'var(--chart-grid)', strokeDasharray: '0', vertical: false }

export const tooltipProps = {
  cursor: { fill: 'var(--muted)', opacity: 0.5 },
  contentStyle: {
    background: 'var(--popover)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    color: 'var(--popover-foreground)',
    fontSize: 12,
    boxShadow: '0 4px 12px rgb(0 0 0 / 0.08)',
  },
  labelStyle: { color: 'var(--foreground)', fontWeight: 600, marginBottom: 4 },
  itemStyle: { color: 'var(--foreground)', padding: 0 },
}

export const lineCursor = { stroke: 'var(--chart-axis)', strokeWidth: 1, strokeDasharray: '3 3' }

export const legendProps = {
  iconType: 'circle',
  iconSize: 8,
  wrapperStyle: { fontSize: 12, color: 'var(--muted-foreground)', paddingTop: 8 },
}

/** Bar ends rounded at the data end only, 4px. */
export const barRadius = [4, 4, 0, 0]
export const barRadiusHorizontal = [0, 4, 4, 0]
