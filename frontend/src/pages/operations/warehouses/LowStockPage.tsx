import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useLowStock } from '../../../api/queries/useStockInventory';
import { PageHeader } from '../../../components/PageHeader/PageHeader';
import { LoadingState } from '../../../components/LoadingState/LoadingState';
import { ErrorState } from '../../../components/ErrorState/ErrorState';
import { EmptyState } from '../../../components/EmptyState/EmptyState';
import { ApiError } from '../../../api/client';

export function LowStockPage() {
  const { t } = useTranslation(['warehouses', 'common']);
  const navigate = useNavigate();
  const { data: lowStockEntries, isLoading, error } = useLowStock();

  return (
    <div>
      <PageHeader title={t('warehouses:lowStock.title')} />
      <p className="mb-4 max-w-2xl text-sm text-ink-muted">{t('warehouses:lowStock.description')}</p>

      {isLoading && <LoadingState />}
      {error && <ErrorState message={error instanceof ApiError ? error.message : undefined} />}
      {lowStockEntries && lowStockEntries.length === 0 && <EmptyState title={t('warehouses:lowStock.empty')} />}

      {lowStockEntries && lowStockEntries.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-start text-sm">
            <thead className="bg-surface-muted text-xs uppercase text-ink-muted">
              <tr>
                <th className="p-3 text-start">{t('warehouses:items.fields.sku')}</th>
                <th className="p-3 text-start">{t('warehouses:items.fields.name')}</th>
                <th className="p-3 text-start">{t('warehouses:lowStock.fields.totalQuantity')}</th>
                <th className="p-3 text-start">{t('warehouses:items.fields.reorderPoint')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {lowStockEntries.map((entry) => (
                <tr key={entry.item.id} className="cursor-pointer hover:bg-surface-muted" onClick={() => navigate(`/ops/stock-items/${entry.item.id}`)}>
                  <td className="p-3 font-medium text-ink">{entry.item.sku}</td>
                  <td className="p-3 text-ink">{entry.item.name}</td>
                  <td className="p-3">
                    <span className="rounded-full bg-danger/10 px-2 py-0.5 text-xs font-medium text-danger">
                      {entry.totalQuantity} {entry.item.unitOfMeasure}
                    </span>
                  </td>
                  <td className="p-3 text-ink-muted">{entry.item.reorderPoint} {entry.item.unitOfMeasure}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
