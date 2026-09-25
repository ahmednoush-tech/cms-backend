import { AuthContext } from '../interfaces/request-context.interface';

/**
 * Returns null if `permission` is fully (unscoped) granted to this
 * user — no filtering needed, matching the exact behavior every
 * service had before scoped roles existed. Returns an array of
 * department IDs if every one of the user's grants of this
 * permission is scoped to 'department' — the caller should filter
 * its query to just those departments. An empty array means the
 * user's only grants are scoped to a DIFFERENT scope type this
 * caller doesn't understand (there is only 'department' today, so
 * this is currently unreachable, but callers should still treat an
 * empty array as "show nothing" rather than crash).
 *
 * A caller only needs this when its endpoint's guard already
 * confirmed the user has SOME form of the permission (scoped or
 * not) — this helper does not itself check access, only how to
 * narrow it.
 */
export function getScopedDepartmentIds(user: AuthContext, permission: string): string[] | null {
  const scopes = user.scopedPermissions[permission];
  if (!scopes) return null; // unscoped grant exists — full access
  return scopes.filter((s) => s.scopeType === 'department').map((s) => s.scopeId);
}
