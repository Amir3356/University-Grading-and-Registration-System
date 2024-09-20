import { FileBarChart } from 'lucide-react'
import { PageHeader } from '@/components/common/PageHeader'

export function GradeReportPage() {
  return (
    <>
      <PageHeader
        title="Grade Report"
        description="Official academic grade reports and performance summaries."
      />

      <div className="coming-soon-card">
        <div className="coming-soon-card__icon-wrapper">
          <FileBarChart aria-hidden="true" />
        </div>
        <h2 className="coming-soon-card__title">Coming Soon</h2>
      </div>
    </>
  )
}

export default GradeReportPage
