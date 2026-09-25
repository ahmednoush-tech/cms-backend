import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  useInventoryItems,
  useCreateInventoryItem,
  useUpdateInventoryItem,
  useAdjustStock,
} from '../../../api/queries/useFinance';
import { PageHeader } from '../../../components/PageHeader/PageHeader';
import { DataTable, type DataTableColumn } from '../../../components/DataTable/DataTable';
import { SearchBar } from '../../../components/SearchBar/SearchBar';
import { PermissionGate } from '../../../rbac/PermissionGate';
import { PERMISSIONS } from '../../../rbac/permissionConstants';
import { ApiError } from '../../../api/client';
import { InventoryItemFormModal, type CreateInventoryItemFormValues, type EditInventoryItemFormValues } from './InventoryItemFormModal';
import { AdjustStockModal, type AdjustStockFormValues } from './AdjustStockModal';
import type { InventoryItem } from '../../../types/entities/finance';

export function InventoryItemsListPage() {
  const { t } = useTranslation(['finance', 'common']);
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [modalMode, setModalMode] = useState<'create' | 'edit' | null>(null);
  const [editing, setEditing] = useState<InventoryItem | null>(null);
  const [adjusting, setAdjusting] = useState<InventoryItem | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [adjustError, setAdjustError] = useState<string | null>(null);

  const { data, isLoading, error } = useInventoryItems({ page, pageSize: 20, search: search || undefined });
  const createMutation = useCreateInventoryItem();
  const updateMutation = useUpdateInventoryItem(editing?.id ?? '');
  const adjustMutation = useAdjustStock();

  const columns: Array<DataTableColumn<InventoryItem>> = [
    { key: 'sku', headerKey: 'finance:inventory.columns.sku', render: (i) => i.sku },
    { key: 'name', headerKey: 'finance:inventory.columns.name', render: (i) => i.name },
    { key: 'quantityOnHand', headerKey: 'finance:inventory.columns.quantityOnHand', render: (i) => `${i.quantityOnHand} ${i.unitOfMeasure}` },
    { key: 'averageUnitCost', headerKey: 'finance:inventory.columns.averageUnitCost', render: (i) => Number(i.averageUnitCost).toFixed(4) },
    {
      key: 'status',
      headerKey: 'finance:inventory.columns.status',
      render: (i) => (
        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${i.isActive ? 'bg-success/15 text-success' : 'bg-slate-200 text-ink-muted'}`}>
          {i.isActive ? t('finance:inventory.status.active') : t('finance:inventory.status.inactive')}
        </span>
      ),
    },
    {
      key: 'actions',
      headerKey: 'common:action.edit',
      render: (i) => (
        <div className="flex gap-3">
          <PermissionGate requires={PERMISSIONS.Finance.inventory.adjust}>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setAdjustError(null); setAdjusting(i); }}
              className="text-xs font-medium text-primary hover:underline"
            >
              {t('finance:inventory.action.adjustStock')}
            </button>
          </PermissionGate>
          <PermissionGate requires={PERMISSIONS.Finance.inventory.edit}>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setEditing(i); setFormError(null); setModalMode('edit'); }}
              className="text-xs font-medium text-ink hover:underline"
            >
              {t('common:action.edit')}
            </button>
          </PermissionGate>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); navigate(`/finance/inventory/${i.id}/movements`); }}
            className="text-xs font-medium text-ink-muted hover:underline"
          >
            {t('finance:inventory.action.viewMovements')}
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title={t('finance:inventory.title')}
        action={
          <PermissionGate requires={PERMISSIONS.Finance.inventory.create}>
            <button type="button" onClick={() => { setEditing(null); setFormError(null); setModalMode('create'); }} className="rounded bg-primary px-3 py-1.5 text-sm font-medium text-primary-fg hover:opacity-90">
              {t('finance:inventory.action.create')}
            </button>
          </PermissionGate>
        }
      />

      <div className="mb-4">
        <SearchBar value={search} onChange={(v) => { setSearch(v); setPage(1); }} />
      </div>

      <DataTable
        columns={columns}
        rows={data?.items}
        rowKey={(i) => i.id}
        isLoading={isLoading}
        error={error}
        meta={data?.meta}
        onPageChange={setPage}
        emptyTitle={t('finance:inventory.empty.title')}
        emptyDescription={t('finance:inventory.empty.description')}
      />

      <InventoryItemFormModal
        open={modalMode !== null}
        onOpenChange={(open) => { if (!open) { setModalMode(null); setFormError(null); } }}
        mode={modalMode ?? 'create'}
        initialValues={editing ?? undefined}
        isSubmitting={createMutation.isPending || updateMutation.isPending}
        submitError={formError}
        onSubmitCreate={(values: CreateInventoryItemFormValues) => {
          setFormError(null);
          createMutation.mutate(
            {
              sku: values.sku,
              name: values.name,
              description: values.description || undefined,
              unitOfMeasure: values.unitOfMeasure || undefined,
              openingQuantity: values.openingQuantity ? Number(values.openingQuantity) : undefined,
              openingUnitCost: values.openingUnitCost ? Number(values.openingUnitCost) : undefined,
              inventoryAccountId: values.inventoryAccountId || undefined,
              cogsAccountId: values.cogsAccountId || undefined,
            },
            { onSuccess: () => setModalMode(null), onError: (err) => setFormError(err instanceof ApiError ? err.message : t('common:error.generic')) },
          );
        }}
        onSubmitEdit={(values: EditInventoryItemFormValues) => {
          setFormError(null);
          updateMutation.mutate(
            { ...values, inventoryAccountId: values.inventoryAccountId || undefined, cogsAccountId: values.cogsAccountId || undefined },
            { onSuccess: () => setModalMode(null), onError: (err) => setFormError(err instanceof ApiError ? err.message : t('common:error.generic')) },
          );
        }}
      />

      {adjusting && (
        <AdjustStockModal
          open={!!adjusting}
          onOpenChange={(open) => !open && setAdjusting(null)}
          item={adjusting}
          isSubmitting={adjustMutation.isPending}
          submitError={adjustError}
          onSubmit={(values: AdjustStockFormValues) => {
            setAdjustError(null);
            adjustMutation.mutate(
              {
                inventoryItemId: adjusting.id,
                direction: values.direction,
                quantity: Number(values.quantity),
                unitCost: values.unitCost ? Number(values.unitCost) : undefined,
                offsetAccountId: values.offsetAccountId,
                notes: values.notes || undefined,
              },
              {
                onSuccess: () => setAdjusting(null),
                onError: (err) => setAdjustError(err instanceof ApiError ? err.message : t('common:error.generic')),
              },
            );
          }}
        />
      )}
    </div>
  );
}
