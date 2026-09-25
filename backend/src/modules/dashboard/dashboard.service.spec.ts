import { Test } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DashboardService } from './dashboard.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CustomersService } from '../customers/customers.service';
import { ProjectsService } from '../projects/projects.service';

const { Decimal } = Prisma;

describe('DashboardService', () => {
  let service: DashboardService;
  let prisma: any;
  let customersService: any;
  let projectsService: any;

  beforeEach(async () => {
    prisma = {
      customer: { count: jest.fn() },
      lead: { count: jest.fn(), groupBy: jest.fn() },
      opportunity: { count: jest.fn(), aggregate: jest.fn(), groupBy: jest.fn() },
      quotation: { groupBy: jest.fn(), aggregate: jest.fn() },
      project: { count: jest.fn(), groupBy: jest.fn() },
      workOrder: { count: jest.fn(), groupBy: jest.fn() },
      task: { count: jest.fn(), groupBy: jest.fn() },
      employee: { findFirst: jest.fn() },
      department: { findFirst: jest.fn() },
    };

    customersService = { assertCustomerBelongsToCompany: jest.fn() };
    projectsService = { assertProjectBelongsToCompany: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        DashboardService,
        { provide: PrismaService, useValue: prisma },
        { provide: CustomersService, useValue: customersService },
        { provide: ProjectsService, useValue: projectsService },
      ],
    }).compile();

    service = moduleRef.get(DashboardService);

    // sensible defaults so every KPI method has something to return
    prisma.customer.count.mockResolvedValue(0);
    prisma.lead.count.mockResolvedValue(0);
    prisma.lead.groupBy.mockResolvedValue([]);
    prisma.opportunity.count.mockResolvedValue(0);
    prisma.opportunity.aggregate.mockResolvedValue({ _sum: { value: null } });
    prisma.opportunity.groupBy.mockResolvedValue([]);
    prisma.quotation.groupBy.mockResolvedValue([]);
    prisma.quotation.aggregate.mockResolvedValue({ _sum: { total: null } });
    prisma.project.count.mockResolvedValue(0);
    prisma.project.groupBy.mockResolvedValue([]);
    prisma.workOrder.count.mockResolvedValue(0);
    prisma.workOrder.groupBy.mockResolvedValue([]);
    prisma.task.count.mockResolvedValue(0);
    prisma.task.groupBy.mockResolvedValue([]);
  });

  // ============================================================
  // RBAC / partial / full permissions
  // ============================================================
  describe('getSummary — RBAC access model', () => {
    it('403s when the caller has neither CRM nor Operations view access', async () => {
      await expect(service.getSummary('company-A', ['Administration:users:view'], {})).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('CRM-only permissions: returns only CRM-derived keys, Operations keys entirely absent', async () => {
      const result = await service.getSummary('company-A', ['CRM:customers:view'], {});
      expect(result).toHaveProperty('totalCustomers');
      expect(result).toHaveProperty('newLeads');
      expect(result).toHaveProperty('openOpportunities');
      expect(result).toHaveProperty('pipelineValue');
      expect(result).not.toHaveProperty('activeProjects');
      expect(result).not.toHaveProperty('openWorkOrders');
      expect(result).not.toHaveProperty('pendingTasks');
      expect(result).not.toHaveProperty('totalOpenAssignments');
    });

    it('Operations-only permissions: returns only Operations-derived keys, CRM keys entirely absent', async () => {
      const result = await service.getSummary('company-A', ['Operations:projects:view'], {});
      expect(result).toHaveProperty('activeProjects');
      expect(result).toHaveProperty('completedProjects');
      expect(result).toHaveProperty('openWorkOrders');
      expect(result).toHaveProperty('totalOpenAssignments');
      expect(result).not.toHaveProperty('totalCustomers');
      expect(result).not.toHaveProperty('newLeads');
      expect(result).not.toHaveProperty('pipelineValue');
    });

    it('both permissions present: returns the full set of keys', async () => {
      const result = await service.getSummary('company-A', ['CRM:customers:view', 'Operations:projects:view'], {});
      expect(result).toHaveProperty('totalCustomers');
      expect(result).toHaveProperty('activeProjects');
    });

    it('never returns a zero-filled value for an unauthorized section — the key is absent, not 0', async () => {
      const result: any = await service.getSummary('company-A', ['CRM:customers:view'], {});
      expect('activeProjects' in result).toBe(false); // not present at all, not present-as-0
    });
  });

  // ============================================================
  // Tenant isolation
  // ============================================================
  describe('tenant isolation', () => {
    it('every count-based KPI query includes the caller companyId', async () => {
      await service.getSales('company-A', {});
      const calls = [
        ...prisma.lead.groupBy.mock.calls,
        ...prisma.opportunity.groupBy.mock.calls,
        ...prisma.quotation.groupBy.mock.calls,
      ];
      for (const [args] of calls) {
        expect(args.where.companyId).toBe('company-A');
      }
    });

    it('rejects a customerId filter belonging to another company before running any query', async () => {
      customersService.assertCustomerBelongsToCompany.mockRejectedValue(new NotFoundException());
      await expect(service.getSales('company-A', { customerId: 'cust-in-B' })).rejects.toThrow(NotFoundException);
      expect(prisma.lead.groupBy).not.toHaveBeenCalled();
    });

    it('rejects a projectId filter belonging to another company', async () => {
      projectsService.assertProjectBelongsToCompany.mockRejectedValue(new NotFoundException());
      await expect(service.getOperations('company-A', { projectId: 'proj-in-B' })).rejects.toThrow(NotFoundException);
    });

    it('rejects an employeeId filter belonging to another company', async () => {
      prisma.employee.findFirst.mockResolvedValue(null);
      await expect(service.getWorkload('company-A', { employeeId: 'emp-in-B' })).rejects.toThrow(ForbiddenException);
    });

    it('rejects a departmentId filter belonging to another company', async () => {
      prisma.department.findFirst.mockResolvedValue(null);
      await expect(service.getWorkload('company-A', { departmentId: 'dept-in-B' })).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  // ============================================================
  // Zero-filled status breakdowns (approved decision 3)
  // ============================================================
  describe('zero-filled status breakdowns', () => {
    it('projectsByStatus returns all six buckets even when most are empty', async () => {
      prisma.project.groupBy.mockResolvedValue([
        { status: 'approved', _count: { status: 3 } },
        { status: 'in_progress', _count: { status: 7 } },
        { status: 'completed', _count: { status: 12 } },
        { status: 'cancelled', _count: { status: 1 } },
      ]);

      const result = await service.getOperations('company-A', {});
      expect(result.projectsByStatus).toEqual({
        planning: 0,
        approved: 3,
        in_progress: 7,
        on_hold: 0,
        completed: 12,
        cancelled: 1,
      });
    });

    it('leadsByStatus returns all six buckets on a completely empty dataset', async () => {
      prisma.lead.groupBy.mockResolvedValue([]);
      const result = await service.getSales('company-A', {});
      expect(result.leadsByStatus).toEqual({
        new: 0,
        contacted: 0,
        qualified: 0,
        proposal: 0,
        won: 0,
        lost: 0,
      });
    });

    it('workOrdersByPriority zero-fills all four priority buckets', async () => {
      prisma.workOrder.groupBy.mockResolvedValue([{ priority: 'urgent', _count: { priority: 2 } }]);
      const result = await service.getOperations('company-A', {});
      expect(result.workOrdersByPriority).toEqual({ low: 0, medium: 0, high: 0, urgent: 2 });
    });
  });

  // ============================================================
  // KPI calculations — financial (Decimal, not JS floats)
  // ============================================================
  describe('financial calculations', () => {
    it('pipelineValue sums using Decimal and formats to 2 decimal places', async () => {
      prisma.opportunity.aggregate.mockResolvedValue({ _sum: { value: new Decimal('12345.678') } });
      const result = await service.getSummary('company-A', ['CRM:customers:view'], {});
      // Decimal('12345.678').toFixed(2) rounds to 12345.68
      expect(result.pipelineValue).toBe('12345.68');
    });

    it('pipelineValue returns "0.00" when there are no open opportunities', async () => {
      prisma.opportunity.aggregate.mockResolvedValue({ _sum: { value: null } });
      const result = await service.getSummary('company-A', ['CRM:customers:view'], {});
      expect(result.pipelineValue).toBe('0.00');
    });

    it('quotationValueByStatus zero-fills every status with "0.00" then overlays actual sums', async () => {
      // buildCrmSales fires quotationsByStatus (_count shape) and
      // quotationValueByStatus (_sum shape) concurrently — both call
      // the SAME prisma.quotation.groupBy mock, so a single flat
      // mockResolvedValue here would incorrectly apply the _sum-shaped
      // fixture to quotationsByStatus's call too, crashing on a
      // missing `_count`. Distinguish by inspecting the actual query.
      prisma.quotation.groupBy.mockImplementation((args: any) =>
        args._sum
          ? Promise.resolve([{ status: 'accepted', _sum: { total: new Decimal('5000') } }])
          : Promise.resolve([]),
      );
      const result = await service.getSales('company-A', {});
      expect(result.quotationValueByStatus).toEqual({
        draft: '0.00',
        sent: '0.00',
        accepted: '5000.00',
        rejected: '0.00',
        expired: '0.00',
      });
    });
  });

  // ============================================================
  // Conversion rate (approved decision 5)
  // ============================================================
  describe('conversion rate', () => {
    it('computes won / (won + lost)', async () => {
      prisma.opportunity.groupBy.mockResolvedValue([
        { stage: 'won', _count: { stage: 3 } },
        { stage: 'lost', _count: { stage: 1 } },
      ]);
      const result = await service.getSales('company-A', {});
      expect(result.conversionRate).toBe(0.75);
    });

    it('returns 0 (not null, not NaN) when won + lost = 0', async () => {
      prisma.opportunity.groupBy.mockResolvedValue([]);
      const result = await service.getSales('company-A', {});
      expect(result.conversionRate).toBe(0);
    });
  });

  // ============================================================
  // Workload — no double counting (approved requirement H)
  // ============================================================
  describe('workload aggregation', () => {
    it('Total Open Assignments by Employee is the SUM of the two independent maps, not a joined query', async () => {
      prisma.task.groupBy.mockResolvedValue([
        { assignedToEmployeeId: 'emp-1', _count: { assignedToEmployeeId: 4 } },
      ]);
      prisma.workOrder.groupBy.mockResolvedValue([
        { assignedToEmployeeId: 'emp-1', _count: { assignedToEmployeeId: 2 } },
        { assignedToEmployeeId: 'emp-2', _count: { assignedToEmployeeId: 5 } },
      ]);

      const result = await service.getWorkload('company-A', {});

      expect(result.openTasksByEmployee).toEqual({ 'emp-1': 4 });
      expect(result.openWorkOrdersByEmployee).toEqual({ 'emp-1': 2, 'emp-2': 5 });
      // emp-1 must be 4+2=6, not overwritten by either individual query
      expect(result.totalOpenAssignmentsByEmployee).toEqual({ 'emp-1': 6, 'emp-2': 5 });
    });

    it('no SQL UNION/join is used — task and work order queries are called independently', async () => {
      await service.getWorkload('company-A', {});
      expect(prisma.task.groupBy).toHaveBeenCalledTimes(1);
      expect(prisma.workOrder.groupBy).toHaveBeenCalledTimes(1);
    });

    it('the executive-level Total Open Assignments is also two independent counts summed', async () => {
      prisma.task.count.mockResolvedValue(10);
      prisma.workOrder.count.mockResolvedValue(4);
      const result = await service.getSummary('company-A', ['Operations:projects:view'], {});
      expect(result.totalOpenAssignments).toBe(14);
    });
  });

  // ============================================================
  // Empty datasets
  // ============================================================
  describe('empty datasets', () => {
    it('a company with zero of everything returns valid zero/empty shapes, never throws', async () => {
      const summary = await service.getSummary('company-A', ['CRM:customers:view', 'Operations:projects:view'], {});
      expect(summary.totalCustomers).toBe(0);
      expect(summary.newLeads).toBe(0);
      expect(summary.openOpportunities).toBe(0);
      expect(summary.pipelineValue).toBe('0.00');
      expect(summary.activeProjects).toBe(0);
      expect(summary.totalOpenAssignments).toBe(0);

      const sales = await service.getSales('company-A', {});
      expect(sales.leadsByStatus.new).toBe(0);
      expect(sales.conversionRate).toBe(0);

      const workload = await service.getWorkload('company-A', {});
      expect(workload.openTasksByEmployee).toEqual({});
      expect(workload.totalOpenAssignmentsByEmployee).toEqual({});
    });
  });

  // ============================================================
  // Date range filtering
  // ============================================================
  describe('date range filters', () => {
    it('newLeads applies dateFrom/dateTo to the createdAt filter', async () => {
      await service.getSummary('company-A', ['CRM:customers:view'], {
        dateFrom: '2026-01-01',
        dateTo: '2026-01-31',
      });
      const call = prisma.lead.count.mock.calls[0][0];
      expect(call.where.createdAt.gte).toEqual(new Date('2026-01-01'));
      expect(call.where.createdAt.lte).toEqual(new Date('2026-01-31'));
    });

    it('omits the date filter entirely when neither dateFrom nor dateTo is supplied', async () => {
      await service.getSummary('company-A', ['CRM:customers:view'], {});
      const call = prisma.lead.count.mock.calls[0][0];
      expect(call.where.createdAt).toBeUndefined();
    });
  });

  // ============================================================
  // Filters applying only where documented
  // ============================================================
  describe('filter scoping', () => {
    it('customerId filter is applied to the Open Opportunities and Pipeline Value queries', async () => {
      await service.getSummary('company-A', ['CRM:customers:view'], { customerId: 'cust-1' });

      const countCall = prisma.opportunity.count.mock.calls[0][0];
      expect(countCall.where.customerId).toBe('cust-1');

      const aggregateCall = prisma.opportunity.aggregate.mock.calls[0][0];
      expect(aggregateCall.where.customerId).toBe('cust-1');
    });

    it('projectId filter is applied to Open/Overdue Work Order queries but has no effect on Task-by-status queries requiring it separately', async () => {
      await service.getOperations('company-A', { projectId: 'proj-1' });

      const woStatusCall = prisma.workOrder.groupBy.mock.calls[0][0];
      expect(woStatusCall.where.projectId).toBe('proj-1');

      const taskStatusCall = prisma.task.groupBy.mock.calls[0][0];
      expect(taskStatusCall.where.projectId).toBe('proj-1');
    });

    it('a status filter does not throw even though the current KPI set does not apply it server-side to every count (documented as a no-op where inapplicable)', async () => {
      await expect(
        service.getSummary('company-A', ['CRM:customers:view'], { status: 'won' }),
      ).resolves.toBeDefined();
    });
  });
});
