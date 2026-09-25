import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { usePermissions } from '../rbac/usePermissions';
import { LoadingState } from '../components/LoadingState/LoadingState';

interface ProtectedRouteProps {
  children: ReactNode;
  requiredPermissions?: readonly string[];
  matchAny?: boolean;
}

export function ProtectedRoute({ children, requiredPermissions, matchAny = false }: ProtectedRouteProps) {
  const { status, user } = useAuth();
  const { hasAnyPermission, hasAllPermissions } = usePermissions();
  const location = useLocation();

  if (status === 'checking') {
    return <LoadingState variant="page" />;
  }

  if (status === 'unauthenticated') {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (user?.isCustomerUser) {
    return <Navigate to="/portal/invoices" replace />;
  }

  if (requiredPermissions && requiredPermissions.length > 0) {
    const allowed = matchAny ? hasAnyPermission(requiredPermissions) : hasAllPermissions(requiredPermissions);
    if (!allowed) {
      return <Navigate to="/403" replace />;
    }
  }

  return <>{children}</>;
}
