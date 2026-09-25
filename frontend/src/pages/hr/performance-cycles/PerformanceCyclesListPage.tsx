import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { usePerformanceCycles, useCreatePerformanceCycle, useUpdatePerformanceCycle } from '../../../api/queries/usePerformanceEvaluation';
import { PageHeader } from '../../../components/PageHeader/PageHeader';
import { LoadingState } from '../../../components/LoadingState/LoadingState';
import { ErrorState } from '../../../components/ErrorState/ErrorState';
import { Modal } from '../../../components/Modal/Modal';
import { FormField, TextInput } from '../../../components/Form/FormField';
import { PermissionGate } from '../../../rbac/PermissionGate';
import { PERMISSIONS } from '../../../rbac/permissionConstants';
import { ApiError } from '../../../api/client';

export function PerformanceCyclesListPage() {
  const { t } = useTranslation(['hr', 'common']);
  const navigate = useNavigate();
  const { data: cycles, isLoading, error } = usePerformanceCycles();
  const createMutation = useCreatePerformanceCycle();
  const updateMutation = useUpdatePerformanceCycle();

  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    createMutation.mutate(
      { name, startDate, endDate },
      {
        onSuccess: () => {
          setCreateOpen(false);
          setName('');
          setStartDate('');
          setEndDate('');
        },
        onError: (err) => setFormError(err instanceof ApiError ? err.message : 'Something went wrong.'),
      },
    );
  };

  const toggleStatus = (id: string, currentStatus: 'open' | 'closed') => {
    updateMutation.mutate({ id, input: { status: currentStatus === 'open' ? 'closed' : 'open' } });
  };

  return (
    <div>
      <PageHeader
        title={t('hr:performanceCycles.title')}
        breadcrumb={t('hr:title')}
        action={
          <PermissionGate requires={PERMISSIONS.HR.performanceCycles.manage}>
            <button type="button" onClick={() => setCreateOpen(true)} className="rounded bg-primary px-3 py-1.5 text-sm font-medium text-primary-fg hover:opacity-90">
              {t('hr:performanceCycles.action.add')}
            </button>
          </PermissionGate>
        }
      />
      <p className="mb-4 max-w-2xl text-sm text-ink-muted">{t('hr:performanceCycles.description')}</p>

      {isLoading && <LoadingState />}
      {error && <ErrorState message={error instanceof ApiError ? error.message : undefined} />}

      {cycles && (
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-start text-sm">
            <thead className="bg-surface-muted text-xs uppercase text-ink-muted">
              <tr>
                <th className="p-3 text-start">{t('hr:performanceCycles.fields.name')}</th>
                <th className="p-3 text-start">{t('hr:performanceCycles.fields.startDate')}</th>
                <th className="p-3 text-start">{t('hr:performanceCycles.fields.endDate')}</th>
                <th className="p-3 text-start">{t('hr:performanceCycles.fields.status')}</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {cycles.map((cycle) => (
                <tr key={cycle.id} className="cursor-pointer hover:bg-surface-muted" onClick={() => navigate(`/hr/performance-evaluations?cycleId=${cycle.id}`)}>
                  <td className="p-3 font-medium text-ink">{cycle.name}</td>
                  <td className="p-3 text-ink-muted">{new Date(cycle.startDate).toLocaleDateString()}</td>
                  <td className="p-3 text-ink-muted">{new Date(cycle.endDate).toLocaleDateString()}</td>
                  <td className="p-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cycle.status === 'open' ? 'bg-success/10 text-success' : 'bg-surface-muted text-ink-muted'}`}>
                      {t(`hr:performanceCycles.status.${cycle.status}`)}
                    </span>
                  </td>
                  <td className="p-3 text-end" onClick={(e) => e.stopPropagation()}>
                    <PermissionGate requires={PERMISSIONS.HR.performanceCycles.manage}>
                      <button type="button" onClick={() => toggleStatus(cycle.id, cycle.status)} className="text-sm font-medium text-primary hover:underline">
                        {cycle.status === 'open' ? t('hr:performanceCycles.action.close') : t('hr:performanceCycles.action.reopen')}
                      </button>
                    </PermissionGate>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={createOpen} onOpenChange={setCreateOpen} title={t('hr:performanceCycles.action.add')}>
        <form onSubmit={handleCreate} noValidate>
          <FormField label={t('hr:performanceCycles.fields.name')} htmlFor="cycleName" required>
            <TextInput id="cycleName" value={name} onChange={(e) => setName(e.target.value)} required />
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label={t('hr:performanceCycles.fields.startDate')} htmlFor="startDate" required>
              <TextInput id="startDate" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
            </FormField>
            <FormField label={t('hr:performanceCycles.fields.endDate')} htmlFor="endDate" required>
              <TextInput id="endDate" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required />
            </FormField>
          </div>
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
