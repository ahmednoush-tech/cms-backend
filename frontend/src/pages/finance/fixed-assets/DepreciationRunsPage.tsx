import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDepreciationRuns, useCreateDepreciationRun } from '../../../api/queries/useFixedAssets';
import { PageHeader } from '../../../components/PageHeader/PageHeader';
import { LoadingState } from '../../../components/LoadingState/LoadingState';
import { ErrorState } from '../../../components/ErrorState/ErrorState';
import { FinancialValue } from '../../../components/dashboard/FinancialValue';
import { PermissionGate } from '../../../rbac/PermissionGate';
import { PERMISSIONS } from '../../../rbac/permissionConstants';
import { ApiError } from '../../../api/client';
import type { DepreciationRun } from '../../../types/entities/fixedAsset';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function DepreciationRunsPage() {
  const { t } = useTranslation(['fixedAssets', 'common']);
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [runError, setRunError] = useState<string | null>(null);
  const [lastRunResult, setLastRunResult] = useState<DepreciationRun | null>(null);

  const { data: runs, isLoading, error } = useDepreciationRuns();
  const createMutation = useCreateDepreciationRun();

  const handleRun = () => {
    setRunError(null);
    setLastRunResult(null);
    createMutation.mutate(
      { month, year },
      {
        onSuccess: (run) => setLastRunResult(run),
        onError: (err) => setRunError(err instanceof ApiError ? err.message : t('common:error.generic')),
      },
    );
  };

  return (
    <div>
      <PageHeader title={t('fixedAssets:depreciationRuns.title')} breadcrumb={t('fixedAssets:title')} />

      <PermissionGate requires={PERMISSIONS.Finance.depreciationRuns.create}>
        <div className="mb-6 rounded-lg border border-border bg-surface p-4">
          <p className="mb-3 text-sm font-medium text-ink">{t('fixedAssets:depreciationRuns.runNew')}</p>
          <div className="flex flex-wrap items-end gap-2">
            <div>
              <label className="mb-1 block text-xs text-ink-muted" htmlFor="month">{t('fixedAssets:depreciationRuns.month')}</label>
              <select id="month" value={month} onChange={(e) => setMonth(Number(e.target.value))} className="rounded border border-border bg-surface px-2 py-1.5 text-sm text-ink">
                {MONTH_NAMES.map((m, i) => (<option key={m} value={i + 1}>{m}</option>))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-ink-muted" htmlFor="year">{t('fixedAssets:depreciationRuns.year')}</label>
              <input id="year" type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} className="w-24 rounded border border-border bg-surface px-2 py-1.5 text-sm text-ink" />
            </div>
            <button
              type="button"
              onClick={handleRun}
              disabled={createMutation.isPending}
              className="rounded bg-primary px-3 py-2 text-sm font-medium text-primary-fg hover:opacity-90 disabled:opacity-50"
            >
              {createMutation.isPending ? t('common:action.processing') : t('fixedAssets:depreciationRuns.run')}
            </button>
          </div>

          {runError && <p className="mt-3 rounded bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">{runError}</p>}

          {lastRunResult && (
            <div className="mt-4 rounded border border-success/30 bg-success/10 p-3 text-sm">
              <p className="font-medium text-success">
                {t('fixedAssets:depreciationRuns.runSuccess', { total: lastRunResult.totalDepreciation })}
              </p>
              {lastRunResult.skippedAssets && lastRunResult.skippedAssets.length > 0 && (
                <div className="mt-2">
                  <p className="font-medium text-ink">{t('fixedAssets:depreciationRuns.skippedAssets')}</p>
                  <ul className="ms-4 list-disc text-ink-muted">
                    {lastRunResult.skippedAssets.map((s) => (<li key={s}>{s}</li>))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </PermissionGate>

      <div className="rounded-lg border border-border bg-surface p-4">
        <p className="mb-3 text-sm font-medium text-ink">{t('fixedAssets:depreciationRuns.history')}</p>
        {isLoading && <LoadingState variant="card" />}
        {error && (() => {
          const apiError = error instanceof ApiError ? error : null;
          return <ErrorState variant="generic" message={apiError?.message} />;
        })()}
        {runs && runs.length === 0 && <p className="text-sm text-ink-muted">{t('fixedAssets:depreciationRuns.empty')}</p>}
        {runs && runs.length > 0 && (
          <table className="w-full text-start text-sm">
            <thead className="border-b border-border text-xs uppercase text-ink-muted">
              <tr>
                <th className="pb-2 text-start">{t('fixedAssets:depreciationRuns.period')}</th>
                <th className="pb-2 text-start">{t('fixedAssets:depreciationRuns.totalDepreciation')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {runs.map((run) => (
                <tr key={run.id}>
                  <td className="py-2">{MONTH_NAMES[run.month - 1]} {run.year}</td>
                  <td className="py-2"><FinancialValue value={run.totalDepreciation} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
