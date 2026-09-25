import { Test } from '@nestjs/testing';
import { UnprocessableEntityException } from '@nestjs/common';
import { PeriodLockService } from './period-lock.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('PeriodLockService', () => {
  let service: PeriodLockService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      accountingPeriod: {
        findFirst: jest.fn(),
      },
    };

    const moduleRef = await Test.createTestingModule({
      providers: [PeriodLockService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = moduleRef.get(PeriodLockService);
  });

  it('does nothing (resolves) when no locked period covers the given date', async () => {
    prisma.accountingPeriod.findFirst.mockResolvedValue(null);
    await expect(service.assertDateNotLocked('company-1', new Date('2026-06-15'))).resolves.toBeUndefined();
  });

  it('throws UnprocessableEntityException naming the period when the date falls inside a locked period', async () => {
    prisma.accountingPeriod.findFirst.mockResolvedValue({
      id: 'period-1',
      name: 'January 2026',
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-01-31'),
      status: 'locked',
    });

    await expect(service.assertDateNotLocked('company-1', new Date('2026-01-15'))).rejects.toThrow(
      UnprocessableEntityException,
    );
  });

  it('includes the period name and date range in the error message', async () => {
    prisma.accountingPeriod.findFirst.mockResolvedValue({
      id: 'period-1',
      name: 'January 2026',
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-01-31'),
      status: 'locked',
    });

    await expect(service.assertDateNotLocked('company-1', new Date('2026-01-15'))).rejects.toThrow(
      /January 2026/,
    );
  });

  it('scopes the lookup to the caller company and only to locked periods, with the date inside the [startDate, endDate] range', async () => {
    prisma.accountingPeriod.findFirst.mockResolvedValue(null);
    const date = new Date('2026-06-15');

    await service.assertDateNotLocked('company-1', date);

    expect(prisma.accountingPeriod.findFirst).toHaveBeenCalledWith({
      where: {
        companyId: 'company-1',
        status: 'locked',
        startDate: { lte: date },
        endDate: { gte: date },
      },
    });
  });
});
