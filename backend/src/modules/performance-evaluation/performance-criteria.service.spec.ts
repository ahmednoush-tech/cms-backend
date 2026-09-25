import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { PerformanceCriteriaService } from './performance-criteria.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('PerformanceCriteriaService', () => {
  let service: PerformanceCriteriaService;
  let prisma: any;

  beforeEach(async () => {
    prisma = { performanceCriterion: { findMany: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn() } };
    const moduleRef = await Test.createTestingModule({
      providers: [PerformanceCriteriaService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = moduleRef.get(PerformanceCriteriaService);
  });

  it('findAll excludes soft-deleted criteria', async () => {
    prisma.performanceCriterion.findMany.mockResolvedValue([]);
    await service.findAll('company-1');
    const call = prisma.performanceCriterion.findMany.mock.calls[0][0];
    expect(call.where.deletedAt).toBeNull();
  });

  it('404s when the criterion does not exist or is already deactivated', async () => {
    prisma.performanceCriterion.findFirst.mockResolvedValue(null);
    await expect(service.findOne('company-1', 'crit-1')).rejects.toThrow(NotFoundException);
  });

  it('deactivate() soft-deletes rather than hard-deleting (sets deletedAt, does not call any delete method)', async () => {
    prisma.performanceCriterion.findFirst.mockResolvedValue({ id: 'crit-1' });
    prisma.performanceCriterion.update.mockResolvedValue({ id: 'crit-1', deletedAt: new Date() });

    await service.deactivate('company-1', 'crit-1');

    const call = prisma.performanceCriterion.update.mock.calls[0][0];
    expect(call.data.deletedAt).toBeInstanceOf(Date);
    expect(prisma.performanceCriterion.update).toHaveBeenCalledTimes(1);
  });
});
