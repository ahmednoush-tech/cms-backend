import { Test } from '@nestjs/testing';
import { NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PeriodLockService } from './period-lock.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('PaymentsService', () => {
  let service: PaymentsService;
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
      invoice: { findFirst: jest.fn(), update: jest.fn() },
      financeSettings: { findUnique: jest.fn() },
      payment: { create: jest.fn(), findMany: jest.fn() },
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
        PaymentsService,
        { provide: PrismaService, useValue: prisma },
        { provide: PeriodLockService, useValue: periodLock },
      ],
    }).compile();

    service = moduleRef.get(PaymentsService);
  });

  const sentInvoice = {
    id: 'inv-1',
    invoiceNumber: 'INV-2026-0001',
    status: 'sent',
    total: '1000.00',
    amountPaid: '0.00',
    exchangeRateToBase: '1.00',
    notes: [],
  };

  it('404s when the invoice does not exist in the caller company', async () => {
    prisma.invoice.findFirst.mockResolvedValue(null);

    await expect(
      service.create('company-1', 'user-1', { invoiceId: 'missing', amount: 100, paymentDate: '2026-06-01', method: 'cash' } as any),
    ).rejects.toThrow(NotFoundException);
  });

  it.each(['draft', 'paid', 'cancelled'])('rejects recording a payment against an invoice with status %s', async (status) => {
    prisma.invoice.findFirst.mockResolvedValue({ ...sentInvoice, status });

    await expect(
      service.create('company-1', 'user-1', { invoiceId: 'inv-1', amount: 100, paymentDate: '2026-06-01', method: 'cash' } as any),
    ).rejects.toThrow(UnprocessableEntityException);
  });

  it('rejects a payment amount that exceeds the remaining balance', async () => {
    prisma.invoice.findFirst.mockResolvedValue({ ...sentInvoice, amountPaid: '800.00' });

    await expect(
      service.create('company-1', 'user-1', { invoiceId: 'inv-1', amount: 300, paymentDate: '2026-06-01', method: 'cash' } as any),
    ).rejects.toThrow(UnprocessableEntityException);
  });

  it('rejects when Finance Settings has no cash/receivable account configured', async () => {
    prisma.invoice.findFirst.mockResolvedValue(sentInvoice);
    prisma.financeSettings.findUnique.mockResolvedValue({ defaultCashAccountId: null });

    await expect(
      service.create('company-1', 'user-1', { invoiceId: 'inv-1', amount: 100, paymentDate: '2026-06-01', method: 'cash' } as any),
    ).rejects.toThrow(UnprocessableEntityException);
  });

  it('checks the period lock using the paymentDate', async () => {
    prisma.invoice.findFirst.mockResolvedValue(sentInvoice);
    prisma.financeSettings.findUnique.mockResolvedValue({ defaultCashAccountId: 'acc-cash', defaultReceivableAccountId: 'acc-ar' });
    prisma.journalEntry.create.mockResolvedValue({ id: 'je-1' });
    prisma.payment.create.mockResolvedValue({ id: 'pay-1' });
    prisma.invoice.update.mockResolvedValue({ id: 'inv-1' });

    await service.create('company-1', 'user-1', { invoiceId: 'inv-1', amount: 100, paymentDate: '2026-06-15', method: 'cash' } as any);

    expect(periodLock.assertDateNotLocked).toHaveBeenCalledWith('company-1', new Date('2026-06-15'));
  });

  it('moves the invoice to partially_paid when the payment does not cover the full remaining balance', async () => {
    prisma.invoice.findFirst.mockResolvedValue(sentInvoice);
    prisma.financeSettings.findUnique.mockResolvedValue({ defaultCashAccountId: 'acc-cash', defaultReceivableAccountId: 'acc-ar' });
    prisma.journalEntry.create.mockResolvedValue({ id: 'je-1' });
    prisma.payment.create.mockResolvedValue({ id: 'pay-1' });
    prisma.invoice.update.mockResolvedValue({ id: 'inv-1' });

    await service.create('company-1', 'user-1', { invoiceId: 'inv-1', amount: 400, paymentDate: '2026-06-01', method: 'cash' } as any);

    expect(prisma.invoice.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'partially_paid' }) }),
    );
  });

  it('moves the invoice to paid when the payment exactly covers the remaining balance', async () => {
    prisma.invoice.findFirst.mockResolvedValue({ ...sentInvoice, amountPaid: '600.00' });
    prisma.financeSettings.findUnique.mockResolvedValue({ defaultCashAccountId: 'acc-cash', defaultReceivableAccountId: 'acc-ar' });
    prisma.journalEntry.create.mockResolvedValue({ id: 'je-1' });
    prisma.payment.create.mockResolvedValue({ id: 'pay-1' });
    prisma.invoice.update.mockResolvedValue({ id: 'inv-1' });

    await service.create('company-1', 'user-1', { invoiceId: 'inv-1', amount: 400, paymentDate: '2026-06-01', method: 'cash' } as any);

    expect(prisma.invoice.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'paid' }) }),
    );
  });

  it('reduces the effective remaining balance by an issued credit note', async () => {
    // Total 1000, an issued credit note for 300 → effective remaining is 700, not 1000.
    prisma.invoice.findFirst.mockResolvedValue({ ...sentInvoice, notes: [{ noteType: 'credit', total: '300.00' }] });

    await expect(
      service.create('company-1', 'user-1', { invoiceId: 'inv-1', amount: 800, paymentDate: '2026-06-01', method: 'cash' } as any),
    ).rejects.toThrow(UnprocessableEntityException);
  });

  it('increases the effective remaining balance by an issued debit note', async () => {
    // Total 1000, an issued debit note for 200 → effective total is 1200, so 1100 should be payable.
    prisma.invoice.findFirst.mockResolvedValue({ ...sentInvoice, notes: [{ noteType: 'debit', total: '200.00' }] });
    prisma.financeSettings.findUnique.mockResolvedValue({ defaultCashAccountId: 'acc-cash', defaultReceivableAccountId: 'acc-ar' });
    prisma.journalEntry.create.mockResolvedValue({ id: 'je-1' });
    prisma.payment.create.mockResolvedValue({ id: 'pay-1' });
    prisma.invoice.update.mockResolvedValue({ id: 'inv-1' });

    await expect(
      service.create('company-1', 'user-1', { invoiceId: 'inv-1', amount: 1100, paymentDate: '2026-06-01', method: 'cash' } as any),
    ).resolves.toBeDefined();
  });

  it('ignores draft/cancelled notes entirely when computing the effective balance (only issued ones count)', async () => {
    prisma.invoice.findFirst.mockResolvedValue(sentInvoice); // findFirst already filters to status: 'issued' via the query itself
    prisma.financeSettings.findUnique.mockResolvedValue({ defaultCashAccountId: 'acc-cash', defaultReceivableAccountId: 'acc-ar' });
    prisma.journalEntry.create.mockResolvedValue({ id: 'je-1' });
    prisma.payment.create.mockResolvedValue({ id: 'pay-1' });
    prisma.invoice.update.mockResolvedValue({ id: 'inv-1' });

    await service.create('company-1', 'user-1', { invoiceId: 'inv-1', amount: 1000, paymentDate: '2026-06-01', method: 'cash' } as any);

    expect(prisma.invoice.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ include: { noteEntries: { where: { status: 'issued' } } } }),
    );
  });

  it('posts a balanced two-line journal entry (debit cash, credit receivable)', async () => {
    prisma.invoice.findFirst.mockResolvedValue(sentInvoice);
    prisma.financeSettings.findUnique.mockResolvedValue({ defaultCashAccountId: 'acc-cash', defaultReceivableAccountId: 'acc-ar' });
    prisma.journalEntry.create.mockResolvedValue({ id: 'je-1' });
    prisma.payment.create.mockResolvedValue({ id: 'pay-1' });
    prisma.invoice.update.mockResolvedValue({ id: 'inv-1' });

    await service.create('company-1', 'user-1', { invoiceId: 'inv-1', amount: 100, paymentDate: '2026-06-01', method: 'cash' } as any);

    const lines = prisma.journalEntry.create.mock.calls[0][0].data.lines.create;
    expect(lines).toHaveLength(2);
    expect(prisma.journalEntry.create.mock.calls[0][0].data.status).toBe('posted');
  });

  describe('multi-currency: realized FX gain/loss', () => {
    const usdInvoice = { ...sentInvoice, total: '1000.00', exchangeRateToBase: '3.75' }; // invoice booked at 3.75 SAR/USD

    it('produces NO third line when the payment rate matches the invoice rate exactly (no FX movement)', async () => {
      prisma.invoice.findFirst.mockResolvedValue(usdInvoice);
      prisma.financeSettings.findUnique.mockResolvedValue({ defaultCashAccountId: 'acc-cash', defaultReceivableAccountId: 'acc-ar' });
      prisma.journalEntry.create.mockResolvedValue({ id: 'je-1' });
      prisma.payment.create.mockResolvedValue({ id: 'pay-1' });
      prisma.invoice.update.mockResolvedValue({ id: 'inv-1' });

      await service.create('company-1', 'user-1', {
        invoiceId: 'inv-1',
        amount: 100,
        paymentDate: '2026-06-01',
        method: 'bank_transfer',
        exchangeRateToBase: 3.75,
      } as any);

      const lines = prisma.journalEntry.create.mock.calls[0][0].data.lines.create;
      expect(lines).toHaveLength(2);
      expect(lines[0].debit.toString()).toBe('375');
      expect(lines[1].credit.toString()).toBe('375');
    });

    it('posts a realized FX GAIN when the payment rate is HIGHER than the invoice rate (SAR strengthened relative to the invoice — more SAR received than the receivable was worth)', async () => {
      // Invoice booked at 3.75 SAR/USD → $100 = 375 SAR receivable.
      // Payment received at 3.80 SAR/USD → $100 = 380 SAR cash.
      // Gain = 380 - 375 = 5 SAR, credited to the FX account.
      prisma.invoice.findFirst.mockResolvedValue(usdInvoice);
      prisma.financeSettings.findUnique.mockResolvedValue({
        defaultCashAccountId: 'acc-cash',
        defaultReceivableAccountId: 'acc-ar',
        defaultFxGainLossAccountId: 'acc-fx',
      });
      prisma.journalEntry.create.mockResolvedValue({ id: 'je-1' });
      prisma.payment.create.mockResolvedValue({ id: 'pay-1' });
      prisma.invoice.update.mockResolvedValue({ id: 'inv-1' });

      await service.create('company-1', 'user-1', {
        invoiceId: 'inv-1',
        amount: 100,
        paymentDate: '2026-06-01',
        method: 'bank_transfer',
        exchangeRateToBase: 3.8,
      } as any);

      const lines = prisma.journalEntry.create.mock.calls[0][0].data.lines.create;
      expect(lines).toHaveLength(3);
      expect(lines[0].debit.toString()).toBe('380');
      expect(lines[1].credit.toString()).toBe('375');
      const fxLine = lines.find((l: any) => l.accountId === 'acc-fx');
      expect(fxLine.credit.toString()).toBe('5');
      expect(fxLine.debit).toBe(0);
    });

    it('posts a realized FX LOSS when the payment rate is LOWER than the invoice rate', async () => {
      // Invoice booked at 3.75 SAR/USD → $100 = 375 SAR receivable.
      // Payment received at 3.70 SAR/USD → $100 = 370 SAR cash.
      // Loss = 375 - 370 = 5 SAR, debited to the FX account.
      prisma.invoice.findFirst.mockResolvedValue(usdInvoice);
      prisma.financeSettings.findUnique.mockResolvedValue({
        defaultCashAccountId: 'acc-cash',
        defaultReceivableAccountId: 'acc-ar',
        defaultFxGainLossAccountId: 'acc-fx',
      });
      prisma.journalEntry.create.mockResolvedValue({ id: 'je-1' });
      prisma.payment.create.mockResolvedValue({ id: 'pay-1' });
      prisma.invoice.update.mockResolvedValue({ id: 'inv-1' });

      await service.create('company-1', 'user-1', {
        invoiceId: 'inv-1',
        amount: 100,
        paymentDate: '2026-06-01',
        method: 'bank_transfer',
        exchangeRateToBase: 3.7,
      } as any);

      const lines = prisma.journalEntry.create.mock.calls[0][0].data.lines.create;
      expect(lines).toHaveLength(3);
      const fxLine = lines.find((l: any) => l.accountId === 'acc-fx');
      expect(fxLine.debit.toString()).toBe('5');
      expect(fxLine.credit).toBe(0);
    });

    it('rejects the payment when there IS a real FX difference but no FX Gain/Loss account is configured, stating the exact amount', async () => {
      prisma.invoice.findFirst.mockResolvedValue(usdInvoice);
      prisma.financeSettings.findUnique.mockResolvedValue({ defaultCashAccountId: 'acc-cash', defaultReceivableAccountId: 'acc-ar' });

      await expect(
        service.create('company-1', 'user-1', {
          invoiceId: 'inv-1',
          amount: 100,
          paymentDate: '2026-06-01',
          method: 'bank_transfer',
          exchangeRateToBase: 3.8,
        } as any),
      ).rejects.toThrow(/gain of 5/);
    });

    it('every journal entry, gain or loss, still balances exactly (debits equal credits)', async () => {
      prisma.invoice.findFirst.mockResolvedValue(usdInvoice);
      prisma.financeSettings.findUnique.mockResolvedValue({
        defaultCashAccountId: 'acc-cash',
        defaultReceivableAccountId: 'acc-ar',
        defaultFxGainLossAccountId: 'acc-fx',
      });
      prisma.journalEntry.create.mockResolvedValue({ id: 'je-1' });
      prisma.payment.create.mockResolvedValue({ id: 'pay-1' });
      prisma.invoice.update.mockResolvedValue({ id: 'inv-1' });

      await service.create('company-1', 'user-1', {
        invoiceId: 'inv-1',
        amount: 100,
        paymentDate: '2026-06-01',
        method: 'bank_transfer',
        exchangeRateToBase: 3.7,
      } as any);

      const lines = prisma.journalEntry.create.mock.calls[0][0].data.lines.create;
      const totalDebit = lines.reduce((s: number, l: any) => s + Number(l.debit || 0), 0);
      const totalCredit = lines.reduce((s: number, l: any) => s + Number(l.credit || 0), 0);
      expect(totalDebit).toBe(totalCredit);
    });
  });
});
