import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLeaveTypes, useCreateLeaveType, useDeactivateLeaveType } from '../../../api/queries/useLeaveManagement';
import { PageHeader } from '../../../components/PageHeader/PageHeader';
import { LoadingState } from '../../../components/LoadingState/LoadingState';
import { ErrorState } from '../../../components/ErrorState/ErrorState';
import { PermissionGate } from '../../../rbac/PermissionGate';
import { PERMISSIONS } from '../../../rbac/permissionConstants';
import { ApiError } from '../../../api/client';

export function LeaveTypesListPage() {
  const { t } = useTranslation(['hr', 'common']);
  const { data: types, isLoading, error } = useLeaveTypes();
  const createMutation = useCreateLeaveType();
  const deactivateMutation = useDeactivateLeaveType();

  const [name, setName] = useState('');
  const [requiresBalance, setRequiresBalance] = useState(true);
  const [isPaid, setIsPaid] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    createMutation.mutate(
      { name, requiresBalance, isPaid },
      {
        onSuccess: () => {
          setName('');
          setRequiresBalance(true);
          setIsPaid(true);
        },
        onError: (err) => setFormError(err instanceof ApiError ? err.message : 'Something went wrong.'),
      },
    );
  };

  if (isLoading) return <LoadingState />;
  if (error) return <ErrorState message={error instanceof ApiError ? error.message : undefined} />;

  return (
    <div>
      <PageHeader title={t('hr:leaveTypes.title')} breadcrumb={t('hr:title')} />
      <p className="mb-4 max-w-2xl text-sm text-ink-muted">{t('hr:leaveTypes.description')}</p>

      <PermissionGate requires={PERMISSIONS.HR.leaveTypes.manage}>
        <form onSubmit={handleCreate} className="mb-6 flex flex-wrap items-end gap-3 rounded-lg border border-border bg-surface p-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-muted">{t('hr:leaveTypes.fields.name')}</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="rounded border border-border bg-surface px-3 py-2 text-sm text-ink"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-ink">
            <input type="checkbox" checked={requiresBalance} onChange={(e) => setRequiresBalance(e.target.checked)} />
            {t('hr:leaveTypes.fields.requiresBalance')}
          </label>
          <label className="flex items-center gap-2 text-sm text-ink">
            <input type="checkbox" checked={isPaid} onChange={(e) => setIsPaid(e.target.checked)} />
            {t('hr:leaveTypes.fields.isPaid')}
          </label>
          <button type="submit" disabled={createMutation.isPending} className="rounded bg-primary px-4 py-2 text-sm font-medium text-primary-fg hover:opacity-90 disabled:opacity-50">
            {createMutation.isPending ? t('common:action.processing') : t('hr:leaveTypes.action.add')}
          </button>
        </form>
        {formError && <p className="mb-4 rounded bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">{formError}</p>}
      </PermissionGate>

      <div className="overflow-hidden rounded-lg border border-border">
        <table className="w-full text-start text-sm">
          <thead className="bg-surface-muted text-xs uppercase text-ink-muted">
            <tr>
              <th className="p-3 text-start">{t('hr:leaveTypes.fields.name')}</th>
              <th className="p-3 text-start">{t('hr:leaveTypes.fields.requiresBalance')}</th>
              <th className="p-3 text-start">{t('hr:leaveTypes.fields.isPaid')}</th>
              <PermissionGate requires={PERMISSIONS.HR.leaveTypes.manage}>
                <th className="p-3"></th>
              </PermissionGate>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {(types ?? []).map((lt) => (
              <tr key={lt.id}>
                <td className="p-3 font-medium text-ink">{lt.name}</td>
                <td className="p-3 text-ink-muted">{lt.requiresBalance ? t('common:action.yes') : t('common:action.no')}</td>
                <td className="p-3 text-ink-muted">{lt.isPaid ? t('common:action.yes') : t('common:action.no')}</td>
                <PermissionGate requires={PERMISSIONS.HR.leaveTypes.manage}>
                  <td className="p-3 text-end">
                    <button
                      type="button"
                      onClick={() => deactivateMutation.mutate(lt.id)}
                      className="text-sm font-medium text-danger hover:underline"
                    >
                      {t('hr:leaveTypes.action.deactivate')}
                    </button>
                  </td>
                </PermissionGate>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
