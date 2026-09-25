import { PERMISSIONS, DASHBOARD_SUMMARY_ANY_OF } from '../rbac/permissionConstants';

export interface RouteMeta {
  path: string;
  navLabelKey?: string; // i18n key under "nav" namespace — omit for routes not shown in the sidebar
  requiredPermissions?: readonly string[];
  matchAny?: boolean;
  group?: 'dashboard' | 'crm' | 'operations' | 'finance' | 'fleet' | 'hr' | 'payroll' | 'administration';
  /** True for pages this phase deliberately does not build real content for yet (design doc P.2). */
  isPlaceholder?: boolean;
}

/**
 * Phase 3A built /login, /403, /404, /portal-unavailable, and
 * placeholder shells for every module. Phase 3B (this update)
 * replaces the /dashboard placeholder with real content and adds
 * its three sub-routes (/dashboard/sales, /dashboard/operations,
 * /dashboard/workload) — those three are intentionally NOT given
 * a navLabelKey, since they're not separate Sidebar entries; they
 * are reached via the in-page DashboardTabs component, matching
 * the design doc's route map (one Sidebar link, four backend-
 * mapped sub-views). Every other CRM/Operations/Administration
 * route remains an unbuilt placeholder, per this phase's explicit
 * "do not start CRM" instruction.
 */
