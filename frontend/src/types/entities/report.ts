export type ReportChartType = 'bar' | 'line' | 'table';
export type ReportAggregateType = 'count' | 'sum';

export interface ReportField {
  field: string;
  label: string;
}

export interface ReportFilter {
  field: string;
  operator: 'eq';
  value: string;
}

export interface ReportEntityMetadata {
  label: string;
  groupByFields: ReportField[];
  sumFields: ReportField[];
  filterFields: ReportField[];
}

/** Keyed by entityType (e.g. 'lead', 'opportunity') — see backend REPORTS_REGISTRY. */
export type ReportsRegistryMetadata = Record<string, ReportEntityMetadata>;

export interface ReportDefinition {
  id: string;
  companyId: string;
  name: string;
  entityType: string;
  groupByField: string;
  aggregateType: ReportAggregateType;
  aggregateField: string | null;
  chartType: ReportChartType;
  filters: ReportFilter[];
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateReportDefinitionInput {
  name: string;
  entityType: string;
  groupByField: string;
  aggregateType: ReportAggregateType;
  aggregateField?: string;
  chartType?: ReportChartType;
  filters?: ReportFilter[];
}

export interface UpdateReportDefinitionInput {
  name?: string;
  entityType?: string;
  groupByField?: string;
  aggregateType?: ReportAggregateType;
  aggregateField?: string;
  chartType?: ReportChartType;
  filters?: ReportFilter[];
}

export interface ReportResultPoint {
  label: string;
  value: number;
}
