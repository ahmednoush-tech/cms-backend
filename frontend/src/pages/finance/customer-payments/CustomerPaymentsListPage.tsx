import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useCustomerPayments } from '../../../api/queries/useFinance';
import { PageHeader } from '../../../components/PageHeader/PageHeader';
import { LoadingState } from '../../../components/LoadingState/LoadingState';
import { ErrorState } from '../../../components/ErrorState/ErrorState';
import { FinancialValue } from '../../../components/dashboard/FinancialValue';
import { PermissionGate } from '../../../rbac/PermissionGate';
import { PERMISSIONS } from '../../../rbac/permissionConstants';
import { ApiError } from '../../../api/client';

export function CustomerPaymentsListPage() {
  const { t } = useTranslation(['finance', 'common']);
  const navigate = useNavigate();
  const { data, isLoading, error } = useCustomerPayments();

  return (
    <div>
      <PageHeader
        title={t('finance:customerPayments.title')}
        action={
          <PermissionGate requires={PERMISSIONS.Finance.payments.create}>
            <button type="button" onClick={() => navigate('/finance/customer-payments/new')} className="rounded bg-primary px-3 py-1.5 text-sm font-medium text-primary-fg hover:opacity-90">
              {t('finance:customerPayments.action.create')}
            </button>
          </PermissionGate>
        }
      />

      {isLoading && <LoadingState variant="card" />}
      {error && (() => {
        const apiError = error instanceof ApiError ? error : null;
        return <ErrorState variant="generic" message={apiError?.message} />;
      })()}

      {data && data.length === 0 && (
        <p className="text-sm text-ink-muted">{t('finance:customerPayments.empty')}</p>
      )}

      {data && data.length > 0 && (
        <table className="w-full text-start text-sm">
          <thead className="border-b border-border text-xs uppercase text-ink-muted">
            <tr>
              <th className="pb-2 text-start">{t('finance:invoices.fields.paymentDate')}</th>
              <th className="pb-2 text-start">{t('finance:customerPayments.columns.amountReceived')}</th>
              <th className="pb-2 text-start">{t('finance:customerPayments.columns.allocatedTo')}</th>
              <th className="pb-2 text-start">{t('finance:customerPayments.unapplied')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {data.map((cp) => (
              <tr key={cp.id}>
                <td className="py-2">{cp.paymentDate.slice(0, 10)}</td>
                <td className="py-2"><FinancialValue value={cp.amount} /></td>
                <td className="py-2 text-ink-muted">
                  {(cp.payments ?? []).map((p) => p.invoice.invoiceNumber).join(', ') || '—'}
                </td>
                <td className="py-2">
                  {Number(cp.unappliedAmount) > 0 ? <FinancialValue value={cp.unappliedAmount} /> : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
