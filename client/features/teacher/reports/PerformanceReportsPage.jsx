import { FileBarChart } from 'lucide-react'
import { PageHeader } from '@/components/common/PageHeader'

export function PerformanceReportsPage() {
  return (
    <>
      <PageHeader
        title="Report"
        description="Course reports, grade analytics, and class performance summaries."
        centered
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

export const TeacherReportsPage = PerformanceReportsPage
export default PerformanceReportsPage
