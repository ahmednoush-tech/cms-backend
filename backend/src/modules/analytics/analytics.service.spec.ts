import { Test } from '@nestjs/testing';
import { AnalyticsService } from './analytics.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('AnalyticsService', () => {
  let service: AnalyticsService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      invoice: { findMany: jest.fn(), groupBy: jest.fn() },
      lead: { count: jest.fn() },
      opportunity: { count: jest.fn(), aggregate: jest.fn(), findMany: jest.fn() },
      customer: { findMany: jest.fn() },
      timeEntry: { findMany: jest.fn() },
      employee: { findMany: jest.fn() },
    };

    const moduleRef = await Test.createTestingModule({
      providers: [AnalyticsService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = moduleRef.get(AnalyticsService);
  });

  describe('revenueTrend', () => {
    it('only counts ISSUED invoice statuses, never drafts', async () => {
      prisma.invoice.findMany.mockResolvedValue([]);

      await service.revenueTrend('company-1', 3);

      const call = prisma.invoice.findMany.mock.calls[0][0];
      expect(call.where.status.in).toEqual(['sent', 'partially_paid', 'paid', 'overdue']);
      expect(call.where.status.in).not.toContain('draft');
    });

    it('returns a zero-filled bucket for a month with no invoices, not a missing entry', async () => {
      prisma.invoice.findMany.mockResolvedValue([]);

      const result = await service.revenueTrend('company-1', 3);

      expect(result).toHaveLength(3);
      expect(result.every((r) => r.revenue === '0')).toBe(true);
    });

    it('sums multiple invoices into the correct month bucket', async () => {
      const thisMonth = new Date();
      prisma.invoice.findMany.mockResolvedValue([
        { issueDate: new Date(thisMonth.getFullYear(), thisMonth.getMonth(), 5), total: '1000.00' },
        { issueDate: new Date(thisMonth.getFullYear(), thisMonth.getMonth(), 20), total: '500.00' },
      ]);

      const result = await service.revenueTrend('company-1', 1);

      expect(result).toHaveLength(1);
      expect(result[0].revenue).toBe('1500');
    });
  });

  describe('salesFunnel', () => {
    it('computes conversion rates as percentages with one decimal place', async () => {
      prisma.lead.count.mockResolvedValueOnce(100);
      prisma.lead.count.mockResolvedValueOnce(40);
      prisma.lead.count.mockResolvedValueOnce(20);
      prisma.opportunity.count.mockResolvedValueOnce(40);
      prisma.opportunity.count.mockResolvedValueOnce(20);
      prisma.opportunity.aggregate.mockResolvedValue({ _sum: { value: '500000.00' } });

      const result = await service.salesFunnel('company-1', new Date('2026-01-01'), new Date('2026-12-31'));

      expect(result.conversionRates.leadToOpportunity).toBe('40.0');
      expect(result.conversionRates.opportunityToWon).toBe('50.0');
      expect(result.conversionRates.leadToWon).toBe('20.0');
    });

    it('returns 0% (not NaN or a crash) when there are zero leads in the period', async () => {
      prisma.lead.count.mockResolvedValue(0);
      prisma.opportunity.count.mockResolvedValue(0);
      prisma.opportunity.aggregate.mockResolvedValue({ _sum: { value: null } });

      const result = await service.salesFunnel('company-1', new Date('2026-01-01'), new Date('2026-12-31'));

      expect(result.conversionRates.leadToOpportunity).toBe('0');
      expect(result.wonOpportunityValue).toBe('0');
    });
  });

  describe('topCustomers', () => {
    it('ranks customers by revenue descending', async () => {
      prisma.invoice.groupBy.mockResolvedValue([
        { customerId: 'cust-1', _sum: { total: '1000.00' }, _count: { id: 2 } },
        { customerId: 'cust-2', _sum: { total: '5000.00' }, _count: { id: 1 } },
      ]);
      prisma.customer.findMany.mockResolvedValue([
        { id: 'cust-1', name: 'Small Co' },
        { id: 'cust-2', name: 'Big Co' },
      ]);

      const result = await service.topCustomers('company-1', new Date('2026-01-01'), new Date('2026-12-31'));

      expect(result[0].customerName).toBe('Big Co');
      expect(result[0].revenue).toBe('5000');
      expect(result[1].customerName).toBe('Small Co');
    });

    it('respects the limit parameter', async () => {
      prisma.invoice.groupBy.mockResolvedValue([
        { customerId: 'c1', _sum: { total: '100.00' }, _count: { id: 1 } },
        { customerId: 'c2', _sum: { total: '200.00' }, _count: { id: 1 } },
        { customerId: 'c3', _sum: { total: '300.00' }, _count: { id: 1 } },
      ]);
      prisma.customer.findMany.mockResolvedValue([]);

      const result = await service.topCustomers('company-1', new Date('2026-01-01'), new Date('2026-12-31'), 2);

      expect(result).toHaveLength(2);
    });
  });

  describe('employeeUtilization', () => {
    it('computes utilization rate as billableHours / totalHours', async () => {
      prisma.timeEntry.findMany.mockResolvedValue([
        { employeeId: 'emp-1', hours: '8.00', billable: true, laborCost: '400.00' },
        { employeeId: 'emp-1', hours: '2.00', billable: false, laborCost: '100.00' },
      ]);
      prisma.employee.findMany.mockResolvedValue([{ id: 'emp-1', firstName: 'Ahmed', lastName: 'Ali' }]);

      const result = await service.employeeUtilization('company-1', new Date('2026-01-01'), new Date('2026-01-31'));

      expect(result[0].totalHours).toBe('10');
      expect(result[0].billableHours).toBe('8');
      expect(result[0].utilizationRate).toBe('80.0');
    });

    it('returns totalCost as null (not "0") when no entry in the period has a priced rate', async () => {
      prisma.timeEntry.findMany.mockResolvedValue([
        { employeeId: 'emp-1', hours: '8.00', billable: true, laborCost: null },
      ]);
      prisma.employee.findMany.mockResolvedValue([{ id: 'emp-1', firstName: 'Ahmed', lastName: 'Ali' }]);

      const result = await service.employeeUtilization('company-1', new Date('2026-01-01'), new Date('2026-01-31'));

      expect(result[0].totalCost).toBeNull();
    });
  });

  describe('salesForecast', () => {
    it('uses the explicit probability when set, ignoring the stage default', async () => {
      prisma.opportunity.findMany.mockResolvedValue([
        { id: 'o1', value: '10000.00', stage: 'proposal', probability: 90, expectedCloseDate: new Date('2026-06-15'), ownerId: 'u1', owner: { name: 'Sara' } },
      ]);
      prisma.opportunity.count.mockResolvedValue(0);

      const result = await service.salesForecast('company-1');

      // proposal's default would be 50%, but explicit 90% must win: 10,000 * 0.90 = 9,000
      expect(result.weightedPipelineValue).toBe('9000');
    });

    it('falls back to the industry-standard default probability by stage when none is set', async () => {
      prisma.opportunity.findMany.mockResolvedValue([
        { id: 'o1', value: '10000.00', stage: 'qualification', probability: null, expectedCloseDate: null, ownerId: null, owner: null },
      ]);
      prisma.opportunity.count.mockResolvedValue(0);

      const result = await service.salesForecast('company-1');

      // qualification default = 25%: 10,000 * 0.25 = 2,500
      expect(result.weightedPipelineValue).toBe('2500');
    });

    it('groups opportunities with no expectedCloseDate into an "unscheduled" bucket rather than dropping them', async () => {
      prisma.opportunity.findMany.mockResolvedValue([
        { id: 'o1', value: '5000.00', stage: 'prospecting', probability: 20, expectedCloseDate: null, ownerId: null, owner: null },
      ]);
      prisma.opportunity.count.mockResolvedValue(0);

      const result = await service.salesForecast('company-1');

      expect(result.byMonth).toHaveLength(1);
      expect(result.byMonth[0].month).toBe('unscheduled');
    });

    it('computes historicalWinRate as a simple won/(won+lost) ratio', async () => {
      prisma.opportunity.findMany.mockResolvedValue([]);
      prisma.opportunity.count.mockImplementation(({ where }: any) => {
        if (where.stage === 'won') return Promise.resolve(3);
        if (where.stage === 'lost') return Promise.resolve(1);
        return Promise.resolve(0);
      });

      const result = await service.salesForecast('company-1');

      expect(result.historicalWinRate).toBe('75'); // 3 / (3+1) = 75%
    });

    it('returns null historicalWinRate when there are zero closed opportunities — not a misleading 0%', async () => {
      prisma.opportunity.findMany.mockResolvedValue([]);
      prisma.opportunity.count.mockResolvedValue(0);

      const result = await service.salesForecast('company-1');

      expect(result.historicalWinRate).toBeNull();
    });

    it('groups pipeline correctly by stage, month, and owner across multiple opportunities', async () => {
      prisma.opportunity.findMany.mockResolvedValue([
        { id: 'o1', value: '10000.00', stage: 'proposal', probability: 50, expectedCloseDate: new Date('2026-06-10'), ownerId: 'u1', owner: { name: 'Sara' } },
        { id: 'o2', value: '20000.00', stage: 'proposal', probability: 50, expectedCloseDate: new Date('2026-06-20'), ownerId: 'u1', owner: { name: 'Sara' } },
        { id: 'o3', value: '5000.00', stage: 'negotiation', probability: 80, expectedCloseDate: new Date('2026-07-01'), ownerId: 'u2', owner: { name: 'Omar' } },
      ]);
      prisma.opportunity.count.mockResolvedValue(0);

      const result = await service.salesForecast('company-1');

      expect(result.totalPipelineValue).toBe('35000');
      expect(result.openOpportunityCount).toBe(3);

      const proposalStage = result.byStage.find((s: any) => s.stage === 'proposal')!;
      expect(proposalStage.count).toBe(2);
      expect(proposalStage.pipelineValue).toBe('30000');

      const juneMonth = result.byMonth.find((m: any) => m.month === '2026-06')!;
      expect(juneMonth.pipelineValue).toBe('30000');

      const saraOwner = result.byOwner.find((o: any) => o.ownerName === 'Sara')!;
      expect(saraOwner.pipelineValue).toBe('30000');
    });

    it('only includes OPEN-stage opportunities in the pipeline — won/lost are excluded entirely', async () => {
      // The query itself filters `stage: { in: OPEN_STAGES }`, so a
      // won/lost opportunity would never be returned by a real DB —
      // this confirms the service doesn't ALSO need to filter them
      // again client-side, by checking the exact where clause used.
      prisma.opportunity.findMany.mockResolvedValue([]);
      prisma.opportunity.count.mockResolvedValue(0);

      await service.salesForecast('company-1');

      const findManyCall = prisma.opportunity.findMany.mock.calls[0][0];
      expect(findManyCall.where.stage.in).toEqual(['prospecting', 'qualification', 'proposal', 'negotiation']);
      expect(findManyCall.where.stage.in).not.toContain('won');
      expect(findManyCall.where.stage.in).not.toContain('lost');
    });
  });
});
