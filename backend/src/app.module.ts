import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_GUARD, APP_INTERCEPTOR, APP_FILTER } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { RolesModule } from './modules/roles/roles.module';
import { ActivityLogsModule } from './modules/activity-logs/activity-logs.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { DepartmentsModule } from './modules/departments/departments.module';
import { FinanceModule } from './modules/finance/finance.module';
import { EmployeesModule } from './modules/employees/employees.module';
import { CustomersModule } from './modules/customers/customers.module';
import { CustomerContactsModule } from './modules/customer-contacts/customer-contacts.module';
import { CustomerUsersModule } from './modules/customer-users/customer-users.module';
import { LeadsModule } from './modules/leads/leads.module';
import { OpportunitiesModule } from './modules/opportunities/opportunities.module';
import { QuotationsModule } from './modules/quotations/quotations.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { WorkOrdersModule } from './modules/work-orders/work-orders.module';
import { TasksModule } from './modules/tasks/tasks.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { PayrollModule } from './modules/payroll/payroll.module';
import { PortalModule } from './modules/portal/portal.module';
import { TimeEntriesModule } from './modules/time-entries/time-entries.module';
import { InteractionsModule } from './modules/interactions/interactions.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { FixedAssetsModule } from './modules/fixed-assets/fixed-assets.module';
import { AttachmentsModule } from './modules/attachments/attachments.module';
import { CompanySettingsModule } from './modules/company-settings/company-settings.module';
import { HealthModule } from './modules/health/health.module';
import { SignupModule } from './modules/signup/signup.module';
import { FleetModule } from './modules/fleet/fleet.module';
import { EmailIntegrationModule } from './modules/email-integration/email-integration.module';
import { SchedulerModule } from './modules/scheduler/scheduler.module';
import { AutomationRulesModule } from './modules/automation-rules/automation-rules.module';
import { CrmTimelineModule } from './modules/crm-timeline/crm-timeline.module';
import { CustomFieldsModule } from './modules/custom-fields/custom-fields.module';
import { PlatformAdminModule } from './modules/platform-admin/platform-admin.module';
import { LeaveManagementModule } from './modules/leave-management/leave-management.module';
import { PerformanceEvaluationModule } from './modules/performance-evaluation/performance-evaluation.module';
import { ReportsModule } from './modules/reports/reports.module';
import { ApprovalWorkflowsModule } from './modules/approval-workflows/approval-workflows.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { ZatcaPhase2Module } from './modules/zatca-phase2/zatca-phase2.module';
import { RequestLoggerMiddleware } from './common/middleware/request-logger.middleware';
import { TenantTransactionMiddleware } from './common/middleware/tenant-transaction.middleware';
import { CommonServicesModule } from './common/services/common-services.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

// NOTE — Phase 2E scope (this update): Dashboard — read-only,
// no tables of its own, live-queries CRM/Operations data. CRM,
// Operations, and Administration were NOT modified. System module
// (comments/attachments/activity-log/notification read endpoints)
// is still not wired in.

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
    PrismaModule,
    CommonServicesModule,
    AuthModule,
    UsersModule,
    RolesModule,
    ActivityLogsModule,
    NotificationsModule,
    DepartmentsModule,
    FinanceModule,
    EmployeesModule,
    CustomersModule,
    CustomerContactsModule,
    CustomerUsersModule,
    LeadsModule,
    OpportunitiesModule,
    QuotationsModule,
    ProjectsModule,
    WorkOrdersModule,
    TasksModule,
    DashboardModule,
    PayrollModule,
    PortalModule,
    TimeEntriesModule,
    InteractionsModule,
    AnalyticsModule,
    FixedAssetsModule,
    AttachmentsModule,
    CompanySettingsModule,
    HealthModule,
    SignupModule,
    FleetModule,
    EmailIntegrationModule,
    SchedulerModule,
    AutomationRulesModule,
    CrmTimelineModule,
    CustomFieldsModule,
    PlatformAdminModule,
    LeaveManagementModule,
    PerformanceEvaluationModule,
    ReportsModule,
    ApprovalWorkflowsModule,
    InventoryModule,
    ZatcaPhase2Module,
  ],
  providers: [
    // Global guards run in array order: throttle -> jwt auth.
    // Route-level guards (PermissionsGuard, InternalOnlyGuard)
    // are applied per-controller via @UseGuards.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_INTERCEPTOR, useClass: ResponseInterceptor },
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // TenantTransactionMiddleware MUST be first — it opens the
    // per-request transaction that everything downstream
    // (including RequestLoggerMiddleware, every guard, every
    // service) runs inside. See that file's own comment for the
    // full rationale.
    //
    // The ONE exclusion: the real-time notification stream. It's a
    // request that deliberately never finishes, so running it inside
    // the per-request transaction would pin a pooled DB connection
    // for as long as a browser tab stays open (and the transaction's
    // 15s timeout would break it anyway). It needs neither: it makes
    // no queries, and authenticates by ticket signature alone — see
    // NotificationsStreamController. It's also kept out of the slow-
    // request logger, which would otherwise report every stream as a
    // 30-minute "slow request".
    consumer
      .apply(TenantTransactionMiddleware, RequestLoggerMiddleware)
      .exclude({ path: 'api/v1/notifications/stream', method: RequestMethod.GET })
      .forRoutes('*');
  }
}