export const ROUTES: RouteMeta[] = [
  { path: '/dashboard', navLabelKey: 'nav:dashboard', group: 'dashboard', matchAny: true, requiredPermissions: DASHBOARD_SUMMARY_ANY_OF },
  { path: '/analytics', navLabelKey: 'nav:analytics', group: 'dashboard', requiredPermissions: [PERMISSIONS.Analytics.reports.view] },
  { path: '/analytics/sales-forecast', navLabelKey: 'nav:salesForecast', group: 'dashboard', requiredPermissions: [PERMISSIONS.Analytics.reports.view] },
  { path: '/dashboard/sales', requiredPermissions: [PERMISSIONS.CRM.customers.view] },
  { path: '/dashboard/operations', requiredPermissions: [PERMISSIONS.Operations.projects.view] },
  { path: '/dashboard/workload', requiredPermissions: [PERMISSIONS.Operations.projects.view] },

  { path: '/crm/customers', navLabelKey: 'nav:customers', group: 'crm', requiredPermissions: [PERMISSIONS.CRM.customers.view] },
  { path: '/crm/leads', navLabelKey: 'nav:leads', group: 'crm', requiredPermissions: [PERMISSIONS.CRM.leads.view] },
  { path: '/crm/opportunities', navLabelKey: 'nav:opportunities', group: 'crm', requiredPermissions: [PERMISSIONS.CRM.opportunities.view] },
  { path: '/crm/quotations', navLabelKey: 'nav:quotations', group: 'crm', requiredPermissions: [PERMISSIONS.CRM.quotations.view] },
  // No requiredPermissions — a personal, self-managed integration any authenticated user can access.
  { path: '/crm/email-integration', navLabelKey: 'nav:emailIntegration', group: 'crm' },
  { path: '/crm/automation-rules', navLabelKey: 'nav:automationRules', group: 'crm', requiredPermissions: [PERMISSIONS.CRM.automationRules.view] },
  { path: '/crm/custom-fields', navLabelKey: 'nav:customFields', group: 'crm', requiredPermissions: [PERMISSIONS.CRM.customFields.view] },

  { path: '/ops/projects', navLabelKey: 'nav:projects', group: 'operations', requiredPermissions: [PERMISSIONS.Operations.projects.view] },
  { path: '/ops/work-orders', navLabelKey: 'nav:workOrders', group: 'operations', requiredPermissions: [PERMISSIONS.Operations.workOrders.view] },
  { path: '/ops/tasks', navLabelKey: 'nav:tasks', group: 'operations', requiredPermissions: [PERMISSIONS.Operations.tasks.view] },
  { path: '/ops/warehouses', navLabelKey: 'nav:warehouses', group: 'operations', requiredPermissions: [PERMISSIONS.Operations.warehouses.view] },
  { path: '/ops/stock-items', navLabelKey: 'nav:stockItems', group: 'operations', requiredPermissions: [PERMISSIONS.Operations.stockItems.view] },
  { path: '/ops/low-stock', navLabelKey: 'nav:lowStock', group: 'operations', requiredPermissions: [PERMISSIONS.Operations.inventoryStock.view] },
  { path: '/finance/accounts', navLabelKey: 'nav:accounts', group: 'finance', requiredPermissions: [PERMISSIONS.Finance.accounts.view] },
  { path: '/finance/journal-entries', navLabelKey: 'nav:journalEntries', group: 'finance', requiredPermissions: [PERMISSIONS.Finance.journalEntries.view] },
  { path: '/finance/invoices', navLabelKey: 'nav:invoices', group: 'finance', requiredPermissions: [PERMISSIONS.Finance.invoices.view] },
  { path: '/finance/vendors', navLabelKey: 'nav:vendors', group: 'finance', requiredPermissions: [PERMISSIONS.Finance.vendors.view] },
  { path: '/finance/bills', navLabelKey: 'nav:bills', group: 'finance', requiredPermissions: [PERMISSIONS.Finance.bills.view] },
  { path: '/finance/purchase-orders', navLabelKey: 'nav:purchaseOrders', group: 'finance', requiredPermissions: [PERMISSIONS.Finance.purchaseOrders.view] },
  { path: '/finance/fixed-assets', navLabelKey: 'nav:fixedAssets', group: 'finance', requiredPermissions: [PERMISSIONS.Finance.fixedAssets.view] },
  { path: '/finance/bank-reconciliation', navLabelKey: 'nav:bankReconciliation', group: 'finance', requiredPermissions: [PERMISSIONS.Finance.bankReconciliation.view] },
  { path: '/finance/recurring-invoices', navLabelKey: 'nav:recurringInvoices', group: 'finance', requiredPermissions: [PERMISSIONS.Finance.recurringInvoices.view] },
  { path: '/fleet/vehicles', navLabelKey: 'nav:vehicles', group: 'fleet', requiredPermissions: [PERMISSIONS.Fleet.vehicles.view] },
  { path: '/hr/leave-types', navLabelKey: 'nav:leaveTypes', group: 'hr', requiredPermissions: [PERMISSIONS.HR.leaveTypes.view] },
  { path: '/hr/leave-balances', navLabelKey: 'nav:leaveBalances', group: 'hr', requiredPermissions: [PERMISSIONS.HR.leaveBalances.view] },
  { path: '/hr/leave-requests', navLabelKey: 'nav:leaveRequests', group: 'hr', requiredPermissions: [PERMISSIONS.HR.leaveRequests.view] },
  { path: '/hr/performance-cycles', navLabelKey: 'nav:performanceCycles', group: 'hr', requiredPermissions: [PERMISSIONS.HR.performanceCycles.view] },
  { path: '/hr/performance-criteria', navLabelKey: 'nav:performanceCriteria', group: 'hr', requiredPermissions: [PERMISSIONS.HR.performanceCriteria.view] },
  { path: '/hr/performance-evaluations', navLabelKey: 'nav:performanceEvaluations', group: 'hr', requiredPermissions: [PERMISSIONS.HR.performanceEvaluations.view] },
  { path: '/finance/reports/trial-balance', navLabelKey: 'nav:trialBalance', group: 'finance', requiredPermissions: [PERMISSIONS.Finance.reports.view] },
  { path: '/finance/reports/income-statement', navLabelKey: 'nav:incomeStatement', group: 'finance', requiredPermissions: [PERMISSIONS.Finance.reports.view] },
  { path: '/finance/reports/balance-sheet', navLabelKey: 'nav:balanceSheet', group: 'finance', requiredPermissions: [PERMISSIONS.Finance.reports.view] },
  { path: '/finance/reports/cash-flow', navLabelKey: 'nav:cashFlow', group: 'finance', requiredPermissions: [PERMISSIONS.Finance.reports.view] },
  { path: '/finance/reports/zakat-estimate', navLabelKey: 'nav:zakatEstimate', group: 'finance', requiredPermissions: [PERMISSIONS.Finance.reports.view] },
  { path: '/finance/customer-payments', navLabelKey: 'nav:customerPayments', group: 'finance', requiredPermissions: [PERMISSIONS.Finance.customerPayments.view] },
  { path: '/finance/reports/customer-aging', navLabelKey: 'nav:customerAging', group: 'finance', requiredPermissions: [PERMISSIONS.Finance.reports.view] },
  { path: '/finance/customer-statement', navLabelKey: 'nav:customerStatement', group: 'finance', requiredPermissions: [PERMISSIONS.Finance.reports.view] },
  { path: '/finance/reports/account-ledger', navLabelKey: 'nav:accountLedger', group: 'finance', requiredPermissions: [PERMISSIONS.Finance.reports.view] },
  { path: '/finance/inventory', navLabelKey: 'nav:inventory', group: 'finance', requiredPermissions: [PERMISSIONS.Finance.inventory.view] },
  { path: '/payroll/runs', navLabelKey: 'nav:payrollRuns', group: 'payroll', requiredPermissions: [PERMISSIONS.Payroll.runs.view] },
  { path: '/payroll/settings', navLabelKey: 'nav:payrollSettings', group: 'payroll', requiredPermissions: [PERMISSIONS.Payroll.settings.manage] },
  { path: '/finance/periods', navLabelKey: 'nav:periods', group: 'finance', requiredPermissions: [PERMISSIONS.Finance.periods.view] },
  { path: '/finance/settings', navLabelKey: 'nav:financeSettings', group: 'finance', requiredPermissions: [PERMISSIONS.Finance.settings.manage] },

  { path: '/admin/departments', navLabelKey: 'nav:departments', group: 'administration', requiredPermissions: [PERMISSIONS.Administration.departments.view] },
  { path: '/admin/employees', navLabelKey: 'nav:employees', group: 'administration', requiredPermissions: [PERMISSIONS.Administration.employees.view] },
  { path: '/admin/users', navLabelKey: 'nav:users', group: 'administration', requiredPermissions: [PERMISSIONS.Administration.users.view] },
  { path: '/admin/roles', navLabelKey: 'nav:roles', group: 'administration', requiredPermissions: [PERMISSIONS.Administration.roles.manage] },
  { path: '/admin/activity-logs', navLabelKey: 'nav:activityLogs', group: 'administration', requiredPermissions: [PERMISSIONS.Administration.activityLogs.view] },
  { path: '/admin/company-settings', navLabelKey: 'nav:companySettings', group: 'administration', requiredPermissions: [PERMISSIONS.Administration.companySettings.manage] },
  { path: '/analytics/custom-reports', navLabelKey: 'nav:customReports', group: 'administration', requiredPermissions: [PERMISSIONS.Analytics.customReports.view] },
  { path: '/administration/approval-workflows', navLabelKey: 'nav:approvalWorkflows', group: 'administration', requiredPermissions: [PERMISSIONS.Administration.approvalWorkflows.view] },
  { path: '/administration/my-approvals', navLabelKey: 'nav:myApprovals', group: 'administration', requiredPermissions: [PERMISSIONS.Administration.approvalRequests.action] },
  { path: '/administration/approval-requests', navLabelKey: 'nav:approvalRequests', group: 'administration', requiredPermissions: [PERMISSIONS.Administration.approvalRequests.create] },

  // No backend read endpoint exists for either of these (confirmed
  // this session — no NotificationsController/ActivityLogController).
  // Routes exist so the Sidebar/Topbar can link somewhere real
  // rather than a dead link, but the page itself explicitly states
  // the data isn't available yet — never a fake/mocked list.
  { path: '/notifications', navLabelKey: 'nav:notifications', isPlaceholder: true },
  { path: '/activity-log', navLabelKey: 'nav:activityLog', isPlaceholder: true },
];

export function findRouteMeta(path: string): RouteMeta | undefined {
  return ROUTES.find((r) => r.path === path);
}
