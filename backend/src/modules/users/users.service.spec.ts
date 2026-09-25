import { Test } from '@nestjs/testing';
import { UnprocessableEntityException, NotFoundException } from '@nestjs/common';
import { UsersService } from './users.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { ActivityLogService } from '../../common/services/activity-log.service';
import { ScopeValidationService } from '../../common/services/scope-validation.service';

/**
 * Focused on softDelete()'s self-deletion guard, added this
 * session after a real gap was found: nothing previously stopped
 * a user from deleting their own account mid-session, which would
 * end that very request's own authorization with no way back in
 * short of another admin's intervention. No spec file existed for
 * this service before — this one is deliberately narrow rather
 * than a full rewrite of untested coverage for every method.
 * Direct permission grant/revoke tests were added in the same
 * session that introduced them — see the describe block below.
 */
describe('UsersService', () => {
  let service: UsersService;
  let prisma: any;
  let activityLog: { record: jest.Mock };

  beforeEach(async () => {
    prisma = {
      user: {
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      permission: { findFirst: jest.fn() },
      department: { findFirst: jest.fn() },
      userPermission: { upsert: jest.fn(), delete: jest.fn() },
    };
    activityLog = { record: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuthService, useValue: { hashPassword: jest.fn() } },
        { provide: ActivityLogService, useValue: activityLog },
        { provide: ScopeValidationService, useValue: new ScopeValidationService(prisma) },
      ],
    }).compile();

    service = moduleRef.get(UsersService);
  });

  describe('softDelete', () => {
    it('refuses to delete the account performing the deletion', async () => {
      await expect(service.softDelete('company-1', 'user-1', 'user-1')).rejects.toThrow(
        UnprocessableEntityException,
      );
      // The guard fires before any database access — a self-delete
      // attempt should never even reach prisma.user.findFirst.
      expect(prisma.user.findFirst).not.toHaveBeenCalled();
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('deletes a different user in the same company', async () => {
      prisma.user.findFirst.mockResolvedValue({ id: 'user-2', companyId: 'company-1' });
      prisma.user.update.mockResolvedValue({ id: 'user-2', companyId: 'company-1' });

      await service.softDelete('company-1', 'user-1', 'user-2');

      // This is the actual proof the deletion happened — safeSelect()
      // deliberately never returns deletedAt to a client (same reason
      // it never returns passwordHash), so the resolved result has no
      // such field to assert on; the data actually written to the
      // database is what matters here.
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'user-2' }, data: { deletedAt: expect.any(Date) } }),
      );
    });

    it('still enforces tenant isolation for a different user (findOne 404s outside the guard)', async () => {
      prisma.user.findFirst.mockResolvedValue(null);

      await expect(service.softDelete('company-1', 'user-1', 'user-in-company-B')).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.user.update).not.toHaveBeenCalled();
    });
  });

  describe('grantPermission / revokePermission (direct per-user grants)', () => {
    it('grants an unscoped permission and records an audit entry', async () => {
      prisma.user.findFirst.mockResolvedValue({ id: 'user-1', companyId: 'company-1' });
      prisma.permission.findFirst.mockResolvedValue({ id: 'perm-1', module: 'Finance', resource: 'invoices', action: 'view' });
      prisma.userPermission.upsert.mockResolvedValue({ userId: 'user-1', permissionId: 'perm-1' });

      await service.grantPermission('company-1', 'user-1', { permissionId: 'perm-1' }, 'actor-1');

      expect(prisma.userPermission.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId_permissionId_scopeId: { userId: 'user-1', permissionId: 'perm-1', scopeId: '00000000-0000-0000-0000-000000000000' } },
          create: { userId: 'user-1', permissionId: 'perm-1', scopeType: 'company', scopeId: '00000000-0000-0000-0000-000000000000' },
        }),
      );
      expect(activityLog.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'permission_granted',
          entityType: 'user',
          entityId: 'user-1',
          newValues: expect.objectContaining({ permissionString: 'Finance:invoices:view' }),
        }),
      );
    });

    it('grants a permission scoped to a real department in the same company', async () => {
      prisma.user.findFirst.mockResolvedValue({ id: 'user-1', companyId: 'company-1' });
      prisma.permission.findFirst.mockResolvedValue({ id: 'perm-1', module: 'Administration', resource: 'employees', action: 'view' });
      prisma.department.findFirst.mockResolvedValue({ id: 'dept-1', companyId: 'company-1' });
      prisma.userPermission.upsert.mockResolvedValue({ userId: 'user-1', permissionId: 'perm-1', scopeId: 'dept-1' });

      await service.grantPermission(
        'company-1',
        'user-1',
        { permissionId: 'perm-1', scopeType: 'department', scopeId: 'dept-1' },
        'actor-1',
      );

      expect(prisma.department.findFirst).toHaveBeenCalledWith({ where: { id: 'dept-1', companyId: 'company-1' } });
      expect(prisma.userPermission.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: { userId: 'user-1', permissionId: 'perm-1', scopeType: 'department', scopeId: 'dept-1' },
        }),
      );
    });

    it('refuses to grant a permission scoped to a department from a different company', async () => {
      prisma.user.findFirst.mockResolvedValue({ id: 'user-1', companyId: 'company-1' });
      prisma.permission.findFirst.mockResolvedValue({ id: 'perm-1', module: 'Administration', resource: 'employees', action: 'view' });
      prisma.department.findFirst.mockResolvedValue(null);

      await expect(
        service.grantPermission(
          'company-1',
          'user-1',
          { permissionId: 'perm-1', scopeType: 'department', scopeId: 'dept-from-company-B' },
          'actor-1',
        ),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.userPermission.upsert).not.toHaveBeenCalled();
    });

    it('404s if the permission itself does not exist', async () => {
      prisma.user.findFirst.mockResolvedValue({ id: 'user-1', companyId: 'company-1' });
      prisma.permission.findFirst.mockResolvedValue(null);

      await expect(
        service.grantPermission('company-1', 'user-1', { permissionId: 'perm-nonexistent' }, 'actor-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('revokes the unscoped grant by default and records an audit entry', async () => {
      prisma.permission.findFirst.mockResolvedValue({ id: 'perm-1', module: 'Finance', resource: 'invoices', action: 'view' });
      prisma.userPermission.delete.mockResolvedValue({ userId: 'user-1', permissionId: 'perm-1' });

      await service.revokePermission('company-1', 'user-1', 'perm-1', 'actor-1');

      expect(prisma.userPermission.delete).toHaveBeenCalledWith({
        where: { userId_permissionId_scopeId: { userId: 'user-1', permissionId: 'perm-1', scopeId: '00000000-0000-0000-0000-000000000000' } },
      });
      expect(activityLog.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'permission_revoked', entityId: 'user-1' }),
      );
    });

    it('revokes only the SPECIFIC scoped grant when scopeId is given', async () => {
      prisma.permission.findFirst.mockResolvedValue({ id: 'perm-1', module: 'Administration', resource: 'employees', action: 'view' });
      prisma.userPermission.delete.mockResolvedValue({ userId: 'user-1', permissionId: 'perm-1', scopeId: 'dept-1' });

      await service.revokePermission('company-1', 'user-1', 'perm-1', 'actor-1', 'dept-1');

      expect(prisma.userPermission.delete).toHaveBeenCalledWith({
        where: { userId_permissionId_scopeId: { userId: 'user-1', permissionId: 'perm-1', scopeId: 'dept-1' } },
      });
    });
  });
});
