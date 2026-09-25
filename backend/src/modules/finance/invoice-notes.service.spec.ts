import { Test } from '@nestjs/testing';
import { NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { InvoiceNotesService } from './invoice-notes.service';
import { PeriodLockService } from './period-lock.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('InvoiceNotesService', () => {
  let service: InvoiceNotesService;
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
      invoice: { findFirst: jest.fn() },
      invoiceNote: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
      },
      financeSettings: { findUnique: jest.fn() },
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
        InvoiceNotesService,
        { provide: PrismaService, useValue: prisma },
        { provide: PeriodLockService, useValue: periodLock },
      ],
    }).compile();

    service = moduleRef.get(InvoiceNotesService);
  });

  describe('create', () => {
    it('404s when the invoice does not exist in the caller company', async () => {
      prisma.invoice.findFirst.mockResolvedValue(null);

      await expect(
        service.create('company-1', 'user-1', {
          invoiceId: 'missing',
          noteType: 'credit',
          noteDate: '2026-06-01',
          items: [{ description: 'x', quantity: 1, unitPrice: 100 }],
        } as any),
      ).rejects.toThrow(NotFoundException);
    });

    it.each(['draft', 'cancelled'])('rejects issuing a note against an invoice with status %s', async (status) => {
      prisma.invoice.findFirst.mockResolvedValue({ id: 'inv-1', status, total: '1000.00', notes: [] });

      await expect(
        service.create('company-1', 'user-1', {
          invoiceId: 'inv-1',
          noteType: 'credit',
          noteDate: '2026-06-01',
          items: [{ description: 'x', quantity: 1, unitPrice: 100 }],
        } as any),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('rejects a credit note whose total exceeds the invoice total (nothing credited yet)', async () => {
      prisma.invoice.findFirst.mockResolvedValue({ id: 'inv-1', status: 'sent', total: '100.00', notes: [] });

      await expect(
        service.create('company-1', 'user-1', {
          invoiceId: 'inv-1',
          noteType: 'credit',
          noteDate: '2026-06-01',
          items: [{ description: 'Refund', quantity: 1, unitPrice: 500 }],
        } as any),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('rejects a second credit note that would push the total credited past the invoice total', async () => {
      prisma.invoice.findFirst.mockResolvedValue({
        id: 'inv-1',
        status: 'sent',
        total: '1000.00',
        notes: [{ noteType: 'credit', total: '700.00' }],
      });

      await expect(
        service.create('company-1', 'user-1', {
          invoiceId: 'inv-1',
          noteType: 'credit',
          noteDate: '2026-06-01',
          items: [{ description: 'Refund', quantity: 1, unitPrice: 400 }],
        } as any),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('allows a credit note whose total is exactly the remaining creditable amount', async () => {
      prisma.invoice.findFirst.mockResolvedValue({
        id: 'inv-1',
        status: 'sent',
        total: '1000.00',
        notes: [{ noteType: 'credit', total: '700.00' }],
      });
      prisma.invoiceNote.create.mockResolvedValue({ id: 'note-1', status: 'draft' });

      await expect(
        service.create('company-1', 'user-1', {
          invoiceId: 'inv-1',
          noteType: 'credit',
          noteDate: '2026-06-01',
          items: [{ description: 'Refund', quantity: 1, unitPrice: 300 }],
        } as any),
      ).resolves.toBeDefined();
    });

    it('a debit note is not constrained by the same creditable ceiling (it only increases the total)', async () => {
      prisma.invoice.findFirst.mockResolvedValue({ id: 'inv-1', status: 'sent', total: '100.00', notes: [] });
      prisma.invoiceNote.create.mockResolvedValue({ id: 'note-1', status: 'draft' });

      await expect(
        service.create('company-1', 'user-1', {
          invoiceId: 'inv-1',
          noteType: 'debit',
          noteDate: '2026-06-01',
          items: [{ description: 'Additional charge', quantity: 1, unitPrice: 500 }],
        } as any),
      ).resolves.toBeDefined();
    });
  });

  describe('issue', () => {
    const draftCreditNote = {
      id: 'note-1',
      noteType: 'credit',
      status: 'draft',
      noteDate: new Date('2026-06-15'),
      noteNumber: 'CN-2026-0001',
      subtotal: '400.00',
      discount: '0.00',
      tax: '60.00',
      total: '460.00',
      items: [{ id: 'item-1' }],
      invoice: { invoiceNumber: 'INV-2026-0001' },
    };

    it('rejects issuing a note with no items', async () => {
      prisma.invoiceNote.findFirst.mockResolvedValue({ ...draftCreditNote, items: [] });

      await expect(service.issue('company-1', 'user-1', 'note-1')).rejects.toThrow(UnprocessableEntityException);
    });

    it("checks the period lock using the note's noteDate", async () => {
      prisma.invoiceNote.findFirst.mockResolvedValue(draftCreditNote);
      prisma.financeSettings.findUnique.mockResolvedValue({
        defaultReceivableAccountId: 'acc-ar',
        defaultRevenueAccountId: 'acc-rev',
        defaultTaxPayableAccountId: 'acc-tax',
      });
      prisma.journalEntry.create.mockResolvedValue({ id: 'je-1' });
      prisma.invoiceNote.update.mockResolvedValue({ id: 'note-1', status: 'issued' });

      await service.issue('company-1', 'user-1', 'note-1');

      expect(periodLock.assertDateNotLocked).toHaveBeenCalledWith('company-1', draftCreditNote.noteDate);
    });

    it('posts a credit note as debit Revenue + Tax, credit AR (reverse of an invoice issue)', async () => {
      prisma.invoiceNote.findFirst.mockResolvedValue(draftCreditNote);
      prisma.financeSettings.findUnique.mockResolvedValue({
        defaultReceivableAccountId: 'acc-ar',
        defaultRevenueAccountId: 'acc-rev',
        defaultTaxPayableAccountId: 'acc-tax',
      });
      prisma.journalEntry.create.mockResolvedValue({ id: 'je-1' });
      prisma.invoiceNote.update.mockResolvedValue({ id: 'note-1', status: 'issued' });

      await service.issue('company-1', 'user-1', 'note-1');

      const lines = prisma.journalEntry.create.mock.calls[0][0].data.lines.create;
      expect(lines).toHaveLength(3);
      expect(lines[0].accountId).toBe('acc-rev');
      expect(lines[0].debit.toString()).toBe('400');
      expect(lines[2].accountId).toBe('acc-ar');
      expect(lines[2].credit.toString()).toBe('460');
    });

    it('posts a debit note as debit AR, credit Revenue + Tax (same direction as an invoice issue)', async () => {
      const draftDebitNote = { ...draftCreditNote, noteType: 'debit' };
      prisma.invoiceNote.findFirst.mockResolvedValue(draftDebitNote);
      prisma.financeSettings.findUnique.mockResolvedValue({
        defaultReceivableAccountId: 'acc-ar',
        defaultRevenueAccountId: 'acc-rev',
        defaultTaxPayableAccountId: 'acc-tax',
      });
      prisma.journalEntry.create.mockResolvedValue({ id: 'je-1' });
      prisma.invoiceNote.update.mockResolvedValue({ id: 'note-1', status: 'issued' });

      await service.issue('company-1', 'user-1', 'note-1');

      const lines = prisma.journalEntry.create.mock.calls[0][0].data.lines.create;
      expect(lines[0].accountId).toBe('acc-ar');
      expect(lines[0].debit.toString()).toBe('460');
      expect(lines[1].accountId).toBe('acc-rev');
      expect(lines[1].credit.toString()).toBe('400');
    });

    it('rejects issuing a note that is not a draft', async () => {
      prisma.invoiceNote.findFirst.mockResolvedValue({ ...draftCreditNote, status: 'issued' });

      await expect(service.issue('company-1', 'user-1', 'note-1')).rejects.toThrow(UnprocessableEntityException);
    });
  });

  describe('cancel', () => {
    it('rejects cancelling a note that is not a draft', async () => {
      prisma.invoiceNote.findFirst.mockResolvedValue({ id: 'note-1', status: 'issued', items: [], invoice: {} });

      await expect(service.cancel('company-1', 'note-1')).rejects.toThrow(UnprocessableEntityException);
    });
  });
});
