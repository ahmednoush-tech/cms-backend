import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { usePortalQuotation } from '../../api/queries/usePortal';
import { LoadingState } from '../../components/LoadingState/LoadingState';
import { ErrorState } from '../../components/ErrorState/ErrorState';
import { StatusBadge } from '../../components/StatusBadge/StatusBadge';
import { FinancialValue } from '../../components/dashboard/FinancialValue';
import { ApiError } from '../../api/client';

export function PortalQuotationDetailPage() {
  const { t } = useTranslation(['portal', 'common']);
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: quotation, isLoading, error } = usePortalQuotation(id);

  if (isLoading) return <LoadingState variant="card" />;
  if (error || !quotation) {
    const apiError = error instanceof ApiError ? error : null;
    return <ErrorState variant="generic" message={apiError?.message} />;
  }

  return (
    <div>
      <button type="button" onClick={() => navigate('/portal/quotations')} className="mb-3 text-sm text-ink-muted hover:text-ink">
        {t('portal:backToList')}
      </button>

      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-ink">{quotation.quotationNumber}</h1>
        <StatusBadge entity="quotation" value={quotation.status} />
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
            {quotation.items.map((item) => (
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
          <div className="flex justify-between text-ink-muted"><span>{t('portal:totals.subtotal')}</span><FinancialValue value={quotation.subtotal} /></div>
          <div className="flex justify-between text-ink-muted"><span>{t('portal:totals.discount')}</span><FinancialValue value={quotation.discount} /></div>
          <div className="flex justify-between text-ink-muted"><span>{t('portal:totals.tax')}</span><FinancialValue value={quotation.tax} /></div>
          <div className="flex justify-between border-t border-border pt-1 font-semibold text-ink"><span>{t('portal:totals.total')}</span><FinancialValue value={quotation.total} /></div>
        </div>
      </div>

      {quotation.validUntil && (
        <p className="text-xs text-ink-muted">{t('portal:quotations.validUntil')}: {quotation.validUntil.slice(0, 10)}</p>
      )}
    </div>
  );
}
