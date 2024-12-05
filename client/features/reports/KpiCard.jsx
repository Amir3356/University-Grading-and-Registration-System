import { ArrowDownRight, ArrowUpRight } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Report KPI tile. tone: reg | wd | net | rate | pass | fail (sets the accent color).
 * `change` (a number) shows a delta pill; leave it undefined to show only the hint.
 */
export function KpiCard({ label, value, icon: Icon, tone, change, changeSuffix = '%', invert = false, hint }) {
  const showDelta = change !== undefined
  const hasChange = change != null && Number.isFinite(change)
  const up = hasChange && change >= 0
  // For withdrawals a rise is bad, so `invert` flips which direction reads as positive.
  const positive = hasChange && (invert ? !up : up)
  const Arrow = up ? ArrowUpRight : ArrowDownRight

  return (
    <div className={cn('rpt-kpi', `rpt-kpi--${tone}`)}>
      <div className="rpt-kpi__top">
        <span className="rpt-kpi__label">{label}</span>
        <span className="rpt-kpi__icon" aria-hidden="true">
          <Icon />
        </span>
      </div>
      <p className="rpt-kpi__value tabular">{value}</p>
      {(showDelta || hint) && (
        <div className="rpt-kpi__foot">
          {showDelta &&
            (hasChange ? (
              <span className={cn('rpt-kpi__delta', positive ? 'rpt-kpi__delta--good' : 'rpt-kpi__delta--bad')}>
                <Arrow aria-hidden="true" />
                {Math.abs(change).toFixed(1)}
                {changeSuffix}
              </span>
            ) : (
              <span className="rpt-kpi__delta rpt-kpi__delta--flat">—</span>
            ))}
          {hint && <span className="rpt-kpi__hint">{hint}</span>}
        </div>
      )}
    </div>
  )
}
