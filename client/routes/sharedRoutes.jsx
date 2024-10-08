import { lazy } from 'react';
import { Route, Navigate } from 'react-router-dom';
import { useAuth } from '@/context/auth-context';
import { Spinner } from '@/components/common/Loading';
import { HOME_BY_ROLE } from './navigation';

const page = (loader, name) =>
  lazy(() => loader().then((m) => ({ default: m[name] ?? m.default })));

// Shared Pages
export const LoginPage = page(() => import('@/features/auth/LoginPage'), 'LoginPage');
export const ProfilePage = page(() => import('@/features/shared/ProfilePage'), 'ProfilePage');
export const NotificationsPage = page(() => import('@/features/shared/NotificationsPage'), 'NotificationsPage');
export const NotFoundPage = page(() => import('@/features/shared/NotFoundPage'), 'NotFoundPage');

export function HomeRedirect() {
  const { user, loading } = useAuth();
  if (loading) return <Spinner />;
  return <Navigate to={user ? HOME_BY_ROLE[user.roleId] : '/login'} replace />;
}

export const sharedRoutes = (
  <>
    <Route path="/profile" element={<ProfilePage />} />
    <Route path="/notifications" element={<NotificationsPage />} />
  </>
);
