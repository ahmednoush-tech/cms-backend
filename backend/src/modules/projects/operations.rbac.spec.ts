import { Reflector } from '@nestjs/core';
import { ProjectsController } from './projects.controller';
import { ProjectMembersController } from './project-members.controller';
import { PERMISSIONS_KEY } from '../../common/decorators/permissions.decorator';
import { INTERNAL_ONLY_KEY } from '../../common/decorators/internal-only.decorator';

/**
 * Same pattern as quotations.rbac.spec.ts (Phase 2C Part 2) —
 * guard *behavior* is already covered by permissions.guard.spec.ts
 * / internal-only.guard.spec.ts (Phase 2A). This proves each
 * Operations/Projects route declares the RIGHT permission string.
 */
describe('Projects & Project Members RBAC metadata', () => {
  const reflector = new Reflector();

  const projectPermissions: Record<string, string[]> = {
    create: ['Operations:projects:create'],
    findAll: ['Operations:projects:view'],
    findOne: ['Operations:projects:view'],
    update: ['Operations:projects:edit'],
    updateStatus: ['Operations:projects:edit'],
    assignManager: ['Operations:projects:assign'],
    remove: ['Operations:projects:delete'],
  };

  it.each(Object.entries(projectPermissions))('ProjectsController.%s requires %j', (method, expected) => {
    const permissions = reflector.get(PERMISSIONS_KEY, (ProjectsController.prototype as any)[method]);
    expect(permissions).toEqual(expected);
  });

  it('ProjectsController is marked @InternalOnly()', () => {
    expect(reflector.get(INTERNAL_ONLY_KEY, ProjectsController)).toBe(true);
  });

  const memberPermissions: Record<string, string[]> = {
    add: ['Operations:project_members:manage'],
    findAll: ['Operations:project_members:view'],
    updateRole: ['Operations:project_members:manage'],
    remove: ['Operations:project_members:manage'],
  };

  it.each(Object.entries(memberPermissions))('ProjectMembersController.%s requires %j', (method, expected) => {
    const permissions = reflector.get(PERMISSIONS_KEY, (ProjectMembersController.prototype as any)[method]);
    expect(permissions).toEqual(expected);
  });

  it('ProjectMembersController is marked @InternalOnly()', () => {
    expect(reflector.get(INTERNAL_ONLY_KEY, ProjectMembersController)).toBe(true);
  });
});
