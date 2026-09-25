import { Test } from '@nestjs/testing';
import { NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { BillPaymentsService } from './bill-payments.service';
import { PeriodLockService } from './period-lock.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('BillPaymentsService', () => {
  let service: BillPaymentsService;
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
      bill: { findFirst: jest.fn(), update: jest.fn() },
      financeSettings: { findUnique: jest.fn() },
      billPayment: { create: jest.fn(), findMany: jest.fn() },
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
        BillPaymentsService,
        { provide: PrismaService, useValue: prisma },
        { provide: PeriodLockService, useValue: periodLock },
      ],
    }).compile();

    service = moduleRef.get(BillPaymentsService);
  });

  const receivedBill = {
    id: 'bill-1',
    billNumber: 'BILL-2026-0001',
    status: 'received',
    total: '1000.00',
    amountPaid: '0.00',
  };

  it('404s when the bill does not exist in the caller company', async () => {
    prisma.bill.findFirst.mockResolvedValue(null);

    await expect(
      service.create('company-1', 'user-1', { billId: 'missing', amount: 100, paymentDate: '2026-06-01', method: 'cash' } as any),
    ).rejects.toThrow(NotFoundException);
  });

  it.each(['draft', 'paid', 'cancelled'])('rejects recording a payment against a bill with status %s', async (status) => {
    prisma.bill.findFirst.mockResolvedValue({ ...receivedBill, status });

    await expect(
      service.create('company-1', 'user-1', { billId: 'bill-1', amount: 100, paymentDate: '2026-06-01', method: 'cash' } as any),
    ).rejects.toThrow(UnprocessableEntityException);
  });

  it('rejects a payment amount that exceeds the remaining balance', async () => {
    prisma.bill.findFirst.mockResolvedValue({ ...receivedBill, amountPaid: '800.00' });

    await expect(
      service.create('company-1', 'user-1', { billId: 'bill-1', amount: 300, paymentDate: '2026-06-01', method: 'cash' } as any),
    ).rejects.toThrow(UnprocessableEntityException);
  });

  it('rejects when Finance Settings has no cash/payable account configured', async () => {
    prisma.bill.findFirst.mockResolvedValue(receivedBill);
    prisma.financeSettings.findUnique.mockResolvedValue({ defaultCashAccountId: null });

    await expect(
      service.create('company-1', 'user-1', { billId: 'bill-1', amount: 100, paymentDate: '2026-06-01', method: 'cash' } as any),
    ).rejects.toThrow(UnprocessableEntityException);
  });

  it('checks the period lock using the paymentDate', async () => {
    prisma.bill.findFirst.mockResolvedValue(receivedBill);
    prisma.financeSettings.findUnique.mockResolvedValue({ defaultCashAccountId: 'acc-cash', defaultPayableAccountId: 'acc-ap' });
    prisma.journalEntry.create.mockResolvedValue({ id: 'je-1' });
    prisma.billPayment.create.mockResolvedValue({ id: 'pay-1' });
    prisma.bill.update.mockResolvedValue({ id: 'bill-1' });

    await service.create('company-1', 'user-1', { billId: 'bill-1', amount: 100, paymentDate: '2026-06-15', method: 'cash' } as any);

    expect(periodLock.assertDateNotLocked).toHaveBeenCalledWith('company-1', new Date('2026-06-15'));
  });

  it('moves the bill to partially_paid when the payment does not cover the full remaining balance', async () => {
    prisma.bill.findFirst.mockResolvedValue(receivedBill);
    prisma.financeSettings.findUnique.mockResolvedValue({ defaultCashAccountId: 'acc-cash', defaultPayableAccountId: 'acc-ap' });
    prisma.journalEntry.create.mockResolvedValue({ id: 'je-1' });
    prisma.billPayment.create.mockResolvedValue({ id: 'pay-1' });
    prisma.bill.update.mockResolvedValue({ id: 'bill-1' });

    await service.create('company-1', 'user-1', { billId: 'bill-1', amount: 400, paymentDate: '2026-06-01', method: 'cash' } as any);

    expect(prisma.bill.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'partially_paid' }) }),
    );
  });

  it('moves the bill to paid when the payment exactly covers the remaining balance', async () => {
    prisma.bill.findFirst.mockResolvedValue({ ...receivedBill, amountPaid: '600.00' });
    prisma.financeSettings.findUnique.mockResolvedValue({ defaultCashAccountId: 'acc-cash', defaultPayableAccountId: 'acc-ap' });
    prisma.journalEntry.create.mockResolvedValue({ id: 'je-1' });
    prisma.billPayment.create.mockResolvedValue({ id: 'pay-1' });
    prisma.bill.update.mockResolvedValue({ id: 'bill-1' });

    await service.create('company-1', 'user-1', { billId: 'bill-1', amount: 400, paymentDate: '2026-06-01', method: 'cash' } as any);

    expect(prisma.bill.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'paid' }) }),
    );
  });

  it('posts a balanced two-line journal entry (debit payable, credit cash — the reverse direction of a customer payment)', async () => {
    prisma.bill.findFirst.mockResolvedValue(receivedBill);
    prisma.financeSettings.findUnique.mockResolvedValue({ defaultCashAccountId: 'acc-cash', defaultPayableAccountId: 'acc-ap' });
    prisma.journalEntry.create.mockResolvedValue({ id: 'je-1' });
    prisma.billPayment.create.mockResolvedValue({ id: 'pay-1' });
    prisma.bill.update.mockResolvedValue({ id: 'bill-1' });

    await service.create('company-1', 'user-1', { billId: 'bill-1', amount: 100, paymentDate: '2026-06-01', method: 'cash' } as any);

    const createCall = prisma.journalEntry.create.mock.calls[0][0];
    expect(createCall.data.status).toBe('posted');
    const lines = createCall.data.lines.create;
    expect(lines).toHaveLength(2);
    expect(lines[0].accountId).toBe('acc-ap');
    expect(lines[0].debit.toString()).toBe('100');
    expect(lines[1].accountId).toBe('acc-cash');
    expect(lines[1].credit.toString()).toBe('100');
  });
});
