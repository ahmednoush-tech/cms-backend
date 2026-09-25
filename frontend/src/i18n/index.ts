import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import enCommon from './en/common.json';
import enAuth from './en/auth.json';
import enNav from './en/nav.json';
import enDashboard from './en/dashboard.json';
import enCustomers from './en/customers.json';
import enLeads from './en/leads.json';
import enOpportunities from './en/opportunities.json';
import enQuotations from './en/quotations.json';
import enProjects from './en/projects.json';
import enWorkOrders from './en/workOrders.json';
import enTasks from './en/tasks.json';
import enDepartments from './en/departments.json';
import enEmployees from './en/employees.json';
import enUsers from './en/users.json';
import enRoles from './en/roles.json';
import enActivityLogs from './en/activityLogs.json';
import enNotifications from './en/notifications.json';
import enFinance from './en/finance.json';
import enPayroll from './en/payroll.json';
import enAnalytics from './en/analytics.json';
import enPurchaseOrders from './en/purchaseOrders.json';
import enFixedAssets from './en/fixedAssets.json';
import enAttachments from './en/attachments.json';
import enBankReconciliation from './en/bankReconciliation.json';
import enCompanySettings from './en/companySettings.json';
import enRecurringInvoices from './en/recurringInvoices.json';
import enFleet from './en/fleet.json';
import enEmailIntegration from './en/emailIntegration.json';
import enAutomationRules from './en/automationRules.json';
import enCrmTimeline from './en/crmTimeline.json';
import enCustomFields from './en/customFields.json';
import enHr from './en/hr.json';
import enReports from './en/reports.json';
import enApprovals from './en/approvals.json';
import enWarehouses from './en/warehouses.json';
import enZatca from './en/zatca.json';
import enPortal from './en/portal.json';
import enTimeTracking from './en/timeTracking.json';
import enInteractions from './en/interactions.json';
import arCommon from './ar/common.json';
import arAuth from './ar/auth.json';
import arNav from './ar/nav.json';
import arDashboard from './ar/dashboard.json';
import arCustomers from './ar/customers.json';
import arLeads from './ar/leads.json';
import arOpportunities from './ar/opportunities.json';
import arQuotations from './ar/quotations.json';
import arProjects from './ar/projects.json';
import arWorkOrders from './ar/workOrders.json';
import arTasks from './ar/tasks.json';
import arDepartments from './ar/departments.json';
import arEmployees from './ar/employees.json';
import arUsers from './ar/users.json';
import arRoles from './ar/roles.json';
import arActivityLogs from './ar/activityLogs.json';
import arNotifications from './ar/notifications.json';
import arFinance from './ar/finance.json';
import arPayroll from './ar/payroll.json';
import arAnalytics from './ar/analytics.json';
import arPurchaseOrders from './ar/purchaseOrders.json';
import arFixedAssets from './ar/fixedAssets.json';
import arAttachments from './ar/attachments.json';
import arBankReconciliation from './ar/bankReconciliation.json';
import arCompanySettings from './ar/companySettings.json';
import arRecurringInvoices from './ar/recurringInvoices.json';
import arFleet from './ar/fleet.json';
import arEmailIntegration from './ar/emailIntegration.json';
import arAutomationRules from './ar/automationRules.json';
import arCrmTimeline from './ar/crmTimeline.json';
import arCustomFields from './ar/customFields.json';
import arHr from './ar/hr.json';
import arReports from './ar/reports.json';
import arApprovals from './ar/approvals.json';
import arWarehouses from './ar/warehouses.json';
import arZatca from './ar/zatca.json';
import arPortal from './ar/portal.json';
import arTimeTracking from './ar/timeTracking.json';
import arInteractions from './ar/interactions.json';

export const SUPPORTED_LANGUAGES = ['en', 'ar'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

/**
 * Namespaced by feature (design doc section G) — "common", "auth",
 * "nav", "dashboard" (Phase 3B), "customers"/"leads"/
 * "opportunities"/"quotations" (Phase 3C), "projects"/
 * "workOrders"/"tasks" (Phase 3D), and "departments"/"employees"/
 * "users"/"roles" (Phase 3E) are the namespaces that exist so far
 * — this completes every business module's translation coverage.
 * "validation" content lives inside "common" rather than its own
 * namespace, since it's shared across every form in every module.
 */
i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: {
        common: enCommon,
        auth: enAuth,
        nav: enNav,
        dashboard: enDashboard,
        customers: enCustomers,
        leads: enLeads,
        opportunities: enOpportunities,
        quotations: enQuotations,
        projects: enProjects,
        workOrders: enWorkOrders,
        tasks: enTasks,
        departments: enDepartments,
        employees: enEmployees,
        users: enUsers,
        roles: enRoles,
        activityLogs: enActivityLogs,
        notifications: enNotifications,
        finance: enFinance,
        payroll: enPayroll,
        analytics: enAnalytics,
        purchaseOrders: enPurchaseOrders,
        fixedAssets: enFixedAssets,
        attachments: enAttachments,
        bankReconciliation: enBankReconciliation,
        companySettings: enCompanySettings,
        recurringInvoices: enRecurringInvoices,
        fleet: enFleet,
        emailIntegration: enEmailIntegration,
        automationRules: enAutomationRules,
        crmTimeline: enCrmTimeline,
        customFields: enCustomFields,
        hr: enHr,
        reports: enReports,
        approvals: enApprovals,
        warehouses: enWarehouses,
        zatca: enZatca,
        portal: enPortal,
        timeTracking: enTimeTracking,
        interactions: enInteractions,
      },
      ar: {
        common: arCommon,
        auth: arAuth,
        nav: arNav,
        dashboard: arDashboard,
        customers: arCustomers,
        leads: arLeads,
        opportunities: arOpportunities,
        quotations: arQuotations,
        projects: arProjects,
        workOrders: arWorkOrders,
        tasks: arTasks,
        departments: arDepartments,
        employees: arEmployees,
        users: arUsers,
        roles: arRoles,
        activityLogs: arActivityLogs,
        notifications: arNotifications,
        finance: arFinance,
        payroll: arPayroll,
        analytics: arAnalytics,
        purchaseOrders: arPurchaseOrders,
        fixedAssets: arFixedAssets,
        attachments: arAttachments,
        bankReconciliation: arBankReconciliation,
        companySettings: arCompanySettings,
        recurringInvoices: arRecurringInvoices,
        fleet: arFleet,
        emailIntegration: arEmailIntegration,
        automationRules: arAutomationRules,
        crmTimeline: arCrmTimeline,
        customFields: arCustomFields,
        hr: arHr,
        reports: arReports,
        approvals: arApprovals,
        warehouses: arWarehouses,
        zatca: arZatca,
        portal: arPortal,
        timeTracking: arTimeTracking,
        interactions: arInteractions,
      },
    },
    fallbackLng: 'en',
    supportedLngs: SUPPORTED_LANGUAGES,
    defaultNS: 'common',
    interpolation: { escapeValue: false }, // React already escapes
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'cms.language',
      caches: ['localStorage'],
    },
  });

export function applyDirection(language: string): void {
  const dir = language === 'ar' ? 'rtl' : 'ltr';
  document.documentElement.setAttribute('dir', dir);
  document.documentElement.setAttribute('lang', language);
}

i18n.on('languageChanged', applyDirection);

export default i18n;
