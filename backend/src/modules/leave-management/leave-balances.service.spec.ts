import { Test } from '@nestjs/testing';
import { NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { LeaveBalancesService } from './leave-balances.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('LeaveBalancesService', () => {
  let service: LeaveBalancesService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      leaveType: { findFirst: jest.fn() },
      employee: { findFirst: jest.fn() },
      leaveBalance: { findMany: jest.fn(), upsert: jest.fn() },
    };

    const moduleRef = await Test.createTestingModule({
      providers: [LeaveBalancesService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = moduleRef.get(LeaveBalancesService);
  });

  describe('setAllocation', () => {
    it('404s when the leave type does not exist', async () => {
      prisma.leaveType.findFirst.mockResolvedValue(null);
      await expect(
        service.setAllocation('company-1', { employeeId: 'emp-1', leaveTypeId: 'type-1', year: 2026, allocatedDays: 21 }),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects allocating a balance for a leave type that does not track one (e.g. Unpaid)', async () => {
      prisma.leaveType.findFirst.mockResolvedValue({ id: 'type-2', name: 'Unpaid', requiresBalance: false });
      await expect(
        service.setAllocation('company-1', { employeeId: 'emp-1', leaveTypeId: 'type-2', year: 2026, allocatedDays: 21 }),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('404s when the employee does not exist for this company', async () => {
      prisma.leaveType.findFirst.mockResolvedValue({ id: 'type-1', name: 'Annual', requiresBalance: true });
      prisma.employee.findFirst.mockResolvedValue(null);
      await expect(
        service.setAllocation('company-1', { employeeId: 'emp-1', leaveTypeId: 'type-1', year: 2026, allocatedDays: 21 }),
      ).rejects.toThrow(NotFoundException);
    });

    it('upserts WITHOUT touching usedDays — setting/correcting an allocation never resets or alters how much has already been used', async () => {
      prisma.leaveType.findFirst.mockResolvedValue({ id: 'type-1', name: 'Annual', requiresBalance: true });
      prisma.employee.findFirst.mockResolvedValue({ id: 'emp-1' });
      prisma.leaveBalance.upsert.mockResolvedValue({});

      await service.setAllocation('company-1', { employeeId: 'emp-1', leaveTypeId: 'type-1', year: 2026, allocatedDays: 25 });

      const upsertCall = prisma.leaveBalance.upsert.mock.calls[0][0];
      expect('usedDays' in upsertCall.update).toBe(false);
      expect('usedDays' in upsertCall.create).toBe(false);
      expect(upsertCall.update.allocatedDays).toBe(25);
    });
  });
});
