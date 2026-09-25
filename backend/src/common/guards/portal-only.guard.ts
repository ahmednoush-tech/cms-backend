import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PORTAL_ONLY_KEY } from '../decorators/portal-only.decorator';
import { AuthContext } from '../interfaces/request-context.interface';

/**
 * Hard boundary, the mirror image of InternalOnlyGuard: if a route
 * is marked @PortalOnly(), an internal staff identity
 * (isCustomerUser !== true) is rejected outright — no role or
 * permission can override this, and having zero customer_users
 * rows is rejected the same as having none at all.
 */
@Injectable()
export class PortalOnlyGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPortalOnly = this.reflector.getAllAndOverride<boolean>(PORTAL_ONLY_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!isPortalOnly) return true;

    const request = context.switchToHttp().getRequest();
    const user: AuthContext = request.user;

    if (!user?.isCustomerUser || !user.customerId) {
      throw new ForbiddenException('This resource is only available to customer portal accounts.');
    }
    return true;
  }
}
