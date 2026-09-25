import { Test } from '@nestjs/testing';
import { BadRequestException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { LeaveRequestsService } from './leave-requests.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('LeaveRequestsService', () => {
  let service: LeaveRequestsService;
  let prisma: any;

  const annualLeaveType = { id: 'type-1', companyId: 'company-1', name: 'Annual', requiresBalance: true, deletedAt: null };
  const unpaidLeaveType = { id: 'type-2', companyId: 'company-1', name: 'Unpaid', requiresBalance: false, deletedAt: null };
  const employee = { id: 'emp-1', companyId: 'company-1', deletedAt: null, workingDaysOverride: [] };
  const company = { defaultWorkingDays: [0, 1, 2, 3, 4] };

  beforeEach(async () => {
    prisma = {
      leaveType: { findFirst: jest.fn() },
      employee: { findFirst: jest.fn() },
      company: { findUnique: jest.fn() },
      leaveRequest: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
      leaveBalance: { findUnique: jest.fn(), upsert: jest.fn() },
      $transaction: jest.fn((fn) => fn(prisma)),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [LeaveRequestsService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = moduleRef.get(LeaveRequestsService);
  });

  describe('create', () => {
    beforeEach(() => {
      prisma.leaveType.findFirst.mockResolvedValue(annualLeaveType);
      prisma.employee.findFirst.mockResolvedValue(employee);
      prisma.company.findUnique.mockResolvedValue(company);
      prisma.leaveRequest.findFirst.mockResolvedValue(null);
    });

    it('404s when the leave type does not exist for this company', async () => {
      prisma.leaveType.findFirst.mockResolvedValue(null);
      await expect(
        service.create('company-1', 'emp-1', { leaveTypeId: 'type-1', startDate: '2026-09-13', endDate: '2026-09-13' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects endDate before startDate', async () => {
      await expect(
        service.create('company-1', 'emp-1', { leaveTypeId: 'type-1', startDate: '2026-09-15', endDate: '2026-09-10' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects a request overlapping an existing pending or approved request for the same employee', async () => {
      prisma.leaveRequest.findFirst.mockResolvedValue({ id: 'existing-1', status: 'approved' });
      await expect(
        service.create('company-1', 'emp-1', { leaveTypeId: 'type-1', startDate: '2026-09-13', endDate: '2026-09-15' }),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('computes daysRequested using the RESOLVED effective working days (employee override wins)', async () => {
      const overrideEmployee = { ...employee, workingDaysOverride: [0, 1, 2, 3, 4, 5] };
      prisma.employee.findFirst.mockResolvedValue(overrideEmployee);
      prisma.leaveBalance.findUnique.mockResolvedValue({ allocatedDays: 30, usedDays: 0 });
      prisma.leaveRequest.create.mockResolvedValue({ id: 'req-1' });

      await service.create('company-1', 'emp-1', { leaveTypeId: 'type-1', startDate: '2026-09-13', endDate: '2026-09-19' });

      const createCall = prisma.leaveRequest.create.mock.calls[0][0];
      expect(createCall.data.daysRequested).toBe(6);
    });

    it('rejects when the requested days exceed the remaining balance', async () => {
      prisma.leaveBalance.findUnique.mockResolvedValue({ allocatedDays: 5, usedDays: 4 });
      await expect(
        service.create('company-1', 'emp-1', { leaveTypeId: 'type-1', startDate: '2026-09-13', endDate: '2026-09-17' }),
      ).rejects.toThrow(/Insufficient/);
    });

    it('treats a missing balance row as zero remaining, not unlimited', async () => {
      prisma.leaveBalance.findUnique.mockResolvedValue(null);
      await expect(
        service.create('company-1', 'emp-1', { leaveTypeId: 'type-1', startDate: '2026-09-13', endDate: '2026-09-13' }),
      ).rejects.toThrow(/Insufficient/);
    });

    it('never checks balance at all for a leave type that does not require one', async () => {
      prisma.leaveType.findFirst.mockResolvedValue(unpaidLeaveType);
      prisma.leaveRequest.create.mockResolvedValue({ id: 'req-1' });

      await service.create('company-1', 'emp-1', { leaveTypeId: 'type-2', startDate: '2026-09-13', endDate: '2026-09-13' });

      expect(prisma.leaveBalance.findUnique).not.toHaveBeenCalled();
    });

    it('creates the request with status "pending", never pre-approved', async () => {
      prisma.leaveBalance.findUnique.mockResolvedValue({ allocatedDays: 30, usedDays: 0 });
      prisma.leaveRequest.create.mockResolvedValue({ id: 'req-1' });

      await service.create('company-1', 'emp-1', { leaveTypeId: 'type-1', startDate: '2026-09-13', endDate: '2026-09-13' });

      expect(prisma.leaveRequest.create.mock.calls[0][0].data.status).toBe('pending');
    });
  });

  describe('approve', () => {
    it('404s when the request does not exist', async () => {
      prisma.leaveRequest.findFirst.mockResolvedValue(null);
      await expect(service.approve('company-1', 'user-1', 'req-1')).rejects.toThrow(NotFoundException);
    });

    it('rejects approving a request that is not pending', async () => {
      prisma.leaveRequest.findFirst.mockResolvedValue({ id: 'req-1', status: 'approved', leaveType: annualLeaveType });
      await expect(service.approve('company-1', 'user-1', 'req-1')).rejects.toThrow(UnprocessableEntityException);
    });

    it('increments the existing leave balance usedDays by daysRequested on approval', async () => {
      prisma.leaveRequest.findFirst.mockResolvedValue({
        id: 'req-1',
        status: 'pending',
        employeeId: 'emp-1',
        leaveTypeId: 'type-1',
        startDate: new Date('2026-09-13'),
        daysRequested: 3,
        leaveType: annualLeaveType,
      });
      prisma.leaveBalance.findUnique.mockResolvedValue({ allocatedDays: 30, usedDays: 0 });
      prisma.leaveBalance.upsert.mockResolvedValue({});
      prisma.leaveRequest.update.mockResolvedValue({ id: 'req-1', status: 'approved' });

      await service.approve('company-1', 'user-1', 'req-1');

      const upsertCall = prisma.leaveBalance.upsert.mock.calls[0][0];
      expect(upsertCall.update.usedDays).toEqual({ increment: 3 });
    });

    it('re-validates the balance INSIDE the approval transaction — rejects if another approval already consumed the remaining days since this request was submitted', async () => {
      prisma.leaveRequest.findFirst.mockResolvedValue({
        id: 'req-1',
        status: 'pending',
        employeeId: 'emp-1',
        leaveTypeId: 'type-1',
        startDate: new Date('2026-09-13'),
        daysRequested: 3,
        leaveType: annualLeaveType,
      });
      // Only 1 day actually remains now, even though this request needs 3 — e.g. another request was approved in the meantime.
      prisma.leaveBalance.findUnique.mockResolvedValue({ allocatedDays: 5, usedDays: 4 });

      await expect(service.approve('company-1', 'user-1', 'req-1')).rejects.toThrow(UnprocessableEntityException);
      expect(prisma.leaveBalance.upsert).not.toHaveBeenCalled();
      expect(prisma.leaveRequest.update).not.toHaveBeenCalled();
    });

    it('never touches the leave balance for a type that does not require one', async () => {
      prisma.leaveRequest.findFirst.mockResolvedValue({
        id: 'req-1',
        status: 'pending',
        employeeId: 'emp-1',
        leaveTypeId: 'type-2',
        startDate: new Date('2026-09-13'),
        daysRequested: 3,
        leaveType: unpaidLeaveType,
      });
      prisma.leaveRequest.update.mockResolvedValue({ id: 'req-1', status: 'approved' });

      await service.approve('company-1', 'user-1', 'req-1');

      expect(prisma.leaveBalance.upsert).not.toHaveBeenCalled();
    });

    it('records who approved it and when', async () => {
      prisma.leaveRequest.findFirst.mockResolvedValue({
        id: 'req-1',
        status: 'pending',
        employeeId: 'emp-1',
        leaveTypeId: 'type-2',
        startDate: new Date('2026-09-13'),
        daysRequested: 1,
        leaveType: unpaidLeaveType,
      });
      prisma.leaveRequest.update.mockResolvedValue({});

      await service.approve('company-1', 'user-42', 'req-1');

      const updateCall = prisma.leaveRequest.update.mock.calls[0][0];
      expect(updateCall.data.status).toBe('approved');
      expect(updateCall.data.approvedBy).toBe('user-42');
      expect(updateCall.data.approvedAt).toBeInstanceOf(Date);
    });
  });

  describe('reject', () => {
    it('rejects rejecting a request that is not pending', async () => {
      prisma.leaveRequest.findFirst.mockResolvedValue({ id: 'req-1', status: 'rejected', leaveType: annualLeaveType });
      await expect(service.reject('company-1', 'user-1', 'req-1', { rejectionReason: 'no' })).rejects.toThrow(UnprocessableEntityException);
    });

    it('never touches any leave balance on rejection', async () => {
      prisma.leaveRequest.findFirst.mockResolvedValue({ id: 'req-1', status: 'pending', leaveType: annualLeaveType });
      prisma.leaveRequest.update.mockResolvedValue({});

      await service.reject('company-1', 'user-1', 'req-1', { rejectionReason: 'not enough coverage' });

      expect(prisma.leaveBalance.upsert).not.toHaveBeenCalled();
      const updateCall = prisma.leaveRequest.update.mock.calls[0][0];
      expect(updateCall.data.status).toBe('rejected');
      expect(updateCall.data.rejectionReason).toBe('not enough coverage');
    });
  });

  describe('cancel', () => {
    it('rejects cancelling an already-approved request', async () => {
      prisma.leaveRequest.findFirst.mockResolvedValue({ id: 'req-1', employeeId: 'emp-1', status: 'approved', leaveType: annualLeaveType });
      await expect(service.cancel('company-1', 'req-1', 'emp-1')).rejects.toThrow(UnprocessableEntityException);
    });

    it('cancels a pending request, never touching any balance', async () => {
      prisma.leaveRequest.findFirst.mockResolvedValue({ id: 'req-1', employeeId: 'emp-1', status: 'pending', leaveType: annualLeaveType });
      prisma.leaveRequest.update.mockResolvedValue({});

      await service.cancel('company-1', 'req-1', 'emp-1');

      expect(prisma.leaveBalance.upsert).not.toHaveBeenCalled();
      expect(prisma.leaveRequest.update.mock.calls[0][0].data.status).toBe('cancelled');
    });

    it('rejects cancelling via a mismatched employeeId (data-integrity guard, not an identity check — see service comment)', async () => {
      prisma.leaveRequest.findFirst.mockResolvedValue({ id: 'req-1', employeeId: 'emp-1', status: 'pending', leaveType: annualLeaveType });
      await expect(service.cancel('company-1', 'req-1', 'emp-999-wrong')).rejects.toThrow(BadRequestException);
    });
  });
});
