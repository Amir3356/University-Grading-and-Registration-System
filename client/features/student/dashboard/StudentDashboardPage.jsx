import { GraduationCap } from 'lucide-react'
import { PageHeader } from '@/components/common/PageHeader'

export function StudentDashboardPage() {
  return (
    <>
      <PageHeader title="Dashboard" />

      <div className="coming-soon-card">
        <div className="coming-soon-card__icon-wrapper">
          <GraduationCap aria-hidden="true" />
        </div>
        <h2 className="coming-soon-card__title">Coming Soon</h2>
      </div>
    </>
  )
}
