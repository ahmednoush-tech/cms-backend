import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { useInventoryItem, useInventoryMovements } from '../../../api/queries/useFinance';
import { PageHeader } from '../../../components/PageHeader/PageHeader';
import { LoadingState } from '../../../components/LoadingState/LoadingState';
import { ErrorState } from '../../../components/ErrorState/ErrorState';
import { ApiError } from '../../../api/client';

const MOVEMENT_LABEL_KEYS: Record<string, string> = {
  purchase: 'finance:inventory.movementType.purchase',
  sale: 'finance:inventory.movementType.sale',
  adjustment_increase: 'finance:inventory.movementType.adjustmentIncrease',
  adjustment_decrease: 'finance:inventory.movementType.adjustmentDecrease',
};

export function InventoryMovementsPage() {
  const { t } = useTranslation(['finance', 'common']);
  const { id } = useParams<{ id: string }>();
  const { data: item, isLoading: itemLoading, error: itemError } = useInventoryItem(id);
  const { data: movements, isLoading: movementsLoading, error: movementsError } = useInventoryMovements(id);

  if (itemLoading || movementsLoading) return <LoadingState variant="card" />;
  if (itemError || movementsError) {
    const apiError = (itemError ?? movementsError) as unknown;
    const err = apiError instanceof ApiError ? apiError : null;
    return <ErrorState variant={err?.status === 404 ? 'not-found' : 'generic'} message={err?.message} />;
  }
  if (!item) return null;

  return (
    <div>
      <PageHeader title={t('finance:inventory.movements.title')} breadcrumb={`${item.sku} — ${item.name}`} />

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-border bg-surface p-3">
          <p className="text-xs text-ink-muted">{t('finance:inventory.columns.quantityOnHand')}</p>
          <p className="text-lg font-semibold text-ink">{item.quantityOnHand} {item.unitOfMeasure}</p>
        </div>
        <div className="rounded-lg border border-border bg-surface p-3">
          <p className="text-xs text-ink-muted">{t('finance:inventory.columns.averageUnitCost')}</p>
          <p className="text-lg font-semibold text-ink">{Number(item.averageUnitCost).toFixed(4)}</p>
        </div>
      </div>

      {(movements ?? []).length === 0 ? (
        <p className="text-sm text-ink-muted">{t('finance:inventory.movements.empty')}</p>
      ) : (
        <table className="w-full text-start text-sm">
          <thead className="border-b border-border text-xs uppercase text-ink-muted">
            <tr>
              <th className="pb-2 text-start">{t('finance:reports.statement.date')}</th>
              <th className="pb-2 text-start">{t('finance:inventory.movements.type')}</th>
              <th className="pb-2 text-end">{t('finance:inventory.movements.quantity')}</th>
              <th className="pb-2 text-end">{t('finance:inventory.movements.unitCost')}</th>
              <th className="pb-2 text-end">{t('finance:inventory.movements.quantityAfter')}</th>
              <th className="pb-2 text-end">{t('finance:inventory.movements.averageCostAfter')}</th>
              <th className="pb-2 text-start">{t('finance:invoices.fields.reference')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {(movements ?? []).map((m) => (
              <tr key={m.id}>
                <td className="py-2">{m.createdAt.slice(0, 10)}</td>
                <td className="py-2">{t(MOVEMENT_LABEL_KEYS[m.movementType])}</td>
                <td className="py-2 text-end">{m.quantity}</td>
                <td className="py-2 text-end">{Number(m.unitCost).toFixed(4)}</td>
                <td className="py-2 text-end">{m.quantityAfter}</td>
                <td className="py-2 text-end">{Number(m.averageCostAfter).toFixed(4)}</td>
                <td className="py-2 text-ink-muted">{m.reference ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
