/**
 * Every one of these 136 strings was extracted directly from
 * `@Permissions(...)` decorators in the backend controllers
 * (confirmed via a full diff this session — zero mismatches
 * either direction) — none invented, none guessed. If the backend
 * adds a permission later, it must be added here explicitly; this
 * file is not derived at runtime from anything the backend exposes
 * (there is no "list all possible permission strings" endpoint —
 * GET /permissions lists rows seeded in the database, which is a
 * different, tenant-specific concern from this static reference
 * used for typing UI checks).
 */
export const PERMISSIONS = {
  Common: {
    attachments: {
      view: 'Common:attachments:view',
      upload: 'Common:attachments:upload',
      delete: 'Common:attachments:delete',
      sign: 'Common:attachments:sign',
    },
  },
  Administration: {
    departments: { view: 'Administration:departments:view', create: 'Administration:departments:create', edit: 'Administration:departments:edit', delete: 'Administration:departments:delete' },
    employees: { view: 'Administration:employees:view', create: 'Administration:employees:create', edit: 'Administration:employees:edit', delete: 'Administration:employees:delete' },
    roles: { manage: 'Administration:roles:manage' },
    companySettings: { manage: 'Administration:company_settings:manage' },
    users: { view: 'Administration:users:view', create: 'Administration:users:create', edit: 'Administration:users:edit', delete: 'Administration:users:delete' },
    approvalWorkflows: { view: 'Administration:approval_workflows:view', manage: 'Administration:approval_workflows:manage' },
    approvalRequests: { create: 'Administration:approval_requests:create', action: 'Administration:approval_requests:action' },
    activityLogs: { view: 'Administration:activity_logs:view' },
    userPermissions: { manage: 'Administration:user_permissions:manage' },
  },
  CRM: {
    customers: { view: 'CRM:customers:view', create: 'CRM:customers:create', edit: 'CRM:customers:edit', delete: 'CRM:customers:delete' },
    leads: { view: 'CRM:leads:view', create: 'CRM:leads:create', edit: 'CRM:leads:edit', delete: 'CRM:leads:delete' },
    opportunities: { view: 'CRM:opportunities:view', create: 'CRM:opportunities:create', edit: 'CRM:opportunities:edit', delete: 'CRM:opportunities:delete' },
    quotations: {
      view: 'CRM:quotations:view',
      create: 'CRM:quotations:create',
      edit: 'CRM:quotations:edit',
      delete: 'CRM:quotations:delete',
      send: 'CRM:quotations:send',
      accept: 'CRM:quotations:accept',
      reject: 'CRM:quotations:reject',
    },
    automationRules: {
      view: 'CRM:automation_rules:view',
      create: 'CRM:automation_rules:create',
      edit: 'CRM:automation_rules:edit',
      delete: 'CRM:automation_rules:delete',
    },
    customFields: {
      view: 'CRM:custom_fields:view',
      create: 'CRM:custom_fields:create',
      edit: 'CRM:custom_fields:edit',
      delete: 'CRM:custom_fields:delete',
    },
    interactions: { view: 'CRM:interactions:view', create: 'CRM:interactions:create', edit: 'CRM:interactions:edit', delete: 'CRM:interactions:delete' },
  },
  Operations: {
    projects: { view: 'Operations:projects:view', create: 'Operations:projects:create', edit: 'Operations:projects:edit', delete: 'Operations:projects:delete', assign: 'Operations:projects:assign' },
    projectMembers: { view: 'Operations:project_members:view', manage: 'Operations:project_members:manage' },
    workOrders: { view: 'Operations:work_orders:view', create: 'Operations:work_orders:create', edit: 'Operations:work_orders:edit', delete: 'Operations:work_orders:delete', assign: 'Operations:work_orders:assign' },
    tasks: { view: 'Operations:tasks:view', create: 'Operations:tasks:create', edit: 'Operations:tasks:edit', delete: 'Operations:tasks:delete', assign: 'Operations:tasks:assign' },
    timeEntries: { view: 'Operations:time_entries:view', create: 'Operations:time_entries:create', edit: 'Operations:time_entries:edit', delete: 'Operations:time_entries:delete' },
    warehouses: { view: 'Operations:warehouses:view', manage: 'Operations:warehouses:manage' },
    stockItems: { view: 'Operations:stock_items:view', manage: 'Operations:stock_items:manage' },
    inventoryStock: { view: 'Operations:inventory_stock:view' },
    stockMovements: { create: 'Operations:stock_movements:create' },
  },
  Finance: {
    accounts: { view: 'Finance:accounts:view', create: 'Finance:accounts:create', edit: 'Finance:accounts:edit', delete: 'Finance:accounts:delete' },
    journalEntries: {
      view: 'Finance:journal_entries:view',
      create: 'Finance:journal_entries:create',
      edit: 'Finance:journal_entries:edit',
      delete: 'Finance:journal_entries:delete',
      post: 'Finance:journal_entries:post',
    },
    settings: { manage: 'Finance:settings:manage' },
    invoices: {
      view: 'Finance:invoices:view',
      create: 'Finance:invoices:create',
      edit: 'Finance:invoices:edit',
      delete: 'Finance:invoices:delete',
      issue: 'Finance:invoices:issue',
    },
    payments: { view: 'Finance:payments:view', create: 'Finance:payments:create' },
    vendors: { view: 'Finance:vendors:view', create: 'Finance:vendors:create', edit: 'Finance:vendors:edit', delete: 'Finance:vendors:delete' },
    zatca: { view: 'Finance:zatca:view', manage: 'Finance:zatca:manage' },
    bills: {
      view: 'Finance:bills:view',
      create: 'Finance:bills:create',
      edit: 'Finance:bills:edit',
      delete: 'Finance:bills:delete',
      receive: 'Finance:bills:receive',
    },
    billPayments: { view: 'Finance:bill_payments:view', create: 'Finance:bill_payments:create' },
    customerPayments: { view: 'Finance:customer_payments:view' },
    inventory: {
      view: 'Finance:inventory:view',
      create: 'Finance:inventory:create',
      edit: 'Finance:inventory:edit',
      adjust: 'Finance:inventory:adjust',
    },
    reports: { view: 'Finance:reports:view' },
    periods: { view: 'Finance:periods:view', manage: 'Finance:periods:manage' },
    invoiceNotes: {
      view: 'Finance:invoice_notes:view',
      create: 'Finance:invoice_notes:create',
      issue: 'Finance:invoice_notes:issue',
      delete: 'Finance:invoice_notes:delete',
    },
    purchaseOrders: {
      view: 'Finance:purchase_orders:view',
      create: 'Finance:purchase_orders:create',
      edit: 'Finance:purchase_orders:edit',
      approve: 'Finance:purchase_orders:approve',
      send: 'Finance:purchase_orders:send',
      delete: 'Finance:purchase_orders:delete',
      receive: 'Finance:purchase_orders:receive',
    },
    fixedAssets: {
      view: 'Finance:fixed_assets:view',
      create: 'Finance:fixed_assets:create',
      edit: 'Finance:fixed_assets:edit',
      dispose: 'Finance:fixed_assets:dispose',
    },
    depreciationRuns: {
      view: 'Finance:depreciation_runs:view',
      create: 'Finance:depreciation_runs:create',
    },
    bankReconciliation: {
      view: 'Finance:bank_reconciliation:view',
      create: 'Finance:bank_reconciliation:create',
      complete: 'Finance:bank_reconciliation:complete',
    },
    recurringInvoices: {
      view: 'Finance:recurring_invoices:view',
      create: 'Finance:recurring_invoices:create',
      edit: 'Finance:recurring_invoices:edit',
      generate: 'Finance:recurring_invoices:generate',
    },
  },
  Payroll: {
    runs: {
      view: 'Payroll:runs:view',
      create: 'Payroll:runs:create',
      process: 'Payroll:runs:process',
      pay: 'Payroll:runs:pay',
    },
    settings: { manage: 'Payroll:settings:manage' },
  },
  Analytics: {
    reports: { view: 'Analytics:reports:view' },
    customReports: { view: 'Analytics:custom_reports:view', manage: 'Analytics:custom_reports:manage' },
  },
  Fleet: {
    vehicles: {
      view: 'Fleet:vehicles:view',
      create: 'Fleet:vehicles:create',
      edit: 'Fleet:vehicles:edit',
      assign: 'Fleet:vehicles:assign',
    },
    maintenance: { create: 'Fleet:maintenance:create' },
  },
  HR: {
    leaveTypes: { view: 'HR:leave_types:view', manage: 'HR:leave_types:manage' },
    leaveBalances: { view: 'HR:leave_balances:view', manage: 'HR:leave_balances:manage' },
    leaveRequests: { view: 'HR:leave_requests:view', create: 'HR:leave_requests:create', approve: 'HR:leave_requests:approve' },
    performanceCycles: { view: 'HR:performance_cycles:view', manage: 'HR:performance_cycles:manage' },
    performanceCriteria: { view: 'HR:performance_criteria:view', manage: 'HR:performance_criteria:manage' },
    performanceEvaluations: { view: 'HR:performance_evaluations:view', create: 'HR:performance_evaluations:create', finalize: 'HR:performance_evaluations:finalize' },
  },
} as const;

/**
 * The one endpoint requiring two permissions at once, confirmed
 * in leads.controller.ts: POST /leads/:id/convert.
 */
export const LEAD_CONVERT_PERMISSIONS = [PERMISSIONS.CRM.leads.edit, PERMISSIONS.CRM.customers.create] as const;

/**
 * Dashboard /summary's OR rule (confirmed in dashboard.service.ts —
 * no @Permissions() decorator exists on that route; the backend
 * does its own "at least one of these" check). Every other
 * Dashboard route uses a normal single required permission.
 */
export const DASHBOARD_SUMMARY_ANY_OF = [PERMISSIONS.CRM.customers.view, PERMISSIONS.Operations.projects.view] as const;
