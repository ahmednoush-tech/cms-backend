import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { usePeriods, useCreatePeriod, useLockPeriod, useUnlockPeriod } from '../../../api/queries/useFinance';
import { PageHeader } from '../../../components/PageHeader/PageHeader';
import { DataTable, type DataTableColumn } from '../../../components/DataTable/DataTable';
import { ConfirmDialog } from '../../../components/ConfirmDialog/ConfirmDialog';
import { PermissionGate } from '../../../rbac/PermissionGate';
import { PERMISSIONS } from '../../../rbac/permissionConstants';
import { ApiError } from '../../../api/client';
import { PeriodFormModal, type PeriodFormValues } from './PeriodFormModal';
import type { AccountingPeriod } from '../../../types/entities/finance';

export function PeriodsListPage() {
  const { t } = useTranslation(['finance', 'common']);
  const [createOpen, setCreateOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<{ period: AccountingPeriod; action: 'lock' | 'unlock' } | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const { data, isLoading, error } = usePeriods();
  const createMutation = useCreatePeriod();
  const lockMutation = useLockPeriod();
  const unlockMutation = useUnlockPeriod();

  const columns: Array<DataTableColumn<AccountingPeriod>> = [
    { key: 'name', headerKey: 'finance:periods.columns.name', render: (p) => p.name },
    { key: 'startDate', headerKey: 'finance:periods.columns.startDate', render: (p) => p.startDate.slice(0, 10) },
    { key: 'endDate', headerKey: 'finance:periods.columns.endDate', render: (p) => p.endDate.slice(0, 10) },
    {
      key: 'status',
      headerKey: 'finance:periods.columns.status',
      render: (p) => (
        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${p.status === 'locked' ? 'bg-danger/15 text-danger' : 'bg-success/15 text-success'}`}>
          {p.status === 'locked' ? t('finance:periods.status.locked') : t('finance:periods.status.open')}
        </span>
      ),
    },
    {
      key: 'actions',
      headerKey: 'common:action.edit',
      render: (p) => (
        <PermissionGate requires={PERMISSIONS.Finance.periods.manage}>
          {p.status === 'open' ? (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setActionError(null); setConfirmTarget({ period: p, action: 'lock' }); }}
              className="text-xs font-medium text-danger hover:underline"
            >
              {t('finance:periods.action.lock')}
            </button>
          ) : (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setActionError(null); setConfirmTarget({ period: p, action: 'unlock' }); }}
              className="text-xs font-medium text-primary hover:underline"
            >
              {t('finance:periods.action.unlock')}
            </button>
          )}
        </PermissionGate>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title={t('finance:periods.title')}
        action={
          <PermissionGate requires={PERMISSIONS.Finance.periods.manage}>
            <button type="button" onClick={() => { setFormError(null); setCreateOpen(true); }} className="rounded bg-primary px-3 py-1.5 text-sm font-medium text-primary-fg hover:opacity-90">
              {t('finance:periods.action.create')}
            </button>
          </PermissionGate>
        }
      />

      <p className="mb-4 text-sm text-ink-muted">{t('finance:periods.description')}</p>

      <DataTable
        columns={columns}
        rows={data}
        rowKey={(p) => p.id}
        isLoading={isLoading}
        error={error}
        emptyTitle={t('finance:periods.empty.title')}
        emptyDescription={t('finance:periods.empty.description')}
      />
      {actionError && <p className="mt-2 text-sm text-danger" role="alert">{actionError}</p>}

      <PeriodFormModal
        open={createOpen}
        onOpenChange={(open) => { if (!open) { setCreateOpen(false); setFormError(null); } }}
        isSubmitting={createMutation.isPending}
        submitError={formError}
        onSubmit={(values: PeriodFormValues) => {
          setFormError(null);
          createMutation.mutate(values, {
            onSuccess: () => setCreateOpen(false),
            onError: (err) => setFormError(err instanceof ApiError ? err.message : t('common:error.generic')),
          });
        }}
      />

      <ConfirmDialog
        open={!!confirmTarget}
        onOpenChange={(open) => !open && setConfirmTarget(null)}
        title={confirmTarget?.action === 'lock' ? t('finance:periods.lockConfirmTitle') : t('finance:periods.unlockConfirmTitle')}
        message={confirmTarget?.action === 'lock' ? t('finance:periods.lockConfirmMessage') : t('finance:periods.unlockConfirmMessage')}
        variant={confirmTarget?.action === 'unlock' ? 'destructive' : undefined}
        isLoading={lockMutation.isPending || unlockMutation.isPending}
        onConfirm={() => {
          if (!confirmTarget) return;
          const mutation = confirmTarget.action === 'lock' ? lockMutation : unlockMutation;
          mutation.mutate(confirmTarget.period.id, {
            onSuccess: () => setConfirmTarget(null),
            onError: (err) => {
              setConfirmTarget(null);
              setActionError(err instanceof ApiError ? err.message : t('common:error.generic'));
            },
          });
        }}
      />
    </div>
  );
}
