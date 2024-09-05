import { Compass } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/context/auth-context'
import { HOME_BY_ROLE } from '@/routes/navigation'

export function NotFoundPage() {
  const { user } = useAuth()
  return (
    <div className="empty-state full-page-state">
      <div className="state-icon state-icon--lg">
        <Compass aria-hidden="true" />
      </div>
      <h1 className="state-title state-title--lg">Page not found</h1>
      <p className="state-description">The page you are looking for doesn't exist or has moved.</p>
      <Button asChild variant="outline" className="state-action">
        <Link to={user ? HOME_BY_ROLE[user.roleId] : '/login'}>Back to dashboard</Link>
      </Button>
    </div>
  )
}
