import { Test } from '@nestjs/testing';
import { ConflictException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { BankReconciliationsService } from './bank-reconciliations.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('BankReconciliationsService', () => {
  let service: BankReconciliationsService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      account: { findFirst: jest.fn() },
      bankReconciliation: { findUnique: jest.fn(), findFirst: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn() },
      bankStatementLine: { create: jest.fn(), delete: jest.fn(), update: jest.fn() },
      journalEntryLine: { findMany: jest.fn(), findFirst: jest.fn(), aggregate: jest.fn() },
    };

    const moduleRef = await Test.createTestingModule({
      providers: [BankReconciliationsService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = moduleRef.get(BankReconciliationsService);
  });

  describe('create', () => {
    it('404s when the bank account does not belong to the caller company', async () => {
      prisma.account.findFirst.mockResolvedValue(null);

      await expect(
        service.create('company-1', 'user-1', { bankAccountId: 'other-account', statementDate: '2026-06-30', statementEndingBalance: 1000 }),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects a duplicate reconciliation for the same account and statement date', async () => {
      prisma.account.findFirst.mockResolvedValue({ id: 'acc-1' });
      prisma.bankReconciliation.findUnique.mockResolvedValue({ id: 'existing' });

      await expect(
        service.create('company-1', 'user-1', { bankAccountId: 'acc-1', statementDate: '2026-06-30', statementEndingBalance: 1000 }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('statement line mutability', () => {
    const inProgressRecon = { id: 'recon-1', status: 'in_progress', bankAccountId: 'acc-1', statementLines: [{ id: 'line-1', matchedJournalEntryLineId: null }] };
    const completedRecon = { ...inProgressRecon, status: 'completed' };

    it('rejects adding a statement line to a completed reconciliation', async () => {
      prisma.bankReconciliation.findFirst.mockResolvedValue(completedRecon);

      await expect(
        service.addStatementLine('company-1', 'recon-1', { transactionDate: '2026-06-15', description: 'Deposit', amount: 500 }),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('allows adding a statement line to an in-progress reconciliation', async () => {
      prisma.bankReconciliation.findFirst.mockResolvedValue(inProgressRecon);
      prisma.bankStatementLine.create.mockResolvedValue({ id: 'line-2' });

      await expect(
        service.addStatementLine('company-1', 'recon-1', { transactionDate: '2026-06-15', description: 'Deposit', amount: 500 }),
      ).resolves.toBeDefined();
    });

    it('rejects removing a statement line from a completed reconciliation', async () => {
      prisma.bankReconciliation.findFirst.mockResolvedValue(completedRecon);

      await expect(service.removeStatementLine('company-1', 'recon-1', 'line-1')).rejects.toThrow(UnprocessableEntityException);
    });
  });

  describe('autoMatch', () => {
    it('matches a statement line to the SINGLE unmatched ledger line with the exact same net amount', async () => {
      const recon = {
        id: 'recon-1', status: 'in_progress', bankAccountId: 'acc-1', statementDate: new Date('2026-06-30'),
        statementLines: [{ id: 'st-1', amount: '500.00', matchedJournalEntryLineId: null }],
      };
      prisma.bankReconciliation.findFirst.mockResolvedValue(recon);
      prisma.journalEntryLine.findMany.mockResolvedValue([{ id: 'ledger-1', debit: '500.00', credit: '0.00' }]);
      prisma.bankStatementLine.update.mockResolvedValue({ id: 'st-1' });

      const result = await service.autoMatch('company-1', 'recon-1');

      expect(result.matchedCount).toBe(1);
      expect(prisma.bankStatementLine.update).toHaveBeenCalledWith({ where: { id: 'st-1' }, data: { matchedJournalEntryLineId: 'ledger-1' } });
    });

    it('does NOT auto-match when multiple ledger lines share the same amount (ambiguous)', async () => {
      const recon = {
        id: 'recon-1', status: 'in_progress', bankAccountId: 'acc-1', statementDate: new Date('2026-06-30'),
        statementLines: [{ id: 'st-1', amount: '500.00', matchedJournalEntryLineId: null }],
      };
      prisma.bankReconciliation.findFirst.mockResolvedValue(recon);
      prisma.journalEntryLine.findMany.mockResolvedValue([
        { id: 'ledger-1', debit: '500.00', credit: '0.00' },
        { id: 'ledger-2', debit: '500.00', credit: '0.00' },
      ]);

      const result = await service.autoMatch('company-1', 'recon-1');

      expect(result.matchedCount).toBe(0);
      expect(prisma.bankStatementLine.update).not.toHaveBeenCalled();
    });
  });

  describe('matchLine', () => {
    it('rejects matching a statement line that is already matched', async () => {
      const recon = { id: 'recon-1', status: 'in_progress', bankAccountId: 'acc-1', statementLines: [{ id: 'st-1', matchedJournalEntryLineId: 'already-matched' }] };
      prisma.bankReconciliation.findFirst.mockResolvedValue(recon);

      await expect(service.matchLine('company-1', 'recon-1', 'st-1', { journalEntryLineId: 'ledger-1' })).rejects.toThrow(
        UnprocessableEntityException,
      );
    });

    it('404s when the ledger line is already matched elsewhere or on a different account', async () => {
      const recon = { id: 'recon-1', status: 'in_progress', bankAccountId: 'acc-1', statementLines: [{ id: 'st-1', matchedJournalEntryLineId: null }] };
      prisma.bankReconciliation.findFirst.mockResolvedValue(recon);
      prisma.journalEntryLine.findFirst.mockResolvedValue(null);

      await expect(service.matchLine('company-1', 'recon-1', 'st-1', { journalEntryLineId: 'ledger-1' })).rejects.toThrow(NotFoundException);
    });
  });

  describe('complete', () => {
    const baseRecon = {
      id: 'recon-1',
      status: 'in_progress',
      bankAccountId: 'acc-1',
      statementDate: new Date('2026-06-30'),
      statementEndingBalance: '10000.00',
    };

    it('rejects completing a reconciliation that already completed', async () => {
      prisma.bankReconciliation.findFirst.mockResolvedValue({ ...baseRecon, status: 'completed', statementLines: [] });

      await expect(service.complete('company-1', 'recon-1')).rejects.toThrow(UnprocessableEntityException);
    });

    it('completes successfully when adjusted bank balance exactly equals adjusted book balance', async () => {
      prisma.bankReconciliation.findFirst.mockResolvedValue({ ...baseRecon, statementEndingBalance: '10000.00', statementLines: [] });
      prisma.journalEntryLine.aggregate.mockResolvedValue({ _sum: { debit: '10000.00', credit: '0.00' } });
      prisma.journalEntryLine.findMany.mockResolvedValue([]);
      prisma.bankReconciliation.update.mockResolvedValue({ id: 'recon-1', status: 'completed' });

      await expect(service.complete('company-1', 'recon-1')).resolves.toBeDefined();

      const call = prisma.bankReconciliation.update.mock.calls[0][0];
      expect(call.data.status).toBe('completed');
      expect(call.data.bookBalance.toString()).toBe('10000');
    });

    it('correctly accounts for an outstanding check (unmatched ledger line) and still balances', async () => {
      prisma.bankReconciliation.findFirst.mockResolvedValue({ ...baseRecon, statementEndingBalance: '10000.00', statementLines: [] });
      prisma.journalEntryLine.aggregate.mockResolvedValue({ _sum: { debit: '10000.00', credit: '300.00' } });
      prisma.journalEntryLine.findMany.mockResolvedValue([{ id: 'ledger-check', debit: '0.00', credit: '300.00' }]);
      prisma.bankReconciliation.update.mockResolvedValue({ id: 'recon-1', status: 'completed' });

      await expect(service.complete('company-1', 'recon-1')).resolves.toBeDefined();
    });

    it('rejects completion when there is a genuine unexplained variance, with the exact amount in the error message', async () => {
      prisma.bankReconciliation.findFirst.mockResolvedValue({ ...baseRecon, statementEndingBalance: '10500.00', statementLines: [] });
      prisma.journalEntryLine.aggregate.mockResolvedValue({ _sum: { debit: '10000.00', credit: '0.00' } });
      prisma.journalEntryLine.findMany.mockResolvedValue([]);

      await expect(service.complete('company-1', 'recon-1')).rejects.toThrow(UnprocessableEntityException);
      await expect(service.complete('company-1', 'recon-1')).rejects.toThrow(/variance of 500/);
    });

    it('accounts for an unmatched STATEMENT line (e.g. unrecorded bank interest) correctly', async () => {
      prisma.bankReconciliation.findFirst.mockResolvedValue({
        ...baseRecon,
        statementEndingBalance: '10200.00',
        statementLines: [{ id: 'st-interest', amount: '200.00', matchedJournalEntryLineId: null }],
      });
      prisma.journalEntryLine.aggregate.mockResolvedValue({ _sum: { debit: '10000.00', credit: '0.00' } });
      prisma.journalEntryLine.findMany.mockResolvedValue([]);
      prisma.bankReconciliation.update.mockResolvedValue({ id: 'recon-1', status: 'completed' });

      await expect(service.complete('company-1', 'recon-1')).resolves.toBeDefined();
    });
  });

  describe('findOne', () => {
    it('404s when the reconciliation does not exist in the caller company', async () => {
      prisma.bankReconciliation.findFirst.mockResolvedValue(null);
      await expect(service.findOne('company-1', 'missing')).rejects.toThrow(NotFoundException);
    });
  });
});
