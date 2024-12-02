import { useCallback, useEffect } from 'react'
import { Download } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { ErrorState } from '@/components/common/ErrorState'
import { PageSkeleton } from '@/components/common/Loading'
import { PageHeader } from '@/components/common/PageHeader'
import { useQuery } from '@/hooks/useStore'
import { useWebSocketEvent } from '@/lib/websocket'
import { onGradeChange, onAssessmentChange } from '@/lib/syncEvents'
import { downloadTranscriptPdf } from '@/lib/transcript-pdf'
import { store } from '@/store'
import { TranscriptView } from '@/features/shared/TranscriptView'

export function TranscriptPage() {
  const { data, loading, error, refetch } = useQuery(() => store.student.getMyTranscript(), [])

  const handleRealtimeUpdate = useCallback(() => {
    refetch()
  }, [refetch])

  // Real-time WebSocket triggers when teacher saves/edits marks or submissions change
  useWebSocketEvent('SCORES_UPDATED', handleRealtimeUpdate)
  useWebSocketEvent('OFFERING_UPDATED', handleRealtimeUpdate)
  useWebSocketEvent('GRADE_UPDATED', handleRealtimeUpdate)
  useWebSocketEvent('TRANSCRIPT_UPDATED', handleRealtimeUpdate)
  useWebSocketEvent('GRADE_SUBMISSION_UPDATED', handleRealtimeUpdate)
  useWebSocketEvent('GRADE_SCALE_UPDATED', handleRealtimeUpdate)
  useWebSocketEvent('GRADING_POLICY_UPDATED', handleRealtimeUpdate)
  useWebSocketEvent('ASSESSMENT_UPDATED', handleRealtimeUpdate)

  // Cross-tab and local window sync fallback
  useEffect(() => {
    const unGrade = onGradeChange(handleRealtimeUpdate)
    const unAsm = onAssessmentChange(handleRealtimeUpdate)
    return () => {
      unGrade()
      unAsm()
    }
  }, [handleRealtimeUpdate])

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
              <Button size="sm" onClick={download}>
                <Download /> Download PDF
              </Button>
            </div>
          )
        }
      />
      {error ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : loading && !data ? (
        <PageSkeleton />
      ) : (
        <TranscriptView transcript={data} />
      )}
    </>
  )
}
