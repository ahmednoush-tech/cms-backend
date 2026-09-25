import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthContext } from '../interfaces/request-context.interface';

/**
 * Injects the authenticated AuthContext into a controller method.
 *
 * Usage:
 *   findAll(@CurrentUser() user: AuthContext) {
 *     return this.service.findAllForCompany(user.companyId);
 *   }
 *
 * Optionally pull a single field:
 *   findAll(@CurrentUser('companyId') companyId: string) { ... }
 */
export const CurrentUser = createParamDecorator(
  (field: keyof AuthContext | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user: AuthContext = request.user;
    return field ? user?.[field] : user;
  },
);
