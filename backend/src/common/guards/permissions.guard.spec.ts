import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionsGuard } from './permissions.guard';

function mockContext(user: any, requiredPermissions?: string[]) {
  const reflector = {
    getAllAndOverride: jest.fn().mockReturnValue(requiredPermissions),
  } as unknown as Reflector;

  const context = {
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;

  return { context, reflector };
}

describe('PermissionsGuard', () => {
  it('allows the request through when no permissions are declared', () => {
    const { context, reflector } = mockContext(
      { permissions: [] },
      undefined,
    );
    const guard = new PermissionsGuard(reflector);
    expect(guard.canActivate(context)).toBe(true);
  });

  it('allows the request when the user has every required permission', () => {
    const { context, reflector } = mockContext(
      { permissions: ['CRM:customers:view', 'CRM:customers:edit'] },
      ['CRM:customers:view'],
    );
    const guard = new PermissionsGuard(reflector);
    expect(guard.canActivate(context)).toBe(true);
  });

  it('throws ForbiddenException when a required permission is missing', () => {
    const { context, reflector } = mockContext(
      { permissions: ['CRM:customers:view'] },
      ['CRM:customers:delete'],
    );
    const guard = new PermissionsGuard(reflector);
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('rejects when there is no authenticated user at all', () => {
    const { context, reflector } = mockContext(undefined, ['CRM:customers:view']);
    const guard = new PermissionsGuard(reflector);
    expect(guard.canActivate(context)).toBe(false);
  });
});
