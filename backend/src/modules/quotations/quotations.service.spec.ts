import { Test } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { QuotationsService } from './quotations.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ActivityLogService } from '../../common/services/activity-log.service';
import { CustomersService } from '../customers/customers.service';
import { NotificationsService } from '../notifications/notifications.service';
import { notificationsServiceBackedBy } from '../notifications/testing/notifications-test-adapter';

describe('QuotationsService', () => {
  let service: QuotationsService;
  let prisma: any;
  let customersService: any;

  function mockTransaction(prismaMock: any) {
    return jest.fn((arg) => {
      if (typeof arg === 'function') return arg(prismaMock);
      return Promise.all(arg);
    });
  }

  beforeEach(async () => {
    prisma = {
      quotation: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
      },
      quotationItem: {
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        findMany: jest.fn(),
      },
      opportunity: { findFirst: jest.fn() },
      customer: { findUnique: jest.fn() },
      currency: { findFirst: jest.fn() },
      notification: { create: jest.fn() },
    };
    prisma.$transaction = mockTransaction(prisma);

    customersService = {
      assertCustomerBelongsToCompany: jest.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        QuotationsService,
        { provide: PrismaService, useValue: prisma },
        { provide: NotificationsService, useValue: notificationsServiceBackedBy(prisma) },
        { provide: ActivityLogService, useValue: { record: jest.fn() } },
        { provide: CustomersService, useValue: customersService },
      ],
    }).compile();

    service = moduleRef.get(QuotationsService);
  });

  // ----------------------------------------------------------
  // Tenant isolation / customer-company mismatch
  // ----------------------------------------------------------
  describe('tenant isolation and customer validation', () => {
    it('findOne throws NotFoundException for a quotation outside the caller company', async () => {
      prisma.quotation.findFirst.mockResolvedValue(null); // simulates cross-tenant filter excluding the row
      await expect(service.findOne('company-A', 'quote-in-company-B')).rejects.toThrow(NotFoundException);
    });

    it('create rejects when the customer does not belong to the caller company', async () => {
      customersService.assertCustomerBelongsToCompany.mockRejectedValue(
        new NotFoundException('customerId must reference an active customer in the same company.'),
      );

      await expect(
        service.create('company-A', 'user-1', { customerId: 'cust-in-company-B' } as any),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });

  // ----------------------------------------------------------
  // Opportunity / customer mismatch validation
  // ----------------------------------------------------------
  describe('opportunity validation', () => {
    const baseDto = { customerId: 'cust-1', opportunityId: 'opp-1' } as any;

    it('rejects when the opportunity does not exist in the caller company', async () => {
      prisma.opportunity.findFirst.mockResolvedValue(null);
      await expect(service.create('company-A', 'user-1', baseDto)).rejects.toThrow(BadRequestException);
    });

    it('rejects when the opportunity belongs to a different customer', async () => {
      prisma.opportunity.findFirst.mockResolvedValue({
        id: 'opp-1',
        companyId: 'company-A',
        customerId: 'a-different-customer',
        stage: 'proposal',
      });
      await expect(service.create('company-A', 'user-1', baseDto)).rejects.toThrow(BadRequestException);
    });

    it('rejects when the opportunity is in the "lost" stage', async () => {
      prisma.opportunity.findFirst.mockResolvedValue({
        id: 'opp-1',
        companyId: 'company-A',
        customerId: 'cust-1',
        stage: 'lost',
      });
      await expect(service.create('company-A', 'user-1', baseDto)).rejects.toThrow(BadRequestException);
    });

    it('accepts a valid, same-customer, non-lost opportunity', async () => {
      prisma.opportunity.findFirst.mockResolvedValue({
        id: 'opp-1',
        companyId: 'company-A',
        customerId: 'cust-1',
        stage: 'proposal',
      });
      prisma.quotation.count.mockResolvedValue(0);
      prisma.quotation.findFirst.mockResolvedValue(null);
      prisma.quotation.create.mockResolvedValue({ id: 'q-1', quotationNumber: 'QTN-2026-0001' });
      // findOne (called at the end of create()) needs a value too:
      const findOneSpy = jest.spyOn(service, 'findOne').mockResolvedValue({ id: 'q-1' } as any);

      await service.create('company-A', 'user-1', baseDto);
      expect(findOneSpy).toHaveBeenCalled();
    });
  });

  // ----------------------------------------------------------
  // Server-side calculation (never trust client totals)
  // ----------------------------------------------------------
  describe('server-side calculations', () => {
    it('computes quotation totals from items on create, ignoring anything the client might have sent', async () => {
      prisma.quotation.count.mockResolvedValue(0);
      prisma.quotation.findFirst.mockResolvedValue(null);
      prisma.quotation.create.mockResolvedValue({ id: 'q-1' });
      prisma.quotationItem.create.mockResolvedValue({});
      jest.spyOn(service, 'findOne').mockResolvedValue({ id: 'q-1' } as any);

      const dto = {
        customerId: 'cust-1',
        items: [
          { description: 'Cat6 cabling', quantity: 100, unitPrice: 150, discount: 500, tax: 2085 },
          { description: 'Switch', quantity: 4, unitPrice: 3500, discount: 0, tax: 1470 },
        ],
      } as any;

      await service.create('company-A', 'user-1', dto);

      expect(prisma.quotation.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            subtotal: expect.anything(),
            discount: expect.anything(),
            tax: expect.anything(),
            total: expect.anything(),
          }),
        }),
      );
      const createCallArg = prisma.quotation.create.mock.calls[0][0].data;
      expect(createCallArg.subtotal.toString()).toBe('29000'); // 15000 + 14000
      expect(createCallArg.discount.toString()).toBe('500');
      expect(createCallArg.tax.toString()).toBe('3555');
      expect(createCallArg.total.toString()).toBe('32055');
    });

    it('recalculates quotation totals after an item is added', async () => {
      jest.spyOn(service, 'findOne')
        .mockResolvedValueOnce({ id: 'q-1', status: 'draft' } as any) // guard check
        .mockResolvedValueOnce({ id: 'q-1' } as any); // final return
      prisma.quotationItem.create.mockResolvedValue({ id: 'item-1' });
      prisma.quotationItem.findMany.mockResolvedValue([
        { quantity: 2, unitPrice: 100, discount: 0, tax: 30 },
      ]);
      prisma.quotation.update.mockResolvedValue({});

      await service.addItem('company-A', 'user-1', 'q-1', {
        description: 'Item',
        quantity: 2,
        unitPrice: 100,
        tax: 30,
      } as any);

      expect(prisma.quotation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'q-1' },
          data: expect.objectContaining({
            subtotal: expect.anything(),
            total: expect.anything(),
          }),
        }),
      );
      const updateArg = prisma.quotation.update.mock.calls[0][0].data;
      expect(updateArg.subtotal.toString()).toBe('200');
      expect(updateArg.total.toString()).toBe('230');
    });
  });

  // ----------------------------------------------------------
  // Quotation number generation / uniqueness
  // ----------------------------------------------------------
  describe('quotation number generation', () => {
    it('generates a QTN-{year}-{4-digit} formatted number', async () => {
      prisma.quotation.count.mockResolvedValue(0);
      prisma.quotation.findFirst.mockResolvedValue(null);
      prisma.quotation.create.mockResolvedValue({ id: 'q-1' });
      jest.spyOn(service, 'findOne').mockResolvedValue({ id: 'q-1' } as any);

      await service.create('company-A', 'user-1', { customerId: 'cust-1' } as any);

      const createArg = prisma.quotation.create.mock.calls[0][0].data;
      expect(createArg.quotationNumber).toMatch(/^QTN-\d{4}-\d{4}$/);
    });

    it('retries on a collision and produces a different number', async () => {
      prisma.quotation.count.mockResolvedValue(5); // starts attempt at 6
      // First candidate collides, second is free.
      prisma.quotation.findFirst
        .mockResolvedValueOnce({ id: 'existing-quote' })
        .mockResolvedValueOnce(null);
      prisma.quotation.create.mockResolvedValue({ id: 'q-1' });
      jest.spyOn(service, 'findOne').mockResolvedValue({ id: 'q-1' } as any);

      await service.create('company-A', 'user-1', { customerId: 'cust-1' } as any);

      expect(prisma.quotation.findFirst).toHaveBeenCalledTimes(2);
      const createArg = prisma.quotation.create.mock.calls[0][0].data;
      expect(createArg.quotationNumber).toContain('0007'); // count(5)+1=6 collided, next is 7
    });

    it('throws ConflictException after exhausting retry attempts', async () => {
      prisma.quotation.count.mockResolvedValue(0);
      prisma.quotation.findFirst.mockResolvedValue({ id: 'always-collides' }); // every attempt collides

      await expect(
        service.create('company-A', 'user-1', { customerId: 'cust-1' } as any),
      ).rejects.toThrow(ConflictException);
    });
  });

  // ----------------------------------------------------------
  // Terminal-state protection
  // ----------------------------------------------------------
  describe('terminal-state protection', () => {
    it.each(['accepted', 'rejected', 'expired'])(
      'blocks update() on a %s quotation',
      async (status) => {
        jest.spyOn(service, 'findOne').mockResolvedValue({ id: 'q-1', status } as any);
        await expect(
          service.update('company-A', 'user-1', 'q-1', { validUntil: '2026-12-01' } as any),
        ).rejects.toThrow(UnprocessableEntityException);
      },
    );

    it.each(['accepted', 'rejected', 'expired', 'sent'])(
      'blocks addItem() on a non-draft (%s) quotation',
      async (status) => {
        jest.spyOn(service, 'findOne').mockResolvedValue({ id: 'q-1', status, items: [] } as any);
        await expect(
          service.addItem('company-A', 'user-1', 'q-1', {
            description: 'x',
            quantity: 1,
            unitPrice: 1,
          } as any),
        ).rejects.toThrow(UnprocessableEntityException);
      },
    );

    it('blocks softDelete() on anything other than draft', async () => {
      jest.spyOn(service, 'findOne').mockResolvedValue({ id: 'q-1', status: 'sent' } as any);
      await expect(service.softDelete('company-A', 'user-1', 'q-1')).rejects.toThrow(
        UnprocessableEntityException,
      );
    });

    it('a sent quotation rejects a customer/opportunity change via update()', async () => {
      jest.spyOn(service, 'findOne').mockResolvedValue({ id: 'q-1', status: 'sent', customerId: 'cust-1' } as any);
      await expect(
        service.update('company-A', 'user-1', 'q-1', { customerId: 'cust-2' } as any),
      ).rejects.toThrow(UnprocessableEntityException);
    });
  });

  // ----------------------------------------------------------
  // Lifecycle transitions: send / accept / reject / expire
  // ----------------------------------------------------------
  describe('send', () => {
    it('transitions draft -> sent and recalculates totals', async () => {
      jest.spyOn(service, 'findOne')
        .mockResolvedValueOnce({
          id: 'q-1',
          status: 'draft',
          quotationNumber: 'QTN-2026-0001',
          customerId: 'cust-1',
          createdBy: 'user-1',
          items: [{ id: 'item-1' }],
        } as any)
        .mockResolvedValueOnce({ id: 'q-1', status: 'sent' } as any);
      prisma.quotationItem.findMany.mockResolvedValue([{ quantity: 1, unitPrice: 100, discount: 0, tax: 0 }]);
      prisma.quotation.update.mockResolvedValue({ id: 'q-1', status: 'sent', total: 100 });
      prisma.customer.findUnique.mockResolvedValue({ ownerId: 'owner-1' });

      const result = await service.send('company-A', 'user-1', 'q-1');
      expect(result.status).toBe('sent');
      expect(prisma.notification.create).toHaveBeenCalled();
    });

    it('rejects sending a quotation with no items', async () => {
      jest.spyOn(service, 'findOne').mockResolvedValue({
        id: 'q-1',
        status: 'draft',
        items: [],
      } as any);

      await expect(service.send('company-A', 'user-1', 'q-1')).rejects.toThrow(UnprocessableEntityException);
    });

    it('rejects sending an already-sent quotation (invalid transition)', async () => {
      jest.spyOn(service, 'findOne').mockResolvedValue({
        id: 'q-1',
        status: 'sent',
        items: [{ id: 'item-1' }],
      } as any);

      await expect(service.send('company-A', 'user-1', 'q-1')).rejects.toThrow(UnprocessableEntityException);
    });
  });

  describe('accept / reject', () => {
    it('accepts a sent quotation', async () => {
      jest.spyOn(service, 'findOne')
        .mockResolvedValueOnce({ id: 'q-1', status: 'sent', customerId: 'cust-1', quotationNumber: 'QTN-2026-0001', createdBy: 'user-1' } as any)
        .mockResolvedValueOnce({ id: 'q-1', status: 'accepted' } as any);
      prisma.quotation.update.mockResolvedValue({ id: 'q-1', status: 'accepted' });
      prisma.customer.findUnique.mockResolvedValue({ ownerId: 'owner-1' });

      const result = await service.accept('company-A', 'user-1', 'q-1');
      expect(result.status).toBe('accepted');
    });

    it('rejects accept() from draft (must go through sent first)', async () => {
      jest.spyOn(service, 'findOne').mockResolvedValue({ id: 'q-1', status: 'draft' } as any);
      await expect(service.accept('company-A', 'user-1', 'q-1')).rejects.toThrow(UnprocessableEntityException);
    });

    it('rejects a quotation from sent', async () => {
      jest.spyOn(service, 'findOne')
        .mockResolvedValueOnce({ id: 'q-1', status: 'sent', customerId: 'cust-1', quotationNumber: 'QTN-2026-0001', createdBy: 'user-1' } as any)
        .mockResolvedValueOnce({ id: 'q-1', status: 'rejected' } as any);
      prisma.quotation.update.mockResolvedValue({ id: 'q-1', status: 'rejected' });
      prisma.customer.findUnique.mockResolvedValue({ ownerId: 'owner-1' });

      const result = await service.reject('company-A', 'user-1', 'q-1');
      expect(result.status).toBe('rejected');
    });

    it('rejects reject() on an already-terminal quotation', async () => {
      jest.spyOn(service, 'findOne').mockResolvedValue({ id: 'q-1', status: 'accepted' } as any);
      await expect(service.reject('company-A', 'user-1', 'q-1')).rejects.toThrow(UnprocessableEntityException);
    });
  });

  describe('expire', () => {
    it('expires a sent quotation whose validUntil has passed', async () => {
      const past = new Date(Date.now() - 86400000);
      jest.spyOn(service, 'findOne')
        .mockResolvedValueOnce({ id: 'q-1', status: 'sent', validUntil: past } as any)
        .mockResolvedValueOnce({ id: 'q-1', status: 'expired' } as any);
      prisma.quotation.update.mockResolvedValue({ id: 'q-1', status: 'expired' });

      const result = await service.expire('company-A', 'user-1', 'q-1');
      expect(result.status).toBe('expired');
    });

    it('rejects expiring a quotation whose validUntil has not passed yet', async () => {
      const future = new Date(Date.now() + 86400000);
      jest.spyOn(service, 'findOne').mockResolvedValue({ id: 'q-1', status: 'sent', validUntil: future } as any);

      await expect(service.expire('company-A', 'user-1', 'q-1')).rejects.toThrow(UnprocessableEntityException);
    });

    it('rejects expiring a quotation with no validUntil set at all', async () => {
      jest.spyOn(service, 'findOne').mockResolvedValue({ id: 'q-1', status: 'sent', validUntil: null } as any);
      await expect(service.expire('company-A', 'user-1', 'q-1')).rejects.toThrow(UnprocessableEntityException);
    });

    it('rejects expiring a draft quotation (invalid transition — must be sent)', async () => {
      jest.spyOn(service, 'findOne').mockResolvedValue({ id: 'q-1', status: 'draft', validUntil: new Date(0) } as any);
      await expect(service.expire('company-A', 'user-1', 'q-1')).rejects.toThrow(UnprocessableEntityException);
    });

    it('does not auto-expire on a plain findOne/GET call', async () => {
      // findOne itself never touches status — this is really just
      // documenting the guarantee: findOne has no expiry logic at all.
      prisma.quotation.findFirst.mockResolvedValue({
        id: 'q-1',
        status: 'sent',
        validUntil: new Date(Date.now() - 86400000),
        items: [],
      });
      const result = await service.findOne('company-A', 'q-1');
      expect(result.status).toBe('sent'); // unchanged by the read
      expect(prisma.quotation.update).not.toHaveBeenCalled();
    });
  });

  // ----------------------------------------------------------
  // findAll — P1 filter regression (V1 Final System Audit §7/13)
  // ----------------------------------------------------------
  describe('findAll — filters reach the service', () => {
    beforeEach(() => {
      prisma.quotation.findMany.mockResolvedValue([]);
      prisma.quotation.count.mockResolvedValue(0);
    });

    it('applies customerId, opportunityId, and status filters alongside companyId', async () => {
      await service.findAll('company-A', {
        page: 1,
        pageSize: 20,
        customerId: 'cust-1',
        opportunityId: 'opp-1',
        status: 'sent',
      } as any);

      const call = prisma.quotation.findMany.mock.calls[0][0];
      expect(call.where.companyId).toBe('company-A');
      expect(call.where.customerId).toBe('cust-1');
      expect(call.where.opportunityId).toBe('opp-1');
      expect(call.where.status).toBe('sent');
      expect(call.where.deletedAt).toBeNull();
    });

    it('omits filter keys entirely when not supplied', async () => {
      await service.findAll('company-A', { page: 1, pageSize: 20 } as any);

      const call = prisma.quotation.findMany.mock.calls[0][0];
      expect(call.where.companyId).toBe('company-A');
      expect('customerId' in call.where).toBe(false);
      expect('opportunityId' in call.where).toBe(false);
      expect('status' in call.where).toBe(false);
    });
  });

  describe('multi-currency: create() currency resolution', () => {
    beforeEach(() => {
      customersService.assertCustomerBelongsToCompany.mockResolvedValue(undefined);
      prisma.quotation.count.mockResolvedValue(0);
      prisma.quotation.findFirst.mockResolvedValue(null); // no clash on generated number
    });

    it('defaults to SAR at rate 1 when no currency is specified — zero behavior change for the common case', async () => {
      prisma.quotation.create.mockResolvedValue({ id: 'q-1' });

      await service.create('company-1', 'user-1', { customerId: 'cust-1', items: [] } as any);

      const call = prisma.quotation.create.mock.calls[0][0];
      expect(call.data.currencyCode).toBe('SAR');
      expect(call.data.exchangeRateToBase).toBe(1);
      expect(prisma.currency.findFirst).not.toHaveBeenCalled(); // SAR never needs a DB lookup
    });

    it('forces rate to exactly 1 for SAR even if a caller mistakenly supplies a different rate', async () => {
      prisma.quotation.create.mockResolvedValue({ id: 'q-1' });

      await service.create('company-1', 'user-1', { customerId: 'cust-1', items: [], currencyCode: 'SAR', exchangeRateToBase: 3.75 } as any);

      expect(prisma.quotation.create.mock.calls[0][0].data.exchangeRateToBase).toBe(1);
    });

    it('rejects an unknown or inactive currency code', async () => {
      prisma.currency.findFirst.mockResolvedValue(null);

      await expect(
        service.create('company-1', 'user-1', { customerId: 'cust-1', items: [], currencyCode: 'XXX', exchangeRateToBase: 2 } as any),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('rejects a non-SAR currency with no exchange rate supplied', async () => {
      prisma.currency.findFirst.mockResolvedValue({ code: 'USD', isActive: true });

      await expect(
        service.create('company-1', 'user-1', { customerId: 'cust-1', items: [], currencyCode: 'USD' } as any),
      ).rejects.toThrow(/exchangeRateToBase is required/);
    });

    it('rejects a non-SAR currency with a zero or negative exchange rate', async () => {
      prisma.currency.findFirst.mockResolvedValue({ code: 'USD', isActive: true });

      await expect(
        service.create('company-1', 'user-1', { customerId: 'cust-1', items: [], currencyCode: 'USD', exchangeRateToBase: 0 } as any),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('accepts a valid non-SAR currency with a positive rate and stores both', async () => {
      prisma.currency.findFirst.mockResolvedValue({ code: 'USD', isActive: true });
      prisma.quotation.create.mockResolvedValue({ id: 'q-1' });

      await service.create('company-1', 'user-1', { customerId: 'cust-1', items: [], currencyCode: 'usd', exchangeRateToBase: 3.75 } as any);

      const call = prisma.quotation.create.mock.calls[0][0];
      expect(call.data.currencyCode).toBe('USD'); // normalized to uppercase
      expect(call.data.exchangeRateToBase).toBe(3.75);
    });
  });
});
