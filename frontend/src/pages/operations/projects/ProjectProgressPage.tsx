import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { useProjectProgress, useUpdateProject } from '../../../api/queries/useProjects';
import { PageHeader } from '../../../components/PageHeader/PageHeader';
import { LoadingState } from '../../../components/LoadingState/LoadingState';
import { ErrorState } from '../../../components/ErrorState/ErrorState';
import { FinancialValue } from '../../../components/dashboard/FinancialValue';
import { PermissionGate } from '../../../rbac/PermissionGate';
import { PERMISSIONS } from '../../../rbac/permissionConstants';
import { ApiError } from '../../../api/client';

const HEALTH_COLORS: Record<string, string> = {
  on_track: 'bg-success/15 text-success',
  at_risk: 'bg-danger/15 text-danger',
};

export function ProjectProgressPage() {
  const { t } = useTranslation(['projects', 'common']);
  const { id } = useParams<{ id: string }>();
  const { data: progress, isLoading, error } = useProjectProgress(id);
  const updateMutation = useUpdateProject(id ?? '');

  const [budgetInput, setBudgetInput] = useState('');
  const [budgetError, setBudgetError] = useState<string | null>(null);

  if (isLoading) return <LoadingState variant="page" />;
  if (error) {
    const apiError = error instanceof ApiError ? error : null;
    return <ErrorState variant={apiError?.status === 404 ? 'not-found' : 'generic'} message={apiError?.message} />;
  }
  if (!progress) return null;

  const handleSetBudget = (e: React.FormEvent) => {
    e.preventDefault();
    setBudgetError(null);
    updateMutation.mutate(
      { budget: Number(budgetInput) },
      { onSuccess: () => setBudgetInput(''), onError: (err) => setBudgetError(err instanceof ApiError ? err.message : t('common:error.generic')) },
    );
  };

  return (
    <div>
      <PageHeader
        title={t('projects:progress.title')}
        breadcrumb={t('projects:title')}
        action={
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${HEALTH_COLORS[progress.health]}`}>
            {t(`projects:progress.health.${progress.health}`)}
          </span>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="rounded-lg border border-border bg-surface p-4">
          <p className="text-xs text-ink-muted">{t('projects:progress.percentComplete')}</p>
          <p className="mt-1 text-xl font-semibold text-ink">
            {progress.percentComplete !== null ? `${progress.percentComplete}%` : '—'}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-surface p-4">
          <p className="text-xs text-ink-muted">{t('projects:progress.totalTasks')}</p>
          <p className="mt-1 text-xl font-semibold text-ink">{progress.taskCounts.total}</p>
        </div>
        <div className="rounded-lg border border-border bg-surface p-4">
          <p className="text-xs text-ink-muted">{t('projects:progress.overdueTasks')}</p>
          <p className={`mt-1 text-xl font-semibold ${progress.taskCounts.overdue > 0 ? 'text-danger' : 'text-ink'}`}>
            {progress.taskCounts.overdue}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-surface p-4">
          <p className="text-xs text-ink-muted">{t('projects:progress.completedTasks')}</p>
          <p className="mt-1 text-xl font-semibold text-ink">{progress.taskCounts.completed} / {progress.taskCounts.total}</p>
        </div>
      </div>

      <div className="mb-4 rounded-lg border border-border bg-surface p-4">
        <p className="mb-3 text-sm font-medium text-ink">{t('projects:progress.taskBreakdown')}</p>
        <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
          <div><span className="text-ink-muted">{t('projects:progress.status.pending')}: </span><span className="font-medium text-ink">{progress.taskCounts.pending}</span></div>
          <div><span className="text-ink-muted">{t('projects:progress.status.inProgress')}: </span><span className="font-medium text-ink">{progress.taskCounts.inProgress}</span></div>
          <div><span className="text-ink-muted">{t('projects:progress.status.completed')}: </span><span className="font-medium text-ink">{progress.taskCounts.completed}</span></div>
          <div><span className="text-ink-muted">{t('projects:progress.status.cancelled')}: </span><span className="font-medium text-ink">{progress.taskCounts.cancelled}</span></div>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-surface p-4">
        <p className="mb-3 text-sm font-medium text-ink">{t('projects:progress.budgetTitle')}</p>

        {progress.budget === null ? (
          <PermissionGate requires={PERMISSIONS.Operations.projects.edit} fallback={<p className="text-sm text-ink-muted">{t('projects:progress.noBudgetSet')}</p>}>
            <form onSubmit={handleSetBudget} className="flex flex-wrap items-end gap-2">
              <input
                type="number"
                min="0"
                step="0.01"
                required
                placeholder={t('projects:progress.budget')}
                value={budgetInput}
                onChange={(e) => setBudgetInput(e.target.value)}
                className="rounded border border-border bg-surface px-3 py-2 text-sm text-ink"
              />
              <button type="submit" disabled={updateMutation.isPending} className="rounded bg-primary px-3 py-2 text-sm font-medium text-primary-fg hover:opacity-90 disabled:opacity-50">
                {updateMutation.isPending ? t('common:action.processing') : t('projects:progress.setBudget')}
              </button>
            </form>
            {budgetError && <p className="mt-2 rounded bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">{budgetError}</p>}
          </PermissionGate>
        ) : (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <div>
              <p className="text-xs text-ink-muted">{t('projects:progress.budget')}</p>
              <p className="font-medium text-ink"><FinancialValue value={progress.budget} /></p>
            </div>
            <div>
              <p className="text-xs text-ink-muted">{t('projects:progress.actualLaborCost')}</p>
              <p className="font-medium text-ink"><FinancialValue value={progress.actualLaborCost} /></p>
            </div>
            <div>
              <p className="text-xs text-ink-muted">{t('projects:progress.actualMaterialCost')}</p>
              <p className="font-medium text-ink"><FinancialValue value={progress.actualMaterialCost} /></p>
            </div>
            <div>
              <p className="text-xs text-ink-muted">{t('projects:progress.actualTotalCost')}</p>
              <p className="font-semibold text-ink"><FinancialValue value={progress.actualTotalCost} /></p>
            </div>
            <div>
              <p className="text-xs text-ink-muted">{t('projects:progress.variance')}</p>
              <p className={`font-medium ${Number(progress.budgetVariance) < 0 ? 'text-danger' : 'text-success'}`}>
                <FinancialValue value={progress.budgetVariance ?? '0'} />
              </p>
            </div>
            <div>
              <p className="text-xs text-ink-muted">{t('projects:progress.utilization')}</p>
              <p className="font-medium text-ink">{progress.budgetUtilizationPercent}%</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
