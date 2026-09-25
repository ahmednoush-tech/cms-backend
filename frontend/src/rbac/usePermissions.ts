import { useAuth } from '../auth/useAuth';

/**
 * UX convenience only (design doc section D) — the backend
 * independently re-checks every one of these on every request.
 * Nothing here is a security boundary.
 */
export function usePermissions() {
  const { user } = useAuth();
  const granted = new Set(user?.permissions ?? []);

  return {
    hasPermission: (permission: string): boolean => granted.has(permission),
    hasAnyPermission: (permissions: readonly string[]): boolean => permissions.some((p) => granted.has(p)),
    hasAllPermissions: (permissions: readonly string[]): boolean => permissions.every((p) => granted.has(p)),
  };
}
