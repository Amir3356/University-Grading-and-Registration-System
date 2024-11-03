import { LayoutDashboard } from 'lucide-react'
import { PageHeader } from '@/components/common/PageHeader'

export function AdminDashboardPage() {
  return (
    <>
      <PageHeader title="Dashboard" />

      <div className="coming-soon-card">
        <div className="coming-soon-card__icon-wrapper">
          <LayoutDashboard aria-hidden="true" />
        </div>
        <h2 className="coming-soon-card__title">Coming Soon</h2>
      </div>
    </>
  )
}
export default AdminDashboardPage
