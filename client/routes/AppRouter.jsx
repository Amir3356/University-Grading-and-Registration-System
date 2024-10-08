import { Suspense } from 'react';
import { Route, Routes, Outlet } from 'react-router-dom';
import { PageSkeleton, Spinner } from '@/components/common/Loading';
import { AppLayout } from '@/components/layout/AppLayout';
import { LookupsProvider } from '@/context/LookupsProvider';
import { ProtectedRoute } from './ProtectedRoute';
import { LoginPage, HomeRedirect, NotFoundPage, sharedRoutes } from './sharedRoutes';
import { adminRoutes } from './adminRoutes';
import { deptHeadRoutes } from './deptHeadRoutes';
import { teacherRoutes } from './teacherRoutes';
import { studentRoutes } from './studentRoutes';

function AuthenticatedShell() {
  return (
    <LookupsProvider>
      <AppLayout />
    </LookupsProvider>
  );
}

function SuspenseOutlet() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Outlet />
    </Suspense>
  );
}

export function AppRouter() {
  return (
    <Suspense fallback={<Spinner />}>
      <Routes>
        {/* Public & Authentication */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<HomeRedirect />} />

        {/* Protected Authenticated Shell */}
        <Route element={<ProtectedRoute />}>
          <Route element={<AuthenticatedShell />}>
            <Route element={<SuspenseOutlet />}>
              {/* Shared Protected Pages */}
              {sharedRoutes}

              {/* Classified Actor Page Routes */}
              {adminRoutes}
              {deptHeadRoutes}
              {teacherRoutes}
              {studentRoutes}

              {/* Catch-all 404 */}
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Route>
        </Route>
      </Routes>
    </Suspense>
  );
}

export default AppRouter;
