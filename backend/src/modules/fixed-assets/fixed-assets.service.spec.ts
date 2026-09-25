import { Test } from '@nestjs/testing';
import { NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { FixedAssetsService } from './fixed-assets.service';
import { PrismaService } from '../../prisma/prisma.service';
import { PeriodLockService } from '../finance/period-lock.service';

describe('FixedAssetsService', () => {
  let service: FixedAssetsService;
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
      fixedAsset: { create: jest.fn(), findFirst: jest.fn(), findMany: jest.fn(), update: jest.fn(), count: jest.fn().mockResolvedValue(0) },
      financeSettings: { findUnique: jest.fn() },
      journalEntry: { create: jest.fn(), count: jest.fn().mockResolvedValue(0), findFirst: jest.fn().mockResolvedValue(null) },
    };
    prisma.$transaction = mockTransaction(prisma);
    periodLock = { assertDateNotLocked: jest.fn().mockResolvedValue(undefined) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        FixedAssetsService,
        { provide: PrismaService, useValue: prisma },
        { provide: PeriodLockService, useValue: periodLock },
      ],
    }).compile();

    service = moduleRef.get(FixedAssetsService);
  });

  describe('create', () => {
    it('rejects a salvage value greater than or equal to purchase cost', async () => {
      await expect(
        service.create('company-1', 'user-1', { name: 'Van', purchaseDate: '2026-01-01', purchaseCost: 50000, salvageValue: 50000, usefulLifeMonths: 60 } as any),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('generates a sequential AST-YYYY-NNNN asset number', async () => {
      prisma.fixedAsset.count.mockResolvedValue(2);
      prisma.fixedAsset.findFirst.mockResolvedValue(null);
      prisma.fixedAsset.create.mockResolvedValue({ id: 'asset-1' });

      await service.create('company-1', 'user-1', { name: 'Laptop', purchaseDate: '2026-01-01', purchaseCost: 5000, usefulLifeMonths: 36 } as any);

      const call = prisma.fixedAsset.create.mock.calls[0][0];
      expect(call.data.assetNumber).toMatch(/^AST-\d{4}-0003$/);
    });
  });

  describe('dispose — real accounting', () => {
    const activeAssetBase = {
      id: 'asset-1',
      assetNumber: 'AST-2026-0001',
      name: 'Delivery Van',
      status: 'active',
      purchaseCost: '100000.00',
      accumulatedDepreciation: '40000.00', // NBV = 60,000
      fixedAssetAccountId: 'acc-asset',
      accumulatedDepreciationAccountId: 'acc-accum-dep',
    };
    const financeSettingsFull = {
      defaultCashAccountId: 'acc-cash',
      defaultAssetDisposalGainLossAccountId: 'acc-disposal-gainloss',
    };

    it('rejects disposing an asset that is already disposed', async () => {
      prisma.fixedAsset.findFirst.mockResolvedValue({ ...activeAssetBase, status: 'disposed' });
      await expect(service.dispose('company-1', 'user-1', 'asset-1', { disposalDate: '2026-06-01' })).rejects.toThrow(
        UnprocessableEntityException,
      );
    });

    it('rejects disposal when the asset has no fixedAssetAccountId/accumulatedDepreciationAccountId configured', async () => {
      prisma.fixedAsset.findFirst.mockResolvedValue({ ...activeAssetBase, fixedAssetAccountId: null });
      await expect(service.dispose('company-1', 'user-1', 'asset-1', { disposalDate: '2026-06-01' })).rejects.toThrow(
        UnprocessableEntityException,
      );
    });

    it('rejects a disposal with proceeds when no default Cash account is configured', async () => {
      prisma.fixedAsset.findFirst.mockResolvedValue(activeAssetBase);
      prisma.financeSettings.findUnique.mockResolvedValue({ defaultAssetDisposalGainLossAccountId: 'acc-disposal-gainloss' });
      await expect(
        service.dispose('company-1', 'user-1', 'asset-1', { disposalDate: '2026-06-01', disposalProceeds: 60000 }),
      ).rejects.toThrow(/default Cash account/);
    });

    it('rejects a disposal producing a real gain/loss when no disposal gain/loss account is configured', async () => {
      prisma.fixedAsset.findFirst.mockResolvedValue(activeAssetBase);
      prisma.financeSettings.findUnique.mockResolvedValue({ defaultCashAccountId: 'acc-cash' });
      await expect(
        service.dispose('company-1', 'user-1', 'asset-1', { disposalDate: '2026-06-01', disposalProceeds: 70000 }),
      ).rejects.toThrow(/Asset Disposal Gain\/Loss account/);
    });

    it('checks the period lock using the disposal date', async () => {
      prisma.fixedAsset.findFirst.mockResolvedValue(activeAssetBase);
      prisma.financeSettings.findUnique.mockResolvedValue(financeSettingsFull);
      prisma.journalEntry.create.mockResolvedValue({ id: 'je-1' });
      prisma.fixedAsset.update.mockResolvedValue({ id: 'asset-1', status: 'disposed' });

      await service.dispose('company-1', 'user-1', 'asset-1', { disposalDate: '2026-06-15', disposalProceeds: 60000 });

      expect(periodLock.assertDateNotLocked).toHaveBeenCalledWith('company-1', new Date('2026-06-15'));
    });

    it('GAIN case: proceeds (70,000) > NBV (60,000) — credits the gain/loss account for the difference (10,000), and the entry balances', async () => {
      prisma.fixedAsset.findFirst.mockResolvedValue(activeAssetBase);
      prisma.financeSettings.findUnique.mockResolvedValue(financeSettingsFull);
      prisma.journalEntry.create.mockResolvedValue({ id: 'je-1' });
      prisma.fixedAsset.update.mockResolvedValue({ id: 'asset-1', status: 'disposed' });

      await service.dispose('company-1', 'user-1', 'asset-1', { disposalDate: '2026-06-01', disposalProceeds: 70000 });

      const lines = prisma.journalEntry.create.mock.calls[0][0].data.lines.create;
      // Credit asset (100,000) + Debit accum. dep (40,000) + Debit cash (70,000) = Credit gain (10,000) to balance
      const totalDebit = lines.reduce((s: number, l: any) => s + Number(l.debit || 0), 0);
      const totalCredit = lines.reduce((s: number, l: any) => s + Number(l.credit || 0), 0);
      expect(totalDebit).toBe(totalCredit);
      expect(totalDebit).toBe(110000); // 40,000 accum dep + 70,000 cash

      const gainLine = lines.find((l: any) => l.accountId === 'acc-disposal-gainloss');
      expect(gainLine.credit.toString()).toBe('10000');
      expect(gainLine.debit).toBe(0);
    });

    it('LOSS case: proceeds (30,000) < NBV (60,000) — debits the gain/loss account for the difference (30,000), and the entry balances', async () => {
      prisma.fixedAsset.findFirst.mockResolvedValue(activeAssetBase);
      prisma.financeSettings.findUnique.mockResolvedValue(financeSettingsFull);
      prisma.journalEntry.create.mockResolvedValue({ id: 'je-1' });
      prisma.fixedAsset.update.mockResolvedValue({ id: 'asset-1', status: 'disposed' });

      await service.dispose('company-1', 'user-1', 'asset-1', { disposalDate: '2026-06-01', disposalProceeds: 30000 });

      const lines = prisma.journalEntry.create.mock.calls[0][0].data.lines.create;
      const totalDebit = lines.reduce((s: number, l: any) => s + Number(l.debit || 0), 0);
      const totalCredit = lines.reduce((s: number, l: any) => s + Number(l.credit || 0), 0);
      expect(totalDebit).toBe(totalCredit);

      const lossLine = lines.find((l: any) => l.accountId === 'acc-disposal-gainloss');
      expect(lossLine.debit.toString()).toBe('30000');
      expect(lossLine.credit).toBe(0);
    });

    it('ZERO gain/loss case: proceeds exactly equal NBV — no gain/loss line at all, and no gain/loss account is required', async () => {
      prisma.fixedAsset.findFirst.mockResolvedValue(activeAssetBase);
      prisma.financeSettings.findUnique.mockResolvedValue({ defaultCashAccountId: 'acc-cash' }); // no disposal gain/loss account configured
      prisma.journalEntry.create.mockResolvedValue({ id: 'je-1' });
      prisma.fixedAsset.update.mockResolvedValue({ id: 'asset-1', status: 'disposed' });

      await service.dispose('company-1', 'user-1', 'asset-1', { disposalDate: '2026-06-01', disposalProceeds: 60000 });

      const lines = prisma.journalEntry.create.mock.calls[0][0].data.lines.create;
      expect(lines).toHaveLength(3); // asset, accum dep, cash — no gain/loss line
      const totalDebit = lines.reduce((s: number, l: any) => s + Number(l.debit || 0), 0);
      const totalCredit = lines.reduce((s: number, l: any) => s + Number(l.credit || 0), 0);
      expect(totalDebit).toBe(totalCredit);
    });

    it('scrapped-with-zero-proceeds case: no cash line, full NBV recognized as a loss', async () => {
      prisma.fixedAsset.findFirst.mockResolvedValue(activeAssetBase);
      prisma.financeSettings.findUnique.mockResolvedValue(financeSettingsFull);
      prisma.journalEntry.create.mockResolvedValue({ id: 'je-1' });
      prisma.fixedAsset.update.mockResolvedValue({ id: 'asset-1', status: 'disposed' });

      await service.dispose('company-1', 'user-1', 'asset-1', { disposalDate: '2026-06-01' }); // no disposalProceeds at all

      const lines = prisma.journalEntry.create.mock.calls[0][0].data.lines.create;
      expect(lines.some((l: any) => l.accountId === 'acc-cash')).toBe(false);
      const lossLine = lines.find((l: any) => l.accountId === 'acc-disposal-gainloss');
      expect(lossLine.debit.toString()).toBe('60000'); // the full NBV is the loss
    });

    it('links the disposal journal entry back onto the asset record', async () => {
      prisma.fixedAsset.findFirst.mockResolvedValue(activeAssetBase);
      prisma.financeSettings.findUnique.mockResolvedValue(financeSettingsFull);
      prisma.journalEntry.create.mockResolvedValue({ id: 'je-42' });
      prisma.fixedAsset.update.mockResolvedValue({ id: 'asset-1', status: 'disposed' });

      await service.dispose('company-1', 'user-1', 'asset-1', { disposalDate: '2026-06-01', disposalProceeds: 60000 });

      const updateCall = prisma.fixedAsset.update.mock.calls[0][0];
      expect(updateCall.data.disposalJournalEntryId).toBe('je-42');
      expect(updateCall.data.status).toBe('disposed');
      expect(updateCall.data.disposedAt).toBeInstanceOf(Date);
    });
  });

  describe('softDelete', () => {
    it('rejects deleting an asset that already has depreciation posted', async () => {
      prisma.fixedAsset.findFirst.mockResolvedValue({ id: 'asset-1', accumulatedDepreciation: '500.00' });

      await expect(service.softDelete('company-1', 'asset-1')).rejects.toThrow(UnprocessableEntityException);
    });

    it('allows deleting an asset with zero accumulated depreciation', async () => {
      prisma.fixedAsset.findFirst.mockResolvedValue({ id: 'asset-1', accumulatedDepreciation: '0.00' });
      prisma.fixedAsset.update.mockResolvedValue({ id: 'asset-1', deletedAt: new Date() });

      await expect(service.softDelete('company-1', 'asset-1')).resolves.toBeDefined();
    });
  });

  describe('findOne', () => {
    it('404s when the asset does not exist in the caller company', async () => {
      prisma.fixedAsset.findFirst.mockResolvedValue(null);
      await expect(service.findOne('company-1', 'missing')).rejects.toThrow(NotFoundException);
    });
  });
});
