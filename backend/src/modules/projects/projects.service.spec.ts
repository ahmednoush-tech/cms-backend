import { Test } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ActivityLogService } from '../../common/services/activity-log.service';
import { CustomersService } from '../customers/customers.service';
import { EmployeesService } from '../employees/employees.service';
import { NotificationsService } from '../notifications/notifications.service';
import { notificationsServiceBackedBy } from '../notifications/testing/notifications-test-adapter';

describe('ProjectsService', () => {
  let service: ProjectsService;
  let prisma: any;
  let customersService: any;
  let employeesService: any;

  function mockTransaction(prismaMock: any) {
    return jest.fn((arg) => (typeof arg === 'function' ? arg(prismaMock) : Promise.all(arg)));
  }

  beforeEach(async () => {
    prisma = {
      project: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
      },
      projectMember: { findUnique: jest.fn(), create: jest.fn() },
      workOrder: { count: jest.fn() },
      opportunity: { findFirst: jest.fn() },
      quotation: { findFirst: jest.fn() },
      employee: { findUnique: jest.fn() },
      notification: { create: jest.fn() },
      task: { findMany: jest.fn() },
      timeEntry: { aggregate: jest.fn() },
      bill: { aggregate: jest.fn().mockResolvedValue({ _sum: { total: null } }) },
    };
    prisma.$transaction = mockTransaction(prisma);

    customersService = { assertCustomerBelongsToCompany: jest.fn() };
    employeesService = { assertActiveEmployeeInCompany: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        ProjectsService,
        { provide: PrismaService, useValue: prisma },
        { provide: NotificationsService, useValue: notificationsServiceBackedBy(prisma) },
        { provide: ActivityLogService, useValue: { record: jest.fn() } },
        { provide: CustomersService, useValue: customersService },
        { provide: EmployeesService, useValue: employeesService },
      ],
    }).compile();

    service = moduleRef.get(ProjectsService);
  });

  // ----------------------------------------------------------
  // Tenant isolation
  // ----------------------------------------------------------
  describe('tenant isolation', () => {
    it('findOne throws NotFoundException for a project outside the caller company', async () => {
      prisma.project.findFirst.mockResolvedValue(null);
      await expect(service.findOne('company-A', 'proj-in-B')).rejects.toThrow(NotFoundException);
    });

    it('create rejects a customer belonging to another company', async () => {
      customersService.assertCustomerBelongsToCompany.mockRejectedValue(new NotFoundException());
      await expect(
        service.create('company-A', 'user-1', { customerId: 'cust-in-B', name: 'X' } as any),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });

  // ----------------------------------------------------------
  // Project/customer/quotation/opportunity consistency
  // ----------------------------------------------------------
  describe('customer/opportunity/quotation consistency', () => {
    it('rejects an opportunity belonging to a different customer', async () => {
      prisma.opportunity.findFirst.mockResolvedValue({ id: 'opp-1', customerId: 'other-cust' });
      await expect(
        service.create('company-A', 'user-1', {
          customerId: 'cust-1',
          opportunityId: 'opp-1',
          name: 'X',
        } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects a quotation that is not accepted', async () => {
      prisma.quotation.findFirst.mockResolvedValue({ id: 'q-1', customerId: 'cust-1', status: 'draft' });
      await expect(
        service.create('company-A', 'user-1', {
          customerId: 'cust-1',
          quotationId: 'q-1',
          name: 'X',
        } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects a quotation belonging to a different customer', async () => {
      prisma.quotation.findFirst.mockResolvedValue({ id: 'q-1', customerId: 'other-cust', status: 'accepted' });
      await expect(
        service.create('company-A', 'user-1', {
          customerId: 'cust-1',
          quotationId: 'q-1',
          name: 'X',
        } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('accepts an accepted quotation matching the project customer', async () => {
      prisma.quotation.findFirst.mockResolvedValue({ id: 'q-1', customerId: 'cust-1', status: 'accepted', opportunityId: null });
      prisma.project.count.mockResolvedValue(0);
      prisma.project.findFirst.mockResolvedValue(null);
      prisma.project.create.mockResolvedValue({ id: 'proj-1' });
      jest.spyOn(service, 'findOne').mockResolvedValue({ id: 'proj-1' } as any);

      const result = await service.create('company-A', 'user-1', {
        customerId: 'cust-1',
        quotationId: 'q-1',
        name: 'X',
      } as any);
      expect(result.id).toBe('proj-1');
    });

    it('allows a manually-created project with no quotation and no opportunity', async () => {
      prisma.project.count.mockResolvedValue(0);
      prisma.project.findFirst.mockResolvedValue(null);
      prisma.project.create.mockResolvedValue({ id: 'proj-manual' });
      jest.spyOn(service, 'findOne').mockResolvedValue({ id: 'proj-manual' } as any);

      const result = await service.create('company-A', 'user-1', { customerId: 'cust-1', name: 'Manual' } as any);
      expect(result.id).toBe('proj-manual');
      expect(prisma.quotation.findFirst).not.toHaveBeenCalled();
    });
  });

  // ----------------------------------------------------------
  // Phase 2F P2 fix: an accepted quotation cannot be linked to
  // more than one project (V1 Final System Audit §9)
  // ----------------------------------------------------------
  describe('accepted quotation cannot be linked to more than one project', () => {
    it('rejects with 409 when the quotation is already linked to another project', async () => {
      prisma.quotation.findFirst.mockResolvedValue({
        id: 'q-1',
        customerId: 'cust-1',
        status: 'accepted',
        opportunityId: null,
      });
      // The quotation-link check runs INSIDE the transaction and
      // is itself a `project.findFirst` call — mocked here to
      // simulate an existing project already holding this
      // quotationId, which must short-circuit before project
      // number generation or creation ever run.
      prisma.project.findFirst.mockResolvedValue({ id: 'existing-proj', projectNumber: 'PRJ-2026-0001' });

      await expect(
        service.create('company-A', 'user-1', {
          customerId: 'cust-1',
          quotationId: 'q-1',
          name: 'Duplicate link attempt',
        } as any),
      ).rejects.toThrow(ConflictException);

      expect(prisma.project.create).not.toHaveBeenCalled();
      expect(prisma.project.count).not.toHaveBeenCalled(); // never even reaches number generation
    });

    it('allows linking when the quotation is not yet linked to any project', async () => {
      prisma.quotation.findFirst.mockResolvedValue({
        id: 'q-1',
        customerId: 'cust-1',
        status: 'accepted',
        opportunityId: null,
      });
      prisma.project.findFirst.mockResolvedValue(null); // no existing link, no number collision either
      prisma.project.count.mockResolvedValue(0);
      prisma.project.create.mockResolvedValue({ id: 'proj-new' });
      jest.spyOn(service, 'findOne').mockResolvedValue({ id: 'proj-new' } as any);

      const result = await service.create('company-A', 'user-1', {
        customerId: 'cust-1',
        quotationId: 'q-1',
        name: 'First link',
      } as any);
      expect(result.id).toBe('proj-new');
    });

    it('the duplicate-link check only applies when quotationId is supplied at all', async () => {
      prisma.project.findFirst.mockResolvedValue(null);
      prisma.project.count.mockResolvedValue(0);
      prisma.project.create.mockResolvedValue({ id: 'proj-no-quote' });
      jest.spyOn(service, 'findOne').mockResolvedValue({ id: 'proj-no-quote' } as any);

      await service.create('company-A', 'user-1', { customerId: 'cust-1', name: 'No quote' } as any);

      // No quotation was supplied, so the quotation-side validation
      // (and therefore the duplicate-link check tied to it) never runs.
      expect(prisma.quotation.findFirst).not.toHaveBeenCalled();
    });
  });

  // ----------------------------------------------------------
  // Project Manager: active employee, auto-sync, no duplicate
  // ----------------------------------------------------------
  describe('project manager assignment and auto-sync', () => {
    it('rejects a non-active/cross-company employee as project manager', async () => {
      employeesService.assertActiveEmployeeInCompany.mockRejectedValue(new BadRequestException());
      await expect(
        service.create('company-A', 'user-1', {
          customerId: 'cust-1',
          name: 'X',
          projectManagerId: 'emp-inactive',
        } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('auto-creates a project_members row for the manager at creation', async () => {
      prisma.project.count.mockResolvedValue(0);
      prisma.project.findFirst.mockResolvedValue(null);
      prisma.project.create.mockResolvedValue({ id: 'proj-1' });
      prisma.projectMember.findUnique.mockResolvedValue(null); // not already a member
      jest.spyOn(service, 'findOne').mockResolvedValue({ id: 'proj-1' } as any);

      await service.create('company-A', 'user-1', {
        customerId: 'cust-1',
        name: 'X',
        projectManagerId: 'emp-1',
      } as any);

      expect(prisma.projectMember.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ projectId: 'proj-1', employeeId: 'emp-1', role: 'manager' }) }),
      );
    });

    it('does NOT create a duplicate membership if the manager is already a member (idempotent auto-sync)', async () => {
      prisma.project.count.mockResolvedValue(0);
      prisma.project.findFirst.mockResolvedValue(null);
      prisma.project.create.mockResolvedValue({ id: 'proj-1' });
      prisma.projectMember.findUnique.mockResolvedValue({ projectId: 'proj-1', employeeId: 'emp-1', role: 'manager' });
      jest.spyOn(service, 'findOne').mockResolvedValue({ id: 'proj-1' } as any);

      await service.create('company-A', 'user-1', {
        customerId: 'cust-1',
        name: 'X',
        projectManagerId: 'emp-1',
      } as any);

      expect(prisma.projectMember.create).not.toHaveBeenCalled();
    });
  });

  // ----------------------------------------------------------
  // Workflow transitions
  // ----------------------------------------------------------
  describe('status transitions', () => {
    it('allows planning -> approved', async () => {
      jest.spyOn(service, 'findOne')
        .mockResolvedValueOnce({ id: 'proj-1', status: 'planning' } as any)
        .mockResolvedValueOnce({ id: 'proj-1', status: 'approved' } as any);
      prisma.project.update.mockResolvedValue({ id: 'proj-1', status: 'approved' });

      const result = await service.updateStatus('company-A', 'user-1', 'proj-1', { status: 'approved' } as any);
      expect(result.status).toBe('approved');
    });

    it('rejects planning -> in_progress (skipping approved)', async () => {
      jest.spyOn(service, 'findOne').mockResolvedValue({ id: 'proj-1', status: 'planning' } as any);
      await expect(
        service.updateStatus('company-A', 'user-1', 'proj-1', { status: 'in_progress' } as any),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('rejects on_hold reached directly from planning (must pass through in_progress)', async () => {
      jest.spyOn(service, 'findOne').mockResolvedValue({ id: 'proj-1', status: 'planning' } as any);
      await expect(
        service.updateStatus('company-A', 'user-1', 'proj-1', { status: 'on_hold' } as any),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('rejects any transition out of a terminal state', async () => {
      jest.spyOn(service, 'findOne').mockResolvedValue({ id: 'proj-1', status: 'completed' } as any);
      await expect(
        service.updateStatus('company-A', 'user-1', 'proj-1', { status: 'in_progress' } as any),
      ).rejects.toThrow(UnprocessableEntityException);
    });
  });

  // ----------------------------------------------------------
  // Completion gating (strict, no override)
  // ----------------------------------------------------------
  describe('completion gating', () => {
    it('blocks completing a project with open work orders', async () => {
      jest.spyOn(service, 'findOne').mockResolvedValue({ id: 'proj-1', status: 'in_progress' } as any);
      prisma.workOrder.count.mockResolvedValue(2);

      await expect(
        service.updateStatus('company-A', 'user-1', 'proj-1', { status: 'completed' } as any),
      ).rejects.toThrow(UnprocessableEntityException);
      expect(prisma.project.update).not.toHaveBeenCalled();
    });

    it('allows completing a project once all work orders are completed/cancelled', async () => {
      jest.spyOn(service, 'findOne')
        .mockResolvedValueOnce({ id: 'proj-1', status: 'in_progress' } as any)
        .mockResolvedValueOnce({ id: 'proj-1', status: 'completed' } as any);
      prisma.workOrder.count.mockResolvedValue(0);
      prisma.project.update.mockResolvedValue({ id: 'proj-1', status: 'completed' });

      const result = await service.updateStatus('company-A', 'user-1', 'proj-1', { status: 'completed' } as any);
      expect(result.status).toBe('completed');
    });
  });

  // ----------------------------------------------------------
  // Soft delete
  // ----------------------------------------------------------
  describe('soft delete', () => {
    it('allows deleting a project still in planning', async () => {
      jest.spyOn(service, 'findOne').mockResolvedValue({ id: 'proj-1', status: 'planning' } as any);
      prisma.project.update.mockResolvedValue({ id: 'proj-1', deletedAt: new Date() });

      const result = await service.softDelete('company-A', 'user-1', 'proj-1');
      expect(result.deletedAt).toBeDefined();
    });

    it('blocks deleting a project that is no longer in planning', async () => {
      jest.spyOn(service, 'findOne').mockResolvedValue({ id: 'proj-1', status: 'approved' } as any);
      await expect(service.softDelete('company-A', 'user-1', 'proj-1')).rejects.toThrow(
        UnprocessableEntityException,
      );
    });
  });

  // ----------------------------------------------------------
  // findAll — P1 filter regression (V1 Final System Audit §7/13)
  // Proves filters declared on ProjectFiltersDto actually reach
  // the Prisma `where` clause, now that the controller/service
  // type mismatch (bare PaginationQueryDto vs. as-any cast) is
  // fixed. Tenant isolation (companyId) is asserted alongside
  // every filter to confirm the fix didn't loosen it.
  // ----------------------------------------------------------
  describe('findAll — filters reach the service', () => {
    beforeEach(() => {
      prisma.project.findMany.mockResolvedValue([]);
      prisma.project.count.mockResolvedValue(0);
    });

    it('applies the customerId filter alongside companyId (tenant isolation intact)', async () => {
      await service.findAll('company-A', {
        page: 1,
        pageSize: 20,
        customerId: 'cust-1',
      } as any);

      const call = prisma.project.findMany.mock.calls[0][0];
      expect(call.where.companyId).toBe('company-A');
      expect(call.where.customerId).toBe('cust-1');
      expect(call.where.deletedAt).toBeNull();
    });

    it('applies the status filter alongside companyId', async () => {
      await service.findAll('company-A', { page: 1, pageSize: 20, status: 'in_progress' } as any);

      const call = prisma.project.findMany.mock.calls[0][0];
      expect(call.where.companyId).toBe('company-A');
      expect(call.where.status).toBe('in_progress');
    });

    it('omits filter keys entirely when not supplied, without breaking tenant scoping', async () => {
      await service.findAll('company-A', { page: 1, pageSize: 20 } as any);

      const call = prisma.project.findMany.mock.calls[0][0];
      expect(call.where.companyId).toBe('company-A');
      expect('customerId' in call.where).toBe(false);
      expect('status' in call.where).toBe(false);
    });

    it('never lets a filter override or replace the companyId tenant scope', async () => {
      // Even a filter object shaped like it might try to smuggle a
      // companyId has no such field on ProjectFiltersDto to begin
      // with — this asserts the actual query sent to Prisma always
      // uses the companyId argument, not anything from `query`.
      await service.findAll('company-A', {
        page: 1,
        pageSize: 20,
        customerId: 'cust-1',
      } as any);

      const call = prisma.project.findMany.mock.calls[0][0];
      expect(call.where.companyId).toBe('company-A');
    });
  });

  describe('getProgressAndBudget', () => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    it('404s when the project does not belong to the caller company', async () => {
      prisma.project.findFirst.mockResolvedValue(null);
      await expect(service.getProgressAndBudget('company-1', 'project-1')).rejects.toThrow(NotFoundException);
    });

    it('computes percentComplete correctly and returns null when there are zero tasks', async () => {
      prisma.project.findFirst.mockResolvedValue({ id: 'project-1', name: 'P', budget: null });
      prisma.task.findMany.mockResolvedValue([]);
      prisma.timeEntry.aggregate.mockResolvedValue({ _sum: { laborCost: null } });

      const result = await service.getProgressAndBudget('company-1', 'project-1');

      expect(result.percentComplete).toBeNull();
      expect(result.taskCounts.total).toBe(0);
    });

    it('computes percentComplete as completed/total, ignoring cancelled tasks in the denominator only conceptually (they still count toward total)', async () => {
      prisma.project.findFirst.mockResolvedValue({ id: 'project-1', name: 'P', budget: null });
      prisma.task.findMany.mockResolvedValue([
        { id: 't1', status: 'completed', dueDate: null },
        { id: 't2', status: 'completed', dueDate: null },
        { id: 't3', status: 'pending', dueDate: null },
        { id: 't4', status: 'cancelled', dueDate: null },
      ]);
      prisma.timeEntry.aggregate.mockResolvedValue({ _sum: { laborCost: null } });

      const result = await service.getProgressAndBudget('company-1', 'project-1');

      // 2 completed / 4 total = 50%
      expect(result.percentComplete).toBe('50');
      expect(result.taskCounts.completed).toBe(2);
      expect(result.taskCounts.cancelled).toBe(1);
    });

    it('flags a task as overdue only when dueDate is in the past AND status is neither completed nor cancelled', async () => {
      prisma.project.findFirst.mockResolvedValue({ id: 'project-1', name: 'P', budget: null });
      prisma.task.findMany.mockResolvedValue([
        { id: 't1', status: 'pending', dueDate: yesterday }, // overdue
        { id: 't2', status: 'completed', dueDate: yesterday }, // NOT overdue — already completed
        { id: 't3', status: 'cancelled', dueDate: yesterday }, // NOT overdue — cancelled
        { id: 't4', status: 'in_progress', dueDate: tomorrow }, // NOT overdue — due date in future
      ]);
      prisma.timeEntry.aggregate.mockResolvedValue({ _sum: { laborCost: null } });

      const result = await service.getProgressAndBudget('company-1', 'project-1');

      expect(result.taskCounts.overdue).toBe(1);
    });

    it('treats a null laborCost sum (zero time entries) as zero actual cost, not an error', async () => {
      prisma.project.findFirst.mockResolvedValue({ id: 'project-1', name: 'P', budget: '10000.00' });
      prisma.task.findMany.mockResolvedValue([]);
      prisma.timeEntry.aggregate.mockResolvedValue({ _sum: { laborCost: null } });

      const result = await service.getProgressAndBudget('company-1', 'project-1');

      expect(result.actualLaborCost).toBe('0');
      expect(result.budgetVariance).toBe('10000');
    });

    it('flags health as at_risk when there is at least one overdue task, even with no budget set', async () => {
      prisma.project.findFirst.mockResolvedValue({ id: 'project-1', name: 'P', budget: null });
      prisma.task.findMany.mockResolvedValue([{ id: 't1', status: 'pending', dueDate: yesterday }]);
      prisma.timeEntry.aggregate.mockResolvedValue({ _sum: { laborCost: null } });

      const result = await service.getProgressAndBudget('company-1', 'project-1');

      expect(result.health).toBe('at_risk');
    });

    it('flags health as at_risk when actual cost exceeds budget, even with zero overdue tasks', async () => {
      prisma.project.findFirst.mockResolvedValue({ id: 'project-1', name: 'P', budget: '5000.00' });
      prisma.task.findMany.mockResolvedValue([]);
      prisma.timeEntry.aggregate.mockResolvedValue({ _sum: { laborCost: '6000.00' } });

      const result = await service.getProgressAndBudget('company-1', 'project-1');

      expect(result.health).toBe('at_risk');
      expect(result.budgetVariance).toBe('-1000');
    });

    it('flags health as on_track when there is no overdue task and the project is within (or has no) budget', async () => {
      prisma.project.findFirst.mockResolvedValue({ id: 'project-1', name: 'P', budget: '5000.00' });
      prisma.task.findMany.mockResolvedValue([{ id: 't1', status: 'in_progress', dueDate: tomorrow }]);
      prisma.timeEntry.aggregate.mockResolvedValue({ _sum: { laborCost: '3000.00' } });

      const result = await service.getProgressAndBudget('company-1', 'project-1');

      expect(result.health).toBe('on_track');
      expect(result.budgetUtilizationPercent).toBe('60');
    });

    it('returns null budgetVariance/budgetUtilizationPercent when no budget is set at all', async () => {
      prisma.project.findFirst.mockResolvedValue({ id: 'project-1', name: 'P', budget: null });
      prisma.task.findMany.mockResolvedValue([]);
      prisma.timeEntry.aggregate.mockResolvedValue({ _sum: { laborCost: '1000.00' } });

      const result = await service.getProgressAndBudget('company-1', 'project-1');

      expect(result.budgetVariance).toBeNull();
      expect(result.budgetUtilizationPercent).toBeNull();
    });

    it('scopes the labor cost aggregate to ONLY this project\'s tasks, not the whole company', async () => {
      prisma.project.findFirst.mockResolvedValue({ id: 'project-1', name: 'P', budget: null });
      prisma.task.findMany.mockResolvedValue([]);
      prisma.timeEntry.aggregate.mockResolvedValue({ _sum: { laborCost: null } });

      await service.getProgressAndBudget('company-1', 'project-1');

      const aggCall = prisma.timeEntry.aggregate.mock.calls[0][0];
      expect(aggCall.where.task.projectId).toBe('project-1');
    });

    describe('material cost from linked Bills (migration 083)', () => {
      it('combines labor AND material cost into actualTotalCost, and reports each separately', async () => {
        prisma.project.findFirst.mockResolvedValue({ id: 'project-1', name: 'P', budget: null });
        prisma.task.findMany.mockResolvedValue([]);
        prisma.timeEntry.aggregate.mockResolvedValue({ _sum: { laborCost: '3000.00' } });
        prisma.bill.aggregate.mockResolvedValue({ _sum: { total: '4500.00' } });

        const result = await service.getProgressAndBudget('company-1', 'project-1');

        expect(result.actualLaborCost).toBe('3000');
        expect(result.actualMaterialCost).toBe('4500');
        expect(result.actualTotalCost).toBe('7500');
      });

      it('treats a null material cost sum (zero linked bills) as zero, not an error', async () => {
        prisma.project.findFirst.mockResolvedValue({ id: 'project-1', name: 'P', budget: null });
        prisma.task.findMany.mockResolvedValue([]);
        prisma.timeEntry.aggregate.mockResolvedValue({ _sum: { laborCost: '3000.00' } });
        prisma.bill.aggregate.mockResolvedValue({ _sum: { total: null } });

        const result = await service.getProgressAndBudget('company-1', 'project-1');

        expect(result.actualMaterialCost).toBe('0');
        expect(result.actualTotalCost).toBe('3000');
      });

      it('excludes cancelled bills from the material cost query', async () => {
        prisma.project.findFirst.mockResolvedValue({ id: 'project-1', name: 'P', budget: null });
        prisma.task.findMany.mockResolvedValue([]);
        prisma.timeEntry.aggregate.mockResolvedValue({ _sum: { laborCost: null } });
        prisma.bill.aggregate.mockResolvedValue({ _sum: { total: null } });

        await service.getProgressAndBudget('company-1', 'project-1');

        const aggCall = prisma.bill.aggregate.mock.calls[0][0];
        expect(aggCall.where.status).toEqual({ not: 'cancelled' });
      });

      it('scopes the material cost aggregate to this project and this company, excluding soft-deleted bills', async () => {
        prisma.project.findFirst.mockResolvedValue({ id: 'project-1', name: 'P', budget: null });
        prisma.task.findMany.mockResolvedValue([]);
        prisma.timeEntry.aggregate.mockResolvedValue({ _sum: { laborCost: null } });
        prisma.bill.aggregate.mockResolvedValue({ _sum: { total: null } });

        await service.getProgressAndBudget('company-1', 'project-1');

        const aggCall = prisma.bill.aggregate.mock.calls[0][0];
        expect(aggCall.where.companyId).toBe('company-1');
        expect(aggCall.where.projectId).toBe('project-1');
        expect(aggCall.where.deletedAt).toBeNull();
      });

      it('budgetVariance/isOverBudget correctly reflect the COMBINED cost, not labor alone — a project under-budget on labor but over-budget once material is included is flagged at_risk', async () => {
        prisma.project.findFirst.mockResolvedValue({ id: 'project-1', name: 'P', budget: '5000.00' });
        prisma.task.findMany.mockResolvedValue([]);
        prisma.timeEntry.aggregate.mockResolvedValue({ _sum: { laborCost: '2000.00' } }); // under budget on labor alone
        prisma.bill.aggregate.mockResolvedValue({ _sum: { total: '4000.00' } }); // but total (2000+4000=6000) exceeds the 5000 budget

        const result = await service.getProgressAndBudget('company-1', 'project-1');

        expect(result.health).toBe('at_risk');
        expect(result.budgetVariance).toBe('-1000');
      });
    });
  });
});
