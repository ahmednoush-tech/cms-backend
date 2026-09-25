import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'permissions';

/**
 * Declares the (module:resource:action) permission string(s)
 * required to hit a route. Checked by PermissionsGuard against
 * the caller's flattened permissions list from their JWT.
 *
 * Usage:
 *   @Permissions('CRM:customers:view')
 *   @Get()
 *   findAll() { ... }
 *
 * Multiple permissions = caller needs ALL of them (AND semantics).
 * For OR semantics, declare two route handlers or check manually
 * in the service layer.
 */
export const Permissions = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
