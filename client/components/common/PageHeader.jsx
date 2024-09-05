import { ChevronLeft } from 'lucide-react'
import { Link } from 'react-router-dom'

export function PageHeader({ title, description, actions, backTo, backLabel = 'Back', children }) {
  return (
    <div className="page-header">
      <div className="page-header__main">
        {backTo && (
          <Link to={backTo} className="page-header__back">
            <ChevronLeft className="icon" aria-hidden="true" />
            {backLabel}
          </Link>
        )}
        <h1 className="page-header__title">{title}</h1>
        {description && <p className="page-header__description">{description}</p>}
        {children}
      </div>
      {actions && <div className="page-header__actions">{actions}</div>}
    </div>
  )
}
