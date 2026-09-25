import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useBankReconciliations } from '../../../api/queries/useBankReconciliations';
import { PageHeader } from '../../../components/PageHeader/PageHeader';
import { LoadingState } from '../../../components/LoadingState/LoadingState';
import { ErrorState } from '../../../components/ErrorState/ErrorState';
import { FinancialValue } from '../../../components/dashboard/FinancialValue';
import { PermissionGate } from '../../../rbac/PermissionGate';
import { PERMISSIONS } from '../../../rbac/permissionConstants';
import { ApiError } from '../../../api/client';

export function BankReconciliationsListPage() {
  const { t } = useTranslation(['bankReconciliation', 'common']);
  const navigate = useNavigate();
  const { data: reconciliations, isLoading, error } = useBankReconciliations();

  if (isLoading) return <LoadingState variant="page" />;
  if (error) {
    const apiError = error instanceof ApiError ? error : null;
    return <ErrorState variant="generic" message={apiError?.message} />;
  }

  return (
    <div>
      <PageHeader
        title={t('bankReconciliation:title')}
        action={
          <PermissionGate requires={PERMISSIONS.Finance.bankReconciliation.create}>
            <button
              type="button"
              onClick={() => navigate('/finance/bank-reconciliation/new')}
              className="rounded bg-primary px-3 py-1.5 text-sm font-medium text-primary-fg hover:opacity-90"
            >
              {t('bankReconciliation:actions.new')}
            </button>
          </PermissionGate>
        }
      />

      {(reconciliations ?? []).length === 0 ? (
        <div className="rounded-lg border border-border bg-surface p-8 text-center">
          <p className="text-sm font-medium text-ink">{t('bankReconciliation:empty.title')}</p>
          <p className="mt-1 text-sm text-ink-muted">{t('bankReconciliation:empty.description')}</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-surface">
          <table className="w-full text-start text-sm">
            <thead className="border-b border-border text-xs uppercase text-ink-muted">
              <tr>
                <th className="p-3 text-start">{t('bankReconciliation:columns.bankAccount')}</th>
                <th className="p-3 text-start">{t('bankReconciliation:columns.statementDate')}</th>
                <th className="p-3 text-start">{t('bankReconciliation:columns.statementBalance')}</th>
                <th className="p-3 text-start">{t('bankReconciliation:columns.status')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {reconciliations!.map((recon) => (
                <tr key={recon.id} onClick={() => navigate(`/finance/bank-reconciliation/${recon.id}`)} className="cursor-pointer hover:bg-surface-muted">
                  <td className="p-3">{recon.bankAccount?.code} — {recon.bankAccount?.name}</td>
                  <td className="p-3">{recon.statementDate.slice(0, 10)}</td>
                  <td className="p-3"><FinancialValue value={recon.statementEndingBalance} /></td>
                  <td className="p-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${recon.status === 'completed' ? 'bg-success/15 text-success' : 'bg-warning/15 text-warning'}`}>
                      {t(`bankReconciliation:status.${recon.status}`)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
