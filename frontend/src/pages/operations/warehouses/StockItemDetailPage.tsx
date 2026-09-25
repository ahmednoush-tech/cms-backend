import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate } from 'react-router-dom';
import {
  useStockItem,
  useStockLevelsByItem,
  useStockMovementsForItem,
  useWarehouses,
  useReceiptMutation,
  useIssueMutation,
  useTransferMutation,
  useAdjustmentMutation,
} from '../../../api/queries/useStockInventory';
import { PageHeader } from '../../../components/PageHeader/PageHeader';
import { LoadingState } from '../../../components/LoadingState/LoadingState';
import { ErrorState } from '../../../components/ErrorState/ErrorState';
import { Modal } from '../../../components/Modal/Modal';
import { PermissionGate } from '../../../rbac/PermissionGate';
import { PERMISSIONS } from '../../../rbac/permissionConstants';
import { ApiError } from '../../../api/client';

type ActionKind = 'receipt' | 'issue' | 'transfer' | 'adjustment' | null;

export function StockItemDetailPage() {
  const { t } = useTranslation(['warehouses', 'common']);
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: item, isLoading, error } = useStockItem(id);
  const { data: stockLevels } = useStockLevelsByItem(id);
  const { data: movements } = useStockMovementsForItem(id);
  const { data: warehouses } = useWarehouses();

  const receiptMutation = useReceiptMutation();
  const issueMutation = useIssueMutation();
  const transferMutation = useTransferMutation();
  const adjustmentMutation = useAdjustmentMutation();

  const [action, setAction] = useState<ActionKind>(null);
  const [warehouseId, setWarehouseId] = useState('');
  const [toWarehouseId, setToWarehouseId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  const activeWarehouses = (warehouses ?? []).filter((w) => w.isActive);

  const resetForm = () => {
    setWarehouseId('');
    setToWarehouseId('');
    setQuantity('');
    setReason('');
    setActionError(null);
  };

  const openAction = (kind: ActionKind) => {
    resetForm();
    setAction(kind);
  };

  const isPending = receiptMutation.isPending || issueMutation.isPending || transferMutation.isPending || adjustmentMutation.isPending;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    setActionError(null);
    const onSuccess = () => setAction(null);
    const onError = (err: unknown) => setActionError(err instanceof ApiError ? err.message : 'Something went wrong.');

    if (action === 'receipt') {
      receiptMutation.mutate({ itemId: id, warehouseId, quantity: Number(quantity), reason: reason || undefined }, { onSuccess, onError });
    } else if (action === 'issue') {
      issueMutation.mutate({ itemId: id, warehouseId, quantity: Number(quantity), reason: reason || undefined }, { onSuccess, onError });
    } else if (action === 'transfer') {
      transferMutation.mutate(
        { itemId: id, fromWarehouseId: warehouseId, toWarehouseId, quantity: Number(quantity), reason: reason || undefined },
        { onSuccess, onError },
      );
    } else if (action === 'adjustment') {
      adjustmentMutation.mutate({ itemId: id, warehouseId, newQuantity: Number(quantity), reason: reason || undefined }, { onSuccess, onError });
    }
  };

  if (isLoading) return <LoadingState />;
  if (error) return <ErrorState message={error instanceof ApiError ? error.message : undefined} />;
  if (!item) return null;

  return (
    <div>
      <button type="button" onClick={() => navigate('/ops/stock-items')} className="mb-3 text-sm text-ink-muted hover:text-ink">
        ← {t('common:action.back')}
      </button>

      <PageHeader title={item.name} breadcrumb={item.sku} />
      {item.description && <p className="mb-4 text-sm text-ink-muted">{item.description}</p>}

      <PermissionGate requires={PERMISSIONS.Operations.stockMovements.create}>
        <div className="mb-6 flex flex-wrap gap-2">
          <button type="button" onClick={() => openAction('receipt')} className="rounded bg-primary px-3 py-1.5 text-sm font-medium text-primary-fg hover:opacity-90">
            {t('warehouses:movements.action.receipt')}
          </button>
          <button type="button" onClick={() => openAction('issue')} className="rounded border border-border px-3 py-1.5 text-sm font-medium text-ink hover:bg-surface-muted">
            {t('warehouses:movements.action.issue')}
          </button>
          <button type="button" onClick={() => openAction('transfer')} className="rounded border border-border px-3 py-1.5 text-sm font-medium text-ink hover:bg-surface-muted">
            {t('warehouses:movements.action.transfer')}
          </button>
          <button type="button" onClick={() => openAction('adjustment')} className="rounded border border-border px-3 py-1.5 text-sm font-medium text-ink hover:bg-surface-muted">
            {t('warehouses:movements.action.adjustment')}
          </button>
        </div>
      </PermissionGate>

      <div className="mb-6">
        <p className="mb-2 text-sm font-medium text-ink">{t('warehouses:items.stockByWarehouse')}</p>
        {(!stockLevels || stockLevels.length === 0) && <p className="text-sm text-ink-muted">{t('warehouses:items.noStock')}</p>}
        {stockLevels && stockLevels.length > 0 && (
          <div className="overflow-hidden rounded-lg border border-border">
            <table className="w-full text-start text-sm">
              <thead className="bg-surface-muted text-xs uppercase text-ink-muted">
                <tr>
                  <th className="p-3 text-start">{t('warehouses:title')}</th>
                  <th className="p-3 text-start">{t('warehouses:items.fields.quantityOnHand')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {stockLevels.map((level) => (
                  <tr key={level.id}>
                    <td className="p-3 text-ink">{level.warehouse?.name}</td>
                    <td className="p-3 font-medium text-ink">{level.quantityOnHand} {item.unitOfMeasure}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {movements && movements.length > 0 && (
        <div>
          <p className="mb-2 text-sm font-medium text-ink">{t('warehouses:movements.history')}</p>
          <div className="space-y-2">
            {movements.map((mv) => (
              <div key={mv.id} className="rounded border border-border p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-ink">{t(`warehouses:movements.type.${mv.movementType}`)}</span>
                  <span className="text-ink-muted">{mv.quantity} {item.unitOfMeasure}</span>
                </div>
                <p className="mt-1 text-xs text-ink-muted">
                  {mv.warehouse?.name} · {mv.performedByUser?.name} · {new Date(mv.createdAt).toLocaleString()}
                </p>
                {mv.reason && <p className="mt-1 text-ink-muted">{mv.reason}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      <Modal open={action !== null} onOpenChange={(open) => !open && setAction(null)} title={action ? t(`warehouses:movements.action.${action}`) : ''}>
        <form onSubmit={handleSubmit} noValidate>
          {action === 'transfer' ? (
            <>
              <div className="mb-3">
                <label className="mb-1 block text-xs font-medium text-ink-muted">{t('warehouses:movements.fields.fromWarehouse')}</label>
                <select required value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-ink">
                  <option value="">—</option>
                  {activeWarehouses.map((w) => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
              </div>
              <div className="mb-3">
                <label className="mb-1 block text-xs font-medium text-ink-muted">{t('warehouses:movements.fields.toWarehouse')}</label>
                <select required value={toWarehouseId} onChange={(e) => setToWarehouseId(e.target.value)} className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-ink">
                  <option value="">—</option>
                  {activeWarehouses.map((w) => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
              </div>
            </>
          ) : (
            <div className="mb-3">
              <label className="mb-1 block text-xs font-medium text-ink-muted">{t('warehouses:title')}</label>
              <select required value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-ink">
                <option value="">—</option>
                {activeWarehouses.map((w) => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </div>
          )}

          <div className="mb-3">
            <label className="mb-1 block text-xs font-medium text-ink-muted">
              {action === 'adjustment' ? t('warehouses:movements.fields.newQuantity') : t('warehouses:movements.fields.quantity')}
            </label>
            <input
              type="number"
              required
              min={action === 'adjustment' ? '0' : '0.01'}
              step="0.01"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-ink"
            />
          </div>

          <div className="mb-3">
            <label className="mb-1 block text-xs font-medium text-ink-muted">{t('warehouses:movements.fields.reason')}</label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-ink"
            />
          </div>

          {actionError && <p className="mb-3 rounded bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">{actionError}</p>}

          <div className="mt-4 flex justify-end gap-2">
            <button type="button" onClick={() => setAction(null)} className="rounded border border-border px-3 py-1.5 text-sm font-medium text-ink hover:bg-surface-muted">
              {t('common:action.cancel')}
            </button>
            <button type="submit" disabled={isPending} className="rounded bg-primary px-3 py-1.5 text-sm font-medium text-primary-fg hover:opacity-90 disabled:opacity-50">
              {isPending ? t('common:action.processing') : t('common:action.save')}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
