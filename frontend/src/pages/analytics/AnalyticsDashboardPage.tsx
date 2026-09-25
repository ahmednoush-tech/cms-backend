import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useRevenueTrend, useSalesFunnel, useTopCustomers, useEmployeeUtilization } from '../../api/queries/useAnalytics';
import { PageHeader } from '../../components/PageHeader/PageHeader';
import { LoadingState } from '../../components/LoadingState/LoadingState';
import { ErrorState } from '../../components/ErrorState/ErrorState';
import { SimpleLineChart } from '../../components/charts/SimpleLineChart';
import { SimpleBarChart } from '../../components/charts/SimpleBarChart';
import { ApiError } from '../../api/client';

function startOfYear(): string {
  return `${new Date().getFullYear()}-01-01`;
}

function formatMoney(v: number): string {
  return new Intl.NumberFormat(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v);
}

export function AnalyticsDashboardPage() {
  const { t } = useTranslation(['analytics', 'common']);

  const [fromDate, setFromDate] = useState(startOfYear());
  const [toDate, setToDate] = useState(new Date().toISOString().slice(0, 10));
  const [range, setRange] = useState<{ from: string; to: string }>({ from: fromDate, to: toDate });

  const revenueTrend = useRevenueTrend(12);
  const salesFunnel = useSalesFunnel(range.from, range.to);
  const topCustomers = useTopCustomers(range.from, range.to, 5);
  const utilization = useEmployeeUtilization(range.from, range.to);

  const anyLoading = revenueTrend.isLoading || salesFunnel.isLoading || topCustomers.isLoading || utilization.isLoading;
  const anyError = revenueTrend.error || salesFunnel.error || topCustomers.error || utilization.error;

  return (
    <div>
      <PageHeader
        title={t('analytics:title')}
        action={
          <Link to="/analytics/sales-forecast" className="rounded border border-border px-3 py-1.5 text-sm font-medium text-ink hover:bg-surface-muted">
            {t('analytics:salesForecast.title')}
          </Link>
        }
      />

      <div className="mb-6 flex flex-wrap items-end gap-2 rounded-lg border border-border bg-surface p-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-ink-muted" htmlFor="fromDate">{t('analytics:fromDate')}</label>
          <input id="fromDate" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="rounded border border-border bg-surface px-2 py-1.5 text-sm text-ink" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-ink-muted" htmlFor="toDate">{t('analytics:toDate')}</label>
          <input id="toDate" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="rounded border border-border bg-surface px-2 py-1.5 text-sm text-ink" />
        </div>
        <button type="button" onClick={() => setRange({ from: fromDate, to: toDate })} className="rounded bg-primary px-3 py-2 text-sm font-medium text-primary-fg hover:opacity-90">
          {t('analytics:apply')}
        </button>
      </div>

      {anyLoading && <LoadingState variant="card" />}
      {anyError && (() => {
        const apiError = anyError instanceof ApiError ? anyError : null;
        return <ErrorState variant="generic" message={apiError?.message} />;
      })()}

      {revenueTrend.data && (
        <section className="mb-6 rounded-lg border border-border bg-surface p-4">
          <h2 className="mb-3 text-sm font-medium text-ink">{t('analytics:revenueTrend.title')}</h2>
          <SimpleLineChart
            points={revenueTrend.data.map((p) => ({ label: p.month.slice(2), value: Number(p.revenue) }))}
            formatValue={formatMoney}
          />
        </section>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {salesFunnel.data && (
          <section className="rounded-lg border border-border bg-surface p-4">
            <h2 className="mb-3 text-sm font-medium text-ink">{t('analytics:salesFunnel.title')}</h2>
            <div className="mb-3 grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-lg font-semibold text-ink">{salesFunnel.data.leads.total}</p>
                <p className="text-xs text-ink-muted">{t('analytics:salesFunnel.leads')}</p>
              </div>
              <div>
                <p className="text-lg font-semibold text-ink">{salesFunnel.data.opportunities.total}</p>
                <p className="text-xs text-ink-muted">{t('analytics:salesFunnel.opportunities')}</p>
              </div>
              <div>
                <p className="text-lg font-semibold text-ink">{salesFunnel.data.opportunities.won}</p>
                <p className="text-xs text-ink-muted">{t('analytics:salesFunnel.won')}</p>
              </div>
            </div>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-ink-muted">{t('analytics:salesFunnel.leadToOpportunity')}</span><span className="font-medium text-ink">{salesFunnel.data.conversionRates.leadToOpportunity}%</span></div>
              <div className="flex justify-between"><span className="text-ink-muted">{t('analytics:salesFunnel.opportunityToWon')}</span><span className="font-medium text-ink">{salesFunnel.data.conversionRates.opportunityToWon}%</span></div>
              <div className="flex justify-between border-t border-border pt-1"><span className="text-ink-muted">{t('analytics:salesFunnel.leadToWon')}</span><span className="font-semibold text-ink">{salesFunnel.data.conversionRates.leadToWon}%</span></div>
            </div>
          </section>
        )}

        {topCustomers.data && (
          <section className="rounded-lg border border-border bg-surface p-4">
            <h2 className="mb-3 text-sm font-medium text-ink">{t('analytics:topCustomers.title')}</h2>
            {topCustomers.data.length === 0 ? (
              <p className="text-sm text-ink-muted">{t('analytics:topCustomers.empty')}</p>
            ) : (
              <SimpleBarChart
                bars={topCustomers.data.map((c) => ({ label: c.customerName, value: Number(c.revenue) }))}
                formatValue={formatMoney}
              />
            )}
          </section>
        )}
      </div>

      {utilization.data && (
        <section className="mt-6 rounded-lg border border-border bg-surface p-4">
          <h2 className="mb-3 text-sm font-medium text-ink">{t('analytics:utilization.title')}</h2>
          {utilization.data.length === 0 ? (
            <p className="text-sm text-ink-muted">{t('analytics:utilization.empty')}</p>
          ) : (
            <table className="w-full text-start text-sm">
              <thead className="border-b border-border text-xs uppercase text-ink-muted">
                <tr>
                  <th className="pb-2 text-start">{t('analytics:utilization.employee')}</th>
                  <th className="pb-2 text-start">{t('analytics:utilization.totalHours')}</th>
                  <th className="pb-2 text-start">{t('analytics:utilization.billableHours')}</th>
                  <th className="pb-2 text-start">{t('analytics:utilization.rate')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {utilization.data.map((u) => (
                  <tr key={u.employeeId}>
                    <td className="py-1.5 font-medium text-ink">{u.employeeName}</td>
                    <td className="py-1.5">{u.totalHours}</td>
                    <td className="py-1.5">{u.billableHours}</td>
                    <td className="py-1.5">{u.utilizationRate}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}
    </div>
  );
}
