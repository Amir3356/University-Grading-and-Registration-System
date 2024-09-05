import { Inbox } from 'lucide-react'
import { cn } from '@/lib/utils'

export function EmptyState({ icon: Icon = Inbox, title = 'Nothing here yet', description, action, compact = false, className }) {
  return (
    <div className={cn('empty-state', compact && 'empty-state--compact', className)}>
      <div className="state-icon">
        <Icon aria-hidden="true" />
      </div>
      <p className="state-title">{title}</p>
      {description && <p className="state-description">{description}</p>}
      {action && <div className="state-action">{action}</div>}
    </div>
  )
}
