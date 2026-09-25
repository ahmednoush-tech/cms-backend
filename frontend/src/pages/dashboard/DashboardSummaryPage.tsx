import { useTranslation } from 'react-i18next';
import { useDashboardSummary } from '../../api/queries/useDashboard';
import { useDashboardFilters } from '../../hooks/useDashboardFilters';
import { KpiCard } from '../../components/dashboard/KpiCard';
import { FinancialValue } from '../../components/dashboard/FinancialValue';
import { LoadingState } from '../../components/LoadingState/LoadingState';
import { ErrorState } from '../../components/ErrorState/ErrorState';
import { ApiError } from '../../api/client';

/**
 * Renders ONLY the KPI cards for fields the backend actually
 * returned (instruction 2) — an undefined field on the response
 * means "you're not authorized to see this section," never
 * treated as zero. If the backend returns ONLY CRM fields (e.g. a
 * Sales-only user), only those cards render — no Operations cards
 * appear as zeroed placeholders. Confirmed this session against
 * DashboardService.getSummary()'s actual Object.assign-only-for-
 * authorized-sections behavior.
 */
export function DashboardSummaryPage() {
  const { t } = useTranslation(['dashboard', 'common']);
  const { filters } = useDashboardFilters();
  const { data, isLoading, error } = useDashboardSummary(filters);

  if (isLoading) return <LoadingState variant="card" />;

  if (error) {
    const apiError = error instanceof ApiError ? error : null;
    return <ErrorState variant={apiError?.status === 403 ? 'forbidden' : 'generic'} message={apiError?.message} />;
  }

  if (!data) return null;

  const hasCrmSection = data.totalCustomers !== undefined;
  const hasOperationsSection = data.activeProjects !== undefined;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {hasCrmSection && (
        <>
          <KpiCard label={t('summary.totalCustomers')} value={data.totalCustomers} />
          <KpiCard label={t('summary.newLeads')} value={data.newLeads} />
          <KpiCard label={t('summary.openOpportunities')} value={data.openOpportunities} />
          <KpiCard label={t('summary.pipelineValue')} value={<FinancialValue value={data.pipelineValue!} />} />
        </>
      )}
      {hasOperationsSection && (
        <>
          <KpiCard label={t('summary.activeProjects')} value={data.activeProjects} />
          <KpiCard label={t('summary.completedProjects')} value={data.completedProjects} />
          <KpiCard label={t('summary.openWorkOrders')} value={data.openWorkOrders} />
          <KpiCard label={t('summary.overdueWorkOrders')} value={data.overdueWorkOrders} />
          <KpiCard label={t('summary.pendingTasks')} value={data.pendingTasks} />
          <KpiCard label={t('summary.completedTasks')} value={data.completedTasks} />
          <KpiCard label={t('summary.totalOpenAssignments')} value={data.totalOpenAssignments} />
        </>
      )}
      {!hasCrmSection && !hasOperationsSection && (
        <div className="col-span-full">
          <ErrorState variant="generic" message={t('common:error.generic')} />
        </div>
      )}
    </div>
  );
}
