import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useVendors, useCreateVendor, useUpdateVendor } from '../../../api/queries/useFinance';
import { PageHeader } from '../../../components/PageHeader/PageHeader';
import { DataTable, type DataTableColumn } from '../../../components/DataTable/DataTable';
import { SearchBar } from '../../../components/SearchBar/SearchBar';
import { PermissionGate } from '../../../rbac/PermissionGate';
import { PERMISSIONS } from '../../../rbac/permissionConstants';
import { ApiError } from '../../../api/client';
import { VendorFormModal, type VendorFormValues } from './VendorFormModal';
import type { Vendor } from '../../../types/entities/finance';

export function VendorsListPage() {
  const { t } = useTranslation(['finance', 'common']);
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [modalMode, setModalMode] = useState<'create' | 'edit' | null>(null);
  const [editing, setEditing] = useState<Vendor | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const { data, isLoading, error } = useVendors({ page, pageSize: 20, search: search || undefined });
  const createMutation = useCreateVendor();
  const updateMutation = useUpdateVendor(editing?.id ?? '');

  const columns: Array<DataTableColumn<Vendor>> = [
    { key: 'vendorCode', headerKey: 'finance:vendors.columns.vendorCode', render: (v) => v.vendorCode },
    { key: 'name', headerKey: 'finance:vendors.columns.name', render: (v) => v.name },
    { key: 'email', headerKey: 'finance:vendors.columns.email', render: (v) => v.email ?? '—' },
    { key: 'status', headerKey: 'finance:vendors.columns.status', render: (v) => (v.status === 'active' ? t('finance:vendors.status.active') : t('finance:vendors.status.inactive')) },
    {
      key: 'actions',
      headerKey: 'common:action.edit',
      render: (v) => (
        <PermissionGate requires={PERMISSIONS.Finance.vendors.edit}>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setEditing(v); setFormError(null); setModalMode('edit'); }}
            className="text-xs font-medium text-primary hover:underline"
          >
            {t('common:action.edit')}
          </button>
        </PermissionGate>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title={t('finance:vendors.title')}
        action={
          <PermissionGate requires={PERMISSIONS.Finance.vendors.create}>
            <button type="button" onClick={() => { setEditing(null); setFormError(null); setModalMode('create'); }} className="rounded bg-primary px-3 py-1.5 text-sm font-medium text-primary-fg hover:opacity-90">
              {t('finance:vendors.action.create')}
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
        rowKey={(v) => v.id}
        onRowClick={(v) => navigate(`/finance/vendors/${v.id}`)}
        isLoading={isLoading}
        error={error}
        meta={data?.meta}
        onPageChange={setPage}
        emptyTitle={t('finance:vendors.empty.title')}
        emptyDescription={t('finance:vendors.empty.description')}
      />

      <VendorFormModal
        open={modalMode !== null}
        onOpenChange={(open) => { if (!open) { setModalMode(null); setFormError(null); } }}
        mode={modalMode ?? 'create'}
        initialValues={editing ?? undefined}
        isSubmitting={createMutation.isPending || updateMutation.isPending}
        submitError={formError}
        onSubmit={(values: VendorFormValues) => {
          setFormError(null);
          const payload = { ...values, email: values.email || undefined };
          if (modalMode === 'create') {
            createMutation.mutate(payload, {
              onSuccess: () => setModalMode(null),
              onError: (err) => setFormError(err instanceof ApiError ? err.message : t('common:error.generic')),
            });
          } else {
            updateMutation.mutate(payload, {
              onSuccess: () => setModalMode(null),
              onError: (err) => setFormError(err instanceof ApiError ? err.message : t('common:error.generic')),
            });
          }
        }}
      />
    </div>
  );
}
