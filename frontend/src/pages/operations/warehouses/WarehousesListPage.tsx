import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useWarehouses, useCreateWarehouse, useUpdateWarehouse } from '../../../api/queries/useStockInventory';
import { PageHeader } from '../../../components/PageHeader/PageHeader';
import { LoadingState } from '../../../components/LoadingState/LoadingState';
import { ErrorState } from '../../../components/ErrorState/ErrorState';
import { Modal } from '../../../components/Modal/Modal';
import { FormField, TextInput } from '../../../components/Form/FormField';
import { PermissionGate } from '../../../rbac/PermissionGate';
import { PERMISSIONS } from '../../../rbac/permissionConstants';
import { ApiError } from '../../../api/client';

export function WarehousesListPage() {
  const { t } = useTranslation(['warehouses', 'common']);
  const navigate = useNavigate();
  const { data: warehouses, isLoading, error } = useWarehouses();
  const createMutation = useCreateWarehouse();
  const updateMutation = useUpdateWarehouse();

  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    createMutation.mutate(
      { name, address: address || undefined },
      {
        onSuccess: () => {
          setCreateOpen(false);
          setName('');
          setAddress('');
        },
        onError: (err) => setFormError(err instanceof ApiError ? err.message : 'Something went wrong.'),
      },
    );
  };

  const toggleActive = (id: string, isActive: boolean) => {
    updateMutation.mutate({ id, input: { isActive: !isActive } });
  };

  return (
    <div>
      <PageHeader
        title={t('warehouses:title')}
        action={
          <PermissionGate requires={PERMISSIONS.Operations.warehouses.manage}>
            <button type="button" onClick={() => setCreateOpen(true)} className="rounded bg-primary px-3 py-1.5 text-sm font-medium text-primary-fg hover:opacity-90">
              {t('warehouses:action.add')}
            </button>
          </PermissionGate>
        }
      />

      {isLoading && <LoadingState />}
      {error && <ErrorState message={error instanceof ApiError ? error.message : undefined} />}

      {warehouses && (
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-start text-sm">
            <thead className="bg-surface-muted text-xs uppercase text-ink-muted">
              <tr>
                <th className="p-3 text-start">{t('warehouses:fields.name')}</th>
                <th className="p-3 text-start">{t('warehouses:fields.address')}</th>
                <th className="p-3 text-start">{t('warehouses:fields.status')}</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {warehouses.map((wh) => (
                <tr key={wh.id} className="cursor-pointer hover:bg-surface-muted" onClick={() => navigate(`/ops/stock-items?warehouseId=${wh.id}`)}>
                  <td className="p-3 font-medium text-ink">{wh.name}</td>
                  <td className="p-3 text-ink-muted">{wh.address ?? '—'}</td>
                  <td className="p-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${wh.isActive ? 'bg-success/10 text-success' : 'bg-surface-muted text-ink-muted'}`}>
                      {wh.isActive ? t('warehouses:status.active') : t('warehouses:status.inactive')}
                    </span>
                  </td>
                  <td className="p-3 text-end" onClick={(e) => e.stopPropagation()}>
                    <PermissionGate requires={PERMISSIONS.Operations.warehouses.manage}>
                      <button type="button" onClick={() => toggleActive(wh.id, wh.isActive)} className="text-sm font-medium text-primary hover:underline">
                        {wh.isActive ? t('warehouses:action.deactivate') : t('warehouses:action.activate')}
                      </button>
                    </PermissionGate>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={createOpen} onOpenChange={setCreateOpen} title={t('warehouses:action.add')}>
        <form onSubmit={handleCreate} noValidate>
          <FormField label={t('warehouses:fields.name')} htmlFor="warehouseName" required>
            <TextInput id="warehouseName" value={name} onChange={(e) => setName(e.target.value)} required />
          </FormField>
          <FormField label={t('warehouses:fields.address')} htmlFor="warehouseAddress">
            <TextInput id="warehouseAddress" value={address} onChange={(e) => setAddress(e.target.value)} />
          </FormField>

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
