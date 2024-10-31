import { CalendarDays, Users, Clock } from 'lucide-react'

const CARDS = [
  { key: 'totalPeriods', fallbackKey: 'totalSemesters', label: 'Total Registration Periods', icon: CalendarDays, tone: 'blue' },
  { key: 'registered', label: 'Registered Students', icon: Users, tone: 'purple' },
  { key: 'pending', label: 'Pending Registrations', icon: Clock, tone: 'orange' },
]

/** Summary cards shared by the registration periods and student registrations pages. */
export function RegistrationStats({ summary, showPending = true }) {
  const visibleCards = showPending ? CARDS : CARDS.filter((c) => c.key !== 'pending')

  return (
    <div className="semester-reg-stats">
      {visibleCards.map(({ key, fallbackKey, label, icon: Icon, tone }) => {
        const val = summary ? (summary[key] ?? (fallbackKey ? summary[fallbackKey] : undefined) ?? 0) : '—'
        return (
          <div key={key} className="reg-stat-card">
            <div className={`reg-stat-card__icon reg-stat-card__icon--${tone}`}>
              <Icon aria-hidden="true" />
            </div>
            <div className="reg-stat-card__content">
              <p className="reg-stat-card__label">{label}</p>
              <p className={`reg-stat-card__value reg-stat-card__value--${tone}`}>{val}</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}
