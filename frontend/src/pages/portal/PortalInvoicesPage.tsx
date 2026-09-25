import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { usePortalInvoices } from '../../api/queries/usePortal';
import { LoadingState } from '../../components/LoadingState/LoadingState';
import { ErrorState } from '../../components/ErrorState/ErrorState';
import { StatusBadge } from '../../components/StatusBadge/StatusBadge';
import { FinancialValue } from '../../components/dashboard/FinancialValue';
import { ApiError } from '../../api/client';

export function PortalInvoicesPage() {
  const { t } = useTranslation(['portal', 'common']);
  const navigate = useNavigate();
  const { data, isLoading, error } = usePortalInvoices();

  if (isLoading) return <LoadingState variant="card" />;
  if (error) {
    const apiError = error instanceof ApiError ? error : null;
    return <ErrorState variant="generic" message={apiError?.message} />;
  }

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold text-ink">{t('portal:invoices.title')}</h1>

      {data && data.length === 0 && <p className="text-sm text-ink-muted">{t('portal:invoices.empty')}</p>}

      {data && data.length > 0 && (
        <table className="w-full text-start text-sm">
          <thead className="border-b border-border text-xs uppercase text-ink-muted">
            <tr>
              <th className="pb-2 text-start">{t('portal:columns.number')}</th>
              <th className="pb-2 text-start">{t('portal:columns.date')}</th>
              <th className="pb-2 text-start">{t('portal:columns.total')}</th>
              <th className="pb-2 text-start">{t('portal:invoices.remaining')}</th>
              <th className="pb-2 text-start">{t('portal:columns.status')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {data.map((inv) => {
              const remaining = (Number(inv.total) - Number(inv.amountPaid)).toFixed(2);
              return (
                <tr key={inv.id} className="cursor-pointer hover:bg-surface" onClick={() => navigate(`/portal/invoices/${inv.id}`)}>
                  <td className="py-2 font-medium text-ink">{inv.invoiceNumber}</td>
                  <td className="py-2 text-ink-muted">{inv.issueDate.slice(0, 10)}</td>
                  <td className="py-2"><FinancialValue value={inv.total} /></td>
                  <td className="py-2"><FinancialValue value={remaining} /></td>
                  <td className="py-2"><StatusBadge entity="invoice" value={inv.status} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
