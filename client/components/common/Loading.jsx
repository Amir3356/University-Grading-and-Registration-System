import { Loader2 } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'

export function Spinner({ label = 'Loading…' }) {
  return (
    <div className="spinner" role="status">
      <Loader2 className="icon spin" aria-hidden="true" />
      {label}
    </div>
  )
}

export function TableSkeleton({ rows = 6, cols = 5 }) {
  return (
    <div className="stack stack--sm" role="status" aria-label="Loading">
      <Skeleton style={{ height: 36 }} />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="skeleton-row" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
          {Array.from({ length: cols }).map((__, j) => (
            <Skeleton key={j} style={{ height: 24 }} />
          ))}
        </div>
      ))}
    </div>
  )
}

export function PageSkeleton() {
  return (
    <div className="skeleton-page" role="status" aria-label="Loading">
      <div className="stack stack--sm">
        <Skeleton style={{ height: 28, width: 224 }} />
        <Skeleton style={{ height: 16, width: 320 }} />
      </div>
      <div className="grid grid--4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} style={{ height: 96 }} />
        ))}
      </div>
      <div className="grid grid--halves">
        <Skeleton style={{ height: 288 }} />
        <Skeleton style={{ height: 288 }} />
      </div>
    </div>
  )
}
