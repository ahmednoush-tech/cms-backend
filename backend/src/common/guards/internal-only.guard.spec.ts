import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InternalOnlyGuard } from './internal-only.guard';

function mockContext(user: any, isInternalOnly: boolean) {
  const reflector = {
    getAllAndOverride: jest.fn().mockReturnValue(isInternalOnly),
  } as unknown as Reflector;

  const context = {
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;

  return { context, reflector };
}

describe('InternalOnlyGuard', () => {
  it('allows a customer user through when the route is not marked internal-only', () => {
    const { context, reflector } = mockContext(
      { isCustomerUser: true },
      false,
    );
    const guard = new InternalOnlyGuard(reflector);
    expect(guard.canActivate(context)).toBe(true);
  });

  it('allows an internal (employee) user through an internal-only route', () => {
    const { context, reflector } = mockContext(
      { isCustomerUser: false },
      true,
    );
    const guard = new InternalOnlyGuard(reflector);
    expect(guard.canActivate(context)).toBe(true);
  });

  it('blocks a customer user from an internal-only route regardless of permissions', () => {
    const { context, reflector } = mockContext(
      { isCustomerUser: true, permissions: ['Administration:users:view'] },
      true,
    );
    const guard = new InternalOnlyGuard(reflector);
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });
});
