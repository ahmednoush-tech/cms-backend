import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { usePublicQuotation } from '../../api/queries/usePublicQuotation';
import { LoadingState } from '../../components/LoadingState/LoadingState';
import { FinancialValue } from '../../components/dashboard/FinancialValue';
import { resolveAssetUrl } from '../../lib/resolveAssetUrl';
import { ApiError } from '../../api/client';

/**
 * Reachable with NO login of any kind — anyone with the link or
 * QR code sees this. Deliberately its own standalone page (no
 * AppLayout, no PortalLayout, no Sidebar) since a prospect
 * clicking a shared link has no account and no reason to see
 * internal navigation.
 */
export function PublicQuotationPage() {
  const { t } = useTranslation(['quotations', 'common']);
  const { token } = useParams<{ token: string }>();
  const { data: quotation, isLoading, error } = usePublicQuotation(token);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoadingState variant="page" />
      </div>
    );
  }

  if (error || !quotation) {
    const apiError = error instanceof ApiError ? error : null;
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-2 p-4 text-center">
        <p className="text-lg font-medium text-ink">{t('quotations:publicView.notFoundTitle')}</p>
        <p className="text-sm text-ink-muted">{apiError?.status === 404 ? t('quotations:publicView.notFoundMessage') : t('common:error.generic')}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-muted p-4 md:p-8">
      <div className="mx-auto max-w-2xl rounded-lg border border-border bg-surface p-6 shadow-sm">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {quotation.company.logo && <img src={resolveAssetUrl(quotation.company.logo) ?? undefined} alt={quotation.company.name} className="h-10" />}
            <div>
              <p className="font-semibold text-ink">{quotation.company.name}</p>
              {quotation.company.phone && <p className="text-xs text-ink-muted">{quotation.company.phone}</p>}
            </div>
          </div>
          <div className="text-end">
            <p className="text-lg font-semibold text-ink">{quotation.quotationNumber}</p>
            <p className="text-xs text-ink-muted">{quotation.createdAt.slice(0, 10)}</p>
          </div>
        </div>

        <p className="mb-4 text-sm text-ink-muted">{t('quotations:publicView.preparedFor')}: <span className="font-medium text-ink">{quotation.customer.name}</span></p>

        <table className="w-full text-start text-sm">
          <thead className="border-b border-border text-xs uppercase text-ink-muted">
            <tr>
              <th className="pb-2 text-start">{t('quotations:detail.description')}</th>
              <th className="pb-2 text-start">{t('quotations:detail.quantity')}</th>
              <th className="pb-2 text-start">{t('quotations:detail.unitPrice')}</th>
              <th className="pb-2 text-start">{t('quotations:detail.lineTotal')}</th>
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
          <div className="flex justify-between text-ink-muted"><span>{t('quotations:detail.subtotal')}</span><FinancialValue value={quotation.subtotal} /></div>
          <div className="flex justify-between text-ink-muted"><span>{t('quotations:detail.discount')}</span><FinancialValue value={quotation.discount} /></div>
          <div className="flex justify-between text-ink-muted"><span>{t('quotations:detail.tax')}</span><FinancialValue value={quotation.tax} /></div>
          <div className="flex justify-between border-t border-border pt-1 text-base font-semibold text-ink"><span>{t('quotations:detail.total')}</span><FinancialValue value={quotation.total} /></div>
        </div>

        {quotation.validUntil && (
          <p className="mt-4 text-xs text-ink-muted">{t('quotations:publicView.validUntil')}: {quotation.validUntil.slice(0, 10)}</p>
        )}

        {(quotation.company.email || quotation.company.website) && (
          <p className="mt-6 border-t border-border pt-3 text-center text-xs text-ink-muted">
            {quotation.company.email}{quotation.company.email && quotation.company.website ? ' · ' : ''}{quotation.company.website}
          </p>
        )}
      </div>
    </div>
  );
}
