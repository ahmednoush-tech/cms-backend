import { Test } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { RolesService } from './roles.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ActivityLogService } from '../../common/services/activity-log.service';
import { ScopeValidationService } from '../../common/services/scope-validation.service';

/**
 * Focused on the audit-logging wiring added this session: a real
 * gap was found where assigning permissions to a role, assigning
 * a role to a user, and removing a role from a user were NEVER
 * recorded anywhere — LoggableEntityType already had 'role' and
 * 'user' defined, but nothing in this service ever called
 * ActivityLogService.record(). No spec file existed for this
 * service before; this one is deliberately narrow to the new
 * behavior rather than a full rewrite of untested coverage.
 */
describe('RolesService', () => {
  let service: RolesService;
  let prisma: any;
  let activityLog: { record: jest.Mock };

  beforeEach(async () => {
    prisma = {
      role: { findFirst: jest.fn() },
      user: { findFirst: jest.fn() },
      department: { findFirst: jest.fn() },
      rolePermission: { upsert: jest.fn() },
      userRole: { upsert: jest.fn(), delete: jest.fn() },
      $transaction: jest.fn((ops) => Promise.all(ops)),
    };
    activityLog = { record: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        RolesService,
        { provide: PrismaService, useValue: prisma },
        { provide: ActivityLogService, useValue: activityLog },
        // Real instance (not a mock) sharing the same mocked
        // prisma — this is what actually calls
        // prisma.department.findFirst under the hood, which the
        // scope-specific tests below assert against directly.
        { provide: ScopeValidationService, useValue: new ScopeValidationService(prisma) },
      ],
    }).compile();

    service = moduleRef.get(RolesService);
  });

  describe('assignPermissions', () => {
    it('records an audit entry against the role after granting permissions', async () => {
      prisma.role.findFirst.mockResolvedValue({
        id: 'role-1',
        companyId: 'company-1',
        rolePermissions: [],
        userRoles: [],
      });

      await service.assignPermissions('company-1', 'role-1', { permissionIds: ['perm-1', 'perm-2'] }, 'actor-1');

      expect(activityLog.record).toHaveBeenCalledWith(
        expect.objectContaining({
          companyId: 'company-1',
          userId: 'actor-1',
          action: 'permissions_assigned',
          entityType: 'role',
          entityId: 'role-1',
          newValues: { permissionIds: ['perm-1', 'perm-2'] },
        }),
      );
    });
  });

  describe('assignRoleToUser', () => {
    it('records an audit entry against the USER (not the role) after assignment', async () => {
      prisma.user.findFirst.mockResolvedValue({ id: 'user-1', companyId: 'company-1' });
      prisma.role.findFirst.mockResolvedValue({ id: 'role-1', companyId: 'company-1', name: 'Sales' });
      prisma.userRole.upsert.mockResolvedValue({ userId: 'user-1', roleId: 'role-1' });

      await service.assignRoleToUser('company-1', { userId: 'user-1', roleId: 'role-1' }, 'actor-1');

      expect(activityLog.record).toHaveBeenCalledWith(
        expect.objectContaining({
          companyId: 'company-1',
          userId: 'actor-1',
          action: 'role_assigned',
          entityType: 'user',
          entityId: 'user-1',
          newValues: { roleId: 'role-1', roleName: 'Sales', scopeType: 'company', scopeId: '00000000-0000-0000-0000-000000000000' },
        }),
      );
    });

    it('does not log anything if the role does not exist in this company', async () => {
      prisma.user.findFirst.mockResolvedValue({ id: 'user-1', companyId: 'company-1' });
      prisma.role.findFirst.mockResolvedValue(null);

      await expect(
        service.assignRoleToUser('company-1', { userId: 'user-1', roleId: 'role-x' }, 'actor-1'),
      ).rejects.toThrow(NotFoundException);
      expect(activityLog.record).not.toHaveBeenCalled();
    });

    it('scopes a role assignment to a department that genuinely exists in this company', async () => {
      prisma.user.findFirst.mockResolvedValue({ id: 'user-1', companyId: 'company-1' });
      prisma.role.findFirst.mockResolvedValue({ id: 'role-1', companyId: 'company-1', name: 'Employees Manager' });
      prisma.department.findFirst.mockResolvedValue({ id: 'dept-1', companyId: 'company-1' });
      prisma.userRole.upsert.mockResolvedValue({ userId: 'user-1', roleId: 'role-1', scopeId: 'dept-1' });

      await service.assignRoleToUser(
        'company-1',
        { userId: 'user-1', roleId: 'role-1', scopeType: 'department', scopeId: 'dept-1' },
        'actor-1',
      );

      expect(prisma.department.findFirst).toHaveBeenCalledWith({ where: { id: 'dept-1', companyId: 'company-1' } });
      expect(prisma.userRole.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId_roleId_scopeId: { userId: 'user-1', roleId: 'role-1', scopeId: 'dept-1' } },
          create: { userId: 'user-1', roleId: 'role-1', scopeType: 'department', scopeId: 'dept-1' },
        }),
      );
      expect(activityLog.record).toHaveBeenCalledWith(
        expect.objectContaining({
          newValues: { roleId: 'role-1', roleName: 'Employees Manager', scopeType: 'department', scopeId: 'dept-1' },
        }),
      );
    });

    it('refuses to scope a role to a department from a different company (or that does not exist at all)', async () => {
      prisma.user.findFirst.mockResolvedValue({ id: 'user-1', companyId: 'company-1' });
      prisma.role.findFirst.mockResolvedValue({ id: 'role-1', companyId: 'company-1', name: 'Employees Manager' });
      prisma.department.findFirst.mockResolvedValue(null);

      await expect(
        service.assignRoleToUser(
          'company-1',
          { userId: 'user-1', roleId: 'role-1', scopeType: 'department', scopeId: 'dept-from-company-B' },
          'actor-1',
        ),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.userRole.upsert).not.toHaveBeenCalled();
      expect(activityLog.record).not.toHaveBeenCalled();
    });

    it('rejects an unsupported scope type outright, before touching the database', async () => {
      prisma.user.findFirst.mockResolvedValue({ id: 'user-1', companyId: 'company-1' });
      prisma.role.findFirst.mockResolvedValue({ id: 'role-1', companyId: 'company-1', name: 'X' });

      await expect(
        service.assignRoleToUser(
          'company-1',
          { userId: 'user-1', roleId: 'role-1', scopeType: 'warehouse', scopeId: 'wh-1' },
          'actor-1',
        ),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.department.findFirst).not.toHaveBeenCalled();
    });
  });

  describe('removeRoleFromUser', () => {
    it('records an audit entry with the removed role in oldValues', async () => {
      prisma.role.findFirst.mockResolvedValue({ id: 'role-1', companyId: 'company-1', name: 'Sales' });
      prisma.userRole.delete.mockResolvedValue({ userId: 'user-1', roleId: 'role-1' });

      await service.removeRoleFromUser('company-1', 'user-1', 'role-1', 'actor-1');

      expect(activityLog.record).toHaveBeenCalledWith(
        expect.objectContaining({
          companyId: 'company-1',
          userId: 'actor-1',
          action: 'role_removed',
          entityType: 'user',
          entityId: 'user-1',
          oldValues: { roleId: 'role-1', roleName: 'Sales', scopeId: '00000000-0000-0000-0000-000000000000' },
        }),
      );
    });

    it('removes only the SPECIFIC scoped grant when scopeId is given, leaving other scopes of the same role untouched', async () => {
      prisma.role.findFirst.mockResolvedValue({ id: 'role-1', companyId: 'company-1', name: 'Employees Manager' });
      prisma.userRole.delete.mockResolvedValue({ userId: 'user-1', roleId: 'role-1', scopeId: 'dept-1' });

      await service.removeRoleFromUser('company-1', 'user-1', 'role-1', 'actor-1', 'dept-1');

      expect(prisma.userRole.delete).toHaveBeenCalledWith({
        where: { userId_roleId_scopeId: { userId: 'user-1', roleId: 'role-1', scopeId: 'dept-1' } },
      });
      expect(activityLog.record).toHaveBeenCalledWith(
        expect.objectContaining({ oldValues: { roleId: 'role-1', roleName: 'Employees Manager', scopeId: 'dept-1' } }),
      );
    });
  });
});
