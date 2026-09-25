import { useTranslation } from 'react-i18next';
import { useDashboardOperations } from '../../api/queries/useDashboard';
import { useDashboardFilters } from '../../hooks/useDashboardFilters';
import { KpiCard } from '../../components/dashboard/KpiCard';
import { StatusBreakdownBars } from '../../components/dashboard/StatusBreakdownBars';
import { LoadingState } from '../../components/LoadingState/LoadingState';
import { ErrorState } from '../../components/ErrorState/ErrorState';
import { ApiError } from '../../api/client';

export function DashboardOperationsPage() {
  const { t } = useTranslation(['dashboard', 'common']);
  const { filters } = useDashboardFilters();
  const { data, isLoading, error } = useDashboardOperations(filters);

  if (isLoading) return <LoadingState variant="card" />;

  if (error) {
    const apiError = error instanceof ApiError ? error : null;
    return <ErrorState variant={apiError?.status === 403 ? 'forbidden' : 'generic'} message={apiError?.message} />;
  }

  if (!data) return null;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label={t('operations.overdueWorkOrders')} value={data.overdueWorkOrders} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <StatusBreakdownBars data={data.projectsByStatus} entity="project" title={t('operations.projectsByStatus')} />
        <StatusBreakdownBars data={data.workOrdersByStatus} entity="workOrder" title={t('operations.workOrdersByStatus')} />
        <StatusBreakdownBars data={data.workOrdersByPriority} entity="priority" title={t('operations.workOrdersByPriority')} />
        <StatusBreakdownBars data={data.tasksByStatus} entity="task" title={t('operations.tasksByStatus')} />
        <StatusBreakdownBars data={data.tasksByPriority} entity="priority" title={t('operations.tasksByPriority')} />
      </div>
    </div>
  );
}
