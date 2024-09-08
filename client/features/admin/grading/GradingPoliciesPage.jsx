import { SlidersHorizontal } from 'lucide-react'
import { PageHeader } from '@/components/common/PageHeader'

export function GradingPoliciesPage() {
  return (
    <>
      <PageHeader title="Grading policies" />

      <div className="coming-soon-card">
        <div className="coming-soon-card__icon-wrapper">
          <SlidersHorizontal aria-hidden="true" />
        </div>
        <h2 className="coming-soon-card__title">Coming Soon</h2>
      </div>
    </>
  )
}
