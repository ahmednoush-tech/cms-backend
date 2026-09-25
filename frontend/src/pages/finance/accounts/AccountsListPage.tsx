import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAccounts, useCreateAccount, useUpdateAccount } from '../../../api/queries/useFinance';
import { PageHeader } from '../../../components/PageHeader/PageHeader';
import { DataTable, type DataTableColumn } from '../../../components/DataTable/DataTable';
import { SearchBar } from '../../../components/SearchBar/SearchBar';
import { FilterBar } from '../../../components/FilterBar/FilterBar';
import { PermissionGate } from '../../../rbac/PermissionGate';
import { PERMISSIONS } from '../../../rbac/permissionConstants';
import { ApiError } from '../../../api/client';
import { AccountFormModal, type CreateAccountFormValues, type EditAccountFormValues } from './AccountFormModal';
import type { Account, AccountType } from '../../../types/entities/finance';

export function AccountsListPage() {
  const { t } = useTranslation(['finance', 'common']);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [type, setType] = useState<AccountType | undefined>();
  const [modalMode, setModalMode] = useState<'create' | 'edit' | null>(null);
  const [editing, setEditing] = useState<Account | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const { data, isLoading, error } = useAccounts({ page, pageSize: 20, search: search || undefined, type });
  const createMutation = useCreateAccount();
  const updateMutation = useUpdateAccount(editing?.id ?? '');

  const columns: Array<DataTableColumn<Account>> = [
    { key: 'code', headerKey: 'finance:accounts.columns.code', render: (a) => a.code },
    { key: 'name', headerKey: 'finance:accounts.columns.name', render: (a) => a.name },
    { key: 'type', headerKey: 'finance:accounts.columns.type', render: (a) => t(`finance:accounts.type.${a.type}`) },
    { key: 'normalBalance', headerKey: 'finance:accounts.columns.normalBalance', render: (a) => t(`finance:accounts.normalBalance.${a.normalBalance}`) },
    { key: 'isActive', headerKey: 'finance:accounts.columns.status', render: (a) => (a.isActive ? t('finance:accounts.status.active') : t('finance:accounts.status.inactive')) },
    {
      key: 'actions',
      headerKey: 'common:action.edit',
      render: (a) => (
        <PermissionGate requires={PERMISSIONS.Finance.accounts.edit}>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setEditing(a); setFormError(null); setModalMode('edit'); }}
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
        title={t('finance:accounts.title')}
        action={
          <PermissionGate requires={PERMISSIONS.Finance.accounts.create}>
            <button type="button" onClick={() => { setEditing(null); setFormError(null); setModalMode('create'); }} className="rounded bg-primary px-3 py-1.5 text-sm font-medium text-primary-fg hover:opacity-90">
              {t('finance:accounts.action.create')}
            </button>
          </PermissionGate>
        }
      />

      <div className="mb-4">
        <SearchBar value={search} onChange={(v) => { setSearch(v); setPage(1); }} />
      </div>

      <FilterBar
        fields={[
          {
            key: 'type',
            labelKey: 'finance:accounts.filters.type',
            type: 'select',
            options: ['asset', 'liability', 'equity', 'revenue', 'expense'].map((tpe) => ({ value: tpe, labelKey: `finance:accounts.type.${tpe}` })),
          },
        ]}
        values={{ type }}
        onChange={(key, value) => { setPage(1); if (key === 'type') setType(value as AccountType | undefined); }}
        onClear={() => { setType(undefined); setPage(1); }}
      />

      <DataTable
        columns={columns}
        rows={data?.items}
        rowKey={(a) => a.id}
        isLoading={isLoading}
        error={error}
        meta={data?.meta}
        onPageChange={setPage}
        emptyTitle={t('finance:accounts.empty.title')}
        emptyDescription={t('finance:accounts.empty.description')}
      />

      <AccountFormModal
        open={modalMode !== null}
        onOpenChange={(open) => { if (!open) { setModalMode(null); setFormError(null); } }}
        mode={modalMode ?? 'create'}
        initialValues={editing ?? undefined}
        isSubmitting={createMutation.isPending || updateMutation.isPending}
        submitError={formError}
        onSubmitCreate={(values: CreateAccountFormValues) => {
          setFormError(null);
          createMutation.mutate(
            { ...values, parentId: values.parentId || undefined, cashFlowCategory: values.cashFlowCategory || undefined, zakatCategory: values.zakatCategory || undefined },
            { onSuccess: () => setModalMode(null), onError: (err) => setFormError(err instanceof ApiError ? err.message : t('common:error.generic')) },
          );
        }}
        onSubmitEdit={(values: EditAccountFormValues) => {
          setFormError(null);
          updateMutation.mutate(
            { ...values, cashFlowCategory: values.cashFlowCategory || undefined, zakatCategory: values.zakatCategory || undefined },
            {
              onSuccess: () => setModalMode(null),
              onError: (err) => setFormError(err instanceof ApiError ? err.message : t('common:error.generic')),
            },
          );
        }}
      />
    </div>
  );
}
