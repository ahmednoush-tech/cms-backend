import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { INTERNAL_ONLY_KEY } from '../decorators/internal-only.decorator';
import { AuthContext } from '../interfaces/request-context.interface';

/**
 * Hard boundary: if a route is marked @InternalOnly(), a
 * customer-portal identity (isCustomerUser === true) is
 * rejected outright — no role or permission can override this.
 *
 * This exists because the approved security model explicitly
 * requires customer isolation to NOT rely solely on RBAC.
 * Administration routes, and any Operations/CRM route exposing
 * internal-only data, carry this decorator.
 */
@Injectable()
export class InternalOnlyGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isInternalOnly = this.reflector.getAllAndOverride<boolean>(
      INTERNAL_ONLY_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!isInternalOnly) return true;

    const request = context.switchToHttp().getRequest();
    const user: AuthContext = request.user;

    if (user?.isCustomerUser) {
      throw new ForbiddenException(
        'Customer portal accounts cannot access internal resources.',
      );
    }
    return true;
  }
}
