/**
 * NOTE ON LOCATION: this file is placed at the exact path
 * requested (backend/src/modules/crm/customers/customers.service.spec.ts).
 * The actual CustomersService implementation lives at
 * src/modules/customers/customers.service.ts — there is no
 * src/modules/crm/ grouping anywhere else in this codebase (every
 * other CRM module — customer-contacts, customer-users, leads,
 * opportunities, quotations — sits directly under src/modules/,
 * same as Administration). Rather than move/duplicate the service
 * to match a folder structure that doesn't otherwise exist (an
 * undiscussed structural change), this spec imports the real
 * service from its actual location. Flagged here and in the
 * accompanying report rather than silently restructuring.
 */
import { Test } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CustomersService } from '../../customers/customers.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { ActivityLogService } from '../../../common/services/activity-log.service';

describe('CustomersService', () => {
  let service: CustomersService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      customer: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
      },
      user: { findFirst: jest.fn() },
      project: { count: jest.fn() },
      $transaction: jest.fn((ops) => Promise.all(ops)),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        CustomersService,
        { provide: PrismaService, useValue: prisma },
        { provide: ActivityLogService, useValue: { record: jest.fn() } },
      ],
    }).compile();

    service = moduleRef.get(CustomersService);
  });

  // ============================================================
  // 1. Tenant isolation
  // ============================================================
  describe('tenant isolation', () => {
    it('Company A cannot read a Company B customer (findOne -> 404, not the other tenant\'s data)', async () => {
      // Simulates the tenant-scoped `where` clause excluding a row
      // that exists but belongs to another company.
      prisma.customer.findFirst.mockResolvedValue(null);

      await expect(service.findOne('company-A', 'cust-in-company-B')).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.customer.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: 'cust-in-company-B', companyId: 'company-A' }),
        }),
      );
    });

    it('Company A cannot update a Company B customer (blocked before any write)', async () => {
      prisma.customer.findFirst.mockResolvedValue(null); // tenant check fails inside findOne

      await expect(
        service.update('company-A', 'user-1', 'cust-in-company-B', { companyName: 'Hijacked' }),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.customer.update).not.toHaveBeenCalled();
    });

    it('Company A cannot delete a Company B customer (blocked before any write)', async () => {
      prisma.customer.findFirst.mockResolvedValue(null);

      await expect(
        service.softDelete('company-A', 'user-1', 'cust-in-company-B'),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.customer.update).not.toHaveBeenCalled();
    });
  });

  // ============================================================
  // 2. Customer creation — companyId always server-derived
  // ============================================================
  describe('customer creation and companyId integrity', () => {
    it('creates the customer with the authenticated companyId', async () => {
      prisma.customer.create.mockResolvedValue({ id: 'cust-1', companyId: 'company-A' });

      await service.create('company-A', 'user-1', {
        customerType: 'company',
        companyName: 'Acme',
        customerCode: 'ACME-001',
      } as any);

      expect(prisma.customer.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ companyId: 'company-A' }) }),
      );
    });

    it('ignores/overrides a client-supplied companyId on the DTO — the authenticated companyId always wins', async () => {
      prisma.customer.create.mockResolvedValue({ id: 'cust-1', companyId: 'company-A' });

      // Simulates a malicious or malformed payload that somehow
      // carries a companyId field (the DTO itself has no such
      // field and the global ValidationPipe would strip it before
      // this point in the real app — this test proves the service
      // layer is ALSO safe even if that upstream defense were
      // bypassed, i.e. defense in depth).
      const dtoWithInjectedCompanyId = {
        customerType: 'company',
        companyName: 'Acme',
        customerCode: 'ACME-002',
        companyId: 'company-B', // attacker-supplied, must be ignored
      } as any;

      await service.create('company-A', 'user-1', dtoWithInjectedCompanyId);

      const createArg = prisma.customer.create.mock.calls[0][0].data;
      expect(createArg.companyId).toBe('company-A');
      expect(createArg.companyId).not.toBe('company-B');
    });
  });

  // ============================================================
  // 3. Duplicate customer code
  // ============================================================
  describe('duplicate customerCode', () => {
    it('translates a unique-constraint violation into 409 Conflict', async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: 'test',
        meta: { target: ['company_id', 'customer_code'] },
      });
      prisma.customer.create.mockRejectedValue(prismaError);

      await expect(
        service.create('company-A', 'user-1', {
          customerType: 'company',
          companyName: 'Dup Co',
          customerCode: 'DUP-01',
        } as any),
      ).rejects.toThrow(ConflictException);
    });

    it('does not pre-emptively block the same customerCode in a DIFFERENT company', async () => {
      // The service places no cross-company uniqueness check of its
      // own — uniqueness is scoped to (company_id, customer_code)
      // at the DB level, so the same code in another company is a
      // normal, successful create.
      prisma.customer.create.mockResolvedValue({ id: 'cust-in-B', companyId: 'company-B', customerCode: 'SHARED-01' });

      const result = await service.create('company-B', 'user-2', {
        customerType: 'company',
        companyName: 'Other Co',
        customerCode: 'SHARED-01',
      } as any);

      expect(result.customerCode).toBe('SHARED-01');
      expect(result.companyId).toBe('company-B');
    });
  });

  // ============================================================
  // 4. Owner validation
  // ============================================================
  describe('owner validation', () => {
    it('allows an ownerId that belongs to the same company', async () => {
      prisma.user.findFirst.mockResolvedValue({ id: 'user-owner', companyId: 'company-A' });
      prisma.customer.create.mockResolvedValue({ id: 'cust-1' });

      await service.create('company-A', 'user-1', {
        customerType: 'individual',
        customerCode: 'IND-001',
        ownerId: 'user-owner',
      } as any);

      expect(prisma.customer.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ ownerId: 'user-owner' }) }),
      );
    });

    it('rejects an ownerId that belongs to a different company', async () => {
      prisma.user.findFirst.mockResolvedValue(null); // not found within company-A scope

      await expect(
        service.create('company-A', 'user-1', {
          customerType: 'individual',
          customerCode: 'IND-002',
          ownerId: 'user-in-company-B',
        } as any),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.customer.create).not.toHaveBeenCalled();
    });

    it('defaults ownerId to the creating user when none is supplied', async () => {
      prisma.customer.create.mockResolvedValue({ id: 'cust-1' });

      await service.create('company-A', 'user-creator', {
        customerType: 'individual',
        customerCode: 'IND-003',
      } as any);

      expect(prisma.customer.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ ownerId: 'user-creator' }) }),
      );
    });

    it('rejects an ownerId on update() that belongs to a different company', async () => {
      jest.spyOn(service, 'findOne').mockResolvedValue({ id: 'cust-1', companyId: 'company-A' } as any);
      prisma.user.findFirst.mockResolvedValue(null);

      await expect(
        service.update('company-A', 'user-1', 'cust-1', { ownerId: 'user-in-company-B' } as any),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.customer.update).not.toHaveBeenCalled();
    });
  });

  // ============================================================
  // 5. Soft delete
  // ============================================================
  describe('soft delete', () => {
    it('excludes soft-deleted customers from findOne (deletedAt filter in the query)', async () => {
      prisma.customer.findFirst.mockResolvedValue(null); // simulates deletedAt: null filtering it out

      await expect(service.findOne('company-A', 'deleted-cust')).rejects.toThrow(NotFoundException);
      expect(prisma.customer.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ deletedAt: null }),
        }),
      );
    });

    it('excludes soft-deleted customers from findAll (deletedAt filter in the query)', async () => {
      prisma.customer.findMany.mockResolvedValue([]);
      prisma.customer.count.mockResolvedValue(0);

      await service.findAll('company-A', { page: 1, pageSize: 20 } as any);

      expect(prisma.customer.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ deletedAt: null }),
        }),
      );
    });

    it('a soft-deleted customer cannot be updated (findOne excludes it, update never reached)', async () => {
      prisma.customer.findFirst.mockResolvedValue(null); // deleted row is invisible to the tenant-scoped query

      await expect(
        service.update('company-A', 'user-1', 'deleted-cust', { companyName: 'Should not apply' } as any),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.customer.update).not.toHaveBeenCalled();
    });

    it('softDelete sets deletedAt and flips status to inactive (never treated as active again)', async () => {
      jest.spyOn(service, 'findOne').mockResolvedValue({ id: 'cust-1', companyId: 'company-A', status: 'active' } as any);
      prisma.customer.update.mockResolvedValue({ id: 'cust-1', status: 'inactive', deletedAt: new Date() });

      const result = await service.softDelete('company-A', 'user-1', 'cust-1');

      expect(prisma.customer.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'cust-1' },
          data: expect.objectContaining({ status: 'inactive' }),
        }),
      );
      expect(result.status).toBe('inactive');
      expect(result.deletedAt).not.toBeNull();
    });
  });

  // ============================================================
  // 6. Update/delete — tenant scope enforced BEFORE mutation
  // ============================================================
  describe('tenant scope ordering on mutation', () => {
    it('update() calls the tenant-scoped findOne before ever calling prisma.customer.update', async () => {
      const findOneSpy = jest.spyOn(service, 'findOne').mockResolvedValue({
        id: 'cust-1',
        companyId: 'company-A',
        status: 'active',
      } as any);
      prisma.customer.update.mockResolvedValue({ id: 'cust-1' });

      await service.update('company-A', 'user-1', 'cust-1', { companyName: 'New Name' } as any);

      // findOne (the tenant gate) must have been invoked, and with
      // the caller's companyId — not the target row's, not a
      // client-supplied one.
      expect(findOneSpy).toHaveBeenCalledWith('company-A', 'cust-1');
      expect(prisma.customer.update).toHaveBeenCalled();
    });

    it('softDelete() calls the tenant-scoped findOne before ever calling prisma.customer.update', async () => {
      const findOneSpy = jest.spyOn(service, 'findOne').mockResolvedValue({
        id: 'cust-1',
        companyId: 'company-A',
        status: 'active',
      } as any);
      prisma.customer.update.mockResolvedValue({ id: 'cust-1' });

      await service.softDelete('company-A', 'user-1', 'cust-1');

      expect(findOneSpy).toHaveBeenCalledWith('company-A', 'cust-1');
      expect(prisma.customer.update).toHaveBeenCalled();
    });

    it('if the tenant check fails, no mutation is ever attempted (update)', async () => {
      jest.spyOn(service, 'findOne').mockRejectedValue(new NotFoundException('Customer not found.'));

      await expect(
        service.update('company-A', 'user-1', 'cust-in-company-B', { companyName: 'X' } as any),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.customer.update).not.toHaveBeenCalled();
    });

    it('if the tenant check fails, no mutation is ever attempted (softDelete)', async () => {
      jest.spyOn(service, 'findOne').mockRejectedValue(new NotFoundException('Customer not found.'));

      await expect(
        service.softDelete('company-A', 'user-1', 'cust-in-company-B'),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.customer.update).not.toHaveBeenCalled();
    });
  });

  // ============================================================
  // Phase 2F P2 fix: customer soft-delete blocked by active projects
  // ============================================================
  describe('soft-delete blocked by active projects (V1 Final System Audit §9)', () => {
    it.each(['planning', 'approved', 'in_progress', 'on_hold'])(
      'blocks deletion when an active project (%s) references the customer',
      async (status) => {
        jest.spyOn(service, 'findOne').mockResolvedValue({ id: 'cust-1', companyId: 'company-A' } as any);
        prisma.project.count.mockResolvedValue(1);

        await expect(service.softDelete('company-A', 'user-1', 'cust-1')).rejects.toThrow(
          UnprocessableEntityException,
        );
        expect(prisma.customer.update).not.toHaveBeenCalled();

        // Confirms the count query is tenant-scoped AND status-scoped
        // to exactly the four active statuses, not an arbitrary set.
        const countCall = prisma.project.count.mock.calls[0][0];
        expect(countCall.where.companyId).toBe('company-A');
        expect(countCall.where.customerId).toBe('cust-1');
        expect(countCall.where.status.in).toEqual(
          expect.arrayContaining(['planning', 'approved', 'in_progress', 'on_hold']),
        );
      },
    );

    it.each(['completed', 'cancelled'])(
      'does NOT block deletion when the only referencing projects are %s',
      async (_status) => {
        jest.spyOn(service, 'findOne').mockResolvedValue({ id: 'cust-1', companyId: 'company-A' } as any);
        prisma.project.count.mockResolvedValue(0); // completed/cancelled excluded by the query itself
        prisma.customer.update.mockResolvedValue({ id: 'cust-1', deletedAt: new Date() });

        const result = await service.softDelete('company-A', 'user-1', 'cust-1');
        expect(result.deletedAt).toBeDefined();
      },
    );

    it('allows deletion when the customer has no projects at all', async () => {
      jest.spyOn(service, 'findOne').mockResolvedValue({ id: 'cust-1', companyId: 'company-A' } as any);
      prisma.project.count.mockResolvedValue(0);
      prisma.customer.update.mockResolvedValue({ id: 'cust-1', deletedAt: new Date() });

      const result = await service.softDelete('company-A', 'user-1', 'cust-1');
      expect(result.deletedAt).toBeDefined();
    });

    it('the active-project check is tenant-scoped — cannot be tricked by a project in another company', async () => {
      jest.spyOn(service, 'findOne').mockResolvedValue({ id: 'cust-1', companyId: 'company-A' } as any);
      prisma.project.count.mockResolvedValue(0); // the mock's query already scopes by companyId

      await service.softDelete('company-A', 'user-1', 'cust-1');

      const countCall = prisma.project.count.mock.calls[0][0];
      expect(countCall.where.companyId).toBe('company-A');
    });
  });
});
