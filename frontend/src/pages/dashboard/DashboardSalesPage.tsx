import { useTranslation } from 'react-i18next';
import { useDashboardSales } from '../../api/queries/useDashboard';
import { useDashboardFilters } from '../../hooks/useDashboardFilters';
import { KpiCard } from '../../components/dashboard/KpiCard';
import { FinancialValue } from '../../components/dashboard/FinancialValue';
import { StatusBreakdownBars } from '../../components/dashboard/StatusBreakdownBars';
import { getStatusLabelKey } from '../../components/StatusBadge/statusMap';
import { LoadingState } from '../../components/LoadingState/LoadingState';
import { ErrorState } from '../../components/ErrorState/ErrorState';
import { ApiError } from '../../api/client';

export function DashboardSalesPage() {
  const { t } = useTranslation(['dashboard', 'common']);
  const { filters } = useDashboardFilters();
  const { data, isLoading, error } = useDashboardSales(filters);

  if (isLoading) return <LoadingState variant="card" />;

  if (error) {
    const apiError = error instanceof ApiError ? error : null;
    return <ErrorState variant={apiError?.status === 403 ? 'forbidden' : 'generic'} message={apiError?.message} />;
  }

  if (!data) return null;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label={t('sales.pipelineValue')} value={<FinancialValue value={data.pipelineValue} />} />
        <KpiCard
          label={t('sales.conversionRate')}
          value={`${(data.conversionRate * 100).toFixed(1)}%`}
          hint={t('sales.conversionRateHint', { won: data.opportunitiesWonLost.won, lost: data.opportunitiesWonLost.lost })}
        />
        <KpiCard label={t('sales.acceptedQuotationValue')} value={<FinancialValue value={data.acceptedQuotationValue} />} />
        <KpiCard
          label={t('sales.opportunitiesWonLost')}
          value={`${data.opportunitiesWonLost.won} / ${data.opportunitiesWonLost.lost}`}
          hint={t('sales.wonLostHint')}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <StatusBreakdownBars data={data.leadsByStatus} entity="lead" title={t('sales.leadsByStatus')} />
        <StatusBreakdownBars data={data.opportunitiesByStage} entity="opportunity" title={t('sales.opportunitiesByStage')} />
        <StatusBreakdownBars data={data.quotationsByStatus} entity="quotation" title={t('sales.quotationsByStatus')} />
      </div>

      <div className="rounded-lg border border-border bg-surface p-4">
        <p className="mb-3 text-sm font-medium text-ink">{t('sales.quotationValueByStatus')}</p>
        <table className="w-full text-start text-sm">
          <thead className="text-xs uppercase text-ink-muted">
            <tr>
              <th className="pb-2 text-start">{t('sales.status')}</th>
              <th className="pb-2 text-start">{t('sales.value')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {Object.entries(data.quotationValueByStatus).map(([status, value]) => (
              <tr key={status}>
                <td className="py-1.5 text-ink-muted">{t(`common:${getStatusLabelKey('quotation', status)}`)}</td>
                <td className="py-1.5 font-medium text-ink">
                  <FinancialValue value={value} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
