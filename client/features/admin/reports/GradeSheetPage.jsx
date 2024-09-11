import { Download, FileSpreadsheet, FileText, Sheet } from 'lucide-react'
import { useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { ErrorState } from '@/components/common/ErrorState'
import { PageSkeleton } from '@/components/common/Loading'
import { PageHeader } from '@/components/common/PageHeader'
import { GradeStatusBadge } from '@/components/common/StatusBadge'
import { useAuth } from '@/context/auth-context'
import { useQuery } from '@/hooks/useStore'
import { exportCsv, exportExcel } from '@/lib/export'
import { formatDateTime } from '@/lib/format'
import { store } from '@/store'
import { GradeSheetInsights, GradeSheetStats, GradeSheetTable } from './GradeSheetParts'
import { downloadGradeSheetPdf, gradeSheetExportColumns } from './grade-sheet-utils'

function Meta({ label, children }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium">{children || '—'}</dd>
    </div>
  )
}

export function GradeSheetPage() {
  const { offeringId } = useParams()
  const { user } = useAuth()
  const isDeptHead = user?.roleId === 'dept_head'
  const backTo = isDeptHead ? '/dept-head/reports' : '/admin/reports?tab=courses'
  const { data, loading, error, refetch } = useQuery(() => store.reports.getCourseGradeSheet(offeringId), [offeringId])

  if (loading && !data) return <PageSkeleton />
  if (error)
    return (
      <>
        <PageHeader title="Course grade sheet" backTo={backTo} backLabel="Reports" />
        <ErrorState error={error} onRetry={refetch} />
      </>
    )

  const o = data.offering
  const name = `grade_sheet_${o.course.code}_${o.semester?.name ?? ''}`

  const run = (kind) => {
    try {
      const cols = gradeSheetExportColumns(data.assessments)
      if (kind === 'pdf') downloadGradeSheetPdf(data, data.university)
      if (kind === 'xlsx') {
        const sem = data.stats
        exportExcel(name, [
          { name: 'Grade sheet', columns: cols, rows: data.rows },
          {
            name: 'Assessments',
            columns: [
              { header: 'Assessment', value: (a) => a.name },
              { header: 'Type', value: (a) => a.type },
              { header: 'Max marks', value: (a) => a.maxMarks },
              { header: 'Weight (%)', value: (a) => a.weight },
              { header: 'Average (%)', value: (a) => sem.assessmentAverages.find((x) => x.assessmentId === a.id)?.averagePercent?.toFixed(1) ?? '' },
            ],
            rows: data.assessments,
          },
          { name: 'Distribution', columns: [{ header: 'Grade', value: (d) => d.letter }, { header: 'Students', value: (d) => d.count }], rows: data.stats.distribution },
        ])
      }
      if (kind === 'csv') exportCsv(name, cols, data.rows)
      toast.success('Grade sheet exported.')
    } catch (err) {
      toast.error(err.message || 'Export failed.')
    }
  }

  return (
    <>
      <PageHeader
        title={`${o.course.code} · ${o.course.title}`}
        description="Course grade sheet"
        backTo={backTo}
        backLabel="Reports"
        actions={
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" disabled={!data.rows.length}>
                <Download /> Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => run('pdf')}>
                <FileText /> PDF grade sheet
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => run('xlsx')}>
                <FileSpreadsheet /> Excel (.xlsx)
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => run('csv')}>
                <Sheet /> CSV
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        }
      />
      <div className="grid gap-6">
        <Card>
          <CardContent>
            <dl className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
              <Meta label="Semester">{o.semester?.name}</Meta>
              <Meta label="Section">{o.section}</Meta>
              <Meta label="Teacher">{o.teacher?.name ?? 'Unassigned'}</Meta>
              <Meta label="Credit hours">{o.course.creditHours}</Meta>
              <Meta label="Pass mark">{`${data.passMark}%`}</Meta>
              <Meta label="Grade status">
                <GradeStatusBadge status={o.gradeStatus} />
              </Meta>
            </dl>
            <p className="mt-3 text-xs text-muted-foreground">Generated {formatDateTime(data.generatedAt)}</p>
          </CardContent>
        </Card>
        <GradeSheetStats stats={data.stats} />
        <GradeSheetInsights sheet={data} />
        <GradeSheetTable sheet={data} />
      </div>
    </>
  )
}
