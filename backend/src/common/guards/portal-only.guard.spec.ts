import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PortalOnlyGuard } from './portal-only.guard';

function mockContext(user: any, isPortalOnly: boolean) {
  const reflector = {
    getAllAndOverride: jest.fn().mockReturnValue(isPortalOnly),
  } as unknown as Reflector;

  const context = {
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;

  return { context, reflector };
}

describe('PortalOnlyGuard', () => {
  it('allows an internal (employee) user through when the route is not marked portal-only', () => {
    const { context, reflector } = mockContext({ isCustomerUser: false }, false);
    const guard = new PortalOnlyGuard(reflector);
    expect(guard.canActivate(context)).toBe(true);
  });

  it('allows a customer portal user through a portal-only route', () => {
    const { context, reflector } = mockContext({ isCustomerUser: true, customerId: 'cust-1' }, true);
    const guard = new PortalOnlyGuard(reflector);
    expect(guard.canActivate(context)).toBe(true);
  });

  it('blocks an internal (employee) user from a portal-only route regardless of permissions', () => {
    const { context, reflector } = mockContext(
      { isCustomerUser: false, permissions: ['Administration:users:view'] },
      true,
    );
    const guard = new PortalOnlyGuard(reflector);
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('blocks a request with isCustomerUser=true but no customerId (defensive)', () => {
    const { context, reflector } = mockContext({ isCustomerUser: true, customerId: undefined }, true);
    const guard = new PortalOnlyGuard(reflector);
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });
});
