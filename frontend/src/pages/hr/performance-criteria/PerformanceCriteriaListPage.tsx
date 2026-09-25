import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { usePerformanceCriteria, useCreatePerformanceCriterion, useDeactivatePerformanceCriterion } from '../../../api/queries/usePerformanceEvaluation';
import { PageHeader } from '../../../components/PageHeader/PageHeader';
import { LoadingState } from '../../../components/LoadingState/LoadingState';
import { ErrorState } from '../../../components/ErrorState/ErrorState';
import { Modal } from '../../../components/Modal/Modal';
import { FormField, TextInput } from '../../../components/Form/FormField';
import { PermissionGate } from '../../../rbac/PermissionGate';
import { PERMISSIONS } from '../../../rbac/permissionConstants';
import { ApiError } from '../../../api/client';

export function PerformanceCriteriaListPage() {
  const { t } = useTranslation(['hr', 'common']);
  const { data: criteria, isLoading, error } = usePerformanceCriteria();
  const createMutation = useCreatePerformanceCriterion();
  const deactivateMutation = useDeactivatePerformanceCriterion();

  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    createMutation.mutate(
      { name, description: description || undefined },
      {
        onSuccess: () => {
          setCreateOpen(false);
          setName('');
          setDescription('');
        },
        onError: (err) => setFormError(err instanceof ApiError ? err.message : 'Something went wrong.'),
      },
    );
  };

  return (
    <div>
      <PageHeader
        title={t('hr:performanceCriteria.title')}
        breadcrumb={t('hr:title')}
        action={
          <PermissionGate requires={PERMISSIONS.HR.performanceCriteria.manage}>
            <button type="button" onClick={() => setCreateOpen(true)} className="rounded bg-primary px-3 py-1.5 text-sm font-medium text-primary-fg hover:opacity-90">
              {t('hr:performanceCriteria.action.add')}
            </button>
          </PermissionGate>
        }
      />
      <p className="mb-4 max-w-2xl text-sm text-ink-muted">{t('hr:performanceCriteria.description')}</p>

      {isLoading && <LoadingState />}
      {error && <ErrorState message={error instanceof ApiError ? error.message : undefined} />}

      {criteria && (
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-start text-sm">
            <thead className="bg-surface-muted text-xs uppercase text-ink-muted">
              <tr>
                <th className="p-3 text-start">{t('hr:performanceCriteria.fields.name')}</th>
                <th className="p-3 text-start">{t('hr:performanceCriteria.fields.description')}</th>
                <PermissionGate requires={PERMISSIONS.HR.performanceCriteria.manage}>
                  <th className="p-3"></th>
                </PermissionGate>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {criteria.map((criterion) => (
                <tr key={criterion.id}>
                  <td className="p-3 font-medium text-ink">{criterion.name}</td>
                  <td className="p-3 text-ink-muted">{criterion.description ?? '—'}</td>
                  <PermissionGate requires={PERMISSIONS.HR.performanceCriteria.manage}>
                    <td className="p-3 text-end">
                      <button type="button" onClick={() => deactivateMutation.mutate(criterion.id)} className="text-sm font-medium text-danger hover:underline">
                        {t('hr:performanceCriteria.action.deactivate')}
                      </button>
                    </td>
                  </PermissionGate>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={createOpen} onOpenChange={setCreateOpen} title={t('hr:performanceCriteria.action.add')}>
        <form onSubmit={handleCreate} noValidate>
          <FormField label={t('hr:performanceCriteria.fields.name')} htmlFor="criterionName" required>
            <TextInput id="criterionName" value={name} onChange={(e) => setName(e.target.value)} required />
          </FormField>
          <FormField label={t('hr:performanceCriteria.fields.description')} htmlFor="criterionDescription">
            <TextInput id="criterionDescription" value={description} onChange={(e) => setDescription(e.target.value)} />
          </FormField>
          {formError && <p className="mb-3 rounded bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">{formError}</p>}
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" onClick={() => setCreateOpen(false)} className="rounded border border-border px-3 py-1.5 text-sm font-medium text-ink hover:bg-surface-muted">
              {t('common:action.cancel')}
            </button>
            <button type="submit" disabled={createMutation.isPending} className="rounded bg-primary px-3 py-1.5 text-sm font-medium text-primary-fg hover:opacity-90 disabled:opacity-50">
              {createMutation.isPending ? t('common:action.processing') : t('common:action.save')}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
