import { PrismaService } from '../../prisma/prisma.service';

export interface ReportField {
  field: string;
  label: string;
}

export interface ReportFilter {
  field: string;
  operator: 'eq';
  value: string;
}

export interface ReportResultPoint {
  label: string;
  value: number;
}

export interface ReportEntityConfig {
  label: string;
  groupByFields: ReportField[];
  /** Numeric fields eligible for aggregateType: 'sum'. */
  sumFields: ReportField[];
  /** Fields eligible for a filter — kept intentionally small and string-equality-only (see ReportFilter). */
  filterFields: ReportField[];
  run: (
    prisma: PrismaService,
    companyId: string,
    groupByField: string,
    aggregateType: 'count' | 'sum',
    aggregateField: string | null,
    filters: ReportFilter[],
  ) => Promise<ReportResultPoint[]>;
}

/**
 * THE single safety boundary for the whole reports engine (see
 * migration 089's comment). A report definition's entityType,
 * groupByField, aggregateField, and every filter's field are
 * checked against THIS object — never passed through to a query
 * as raw user input. Adding a new reportable entity means adding
 * a new explicit entry here (and its own explicit run()
 * function), not exposing a generic "any table, any column" path.
 *
 * Each run() function is written out by hand per entity rather
 * than through one shared generic implementation — slightly more
 * repetitive, but each entity's query is independently readable
 * and auditable without tracing through a layer of dynamic
 * field-name plumbing.
 */
export const REPORTS_REGISTRY: Record<string, ReportEntityConfig> = {
  lead: {
    label: 'Leads',
    groupByFields: [
      { field: 'status', label: 'Status' },
      { field: 'source', label: 'Source' },
    ],
    sumFields: [],
    filterFields: [
      { field: 'status', label: 'Status' },
      { field: 'source', label: 'Source' },
    ],
    run: async (prisma, companyId, groupByField, aggregateType, _aggregateField, filters) => {
      const where = buildWhere(companyId, filters, { deletedAt: null });
      const rows = await prisma.lead.groupBy({
        by: [groupByField as 'status' | 'source'],
        where,
        _count: true,
      });
      return rows.map((r: any) => ({ label: String(r[groupByField] ?? '—'), value: r._count }));
    },
  },

  opportunity: {
    label: 'Opportunities',
    groupByFields: [{ field: 'stage', label: 'Stage' }],
    sumFields: [{ field: 'value', label: 'Value' }],
    filterFields: [{ field: 'stage', label: 'Stage' }],
    run: async (prisma, companyId, groupByField, aggregateType, aggregateField, filters) => {
      const where = buildWhere(companyId, filters, { deletedAt: null });
      const rows = await prisma.opportunity.groupBy({
        by: [groupByField as 'stage'],
        where,
        _count: true,
        _sum: aggregateType === 'sum' ? { value: true } : undefined,
      });
      return rows.map((r: any) => ({
        label: String(r[groupByField] ?? '—'),
        value: aggregateType === 'sum' ? Number(r._sum?.[aggregateField!] ?? 0) : r._count,
      }));
    },
  },

  invoice: {
    label: 'Invoices',
    groupByFields: [{ field: 'status', label: 'Status' }],
    sumFields: [{ field: 'total', label: 'Total' }],
    filterFields: [{ field: 'status', label: 'Status' }],
    run: async (prisma, companyId, groupByField, aggregateType, aggregateField, filters) => {
      const where = buildWhere(companyId, filters, { deletedAt: null });
      const rows = await prisma.invoice.groupBy({
        by: [groupByField as 'status'],
        where,
        _count: true,
        _sum: aggregateType === 'sum' ? { total: true } : undefined,
      });
      return rows.map((r: any) => ({
        label: String(r[groupByField] ?? '—'),
        value: aggregateType === 'sum' ? Number(r._sum?.[aggregateField!] ?? 0) : r._count,
      }));
    },
  },

  project: {
    label: 'Projects',
    groupByFields: [{ field: 'status', label: 'Status' }],
    sumFields: [{ field: 'budget', label: 'Budget' }],
    filterFields: [{ field: 'status', label: 'Status' }],
    run: async (prisma, companyId, groupByField, aggregateType, aggregateField, filters) => {
      const where = buildWhere(companyId, filters, { deletedAt: null });
      const rows = await prisma.project.groupBy({
        by: [groupByField as 'status'],
        where,
        _count: true,
        _sum: aggregateType === 'sum' ? { budget: true } : undefined,
      });
      return rows.map((r: any) => ({
        label: String(r[groupByField] ?? '—'),
        value: aggregateType === 'sum' ? Number(r._sum?.[aggregateField!] ?? 0) : r._count,
      }));
    },
  },
};

/**
 * Every filter's field was ALREADY checked against
 * config.filterFields by the caller (see ReportRunnerService)
 * before this is called — this function trusts that check and
 * only ever does string-equality filtering, never anything more
 * dynamic than `{ [field]: value }`.
 */
function buildWhere(companyId: string, filters: ReportFilter[], extra: Record<string, unknown>): Record<string, unknown> {
  const where: Record<string, unknown> = { companyId, ...extra };
  for (const f of filters) {
    where[f.field] = f.value;
  }
  return where;
}
