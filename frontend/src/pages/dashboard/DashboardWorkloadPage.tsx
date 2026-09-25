import { useTranslation } from 'react-i18next';
import { useDashboardWorkload } from '../../api/queries/useDashboard';
import { useDashboardFilters } from '../../hooks/useDashboardFilters';
import { WorkloadTable } from '../../components/dashboard/WorkloadTable';
import { LoadingState } from '../../components/LoadingState/LoadingState';
import { ErrorState } from '../../components/ErrorState/ErrorState';
import { ApiError } from '../../api/client';

export function DashboardWorkloadPage() {
  const { t } = useTranslation('common');
  const { filters } = useDashboardFilters();
  const { data, isLoading, error } = useDashboardWorkload(filters);

  if (isLoading) return <LoadingState variant="table" />;

  if (error) {
    const apiError = error instanceof ApiError ? error : null;
    return (
      <ErrorState
        variant={apiError?.status === 403 ? 'forbidden' : 'generic'}
        message={apiError?.message ?? t('error.generic')}
      />
    );
  }

  if (!data) return null;

  return (
    <WorkloadTable
      openTasksByEmployee={data.openTasksByEmployee}
      openWorkOrdersByEmployee={data.openWorkOrdersByEmployee}
      totalOpenAssignmentsByEmployee={data.totalOpenAssignmentsByEmployee}
    />
  );
}
