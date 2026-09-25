import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

const { Decimal } = Prisma;

const ISSUED_INVOICE_STATUSES = ['sent', 'partially_paid', 'paid', 'overdue'];

@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Monthly issued-invoice revenue for the last N months (default
   * 12), oldest first. Distinct from the Dashboard's /summary,
   * which only ever shows CURRENT totals — this is the trend line
   * an executive actually asks for ("show me revenue over time"),
   * not a snapshot.
   */
  async revenueTrend(companyId: string, months = 12) {
    const now = new Date();
    const startMonth = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);

    const invoices = await this.prisma.invoice.findMany({
      where: {
        companyId,
        deletedAt: null,
        status: { in: ISSUED_INVOICE_STATUSES },
        issueDate: { gte: startMonth },
      },
      select: { issueDate: true, total: true },
    });

    const buckets = new Map<string, Prisma.Decimal>();
    for (let i = 0; i < months; i++) {
      const d = new Date(startMonth.getFullYear(), startMonth.getMonth() + i, 1);
      buckets.set(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, new Decimal(0));
    }

    for (const inv of invoices) {
      const key = `${inv.issueDate.getFullYear()}-${String(inv.issueDate.getMonth() + 1).padStart(2, '0')}`;
      if (buckets.has(key)) {
        buckets.set(key, buckets.get(key)!.add(inv.total));
      }
    }

    return Array.from(buckets.entries()).map(([month, total]) => ({
      month,
      revenue: total.toDecimalPlaces(2).toString(),
    }));
  }

  /**
   * Lead → Opportunity → Won conversion counts and rates for a
   * given period, counted by CREATION date within the window.
   */
  async salesFunnel(companyId: string, fromDate: Date, toDate: Date) {
    const [totalLeads, convertedLeads, wonLeads, totalOpportunities, wonOpportunities, opportunityValueWon] = await Promise.all([
      this.prisma.lead.count({ where: { companyId, deletedAt: null, createdAt: { gte: fromDate, lte: toDate } } }),
      this.prisma.lead.count({
        where: { companyId, deletedAt: null, createdAt: { gte: fromDate, lte: toDate }, convertedAt: { not: null } },
      }),
      this.prisma.lead.count({
        where: { companyId, deletedAt: null, createdAt: { gte: fromDate, lte: toDate }, status: 'won' },
      }),
      this.prisma.opportunity.count({ where: { companyId, deletedAt: null, createdAt: { gte: fromDate, lte: toDate } } }),
      this.prisma.opportunity.count({
        where: { companyId, deletedAt: null, createdAt: { gte: fromDate, lte: toDate }, stage: 'won' },
      }),
      this.prisma.opportunity.aggregate({
        where: { companyId, deletedAt: null, createdAt: { gte: fromDate, lte: toDate }, stage: 'won' },
        _sum: { value: true },
      }),
    ]);

    const pct = (part: number, whole: number) => (whole > 0 ? new Decimal(part).div(whole).mul(100).toDecimalPlaces(1).toString() : '0');

    return {
      leads: { total: totalLeads, converted: convertedLeads, won: wonLeads },
      opportunities: { total: totalOpportunities, won: wonOpportunities },
      conversionRates: {
        leadToOpportunity: pct(convertedLeads, totalLeads),
        opportunityToWon: pct(wonOpportunities, totalOpportunities),
        leadToWon: pct(wonLeads, totalLeads),
      },
      wonOpportunityValue: (opportunityValueWon._sum.value ?? new Decimal(0)).toDecimalPlaces(2).toString(),
    };
  }

  /**
   * Customers ranked by issued-invoice revenue within the period.
   */
  async topCustomers(companyId: string, fromDate: Date, toDate: Date, limit = 10) {
    const grouped = await this.prisma.invoice.groupBy({
      by: ['customerId'],
      where: {
        companyId,
        deletedAt: null,
        status: { in: ISSUED_INVOICE_STATUSES },
        issueDate: { gte: fromDate, lte: toDate },
      },
      _sum: { total: true },
      _count: { id: true },
    });

    const ranked = grouped
      .map((g) => ({ customerId: g.customerId, revenue: g._sum.total ?? new Decimal(0), invoiceCount: g._count.id }))
      .sort((a, b) => (new Decimal(b.revenue).sub(a.revenue).gt(0) ? 1 : -1))
      .slice(0, limit);

    const customers = await this.prisma.customer.findMany({
      where: { id: { in: ranked.map((r) => r.customerId) } },
      select: { id: true, companyName: true },
    });
    const nameById = new Map(customers.map((c) => [c.id, c.companyName]));

    return ranked.map((r) => ({
      customerId: r.customerId,
      customerName: nameById.get(r.customerId) ?? 'Unknown',
      revenue: new Decimal(r.revenue).toDecimalPlaces(2).toString(),
      invoiceCount: r.invoiceCount,
    }));
  }

  /**
   * Billable vs total hours per employee within a period, from
   * Time Entries.
   */
  async employeeUtilization(companyId: string, fromDate: Date, toDate: Date) {
    const entries = await this.prisma.timeEntry.findMany({
      where: { companyId, deletedAt: null, entryDate: { gte: fromDate, lte: toDate } },
      select: { employeeId: true, hours: true, billable: true, laborCost: true },
    });

    const byEmployee = new Map<string, { totalHours: Prisma.Decimal; billableHours: Prisma.Decimal; totalCost: Prisma.Decimal; hasCost: boolean }>();
    for (const e of entries) {
      const bucket = byEmployee.get(e.employeeId) ?? { totalHours: new Decimal(0), billableHours: new Decimal(0), totalCost: new Decimal(0), hasCost: false };
      const hours = new Decimal(e.hours);
      bucket.totalHours = bucket.totalHours.add(hours);
      if (e.billable) bucket.billableHours = bucket.billableHours.add(hours);
      if (e.laborCost !== null) {
        bucket.hasCost = true;
        bucket.totalCost = bucket.totalCost.add(e.laborCost);
      }
      byEmployee.set(e.employeeId, bucket);
    }

    const employees = await this.prisma.employee.findMany({
      where: { id: { in: Array.from(byEmployee.keys()) } },
      select: { id: true, firstName: true, lastName: true },
    });
    const nameById = new Map(employees.map((emp) => [emp.id, `${emp.firstName} ${emp.lastName}`]));

    return Array.from(byEmployee.entries()).map(([employeeId, bucket]) => ({
      employeeId,
      employeeName: nameById.get(employeeId) ?? 'Unknown',
      totalHours: bucket.totalHours.toDecimalPlaces(2).toString(),
      billableHours: bucket.billableHours.toDecimalPlaces(2).toString(),
      utilizationRate: bucket.totalHours.gt(0) ? bucket.billableHours.div(bucket.totalHours).mul(100).toDecimalPlaces(1).toString() : '0',
      totalCost: bucket.hasCost ? bucket.totalCost.toDecimalPlaces(2).toString() : null,
    }));
  }

  /**
   * Sales forecasting, built ENTIRELY from data that already
   * exists on Opportunity — no schema change was needed for this
   * feature at all.
   *
   * "Weighted value" = value × probability. When an opportunity
   * has no explicit probability set, DEFAULT_PROBABILITY_BY_STAGE
   * is used as a read-time fallback ONLY for this calculation —
   * it is never written back onto the opportunity record. These
   * defaults are ordinary, disclosed industry-standard estimates
   * (10/25/50/75%), not a value derived from this company's own
   * history — a sales manager should adjust individual
   * opportunities' probability once real patterns emerge.
   *
   * historicalWinRate is a SIMPLE overall ratio
   * (won ÷ (won + lost)) across all-time closed opportunities —
   * not a sophisticated stage-by-stage conditional model, since
   * this system does not track stage-transition history (only the
   * CURRENT stage), so "how often does an opportunity that once
   * reached stage X eventually win" cannot be computed honestly
   * from what's stored today.
   */
  async salesForecast(companyId: string) {
    const OPEN_STAGES = ['prospecting', 'qualification', 'proposal', 'negotiation'];
    const DEFAULT_PROBABILITY_BY_STAGE: Record<string, number> = {
      prospecting: 10,
      qualification: 25,
      proposal: 50,
      negotiation: 75,
    };

    const [openOpportunities, wonCount, lostCount] = await Promise.all([
      this.prisma.opportunity.findMany({
        where: { companyId, deletedAt: null, stage: { in: OPEN_STAGES } },
        select: {
          id: true,
          value: true,
          stage: true,
          probability: true,
          expectedCloseDate: true,
          ownerId: true,
          owner: { select: { name: true } },
        },
      }),
      this.prisma.opportunity.count({ where: { companyId, deletedAt: null, stage: 'won' } }),
      this.prisma.opportunity.count({ where: { companyId, deletedAt: null, stage: 'lost' } }),
    ]);

    const historicalWinRate =
      wonCount + lostCount > 0 ? new Decimal(wonCount).div(wonCount + lostCount).mul(100).toDecimalPlaces(1).toString() : null;

    let totalPipeline = new Decimal(0);
    let weightedPipeline = new Decimal(0);
    const byStage = new Map<string, { count: number; pipelineValue: Prisma.Decimal; weightedValue: Prisma.Decimal }>();
    const byMonth = new Map<string, { pipelineValue: Prisma.Decimal; weightedValue: Prisma.Decimal }>();
    const byOwner = new Map<string, { ownerName: string; pipelineValue: Prisma.Decimal; weightedValue: Prisma.Decimal }>();

    for (const opp of openOpportunities) {
      const value = new Decimal(opp.value ?? 0);
      const probability = opp.probability ?? DEFAULT_PROBABILITY_BY_STAGE[opp.stage] ?? 0;
      const weighted = value.mul(probability).div(100);

      totalPipeline = totalPipeline.add(value);
      weightedPipeline = weightedPipeline.add(weighted);

      const stageBucket = byStage.get(opp.stage) ?? { count: 0, pipelineValue: new Decimal(0), weightedValue: new Decimal(0) };
      stageBucket.count += 1;
      stageBucket.pipelineValue = stageBucket.pipelineValue.add(value);
      stageBucket.weightedValue = stageBucket.weightedValue.add(weighted);
      byStage.set(opp.stage, stageBucket);

      const monthKey = opp.expectedCloseDate ? opp.expectedCloseDate.toISOString().slice(0, 7) : 'unscheduled';
      const monthBucket = byMonth.get(monthKey) ?? { pipelineValue: new Decimal(0), weightedValue: new Decimal(0) };
      monthBucket.pipelineValue = monthBucket.pipelineValue.add(value);
      monthBucket.weightedValue = monthBucket.weightedValue.add(weighted);
      byMonth.set(monthKey, monthBucket);

      const ownerKey = opp.ownerId ?? 'unassigned';
      const ownerBucket = byOwner.get(ownerKey) ?? { ownerName: opp.owner?.name ?? 'Unassigned', pipelineValue: new Decimal(0), weightedValue: new Decimal(0) };
      ownerBucket.pipelineValue = ownerBucket.pipelineValue.add(value);
      ownerBucket.weightedValue = ownerBucket.weightedValue.add(weighted);
      byOwner.set(ownerKey, ownerBucket);
    }

    const toStr = (d: Prisma.Decimal) => d.toDecimalPlaces(2).toString();

    return {
      totalPipelineValue: toStr(totalPipeline),
      weightedPipelineValue: toStr(weightedPipeline),
      openOpportunityCount: openOpportunities.length,
      historicalWinRate,
      byStage: Array.from(byStage.entries()).map(([stage, v]) => ({
        stage,
        count: v.count,
        pipelineValue: toStr(v.pipelineValue),
        weightedValue: toStr(v.weightedValue),
      })),
      byMonth: Array.from(byMonth.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, v]) => ({ month, pipelineValue: toStr(v.pipelineValue), weightedValue: toStr(v.weightedValue) })),
      byOwner: Array.from(byOwner.entries()).map(([ownerId, v]) => ({
        ownerId,
        ownerName: v.ownerName,
        pipelineValue: toStr(v.pipelineValue),
        weightedValue: toStr(v.weightedValue),
      })),
    };
  }
}
