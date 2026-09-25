import { Test } from '@nestjs/testing';
import { NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { DepreciationRunsService } from './depreciation-runs.service';
import { PeriodLockService } from '../finance/period-lock.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('DepreciationRunsService', () => {
  let service: DepreciationRunsService;
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
      depreciationRun: { findUnique: jest.fn(), findFirst: jest.fn(), findMany: jest.fn(), create: jest.fn() },
      fixedAsset: { findMany: jest.fn(), update: jest.fn() },
      journalEntry: { create: jest.fn(), count: jest.fn().mockResolvedValue(0), findFirst: jest.fn() },
    };
    prisma.$transaction = mockTransaction(prisma);

    periodLock = { assertDateNotLocked: jest.fn().mockResolvedValue(undefined) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        DepreciationRunsService,
        { provide: PrismaService, useValue: prisma },
        { provide: PeriodLockService, useValue: periodLock },
      ],
    }).compile();

    service = moduleRef.get(DepreciationRunsService);
  });

  const baseAsset = {
    id: 'asset-1',
    assetNumber: 'AST-2026-0001',
    name: 'Delivery Van',
    purchaseDate: new Date('2025-01-01'),
    purchaseCost: '60000.00',
    salvageValue: '0.00',
    usefulLifeMonths: 60,
    accumulatedDepreciation: '0.00',
    status: 'active',
    fixedAssetAccountId: 'acc-asset',
    accumulatedDepreciationAccountId: 'acc-accum',
    depreciationExpenseAccountId: 'acc-expense',
  };

  describe('create', () => {
    it('rejects creating a second run for the same month/year', async () => {
      prisma.depreciationRun.findUnique.mockResolvedValue({ id: 'existing' });

      await expect(service.create('company-1', 'user-1', { month: 6, year: 2026 })).rejects.toThrow(UnprocessableEntityException);
    });

    it('skips an asset missing any of its three required accounts, listing it by name', async () => {
      prisma.depreciationRun.findUnique.mockResolvedValue(null);
      prisma.fixedAsset.findMany.mockResolvedValue([{ ...baseAsset, depreciationExpenseAccountId: null }]);

      await expect(service.create('company-1', 'user-1', { month: 6, year: 2026 })).rejects.toThrow(UnprocessableEntityException);
    });

    it('computes straight-line monthly depreciation correctly: (cost - salvage) / usefulLifeMonths', async () => {
      prisma.depreciationRun.findUnique.mockResolvedValue(null);
      prisma.fixedAsset.findMany.mockResolvedValue([baseAsset]);
      prisma.journalEntry.create.mockResolvedValue({ id: 'je-1' });
      prisma.depreciationRun.create.mockResolvedValue({ id: 'run-1', entries: [] });
      prisma.fixedAsset.update.mockResolvedValue({ id: 'asset-1' });

      await service.create('company-1', 'user-1', { month: 6, year: 2026 });

      const createCall = prisma.depreciationRun.create.mock.calls[0][0];
      const entry = createCall.data.entries.create[0];
      expect(entry.depreciationAmount.toString()).toBe('1000');
    });

    it('caps the depreciation amount at the remaining depreciable balance, never overshooting salvage value', async () => {
      const almostDoneAsset = { ...baseAsset, accumulatedDepreciation: '59700.00' };
      prisma.depreciationRun.findUnique.mockResolvedValue(null);
      prisma.fixedAsset.findMany.mockResolvedValue([almostDoneAsset]);
      prisma.journalEntry.create.mockResolvedValue({ id: 'je-1' });
      prisma.depreciationRun.create.mockResolvedValue({ id: 'run-1', entries: [] });
      prisma.fixedAsset.update.mockResolvedValue({ id: 'asset-1' });

      await service.create('company-1', 'user-1', { month: 6, year: 2026 });

      const createCall = prisma.depreciationRun.create.mock.calls[0][0];
      const entry = createCall.data.entries.create[0];
      expect(entry.depreciationAmount.toString()).toBe('300');

      const updateCall = prisma.fixedAsset.update.mock.calls[0][0];
      expect(updateCall.data.status).toBe('fully_depreciated');
    });

    it('rejects when NO active asset is eligible (all fully depreciated or misconfigured)', async () => {
      const doneAsset = { ...baseAsset, accumulatedDepreciation: '60000.00' };
      prisma.depreciationRun.findUnique.mockResolvedValue(null);
      prisma.fixedAsset.findMany.mockResolvedValue([doneAsset]);

      await expect(service.create('company-1', 'user-1', { month: 6, year: 2026 })).rejects.toThrow(UnprocessableEntityException);
    });

    it('groups multiple assets sharing the SAME accounts into one combined journal line, not one line per asset', async () => {
      const asset2 = { ...baseAsset, id: 'asset-2', assetNumber: 'AST-2026-0002', purchaseCost: '30000.00', usefulLifeMonths: 30 };
      prisma.depreciationRun.findUnique.mockResolvedValue(null);
      prisma.fixedAsset.findMany.mockResolvedValue([baseAsset, asset2]);
      prisma.journalEntry.create.mockResolvedValue({ id: 'je-1' });
      prisma.depreciationRun.create.mockResolvedValue({ id: 'run-1', entries: [] });
      prisma.fixedAsset.update.mockResolvedValue({ id: 'asset-1' });

      await service.create('company-1', 'user-1', { month: 6, year: 2026 });

      const lines = prisma.journalEntry.create.mock.calls[0][0].data.lines.create;
      expect(lines).toHaveLength(2);
      expect(lines[0].debit.toString()).toBe('2000');
      expect(lines[1].credit.toString()).toBe('2000');
    });

    it('posts separate lines when assets use DIFFERENT accounts', async () => {
      const asset2 = { ...baseAsset, id: 'asset-2', assetNumber: 'AST-2026-0002', depreciationExpenseAccountId: 'acc-expense-2', accumulatedDepreciationAccountId: 'acc-accum-2' };
      prisma.depreciationRun.findUnique.mockResolvedValue(null);
      prisma.fixedAsset.findMany.mockResolvedValue([baseAsset, asset2]);
      prisma.journalEntry.create.mockResolvedValue({ id: 'je-1' });
      prisma.depreciationRun.create.mockResolvedValue({ id: 'run-1', entries: [] });
      prisma.fixedAsset.update.mockResolvedValue({ id: 'asset-1' });

      await service.create('company-1', 'user-1', { month: 6, year: 2026 });

      const lines = prisma.journalEntry.create.mock.calls[0][0].data.lines.create;
      expect(lines).toHaveLength(4);
    });

    it('checks the period lock using the LAST day of the period', async () => {
      prisma.depreciationRun.findUnique.mockResolvedValue(null);
      prisma.fixedAsset.findMany.mockResolvedValue([baseAsset]);
      prisma.journalEntry.create.mockResolvedValue({ id: 'je-1' });
      prisma.depreciationRun.create.mockResolvedValue({ id: 'run-1', entries: [] });
      prisma.fixedAsset.update.mockResolvedValue({ id: 'asset-1' });

      await service.create('company-1', 'user-1', { month: 6, year: 2026 });

      const calledDate: Date = periodLock.assertDateNotLocked.mock.calls[0][1];
      expect(calledDate.getMonth()).toBe(5);
      expect(calledDate.getDate()).toBe(30);
    });

    it('filters eligible assets by purchaseDate at or before the period end date', async () => {
      prisma.depreciationRun.findUnique.mockResolvedValue(null);
      prisma.fixedAsset.findMany.mockResolvedValue([]);

      await expect(service.create('company-1', 'user-1', { month: 1, year: 2026 })).rejects.toThrow(UnprocessableEntityException);

      const queryCall = prisma.fixedAsset.findMany.mock.calls[0][0];
      expect(queryCall.where.purchaseDate.lte).toBeInstanceOf(Date);
    });
  });

  describe('findOne', () => {
    it('404s when the run does not exist in the caller company', async () => {
      prisma.depreciationRun.findFirst.mockResolvedValue(null);
      await expect(service.findOne('company-1', 'missing')).rejects.toThrow(NotFoundException);
    });
  });
});
