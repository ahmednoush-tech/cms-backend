import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { PerformanceCyclesService } from './performance-cycles.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('PerformanceCyclesService', () => {
  let service: PerformanceCyclesService;
  let prisma: any;

  beforeEach(async () => {
    prisma = { performanceCycle: { findMany: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn() } };
    const moduleRef = await Test.createTestingModule({
      providers: [PerformanceCyclesService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = moduleRef.get(PerformanceCyclesService);
  });

  it('scopes findAll to the caller company, newest cycle first', async () => {
    prisma.performanceCycle.findMany.mockResolvedValue([]);
    await service.findAll('company-1');
    const call = prisma.performanceCycle.findMany.mock.calls[0][0];
    expect(call.where.companyId).toBe('company-1');
    expect(call.orderBy).toEqual({ startDate: 'desc' });
  });

  it('404s when the cycle does not exist in this company', async () => {
    prisma.performanceCycle.findFirst.mockResolvedValue(null);
    await expect(service.findOne('company-1', 'cycle-1')).rejects.toThrow(NotFoundException);
  });

  it('create() parses the date strings into real Date objects', async () => {
    prisma.performanceCycle.create.mockResolvedValue({ id: 'cycle-1' });
    await service.create('company-1', { name: 'Q1 2026', startDate: '2026-01-01', endDate: '2026-03-31' });
    const call = prisma.performanceCycle.create.mock.calls[0][0];
    expect(call.data.startDate).toBeInstanceOf(Date);
    expect(call.data.endDate).toBeInstanceOf(Date);
  });

  it('update() 404s before attempting to update a cycle from another company', async () => {
    prisma.performanceCycle.findFirst.mockResolvedValue(null);
    await expect(service.update('company-1', 'cycle-1', { status: 'closed' })).rejects.toThrow(NotFoundException);
    expect(prisma.performanceCycle.update).not.toHaveBeenCalled();
  });
});
