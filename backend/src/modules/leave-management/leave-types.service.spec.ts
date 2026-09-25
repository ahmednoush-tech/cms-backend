import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { LeaveTypesService } from './leave-types.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('LeaveTypesService', () => {
  let service: LeaveTypesService;
  let prisma: any;

  beforeEach(async () => {
    prisma = { leaveType: { findMany: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn() } };

    const moduleRef = await Test.createTestingModule({
      providers: [LeaveTypesService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = moduleRef.get(LeaveTypesService);
  });

  it('findAll excludes soft-deleted types', async () => {
    prisma.leaveType.findMany.mockResolvedValue([]);
    await service.findAll('company-1');
    expect(prisma.leaveType.findMany.mock.calls[0][0].where.deletedAt).toBeNull();
  });

  it('create defaults requiresBalance and isPaid to true when not specified', async () => {
    prisma.leaveType.create.mockResolvedValue({});
    await service.create('company-1', { name: 'Sick Leave' });
    const call = prisma.leaveType.create.mock.calls[0][0];
    expect(call.data.requiresBalance).toBe(true);
    expect(call.data.isPaid).toBe(true);
  });

  it('deactivate() sets deletedAt rather than actually deleting the row', async () => {
    prisma.leaveType.findFirst.mockResolvedValue({ id: 'type-1' });
    prisma.leaveType.update.mockResolvedValue({});

    await service.deactivate('company-1', 'type-1');

    const call = prisma.leaveType.update.mock.calls[0][0];
    expect(call.data.deletedAt).toBeInstanceOf(Date);
  });

  it('deactivate() 404s for a type belonging to a different company', async () => {
    prisma.leaveType.findFirst.mockResolvedValue(null);
    await expect(service.deactivate('company-1', 'type-from-other-company')).rejects.toThrow(NotFoundException);
  });
});
