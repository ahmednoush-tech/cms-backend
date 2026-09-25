import { Test } from '@nestjs/testing';
import { NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { BillsService } from './bills.service';
import { PeriodLockService } from './period-lock.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('BillsService', () => {
  let service: BillsService;
  let prisma: any;
  let periodLock: { assertDateNotLocked: jest.Mock };

  function mockTransaction(prismaMock: any) {
    return jest.fn((arg) => {
      if (typeof arg === 'function') return arg(prismaMock);
      return Promise.all(arg);
    });
  }

  beforeEach(async () => {
    prisma = {
      vendor: { findFirst: jest.fn() },
      bill: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
      },
      financeSettings: { findUnique: jest.fn() },
      inventoryItem: { update: jest.fn() },
      inventoryMovement: { create: jest.fn() },
      journalEntry: {
        create: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
        findFirst: jest.fn(),
      },
    };
    prisma.$transaction = mockTransaction(prisma);

    periodLock = { assertDateNotLocked: jest.fn().mockResolvedValue(undefined) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        BillsService,
        { provide: PrismaService, useValue: prisma },
        { provide: PeriodLockService, useValue: periodLock },
      ],
    }).compile();

    service = moduleRef.get(BillsService);
  });

  describe('create', () => {
    it('404s when the vendor does not exist in the caller company', async () => {
      prisma.vendor.findFirst.mockResolvedValue(null);

      await expect(
        service.create('company-1', 'user-1', {
          vendorId: 'missing',
          billDate: '2026-06-01',
          items: [{ description: 'x', quantity: 1, unitPrice: 100 }],
        } as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('creates a draft bill with computed totals', async () => {
      prisma.vendor.findFirst.mockResolvedValue({ id: 'vendor-1' });
      prisma.bill.create.mockResolvedValue({ id: 'bill-1', status: 'draft' });

      const result = await service.create('company-1', 'user-1', {
        vendorId: 'vendor-1',
        billDate: '2026-06-01',
        items: [{ description: 'Supplies', quantity: 2, unitPrice: 100 }],
      } as any);

      expect(result.status).toBe('draft');
      expect(prisma.bill.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ vendorId: 'vendor-1', status: 'draft' }) }),
      );
    });
  });

  describe('receive', () => {
    const draftBill = {
      id: 'bill-1',
      status: 'draft',
      billDate: new Date('2026-06-15'),
      billNumber: 'BILL-2026-0001',
      subtotal: '1000.00',
      discount: '0.00',
      tax: '150.00',
      total: '1150.00',
      items: [{ id: 'item-1' }],
      vendor: {},
      payments: [],
    };

    it('rejects receiving a bill with no line items', async () => {
      prisma.bill.findFirst.mockResolvedValue({ ...draftBill, items: [] });

      await expect(service.receive('company-1', 'user-1', 'bill-1')).rejects.toThrow(UnprocessableEntityException);
    });

    it("checks the period lock using the bill's billDate", async () => {
      prisma.bill.findFirst.mockResolvedValue(draftBill);
      prisma.financeSettings.findUnique.mockResolvedValue({
        defaultPayableAccountId: 'acc-ap',
        defaultExpenseAccountId: 'acc-exp',
        defaultTaxRecoverableAccountId: 'acc-tax',
      });
      prisma.journalEntry.create.mockResolvedValue({ id: 'je-1' });
      prisma.bill.update.mockResolvedValue({ id: 'bill-1', status: 'received' });

      await service.receive('company-1', 'user-1', 'bill-1');

      expect(periodLock.assertDateNotLocked).toHaveBeenCalledWith('company-1', draftBill.billDate);
    });

    it('rejects receiving when no payable/expense account is configured', async () => {
      prisma.bill.findFirst.mockResolvedValue(draftBill);
      prisma.financeSettings.findUnique.mockResolvedValue({ defaultPayableAccountId: null });

      await expect(service.receive('company-1', 'user-1', 'bill-1')).rejects.toThrow(UnprocessableEntityException);
    });

    it('rejects receiving a taxed bill when no Tax Recoverable account is configured', async () => {
      prisma.bill.findFirst.mockResolvedValue(draftBill);
      prisma.financeSettings.findUnique.mockResolvedValue({
        defaultPayableAccountId: 'acc-ap',
        defaultExpenseAccountId: 'acc-exp',
        defaultTaxRecoverableAccountId: null,
      });

      await expect(service.receive('company-1', 'user-1', 'bill-1')).rejects.toThrow(UnprocessableEntityException);
    });

    it('posts a balanced journal entry (debit expense + tax, credit AP = total) and moves the bill to received', async () => {
      prisma.bill.findFirst.mockResolvedValue(draftBill);
      prisma.financeSettings.findUnique.mockResolvedValue({
        defaultPayableAccountId: 'acc-ap',
        defaultExpenseAccountId: 'acc-exp',
        defaultTaxRecoverableAccountId: 'acc-tax',
      });
      prisma.journalEntry.create.mockResolvedValue({ id: 'je-1' });
      prisma.bill.update.mockResolvedValue({ id: 'bill-1', status: 'received', journalEntryId: 'je-1' });

      const result = await service.receive('company-1', 'user-1', 'bill-1');

      expect(result.status).toBe('received');
      const createCall = prisma.journalEntry.create.mock.calls[0][0];
      expect(createCall.data.status).toBe('posted');
      expect(createCall.data.lines.create).toHaveLength(3);
    });

    it('omits the tax-recoverable line entirely when the bill has zero tax', async () => {
      prisma.bill.findFirst.mockResolvedValue({ ...draftBill, tax: '0.00', total: '1000.00' });
      prisma.financeSettings.findUnique.mockResolvedValue({
        defaultPayableAccountId: 'acc-ap',
        defaultExpenseAccountId: 'acc-exp',
        defaultTaxRecoverableAccountId: null,
      });
      prisma.journalEntry.create.mockResolvedValue({ id: 'je-1' });
      prisma.bill.update.mockResolvedValue({ id: 'bill-1', status: 'received' });

      await service.receive('company-1', 'user-1', 'bill-1');

      expect(prisma.journalEntry.create.mock.calls[0][0].data.lines.create).toHaveLength(2);
    });

    it('rejects receiving a bill that is not a draft', async () => {
      prisma.bill.findFirst.mockResolvedValue({ ...draftBill, status: 'received' });

      await expect(service.receive('company-1', 'user-1', 'bill-1')).rejects.toThrow(UnprocessableEntityException);
    });
  });

  describe('cancel / softDelete — draft-only gating', () => {
    it('rejects cancelling a non-draft bill', async () => {
      prisma.bill.findFirst.mockResolvedValue({ id: 'bill-1', status: 'received', items: [], payments: [] });

      await expect(service.cancel('company-1', 'bill-1')).rejects.toThrow(UnprocessableEntityException);
    });

    it('rejects deleting a non-draft bill', async () => {
      prisma.bill.findFirst.mockResolvedValue({ id: 'bill-1', status: 'paid', items: [], payments: [] });

      await expect(service.softDelete('company-1', 'bill-1')).rejects.toThrow(UnprocessableEntityException);
    });
  });

  describe('receive — inventory integration (F15)', () => {
    const financeSettings = {
      defaultPayableAccountId: 'acc-ap',
      defaultExpenseAccountId: 'acc-expense',
      defaultTaxRecoverableAccountId: 'acc-tax-recoverable',
    };

    function billWithItem(itemOverrides: any) {
      return {
        id: 'bill-1',
        status: 'draft',
        billDate: new Date('2026-06-15'),
        billNumber: 'BILL-2026-0001',
        subtotal: '500.00',
        discount: '0.00',
        tax: '0.00',
        total: '500.00',
        vendor: {},
        payments: [],
        items: [
          {
            id: 'item-1',
            description: 'Cable',
            quantity: '10.00',
            total: '500.00',
            tax: '0.00',
            inventoryItemId: 'inv-item-1',
            inventoryItem: {
              id: 'inv-item-1',
              name: 'CAT6 Cable',
              quantityOnHand: '90.000',
              averageUnitCost: '40.0000',
              inventoryAccountId: 'acc-inventory',
              ...itemOverrides,
            },
          },
        ],
      };
    }

    it('a bill with NO inventory-linked lines produces the exact same journal entry as before (zero-touch)', async () => {
      const plainBill = {
        id: 'bill-1', status: 'draft', billDate: new Date('2026-06-15'), billNumber: 'BILL-2026-0001',
        subtotal: '1000.00', discount: '0.00', tax: '150.00', total: '1150.00',
        items: [{ id: 'item-1', total: '1000.00', tax: '150.00', inventoryItemId: null }], vendor: {}, payments: [],
      };
      prisma.bill.findFirst.mockResolvedValue(plainBill);
      prisma.financeSettings.findUnique.mockResolvedValue(financeSettings);
      prisma.journalEntry.create.mockResolvedValue({ id: 'je-1' });
      prisma.bill.update.mockResolvedValue({ id: 'bill-1', status: 'received' });

      await service.receive('company-1', 'user-1', 'bill-1');

      const lines = prisma.journalEntry.create.mock.calls[0][0].data.lines.create;
      expect(lines).toHaveLength(3); // Expense debit, Tax Recoverable debit, AP credit — unchanged
      expect(prisma.inventoryMovement.create).not.toHaveBeenCalled();
    });

    it('rejects receiving when the linked inventory item has no inventory account configured', async () => {
      prisma.bill.findFirst.mockResolvedValue(billWithItem({ inventoryAccountId: null }));
      prisma.financeSettings.findUnique.mockResolvedValue(financeSettings);

      await expect(service.receive('company-1', 'user-1', 'bill-1')).rejects.toThrow(UnprocessableEntityException);
    });

    it("debits the item's OWN inventory account instead of the aggregate Expense account", async () => {
      prisma.bill.findFirst.mockResolvedValue(billWithItem({}));
      prisma.financeSettings.findUnique.mockResolvedValue(financeSettings);
      prisma.journalEntry.create.mockResolvedValue({ id: 'je-1' });
      prisma.bill.update.mockResolvedValue({ id: 'bill-1', status: 'received' });

      await service.receive('company-1', 'user-1', 'bill-1');

      const lines = prisma.journalEntry.create.mock.calls[0][0].data.lines.create;
      const expenseLine = lines.find((l: any) => l.accountId === 'acc-expense');
      const invLine = lines.find((l: any) => l.accountId === 'acc-inventory');
      expect(expenseLine).toBeUndefined(); // entire taxable amount was inventory — nothing left for Expense
      expect(invLine.debit.toString()).toBe('500');
    });

    it('updates the weighted average cost correctly on a purchase', async () => {
      // Existing: 90 @ 40.00 = 3600. Adding: 10 @ 50.00 (500/10) = 500. New: 4100 / 100 = 41.00.
      prisma.bill.findFirst.mockResolvedValue(billWithItem({}));
      prisma.financeSettings.findUnique.mockResolvedValue(financeSettings);
      prisma.journalEntry.create.mockResolvedValue({ id: 'je-1' });
      prisma.bill.update.mockResolvedValue({ id: 'bill-1', status: 'received' });

      await service.receive('company-1', 'user-1', 'bill-1');

      const updateCall = prisma.inventoryItem.update.mock.calls[0][0];
      expect(updateCall.data.quantityOnHand.toString()).toBe('100');
      expect(updateCall.data.averageUnitCost.toString()).toBe('41');
    });

    it('records a "purchase" movement referencing the bill', async () => {
      prisma.bill.findFirst.mockResolvedValue(billWithItem({}));
      prisma.financeSettings.findUnique.mockResolvedValue(financeSettings);
      prisma.journalEntry.create.mockResolvedValue({ id: 'je-1' });
      prisma.bill.update.mockResolvedValue({ id: 'bill-1', status: 'received' });

      await service.receive('company-1', 'user-1', 'bill-1');

      const movementCall = prisma.inventoryMovement.create.mock.calls[0][0];
      expect(movementCall.data.type).toBe('purchase');
      expect(movementCall.data.referenceType).toBe('bill');
    });
  });
});
