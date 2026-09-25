import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { usePayrollRun, useProcessPayrollRun, usePayPayrollRun } from '../../api/queries/usePayroll';
import { PageHeader } from '../../components/PageHeader/PageHeader';
import { LoadingState } from '../../components/LoadingState/LoadingState';
import { ErrorState } from '../../components/ErrorState/ErrorState';
import { StatusBadge } from '../../components/StatusBadge/StatusBadge';
import { FinancialValue } from '../../components/dashboard/FinancialValue';
import { ConfirmDialog } from '../../components/ConfirmDialog/ConfirmDialog';
import { PermissionGate } from '../../rbac/PermissionGate';
import { PERMISSIONS } from '../../rbac/permissionConstants';
import { ApiError } from '../../api/client';

const MONTH_NAMES = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

export function PayrollRunDetailPage() {
  const { t } = useTranslation(['payroll', 'common']);
  const { id } = useParams<{ id: string }>();
  const { data: run, isLoading, error } = usePayrollRun(id);
  const processMutation = useProcessPayrollRun(id!);
  const payMutation = usePayPayrollRun(id!);
  const [confirmProcess, setConfirmProcess] = useState(false);
  const [confirmPay, setConfirmPay] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  if (isLoading) return <LoadingState variant="card" />;
  if (error || !run) {
    const apiError = error instanceof ApiError ? error : null;
    return <ErrorState variant="generic" message={apiError?.message} />;
  }

  return (
    <div>
      <PageHeader
        title={`${t(`payroll:month.${MONTH_NAMES[run.month - 1]}`)} ${run.year}`}
        breadcrumb={t('payroll:runs.title')}
        action={<StatusBadge entity="payrollRun" value={run.status} />}
      />

      <div className="mb-4 grid grid-cols-3 gap-3">
        <div className="rounded-lg border border-border bg-surface p-3">
          <p className="text-xs text-ink-muted">{t('payroll:runs.columns.gross')}</p>
          <p className="text-lg font-semibold"><FinancialValue value={run.totalGross} /></p>
        </div>
        <div className="rounded-lg border border-border bg-surface p-3">
          <p className="text-xs text-ink-muted">{t('payroll:runs.gosiTotal')}</p>
          <p className="text-lg font-semibold"><FinancialValue value={run.totalGosiEmployee} /></p>
          <p className="text-xs text-ink-muted">{t('payroll:runs.employerCost')}: <FinancialValue value={run.totalGosiEmployer} /></p>
        </div>
        <div className="rounded-lg border border-border bg-surface p-3">
          <p className="text-xs text-ink-muted">{t('payroll:runs.columns.net')}</p>
          <p className="text-lg font-semibold"><FinancialValue value={run.totalNet} /></p>
        </div>
      </div>

      <div className="mb-4 flex gap-2">
        {run.status === 'draft' && (
          <PermissionGate requires={PERMISSIONS.Payroll.runs.process}>
            <button type="button" onClick={() => { setActionError(null); setConfirmProcess(true); }} className="rounded bg-primary px-3 py-1.5 text-sm font-medium text-primary-fg hover:opacity-90">
              {t('payroll:runs.action.process')}
            </button>
          </PermissionGate>
        )}
        {run.status === 'processed' && (
          <PermissionGate requires={PERMISSIONS.Payroll.runs.pay}>
            <button type="button" onClick={() => { setActionError(null); setConfirmPay(true); }} className="rounded bg-primary px-3 py-1.5 text-sm font-medium text-primary-fg hover:opacity-90">
              {t('payroll:runs.action.pay')}
            </button>
          </PermissionGate>
        )}
      </div>
      {actionError && <p className="mb-4 rounded bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">{actionError}</p>}

      <table className="w-full text-start text-sm">
        <thead className="border-b border-border text-xs uppercase text-ink-muted">
          <tr>
            <th className="pb-2 text-start">{t('payroll:payslip.employee')}</th>
            <th className="pb-2 text-start">{t('employees:compensation.basicSalary')}</th>
            <th className="pb-2 text-start">{t('payroll:payslip.gross')}</th>
            <th className="pb-2 text-start">{t('payroll:payslip.gosiDeduction')}</th>
            <th className="pb-2 text-start">{t('payroll:payslip.net')}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {(run.payslips ?? []).map((p) => (
            <tr key={p.id}>
              <td className="py-2 font-medium text-ink">{p.employee ? `${p.employee.firstName} ${p.employee.lastName}` : '—'}</td>
              <td className="py-2"><FinancialValue value={p.basicSalary} /></td>
              <td className="py-2"><FinancialValue value={p.grossPay} /></td>
              <td className="py-2"><FinancialValue value={p.gosiEmployeeDeduction} /></td>
              <td className="py-2 font-medium"><FinancialValue value={p.netPay} /></td>
            </tr>
          ))}
        </tbody>
      </table>

      <ConfirmDialog
        open={confirmProcess}
        onOpenChange={setConfirmProcess}
        title={t('payroll:runs.processConfirmTitle')}
        message={t('payroll:runs.processConfirmMessage')}
        isLoading={processMutation.isPending}
        onConfirm={() =>
          processMutation.mutate(undefined, {
            onSuccess: () => setConfirmProcess(false),
            onError: (err) => { setConfirmProcess(false); setActionError(err instanceof ApiError ? err.message : t('common:error.generic')); },
          })
        }
      />
      <ConfirmDialog
        open={confirmPay}
        onOpenChange={setConfirmPay}
        title={t('payroll:runs.payConfirmTitle')}
        message={t('payroll:runs.payConfirmMessage')}
        isLoading={payMutation.isPending}
        onConfirm={() =>
          payMutation.mutate(undefined, {
            onSuccess: () => setConfirmPay(false),
            onError: (err) => { setConfirmPay(false); setActionError(err instanceof ApiError ? err.message : t('common:error.generic')); },
          })
        }
      />
    </div>
  );
}
