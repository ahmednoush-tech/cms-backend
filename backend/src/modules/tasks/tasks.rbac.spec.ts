import { Reflector } from '@nestjs/core';
import { TasksController } from './tasks.controller';
import { PERMISSIONS_KEY } from '../../common/decorators/permissions.decorator';
import { INTERNAL_ONLY_KEY } from '../../common/decorators/internal-only.decorator';

describe('TasksController RBAC metadata', () => {
  const reflector = new Reflector();

  const expected: Record<string, string[]> = {
    create: ['Operations:tasks:create'],
    findAll: ['Operations:tasks:view'],
    findOne: ['Operations:tasks:view'],
    update: ['Operations:tasks:edit'],
    updateStatus: ['Operations:tasks:edit'],
    assign: ['Operations:tasks:assign'],
    remove: ['Operations:tasks:delete'],
  };

  it.each(Object.entries(expected))('TasksController.%s requires %j', (method, perms) => {
    const permissions = reflector.get(PERMISSIONS_KEY, (TasksController.prototype as any)[method]);
    expect(permissions).toEqual(perms);
  });

  it('TasksController is marked @InternalOnly()', () => {
    expect(reflector.get(INTERNAL_ONLY_KEY, TasksController)).toBe(true);
  });
});
