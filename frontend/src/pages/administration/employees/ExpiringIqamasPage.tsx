import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useCheckExpiringIqamas } from '../../../api/queries/useEmployees';
import { PageHeader } from '../../../components/PageHeader/PageHeader';
import { ApiError } from '../../../api/client';

function urgencyColor(daysRemaining: number): string {
  if (daysRemaining < 0) return 'bg-danger/15 text-danger';
  if (daysRemaining <= 7) return 'bg-danger/15 text-danger';
  if (daysRemaining <= 30) return 'bg-warning/15 text-warning';
  return 'bg-ink-muted/15 text-ink-muted';
}

export function ExpiringIqamasPage() {
  const { t } = useTranslation(['employees', 'common']);
  const navigate = useNavigate();
  const [daysThreshold, setDaysThreshold] = useState('30');
  const [checkError, setCheckError] = useState<string | null>(null);
  const checkMutation = useCheckExpiringIqamas();

  const handleCheck = () => {
    setCheckError(null);
    checkMutation.mutate(Number(daysThreshold), {
      onError: (err) => setCheckError(err instanceof ApiError ? err.message : t('common:error.generic')),
    });
  };

  return (
    <div>
      <PageHeader title={t('employees:residency.expiringIqamasTitle')} breadcrumb={t('employees:title')} />
      <p className="mb-4 max-w-2xl text-sm text-ink-muted">{t('employees:residency.onDemandDisclosure')}</p>

      <div className="mb-4 flex flex-wrap items-end gap-2 rounded-lg border border-border bg-surface p-4">
        <div>
          <label htmlFor="daysThreshold" className="mb-1 block text-xs font-medium text-ink-muted">
            {t('employees:residency.daysThreshold')}
          </label>
          <input
            id="daysThreshold"
            type="number"
            min="1"
            value={daysThreshold}
            onChange={(e) => setDaysThreshold(e.target.value)}
            className="w-24 rounded border border-border bg-surface px-3 py-2 text-sm text-ink"
          />
        </div>
        <button type="button" onClick={handleCheck} disabled={checkMutation.isPending} className="rounded bg-primary px-3 py-2 text-sm font-medium text-primary-fg hover:opacity-90 disabled:opacity-50">
          {checkMutation.isPending ? t('common:action.processing') : t('employees:residency.checkNow')}
        </button>
      </div>

      {checkError && <p className="mb-4 rounded bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">{checkError}</p>}

      {checkMutation.data && (
        <div className="rounded-lg border border-border bg-surface p-4">
          <p className="mb-3 text-sm text-ink-muted">
            {t('employees:residency.resultSummary', {
              expiringCount: checkMutation.data.expiringCount,
              notificationsSent: checkMutation.data.notificationsSent,
            })}
          </p>

          {checkMutation.data.employees.length === 0 ? (
            <p className="text-sm text-ink-muted">{t('employees:residency.noneExpiring')}</p>
          ) : (
            <table className="w-full text-start text-sm">
              <thead className="border-b border-border text-xs uppercase text-ink-muted">
                <tr>
                  <th className="p-2 text-start">{t('employees:columns.name')}</th>
                  <th className="p-2 text-start">{t('employees:residency.iqamaNumber')}</th>
                  <th className="p-2 text-start">{t('employees:residency.iqamaExpiryDate')}</th>
                  <th className="p-2 text-start">{t('employees:residency.daysRemaining')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {checkMutation.data.employees.map((emp) => (
                  <tr key={emp.id} onClick={() => navigate(`/admin/employees/${emp.id}`)} className="cursor-pointer hover:bg-surface-muted">
                    <td className="p-2 font-medium text-ink">{emp.name}</td>
                    <td className="p-2">{emp.iqamaNumber ?? '—'}</td>
                    <td className="p-2">{emp.iqamaExpiryDate.slice(0, 10)}</td>
                    <td className="p-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${urgencyColor(emp.daysRemaining)}`}>
                        {emp.daysRemaining < 0
                          ? t('employees:residency.expiredDaysAgo', { count: Math.abs(emp.daysRemaining) })
                          : t('employees:residency.daysRemainingValue', { count: emp.daysRemaining })}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
