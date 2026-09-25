import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useStockItems, useCreateStockItem, useDeactivateStockItem } from '../../../api/queries/useStockInventory';
import { PageHeader } from '../../../components/PageHeader/PageHeader';
import { LoadingState } from '../../../components/LoadingState/LoadingState';
import { ErrorState } from '../../../components/ErrorState/ErrorState';
import { EmptyState } from '../../../components/EmptyState/EmptyState';
import { Modal } from '../../../components/Modal/Modal';
import { FormField, TextInput } from '../../../components/Form/FormField';
import { PermissionGate } from '../../../rbac/PermissionGate';
import { PERMISSIONS } from '../../../rbac/permissionConstants';
import { ApiError } from '../../../api/client';

export function StockItemsListPage() {
  const { t } = useTranslation(['warehouses', 'common']);
  const navigate = useNavigate();
  const { data: items, isLoading, error } = useStockItems();
  const createMutation = useCreateStockItem();
  const deactivateMutation = useDeactivateStockItem();

  const [createOpen, setCreateOpen] = useState(false);
  const [sku, setSku] = useState('');
  const [name, setName] = useState('');
  const [unitOfMeasure, setUnitOfMeasure] = useState('');
  const [reorderPoint, setReorderPoint] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    createMutation.mutate(
      { sku, name, unitOfMeasure: unitOfMeasure || undefined, reorderPoint: reorderPoint ? Number(reorderPoint) : undefined },
      {
        onSuccess: () => {
          setCreateOpen(false);
          setSku('');
          setName('');
          setUnitOfMeasure('');
          setReorderPoint('');
        },
        onError: (err) => setFormError(err instanceof ApiError ? err.message : 'Something went wrong.'),
      },
    );
  };

  return (
    <div>
      <PageHeader
        title={t('warehouses:items.title')}
        action={
          <PermissionGate requires={PERMISSIONS.Operations.stockItems.manage}>
            <button type="button" onClick={() => setCreateOpen(true)} className="rounded bg-primary px-3 py-1.5 text-sm font-medium text-primary-fg hover:opacity-90">
              {t('warehouses:items.action.add')}
            </button>
          </PermissionGate>
        }
      />

      {isLoading && <LoadingState />}
      {error && <ErrorState message={error instanceof ApiError ? error.message : undefined} />}
      {items && items.length === 0 && <EmptyState title={t('warehouses:items.empty')} />}

      {items && items.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-start text-sm">
            <thead className="bg-surface-muted text-xs uppercase text-ink-muted">
              <tr>
                <th className="p-3 text-start">{t('warehouses:items.fields.sku')}</th>
                <th className="p-3 text-start">{t('warehouses:items.fields.name')}</th>
                <th className="p-3 text-start">{t('warehouses:items.fields.unitOfMeasure')}</th>
                <th className="p-3 text-start">{t('warehouses:items.fields.status')}</th>
                <PermissionGate requires={PERMISSIONS.Operations.stockItems.manage}>
                  <th className="p-3"></th>
                </PermissionGate>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.map((item) => (
                <tr key={item.id} className="cursor-pointer hover:bg-surface-muted" onClick={() => navigate(`/ops/stock-items/${item.id}`)}>
                  <td className="p-3 font-medium text-ink">{item.sku}</td>
                  <td className="p-3 text-ink">{item.name}</td>
                  <td className="p-3 text-ink-muted">{item.unitOfMeasure}</td>
                  <td className="p-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${item.isActive ? 'bg-success/10 text-success' : 'bg-surface-muted text-ink-muted'}`}>
                      {item.isActive ? t('warehouses:status.active') : t('warehouses:status.inactive')}
                    </span>
                  </td>
                  <PermissionGate requires={PERMISSIONS.Operations.stockItems.manage}>
                    <td className="p-3 text-end" onClick={(e) => e.stopPropagation()}>
                      {item.isActive && (
                        <button type="button" onClick={() => deactivateMutation.mutate(item.id)} className="text-sm font-medium text-danger hover:underline">
                          {t('warehouses:items.action.deactivate')}
                        </button>
                      )}
                    </td>
                  </PermissionGate>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={createOpen} onOpenChange={setCreateOpen} title={t('warehouses:items.action.add')}>
        <form onSubmit={handleCreate} noValidate>
          <FormField label={t('warehouses:items.fields.sku')} htmlFor="itemSku" required>
            <TextInput id="itemSku" value={sku} onChange={(e) => setSku(e.target.value)} required />
          </FormField>
          <FormField label={t('warehouses:items.fields.name')} htmlFor="itemName" required>
            <TextInput id="itemName" value={name} onChange={(e) => setName(e.target.value)} required />
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label={t('warehouses:items.fields.unitOfMeasure')} htmlFor="itemUom">
              <TextInput id="itemUom" value={unitOfMeasure} onChange={(e) => setUnitOfMeasure(e.target.value)} placeholder="unit" />
            </FormField>
            <FormField label={t('warehouses:items.fields.reorderPoint')} htmlFor="itemReorder">
              <TextInput id="itemReorder" type="number" min="0" value={reorderPoint} onChange={(e) => setReorderPoint(e.target.value)} />
            </FormField>
          </div>

          {formError && <p className="mb-3 rounded bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">{formError}</p>}

          <div className="mt-4 flex justify-end gap-2">
            <button type="button" onClick={() => setCreateOpen(false)} className="rounded border border-border px-3 py-1.5 text-sm font-medium text-ink hover:bg-surface-muted">
              {t('common:action.cancel')}
            </button>
            <button type="submit" disabled={createMutation.isPending} className="rounded bg-primary px-3 py-1.5 text-sm font-medium text-primary-fg hover:opacity-90 disabled:opacity-50">
              {createMutation.isPending ? t('common:action.processing') : t('common:action.save')}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
