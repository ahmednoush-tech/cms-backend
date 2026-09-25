import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { usePayrollRuns, useCreatePayrollRun } from '../../api/queries/usePayroll';
import { PageHeader } from '../../components/PageHeader/PageHeader';
import { LoadingState } from '../../components/LoadingState/LoadingState';
import { ErrorState } from '../../components/ErrorState/ErrorState';
import { StatusBadge } from '../../components/StatusBadge/StatusBadge';
import { FinancialValue } from '../../components/dashboard/FinancialValue';
import { PermissionGate } from '../../rbac/PermissionGate';
import { PERMISSIONS } from '../../rbac/permissionConstants';
import { ApiError } from '../../api/client';

const MONTH_NAMES = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

export function PayrollRunsListPage() {
  const { t } = useTranslation(['payroll', 'common']);
  const navigate = useNavigate();
  const { data: runs, isLoading, error } = usePayrollRuns();
  const createMutation = useCreatePayrollRun();

  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [createError, setCreateError] = useState<string | null>(null);
  const [skippedNotice, setSkippedNotice] = useState<string[] | null>(null);

  const handleCreate = () => {
    setCreateError(null);
    setSkippedNotice(null);
    createMutation.mutate(
      { month, year },
      {
        onSuccess: (run) => {
          if (run.skippedEmployees && run.skippedEmployees.length > 0) {
            setSkippedNotice(run.skippedEmployees);
          }
          navigate(`/payroll/runs/${run.id}`);
        },
        onError: (err) => setCreateError(err instanceof ApiError ? err.message : t('common:error.generic')),
      },
    );
  };

  return (
    <div>
      <PageHeader title={t('payroll:runs.title')} />

      <PermissionGate requires={PERMISSIONS.Payroll.runs.create}>
        <div className="mb-4 flex flex-wrap items-end gap-2 rounded-lg border border-border bg-surface p-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-muted" htmlFor="month">{t('payroll:runs.month')}</label>
            <select id="month" value={month} onChange={(e) => setMonth(Number(e.target.value))} className="rounded border border-border bg-surface px-2 py-1.5 text-sm text-ink">
              {MONTH_NAMES.map((m, i) => (
                <option key={m} value={i + 1}>{t(`payroll:month.${m}`)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-muted" htmlFor="year">{t('payroll:runs.year')}</label>
            <input id="year" type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} className="w-24 rounded border border-border bg-surface px-2 py-1.5 text-sm text-ink" />
          </div>
          <button type="button" onClick={handleCreate} disabled={createMutation.isPending} className="rounded bg-primary px-3 py-1.5 text-sm font-medium text-primary-fg hover:opacity-90 disabled:opacity-50">
            {createMutation.isPending ? t('common:action.processing') : t('payroll:runs.action.create')}
          </button>
        </div>
      </PermissionGate>

      {createError && <p className="mb-3 rounded bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">{createError}</p>}
      {skippedNotice && (
        <div className="mb-3 rounded border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-ink">
          <p className="mb-1 font-medium">{t('payroll:runs.skippedTitle')}</p>
          <ul className="list-inside list-disc">
            {skippedNotice.map((s) => <li key={s}>{s}</li>)}
          </ul>
        </div>
      )}

      {isLoading && <LoadingState variant="card" />}
      {error && (() => {
        const apiError = error instanceof ApiError ? error : null;
        return <ErrorState variant="generic" message={apiError?.message} />;
      })()}

      {runs && runs.length === 0 && <p className="text-sm text-ink-muted">{t('payroll:runs.empty')}</p>}

      {runs && runs.length > 0 && (
        <table className="w-full text-start text-sm">
          <thead className="border-b border-border text-xs uppercase text-ink-muted">
            <tr>
              <th className="pb-2 text-start">{t('payroll:runs.period')}</th>
              <th className="pb-2 text-start">{t('payroll:runs.columns.gross')}</th>
              <th className="pb-2 text-start">{t('payroll:runs.columns.gosi')}</th>
              <th className="pb-2 text-start">{t('payroll:runs.columns.net')}</th>
              <th className="pb-2 text-start">{t('finance:invoices.columns.status')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {runs.map((run) => (
              <tr key={run.id} className="cursor-pointer hover:bg-surface-muted" onClick={() => navigate(`/payroll/runs/${run.id}`)}>
                <td className="py-2 font-medium text-ink">{t(`payroll:month.${MONTH_NAMES[run.month - 1]}`)} {run.year}</td>
                <td className="py-2"><FinancialValue value={run.totalGross} /></td>
                <td className="py-2"><FinancialValue value={run.totalGosiEmployee} /></td>
                <td className="py-2"><FinancialValue value={run.totalNet} /></td>
                <td className="py-2"><StatusBadge entity="payrollRun" value={run.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
