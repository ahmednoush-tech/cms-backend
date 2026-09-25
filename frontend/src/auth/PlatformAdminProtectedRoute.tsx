import { Navigate } from 'react-router-dom';
import { usePlatformAdminAuth } from '../auth/usePlatformAdminAuth';

interface PlatformAdminProtectedRouteProps {
  children: React.ReactNode;
}

/**
 * Deliberately does NOT reuse the tenant <ProtectedRoute> — that
 * component checks the tenant AuthContext/tokenStorage, which has
 * nothing to do with a platform admin's session. Checking token
 * PRESENCE here is a UX convenience only (avoids a flash of the
 * companies page before an API call 401s); the REAL enforcement is
 * the backend's PlatformAdminAuthGuard on every request.
 */
export function PlatformAdminProtectedRoute({ children }: PlatformAdminProtectedRouteProps) {
  const { isAuthenticated } = usePlatformAdminAuth();

  if (!isAuthenticated) {
    return <Navigate to="/platform-admin/login" replace />;
  }

  return <>{children}</>;
}
