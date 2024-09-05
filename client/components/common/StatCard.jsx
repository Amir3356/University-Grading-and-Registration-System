import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'

/** tone: default | teal | warning | danger | success */
export function StatCard({ label, value, icon: Icon, hint, tone = 'default', to, className }) {
  const body = (
    <>
      <div className="stat-card__row">
        <div style={{ minWidth: 0 }}>
          <p className="stat-card__label">{label}</p>
          <p className="stat-card__value">{value ?? '—'}</p>
        </div>
        {Icon && (
          <div className={cn('stat-card__icon', `tone-${tone}`)}>
            <Icon aria-hidden="true" />
          </div>
        )}
      </div>
      {hint && <p className="stat-card__hint">{hint}</p>}
    </>
  )
  return to ? (
    <Link to={to} className={cn('stat-card', className)}>
      {body}
    </Link>
  ) : (
    <div className={cn('stat-card', className)}>{body}</div>
  )
}
