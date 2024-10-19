import { CalendarDays, CalendarCheck2, Users, Clock } from 'lucide-react'

const CARDS = [
  { key: 'totalSemesters', label: 'Total Semesters', icon: CalendarDays, tone: 'blue' },
  { key: 'openPeriods', label: 'Open Registration Periods', icon: CalendarCheck2, tone: 'green' },
  { key: 'registered', label: 'Registered Students', icon: Users, tone: 'purple' },
  { key: 'pending', label: 'Pending Registrations', icon: Clock, tone: 'orange' },
]

/** Summary cards shared by the registration periods and student registrations pages. */
export function RegistrationStats({ summary }) {
  return (
    <div className="semester-reg-stats">
      {CARDS.map(({ key, label, icon: Icon, tone }) => (
        <div key={key} className="reg-stat-card">
          <div className={`reg-stat-card__icon reg-stat-card__icon--${tone}`}>
            <Icon aria-hidden="true" />
          </div>
          <div className="reg-stat-card__content">
            <p className="reg-stat-card__label">{label}</p>
            <p className={`reg-stat-card__value reg-stat-card__value--${tone}`}>{summary ? summary[key] ?? 0 : '—'}</p>
          </div>
        </div>
      ))}
    </div>
  )
}
