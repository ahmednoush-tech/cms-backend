import type { ReactNode } from 'react';
import { usePermissions } from './usePermissions';

interface PermissionGateProps {
  /** Required permission(s). Default: caller must have ALL of them. */
  requires: string | readonly string[];
  /** If true, caller needs ANY one of `requires` rather than all. */
  matchAny?: boolean;
  children: ReactNode;
  /** Rendered instead of nothing when the check fails — rarely used; default is to render nothing at all (design doc D.6). */
  fallback?: ReactNode;
}

/**
 * Wraps an action/button (Send/Accept/Reject a quotation, Assign a
 * work order, Delete anywhere, etc). Renders nothing by default
 * when the permission is missing — not a disabled button — per
 * the design doc's stated philosophy: don't imply a capability
 * that would just 403 if attempted.
 *
 * This is UX only. The backend is authoritative (design doc
 * section D, restated here since it's the whole point of this
 * component's existence).
 */
export function PermissionGate({ requires, matchAny = false, children, fallback = null }: PermissionGateProps) {
  const { hasAnyPermission, hasAllPermissions } = usePermissions();
  const required = Array.isArray(requires) ? requires : [requires as string];

  const allowed = matchAny ? hasAnyPermission(required) : hasAllPermissions(required);

  return allowed ? <>{children}</> : <>{fallback}</>;
}
