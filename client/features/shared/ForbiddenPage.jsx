import { ShieldAlert } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/context/auth-context'
import { HOME_BY_ROLE } from '@/routes/navigation'

export function ForbiddenPage() {
  const { user } = useAuth()
  return (
    <div className="empty-state full-page-state">
      <div className="state-icon state-icon--lg state-icon--danger">
        <ShieldAlert aria-hidden="true" />
      </div>
      <h1 className="state-title state-title--lg">Access denied</h1>
      <p className="state-description">Your account does not have permission to view this page.</p>
      <Button asChild variant="outline" className="state-action">
        <Link to={user ? HOME_BY_ROLE[user.roleId] : '/login'}>Go to my dashboard</Link>
      </Button>
    </div>
  )
}
