import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { Spinner } from '@/components/common/Loading'
import { useAuth } from '@/context/auth-context'
import { ForbiddenPage } from '@/features/shared/ForbiddenPage'

/** Requires an authenticated user, optionally with one of `roles`. */
export function ProtectedRoute({ roles }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return <Spinner label="Checking your session…" />
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />
  if (roles && !roles.includes(user.roleId)) return <ForbiddenPage />
  return <Outlet />
}
