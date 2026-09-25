import { SetMetadata } from '@nestjs/common';

export const PORTAL_ONLY_KEY = 'portalOnly';

/**
 * The mirror image of @InternalOnly(): marks a route as reachable
 * ONLY by an authenticated customer-portal identity
 * (isCustomerUser === true). Internal staff — even a superadmin —
 * are rejected, the same hard-boundary way @InternalOnly() rejects
 * portal identities. Portal routes never carry @Permissions()
 * (a portal user's permissions array is always empty by design);
 * this guard is the entire authorization boundary for everything
 * under /portal.
 */
export const PortalOnly = () => SetMetadata(PORTAL_ONLY_KEY, true);
