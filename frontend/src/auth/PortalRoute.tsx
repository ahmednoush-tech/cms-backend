import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { LoadingState } from '../components/LoadingState/LoadingState';

interface PortalRouteProps {
  children: ReactNode;
}

/**
 * The mirror image of ProtectedRoute: every /portal/* route uses
 * this instead. Internal staff (isCustomerUser !== true) are
 * redirected to /dashboard, the same hard-boundary direction the
 * backend's PortalOnlyGuard enforces server-side — this is a UX
 * convenience, not the actual security boundary (that's the JWT +
 * backend guard); a staff member manually hitting a /portal/*
 * URL is simply routed to their own app, not blocked with an
 * error page.
 */
export function PortalRoute({ children }: PortalRouteProps) {
  const { status, user } = useAuth();
  const location = useLocation();

  if (status === 'checking') {
    return <LoadingState variant="page" />;
  }

  if (status === 'unauthenticated') {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (!user?.isCustomerUser) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
