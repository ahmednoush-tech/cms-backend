import { SetMetadata } from '@nestjs/common';

export const INTERNAL_ONLY_KEY = 'internalOnly';

/**
 * Marks a route as unreachable for customer-portal identities,
 * regardless of any role/permission they might otherwise carry.
 * This is a hard boundary, not a permission check — per the
 * approved security model, customer isolation must not depend
 * solely on RBAC.
 *
 * Applied to all Administration routes and to any Operations/CRM
 * route that exposes internal-only data (employees, departments,
 * roles, activity logs, etc).
 */
export const InternalOnly = () => SetMetadata(INTERNAL_ONLY_KEY, true);
