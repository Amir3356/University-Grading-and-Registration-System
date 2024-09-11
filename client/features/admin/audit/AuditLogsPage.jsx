import { ScrollText } from 'lucide-react'
import { PageHeader } from '@/components/common/PageHeader'

export function AuditLogsPage() {
  return (
    <>
      <PageHeader title="Audit logs" />

      <div className="coming-soon-card">
        <div className="coming-soon-card__icon-wrapper">
          <ScrollText aria-hidden="true" />
        </div>
        <h2 className="coming-soon-card__title">Coming Soon</h2>
      </div>
    </>
  )
}
