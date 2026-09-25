import { Reflector } from '@nestjs/core';
import { WorkOrdersController } from './work-orders.controller';
import { PERMISSIONS_KEY } from '../../common/decorators/permissions.decorator';
import { INTERNAL_ONLY_KEY } from '../../common/decorators/internal-only.decorator';

describe('WorkOrdersController RBAC metadata', () => {
  const reflector = new Reflector();

  const expected: Record<string, string[]> = {
    create: ['Operations:work_orders:create'],
    findAll: ['Operations:work_orders:view'],
    findOne: ['Operations:work_orders:view'],
    update: ['Operations:work_orders:edit'],
    updateStatus: ['Operations:work_orders:edit'],
    assign: ['Operations:work_orders:assign'],
    remove: ['Operations:work_orders:delete'],
  };

  it.each(Object.entries(expected))('WorkOrdersController.%s requires %j', (method, perms) => {
    const permissions = reflector.get(PERMISSIONS_KEY, (WorkOrdersController.prototype as any)[method]);
    expect(permissions).toEqual(perms);
  });

  it('WorkOrdersController is marked @InternalOnly()', () => {
    expect(reflector.get(INTERNAL_ONLY_KEY, WorkOrdersController)).toBe(true);
  });
});
