import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { PlatformAdminAuthContext } from '../platform-admin-context.interface';

export const CurrentPlatformAdmin = createParamDecorator(
  (data: keyof PlatformAdminAuthContext | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const admin: PlatformAdminAuthContext = request.user;
    return data ? admin?.[data] : admin;
  },
);
