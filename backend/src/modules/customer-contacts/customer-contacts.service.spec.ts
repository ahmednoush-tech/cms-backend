import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { CustomerContactsService } from './customer-contacts.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CustomersService } from '../customers/customers.service';
import { ActivityLogService } from '../../common/services/activity-log.service';

/**
 * New in Phase 2F — this service had no unit spec at all before
 * this pass (identified as a gap in the V1 Final System Audit
 * §11). Also covers the P2 activity-logging fix from this same
 * phase (§1 of the Phase 2F instructions).
 */
describe('CustomerContactsService', () => {
  let service: CustomerContactsService;
  let prisma: any;
  let customersService: any;
  let activityLog: any;

  beforeEach(async () => {
    prisma = {
      customerContact: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        delete: jest.fn(),
      },
    };
    customersService = { assertCustomerBelongsToCompany: jest.fn() };
    activityLog = { record: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        CustomerContactsService,
        { provide: PrismaService, useValue: prisma },
        { provide: CustomersService, useValue: customersService },
        { provide: ActivityLogService, useValue: activityLog },
      ],
    }).compile();

    service = moduleRef.get(CustomerContactsService);
  });

  // ============================================================
  // Tenant isolation
  // ============================================================
  describe('tenant isolation', () => {
    it('create propagates a tenant-check failure from CustomersService before writing anything', async () => {
      customersService.assertCustomerBelongsToCompany.mockRejectedValue(new NotFoundException());
      await expect(
        service.create('company-A', 'user-1', 'cust-in-company-B', { name: 'X' } as any),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.customerContact.create).not.toHaveBeenCalled();
    });

    it('findOne propagates a tenant-check failure', async () => {
      customersService.assertCustomerBelongsToCompany.mockRejectedValue(new NotFoundException());
      await expect(service.findOne('company-A', 'cust-in-company-B', 'contact-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ============================================================
  // Activity logging (Phase 2F P2 fix)
  // ============================================================
  describe('activity logging', () => {
    it('logs contact creation under entityType "customer" (contacts are not their own entity_type)', async () => {
      prisma.customerContact.create.mockResolvedValue({ id: 'contact-1', name: 'New Contact' });

      await service.create('company-A', 'user-1', 'cust-1', { name: 'New Contact' } as any);

      expect(activityLog.record).toHaveBeenCalledWith(
        expect.objectContaining({
          companyId: 'company-A',
          userId: 'user-1',
          action: 'contact_added',
          entityType: 'customer',
          entityId: 'cust-1',
        }),
      );
    });

    it('logs contact updates with old and new values', async () => {
      prisma.customerContact.findFirst.mockResolvedValue({ id: 'contact-1', name: 'Old Name' });
      prisma.customerContact.update.mockResolvedValue({ id: 'contact-1', name: 'New Name' });

      await service.update('company-A', 'user-1', 'cust-1', 'contact-1', { name: 'New Name' } as any);

      expect(activityLog.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'contact_updated',
          entityType: 'customer',
          entityId: 'cust-1',
          oldValues: expect.objectContaining({ name: 'Old Name' }),
          newValues: expect.objectContaining({ name: 'New Name' }),
        }),
      );
    });

    it('logs contact removal', async () => {
      prisma.customerContact.findFirst.mockResolvedValue({ id: 'contact-1', name: 'Gone Soon' });
      prisma.customerContact.delete.mockResolvedValue({ id: 'contact-1' });

      await service.remove('company-A', 'user-1', 'cust-1', 'contact-1');

      expect(activityLog.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'contact_removed', entityType: 'customer', entityId: 'cust-1' }),
      );
    });

    it('does not log on a plain read (findOne/findAll)', async () => {
      prisma.customerContact.findFirst.mockResolvedValue({ id: 'contact-1' });
      await service.findOne('company-A', 'cust-1', 'contact-1');
      expect(activityLog.record).not.toHaveBeenCalled();
    });
  });

  // ============================================================
  // Business behavior (existing, unchanged — sanity coverage)
  // ============================================================
  describe('primary contact handling', () => {
    it('clears any existing primary contact when a new one is marked primary', async () => {
      prisma.customerContact.create.mockResolvedValue({ id: 'contact-2', isPrimary: true });

      await service.create('company-A', 'user-1', 'cust-1', { name: 'New Primary', isPrimary: true } as any);

      expect(prisma.customerContact.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ customerId: 'cust-1', isPrimary: true }),
          data: { isPrimary: false },
        }),
      );
    });
  });
});
