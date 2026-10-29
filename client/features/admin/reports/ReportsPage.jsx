import { useLookups } from '@/context/lookups-context'
import { RegistrationReportsView } from '@/features/reports/RegistrationReportsView'

export function ReportsPage() {
  const lookups = useLookups()
  return (
    <RegistrationReportsView
      description="Student registration and withdrawal activity across all departments."
      university={lookups?.university}
    />
  )
}

export default ReportsPage
