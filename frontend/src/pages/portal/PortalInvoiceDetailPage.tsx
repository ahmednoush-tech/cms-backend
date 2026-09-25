import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { usePortalInvoice } from '../../api/queries/usePortal';
import { LoadingState } from '../../components/LoadingState/LoadingState';
import { ErrorState } from '../../components/ErrorState/ErrorState';
import { StatusBadge } from '../../components/StatusBadge/StatusBadge';
import { FinancialValue } from '../../components/dashboard/FinancialValue';
import { ApiError } from '../../api/client';

export function PortalInvoiceDetailPage() {
  const { t } = useTranslation(['portal', 'common']);
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: invoice, isLoading, error } = usePortalInvoice(id);

  if (isLoading) return <LoadingState variant="card" />;
  if (error || !invoice) {
    const apiError = error instanceof ApiError ? error : null;
    return <ErrorState variant="generic" message={apiError?.message} />;
  }

  const remaining = (Number(invoice.total) - Number(invoice.amountPaid)).toFixed(2);

  return (
    <div>
      <button type="button" onClick={() => navigate('/portal/invoices')} className="mb-3 text-sm text-ink-muted hover:text-ink">
        {t('portal:backToList')}
      </button>

      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-ink">{invoice.invoiceNumber}</h1>
        <StatusBadge entity="invoice" value={invoice.status} />
      </div>

      <div className="mb-4 rounded-lg border border-border bg-surface p-4">
        <table className="w-full text-start text-sm">
          <thead className="border-b border-border text-xs uppercase text-ink-muted">
            <tr>
              <th className="pb-2 text-start">{t('portal:columns.description')}</th>
              <th className="pb-2 text-start">{t('portal:columns.quantity')}</th>
              <th className="pb-2 text-start">{t('portal:columns.unitPrice')}</th>
              <th className="pb-2 text-start">{t('portal:columns.total')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {invoice.items.map((item) => (
              <tr key={item.id}>
                <td className="py-2">{item.description}</td>
                <td className="py-2">{item.quantity}</td>
                <td className="py-2"><FinancialValue value={item.unitPrice} /></td>
                <td className="py-2"><FinancialValue value={item.total} /></td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-4 space-y-1 border-t border-border pt-3 text-sm">
          <div className="flex justify-between text-ink-muted"><span>{t('portal:totals.subtotal')}</span><FinancialValue value={invoice.subtotal} /></div>
          <div className="flex justify-between text-ink-muted"><span>{t('portal:totals.discount')}</span><FinancialValue value={invoice.discount} /></div>
          <div className="flex justify-between text-ink-muted"><span>{t('portal:totals.tax')}</span><FinancialValue value={invoice.tax} /></div>
          <div className="flex justify-between border-t border-border pt-1 font-semibold text-ink"><span>{t('portal:totals.total')}</span><FinancialValue value={invoice.total} /></div>
          <div className="flex justify-between text-ink-muted"><span>{t('portal:invoices.paid')}</span><FinancialValue value={invoice.amountPaid} /></div>
          <div className="flex justify-between font-semibold text-ink"><span>{t('portal:invoices.remaining')}</span><FinancialValue value={remaining} /></div>
        </div>
      </div>

      {invoice.payments.length > 0 && (
        <div className="rounded-lg border border-border bg-surface p-4">
          <p className="mb-2 text-sm font-medium text-ink">{t('portal:invoices.paymentHistory')}</p>
          <table className="w-full text-start text-sm">
            <tbody className="divide-y divide-border">
              {invoice.payments.map((p) => (
                <tr key={p.id}>
                  <td className="py-1.5 text-ink-muted">{p.paymentDate.slice(0, 10)}</td>
                  <td className="py-1.5 text-ink-muted">{t(`portal:paymentMethod.${p.method}`, p.method)}</td>
                  <td className="py-1.5 text-end"><FinancialValue value={p.amount} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
