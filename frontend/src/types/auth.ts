/**
 * Transcribed directly from:
 * backend/src/common/interfaces/request-context.interface.ts (AuthContext)
 * backend/src/modules/auth/dto/auth-response.dto.ts (TokenPairDto, CurrentUserDto)
 * Verified this session (Phase 3A). No field here was invented.
 */

/** Shape of GET /api/v1/auth/me, and of the JWT payload conceptually. */
export interface AuthContext {
  /** users.id */
  sub: string;
  /** users.company_id — read-only, NEVER sent by the frontend anywhere. */
  companyId: string;
  email: string;
  /** Present only if this identity has a matching employees row. */
  employeeId?: string;
  /** Role names, informational — permission checks use `permissions`, not this. */
  roles: string[];
  /** Flattened "module:resource:action" strings — see rbac/permissionConstants.ts */
  permissions: string[];
  /** True if this identity is a customer-portal login (customer_users row) rather than internal staff — routed to /portal, not the internal app. */
  isCustomerUser: boolean;
  customerId?: string;
}

/** Response shape of POST /api/v1/auth/login and POST /api/v1/auth/refresh. */
export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  /** Access token TTL in seconds. */
  expiresIn: number;
  user: {
    id: string;
    email: string;
    companyId: string;
    employeeId?: string;
    roles: string[];
    isCustomerUser: boolean;
    customerId?: string;
  };
}

export interface LoginInput {
  email: string;
  password: string;
}
