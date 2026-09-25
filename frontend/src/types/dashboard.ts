/**
 * Every field below is transcribed directly from the actual
 * return statements in backend/src/modules/dashboard/dashboard.service.ts
 * (buildCrmSummary, buildOperationsSummary, buildCrmSales,
 * buildOperationsBreakdown, buildWorkload — all re-read this
 * session). Nothing here is invented. Financial values are
 * decimal STRINGS (backend uses `Decimal.toFixed(2)`, confirmed
 * this session), never numbers — do not parse them as JS floats
 * beyond display formatting, matching the backend's own
 * never-JS-float-math-on-money rule.
 */

export type StatusBreakdown = Record<string, number>;
export type ValueByStatusBreakdown = Record<string, string>; // decimal strings, zero-filled as "0.00"
export type EmployeeCountMap = Record<string, number>; // keyed by employeeId (uuid)

/** GET /dashboard/summary — fields present depend on the caller's permissions (see RBAC notes below). */
export interface DashboardSummaryResponse {
  // Present only if the caller has CRM:customers:view (buildCrmSummary)
  totalCustomers?: number;
  newLeads?: number;
  openOpportunities?: number;
  pipelineValue?: string;
  // Present only if the caller has Operations:projects:view (buildOperationsSummary)
  activeProjects?: number;
  completedProjects?: number;
  openWorkOrders?: number;
  overdueWorkOrders?: number;
  pendingTasks?: number;
  completedTasks?: number;
  totalOpenAssignments?: number;
}

/** GET /dashboard/sales — requires CRM:customers:view, all fields always present. */
export interface DashboardSalesResponse {
  leadsByStatus: StatusBreakdown;
  opportunitiesByStage: StatusBreakdown;
  pipelineValue: string;
  opportunitiesWonLost: { won: number; lost: number };
  conversionRate: number; // 0..1, exactly won/(won+lost), 0 if denominator is 0 (never null/NaN)
  quotationsByStatus: StatusBreakdown;
  quotationValueByStatus: ValueByStatusBreakdown;
  acceptedQuotationValue: string;
}

/** GET /dashboard/operations — requires Operations:projects:view, all fields always present. */
export interface DashboardOperationsResponse {
  projectsByStatus: StatusBreakdown;
  workOrdersByStatus: StatusBreakdown;
  workOrdersByPriority: StatusBreakdown;
  overdueWorkOrders: number;
  tasksByStatus: StatusBreakdown;
  tasksByPriority: StatusBreakdown;
}

/**
 * GET /dashboard/workload — requires Operations:projects:view.
 * NOTE: keyed by employeeId only — the backend does not return
 * employee names in this response (confirmed this session). No
 * additional endpoint is called to resolve names; see the
 * WorkloadTable component and the Phase 3B report's "assumptions"
 * section for why.
 */
export interface DashboardWorkloadResponse {
  openTasksByEmployee: EmployeeCountMap;
  openWorkOrdersByEmployee: EmployeeCountMap;
  totalOpenAssignmentsByEmployee: EmployeeCountMap;
}

/**
 * Mirrors backend/src/modules/dashboard/dto/dashboard-filters.dto.ts
 * field-for-field — exactly these seven filters exist, no more.
 */
export interface DashboardFilters {
  dateFrom?: string;
  dateTo?: string;
  departmentId?: string;
  employeeId?: string;
  customerId?: string;
  projectId?: string;
  status?: string;
  priority?: string;
}
