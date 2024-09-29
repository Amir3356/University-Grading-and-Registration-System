import { Download, Printer } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { ErrorState } from '@/components/common/ErrorState'
import { PageSkeleton } from '@/components/common/Loading'
import { PageHeader } from '@/components/common/PageHeader'
import { useQuery } from '@/hooks/useStore'
import { downloadTranscriptPdf } from '@/lib/transcript-pdf'
import { store } from '@/store'
import { TranscriptView } from '@/features/shared/TranscriptView'

export function TranscriptPage() {
  const { data, loading, error, refetch } = useQuery(() => store.student.getMyTranscript(), [])

  const download = () => {
    try {
      downloadTranscriptPdf(data)
      toast.success('Unofficial transcript downloaded.')
    } catch (err) {
      toast.error(err.message || 'Could not generate the PDF.')
    }
  }

  return (
    <>
      <PageHeader
        title="Transcript"
        description="View all semesters' official course results, cumulative GPA, and completed credits."
        centered
        actions={
          data && (
            <div className="no-print flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => window.print()}>
                <Printer /> Print
              </Button>
              <Button size="sm" onClick={download}>
                <Download /> Download PDF
              </Button>
            </div>
          )
        }
      />
      {error ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : loading || !data ? (
        <PageSkeleton />
      ) : (
        <TranscriptView transcript={data} />
      )}
    </>
  )
}
