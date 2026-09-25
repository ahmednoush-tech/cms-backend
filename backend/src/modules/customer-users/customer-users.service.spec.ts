import { Test } from '@nestjs/testing';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CustomerUsersService } from './customer-users.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { CustomersService } from '../customers/customers.service';
import { ActivityLogService } from '../../common/services/activity-log.service';

/**
 * New in Phase 2F — this service had no unit spec at all before
 * this pass (identified as a gap in the V1 Final System Audit
 * §11). Also covers the P2 activity-logging fix from this same
 * phase (§1 of the Phase 2F instructions).
 */
describe('CustomerUsersService', () => {
  let service: CustomerUsersService;
  let prisma: any;
  let authService: any;
  let customersService: any;
  let activityLog: any;

  function mockTransaction(prismaMock: any) {
    return jest.fn((arg) => (typeof arg === 'function' ? arg(prismaMock) : Promise.all(arg)));
  }

  beforeEach(async () => {
    prisma = {
      user: { findUnique: jest.fn(), findFirst: jest.fn(), create: jest.fn() },
      customerContact: { findFirst: jest.fn() },
      customerUser: { create: jest.fn(), findMany: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
    };
    prisma.$transaction = mockTransaction(prisma);

    authService = { hashPassword: jest.fn().mockResolvedValue('hashed') };
    customersService = { assertCustomerBelongsToCompany: jest.fn() };
    activityLog = { record: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        CustomerUsersService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuthService, useValue: authService },
        { provide: CustomersService, useValue: customersService },
        { provide: ActivityLogService, useValue: activityLog },
      ],
    }).compile();

    service = moduleRef.get(CustomerUsersService);
  });

  describe('tenant isolation', () => {
    it('createPortalUser propagates a tenant-check failure before creating a user', async () => {
      customersService.assertCustomerBelongsToCompany.mockRejectedValue(new NotFoundException());
      await expect(
        service.createPortalUser('company-A', 'actor-1', 'cust-in-company-B', {
          name: 'X',
          email: 'x@example.com',
          password: 'password123',
        } as any),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.user.create).not.toHaveBeenCalled();
    });

    it('linkExistingUser rejects a userId outside the company scope', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      await expect(
        service.linkExistingUser('company-A', 'actor-1', 'cust-1', { userId: 'user-in-company-B' } as any),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.customerUser.create).not.toHaveBeenCalled();
    });
  });

  describe('duplicate prevention', () => {
    it('createPortalUser rejects an email that is already registered', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'existing-user' });
      await expect(
        service.createPortalUser('company-A', 'actor-1', 'cust-1', {
          name: 'X',
          email: 'taken@example.com',
          password: 'password123',
        } as any),
      ).rejects.toThrow(ConflictException);
    });

    it('linkExistingUser translates a DB unique-violation (already linked) into 409', async () => {
      prisma.user.findFirst.mockResolvedValue({ id: 'user-1', companyId: 'company-A' });
      const prismaError = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: 'test',
      });
      prisma.customerUser.create.mockRejectedValue(prismaError);

      await expect(
        service.linkExistingUser('company-A', 'actor-1', 'cust-1', { userId: 'user-1' } as any),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('activity logging', () => {
    it('logs portal user creation under entityType "customer"', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({ id: 'new-user-1' });
      prisma.customerUser.create.mockResolvedValue({ id: 'cu-1', userId: 'new-user-1' });

      await service.createPortalUser('company-A', 'actor-1', 'cust-1', {
        name: 'Portal Person',
        email: 'portal@example.com',
        password: 'password123',
      } as any);

      expect(activityLog.record).toHaveBeenCalledWith(
        expect.objectContaining({
          companyId: 'company-A',
          userId: 'actor-1',
          action: 'portal_user_created',
          entityType: 'customer',
          entityId: 'cust-1',
        }),
      );
    });

    it('logs linking an existing user', async () => {
      prisma.user.findFirst.mockResolvedValue({ id: 'user-1', companyId: 'company-A' });
      prisma.customerUser.create.mockResolvedValue({ id: 'cu-2', userId: 'user-1' });

      await service.linkExistingUser('company-A', 'actor-1', 'cust-1', { userId: 'user-1' } as any);

      expect(activityLog.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'portal_user_linked', entityType: 'customer', entityId: 'cust-1' }),
      );
    });

    it('logs revocation with old and new status', async () => {
      prisma.customerUser.findFirst.mockResolvedValue({ id: 'cu-1', userId: 'user-1', status: 'active' });
      prisma.customerUser.update.mockResolvedValue({ id: 'cu-1', status: 'inactive' });

      await service.revoke('company-A', 'actor-1', 'cust-1', 'cu-1');

      expect(activityLog.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'portal_user_revoked',
          entityType: 'customer',
          entityId: 'cust-1',
          oldValues: expect.objectContaining({ status: 'active' }),
          newValues: expect.objectContaining({ status: 'inactive' }),
        }),
      );
    });

    it('does not log on a plain read (findAll)', async () => {
      prisma.customerUser.findMany.mockResolvedValue([]);
      await service.findAll('company-A', 'cust-1');
      expect(activityLog.record).not.toHaveBeenCalled();
    });

    it('revoke on a non-existent link throws 404 and never logs', async () => {
      prisma.customerUser.findFirst.mockResolvedValue(null);
      await expect(service.revoke('company-A', 'actor-1', 'cust-1', 'cu-missing')).rejects.toThrow(
        NotFoundException,
      );
      expect(activityLog.record).not.toHaveBeenCalled();
    });
  });
});
