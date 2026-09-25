/**
 * Shape of the JWT access-token payload AND of req.user after
 * JwtStrategy.validate() runs. This is the ONLY source of truth
 * for company_id / customer_id used in authorization — every
 * one of these fields is resolved server-side at login time and
 * signed into the token. Nothing here is ever re-derived from a
 * request body or query string.
 */
export interface AuthContext {
  /** users.id */
  sub: string;

  /** users.company_id — tenant scope. NEVER accept this from the client. */
  companyId: string;

  /** users.email, carried for convenience/logging */
  email: string;

  /**
   * Present only if this user has a matching employees row.
   * Internal-module access (Administration/CRM/Operations write
   * access beyond a customer's own data) requires this to be set.
   */
  employeeId?: string;

  /** Role names resolved at login time, used by PermissionsGuard */
  roles: string[];

  /** Flattened (module:resource:action) permission strings — includes both role-based and direct grants, scoped or not. */
  permissions: string[];

  /**
   * Permission strings from `permissions` above that are ONLY
   * ever granted with a scope (department, etc.) — never
   * unscoped/company-wide. A permission with even one unscoped
   * grant is deliberately left OUT of this map entirely, since an
   * unscoped grant already means full, unrestricted access and no
   * service should narrow it. Built in AuthService.buildAuthContext()
   * from UserRole/UserPermission's scopeType/scopeId — see that
   * method's comment for the full reasoning. A service that reads
   * a permission from `permissions` but ignores this map is
   * granting full access regardless of scope — every service that
   * enforces scope must check this explicitly.
   */
  scopedPermissions: Record<string, Array<{ scopeType: string; scopeId: string }>>;

  /**
   * True if this user has one or more active customer_users rows.
   * A user could theoretically be both an employee AND a customer
   * user across different accounts, but in V1 a single login is
   * treated as exactly one identity type per session — see
   * AuthService.buildAuthContext().
   */
  isCustomerUser: boolean;

  /**
   * Resolved server-side from customer_users.customer_id at login.
   * NEVER accept customer_id from the client for authorization —
   * this is the only trusted value. Present only when
   * isCustomerUser is true.
   */
  customerId?: string;
}

/** Express Request, augmented with the authenticated context */
export interface AuthenticatedRequest extends Request {
  user: AuthContext;
}
