import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AuthLayout } from '../layouts/AuthLayout';
import { AppLayout } from '../layouts/AppLayout';
import { ProtectedRoute } from '../auth/ProtectedRoute';
import { LoginPage } from '../pages/auth/LoginPage';
import { SignupPage } from '../pages/auth/SignupPage';
import { ForgotPasswordPage } from '../pages/auth/ForgotPasswordPage';
import { ResetPasswordPage } from '../pages/auth/ResetPasswordPage';
import { PortalRoute } from '../auth/PortalRoute';
import { PortalLayout } from '../layouts/PortalLayout';
import { PortalQuotationsPage } from '../pages/portal/PortalQuotationsPage';
import { PortalQuotationDetailPage } from '../pages/portal/PortalQuotationDetailPage';
import { PortalInvoicesPage } from '../pages/portal/PortalInvoicesPage';
import { PortalInvoiceDetailPage } from '../pages/portal/PortalInvoiceDetailPage';
import { PortalProjectsPage } from '../pages/portal/PortalProjectsPage';
import { PortalStatementPage } from '../pages/portal/PortalStatementPage';
import { ForbiddenPage } from '../pages/errors/ForbiddenPage';
import { NotFoundPage } from '../pages/errors/NotFoundPage';
import { UnavailableFeaturePage } from '../pages/placeholder/UnavailableFeaturePage';
import { NotificationsPage } from '../pages/notifications/NotificationsPage';
import { DashboardShell } from '../pages/dashboard/DashboardShell';
import { DashboardSummaryPage } from '../pages/dashboard/DashboardSummaryPage';
import { DashboardSalesPage } from '../pages/dashboard/DashboardSalesPage';
import { DashboardOperationsPage } from '../pages/dashboard/DashboardOperationsPage';
import { DashboardWorkloadPage } from '../pages/dashboard/DashboardWorkloadPage';
import { CustomersListPage } from '../pages/crm/customers/CustomersListPage';
import { CustomerDetailPage } from '../pages/crm/customers/CustomerDetailPage';
import { LeadsListPage } from '../pages/crm/leads/LeadsListPage';
import { LeadDetailPage } from '../pages/crm/leads/LeadDetailPage';
import { OpportunitiesListPage } from '../pages/crm/opportunities/OpportunitiesListPage';
import { OpportunityDetailPage } from '../pages/crm/opportunities/OpportunityDetailPage';
import { QuotationsListPage } from '../pages/crm/quotations/QuotationsListPage';
import { QuotationDetailPage } from '../pages/crm/quotations/QuotationDetailPage';
import { ProjectsListPage } from '../pages/operations/projects/ProjectsListPage';
import { ProjectDetailPage } from '../pages/operations/projects/ProjectDetailPage';
import { ProjectGanttPage } from '../pages/operations/projects/ProjectGanttPage';
import { ProjectProgressPage } from '../pages/operations/projects/ProjectProgressPage';
import { WorkOrdersListPage } from '../pages/operations/work-orders/WorkOrdersListPage';
import { WorkOrderDetailPage } from '../pages/operations/work-orders/WorkOrderDetailPage';
import { TasksListPage } from '../pages/operations/tasks/TasksListPage';
import { TaskDetailPage } from '../pages/operations/tasks/TaskDetailPage';
import { AccountsListPage } from '../pages/finance/accounts/AccountsListPage';
import { JournalEntriesListPage } from '../pages/finance/journal-entries/JournalEntriesListPage';
import { CreateJournalEntryPage } from '../pages/finance/journal-entries/CreateJournalEntryPage';
import { JournalEntryDetailPage } from '../pages/finance/journal-entries/JournalEntryDetailPage';
import { FinanceSettingsPage } from '../pages/finance/settings/FinanceSettingsPage';
import { InvoicesListPage } from '../pages/finance/invoices/InvoicesListPage';
import { CreateInvoicePage } from '../pages/finance/invoices/CreateInvoicePage';
import { InvoiceDetailPage } from '../pages/finance/invoices/InvoiceDetailPage';
import { VendorsListPage } from '../pages/finance/vendors/VendorsListPage';
import { VendorDetailPage } from '../pages/finance/vendors/VendorDetailPage';
import { ZatcaOnboardingPage } from '../pages/finance/zatca/ZatcaOnboardingPage';
import { BillsListPage } from '../pages/finance/bills/BillsListPage';
import { CreateBillPage } from '../pages/finance/bills/CreateBillPage';
import { BillDetailPage } from '../pages/finance/bills/BillDetailPage';
import { PurchaseOrdersListPage } from '../pages/finance/purchase-orders/PurchaseOrdersListPage';
import { CreatePurchaseOrderPage } from '../pages/finance/purchase-orders/CreatePurchaseOrderPage';
import { PurchaseOrderDetailPage } from '../pages/finance/purchase-orders/PurchaseOrderDetailPage';
import { FixedAssetsListPage } from '../pages/finance/fixed-assets/FixedAssetsListPage';
import { CreateFixedAssetPage } from '../pages/finance/fixed-assets/CreateFixedAssetPage';
import { FixedAssetDetailPage } from '../pages/finance/fixed-assets/FixedAssetDetailPage';
import { DepreciationRunsPage } from '../pages/finance/fixed-assets/DepreciationRunsPage';
import { BankReconciliationsListPage } from '../pages/finance/bank-reconciliation/BankReconciliationsListPage';
import { RecurringInvoiceTemplatesListPage } from '../pages/finance/recurring-invoices/RecurringInvoiceTemplatesListPage';
import { VehiclesListPage } from '../pages/fleet/VehiclesListPage';
import { EmailIntegrationPage } from '../pages/crm/email-integration/EmailIntegrationPage';
import { AutomationRulesListPage } from '../pages/crm/automation-rules/AutomationRulesListPage';
import { CustomFieldDefinitionsListPage } from '../pages/crm/custom-fields/CustomFieldDefinitionsListPage';
import { LeaveTypesListPage } from '../pages/hr/leave-types/LeaveTypesListPage';
import { LeaveBalancesPage } from '../pages/hr/leave-balances/LeaveBalancesPage';
import { LeaveRequestsListPage } from '../pages/hr/leave-requests/LeaveRequestsListPage';
import { PerformanceCyclesListPage } from '../pages/hr/performance-cycles/PerformanceCyclesListPage';
import { PerformanceCriteriaListPage } from '../pages/hr/performance-criteria/PerformanceCriteriaListPage';
import { PerformanceEvaluationsListPage } from '../pages/hr/performance-evaluations/PerformanceEvaluationsListPage';
import { PerformanceEvaluationDetailPage } from '../pages/hr/performance-evaluations/PerformanceEvaluationDetailPage';
import { CustomReportsListPage } from '../pages/analytics/custom-reports/CustomReportsListPage';
import { CustomReportBuilderPage } from '../pages/analytics/custom-reports/CustomReportBuilderPage';
import { ApprovalWorkflowsListPage } from '../pages/administration/approval-workflows/ApprovalWorkflowsListPage';
import { MyApprovalsPage } from '../pages/administration/approval-workflows/MyApprovalsPage';
import { ApprovalRequestsListPage } from '../pages/administration/approval-workflows/ApprovalRequestsListPage';
import { ApprovalRequestDetailPage } from '../pages/administration/approval-workflows/ApprovalRequestDetailPage';
import { WarehousesListPage } from '../pages/operations/warehouses/WarehousesListPage';
import { StockItemsListPage } from '../pages/operations/warehouses/StockItemsListPage';
import { StockItemDetailPage } from '../pages/operations/warehouses/StockItemDetailPage';
import { LowStockPage } from '../pages/operations/warehouses/LowStockPage';
import { PlatformAdminLoginPage } from '../pages/platform-admin/PlatformAdminLoginPage';
import { PlatformAdminCompaniesListPage } from '../pages/platform-admin/PlatformAdminCompaniesListPage';
import { PlatformAdminCompanyDetailPage } from '../pages/platform-admin/PlatformAdminCompanyDetailPage';
import { PlatformAdminSettingsPage } from '../pages/platform-admin/PlatformAdminSettingsPage';
import { PlatformAdminProtectedRoute } from '../auth/PlatformAdminProtectedRoute';
import { CreateVehiclePage } from '../pages/fleet/CreateVehiclePage';
import { VehicleDetailPage } from '../pages/fleet/VehicleDetailPage';
import { CreateRecurringInvoiceTemplatePage } from '../pages/finance/recurring-invoices/CreateRecurringInvoiceTemplatePage';
import { RecurringInvoiceTemplateDetailPage } from '../pages/finance/recurring-invoices/RecurringInvoiceTemplateDetailPage';
import { CreateBankReconciliationPage } from '../pages/finance/bank-reconciliation/CreateBankReconciliationPage';
import { BankReconciliationDetailPage } from '../pages/finance/bank-reconciliation/BankReconciliationDetailPage';
import { TrialBalancePage } from '../pages/finance/reports/TrialBalancePage';
import { IncomeStatementPage } from '../pages/finance/reports/IncomeStatementPage';
import { BalanceSheetPage } from '../pages/finance/reports/BalanceSheetPage';
import { PeriodsListPage } from '../pages/finance/periods/PeriodsListPage';
import { CashFlowStatementPage } from '../pages/finance/reports/CashFlowStatementPage';
import { ZakatBaseEstimatePage } from '../pages/finance/reports/ZakatBaseEstimatePage';
import { CustomerPaymentsListPage } from '../pages/finance/customer-payments/CustomerPaymentsListPage';
import { CreateCustomerPaymentPage } from '../pages/finance/customer-payments/CreateCustomerPaymentPage';
import { CustomerAgingReportPage } from '../pages/finance/reports/CustomerAgingReportPage';
import { CustomerStatementPage } from '../pages/finance/reports/CustomerStatementPage';
import { AccountLedgerPage } from '../pages/finance/reports/AccountLedgerPage';
import { InventoryItemsListPage } from '../pages/finance/inventory/InventoryItemsListPage';
import { InventoryMovementsPage } from '../pages/finance/inventory/InventoryMovementsPage';
import { PayrollSettingsPage } from '../pages/payroll/PayrollSettingsPage';
import { AnalyticsDashboardPage } from '../pages/analytics/AnalyticsDashboardPage';
import { SalesForecastPage } from '../pages/analytics/SalesForecastPage';
import { PublicQuotationPage } from '../pages/public/PublicQuotationPage';
import { PayrollRunsListPage } from '../pages/payroll/PayrollRunsListPage';
import { PayrollRunDetailPage } from '../pages/payroll/PayrollRunDetailPage';
import { DepartmentsListPage } from '../pages/administration/departments/DepartmentsListPage';
import { DepartmentDetailPage } from '../pages/administration/departments/DepartmentDetailPage';
import { EmployeesListPage } from '../pages/administration/employees/EmployeesListPage';
import { EmployeeDetailPage } from '../pages/administration/employees/EmployeeDetailPage';
import { ExpiringIqamasPage } from '../pages/administration/employees/ExpiringIqamasPage';
import { UsersListPage } from '../pages/administration/users/UsersListPage';
import { UserDetailPage } from '../pages/administration/users/UserDetailPage';
import { RolesListPage } from '../pages/administration/roles/RolesListPage';
import { ActivityLogsListPage } from '../pages/administration/activity-logs/ActivityLogsListPage';
import { RoleDetailPage } from '../pages/administration/roles/RoleDetailPage';
import { CompanySettingsPage } from '../pages/administration/company-settings/CompanySettingsPage';
import { PERMISSIONS, DASHBOARD_SUMMARY_ANY_OF } from '../rbac/permissionConstants';

