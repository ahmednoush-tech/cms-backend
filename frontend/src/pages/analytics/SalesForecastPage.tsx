import { useTranslation } from 'react-i18next';
import { useSalesForecast } from '../../api/queries/useAnalytics';
import { PageHeader } from '../../components/PageHeader/PageHeader';
import { LoadingState } from '../../components/LoadingState/LoadingState';
import { ErrorState } from '../../components/ErrorState/ErrorState';
import { FinancialValue } from '../../components/dashboard/FinancialValue';
import { SimpleBarChart } from '../../components/charts/SimpleBarChart';
import { ApiError } from '../../api/client';

export function SalesForecastPage() {
  const { t } = useTranslation(['analytics', 'opportunities', 'common']);
  const { data: forecast, isLoading, error } = useSalesForecast();

  if (isLoading) return <LoadingState variant="page" />;
  if (error) {
    const apiError = error instanceof ApiError ? error : null;
    return <ErrorState variant="generic" message={apiError?.message} />;
  }
  if (!forecast) return null;

  return (
    <div>
      <PageHeader title={t('analytics:salesForecast.title')} />
      <p className="mb-4 text-sm text-ink-muted">{t('analytics:salesForecast.methodologyNote')}</p>

      <div className="mb-4 grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="rounded-lg border border-border bg-surface p-4">
          <p className="text-xs text-ink-muted">{t('analytics:salesForecast.totalPipeline')}</p>
          <p className="mt-1 text-xl font-semibold text-ink"><FinancialValue value={forecast.totalPipelineValue} /></p>
        </div>
        <div className="rounded-lg border border-border bg-surface p-4">
          <p className="text-xs text-ink-muted">{t('analytics:salesForecast.weightedPipeline')}</p>
          <p className="mt-1 text-xl font-semibold text-primary"><FinancialValue value={forecast.weightedPipelineValue} /></p>
        </div>
        <div className="rounded-lg border border-border bg-surface p-4">
          <p className="text-xs text-ink-muted">{t('analytics:salesForecast.openOpportunities')}</p>
          <p className="mt-1 text-xl font-semibold text-ink">{forecast.openOpportunityCount}</p>
        </div>
        <div className="rounded-lg border border-border bg-surface p-4">
          <p className="text-xs text-ink-muted">{t('analytics:salesForecast.historicalWinRate')}</p>
          <p className="mt-1 text-xl font-semibold text-ink">
            {forecast.historicalWinRate !== null ? `${forecast.historicalWinRate}%` : t('analytics:salesForecast.noClosedDataYet')}
          </p>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-surface p-4">
          <p className="mb-3 text-sm font-medium text-ink">{t('analytics:salesForecast.byStage')}</p>
          {forecast.byStage.length === 0 ? (
            <p className="text-sm text-ink-muted">{t('analytics:salesForecast.noOpenOpportunities')}</p>
          ) : (
            <SimpleBarChart
              bars={forecast.byStage.map((s) => ({ label: t(`opportunities:stage.${s.stage}`), value: Number(s.weightedValue) }))}
              formatValue={(v) => v.toLocaleString()}
            />
          )}
        </div>

        <div className="rounded-lg border border-border bg-surface p-4">
          <p className="mb-3 text-sm font-medium text-ink">{t('analytics:salesForecast.byOwner')}</p>
          {forecast.byOwner.length === 0 ? (
            <p className="text-sm text-ink-muted">{t('analytics:salesForecast.noOpenOpportunities')}</p>
          ) : (
            <SimpleBarChart
              bars={forecast.byOwner.map((o) => ({ label: o.ownerName, value: Number(o.weightedValue) }))}
              formatValue={(v) => v.toLocaleString()}
            />
          )}
        </div>
      </div>

      <div className="rounded-lg border border-border bg-surface p-4">
        <p className="mb-3 text-sm font-medium text-ink">{t('analytics:salesForecast.byMonth')}</p>
        {forecast.byMonth.length === 0 ? (
          <p className="text-sm text-ink-muted">{t('analytics:salesForecast.noOpenOpportunities')}</p>
        ) : (
          <table className="w-full text-start text-sm">
            <thead className="border-b border-border text-xs uppercase text-ink-muted">
              <tr>
                <th className="p-2 text-start">{t('analytics:salesForecast.month')}</th>
                <th className="p-2 text-start">{t('analytics:salesForecast.pipelineValue')}</th>
                <th className="p-2 text-start">{t('analytics:salesForecast.weightedValue')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {forecast.byMonth.map((m) => (
                <tr key={m.month}>
                  <td className="p-2">{m.month === 'unscheduled' ? t('analytics:salesForecast.unscheduled') : m.month}</td>
                  <td className="p-2"><FinancialValue value={m.pipelineValue} /></td>
                  <td className="p-2"><FinancialValue value={m.weightedValue} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
