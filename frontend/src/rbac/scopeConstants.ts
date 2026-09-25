/**
 * Matches backend/src/common/constants/scope.constants.ts's
 * COMPANY_WIDE_SCOPE_ID exactly — a UserRole or UserPermission row
 * with this scopeId is unscoped (applies company-wide), not
 * limited to one department. Never hardcode this literal a second
 * time.
 */
export const COMPANY_WIDE_SCOPE_ID = '00000000-0000-0000-0000-000000000000';
