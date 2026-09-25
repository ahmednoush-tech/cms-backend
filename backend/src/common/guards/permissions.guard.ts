import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { AuthContext } from '../interfaces/request-context.interface';

/**
 * Checks the caller's flattened permissions (set on the JWT at
 * login) against whatever @Permissions(...) the route handler
 * declares. Runs after JwtAuthGuard, so req.user is guaranteed
 * to be populated by the time this executes.
 *
 * Routes with no @Permissions() metadata are allowed through
 * (authentication alone is enough) — this guard only narrows,
 * it never widens access on its own.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required || required.length === 0) return true;

    const request = context.switchToHttp().getRequest();
    const user: AuthContext = request.user;

    if (!user) return false;

    const granted = new Set(user.permissions ?? []);
    const hasAll = required.every((perm) => granted.has(perm));

    if (!hasAll) {
      throw new ForbiddenException(
        `Missing required permission(s): ${required.join(', ')}`,
      );
    }
    return true;
  }
}
