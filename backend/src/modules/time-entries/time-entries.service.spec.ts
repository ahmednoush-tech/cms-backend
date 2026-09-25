import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { TimeEntriesService } from './time-entries.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('TimeEntriesService', () => {
  let service: TimeEntriesService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      task: { findFirst: jest.fn(), findMany: jest.fn() },
      employee: { findFirst: jest.fn() },
      workOrder: { findFirst: jest.fn(), findMany: jest.fn() },
      project: { findFirst: jest.fn() },
      timeEntry: { create: jest.fn(), findFirst: jest.fn(), findMany: jest.fn(), update: jest.fn() },
    };

    const moduleRef = await Test.createTestingModule({
      providers: [TimeEntriesService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = moduleRef.get(TimeEntriesService);
  });

  describe('create', () => {
    it('404s when the task does not exist in the caller company', async () => {
      prisma.task.findFirst.mockResolvedValue(null);

      await expect(
        service.create('company-1', 'user-1', { taskId: 'missing', employeeId: 'emp-1', entryDate: '2026-06-01', hours: 2 } as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('404s when the employee does not exist in the caller company', async () => {
      prisma.task.findFirst.mockResolvedValue({ id: 'task-1' });
      prisma.employee.findFirst.mockResolvedValue(null);

      await expect(
        service.create('company-1', 'user-1', { taskId: 'task-1', employeeId: 'missing', entryDate: '2026-06-01', hours: 2 } as any),
      ).rejects.toThrow(NotFoundException);
    });

    it("freezes the employee's current hourly rate and computes laborCost = hours × rate", async () => {
      prisma.task.findFirst.mockResolvedValue({ id: 'task-1' });
      prisma.employee.findFirst.mockResolvedValue({ id: 'emp-1', hourlyRate: '50.00' });
      prisma.timeEntry.create.mockResolvedValue({ id: 'entry-1' });

      await service.create('company-1', 'user-1', { taskId: 'task-1', employeeId: 'emp-1', entryDate: '2026-06-01', hours: 3 } as any);

      const call = prisma.timeEntry.create.mock.calls[0][0];
      expect(call.data.hourlyRateSnapshot.toString()).toBe('50');
      expect(call.data.laborCost.toString()).toBe('150');
    });

    it('leaves hourlyRateSnapshot and laborCost as null (never zero) when the employee has no rate configured', async () => {
      prisma.task.findFirst.mockResolvedValue({ id: 'task-1' });
      prisma.employee.findFirst.mockResolvedValue({ id: 'emp-1', hourlyRate: null });
      prisma.timeEntry.create.mockResolvedValue({ id: 'entry-1' });

      await service.create('company-1', 'user-1', { taskId: 'task-1', employeeId: 'emp-1', entryDate: '2026-06-01', hours: 3 } as any);

      const call = prisma.timeEntry.create.mock.calls[0][0];
      expect(call.data.hourlyRateSnapshot).toBeNull();
      expect(call.data.laborCost).toBeNull();
    });

    it('defaults billable to true when not specified', async () => {
      prisma.task.findFirst.mockResolvedValue({ id: 'task-1' });
      prisma.employee.findFirst.mockResolvedValue({ id: 'emp-1', hourlyRate: null });
      prisma.timeEntry.create.mockResolvedValue({ id: 'entry-1' });

      await service.create('company-1', 'user-1', { taskId: 'task-1', employeeId: 'emp-1', entryDate: '2026-06-01', hours: 3 } as any);

      expect(prisma.timeEntry.create.mock.calls[0][0].data.billable).toBe(true);
    });
  });

  describe('update', () => {
    it('recomputes laborCost using the FROZEN rate snapshot, never a freshly-fetched employee rate', async () => {
      prisma.timeEntry.findFirst.mockResolvedValue({ id: 'entry-1', hours: '3.00', hourlyRateSnapshot: '50.00' });
      prisma.timeEntry.update.mockResolvedValue({ id: 'entry-1' });

      await service.update('company-1', 'entry-1', { hours: 5 } as any);

      expect(prisma.employee.findFirst).not.toHaveBeenCalled();
      const call = prisma.timeEntry.update.mock.calls[0][0];
      expect(call.data.laborCost.toString()).toBe('250');
    });

    it('keeps laborCost null if the entry never had a rate, even after an hours edit', async () => {
      prisma.timeEntry.findFirst.mockResolvedValue({ id: 'entry-1', hours: '3.00', hourlyRateSnapshot: null });
      prisma.timeEntry.update.mockResolvedValue({ id: 'entry-1' });

      await service.update('company-1', 'entry-1', { hours: 5 } as any);

      const call = prisma.timeEntry.update.mock.calls[0][0];
      expect(call.data.laborCost).toBeNull();
    });
  });

  describe('getProjectSummary', () => {
    it('rolls up tasks linked to the project BOTH directly and via its work orders', async () => {
      prisma.project.findFirst.mockResolvedValue({ id: 'proj-1' });
      prisma.workOrder.findMany.mockResolvedValue([{ id: 'wo-1' }]);
      prisma.task.findMany.mockResolvedValue([{ id: 'task-direct' }, { id: 'task-via-wo' }]);
      prisma.timeEntry.findMany.mockResolvedValue([
        { hours: '2.00', laborCost: '100.00', billable: true },
        { hours: '3.00', laborCost: '150.00', billable: true },
      ]);

      const summary = await service.getProjectSummary('company-1', 'proj-1');

      const taskQuery = prisma.task.findMany.mock.calls[0][0];
      expect(taskQuery.where.OR).toEqual([{ projectId: 'proj-1' }, { workOrderId: { in: ['wo-1'] } }]);
      expect(summary.totalHours).toBe('5');
      expect(summary.totalCost).toBe('250');
    });

    it('404s when the project does not exist in the caller company', async () => {
      prisma.project.findFirst.mockResolvedValue(null);
      await expect(service.getProjectSummary('company-1', 'missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('summarize (via getTaskSummary)', () => {
    it('returns totalCost as null (not "0") when NO entry in the set has a rate', async () => {
      prisma.task.findFirst.mockResolvedValue({ id: 'task-1' });
      prisma.timeEntry.findMany.mockResolvedValue([
        { hours: '2.00', laborCost: null, billable: true },
        { hours: '1.00', laborCost: null, billable: false },
      ]);

      const summary = await service.getTaskSummary('company-1', 'task-1');

      expect(summary.totalCost).toBeNull();
      expect(summary.totalHours).toBe('3');
      expect(summary.billableHours).toBe('2');
    });

    it('counts only billable entries toward billableHours', async () => {
      prisma.task.findFirst.mockResolvedValue({ id: 'task-1' });
      prisma.timeEntry.findMany.mockResolvedValue([
        { hours: '4.00', laborCost: '200.00', billable: true },
        { hours: '2.00', laborCost: '100.00', billable: false },
      ]);

      const summary = await service.getTaskSummary('company-1', 'task-1');

      expect(summary.totalHours).toBe('6');
      expect(summary.billableHours).toBe('4');
      expect(summary.totalCost).toBe('300');
    });
  });
});
