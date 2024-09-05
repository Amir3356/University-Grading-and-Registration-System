import { AlertTriangle, Lock, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function ErrorState({ error, onRetry, title }) {
  const forbidden = error?.kind === 'forbidden'
  const missing = error?.kind === 'not_found'
  const Icon = forbidden ? Lock : AlertTriangle
  return (
    <div role="alert" className="error-state">
      <div className="state-icon state-icon--danger">
        <Icon aria-hidden="true" />
      </div>
      <p className="state-title">{title ?? (forbidden ? 'Access denied' : missing ? 'Not found' : 'Something went wrong')}</p>
      <p className="state-description">{error?.message ?? 'An unexpected error occurred.'}</p>
      {onRetry && !forbidden && !missing && (
        <Button variant="outline" size="sm" className="state-action" onClick={() => onRetry()}>
          <RefreshCw /> Try again
        </Button>
      )}
    </div>
  )
}
