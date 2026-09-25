import { Test } from '@nestjs/testing';
import { BadRequestException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { PeriodsService } from './periods.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('PeriodsService', () => {
  let service: PeriodsService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      accountingPeriod: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };

    const moduleRef = await Test.createTestingModule({
      providers: [PeriodsService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = moduleRef.get(PeriodsService);
  });

  describe('create', () => {
    it('rejects an endDate before startDate', async () => {
      await expect(
        service.create('company-1', { name: 'Bad Range', startDate: '2026-02-01', endDate: '2026-01-01' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects a date range that overlaps an existing period', async () => {
      prisma.accountingPeriod.findFirst.mockResolvedValue({ id: 'existing', name: 'January 2026' });

      await expect(
        service.create('company-1', { name: 'Overlap', startDate: '2026-01-15', endDate: '2026-02-15' }),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('creates the period when the range is valid and does not overlap anything', async () => {
      prisma.accountingPeriod.findFirst.mockResolvedValue(null);
      prisma.accountingPeriod.create.mockResolvedValue({ id: 'period-1', name: 'January 2026', status: 'open' });

      const result = await service.create('company-1', { name: 'January 2026', startDate: '2026-01-01', endDate: '2026-01-31' });

      expect(result.status).toBe('open');
    });
  });

  describe('findOne', () => {
    it('404s when the period does not exist in the caller company', async () => {
      prisma.accountingPeriod.findFirst.mockResolvedValue(null);
      await expect(service.findOne('company-1', 'missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('lock', () => {
    it('rejects locking a period that is already locked', async () => {
      prisma.accountingPeriod.findFirst.mockResolvedValue({ id: 'period-1', status: 'locked' });

      await expect(service.lock('company-1', 'user-1', 'period-1')).rejects.toThrow(UnprocessableEntityException);
    });

    it('locks an open period, recording who locked it and when', async () => {
      prisma.accountingPeriod.findFirst.mockResolvedValue({ id: 'period-1', status: 'open' });
      prisma.accountingPeriod.update.mockResolvedValue({ id: 'period-1', status: 'locked' });

      await service.lock('company-1', 'user-1', 'period-1');

      expect(prisma.accountingPeriod.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'locked', lockedBy: 'user-1', lockedAt: expect.any(Date) }),
        }),
      );
    });
  });

  describe('unlock', () => {
    it('rejects unlocking a period that is not locked', async () => {
      prisma.accountingPeriod.findFirst.mockResolvedValue({ id: 'period-1', status: 'open' });

      await expect(service.unlock('company-1', 'period-1')).rejects.toThrow(UnprocessableEntityException);
    });

    it('unlocks a locked period, clearing lockedAt/lockedBy', async () => {
      prisma.accountingPeriod.findFirst.mockResolvedValue({ id: 'period-1', status: 'locked' });
      prisma.accountingPeriod.update.mockResolvedValue({ id: 'period-1', status: 'open' });

      await service.unlock('company-1', 'period-1');

      expect(prisma.accountingPeriod.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: 'open', lockedAt: null, lockedBy: null } }),
      );
    });
  });
});
