import { LayoutDashboard } from 'lucide-react'
import { PageHeader } from '@/components/common/PageHeader'

export function StudentDashboardPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Student Dashboard" />

      <div className="coming-soon-card">
        <div className="coming-soon-card__icon-wrapper">
          <LayoutDashboard aria-hidden="true" />
        </div>
        <h2 className="coming-soon-card__title">Welcome to Student Portal</h2>
        <p className="text-sm text-muted-foreground mt-2 max-w-md text-center">
          Access your courses, view semester registrations, check assessment grades, and track your degree progress from the navigation sidebar.
        </p>
      </div>
    </div>
  )
}
export default StudentDashboardPage
