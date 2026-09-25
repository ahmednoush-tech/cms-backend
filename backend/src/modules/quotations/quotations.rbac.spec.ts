import { Reflector } from '@nestjs/core';
import { QuotationsController } from './quotations.controller';
import { QuotationItemsController } from './quotation-items.controller';
import { PERMISSIONS_KEY } from '../../common/decorators/permissions.decorator';
import { INTERNAL_ONLY_KEY } from '../../common/decorators/internal-only.decorator';

/**
 * Guard *behavior* (allow/deny given a permission set) is already
 * covered by src/common/guards/permissions.guard.spec.ts and
 * internal-only.guard.spec.ts from Phase 2A/2B — this file instead
 * proves each quotation endpoint declares the RIGHT permission
 * string, so a future refactor can't silently drop or rename one
 * without a test catching it.
 */
describe('Quotations RBAC metadata', () => {
  const reflector = new Reflector();

  const expectedControllerPermissions: Record<string, string[]> = {
    create: ['CRM:quotations:create'],
    findAll: ['CRM:quotations:view'],
    findOne: ['CRM:quotations:view'],
    update: ['CRM:quotations:edit'],
    remove: ['CRM:quotations:delete'],
    send: ['CRM:quotations:send'],
    accept: ['CRM:quotations:accept'],
    reject: ['CRM:quotations:reject'],
    expire: ['CRM:quotations:edit'],
  };

  it.each(Object.entries(expectedControllerPermissions))(
    'QuotationsController.%s requires %j',
    (methodName, expected) => {
      const permissions = reflector.get(PERMISSIONS_KEY, (QuotationsController.prototype as any)[methodName]);
      expect(permissions).toEqual(expected);
    },
  );

  it('QuotationsController is marked @InternalOnly()', () => {
    const isInternal = reflector.get(INTERNAL_ONLY_KEY, QuotationsController);
    expect(isInternal).toBe(true);
  });

  const expectedItemPermissions: Record<string, string[]> = {
    create: ['CRM:quotations:edit'],
    update: ['CRM:quotations:edit'],
    remove: ['CRM:quotations:edit'],
  };

  it.each(Object.entries(expectedItemPermissions))(
    'QuotationItemsController.%s requires %j',
    (methodName, expected) => {
      const permissions = reflector.get(PERMISSIONS_KEY, (QuotationItemsController.prototype as any)[methodName]);
      expect(permissions).toEqual(expected);
    },
  );

  it('QuotationItemsController is marked @InternalOnly()', () => {
    const isInternal = reflector.get(INTERNAL_ONLY_KEY, QuotationItemsController);
    expect(isInternal).toBe(true);
  });
});