/**
 * Every permission requirement below is copied directly from
 * routeMap.ts (which is itself transcribed from the backend
 * controllers) — this file is purely the React Router wiring, not
 * a second source of truth for what's protected.
 *
 * Phase 3B: /dashboard is now a real nested route — DashboardShell
 * renders the shared filter bar + tabs once, with the four section
 * pages as children via <Outlet/>. Each child route carries its
 * OWN permission requirement matching its backend endpoint's guard
 * exactly (confirmed against dashboard.controller.ts this session)
 * — /dashboard itself uses the OR rule, the three sub-routes use
 * single required permissions, same as the backend's @Permissions().
 *
 * Phase 3E (this update): Administration — Departments, Employees,
 * Users, Roles — is now real, completing all four business
 * modules. `pages/placeholder/ComingSoonPage.tsx` is no longer
 * referenced by any route (kept in the codebase harmlessly, not
 * deleted, since removing a component file isn't required by any
 * phase's constraints and there was no ambiguity about whether it
 * should be — it simply has zero remaining call sites). No
 * business logic exists for a legacy Activity-Log *data* view at
 * /activity-log — it still renders UnavailableFeaturePage (the real
 * audit log lives at /admin/activity-logs). /notifications is now a
 * real page, backed by the notifications module.
 */
