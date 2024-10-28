import { LayoutDashboard, ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { PageHeader } from '@/components/common/PageHeader'
import { Button } from '@/components/ui/button'
import { useQuery } from '@/hooks/useStore'
import { listRegistrationPeriodsApi } from '@/api/registration'
import { RegistrationCountdown } from '@/components/registration/RegistrationCountdown'

export function AdminDashboardPage() {
  const { data } = useQuery(listRegistrationPeriodsApi, [], { live: false })
  const items = data?.items ?? []
  // Find open period first, then upcoming scheduled period
  const activePeriod =
    items.find((p) => p.status === 'open') ||
    items.find((p) => p.status === 'scheduled') ||
    null

  return (
    <div className="space-y-6">
      <PageHeader title="Admin Dashboard" />

      {activePeriod && (
        <RegistrationCountdown
          startDate={activePeriod.start_date}
          deadline={activePeriod.deadline}
          semesterName={activePeriod.semester?.name}
          academicYearName={activePeriod.semester?.academicYear?.name}
          actionButton={
            <Button asChild size="sm">
              <Link to="/admin/semester-registration/periods">
                Manage Periods <ArrowRight className="size-4 ml-1" />
              </Link>
            </Button>
          }
        />
      )}

      <div className="coming-soon-card">
        <div className="coming-soon-card__icon-wrapper">
          <LayoutDashboard aria-hidden="true" />
        </div>
        <h2 className="coming-soon-card__title">Welcome to Admin Portal</h2>
        <p className="text-sm text-muted-foreground mt-2 max-w-md text-center">
          Manage user accounts, courses, departments, academic calendar, semester registrations, and grade approvals from the sidebar menu.
        </p>
      </div>
    </div>
  )
}
export default AdminDashboardPage
