import { LayoutDashboard, ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { PageHeader } from '@/components/common/PageHeader'
import { Button } from '@/components/ui/button'
import { useQuery } from '@/hooks/useStore'
import { getStudentRegistrationsApi } from '@/api/registration'
import { RegistrationCountdown } from '@/components/registration/RegistrationCountdown'

export function StudentDashboardPage() {
  const { data } = useQuery(getStudentRegistrationsApi, [], { live: false })
  const currentPeriod = data?.currentPeriod
  const upcomingPeriod = data?.upcomingPeriod
  const activePeriod = currentPeriod || upcomingPeriod

  return (
    <div className="space-y-6">
      <PageHeader title="Student Dashboard" />

      {activePeriod && (
        <RegistrationCountdown
          startDate={activePeriod.start_date}
          deadline={activePeriod.deadline}
          semesterName={activePeriod.semester_name}
          academicYearName={activePeriod.academic_year_name}
          actionButton={
            <Button asChild size="sm">
              <Link to="/student/registrations">
                Go to Registration <ArrowRight className="size-4 ml-1" />
              </Link>
            </Button>
          }
        />
      )}

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
