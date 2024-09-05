import { Download, LineChart, Printer } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { ErrorState } from '@/components/common/ErrorState'
import { PageSkeleton } from '@/components/common/Loading'
import { PageHeader } from '@/components/common/PageHeader'
import { useQuery } from '@/hooks/useStore'
import { downloadTranscriptPdf } from '@/lib/transcript-pdf'
import { store } from '@/store'
import { TranscriptView } from '@/features/shared/TranscriptView'

export function AdminTranscriptPage() {
  const { studentId } = useParams()
  // Not live: generating a transcript writes an audit log entry, which would otherwise trigger a refetch loop.
  const { data, loading, error, refetch } = useQuery(() => store.reports.getTranscript(studentId), [studentId], { live: false })

  const download = () => {
    try {
      downloadTranscriptPdf(data, { official: true })
      toast.success('Transcript downloaded.')
    } catch (err) {
      toast.error(err.message || 'Could not generate the PDF.')
    }
  }

  return (
    <>
      <PageHeader
        title={data ? `Transcript — ${data.student.name}` : 'Academic transcript'}
        description={data ? `${data.student.studentNumber} · ${data.student.program}` : undefined}
        backTo="/admin/reports?tab=transcripts"
        backLabel="Reports"
        actions={
          data && (
            <>
              <Button variant="outline" asChild>
                <Link to={`/admin/reports/students/${studentId}`}>
                  <LineChart /> Performance
                </Link>
              </Button>
              <Button variant="outline" onClick={() => window.print()}>
                <Printer /> Print
              </Button>
              <Button onClick={download}>
                <Download /> Download PDF
              </Button>
            </>
          )
        }
      />
      {loading && !data ? <PageSkeleton /> : error ? <ErrorState error={error} onRetry={refetch} /> : <TranscriptView transcript={data} />}
    </>
  )
}