export const router = createBrowserRouter([
  {
    path: '/login',
    element: (
      <AuthLayout>
        <LoginPage />
      </AuthLayout>
    ),
  },
  {
    path: '/signup',
    element: (
      <AuthLayout>
        <SignupPage />
      </AuthLayout>
    ),
  },
  {
    path: '/quote/:token',
    element: <PublicQuotationPage />,
  },
  {
    path: '/forgot-password',
    element: (
      <AuthLayout>
        <ForgotPasswordPage />
      </AuthLayout>
    ),
  },
  {
    path: '/reset-password',
    element: (
      <AuthLayout>
        <ResetPasswordPage />
      </AuthLayout>
    ),
  },
  {
    path: '/portal-unavailable',
    element: <Navigate to="/portal/invoices" replace />,
  },
  {
    path: '/portal/quotations',
    element: (
      <PortalRoute>
        <PortalLayout>
          <PortalQuotationsPage />
        </PortalLayout>
      </PortalRoute>
    ),
  },
  {
    path: '/portal/quotations/:id',
    element: (
      <PortalRoute>
        <PortalLayout>
          <PortalQuotationDetailPage />
        </PortalLayout>
      </PortalRoute>
    ),
  },
  {
    path: '/portal/invoices',
    element: (
      <PortalRoute>
        <PortalLayout>
          <PortalInvoicesPage />
        </PortalLayout>
      </PortalRoute>
    ),
  },
  {
    path: '/portal/invoices/:id',
    element: (
      <PortalRoute>
        <PortalLayout>
          <PortalInvoiceDetailPage />
        </PortalLayout>
      </PortalRoute>
    ),
  },
  {
    path: '/portal/projects',
    element: (
      <PortalRoute>
        <PortalLayout>
          <PortalProjectsPage />
        </PortalLayout>
      </PortalRoute>
    ),
  },
  {
    path: '/portal/statement',
    element: (
      <PortalRoute>
        <PortalLayout>
          <PortalStatementPage />
        </PortalLayout>
      </PortalRoute>
    ),
  },
  {
    path: '/403',
    element: (
      <AppLayout>
        <ForbiddenPage />
      </AppLayout>
    ),
  },
  {
    path: '/dashboard',
    element: (
      <ProtectedRoute requiredPermissions={DASHBOARD_SUMMARY_ANY_OF} matchAny>
        <AppLayout>
          <DashboardShell />
        </AppLayout>
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <DashboardSummaryPage /> },
      {
        path: 'sales',
        element: (
          <ProtectedRoute requiredPermissions={[PERMISSIONS.CRM.customers.view]}>
            <DashboardSalesPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'operations',
        element: (
          <ProtectedRoute requiredPermissions={[PERMISSIONS.Operations.projects.view]}>
            <DashboardOperationsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'workload',
        element: (
          <ProtectedRoute requiredPermissions={[PERMISSIONS.Operations.projects.view]}>
            <DashboardWorkloadPage />
          </ProtectedRoute>
        ),
      },
    ],
  },
  {
    path: '/analytics',
    element: (
      <ProtectedRoute requiredPermissions={[PERMISSIONS.Analytics.reports.view]}>
        <AppLayout>
          <AnalyticsDashboardPage />
        </AppLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: '/analytics/sales-forecast',
    element: (
      <ProtectedRoute requiredPermissions={[PERMISSIONS.Analytics.reports.view]}>
        <AppLayout>
          <SalesForecastPage />
        </AppLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: '/crm/customers',
    element: (
      <ProtectedRoute requiredPermissions={[PERMISSIONS.CRM.customers.view]}>
        <AppLayout>
          <CustomersListPage />
        </AppLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: '/crm/customers/:id',
    element: (
      <ProtectedRoute requiredPermissions={[PERMISSIONS.CRM.customers.view]}>
        <AppLayout>
          <CustomerDetailPage />
        </AppLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: '/crm/leads',
    element: (
      <ProtectedRoute requiredPermissions={[PERMISSIONS.CRM.leads.view]}>
        <AppLayout>
          <LeadsListPage />
        </AppLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: '/crm/leads/:id',
    element: (
      <ProtectedRoute requiredPermissions={[PERMISSIONS.CRM.leads.view]}>
        <AppLayout>
          <LeadDetailPage />
        </AppLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: '/crm/opportunities',
    element: (
      <ProtectedRoute requiredPermissions={[PERMISSIONS.CRM.opportunities.view]}>
        <AppLayout>
          <OpportunitiesListPage />
        </AppLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: '/crm/opportunities/:id',
    element: (
      <ProtectedRoute requiredPermissions={[PERMISSIONS.CRM.opportunities.view]}>
        <AppLayout>
          <OpportunityDetailPage />
        </AppLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: '/crm/quotations',
    element: (
      <ProtectedRoute requiredPermissions={[PERMISSIONS.CRM.quotations.view]}>
        <AppLayout>
          <QuotationsListPage />
        </AppLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: '/crm/quotations/:id',
    element: (
      <ProtectedRoute requiredPermissions={[PERMISSIONS.CRM.quotations.view]}>
        <AppLayout>
          <QuotationDetailPage />
        </AppLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: '/ops/projects',
    element: (
      <ProtectedRoute requiredPermissions={[PERMISSIONS.Operations.projects.view]}>
        <AppLayout>
          <ProjectsListPage />
        </AppLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: '/ops/projects/:id',
    element: (
      <ProtectedRoute requiredPermissions={[PERMISSIONS.Operations.projects.view]}>
        <AppLayout>
          <ProjectDetailPage />
        </AppLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: '/ops/projects/:id/gantt',
    element: (
      <ProtectedRoute requiredPermissions={[PERMISSIONS.Operations.projects.view]}>
        <AppLayout>
          <ProjectGanttPage />
        </AppLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: '/ops/projects/:id/progress',
    element: (
      <ProtectedRoute requiredPermissions={[PERMISSIONS.Operations.projects.view]}>
        <AppLayout>
          <ProjectProgressPage />
        </AppLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: '/ops/work-orders',
    element: (
      <ProtectedRoute requiredPermissions={[PERMISSIONS.Operations.workOrders.view]}>
        <AppLayout>
          <WorkOrdersListPage />
        </AppLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: '/ops/work-orders/:id',
    element: (
      <ProtectedRoute requiredPermissions={[PERMISSIONS.Operations.workOrders.view]}>
        <AppLayout>
          <WorkOrderDetailPage />
        </AppLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: '/ops/tasks',
    element: (
      <ProtectedRoute requiredPermissions={[PERMISSIONS.Operations.tasks.view]}>
        <AppLayout>
          <TasksListPage />
        </AppLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: '/ops/tasks/:id',
    element: (
      <ProtectedRoute requiredPermissions={[PERMISSIONS.Operations.tasks.view]}>
        <AppLayout>
          <TaskDetailPage />
        </AppLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: '/finance/accounts',
    element: (
      <ProtectedRoute requiredPermissions={[PERMISSIONS.Finance.accounts.view]}>
        <AppLayout>
          <AccountsListPage />
        </AppLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: '/finance/journal-entries',
    element: (
      <ProtectedRoute requiredPermissions={[PERMISSIONS.Finance.journalEntries.view]}>
        <AppLayout>
          <JournalEntriesListPage />
        </AppLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: '/finance/journal-entries/new',
    element: (
      <ProtectedRoute requiredPermissions={[PERMISSIONS.Finance.journalEntries.create]}>
        <AppLayout>
          <CreateJournalEntryPage />
        </AppLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: '/finance/journal-entries/:id',
    element: (
      <ProtectedRoute requiredPermissions={[PERMISSIONS.Finance.journalEntries.view]}>
        <AppLayout>
          <JournalEntryDetailPage />
        </AppLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: '/finance/settings',
    element: (
      <ProtectedRoute requiredPermissions={[PERMISSIONS.Finance.settings.manage]}>
        <AppLayout>
          <FinanceSettingsPage />
        </AppLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: '/finance/invoices',
    element: (
      <ProtectedRoute requiredPermissions={[PERMISSIONS.Finance.invoices.view]}>
        <AppLayout>
          <InvoicesListPage />
        </AppLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: '/finance/invoices/new',
    element: (
      <ProtectedRoute requiredPermissions={[PERMISSIONS.Finance.invoices.create]}>
        <AppLayout>
          <CreateInvoicePage />
        </AppLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: '/finance/invoices/:id',
    element: (
      <ProtectedRoute requiredPermissions={[PERMISSIONS.Finance.invoices.view]}>
        <AppLayout>
          <InvoiceDetailPage />
        </AppLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: '/finance/zatca',
    element: (
      <ProtectedRoute requiredPermissions={[PERMISSIONS.Finance.zatca.view]}>
        <AppLayout>
          <ZatcaOnboardingPage />
        </AppLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: '/finance/vendors',
    element: (
      <ProtectedRoute requiredPermissions={[PERMISSIONS.Finance.vendors.view]}>
        <AppLayout>
          <VendorsListPage />
        </AppLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: '/finance/vendors/:id',
    element: (
      <ProtectedRoute requiredPermissions={[PERMISSIONS.Finance.vendors.view]}>
        <AppLayout>
          <VendorDetailPage />
        </AppLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: '/finance/bills',
    element: (
      <ProtectedRoute requiredPermissions={[PERMISSIONS.Finance.bills.view]}>
        <AppLayout>
          <BillsListPage />
        </AppLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: '/finance/bills/new',
    element: (
      <ProtectedRoute requiredPermissions={[PERMISSIONS.Finance.bills.create]}>
        <AppLayout>
          <CreateBillPage />
        </AppLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: '/finance/bills/:id',
    element: (
      <ProtectedRoute requiredPermissions={[PERMISSIONS.Finance.bills.view]}>
        <AppLayout>
          <BillDetailPage />
        </AppLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: '/finance/purchase-orders',
    element: (
      <ProtectedRoute requiredPermissions={[PERMISSIONS.Finance.purchaseOrders.view]}>
        <AppLayout>
          <PurchaseOrdersListPage />
        </AppLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: '/finance/purchase-orders/new',
    element: (
      <ProtectedRoute requiredPermissions={[PERMISSIONS.Finance.purchaseOrders.create]}>
        <AppLayout>
          <CreatePurchaseOrderPage />
        </AppLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: '/finance/purchase-orders/:id',
    element: (
      <ProtectedRoute requiredPermissions={[PERMISSIONS.Finance.purchaseOrders.view]}>
        <AppLayout>
          <PurchaseOrderDetailPage />
        </AppLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: '/finance/fixed-assets',
    element: (
      <ProtectedRoute requiredPermissions={[PERMISSIONS.Finance.fixedAssets.view]}>
        <AppLayout>
          <FixedAssetsListPage />
        </AppLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: '/finance/fixed-assets/new',
    element: (
      <ProtectedRoute requiredPermissions={[PERMISSIONS.Finance.fixedAssets.create]}>
        <AppLayout>
          <CreateFixedAssetPage />
        </AppLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: '/finance/fixed-assets/:id',
    element: (
      <ProtectedRoute requiredPermissions={[PERMISSIONS.Finance.fixedAssets.view]}>
        <AppLayout>
          <FixedAssetDetailPage />
        </AppLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: '/finance/depreciation-runs',
    element: (
      <ProtectedRoute requiredPermissions={[PERMISSIONS.Finance.depreciationRuns.view]}>
        <AppLayout>
          <DepreciationRunsPage />
        </AppLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: '/finance/bank-reconciliation',
    element: (
      <ProtectedRoute requiredPermissions={[PERMISSIONS.Finance.bankReconciliation.view]}>
        <AppLayout>
          <BankReconciliationsListPage />
        </AppLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: '/finance/recurring-invoices',
    element: (
      <ProtectedRoute requiredPermissions={[PERMISSIONS.Finance.recurringInvoices.view]}>
        <AppLayout>
          <RecurringInvoiceTemplatesListPage />
        </AppLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: '/finance/recurring-invoices/new',
    element: (
      <ProtectedRoute requiredPermissions={[PERMISSIONS.Finance.recurringInvoices.create]}>
        <AppLayout>
          <CreateRecurringInvoiceTemplatePage />
        </AppLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: '/finance/recurring-invoices/:id',
    element: (
      <ProtectedRoute requiredPermissions={[PERMISSIONS.Finance.recurringInvoices.view]}>
        <AppLayout>
          <RecurringInvoiceTemplateDetailPage />
        </AppLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: '/fleet/vehicles',
    element: (
      <ProtectedRoute requiredPermissions={[PERMISSIONS.Fleet.vehicles.view]}>
        <AppLayout>
          <VehiclesListPage />
        </AppLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: '/fleet/vehicles/new',
    element: (
      <ProtectedRoute requiredPermissions={[PERMISSIONS.Fleet.vehicles.create]}>
        <AppLayout>
          <CreateVehiclePage />
        </AppLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: '/fleet/vehicles/:id',
    element: (
      <ProtectedRoute requiredPermissions={[PERMISSIONS.Fleet.vehicles.view]}>
        <AppLayout>
          <VehicleDetailPage />
        </AppLayout>
      </ProtectedRoute>
    ),
  },
  {
    // No requiredPermissions — every authenticated user manages
    // their own personal Outlook connection, the same way anyone
    // can edit their own profile without a special grant.
    path: '/crm/email-integration',
    element: (
      <ProtectedRoute>
        <AppLayout>
          <EmailIntegrationPage />
        </AppLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: '/crm/automation-rules',
    element: (
      <ProtectedRoute requiredPermissions={[PERMISSIONS.CRM.automationRules.view]}>
        <AppLayout>
          <AutomationRulesListPage />
        </AppLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: '/crm/custom-fields',
    element: (
      <ProtectedRoute requiredPermissions={[PERMISSIONS.CRM.customFields.view]}>
        <AppLayout>
          <CustomFieldDefinitionsListPage />
        </AppLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: '/hr/leave-types',
    element: (
      <ProtectedRoute requiredPermissions={[PERMISSIONS.HR.leaveTypes.view]}>
        <AppLayout>
          <LeaveTypesListPage />
        </AppLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: '/hr/leave-balances',
    element: (
      <ProtectedRoute requiredPermissions={[PERMISSIONS.HR.leaveBalances.view]}>
        <AppLayout>
          <LeaveBalancesPage />
        </AppLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: '/hr/leave-requests',
    element: (
      <ProtectedRoute requiredPermissions={[PERMISSIONS.HR.leaveRequests.view]}>
        <AppLayout>
          <LeaveRequestsListPage />
        </AppLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: '/hr/performance-cycles',
    element: (
      <ProtectedRoute requiredPermissions={[PERMISSIONS.HR.performanceCycles.view]}>
        <AppLayout>
          <PerformanceCyclesListPage />
        </AppLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: '/hr/performance-criteria',
    element: (
      <ProtectedRoute requiredPermissions={[PERMISSIONS.HR.performanceCriteria.view]}>
        <AppLayout>
          <PerformanceCriteriaListPage />
        </AppLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: '/hr/performance-evaluations',
    element: (
      <ProtectedRoute requiredPermissions={[PERMISSIONS.HR.performanceEvaluations.view]}>
        <AppLayout>
          <PerformanceEvaluationsListPage />
        </AppLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: '/hr/performance-evaluations/:id',
    element: (
      <ProtectedRoute requiredPermissions={[PERMISSIONS.HR.performanceEvaluations.view]}>
        <AppLayout>
          <PerformanceEvaluationDetailPage />
        </AppLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: '/analytics/custom-reports',
    element: (
      <ProtectedRoute requiredPermissions={[PERMISSIONS.Analytics.customReports.view]}>
        <AppLayout>
          <CustomReportsListPage />
        </AppLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: '/analytics/custom-reports/:id',
    element: (
      <ProtectedRoute requiredPermissions={[PERMISSIONS.Analytics.customReports.view]}>
        <AppLayout>
          <CustomReportBuilderPage />
        </AppLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: '/administration/approval-workflows',
    element: (
      <ProtectedRoute requiredPermissions={[PERMISSIONS.Administration.approvalWorkflows.view]}>
        <AppLayout>
          <ApprovalWorkflowsListPage />
        </AppLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: '/administration/my-approvals',
    element: (
      <ProtectedRoute requiredPermissions={[PERMISSIONS.Administration.approvalRequests.action]}>
        <AppLayout>
          <MyApprovalsPage />
        </AppLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: '/administration/approval-requests',
    element: (
      <ProtectedRoute requiredPermissions={[PERMISSIONS.Administration.approvalRequests.create]}>
        <AppLayout>
          <ApprovalRequestsListPage />
        </AppLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: '/administration/approval-requests/:id',
    element: (
      <ProtectedRoute requiredPermissions={[PERMISSIONS.Administration.approvalRequests.create]}>
        <AppLayout>
          <ApprovalRequestDetailPage />
        </AppLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: '/ops/warehouses',
    element: (
      <ProtectedRoute requiredPermissions={[PERMISSIONS.Operations.warehouses.view]}>
        <AppLayout>
          <WarehousesListPage />
        </AppLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: '/ops/stock-items',
    element: (
      <ProtectedRoute requiredPermissions={[PERMISSIONS.Operations.stockItems.view]}>
        <AppLayout>
          <StockItemsListPage />
        </AppLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: '/ops/stock-items/:id',
    element: (
      <ProtectedRoute requiredPermissions={[PERMISSIONS.Operations.stockItems.view]}>
        <AppLayout>
          <StockItemDetailPage />
        </AppLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: '/ops/low-stock',
    element: (
      <ProtectedRoute requiredPermissions={[PERMISSIONS.Operations.inventoryStock.view]}>
        <AppLayout>
          <LowStockPage />
        </AppLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: '/finance/bank-reconciliation/new',
    element: (
      <ProtectedRoute requiredPermissions={[PERMISSIONS.Finance.bankReconciliation.create]}>
        <AppLayout>
          <CreateBankReconciliationPage />
        </AppLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: '/finance/bank-reconciliation/:id',
    element: (
      <ProtectedRoute requiredPermissions={[PERMISSIONS.Finance.bankReconciliation.view]}>
        <AppLayout>
          <BankReconciliationDetailPage />
        </AppLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: '/finance/reports/trial-balance',
    element: (
      <ProtectedRoute requiredPermissions={[PERMISSIONS.Finance.reports.view]}>
        <AppLayout>
          <TrialBalancePage />
        </AppLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: '/finance/reports/income-statement',
    element: (
      <ProtectedRoute requiredPermissions={[PERMISSIONS.Finance.reports.view]}>
        <AppLayout>
          <IncomeStatementPage />
        </AppLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: '/finance/reports/balance-sheet',
    element: (
      <ProtectedRoute requiredPermissions={[PERMISSIONS.Finance.reports.view]}>
        <AppLayout>
          <BalanceSheetPage />
        </AppLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: '/finance/periods',
    element: (
      <ProtectedRoute requiredPermissions={[PERMISSIONS.Finance.periods.view]}>
        <AppLayout>
          <PeriodsListPage />
        </AppLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: '/finance/reports/cash-flow',
    element: (
      <ProtectedRoute requiredPermissions={[PERMISSIONS.Finance.reports.view]}>
        <AppLayout>
          <CashFlowStatementPage />
        </AppLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: '/finance/reports/zakat-estimate',
    element: (
      <ProtectedRoute requiredPermissions={[PERMISSIONS.Finance.reports.view]}>
        <AppLayout>
          <ZakatBaseEstimatePage />
        </AppLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: '/finance/customer-payments',
    element: (
      <ProtectedRoute requiredPermissions={[PERMISSIONS.Finance.customerPayments.view]}>
        <AppLayout>
          <CustomerPaymentsListPage />
        </AppLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: '/finance/customer-payments/new',
    element: (
      <ProtectedRoute requiredPermissions={[PERMISSIONS.Finance.payments.create]}>
        <AppLayout>
          <CreateCustomerPaymentPage />
        </AppLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: '/finance/reports/customer-aging',
    element: (
      <ProtectedRoute requiredPermissions={[PERMISSIONS.Finance.reports.view]}>
        <AppLayout>
          <CustomerAgingReportPage />
        </AppLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: '/finance/customer-statement',
    element: (
      <ProtectedRoute requiredPermissions={[PERMISSIONS.Finance.reports.view]}>
        <AppLayout>
          <CustomerStatementPage />
        </AppLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: '/finance/reports/account-ledger',
    element: (
      <ProtectedRoute requiredPermissions={[PERMISSIONS.Finance.reports.view]}>
        <AppLayout>
          <AccountLedgerPage />
        </AppLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: '/finance/inventory',
    element: (
      <ProtectedRoute requiredPermissions={[PERMISSIONS.Finance.inventory.view]}>
        <AppLayout>
          <InventoryItemsListPage />
        </AppLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: '/finance/inventory/:id/movements',
    element: (
      <ProtectedRoute requiredPermissions={[PERMISSIONS.Finance.inventory.view]}>
        <AppLayout>
          <InventoryMovementsPage />
        </AppLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: '/payroll/settings',
    element: (
      <ProtectedRoute requiredPermissions={[PERMISSIONS.Payroll.settings.manage]}>
        <AppLayout>
          <PayrollSettingsPage />
        </AppLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: '/payroll/runs',
    element: (
      <ProtectedRoute requiredPermissions={[PERMISSIONS.Payroll.runs.view]}>
        <AppLayout>
          <PayrollRunsListPage />
        </AppLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: '/payroll/runs/:id',
    element: (
      <ProtectedRoute requiredPermissions={[PERMISSIONS.Payroll.runs.view]}>
        <AppLayout>
          <PayrollRunDetailPage />
        </AppLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: '/admin/departments',
    element: (
      <ProtectedRoute requiredPermissions={[PERMISSIONS.Administration.departments.view]}>
        <AppLayout>
          <DepartmentsListPage />
        </AppLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: '/admin/departments/:id',
    element: (
      <ProtectedRoute requiredPermissions={[PERMISSIONS.Administration.departments.view]}>
        <AppLayout>
          <DepartmentDetailPage />
        </AppLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: '/admin/employees',
    element: (
      <ProtectedRoute requiredPermissions={[PERMISSIONS.Administration.employees.view]}>
        <AppLayout>
          <EmployeesListPage />
        </AppLayout>
      </ProtectedRoute>
    ),
  },
  {
    // Static route, deliberately placed BEFORE the `:id` route below.
    path: '/admin/employees/expiring-iqamas',
    element: (
      <ProtectedRoute requiredPermissions={[PERMISSIONS.Administration.employees.view]}>
        <AppLayout>
          <ExpiringIqamasPage />
        </AppLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: '/admin/employees/:id',
    element: (
      <ProtectedRoute requiredPermissions={[PERMISSIONS.Administration.employees.view]}>
        <AppLayout>
          <EmployeeDetailPage />
        </AppLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: '/admin/users',
    element: (
      <ProtectedRoute requiredPermissions={[PERMISSIONS.Administration.users.view]}>
        <AppLayout>
          <UsersListPage />
        </AppLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: '/admin/users/:id',
    element: (
      <ProtectedRoute requiredPermissions={[PERMISSIONS.Administration.users.view]}>
        <AppLayout>
          <UserDetailPage />
        </AppLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: '/admin/roles',
    element: (
      <ProtectedRoute requiredPermissions={[PERMISSIONS.Administration.roles.manage]}>
        <AppLayout>
          <RolesListPage />
        </AppLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: '/admin/activity-logs',
    element: (
      <ProtectedRoute requiredPermissions={[PERMISSIONS.Administration.activityLogs.view]}>
        <AppLayout>
          <ActivityLogsListPage />
        </AppLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: '/admin/roles/:id',
    element: (
      <ProtectedRoute requiredPermissions={[PERMISSIONS.Administration.roles.manage]}>
        <AppLayout>
          <RoleDetailPage />
        </AppLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: '/admin/company-settings',
    element: (
      <ProtectedRoute requiredPermissions={[PERMISSIONS.Administration.companySettings.manage]}>
        <AppLayout>
          <CompanySettingsPage />
        </AppLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: '/notifications',
    element: (
      <ProtectedRoute>
        <AppLayout>
          <NotificationsPage />
        </AppLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: '/activity-log',
    element: (
      <ProtectedRoute>
        <AppLayout>
          <UnavailableFeaturePage titleKey="nav:activityLog" messageKey="common:unavailable.activityLog" />
        </AppLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: '/',
    element: <Navigate to="/dashboard" replace />,
  },
  {
    // Deliberately standalone — no <AppLayout> (that's the tenant
    // app's sidebar/topbar) and no tenant <ProtectedRoute>. This
    // whole branch is Mizan's own internal ops tool, isolated end
    // to end from the tenant application shell.
    path: '/platform-admin/login',
    element: <PlatformAdminLoginPage />,
  },
  {
    path: '/platform-admin/companies',
    element: (
      <PlatformAdminProtectedRoute>
        <PlatformAdminCompaniesListPage />
      </PlatformAdminProtectedRoute>
    ),
  },
  {
    path: '/platform-admin/companies/:id',
    element: (
      <PlatformAdminProtectedRoute>
        <PlatformAdminCompanyDetailPage />
      </PlatformAdminProtectedRoute>
    ),
  },
  {
    path: '/platform-admin/settings',
    element: (
      <PlatformAdminProtectedRoute>
        <PlatformAdminSettingsPage />
      </PlatformAdminProtectedRoute>
    ),
  },
  {
    path: '*',
    element: (
      <AppLayout>
        <NotFoundPage />
      </AppLayout>
    ),
  },
]);
