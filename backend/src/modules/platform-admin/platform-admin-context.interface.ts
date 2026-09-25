/**
 * Deliberately a DIFFERENT shape from AuthContext (tenant users) —
 * no companyId at all, and an explicit `type` marker as
 * defense-in-depth so a payload from one system is structurally
 * distinguishable from the other even before signature/secret
 * checks are considered.
 */
export interface PlatformAdminAuthContext {
  /** platform_admins.id */
  sub: string;
  email: string;
  type: 'platform-admin';
}
