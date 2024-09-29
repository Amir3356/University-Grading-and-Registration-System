import { ChevronLeft } from 'lucide-react'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'

export function PageHeader({ title, description, actions, backTo, backLabel = 'Back', centered = false, className, children }) {
  return (
    <div className={cn('page-header', centered && 'page-header--centered', className)}>
      <div className={cn('page-header__main', centered && 'text-center')}>
        {backTo && (
          <Link to={backTo} className="page-header__back">
            <ChevronLeft className="icon" aria-hidden="true" />
            {backLabel}
          </Link>
        )}
        <h1 className={cn('page-header__title', centered && 'text-center')}>{title}</h1>
        {description && <p className={cn('page-header__description', centered && 'text-center')}>{description}</p>}
        {children}
      </div>
      {actions && <div className="page-header__actions">{actions}</div>}
    </div>
  )
}
