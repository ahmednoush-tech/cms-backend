import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  usePerformanceCycles,
  usePerformanceEvaluationsForCycle,
  useCreatePerformanceEvaluation,
} from '../../../api/queries/usePerformanceEvaluation';
import { useEmployees } from '../../../api/queries/useEmployees';
import { PageHeader } from '../../../components/PageHeader/PageHeader';
import { LoadingState } from '../../../components/LoadingState/LoadingState';
import { ErrorState } from '../../../components/ErrorState/ErrorState';
import { Modal } from '../../../components/Modal/Modal';
import { PermissionGate } from '../../../rbac/PermissionGate';
import { PERMISSIONS } from '../../../rbac/permissionConstants';
import { ApiError } from '../../../api/client';

export function PerformanceEvaluationsListPage() {
  const { t } = useTranslation(['hr', 'common']);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const cycleId = searchParams.get('cycleId') ?? undefined;

  const { data: cycles } = usePerformanceCycles();
  const cycle = cycles?.find((c) => c.id === cycleId);
  const { data: evaluations, isLoading, error } = usePerformanceEvaluationsForCycle(cycleId);
  const { data: employeesData } = useEmployees({ page: 1, pageSize: 500 });
  const createMutation = useCreatePerformanceEvaluation();

  const [createOpen, setCreateOpen] = useState(false);
  const [employeeId, setEmployeeId] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const evaluatedEmployeeIds = new Set((evaluations ?? []).map((e) => e.employeeId));
  const availableEmployees = (employeesData?.items ?? []).filter((emp) => !evaluatedEmployeeIds.has(emp.id));

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cycleId) return;
    setFormError(null);
    createMutation.mutate(
      { cycleId, employeeId, scores: [] },
      {
        onSuccess: (created) => navigate(`/hr/performance-evaluations/${created.id}`),
        onError: (err) => setFormError(err instanceof ApiError ? err.message : 'Something went wrong.'),
      },
    );
  };

  if (!cycleId) {
    return (
      <div>
        <PageHeader title={t('hr:performanceEvaluations.title')} breadcrumb={t('hr:title')} />
        <p className="text-sm text-ink-muted">{t('hr:performanceEvaluations.selectCyclePrompt')}</p>
        <button type="button" onClick={() => navigate('/hr/performance-cycles')} className="mt-3 text-sm font-medium text-primary hover:underline">
          {t('hr:performanceCycles.title')} →
        </button>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={cycle ? `${t('hr:performanceEvaluations.title')} — ${cycle.name}` : t('hr:performanceEvaluations.title')}
        breadcrumb={t('hr:title')}
        action={
          <PermissionGate requires={PERMISSIONS.HR.performanceEvaluations.create}>
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              disabled={cycle?.status === 'closed'}
              className="rounded bg-primary px-3 py-1.5 text-sm font-medium text-primary-fg hover:opacity-90 disabled:opacity-50"
            >
              {t('hr:performanceEvaluations.action.new')}
            </button>
          </PermissionGate>
        }
      />

      {isLoading && <LoadingState />}
      {error && <ErrorState message={error instanceof ApiError ? error.message : undefined} />}

      {evaluations && evaluations.length === 0 && <p className="text-sm text-ink-muted">{t('hr:performanceEvaluations.empty')}</p>}

      {evaluations && evaluations.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-start text-sm">
            <thead className="bg-surface-muted text-xs uppercase text-ink-muted">
              <tr>
                <th className="p-3 text-start">{t('hr:performanceEvaluations.fields.employee')}</th>
                <th className="p-3 text-start">{t('hr:performanceEvaluations.fields.status')}</th>
                <th className="p-3 text-start">{t('hr:performanceEvaluations.fields.overallRating')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {evaluations.map((evaluation) => (
                <tr key={evaluation.id} className="cursor-pointer hover:bg-surface-muted" onClick={() => navigate(`/hr/performance-evaluations/${evaluation.id}`)}>
                  <td className="p-3 font-medium text-ink">
                    {evaluation.employee?.firstName} {evaluation.employee?.lastName}
                  </td>
                  <td className="p-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${evaluation.status === 'finalized' ? 'bg-success/10 text-success' : 'bg-surface-muted text-ink-muted'}`}>
                      {t(`hr:performanceEvaluations.status.${evaluation.status}`)}
                    </span>
                  </td>
                  <td className="p-3 text-ink">{evaluation.overallRating ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={createOpen} onOpenChange={setCreateOpen} title={t('hr:performanceEvaluations.action.new')}>
        <form onSubmit={handleCreate} noValidate>
          <label className="mb-1 block text-xs font-medium text-ink-muted">{t('hr:performanceEvaluations.fields.employee')}</label>
          <select
            required
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value)}
            className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-ink"
          >
            <option value="">—</option>
            {availableEmployees.map((emp) => (
              <option key={emp.id} value={emp.id}>{emp.firstName} {emp.lastName}</option>
            ))}
          </select>
          {formError && <p className="mb-3 mt-3 rounded bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">{formError}</p>}
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" onClick={() => setCreateOpen(false)} className="rounded border border-border px-3 py-1.5 text-sm font-medium text-ink hover:bg-surface-muted">
              {t('common:action.cancel')}
            </button>
            <button type="submit" disabled={createMutation.isPending || !employeeId} className="rounded bg-primary px-3 py-1.5 text-sm font-medium text-primary-fg hover:opacity-90 disabled:opacity-50">
              {createMutation.isPending ? t('common:action.processing') : t('common:action.save')}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
