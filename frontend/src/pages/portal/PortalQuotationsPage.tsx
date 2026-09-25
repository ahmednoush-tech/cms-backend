import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { usePortalQuotations } from '../../api/queries/usePortal';
import { LoadingState } from '../../components/LoadingState/LoadingState';
import { ErrorState } from '../../components/ErrorState/ErrorState';
import { StatusBadge } from '../../components/StatusBadge/StatusBadge';
import { FinancialValue } from '../../components/dashboard/FinancialValue';
import { ApiError } from '../../api/client';

export function PortalQuotationsPage() {
  const { t } = useTranslation(['portal', 'common']);
  const navigate = useNavigate();
  const { data, isLoading, error } = usePortalQuotations();

  if (isLoading) return <LoadingState variant="card" />;
  if (error) {
    const apiError = error instanceof ApiError ? error : null;
    return <ErrorState variant="generic" message={apiError?.message} />;
  }

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold text-ink">{t('portal:quotations.title')}</h1>

      {data && data.length === 0 && <p className="text-sm text-ink-muted">{t('portal:quotations.empty')}</p>}

      {data && data.length > 0 && (
        <table className="w-full text-start text-sm">
          <thead className="border-b border-border text-xs uppercase text-ink-muted">
            <tr>
              <th className="pb-2 text-start">{t('portal:columns.number')}</th>
              <th className="pb-2 text-start">{t('portal:columns.date')}</th>
              <th className="pb-2 text-start">{t('portal:columns.total')}</th>
              <th className="pb-2 text-start">{t('portal:columns.status')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {data.map((q) => (
              <tr key={q.id} className="cursor-pointer hover:bg-surface" onClick={() => navigate(`/portal/quotations/${q.id}`)}>
                <td className="py-2 font-medium text-ink">{q.quotationNumber}</td>
                <td className="py-2 text-ink-muted">{q.createdAt.slice(0, 10)}</td>
                <td className="py-2"><FinancialValue value={q.total} /></td>
                <td className="py-2"><StatusBadge entity="quotation" value={q.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
